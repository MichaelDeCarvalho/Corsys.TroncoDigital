import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { AccountingLedger } from './AccountingLedger'
import { createIntegralBookWorkbook, downloadReport } from '../lib/report-export'

vi.mock('../lib/report-export', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/report-export')>()
  return {
    ...actual,
    createIntegralBookWorkbook: vi.fn().mockResolvedValue(new Blob(['xlsx-ledger'])),
    downloadReport: vi.fn(),
    printIntegralBookReport: vi.fn(),
  }
})

function mockClient(integralOk = true) {
  const from = vi.fn().mockImplementation((table: string) => {
    let data: unknown[] = []
    if (table === 'accounting_plans') {
      data = [{ id: 'plan-1', organization_id: 'org-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' }]
    } else if (table === 'accounting_accounts') {
      data = [
        {
          id: 'acc-ctrl',
          organization_id: 'org-1',
          accounting_plan_id: 'plan-1',
          code: '1.1.02.01',
          description: 'Contribuições a Receber',
          nature: 'patrimonial',
          row_type: 'analytic',
          active: true,
          parent_account_id: null,
        },
      ]
    } else if (table === 'accounting_plan_templates') {
      data = [{ id: 't-1', name: 'Padrão', version: 1, active: true }]
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data, error: null }),
    }
  })

  const rpc = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'read_tenant_accounting_ledger') {
      return Promise.resolve({
        data: {
          organization_id: 'org-1',
          from_date: '2026-10-01',
          to_date: '2026-10-31',
          date_basis: 'event_date',
          page: 0,
          page_size: 100,
          total_count: 1,
          account: { id: 'acc-ctrl', code: '1.1.02.01', description: 'Contribuições a Receber', nature: 'patrimonial', row_type: 'analytic' },
          plan: { id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' },
          opening_balance: '100.00',
          opening_balance_dc: 'D',
          opening_balance_source: 'prior_entries',
          period_debit_total: '150.00',
          period_credit_total: '0.00',
          closing_balance: '250.00',
          closing_balance_dc: 'D',
          reconciles_with_diary: true,
          unmapped_count: integralOk ? 0 : 1,
          legacy_non_posting_count: 0,
          integral_ok: integralOk,
          incomplete_reasons: integralOk ? [] : ['unmapped_entries'],
          report_classification: 'gerencial_nao_fiscal',
          entries: [
            {
              entry_seq: 1,
              entry_id: 'e-1',
              event_date: '2026-10-10',
              competence: '2026-10-01',
              accounting_period: '2026-10-01',
              event_type: 'member_charge',
              source_table: 'charges',
              source_id: 'chg-11111111',
              reference_event_id: null,
              is_reversal_or_correction: false,
              debit_amount: '150.00',
              credit_amount: '0.00',
              running_balance: '250.00',
              balance_dc: 'D',
              counterpart_code: '3.1.01.01',
              counterpart_description: 'Mensalidades',
              description: 'Mensalidade',
              reason: null,
              is_fully_mapped: true,
              mapping_gap_reason: null,
            },
          ],
        },
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  })

  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('AccountingLedger component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders opening balance derivation, running D/C balance, and allows integral XLSX export', async () => {
    const { client } = mockClient(true)
    render(<AccountingLedger client={client} organizationId="org-1" />)

    const queryBtn = await screen.findByRole('button', { name: 'Consultar Razão' })
    await waitFor(() => expect(queryBtn).toBeEnabled())
    fireEvent.click(queryBtn)

    expect(await screen.findByText('Derivado de partidas anteriores registradas')).toBeInTheDocument()
    expect(screen.getByText('Conciliado com o Diário')).toBeInTheDocument()
    expect(screen.getAllByText(/250,00 D/).length).toBeGreaterThanOrEqual(2)

    const xlsxBtn = screen.getByRole('button', { name: /Exportar Razão Integral/ })
    expect(xlsxBtn).toBeEnabled()
    fireEvent.click(xlsxBtn)

    await waitFor(() => expect(downloadReport).toHaveBeenCalled())
    expect(createIntegralBookWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({ bookType: 'RAZAO', integralOk: true }),
    )
  })

  it('disables integral exports when ledger seal is blocked', async () => {
    const { client } = mockClient(false)
    render(<AccountingLedger client={client} organizationId="org-1" />)

    const queryBtn = await screen.findByRole('button', { name: 'Consultar Razão' })
    await waitFor(() => expect(queryBtn).toBeEnabled())
    fireEvent.click(queryBtn)

    expect(await screen.findByText('Selo Integral bloqueado neste período:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar Razão Integral/ })).toBeDisabled()
  })
})
