import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { DreGerencialPanel } from './DreGerencialPanel'
import { createIntegralBookWorkbook, downloadReport } from '../lib/report-export'

vi.mock('../lib/report-export', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/report-export')>()
  return {
    ...actual,
    createIntegralBookWorkbook: vi.fn().mockResolvedValue(new Blob(['xlsx-dre'])),
    downloadReport: vi.fn(),
    printIntegralBookReport: vi.fn(),
  }
})

function mockClient(integralOk = true) {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      organization_id: 'org-1',
      from_period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
      to_period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
      prior_period_from: '2026-09-01',
      prior_period_to: '2026-09-01',
      prior_year_from: '2025-10-01',
      prior_year_to: '2025-10-01',
      has_prior_period_data: true,
      has_prior_year_data: false,
      plans: [{ id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' }],
      waterfall: {
        gross_revenue: '1000.00',
        deductions: '-100.00',
        net_revenue: '900.00',
        costs: '-200.00',
        gross_result: '700.00',
        operational_expenses: '-300.00',
        operating_result: '400.00',
        financial_result: '0.00',
        net_result: '400.00',
      },
      prior_period_waterfall: {
        gross_revenue: '800.00',
        deductions: '0.00',
        net_revenue: '800.00',
        costs: '-100.00',
        gross_result: '700.00',
        operational_expenses: '-200.00',
        operating_result: '500.00',
        financial_result: '0.00',
        net_result: '500.00',
      },
      prior_year_waterfall: null,
      months: [],
      accounts: [
        {
          accounting_plan_id: 'plan-1',
          accounting_account_id: 'acc-rev',
          account_code: '3.1.01.01',
          account_description: 'Mensalidades',
          nature: 'revenue',
          operational_classification: null,
          dre_section: 'gross_revenue',
          amount: '1000.00',
          prior_period_amount: '800.00',
          prior_year_amount: '0.00',
        },
        {
          accounting_plan_id: 'plan-1',
          accounting_account_id: 'acc-zero',
          account_code: '3.1.02.01',
          account_description: 'Doações Eventuais',
          nature: 'revenue',
          operational_classification: null,
          dre_section: 'gross_revenue',
          amount: '0.00',
          prior_period_amount: '0.00',
          prior_year_amount: '0.00',
        },
        {
          accounting_plan_id: 'plan-1',
          accounting_account_id: 'acc-ded',
          account_code: '3.9.01.01',
          account_description: 'Descontos Concedidos',
          nature: 'revenue',
          operational_classification: null,
          dre_section: 'deductions',
          amount: '-100.00',
          prior_period_amount: '0.00',
          prior_year_amount: '0.00',
        },
        {
          accounting_plan_id: 'plan-1',
          accounting_account_id: 'acc-cost',
          account_code: '4.1.01.01',
          account_description: 'Custos Diretos',
          nature: 'cost',
          operational_classification: null,
          dre_section: 'cost',
          amount: '-200.00',
          prior_period_amount: '-100.00',
          prior_year_amount: '0.00',
        },
        {
          accounting_plan_id: 'plan-1',
          accounting_account_id: 'acc-exp',
          account_code: '4.2.01.01',
          account_description: 'Despesas Gerais',
          nature: 'expense',
          operational_classification: 'administrative',
          dre_section: 'operational_expense',
          amount: '-300.00',
          prior_period_amount: '-200.00',
          prior_year_amount: '0.00',
        },
      ],
      unmapped_count: integralOk ? 0 : 2,
      legacy_non_posting_count: 0,
      integral_ok: integralOk,
      incomplete_reasons: integralOk ? [] : ['unmapped_entries'],
      report_classification: 'gerencial_nao_fiscal',
      official_disclaimer: 'DRE Gerencial — não substitui DRE contábil oficial elaborada pelo contador.',
    },
    error: null,
  })
  return { client: { rpc } as unknown as SupabaseClient }
}

describe('DreGerencialPanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders B01 waterfall, zero-balance plan account toggle, comparatives, and exports integral XLSX', async () => {
    const { client } = mockClient(true)
    render(<DreGerencialPanel client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar DRE Gerencial' }))

    expect(await screen.findByText('(=) Receitas Líquidas')).toBeInTheDocument()
    expect(screen.getByText('(=) Superávit / Déficit Gerencial')).toBeInTheDocument()
    expect(screen.getByText('Doações Eventuais')).toBeInTheDocument()
    expect(screen.getAllByText('Sem dados no servidor').length).toBeGreaterThan(0)

    // Hide zero-balance accounts
    fireEvent.click(screen.getByLabelText('Exibir contas analíticas zeradas do plano vigente'))
    expect(screen.queryByText('Doações Eventuais')).not.toBeInTheDocument()

    const xlsxBtn = screen.getByRole('button', { name: /Exportar DRE Integral/ })
    expect(xlsxBtn).toBeEnabled()
    fireEvent.click(xlsxBtn)

    await waitFor(() => expect(downloadReport).toHaveBeenCalled())
    expect(createIntegralBookWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({ bookType: 'DRE_GERENCIAL', integralOk: true }),
    )
  })

  it('blocks export when DRE Gerencial reports unmapped gaps', async () => {
    const { client } = mockClient(false)
    render(<DreGerencialPanel client={client} organizationId="org-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar DRE Gerencial' }))

    expect(await screen.findByText('Selo Integral da DRE bloqueado:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar DRE Integral/ })).toBeDisabled()
  })
})
