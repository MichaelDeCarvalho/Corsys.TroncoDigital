import type { SupabaseClient } from '@supabase/supabase-js'
import { assertM05Uuid, generateM05IdempotencyKey } from './privacy-portability'

const SENSITIVE_PATTERN = /(password|senha|token|secret|jwt|otp|bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]+\.|sb_secret_)/i
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/

export function assertNoSecretOrPii(text: string, fieldLabel: string): string {
  const trimmed = text.trim()
  if (SENSITIVE_PATTERN.test(trimmed)) {
    throw new Error(`${fieldLabel} não pode conter senhas, OTPs, tokens ou segredos.`)
  }
  if (CPF_PATTERN.test(trimmed)) {
    throw new Error(`${fieldLabel} não pode conter CPF ou dado identificável sensível.`)
  }
  return trimmed
}

export interface OperationalSecurityOverview {
  operational_owner: string
  probe_interval_target_minutes: number
  continuous_monitoring_active: boolean
  external_legal_notice_automated: boolean
  failed_jobs_24h: number
  open_incidents: number
  critical_incidents: number
  overdue_24h_notifications: number
  pending_recovery_reviews: number
  revoked_compromised_accounts: number
  latest_backup_verification: {
    trial_scope?: string
    verification_status: 'target_unproven' | 'verified_disposable' | 'failed' | string
    backup_rotation_days: number
    rpo_target_hours: number
    rto_target_hours: number
    verified_at?: string
  }
  latest_health_probe: {
    status: 'healthy' | 'degraded' | 'unconfigured' | string
    continuous_monitoring_active: boolean
    probe_interval_target_minutes: number
    error_code?: string | null
    checked_at?: string
  }
}

export interface BackupRestoreVerificationRow {
  id: string
  trial_scope: 'disposable_full_restore' | 'disposable_selective_tenant_restore' | 'storage_inventory_check'
  target_env_label: string
  source_label: string
  rpo_target_hours: number
  rto_target_hours: number
  observed_rpo_hours: number | null
  observed_rto_minutes: number | null
  backup_rotation_days: number
  selective_tenant_isolation_passed: boolean
  deleted_data_reintroduction_blocked: boolean
  verification_status: 'target_unproven' | 'verified_disposable' | 'failed'
  evidence_summary: string
  verified_at: string
}

export interface AccessRecoveryRequestRow {
  id: string
  organization_id: string | null
  target_user_id: string
  account_tier: 'tenant_admin' | 'platform_master' | 'platform_support' | 'tenant_member'
  recovery_kind: 'mfa_reset_review' | 'privileged_recovery' | 'compromised_revocation'
  status: 'pending_dual_evidence' | 'approved_awaiting_owner_mfa' | 'revoked_access' | 'rejected'
  evidence_primary_type: string
  evidence_primary_ref: string
  evidence_secondary_type: string | null
  evidence_secondary_ref: string | null
  requires_owner_mfa_reenroll: boolean
  notes: string
  created_at: string
}

export interface OperationalIncidentRow {
  id: string
  organization_id: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'availability' | 'auth_authz' | 'job_failure' | 'backup_restore' | 'privacy_security'
  status: 'open' | 'investigating' | 'mitigated' | 'closed'
  title: string
  sanitized_summary: string
  operational_owner: string
  escalation_level: 'L1_ops' | 'L2_engineering' | 'L3_controller_legal'
  tenant_notification_due_at: string
  tenant_notified_at: string | null
  retention_years: number
  detected_at: string
}

export async function readMasterOperationalSecurityOverview(
  client: SupabaseClient,
): Promise<OperationalSecurityOverview | null> {
  const { data, error } = await client.rpc('read_master_operational_security_overview')
  if (error) throw error
  if (!data || typeof data !== 'object' || !(data as OperationalSecurityOverview).latest_backup_verification) {
    return null
  }
  return data as OperationalSecurityOverview
}

export async function listBackupRestoreVerifications(
  client: SupabaseClient,
  limit = 25,
): Promise<BackupRestoreVerificationRow[]> {
  const { data, error } = await client.rpc('list_backup_restore_verifications', { p_limit: limit })
  if (error) throw error
  return Array.isArray(data) ? (data as BackupRestoreVerificationRow[]) : []
}

export async function recordBackupRestoreVerification(
  client: SupabaseClient,
  params: {
    trialScope: BackupRestoreVerificationRow['trial_scope']
    targetEnvLabel: string
    sourceLabel: string
    observedRpoHours: number | null
    observedRtoMinutes: number | null
    backupRotationDays: number
    selectiveTenantIsolationPassed: boolean
    deletedDataReintroductionBlocked: boolean
    verificationStatus: BackupRestoreVerificationRow['verification_status']
    evidenceSummary: string
    idempotencyKey?: string
  },
) {
  const cleanSummary = assertNoSecretOrPii(params.evidenceSummary, 'Resumo de evidência')
  if (/(prod|szqkdekwhzxsoxorgvaz|live)/i.test(params.targetEnvLabel)) {
    throw new Error('Alvo de verificação deve ser estritamente descartável (nunca PROD ou DEV).')
  }
  const { data, error } = await client.rpc('record_backup_restore_verification_idempotent', {
    p_trial_scope: params.trialScope,
    p_target_env_label: params.targetEnvLabel.trim(),
    p_source_label: params.sourceLabel.trim(),
    p_observed_rpo_hours: params.observedRpoHours,
    p_observed_rto_minutes: params.observedRtoMinutes,
    p_backup_rotation_days: params.backupRotationDays,
    p_selective_tenant_isolation_passed: params.selectiveTenantIsolationPassed,
    p_deleted_data_reintroduction_blocked: params.deletedDataReintroductionBlocked,
    p_verification_status: params.verificationStatus,
    p_evidence_summary: cleanSummary,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('bkp-ver'),
  })
  if (error) throw error
  return data
}

