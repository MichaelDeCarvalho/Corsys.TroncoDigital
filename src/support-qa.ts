import { getSupabaseClient } from './lib/supabase'
import { assertQAUUID, assertQADenied, assertQARows } from './lib/dev-qa-gates'

if (import.meta.env.VITE_SUPPORT_QA_ENABLED !== 'true' || import.meta.env.VITE_SUPABASE_URL !== 'https://szqkdekwhzxsoxorgvaz.supabase.co' || location.hostname !== 'corsys-tronco-digital-dev.corsys1.workers.dev') throw Error('DEV support QA denied')
const c = getSupabaseClient()
const A = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
// B is fixed to the real DEV fixture; never infer tenants from user-editable metadata.
const orgB = 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
const actors = { master: 'f0d9a620-91e2-4d94-a2de-6da446cea155', 'tenant-a': 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624', 'tenant-b': '559ba052-c408-4418-b806-0c0c4b8e3603' }
const masterTicket = '5b65bd78-cf2a-4a4f-b705-f7360321e71d'
const prefix = 'qa-p0-20261028-5b65bd78'
const out = document.querySelector('#results')!, identity = document.querySelector('#identity')!
const report = (value: string) => { out.textContent += value + '\n' }
let busy = false
async function rpc(name: string, args: Record<string, unknown>) {
  const start = performance.now()
  const result = await c.rpc(name, args)
  report(JSON.stringify({ rpc: name, status: result.status, code: result.error?.code ?? null, milliseconds: Math.round(performance.now() - start), id: typeof result.data === 'string' ? result.data : null }))
  return result
}
async function replay(name: string, args: Record<string, unknown>) {
  const pair = await Promise.all([rpc(name, args), rpc(name, args)])
  const id = assertQAUUID(pair[0])
  if (assertQAUUID(pair[1]) !== id || assertQAUUID(await rpc(name, args)) !== id) throw Error('Replay differs')
  assertQADenied(await rpc(name, { ...args, p_message: String(args.p_message) + ' divergente' }), ['22023'])
  report('PASS concorrência mesma chave, replay serial e payload divergente 22023')
  return id
}
async function run(mode: keyof typeof actors) {
  if (busy) return
  busy = true
  document.querySelectorAll('button').forEach(b => { b.disabled = true })
  try {
    const user = await c.auth.getUser()
    if (user.error || user.data.user?.id !== actors[mode]) throw Error('Wrong DEV test identity')
    if (mode === 'master') {
      const aal = await c.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal.error || aal.data?.currentLevel !== 'aal2') throw Error('AAL2 required')
      report('PASS MASTER AAL2, fixture SQL independente da abertura da Loja A')
      await replay('reply_master_tenant_support_idempotent', { p_organization_id: A, p_ticket_id: masterTicket, p_message: 'QA P0 HTTP Master concorrência 5b65bd78', p_next_status: null, p_idempotency_key: prefix + '-master' })
    } else if (mode === 'tenant-a') {
      const id = await replay('create_saas_support_ticket', { p_organization_id: A, p_subject: 'QA-P0-20261028-TENANT-A-5b65bd78', p_category: 'other', p_priority: 'low', p_message: 'QA P0 abertura HTTP Loja A 5b65bd78', p_idempotency_key: prefix + '-create-a' })
      report('TICKET_A=' + id)
      sessionStorage.setItem(prefix + '-ticket-a', id)
      await replay('reply_saas_support_ticket', { p_organization_id: A, p_ticket_id: id, p_message: 'QA P0 resposta HTTP Loja A 5b65bd78', p_next_status: null, p_idempotency_key: prefix + '-reply-a' })
      assertQARows(await c.from('saas_support_ticket_messages').select('id').eq('ticket_id', id), 2)
      assertQARows(await c.from('saas_support_tickets').select('id').eq('organization_id', A).eq('subject', 'QA-P0-20261028-TENANT-A-5b65bd78'), 1)
      report('PASS uma criação, uma resposta, sem duplicação')
    } else {
      const ticket = sessionStorage.getItem(prefix + '-ticket-a')
      if (!ticket || !/^[a-f0-9-]{36}$/.test(ticket)) throw Error('Ticket A read-back required in this test tab')
      assertQARows(await c.from('saas_support_tickets').select('id').eq('id', ticket), 0)
      assertQARows(await c.from('saas_support_ticket_messages').select('id').eq('ticket_id', ticket), 0)
      assertQADenied(await rpc('reply_saas_support_ticket', { p_organization_id: A, p_ticket_id: ticket, p_message: 'QA cross tenant denied', p_next_status: null, p_idempotency_key: prefix + '-denied-b' }))
      assertQADenied(await rpc('reply_saas_support_ticket', { p_organization_id: orgB, p_ticket_id: ticket, p_message: 'QA foreign ticket denied', p_next_status: null, p_idempotency_key: prefix + '-foreign-b' }), ['23503'])
      assertQADenied(await rpc('create_saas_support_ticket', { p_organization_id: A, p_subject: 'QA denied', p_category: 'other', p_priority: 'low', p_message: 'QA denied', p_idempotency_key: prefix + '-create-denied-b' }))
      report('PASS leituras ocultas e escritas A negadas para B')
    }
    report('RESULT PASS ' + mode)
  } catch (error) { report('RESULT FAIL ' + mode + ': ' + (error instanceof Error ? error.message : 'unconfirmed')) }
  finally { busy = false }
}
async function init() {
  const user = await c.auth.getUser()
  const entry = Object.entries(actors).find(([, id]) => id === user.data.user?.id)
  identity.textContent = !user.error && entry ? 'Sessão DEV: ' + entry[0] : 'Entre com uma conta DEV de homologação pelo sistema.'
  if (!user.error && entry) {
    const mode = entry[0] as keyof typeof actors
    const button = document.getElementById(mode) as HTMLButtonElement
    button.disabled = false
    button.onclick = () => { void run(mode) }
  }
}
void init()
