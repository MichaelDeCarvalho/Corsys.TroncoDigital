import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Configuracoes } from './Configuracoes'
import type { SupabaseClient } from '@supabase/supabase-js'

const ORG_ID = '33333333-3333-3333-3333-333333333333'
const PLAN_ID = '44444444-4444-4444-4444-444444444444'
const VERSION_ID = '55555555-5555-5555-5555-555555555555'
const ACTOR_ID = '66666666-6666-6666-6666-666666666666'

interface MockOptions {
  subscriptionEmpty?: boolean
  subscriptionPermissionError?: boolean
  subscriptionGenericError?: boolean
  auditEmpty?: boolean
  auditPermissionError?: boolean
  auditGenericError?: boolean
  customSubscription?: Record<string, unknown>
  customAuditLogs?: unknown[]
}

function createMockClient(options: MockOptions = {}) {
  const selectQueryMock = (table: string) => {
    const builder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      abortSignal: vi.fn(),
    }

    const resolveWith = () => {
      if (table === 'organization_settings') {
        return Promise.resolve({
          data: [
            {
              organization_id: ORG_ID,
              updated_at: '2026-11-01T12:00:00Z',
              phone: '11999999999',
              email: 'contato@loja.com.br',
              pix_key: '11999999999',
              address: 'Rua das Flores, 100',
              postal_code: '01001-000',
              city: 'São Paulo',
              state_code: 'SP',
              country_code: 'BRA',
            },
          ],
          error: null,
        })
      }

      if (table === 'saas_subscriptions') {
        if (options.subscriptionPermissionError) {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied: settings.manage' } })
        }
        if (options.subscriptionGenericError) {
          return Promise.resolve({ data: null, error: { code: 'XX000', message: 'internal error' } })
        }
        if (options.subscriptionEmpty) {
          return Promise.resolve({ data: [], error: null })
        }
        return Promise.resolve({
          data: [
            options.customSubscription || {
              id: 'sub-1',
              organization_id: ORG_ID,
              plan_id: PLAN_ID,
              plan_version_id: VERSION_ID,
              status: 'active',
              started_at: '2026-01-01T00:00:00Z',
              current_period_start: '2026-11-01',
              current_period_end: '2026-11-30',
              billing_anchor_day: 10,
              cancel_at_period_end: false,
              canceled_at: null,
              billing_provider: 'manual',
              grace_until: null,
              past_due_since: null,
            },
          ],
          error: null,
        })
      }

      if (table === 'saas_plans') {
        return Promise.resolve({
          data: {
            id: PLAN_ID,
            code: 'PLANO-PROFISSIONAL',
            name: 'Plano Tronco Digital Pro',
            description: 'Plano completo com tesouraria e DRE',
            billing_interval: 'monthly',
            currency: 'BRL',
          },
          error: null,
        })
      }

      if (table === 'saas_plan_versions') {
        return Promise.resolve({
          data: {
            id: VERSION_ID,
            plan_id: PLAN_ID,
            version_number: 2,
            status: 'published',
            price: 549.9,
            currency: 'BRL',
            billing_interval: 'monthly',
            valid_from: '2026-01-01',
            valid_to: '2026-12-31',
            trial_days: 0,
            grace_days: 5,
          },
          error: null,
        })
      }

      if (table === 'audit_logs') {
        if (options.auditPermissionError) {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied: audit.read' } })
        }
        if (options.auditGenericError) {
          return Promise.resolve({ data: null, error: { code: 'XX000', message: 'audit read error' } })
        }
        if (options.auditEmpty) {
          return Promise.resolve({ data: [], error: null })
        }
        return Promise.resolve({
          data: options.customAuditLogs || [
            {
              id: 'audit-1',
              organization_id: ORG_ID,
              actor_user_id: ACTOR_ID,
              action: 'user_role.assign',
              entity_type: 'user_roles',
              entity_id: '77777777-7777-7777-7777-777777777777',
              reason: 'Atribuição de papel aprovada pela diretoria',
              created_at: '2026-11-01T10:30:00Z',
            },
            {
              id: 'audit-2',
              organization_id: ORG_ID,
              actor_user_id: null,
              action: 'organization_settings.update',
              entity_type: 'organization_settings',
              entity_id: ORG_ID,
              reason: null,
              created_at: '2026-11-01T09:00:00Z',
            },
          ],
          error: null,
        })
      }

      if (table === 'user_profiles') {
        return Promise.resolve({
          data: [
            {
              user_id: ACTOR_ID,
              display_name: 'Carlos Administrador',
            },
          ],
          error: null,
        })
      }

      return Promise.resolve({ data: [], error: null })
    }

    builder.abortSignal = vi.fn().mockReturnValue(builder)
    builder.maybeSingle = vi.fn().mockImplementation(() => resolveWith())
    builder.single = vi.fn().mockImplementation(() => resolveWith())
    builder.then = (onResolve: (val: unknown) => unknown, onReject?: (err: unknown) => unknown) =>
      resolveWith().then(onResolve, onReject)

    return builder
  }

  const client = {
    from: vi.fn().mockImplementation((table: string) => selectQueryMock(table)),
    rpc: vi.fn().mockResolvedValue({ data: ORG_ID, error: null }),
  } as unknown as SupabaseClient

  return { client }
}

