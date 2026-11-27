import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createPrivacyClientError(
  message: string,
  code: string,
): Error & { code: string } {
  const err = new Error(message) as Error & { code: string }
  err.code = code
  return err
}

export function assertM05Uuid(value: string, label: string): string {
  const trimmed = value.trim()
  if (!UUID_REGEX.test(trimmed)) {
    throw createPrivacyClientError(`${label} inválido`, 'CLIENT_VALIDATION')
  }
  return trimmed
}

export function isM05Uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim())
}

export function generateM05IdempotencyKey(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'm05'
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${cleanPrefix}-${crypto.randomUUID()}`
  }
  return `${cleanPrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export type PortabilityScope = 'organization_full' | 'data_subject_package'
export type PortabilityFormat = 'json' | 'csv'

export type RetentionCategory =
  | 'financial_ledger'
  | 'access_logs'
  | 'operational_logs'
  | 'cadastral'
  | 'attachments'
  | 'all'

export type PrivacyDataCategory =
  | 'cadastral'
  | 'financial_ledger'
  | 'sensitive_philosophical'
  | 'access_logs'
  | 'operational_logs'
  | 'attachments'

export type PrivacyRequestType = 'access' | 'correction' | 'portability' | 'anonymization' | 'deletion'
export type PrivacyVerificationMethod =
  | 'authenticated_member_link'
  | 'signed_document_verified'
  | 'in_person_controller_check'
export type PrivacyLegalBasis =
  | 'legal_obligation_accounting'
  | 'contract_execution'
  | 'legitimate_interest'
  | 'consent'
  | 'exercise_of_rights'
export type PrivacyDecisionOutcome =
  | 'pending_triage'
  | 'fulfilled'
  | 'pseudonymized'
  | 'anonymized_verified'
  | 'retained_by_law'
  | 'rejected_unverified'

export interface PortabilityExportRecord {
  export_id: string
  organization_id: string
  export_scope: PortabilityScope
  subject_member_id: string | null
  package_format: PortabilityFormat
  status: 'ready' | 'blocked_incomplete' | 'expired'
  retention_posture: string
  payload_sha256: string
  expires_at: string
  created_at: string
  manifest: {
    export_scope: PortabilityScope
    retention_posture: string
    binary_files_included?: boolean
    attachments_note?: string
    restoration_note: string
    excluded_scopes: string[]
    counts: Record<string, number>
    totals_cents: Record<string, number>
  }
  data_dictionary?: Record<string, unknown>
}

export interface EligibleAttachmentMetadata {
  id: string
  storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string | null
  classification: "internal" | "confidential"
  binary_embedded?: boolean
  created_at: string
}



export interface DownloadedPortabilityPackage {
  export_id: string
  organization_id: string
  export_scope: PortabilityScope
  subject_member_id: string | null
  package_format: PortabilityFormat
  payload_sha256: string
  expires_at: string
  downloaded_at: string
  manifest: PortabilityExportRecord['manifest']
  data_dictionary: Record<string, unknown>
  payload: Record<string, unknown>
}

export interface PrivacyRequestRecord {
  request_id: string
  organization_id: string
  member_id: string | null
  request_type: PrivacyRequestType
  data_category: PrivacyDataCategory
  requester_verification_method: PrivacyVerificationMethod
  requester_verified: boolean
  legal_basis: PrivacyLegalBasis
  decision_outcome: PrivacyDecisionOutcome
  triage_due_at: string
  triaged_at: string | null
  controller_justification: string | null
  anonymization_assessment: Record<string, unknown>
  ledger_preserved: boolean
  created_at: string
}

export interface RegisteredPrivacyRequestResult {
  request_id: string
  organization_id: string
  decision_outcome: PrivacyDecisionOutcome
  triage_due_at: string
  ledger_preserved: boolean
  requester_verified?: boolean
  requester_verification_method?: PrivacyVerificationMethod
}

export type PrivacyErrorKind =
  | 'auth'
  | 'validation'
  | 'conflict'
  | 'uncertain'
  | 'unexpected'

export interface ClassifiedPrivacyError {
  kind: PrivacyErrorKind
  code: string | null
  message: string
  retryableWithSameKey: boolean
}

export function sanitizePrivacyMessage(raw: string): string {
  return raw
    .replace(/\b(password|passwd|secret|token|apikey|api_key|authorization)\s*[:=]\s*\S+/gi, '[redigido]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redigido]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redigido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260)
}

function extractRawPrivacyError(err: unknown): {
  code: string | null
  status: number | null
  name: string | null
  message: string
} {
  if (err instanceof Error) {
    const extra = err as Error & { code?: unknown; status?: unknown; details?: unknown }
    return {
      code: typeof extra.code === 'string' ? extra.code : null,
      status: typeof extra.status === 'number' ? extra.status : null,
      name: err.name || null,
      message: err.message || '',
    }
  }
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    return {
      code: typeof rec.code === 'string' ? rec.code : null,
      status: typeof rec.status === 'number' ? rec.status : null,
      name: typeof rec.name === 'string' ? rec.name : null,
      message: typeof rec.message === 'string' ? rec.message : '',
    }
  }
  if (typeof err === 'string') {
    return { code: null, status: null, name: null, message: err }
  }
  return { code: null, status: null, name: null, message: '' }
}

export function classifyPrivacyError(
  err: unknown,
  fallbackMessage = 'Não foi possível concluir a operação LGPD.',
): ClassifiedPrivacyError {
  const { code, status, name, message } = extractRawPrivacyError(err)
  const cleanMsg = sanitizePrivacyMessage(message)
  const lower = cleanMsg.toLowerCase()

  if (code === 'INVALID_RPC_RESPONSE') {
    return {
      kind: 'uncertain',
      code,
      message:
        cleanMsg ||
        'Resposta do servidor incompleta ou inválida. Reconcilie utilizando a mesma chave idempotente antes de enviar outra solicitação.',
      retryableWithSameKey: true,
    }
  }

  if (
    name === 'AbortError' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (status !== null && status >= 500) ||
    /timeout|timed out|abort|network|failed to fetch|fetcherror|connection|gateway|service unavailable|504|502|503|408/.test(
      lower,
    )
  ) {
    return {
      kind: 'uncertain',
      code,
      message:
        'Não foi possível confirmar se o servidor concluiu o registro (tempo limite ou falha de comunicação). Reconcilie utilizando a mesma chave idempotente.',
      retryableWithSameKey: true,
    }
  }

  if (code === '28000' || status === 401 || /authentication required|not authenticated|jwt expired/.test(lower)) {
    return {
      kind: 'auth',
      code: code ?? '28000',
      message: 'Sessão autenticada expirada ou ausente para operar dados LGPD desta Loja.',
      retryableWithSameKey: false,
    }
  }

  if (
    code === '42501' ||
    status === 403 ||
    /controller permission required/.test(lower) ||
    /authenticated_member_link verification can only be confirmed/.test(lower) ||
    /access denied|permission denied|row-level security/.test(lower)
  ) {
    let friendly = 'Acesso negado: seu perfil não possui autorização para esta operação LGPD nesta Loja.'
    if (/controller permission required/.test(lower)) {
      friendly =
        'O método de verificação selecionado é reservado ao controlador autorizado (settings.manage ou members.write).'
    } else if (/authenticated_member_link verification can only be confirmed/.test(lower)) {
      friendly =
        'A validação por sessão autenticada do titular só pode ser confirmada pela própria sessão vinculada do titular.'
    }
    return {
      kind: 'auth',
      code: code ?? '42501',
      message: friendly,
      retryableWithSameKey: false,
    }
  }

  if (code === 'PT409' || /idempotency key already used with different payload/.test(lower)) {
    return {
      kind: 'conflict',
      code: code ?? 'PT409',
      message:
        'A chave idempotente já foi utilizada com outro conteúdo. Confirme ou inicie uma nova intenção para outro pedido.',
      retryableWithSameKey: false,
    }
  }

  if (
    code === 'CLIENT_VALIDATION' ||
    code === '22023' ||
    code === '23503' ||
    code === '23505'
  ) {
    let friendly = cleanMsg || fallbackMessage
    if (/authenticated_member_link requires member_id/.test(lower)) {
      friendly = 'O método "Sessão autenticada do titular" exige informar o UUID do integrante.'
    } else if (/member does not have an authenticated user link/.test(lower)) {
      friendly = 'O integrante informado não possui conta de usuário autenticada vinculada nesta Loja.'
    } else if (/member not found in organization/.test(lower)) {
      friendly = 'Integrante não encontrado na Loja selecionada.'
    } else if (/notes cannot exceed 1000 characters/.test(lower)) {
      friendly = 'As observações sanitizadas não podem ultrapassar 1000 caracteres.'
    } else if (/notes cannot contain secrets/.test(lower)) {
      friendly = 'Observações não podem conter credenciais, tokens ou segredos.'
    }
    return {
      kind: 'validation',
      code,
      message: friendly,
      retryableWithSameKey: false,
    }
  }

  return {
    kind: 'unexpected',
    code,
    message: cleanMsg || fallbackMessage,
    retryableWithSameKey: false,
  }
}

export interface RetentionScheduleItem {
  category: string
  retention_label: string
  legal_note: string
}

export interface RetentionHoldRecord {
  id: string
  data_category: RetentionCategory
  hold_reason: string
  legal_reference: string
  hold_status: 'active' | 'released'
  placed_at: string
  released_at: string | null
  release_reason: string | null
}

export interface TenantRetentionPosture {
  organization_id: string
  subscription_status: string
  canceled_at: string | null
  current_period_end: string | null
  write_allowed: boolean
  export_allowed: boolean
  export_window_ends_at: string | null
  retention_phase:
    | 'active_operations'
    | 'suspended_export_allowed'
    | 'post_cancel_export_window'
    | 'archived_restricted'
    | 'no_subscription_restricted'
    | string
  legal_hold_active: boolean
  active_holds_count: number
  auto_purge_enabled: boolean
  deletion_requires_controller_order: boolean
  schedule: RetentionScheduleItem[]
  holds: RetentionHoldRecord[]
}

export const PRIVACY_CATEGORY_LABELS: Record<PrivacyDataCategory, string> = {
  cadastral: 'Cadastral',
  financial_ledger: 'Fatos Financeiros / Contábeis (Imutável)',
  sensitive_philosophical: 'Vínculo Filosófico / Iniciático (Sensível)',
  access_logs: 'Logs de Acesso (6 meses)',
  operational_logs: 'Logs Operacionais (90 dias)',
  attachments: 'Anexos Elegíveis',
}

export const PRIVACY_OUTCOME_LABELS: Record<PrivacyDecisionOutcome, string> = {
  pending_triage: 'Em triagem (meta 2 dias úteis)',
  fulfilled: 'Atendida',
  pseudonymized: 'Pseudonimizada (reidentificável — proteção mantida)',
  anonymized_verified: 'Anonimizada (sem risco residual)',
  retained_by_law: 'Retida por obrigação legal / guarda contábil',
  rejected_unverified: 'Bloqueada por falta de verificação do titular',
}

export const RETENTION_PHASE_LABELS: Record<string, string> = {
  active_operations: 'Operação regular ativa',
  suspended_export_allowed: 'Suspensa / encerramento agendado (exportação permitida)',
  post_cancel_export_window: 'Janela pós-cancelamento de 90 dias (somente leitura/portabilidade)',
  archived_restricted: 'Arquivamento restrito (janela de 90 dias encerrada)',
  no_subscription_restricted: 'Sem assinatura ativa (acesso restrito)',
}

/**
 * Neutralizes spreadsheet CSV formula injection after NFKC normalization
 * (consistent with src/lib/delinquency-export.ts).
 */
export function sanitizeCsvCell(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return '""'
  const text = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue)
  const compact = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
  const normalized = compact.normalize('NFKC')
  const safe = /^[=+\-@]/.test(normalized) ? `'${compact}` : compact
  return `"${safe.replace(/"/g, '""')}"`
}

export function buildPortabilityCsvBundle(payload: Record<string, unknown>): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [datasetName, rawRows] of Object.entries(payload)) {
    const rows = Array.isArray(rawRows) ? rawRows : rawRows && typeof rawRows === 'object' ? [rawRows] : []
    if (rows.length === 0) {
      files[`${datasetName}.csv`] = ''
      continue
    }
    const headers: string[] = []
    for (const row of rows) {
      if (row && typeof row === 'object') {
        for (const key of Object.keys(row as Record<string, unknown>)) {
          if (!headers.includes(key)) headers.push(key)
        }
      }
    }
    const lines = [headers.map(h => sanitizeCsvCell(h)).join(',')]
    for (const row of rows) {
      const record = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
      lines.push(headers.map(h => sanitizeCsvCell(record[h])).join(','))
    }
    files[`${datasetName}.csv`] = lines.join('\n')
  }
  return files
}

