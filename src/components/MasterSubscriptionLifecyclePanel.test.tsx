import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { MasterSubscriptionLifecyclePanel } from './MasterSubscriptionLifecyclePanel'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const SUB_ID = '22222222-2222-4222-8222-222222222222'
const PLAN_ESSENCIAL_V1 = '33333333-3333-4333-8333-333333333333'
const PLAN_PRO_V1 = '44444444-4444-4444-8444-444444444444'
const SCHED_ID = '55555555-5555-4555-8555-555555555555'
const RETURN_UUID = '66666666-6666-4666-8666-666666666666'

function createLifecycleFixture(opts: {
  status?: string
  writeAllowed?: boolean
  overdueAmount?: string
  graceUntil?: string | null
  exportWindowUntil?: string | null
  scheduledChanges?: Array<Record<string, unknown>>
} = {}) {
  const status = opts.status ?? 'trialing'
  const commercialStatus = {
    organization_id: ORG_ID,
    subscription_id: SUB_ID,
    subscription_status: status,
    commercial_status: status,
    access_override: 'none',
    write_allowed: opts.writeAllowed ?? true,
    plan_id: '77777777-7777-4777-8777-777777777777',
    plan_code: 'corsys_essencial_125',
    plan_name: 'Corsys Essencial',
    plan_version_id: PLAN_ESSENCIAL_V1,
    contract_price: 125,
    active_users: 2,
    max_admin_users: 3,
    current_period_start: '2026-11-01',
    current_period_end: '2026-11-30',
    billing_anchor_day: 10,
    past_due_since: status === 'past_due' ? '2026-11-11T00:00:00Z' : null,
    grace_until: opts.graceUntil ?? (status === 'past_due' ? '2026-11-18T23:59:59Z' : null),
    cancel_at_period_end: status === 'cancel_scheduled',
    canceled_at: status === 'canceled' ? '2026-11-20T00:00:00Z' : null,
    export_window_until: opts.exportWindowUntil ?? (status === 'canceled' ? '2027-02-18T00:00:00Z' : null),
    open_amount: opts.overdueAmount ?? '0.00',
    overdue_amount: opts.overdueAmount ?? '0.00',
    scheduled_change: null,
  }
  const seatUsage = {
    organization_id: ORG_ID,
    active_users: 2,
    max_admin_users: 3,
    seats_remaining: 1,
    over_limit: false,
    plan_id: '77777777-7777-4777-8777-777777777777',
    plan_version_id: PLAN_ESSENCIAL_V1,
    plan_name: 'Corsys Essencial',
    plan_code: 'corsys_essencial_125',
    subscription_status: status,
  }
  const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
    if (name === 'read_tenant_commercial_status') return { data: commercialStatus, error: null }
    if (name === 'read_tenant_seat_usage') return { data: seatUsage, error: null }
    return { data: RETURN_UUID, error: null }
  })
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      abortSignal: () => Promise.resolve({
        data: table === 'saas_subscription_price_terms'
          ? [{ id: RETURN_UUID, organization_id: ORG_ID, subscription_id: SUB_ID, effective_from: '2026-11-01', effective_to: null, unit_price: '125.00', currency: 'BRL', adjustment_reason: 'Condição inicial preservada', created_at: '2026-11-01T10:00:00Z' }]
          : table === 'saas_scheduled_subscription_changes'
            ? (opts.scheduledChanges ?? [{ id: SCHED_ID, organization_id: ORG_ID, subscription_id: SUB_ID, change_type: 'plan_change', target_plan_version_id: PLAN_PRO_V1, effective_at: '2026-12-01', status: 'scheduled', reason: 'Upgrade mensal', applied_at: null, created_at: '2026-11-15T10:00:00Z' }])
            : table === 'saas_collection_events'
              ? [{ id: 1, organization_id: ORG_ID, invoice_id: null, event_type: 'reminder_sent', channel: 'email', external_reference: null, metadata: { note: 'Aviso enviado' }, created_at: '2026-11-12T10:00:00Z' }]
              : table === 'v_saas_plan_version_admin'
                ? [
                    { plan_id: '77777777-7777-4777-8777-777777777777', plan_active: true, plan_version_id: PLAN_ESSENCIAL_V1, version_number: 1, display_name_snapshot: 'Corsys Essencial', internal_code_snapshot: 'corsys_essencial_125', price: '125.00', currency: 'BRL', billing_interval: 'monthly', trial_days: 0, grace_days: 7, valid_from: '2026-11-01', valid_to: null, publication_status: 'published', admin_status: 'current', can_delete_plan: false, delete_block_reason: 'published_version_exists' },
                    { plan_id: '88888888-8888-4888-8888-888888888888', plan_active: true, plan_version_id: PLAN_PRO_V1, version_number: 1, display_name_snapshot: 'Corsys Profissional', internal_code_snapshot: 'corsys_profissional_180', price: '180.00', currency: 'BRL', billing_interval: 'monthly', trial_days: 0, grace_days: 7, valid_from: '2026-11-01', valid_to: null, publication_status: 'published', admin_status: 'current', can_delete_plan: false, delete_block_reason: 'published_version_exists' },
                  ]
                : [],
        error: null,
      }),
    }
    return chain
  })
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from }
}

