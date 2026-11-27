import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sanitizeCsvCell,
  buildPortabilityCsvBundle,
  computeBytesSha256Hex,
  computeTextSha256Hex,
  serializePgJsonbText,
  verifyBytesSha256Integrity,
  verifySha256Integrity,
  createTenantPortabilityExport,
  downloadPortabilityAttachmentBinary,
  downloadTenantPortabilityExport,
  listTenantPrivacyRequests,
  registerTenantPrivacyRequest,
  reviewTenantPrivacyRequest,
  readTenantRetentionPosture,
  classifyPrivacyError,
  sanitizePrivacyMessage,
} from './privacy-portability'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '99999999-9999-4999-8999-999999999999'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const EXPORT_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_EXPORT_ID = '77777777-7777-4777-8777-777777777777'
const REQ_ID = '44444444-4444-4444-8444-444444444444'

const FUTURE_EXPIRES_AT = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const PAST_EXPIRES_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString()

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

  it('serializes JSON deterministically matching PostgreSQL jsonb::text key ordering and spacing', () => {
    const serialized = serializePgJsonbText({
      zeta: [1, 2],
      ab: true,
      b: 'short',
      a: 'first',
      nested: { long_key: 10, id: 1 },
    })
    // PG jsonb::text orders keys by UTF-8 byte length first, then byte lexicographical order
    expect(serialized).toBe(
      '{"a": "first", "b": "short", "ab": true, "zeta": [1, 2], "nested": {"id": 1, "long_key": 10}}',
    )
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

  it('verifies server canonical payload_text SHA-256 and blocks divergent, tampered, expired, or cross-tenant packages without auto-retry', async () => {
    const payload = {
      organization: { id: ORG_ID, name: 'Loja QA' },
      charges: [{ id: 'c1', amount: 120.5 }],
    }
    // Simulate exact PostgreSQL jsonb::text including formatting that differs from JSON.stringify
    const pgText =
      '{"charges": [{"id": "c1", "amount": 120.50}], "organization": {"id": "11111111-1111-4111-8111-111111111111", "name": "Loja QA"}}'
    const validSha = await computeTextSha256Hex(pgText)

    const validBase = {
      export_id: EXPORT_ID,
      organization_id: ORG_ID,
      export_scope: 'organization_full',
      subject_member_id: null,
      package_format: 'json',
      payload_sha256: validSha,
      payload_text_format: 'pg_jsonb_text_v1',
      payload_text: pgText,
      expires_at: FUTURE_EXPIRES_AT,
      downloaded_at: new Date().toISOString(),
      manifest: { counts: { charges: 1 }, totals_cents: {} },
      data_dictionary: { version: '2026.11-m05' },
      payload,
    }

    // 1. Valid canonical payload_text passes strictly with 1 RPC call (zero retries)
    const rpcOk = vi.fn().mockResolvedValue({ data: validBase, error: null })
    const verified = await downloadTenantPortabilityExport({ rpc: rpcOk } as unknown as SupabaseClient, {
      organizationId: ORG_ID,
      exportId: EXPORT_ID,
      requestedFormat: 'json',
      expectedScope: 'organization_full',
    })
    expect(verified.integrity_verified).toBe(true)
    expect(verified.integrity_mode).toBe('server_canonical_text')
    expect(rpcOk).toHaveBeenCalledTimes(1)

    // 2. Tampered digest strictly blocked (INTEGRITY_MISMATCH)
    const rpcTamperedSha = vi.fn().mockResolvedValue({
      data: { ...validBase, payload_sha256: 'f'.repeat(64) },
      error: null,
    })
    await expect(
      downloadTenantPortabilityExport({ rpc: rpcTamperedSha } as unknown as SupabaseClient, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        requestedFormat: 'json',
      }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' })
    expect(rpcTamperedSha).toHaveBeenCalledTimes(1)

    // 3. Payload diverged from verified payload_text blocked
    const rpcTamperedPayload = vi.fn().mockResolvedValue({
      data: { ...validBase, payload: { organization: { id: ORG_ID, name: 'ADULTERADA' } } },
      error: null,
    })
    await expect(
      downloadTenantPortabilityExport({ rpc: rpcTamperedPayload } as unknown as SupabaseClient, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        requestedFormat: 'json',
      }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' })

    // 4. Legacy package without payload_text remains compatible via PG jsonb::text serializer
    const legacyPgText = serializePgJsonbText(payload)
    const legacySha = await computeTextSha256Hex(legacyPgText)
    const { payload_text: _omitText, payload_text_format: _omitFmt, ...legacyPkg } = validBase
    const rpcLegacy = vi.fn().mockResolvedValue({
      data: { ...legacyPkg, payload_sha256: legacySha },
      error: null,
    })
    const verifiedLegacy = await downloadTenantPortabilityExport({ rpc: rpcLegacy } as unknown as SupabaseClient, {
      organizationId: ORG_ID,
      exportId: EXPORT_ID,
      requestedFormat: 'json',
    })
    expect(verifiedLegacy.integrity_verified).toBe(true)
    expect(verifiedLegacy.integrity_mode).toBe('legacy_pg_jsonb_text')

    // 5. Cross-tenant organization_id, wrong export_id, wrong scope, wrong format, expired
    for (const [override, expectedCode] of [
      [{ organization_id: OTHER_ORG_ID }, 'INTEGRITY_MISMATCH'],
      [{ export_id: OTHER_EXPORT_ID }, 'INTEGRITY_MISMATCH'],
      [{ export_scope: 'data_subject_package' }, 'INTEGRITY_MISMATCH'],
      [{ package_format: 'csv' }, 'INTEGRITY_MISMATCH'],
      [{ expires_at: PAST_EXPIRES_AT }, 'EXPORT_EXPIRED'],
    ] as const) {
      const rpcBad = vi.fn().mockResolvedValue({ data: { ...validBase, ...override }, error: null })
      await expect(
        downloadTenantPortabilityExport({ rpc: rpcBad } as unknown as SupabaseClient, {
          organizationId: ORG_ID,
          exportId: EXPORT_ID,
          requestedFormat: 'json',
          expectedScope: 'organization_full',
        }),
      ).rejects.toMatchObject({ code: expectedCode })
    }
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
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          request_id: REQ_ID,
          organization_id: ORG_ID,
          decision_outcome: 'pending_triage',
          triage_due_at: '2026-11-30T12:00:00Z',
          ledger_preserved: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: {
          organization_id: ORG_ID,
          schedule: [],
        },
        error: null,
      })
    const client = { rpc } as unknown as SupabaseClient

    const registered = await registerTenantPrivacyRequest(client, {
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
    expect(registered.request_id).toBe(REQ_ID)
    expect(registered.decision_outcome).toBe('pending_triage')

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

  it('rejects incomplete, invalid or cross-tenant RPC responses on register and list', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: {
          request_id: REQ_ID,
          organization_id: OTHER_ORG_ID,
          decision_outcome: 'pending_triage',
          triage_due_at: '2026-11-30T12:00:00Z',
          ledger_preserved: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { not_an_array: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ request_id: REQ_ID, organization_id: OTHER_ORG_ID }],
        error: null,
      })
    const client = { rpc } as unknown as SupabaseClient

    await expect(
      registerTenantPrivacyRequest(client, {
        organizationId: ORG_ID,
        requestType: 'access',
        dataCategory: 'cadastral',
        verificationMethod: 'in_person_controller_check',
        requesterVerified: false,
        legalBasis: 'exercise_of_rights',
        notes: 'Sem id válido',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RPC_RESPONSE' })

    await expect(
      registerTenantPrivacyRequest(client, {
        organizationId: ORG_ID,
        requestType: 'access',
        dataCategory: 'cadastral',
        verificationMethod: 'in_person_controller_check',
        requesterVerified: false,
        legalBasis: 'exercise_of_rights',
        notes: 'Tenant divergente',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RPC_RESPONSE' })

    await expect(listTenantPrivacyRequests(client, ORG_ID)).rejects.toMatchObject({
      code: 'INVALID_RPC_RESPONSE',
    })
    await expect(listTenantPrivacyRequests(client, ORG_ID)).rejects.toMatchObject({
      code: 'INVALID_RPC_RESPONSE',
    })
  })

  it('requires member_id for authenticated_member_link before calling RPC', async () => {
    const rpc = vi.fn()
    const client = { rpc } as unknown as SupabaseClient

    await expect(
      registerTenantPrivacyRequest(client, {
        organizationId: ORG_ID,
        memberId: '',
        requestType: 'access',
        dataCategory: 'cadastral',
        verificationMethod: 'authenticated_member_link',
        requesterVerified: false,
        legalBasis: 'exercise_of_rights',
        notes: 'Falta UUID',
      }),
    ).rejects.toMatchObject({ code: 'CLIENT_VALIDATION' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('classifies auth, conflict, integrity, expiry, timeout/uncertain errors safely and redacts secrets', () => {
    expect(
      classifyPrivacyError({ code: '42501', message: 'controller permission required' }),
    ).toMatchObject({ kind: 'auth', retryableWithSameKey: false })

    expect(classifyPrivacyError({ code: '28000', message: 'authentication required' })).toMatchObject({
      kind: 'auth',
      retryableWithSameKey: false,
    })

    expect(
      classifyPrivacyError({ code: 'PT409', message: 'idempotency key already used with different payload' }),
    ).toMatchObject({ kind: 'conflict', retryableWithSameKey: false })

    expect(
      classifyPrivacyError({ code: '55000', message: 'portability export payload digest mismatch' }),
    ).toMatchObject({ kind: 'integrity', retryableWithSameKey: false })

    expect(
      classifyPrivacyError({ code: 'EXPORT_EXPIRED', message: 'Pacote expirado' }),
    ).toMatchObject({ kind: 'validation', retryableWithSameKey: false })

    expect(classifyPrivacyError(new Error('504 Gateway Timeout'))).toMatchObject({
      kind: 'uncertain',
      retryableWithSameKey: true,
    })

    expect(sanitizePrivacyMessage('erro password=supersecret Bearer tok123 postgres://user:pw@db')).not.toContain(
      'supersecret',
    )
  })

  it('downloads only through server-side attachment authorization and enforces fail-closed SHA-256 and size checks', async () => {
    const documentId = '44444444-4444-4444-8444-444444444444'
    const rawBytes = new TextEncoder().encode('test-pdf-bytes')
    const validSha = await computeBytesSha256Hex(rawBytes)
    const blob = new Blob([rawBytes], { type: 'application/pdf' })

    expect(await verifyBytesSha256Integrity(rawBytes, validSha)).toBe(true)
    expect(await verifyBytesSha256Integrity(rawBytes, null)).toBe(false)
    expect(await verifyBytesSha256Integrity(rawBytes, 'bad')).toBe(false)

    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ data: blob, error: null })
      .mockResolvedValueOnce({ data: blob, error: null })
      .mockResolvedValueOnce({ data: blob, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('Object unavailable') })
    const client = { functions: { invoke } } as unknown as SupabaseClient

    // Valid digest & size passes
    await expect(
      downloadPortabilityAttachmentBinary(client, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        documentId,
        expectedSha256: validSha,
        expectedSizeBytes: rawBytes.length,
        requireSha256: true,
      }),
    ).resolves.toBe(blob)
    expect(invoke).toHaveBeenCalledWith('portability-attachment', {
      body: { p_organization_id: ORG_ID, p_export_id: EXPORT_ID, p_document_id: documentId },
    })

    // Divergent digest blocked
    await expect(
      downloadPortabilityAttachmentBinary(client, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        documentId,
        expectedSha256: 'e'.repeat(64),
        expectedSizeBytes: rawBytes.length,
        requireSha256: true,
      }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' })

    // Divergent size blocked
    await expect(
      downloadPortabilityAttachmentBinary(client, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        documentId,
        expectedSha256: validSha,
        expectedSizeBytes: 9999,
        requireSha256: true,
      }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' })

    // Missing sha256 when requireSha256=true blocked before even calling edge function
    await expect(
      downloadPortabilityAttachmentBinary(client, {
        organizationId: ORG_ID,
        exportId: EXPORT_ID,
        documentId,
        expectedSha256: null,
        requireSha256: true,
      }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' })

    // Missing binary from Edge Function rejected
    await expect(
      downloadPortabilityAttachmentBinary(client, { organizationId: ORG_ID, exportId: EXPORT_ID, documentId }),
    ).rejects.toThrow(/baixar o binário autorizado/)
  })
})
