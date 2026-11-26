import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { AccountingDiary } from './AccountingDiary'
import { createIntegralBookWorkbook, downloadReport, printIntegralBookReport } from '../lib/report-export'

vi.mock('../lib/report-export', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/report-export')>()
  return {
    ...actual,
    createIntegralBookWorkbook: vi.fn().mockResolvedValue(new Blob(['xlsx-diary'])),
    downloadReport: vi.fn(),
    printIntegralBookReport: vi.fn(),
  }
})

function mockClient(options?: { integralOk?: boolean; errorCode?: string }) {
  const integralOk = options?.integralOk ?? true
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  })

  const rpc = vi.fn().mockImplementation((fnName: string) => {
    if (options?.errorCode) {
      return Promise.resolve({ data: null, error: { code: options.errorCode, message: 'denied' } })
    }
    if (fnName === 'read_tenant_accounting_diary_summary') {
      return Promise.resolve({
        data: {
          organization_id: 'org-1',
          from_date: '2026-10-01',
          to_date: '2026-10-31',
          date_basis: 'event_date',
          total_count: 1,
          total_debit: '120.00',
          total_credit: '120.00',
          balanced: true,
          unmapped_count: integralOk ? 0 : 1,
          legacy_non_posting_count: 0,
          integral_ok: integralOk,
          incomplete_reasons: integralOk ? [] : ['unmapped_entries_in_period'],
          plans: [{ id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' }],
          report_classification: 'gerencial_nao_fiscal',
        },
        error: null,
      })
    }
    if (fnName === 'read_tenant_accounting_diary') {
      return Promise.resolve({
        data: [
          {
            entry_seq: 1,
            entry_id: 'entry-uuid-1',
            organization_id: 'org-1',
            accounting_period: '2026-10-01',
            competence: '2026-10-01',
            event_date: '2026-10-05',
            created_at: '2026-10-05T10:00:00Z',
            event_type: 'member_payment_reversal',
            source_table: 'payment_reversals',
            source_id: 'rev-11111111',
            reference_event_id: 'pay-22222222',
            is_reversal_or_correction: true,
            accounting_plan_id: 'plan-1',
            plan_name: 'Plano 2026',
            debit_account_id: 'acc-lib',
            debit_account_code: '2.1.01.01',
            debit_account_description: 'Adiantamentos',
            debit_role: 'member_advance_liability',
            credit_account_id: integralOk ? 'acc-bank' : null,
            credit_account_code: integralOk ? '1.1.01.02' : null,
            credit_account_description: integralOk ? 'Banco Principal' : null,
            credit_role: 'financial_account',
            amount: '120.00',
            description: 'Estorno de pagamento',
            reason: 'Duplicidade',
            is_fully_mapped: integralOk,
            mapping_gap_reason: integralOk ? null : 'Conta financeira sem vínculo contábil',
          },
        ],
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })

  return { client: { from, rpc } as unknown as SupabaseClient, rpc }
}

describe('AccountingDiary component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries diary, renders balanced double-entry row with reversal trace, and exports XLSX/PDF', async () => {
    const { client } = mockClient({ integralOk: true })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    expect(await screen.findByText('Equilibrado e Integral')).toBeInTheDocument()
    expect(screen.getByText('Estorno/Retificação')).toBeInTheDocument()
    expect(screen.getByText('1.1.01.02 — Banco Principal')).toBeInTheDocument()

    const xlsxBtn = screen.getByRole('button', { name: /Exportar Diário Integral/ })
    expect(xlsxBtn).toBeEnabled()
    fireEvent.click(xlsxBtn)

    await waitFor(() => expect(downloadReport).toHaveBeenCalled())
    expect(createIntegralBookWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({ bookType: 'DIARIO', integralOk: true, expectedTotalCount: 1 }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Imprimir \/ PDF Integral/ }))
    await waitFor(() => expect(printIntegralBookReport).toHaveBeenCalled())
  })

  it('blocks integral exports fail-closed when unmapped entries exist', async () => {
    const { client } = mockClient({ integralOk: false })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    expect(await screen.findByText('Selo Integral bloqueado neste período:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar Diário Integral/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Imprimir \/ PDF Integral/ })).toBeDisabled()
  })

  it('displays clear permission denial message on SQLSTATE 42501', async () => {
    const { client } = mockClient({ errorCode: '42501' })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))
    expect(await screen.findByText(/não possui permissão/)).toBeInTheDocument()
  })
})
