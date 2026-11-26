import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TenantSeatUsage = {
  organization_id: string
  active_users: number
  max_admin_users: number | null
  seats_remaining: number | null
  over_limit: boolean
  plan_id: string | null
  plan_version_id: string | null
  plan_name: string | null
  plan_code: string | null
  subscription_status: string | null
}

export type ScheduledChangeSummary = {
  id: string
  change_type: string
  target_plan_version_id: string | null
  target_plan_name: string | null
  target_price: number | string | null
  target_max_admin_users: number | null
  effective_at: string
}

export type TenantCommercialStatus = {
  organization_id: string
  subscription_id: string | null
  subscription_status: string | null
  commercial_status: string | null
  access_override: string
  write_allowed: boolean
  plan_id: string | null
  plan_code: string | null
  plan_name: string | null
  plan_version_id: string | null
  contract_price: number | string | null
  active_users: number
  max_admin_users: number | null
  current_period_start: string | null
  current_period_end: string | null
  billing_anchor_day: number | null
  past_due_since: string | null
  grace_until: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  export_window_until: string | null
  open_amount: number | string
  overdue_amount: number | string
  scheduled_change: ScheduledChangeSummary | null
}

export type SubscriptionPriceTerm = {
  id: string
  organization_id: string
  subscription_id: string
  effective_from: string
  effective_to: string | null
  unit_price: number | string
  currency: string
  adjustment_reason: string | null
  created_at: string
}

export type ScheduledSubscriptionChange = {
  id: string
  organization_id: string
  subscription_id: string
  change_type: string
  target_plan_version_id: string | null
  effective_at: string
  status: string
  reason: string
  applied_at: string | null
  created_at: string
}

