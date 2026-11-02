import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMasterAudit } from './master-audit'

const filters = { from: '2026-10-01', to: '2026-10-31', action: '', organization: '' }
const actor = '71e27b4c-f0ba-46f7-832f-4faf29e8603d'
const event = { id: '9007199254740993', created_at: '2026-10-15T10:00:00Z', staff_user_id: actor, organization_id: null, action: 'plan.publish', resource_type: 'plan', resource_id: 'test' }
function fixture(data: unknown = [event], error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error })
  const rpc = vi.fn(() => ({ abortSignal }))
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}
it('preserves bigint IDs, projects safe columns and sends date/cursor filters to the server', async () => {
  const { client, rpc } = fixture([{ ...event, metadata: { hidden: 'never display' } }])
  const result = await loadMasterAudit(client, filters, null, new AbortController().signal)
  expect(result.rows[0].id).toBe(event.id)
  expect(result.rows[0]).not.toHaveProperty('metadata')
  expect(rpc).toHaveBeenCalledWith('list_master_audit_events', { p_from: filters.from, p_to: filters.to, p_action: null, p_organization_id: null, p_before_id: null, p_limit: 26 })
})
it('uses the last visible ID as cursor and excludes the lookahead event', async () => {
  const rows = Array.from({ length: 26 }, (_, i) => ({ ...event, id: String(100 - i) }))
  const { client } = fixture(rows)
  const result = await loadMasterAudit(client, filters, null, new AbortController().signal)
  expect(result.rows).toHaveLength(25)
  expect(result.next).toBe('76')
})
it('accepts historical events with nullable resource type as defined by the schema', async () => {
  const result = await loadMasterAudit(fixture([{ ...event, resource_type: null }]).client, filters, null, new AbortController().signal)
  expect(result.rows[0].resource_type).toBeNull()
})
it.each([
  { ...filters, from: '2026-02-30' }, { ...filters, to: '2026-01-01' },
  { ...filters, from: '2024-01-01' }, { ...filters, organization: 'bad' },
])('rejects invalid filters before requesting data', async invalid => {
  const { client, rpc } = fixture()
  await expect(loadMasterAudit(client, invalid, null, new AbortController().signal)).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it('fails closed on permission errors, wrong filters and unordered/duplicate events', async () => {
  const denied = fixture(null, { code: '42501' })
  await expect(loadMasterAudit(denied.client, filters, null, new AbortController().signal)).rejects.toEqual({ code: '42501' })
  for (const rows of [[event, event], [{ ...event, created_at: '2026-11-01T00:00:00Z' }], [{ ...event, id: '9223372036854775808' }]]) {
    await expect(loadMasterAudit(fixture(rows).client, filters, null, new AbortController().signal)).rejects.toThrow()
  }
})
