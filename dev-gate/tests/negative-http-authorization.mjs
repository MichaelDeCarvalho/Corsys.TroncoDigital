// Gate DEV V35 (M02.03 / M04.03 / M06.03) — Roteiro HTTP Real de Fronteiras de Autorização.
//
// Estrutura em dois grupos independentes:
//   GRUPO A (PADRÃO — SOMENTE LEITURA, `--readonly` ou sem flags):
//     1. Leituras positivas na própria Loja (garante ausência de PGRST202 / erro de schema).
//     2. Loja A tentando consultar Loja B (`42501` em RPCs financeiras/inadimplência/fluxo de caixa e `0` linhas em tabelas/views).
//     3. Loja B tentando consultar Loja A (`42501` em RPCs e `0` linhas em tabelas/views).
//     4. Usuário autenticado sem `finance.read` tentando consultar dados financeiros (`42501`).
//     5. Master AAL1 tentando acessar consultas restritas somente leitura (`42501` / `0` linhas).
//     6. Master AAL2 autorizado a consultas somente leitura (`read_platform_master_overview`, `list_platform_master_tenants`, `list_master_audit_events`, `saas_jobs`).
//
//   GRUPO B (OPERAÇÕES PERSISTENTES — BLOQUEADO POR PADRÃO):
//     Exige confirmação dupla explícita: flag `--include-persistent` E variável `ALLOW_DEV_PERSISTENT_AUTH_TESTS=true`.
//     Inclui probes de escrita AAL1 (`set_saas_plan_active`), abertura/encerramento de sessão de suporte
//     (`start_master_support_session` / `end_master_support_session`) e tentativas de escrita em suporte
//     somente leitura (`create_institutional_payable`, `save_member_profile`, `create_saas_support_ticket`).
//
// Execução somente leitura (recomendada para fechar o gate M02.03 / M04.03 / M06):
//   npm run test:negative-auth:readonly --prefix dev-gate
import assert from 'node:assert/strict'
import fs from 'node:fs'
import readline from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'
import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import {
  validateFixture,
  requireRows,
  assertHidden,
  assertPermissionDenied,
  assertAuthorizedRpcSuccess,
} from '../tools/isolation-assertions.mjs'

