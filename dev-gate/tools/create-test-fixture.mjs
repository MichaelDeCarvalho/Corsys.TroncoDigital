import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { createClient } from '@supabase/supabase-js'

const required = [
  'SUPABASE_URL','SUPABASE_SECRET_KEY',
  'TEST_ADMIN_A_EMAIL','TEST_ADMIN_A_PASSWORD',
  'TEST_ADMIN_B_EMAIL','TEST_ADMIN_B_PASSWORD'
]
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`)
}

const projectRef = assertDevEnvironment()

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function getOrCreateUser(email, password, displayName) {
  let user
  for (let page = 1; ; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (user || list.users.length < 1000) break
  }
  if (!user) {
    const created = await must(admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    }), `create auth user ${email}`)
    user = created.user
  }
  return user
}

async function createOrg(name, suffix) {
  const existing = await must(
    admin.from('organizations').select('id,name').eq('name', name).maybeSingle(),
    `find organization ${name}`
  )
  if (existing) return existing

  return await must(
    admin.from('organizations')
      .insert({ name, number: suffix, status: 'active' })
      .select('id,name')
      .single(),
    `create organization ${name}`
  )
}

async function assignRole(orgId, userId, code) {
  const role = await must(
    admin.from('roles').select('id').eq('organization_id', orgId).eq('code', code).single(),
    `find ${code} role`
  )

  await must(
    admin.from('user_profiles').upsert({ user_id: userId, display_name: `Teste ${code}` }),
    `upsert user profile`
  )

  await must(
    admin.from('user_roles').upsert({
      organization_id: orgId,
      user_id: userId,
      role_id: role.id
    }),
    `assign ${code}`
  )
}

async function ensureMember(orgId, name) {
  const existing = await must(
    admin.from('members').select('id').eq('organization_id', orgId).eq('full_name', name).maybeSingle(),
    `find member ${name}`
  )
  if (existing) return existing
  return await must(
    admin.from('members').insert({
      organization_id: orgId,
      full_name: name,
      status: 'active'
    }).select('id').single(),
    `create member ${name}`
  )
}

const adminA = await getOrCreateUser(
  process.env.TEST_ADMIN_A_EMAIL,
  process.env.TEST_ADMIN_A_PASSWORD,
  'Administrador DEV Tenant A'
)
const adminB = await getOrCreateUser(
  process.env.TEST_ADMIN_B_EMAIL,
  process.env.TEST_ADMIN_B_PASSWORD,
  'Administrador DEV Tenant B'
)

const orgA = await createOrg('CORSYS DEV TENANT A', 'DEV-A')
const orgB = await createOrg('CORSYS DEV TENANT B', 'DEV-B')

await assignRole(orgA.id, adminA.id, 'ADMIN')
await assignRole(orgB.id, adminB.id, 'ADMIN')

const memberA = await ensureMember(orgA.id, 'Integrante Exclusivo Tenant A')
const memberB = await ensureMember(orgB.id, 'Integrante Exclusivo Tenant B')

const fixture = {
  project_ref: projectRef,
  generated_at: new Date().toISOString(),
  tenant_a: { organization_id: orgA.id, admin_user_id: adminA.id, member_id: memberA.id },
  tenant_b: { organization_id: orgB.id, admin_user_id: adminB.id, member_id: memberB.id }
}

await import('node:fs/promises').then(fs =>
  fs.writeFile('fixture.ids.json', JSON.stringify(fixture, null, 2), { mode: 0o600 })
)

console.log('DEV fixture prepared.')