export async function listAccessRecoveryRequests(
  client: SupabaseClient,
  limit = 30,
): Promise<AccessRecoveryRequestRow[]> {
  const { data, error } = await client.rpc('list_access_recovery_requests', { p_limit: limit })
  if (error) throw error
  return Array.isArray(data) ? (data as AccessRecoveryRequestRow[]) : []
}

export async function registerPrivilegedRecoveryDecision(
  client: SupabaseClient,
  params: {
    organizationId?: string | null
    targetUserId: string
    accountTier: AccessRecoveryRequestRow['account_tier']
    recoveryKind: AccessRecoveryRequestRow['recovery_kind']
    decision: 'pending_dual_evidence' | 'approved_awaiting_owner_mfa' | 'rejected'
    evidencePrimaryType: string
    evidencePrimaryRef: string
    evidenceSecondaryType?: string | null
    evidenceSecondaryRef?: string | null
    verifiedBySecondary?: string | null
    notes: string
    idempotencyKey?: string
  },
) {
  const orgId = params.organizationId && params.organizationId.trim() ? assertM05Uuid(params.organizationId, 'Organização') : null
  const targetUserId = assertM05Uuid(params.targetUserId, 'Usuário alvo')
  const secondaryUserId = params.verifiedBySecondary && params.verifiedBySecondary.trim()
    ? assertM05Uuid(params.verifiedBySecondary, 'Segundo validador')
    : null
  const cleanNotes = assertNoSecretOrPii(params.notes, 'Justificativa')
  const cleanRef1 = assertNoSecretOrPii(params.evidencePrimaryRef, 'Referência primária')
  const cleanRef2 = params.evidenceSecondaryRef ? assertNoSecretOrPii(params.evidenceSecondaryRef, 'Referência secundária') : null

  const { data, error } = await client.rpc('register_privileged_recovery_decision_idempotent', {
    p_organization_id: orgId,
    p_target_user_id: targetUserId,
    p_account_tier: params.accountTier,
    p_recovery_kind: params.recoveryKind,
    p_decision: params.decision,
    p_evidence_primary_type: params.evidencePrimaryType.trim(),
    p_evidence_primary_ref: cleanRef1,
    p_evidence_secondary_type: params.evidenceSecondaryType?.trim() || null,
    p_evidence_secondary_ref: cleanRef2,
    p_verified_by_secondary: secondaryUserId,
    p_notes: cleanNotes,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('rec-dec'),
  })
  if (error) throw error
  return data
}

export async function revokeCompromisedTenantAccess(
  client: SupabaseClient,
  params: {
    organizationId: string
    targetUserId: string
    reason: string
    idempotencyKey?: string
  },
) {
  const orgId = assertM05Uuid(params.organizationId, 'Organização')
  const userId = assertM05Uuid(params.targetUserId, 'Usuário comprometido')
  const cleanReason = assertNoSecretOrPii(params.reason, 'Motivo da revogação')
  const { data, error } = await client.rpc('revoke_compromised_tenant_access_idempotent', {
    p_organization_id: orgId,
    p_target_user_id: userId,
    p_reason: cleanReason,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('revoke'),
  })
  if (error) throw error
  return data
}

export async function listOperationalIncidents(
  client: SupabaseClient,
  limit = 30,
): Promise<OperationalIncidentRow[]> {
  const { data, error } = await client.rpc('list_operational_incidents', { p_limit: limit })
  if (error) throw error
  return Array.isArray(data) ? (data as OperationalIncidentRow[]) : []
}

export async function recordOperationalIncident(
  client: SupabaseClient,
  params: {
    organizationId?: string | null
    severity: OperationalIncidentRow['severity']
    category: OperationalIncidentRow['category']
    title: string
    sanitizedSummary: string
    escalationLevel: OperationalIncidentRow['escalation_level']
    idempotencyKey?: string
  },
) {
  const orgId = params.organizationId && params.organizationId.trim() ? assertM05Uuid(params.organizationId, 'Organização') : null
  const cleanTitle = assertNoSecretOrPii(params.title, 'Título do incidente')
  const cleanSummary = assertNoSecretOrPii(params.sanitizedSummary, 'Resumo técnico sanitizado')
  const { data, error } = await client.rpc('record_operational_incident_idempotent', {
    p_organization_id: orgId,
    p_severity: params.severity,
    p_category: params.category,
    p_title: cleanTitle,
    p_sanitized_summary: cleanSummary,
    p_escalation_level: params.escalationLevel,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('inc'),
  })
  if (error) throw error
  return data
}

export async function updateOperationalIncidentStatus(
  client: SupabaseClient,
  params: {
    incidentId: string
    nextStatus: OperationalIncidentRow['status']
    markTenantNotified: boolean
    idempotencyKey?: string
  },
) {
  const incidentId = assertM05Uuid(params.incidentId, 'Incidente')
  const { data, error } = await client.rpc('update_operational_incident_status_idempotent', {
    p_incident_id: incidentId,
    p_next_status: params.nextStatus,
    p_mark_tenant_notified: params.markTenantNotified,
    p_idempotency_key: params.idempotencyKey ?? generateM05IdempotencyKey('inc-upd'),
  })
  if (error) throw error
  return data
}
