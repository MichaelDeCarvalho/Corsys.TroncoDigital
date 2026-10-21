import type { SupabaseClient } from '@supabase/supabase-js'
import { assertQADenied as denied, assertQARows as rows, assertQAUUID as uuid } from './dev-qa-gates'

const fixtures = [
  { label: 'A', actor: 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624', org: '94b84958-4dd9-435d-9a4e-244220835d70', account: 'd6e9a3e6-cacf-491f-b2fa-55f7ab54028f' },
  { label: 'B', actor: '559ba052-c408-4418-b806-0c0c4b8e3603', org: '7a6aa771-524d-4d5a-9d38-7006175e1cb4', account: 'ca86e4c5-de93-4134-ba0e-ea47b3e56e3a' },
]

// Optional DEV entry only. Never record request headers, payloads or credentials.
export async function runLegacyConflictHTTPQA(c: SupabaseClient, report: (s: string) => void) {
  const user = await c.auth.getUser(), own = fixtures.find(f => f.actor === user.data.user?.id)
  if (user.error || !own) throw Error('Expected QA identity absent')
  const foreign = fixtures.find(f => f !== own)!
  const organizations = rows(await c.from('organizations').select('id,name').eq('id', own.org), 1)
  if (organizations[0].name !== `DEV QA FINANCE ${own.label} 20261015`) throw Error('Expected QA organization absent')
  const snapshot = async () => {
    const r = await c.from('organization_settings').select('*').eq('organization_id', own.org)
    if (r.error || !Array.isArray(r.data) || r.data.length > 1) throw Error('Identity readback unavailable')
    return JSON.stringify(r.data)
  }
  const before = await snapshot(), baseFetch = globalThis.fetch
  const traces: { rpc: string; status: number; code: string | null }[] = []
  let expectedRequests = 0, method: string | null = null
  const tag = `DEV QA HTTP CONFLICT ${own.label} ${crypto.randomUUID()}`
  globalThis.fetch = async (input, init) => {
    const response = await baseFetch(input, init)
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin === 'https://szqkdekwhzxsoxorgvaz.supabase.co' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const body = await response.clone().json().catch(() => null)
      traces.push({ rpc: url.pathname.split('/').pop()!, status: response.status, code: typeof body?.code === 'string' ? body.code : null })
    }
    return response
  }
  const rpc = (name: string, args: Record<string, unknown>) => { expectedRequests++; return c.rpc(name, args) }
  try {
    for (const table of ['organization_settings', 'payment_methods']) {
      rows(await c.from(table).select('*').eq('organization_id', foreign.org), 0)
    }
    const identity = { p_organization_id: own.org, p_expected_updated_at: '1900-01-01T00:00:00Z',
      p_phone: null, p_email: null, p_pix_key: null, p_address: null, p_postal_code: null,
      p_city: null, p_state_code: null, p_country_code: 'BR', p_reason: tag, p_idempotency_key: crypto.randomUUID() }
    const conflicts = await Promise.all([rpc('save_tenant_identity', identity), rpc('save_tenant_identity', identity)])
    conflicts.forEach(r => denied(r, ['PT409']))
    denied(await rpc('save_tenant_identity', { ...identity, p_organization_id: foreign.org, p_idempotency_key: crypto.randomUUID() }))
    if (await snapshot() !== before) throw Error('Identity changed on conflict')
    report('Identity: simultaneous rejected replay PT409; foreign scope 42501; exact readback unchanged PASS')

    const create = { p_organization_id: own.org, p_kind: 'method', p_name: tag, p_account_type: null,
      p_institution: null, p_identification: null, p_description: null, p_reason: tag, p_idempotency_key: crypto.randomUUID() }
    // Successful replay uses a new disposable payment method, never an existing financial account.
    const replay = await Promise.all([rpc('create_treasury_catalog_item', create), rpc('create_treasury_catalog_item', create)])
    for (const result of replay) if (!result.error && typeof result.data === 'string') method = result.data
    if (uuid(replay[0]) !== uuid(replay[1])) throw Error('Successful replay returned different IDs')
    method = uuid(replay[0])
    denied(await rpc('create_treasury_catalog_item', { ...create, p_name: tag + ' changed' }), ['22023'])
    const status = { p_organization_id: own.org, p_kind: 'method', p_item_id: method,
      p_expected_active: false, p_new_active: true, p_reason: tag, p_idempotency_key: crypto.randomUUID() }
    denied(await rpc('set_treasury_catalog_status', status), ['PT409'])
    denied(await rpc('set_treasury_catalog_status', { ...status, p_kind: 'account', p_item_id: foreign.account }), ['23503'])
    denied(await rpc('set_treasury_catalog_status', { ...status, p_organization_id: foreign.org }))
    report('Catalog: same-key concurrent replay one ID; changed payload 22023; stale status PT409; foreign scope/ID denied PASS')
  } finally {
    try {
      // Recover persisted success even if its response was lost. Refuse an unexpected duplicate.
      const found = await c.from('payment_methods').select('id,active').eq('organization_id', own.org).eq('name', tag)
      if (found.error || !Array.isArray(found.data) || found.data.length > 1) throw Error('Inspect QA payment method cleanup')
      if (found.data.length) {
        method = found.data[0].id
        if (found.data[0].active) uuid(await rpc('set_treasury_catalog_status', {
          p_organization_id: own.org, p_kind: 'method', p_item_id: method, p_expected_active: true,
          p_new_active: false, p_reason: tag + ' cleanup', p_idempotency_key: crypto.randomUUID(),
        }))
        const readback = rows(await c.from('payment_methods').select('id,active').eq('organization_id', own.org).eq('id', method), 1)
        if (readback[0].active !== false) throw Error('QA payment method still active')
        report('Cleanup: disposable method inactive ' + method)
      }
    } finally { globalThis.fetch = baseFetch }
  }
  if (await snapshot() !== before) throw Error('Identity changed after cleanup')
  if (traces.length !== expectedRequests) throw Error('Request count mismatch: expected ' + expectedRequests + ', observed ' + traces.length)
  for (const name of ['save_tenant_identity', 'set_treasury_catalog_status']) {
    if (!traces.some(t => t.rpc === name && t.status === 409 && t.code === 'PT409')) throw Error('HTTP409/PT409 trace absent: ' + name)
  }
  report('HTTP ' + own.label + ': ' + expectedRequests + ' calls / ' + traces.length + ' requests; no automatic retry PASS')
  for (const t of traces) report(`${t.rpc}: HTTP ${t.status} ${t.code ?? 'success'}`)
  report('Coverage: identity/catalog only; remaining 11 legacy RPCs are NOT EVALUATED by this gate.')
}
