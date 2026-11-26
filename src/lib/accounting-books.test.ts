// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import {
  loadAccountingDiaryPage,
  loadAccountingDiarySummary,
  loadAccountingLedgerPage,
  loadAllAccountingDiaryPages,
  loadAllAccountingLedgerPages,
  reconcileDiaryAndLedger,
  toCentsStrict,
  type DiaryEntry,
  type DiarySummary,
  type LedgerReport,
} from './accounting-books'

const filter = { fromDate: '2026-10-01', toDate: '2026-10-31', dateBasis: 'event_date' as const }

function makeDiaryEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entry_seq: 1,
    entry_id: 'e-1',
    organization_id: 'org-1',
    accounting_period: '2026-10-01',
    competence: '2026-10-01',
    event_date: '2026-10-10',
    created_at: '2026-10-10T12:00:00Z',
    event_type: 'member_charge',
    source_table: 'charges',
    source_id: 'chg-1',
    reference_event_id: null,
    is_reversal_or_correction: false,
    accounting_plan_id: 'plan-1',
    plan_name: 'Plano 2026',
    debit_account_id: 'acc-ctrl',
    debit_account_code: '1.1.02.01',
    debit_account_description: 'Contribuições a Receber',
    debit_role: 'member_receivable_control',
    credit_account_id: 'acc-rev',
    credit_account_code: '3.1.01.01',
    credit_account_description: 'Mensalidades',
    credit_role: 'category_revenue',
    amount: '150.00',
    description: 'Mensalidade outubro',
    reason: null,
    is_fully_mapped: true,
    mapping_gap_reason: null,
    ...overrides,
  }
}