function computeSha256HexFallback(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n))
  const bitLen = bytes.length * 8
  const padLen = ((bytes.length + 8) >>> 6) + 1
  const buf = new Uint8Array(padLen * 64)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(buf.length - 8, Math.floor(bitLen / 0x100000000), false)
  view.setUint32(buf.length - 4, bitLen >>> 0, false)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const w = new Uint32Array(64)
  for (let i = 0; i < buf.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + temp1) >>> 0
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(v => v.toString(16).padStart(8, '0')).join('')
}

export async function verifySha256Integrity(text: string, expectedHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) return false
  const bytes = new TextEncoder().encode(text)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hex = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hex.toLowerCase() === expectedHex.toLowerCase()
  }
  return computeSha256HexFallback(bytes) === expectedHex.toLowerCase()
}

export async function readTenantRetentionPosture(
  client: SupabaseClient,
  organizationId: string,
): Promise<TenantRetentionPosture> {
  const orgId = assertM05Uuid(organizationId, 'Organização')
  const { data, error } = await client.rpc('read_tenant_retention_posture', {
    p_organization_id: orgId,
  })
  if (error) throw error
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !Array.isArray((data as TenantRetentionPosture).schedule)
  ) {
    throw createPrivacyClientError(
      'Resposta inválida ao consultar a postura de retenção da Loja.',
      'INVALID_RPC_RESPONSE',
    )
  }
  const posture = data as TenantRetentionPosture
  if (
    typeof posture.organization_id === 'string' &&
    posture.organization_id.toLowerCase() !== orgId.toLowerCase()
  ) {
    throw createPrivacyClientError(
      'Inconsistência de isolamento multi-tenant na postura de retenção.',
      'INVALID_RPC_RESPONSE',
    )
  }
  return posture
}

