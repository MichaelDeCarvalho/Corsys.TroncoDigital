// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import {
  classifyDiaryReadError,
  loadAccountingDiaryPage,
  loadAccountingDiarySummary,
  loadAccountingDiaryWithDiagnostics,
  loadAccountingLedgerPage,
  loadAllAccountingDiaryPages,
  loadAllAccountingLedgerPages,
  reconcileDiaryAndLedger,
  sanitizeDiaryDiagnosticText,
  toCentsStrict,
  type DiaryEntry,
  type DiaryRpcDiagnostic,
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

  it('recovers automatically after at most 1 retry on TimeoutError and TypeError: Failed to fetch with individualized diagnostics', async () => {
    const e1 = makeDiaryEntry({ entry_seq: 1, entry_id: 'e-1', amount: '150.00' })
    const e2 = makeDiaryEntry({ entry_seq: 2, entry_id: 'e-2', amount: '150.00' })
    let summaryCalls = 0
    let pageCalls = 0

    const rpc = vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        summaryCalls += 1
        if (summaryCalls === 1) {
          const timeoutErr = new Error('The operation was aborted due to timeout')
          timeoutErr.name = 'TimeoutError'
          return Promise.reject(timeoutErr)
        }
        return Promise.resolve({ data: makeSummary(), error: null, status: 200 })
      }
      if (fnName === 'read_tenant_accounting_diary') {
        pageCalls += 1
        if (pageCalls === 1) {
          return Promise.reject(new TypeError('Failed to fetch'))
        }
        return Promise.resolve({ data: [e1, e2], error: null, status: 200 })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await loadAccountingDiaryWithDiagnostics(
      { rpc } as unknown as SupabaseClient,
      'org-1',
      filter,
      0,
      50,
      { retryDelayMs: 0 },
    )

    expect(summaryCalls).toBe(2)
    expect(pageCalls).toBe(2)
    expect(result.entries).toHaveLength(2)
    expect(result.diagnostics.summary).toMatchObject({
      rpc: 'read_tenant_accounting_diary_summary',
      ok: true,
      category: 'ok',
      attempts: 2,
      retried: true,
    })
    expect(result.diagnostics.page).toMatchObject({
      rpc: 'read_tenant_accounting_diary',
      ok: true,
      category: 'ok',
      attempts: 2,
      retried: true,
    })
    expect(result.diagnostics.summary.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.diagnostics.page.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('caps transient retries at 1 (2 attempts max) and never retries definitive failures (42501/22023/inconsistent)', async () => {
    const rpcDoubleTimeout = vi.fn().mockRejectedValue(Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }))
    const capturedDiags: DiaryRpcDiagnostic[] = []
    await expect(
      loadAccountingDiarySummary({ rpc: rpcDoubleTimeout } as unknown as SupabaseClient, 'org-1', filter, {
        retryDelayMs: 0,
        onDiagnostic: d => capturedDiags.push(d),
      }),
    ).rejects.toThrow(/tempo limite/)
    expect(rpcDoubleTimeout).toHaveBeenCalledTimes(2)
    expect(capturedDiags[0]).toMatchObject({
      rpc: 'read_tenant_accounting_diary_summary',
      ok: false,
      category: 'timeout',
      attempts: 2,
      retried: true,
    })

    const rpcAuthDenied = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied', requestId: 'req-42501-abc' },
      status: 403,
    })
    await expect(
      loadAccountingDiarySummary({ rpc: rpcAuthDenied } as unknown as SupabaseClient, 'org-1', filter, {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/não possui permissão/)
    expect(rpcAuthDenied).toHaveBeenCalledTimes(1)

    const rpcInvalidParam = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'invalid parameter' },
      status: 400,
    })
    await expect(
      loadAccountingDiaryPage({ rpc: rpcInvalidParam } as unknown as SupabaseClient, 'org-1', filter, 0, 50, {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/invalid parameter/)
    expect(rpcInvalidParam).toHaveBeenCalledTimes(1)
  })

  it('aborts obsolete queries immediately via AbortSignal with zero retries', async () => {
    const controller = new AbortController()
    const abortSignalSpy = vi.fn().mockImplementation((sig: AbortSignal) => {
      return new Promise((_, reject) => {
        sig.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
      })
    })
    const rpc = vi.fn().mockReturnValue({ abortSignal: abortSignalSpy })

    const promise = loadAccountingDiarySummary({ rpc } as unknown as SupabaseClient, 'org-1', filter, {
      signal: controller.signal,
      retryDelayMs: 0,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ category: 'aborted' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(abortSignalSpy).toHaveBeenCalledWith(controller.signal)
  })

  it('validates coherence between summary, period, filters, page count, totals, and unmapped count', async () => {
    const e1 = makeDiaryEntry({ entry_seq: 1, entry_id: 'e-1', amount: '150.00' })
    const e2 = makeDiaryEntry({ entry_seq: 2, entry_id: 'e-2', amount: '100.00' })

    // Summary claims 2 entries totaling 300.00, page sums to 250.00
    const rpcSumDrift = vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({ data: makeSummary({ total_count: 2, total_debit: '300.00', total_credit: '300.00' }), error: null })
      }
      return Promise.resolve({ data: [e1, e2], error: null })
    })
    await expect(
      loadAccountingDiaryWithDiagnostics({ rpc: rpcSumDrift } as unknown as SupabaseClient, 'org-1', filter, 0, 50, {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/diverge do total de débitos/)

    // Summary period does not match requested filter
    const rpcPeriodMismatch = vi.fn().mockResolvedValue({
      data: makeSummary({ from_date: '2026-01-01', to_date: '2026-12-31' }),
      error: null,
    })
    await expect(
      loadAccountingDiarySummary({ rpc: rpcPeriodMismatch } as unknown as SupabaseClient, 'org-1', filter, {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/diverge do período/)

    // Entry violates active event_type filter
    const rpcWrongEvent = vi.fn().mockResolvedValue({
      data: [makeDiaryEntry({ event_type: 'member_payment' })],
      error: null,
    })
    await expect(
      loadAccountingDiaryPage(
        { rpc: rpcWrongEvent } as unknown as SupabaseClient,
        'org-1',
        { ...filter, eventType: 'member_charge' },
        0,
        50,
        { retryDelayMs: 0 },
      ),
    ).rejects.toThrow(/divergente do filtro de tipo de evento/)

    // Entry falls outside requested period
    const rpcOutOfRange = vi.fn().mockResolvedValue({
      data: [makeDiaryEntry({ event_date: '2026-09-15' })],
      error: null,
    })
    await expect(
      loadAccountingDiaryPage({ rpc: rpcOutOfRange } as unknown as SupabaseClient, 'org-1', filter, 0, 50, {
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/fora do período/)
  })

  it('handles annual diary (9 entries, R$34.00 per side, 1 unmapped) and multi-page pagination coherently', async () => {
    const annualFilter = { fromDate: '2026-01-01', toDate: '2026-12-31', dateBasis: 'event_date' as const }
    const nineEntries: DiaryEntry[] = Array.from({ length: 9 }, (_, i) =>
      makeDiaryEntry({
        entry_seq: i + 1,
        entry_id: `e-yr-${i + 1}`,
        event_date: `2026-0${Math.min(9, i + 1)}-10`,
        accounting_period: `2026-0${Math.min(9, i + 1)}-01`,
        competence: `2026-0${Math.min(9, i + 1)}-01`,
        amount: i === 8 ? '2.00' : '4.00',
        is_fully_mapped: i !== 8,
        credit_account_id: i === 8 ? null : 'acc-rev',
        credit_account_code: i === 8 ? null : '3.1.01.01',
        credit_account_description: i === 8 ? null : 'Mensalidades',
        mapping_gap_reason: i === 8 ? 'Conta sem vínculo contábil' : null,
      }),
    )
    const annualSummary = makeSummary({
      from_date: '2026-01-01',
      to_date: '2026-12-31',
      total_count: 9,
      total_debit: '34.00',
      total_credit: '34.00',
      unmapped_count: 1,
      integral_ok: false,
      incomplete_reasons: ['unmapped_entries_in_period'],
    })

    const rpc = vi.fn().mockImplementation((fnName: string, params: { p_page?: number; p_page_size?: number }) => {
      if (fnName === 'read_tenant_accounting_diary_summary') {
        return Promise.resolve({ data: annualSummary, error: null })
      }
      const start = (params.p_page ?? 0) * (params.p_page_size ?? 50)
      return Promise.resolve({ data: nineEntries.slice(start, start + (params.p_page_size ?? 50)), error: null })
    })

    const fullAnnual = await loadAccountingDiaryWithDiagnostics(
      { rpc } as unknown as SupabaseClient,
      'org-1',
      annualFilter,
      0,
      50,
    )
    expect(fullAnnual.summary.total_count).toBe(9)
    expect(fullAnnual.summary.total_debit).toBe('34.00')
    expect(fullAnnual.summary.unmapped_count).toBe(1)
    expect(fullAnnual.entries).toHaveLength(9)

    // Multi-page (pageSize 5 -> page 0 has 5, page 1 has 4)
    const page0 = await loadAccountingDiaryWithDiagnostics({ rpc } as unknown as SupabaseClient, 'org-1', annualFilter, 0, 5)
    const page1 = await loadAccountingDiaryWithDiagnostics({ rpc } as unknown as SupabaseClient, 'org-1', annualFilter, 1, 5)
    expect(page0.entries).toHaveLength(5)
    expect(page1.entries).toHaveLength(4)
  })

  it('sanitizes diagnostic error text and classifies transient vs definitive errors', () => {
    const clean = sanitizeDiaryDiagnosticText('Falha Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb password=123 postgres://u:p@host/db')
    expect(clean).not.toContain('eyJhbGci')
    expect(clean).not.toContain('password=123')
    expect(clean).not.toContain('postgres://')
    expect(classifyDiaryReadError(new TypeError('Failed to fetch'))).toMatchObject({
      category: 'network',
      retryable: true,
    })
    expect(classifyDiaryReadError({ status: 503, message: 'Service Unavailable' })).toMatchObject({
      category: 'server_transient',
      retryable: true,
    })
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
