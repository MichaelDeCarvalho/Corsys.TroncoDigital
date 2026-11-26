import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountingRoleCode =
  | 'member_receivable_control'
  | 'institutional_receivable_control'
  | 'member_advance_liability'
  | 'institutional_payable_control'
  | 'revenue_deduction'
  | 'financial_fee_expense'
  | 'opening_balance_contra'
  | 'closing_result_account'

export const ACCOUNTING_ROLE_LABELS: Record<AccountingRoleCode, string> = {
  member_receivable_control: 'Contribuições a receber (Controle)',
  institutional_receivable_control: 'Recebíveis institucionais (Controle)',
  member_advance_liability: 'Adiantamentos / créditos de integrantes (Passivo)',
  institutional_payable_control: 'Obrigações institucionais a pagar (Controle)',
  revenue_deduction: 'Deduções de receita (Descontos / Abatimentos)',
  financial_fee_expense: 'Tarifas e encargos bancários',
  opening_balance_contra: 'Contrapartida de abertura patrimonial documentada',
  closing_result_account: 'Conta de apuração / encerramento de resultado',
}

export type AccountingPlanRoleMapping = {
  id: string
  organization_id: string
  accounting_plan_id: string
  role_code: AccountingRoleCode
  accounting_account_id: string
}

export type AccountingPlanRef = {
  id: string
  name: string
  status: 'draft' | 'published'
  valid_from: string
  valid_to: string
}

export type DiaryDateBasis = 'event_date' | 'competence'

export type DiaryFilter = {
  fromDate: string
  toDate: string
  dateBasis: DiaryDateBasis
  eventType?: string | null
  accountId?: string | null
  onlyReversals?: boolean
}

export type DiaryEntry = {
  entry_seq: number
  entry_id: string
  organization_id: string
  accounting_period: string
  competence: string
  event_date: string
  created_at: string
  event_type: string
  source_table: string
  source_id: string
  reference_event_id: string | null
  is_reversal_or_correction: boolean
  accounting_plan_id: string | null
  plan_name: string | null
  debit_account_id: string | null
  debit_account_code: string | null
  debit_account_description: string | null
  debit_role: string
  credit_account_id: string | null
  credit_account_code: string | null
  credit_account_description: string | null
  credit_role: string
  amount: number | string
  description: string
  reason: string | null
  is_fully_mapped: boolean
  mapping_gap_reason: string | null
}

export type DiarySummary = {
  organization_id: string
  from_date: string
  to_date: string
  date_basis: DiaryDateBasis
  total_count: number
  total_debit: number | string
  total_credit: number | string
  balanced: boolean
  unmapped_count: number
  legacy_non_posting_count: number
  integral_ok: boolean
  incomplete_reasons: string[]
  plans: AccountingPlanRef[]
  report_classification: string
}

export type LedgerEntry = {
  entry_seq: number
  entry_id: string
  event_date: string
  competence: string
  accounting_period: string
  event_type: string
  source_table: string
  source_id: string
  reference_event_id: string | null
  is_reversal_or_correction: boolean
  debit_amount: number | string
  credit_amount: number | string
  running_balance: number | string
  balance_dc: 'D' | 'C'
  counterpart_code: string | null
  counterpart_description: string | null
  description: string
  reason: string | null
  is_fully_mapped: boolean
  mapping_gap_reason: string | null
}