export async function placeTenantLegalHold(
  client: SupabaseClient,
  params: {
    organizationId: string
    dataCategory: RetentionCategory
    holdReason: string
    legalReference: string
    idempotencyKey?: string
  },
) {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const { data, error } = await client.rpc('place_tenant_legal_hold_idempotent', {
    p_organization_id: orgId,
    p_data_category: params.dataCategory,
    p_hold_reason: params.holdReason,
    p_legal_reference: params.legalReference,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('hold-place'),
  })
  if (error) throw error
  return data
}

export async function releaseTenantLegalHold(
  client: SupabaseClient,
  params: {
    organizationId: string
    holdId: string
    releaseReason: string
    idempotencyKey?: string
  },
) {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const holdId = assertM05Uuid(params.holdId, 'Retenção legal')
  const { data, error } = await client.rpc('release_tenant_legal_hold_idempotent', {
    p_organization_id: orgId,
    p_hold_id: holdId,
    p_release_reason: params.releaseReason,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('hold-release'),
  })
  if (error) throw error
  return data
}

export async function listTenantPortabilityExports(
  client: SupabaseClient,
  organizationId: string,
): Promise<PortabilityExportRecord[]> {
  const orgId = assertM05Uuid(organizationId, 'Organização')
  const { data, error } = await client.rpc('list_tenant_portability_exports', {
    p_organization_id: orgId,
  })
  if (error) throw error
  if (!Array.isArray(data)) {
    throw createPrivacyClientError(
      'Resposta inválida ao listar pacotes de portabilidade da Loja.',
      'INVALID_RPC_RESPONSE',
    )
  }
  const rows = data as PortabilityExportRecord[]
  if (
    rows.some(
      row =>
        typeof row?.organization_id === 'string' &&
        row.organization_id.toLowerCase() !== orgId.toLowerCase(),
    )
  ) {
    throw createPrivacyClientError(
      'Inconsistência de isolamento multi-tenant na listagem de exportações.',
      'INVALID_RPC_RESPONSE',
    )
  }
  return rows
}