const args = new Set(process.argv.slice(2))
const auditTo = new Date().toISOString().slice(0, 10)
const auditFrom = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
const includePersistent =
  args.has('--include-persistent') && process.env.ALLOW_DEV_PERSISTENT_AUTH_TESTS === 'true'

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'TEST_ADMIN_A_EMAIL',
  'TEST_ADMIN_A_PASSWORD',
  'TEST_ADMIN_B_EMAIL',
  'TEST_ADMIN_B_PASSWORD',
]
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable in .env.dev: ${key}`)
  }
}

const projectRef = assertDevEnvironment(process.env)
const fixture = JSON.parse(fs.readFileSync(new URL('../fixture.ids.json', import.meta.url), 'utf8'))
validateFixture(fixture, projectRef)

const orgA = fixture.tenant_a.organization_id
const orgB = fixture.tenant_b.organization_id

function newAnonClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function signInVerified(email, password, expectedId, label) {
  assert.ok(email && password, `Missing credentials for ${label} in .env.dev`)
  const client = newAnonClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `${label} signInWithPassword failed`)
  assert.ok(data?.session?.access_token, `${label} missing JWT access token`)
  const userRes = await client.auth.getUser()
  assert.equal(userRes.error, null, `${label} getUser failed`)
  if (expectedId) {
    assert.equal(userRes.data.user?.id, expectedId, `${label} user UUID mismatch`)
  }
  return { client, userId: userRes.data.user?.id }
}

async function signOutQuietly(client) {
  if (!client) return
  await client.auth.signOut().catch(() => {})
}

async function promptTotpCode(promptText) {
  assert.ok(
    process.stdin.isTTY && process.stdout.isTTY,
    'Interactive TTY required for Master AAL2 TOTP verification',
  )
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl. _writeToOutput = function (stringToWrite) {
    if (stringToWrite.includes(promptText)) rl.output.write(promptText)
  }
  try {
    const raw = (await rl.question(promptText)).trim()
    assert.match(raw, /^\d{6}$/, 'Invalid 6-digit TOTP code')
    return raw
  } finally {
    rl.close()
    process.stdout.write('\n')
  }
}

async function assertPositiveOwnFinancialReads(client, ownOrg, label) {
  const dash = assertAuthorizedRpcSuccess(
    await client.rpc('read_tenant_financial_dashboard', { p_organization_id: ownOrg }),
    `${label} own read_tenant_financial_dashboard`,
  )
  assert.equal(dash.organization_id, ownOrg, `${label} dashboard organization_id mismatch`)
  assert.equal(dash.integrity_ok, true, `${label} dashboard integrity_ok must be true`)

  const summaryRows = requireRows(
    await client.rpc('read_tenant_delinquency_bucket_summary', { p_organization_id: ownOrg }),
    `${label} own read_tenant_delinquency_bucket_summary`,
  )
  assert.equal(summaryRows.length, 4, `${label} bucket summary must return 4 canonical buckets`)

  requireRows(
    await client.rpc('read_tenant_delinquency_filtered', {
      p_organization_id: ownOrg,
      p_bucket: null,
      p_limit: 25,
      p_offset: 0,
    }),
    `${label} own read_tenant_delinquency_filtered`,
  )

  requireRows(
    await client.rpc('read_tenant_daily_cash_flow', {
      p_organization_id: ownOrg,
      p_from_date: '2026-10-01',
      p_to_date: '2026-10-31',
    }),
    `${label} own read_tenant_daily_cash_flow`,
  )

  const detail = assertAuthorizedRpcSuccess(
    await client.rpc('read_tenant_cash_flow_detail', {
      p_organization_id: ownOrg,
      p_from_date: '2026-10-01',
      p_to_date: '2026-10-31',
      p_page: 0,
    }),
    `${label} own read_tenant_cash_flow_detail`,
  )
  assert.equal(detail.organization_id, ownOrg, `${label} cash-flow detail tenant mismatch`)
  assert.ok(Array.isArray(detail.rows), `${label} cash-flow detail rows must be an array`)
  assert.ok(Array.isArray(detail.history), `${label} cash-flow detail history must be an array`)
  assert.ok(Array.isArray(detail.expenses), `${label} cash-flow detail expenses must be an array`)
}

async function assertCrossTenantReadDenials(client, targetOrg, label) {
  assertPermissionDenied(
    await client.rpc('read_tenant_financial_dashboard', { p_organization_id: targetOrg }),
    `${label} cross-tenant read_tenant_financial_dashboard`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency', {
      p_organization_id: targetOrg,
      p_limit: 25,
      p_offset: 0,
    }),
    `${label} cross-tenant read_tenant_delinquency`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency_bucket_summary', { p_organization_id: targetOrg }),
    `${label} cross-tenant read_tenant_delinquency_bucket_summary`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_delinquency_filtered', {
      p_organization_id: targetOrg,
      p_bucket: 'up30',
      p_limit: 25,
      p_offset: 0,
    }),
    `${label} cross-tenant read_tenant_delinquency_filtered`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_daily_cash_flow', {
      p_organization_id: targetOrg,
      p_from_date: '2026-10-01',
      p_to_date: '2026-10-31',
    }),
    `${label} cross-tenant read_tenant_daily_cash_flow`,
  )
  assertPermissionDenied(
    await client.rpc('read_tenant_cash_flow_detail', {
      p_organization_id: targetOrg,
      p_from_date: '2026-10-01',
      p_to_date: '2026-10-31',
      p_page: 0,
    }),
    `${label} cross-tenant read_tenant_cash_flow_detail`,
  )

  for (const table of ['members', 'v_charge_balances', 'v_member_financial_position']) {
    assertHidden(
      await client.from(table).select('*').eq('organization_id', targetOrg),
      `${label} cross-tenant ${table}`,
    )
  }
}

async function runReadOnlyAuthorizationSuite() {
  let clientA
  let clientB
  let noFinanceClient
  let masterAal1Client
  let masterAal2Client

  try {
    // 1 & 2. Loja A <-> Loja B: leituras próprias positivas + negações cruzadas determinísticas (42501 / 0 rows)
    ;({ client: clientA } = await signInVerified(
      process.env.TEST_ADMIN_A_EMAIL,
      process.env.TEST_ADMIN_A_PASSWORD,
      fixture.tenant_a.admin_user_id,
      'Tenant A Admin',
    ))
    ;({ client: clientB } = await signInVerified(
      process.env.TEST_ADMIN_B_EMAIL,
      process.env.TEST_ADMIN_B_PASSWORD,
      fixture.tenant_b.admin_user_id,
      'Tenant B Admin',
    ))

    await assertPositiveOwnFinancialReads(clientA, orgA, 'Tenant A')
    await assertPositiveOwnFinancialReads(clientB, orgB, 'Tenant B')
    await assertCrossTenantReadDenials(clientA, orgB, 'Tenant A -> B')
    await assertCrossTenantReadDenials(clientB, orgA, 'Tenant B -> A')
    console.log('PASS [Group A 1/5]: Tenant A -> B cross-tenant read RPCs (42501) and views (0 rows) blocked.')
    console.log('PASS [Group A 2/5]: Tenant B -> A cross-tenant read RPCs (42501) and views (0 rows) blocked.')

    // 3. Usuário autenticado na Loja sem permissão finance.read tentando consultar dados financeiros
    const noFinanceEmail = process.env.TEST_NO_FINANCE_EMAIL || ''
    const noFinancePassword = process.env.TEST_NO_FINANCE_PASSWORD || ''
    const noFinanceExpectedId = process.env.TEST_NO_FINANCE_USER_ID || ''
    const noFinanceOrg = process.env.TEST_NO_FINANCE_ORG_ID || orgA
    assert.ok(
      noFinanceEmail && noFinancePassword,
      'Configure TEST_NO_FINANCE_EMAIL and TEST_NO_FINANCE_PASSWORD in .env.dev (member/secretary user without finance.read)',
    )

    ;({ client: noFinanceClient } = await signInVerified(
      noFinanceEmail,
      noFinancePassword,
      noFinanceExpectedId || undefined,
      'No-Finance User',
    ))

    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_financial_dashboard', { p_organization_id: noFinanceOrg }),
      'no-finance read_tenant_financial_dashboard',
    )
    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_delinquency', {
        p_organization_id: noFinanceOrg,
        p_limit: 25,
        p_offset: 0,
      }),
      'no-finance read_tenant_delinquency',
    )
    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_delinquency_bucket_summary', {
        p_organization_id: noFinanceOrg,
      }),
      'no-finance read_tenant_delinquency_bucket_summary',
    )
    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_delinquency_filtered', {
        p_organization_id: noFinanceOrg,
        p_bucket: null,
        p_limit: 25,
        p_offset: 0,
      }),
      'no-finance read_tenant_delinquency_filtered',
    )
    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_daily_cash_flow', {
        p_organization_id: noFinanceOrg,
        p_from_date: '2026-10-01',
        p_to_date: '2026-10-31',
      }),
      'no-finance read_tenant_daily_cash_flow',
    )
    assertPermissionDenied(
      await noFinanceClient.rpc('read_tenant_cash_flow_detail', {
        p_organization_id: noFinanceOrg,
        p_from_date: '2026-10-01',
        p_to_date: '2026-10-31',
      }),
      'no-finance read_tenant_cash_flow_detail',
    )
    console.log('PASS [Group A 3/5]: Authenticated user without finance.read denied (42501) on all financial read RPCs.')

    // 4. Master AAL1 tentando acessar consultas restritas (somente leitura)
    const masterEmail = process.env.TEST_MASTER_EMAIL || ''
    const masterPassword = process.env.TEST_MASTER_PASSWORD || ''
    const masterExpectedId = process.env.TEST_MASTER_USER_ID || ''
    assert.ok(
      masterEmail && masterPassword && masterExpectedId,
      'Configure TEST_MASTER_EMAIL, TEST_MASTER_PASSWORD and TEST_MASTER_USER_ID in .env.dev',
    )

    ;({ client: masterAal1Client } = await signInVerified(
      masterEmail,
      masterPassword,
      masterExpectedId,
      'Master AAL1',
    ))
    const aal1 = await masterAal1Client.auth.mfa.getAuthenticatorAssuranceLevel()
    assert.equal(aal1.error, null, 'Master AAL1 check failed')
    assert.equal(aal1.data.currentLevel, 'aal1', 'Fresh Master password login must start at AAL1')

    assertPermissionDenied(
      await masterAal1Client.rpc('read_platform_master_overview'),
      'Master AAL1 read_platform_master_overview',
    )
    assertPermissionDenied(
      await masterAal1Client.rpc('list_platform_master_tenants', { p_limit: 25, p_offset: 0 }),
      'Master AAL1 list_platform_master_tenants',
    )
    assertPermissionDenied(
      await masterAal1Client.rpc('list_master_audit_events', { p_from: auditFrom, p_to: auditTo, p_limit: 10 }),
      'Master AAL1 list_master_audit_events',
    )
    assertHidden(
      await masterAal1Client.from('saas_jobs').select('id, job_type, status').limit(5),
      'Master AAL1 saas_jobs RLS hidden',
    )
    console.log('PASS [Group A 4/5]: Master AAL1 denied (42501 / 0 rows) on restricted Master read queries.')

    // 5. Master AAL2 autorizado a consultas somente leitura
    ;({ client: masterAal2Client } = await signInVerified(
      masterEmail,
      masterPassword,
      masterExpectedId,
      'Master AAL2 Candidate',
    ))
    const factors = await masterAal2Client.auth.mfa.listFactors()
    assert.equal(factors.error, null, 'listFactors failed')
    const verifiedTotp = (factors.data?.totp || []).filter(f => f.status === 'verified')
    assert.equal(verifiedTotp.length, 1, 'Expected exactly one verified TOTP factor on Master account')

    const code = await promptTotpCode('TOTP 6 digitos para Master AAL2 (oculto): ')
    const verify = await masterAal2Client.auth.mfa.challengeAndVerify({
      factorId: verifiedTotp[0].id,
      code,
    })
    assert.equal(verify.error, null, 'Master TOTP challengeAndVerify failed')

    const aal2 = await masterAal2Client.auth.mfa.getAuthenticatorAssuranceLevel()
    assert.equal(aal2.error, null, 'Master AAL2 check failed')
    assert.equal(aal2.data.currentLevel, 'aal2', 'Master session must reach AAL2')

    const overview = assertAuthorizedRpcSuccess(
      await masterAal2Client.rpc('read_platform_master_overview'),
      'Master AAL2 read_platform_master_overview',
    )
    assert.equal(overview.access, 'MASTER', 'Master AAL2 overview access must be MASTER')
    assert.equal(overview.mfa_required, true, 'Master AAL2 overview must require MFA')
    assert.ok(Number.isInteger(overview.tenants_total), 'Master AAL2 tenants_total must be an integer')

    const tenants = requireRows(
      await masterAal2Client.rpc('list_platform_master_tenants', { p_limit: 25, p_offset: 0 }),
      'Master AAL2 list_platform_master_tenants',
    )
    assert.ok(tenants.length >= 2, 'Master AAL2 must list at least 2 tenants')

    requireRows(
      await masterAal2Client.rpc('list_master_audit_events', { p_from: auditFrom, p_to: auditTo, p_limit: 10 }),
      'Master AAL2 list_master_audit_events',
    )

    requireRows(
      await masterAal2Client.from('saas_jobs').select('id, job_type, status').limit(5),
      'Master AAL2 saas_jobs read',
    )
    console.log('PASS [Group A 5/5]: Master AAL2 authorized for read-only Master overview, tenant directory, audit and saas_jobs.')

    if (includePersistent) {
      await runPersistentSupportWriteGuardSuite(masterAal1Client, masterAal2Client)
    } else {
      console.log(
        'SKIPPED [Group B — Persistent Operations]: Blocked by default. Read-only gate completed without mutating DEV state.',
      )
    }
  } finally {
    await signOutQuietly(clientA)
    await signOutQuietly(clientB)
    await signOutQuietly(noFinanceClient)
    await signOutQuietly(masterAal1Client)
    await signOutQuietly(masterAal2Client)
  }
}

async function runPersistentSupportWriteGuardSuite(masterAal1Client, masterAal2Client) {
  assert.equal(
    process.env.ALLOW_DEV_PERSISTENT_AUTH_TESTS,
    'true',
    'Group B requires ALLOW_DEV_PERSISTENT_AUTH_TESTS=true',
  )

  // Probe de escrita administrativa AAL1 bloqueado
  assertPermissionDenied(
    await masterAal1Client.rpc('set_saas_plan_active', {
      p_plan_id: '00000000-0000-0000-0000-000000000001',
      p_active: true,
    }),
    'Master AAL1 set_saas_plan_active',
  )
  assertPermissionDenied(
    await masterAal1Client.rpc('start_master_support_session', {
      p_organization_id: orgA,
      p_ticket_id: null,
      p_reason: 'Tentativa bloqueada em AAL1 pelo gate HTTP negativo',
    }),
    'Master AAL1 start_master_support_session',
  )

  let supportSessionId = null
  try {
    const startSession = await masterAal2Client.rpc('start_master_support_session', {
      p_organization_id: orgA,
      p_ticket_id: null,
      p_reason: 'Gate HTTP negativo V35: validacao de suporte somente leitura',
    })
    assertAuthorizedRpcSuccess(startSession, 'Master AAL2 start_master_support_session')
    supportSessionId = startSession.data?.session_id
    assert.ok(supportSessionId, 'Expected session_id from start_master_support_session')
    assert.equal(startSession.data?.mode, 'read_only', 'Support session must be strictly read_only')

    const activeSession = assertAuthorizedRpcSuccess(
      await masterAal2Client.rpc('get_active_master_support_session', {
        p_organization_id: orgA,
      }),
      'Master AAL2 get_active_master_support_session',
    )
    assert.equal(activeSession.session_id, supportSessionId, 'Active support session must match')

    assertAuthorizedRpcSuccess(
      await masterAal2Client.rpc('read_tenant_financial_dashboard', {
        p_organization_id: orgA,
      }),
      'Master AAL2 read_tenant_financial_dashboard during active support session',
    )

    // Assinatura exata de public.create_institutional_payable (11 parâmetros)
    assertPermissionDenied(
      await masterAal2Client.rpc('create_institutional_payable', {
        p_organization_id: orgA,
        p_category_id: '00000000-0000-0000-0000-000000000001',
        p_fund_id: null,
        p_description: 'Tentativa bloqueada durante suporte somente leitura',
        p_counterparty_name: 'Fornecedor Bloqueado',
        p_competence: '2026-11-01',
        p_issue_date: '2026-11-01',
        p_due_date: '2026-11-15',
        p_accounting_period: '2026-11-01',
        p_amount: 100,
        p_idempotency_key: `neg-support-payable-${Date.now()}`,
      }),
      'Support session write blocked on create_institutional_payable',
    )

    assertPermissionDenied(
      await masterAal2Client.rpc('save_member_profile', {
        p_organization_id: orgA,
        p_member_id: null,
        p_expected_updated_at: null,
        p_profile: { full_name: 'Bloqueio Suporte ReadOnly', status: 'active' },
        p_reason: 'Tentativa bloqueada em sessao de suporte',
        p_idempotency_key: `neg-support-member-${Date.now()}`,
      }),
      'Support session write blocked on save_member_profile',
    )

    assertPermissionDenied(
      await masterAal2Client.rpc('create_saas_support_ticket', {
        p_organization_id: orgA,
        p_subject: 'Tentativa bloqueada em sessao de suporte',
        p_category: 'technical',
        p_priority: 'normal',
        p_message: 'Escrita de chamado bloqueada durante suporte somente leitura',
        p_idempotency_key: `neg-support-ticket-${Date.now()}`,
      }),
      'Support session write blocked on create_saas_support_ticket',
    )
    console.log('PASS [Group B]: Support session read-only write guard blocked all write RPCs (42501).')
  } finally {
    if (supportSessionId) {
      await masterAal2Client
        .rpc('end_master_support_session', {
          p_session_id: supportSessionId,
          p_reason: 'Encerramento imediato apos teste negativo',
        })
        .catch(() => {})
    }
  }
}

await runReadOnlyAuthorizationSuite()
console.log('PASS: negative HTTP authorization suite completed successfully.')
