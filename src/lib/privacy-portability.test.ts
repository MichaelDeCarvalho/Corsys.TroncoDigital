import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sanitizeCsvCell,
  buildPortabilityCsvBundle,
  verifySha256Integrity,
  createTenantPortabilityExport,
  downloadPortabilityAttachmentBinary,
  downloadTenantPortabilityExport,
  registerTenantPrivacyRequest,
  reviewTenantPrivacyRequest,
  readTenantRetentionPosture,
} from './privacy-portability'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const EXPORT_ID = '33333333-3333-4333-8333-333333333333'
const REQ_ID = '44444444-4444-4444-8444-444444444444'

describe('privacy-portability library (M05 Entregas A-C)', () => {
  it('neutralizes CSV formula injection after NFKC normalization', () => {
    expect(sanitizeCsvCell('=CMD|"/C calc"!A0')).toBe('"\'=CMD|""/C calc""!A0"')
    expect(sanitizeCsvCell('＋1+1')).toBe('"\'＋1+1"')
    expect(sanitizeCsvCell('\u0007@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(sanitizeCsvCell('Loja Harmonia 42')).toBe('"Loja Harmonia 42"')
  })

  it('builds safe CSV bundle per dataset without losing exact columns', () => {
    const bundle = buildPortabilityCsvBundle({
      members: [{ id: MEMBER_ID, full_name: '=HYPERLINK("bad")', status: 'active' }],
      charges: [],
    })
    expect(bundle['members.csv']).toContain('"\'=HYPERLINK(""bad"")"')
    expect(bundle['charges.csv']).toBe('')
  })

  it('validates SHA-256 integrity hex digest strictly', async () => {
    const text = '{"organization":"qa"}'
    const hash = '173ca9ed192320a30c746a752c7d10a5f63a0f5a1a7d6304dd79fad232e8f611'
    expect(await verifySha256Integrity(text, hash)).toBe(true)
    expect(await verifySha256Integrity(text + '!', hash)).toBe(false)
    expect(await verifySha256Integrity(text, 'invalid-digest')).toBe(false)
  })

  it('requires subject member UUID for data_subject_package export and passes exact RPC params', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { export_id: EXPORT_ID, status: 'ready', payload_sha256: 'a'.repeat(64) },
      error: null,
    })
    const client = { rpc } as unknown as SupabaseClient

    await expect(
      createTenantPortabilityExport(client, {
        organizationId: ORG_ID,
        exportScope: 'data_subject_package',
        subjectMemberId: '',
        packageFormat: 'json',
      }),
    ).rejects.toThrow(/Integrante titular inválido/)

    await createTenantPortabilityExport(client, {
      organizationId: ORG_ID,
      exportScope: 'data_subject_package',
      subjectMemberId: MEMBER_ID,
      packageFormat: 'csv',
      idempotencyKey: 'fixed-key',
    })

    expect(rpc).toHaveBeenCalledWith('create_tenant_portability_export_idempotent', {
      p_organization_id: ORG_ID,
      p_export_scope: 'data_subject_package',
      p_subject_member_id: MEMBER_ID,
      p_package_format: 'csv',
      p_idempotency_key: 'fixed-key',
    })
  })

  it('blocks download if response lacks valid sha256 or payload', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { export_id: EXPORT_ID, payload_sha256: 'broken', payload: {} },
      error: null,
    })
    const client = { rpc } as unknown as SupabaseClient

    await expect(
      downloadTenantPortabilityExport(client, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        requestedFormat: 'json',
      }),
    ).rejects.toThrow(/SHA-256/)
  })

  it('calls privacy request registration, controller review, and retention posture RPCs cleanly', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null })
    const client = { rpc } as unknown as SupabaseClient

    await registerTenantPrivacyRequest(client, {
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
      requestType: 'anonymization',
      dataCategory: 'financial_ledger',
      verificationMethod: 'in_person_controller_check',
      requesterVerified: true,
      legalBasis: 'legal_obligation_accounting',
      notes: 'Solicitação de revisão do titular',
      idempotencyKey: 'req-1',
    })

    await reviewTenantPrivacyRequest(client, {
      organizationId: ORG_ID,
      requestId: REQ_ID,
      decisionOutcome: 'retained_by_law',
      legalBasis: 'legal_obligation_accounting',
      requesterVerified: true,
      reidentificationRiskRemains: true,
      controllerJustification: 'Guarda contábil obrigatória por 5 anos conforme D01',
      idempotencyKey: 'rev-1',
    })

    await readTenantRetentionPosture(client, ORG_ID)
    expect(rpc).toHaveBeenCalledTimes(3)
  })

  it('downloads only through the server-side attachment authorization and rejects missing binaries', async () => {
    const documentId = '44444444-4444-4444-8444-444444444444'
    const payload = { organizationId: ORG_ID, exportId: EXPORT_ID, documentId }
    const blob = new Blob(['test'], { type: 'application/octet-stream' })
    const invoke = vi.fn().mockResolvedValueOnce({ data: blob, error: null }).mockResolvedValueOnce({
      data: null, error: new Error('Object unavailable'),
    })
    const client = { functions: { invoke } } as unknown as SupabaseClient
    await expect(downloadPortabilityAttachmentBinary(client, payload)).resolves.toBe(blob)
    expect(invoke).toHaveBeenCalledWith('portability-attachment', {
      body: { p_organization_id: ORG_ID, p_export_id: EXPORT_ID, p_document_id: documentId },
    })
    await expect(downloadPortabilityAttachmentBinary(client, payload)).rejects.toThrow(/baixar o binário autorizado/)
  })
})