describe('MasterSubscriptionLifecyclePanel (M04 C01–C07 / D01)', () => {
  it('renders seat usage, price terms, scheduled changes and collection trail, and confirms C02 express hiring with idempotency retry', async () => {
    const { client, rpc } = createLifecycleFixture({ status: 'trialing' })
    render(<MasterSubscriptionLifecyclePanel client={client} organizationId={ORG_ID} />)

    await screen.findByText(/Ciclo comercial, assentos e inadimplência/)
    expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
    expect(screen.getByText(/Condição inicial preservada/)).toBeInTheDocument()

    // Select published plan and confirm hiring -> simulate uncertain network drop once, then retry with identical idempotency key
    const selectPlan = await screen.findByLabelText('Versão publicada do plano')
    fireEvent.change(selectPlan, { target: { value: PLAN_PRO_V1 } })
    fireEvent.change(screen.getByLabelText('Motivo / justificativa'), { target: { value: 'Contratação expressa Loja Piloto' } })

    const baseImpl = rpc.getMockImplementation()!
    rpc.mockImplementationOnce(async (name: string, params?: Record<string, unknown>) => {
      if (name === 'confirm_saas_subscription_hiring_idempotent') throw new Error('network timeout')
      return baseImpl(name, params)
    })

    fireEvent.submit(screen.getByRole('form', { name: 'Confirmar contratação expressa' }))
    const retryBtn = await screen.findByRole('button', { name: 'Verificar envio' })
    fireEvent.click(retryBtn)

    await screen.findByText(/confirmada \([0-9a-f]{8}\)/i)
    const hiringCalls = rpc.mock.calls.filter(([fn]) => fn === 'confirm_saas_subscription_hiring_idempotent')
    expect(hiringCalls).toHaveLength(2)
    expect(hiringCalls[1][1]).toEqual(hiringCalls[0][1])
  })

  it('schedules prospective plan change (C05) and supports cancel/apply of scheduled changes', async () => {
    const { client, rpc } = createLifecycleFixture({ status: 'active' })
    render(<MasterSubscriptionLifecyclePanel client={client} organizationId={ORG_ID} />)

    const targetSelect = await screen.findByLabelText('Plano destino publicado')
    fireEvent.change(targetSelect, { target: { value: PLAN_PRO_V1 } })
    fireEvent.change(screen.getByLabelText('Motivo da mudança'), { target: { value: 'Upgrade no próximo mês' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Agendar troca de plano' }))

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('schedule_saas_plan_change_idempotent', expect.objectContaining({
        p_organization_id: ORG_ID,
        p_target_plan_version_id: PLAN_PRO_V1,
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Efetivar agora' }))
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('apply_scheduled_saas_plan_change_idempotent', expect.objectContaining({
        p_organization_id: ORG_ID,
        p_change_id: SCHED_ID,
      }))
    })
  })

  it('operates C03 delinquency/collection/manual suspension/reactivation and D01 immediate cancel', async () => {
    const { client, rpc } = createLifecycleFixture({ status: 'past_due', overdueAmount: '125.00' })
    render(<MasterSubscriptionLifecyclePanel client={client} organizationId={ORG_ID} />)

    await screen.findByText(/Ciclo comercial, assentos e inadimplência/)
    fireEvent.click(screen.getByRole('button', { name: 'Cobrança, tolerância e suspensão (C03)' }))

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'whatsapp' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Registrar aviso de cobrança' }))
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('record_saas_collection_event_idempotent', expect.objectContaining({
        p_organization_id: ORG_ID,
        p_channel: 'whatsapp',
      }))
    })

    fireEvent.change(screen.getByLabelText('Motivo auditável'), { target: { value: 'Prazo de 7 dias encerrado sem pagamento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suspender manualmente (somente leitura)' }))
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('suspend_saas_subscription_manual_idempotent', expect.objectContaining({
        p_organization_id: ORG_ID,
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelamento e janela D01' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Justificativa obrigatória'), { target: { value: 'Encerramento com retenção D01' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cancelar assinatura SaaS' }))
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('cancel_saas_subscription_idempotent', expect.objectContaining({
        p_organization_id: ORG_ID,
        p_immediate: true,
      }))
    })
  })
})
