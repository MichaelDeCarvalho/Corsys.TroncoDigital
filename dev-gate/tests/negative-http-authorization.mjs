// DEV ONLY — Prepared HTTP negative & authorization boundary verification script.
// Requires private .env.dev credentials and fixture.ids.json.
// Never uses forged JWTs, service-role secrets, or production targets.
// Do NOT run in CI without authorized interactive DEV credentials.

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { validateFixture, assertHidden, assertPermissionDenied, requireRows } from '../tools/isolation-assertions.mjs'

const projectRef = assertDevEnvironment()
const fixture = JSON.parse(await fs.readFile('fixture.ids.json', 'utf8'))
validateFixture(fixture, projectRef)

for (const key of [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'TEST_ADMIN_A_EMAIL',
  'TEST_ADMIN_A_PASSWORD',
  'TEST_ADMIN_B_EMAIL',
  'TEST_ADMIN_B_PASSWORD',
  'TEST_MASTER_USER_ID',
  'TEST_MASTER_PASSWORD',
]) {
  assert.ok(process.env[key], `Missing required DEV env var: ${key}`)
}

const MASTER_EMAIL = process.env.TEST_MASTER_EMAIL?.trim() || 'michael.c.carvalho+corsys-dev-master@gmail.com'
const todayIso = new Date().toISOString().slice(0, 10)
const clients = []

function newClient() {
  const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) },
  })
  clients.push(c)
  return c
}

async function signInVerified(email, password, expectedUserId, label) {
  const c = newClient()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  assert.ok(!error && data.session, `${label}: signInWithPassword failed`)
  const userRes = await c.auth.getUser()
  assert.ok(!userRes.error && userRes.data.user?.id, `${label}: getUser failed`)
  if (expectedUserId) {
    assert.equal(userRes.data.user.id, expectedUserId, `${label}: user UUID mismatch`)
  }
  return c
}

async function promptTotpCode() {
  assert.ok(process.stdin.isTTY, 'Interactive TTY required for masked Master AAL2 TOTP verification')
  return await new Promise((resolve, reject) => {
    let value = ''
    process.stdout.write('Digite o codigo TOTP de 6 digitos do Master DEV (oculto): ')
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    function finish(err) {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      err ? reject(err) : resolve(value)
    }
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\u0003') return finish(new Error('MFA input cancelled'))
        if (ch === '\r' || ch === '\n') {
          if (value.length === 6) return finish()
          continue
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length) {
            value = value.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        if (/[0-9]/.test(ch) && value.length < 6) {
          value += ch
          process.stdout.write('*')
        }
      }
    }
    process.stdin.on('data', onData)
  })
}

async function assertCrossTenantDenied(client, ownOrgId, foreignOrgId, label) {
  // 1 & 2. Cross-tenant financial / delinquency RPCs MUST fail with exact 42501
  assertPermissionDenied(
    await client.rpc('read_tenant_financial_dashboard', { p_organization_id: foreignOrgId }),
    `${label} cross read_tenant_financial_dashboard`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency', { p_organization_id: foreignOrgId, p_limit: 26, p_offset: 0 }),
    `${label} cross read_tenant_delinquency`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency_bucket_summary', { p_organization_id: foreignOrgId }),
    `${label} cross read_tenant_delinquency_bucket_summary`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency_filtered', {
      p_organization_id: foreignOrgId,
      p_bucket: null,
      p_limit: 26,
      p_offset: 0,
    }),
    `${label} cross read_tenant_delinquency_filtered`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_daily_cash_flow', {
      p_organization_id: foreignOrgId,
      p_from: todayIso,
      p_to: todayIso,
    }),
    `${label} cross read_tenant_daily_cash_flow`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_cash_flow_detail', {
      p_organization_id: foreignOrgId,
      p_from_date: todayIso,
      p_to_date: todayIso,
      p_page: 0,
    }),
    `${label} cross read_tenant_cash_flow_detail`,
  )

  // Direct cross-tenant table/view probes MUST expose 0 rows
  for (const view of ['members', 'v_charge_balances', 'v_member_financial_position']) {
    assertHidden(
      await client.from(view).select('organization_id').eq('organization_id', foreignOrgId),
      `${label} cross table/view ${view}`,
    )
  }

  // Own tenant baseline read succeeds cleanly
  const ownOrgs = requireRows(
    await client.from('organizations').select('id').eq('id', ownOrgId),
    `${label} own organization sanity read`,
  )
  assert.equal(ownOrgs.length, 1)
}

