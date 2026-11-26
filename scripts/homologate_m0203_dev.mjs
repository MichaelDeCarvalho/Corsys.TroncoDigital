#!/usr/bin/env node
/**
 * CorSys Tronco Digital V35 — M02.03 DEV Homologation Runner (4 Remaining Acceptances)
 *
 * Scenarios covered (B06 / E04 / E06 / docs/V35_M0203_DEV_GATE.md):
 *   1. Acordo pela tela (MemberAgreements + MemberPayments)
 *   2. Mensalidades (MemberConfiguration + MonthlyChargeGeneration)
 *   3. Quorum de dois aprovadores distintos (ContasPagar / InstitutionalOperations / PayableApprovals)
 *   4. Conciliacao sob leitura incompleta simulada no cliente de teste (BankReconciliation)
 *
 * Strictly targets DEV (szqkdekwhzxsoxorgvaz / corsys-tronco-digital-dev.corsys1.workers.dev)
 * on an isolated QA_CLOSURE_* organization. Never asks for passwords, MFA codes or tokens.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const DEV_SUPABASE_REF = 'szqkdekwhzxsoxorgvaz'
const DEV_SUPABASE_ORIGIN = `https://${DEV_SUPABASE_REF}.supabase.co`
const DEFAULT_DEV_APP_URL = 'https://corsys-tronco-digital-dev.corsys1.workers.dev'

export function assertDevBrowserTarget(rawUrl = process.env.CORSYS_DEV_URL || DEFAULT_DEV_APP_URL) {
  const url = new URL(rawUrl)
  const isWorkersDev =
    url.protocol === 'https:' &&
    (url.hostname === 'corsys-tronco-digital-dev.corsys1.workers.dev' ||
      /^[a-z0-9-]+-corsys-tronco-digital-dev\.corsys1\.workers\.dev$/i.test(url.hostname))
  const isLocalDev =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.port === '3000'

  if ((!isWorkersDev && !isLocalDev) || url.username || url.password) {
    throw new Error(`Alvo recusado (${url.origin}). Homologacao M02.03 permitida apenas no DEV autorizado.`)
  }
  if (/prod|production/i.test(url.hostname)) {
    throw new Error(`Alvo com indicio de producao recusado: ${url.hostname}`)
  }
  return url.origin
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
}

function todayBr() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseCliOption(argv, flag) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1).trim()
    if (arg === flag && i + 1 < argv.length) return argv[i + 1].trim()
  }
  return ''
}

function printSummary(results, metadata = {}) {
  console.log('\n=== RESUMO HOMOLOGACAO M02.03 (DEV) ===')
  if (metadata.targetUrl) console.log(`Alvo: ${metadata.targetUrl}`)
  if (metadata.verifiedRoundId) console.log(`Rodada Setup QA: ${metadata.verifiedRoundId}`)
  if (metadata.organizationName) console.log(`Loja QA: ${metadata.organizationName} (${metadata.organizationId})`)
  if (metadata.runId) console.log(`Tag de rastreio: QA_M0203_${metadata.runId}`)
  console.log('------------------------------------------------------------')
  for (const row of results) {
    console.log(`[${row.status.padEnd(7)}] ${row.id} — ${row.title}: ${row.detail}`)
  }
  console.log('------------------------------------------------------------')
}

async function waitForAuthenticatedWorkspace(page, label, timeoutMs, expectedOrgId = '') {
  console.log(`[${label}] Aguardando login manual (e MFA, se aplicavel) na janela aberta...`)
  await page.waitForSelector('#organization', { timeout: timeoutMs })
  const orgOptions = await page.locator('#organization option').evaluateAll(opts =>
    opts.map(o => ({ value: o.value, text: (o.textContent || '').trim() })),
  )
  let qaOption
  if (expectedOrgId) {
    qaOption = orgOptions.find(o => o.value.toLowerCase() === expectedOrgId.toLowerCase() && /^QA_CLOSURE_/i.test(o.text))
    if (!qaOption) {
      return {
        ok: false,
        reason: `Loja QA_CLOSURE_* com UUID ${expectedOrgId} nao visivel para ${label}. Confirme a rodada criada pelo setup.`,
      }
    }
  } else {
    const qaOptions = orgOptions.filter(o => /^QA_CLOSURE_/i.test(o.text) && o.value)
    if (qaOptions.length === 0) {
      return { ok: false, reason: `Nenhuma Loja QA_CLOSURE_* visivel para ${label}. Execute scripts/prepare_dev_m0203_closure_qa.sql no DEV.` }
    }
    if (qaOptions.length > 1) {
      return {
        ok: false,
        reason: `Multiplas Lojas QA_CLOSURE_* encontradas para ${label}. Informe CORSYS_QA_ORG_ID com o UUID exato da rodada.`,
      }
    }
    qaOption = qaOptions[0]
  }
  const currentVal = await page.locator('#organization').inputValue()
  if (currentVal !== qaOption.value) {
    await page.locator('#organization').selectOption(qaOption.value)
  }
  await page.waitForSelector('nav[aria-label="Navegação principal"]', { timeout: 30000 })
  const confirmedVal = await page.locator('#organization').inputValue()
  if (confirmedVal.toLowerCase() !== qaOption.value.toLowerCase()) {
    return { ok: false, reason: `Seletor #organization em ${label} divergiu do UUID esperado (${confirmedVal} != ${qaOption.value}).` }
  }
  return { ok: true, organizationId: qaOption.value, organizationName: qaOption.text }
}

async function readBrowserSessionIdentity(page) {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const user = parsed?.user ?? parsed?.currentSession?.user ?? null
    const token = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null
    if (!user?.id || !token) return null
    return { userId: String(user.id), email: String(user.email ?? '') }
  }, `sb-${DEV_SUPABASE_REF}-auth-token`)
}

async function supabaseRestGet(page, publishableKey, pathAndQuery) {
  return page.evaluate(
    async ({ origin, storageKey, apikey, path }) => {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) throw new Error('Sessao Supabase ausente no navegador')
      const parsed = JSON.parse(raw)
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token
      if (!token) throw new Error('Token de sessao ausente no navegador')
      const res = await fetch(`${origin}${path}`, {
        headers: {
          apikey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      const body = await res.json().catch(() => null)
      return { status: res.status, ok: res.ok, body }
    },
    { origin: DEV_SUPABASE_ORIGIN, storageKey: `sb-${DEV_SUPABASE_REF}-auth-token`, apikey: publishableKey, path: pathAndQuery },
  )
}

async function supabaseRpcRead(page, publishableKey, fnName, args) {
  return page.evaluate(
    async ({ origin, storageKey, apikey, fn, payload }) => {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) throw new Error('Sessao Supabase ausente no navegador')
      const parsed = JSON.parse(raw)
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token
      if (!token) throw new Error('Token de sessao ausente no navegador')
      const res = await fetch(`${origin}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      return { status: res.status, ok: res.ok, body }
    },
    { origin: DEV_SUPABASE_ORIGIN, storageKey: `sb-${DEV_SUPABASE_REF}-auth-token`, apikey: publishableKey, fn: fnName, payload: args },
  )
}

function parseContentRangeHeader(rawHeader) {
  const m = /^(\d+)-(\d+)\/(\d+)$/.exec(String(rawHeader || '').trim())
  if (!m) return null
  const start = Number(m[1])
  const end = Number(m[2])
  const total = Number(m[3])
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(total) || end < start) return null
  return { start, end, total, span: end - start + 1 }
}

async function navigateMain(page, label) {
  await page.locator('nav[aria-label="Navegação principal"] button', { hasText: label }).first().click()
}

async function launchVisibleBrowser() {
  const preferred = (process.env.CORSYS_BROWSER_CHANNEL || '').trim().toLowerCase()
  const attempts = preferred
    ? [
        preferred === 'chromium'
          ? () => chromium.launch({ headless: false })
          : () => chromium.launch({ headless: false, channel: preferred }),
      ]
    : [
        () => chromium.launch({ headless: false }),
        () => chromium.launch({ headless: false, channel: 'msedge' }),
        () => chromium.launch({ headless: false, channel: 'chrome' }),
      ]
  let lastError
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const args = new Set(rawArgs)
  const rawUrlOpt = parseCliOption(rawArgs, '--url')
  const expectedOrgId = (parseCliOption(rawArgs, '--org-id') || process.env.CORSYS_QA_ORG_ID || '').trim()
  const expectedRoundId = (parseCliOption(rawArgs, '--round-id') || process.env.CORSYS_QA_ROUND_ID || '').trim()

  if (expectedOrgId && !UUID_REGEX.test(expectedOrgId)) {
    throw new Error(`CORSYS_QA_ORG_ID / --org-id invalido: ${expectedOrgId}`)
  }

  if (args.has('--help')) {
    console.log(`Uso: npm run test:m0203:homologation [-- --org-id <UUID> --round-id <ID>]

Variaveis/opcoes opcionais:
  --url / CORSYS_DEV_URL            URL DEV autorizada (padrao: ${DEFAULT_DEV_APP_URL})
  --org-id / CORSYS_QA_ORG_ID       UUID da Loja criada por scripts/prepare_dev_m0203_closure_qa.sql
  --round-id / CORSYS_QA_ROUND_ID   Identificador da rodada retornado pelo setup
  CORSYS_BROWSER_CHANNEL            Canal do navegador opcional (chromium | msedge | chrome)
  CORSYS_QA_LOGIN_TIMEOUT_MS        Tempo de espera pelo login manual em ms (padrao: 300000)

Fluxo:
  1. Rode scripts/prepare_dev_m0203_closure_qa.sql no DEV e anote round_id e organization_id (UUID).
  2. Execute o comando unico: npm run test:m0203:homologation -- --org-id "<UUID>" --round-id "<ROUND_ID>"
  3. Efetue o login manualmente nas duas janelas (Janela 1 = ADMIN, Janela 2 = TREASURER; sem senhas/tokens no script).
  4. O runner valida identidades, papeis ADMIN/TREASURER, UUID da Loja e pre-requisitos antes de qualquer gravacao.
  5. Ao encerrar, revise e execute scripts/cleanup_dev_m0203_closure_qa.sql com round_id e organization_id.`)
    process.exit(0)
  }

  const targetUrl = assertDevBrowserTarget(rawUrlOpt || undefined)
  if (args.has('--dry-check')) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-check',
      targetUrl,
      supabaseOrigin: DEV_SUPABASE_ORIGIN,
      expectedOrgId: expectedOrgId || null,
      expectedRoundId: expectedRoundId || null,
      headless: false,
      scenarios: ['S1_ACORDO_ESTORNO', 'S2_MENSALIDADES', 'S3_QUORUM_2_APROVADORES', 'S4_CONCILIACAO_INCOMPLETA'],
    }, null, 2))
    process.exit(0)
  }

  const loginTimeoutMs = Number(process.env.CORSYS_QA_LOGIN_TIMEOUT_MS || 300000)
  const runId = Date.now().toString(36)
  const today = todayBr()
  const currentMonth = today.slice(0, 7)

  const results = [
    { id: 'S1_ACORDO_ESTORNO', title: 'Acordo pela tela + baixa + estorno seletivo', status: 'BLOCKED', detail: 'Nao executado' },
    { id: 'S2_MENSALIDADES', title: 'Mensalidades (regra geral, valor individual, isencao, idempotencia)', status: 'BLOCKED', detail: 'Nao executado' },
    { id: 'S3_QUORUM_2_APROVADORES', title: 'Quorum 2 aprovadores distintos (0/2, 1/2 bloqueados; 2/2 pago)', status: 'BLOCKED', detail: 'Nao executado' },
    { id: 'S4_CONCILIACAO_INCOMPLETA', title: 'Conciliacao bloqueada sob leitura incompleta e recuperacao sem escrita', status: 'BLOCKED', detail: 'Nao executado' },
  ]
  const setResult = (id, status, detail) => {
    const entry = results.find(r => r.id === id)
    if (entry) {
      entry.status = status
      entry.detail = detail
    }
  }

  let browser
  let orgId = ''
  let orgName = ''
  let verifiedRoundId = ''
  try {
    try {
      browser = await launchVisibleBrowser()
    } catch (err) {
      for (const r of results) {
        r.status = 'BLOCKED'
        r.detail = `Navegador grafico indisponivel neste ambiente (${err instanceof Error ? err.message.split('\n')[0] : 'launch failed'}). Execute localmente com navegador instalado.`
      }
      printSummary(results, { targetUrl, runId })
      process.exit(2)
    }

    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })

    let detectedPublishableKey = ''
    let wrongSupabaseOriginDetected = ''
    const isSupabaseApiPath = (pathname) =>
      /^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)/i.test(pathname)

    const blockUnauthorizedSupabase = async (route) => {
      const req = route.request()
      let parsed
      try {
        parsed = new URL(req.url())
      } catch {
        await route.continue()
        return
      }
      const isSupabaseDomain = /(^|\.)supabase\.(co|com|in|net)$/i.test(parsed.hostname)
      const isSupabaseApi = isSupabaseApiPath(parsed.pathname) && parsed.origin !== targetUrl
      if ((isSupabaseDomain || isSupabaseApi) && parsed.origin !== DEV_SUPABASE_ORIGIN) {
        wrongSupabaseOriginDetected = parsed.origin
        await route.abort('blockedbyclient')
        return
      }
      if (parsed.origin === DEV_SUPABASE_ORIGIN) {
        const key = req.headers()['apikey']
        if (key && key.startsWith('sb_publishable_')) detectedPublishableKey = key
      }
      await route.continue()
    }
    await ctx1.route('**/*', blockUnauthorizedSupabase)
    await ctx2.route('**/*', blockUnauthorizedSupabase)

    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    const inspectRequest = (req) => {
      let parsed
      try {
        parsed = new URL(req.url())
      } catch {
        return
      }
      const isSupabaseDomain = /(^|\.)supabase\.(co|com|in|net)$/i.test(parsed.hostname)
      const isSupabaseApi = isSupabaseApiPath(parsed.pathname) && parsed.origin !== targetUrl
      if ((isSupabaseDomain || isSupabaseApi) && parsed.origin !== DEV_SUPABASE_ORIGIN) {
        wrongSupabaseOriginDetected = parsed.origin
      }
      if (parsed.origin === DEV_SUPABASE_ORIGIN) {
        const key = req.headers()['apikey']
        if (key && key.startsWith('sb_publishable_')) detectedPublishableKey = key
      }
    }
    page1.on('request', inspectRequest)
    page2.on('request', inspectRequest)

    await Promise.all([
      page1.goto(targetUrl, { waitUntil: 'domcontentloaded' }),
      page2.goto(targetUrl, { waitUntil: 'domcontentloaded' }),
    ])

    const [ws1, ws2] = await Promise.all([
      waitForAuthenticatedWorkspace(page1, 'Janela 1 - Operador Principal (ADMIN)', loginTimeoutMs, expectedOrgId),
      waitForAuthenticatedWorkspace(page2, 'Janela 2 - 2o Aprovador (TREASURER)', loginTimeoutMs, expectedOrgId),
    ])

    const id1 = ws1.ok ? await readBrowserSessionIdentity(page1) : null
    const id2 = ws2.ok ? await readBrowserSessionIdentity(page2) : null

    const blockBeforeWrites = (reason) => {
      for (const r of results) setResult(r.id, 'BLOCKED', reason)
      printSummary(results, { targetUrl, organizationId: orgId, organizationName: orgName, verifiedRoundId, runId })
      process.exit(2)
    }

    if (wrongSupabaseOriginDetected) {
      return blockBeforeWrites(`Requisicao para ambiente Supabase nao autorizado bloqueada (${wrongSupabaseOriginDetected} != ${DEV_SUPABASE_ORIGIN}).`)
    }
    if (!ws1.ok) return blockBeforeWrites(ws1.reason)
    if (!ws2.ok) return blockBeforeWrites(ws2.reason)
    if (!id1 || !id2 || !detectedPublishableKey) {
      return blockBeforeWrites('Nao foi possivel validar as duas sessoes autenticadas DEV ou a chave publica da aplicacao.')
    }
    if (id1.userId === id2.userId) {
      return blockBeforeWrites('As duas janelas usaram o mesmo usuario; nenhuma gravacao foi iniciada.')
    }
    if (!UUID_REGEX.test(ws1.organizationId) || ws1.organizationId.toLowerCase() !== ws2.organizationId.toLowerCase()) {
      return blockBeforeWrites(`UUID da Loja divergente entre sessoes (${ws1.organizationId} != ${ws2.organizationId}); nenhuma gravacao foi iniciada.`)
    }
    if (expectedOrgId && ws1.organizationId.toLowerCase() !== expectedOrgId.toLowerCase()) {
      return blockBeforeWrites(`UUID da Loja (${ws1.organizationId}) diverge de CORSYS_QA_ORG_ID (${expectedOrgId}); nenhuma gravacao foi iniciada.`)
    }

    orgId = ws1.organizationId
    orgName = ws1.organizationName

    const [domOrg1, domOrg2, orgRead1, orgRead2, roleRead1, roleRead2, rolesCatalog1, rolesCatalog2, prepareAuditRes, s2QueueCheck] = await Promise.all([
      page1.locator('#organization').inputValue(),
      page2.locator('#organization').inputValue(),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/organizations?id=eq.${orgId}&select=id,name,status`),
      supabaseRestGet(page2, detectedPublishableKey, `/rest/v1/organizations?id=eq.${orgId}&select=id,name,status`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/user_roles?organization_id=eq.${orgId}&user_id=eq.${id1.userId}&select=organization_id,user_id,role_id`),
      supabaseRestGet(page2, detectedPublishableKey, `/rest/v1/user_roles?organization_id=eq.${orgId}&user_id=eq.${id2.userId}&select=organization_id,user_id,role_id`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/roles?organization_id=eq.${orgId}&select=id,code`),
      supabaseRestGet(page2, detectedPublishableKey, `/rest/v1/roles?organization_id=eq.${orgId}&select=id,code`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/audit_logs?organization_id=eq.${orgId}&action=eq.dev_qa.m0203_closure_prepare&select=entity_id,after_data&order=created_at.desc&limit=1`),
      supabaseRestGet(page2, detectedPublishableKey, `/rest/v1/v_payable_approval_state?organization_id=eq.${orgId}&limit=1`),
    ])

    if (domOrg1.toLowerCase() !== orgId.toLowerCase() || domOrg2.toLowerCase() !== orgId.toLowerCase()) {
      return blockBeforeWrites(`Seletor #organization divergiu do UUID ${orgId} antes de iniciar gravacoes (J1=${domOrg1}, J2=${domOrg2}).`)
    }
    const orgRow1 = orgRead1.ok ? orgRead1.body?.[0] : null
    const orgRow2 = orgRead2.ok ? orgRead2.body?.[0] : null
    if (!orgRow1 || !orgRow2 || orgRow1.id !== orgId || orgRow2.id !== orgId || orgRow1.status !== 'active' || orgRow2.status !== 'active' || !/^QA_CLOSURE_/i.test(orgRow1.name)) {
      return blockBeforeWrites(`Validacao backend do UUID ${orgId} falhou nas duas sessoes antes das gravacoes.`)
    }
    const roleRows1 = Array.isArray(roleRead1.body) ? roleRead1.body : []
    const roleRows2 = Array.isArray(roleRead2.body) ? roleRead2.body : []
    const roleMap1 = new Map((Array.isArray(rolesCatalog1.body) ? rolesCatalog1.body : []).map(r => [r.id, r.code]))
    const roleMap2 = new Map((Array.isArray(rolesCatalog2.body) ? rolesCatalog2.body : []).map(r => [r.id, r.code]))
    if (!roleRead1.ok || roleRows1.length === 0 || !roleRead2.ok || roleRows2.length === 0 || !rolesCatalog1.ok || !rolesCatalog2.ok) {
      return blockBeforeWrites(`Vinculos em user_roles/roles nao confirmados para as duas sessoes na Loja ${orgId}.`)
    }

    const session1HasAdmin = roleRows1.some(rr => roleMap1.get(rr.role_id) === 'ADMIN')
    const session2HasTreasurer = roleRows2.some(rr => roleMap2.get(rr.role_id) === 'TREASURER')
    if (!session1HasAdmin) {
      return blockBeforeWrites(`Janela 1 (${id1.email || id1.userId}) nao possui o papel ADMIN esperado na Loja ${orgId}.`)
    }
    if (!session2HasTreasurer) {
      return blockBeforeWrites(`Janela 2 (${id2.email || id2.userId}) nao possui o papel TREASURER esperado na Loja ${orgId}.`)
    }

    const prepareAudit = prepareAuditRes.ok ? prepareAuditRes.body?.[0] : null
    const auditRoundId = String(prepareAudit?.after_data?.round_id || '')
    const auditOrgId = String(prepareAudit?.after_data?.organization_id || '')
    const auditRoles = Array.isArray(prepareAudit?.after_data?.created_user_roles) ? prepareAudit.after_data.created_user_roles : []
    if (!prepareAudit || prepareAudit.entity_id !== orgId || auditOrgId.toLowerCase() !== orgId.toLowerCase() || !auditRoundId || auditRoles.length === 0) {
      return blockBeforeWrites(`Auditoria dev_qa.m0203_closure_prepare ausente ou incoerente para a Loja ${orgId}. Execute scripts/prepare_dev_m0203_closure_qa.sql antes do runner.`)
    }
    if (expectedRoundId && auditRoundId.toUpperCase() !== expectedRoundId.toUpperCase()) {
      return blockBeforeWrites(`Rodada da Loja ${orgId} (${auditRoundId}) diverge de CORSYS_QA_ROUND_ID (${expectedRoundId}).`)
    }
    const adminBound = auditRoles.some(
      r =>
        String(r.organization_id).toLowerCase() === orgId.toLowerCase() &&
        String(r.user_id).toLowerCase() === id1.userId.toLowerCase() &&
        r.role_code === 'ADMIN' &&
        roleRows1.some(rr => rr.role_id === r.role_id && roleMap1.get(rr.role_id) === 'ADMIN'),
    )
    const treasurerBound = auditRoles.some(
      r =>
        String(r.organization_id).toLowerCase() === orgId.toLowerCase() &&
        String(r.user_id).toLowerCase() === id2.userId.toLowerCase() &&
        r.role_code === 'TREASURER' &&
        roleRows2.some(rr => rr.role_id === r.role_id && roleMap2.get(rr.role_id) === 'TREASURER'),
    )
    if (!adminBound || !treasurerBound) {
      return blockBeforeWrites(`Identidades ou papeis ADMIN/TREASURER das sessoes nao correspondem aos vinculos exatos da rodada ${auditRoundId} na Loja ${orgId}.`)
    }
    if (!s2QueueCheck.ok) {
      return blockBeforeWrites(`Operador 2 (TREASURER) sem acesso de leitura a fila de aprovacao na Loja ${orgId} (HTTP ${s2QueueCheck.status}).`)
    }

    verifiedRoundId = auditRoundId
    console.log(`[Validacao] UUID ${orgId}, rodada ${verifiedRoundId}, Janela 1 (ADMIN) e Janela 2 (TREASURER) confirmados antes de qualquer gravacao.`)

    // =========================================================================
    // Verificacao unica antecipada de pre-requisitos
    // =========================================================================
    console.log('\n[Pre-requisitos] Conferindo configuracao da Loja QA antes dos cenarios...')
    const [
      catMemberRes,
      catExpRes,
      planRes,
      catMapRes,
      accRes,
      methodRes,
      membersRes,
      rulesRes,
      policyRes,
      importRes,
    ] = await Promise.all([
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/financial_categories?organization_id=eq.${orgId}&domain=eq.member_receivable&active=eq.true&select=id,name,allow_installments,allow_recurrence`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/financial_categories?organization_id=eq.${orgId}&domain=eq.institutional_expense&active=eq.true&select=id,name`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/accounting_plans?organization_id=eq.${orgId}&status=eq.published&select=id,name,valid_from,valid_to`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/financial_category_account_mappings?organization_id=eq.${orgId}&select=accounting_plan_id,category_id,accounting_account_id`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/financial_accounts?organization_id=eq.${orgId}&active=eq.true&select=id,name`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/payment_methods?organization_id=eq.${orgId}&active=eq.true&select=id,name`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/members?organization_id=eq.${orgId}&status=eq.active&select=id,full_name&order=full_name.asc`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/recurring_rules?organization_id=eq.${orgId}&active=eq.true&frequency=eq.monthly&select=id,name,category_id`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/expense_approval_policies?organization_id=eq.${orgId}&status=eq.published&valid_from=lte.${today}&valid_to=gte.${today}&select=id,name,mode,threshold_amount,minimum_approvers`),
      supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/bank_statement_imports?organization_id=eq.${orgId}&status=neq.canceled&select=id,file_name,status,financial_account_id&order=created_at.desc`),
    ])

    const activeAccount = accRes.body?.[0] ?? null
    const activeMethod = methodRes.body?.[0] ?? null
    const installmentCategory = (catMemberRes.body ?? []).find(c => c.allow_installments) ?? null
    const expenseCategory = catExpRes.body?.[0] ?? null
    const activeMembers = membersRes.body ?? []
    const activePlans = (planRes.body ?? []).filter(p => p.valid_from <= today && p.valid_to >= today)
    const mappedCategories = new Set((catMapRes.body ?? []).filter(m => activePlans.some(p => p.id === m.accounting_plan_id)).map(m => m.category_id))
    const monthlyRule = (rulesRes.body ?? []).find(r => (catMemberRes.body ?? []).some(c => c.id === r.category_id && c.allow_recurrence)) ?? null
    const activePolicy2 = (policyRes.body ?? []).find(p => Number(p.minimum_approvers) === 2 && (p.mode === 'all' || p.mode === 'threshold')) ?? null
    const bankImport = importRes.body?.[0] ?? null

    // Find next untouched future competence for Scenario 2 (between +1 and +11 months)
    let futureCompetence = ''
    if (monthlyRule && activeMembers.length >= 3) {
      for (let offset = 1; offset <= 11; offset++) {
        const ym = addMonths(currentMonth, offset)
        const previewRes = await supabaseRpcRead(page1, detectedPublishableKey, 'preview_monthly_charge_generation', {
          p_organization_id: orgId,
          p_rule_id: monthlyRule.id,
          p_competence: `${ym}-01`,
        })
        if (
          previewRes.ok &&
          previewRes.body?.accounting_mapping_ready === true &&
          Number(previewRes.body?.already_generated ?? 0) === 0 &&
          Number(previewRes.body?.missing_price ?? 0) === 0
        ) {
          futureCompetence = ym
          break
        }
      }
    }

    // Sessao 2 ja validada no gate pre-gravacao acima; apenas S3 e S4 conferem pre-requisitos restantes
    const session2ApproverReady = true

    // Verify bank import actually has lines for Scenario 4
    let statementLinesCount = 0
    if (bankImport) {
      const linesCheck = await supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/v_bank_reconciliation_lines?organization_id=eq.${orgId}&statement_import_id=eq.${bankImport.id}&select=statement_line_id`)
      statementLinesCount = Array.isArray(linesCheck.body) ? linesCheck.body.length : 0
    }

    const s1PrereqErrors = []
    if (!installmentCategory) s1PrereqErrors.push('categoria de integrante ativa com allow_installments=true')
    if (installmentCategory && !mappedCategories.has(installmentCategory.id)) s1PrereqErrors.push('mapeamento contabil publicado para categoria de acordo')
    if (!activeAccount) s1PrereqErrors.push('conta financeira ativa')
    if (!activeMethod) s1PrereqErrors.push('forma de pagamento ativa')
    if (activeMembers.length < 1) s1PrereqErrors.push('pelo menos 1 integrante ativo')

    const s2PrereqErrors = []
    if (activeMembers.length < 3) s2PrereqErrors.push('3 integrantes ativos')
    if (!monthlyRule) s2PrereqErrors.push('regra mensal ativa com categoria allow_recurrence=true')
    if (!futureCompetence) s2PrereqErrors.push('competencia futura livre com preco vigente e plano contabil publicado')

    const s3PrereqErrors = []
    if (!expenseCategory) s3PrereqErrors.push('categoria institucional_expense ativa')
    if (expenseCategory && !mappedCategories.has(expenseCategory.id)) s3PrereqErrors.push('mapeamento contabil publicado para despesa institucional')
    if (!activeAccount) s3PrereqErrors.push('conta financeira ativa')
    if (!activeMethod) s3PrereqErrors.push('forma de pagamento ativa')
    if (!activePolicy2) s3PrereqErrors.push('politica de aprovacao publicada vigente com minimum_approvers = 2')
    if (!session2ApproverReady) s3PrereqErrors.push('segunda sessao aprovadora distinta pronta')

    const s4PrereqErrors = []
    if (!bankImport || statementLinesCount < 1) s4PrereqErrors.push('extrato OFX/CSV valido com linhas na Loja QA')

    // =========================================================================
    // Cenario 1 — Acordo pela tela (R$ 100 + R$ 60 -> 2x R$ 80 -> baixa -> estorno)
    // =========================================================================
    if (s1PrereqErrors.length) {
      setResult('S1_ACORDO_ESTORNO', 'BLOCKED', `Pre-requisitos ausentes: ${s1PrereqErrors.join('; ')}`)
    } else {
      try {
        console.log('\n[S1] Executando Acordo pela tela + Baixa + Estorno seletivo...')
        const member1 = activeMembers[0]
        const desc100 = `QA Acordo 100 ${runId}`
        const desc60 = `QA Acordo 60 ${runId}`
        const agreementReason = `QA M02.03 acordo 160 em 2x80 ${runId}`

        await navigateMain(page1, 'Financeiro')
        await page1.locator('div[aria-label="Consultas financeiras"] button', { hasText: 'Cobranças avulsas' }).click()
        await page1.locator(`#manual-member option[value="${member1.id}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#manual-member').selectOption(member1.id)

        for (const [desc, amt] of [[desc100, '100,00'], [desc60, '60,00']]) {
          await page1.locator('#manual-desc').waitFor({ timeout: 20000 })
          await page1.locator('#manual-desc').fill(desc)
          await page1.locator('#manual-category').selectOption(installmentCategory.id)
          await page1.locator('#manual-competence').fill(currentMonth)
          await page1.locator('#manual-issue').fill(today)
          await page1.locator('#manual-due').fill(today)
          await page1.locator('#manual-period').fill(currentMonth)
          await page1.locator('#manual-amount').fill(amt)
          await page1.locator('#manual-reference').fill(`QA-M0203-${runId}`)
          await page1.locator('form[aria-label="Cadastrar cobrança avulsa"] button[type="submit"]').click()
          await page1.locator('div[aria-label="Cobranças de integrante"]', { hasText: desc }).waitFor({ timeout: 20000 })
        }

        await page1.locator('div[aria-label="Consultas financeiras"] button', { hasText: 'Negociar dívida' }).click()
        await page1.locator(`#agreement-member option[value="${member1.id}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#agreement-member').selectOption(member1.id)
        const debtFieldset = page1.locator('fieldset', { hasText: 'Débitos que serão negociados' })
        await debtFieldset.waitFor({ timeout: 20000 })

        await debtFieldset.locator('label', { hasText: desc100 }).locator('input[type="checkbox"]').check()
        await debtFieldset.locator('label', { hasText: desc60 }).locator('input[type="checkbox"]').check()
        await page1.getByText(/Saldo devedor selecionado:.*160,00/).waitFor({ timeout: 10000 })

        const prepForm = page1.locator('form[aria-label="Preparar negociação"]')
        await prepForm.locator('input[name="amount"]').fill('160,00')
        await prepForm.locator('input[name="count"]').fill('2')
        await prepForm.locator('input[name="date"]').fill(today)
        await prepForm.locator('input[name="due"]').fill(today)
        await prepForm.locator('input[name="reason"]').fill(agreementReason)
        await prepForm.locator('button[type="submit"]').click()

        const previewBox = page1.locator('div[aria-label="Prévia da negociação"]')
        await previewBox.waitFor({ timeout: 20000 })
        await previewBox.getByText(/Negociado:.*160,00/).waitFor({ timeout: 10000 })
        assert.equal(await previewBox.locator('ol li').count(), 2, 'Esperava 2 parcelas na previa')

        await previewBox.locator('input').fill('NEGOCIAR')
        await previewBox.locator('button', { hasText: 'Confirmar acordo' }).click()
        await page1.getByText('Acordo confirmado. Cobranças e parcelas atualizadas.').waitFor({ timeout: 20000 })
        await debtFieldset.waitFor({ timeout: 20000 })

        // Confirmar que as duas cobrancas originais sairam da carteira em aberto
        assert.equal(await debtFieldset.locator('label', { hasText: desc100 }).count(), 0, 'Cobranca de R$ 100 nao deveria permanecer em aberto apos o acordo')
        assert.equal(await debtFieldset.locator('label', { hasText: desc60 }).count(), 0, 'Cobranca de R$ 60 nao deveria permanecer em aberto apos o acordo')

        // Capturar os 2 IDs das parcelas do acordo criado para checar exatamente qual reabre
        const agreeRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/member_debt_agreements?organization_id=eq.${orgId}&member_id=eq.${member1.id}&reason=eq.${encodeURIComponent(agreementReason)}&select=id`,
        )
        const agreementId = agreeRes.body?.[0]?.id
        assert.ok(agreementId, 'Acordo criado nao encontrado em member_debt_agreements')

        const instRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/member_debt_agreement_installments?organization_id=eq.${orgId}&agreement_id=eq.${agreementId}&select=charge_id,installment_number,amount&order=installment_number.asc`,
        )
        assert.equal(instRes.body?.length, 2, 'Acordo deveria possuir exatamente 2 parcelas')
        const [inst1, inst2] = instRes.body
        assert.equal(Number(inst1.amount), 80)
        assert.equal(Number(inst2.amount), 80)

        // Baixar parcela 1 pela tela Pagamentos de integrantes e depois estornar
        await page1.locator('div[aria-label="Consultas financeiras"] button', { hasText: 'Pagamentos de integrantes' }).click()
        await page1.locator(`#member-payments-member option[value="${member1.id}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#member-payments-member').selectOption(member1.id)
        await page1.waitForSelector('form[aria-label="Registrar pagamento de integrante"]')

        await page1.locator('#member-pay-date').fill(today)
        await page1.locator('#member-pay-period').fill(currentMonth)
        await page1.locator('#member-pay-amount').fill('80,00')
        await page1.locator('#member-pay-method').selectOption(activeMethod.id)
        await page1.locator('#member-pay-account').selectOption(activeAccount.id)
        await page1.locator('#member-pay-reference').fill(`QA-PAY-${runId}`)
        await page1.locator('#member-pay-notes').fill(`QA M02.03 baixa parcela 1 ${runId}`)
        await page1.locator('form[aria-label="Registrar pagamento de integrante"] button[type="submit"]').click()
        await page1.getByText('Operação confirmada. O extrato foi atualizado.').waitFor({ timeout: 20000 })

        // Selecionar o pagamento recem-criado e alocar na Parcela 1/2
        const payRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/payments?organization_id=eq.${orgId}&member_id=eq.${member1.id}&reference=eq.${encodeURIComponent(`QA-PAY-${runId}`)}&select=id&order=created_at.desc&limit=1`,
        )
        const paymentId = payRes.body?.[0]?.id
        assert.ok(paymentId, 'Pagamento de R$ 80 nao encontrado')

        await page1.locator(`#member-alloc-pay option[value="${paymentId}"]`).waitFor({ timeout: 20000 })
        await page1.locator(`#member-alloc-charge option[value="${inst1.charge_id}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#member-alloc-pay').selectOption(paymentId)
        await page1.locator('#member-alloc-charge').selectOption(inst1.charge_id)
        await page1.locator('#member-alloc-amount').fill('80,00')
        await page1.locator('#member-alloc-period').fill(currentMonth)
        await page1.locator('form[aria-label="Alocar pagamento à cobrança"] button[type="submit"]').click()
        await page1.getByText('Operação confirmada. O extrato foi atualizado.').waitFor({ timeout: 20000 })

        // Validar Parcela 1 quitada e Parcela 2 aberta antes do estorno
        const balBeforeRev = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/v_charge_balances?organization_id=eq.${orgId}&charge_id=in.(${inst1.charge_id},${inst2.charge_id})&select=charge_id,open_amount`,
        )
        const mapBefore = new Map((balBeforeRev.body ?? []).map(x => [x.charge_id, Number(x.open_amount)]))
        assert.equal(mapBefore.get(inst1.charge_id), 0, 'Parcela 1/2 deveria estar quitada apos alocacao')
        assert.equal(mapBefore.get(inst2.charge_id), 80, 'Parcela 2/2 deveria continuar com R$ 80 em aberto')

        // Estornar o pagamento pela tela
        await page1.locator(`#member-reverse-pay option[value="${paymentId}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#member-reverse-pay').selectOption(paymentId)
        await page1.locator('#member-reverse-period').fill(currentMonth)
        await page1.locator('#member-reverse-reason').fill(`QA M02.03 estorno parcela 1 ${runId}`)
        await page1.locator('form[aria-label="Estornar pagamento de integrante"] button[type="submit"]').click()
        await page1.getByText('Operação confirmada. O extrato foi atualizado.').waitFor({ timeout: 20000 })

        // Conferir que APENAS Parcela 1/2 reabriu, Parcela 2/2 permanece inalterada e originais permanecem com open_amount = 0
        const itemsRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/member_debt_agreement_items?organization_id=eq.${orgId}&agreement_id=eq.${agreementId}&select=original_charge_id`,
        )
        const origIds = (itemsRes.body ?? []).map(x => x.original_charge_id)
        assert.equal(origIds.length, 2, 'Acordo deveria referenciar os 2 titulos originais')

        const balAfterRev = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/v_charge_balances?organization_id=eq.${orgId}&charge_id=in.(${[inst1.charge_id, inst2.charge_id, ...origIds].join(',')})&select=charge_id,open_amount,is_cancelled`,
        )
        const mapAfter = new Map((balAfterRev.body ?? []).map(x => [x.charge_id, x]))
        assert.equal(Number(mapAfter.get(inst1.charge_id)?.open_amount), 80, 'Parcela 1/2 deveria reabrir com R$ 80,00')
        assert.equal(Number(mapAfter.get(inst2.charge_id)?.open_amount), 80, 'Parcela 2/2 deveria permanecer com R$ 80,00')
        for (const oid of origIds) {
          assert.equal(Number(mapAfter.get(oid)?.open_amount), 0, 'Titulo original nao deve voltar a carteira aberta apos estorno da parcela')
          assert.equal(mapAfter.get(oid)?.is_cancelled, false, 'Titulo original permanece nao cancelado (ajustado pelo acordo)')
        }

        setResult('S1_ACORDO_ESTORNO', 'PASS', `Acordo ${agreementId.slice(0, 8)} (100+60 -> 2x80), originais zerados e estorno reabriu apenas parcela 1/2`)
      } catch (err) {
        setResult('S1_ACORDO_ESTORNO', 'FAIL', err instanceof Error ? err.message : String(err))
      }
    }

    // =========================================================================
    // Cenario 2 — Mensalidades (regra geral, valor individual, isencao, idempotencia)
    // =========================================================================
    if (s2PrereqErrors.length) {
      setResult('S2_MENSALIDADES', 'BLOCKED', `Pre-requisitos ausentes: ${s2PrereqErrors.join('; ')}`)
    } else {
      try {
        console.log(`\n[S2] Executando Mensalidades (competencia ${futureCompetence})...`)
        const [memberStd, memberOverride, memberExempt] = activeMembers
        const overrideAmountStr = '215,00'

        // Ler valor geral da regra vigente na competencia futura para conferencia
        const ruleVerRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/recurring_rule_versions?recurring_rule_id=eq.${monthlyRule.id}&valid_from_competence=lte.${futureCompetence}-01&select=unit_amount,valid_from_competence,valid_to_competence&order=valid_from_competence.desc`,
        )
        const activeVer = (ruleVerRes.body ?? []).find(v => !v.valid_to_competence || v.valid_to_competence >= `${futureCompetence}-01`)
        assert.ok(activeVer, 'Versao de preco vigente para a regra mensal nao encontrada')
        const generalAmount = Number(activeVer.unit_amount)
        assert.notEqual(generalAmount, 215, 'Valor geral coincide com 215; ajuste a regra ou valor individual')

        await navigateMain(page1, 'Integrantes')
        await page1.waitForSelector('#membersTable')

        // Configurar valor individual para memberOverride na competencia futureCompetence
        const openMemberConfig = async (memberName) => {
          const summary = page1.locator(`#membersTable summary[data-member="${memberName}"]`)
          await summary.click()
          await page1.locator('#membersTable button', { hasText: `Cargos e mensalidade de ${memberName}` }).click()
          await page1.waitForSelector('form[aria-label="Programar configuração do integrante"]')
        }

        await openMemberConfig(memberOverride.full_name)
        await page1.locator('#configuration-kind').selectOption('term')
        await page1.locator('#configuration-reference').selectOption(monthlyRule.id)
        await page1.locator('#configuration-term').selectOption('override_amount')
        await page1.locator('#configuration-amount').fill(overrideAmountStr)
        await page1.locator('#configuration-from').fill(futureCompetence)
        await page1.locator('#configuration-to').fill(futureCompetence)
        await page1.locator('#configuration-reason').fill(`QA M02.03 valor individual ${runId}`)
        await page1.locator('form[aria-label="Programar configuração do integrante"] button[type="submit"]').click()
        await page1.getByText('Configuração salva. O histórico foi atualizado.').waitFor({ timeout: 20000 })
        await page1.locator('button', { hasText: 'Fechar configurações' }).click()

        // Configurar isencao para memberExempt na competencia futureCompetence
        await openMemberConfig(memberExempt.full_name)
        await page1.locator('#configuration-kind').selectOption('term')
        await page1.locator('#configuration-reference').selectOption(monthlyRule.id)
        await page1.locator('#configuration-term').selectOption('exempt')
        await page1.locator('#configuration-from').fill(futureCompetence)
        await page1.locator('#configuration-to').fill(futureCompetence)
        await page1.locator('#configuration-reason').fill(`QA M02.03 isencao ${runId}`)
        await page1.locator('form[aria-label="Programar configuração do integrante"] button[type="submit"]').click()
        await page1.getByText('Configuração salva. O histórico foi atualizado.').waitFor({ timeout: 20000 })
        await page1.locator('button', { hasText: 'Fechar configurações' }).click()

        // Gerar mensalidades em Financeiro -> Gerar mensalidades
        await navigateMain(page1, 'Financeiro')
        await page1.locator('div[aria-label="Consultas financeiras"] button', { hasText: 'Gerar mensalidades' }).click()
        await page1.locator('#monthly-generator-rule').selectOption(monthlyRule.id)
        await page1.locator('#monthly-generator-competence').fill(futureCompetence)
        await page1.locator('button', { hasText: 'Verificar prévia' }).click()

        const prevSection = page1.locator('section[aria-label="Prévia mensal"]')
        await prevSection.waitFor({ timeout: 20000 })
        const confirmBtn = prevSection.locator('button[type="submit"]')
        await confirmBtn.waitFor({ timeout: 10000 })
        await page1.locator('#monthly-generator-reason').fill(`QA M02.03 geracao mensal ${runId}`)
        await confirmBtn.click()
        await page1.getByText(/Lote de cobranças confirmado\. Identificador:/).waitFor({ timeout: 20000 })

        // Conferir valores gerados por integrante na competencia
        const chargesRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/charges?organization_id=eq.${orgId}&category_id=eq.${monthlyRule.category_id}&competence=eq.${futureCompetence}-01&select=id,member_id,original_amount`,
        )
        const byMember = new Map((chargesRes.body ?? []).map(c => [c.member_id, Number(c.original_amount)]))
        assert.equal(byMember.get(memberStd.id), generalAmount, `Integrante padrao deveria receber valor geral (${generalAmount})`)
        assert.equal(byMember.get(memberOverride.id), 215, 'Valor individual R$ 215,00 nao teve precedencia sobre a regra geral')
        assert.equal(byMember.has(memberExempt.id), false, 'Integrante isento nao deveria receber cobranca na competencia')

        // Repetir a previa na mesma competencia e comprovar bloqueio sem duplicacao
        await page1.locator('button', { hasText: 'Verificar prévia' }).click()
        await prevSection.waitFor({ timeout: 20000 })
        await prevSection.getByText('A geração não está liberada.').waitFor({ timeout: 10000 })
        assert.equal(await prevSection.locator('button[type="submit"]').count(), 0, 'Botao de gerar deveria estar ausente apos lote ja gerado')

        const chargesAfterRetry = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/charges?organization_id=eq.${orgId}&category_id=eq.${monthlyRule.category_id}&competence=eq.${futureCompetence}-01&select=id`,
        )
        assert.equal(chargesAfterRetry.body?.length, chargesRes.body?.length, 'Quantidade de cobrancas alterou apos repetir previa')

        setResult('S2_MENSALIDADES', 'PASS', `Competencia ${futureCompetence}: padrao=${generalAmount}, individual=215, isento=0 cobrancas, re-execucao bloqueada (${chargesRes.body?.length} titulos)`)
      } catch (err) {
        setResult('S2_MENSALIDADES', 'FAIL', err instanceof Error ? err.message : String(err))
      }
    }

    // =========================================================================
    // Cenario 3 — Quorum de 2 aprovadores distintos (0/2 e 1/2 bloqueados; 2/2 pago)
    // =========================================================================
    if (s3PrereqErrors.length) {
      setResult('S3_QUORUM_2_APROVADORES', 'BLOCKED', `Pre-requisitos ausentes: ${s3PrereqErrors.join('; ')}`)
    } else {
      try {
        console.log('\n[S3] Executando Quorum de 2 aprovadores distintos em duas sessoes...')
        const payableDesc = `QA Despesa Quorum ${runId}`

        await navigateMain(page1, 'Contas a Pagar')
        await page1.waitForSelector('form[aria-label="Cadastrar obrigação institucional"]')

        await page1.locator('#inst-description').fill(payableDesc)
        await page1.locator('#inst-counterparty').fill('Fornecedor QA M02.03')
        await page1.locator('#inst-category').selectOption(expenseCategory.id)
        await page1.locator('#inst-competence').fill(currentMonth)
        await page1.locator('#inst-issue').fill(today)
        await page1.locator('#inst-due').fill(today)
        await page1.locator('#inst-period').fill(currentMonth)
        await page1.locator('#inst-amount').fill('45,00')
        await page1.locator('form[aria-label="Cadastrar obrigação institucional"] button[type="submit"]').click()
        await page1.getByText('Operação institucional confirmada. A consulta foi atualizada.').waitFor({ timeout: 20000 })
        await page1.locator('div[aria-label="Obrigações institucionais consultadas"]').waitFor({ timeout: 20000 })

        // Recuperar payable_id criado
        const payRowRes = await supabaseRestGet(
          page1,
          detectedPublishableKey,
          `/rest/v1/institutional_payables?organization_id=eq.${orgId}&description=eq.${encodeURIComponent(payableDesc)}&select=id&limit=1`,
        )
        const payableId = payRowRes.body?.[0]?.id
        assert.ok(payableId, 'Despesa institucional criada nao encontrada')

        // 0/2: confirmar ausencia no select de liquidacao (#inst-target) e pending no estado
        assert.equal(await page1.locator('#inst-target option', { hasText: payableDesc }).count(), 0, 'Pagamento permitido indevidamente em 0/2')
        const state0 = await supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/v_payable_approval_state?organization_id=eq.${orgId}&payable_id=eq.${payableId}&select=approvals,minimum_approvers,approval_status,approval_request_id`)
        assert.equal(state0.body?.[0]?.approvals, 0)
        assert.equal(state0.body?.[0]?.approval_status, 'pending')
        const reqId = state0.body?.[0]?.approval_request_id
        assert.ok(reqId, 'Solicitacao de aprovacao nao criada automaticamente')

        // Voto 1 na Janela 1 (Operador 1)
        await page1.locator('div[aria-label="Módulos de contas a pagar"] button', { hasText: 'Fila de Aprovação' }).click()
        await page1.locator(`#payable-approval-request option[value="${reqId}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#payable-approval-request').selectOption(reqId)
        await page1.locator('#payable-approval-decision').selectOption('approve')
        await page1.locator('#payable-approval-reason').fill(`QA M02.03 voto 1 de 2 ${runId}`)
        await page1.locator('form[aria-label="Decidir aprovação de despesa"] button[type="submit"]').click()
        await page1.getByText('Decisão registrada. A fila foi atualizada.').waitFor({ timeout: 20000 })

        // 1/2: voltar para Operacional e Liquidacao e comprovar bloqueio
        await page1.locator('div[aria-label="Módulos de contas a pagar"] button', { hasText: 'Operacional e Liquidação' }).click()
        await page1.waitForSelector('div[aria-label="Obrigações institucionais consultadas"]')
        assert.equal(await page1.locator('#inst-target option', { hasText: payableDesc }).count(), 0, 'Pagamento liberado indevidamente em 1/2')

        // Voto 2 na Janela 2 (Operador 2 distinto)
        await navigateMain(page2, 'Contas a Pagar')
        await page2.locator('div[aria-label="Módulos de contas a pagar"] button', { hasText: 'Fila de Aprovação' }).click()
        await page2.locator('section[aria-label="Aprovação de despesas"] button', { hasText: 'Atualizar fila' }).click()
        await page2.locator(`#payable-approval-request option[value="${reqId}"]`).waitFor({ timeout: 20000 })
        await page2.locator('#payable-approval-request').selectOption(reqId)
        await page2.locator('#payable-approval-decision').selectOption('approve')
        await page2.locator('#payable-approval-reason').fill(`QA M02.03 voto 2 de 2 ${runId}`)
        await page2.locator('form[aria-label="Decidir aprovação de despesa"] button[type="submit"]').click()
        await page2.getByText('Decisão registrada. A fila foi atualizada.').waitFor({ timeout: 20000 })

        // 2/2: atualizar na Janela 1, selecionar #inst-target e liquidar
        await page1.locator('section[aria-label="Tesouraria institucional"] button', { hasText: 'Atualizar lançamentos' }).click()
        await page1.locator(`#inst-target option[value="${payableId}"]`).waitFor({ timeout: 20000 })
        await page1.locator('#inst-target').selectOption(payableId)
        await page1.locator('#inst-settle-date').fill(today)
        await page1.locator('#inst-settle-period').fill(currentMonth)
        await page1.locator('#inst-settle-amount').fill('45,00')
        await page1.locator('#inst-settle-method').selectOption(activeMethod.id)
        await page1.locator('#inst-settle-account').selectOption(activeAccount.id)
        await page1.locator('#inst-settle-reference').fill(`QA-LIQ-${runId}`)
        await page1.locator('form[aria-label="Liquidar obrigação institucional"] button[type="submit"]').click()
        await page1.getByText('Operação institucional confirmada. A consulta foi atualizada.').waitFor({ timeout: 20000 })

        const settledState = await supabaseRestGet(page1, detectedPublishableKey, `/rest/v1/v_institutional_payable_balances?organization_id=eq.${orgId}&payable_id=eq.${payableId}&select=open_amount,approval_status`)
        assert.equal(settledState.body?.[0]?.approval_status, 'approved')
        assert.equal(Number(settledState.body?.[0]?.open_amount), 0, 'Obrigacao deveria estar quitada apos 2/2')

        setResult('S3_QUORUM_2_APROVADORES', 'PASS', `Despesa ${payableId.slice(0, 8)}: bloqueada em 0/2 e 1/2; liberada e liquidada apos voto de 2o usuario distinto (${id2.userId.slice(0, 8)})`)
      } catch (err) {
        setResult('S3_QUORUM_2_APROVADORES', 'FAIL', err instanceof Error ? err.message : String(err))
      }
    }

    // =========================================================================
    // Cenario 4 — Conciliacao sob leitura incompleta simulada apenas no cliente
    // =========================================================================
    if (s4PrereqErrors.length) {
      setResult('S4_CONCILIACAO_INCOMPLETA', 'BLOCKED', `Pre-requisitos ausentes: ${s4PrereqErrors.join('; ')}`)
    } else {
      const writeRpcCalls = []
      const interceptedResponses = []
      const recoveryResponses = []
      const recoveryReadPromises = []
      let captureRecovery = false
      const rpcMonitor = (req) => {
        if (req.url().includes('/rest/v1/rpc/')) {
          writeRpcCalls.push(req.url())
        }
      }
      const responseMonitor = (res) => {
        if (!captureRecovery) return
        const url = res.url()
        if (
          url.startsWith(DEV_SUPABASE_ORIGIN) &&
          url.includes('/rest/v1/v_bank_reconciliation_lines') &&
          url.includes(`organization_id=eq.${orgId}`) &&
          url.includes(`statement_import_id=eq.${bankImport.id}`)
        ) {
          recoveryReadPromises.push(
            (async () => {
              const rows = await res.json().catch(() => null)
              const rawRange = res.headers()['content-range'] || ''
              recoveryResponses.push({
                url,
                status: res.status(),
                rawRange,
                parsedRange: parseContentRangeHeader(rawRange),
                rows,
              })
            })(),
          )
        }
      }
      const routePattern = '**/rest/v1/v_bank_reconciliation_lines*'
      try {
        console.log('\n[S4] Executando Conciliacao com falha simulada somente no cliente...')
        await navigateMain(page1, 'Tesouraria')
        await page1.locator('div[aria-label="Navegação da tesouraria"] button', { hasText: 'Conciliação OFX/CSV' }).click()
        const selectImport = page1.getByLabel('Extrato para revisar')
        await selectImport.waitFor({ timeout: 20000 })
        await selectImport.locator(`option[value="${bankImport.id}"]`).waitFor({ timeout: 20000 })

        page1.on('request', rpcMonitor)
        page1.on('response', responseMonitor)
        await page1.route(routePattern, async (route) => {
          const reqUrl = route.request().url()
          if (
            !reqUrl.startsWith(DEV_SUPABASE_ORIGIN) ||
            !reqUrl.includes(`organization_id=eq.${orgId}`) ||
            !reqUrl.includes(`statement_import_id=eq.${bankImport.id}`)
          ) {
            await route.continue()
            return
          }
          const response = await route.fetch()
          const body = await response.text()
          const headers = { ...response.headers() }
          const originalContentRange = headers['content-range'] || ''
          headers['content-range'] = '0-0/999'
          headers['access-control-expose-headers'] = 'content-range'
          interceptedResponses.push({
            url: reqUrl,
            status: response.status(),
            originalContentRange,
            tamperedContentRange: headers['content-range'],
          })
          await route.fulfill({
            status: response.status(),
            headers,
            contentType: response.headers()['content-type'] || 'application/json',
            body,
          })
        })

        writeRpcCalls.length = 0
        await selectImport.selectOption(bankImport.id)

        const bankSection = page1.locator('section.bank-reconciliation')
        await bankSection.locator('p[role="alert"]').getByText('Consulta incompleta ou inconsistente. Nenhuma conciliação foi autorizada.').waitFor({ timeout: 20000 })

        // Confirmar explicitamente que a resposta esperada foi interceptada pelo cliente de teste
        assert.ok(
          interceptedResponses.length >= 1 &&
            interceptedResponses.some(
              r =>
                r.url.includes(`organization_id=eq.${orgId}`) &&
                r.url.includes(`statement_import_id=eq.${bankImport.id}`) &&
                r.status >= 200 &&
                r.status < 300 &&
                r.tamperedContentRange === '0-0/999',
            ),
          `A resposta esperada de v_bank_reconciliation_lines (${bankImport.id}) nao foi interceptada no S4`,
        )

        // Confirmar travamento da UI e ausencia de acoes e RPCs de escrita
        assert.equal(await bankSection.locator('legend', { hasText: 'Correspondência manual' }).count(), 0)
        assert.equal(await bankSection.locator('legend', { hasText: 'Desfazer correspondência' }).count(), 0)
        assert.equal(await bankSection.locator('button', { hasText: 'Validar extrato revisado' }).count(), 0)
        assert.equal(await bankSection.locator('button', { hasText: 'Confirmar correspondência' }).count(), 0)
        assert.equal(writeRpcCalls.length, 0, `Chamada RPC inesperada durante bloqueio: ${writeRpcCalls.join(', ')}`)

        // Remover interceptacao e recarregar com leitura integra comprovando contagem, intervalo, organizacao e extrato
        await page1.unroute(routePattern)
        captureRecovery = true
        await bankSection.locator('button', { hasText: 'Atualizar conciliação' }).click()

        await bankSection.locator('div[aria-label="Linhas do extrato"]').waitFor({ timeout: 20000 })
        await Promise.all(recoveryReadPromises)

        const validRecovery = recoveryResponses.find((r) => {
          if (r.status !== 200 && r.status !== 206) return false
          if (!r.parsedRange || !Array.isArray(r.rows)) return false
          if (r.parsedRange.start !== 0 || r.parsedRange.end !== statementLinesCount - 1) return false
          if (r.parsedRange.span !== statementLinesCount || r.parsedRange.total !== statementLinesCount) return false
          if (r.rows.length !== statementLinesCount) return false
          const uniqueLineIds = new Set(r.rows.map(row => row.statement_line_id))
          if (uniqueLineIds.size !== statementLinesCount) return false
          return r.rows.every(
            row =>
              row.organization_id === orgId &&
              row.statement_import_id === bankImport.id &&
              row.integrity_ok === true,
          )
        })
        assert.ok(
          validRecovery,
          `Recuperacao do S4 sem integridade completa (esperado total=${statementLinesCount}, intervalo=0-${statementLinesCount - 1}, org=${orgId}, extrato=${bankImport.id})`,
        )
        assert.equal(
          await bankSection.locator('div[aria-label="Linhas do extrato"] tbody tr').count(),
          statementLinesCount,
          'Quantidade de linhas renderizadas na tabela diverge do extrato esperado',
        )
        assert.equal(await bankSection.locator('p[role="alert"]').count(), 0, 'Alerta deveria desaparecer apos recuperacao integra')
        const controlsVisible = await bankSection.locator('legend:has-text("Correspondência manual"), button:has-text("Validar extrato revisado")').count()
        assert.ok(controlsVisible >= 1, 'Controles de conciliacao nao reapareceram apos leitura integra')
        assert.equal(writeRpcCalls.length, 0, `Chamada RPC de escrita inesperada durante recuperacao: ${writeRpcCalls.join(', ')}`)

        setResult(
          'S4_CONCILIACAO_INCOMPLETA',
          'PASS',
          `Extrato ${bankImport.id.slice(0, 8)} (org ${orgId.slice(0, 8)}): ${interceptedResponses.length} resposta(s) interceptada(s), 0 RPCs de escrita, recuperacao integra confirmada (intervalo ${validRecovery.rawRange}, ${statementLinesCount} linhas)`,
        )
      } catch (err) {
        setResult('S4_CONCILIACAO_INCOMPLETA', 'FAIL', err instanceof Error ? err.message : String(err))
      } finally {
        page1.off('request', rpcMonitor)
        page1.off('response', responseMonitor)
        await page1.unroute(routePattern).catch(() => {})
      }
    }

    printSummary(results, { targetUrl, organizationId: orgId, organizationName: orgName, verifiedRoundId, runId })

    const hasFail = results.some(r => r.status === 'FAIL')
    const hasBlocked = results.some(r => r.status === 'BLOCKED')
    if (hasFail) process.exitCode = 1
    else if (hasBlocked) process.exitCode = 2
    else process.exitCode = 0
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isCli) {
  main().catch((err) => {
    console.error('Erro fatal na homologacao M02.03:', err)
    process.exit(1)
  })
}
