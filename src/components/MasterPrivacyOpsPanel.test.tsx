import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MasterPrivacyOpsPanel } from './MasterPrivacyOpsPanel'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const OP2_ID = '33333333-3333-4333-8333-333333333333'

describe('MasterPrivacyOpsPanel (M05 Entregas D-F)', () => {
  let rpcMock: ReturnType<typeof vi.fn>
  let client: SupabaseClient

  beforeEach(() => {
    rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'read_master_operational_security_overview') {
        return {
          data: {
            operational_owner: 'Michael',
            probe_interval_target_minutes: 5,
            continuous_monitoring_active: false,
            external_legal_notice_automated: false,
            failed_jobs_24h: 1,
            open_incidents: 1,
            critical_incidents: 0,
            overdue_24h_notifications: 0,
            pending_recovery_reviews: 1,
            revoked_compromised_accounts: 0,
            latest_backup_verification: {
              verification_status: 'target_unproven',
              backup_rotation_days: 35,
              rpo_target_hours: 24,
              rto_target_hours: 8,
            },
            latest_health_probe: {
              status: 'unconfigured',
              continuous_monitoring_active: false,
              probe_interval_target_minutes: 5,
            },
          },
          error: null,
        }
      }
      if (fn === 'list_backup_restore_verifications') return { data: [], error: null }
      if (fn === 'list_access_recovery_requests') return { data: [], error: null }
      if (fn === 'list_operational_incidents') return { data: [], error: null }
      return { data: { ok: true }, error: null }
    })
    client = { rpc: rpcMock } as unknown as SupabaseClient
  })

  it('displays honest readiness disclaimers (target_unproven, monitoring pending, no auto legal notice)', async () => {
    render(<MasterPrivacyOpsPanel client={client} />)

    expect(await screen.findByText(/Responsável: Michael/)).toBeInTheDocument()
    expect(screen.getByText(/Pendente de probe externo/i)).toBeInTheDocument()
    expect(screen.getByText(/target_unproven/)).toBeInTheDocument()
    expect(screen.getByText(/ato exclusivo do controlador/i)).toBeInTheDocument()
  })

  it('blocks secret leakage in incident summary on the client before calling RPC', async () => {
    render(<MasterPrivacyOpsPanel client={client} />)

    await screen.findByText(/Responsável: Michael/)
    fireEvent.change(screen.getByLabelText('Título técnico'), { target: { value: 'Falha gateway' } })
    fireEvent.change(screen.getByLabelText('Resumo sanitizado (sem segredos/CPF)'), {
      target: { value: 'Erro ao validar password=segredo no teste' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar incidente' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não pode conter senhas/i)
    expect(rpcMock).not.toHaveBeenCalledWith('record_operational_incident_idempotent', expect.anything())
  })

  it('submits dual-evidence privileged recovery and disposable backup verification cleanly', async () => {
    render(<MasterPrivacyOpsPanel client={client} />)
    await screen.findByText(/Responsável: Michael/)

    fireEvent.change(screen.getByLabelText('UUID do usuário alvo'), { target: { value: USER_ID } })
    fireEvent.change(screen.getByLabelText(/Referência evidência 1/), { target: { value: 'TICKET-42' } })
    fireEvent.change(screen.getByLabelText(/Referência evidência 2/), { target: { value: 'VIDEO-CHECK-99' } })
    fireEvent.change(screen.getByLabelText('UUID do 2º operador validador'), { target: { value: OP2_ID } })
    fireEvent.change(screen.getByLabelText('Justificativa sanitizada'), { target: { value: 'Validação presencial + chamado formal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisão de recuperação' }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'register_privileged_recovery_decision_idempotent',
        expect.objectContaining({
          p_target_user_id: USER_ID,
          p_verified_by_secondary: OP2_ID,
        }),
      )
    })

    fireEvent.change(screen.getByLabelText('Resumo sanitizado da evidência'), {
      target: { value: 'Loja B intocada após restore seletivo da Loja A' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evidência de restore' }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'record_backup_restore_verification_idempotent',
        expect.objectContaining({
          p_trial_scope: 'disposable_selective_tenant_restore',
          p_backup_rotation_days: 35,
        }),
      )
    })

    expect(rpcMock).not.toHaveBeenCalledWith(
      'record_backup_restore_verification_idempotent',
      expect.objectContaining({ p_target_env_label: ORG_ID }),
    )
  })
})