let activeSupportSessionId = null
let masterClient = null

try {
  // Case 1 & Case 2: Loja A vs Loja B bidirectional cross-tenant isolation
  const adminA = await signInVerified(
    process.env.TEST_ADMIN_A_EMAIL,
    process.env.TEST_ADMIN_A_PASSWORD,
    fixture.tenant_a.admin_user_id,
    'ADMIN A',
  )
  const adminB = await signInVerified(
    process.env.TEST_ADMIN_B_EMAIL,
    process.env.TEST_ADMIN_B_PASSWORD,
    fixture.tenant_b.admin_user_id,
    'ADMIN B',
  )

  await assertCrossTenantDenied(adminA, fixture.tenant_a.organization_id, fixture.tenant_b.organization_id, 'Loja A -> Loja B')
  await assertCrossTenantDenied(adminB, fixture.tenant_b.organization_id, fixture.tenant_a.organization_id, 'Loja B -> Loja A')
  console.log('PASS Cases 1 & 2: Loja A <-> Loja B bidirectional cross-tenant isolation enforced (42501 / 0 rows).')

  // Case 3: Authenticated user in org WITHOUT finance.read permission
  assert.ok(
    process.env.TEST_NO_FINANCE_EMAIL && process.env.TEST_NO_FINANCE_PASSWORD && process.env.TEST_NO_FINANCE_ORG_ID,
    'Missing TEST_NO_FINANCE_EMAIL / TEST_NO_FINANCE_PASSWORD / TEST_NO_FINANCE_ORG_ID in private .env.dev for Case 3',
  )
  const restrictedUser = await signInVerified(
    process.env.TEST_NO_FINANCE_EMAIL,
    process.env.TEST_NO_FINANCE_PASSWORD,
    process.env.TEST_NO_FINANCE_USER_ID || undefined,
    'NO_FINANCE_USER',
  )
  const restrictedOrgId = process.env.TEST_NO_FINANCE_ORG_ID
  for (const [rpcName, params] of [
    ['read_tenant_financial_dashboard', { p_organization_id: restrictedOrgId }],
    ['read_tenant_delinquency', { p_organization_id: restrictedOrgId, p_limit: 26, p_offset: 0 }],
    ['read_tenant_delinquency_bucket_summary', { p_organization_id: restrictedOrgId }],
    ['read_tenant_delinquency_filtered', { p_organization_id: restrictedOrgId, p_bucket: null, p_limit: 26, p_offset: 0 }],
    ['read_tenant_cash_flow_detail', { p_organization_id: restrictedOrgId, p_from_date: todayIso, p_to_date: todayIso, p_page: 0 }],
  ]) {
    assertPermissionDenied(
      await restrictedUser.rpc(rpcName, params),
      `User without finance.read calling ${rpcName}`,
    )
  }
  console.log('PASS Case 3: User without finance.read denied (42501) on financial & delinquency RPCs.')

  // Case 4: Master AAL1 (password only, before MFA verification) MUST be denied restricted RPCs
  masterClient = await signInVerified(
    MASTER_EMAIL,
    process.env.TEST_MASTER_PASSWORD,
    process.env.TEST_MASTER_USER_ID,
    'MASTER_DEV',
  )
  const aalBefore = await masterClient.auth.mfa.getAuthenticatorAssuranceLevel()
  assert.equal(aalBefore.error, null)
  assert.equal(aalBefore.data?.currentLevel, 'aal1', 'Master must initially be at AAL1 before TOTP challenge')

  assertPermissionDenied(
    await masterClient.rpc('read_platform_master_overview'),
    'Master AAL1 read_platform_master_overview',
  )
  assertPermissionDenied(
    await masterClient.rpc('list_platform_master_tenants', { p_limit: 10, p_offset: 0 }),
    'Master AAL1 list_platform_master_tenants',
  )
  assertPermissionDenied(
    await masterClient.rpc('set_saas_plan_active', { p_plan_id: randomUUID(), p_active: true, p_reason: 'AAL1 probe' }),
    'Master AAL1 set_saas_plan_active',
  )
  assertPermissionDenied(
    await masterClient.rpc('start_master_support_session', {
      p_organization_id: fixture.tenant_a.organization_id,
      p_reason: 'AAL1 support probe',
      p_idempotency_key: `aal1-${randomUUID()}`,
    }),
    'Master AAL1 start_master_support_session',
  )
  console.log('PASS Case 4: Master AAL1 denied (42501) across restricted platform RPCs.')

  // Case 5: Master AAL2 positive read-only & session-scoped verification via real verified TOTP
  const factorsRes = await masterClient.auth.mfa.listFactors()
  assert.equal(factorsRes.error, null)
  const verifiedTotp = (factorsRes.data?.all || []).find(f => f.factor_type === 'totp' && f.status === 'verified')
  assert.ok(verifiedTotp?.id, 'Dedicated Master DEV must already have a verified TOTP factor enrolled')

  let otp = await promptTotpCode()
  const verifyRes = await masterClient.auth.mfa.challengeAndVerify({ factorId: verifiedTotp.id, code: otp })
  otp = ''
  assert.equal(verifyRes.error, null, 'Master TOTP verification failed')

  const aalAfter = await masterClient.auth.mfa.getAuthenticatorAssuranceLevel()
  assert.equal(aalAfter.data?.currentLevel, 'aal2', 'Session must elevate to AAL2')

  const overviewRes = await masterClient.rpc('read_platform_master_overview')
  assert.equal(overviewRes.error, null, 'Master AAL2 read_platform_master_overview must succeed')
  const tenantsRes = await masterClient.rpc('list_platform_master_tenants', { p_limit: 10, p_offset: 0 })
  assert.equal(tenantsRes.error, null, 'Master AAL2 list_platform_master_tenants must succeed')

  // Ensure no leftover active session first, or start temporary audited read-only session
  const startRes = await masterClient.rpc('start_master_support_session', {
    p_organization_id: fixture.tenant_a.organization_id,
    p_reason: 'HTTP negative gate verification (read_only boundary)',
    p_idempotency_key: `neg-gate-${randomUUID()}`,
  })
  assert.equal(startRes.error, null, 'Master AAL2 start_master_support_session must succeed')
  activeSupportSessionId = startRes.data

  const activeCheck = await masterClient.rpc('get_active_master_support_session', {
    p_organization_id: fixture.tenant_a.organization_id,
  })
  assert.equal(activeCheck.error, null)
  assert.equal(activeCheck.data?.scope, 'read_only')
  console.log('PASS Case 5: Master AAL2 verified read-only RPCs & temporary read-only support session.')

  // Case 6: Write attempt inside active read-only Master support session MUST fail with 42501
  assertPermissionDenied(
    await masterClient.rpc('create_institutional_payable', {
      p_organization_id: fixture.tenant_a.organization_id,
      p_category_id: randomUUID(),
      p_description: 'WRITE INSIDE READONLY SUPPORT MUST FAIL',
      p_competence: todayIso.slice(0, 7) + '-01',
      p_due_date: todayIso,
      p_amount: 10,
      p_idempotency_key: `neg-write-${randomUUID()}`,
    }),
    'Write create_institutional_payable during read-only Master support session',
  )
  assertPermissionDenied(
    await masterClient.rpc('save_member_profile', {
      p_organization_id: fixture.tenant_a.organization_id,
      p_member_id: randomUUID(),
      p_full_name: 'WRITE INSIDE READONLY SUPPORT',
      p_status: 'active',
    }),
    'Write save_member_profile during read-only Master support session',
  )
  assertPermissionDenied(
    await masterClient.rpc('create_saas_support_ticket', {
      p_organization_id: fixture.tenant_a.organization_id,
      p_subject: 'WRITE INSIDE READONLY SUPPORT',
      p_category: 'other',
      p_priority: 'low',
      p_message: 'Must be rejected for Master read-only support session.',
    }),
    'Write create_saas_support_ticket during read-only Master support session',
  )
  console.log('PASS Case 6: Write commands rejected (42501) inside active read-only Master support session.')
} finally {
  if (masterClient && activeSupportSessionId) {
    try {
      await masterClient.rpc('end_master_support_session', {
        p_organization_id: fixture.tenant_a.organization_id,
        p_session_id: activeSupportSessionId,
        p_idempotency_key: `neg-gate-end-${randomUUID()}`,
      })
    } catch {
      // ignore cleanup failures
    }
  }
  await Promise.allSettled(clients.map(c => c.auth.signOut({ scope: 'local' })))
}
