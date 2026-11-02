import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditFilters = { from: string; to: string; action: string; organization: string }
export type MasterAuditEvent = {
  id: string; created_at: string; staff_user_id: string | null; organization_id: string | null;
  action: string; resource_type: string; resource_id: string | null
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Informe datas válidas.')
  const ms = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw Error('Informe datas válidas.')
  return ms
}
const validId = (id: string) => /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n
export async function loadMasterAudit(client: SupabaseClient, filters: AuditFilters, before: string | null, signal: AbortSignal) {
  const start = dateValue(filters.from), end = dateValue(filters.to)
  if (end < start || end - start > 366 * 86400000 || filters.action.trim().length > 100 ||
    (filters.organization && !uuid.test(filters.organization)) || (before !== null && !validId(before))) throw Error('Revise período, ação e Loja da consulta de auditoria.')
  const action = filters.action.trim()
  const { data, error } = await client.rpc('list_master_audit_events', {
    p_from: filters.from, p_to: filters.to, p_action: action || null,
    p_organization_id: filters.organization || null, p_before_id: before, p_limit: 26,
  }).abortSignal(signal)
  if (error) throw error
  if (!Array.isArray(data) || data.length > 26) throw Error('Consulta de auditoria incompleta.')
  let previous = before === null ? null : BigInt(before)
  for (const row of data) {
    const time = Date.parse(row.created_at)
    if (typeof row.id !== 'string' || !validId(row.id) || typeof row.created_at !== 'string' || (previous !== null && BigInt(row.id) >= previous) ||
      !Number.isFinite(time) || time < start || time >= end + 86400000 ||
      typeof row.action !== 'string' || typeof row.resource_type !== 'string' ||
      !(row.resource_id === null || typeof row.resource_id === 'string') ||
      !(row.staff_user_id === null || (typeof row.staff_user_id === 'string' && uuid.test(row.staff_user_id))) ||
      !(row.organization_id === null || (typeof row.organization_id === 'string' && uuid.test(row.organization_id))) ||
      (action && row.action !== action) || (filters.organization && row.organization_id !== filters.organization)) throw Error('Resposta de auditoria inconsistente.')
    previous = BigInt(row.id)
  }
  // Project allowed columns only: never propagate unexpected metadata to the UI.
  const rows: MasterAuditEvent[] = data.slice(0, 25).map(row => ({
    id: row.id, created_at: row.created_at, staff_user_id: row.staff_user_id,
    organization_id: row.organization_id, action: row.action, resource_type: row.resource_type, resource_id: row.resource_id,
  }))
  return { rows, next: data.length > 25 ? rows[rows.length - 1].id : null }
}