export async function createTenantPortabilityExport(
  client: SupabaseClient,
  params: {
    organizationId: string
    exportScope: PortabilityScope
    subjectMemberId?: string | null
    packageFormat: PortabilityFormat
    idempotencyKey?: string
  },
): Promise<PortabilityExportRecord> {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const subjectId = params.exportScope === 'data_subject_package'
    ? assertM05Uuid(params.subjectMemberId ?? '', 'Integrante titular')
    : null
  const { data, error } = await client.rpc('create_tenant_portability_export_idempotent', {
    p_organization_id: orgId,
    p_export_scope: params.exportScope,
    p_subject_member_id: subjectId,
    p_package_format: params.packageFormat,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('export'),
  })
  if (error) throw error
  return data as PortabilityExportRecord
}

export async function downloadTenantPortabilityExport(
  client: SupabaseClient,
  params: {
    organizationId: string
    exportId: string
    requestedFormat: PortabilityFormat
  },
): Promise<DownloadedPortabilityPackage> {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const exportId = assertM05Uuid(params.exportId, 'Pacote de exportação')
  const { data, error } = await client.rpc('download_tenant_portability_export', {
    p_organization_id: orgId,
    p_export_id: exportId,
    p_requested_format: params.requestedFormat,
  })
  if (error) throw error
  const pkg = data as DownloadedPortabilityPackage
  if (!pkg || !pkg.payload || !/^[0-9a-f]{64}$/i.test(pkg.payload_sha256)) {
    throw new Error('Pacote de exportação inválido ou sem digest SHA-256.')
  }
  return pkg
}

