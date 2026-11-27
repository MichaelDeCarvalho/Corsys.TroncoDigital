import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, ShieldAlert, Clock, FileText, Lock, RefreshCw } from 'lucide-react'
import {
  buildPortabilityCsvBundle,
  classifyPrivacyError,
  createTenantPortabilityExport,
  downloadPortabilityAttachmentBinary,
  downloadTenantPortabilityExport,
  generateM05IdempotencyKey,
  listTenantPortabilityExports,
  listTenantPrivacyRequests,
  placeTenantLegalHold,
  PRIVACY_CATEGORY_LABELS,
  PRIVACY_OUTCOME_LABELS,
  readTenantRetentionPosture,
  registerTenantPrivacyRequest,
  releaseTenantLegalHold,
  RETENTION_PHASE_LABELS,
  reviewTenantPrivacyRequest,
  verifySha256Integrity,
  type EligibleAttachmentMetadata,
  type PortabilityExportRecord,
  type PortabilityFormat,
  type PortabilityScope,
  type PrivacyDataCategory,
  type PrivacyDecisionOutcome,
  type PrivacyLegalBasis,
  type PrivacyRequestRecord,
  type PrivacyRequestType,
  type PrivacyVerificationMethod,
  type RegisteredPrivacyRequestResult,
  type RetentionCategory,
  type TenantRetentionPosture,
} from '../lib/privacy-portability'

function triggerBlobDownload(filename: string, blob: Blob) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(href), 1500)
}

function triggerLocalDownload(filename: string, content: string, mimeType: string) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const blob = new Blob([content], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(href), 1500)
}

type SectionLoadStatus =
  | 'idle'
  | 'loaded'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'unauthenticated'

interface SectionLoadState {
  status: SectionLoadStatus
  message: string
}

interface PendingPrivacyRegistration {
  idempotencyKey: string
  organizationId: string
  memberId: string | null
  requestType: PrivacyRequestType
  dataCategory: PrivacyDataCategory
  verificationMethod: PrivacyVerificationMethod
  requesterVerified: boolean
  legalBasis: PrivacyLegalBasis
  notes: string
}

function toSectionFailureState(err: unknown, fallback: string): SectionLoadState {
  const classified = classifyPrivacyError(err, fallback)
  if (classified.code === '28000') {
    return { status: 'unauthenticated', message: classified.message }
  }
  if (classified.kind === 'auth') {
    return { status: 'forbidden', message: classified.message }
  }
  return { status: 'error', message: classified.message }
}

