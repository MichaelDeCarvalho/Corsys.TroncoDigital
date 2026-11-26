// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import {
  formatVariationPercent,
  loadDreGerencialReport,
  type DreGerencialReport,
} from './dre-report'

function makeReport(overrides: Partial<DreGerencialReport> = {}): DreGerencialReport {
  return {
    organization_id: 'org-1',
    from_period: '2026-10-01',
    to_period: '2026-10-01',
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
      financial_result: '25.00',
      net_result: '425.00',
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
      {
        accounting_plan_id: 'plan-1',
        accounting_account_id: 'acc-fin',
        account_code: '4.3.01.01',
        account_description: 'Rendimentos Financeiros',
        nature: 'financial_result',
        operational_classification: null,
        dre_section: 'financial_result',
        amount: '25.00',
        prior_period_amount: '0.00',
        prior_year_amount: '0.00',
      },
    ],
    unmapped_count: 0,
    legacy_non_posting_count: 0,
    integral_ok: true,
    incomplete_reasons: [],
    report_classification: 'gerencial_nao_fiscal',
    official_disclaimer: 'DRE Gerencial — não substitui DRE contábil oficial elaborada pelo contador.',
    ...overrides,
  }
}

describe('loadDreGerencialReport & waterfall math checks', () => {
  it('validates B01 waterfall identities and account-to-section sums in cents', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: makeReport(), error: null })
    const report = await loadDreGerencialReport({ rpc } as unknown as SupabaseClient, 'org-1', '2026-10', '2026-10')
    expect(report.waterfall.net_result).toBe('425.00')
    expect(formatVariationPercent('1000.00', '800.00')).toBe('+25,0%')
    expect(formatVariationPercent('100.00', '0.00')).toBe('N/A')
  })

  it('rejects broken waterfall arithmetic, mismatched section sums, and foreign tenant data', async () => {
    const badWaterfall = makeReport({
      waterfall: { ...makeReport().waterfall, net_result: '999.99' },
    })
    await expect(
      loadDreGerencialReport(
        { rpc: vi.fn().mockResolvedValue({ data: badWaterfall, error: null }) } as unknown as SupabaseClient,
        'org-1',
        '2026-10',
        '2026-10',
      ),
    ).rejects.toThrow(/cascata/)

    const badSectionSum = makeReport({
      accounts: makeReport().accounts.map(a => (a.accounting_account_id === 'acc-rev' ? { ...a, amount: '950.00' } : a)),
    })
    await expect(
      loadDreGerencialReport(
        { rpc: vi.fn().mockResolvedValue({ data: badSectionSum, error: null }) } as unknown as SupabaseClient,
        'org-1',
        '2026-10',
        '2026-10',
      ),
    ).rejects.toThrow(/diverge/)

    await expect(
      loadDreGerencialReport(
        { rpc: vi.fn().mockResolvedValue({ data: makeReport({ organization_id: 'org-2' }), error: null }) } as unknown as SupabaseClient,
        'org-1',
        '2026-10',
        '2026-10',
      ),
    ).rejects.toThrow(/inconsistente/)
  })
})