export type SaasCollectionEvent = {
  id: number | string
  organization_id: string
  invoice_id: string | null
  event_type: string
  channel: string | null
  external_reference: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type SubscriptionLifecycleBundle = {
  commercialStatus: TenantCommercialStatus
  seatUsage: TenantSeatUsage
  priceTerms: SubscriptionPriceTerm[]
  scheduledChanges: ScheduledSubscriptionChange[]
  collectionEvents: SaasCollectionEvent[]
}

function assertUuid(value: string, label: string): string {
  const clean = value?.trim() || ''
  if (!UUID_RE.test(clean)) throw new Error(`${label} inválido.`)
  return clean
}

function assertReason(reason: string): string {
  const clean = reason?.trim() || ''
  if (clean.length < 3 || clean.length > 400) {
    throw new Error('Informe um motivo com 3 a 400 caracteres.')
  }
  return clean
}

function assertIdempotencyKey(key: string): string {
  const clean = key?.trim() || ''
  if (clean.length < 1 || clean.length > 200) {
    throw new Error('Chave de idempotência inválida.')
  }
  return clean
}

export function isValidTenantCommercialStatusPayload(data: unknown, orgId: string): data is TenantCommercialStatus {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const row = data as Record<string, unknown>
  return row.organization_id === orgId
    && typeof row.write_allowed === 'boolean'
    && typeof row.active_users === 'number'
}

export function isValidTenantSeatUsagePayload(data: unknown, orgId: string): data is TenantSeatUsage {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const row = data as Record<string, unknown>
  return row.organization_id === orgId
    && typeof row.active_users === 'number'
    && typeof row.over_limit === 'boolean'
}

export async function readTenantCommercialStatus(
  client: SupabaseClient,
  organizationId: string
): Promise<TenantCommercialStatus | null> {
  const org = assertUuid(organizationId, 'ID da Loja')
  const { data, error } = await client.rpc('read_tenant_commercial_status', { p_organization_id: org })
  if (error) throw error
  if (!isValidTenantCommercialStatusPayload(data, org)) return null
  return data
}

export async function readTenantSeatUsage(
  client: SupabaseClient,
  organizationId: string
): Promise<TenantSeatUsage | null> {
  const org = assertUuid(organizationId, 'ID da Loja')
  const { data, error } = await client.rpc('read_tenant_seat_usage', { p_organization_id: org })
  if (error) throw error
  if (!isValidTenantSeatUsagePayload(data, org)) return null
  return data
}

export async function loadSubscriptionLifecycleBundle(
  client: SupabaseClient,
  organizationId: string,
  signal: AbortSignal
): Promise<SubscriptionLifecycleBundle> {
  const org = assertUuid(organizationId, 'ID da Loja')
  const [statusRes, seatRes, termsRes, schedRes, collRes] = await Promise.all([
    client.rpc('read_tenant_commercial_status', { p_organization_id: org }),
    client.rpc('read_tenant_seat_usage', { p_organization_id: org }),
    client
      .from('saas_subscription_price_terms')
      .select('id,organization_id,subscription_id,effective_from,effective_to,unit_price,currency,adjustment_reason,created_at')
      .eq('organization_id', org)
      .order('effective_from', { ascending: false })
      .limit(50)
      .abortSignal(signal),
    client
      .from('saas_scheduled_subscription_changes')
      .select('id,organization_id,subscription_id,change_type,target_plan_version_id,effective_at,status,reason,applied_at,created_at')
      .eq('organization_id', org)
      .order('created_at', { ascending: false })
      .limit(30)
      .abortSignal(signal),
    client
      .from('saas_collection_events')
      .select('id,organization_id,invoice_id,event_type,channel,external_reference,metadata,created_at')
      .eq('organization_id', org)
      .order('created_at', { ascending: false })
      .limit(30)
      .abortSignal(signal),
  ])

  if (statusRes.error) throw statusRes.error
  if (!isValidTenantCommercialStatusPayload(statusRes.data, org)) {
    throw new Error('Status comercial da Loja indisponível ou inconsistente.')
  }
  if (seatRes.error) throw seatRes.error
  if (!isValidTenantSeatUsagePayload(seatRes.data, org)) {
    throw new Error('Uso de assentos da Loja inválido.')
  }
  if (termsRes.error) throw termsRes.error
  if (schedRes.error) throw schedRes.error
  if (collRes.error) throw collRes.error

  return {
    commercialStatus: statusRes.data,
    seatUsage: seatRes.data,
    priceTerms: (termsRes.data ?? []) as SubscriptionPriceTerm[],
    scheduledChanges: (schedRes.data ?? []) as ScheduledSubscriptionChange[],
    collectionEvents: (collRes.data ?? []) as SaasCollectionEvent[],
  }
}

export async function confirmSaasSubscriptionHiring(
  client: SupabaseClient,
  input: {
    organizationId: string
    planVersionId: string
    contractPrice?: number | null
    reason: string
    idempotencyKey: string
  }
): Promise<string> {
  const org = assertUuid(input.organizationId, 'ID da Loja')
  const ver = assertUuid(input.planVersionId, 'Versão do plano')
  const reason = assertReason(input.reason)
  const key = assertIdempotencyKey(input.idempotencyKey)
  if (input.contractPrice !== undefined && input.contractPrice !== null) {
    if (!Number.isFinite(input.contractPrice) || input.contractPrice <= 0) {
      throw new Error('Preço contratual deve ser positivo.')
    }
  }
  const { data, error } = await client.rpc('confirm_saas_subscription_hiring_idempotent', {
    p_organization_id: org,
    p_plan_version_id: ver,
    p_contract_price: input.contractPrice ?? null,
    p_reason: reason,
    p_idempotency_key: key,
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao confirmar contratação.')
  return data
}

export async function scheduleSaasPlanChange(
  client: SupabaseClient,
  input: {
    organizationId: string
    targetPlanVersionId: string
    reason: string
    idempotencyKey: string
  }
): Promise<string> {
  const { data, error } = await client.rpc('schedule_saas_plan_change_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_target_plan_version_id: assertUuid(input.targetPlanVersionId, 'Versão destino'),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao agendar troca de plano.')
  return data
}

export async function cancelScheduledSaasChange(
  client: SupabaseClient,
  input: { organizationId: string; changeId: string; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('cancel_scheduled_saas_change_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_change_id: assertUuid(input.changeId, 'ID do agendamento'),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao cancelar agendamento.')
  return data
}

export async function applyScheduledSaasPlanChange(
  client: SupabaseClient,
  input: { organizationId: string; changeId: string; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('apply_scheduled_saas_plan_change_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_change_id: assertUuid(input.changeId, 'ID do agendamento'),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao efetivar troca de plano.')
  return data
}

export async function markSaasSubscriptionPastDue(
  client: SupabaseClient,
  input: { organizationId: string; invoiceId?: string | null; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('mark_saas_subscription_past_due_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_invoice_id: input.invoiceId ? assertUuid(input.invoiceId, 'ID da fatura') : null,
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao marcar inadimplência.')
  return data
}

export async function recordSaasCollectionEvent(
  client: SupabaseClient,
  input: {
    organizationId: string
    invoiceId?: string | null
    eventType: 'reminder_scheduled' | 'reminder_sent' | 'payment_attempt'
    channel: string
    externalReference?: string | null
    note?: string | null
    idempotencyKey: string
  }
): Promise<string> {
  const channel = input.channel?.trim() || ''
  if (channel.length < 2 || channel.length > 60) throw new Error('Informe o canal de cobrança.')
  const { data, error } = await client.rpc('record_saas_collection_event_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_invoice_id: input.invoiceId ? assertUuid(input.invoiceId, 'ID da fatura') : null,
    p_event_type: input.eventType,
    p_channel: channel,
    p_external_reference: input.externalReference?.trim() || null,
    p_note: input.note?.trim() || null,
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao registrar cobrança.')
  return data
}

export async function suspendSaasSubscriptionManual(
  client: SupabaseClient,
  input: { organizationId: string; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('suspend_saas_subscription_manual_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao suspender assinatura.')
  return data
}

export async function reactivateSaasSubscription(
  client: SupabaseClient,
  input: { organizationId: string; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('reactivate_saas_subscription_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao reativar assinatura.')
  return data
}

export async function cancelSaasSubscription(
  client: SupabaseClient,
  input: { organizationId: string; immediate: boolean; reason: string; idempotencyKey: string }
): Promise<string> {
  const { data, error } = await client.rpc('cancel_saas_subscription_idempotent', {
    p_organization_id: assertUuid(input.organizationId, 'ID da Loja'),
    p_immediate: Boolean(input.immediate),
    p_reason: assertReason(input.reason),
    p_idempotency_key: assertIdempotencyKey(input.idempotencyKey),
  })
  if (error) throw error
  if (typeof data !== 'string' || !UUID_RE.test(data)) throw new Error('Retorno inválido ao cancelar assinatura.')
  return data
}
