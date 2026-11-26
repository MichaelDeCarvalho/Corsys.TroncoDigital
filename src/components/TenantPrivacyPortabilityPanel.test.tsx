import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TenantPrivacyPortabilityPanel } from './TenantPrivacyPortabilityPanel'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const EXPORT_ID = '22222222-2222-4222-8222-222222222222'
const REQ_ID = '33333333-3333-4333-8333-333333333333'
const HOLD_ID = '44444444-4444-4444-8444-444444444444'

describe('TenantPrivacyPortabilityPanel (M05 Entregas A-C)', () => {
  let rpcMock: ReturnType<typeof vi.fn>
  let client: SupabaseClient

  beforeEach(() => {
    rpcMock = vi.fn(async (fn: string) => {
      if (fn === 'read_tenant_retention_posture') {
        return {
          data: {
            organization_id: ORG_ID,
            subscription_status: 'canceled',
            canceled_at: '2026-11-10T00:00:00Z',
            current_period_end: '2026-11-30',
            write_allowed: false,
            export_allowed: true,
            export_window_ends_at: '2027-02-08T00:00:00Z',
            retention_phase: 'post_cancel_export_window',
            legal_hold_active: true,
            active_holds_count: 1,
            auto_purge_enabled: false,
            deletion_requires_controller_order: true,
            schedule: [
              {
                category: 'financial_ledger',
                retention_label: '5 anos (piso contratual)',
                legal_note: 'Sem eliminação automática.',
              },
            ],
            holds: [
              {
                id: HOLD_ID,
                data_category: 'financial_ledger',
                hold_reason: 'Parecer contábil em aberto',
                legal_reference: 'PAR-2026-01',
                hold_status: 'active',
                placed_at: '2026-11-15T10:00:00Z',
                released_at: null,
                release_reason: null,
              },
            ],
          },
          error: null,
        }
      }
      if (fn === 'list_tenant_portability_exports') {
        return {
          data: [
            {
              export_id: EXPORT_ID,
              organization_id: ORG_ID,
              export_scope: 'organization_full',
              subject_member_id: null,
              package_format: 'json',
              status: 'ready',
              retention_posture: 'post_cancel_export_window',
              payload_sha256: 'a'.repeat(64),
              expires_at: '2026-11-28T00:00:00Z',
              created_at: '2026-11-26T00:00:00Z',
              manifest: {
                export_scope: 'organization_full',
                retention_posture: 'post_cancel_export_window',
                restoration_note: 'Somente leitura; restauração automática proibida.',
                excluded_scopes: ['secrets_and_tokens'],
                counts: { members: 2 },
                totals_cents: { charges_total_cents: 12050 },
              },
            },
          ],
          error: null,
        }
      }
      if (fn === 'list_tenant_privacy_requests') {
        return {
          data: [
            {
              request_id: REQ_ID,
              organization_id: ORG_ID,
              member_id: null,
              request_type: 'anonymization',
              data_category: 'cadastral',
              requester_verification_method: 'in_person_controller_check',
              requester_verified: true,
              legal_basis: 'exercise_of_rights',
              decision_outcome: 'pending_triage',
              triage_due_at: '2026-11-30T12:00:00Z',
              triaged_at: null,
              controller_justification: null,
              anonymization_assessment: {},
              ledger_preserved: true,
              created_at: '2026-11-26T10:00:00Z',
            },
          ],
          error: null,
        }
      }
      if (fn === 'create_tenant_portability_export_idempotent') {
        return {
          data: {
            export_id: EXPORT_ID,
            payload_sha256: 'b'.repeat(64),
          },
          error: null,
        }
      }
      if (fn === 'download_tenant_portability_export') {
        return {
          data: {
            export_id: EXPORT_ID,
            organization_id: ORG_ID,
            export_scope: 'organization_full',
            subject_member_id: null,
            package_format: 'json',
            payload_sha256: 'a'.repeat(64),
            expires_at: '2026-11-28T00:00:00Z',
            downloaded_at: '2026-11-26T11:00:00Z',
            manifest: { counts: {}, totals_cents: {} },
            data_dictionary: { version: '2026.11-m05' },
            payload: {
              organization: { id: ORG_ID, name: 'Loja QA' },
              eligible_attachments: [
                {
                  id: '55555555-5555-4555-8555-555555555555',
                  storage_path: 'tenant-documents/org-1/ata.pdf',
                  original_filename: 'ata.pdf',
                  mime_type: 'application/pdf',
                  size_bytes: 512,
                  sha256: null,
                  classification: 'confidential',
                  binary_embedded: false,
                  created_at: '2026-11-26T10:00:00Z',
                },
              ],
            },
          },
          error: null,
        }
      }
      return { data: { ok: true }, error: null }
    })
    client = { rpc: rpcMock } as unknown as SupabaseClient
  })

  it('allows portability export during post-cancellation 90d window and logs download', async () => {
    render(<TenantPrivacyPortabilityPanel client={client} organizationId={ORG_ID} />)

    expect(await screen.findByText(/Janela pós-cancelamento de 90 dias/)).toBeInTheDocument()
    expect(screen.getByText(/restauração automática por upload é proibida/i)).toBeInTheDocument()
    expect(screen.getByText(/inventário de metadados e hashes SHA-256 \(sem arquivos binários do Storage embutidos\)/i)).toBeInTheDocument()

    const createBtn = screen.getByRole('button', { name: 'Gerar pacote portátil' })
    expect(createBtn).not.toBeDisabled()
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'create_tenant_portability_export_idempotent',
        expect.objectContaining({
          p_organization_id: ORG_ID,
          p_export_scope: 'organization_full',
          p_package_format: 'json',
        }),
      )
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Baixar pacote' }))
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('download_tenant_portability_export', {
        p_organization_id: ORG_ID,
        p_export_id: EXPORT_ID,
        p_requested_format: 'json',
      })
    })
  })

  it('submits controller privacy decision while highlighting pseudonymization vs anonymization and ledger immutability', async () => {
    render(<TenantPrivacyPortabilityPanel client={client} organizationId={ORG_ID} />)

    expect(await screen.findByText(/Trocar nome por identificador UUID é pseudonimização/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Justificativa do controlador'), {
      target: { value: 'Guarda obrigatória mantida sem alteração do razão' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Decidir solicitação' }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'review_tenant_privacy_request_idempotent',
        expect.objectContaining({
          p_organization_id: ORG_ID,
          p_request_id: REQ_ID,
          p_decision_outcome: 'retained_by_law',
        }),
      )
    })
  })
})