describe('Configuracoes Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders SaaS subscription details using historical contracted plan version price', async () => {
    const { client } = createMockClient()
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    // Verify plan name and code
    expect(await screen.findByText('Plano Tronco Digital Pro')).toBeInTheDocument()
    expect(screen.getByText('PLANO-PROFISSIONAL')).toBeInTheDocument()

    // Verify version badge
    expect(screen.getByText(/Versão 2 \(Publicada\)/)).toBeInTheDocument()

    // Verify historical contracted price formatted in BRL
    expect(screen.getByText('R$ 549,90')).toBeInTheDocument()
    expect(screen.getByText('base da versão contratada')).toBeInTheDocument()

    // Verify active status pill
    expect(screen.getByText('Ativa')).toBeInTheDocument()

    // Verify anchor day
    expect(screen.getByText('Vencimento dia 10')).toBeInTheDocument()
  })

  it('handles empty SaaS subscription gracefully without mock data', async () => {
    const { client } = createMockClient({ subscriptionEmpty: true })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText('Nenhuma assinatura ativa encontrada.')
    ).toBeInTheDocument()
  })

  it('displays permission denied message when user lacks settings.manage for subscription', async () => {
    const { client } = createMockClient({ subscriptionPermissionError: true })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText(/Seu perfil não possui permissão para consultar os dados da assinatura \(requer settings\.manage\)/)
    ).toBeInTheDocument()
  })

  it('renders audit logs with translated action, actor name, and reason without technical context', async () => {
    const { client } = createMockClient()
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    // Verify translated action
    expect(await screen.findByText('Atribuição de Perfil')).toBeInTheDocument()
    expect(screen.getByText('Alteração de Parâmetros')).toBeInTheDocument()

    // Verify resolved actor display name and reason
    expect(screen.getByText('Carlos Administrador')).toBeInTheDocument()
    expect(screen.getByText('Atribuição de papel aprovada pela diretoria')).toBeInTheDocument()

    // Verify fallback to Sistema when actor is null
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('displays empty state for audit logs when no events are recorded', async () => {
    const { client } = createMockClient({ auditEmpty: true })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText('Nenhum evento de governança ou auditoria registrado para esta Loja.')
    ).toBeInTheDocument()
  })

  it('handles audit log permission denied (requer audit.read)', async () => {
    const { client } = createMockClient({ auditPermissionError: true })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText(/Seu perfil não possui permissão para visualizar a trilha de auditoria \(requer audit\.read\)/)
    ).toBeInTheDocument()
  })

  it('navigates to support screen when support button is clicked', async () => {
    const { client } = createMockClient()
    const onNavigateMock = vi.fn()
    render(<Configuracoes client={client} organizationId={ORG_ID} onNavigate={onNavigateMock} />)

    const supportBtn = await screen.findByRole('button', { name: /Acessar Central de Chamados/i })
    fireEvent.click(supportBtn)

    expect(onNavigateMock).toHaveBeenCalledWith('support')
  })

  it('renders privacy section keeping unavailable features informed without mock simulation', async () => {
    const { client } = createMockClient()
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(await screen.findByText(/Exportação Integral de Dados \(Portabilidade LGPD\)/)).toBeInTheDocument()
    expect(screen.getByText('Em homologação na plataforma Master')).toBeInTheDocument()
    expect(screen.getByText('Exige solicitação via Suporte')).toBeInTheDocument()
    expect(screen.getByText('Operação restrita Master AAL2')).toBeInTheDocument()
  })

  it('fails closed when returned subscription has cross-tenant organization_id', async () => {
    const { client } = createMockClient({
      customSubscription: {
        id: 'sub-leak',
        organization_id: '99999999-9999-9999-9999-999999999999', // foreign tenant
        plan_id: PLAN_ID,
        plan_version_id: VERSION_ID,
        status: 'active',
      },
    })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText('Inconsistência de isolamento de dados da assinatura.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Plano Tronco Digital Pro')).not.toBeInTheDocument()
  })

  it('handles generic database errors gracefully for subscription and audit logs', async () => {
    const { client } = createMockClient({
      subscriptionGenericError: true,
      auditGenericError: true,
    })
    render(<Configuracoes client={client} organizationId={ORG_ID} />)

    expect(
      await screen.findByText('Não foi possível carregar a assinatura SaaS da Loja.')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Não foi possível carregar a trilha de auditoria da Loja.')
    ).toBeInTheDocument()
  })
})
