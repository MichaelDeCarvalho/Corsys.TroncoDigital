import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  EXPECTED_SUPABASE_DEV_URL,
  runManualInvoiceControlledFinancialTest,
  runManualInvoiceHTTPQA,
  runManualInvoicePreflight,
  validateQAOrganizationAndCompetence,
  validateQATargetEnvironment
} from './dev-qa-manual-invoice'

const TEST_ORG_ID = '94b84958-4dd9-435d-9a4e-244220835d70'
const TEST_SUB_ID = '11111111-1111-4111-8111-111111111111'
const TEST_INVOICE_ID = '22222222-2222-4222-8222-222222222222'

function createMockSupabaseClient(options?: {
  previewError?: { code: string; message: string } | null
  issueError?: { code: string; message: string } | null
  missingAuditLog?: boolean
  existingActiveInvoice?: boolean
}): SupabaseClient {
  const rpcCalls: { name: string; args: unknown }[] = []
  const issuedKeys = new Map<string, string>()

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args })

    if (name === 'preview_saas_manual_invoice') {
      if (options?.previewError) {
        return { data: null, error: options.previewError }
      }
      if (args.p_organization_id === '00000000-0000-0000-0000-000000000000') {
        return {
          data: null,
          error: { code: '23503', message: 'organization not found' }
        }
      }
      if (args.p_competence === '2026-11-15') {
        return {
          data: null,
          error: {
            code: '22023',
            message: 'competence must be the first day of the month'
          }
        }
      }
      return {
        data: {
          organization_id: String(args.p_organization_id),
          organization_name: 'Org QA Test',
          subscription_id: TEST_SUB_ID,
          plan_id: '33333333-3333-4333-8333-333333333333',
          plan_name: 'Plano Pro SaaS',
          competence: String(args.p_competence),
          service_period_start: '2026-11-01',
          service_period_end: '2026-11-30',
          due_date: '2026-11-10',
          unit_price: 250.0,
          currency: 'BRL',
          line_items: [
            {
              item_type: 'subscription_fee',
              description: 'Mensalidade Plano Pro SaaS (Competência 2026-11)',
              quantity: 1,
              unit_amount: 250.0,
              line_amount: 250.0
            }
          ],
          total_amount: 250.0,
          already_billed: false
        },
        error: null
      }
    }

    if (name === 'issue_saas_manual_invoice') {
      if (options?.issueError) {
        return { data: null, error: options.issueError }
      }
      const org = String(args.p_organization_id)
      const competence = String(args.p_competence)
      const key = String(args.p_idempotency_key)
      const scopeKey = `${org}:${competence}`

      const existingKey = issuedKeys.get(scopeKey)
      if (!existingKey) {
        issuedKeys.set(scopeKey, key)
        return { data: TEST_INVOICE_ID, error: null }
      }

      if (existingKey === key) {
        // Replay: same key returns same UUID
        return { data: TEST_INVOICE_ID, error: null }
      }

      // Different key on same competence -> 55000 block
      return {
        data: null,
        error: {
          code: '55000',
          message: 'Duplicate billing for the same competence & subscription is blocked'
        }
      }
    }

    throw new Error(`Unexpected RPC call: ${name}`)
  })

  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      abortSignal: () => builder,
      then: (resolve: (r: unknown) => void) => {
        let data: unknown[] = []
        if (table === 'organizations') {
          data = [{ id: TEST_ORG_ID, name: 'Org QA Test' }]
        } else if (table === 'saas_subscription_price_terms') {
          data = [
            {
              id: '44444444-4444-4444-8444-444444444444',
              unit_price: 250.0,
              effective_from: '2026-01-01',
              effective_to: null
            }
          ]
        } else if (table === 'v_saas_invoice_balances') {
          data = options?.existingActiveInvoice
            ? [
                {
                  id: TEST_INVOICE_ID,
                  competence: '2026-11-01',
                  derived_status: 'open'
                }
              ]
            : []
        } else if (table === 'saas_master_audit_logs') {
          data = options?.missingAuditLog
            ? []
            : [
                {
                  id: '55555555-5555-4555-8555-555555555555',
                  staff_user_id: '66666666-6666-4666-8666-666666666666',
                  organization_id: TEST_ORG_ID,
                  action: 'invoice.manual_issue',
                  resource_type: 'saas_invoices',
                  resource_id: TEST_INVOICE_ID,
                  metadata: {
                    invoice_number: 'CORSYS-202611-00001',
                    subscription_id: TEST_SUB_ID,
                    competence: '2026-11-01',
                    amount_due: 250.0
                  }
                }
              ]
        }
        resolve({ data, error: null })
      }
    }
    return builder
  })

  return { rpc, from } as unknown as SupabaseClient
}

function createDeniedMockClient(errorCode = '42501'): SupabaseClient {
  const rpc = vi.fn(async () => ({
    data: null,
    error: { code: errorCode, message: 'insufficient_privilege' }
  }))
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        then: (resolve: (r: unknown) => void) =>
          resolve({ data: null, error: { code: errorCode, message: 'insufficient_privilege' } })
      })
    })
  }))
  return { rpc, from } as unknown as SupabaseClient
}