function makeSummary(overrides: Partial<DiarySummary> = {}): DiarySummary {
  return {
    organization_id: 'org-1',
    from_date: '2026-10-01',
    to_date: '2026-10-31',
    date_basis: 'event_date',
    total_count: 2,
    total_debit: '300.00',
    total_credit: '300.00',
    balanced: true,
    unmapped_count: 0,
    legacy_non_posting_count: 0,
    integral_ok: true,
    incomplete_reasons: [],
    plans: [{ id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' }],
    report_classification: 'gerencial_nao_fiscal',
    ...overrides,
  }
}

describe('accounting-books service & integrity checks', () => {
  it('parses monetary amounts strictly into cents without float drift', () => {
    expect(toCentsStrict('0.00')).toBe(0n)
    expect(toCentsStrict('1234.56')).toBe(123456n)
    expect(toCentsStrict('-90.5')).toBe(-9050n)
    expect(() => toCentsStrict('NaN')).toThrow()
    expect(() => toCentsStrict('10.123')).toThrow()
  })

  it('rejects unbalanced diary summary or foreign tenant summary', async () => {
    const rpcUnbalanced = vi.fn().mockResolvedValue({
      data: makeSummary({ total_debit: '300.00', total_credit: '299.00', balanced: false }),
      error: null,
    })
    await expect(
      loadAccountingDiarySummary({ rpc: rpcUnbalanced } as unknown as SupabaseClient, 'org-1', filter),
    ).rejects.toThrow(/Desequilíbrio/)

    const rpcForeign = vi.fn().mockResolvedValue({
      data: makeSummary({ organization_id: 'org-2' }),
      error: null,
    })
    await expect(
      loadAccountingDiarySummary({ rpc: rpcForeign } as unknown as SupabaseClient, 'org-1', filter),
    ).rejects.toThrow(/outra Loja/)
  })

  it('rejects foreign tenant or invalid rows in diary page', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [makeDiaryEntry({ organization_id: 'org-other' })],
      error: null,
    })
    await expect(
      loadAccountingDiaryPage({ rpc } as unknown as SupabaseClient, 'org-1', filter, 0, 50),
    ).rejects.toThrow(/outra Loja/)
  })

  it('loads full paginated diary for integral export and blocks !integral_ok or truncated server pages', async () => {
    const e1 = makeDiaryEntry({ entry_seq: 1, entry_id: 'e-1', amount: '150.00' })
    const e2 = makeDiaryEntry({ entry_seq: 2, entry_id: 'e-2', amount: '150.00' })

    const rpc = vi.fn().mockImplementation((fnName: string, params: { p_page?: number }) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({ data: makeSummary({ total_count: 2, total_debit: '300.00', total_credit: '300.00' }), error: null })
      }
      if (fnName === 'read_tenant_accounting_diary') {
        return Promise.resolve({ data: params.p_page === 0 ? [e1, e2] : [], error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const full = await loadAllAccountingDiaryPages({ rpc } as unknown as SupabaseClient, 'org-1', filter)
    expect(full.entries).toHaveLength(2)

    const rpcIncomplete = vi.fn().mockResolvedValue({
      data: makeSummary({ integral_ok: false, unmapped_count: 1, incomplete_reasons: ['unmapped_entries'] }),
      error: null,
    })
    await expect(
      loadAllAccountingDiaryPages({ rpc: rpcIncomplete } as unknown as SupabaseClient, 'org-1', filter),
    ).rejects.toThrow(/bloqueada/i)

    const rpcTruncated = vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({ data: makeSummary({ total_count: 2, total_debit: '300.00', total_credit: '300.00' }), error: null })
      }
      return Promise.resolve({ data: [e1], error: null })
    })
    // Second page returns [e1] only once or wait — if server keeps returning 1 row, length grows on second call unless empty; test empty truncation:
    const rpcEmpty = vi.fn().mockImplementation((fnName: string, params: { p_page?: number }) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({ data: makeSummary({ total_count: 3, total_debit: '300.00', total_credit: '300.00' }), error: null })
      }
      return Promise.resolve({ data: params.p_page === 0 ? [e1, e2] : [], error: null })
    })
    await expect(
      loadAllAccountingDiaryPages({ rpc: rpcEmpty } as unknown as SupabaseClient, 'org-1', filter),
    ).rejects.toThrow(/truncada/i)

    expect(rpcTruncated).toBeDefined()
  })

  it('verifies running balance continuity and diary reconciliation in Razão Contábil', async () => {
    const ledgerReport: LedgerReport = {
      organization_id: 'org-1',
      from_date: '2026-10-01',
      to_date: '2026-10-31',
      date_basis: 'event_date',
      page: 0,
      page_size: 200,
      total_count: 2,
      account: { id: 'acc-ctrl', code: '1.1.02.01', description: 'Contribuições a Receber', nature: 'patrimonial', row_type: 'analytic' },
      plan: { id: 'plan-1', name: 'Plano 2026', status: 'published', valid_from: '2026-01-01', valid_to: '2026-12-31' },
      opening_balance: '100.00',
      opening_balance_dc: 'D',
      opening_balance_source: 'prior_entries',
      period_debit_total: '150.00',
      period_credit_total: '50.00',
      closing_balance: '200.00',
      closing_balance_dc: 'D',
      reconciles_with_diary: true,
      unmapped_count: 0,
      legacy_non_posting_count: 0,
      integral_ok: true,
      incomplete_reasons: [],
      report_classification: 'gerencial_nao_fiscal',
      entries: [
        {
          entry_seq: 1,
          entry_id: 'e-1',
          event_date: '2026-10-05',
          competence: '2026-10-01',
          accounting_period: '2026-10-01',
          event_type: 'member_charge',
          source_table: 'charges',
          source_id: 'chg-1',
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
        {
          entry_seq: 2,
          entry_id: 'e-2',
          event_date: '2026-10-06',
          competence: '2026-10-01',
          accounting_period: '2026-10-01',
          event_type: 'member_receivable_allocation',
          source_table: 'receivable_allocations',
          source_id: 'alloc-1',
          reference_event_id: null,
          is_reversal_or_correction: false,
          debit_amount: '0.00',
          credit_amount: '50.00',
          running_balance: '200.00',
          balance_dc: 'D',
          counterpart_code: '1.1.01.01',
          counterpart_description: 'Banco',
          description: 'Baixa',
          reason: null,
          is_fully_mapped: true,
          mapping_gap_reason: null,
        },
      ],
    }

    const rpc = vi.fn().mockResolvedValue({ data: ledgerReport, error: null })
    const loaded = await loadAllAccountingLedgerPages(
      { rpc } as unknown as SupabaseClient,
      'org-1',
      'acc-ctrl',
      '2026-10-01',
      '2026-10-31',
      'event_date',
    )
    expect(loaded.entries).toHaveLength(2)

    const tie = reconcileDiaryAndLedger(
      [
        makeDiaryEntry({ debit_account_id: 'acc-ctrl', credit_account_id: 'acc-rev', amount: '150.00' }),
        makeDiaryEntry({ entry_id: 'e-2', debit_account_id: 'acc-bank', credit_account_id: 'acc-ctrl', amount: '50.00' }),
      ],
      loaded,
    )
    expect(tie.ok).toBe(true)

    const broken = {
      ...ledgerReport,
      entries: [ledgerReport.entries[0], { ...ledgerReport.entries[1], running_balance: '999.00' }],
    }
    const rpcBroken = vi.fn().mockResolvedValue({ data: broken, error: null })
    await expect(
      loadAllAccountingLedgerPages({ rpc: rpcBroken } as unknown as SupabaseClient, 'org-1', 'acc-ctrl', '2026-10-01', '2026-10-31', 'event_date'),
    ).rejects.toThrow(/continuidade/)

    const rpcMathErr = vi.fn().mockResolvedValue({
      data: { ...ledgerReport, closing_balance: '999.00' },
      error: null,
    })
    await expect(
      loadAccountingLedgerPage({ rpc: rpcMathErr } as unknown as SupabaseClient, 'org-1', 'acc-ctrl', '2026-10-01', '2026-10-31', 'event_date'),
    ).rejects.toThrow(/Inconsistência matemática/)
  })
})
