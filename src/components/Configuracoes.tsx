import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CreditCard,
  ShieldCheck,
  LifeBuoy,
  Lock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Clock,
  Calendar,
} from 'lucide-react'
import { TenantIdentity } from './TenantIdentity'
import type { Page } from './AppShell'

export interface SubscriptionData {
  id: string
  organization_id: string
  plan_id: string
  plan_version_id: string
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancel_scheduled' | 'canceled' | string
  started_at: string
  current_period_start: string | null
  current_period_end: string | null
  billing_anchor_day: number | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  billing_provider: string
  grace_until: string | null
  past_due_since: string | null
  plan?: {
    id: string
    code: string
    name: string
    description: string | null
    billing_interval: string
    currency: string
  } | null
  version?: {
    id: string
    plan_id: string
    version_number: number
    status: string
    price: number | string
    currency: string
    billing_interval: string
    valid_from: string
    valid_to: string | null
    trial_days: number
    grace_days: number
  } | null
}

export interface AuditLogEntry {
  id: string
  organization_id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  reason: string | null
  created_at: string
  actor_display?: string
}

const subscriptionStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Ativa', color: '#14532d', bg: '#dcfce7' },
  trialing: { label: 'Em Avaliação (Trial)', color: '#312e81', bg: '#e0e7ff' },
  past_due: { label: 'Pagamento Pendente', color: '#713f12', bg: '#fef9c3' },
  suspended: { label: 'Suspensa', color: '#991b1b', bg: '#fee2e2' },
  cancel_scheduled: { label: 'Cancelamento Agendado', color: '#713f12', bg: '#fef9c3' },
  canceled: { label: 'Cancelada', color: '#475569', bg: '#f1f5f9' },
}

const intervalMap: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  custom: 'Personalizada',
}

const auditActionLabels: Record<string, string> = {
  'user_role.assign': 'Atribuição de Perfil',
  'user_role.revoke': 'Revogação de Perfil',
  'organization.update': 'Atualização Institucional',
  'organization_settings.update': 'Alteração de Parâmetros',
  'period.close': 'Fechamento de Competência',
  'charge.create': 'Emissão de Cobrança',
  'charge.cancel': 'Cancelamento de Cobrança',
  'payment.create': 'Registro de Pagamento',
  'payment.reverse': 'Estorno de Pagamento',
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR')
  } catch {
    return dateStr
  }
}

function formatDateTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return '—'
  try {
    const d = new Date(dateTimeStr)
    if (isNaN(d.getTime())) return dateTimeStr
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return dateTimeStr
  }
}

function formatMoney(value: number | string | null | undefined, currency = 'BRL'): string {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(num)
}

