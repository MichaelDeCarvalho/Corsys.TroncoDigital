import type { SupabaseClient } from '@supabase/supabase-js'
import { getLastRpcTransportMeta } from './supabase'

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

export type DiaryRpcName =
  | 'read_tenant_accounting_diary_summary'
  | 'read_tenant_accounting_diary'

export type DiaryFailureCategory =
  | 'ok'
  | 'timeout'
  | 'network'
  | 'server_transient'
  | 'aborted'
  | 'auth'
  | 'validation'
  | 'inconsistent_response'
  | 'unexpected'

export type DiaryRpcDiagnostic = {
  rpc: DiaryRpcName
  ok: boolean
  category: DiaryFailureCategory
  durationMs: number
  attempts: number
  retried: boolean
  requestId: string | null
  httpStatus: number | null
  errorCode: string | null
  message: string | null
}

export type DiaryReadOptions = {
  signal?: AbortSignal
  retryDelayMs?: number
  onDiagnostic?: (diagnostic: DiaryRpcDiagnostic) => void
}

export type DiaryQueryWithDiagnosticsResult = {
  summary: DiarySummary
  entries: DiaryEntry[]
  diagnostics: {
    summary: DiaryRpcDiagnostic
    page: DiaryRpcDiagnostic
  }
}

export type ClassifiedDiaryError = {
  category: DiaryFailureCategory
  retryable: boolean
  code: string | null
  httpStatus: number | null
  requestId: string | null
  userMessage: string
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

const MAX_DIARY_READ_TRANSIENT_RETRIES = 1
const DEFAULT_DIARY_RETRY_DELAY_MS = 250
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{4,128}$/

type DiaryCodedError = Error & {
  code: string
  category: DiaryFailureCategory
  diagnostic?: DiaryRpcDiagnostic
  diagnostics?: DiaryRpcDiagnostic[]
}

function createDiaryCodedError(
  message: string,
  code: string,
  category: DiaryFailureCategory,
  diagnostic?: DiaryRpcDiagnostic,
): DiaryCodedError {
  const err = new Error(message) as DiaryCodedError
  err.code = code
  err.category = category
  if (diagnostic) err.diagnostic = diagnostic
  return err
}

export function sanitizeDiaryDiagnosticText(raw: string): string {
  return raw
    .replace(/\b(password|passwd|secret|token|apikey|api_key|authorization)\s*[:=]\s*\S+/gi, '[redigido]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redigido]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redigido]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redigido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function sanitizeRequestId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return SAFE_REQUEST_ID.test(trimmed) ? trimmed : null
}

function extractDiaryErrorFields(cause: unknown): {
  name: string | null
  code: string | null
  status: number | null
  requestId: string | null
  message: string
  details: string
  categoryHint: DiaryFailureCategory | null
} {
  if (cause instanceof Error) {
    const extra = cause as Error & {
      code?: unknown
      status?: unknown
      details?: unknown
      requestId?: unknown
      request_id?: unknown
      category?: unknown
    }
    return {
      name: cause.name || null,
      code: typeof extra.code === 'string' && extra.code ? extra.code : null,
      status: typeof extra.status === 'number' ? extra.status : null,
      requestId: sanitizeRequestId(extra.requestId ?? extra.request_id),
      message: cause.message || '',
      details: typeof extra.details === 'string' ? extra.details : '',
      categoryHint: typeof extra.category === 'string' ? (extra.category as DiaryFailureCategory) : null,
    }
  }
  if (cause && typeof cause === 'object') {
    const rec = cause as Record<string, unknown>
    return {
      name: typeof rec.name === 'string' && rec.name ? rec.name : null,
      code: typeof rec.code === 'string' && rec.code ? rec.code : null,
      status: typeof rec.status === 'number' ? rec.status : null,
      requestId: sanitizeRequestId(rec.requestId ?? rec.request_id),
      message: typeof rec.message === 'string' ? rec.message : '',
      details: typeof rec.details === 'string' ? rec.details : '',
      categoryHint: typeof rec.category === 'string' ? (rec.category as DiaryFailureCategory) : null,
    }
  }
  if (typeof cause === 'string') {
    return {
      name: null,
      code: null,
      status: null,
      requestId: null,
      message: cause,
      details: '',
      categoryHint: null,
    }
  }
  return {
    name: null,
    code: null,
    status: null,
    requestId: null,
    message: '',
    details: '',
    categoryHint: null,
  }
}

export function classifyDiaryReadError(
  cause: unknown,
  signal?: AbortSignal,
  fallbackStatus?: number | null,
  fallbackRequestId?: string | null,
): ClassifiedDiaryError {
  const fields = extractDiaryErrorFields(cause)
  const status = fields.status ?? fallbackStatus ?? null
  const requestId = fields.requestId ?? fallbackRequestId ?? null
  const cleanMessage = sanitizeDiaryDiagnosticText(fields.message)
  const combinedLower = `${cleanMessage} ${sanitizeDiaryDiagnosticText(fields.details)}`.toLowerCase()

  if (
    signal?.aborted ||
    fields.code === 'ABORTED' ||
    fields.categoryHint === 'aborted' ||
    (fields.name === 'AbortError' && !/timeout|timed out/.test(combinedLower))
  ) {
    return {
      category: 'aborted',
      retryable: false,
      code: fields.code ?? 'ABORTED',
      httpStatus: status,
      requestId,
      userMessage: 'Consulta do Diário cancelada por nova solicitação ou troca de Loja.',
    }
  }

  if (fields.categoryHint === 'inconsistent_response' || fields.code === 'INCONSISTENT_DIARY_RESPONSE') {
    return {
      category: 'inconsistent_response',
      retryable: false,
      code: 'INCONSISTENT_DIARY_RESPONSE',
      httpStatus: status,
      requestId,
      userMessage:
        cleanMessage ||
        'Os dados retornados pelo servidor para o Diário Contábil estão inconsistentes e foram bloqueados.',
    }
  }

  if (
    fields.code === '42501' ||
    fields.code === '28000' ||
    status === 401 ||
    status === 403 ||
    /permission denied|access denied|authentication required|jwt expired/.test(combinedLower)
  ) {
    return {
      category: 'auth',
      retryable: false,
      code: fields.code ?? (status === 401 ? '28000' : '42501'),
      httpStatus: status,
      requestId,
      userMessage:
        fields.code === '28000' || status === 401
          ? 'Sessão autenticada expirada ou ausente para consultar o Diário Contábil.'
          : 'Seu perfil não possui permissão para consultar o Diário Contábil desta Loja.',
    }
  }

  if (
    fields.name === 'TimeoutError' ||
    fields.code === 'ETIMEDOUT' ||
    fields.code === 'ECONNABORTED' ||
    status === 408 ||
    status === 504 ||
    /timeouterror|signal timed out|timed out|timeout|gateway timeout/.test(combinedLower)
  ) {
    return {
      category: 'timeout',
      retryable: true,
      code: fields.code ?? 'TIMEOUT',
      httpStatus: status,
      requestId,
      userMessage:
        'A consulta do Diário Contábil excedeu o tempo limite de resposta do servidor. Tente novamente ou reduza o período consultado.',
    }
  }

  if (
    (cause instanceof TypeError && /fetch|network|load failed/i.test(combinedLower)) ||
    fields.code === 'ECONNRESET' ||
    fields.code === 'ENOTFOUND' ||
    /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_network|econnreset|enotfound/.test(
      combinedLower,
    )
  ) {
    return {
      category: 'network',
      retryable: true,
      code: fields.code ?? 'NETWORK_ERROR',
      httpStatus: status,
      requestId,
      userMessage:
        'Falha temporária de rede ao consultar o Diário Contábil. Verifique a conexão e tente novamente.',
    }
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 429 ||
    /bad gateway|service unavailable|too many requests|502|503/.test(combinedLower)
  ) {
    return {
      category: 'server_transient',
      retryable: true,
      code: fields.code ?? (status ? `HTTP_${status}` : 'SERVER_TRANSIENT'),
      httpStatus: status,
      requestId,
      userMessage:
        'Serviço temporariamente indisponível ao consultar o Diário Contábil. Tente novamente em instantes.',
    }
  }

  if (
    fields.code === '22023' ||
    fields.code === '23503' ||
    fields.code === 'PT409' ||
    fields.code === '55000' ||
    (status !== null && status >= 400 && status < 500)
  ) {
    return {
      category: 'validation',
      retryable: false,
      code: fields.code ?? (status ? `HTTP_${status}` : 'VALIDATION_ERROR'),
      httpStatus: status,
      requestId,
      userMessage: cleanMessage || 'Parâmetros ou período inválidos para consulta do Diário Contábil.',
    }
  }

  return {
    category: 'unexpected',
    retryable: false,
    code: fields.code,
    httpStatus: status,
    requestId,
    userMessage: cleanMessage || 'Não foi possível consultar o Diário Contábil.',
  }
}

function waitAbortable(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    if (signal?.aborted) {
      return Promise.reject(createDiaryCodedError('Consulta cancelada.', 'ABORTED', 'aborted'))
    }
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createDiaryCodedError('Consulta cancelada.', 'ABORTED', 'aborted'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(createDiaryCodedError('Consulta cancelada.', 'ABORTED', 'aborted'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function executeDiaryReadRpc<T>(params: {
  client: SupabaseClient
  rpcName: DiaryRpcName
  rpcArgs: Record<string, unknown>
  validate: (data: unknown) => T
  options?: DiaryReadOptions
}): Promise<T> {
  const { client, rpcName, rpcArgs, validate, options } = params
  const signal = options?.signal
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_DIARY_RETRY_DELAY_MS
  const startedWallMs = Date.now()
  let attempts = 0

  while (attempts <= MAX_DIARY_READ_TRANSIENT_RETRIES) {
    if (signal?.aborted) {
      const diag: DiaryRpcDiagnostic = {
        rpc: rpcName,
        ok: false,
        category: 'aborted',
        durationMs: Math.max(0, Date.now() - startedWallMs),
        attempts,
        retried: attempts > 1,
        requestId: null,
        httpStatus: null,
        errorCode: 'ABORTED',
        message: 'Consulta cancelada.',
      }
      options?.onDiagnostic?.(diag)
      throw createDiaryCodedError('Consulta cancelada.', 'ABORTED', 'aborted', diag)
    }

    attempts += 1
    const attemptStartMs = Date.now()

    try {
      const builder = client.rpc(rpcName, rpcArgs) as unknown as PromiseLike<{
        data: unknown
        error: unknown
        status?: number
      }> & { abortSignal?: (s: AbortSignal) => PromiseLike<{ data: unknown; error: unknown; status?: number }> }

      const response =
        signal && builder && typeof builder.abortSignal === 'function'
          ? await builder.abortSignal(signal)
          : await builder

      if (signal?.aborted) {
        throw createDiaryCodedError('Consulta cancelada.', 'ABORTED', 'aborted')
      }

      const transportMeta = getLastRpcTransportMeta(rpcName, attemptStartMs)
      const responseStatus = typeof response?.status === 'number' ? response.status : (transportMeta?.httpStatus ?? null)
      const requestId = transportMeta?.requestId ?? null

      if (response?.error) {
        const errWithMeta =
          response.error && typeof response.error === 'object'
            ? { ...(response.error as Record<string, unknown>), status: (response.error as Record<string, unknown>).status ?? responseStatus, requestId: (response.error as Record<string, unknown>).requestId ?? requestId }
            : response.error
        throw errWithMeta
      }

      const validated = validate(response?.data)
      const diag: DiaryRpcDiagnostic = {
        rpc: rpcName,
        ok: true,
        category: 'ok',
        durationMs: Math.max(0, Date.now() - startedWallMs),
        attempts,
        retried: attempts > 1,
        requestId,
        httpStatus: responseStatus ?? 200,
        errorCode: null,
        message: null,
      }
      options?.onDiagnostic?.(diag)
      return validated
    } catch (cause) {
      const transportMeta = getLastRpcTransportMeta(rpcName, attemptStartMs)
      const classified = classifyDiaryReadError(
        cause,
        signal,
        transportMeta?.httpStatus ?? null,
        transportMeta?.requestId ?? null,
      )

      const canRetry =
        classified.retryable &&
        !signal?.aborted &&
        attempts <= MAX_DIARY_READ_TRANSIENT_RETRIES

      if (canRetry) {
        await waitAbortable(retryDelayMs, signal)
        continue
      }

      const diag: DiaryRpcDiagnostic = {
        rpc: rpcName,
        ok: false,
        category: classified.category,
        durationMs: Math.max(0, Date.now() - startedWallMs),
        attempts,
        retried: attempts > 1,
        requestId: classified.requestId,
        httpStatus: classified.httpStatus,
        errorCode: classified.code,
        message: classified.userMessage,
      }
      options?.onDiagnostic?.(diag)
      throw createDiaryCodedError(
        classified.userMessage,
        classified.code ?? classified.category.toUpperCase(),
        classified.category,
        diag,
      )
    }
  }

  throw createDiaryCodedError('Não foi possível consultar o Diário Contábil.', 'UNEXPECTED', 'unexpected')
}

export function serializeDiaryFilter(filter: DiaryFilter): string {
  return JSON.stringify({
    fromDate: filter.fromDate,
    toDate: filter.toDate,
    dateBasis: filter.dateBasis,
    eventType: filter.eventType || null,
    accountId: filter.accountId || null,
    onlyReversals: Boolean(filter.onlyReversals),
  })
}

function validateDiaryEntryRow(row: unknown, organizationId: string, filter?: DiaryFilter): DiaryEntry {
  if (!row || typeof row !== 'object') {
    throw createDiaryCodedError('Lançamento do Diário inválido.', 'INCONSISTENT_DIARY_RESPONSE', 'inconsistent_response')
  }
  const r = row as DiaryEntry
  if (
    r.organization_id !== organizationId ||
    typeof r.entry_id !== 'string' ||
    !r.entry_id ||
    !ISO_DATE.test(String(r.event_date)) ||
    !ISO_DATE.test(String(r.accounting_period)) ||
    typeof r.event_type !== 'string' ||
    typeof r.source_table !== 'string' ||
    typeof r.source_id !== 'string'
  ) {
    throw createDiaryCodedError(
      'Dados inconsistentes ou de outra Loja detectados no Diário.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  const cents = toCentsStrict(r.amount, 'Valor do lançamento')
  if (cents <= 0n) {
    throw createDiaryCodedError(
      'Lançamento com valor nulo ou negativo não permitido no Diário.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  if (filter) {
    const basisDate = filter.dateBasis === 'competence' ? r.accounting_period : r.event_date
    if (basisDate < filter.fromDate || basisDate > filter.toDate) {
      throw createDiaryCodedError(
        'Lançamento fora do período consultado detectado no Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (filter.eventType && r.event_type !== filter.eventType) {
      throw createDiaryCodedError(
        'Lançamento divergente do filtro de tipo de evento detectado no Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (
      filter.accountId &&
      r.debit_account_id !== filter.accountId &&
      r.credit_account_id !== filter.accountId
    ) {
      throw createDiaryCodedError(
        'Lançamento divergente do filtro de conta contábil detectado no Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (filter.onlyReversals && !r.is_reversal_or_correction) {
      throw createDiaryCodedError(
        'Lançamento divergente do filtro de estornos/retificações detectado no Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
  }
  return r
}

function validateDiarySummaryPayload(
  data: unknown,
  organizationId: string,
  filter: DiaryFilter,
): DiarySummary {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createDiaryCodedError('Resumo do Diário inválido.', 'INCONSISTENT_DIARY_RESPONSE', 'inconsistent_response')
  }
  const summary = data as DiarySummary
  if (summary.organization_id !== organizationId) {
    throw createDiaryCodedError(
      'Resumo do Diário pertence a outra Loja.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  if (
    summary.from_date !== filter.fromDate ||
    summary.to_date !== filter.toDate ||
    summary.date_basis !== filter.dateBasis
  ) {
    throw createDiaryCodedError(
      'Resumo do Diário diverge do período ou critério consultado.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  const debitCents = toCentsStrict(summary.total_debit, 'Total de débitos')
  const creditCents = toCentsStrict(summary.total_credit, 'Total de créditos')
  if (debitCents < 0n || creditCents < 0n || debitCents !== creditCents || !summary.balanced) {
    throw createDiaryCodedError(
      'Desequilíbrio entre débitos e créditos detectado no Diário.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  if (
    !Number.isInteger(summary.total_count) ||
    summary.total_count < 0 ||
    !Number.isInteger(summary.unmapped_count) ||
    summary.unmapped_count < 0 ||
    summary.unmapped_count > summary.total_count ||
    !Number.isInteger(summary.legacy_non_posting_count) ||
    summary.legacy_non_posting_count < 0 ||
    !Array.isArray(summary.incomplete_reasons) ||
    !Array.isArray(summary.plans)
  ) {
    throw createDiaryCodedError(
      'Contagem total do Diário inválida.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  if (
    summary.integral_ok &&
    (summary.unmapped_count > 0 ||
      summary.legacy_non_posting_count > 0 ||
      summary.incomplete_reasons.length > 0)
  ) {
    throw createDiaryCodedError(
      'Selo integral inconsistente com pendências contábeis reportadas no resumo do Diário.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  return summary
}

export function validateDiarySummaryAndPageCoherence(
  summary: DiarySummary,
  entries: DiaryEntry[],
  filter: DiaryFilter,
  page: number,
  pageSize: number,
): void {
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize <= 0) {
    throw createDiaryCodedError('Parâmetros de paginação do Diário inválidos.', 'INCONSISTENT_DIARY_RESPONSE', 'inconsistent_response')
  }
  if (
    summary.from_date !== filter.fromDate ||
    summary.to_date !== filter.toDate ||
    summary.date_basis !== filter.dateBasis
  ) {
    throw createDiaryCodedError(
      'Resumo do Diário diverge dos filtros ativos.',
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  const expectedPageCount = Math.max(0, Math.min(pageSize, summary.total_count - page * pageSize))
  if (entries.length !== expectedPageCount) {
    throw createDiaryCodedError(
      `Inconsistência entre resumo e página do Diário: esperava ${expectedPageCount} partida(s) na página ${page + 1}, mas recebeu ${entries.length}.`,
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
  }
  const seenIds = new Set<string>()
  let pageSumCents = 0n
  let pageUnmapped = 0
  for (const row of entries) {
    if (row.organization_id !== summary.organization_id) {
      throw createDiaryCodedError(
        'Divergência de Loja entre resumo e lançamentos do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (seenIds.has(row.entry_id)) {
      throw createDiaryCodedError(
        'Partida duplicada detectada na página do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    seenIds.add(row.entry_id)
    pageSumCents += toCentsStrict(row.amount, 'Valor do lançamento')
    if (!row.is_fully_mapped) pageUnmapped += 1
  }
  const summaryDebitCents = toCentsStrict(summary.total_debit, 'Total de débitos')
  if (page === 0 && summary.total_count === entries.length) {
    if (pageSumCents !== summaryDebitCents) {
      throw createDiaryCodedError(
        'Soma das partidas carregadas diverge do total de débitos/créditos do resumo do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (pageUnmapped !== summary.unmapped_count) {
      throw createDiaryCodedError(
        'Contagem de partidas sem mapeamento diverge entre o resumo e a página do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
  } else {
    if (pageSumCents > summaryDebitCents) {
      throw createDiaryCodedError(
        'Soma da página excede o total consolidado no resumo do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
    if (pageUnmapped > summary.unmapped_count) {
      throw createDiaryCodedError(
        'Partidas sem mapeamento na página excedem o total reportado no resumo do Diário.',
        'INCONSISTENT_DIARY_RESPONSE',
        'inconsistent_response',
      )
    }
  }
}

export async function loadAccountingDiarySummary(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  options?: DiaryReadOptions,
): Promise<DiarySummary> {
  validateDateRange(filter.fromDate, filter.toDate)
  return executeDiaryReadRpc({
    client,
    rpcName: 'read_tenant_accounting_diary_summary',
    rpcArgs: {
      p_organization_id: organizationId,
      p_from_date: filter.fromDate,
      p_to_date: filter.toDate,
      p_date_basis: filter.dateBasis,
      p_event_type: filter.eventType || null,
      p_account_id: filter.accountId || null,
      p_only_reversals: Boolean(filter.onlyReversals),
    },
    validate: data => validateDiarySummaryPayload(data, organizationId, filter),
    options,
  })
}

export async function loadAccountingDiaryPage(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  page: number,
  pageSize = 100,
  options?: DiaryReadOptions,
): Promise<DiaryEntry[]> {
  validateDateRange(filter.fromDate, filter.toDate)
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize <= 0) {
    throw createDiaryCodedError('Parâmetros de paginação do Diário inválidos.', 'VALIDATION_ERROR', 'validation')
  }
  return executeDiaryReadRpc({
    client,
    rpcName: 'read_tenant_accounting_diary',
    rpcArgs: {
      p_organization_id: organizationId,
      p_from_date: filter.fromDate,
      p_to_date: filter.toDate,
      p_date_basis: filter.dateBasis,
      p_event_type: filter.eventType || null,
      p_account_id: filter.accountId || null,
      p_only_reversals: Boolean(filter.onlyReversals),
      p_page: page,
      p_page_size: pageSize,
    },
    validate: data => {
      if (!Array.isArray(data)) {
        throw createDiaryCodedError(
          'Resposta de lançamentos do Diário inválida.',
          'INCONSISTENT_DIARY_RESPONSE',
          'inconsistent_response',
        )
      }
      if (data.length > pageSize) {
        throw createDiaryCodedError(
          'Página do Diário excedeu o tamanho solicitado.',
          'INCONSISTENT_DIARY_RESPONSE',
          'inconsistent_response',
        )
      }
      return data.map(row => validateDiaryEntryRow(row, organizationId, filter))
    },
    options,
  })
}

export async function loadAccountingDiaryWithDiagnostics(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  page: number,
  pageSize = 50,
  options?: Omit<DiaryReadOptions, 'onDiagnostic'>,
): Promise<DiaryQueryWithDiagnosticsResult> {
  validateDateRange(filter.fromDate, filter.toDate)
  let summaryDiag: DiaryRpcDiagnostic | null = null
  let pageDiag: DiaryRpcDiagnostic | null = null

  const [sumSettled, pageSettled] = await Promise.allSettled([
    loadAccountingDiarySummary(client, organizationId, filter, {
      ...options,
      onDiagnostic: d => {
        summaryDiag = d
      },
    }),
    loadAccountingDiaryPage(client, organizationId, filter, page, pageSize, {
      ...options,
      onDiagnostic: d => {
        pageDiag = d
      },
    }),
  ])

  const finalizedSummaryDiag: DiaryRpcDiagnostic = summaryDiag ?? {
    rpc: 'read_tenant_accounting_diary_summary',
    ok: sumSettled.status === 'fulfilled',
    category: sumSettled.status === 'fulfilled' ? 'ok' : classifyDiaryReadError(sumSettled.reason, options?.signal).category,
    durationMs: 0,
    attempts: 1,
    retried: false,
    requestId: null,
    httpStatus: null,
    errorCode: null,
    message: sumSettled.status === 'rejected' ? classifyDiaryReadError(sumSettled.reason, options?.signal).userMessage : null,
  }
  const finalizedPageDiag: DiaryRpcDiagnostic = pageDiag ?? {
    rpc: 'read_tenant_accounting_diary',
    ok: pageSettled.status === 'fulfilled',
    category: pageSettled.status === 'fulfilled' ? 'ok' : classifyDiaryReadError(pageSettled.reason, options?.signal).category,
    durationMs: 0,
    attempts: 1,
    retried: false,
    requestId: null,
    httpStatus: null,
    errorCode: null,
    message: pageSettled.status === 'rejected' ? classifyDiaryReadError(pageSettled.reason, options?.signal).userMessage : null,
  }

  if (sumSettled.status === 'rejected' || pageSettled.status === 'rejected') {
    const primaryReason =
      sumSettled.status === 'rejected'
        ? sumSettled.reason
        : pageSettled.status === 'rejected'
          ? pageSettled.reason
          : null
    const classified = classifyDiaryReadError(primaryReason, options?.signal)
    const err = createDiaryCodedError(
      classified.userMessage,
      classified.code ?? classified.category.toUpperCase(),
      classified.category,
    )
    err.diagnostics = [finalizedSummaryDiag, finalizedPageDiag]
    throw err
  }

  try {
    validateDiarySummaryAndPageCoherence(sumSettled.value, pageSettled.value, filter, page, pageSize)
  } catch (coherenceErr) {
    const classified = classifyDiaryReadError(coherenceErr, options?.signal)
    const err = createDiaryCodedError(
      classified.userMessage,
      'INCONSISTENT_DIARY_RESPONSE',
      'inconsistent_response',
    )
    err.diagnostics = [
      finalizedSummaryDiag,
      {
        ...finalizedPageDiag,
        ok: false,
        category: 'inconsistent_response',
        errorCode: 'INCONSISTENT_DIARY_RESPONSE',
        message: classified.userMessage,
      },
    ]
    throw err
  }

  return {
    summary: sumSettled.value,
    entries: pageSettled.value,
    diagnostics: {
      summary: finalizedSummaryDiag,
      page: finalizedPageDiag,
    },
  }
}

export async function loadAllAccountingDiaryPages(
  client: SupabaseClient,
  organizationId: string,
  filter: DiaryFilter,
  signal?: AbortSignal,
  options?: { retryDelayMs?: number },
): Promise<{ summary: DiarySummary; entries: DiaryEntry[] }> {
  const readOptions: DiaryReadOptions = { signal, retryDelayMs: options?.retryDelayMs }
  const summary = await loadAccountingDiarySummary(client, organizationId, filter, readOptions)
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
    const batch = await loadAccountingDiaryPage(client, organizationId, filter, page, PAGE_SIZE_EXPORT, readOptions)
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
