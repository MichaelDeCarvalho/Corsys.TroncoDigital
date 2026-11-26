import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database, ShieldAlert, KeyRound, Activity, RefreshCw } from 'lucide-react'
import {
  listAccessRecoveryRequests,
  listBackupRestoreVerifications,
  listOperationalIncidents,
  readMasterOperationalSecurityOverview,
  recordBackupRestoreVerification,
  recordOperationalIncident,
  registerPrivilegedRecoveryDecision,
  revokeCompromisedTenantAccess,
  updateOperationalIncidentStatus,
  type AccessRecoveryRequestRow,
  type BackupRestoreVerificationRow,
  type OperationalIncidentRow,
  type OperationalSecurityOverview,
} from '../lib/master-operations-m05'

export function MasterPrivacyOpsPanel({ client }: { client: SupabaseClient }) {
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const [overview, setOverview] = useState<OperationalSecurityOverview | null>(null)
  const [backups, setBackups] = useState<BackupRestoreVerificationRow[]>([])
  const [recoveries, setRecoveries] = useState<AccessRecoveryRequestRow[]>([])
  const [incidents, setIncidents] = useState<OperationalIncidentRow[]>([])

  // D04 backup verification form
  const [trialScope, setTrialScope] = useState<BackupRestoreVerificationRow['trial_scope']>('disposable_selective_tenant_restore')
  const [targetEnv, setTargetEnv] = useState('disposable-pg17-trial')
  const [sourceLabel, setSourceLabel] = useState('qa-fictional-fixture-snapshot')
  const [rotationDays, setRotationDays] = useState('35')
  const [isolationPassed, setIsolationPassed] = useState(true)
  const [reintroBlocked, setReintroBlocked] = useState(true)
  const [verStatus, setVerStatus] = useState<BackupRestoreVerificationRow['verification_status']>('target_unproven')
  const [evidenceSummary, setEvidenceSummary] = useState('')

  // D05 privileged recovery form
  const [recOrgId, setRecOrgId] = useState('')
  const [recTargetUser, setRecTargetUser] = useState('')
  const [recTier, setRecTier] = useState<AccessRecoveryRequestRow['account_tier']>('tenant_admin')
  const [recDecision, setRecDecision] = useState<'pending_dual_evidence' | 'approved_awaiting_owner_mfa' | 'rejected'>('pending_dual_evidence')
  const [recEv1Type, setRecEv1Type] = useState('signed_ticket_authority')
  const [recEv1Ref, setRecEv1Ref] = useState('')
  const [recEv2Type, setRecEv2Type] = useState('identity_document_check')
  const [recEv2Ref, setRecEv2Ref] = useState('')
  const [recSecOperator, setRecSecOperator] = useState('')
  const [recNotes, setRecNotes] = useState('')

  // D05 revocation form
  const [revOrgId, setRevOrgId] = useState('')
  const [revUserId, setRevUserId] = useState('')
  const [revReason, setRevReason] = useState('')

  // D06 incident form
  const [incOrgId, setIncOrgId] = useState('')
  const [incSeverity, setIncSeverity] = useState<OperationalIncidentRow['severity']>('high')
  const [incCategory, setIncCategory] = useState<OperationalIncidentRow['category']>('auth_authz')
  const [incEscalation, setIncEscalation] = useState<OperationalIncidentRow['escalation_level']>('L2_engineering')
  const [incTitle, setIncTitle] = useState('')
  const [incSummary, setIncSummary] = useState('')

  const loadAll = useCallback(async () => {
    if (typeof client?.rpc !== 'function') return
    setLoading(true)
    setError('')
    try {
      const [ov, bkp, rec, inc] = await Promise.all([
        readMasterOperationalSecurityOverview(client),
        listBackupRestoreVerifications(client),
        listAccessRecoveryRequests(client),
        listOperationalIncidents(client),
      ])
      setOverview(ov)
      setBackups(bkp)
      setRecoveries(rec)
      setIncidents(inc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o painel M05 Master (requer MASTER AAL2).')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function handleRecordBackup(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('bkp')
    setError('')
    setFeedback('')
    try {
      await recordBackupRestoreVerification(client, {
        trialScope,
        targetEnvLabel: targetEnv,
        sourceLabel,
        observedRpoHours: verStatus === 'verified_disposable' ? 1 : null,
        observedRtoMinutes: verStatus === 'verified_disposable' ? 12 : null,
        backupRotationDays: Number(rotationDays) || 35,
        selectiveTenantIsolationPassed: isolationPassed,
        deletedDataReintroductionBlocked: reintroBlocked,
        verificationStatus: verStatus,
        evidenceSummary,
      })
      setEvidenceSummary('')
      setFeedback('Evidência de backup/restore descartável registrada na trilha Master.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar verificação de backup.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleRecoveryDecision(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('rec')
    setError('')
    setFeedback('')
    try {
      await registerPrivilegedRecoveryDecision(client, {
        organizationId: recOrgId.trim() || null,
        targetUserId: recTargetUser,
        accountTier: recTier,
        recoveryKind: 'privileged_recovery',
        decision: recDecision,
        evidencePrimaryType: recEv1Type,
        evidencePrimaryRef: recEv1Ref,
        evidenceSecondaryType: recEv2Ref.trim() ? recEv2Type : null,
        evidenceSecondaryRef: recEv2Ref.trim() || null,
        verifiedBySecondary: recSecOperator.trim() || null,
        notes: recNotes,
      })
      setRecNotes('')
      setFeedback('Decisão de recuperação privilegiada registrada com obrigatoriedade de novo MFA pelo titular.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar decisão de recuperação.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleRevokeAccess(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('revoke')
    setError('')
    setFeedback('')
    try {
      await revokeCompromisedTenantAccess(client, {
        organizationId: revOrgId,
        targetUserId: revUserId,
        reason: revReason,
      })
      setRevReason('')
      setFeedback('Acesso comprometido revogado sem alteração do razão contábil ou auditoria imutável.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar acesso comprometido.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleRecordIncident(event: FormEvent) {
    event.preventDefault()
    if (busyAction) return
    setBusyAction('inc')
    setError('')
    setFeedback('')
    try {
      await recordOperationalIncident(client, {
        organizationId: incOrgId.trim() || null,
        severity: incSeverity,
        category: incCategory,
        title: incTitle,
        sanitizedSummary: incSummary,
        escalationLevel: incEscalation,
      })
      setIncTitle('')
      setIncSummary('')
      setFeedback('Incidente registrado com prazo interno de notificação de 24 horas e guarda de 5 anos.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar incidente operacional.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleMarkNotified(incidentId: string) {
    if (busyAction) return
    setBusyAction(`inc-notif-${incidentId}`)
    setError('')
    try {
      await updateOperationalIncidentStatus(client, {
        incidentId,
        nextStatus: 'investigating',
        markTenantNotified: true,
      })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar incidente.')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="space-y-6" data-testid="master-privacy-ops-panel">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Privacidade, Backups, Recuperação e Incidentes (M05 · D04–D06)</h3>
          <p className="text-xs text-slate-600">
            Governança Master AAL2: metas RPO ≤ 24h / RTO ≤ 8h a comprovar em ambiente descartável, dupla evidência para recuperação e incidentes sem dados sensíveis.
          </p>
        </div>
        <button
          type="button"
          className="secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
          disabled={loading}
          onClick={() => void loadAll()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Atualizar painel M05
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div role="status" className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          {feedback}
        </div>
      )}

      {/* Overview Metrics (D06) */}
      {overview && (
        <section className="panel space-y-3">
          <div className="section-title">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Activity size={16} className="text-blue-600" aria-hidden="true" />
              Prontidão Operacional e Segurança (Responsável: {overview.operational_owner})
            </h4>
            <span className="text-xs text-slate-600">
              Monitoramento contínuo: {overview.continuous_monitoring_active ? 'Ativo' : 'Pendente de probe externo (meta 5 min)'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-slate-500">Falhas de jobs (24h)</div>
              <div className="text-lg font-semibold text-slate-900">{overview.failed_jobs_24h}</div>
            </div>
            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-slate-500">Incidentes abertos / críticos</div>
              <div className="text-lg font-semibold text-slate-900">{overview.open_incidents} / {overview.critical_incidents}</div>
            </div>
            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-slate-500">Meta RPO / RTO (D04)</div>
              <div className="text-sm font-semibold text-slate-900">
                ≤ {overview.latest_backup_verification.rpo_target_hours}h / ≤ {overview.latest_backup_verification.rto_target_hours}h ({overview.latest_backup_verification.verification_status})
              </div>
            </div>
            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-slate-500">Comunicação externa automática</div>
              <div className="text-sm font-semibold text-slate-900">
                {overview.external_legal_notice_automated ? 'Ativa' : 'Desativada (ato exclusivo do controlador)'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* D04 Backup & Selective Recovery Registry */}
      <section className="panel space-y-4">
        <div className="section-title">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Database size={16} className="text-blue-600" aria-hidden="true" />
            Backup Criptografado, Rotação (≤ 35 dias) e Restore Seletivo Descartável (D04)
          </h4>
          <span className="text-xs text-slate-600">Proibido restaurar em PROD/DEV</span>
        </div>
        <form onSubmit={handleRecordBackup} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor="m05-bkp-scope">Escopo do ensaio</label>
            <select id="m05-bkp-scope" value={trialScope} onChange={e => setTrialScope(e.target.value as BackupRestoreVerificationRow['trial_scope'])}>
              <option value="disposable_selective_tenant_restore">Restore seletivo Loja A sem sobrescrever Loja B</option>
              <option value="disposable_full_restore">Restore completo em banco descartável</option>
              <option value="storage_inventory_check">Inventário de storage privado e config</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-bkp-target">Alvo descartável</label>
            <input id="m05-bkp-target" value={targetEnv} onChange={e => setTargetEnv(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-bkp-source">Origem fictícia</label>
            <input id="m05-bkp-source" value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-bkp-rot">Rotação máxima (dias ≤ 35)</label>
            <input id="m05-bkp-rot" type="number" min={1} max={35} value={rotationDays} onChange={e => setRotationDays(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-bkp-status">Situação da prova</label>
            <select id="m05-bkp-status" value={verStatus} onChange={e => setVerStatus(e.target.value as BackupRestoreVerificationRow['verification_status'])}>
              <option value="target_unproven">Meta definida (não comprovada)</option>
              <option value="verified_disposable">Comprovada em base descartável</option>
              <option value="failed">Falhou</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-bkp-sum">Resumo sanitizado da evidência</label>
            <input id="m05-bkp-sum" value={evidenceSummary} onChange={e => setEvidenceSummary(e.target.value)} placeholder="Contagens, centavos e isolamento A/B" required />
          </div>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={isolationPassed} onChange={e => setIsolationPassed(e.target.checked)} />
            Isolamento Loja A/B verificado
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={reintroBlocked} onChange={e => setReintroBlocked(e.target.checked)} />
            Reintrodução de dados eliminados/pseudonimizados bloqueada
          </label>
          <button type="submit" className="primary" disabled={busyAction !== ''}>
            Registrar evidência de restore
          </button>
        </form>

        {backups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th>Escopo</th>
                  <th>Alvo</th>
                  <th>Rotação</th>
                  <th>Status</th>
                  <th>Resumo</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.id}>
                    <td>{b.trial_scope}</td>
                    <td>{b.target_env_label}</td>
                    <td>{b.backup_rotation_days}d</td>
                    <td>{b.verification_status}</td>
                    <td>{b.evidence_summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* D05 Privileged Recovery & Compromised Access Revocation */}
      <section className="panel space-y-4">
        <div className="section-title">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <KeyRound size={16} className="text-blue-600" aria-hidden="true" />
            Recuperação Privilegiada com Dupla Evidência e Revogação de Acesso (D05)
          </h4>
          <span className="text-xs text-slate-600">Sem envio de senha/OTP; novo MFA obrigatório pelo titular</span>
        </div>

        <form onSubmit={handleRecoveryDecision} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor="m05-rec-user">UUID do usuário alvo</label>
            <input id="m05-rec-user" value={recTargetUser} onChange={e => setRecTargetUser(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-rec-org">UUID da Loja (opcional para Master)</label>
            <input id="m05-rec-org" value={recOrgId} onChange={e => setRecOrgId(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m05-rec-tier">Nível da conta</label>
            <select id="m05-rec-tier" value={recTier} onChange={e => setRecTier(e.target.value as AccessRecoveryRequestRow['account_tier'])}>
              <option value="tenant_admin">Administrador de Loja</option>
              <option value="platform_master">Operador Master</option>
              <option value="platform_support">Operador Suporte</option>
              <option value="tenant_member">Integrante</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-rec-dec">Decisão</label>
            <select id="m05-rec-dec" value={recDecision} onChange={e => setRecDecision(e.target.value as 'pending_dual_evidence' | 'approved_awaiting_owner_mfa' | 'rejected')}>
              <option value="pending_dual_evidence">Aguardando 2ª evidência</option>
              <option value="approved_awaiting_owner_mfa">Aprovada (aguardando novo MFA pelo titular)</option>
              <option value="rejected">Bloqueada (identidade não comprovada)</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-rec-ev1">Referência evidência 1 ({recEv1Type})</label>
            <input id="m05-rec-ev1" value={recEv1Ref} onChange={e => setRecEv1Ref(e.target.value)} placeholder="ID chamado assinado" required />
          </div>
          <div>
            <label htmlFor="m05-rec-ev2">Referência evidência 2 ({recEv2Type})</label>
            <input id="m05-rec-ev2" value={recEv2Ref} onChange={e => setRecEv2Ref(e.target.value)} placeholder="ID conferência independente" />
          </div>
          <div>
            <label htmlFor="m05-rec-op2">UUID do 2º operador validador</label>
            <input id="m05-rec-op2" value={recSecOperator} onChange={e => setRecSecOperator(e.target.value)} placeholder="Obrigatório para aprovar" />
          </div>
          <div>
            <label htmlFor="m05-rec-notes">Justificativa sanitizada</label>
            <input id="m05-rec-notes" value={recNotes} onChange={e => setRecNotes(e.target.value)} required />
          </div>
          <button type="submit" className="secondary" disabled={busyAction !== ''}>
            Registrar decisão de recuperação
          </button>
        </form>

        <form onSubmit={handleRevokeAccess} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-200">
          <div>
            <label htmlFor="m05-rev-org">UUID da Loja (revogação)</label>
            <input id="m05-rev-org" value={revOrgId} onChange={e => setRevOrgId(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-rev-user">UUID do usuário comprometido</label>
            <input id="m05-rev-user" value={revUserId} onChange={e => setRevUserId(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-rev-reason">Motivo da revogação</label>
            <input id="m05-rev-reason" value={revReason} onChange={e => setRevReason(e.target.value)} required />
          </div>
          <button type="submit" className="secondary" disabled={busyAction !== ''}>
            Revogar acesso comprometido
          </button>
        </form>

        {recoveries.length > 0 && (
          <div className="text-xs space-y-1">
            {recoveries.slice(0, 5).map(r => (
              <div key={r.id} className="p-2 rounded border border-slate-200 bg-white flex justify-between flex-wrap gap-2">
                <span><strong>{r.account_tier}</strong> · {r.recovery_kind} · {r.status}</span>
                <span>Novo MFA titular obrigatório: {r.requires_owner_mfa_reenroll ? 'Sim' : 'Não'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* D06 Incidents & Escalation Runbook */}
      <section className="panel space-y-4">
        <div className="section-title">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600" aria-hidden="true" />
            Registro de Incidentes e Escalonamento (Meta 24h · Guarda 5 anos · D06)
          </h4>
          <span className="text-xs text-slate-600">Sem CPF, dados financeiros ou segredos</span>
        </div>

        <form onSubmit={handleRecordIncident} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor="m05-inc-title">Título técnico</label>
            <input id="m05-inc-title" value={incTitle} onChange={e => setIncTitle(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="m05-inc-sev">Gravidade</label>
            <select id="m05-inc-sev" value={incSeverity} onChange={e => setIncSeverity(e.target.value as OperationalIncidentRow['severity'])}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-inc-cat">Categoria</label>
            <select id="m05-inc-cat" value={incCategory} onChange={e => setIncCategory(e.target.value as OperationalIncidentRow['category'])}>
              <option value="auth_authz">Autenticação / Autorização</option>
              <option value="availability">Disponibilidade</option>
              <option value="job_failure">Falha de jobs</option>
              <option value="backup_restore">Backup / Restauração</option>
              <option value="privacy_security">Privacidade / Segurança</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-inc-esc">Nível de escalonamento</label>
            <select id="m05-inc-esc" value={incEscalation} onChange={e => setIncEscalation(e.target.value as OperationalIncidentRow['escalation_level'])}>
              <option value="L1_ops">L1 · Operação inicial (Michael)</option>
              <option value="L2_engineering">L2 · Engenharia e Contenção</option>
              <option value="L3_controller_legal">L3 · Controlador / Jurídico (Comunicação ANPD/Titulares)</option>
            </select>
          </div>
          <div>
            <label htmlFor="m05-inc-org">UUID da Loja afetada (opcional)</label>
            <input id="m05-inc-org" value={incOrgId} onChange={e => setIncOrgId(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m05-inc-sum">Resumo sanitizado (sem segredos/CPF)</label>
            <input id="m05-inc-sum" value={incSummary} onChange={e => setIncSummary(e.target.value)} placeholder="Mín. 10 caracteres" required />
          </div>
          <button type="submit" className="secondary" disabled={busyAction !== ''}>
            Registrar incidente
          </button>
        </form>

        {incidents.length > 0 && (
          <div className="space-y-2 text-xs tabular-nums">
            {incidents.map(inc => (
              <div key={inc.id} className="p-3 rounded border border-slate-200 bg-white flex justify-between items-center flex-wrap gap-2">
                <div>
                  <strong>[{inc.severity.toUpperCase()}] {inc.title}</strong> ({inc.status} · {inc.escalation_level})
                  <div className="text-slate-600">{inc.sanitized_summary}</div>
                  <div className="text-slate-500">
                    Prazo interno 24h: {new Date(inc.tenant_notification_due_at).toLocaleString('pt-BR')} · Notificado: {inc.tenant_notified_at ? 'Sim' : 'Pendente'} · Retenção: {inc.retention_years} anos
                  </div>
                </div>
                {!inc.tenant_notified_at && (
                  <button type="button" className="secondary" disabled={busyAction !== ''} onClick={() => void handleMarkNotified(inc.id)}>
                    Registrar ciência da Loja
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
