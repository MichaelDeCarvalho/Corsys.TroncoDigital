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

function mockClient(options?: {
  integralOk?: boolean
  errorCode?: string
  transientFailures?: number
  transientMode?: 'timeout' | 'fetch'
  annualNineEntries?: boolean
}) {
  const integralOk = options?.integralOk ?? true
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  })

  const callsByRpc: Record<string, number> = {}

  const rpc = vi.fn().mockImplementation((fnName: string, params: Record<string, unknown> = {}) => {
    callsByRpc[fnName] = (callsByRpc[fnName] ?? 0) + 1
    if (options?.transientFailures && callsByRpc[fnName] <= options.transientFailures) {
      if (options.transientMode === 'fetch') {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      const err = new Error('The operation was aborted due to timeout')
      err.name = 'TimeoutError'
      return Promise.reject(err)
    }
    if (options?.errorCode) {
      return Promise.resolve({ data: null, error: { code: options.errorCode, message: 'denied' } })
    }
    const orgId = String(params.p_organization_id ?? 'org-1')
    const fromDate = String(params.p_from_date ?? '2026-11-01')
    const toDate = String(params.p_to_date ?? '2026-11-30')
    const dateBasis = String(params.p_date_basis ?? 'event_date')

    if (options?.annualNineEntries) {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({
          data: {
            organization_id: orgId,
            from_date: fromDate,
            to_date: toDate,
            date_basis: dateBasis,
            total_count: 9,
            total_debit: '34.00',
            total_credit: '34.00',
            balanced: true,
            unmapped_count: 1,
            legacy_non_posting_count: 0,
            integral_ok: false,
            incomplete_reasons: ['unmapped_entries_in_period'],
            plans: [{ id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' }],
            report_classification: 'gerencial_nao_fiscal',
          },
          error: null,
        })
      }
      if (fnName === 'read_tenant_accounting_diary') {
        const rows = Array.from({ length: 9 }, (_, i) => ({
          entry_seq: i + 1,
          entry_id: `entry-annual-${i + 1}`,
          organization_id: orgId,
          accounting_period: fromDate,
          competence: fromDate,
          event_date: fromDate,
          created_at: '2026-05-05T10:00:00Z',
          event_type: 'member_charge',
          source_table: 'charges',
          source_id: `chg-${i + 1}1111111`,
          reference_event_id: null,
          is_reversal_or_correction: false,
          accounting_plan_id: 'plan-1',
          plan_name: 'Plano 2026',
          debit_account_id: 'acc-ctrl',
          debit_account_code: '1.1.02.01',
          debit_account_description: 'Contribuições a Receber',
          debit_role: 'member_receivable_control',
          credit_account_id: i === 8 ? null : 'acc-rev',
          credit_account_code: i === 8 ? null : '3.1.01.01',
          credit_account_description: i === 8 ? null : 'Mensalidades',
          credit_role: 'category_revenue',
          amount: i === 8 ? '2.00' : '4.00',
          description: `Lançamento anual #${i + 1}`,
          reason: null,
          is_fully_mapped: i !== 8,
          mapping_gap_reason: i === 8 ? 'Conta sem vínculo contábil' : null,
        }))
        return Promise.resolve({ data: rows, error: null })
      }
    }

    if (fnName === 'read_tenant_accounting_diary_summary') {
      return Promise.resolve({
        data: {
          organization_id: orgId,
          from_date: fromDate,
          to_date: toDate,
          date_basis: dateBasis,
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
            organization_id: orgId,
            accounting_period: fromDate,
            competence: fromDate,
            event_date: fromDate,
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

  it('displays clear permission denial message on SQLSTATE 42501 with individualized diagnostics and zero retries', async () => {
    const { client, rpc } = mockClient({ errorCode: '42501' })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))
    expect(await screen.findByText(/não possui permissão/)).toBeInTheDocument()
    const diagPanel = screen.getByTestId('diary-rpc-diagnostics')
    expect(diagPanel).toHaveTextContent('read_tenant_accounting_diary_summary')
    expect(diagPanel).toHaveTextContent('read_tenant_accounting_diary')
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('recovers automatically on single transient TimeoutError and renders sanitized diagnostics', async () => {
    const { client, rpc } = mockClient({ integralOk: true, transientFailures: 1, transientMode: 'timeout' })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    expect(await screen.findByText('Equilibrado e Integral')).toBeInTheDocument()
    expect(screen.getByText(/recuperada automaticamente após 1 nova tentativa/)).toBeInTheDocument()
    expect(screen.getByTestId('diary-rpc-diagnostics')).toHaveTextContent('2 tentativa(s)')
    expect(rpc).toHaveBeenCalledTimes(4)
  })

  it('fails closed after 1 automatic retry on persistent Failed to fetch and blocks export', async () => {
    const { client, rpc } = mockClient({ transientFailures: 5, transientMode: 'fetch' })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    expect(await screen.findByText(/Falha temporária de rede ao consultar o Diário Contábil/)).toBeInTheDocument()
    expect(screen.getByTestId('diary-rpc-diagnostics')).toHaveTextContent('Falha transitória de rede')
    expect(screen.getByRole('button', { name: /Exportar Diário Integral/ })).toBeDisabled()
    expect(rpc).toHaveBeenCalledTimes(4)
  })

  it('blocks export when filters are modified after last query until user re-queries', async () => {
    const { client } = mockClient({ integralOk: true })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))
    expect(await screen.findByText('Equilibrado e Integral')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar Diário Integral/ })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-01' } })

    expect(screen.getByText(/Os filtros foram alterados após a última consulta/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar Diário Integral/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Imprimir \/ PDF Integral/ })).toBeDisabled()
  })

  it('renders annual diary (9 entries, R$34.00, 1 unmapped) and blocks integral export', async () => {
    const { client } = mockClient({ annualNineEntries: true })
    render(<AccountingDiary client={client} organizationId="org-1" />)

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    expect(await screen.findByText('Selo Integral bloqueado neste período:')).toBeInTheDocument()
    expect(screen.getByText('Lançamento anual #9')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar Diário Integral/ })).toBeDisabled()
  })

  it('aborts and ignores stale responses from a previous Loja after organizationId switch', async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    let resolveOrgASummary!: (val: unknown) => void
    let resolveOrgAPage!: (val: unknown) => void

    const rpc = vi.fn().mockImplementation((fnName: string, params: Record<string, unknown>) => {
      if (params.p_organization_id === 'org-A') {
        return new Promise(resolve => {
          if (fnName === 'read_tenant_accounting_diary_summary') resolveOrgASummary = resolve
          else resolveOrgAPage = resolve
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const client = { from, rpc } as unknown as SupabaseClient
    const { rerender } = render(<AccountingDiary client={client} organizationId="org-A" />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar Diário' }))

    // Switch tenant while Org A request is still in flight
    rerender(<AccountingDiary client={client} organizationId="org-B" />)

    // Resolve Org A late
    resolveOrgASummary({
      data: {
        organization_id: 'org-A',
        from_date: '2026-11-01',
        to_date: '2026-11-30',
        date_basis: 'event_date',
        total_count: 1,
        total_debit: '120.00',
        total_credit: '120.00',
        balanced: true,
        unmapped_count: 0,
        legacy_non_posting_count: 0,
        integral_ok: true,
        incomplete_reasons: [],
        plans: [],
        report_classification: 'gerencial_nao_fiscal',
      },
      error: null,
    })
    resolveOrgAPage({
      data: [
        {
          entry_seq: 1,
          entry_id: 'entry-org-a',
          organization_id: 'org-A',
          accounting_period: '2026-11-01',
          competence: '2026-11-01',
          event_date: '2026-11-01',
          created_at: '2026-11-01T10:00:00Z',
          event_type: 'member_charge',
          source_table: 'charges',
          source_id: 'chg-org-a',
          reference_event_id: null,
          is_reversal_or_correction: false,
          accounting_plan_id: 'plan-1',
          plan_name: 'Plano A',
          debit_account_id: 'acc-1',
          debit_account_code: '1.1',
          debit_account_description: 'Caixa Org A',
          debit_role: 'financial_account',
          credit_account_id: 'acc-2',
          credit_account_code: '3.1',
          credit_account_description: 'Receita Org A',
          credit_role: 'category_revenue',
          amount: '120.00',
          description: 'Dados secretos Loja A',
          reason: null,
          is_fully_mapped: true,
          mapping_gap_reason: null,
        },
      ],
      error: null,
    })

    await waitFor(() => {
      expect(screen.queryByText('Dados secretos Loja A')).not.toBeInTheDocument()
      expect(screen.queryByText('Equilibrado e Integral')).not.toBeInTheDocument()
    })
  })
})