export async function listTenantPrivacyRequests(
  client: SupabaseClient,
  organizationId: string,
): Promise<PrivacyRequestRecord[]> {
  const orgId = assertM05Uuid(organizationId, 'Organização')
  const { data, error } = await client.rpc('list_tenant_privacy_requests', {
    p_organization_id: orgId,
  })
  if (error) throw error
  if (!Array.isArray(data)) {
    throw createPrivacyClientError(
      'Resposta inválida ao listar solicitações LGPD da Loja.',
      'INVALID_RPC_RESPONSE',
    )
  }
  const rows = data as PrivacyRequestRecord[]
  if (
    rows.some(
      row =>
        typeof row?.organization_id === 'string' &&
        row.organization_id.toLowerCase() !== orgId.toLowerCase(),
    )
  ) {
    throw createPrivacyClientError(
      'Inconsistência de isolamento multi-tenant na listagem de solicitações LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  return rows
}

export function validateRegisteredPrivacyRequestResult(
  data: unknown,
  expectedOrganizationId: string,
): RegisteredPrivacyRequestResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createPrivacyClientError(
      'Resposta do servidor ausente ou inválida após o envio da solicitação LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  const rec = data as Record<string, unknown>
  if (!isM05Uuid(rec.request_id) || !isM05Uuid(rec.organization_id)) {
    throw createPrivacyClientError(
      'Resposta do servidor sem request_id ou organization_id válido após o registro LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  if (rec.organization_id.trim().toLowerCase() !== expectedOrganizationId.trim().toLowerCase()) {
    throw createPrivacyClientError(
      'Resposta do servidor retornou organização divergente no registro LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  if (rec.decision_outcome !== 'pending_triage') {
    throw createPrivacyClientError(
      'Resposta do servidor retornou desfecho inicial inválido para a solicitação LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  if (typeof rec.triage_due_at !== 'string' || !Number.isFinite(Date.parse(rec.triage_due_at))) {
    throw createPrivacyClientError(
      'Resposta do servidor sem prazo de triagem válido após o registro LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  if (typeof rec.ledger_preserved !== 'boolean') {
    throw createPrivacyClientError(
      'Resposta do servidor sem confirmação de preservação contábil após o registro LGPD.',
      'INVALID_RPC_RESPONSE',
    )
  }
  return {
    request_id: rec.request_id.trim(),
    organization_id: rec.organization_id.trim(),
    decision_outcome: 'pending_triage',
    triage_due_at: rec.triage_due_at,
    ledger_preserved: rec.ledger_preserved,
    ...(typeof rec.requester_verified === 'boolean'
      ? { requester_verified: rec.requester_verified }
      : {}),
    ...(typeof rec.requester_verification_method === 'string'
      ? {
          requester_verification_method:
            rec.requester_verification_method as PrivacyVerificationMethod,
        }
      : {}),
  }
}

export async function registerTenantPrivacyRequest(
  client: SupabaseClient,
  params: {
    organizationId: string
    memberId?: string | null
    requestType: PrivacyRequestType
    dataCategory: PrivacyDataCategory
    verificationMethod: PrivacyVerificationMethod
    requesterVerified: boolean
    legalBasis: PrivacyLegalBasis
    notes: string
    idempotencyKey?: string
  },
): Promise<RegisteredPrivacyRequestResult> {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const memberId =
    params.memberId && params.memberId.trim()
      ? assertM05Uuid(params.memberId, 'Integrante')
      : null
  if (params.verificationMethod === 'authenticated_member_link' && !memberId) {
    throw createPrivacyClientError(
      'O método "Sessão autenticada do titular" exige informar o UUID do integrante.',
      'CLIENT_VALIDATION',
    )
  }
  const trimmedNotes = params.notes.trim()
  if (trimmedNotes.length > 1000) {
    throw createPrivacyClientError(
      'As observações sanitizadas não podem ultrapassar 1000 caracteres.',
      'CLIENT_VALIDATION',
    )
  }
  const { data, error } = await client.rpc('register_tenant_privacy_request_idempotent', {
    p_organization_id: orgId,
    p_member_id: memberId,
    p_request_type: params.requestType,
    p_data_category: params.dataCategory,
    p_verification_method: params.verificationMethod,
    p_requester_verified: params.requesterVerified,
    p_legal_basis: params.legalBasis,
    p_notes: trimmedNotes,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('priv-req'),
  })
  if (error) throw error
  return validateRegisteredPrivacyRequestResult(data, orgId)
}

export async function reviewTenantPrivacyRequest(
  client: SupabaseClient,
  params: {
    organizationId: string
    requestId: string
    decisionOutcome: Exclude<PrivacyDecisionOutcome, 'pending_triage'>
    legalBasis: PrivacyLegalBasis
    requesterVerified: boolean
    reidentificationRiskRemains: boolean
    controllerJustification: string
    idempotencyKey?: string
  },
) {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const requestId = assertM05Uuid(params.requestId, 'Solicitação')
  const { data, error } = await client.rpc('review_tenant_privacy_request_idempotent', {
    p_organization_id: orgId,
    p_request_id: requestId,
    p_decision_outcome: params.decisionOutcome,
    p_legal_basis: params.legalBasis,
    p_requester_verified: params.requesterVerified,
    p_reidentification_risk_remains: params.reidentificationRiskRemains,
    p_controller_justification: params.controllerJustification,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('priv-rev'),
  })
  if (error) throw error
  return data
}

export async function verifyBytesSha256Integrity(bytes: Uint8Array, expectedHex: string | null): Promise<boolean> {
  if (!expectedHex) return true
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) return false
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hex = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hex.toLowerCase() === expectedHex.toLowerCase()
  }
  return computeSha256HexFallback(bytes) === expectedHex.toLowerCase()
}

export async function downloadPortabilityAttachmentBinary(
  client: SupabaseClient,
  params: {
    organizationId: string
    exportId: string
    documentId: string
  },
): Promise<Blob> {
  const { data, error } = await client.functions.invoke<Blob>('portability-attachment', {
    body: {
      p_organization_id: assertM05Uuid(params.organizationId, 'Organização'),
      p_export_id: assertM05Uuid(params.exportId, 'Pacote de exportação'),
      p_document_id: assertM05Uuid(params.documentId, 'Anexo elegível'),
    },
  })
  if (error || !(data instanceof Blob)) {
    throw new Error('Não foi possível baixar o binário autorizado do anexo.')
  }
  return data
}
