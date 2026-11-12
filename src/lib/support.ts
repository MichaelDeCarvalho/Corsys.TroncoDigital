import type { SupabaseClient } from '@supabase/supabase-js'

export type SupportTicketCategory =
  | 'finance'
  | 'reports'
  | 'access'
  | 'configuration'
  | 'billing'
  | 'other'

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type SupportTicketStatus =
  | 'new'
  | 'triage'
  | 'working'
  | 'waiting_client'
  | 'resolved'
  | 'closed'

export type TenantSupportTicket = {
  id: string
  ticket_seq: number
  organization_id: string
  ticket_scope: 'tenant'
  subject: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  status: SupportTicketStatus
  opened_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
  first_response_seconds: number | null
  resolution_seconds: number | null
}

export type TenantTicketMessage = {
  id: string
  organization_id: string
  ticket_id: string
  sender_kind: 'tenant_user' | 'platform_staff' | 'system'
  visibility: 'customer' | 'internal'
  body: string
  created_at: string
}

export type TenantTicketEvent = {
  id: number | string
  organization_id: string
  ticket_id: string
  from_status: string | null
  to_status: string
  visibility: 'customer'
  created_at: string
}

export type TenantTicketMessagesResult = {
  messages: TenantTicketMessage[]
  isTruncated: boolean
}

/**
 * Sanitiza valores de duração em segundos retornados da view.
 * Garante que valores nulos, ausentes ou inválidos (NaN, negativos, não numéricos)
 * sejam convertidos para null, prevenindo a renderização de NaN na interface.
 */
export function sanitizeDurationSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(num) || num < 0) return null
  return Math.floor(num)
}

/**
 * Formata duração em minutos para exibição amigável sem risco de NaN.
 */
export function formatDurationMinutes(seconds: number | string | null | undefined): string | null {
  const sanitized = sanitizeDurationSeconds(seconds)
  if (sanitized === null) return null
  return `${Math.floor(sanitized / 60)} min`
}

export const SUPPORT_PAGE_SIZE = 15

export type SupportFilters = {
  search?: string
  statusFilter?: 'all' | 'open' | 'waiting_client' | 'resolved'
}

export async function loadTenantTickets(
  client: SupabaseClient,
  organizationId: string,
  page: number,
  filters: SupportFilters,
  signal: AbortSignal
): Promise<{ rows: TenantSupportTicket[]; hasNext: boolean }> {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Identificador da Loja inválido.')
  }
  if (!Number.isSafeInteger(page) || page < 0 || page > 500) {
    throw new Error('Página inválida.')
  }

  let query = client
    .from('v_saas_support_ticket_metrics')
    .select(
      'id,ticket_seq,organization_id,ticket_scope,subject,category,priority,status,opened_at,updated_at,resolved_at,closed_at,first_response_seconds,resolution_seconds'
    )
    .eq('organization_id', organizationId)
    .eq('ticket_scope', 'tenant')

  // Status filter
  if (filters.statusFilter === 'open') {
    query = query.in('status', ['new', 'triage', 'working', 'waiting_client'])
  } else if (filters.statusFilter === 'waiting_client') {
    query = query.eq('status', 'waiting_client')
  } else if (filters.statusFilter === 'resolved') {
    query = query.in('status', ['resolved', 'closed'])
  }

  // Search by subject or ticket sequence if numeric
  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim()
    const cleanNum = term.replace(/^#/, '')
    if (/^\d+$/.test(cleanNum)) {
      query = query.or(`subject.ilike.%${term}%,ticket_seq.eq.${cleanNum}`)
    } else {
      query = query.ilike('subject', `%${term}%`)
    }
  }

  const offset = page * SUPPORT_PAGE_SIZE
  query = query
    .order('opened_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + SUPPORT_PAGE_SIZE)
    .abortSignal(signal)

  const { data, error } = await query
  if (error) throw error

  if (!Array.isArray(data)) {
    throw new Error('Resposta de chamados inválida.')
  }

  // Tenant isolation and scope validation
  const sanitizedRows: TenantSupportTicket[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') {
      throw new Error('Registro de chamado inválido.')
    }
    if (item.organization_id !== organizationId) {
      throw new Error('Violação de isolamento de Loja nos chamados.')
    }
    if (item.ticket_scope !== 'tenant') {
      throw new Error('Violação de escopo: chamados internos não permitidos para a Loja.')
    }

    sanitizedRows.push({
      id: String(item.id),
      ticket_seq: Number(item.ticket_seq),
      organization_id: String(item.organization_id),
      ticket_scope: 'tenant',
      subject: String(item.subject ?? ''),
      category: item.category as SupportTicketCategory,
      priority: item.priority as SupportTicketPriority,
      status: item.status as SupportTicketStatus,
      opened_at: String(item.opened_at ?? ''),
      updated_at: String(item.updated_at ?? ''),
      resolved_at: item.resolved_at ? String(item.resolved_at) : null,
      closed_at: item.closed_at ? String(item.closed_at) : null,
      first_response_seconds: sanitizeDurationSeconds(item.first_response_seconds),
      resolution_seconds: sanitizeDurationSeconds(item.resolution_seconds),
    })
  }

  const hasNext = sanitizedRows.length > SUPPORT_PAGE_SIZE
  const rows = hasNext ? sanitizedRows.slice(0, SUPPORT_PAGE_SIZE) : sanitizedRows

  return { rows, hasNext }
}