export type LedgerReport = {
  organization_id: string
  from_date: string
  to_date: string
  date_basis: DiaryDateBasis
  page: number
  page_size: number
  total_count: number
  account: {
    id: string
    code: string
    description: string
    nature: string
    row_type: string
  }
  plan: AccountingPlanRef
  opening_balance: number | string
  opening_balance_dc: 'D' | 'C'
  opening_balance_source: 'prior_entries' | 'no_prior_entries_zero'
  period_debit_total: number | string
  period_credit_total: number | string
  closing_balance: number | string
  closing_balance_dc: 'D' | 'C'
  reconciles_with_diary: boolean
  unmapped_count: number
  legacy_non_posting_count: number
  integral_ok: boolean
  incomplete_reasons: string[]
  report_classification: string
  entries: LedgerEntry[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MONEY = /^-?\d{1,12}(\.\d{1,2})?$/
const MAX_INTEGRAL_PAGES = 50
const PAGE_SIZE_EXPORT = 200

export function toCentsStrict(value: string | number, label = 'Montante contábil'): bigint {
  const str = String(value).trim()
  if (!MONEY.test(str)) throw new Error(`${label} inválido`)
  const num = Number(str)
  if (!Number.isFinite(num)) throw new Error(`${label} inválido`)
  const negative = str.startsWith('-')
  const unsigned = negative ? str.slice(1) : str
  const [intPart, decPart = ''] = unsigned.split('.')
  const cents = BigInt(intPart) * 100n + BigInt((decPart + '00').slice(0, 2))
  return negative ? -cents : cents
}

export function centsToNumber(cents: bigint): number {
  const val = Number(cents)
  if (!Number.isSafeInteger(val)) throw new Error('Valor contábil fora do limite seguro de precisão')
  return val / 100
}

export function validateDateRange(fromDate: string, toDate: string) {
  if (!ISO_DATE.test(fromDate) || !ISO_DATE.test(toDate) || toDate < fromDate) {
    throw new Error('Informe um intervalo de datas válido (início até fim).')
  }
}

export const DIARY_EVENT_LABELS: Record<string, string> = {
  member_charge: 'Cobrança de integrante',
  member_agreement_installment: 'Parcela de acordo de integrante',
  member_charge_adjustment_increase: 'Acréscimo em cobrança',
  member_charge_deduction: 'Dedução / desconto em cobrança',
  member_charge_credit_correction: 'Retificação credora de cobrança',
  member_charge_cancellation: 'Cancelamento de cobrança',
  member_payment: 'Recebimento de integrante',
  member_payment_reversal: 'Estorno de recebimento de integrante',
  member_receivable_allocation: 'Baixa em título de integrante',
  member_allocation_reversal: 'Estorno de baixa em título',
  member_credit: 'Crédito de integrante',
  member_credit_reversal: 'Estorno de crédito de integrante',
  institutional_payable: 'Obrigação institucional a pagar',
  institutional_payable_correction_reverse: 'Retificação obrigação (estorno)',
  institutional_payable_correction_repost: 'Retificação obrigação (reclassificação)',
  institutional_payable_correction_delta: 'Retificação obrigação (ajuste valor)',
  institutional_payable_cancellation: 'Cancelamento de obrigação',
  institutional_payable_payment: 'Pagamento institucional',
  institutional_payable_payment_reversal: 'Estorno de pagamento institucional',
  institutional_receivable: 'Recebível institucional',
  institutional_receivable_correction_reverse: 'Retificação recebível (estorno)',
  institutional_receivable_correction_repost: 'Retificação recebível (reclassificação)',
  institutional_receivable_correction_delta: 'Retificação recebível (ajuste valor)',
  institutional_receivable_cancellation: 'Cancelamento de recebível institucional',
  institutional_receipt: 'Recebimento institucional',
  institutional_receipt_reversal: 'Estorno de recebimento institucional',
  account_transfer: 'Transferência entre contas',
  account_transfer_reversal: 'Estorno de transferência entre contas',
  account_opening_entry: 'Saldo de abertura documentado',
}

export const INCOMPLETE_REASON_LABELS: Record<string, string> = {
  unmapped_entries: 'Existem lançamentos no período sem conta contábil ou papel Anexo III mapeado.',
  unmapped_entries_in_period: 'Existem lançamentos no período sem conta contábil ou papel Anexo III mapeado.',
  legacy_non_posting_present: 'Existem registros legados não contabilizados (non-posting) no período.',
  unbalanced_totals: 'Totais de débito e crédito divergentes no Diário.',
  no_published_plan_in_period: 'Nenhum plano contábil publicado vigente cobre a competência selecionada.',
}

export async function loadAccountingPlanRoleMappings(
  client: SupabaseClient,
  organizationId: string,
  planId: string,
  signal?: AbortSignal,
): Promise<AccountingPlanRoleMapping[]> {
  let query = client
    .from('accounting_plan_role_mappings')
    .select('id,organization_id,accounting_plan_id,role_code,accounting_account_id')
    .eq('organization_id', organizationId)
    .eq('accounting_plan_id', planId)
    .order('role_code')
    .limit(50)

  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as AccountingPlanRoleMapping[]
  if (rows.some(r => r.organization_id !== organizationId || r.accounting_plan_id !== planId)) {
    throw new Error('Vínculos contábeis inconsistentes com a Loja ou plano.')
  }
  return rows
}

export async function saveAccountingPlanRoleMapping(
  client: SupabaseClient,
  params: {
    organizationId: string
    planId: string
    roleCode: AccountingRoleCode
    accountingAccountId: string
    expectedAccountId: string | null
    reason: string
    idempotencyKey: string
  },
): Promise<string> {
  const { data, error } = await client.rpc('set_accounting_plan_role_mapping_idempotent', {
    p_organization_id: params.organizationId,
    p_accounting_plan_id: params.planId,
    p_role_code: params.roleCode,
    p_accounting_account_id: params.accountingAccountId,
    p_expected_account_id: params.expectedAccountId,
    p_reason: params.reason,
    p_idempotency_key: params.idempotencyKey,
  })
  if (error) throw error
  if (typeof data !== 'string' || !data) throw new Error('Comando contábil não confirmado.')
  return data
}

function validateDiaryEntryRow(row: unknown, organizationId: string): DiaryEntry {
  if (!row || typeof row !== 'object') throw new Error('Lançamento do Diário inválido.')
  const r = row as DiaryEntry
  if (
    r.organization_id !== organizationId ||
    typeof r.entry_id !== 'string' ||
    !ISO_DATE.test(String(r.event_date)) ||
    !ISO_DATE.test(String(r.accounting_period)) ||
    typeof r.event_type !== 'string' ||
    typeof r.source_table !== 'string' ||
    typeof r.source_id !== 'string'
  ) {
    throw new Error('Dados inconsistentes ou de outra Loja detectados no Diário.')
  }
  const cents = toCentsStrict(r.amount, 'Valor do lançamento')
  if (cents <= 0n) throw new Error('Lançamento com valor nulo ou negativo não permitido no Diário.')
  return r
}

export async function loadAccountingDiarySummary(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
): Promise<DiarySummary> {
  validateDateRange(filter.fromDate, filter.toDate)
  const { data, error } = await client.rpc('read_tenant_accounting_diary_summary', {
    p_organization_id: organizationId,
    p_from_date: filter.fromDate,
    p_to_date: filter.toDate,
    p_date_basis: filter.dateBasis,
    p_event_type: filter.eventType || null,
    p_account_id: filter.accountId || null,
    p_only_reversals: Boolean(filter.onlyReversals),
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('Resumo do Diário inválido.')
  const summary = data as DiarySummary
  if (summary.organization_id !== organizationId) {
    throw new Error('Resumo do Diário pertence a outra Loja.')
  }
  const debitCents = toCentsStrict(summary.total_debit, 'Total de débitos')
  const creditCents = toCentsStrict(summary.total_credit, 'Total de créditos')
  if (debitCents !== creditCents || !summary.balanced) {
    throw new Error('Desequilíbrio entre débitos e créditos detectado no Diário.')
  }
  if (!Number.isInteger(summary.total_count) || summary.total_count < 0) {
    throw new Error('Contagem total do Diário inválida.')
  }
  return summary
}

export async function loadAccountingDiaryPage(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  page: number,
  pageSize = 100,
): Promise<DiaryEntry[]> {
  validateDateRange(filter.fromDate, filter.toDate)
  const { data, error } = await client.rpc('read_tenant_accounting_diary', {
    p_organization_id: organizationId,
    p_from_date: filter.fromDate,
    p_to_date: filter.toDate,
    p_date_basis: filter.dateBasis,
    p_event_type: filter.eventType || null,
    p_account_id: filter.accountId || null,
    p_only_reversals: Boolean(filter.onlyReversals),
    p_page: page,
    p_page_size: pageSize,
  })
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Resposta de lançamentos do Diário inválida.')
  return data.map(row => validateDiaryEntryRow(row, organizationId))
}

export async function loadAllAccountingDiaryPages(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  signal?: AbortSignal,
): Promise<{ summary: DiarySummary; entries: DiaryEntry[] }> {
  const summary = await loadAccountingDiarySummary(client, organizationId, filter)
  if (!summary.integral_ok) {
    throw new Error('Exportação integral do Diário bloqueada: o período possui pendências contábeis ou lançamentos não mapeados.')
  }
  if (summary.total_count > MAX_INTEGRAL_PAGES * PAGE_SIZE_EXPORT) {
    throw new Error('Volume de lançamentos excede o limite seguro de exportação local no navegador.')
  }
  const entries: DiaryEntry[] = []
  let page = 0
  while (entries.length < summary.total_count) {
    if (signal?.aborted) throw new Error('Consulta cancelada.')
    if (page >= MAX_INTEGRAL_PAGES) throw new Error('Paginação do Diário excedeu o limite seguro.')
    const batch = await loadAccountingDiaryPage(client, organizationId, filter, page, PAGE_SIZE_EXPORT)
    if (!batch.length) {
      throw new Error('Exportação bloqueada: resposta paginada do Diário foi truncada pelo servidor.')
    }
    entries.push(...batch)
    page += 1
  }
  if (entries.length !== summary.total_count) {
    throw new Error('Exportação bloqueada: contagem obtida diverge do total esperado no Diário.')
  }
  let sumCents = 0n
  for (const row of entries) {
    sumCents += toCentsStrict(row.amount, 'Valor do lançamento')
  }
  const expectedDebitCents = toCentsStrict(summary.total_debit, 'Total de débitos')
  if (sumCents !== expectedDebitCents) {
    throw new Error('Exportação bloqueada: soma dos lançamentos do Diário diverge do total conciliado.')
  }
  return { summary, entries }
}

function validateLedgerReport(raw: unknown, organizationId: string, accountId: string): LedgerReport {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta do Razão Contábil inválida.')
  const rep = raw as LedgerReport
  if (
    rep.organization_id !== organizationId ||
    !rep.account ||
    rep.account.id !== accountId ||
    !Array.isArray(rep.entries) ||
    !Number.isInteger(rep.total_count) ||
    rep.total_count < 0
  ) {
    throw new Error('Dados do Razão Contábil inconsistentes com a Loja ou conta consultada.')
  }
  const openingCents = toCentsStrict(rep.opening_balance, 'Saldo inicial')
  const debitCents = toCentsStrict(rep.period_debit_total, 'Total de débitos do período')
  const creditCents = toCentsStrict(rep.period_credit_total, 'Total de créditos do período')
  const closingCents = toCentsStrict(rep.closing_balance, 'Saldo final')
  if (openingCents + debitCents - creditCents !== closingCents) {
    throw new Error('Inconsistência matemática no Razão: saldo inicial + débitos - créditos diverge do saldo final.')
  }
  if (!rep.reconciles_with_diary) {
    throw new Error('Falha de conciliação entre Razão e Diário detectada no servidor.')
  }
  for (const row of rep.entries) {
    if (!row || typeof row !== 'object' || typeof row.entry_id !== 'string' || !ISO_DATE.test(String(row.event_date))) {
      throw new Error('Movimento inválido no Razão Contábil.')
    }
    toCentsStrict(row.debit_amount, 'Débito no Razão')
    toCentsStrict(row.credit_amount, 'Crédito no Razão')
    toCentsStrict(row.running_balance, 'Saldo acumulado no Razão')
  }
  return rep
}

export async function loadAccountingLedgerPage(
  client: SupabaseClient,
  organizationId: string,
  accountId: string,
  fromDate: string,
  toDate: string,
  dateBasis: DiaryDateBasis,
  page = 0,
  pageSize = 200,
): Promise<LedgerReport> {
  validateDateRange(fromDate, toDate)
  if (!accountId) throw new Error('Selecione uma conta contábil para consultar o Razão.')
  const { data, error } = await client.rpc('read_tenant_accounting_ledger', {
    p_organization_id: organizationId,
    p_accounting_account_id: accountId,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_date_basis: dateBasis,
    p_page: page,
    p_page_size: pageSize,
  })
  if (error) throw error
  return validateLedgerReport(data, organizationId, accountId)
}

export async function loadAllAccountingLedgerPages(
  client: SupabaseClient,
  organizationId: string,
  accountId: string,
  fromDate: string,
  toDate: string,
  dateBasis: DiaryDateBasis,
  signal?: AbortSignal,
): Promise<LedgerReport> {
  const first = await loadAccountingLedgerPage(client, organizationId, accountId, fromDate, toDate, dateBasis, 0, PAGE_SIZE_EXPORT)
  if (!first.integral_ok) {
    throw new Error('Exportação integral do Razão bloqueada: existem lançamentos não mapeados ou lacunas no período.')
  }
  if (first.total_count > MAX_INTEGRAL_PAGES * PAGE_SIZE_EXPORT) {
    throw new Error('Volume de lançamentos do Razão excede o limite seguro de exportação local.')
  }
  const allEntries = [...first.entries]
  let page = 1
  while (allEntries.length < first.total_count) {
    if (signal?.aborted) throw new Error('Consulta cancelada.')
    if (page >= MAX_INTEGRAL_PAGES) throw new Error('Paginação do Razão excedeu o limite seguro.')
    const next = await loadAccountingLedgerPage(client, organizationId, accountId, fromDate, toDate, dateBasis, page, PAGE_SIZE_EXPORT)
    if (!next.entries.length) {
      throw new Error('Exportação bloqueada: resposta paginada do Razão foi truncada.')
    }
    allEntries.push(...next.entries)
    page += 1
  }
  if (allEntries.length !== first.total_count) {
    throw new Error('Exportação bloqueada: total de partidas do Razão diverge da contagem do servidor.')
  }

  let running = toCentsStrict(first.opening_balance, 'Saldo inicial')
  let sumDebit = 0n
  let sumCredit = 0n
  for (const row of allEntries) {
    const d = toCentsStrict(row.debit_amount, 'Débito')
    const c = toCentsStrict(row.credit_amount, 'Crédito')
    const reportedRunning = toCentsStrict(row.running_balance, 'Saldo corrente')
    running = running + d - c
    if (running !== reportedRunning) {
      throw new Error('Falha de continuidade no saldo corrente do Razão.')
    }
    sumDebit += d
    sumCredit += c
  }
  if (
    sumDebit !== toCentsStrict(first.period_debit_total, 'Débito período') ||
    sumCredit !== toCentsStrict(first.period_credit_total, 'Crédito período') ||
    running !== toCentsStrict(first.closing_balance, 'Saldo final')
  ) {
    throw new Error('Totais do Razão não fecham com os movimentos carregados.')
  }

  return { ...first, entries: allEntries }
}

export function reconcileDiaryAndLedger(
  diaryEntries: DiaryEntry[],
  ledger: LedgerReport,
): { ok: boolean; diaryDebitCents: bigint; diaryCreditCents: bigint; ledgerDebitCents: bigint; ledgerCreditCents: bigint } {
  const accountId = ledger.account.id
  let diaryDebitCents = 0n
  let diaryCreditCents = 0n
  for (const row of diaryEntries) {
    const amountCents = toCentsStrict(row.amount, 'Valor do lançamento')
    if (row.debit_account_id === accountId) diaryDebitCents += amountCents
    if (row.credit_account_id === accountId) diaryCreditCents += amountCents
  }
  const ledgerDebitCents = toCentsStrict(ledger.period_debit_total, 'Débito do Razão')
  const ledgerCreditCents = toCentsStrict(ledger.period_credit_total, 'Crédito do Razão')
  return {
    ok: diaryDebitCents === ledgerDebitCents && diaryCreditCents === ledgerCreditCents,
    diaryDebitCents,
    diaryCreditCents,
    ledgerDebitCents,
    ledgerCreditCents,
  }
}
