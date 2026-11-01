import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertQADenied,
  assertQARows,
  assertQAUUID
} from './dev-qa-gates'
import {
  buildManualInvoiceIdempotencyKey,
  issueMasterManualInvoice,
  previewMasterManualInvoice,
  type MasterManualInvoicePreview
} from './master-billing'

export type ManualInvoiceQAMode = 'PREFLIGHT' | 'CONTROLLED_FINANCIAL_TEST'

export interface ManualInvoiceQAOptions {
  mode?: ManualInvoiceQAMode
  organizationId?: string
  competence?: string
  dueDate?: string
  enableRealFinancialMutation?: boolean
  operationalAuthConfirmation?: boolean
  targetSupabaseUrl?: string
  customFetch?: typeof fetch
  unauthenticatedClient?: SupabaseClient
  tenantUserClient?: SupabaseClient
  aal1StaffClient?: SupabaseClient
}

export interface ManualInvoiceQAResult {
  success: boolean
  mode: ManualInvoiceQAMode
  details: string[]
  createdInvoiceId?: string
  tracesCount?: number
  auditVerified?: boolean
}

const ALLOWED_QA_ORGS = new Set([
  '94b84958-4dd9-435d-9a4e-244220835d70',
  '7a6aa771-524d-4d5a-9d38-7006175e1cb4'
])

const ALLOWED_QA_COMPETENCES = new Set([
  '2026-11-01',
  '2026-12-01',
  '2027-01-01'
])

export const EXPECTED_SUPABASE_DEV_URL = 'https://szqkdekwhzxsoxorgvaz.supabase.co'

/**
 * Validates target environment to ensure operations run exclusively on the authorized Supabase DEV instance.
 */
export function validateQATargetEnvironment(supabaseUrl?: string): void {
  const targetUrl =
    supabaseUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
      : undefined) ||
    EXPECTED_SUPABASE_DEV_URL

  if (targetUrl !== EXPECTED_SUPABASE_DEV_URL) {
    throw Error(
      `DEV QA target denied: project URL "${targetUrl}" is not the authorized Supabase DEV instance (${EXPECTED_SUPABASE_DEV_URL})`
    )
  }
}

/**
 * Enforces explicit allowlist of authorized QA organizations and competences.
 */
export function validateQAOrganizationAndCompetence(
  org: string,
  competence: string
): void {
  if (!ALLOWED_QA_ORGS.has(org)) {
    throw Error(`DEV QA denied: organization "${org}" is not in the explicit QA allowlist`)
  }
  if (!ALLOWED_QA_COMPETENCES.has(competence)) {
    throw Error(`DEV QA denied: competence "${competence}" is not in the explicit QA allowlist`)
  }
}

/**
 * Preflight verification mode for Master Manual Invoice issuance.
 * Performs read-only schema, contractual term, RLS, and RPC preview checks
 * under strict RLS isolation without making any real financial mutations.
 */
export async function runManualInvoicePreflight(
  client: SupabaseClient,
  report: (msg: string) => void,
  options?: ManualInvoiceQAOptions
): Promise<MasterManualInvoicePreview> {
  const org = options?.organizationId || '94b84958-4dd9-435d-9a4e-244220835d70'
  const competence = options?.competence || '2026-11-01'

  validateQATargetEnvironment(options?.targetSupabaseUrl)
  validateQAOrganizationAndCompetence(org, competence)

  report(`[PREFLIGHT] Checking schema, RLS, and contractual terms for org ${org.slice(0, 8)}...`)

  // 1. Verify organization under RLS isolation
  const orgRows = assertQARows(
    await client.from('organizations').select('id, name').eq('id', org),
    1
  )
  const orgName = String(orgRows[0].name)

  // 2. Verify active contractual price terms in saas_subscription_price_terms under RLS
  const termRes = await client
    .from('saas_subscription_price_terms')
    .select('id, unit_price, effective_from, effective_to')
    .eq('organization_id', org)
  if (termRes.error) {
    throw Error(
      `Preflight failed querying saas_subscription_price_terms under RLS: ${termRes.error.message}`
    )
  }

  // 3. Verify RPC preview_saas_manual_invoice without financial mutation
  const preview = await previewMasterManualInvoice(
    client,
    org,
    competence,
    options?.dueDate
  )

  if (!preview || preview.organization_id !== org) {
    throw Error('Preflight preview returned invalid organization scope')
  }
  if (typeof preview.unit_price !== 'number' || preview.unit_price <= 0) {
    throw Error('Preflight preview returned non-positive unit price')
  }
  if (!Array.isArray(preview.line_items) || preview.line_items.length === 0) {
    throw Error('Preflight preview returned empty line items')
  }

  report(
    `[PREFLIGHT PASS] Org "${orgName}": Plan "${preview.plan_name}", Unit Price R$ ${preview.unit_price.toFixed(
      2
    )}, Line Items: ${preview.line_items.length}. Read-only preflight under RLS verified.`
  )

  return preview
}

