import type { SupabaseClient } from '@supabase/supabase-js'

export type ActiveMasterSupportSession = {
  id: string
  staff_user_id: string
  organization_id: string
  reason: string
  scope: 'read_only'
  started_at: string
  expires_at: string
  created_at: string
  is_active: boolean
  seconds_remaining: number
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function generateSupportIdempotencyKey(prefix = 'master-sess'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}:${crypto.randomUUID()}`
    }
  } catch {
    // fallback below
  }
  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function getActiveMasterSupportSession(
  client: SupabaseClient,
  organizationId: string
): Promise<ActiveMasterSupportSession | null> {
  const org = organizationId?.trim()
  if (!org || !UUID_REGEX.test(org)) {
    throw new Error('ID de organização inválido para consulta de sessão.')
  }

  const { data, error } = await client.rpc('get_active_master_support_session', {
    p_organization_id: org,
  })

  if (error) {
    throw new Error(error.message || 'Falha ao consultar sessão ativa de suporte.')
  }

  if (!data) return null

  const row = data as Record<string, unknown>
  if (!row.id || typeof row.id !== 'string' || !UUID_REGEX.test(row.id)) {
    throw new Error('Dados de sessão corrompidos ou inesperados do servidor.')
  }

  return {
    id: row.id,
    staff_user_id: String(row.staff_user_id || ''),
    organization_id: String(row.organization_id || ''),
    reason: String(row.reason || ''),
    scope: 'read_only',
    started_at: String(row.started_at || ''),
    expires_at: String(row.expires_at || ''),
    created_at: String(row.created_at || ''),
    is_active: Boolean(row.is_active),
    seconds_remaining: Math.max(0, Number(row.seconds_remaining) || 0),
  }
}

export async function startMasterSupportSession(
  client: SupabaseClient,
  args: {
    organizationId: string
    reason: string
    idempotencyKey?: string
  }
): Promise<string> {
  const org = args.organizationId?.trim()
  if (!org || !UUID_REGEX.test(org)) {
    throw new Error('ID de organização inválido.')
  }

  const reason = args.reason?.trim()
  if (!reason || reason.length < 5 || reason.length > 500) {
    throw new Error('O motivo do acesso deve conter entre 5 e 500 caracteres.')
  }

  const key = args.idempotencyKey?.trim() || generateSupportIdempotencyKey('start-sess')
  if (key.length > 200) {
    throw new Error('Chave de idempotência excede 200 caracteres.')
  }

  const { data, error } = await client.rpc('start_master_support_session', {
    p_organization_id: org,
    p_reason: reason,
    p_idempotency_key: key,
  })

  if (error) {
    throw new Error(error.message || 'Falha ao iniciar sessão de suporte Master.')
  }

  if (!data || typeof data !== 'string' || !UUID_REGEX.test(data)) {
    throw new Error('Identificador de sessão retornado pelo servidor é inválido.')
  }

  return data
}

export async function endMasterSupportSession(
  client: SupabaseClient,
  args: {
    organizationId: string
    sessionId: string
    idempotencyKey?: string
  }
): Promise<string> {
  const org = args.organizationId?.trim()
  if (!org || !UUID_REGEX.test(org)) {
    throw new Error('ID de organização inválido.')
  }

  const sess = args.sessionId?.trim()
  if (!sess || !UUID_REGEX.test(sess)) {
    throw new Error('ID de sessão inválido.')
  }

  const key = args.idempotencyKey?.trim() || generateSupportIdempotencyKey('end-sess')
  if (key.length > 200) {
    throw new Error('Chave de idempotência excede 200 caracteres.')
  }

  const { data, error } = await client.rpc('end_master_support_session', {
    p_organization_id: org,
    p_session_id: sess,
    p_idempotency_key: key,
  })

  if (error) {
    throw new Error(error.message || 'Falha ao encerrar sessão de suporte Master.')
  }

  if (!data || typeof data !== 'string' || !UUID_REGEX.test(data)) {
    throw new Error('Identificador de encerramento retornado pelo servidor é inválido.')
  }

  return data
}