export function Configuracoes({
  client,
  organizationId,
  onNavigate,
}: {
  client: SupabaseClient
  organizationId: string
  onNavigate?: (page: Page) => void
}) {
  const [subscription, setSubscription] = useState<SubscriptionData | null | undefined>(undefined)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [subscriptionError, setSubscriptionError] = useState('')

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[] | null | undefined>(undefined)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')

  const [refreshKey, setRefreshKey] = useState(0)

  // 1. Carregar Assinatura SaaS
  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setSubscriptionLoading(true)
    setSubscriptionError('')

    async function fetchSubscription() {
      try {
        const { data: subData, error: subErr } = await client
          .from('saas_subscriptions')
          .select(
            'id, organization_id, plan_id, plan_version_id, status, started_at, current_period_start, current_period_end, billing_anchor_day, cancel_at_period_end, canceled_at, billing_provider, grace_until, past_due_since'
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .abortSignal(controller.signal)

        if (!active) return

        if (subErr) {
          if (['42501', '28000'].includes(subErr.code)) {
            setSubscriptionError('Seu perfil não possui permissão para consultar os dados da assinatura (requer settings.manage).')
          } else {
            setSubscriptionError('Não foi possível carregar a assinatura SaaS da Loja.')
          }
          setSubscription(null)
          return
        }

        if (!subData || subData.length === 0) {
          setSubscription(null)
          return
        }

        const currentSub = subData[0] as SubscriptionData

        // Garantir isolamento rigoroso por tenant
        if (currentSub.organization_id !== organizationId) {
          setSubscriptionError('Inconsistência de isolamento de dados da assinatura.')
          setSubscription(null)
          return
        }

        // Buscar dados complementares do plano e da versão contratada
        const [planRes, verRes] = await Promise.all([
          client
            .from('saas_plans')
            .select('id, code, name, description, billing_interval, currency')
            .eq('id', currentSub.plan_id)
            .abortSignal(controller.signal)
            .maybeSingle(),
          client
            .from('saas_plan_versions')
            .select(
              'id, plan_id, version_number, status, price, currency, billing_interval, valid_from, valid_to, trial_days, grace_days'
            )
            .eq('id', currentSub.plan_version_id)
            .abortSignal(controller.signal)
            .maybeSingle(),
        ])

        if (!active) return

        currentSub.plan = planRes.data ?? null
        currentSub.version = verRes.data ?? null

        setSubscription(currentSub)
      } catch (err: unknown) {
        if (!active) return
        const isAbort = (err as { name?: string })?.name === 'AbortError'
        if (!isAbort) {
          setSubscriptionError('Não foi possível consultar os dados da assinatura SaaS.')
          setSubscription(null)
        }
      } finally {
        if (active) setSubscriptionLoading(false)
      }
    }

    fetchSubscription()

    return () => {
      active = false
      controller.abort()
    }
  }, [client, organizationId, refreshKey])

  // 2. Carregar Governança e Auditoria
  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setAuditLoading(true)
    setAuditError('')

    async function fetchAuditLogs() {
      try {
        const { data: logsData, error: logsErr } = await client
          .from('audit_logs')
          .select('id, organization_id, actor_user_id, action, entity_type, entity_id, reason, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(20)
          .abortSignal(controller.signal)

        if (!active) return

        if (logsErr) {
          if (['42501', '28000'].includes(logsErr.code)) {
            setAuditError('Seu perfil não possui permissão para visualizar a trilha de auditoria (requer audit.read).')
          } else {
            setAuditError('Não foi possível carregar a trilha de auditoria da Loja.')
          }
          setAuditLogs(null)
          return
        }

        if (!logsData || logsData.length === 0) {
          setAuditLogs([])
          return
        }

        const entries = logsData as AuditLogEntry[]

        // Validar isolamento
        if (entries.some((e) => e.organization_id !== organizationId)) {
          setAuditError('Inconsistência de tenant na trilha de auditoria.')
          setAuditLogs(null)
          return
        }

        // Tentar resolver nomes de exibição dos atores via user_profiles sem expor dados sensíveis
        const actorIds = Array.from(
          new Set(entries.map((e) => e.actor_user_id).filter((id): id is string => Boolean(id)))
        )

        if (actorIds.length > 0) {
          try {
            const { data: profiles } = await client
              .from('user_profiles')
              .select('user_id, display_name')
              .in('user_id', actorIds)
              .abortSignal(controller.signal)

            if (profiles && active) {
              const map = new Map<string, string>()
              profiles.forEach((p: { user_id: string; display_name: string | null }) => {
                if (p.display_name) map.set(p.user_id, p.display_name)
              })
              entries.forEach((entry) => {
                if (entry.actor_user_id && map.has(entry.actor_user_id)) {
                  entry.actor_display = map.get(entry.actor_user_id)
                }
              })
            }
          } catch {
            // Se user_profiles for restrito, segue com ID ou valor padrão
          }
        }

        if (active) {
          setAuditLogs(entries)
        }
      } catch (err: unknown) {
        if (!active) return
        const isAbort = (err as { name?: string })?.name === 'AbortError'
        if (!isAbort) {
          setAuditError('Não foi possível consultar os registros de auditoria.')
          setAuditLogs(null)
        }
      } finally {
        if (active) setAuditLoading(false)
      }
    }

    fetchAuditLogs()

    return () => {
      active = false
      controller.abort()
    }
  }, [client, organizationId, refreshKey])

  const subStatusStyle = subscription
    ? subscriptionStatusMap[subscription.status] || {
        label: subscription.status,
        color: '#475569',
        bg: '#f1f5f9',
      }
    : null

  const historicalPrice = subscription?.version?.price ?? subscription?.plan ? (subscription.version?.price ?? null) : null
  const currencyCode = subscription?.version?.currency || subscription?.plan?.currency || 'BRL'
  const intervalCode = subscription?.version?.billing_interval || subscription?.plan?.billing_interval || 'monthly'

  return (
    <div className="view active" id="view-configuracoes">
      <div className="hero">
        <div>
          <h2>Configurações da Loja</h2>
          <p>Identidade institucional, contatos, assinatura SaaS, governança e auditoria da Loja.</p>
        </div>
        <div>
          <button
            type="button"
            className="secondary"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={subscriptionLoading || auditLoading}
            title="Atualizar dados de configuração"
          >
            <RefreshCw size={16} aria-hidden="true" style={{ marginRight: '6px' }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* 1. Identidade e Parâmetros da Loja (Preservado) */}
      <TenantIdentity client={client} organizationId={organizationId} />

      {/* 2. Assinatura e Plano SaaS */}
      <section className="panel" aria-label="Assinatura e Plano SaaS" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} style={{ color: 'var(--gold, #C5A880)' }} aria-hidden="true" />
            <h3>Assinatura e Plano SaaS</h3>
          </div>
          <span className="subtle">Contrato de licenciamento da plataforma</span>
        </div>

        {subscriptionLoading ? (
          <p role="status" className="message">Carregando informações da assinatura…</p>
        ) : subscriptionError ? (
          <div className="panel" role="alert" style={{ borderLeft: '4px solid var(--danger, #D88484)', background: '#1C2028' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <AlertTriangle size={20} style={{ color: 'var(--danger, #D88484)', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <strong>Acesso à Assinatura</strong>
                <p className="subtle" style={{ margin: '4px 0 0' }}>{subscriptionError}</p>
              </div>
            </div>
          </div>
        ) : !subscription ? (
          <div
            className="callout warning"
            style={{
              backgroundColor: '#fffbeb',
              borderColor: '#fde68a',
              color: '#78350f',
            }}
          >
            <p style={{ margin: 0, marginBottom: '4px' }}>
              <strong style={{ color: '#78350f' }}>Nenhuma assinatura ativa encontrada.</strong>
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
              Esta Loja não possui assinatura SaaS vinculada ou contratada no momento. Entre em contato com a administração da plataforma Master para regularizar.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text, #E2E8F0)' }}>
                  {subscription.plan?.name || 'Plano SaaS'}
                </h4>
                <p className="subtle" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                  Código: <code>{subscription.plan?.code || '—'}</code> • Provedor: {subscription.billing_provider}
                </p>
              </div>

              {subStatusStyle && (
                <span
                  className="pill"
                  style={{
                    backgroundColor: subStatusStyle.bg,
                    color: subStatusStyle.color,
                    fontWeight: 600,
                  }}
                >
                  {subStatusStyle.label}
                </span>
              )}

              {subscription.version && (
                <span
                  className="pill"
                  style={{
                    backgroundColor: '#e0e7ff',
                    color: '#312e81',
                    fontWeight: 600,
                  }}
                >
                  Versão {subscription.version.version_number} ({subscription.version.status === 'published' ? 'Publicada' : 'Rascunho'})
                </span>
              )}
            </div>

            <div
              className="metric-grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div className="panel metric" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
                <p>Valor Contratado</p>
                <strong style={{ color: 'var(--gold, #C5A880)' }}>
                  {historicalPrice !== null ? formatMoney(historicalPrice, currencyCode) : 'Sob Consulta'}
                </strong>
                <span className="subtle">base da versão contratada</span>
              </div>

              <div className="panel metric" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
                <p>Periodicidade</p>
                <strong>{intervalMap[intervalCode] || intervalCode}</strong>
                <span className="subtle">
                  {subscription.billing_anchor_day ? `Vencimento dia ${subscription.billing_anchor_day}` : 'Ciclo recorrente'}
                </span>
              </div>

              <div className="panel metric" style={{ margin: 0, background: 'var(--surface-2, #1C2028)' }}>
                <p>Início do Contrato</p>
                <strong>{formatDate(subscription.started_at)}</strong>
                <span className="subtle">
                  {subscription.current_period_end ? `Ciclo até ${formatDate(subscription.current_period_end)}` : 'Vigência em curso'}
                </span>
              </div>
            </div>

            {/* Informações de vigência contratual */}
            <div
              style={{
                background: 'var(--surface, #161920)',
                border: '1px solid var(--border-soft, rgba(148, 163, 184, .12))',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} style={{ color: 'var(--muted, #94A3B8)' }} aria-hidden="true" />
                <span className="subtle">Competência Atual:</span>
                <strong>
                  {formatDate(subscription.current_period_start)} a {formatDate(subscription.current_period_end)}
                </strong>
              </div>
              {subscription.version && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} style={{ color: 'var(--muted, #94A3B8)' }} aria-hidden="true" />
                  <span className="subtle">Vigência da Versão:</span>
                  <strong>
                    {formatDate(subscription.version.valid_from)} {subscription.version.valid_to ? `a ${formatDate(subscription.version.valid_to)}` : '(vigente)'}
                  </strong>
                </div>
              )}
              {subscription.grace_until && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} style={{ color: '#b45309' }} aria-hidden="true" />
                  <span style={{ color: '#b45309' }}>Tolerância (Grace): até {formatDate(subscription.grace_until)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. Governança e Auditoria */}
      <section className="panel" aria-label="Governança e Auditoria" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--gold, #C5A880)' }} aria-hidden="true" />
            <h3>Governança e Auditoria</h3>
          </div>
          <span className="subtle">Trilha de eventos e operações da Loja</span>
        </div>

        {auditLoading ? (
          <p role="status" className="message">Carregando registros de auditoria da Loja…</p>
        ) : auditError ? (
          <div className="panel" role="alert" style={{ borderLeft: '4px solid var(--danger, #D88484)', background: '#1C2028' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <AlertTriangle size={20} style={{ color: 'var(--danger, #D88484)', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <strong>Acesso à Auditoria</strong>
                <p className="subtle" style={{ margin: '4px 0 0' }}>{auditError}</p>
              </div>
            </div>
          </div>
        ) : !auditLogs || auditLogs.length === 0 ? (
          <p className="empty">Nenhum evento de governança ou auditoria registrado para esta Loja.</p>
        ) : (
          <div>
            <p className="subtle" style={{ marginBottom: '12px' }}>
              Últimas {auditLogs.length} operações registradas no livro de auditoria imutável do sistema.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Data / Hora</th>
                    <th scope="col">Ação</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Justificativa / Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="subtle" style={{ fontSize: '0.85rem' }}>
                          {formatDateTime(log.created_at)}
                        </span>
                      </td>
                      <td>
                        <strong>{auditActionLabels[log.action] || log.action}</strong>
                        <span className="subtle" style={{ display: 'block', fontSize: '0.75rem' }}>
                          {log.entity_type} {log.entity_id ? `• ${log.entity_id.slice(0, 8)}…` : ''}
                        </span>
                      </td>
                      <td>
                        <span>{log.actor_display || (log.actor_user_id ? `ID ${log.actor_user_id.slice(0, 8)}…` : 'Sistema')}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>{log.reason || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. Suporte e Central de Chamados */}
      <section className="panel" aria-label="Suporte da Loja" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LifeBuoy size={20} style={{ color: 'var(--gold, #C5A880)' }} aria-hidden="true" />
            <h3>Atendimento e Suporte Técnico</h3>
          </div>
          <span className="subtle">Central de tickets e chamados</span>
        </div>

        <p className="subtle" style={{ marginBottom: '16px' }}>
          O suporte técnico, solicitações de ajuste de cadastro e acompanhamento de chamados são centralizados no módulo de Chamados da Loja.
        </p>

        {onNavigate ? (
          <button
            type="button"
            className="secondary"
            onClick={() => onNavigate('support')}
          >
            Acessar Central de Chamados
            <ArrowRight size={16} aria-hidden="true" style={{ marginLeft: '6px' }} />
          </button>
        ) : (
          <p className="subtle">Acesse a aba <strong>Chamados</strong> no menu lateral para abrir um ticket.</p>
        )}
      </section>

      {/* 5. Privacidade e Conformidade (LGPD) */}
      <section className="panel" aria-label="Privacidade e Conformidade" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} style={{ color: 'var(--gold, #C5A880)' }} aria-hidden="true" />
            <h3>Privacidade e Conformidade (LGPD)</h3>
          </div>
          <span className="subtle">Gestão de dados e políticas de segurança</span>
        </div>

        <p className="subtle" style={{ marginBottom: '16px' }}>
          O CorSys Tronco Digital adota isolamento estrito por tenant no nível do banco de dados (Row Level Security). As solicitações de titular de dados e exportações em lote seguem o protocolo da plataforma Master SaaS.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-soft, rgba(148, 163, 184, .12))',
              background: 'var(--surface-2, #1C2028)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <strong>Exportação Integral de Dados (Portabilidade LGPD)</strong>
              <p className="subtle" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                Geração de pacote seguro com histórico contábil, integrantes e cadastros da Loja.
              </p>
            </div>
            <span
              className="pill"
              style={{
                backgroundColor: '#fef9c3',
                color: '#713f12',
                fontWeight: 600,
              }}
            >
              Em homologação na plataforma Master
            </span>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-soft, rgba(148, 163, 184, .12))',
              background: 'var(--surface-2, #1C2028)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <strong>Anonimização e Exclusão de Titular</strong>
              <p className="subtle" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                Direito ao esquecimento de dados pessoais, ressalvados prazos de guarda contábil e fiscal.
              </p>
            </div>
            <span
              className="pill"
              style={{
                backgroundColor: '#fef9c3',
                color: '#713f12',
                fontWeight: 600,
              }}
            >
              Exige solicitação via Suporte
            </span>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-soft, rgba(148, 163, 184, .12))',
              background: 'var(--surface-2, #1C2028)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <strong>Restauração de Snapshot / Backup Pontual</strong>
              <p className="subtle" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                Restauração de ponto no tempo com aprovação e auditoria transacional Master.
              </p>
            </div>
            <span
              className="pill"
              style={{
                backgroundColor: '#fef9c3',
                color: '#713f12',
                fontWeight: 600,
              }}
            >
              Operação restrita Master AAL2
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