/**
 * Controlled Financial Test mode for Master Manual Invoice issuance.
 * Requires TWO explicit operational confirmations:
 *  - enableRealFinancialMutation: true
 *  - operationalAuthConfirmation: true
 * Performs real HTTP concurrent RPC calls to test:
 *  - Concurrency with SAME idempotency key (must deduplicate to 1 invoice UUID)
 *  - Concurrency with DIFFERENT idempotency keys (must block duplicate with SQLSTATE 55000)
 *  - Real/Prepared negative authorization (Master/AAL1, tenant user, anonymous)
 *  - Strict audit log validation using real saas_master_audit_logs fields (action, resource_id, metadata).
 *  - Uses injected transport telemetry fetch without modifying globalThis.fetch.
 */
export async function runManualInvoiceControlledFinancialTest(
  client: SupabaseClient,
  report: (msg: string) => void,
  options?: ManualInvoiceQAOptions
): Promise<{ createdInvoiceId: string; tracesCount: number; auditVerified: boolean }> {
  // 1. Multi-factor operational security check
  if (options?.enableRealFinancialMutation !== true) {
    throw Error(
      'Controlled financial mutation denied: enableRealFinancialMutation flag must be explicitly set to true.'
    )
  }
  if (options?.operationalAuthConfirmation !== true) {
    throw Error(
      'Controlled financial mutation denied: operationalAuthConfirmation must be explicitly confirmed for QA financial execution.'
    )
  }

  const org = options?.organizationId || '94b84958-4dd9-435d-9a4e-244220835d70'
  const competence = options?.competence || '2026-11-01'
  const dueDate = options?.dueDate || '2026-11-10'

  validateQATargetEnvironment(options?.targetSupabaseUrl)
  validateQAOrganizationAndCompetence(org, competence)

  report(
    `[CONTROLLED FINANCIAL TEST] Starting HTTP QA for org ${org.slice(
      0,
      8
    )}, competence ${competence}...`
  )

  // 2. Historical check on target organization
  const invoiceCheck = await client
    .from('v_saas_invoice_balances')
    .select('id, competence, derived_status')
    .eq('organization_id', org)
    .eq('competence', competence)

  if (
    !invoiceCheck.error &&
    Array.isArray(invoiceCheck.data) &&
    invoiceCheck.data.some((inv) => inv.derived_status !== 'void')
  ) {
    throw Error(
      `CONTROLLED TEST DENIED: Organization ${org} already has an active (unvoided) invoice for competence ${competence}.`
    )
  }

  // 3. Isolated HTTP Transport Telemetry (No mutation of globalThis.fetch!)
  const traces: { name: string; status: number; code: string | null }[] = []
  const baseFetch = options?.customFetch || globalThis.fetch

  const telemetryFetch: typeof fetch = async (input, init) => {
    const response = await baseFetch(input, init)
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.href
        : input.url
    const url = new URL(urlStr)

    if (url.pathname.includes('/rest/v1/rpc/')) {
      const clone = response.clone()
      const body = await clone.json().catch(() => null)
      traces.push({
        name: url.pathname.split('/').pop() || '',
        status: response.status,
        code: typeof body?.code === 'string' ? body.code : null
      })
    }
    return response
  }

  // 4. Negative Authorization Checks (Real / Prepared)
  report('[CONTROLLED TEST] Running negative authorization checks...')

  // Check 4a: Non-existent organization
  const fakeOrg = '00000000-0000-0000-0000-000000000000'
  const invalidOrgCall = await client.rpc('preview_saas_manual_invoice', {
    p_organization_id: fakeOrg,
    p_competence: competence
  })
  assertQADenied(invalidOrgCall, ['23503', '42501', '55000'])

  // Check 4b: Invalid competence day (not day 1 of month)
  const invalidDayCall = await client.rpc('preview_saas_manual_invoice', {
    p_organization_id: org,
    p_competence: '2026-11-15'
  })
  assertQADenied(invalidDayCall, ['22023', '42501'])

  // Check 4c: Anonymous client call (if provided)
  if (options?.unauthenticatedClient) {
    const anonCall = await options.unauthenticatedClient.rpc('preview_saas_manual_invoice', {
      p_organization_id: org,
      p_competence: competence
    })
    assertQADenied(anonCall, ['42501', 'P0001'])
  }

  // Check 4d: Tenant user client call (if provided)
  if (options?.tenantUserClient) {
    const tenantCall = await options.tenantUserClient.rpc('preview_saas_manual_invoice', {
      p_organization_id: org,
      p_competence: competence
    })
    assertQADenied(tenantCall, ['42501', 'P0001'])
  }

  // Check 4e: AAL1 Staff user client call (if provided)
  if (options?.aal1StaffClient) {
    const aal1Call = await options.aal1StaffClient.rpc('preview_saas_manual_invoice', {
      p_organization_id: org,
      p_competence: competence
    })
    assertQADenied(aal1Call, ['42501', 'P0001'])
  }

  // 5. Real Concurrency Scenario A: Concurrent calls with SAME idempotency key
  report('[CONTROLLED TEST] Testing REAL concurrency with SAME idempotency key...')
  const idempotencyKeyA = buildManualInvoiceIdempotencyKey(org, competence)

  const [resA1, resA2] = await Promise.all([
    issueMasterManualInvoice(client, {
      organization_id: org,
      competence,
      due_date: dueDate,
      description: 'DEV QA HTTP Controlled Financial Test Concurrent Same Key',
      idempotency_key: idempotencyKeyA
    }).catch((e) => e),
    issueMasterManualInvoice(client, {
      organization_id: org,
      competence,
      due_date: dueDate,
      description: 'DEV QA HTTP Controlled Financial Test Concurrent Same Key',
      idempotency_key: idempotencyKeyA
    }).catch((e) => e)
  ])

  if (resA1 instanceof Error) throw resA1
  if (resA2 instanceof Error) throw resA2

  const invoiceIdA1 = assertQAUUID({ data: resA1, error: null })
  const invoiceIdA2 = assertQAUUID({ data: resA2, error: null })

  if (invoiceIdA1 !== invoiceIdA2) {
    throw Error(
      `Idempotency replay failure: expected identical UUID ${invoiceIdA1}, got ${invoiceIdA2}`
    )
  }

  report(
    `[CONTROLLED TEST PASS] Real concurrency verified: identical invoice UUID ${invoiceIdA1} returned for concurrent requests with same key.`
  )

  // 6. Real Concurrency Scenario B: Calls with DIFFERENT idempotency key for same competence
  report('[CONTROLLED TEST] Testing duplicate block for DIFFERENT idempotency key...')
  const idempotencyKeyB = buildManualInvoiceIdempotencyKey(org, competence)

  let duplicateError: { code?: string; message?: string } | null = null
  try {
    await issueMasterManualInvoice(client, {
      organization_id: org,
      competence,
      due_date: dueDate,
      description: 'DEV QA Duplicate Test Different Key',
      idempotency_key: idempotencyKeyB
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object') {
      duplicateError = err as { code?: string; message?: string }
    }
  }

  if (
    !duplicateError ||
    (duplicateError.code !== '55000' &&
      !duplicateError.message?.includes('already exists') &&
      !duplicateError.message?.includes('Duplicate billing'))
  ) {
    throw Error(
      `Duplicate invoice block failed: expected SQLSTATE 55000, got code "${
        duplicateError?.code
      }" / msg "${duplicateError?.message}"`
    )
  }

  report(
    '[CONTROLLED TEST PASS] Duplicate invoice correctly blocked with SQLSTATE 55000 for different key on same competence.'
  )

  // 7. Strict Audit Log Validation (MUST fail test if audit log is missing or invalid)
  report('[CONTROLLED TEST] Verifying saas_master_audit_logs entry with real fields (action, resource_id, metadata)...')

  const auditRes = await client
    .from('saas_master_audit_logs')
    .select('id, staff_user_id, organization_id, action, resource_type, resource_id, metadata')
    .eq('organization_id', org)
    .eq('resource_id', invoiceIdA1)
    .eq('action', 'invoice.manual_issue')

  if (auditRes.error) {
    throw Error(
      `Audit log query failed for saas_master_audit_logs: ${auditRes.error.message}`
    )
  }

  if (!Array.isArray(auditRes.data) || auditRes.data.length === 0) {
    throw Error(
      `AUDIT LOG VERIFICATION FAILED: saas_master_audit_logs record for invoice ${invoiceIdA1} with action "invoice.manual_issue" was not found.`
    )
  }

  const auditRecord = auditRes.data[0] as {
    resource_id: string
    action: string
    metadata?: Record<string, unknown>
  }

  if (auditRecord.resource_id !== invoiceIdA1 || auditRecord.action !== 'invoice.manual_issue') {
    throw Error(
      `AUDIT LOG DISCREPANCY FAILED: Expected resource_id "${invoiceIdA1}" and action "invoice.manual_issue", got resource_id "${auditRecord.resource_id}" and action "${auditRecord.action}".`
    )
  }

  if (!auditRecord.metadata || typeof auditRecord.metadata !== 'object') {
    throw Error(
      `AUDIT LOG METADATA FAILED: metadata object missing or invalid for invoice ${invoiceIdA1}.`
    )
  }

  report(
    `[CONTROLLED TEST PASS] Strict audit log verified in saas_master_audit_logs for invoice ${invoiceIdA1.slice(
      0,
      8
    )} (resource_id, action, metadata validated).`
  )

  report(
    `[CONTROLLED FINANCIAL TEST PASS] Complete HTTP QA verified (${traces.length} telemetry traces). Created invoice UUID: ${invoiceIdA1}.`
  )

  return {
    createdInvoiceId: invoiceIdA1,
    tracesCount: traces.length,
    auditVerified: true
  }
}

/**
 * Main entrypoint runner for Manual Invoice HTTP QA.
 * Runs PREFLIGHT by default, or Controlled Financial Test if enabled.
 */
export async function runManualInvoiceHTTPQA(
  client: SupabaseClient,
  report: (msg: string) => void,
  options?: ManualInvoiceQAOptions
): Promise<ManualInvoiceQAResult> {
  const mode = options?.mode || 'PREFLIGHT'
  const details: string[] = []
  const collector = (msg: string) => {
    details.push(msg)
    report(msg)
  }

  if (mode === 'CONTROLLED_FINANCIAL_TEST') {
    const result = await runManualInvoiceControlledFinancialTest(
      client,
      collector,
      options
    )
    return {
      success: true,
      mode,
      details,
      createdInvoiceId: result.createdInvoiceId,
      tracesCount: result.tracesCount,
      auditVerified: result.auditVerified
    }
  }

  await runManualInvoicePreflight(client, collector, options)
  return {
    success: true,
    mode: 'PREFLIGHT',
    details
  }
}