describe('Manual Invoice HTTP QA Runner Refactored (dev-qa-manual-invoice)', () => {
  it('validates target environment and allowlists correctly', () => {
    expect(() => validateQATargetEnvironment(EXPECTED_SUPABASE_DEV_URL)).not.toThrow()
    expect(() => validateQATargetEnvironment('https://unauthorized-project.supabase.co')).toThrow(
      /DEV QA target denied/
    )

    expect(() => validateQAOrganizationAndCompetence(TEST_ORG_ID, '2026-11-01')).not.toThrow()
    expect(() =>
      validateQAOrganizationAndCompetence('00000000-0000-0000-0000-000000000000', '2026-11-01')
    ).toThrow(/organization .* is not in the explicit QA allowlist/)
    expect(() => validateQAOrganizationAndCompetence(TEST_ORG_ID, '2025-01-01')).toThrow(
      /competence .* is not in the explicit QA allowlist/
    )
  })

  it('runs PREFLIGHT successfully under RLS without financial mutations', async () => {
    const client = createMockSupabaseClient()
    const reports: string[] = []
    const reportFn = (msg: string) => reports.push(msg)

    const preview = await runManualInvoicePreflight(client, reportFn, {
      organizationId: TEST_ORG_ID,
      competence: '2026-11-01'
    })

    expect(preview.organization_id).toBe(TEST_ORG_ID)
    expect(preview.unit_price).toBe(250.0)
    expect(reports.some((r) => r.includes('[PREFLIGHT PASS]'))).toBe(true)
  })

  it('rejects controlled financial mutation when operational confirmations are missing', async () => {
    const client = createMockSupabaseClient()
    const reportFn = vi.fn()

    // Missing enableRealFinancialMutation
    await expect(
      runManualInvoiceControlledFinancialTest(client, reportFn, {
        enableRealFinancialMutation: false,
        operationalAuthConfirmation: true
      })
    ).rejects.toThrow(/enableRealFinancialMutation flag must be explicitly set to true/)

    // Missing operationalAuthConfirmation
    await expect(
      runManualInvoiceControlledFinancialTest(client, reportFn, {
        enableRealFinancialMutation: true,
        operationalAuthConfirmation: false
      })
    ).rejects.toThrow(/operationalAuthConfirmation must be explicitly confirmed/)
  })

  it('blocks controlled financial mutation if incompatible active invoice exists in historical check', async () => {
    const client = createMockSupabaseClient({ existingActiveInvoice: true })
    const reportFn = vi.fn()

    await expect(
      runManualInvoiceControlledFinancialTest(client, reportFn, {
        organizationId: TEST_ORG_ID,
        competence: '2026-11-01',
        enableRealFinancialMutation: true,
        operationalAuthConfirmation: true
      })
    ).rejects.toThrow(/already has an active \(unvoided\) invoice/)
  })

  it('executes controlled financial test successfully with concurrency, deduplication & negative auth checks', async () => {
    const client = createMockSupabaseClient()
    const unauthenticatedClient = createDeniedMockClient('P0001')
    const tenantUserClient = createDeniedMockClient('42501')
    const aal1StaffClient = createDeniedMockClient('42501')

    const reports: string[] = []
    const reportFn = (msg: string) => reports.push(msg)

    const result = await runManualInvoiceControlledFinancialTest(
      client,
      reportFn,
      {
        organizationId: TEST_ORG_ID,
        competence: '2026-11-01',
        enableRealFinancialMutation: true,
        operationalAuthConfirmation: true,
        unauthenticatedClient,
        tenantUserClient,
        aal1StaffClient
      }
    )

    expect(result.createdInvoiceId).toBe(TEST_INVOICE_ID)
    expect(result.auditVerified).toBe(true)
    expect(reports.some((r) => r.includes('[CONTROLLED TEST PASS] Real concurrency verified'))).toBe(true)
    expect(reports.some((r) => r.includes('Duplicate invoice correctly blocked'))).toBe(true)
    expect(reports.some((r) => r.includes('Strict audit log verified in saas_master_audit_logs'))).toBe(true)
  })

  it('FAILS test if saas_master_audit_logs entry is missing (strict audit check)', async () => {
    const client = createMockSupabaseClient({ missingAuditLog: true })
    const reportFn = vi.fn()

    await expect(
      runManualInvoiceControlledFinancialTest(client, reportFn, {
        organizationId: TEST_ORG_ID,
        competence: '2026-11-01',
        enableRealFinancialMutation: true,
        operationalAuthConfirmation: true
      })
    ).rejects.toThrow(/AUDIT LOG VERIFICATION FAILED: saas_master_audit_logs record for invoice/)
  })

  it('runs runManualInvoiceHTTPQA wrapper in PREFLIGHT and CONTROLLED_FINANCIAL_TEST modes', async () => {
    const client = createMockSupabaseClient()
    const reports: string[] = []
    const reportFn = (msg: string) => reports.push(msg)

    // Preflight mode by default
    const resPreflight = await runManualInvoiceHTTPQA(client, reportFn)
    expect(resPreflight.success).toBe(true)
    expect(resPreflight.mode).toBe('PREFLIGHT')

    // Controlled test mode
    const resControlled = await runManualInvoiceHTTPQA(client, reportFn, {
      mode: 'CONTROLLED_FINANCIAL_TEST',
      enableRealFinancialMutation: true,
      operationalAuthConfirmation: true,
      organizationId: TEST_ORG_ID,
      competence: '2026-11-01'
    })
    expect(resControlled.success).toBe(true)
    expect(resControlled.mode).toBe('CONTROLLED_FINANCIAL_TEST')
    expect(resControlled.createdInvoiceId).toBe(TEST_INVOICE_ID)
    expect(resControlled.auditVerified).toBe(true)
  })

  it('preserves globalThis.fetch without mutating global state', async () => {
    const originalFetch = globalThis.fetch
    const client = createMockSupabaseClient()
    const reportFn = vi.fn()

    await runManualInvoiceControlledFinancialTest(client, reportFn, {
      organizationId: TEST_ORG_ID,
      competence: '2026-11-01',
      enableRealFinancialMutation: true,
      operationalAuthConfirmation: true
    })

    expect(globalThis.fetch).toBe(originalFetch)
  })
})