export async function loadTenantTicketMessages(
  client: SupabaseClient,
  organizationId: string,
  ticketId: string,
  signal: AbortSignal
): Promise<TenantTicketMessagesResult> {
  if (!organizationId || !ticketId || typeof organizationId !== 'string' || typeof ticketId !== 'string') {
    throw new Error('Parâmetros de conversa inválidos.')
  }

  const { data, error } = await client
    .from('saas_support_ticket_messages')
    .select('id,organization_id,ticket_id,sender_kind,visibility,body,created_at')
    .eq('organization_id', organizationId)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200)
    .abortSignal(signal)

  if (error) throw error
  if (!Array.isArray(data)) return { messages: [], isTruncated: false }

  for (const msg of data) {
    if (msg.organization_id !== organizationId || msg.ticket_id !== ticketId) {
      throw new Error('Violação de isolamento no histórico de mensagens.')
    }
  }

  const isTruncated = data.length >= 200

  return {
    messages: data as TenantTicketMessage[],
    isTruncated,
  }
}

/**
 * Criação de chamado de suporte da Loja com suporte a idempotência server-side.
 */
export async function createTenantSupportTicket(
  client: SupabaseClient,
  params: {
    organizationId: string
    subject: string
    category: SupportTicketCategory
    priority: SupportTicketPriority
    message: string
    idempotencyKey?: string
  }
): Promise<string> {
  const { organizationId, subject, category, priority, message, idempotencyKey } = params

  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Identificador da Loja inválido.')
  }
  if (!subject.trim() || !message.trim()) {
    throw new Error('Assunto e mensagem são obrigatórios.')
  }

  const { data, error } = await client.rpc('create_saas_support_ticket', {
    p_organization_id: organizationId,
    p_subject: subject.trim(),
    p_category: category,
    p_priority: priority,
    p_message: message.trim(),
    p_idempotency_key: idempotencyKey ?? crypto.randomUUID(),
  })

  if (error) throw error
  if (typeof data !== 'string' || !data) {
    throw new Error('Criação do chamado não confirmada com resposta autoritativa pelo servidor.')
  }

  return data
}

/**
 * Resposta a chamado de suporte da Loja com suporte a idempotência server-side.
 */
export async function replyTenantSupportTicket(
  client: SupabaseClient,
  params: {
    organizationId: string
    ticketId: string
    message: string
    idempotencyKey?: string
  }
): Promise<string> {
  const { organizationId, ticketId, message, idempotencyKey } = params

  if (!organizationId || !ticketId || typeof organizationId !== 'string' || typeof ticketId !== 'string') {
    throw new Error('Parâmetros de resposta inválidos.')
  }
  if (!message.trim()) {
    throw new Error('A mensagem não pode ser vazia.')
  }

  const { data, error } = await client.rpc('reply_saas_support_ticket', {
    p_organization_id: organizationId,
    p_ticket_id: ticketId,
    p_message: message.trim(),
    p_idempotency_key: idempotencyKey ?? crypto.randomUUID(),
    p_next_status: null,
  })

  if (error) throw error
  if (typeof data !== 'string' || !data) {
    throw new Error('Resposta ao chamado não confirmada com resposta autoritativa pelo servidor.')
  }

  return data
}

/**
 * Consulta a trilha de eventos do chamado da Loja (transições públicas de estado).
 */
export async function loadTenantTicketEvents(
  client: SupabaseClient,
  organizationId: string,
  ticketId: string,
  signal: AbortSignal
): Promise<TenantTicketEvent[]> {
  if (!organizationId || !ticketId || typeof organizationId !== 'string' || typeof ticketId !== 'string') {
    throw new Error('Parâmetros de consulta de eventos inválidos.')
  }

  const { data, error } = await client
    .from('saas_support_ticket_events')
    .select('id,organization_id,ticket_id,from_status,to_status,visibility,created_at')
    .eq('organization_id', organizationId)
    .eq('ticket_id', ticketId)
    .eq('visibility', 'customer')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(201)
    .abortSignal(signal)

  if (error) throw error
  if (!Array.isArray(data) || data.length > 200) throw new Error('Trilha de eventos indisponível ou incompleta.')

  for (const ev of data as TenantTicketEvent[]) {
    if (!ev || ev.organization_id !== organizationId || ev.ticket_id !== ticketId ||
      ev.visibility !== 'customer' || typeof ev.to_status !== 'string' ||
      !Number.isFinite(Date.parse(ev.created_at))) {
      throw new Error('Violação de isolamento na trilha de eventos do chamado.')
    }
  }

  return data as TenantTicketEvent[]
}