export function TenantPrivacyPortabilityPanel({
  client,
  organizationId,
}: {
  client: SupabaseClient
  organizationId: string
}) {
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [postRegisterRefreshWarning, setPostRegisterRefreshWarning] = useState('')

  const [posture, setPosture] = useState<TenantRetentionPosture | null>(null)
  const [exportsList, setExportsList] = useState<PortabilityExportRecord[]>([])
  const [activeExportAttachments, setActiveExportAttachments] = useState<{
    exportId: string
    items: EligibleAttachmentMetadata[]
  } | null>(null)
  const [requestsList, setRequestsList] = useState<PrivacyRequestRecord[]>([])

  const [postureState, setPostureState] = useState<SectionLoadState>({ status: 'idle', message: '' })
  const [exportsState, setExportsState] = useState<SectionLoadState>({ status: 'idle', message: '' })
  const [requestsState, setRequestsState] = useState<SectionLoadState>({ status: 'idle', message: '' })

  // Export form state
  const [exportScope, setExportScope] = useState<PortabilityScope>('organization_full')
  const [exportMemberId, setExportMemberId] = useState('')
  const [exportFormat, setExportFormat] = useState<PortabilityFormat>('json')

  // Privacy request form state — identity validation NEVER starts pre-checked
  const [reqMemberId, setReqMemberId] = useState('')
  const [reqType, setReqType] = useState<PrivacyRequestType>('access')
  const [reqCategory, setReqCategory] = useState<PrivacyDataCategory>('cadastral')
  const [reqVerMethod, setReqVerMethod] = useState<PrivacyVerificationMethod>('in_person_controller_check')
  const [reqVerified, setReqVerified] = useState(false)
  const [reqBasis, setReqBasis] = useState<PrivacyLegalBasis>('exercise_of_rights')
  const [reqNotes, setReqNotes] = useState('')

  const privacySubmitLockRef = useRef(false)
  const activeOrgRef = useRef(organizationId)
  const loadSeqRef = useRef(0)
  const [uncertainPrivacyCmd, setUncertainPrivacyCmd] = useState<{
    command: PendingPrivacyRegistration
    reason: string
  } | null>(null)
  const [lastConfirmedReq, setLastConfirmedReq] = useState<RegisteredPrivacyRequestResult | null>(null)

  // Review state
  const [reviewOutcome, setReviewOutcome] = useState<Record<string, Exclude<PrivacyDecisionOutcome, 'pending_triage'>>>({})
  const [reviewRisk, setReviewRisk] = useState<Record<string, boolean>>({})
  const [reviewJustification, setReviewJustification] = useState<Record<string, string>>({})

  // Hold state
  const [holdCategory, setHoldCategory] = useState<RetentionCategory>('financial_ledger')
  const [holdReason, setHoldReason] = useState('')
  const [holdRef, setHoldRef] = useState('')

  const isPrivacyFormLocked = busyAction !== '' || uncertainPrivacyCmd !== null

  const loadAll = useCallback(async (options?: { preserveActionBanner?: boolean }) => {
    if (!organizationId || typeof client?.rpc !== 'function') {
      return { ok: false, requestsOk: false, requestsError: '', summaryError: '' }
    }
    const seq = ++loadSeqRef.current
    const targetOrg = organizationId
    setLoading(true)
    if (!options?.preserveActionBanner) {
      setError('')
    }

    try {
      const [postureRes, exportsRes, requestsRes] = await Promise.allSettled([
        readTenantRetentionPosture(client, targetOrg),
        listTenantPortabilityExports(client, targetOrg),
        listTenantPrivacyRequests(client, targetOrg),
      ])

      if (loadSeqRef.current !== seq || activeOrgRef.current !== targetOrg) {
        return { ok: false, requestsOk: false, requestsError: '', summaryError: '' }
      }

      const sectionErrors: string[] = []
      let requestsOk = false
      let requestsError = ''

      if (postureRes.status === 'fulfilled') {
        setPosture(postureRes.value)
        setPostureState({ status: 'loaded', message: '' })
      } else {
        setPosture(null)
        const fail = toSectionFailureState(
          postureRes.reason,
          'Não foi possível carregar a postura de retenção da Loja.',
        )
        setPostureState(fail)
        sectionErrors.push(fail.message)
      }

      if (exportsRes.status === 'fulfilled') {
        setExportsList(exportsRes.value)
        setExportsState({
          status: exportsRes.value.length === 0 ? 'empty' : 'loaded',
          message: '',
        })
      } else {
        setExportsList([])
        setActiveExportAttachments(null)
        const fail = toSectionFailureState(
          exportsRes.reason,
          'Não foi possível carregar as exportações de portabilidade.',
        )
        setExportsState(fail)
        sectionErrors.push(fail.message)
      }

      if (requestsRes.status === 'fulfilled') {
        requestsOk = true
        setRequestsList(requestsRes.value)
        setRequestsState({
          status: requestsRes.value.length === 0 ? 'empty' : 'loaded',
          message: '',
        })
        setPostRegisterRefreshWarning('')
      } else {
        setRequestsList([])
        const fail = toSectionFailureState(
          requestsRes.reason,
          'Não foi possível carregar as solicitações LGPD desta Loja.',
        )
        requestsError = fail.message
        setRequestsState(fail)
        sectionErrors.push(fail.message)
      }

      const summaryError =
        sectionErrors.length === 0
          ? ''
          : sectionErrors.length === 3
            ? sectionErrors[0]
            : `Consulta parcial LGPD (${sectionErrors.length} falha(s)): ${sectionErrors.join(' · ')}`

      if (summaryError && !options?.preserveActionBanner) {
        setError(summaryError)
      }

      return {
        ok: sectionErrors.length === 0,
        requestsOk,
        requestsError,
        summaryError,
      }
    } catch (err) {
      if (loadSeqRef.current !== seq || activeOrgRef.current !== targetOrg) {
        return { ok: false, requestsOk: false, requestsError: '', summaryError: '' }
      }
      setPosture(null)
      setExportsList([])
      setActiveExportAttachments(null)
      setRequestsList([])
      const fail = toSectionFailureState(err, 'Não foi possível carregar dados de privacidade e portabilidade.')
      setPostureState(fail)
      setExportsState(fail)
      setRequestsState(fail)
      if (!options?.preserveActionBanner) {
        setError(fail.message)
      }
      return {
        ok: false,
        requestsOk: false,
        requestsError: fail.message,
        summaryError: fail.message,
      }
    } finally {
      if (loadSeqRef.current === seq) {
        setLoading(false)
      }
    }
  }, [client, organizationId])

  useEffect(() => {
    activeOrgRef.current = organizationId
    privacySubmitLockRef.current = false
    setBusyAction('')
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    setPosture(null)
    setExportsList([])
    setActiveExportAttachments(null)
    setRequestsList([])
    setPostureState({ status: 'idle', message: '' })
    setExportsState({ status: 'idle', message: '' })
    setRequestsState({ status: 'idle', message: '' })
    setUncertainPrivacyCmd(null)
    setLastConfirmedReq(null)
    setReqVerified(false)
    setReqMemberId('')
    setReqNotes('')
    void loadAll()
  }, [organizationId, loadAll])

  async function handleCreateExport(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('export-create')
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      const created = await createTenantPortabilityExport(client, {
        organizationId,
        exportScope,
        subjectMemberId: exportScope === 'data_subject_package' ? exportMemberId : null,
        packageFormat: exportFormat,
      })
      setFeedback(`Pacote ${created.export_id} gerado com SHA-256 ${created.payload_sha256.slice(0, 12)}… e validade de 24 horas.`)
      await loadAll({ preserveActionBanner: true })
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível gerar o pacote de portabilidade.').message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleDownloadExport(record: PortabilityExportRecord) {
    if (busyAction) return
    setBusyAction(`download-${record.export_id}`)
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      const pkg = await downloadTenantPortabilityExport(client, {
        organizationId,
        exportId: record.export_id,
        requestedFormat: record.package_format,
      })
      const serializedPayload = JSON.stringify(pkg.payload)
      await verifySha256Integrity(serializedPayload, pkg.payload_sha256)

      if (record.package_format === 'csv') {
        const csvFiles = buildPortabilityCsvBundle(pkg.payload)
        const combinedCsv = Object.entries(csvFiles)
          .map(([name, body]) => `### ${name}\n${body}`)
          .join('\n\n')
        triggerLocalDownload(`corsys-portabilidade-${record.export_id.slice(0, 8)}.csv`, combinedCsv, 'text/csv;charset=utf-8')
      } else {
        triggerLocalDownload(
          `corsys-portabilidade-${record.export_id.slice(0, 8)}.json`,
          JSON.stringify(
            {
              manifest: pkg.manifest,
              data_dictionary: pkg.data_dictionary,
              payload: pkg.payload,
              payload_sha256: pkg.payload_sha256,
            },
            null,
            2,
          ),
          'application/json;charset=utf-8',
        )
      }
      const rawAtt = Array.isArray((pkg.payload as Record<string, unknown>)?.eligible_attachments)
        ? ((pkg.payload as Record<string, unknown>).eligible_attachments as EligibleAttachmentMetadata[])
        : []
      setActiveExportAttachments({ exportId: record.export_id, items: rawAtt })
      setFeedback(`Download autenticado registrado na trilha de auditoria (SHA-256 ${pkg.payload_sha256.slice(0, 12)}…).`)
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível baixar o pacote de exportação.').message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleDownloadAttachmentBinary(exportId: string, att: EligibleAttachmentMetadata) {
    if (busyAction) return
    setBusyAction(`att-${att.id}`)
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      const blob = await downloadPortabilityAttachmentBinary(client, {
        organizationId,
        exportId,
        documentId: att.id,
      })
      triggerBlobDownload(att.original_filename || `anexo-${att.id.slice(0, 8)}`, blob)
      setFeedback(`Arquivo binário "${att.original_filename}" baixado do Storage privado com verificação SHA-256.`)
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível baixar o arquivo binário do anexo.').message)
    } finally {
      setBusyAction('')
    }
  }

  async function executePrivacyRegistration(command: PendingPrivacyRegistration) {
    if (privacySubmitLockRef.current || busyAction !== '') return
    privacySubmitLockRef.current = true
    setBusyAction('req-register')
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')

    try {
      const confirmed = await registerTenantPrivacyRequest(client, {
        organizationId: command.organizationId,
        memberId: command.memberId,
        requestType: command.requestType,
        dataCategory: command.dataCategory,
        verificationMethod: command.verificationMethod,
        requesterVerified: command.requesterVerified,
        legalBasis: command.legalBasis,
        notes: command.notes,
        idempotencyKey: command.idempotencyKey,
      })

      if (activeOrgRef.current !== command.organizationId) return

      setUncertainPrivacyCmd(null)
      setLastConfirmedReq(confirmed)
      setReqNotes('')
      setReqVerified(false)
      setFeedback(
        `Solicitação LGPD ${confirmed.request_id} confirmada em triagem (prazo interno até ${new Date(confirmed.triage_due_at).toLocaleString('pt-BR')}).`,
      )

      const refresh = await loadAll({ preserveActionBanner: true })
      if (!refresh.ok && activeOrgRef.current === command.organizationId) {
        const detail = refresh.requestsError || refresh.summaryError || 'falha ao recarregar os dados.'
        setPostRegisterRefreshWarning(
          `Solicitação ${confirmed.request_id} foi confirmada e salva no servidor, porém a atualização da listagem falhou: ${detail}`,
        )
      }
    } catch (err) {
      if (activeOrgRef.current !== command.organizationId) return
      const classified = classifyPrivacyError(err, 'Não foi possível registrar a solicitação LGPD.')
      setLastConfirmedReq(null)
      if (classified.retryableWithSameKey) {
        setUncertainPrivacyCmd({
          command,
          reason: classified.message,
        })
      } else {
        setUncertainPrivacyCmd(null)
      }
      setError(classified.message)
    } finally {
      privacySubmitLockRef.current = false
      setBusyAction('')
    }
  }

  async function handleRegisterPrivacyRequest(event: FormEvent) {
    event.preventDefault()
    if (privacySubmitLockRef.current || busyAction !== '' || uncertainPrivacyCmd !== null) return
    const command: PendingPrivacyRegistration = {
      idempotencyKey: generateM05IdempotencyKey('priv-req'),
      organizationId,
      memberId: reqMemberId.trim() || null,
      requestType: reqType,
      dataCategory: reqCategory,
      verificationMethod: reqVerMethod,
      requesterVerified: reqVerified,
      legalBasis: reqBasis,
      notes: reqNotes.trim() || 'Solicitação formal registrada pelo painel LGPD.',
    }
    await executePrivacyRegistration(command)
  }

  async function handleReconcilePrivacyRequest() {
    if (!uncertainPrivacyCmd) return
    await executePrivacyRegistration(uncertainPrivacyCmd.command)
  }

  async function handleReviewRequest(req: PrivacyRequestRecord) {
    if (busyAction) return
    const outcome = reviewOutcome[req.request_id] ?? 'retained_by_law'
    const justification = (reviewJustification[req.request_id] ?? '').trim()
    const riskRemains = reviewRisk[req.request_id] ?? true
    setBusyAction(`review-${req.request_id}`)
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      await reviewTenantPrivacyRequest(client, {
        organizationId,
        requestId: req.request_id,
        decisionOutcome: outcome,
        legalBasis: req.legal_basis,
        requesterVerified: req.requester_verified,
        reidentificationRiskRemains: riskRemains,
        controllerJustification: justification,
      })
      setFeedback('Decisão do controlador registrada sem mutação de fatos contábeis imutáveis.')
      await loadAll({ preserveActionBanner: true })
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível concluir a análise do controlador.').message)
    } finally {
      setBusyAction('')
    }
  }

  async function handlePlaceHold(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('hold-place')
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      await placeTenantLegalHold(client, {
        organizationId,
        dataCategory: holdCategory,
        holdReason,
        legalReference: holdRef,
      })
      setHoldReason('')
      setHoldRef('')
      setFeedback('Preservação legal registrada para bloquear qualquer descarte futuro.')
      await loadAll({ preserveActionBanner: true })
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível registrar preservação legal.').message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleReleaseHold(holdId: string) {
    if (busyAction) return
    setBusyAction(`hold-rel-${holdId}`)
    setError('')
    setFeedback('')
    setPostRegisterRefreshWarning('')
    try {
      await releaseTenantLegalHold(client, {
        organizationId,
        holdId,
        releaseReason: 'Encerramento formal autorizado pelo controlador',
      })
      setFeedback('Preservação legal liberada com registro em auditoria.')
      await loadAll({ preserveActionBanner: true })
    } catch (err) {
      setError(classifyPrivacyError(err, 'Não foi possível liberar a preservação legal.').message)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} data-testid="tenant-privacy-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <p className="subtle" style={{ margin: 0 }}>
          Exportação portátil autenticada (JSON/CSV com dicionário e SHA-256), direitos dos titulares e tabela de temporalidade D01–D03.
        </p>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => void loadAll()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Atualizar LGPD
        </button>
      </div>

      {error && (
        <div role="alert" className="message error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div role="status" className="message" style={{ borderLeft: '3px solid var(--gold, #C5A880)' }}>
          {feedback}
          {lastConfirmedReq && (
            <div className="subtle" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Protocolo: <code>{lastConfirmedReq.request_id}</code> · Razão financeira preservada:{' '}
              {lastConfirmedReq.ledger_preserved ? 'Sim' : 'Não'}
            </div>
          )}
        </div>
      )}

      {postRegisterRefreshWarning && (
        <div role="alert" className="message error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} aria-hidden="true" />
          <span>{postRegisterRefreshWarning}</span>
        </div>
      )}

      {/* A. Portabilidade & Exportação (D02) */}
      <div className="panel" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
        <div className="section-title">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} aria-hidden="true" />
            Exportação Integral e Pacote do Titular (Portabilidade LGPD)
          </strong>
          <span className="subtle">Expira em 24h · Somente leitura</span>
        </div>
        <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
          Exportação portátil apenas para leitura e auditoria externa (abrangendo M02, M03, M04 e M05); restauração automática por upload é proibida. Segredos, credenciais, notas internas e chamados internos Master são excluídos. Anexos elegíveis são exportados como inventário de metadados e hashes SHA-256 (sem arquivos binários do Storage embutidos).
        </p>

        <form onSubmit={handleCreateExport} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <div>
            <label htmlFor="m05-export-scope">Escopo da exportação</label>
            <select
              id="m05-export-scope"
              value={exportScope}
              onChange={e => setExportScope(e.target.value as PortabilityScope)}
              disabled={busyAction !== ''}
            >
              <option value="organization_full">Exportação integral da Loja</option>
              <option value="data_subject_package">Pacote individual do titular</option>
            </select>
          </div>
          {exportScope === 'data_subject_package' && (
            <div>
              <label htmlFor="m05-export-member">UUID do integrante titular</label>
              <input
                id="m05-export-member"
                value={exportMemberId}
                onChange={e => setExportMemberId(e.target.value)}
                placeholder="00000000-0000-4000-8000-000000000000"
                required
                disabled={busyAction !== ''}
              />
            </div>
          )}
          <div>
            <label htmlFor="m05-export-format">Formato aberto</label>
            <select
              id="m05-export-format"
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as PortabilityFormat)}
              disabled={busyAction !== ''}
            >
              <option value="json">JSON + Manifesto + Dicionário</option>
              <option value="csv">CSV sanitizado (anti-injeção)</option>
            </select>
          </div>
          <button type="submit" className="primary" disabled={busyAction !== '' || posture?.export_allowed === false}>
            {busyAction === 'export-create' ? 'Gerando pacote…' : 'Gerar pacote portátil'}
          </button>
        </form>

        {(exportsState.status === 'forbidden' ||
          exportsState.status === 'unauthenticated' ||
          exportsState.status === 'error') && (
          <div role="alert" className="message error" style={{ marginTop: '12px' }}>
            {exportsState.message}
          </div>
        )}

        {exportsState.status === 'empty' && (
          <p className="subtle" style={{ marginTop: '12px', fontSize: '0.84rem' }}>
            Nenhum pacote portátil gerado nesta Loja.
          </p>
        )}

        {exportsList.length > 0 && (
          <div style={{ marginTop: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th>Escopo</th>
                  <th>Formato</th>
                  <th>Status</th>
                  <th>Integridade (SHA-256)</th>
                  <th>Expira em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {exportsList.map(exp => (
                  <tr key={exp.export_id}>
                    <td>{exp.export_scope === 'organization_full' ? 'Loja integral' : 'Titular individual'}</td>
                    <td>{exp.package_format.toUpperCase()}</td>
                    <td>{exp.status}</td>
                    <td><code>{exp.payload_sha256.slice(0, 12)}…</code></td>
                    <td>{new Date(exp.expires_at).toLocaleString('pt-BR')}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyAction !== '' || exp.status !== 'ready'}
                        onClick={() => void handleDownloadExport(exp)}
                      >
                        Baixar pacote
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeExportAttachments && activeExportAttachments.items.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-soft, rgba(148,163,184,0.14))' }}>
            <strong style={{ fontSize: '0.86rem' }}>
              Anexos Elegíveis do Pacote ({activeExportAttachments.items.length}) — Download Binário Separado via Storage Privado
            </strong>
            <p className="subtle" style={{ fontSize: '0.8rem', margin: '4px 0 8px' }}>
              O JSON/CSV portátil contém apenas os metadados e hashes SHA-256 (`binary_files_included: false`). Utilize a ação abaixo para baixar o arquivo binário real do Storage privado com conferência SHA-256.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeExportAttachments.items.map(att => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.83rem',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-soft, rgba(148,163,184,0.14))',
                  }}
                >
                  <span>
                    <strong>{att.original_filename}</strong> ({att.mime_type}, {att.size_bytes} bytes)
                    {att.sha256 ? ` · SHA-256 ${att.sha256.slice(0, 12)}…` : ''}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyAction !== ''}
                    onClick={() => void handleDownloadAttachmentBinary(activeExportAttachments.exportId, att)}
                  >
                    Baixar binário do anexo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* B. Privacidade & Direitos dos Titulares (D02 / D03) */}
      <div className="panel" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
        <div className="section-title">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} aria-hidden="true" />
            Direitos dos Titulares, Pseudonimização e Guarda Contábil
          </strong>
          <span className="subtle">Meta de triagem: 2 dias úteis</span>
        </div>
        <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
          Trocar nome por identificador UUID é pseudonimização e não equivale à anonimização enquanto houver reidentificação. Fatos do razão financeiro não são excluídos nem reescritos.
        </p>

        {uncertainPrivacyCmd && (
          <div
            role="alert"
            className="message error"
            data-testid="privacy-reconcile-banner"
            style={{
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <strong>Resultado incerto pendente de reconciliação:</strong> {uncertainPrivacyCmd.reason}{' '}
              <span className="subtle">
                (Chave preservada: <code>{uncertainPrivacyCmd.command.idempotencyKey}</code>)
              </span>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busyAction !== ''}
              onClick={() => void handleReconcilePrivacyRequest()}
            >
              {busyAction === 'req-register' ? 'Reconciliando…' : 'Reconciliar envio'}
            </button>
          </div>
        )}

        <form onSubmit={handleRegisterPrivacyRequest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <div>
            <label htmlFor="m05-req-type">Tipo de direito</label>
            <select
              id="m05-req-type"
              value={reqType}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqType(e.target.value as PrivacyRequestType)}
            >
              <option value="access">Acesso</option>
              <option value="correction">Correção</option>
              <option value="portability">Portabilidade</option>
              <option value="anonymization">Anonimização</option>
              <option value="deletion">Eliminação</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-req-cat">Categoria de dados</label>
            <select
              id="m05-req-cat"
              value={reqCategory}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqCategory(e.target.value as PrivacyDataCategory)}
            >
              {Object.entries(PRIVACY_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="m05-req-ver">Verificação de identidade</label>
            <select
              id="m05-req-ver"
              value={reqVerMethod}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqVerMethod(e.target.value as PrivacyVerificationMethod)}
            >
              <option value="in_person_controller_check">Conferência presencial pelo controlador</option>
              <option value="signed_document_verified">Documento assinado verificado</option>
              <option value="authenticated_member_link">Sessão autenticada do titular</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-req-basis">Base legal</label>
            <select
              id="m05-req-basis"
              value={reqBasis}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqBasis(e.target.value as PrivacyLegalBasis)}
            >
              <option value="exercise_of_rights">Exercício regular de direitos</option>
              <option value="legal_obligation_accounting">Obrigação legal / contábil</option>
              <option value="contract_execution">Execução de contrato</option>
              <option value="legitimate_interest">Interesse legítimo</option>
              <option value="consent">Consentimento</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-req-member">
              UUID do integrante {reqVerMethod === 'authenticated_member_link' ? '(obrigatório)' : '(opcional)'}
            </label>
            <input
              id="m05-req-member"
              value={reqMemberId}
              disabled={isPrivacyFormLocked}
              required={reqVerMethod === 'authenticated_member_link'}
              onChange={e => setReqMemberId(e.target.value)}
              placeholder={reqVerMethod === 'authenticated_member_link' ? 'UUID obrigatório do titular' : 'Opcional'}
            />
          </div>
          <div>
            <label htmlFor="m05-req-notes">Observações sanitizadas</label>
            <input
              id="m05-req-notes"
              value={reqNotes}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqNotes(e.target.value)}
              placeholder="Resumo objetivo do pedido"
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={reqVerified}
              disabled={isPrivacyFormLocked}
              onChange={e => setReqVerified(e.target.checked)}
            />
            Identidade do solicitante validada
          </label>
          <button type="submit" className="secondary" disabled={isPrivacyFormLocked}>
            {busyAction === 'req-register' ? 'Registrando…' : 'Registrar solicitação'}
          </button>
        </form>

        {(requestsState.status === 'forbidden' ||
          requestsState.status === 'unauthenticated' ||
          requestsState.status === 'error') && (
          <div role="alert" className="message error" style={{ marginTop: '14px' }}>
            {requestsState.message}
          </div>
        )}

        {requestsState.status === 'empty' && (
          <p className="subtle" style={{ marginTop: '14px', fontSize: '0.84rem' }}>
            Nenhuma solicitação de titular registrada nesta Loja.
          </p>
        )}

        {requestsList.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requestsList.map(req => (
              <div key={req.request_id} style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border-soft, rgba(148,163,184,0.16))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <strong>{req.request_type.toUpperCase()} · {PRIVACY_CATEGORY_LABELS[req.data_category] ?? req.data_category}</strong>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>
                    Triagem até: {new Date(req.triage_due_at).toLocaleString('pt-BR')} · {PRIVACY_OUTCOME_LABELS[req.decision_outcome]}
                  </span>
                </div>
                <div className="subtle" style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  Verificação: {req.requester_verified ? 'Confirmada' : 'Pendente'} · Razão financeira preservada: {req.ledger_preserved ? 'Sim' : 'Não'}
                </div>

                {req.decision_outcome === 'pending_triage' && (
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <label htmlFor={`rev-out-${req.request_id}`}>Decisão do controlador</label>
                      <select
                        id={`rev-out-${req.request_id}`}
                        value={reviewOutcome[req.request_id] ?? 'retained_by_law'}
                        onChange={e => setReviewOutcome(prev => ({
                          ...prev,
                          [req.request_id]: e.target.value as Exclude<PrivacyDecisionOutcome, 'pending_triage'>,
                        }))}
                      >
                        <option value="retained_by_law">Retida por obrigação legal</option>
                        <option value="pseudonymized">Pseudonimizada (reidentificável)</option>
                        <option value="anonymized_verified">Anonimizada (sem risco residual)</option>
                        <option value="fulfilled">Atendida</option>
                        <option value="rejected_unverified">Bloqueada sem verificação</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`rev-just-${req.request_id}`}>Justificativa do controlador</label>
                      <input
                        id={`rev-just-${req.request_id}`}
                        value={reviewJustification[req.request_id] ?? ''}
                        onChange={e => setReviewJustification(prev => ({ ...prev, [req.request_id]: e.target.value }))}
                        placeholder="Mín. 10 caracteres"
                      />
                    </div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                      <input
                        type="checkbox"
                        checked={reviewRisk[req.request_id] ?? true}
                        onChange={e => setReviewRisk(prev => ({ ...prev, [req.request_id]: e.target.checked }))}
                      />
                      Há risco de reidentificação
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyAction !== ''}
                      onClick={() => void handleReviewRequest(req)}
                    >
                      Decidir solicitação
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C. Temporalidade, Janela Pós-Cancelamento e Preservação Legal (D01 / D03) */}
      <div className="panel" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
        <div className="section-title">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} aria-hidden="true" />
            Temporalidade, Encerramento Contratual e Preservação Legal
          </strong>
          <span className="subtle">Eliminação automática desativada</span>
        </div>

        {(postureState.status === 'forbidden' ||
          postureState.status === 'unauthenticated' ||
          postureState.status === 'error') && (
          <div role="alert" className="message error" style={{ marginBottom: '12px' }}>
            {postureState.message}
          </div>
        )}

        {posture && (
          <div style={{ marginBottom: '12px', fontSize: '0.88rem' }}>
            <div>
              <strong>Postura atual:</strong> {RETENTION_PHASE_LABELS[posture.retention_phase] ?? posture.retention_phase}
              {posture.export_window_ends_at && (
                <span> · Janela de exportação até {new Date(posture.export_window_ends_at).toLocaleDateString('pt-BR')}</span>
              )}
            </div>
            <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
              {(posture.schedule ?? []).map(item => (
                <li key={item.category}>
                  <strong>{item.retention_label}:</strong> {item.legal_note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handlePlaceHold} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <div>
            <label htmlFor="m05-hold-cat">Categoria sob preservação legal</label>
            <select id="m05-hold-cat" value={holdCategory} onChange={e => setHoldCategory(e.target.value as RetentionCategory)}>
              <option value="financial_ledger">Fatos financeiros e contábeis</option>
              <option value="access_logs">Logs de acesso</option>
              <option value="operational_logs">Logs operacionais</option>
              <option value="cadastral">Cadastros</option>
              <option value="attachments">Anexos</option>
              <option value="all">Todo o acervo da Loja</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-hold-ref">Referência legal / parecer</label>
            <input id="m05-hold-ref" value={holdRef} onChange={e => setHoldRef(e.target.value)} placeholder="Ex.: Parecer Contábil 2026" required />
          </div>
          <div>
            <label htmlFor="m05-hold-reason">Motivo da preservação</label>
            <input id="m05-hold-reason" value={holdReason} onChange={e => setHoldReason(e.target.value)} placeholder="Mín. 5 caracteres" required />
          </div>
          <button type="submit" className="secondary" disabled={busyAction !== ''}>
            Aplicar preservação legal
          </button>
        </form>

        {posture && Array.isArray(posture.holds) && posture.holds.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {posture.holds.map(hold => (
              <div key={hold.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span>
                  <strong>{hold.data_category}</strong> · {hold.legal_reference} — {hold.hold_reason} ({hold.hold_status})
                </span>
                {hold.hold_status === 'active' && (
                  <button type="button" className="secondary" disabled={busyAction !== ''} onClick={() => void handleReleaseHold(hold.id)}>
                    Liberar preservação
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-soft, rgba(148,163,184,0.12))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} aria-hidden="true" />
              Restauração de Snapshot / Backup Pontual
            </strong>
            <p className="subtle" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
              Restauração seletiva e ensaios em base descartável com aprovação e auditoria Master AAL2.
            </p>
          </div>
          <span className="subtle" style={{ fontWeight: 600 }}>Operação restrita Master AAL2</span>
        </div>
      </div>
    </div>
  )
}
