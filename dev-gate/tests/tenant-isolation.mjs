import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'

const required = [
  'SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY',
  'TEST_ADMIN_A_EMAIL','TEST_ADMIN_A_PASSWORD',
  'TEST_ADMIN_B_EMAIL','TEST_ADMIN_B_PASSWORD'
]
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`)
}

const projectRef = assertDevEnvironment()
const fixture = JSON.parse(await fs.readFile('fixture.ids.json', 'utf8'))

assert(fixture.project_ref === projectRef, 'fixture must belong to selected DEV project')
assert(fixture.tenant_a.organization_id !== fixture.tenant_b.organization_id, 'distinct organizations required')
assert(fixture.tenant_a.admin_user_id !== fixture.tenant_b.admin_user_id, 'distinct users required')

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  })
}

async function signIn(email, password) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`sign in failed for ${email}: ${error?.message}`)
  return c
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
}

async function assertTenant(c, own, other, label) {
  const { data: orgs, error: orgError } = await c
    .from('organizations')
    .select('id,name')
  if (orgError) throw orgError

  assert(orgs.some(x => x.id === own.organization_id), `${label} must see own organization`)
  assert(!orgs.some(x => x.id === other.organization_id), `${label} MUST NOT see other organization`)

  const { data: members, error: memberError } = await c
    .from('members')
    .select('id,organization_id,full_name')
  if (memberError) throw memberError

  assert(members.some(x => x.organization_id === own.organization_id), `${label} must see own member`)
  assert(!members.some(x => x.organization_id === other.organization_id), `${label} MUST NOT see other members`)

  const { data: masterConfig, error: masterError } = await c
    .from('saas_platform_configuration')
    .select('*')
  if (masterError) throw masterError
  assert(masterConfig.length === 0, `${label} MUST NOT see Master platform configuration`)

  const { data: staff, error: staffError } = await c
    .from('platform_staff')
    .select('user_id,role')
  if (staffError) throw staffError
  assert(staff.length === 0, `${label} MUST NOT see platform staff`)
}

async function assertCrossTenantTicketBlocked(c, own, other, label) {
  const subject = `RLS DEV TEST ${Date.now()}`
  const ownResult = await c.rpc('create_saas_support_ticket', {
    p_organization_id: own.organization_id,
    p_subject: subject,
    p_category: 'other',
    p_priority: 'low',
    p_message: 'Chamado legítimo do próprio tenant.'
  })
  if (ownResult.error) throw new Error(`${label} could not create own ticket: ${ownResult.error.message}`)

  const cross = await c.rpc('create_saas_support_ticket', {
    p_organization_id: other.organization_id,
    p_subject: 'CROSS TENANT MUST FAIL',
    p_category: 'other',
    p_priority: 'low',
    p_message: 'Esta operação deve ser negada.'
  })
  assert(cross.error?.code === '42501', `${label} cross-tenant ticket creation MUST fail`)

  const { data: tickets, error } = await c
    .from('saas_support_tickets')
    .select('id,organization_id,subject')
  if (error) throw error

  assert(tickets.some(t => t.id === ownResult.data), `${label} must see the newly created own ticket`)
  assert(tickets.every(t => t.organization_id === own.organization_id), `${label} MUST only read own tenant tickets`)
}

const a = await signIn(process.env.TEST_ADMIN_A_EMAIL, process.env.TEST_ADMIN_A_PASSWORD)
const b = await signIn(process.env.TEST_ADMIN_B_EMAIL, process.env.TEST_ADMIN_B_PASSWORD)

await assertTenant(a, fixture.tenant_a, fixture.tenant_b, 'ADMIN A')
await assertTenant(b, fixture.tenant_b, fixture.tenant_a, 'ADMIN B')
await assertCrossTenantTicketBlocked(a, fixture.tenant_a, fixture.tenant_b, 'ADMIN A')
await assertCrossTenantTicketBlocked(b, fixture.tenant_b, fixture.tenant_a, 'ADMIN B')

const anonymous = client()
for (const table of ['organizations', 'members', 'platform_staff', 'saas_platform_configuration']) {
  const { data, error } = await anonymous.from(table).select('*').limit(1)
  assert(error ? error.code === '42501' : Array.isArray(data) && data.length === 0, `anonymous access must be denied for ${table}`)
}

console.log('PASS: tenant isolation smoke tests; financial/MFA/concurrency gates remain separate.')
