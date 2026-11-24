import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  Building2,
  FileText,
  Sliders,
  DollarSign,
  Mail,
  RefreshCw,
  Lock,
} from 'lucide-react'
import {
  loadPlatformConfiguration,
  loadPlatformTerms,
  type PlatformConfiguration,
  type PlatformTermVersion,
} from '../lib/master-config'

type ConfigSection =
  | 'identity'
  | 'commercial'
  | 'billing'
  | 'communications'
  | 'legal'
  | 'integrations'

const SECTIONS: ReadonlyArray<{ id: ConfigSection; label: string }> = [
  { id: 'identity', label: 'Identidade / Fiscal' },
  { id: 'commercial', label: 'Regras Comerciais' },
  { id: 'billing', label: 'Cobrança / Encargos' },
  { id: 'communications', label: 'Comunicação' },
  { id: 'legal', label: 'Termos e Privacidade' },
  { id: 'integrations', label: 'Integrações' },
]

type ProviderReadinessDisplay = {
  badgeLabel: 'Configurado' | 'Não configurado' | 'Estado não reconhecido'
  badgeTone: 'partial' | 'open' | 'overdue'
  verificationNote: 'Disponibilidade operacional não verificada'
}

function resolveProviderReadiness(status: string): ProviderReadinessDisplay {
  if (status === 'configured') {
    return {
      badgeLabel: 'Configurado',
      badgeTone: 'partial',
      verificationNote: 'Disponibilidade operacional não verificada',
    }
  }
  if (status === 'not_configured') {
    return {
      badgeLabel: 'Não configurado',
      badgeTone: 'open',
      verificationNote: 'Disponibilidade operacional não verificada',
    }
  }
  return {
    badgeLabel: 'Estado não reconhecido',
    badgeTone: 'overdue',
    verificationNote: 'Disponibilidade operacional não verificada',
  }
}

function formatCollectionChannel(channel: PlatformConfiguration['primary_collection_channel']): string {
  if (channel === 'email_whatsapp') return 'E-mail + WhatsApp'
  if (channel === 'whatsapp') return 'WhatsApp'
  return 'E-mail'
}

function formatDocumentTypeLabel(docType: string): string {
  if (docType === 'terms' || docType === 'terms_of_service') return 'Termos de Uso'
  if (docType === 'privacy' || docType === 'privacy_policy') return 'Privacidade'
  if (docType === 'dpa' || docType === 'data_processing') return 'DPA (LGPD)'
  return docType
}

function renderTermStatusBadge(status: PlatformTermVersion['status']) {
  if (status === 'published') {
    return <span className="status ok">Publicado</span>
  }
  if (status === 'draft') {
    return <span className="status open">Rascunho</span>
  }
  return <span className="status">Revogado</span>
}

export function MasterPlatformConfig({ client }: { client: SupabaseClient }) {
  const [config, setConfig] = useState<PlatformConfiguration | null>(null)
  const [terms, setTerms] = useState<PlatformTermVersion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [revision, setRevision] = useState(0)
  const [activeSection, setActiveSection] = useState<ConfigSection>('identity')

  const requestSeqRef = useRef(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let live = true
    const reqId = ++requestSeqRef.current
    const controller = new AbortController()

    setConfig(null)
    setTerms(null)
    setLoading(true)
    setError('')
    setDenied(false)

    Promise.all([
      loadPlatformConfiguration(client, controller.signal),
      loadPlatformTerms(client, controller.signal),
    ])
      .then(([cfg, trm]) => {
        if (!live || controller.signal.aborted || reqId !== requestSeqRef.current) return
        setConfig(cfg)
        setTerms(trm)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!live || controller.signal.aborted || reqId !== requestSeqRef.current) return
        setConfig(null)
        setTerms(null)
        const code = (err as { code?: string })?.code
        if (code === '42501' || code === '28000') {
          setDenied(true)
        } else {
          setError(
            'Não foi possível consultar as configurações da plataforma. Acesso restrito a MASTER/MFA.'
          )
        }
        setLoading(false)
      })

    return () => {
      live = false
      controller.abort()
    }
  }, [client, revision])

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % SECTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + SECTIONS.length) % SECTIONS.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = SECTIONS.length - 1
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveSection(SECTIONS[index].id)
      return
    }

    if (targetIndex !== null) {
      event.preventDefault()
      const nextSection = SECTIONS[targetIndex]
      setActiveSection(nextSection.id)
      tabRefs.current[targetIndex]?.focus()
    }
  }

  const ready = !loading && !denied && !error && config !== null && terms !== null
  const billingReadiness = config ? resolveProviderReadiness(config.billing_provider_status) : null
  const emailReadiness = config ? resolveProviderReadiness(config.email_provider_status) : null
  const fiscalReadiness = config ? resolveProviderReadiness(config.fiscal_provider_status) : null

  return (
    <div className="master-config" data-view-id="view-master-config">
      {/* Title & Refresh */}
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Governança Master · Parâmetros Globais</p>
            <h2>Configurações da Plataforma</h2>
            <p className="subtle">
              Parâmetros globais de governança, identidade, cobrança e termos do SaaS Corsys (somente leitura · sem exposição de segredos).
            </p>
          </div>
          <div className="master-config-badges">
            <span className="badge">Master · AAL2</span>
            <button
              type="button"
              className="secondary"
              onClick={() => setRevision(v => v + 1)}
              aria-label="Atualizar configurações da plataforma"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {denied && (
        <p role="alert" className="message error">
          Acesso restrito: sua autenticação requer papel MASTER e validação em dois fatores (MFA/AAL2).
        </p>
      )}

      {!denied && error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}

      {loading && !denied && !error && (
        <p role="status" className="panel subtle">
          Consultando configurações da plataforma sob governança Master…
        </p>
      )}

      {ready && config && terms && billingReadiness && emailReadiness && fiscalReadiness && (
        <>
          {/* Section Navigation Tabs */}
          <div
            className="master-config-tabs"
            role="tablist"
            aria-label="Seções de configuração"
          >
            {SECTIONS.map((s, idx) => {
              const isSelected = activeSection === s.id
              return (
                <button
                  key={s.id}
                  ref={el => {
                    tabRefs.current[idx] = el
                  }}
                  id={`master-config-tab-${s.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`master-config-panel-${s.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  className="master-config-tab"
                  data-v33-config-section={s.id}
                  onClick={() => setActiveSection(s.id)}
                  onKeyDown={e => handleTabKeyDown(e, idx)}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Section 1: Identidade / Fiscal */}
          <section
            id="master-config-panel-identity"
            role="tabpanel"
            aria-labelledby="master-config-tab-identity"
            hidden={activeSection !== 'identity'}
            tabIndex={activeSection === 'identity' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <Building2 size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Identidade e Cadastro Fiscal
              </h3>
            </div>
            <p className="subtle">
              Dados cadastrais da operadora da plataforma para emissão de faturas e identificação legal.
            </p>

            <div className="master-config-grid">
              <div className="master-config-card">
                <span className="master-config-label">Nome Fantasia</span>
                <strong className="master-config-value">{config.trade_name}</strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Razão Social</span>
                <strong className="master-config-value">
                  {config.legal_name ?? 'Não informada'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">CNPJ</span>
                <strong className="master-config-value">
                  {config.tax_id ?? 'Não informado'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Endereço</span>
                <strong className="master-config-value">
                  {config.address_line ?? 'Não informado'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Cidade / UF</span>
                <strong className="master-config-value">
                  {config.city && config.state_code
                    ? `${config.city} - ${config.state_code}`
                    : config.city ?? config.state_code ?? 'Não informado'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">CEP</span>
                <strong className="master-config-value">
                  {config.postal_code ?? 'Não informado'}
                </strong>
              </div>
            </div>
          </section>

          {/* Section 2: Regras Comerciais */}
          <section
            id="master-config-panel-commercial"
            role="tabpanel"
            aria-labelledby="master-config-tab-commercial"
            hidden={activeSection !== 'commercial'}
            tabIndex={activeSection === 'commercial' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <Sliders size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Regras Comerciais Padrão
              </h3>
            </div>
            <p className="subtle">
              Parâmetros aplicados a novas assinaturas, ressalvadas condições expressas em contratos individuais.
            </p>

            <div className="master-config-grid">
              <div className="master-config-card">
                <span className="master-config-label">Período de Testes (Trial)</span>
                <strong className="master-config-value-lg">
                  {config.default_trial_days} dias
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Dia de Vencimento Padrão</span>
                <strong className="master-config-value-lg">
                  Dia {config.default_due_day}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Tolerância (Grace Period)</span>
                <strong className="master-config-value-lg">
                  {config.default_grace_days} dias
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Retenção Pós-Cancelamento</span>
                <strong className="master-config-value-lg">
                  {config.default_retention_days} dias
                </strong>
              </div>
            </div>

            <div className="callout">
              <strong>Isolamento contratual:</strong> Alterações futuras nestes parâmetros aplicam-se apenas a novos contratos ou renovações expressas, preservando snapshots de versões de planos vigentes.
            </div>
          </section>

          {/* Section 3: Cobrança / Encargos */}
          <section
            id="master-config-panel-billing"
            role="tabpanel"
            aria-labelledby="master-config-tab-billing"
            hidden={activeSection !== 'billing'}
            tabIndex={activeSection === 'billing' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <DollarSign size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Cobrança e Encargos da Plataforma
              </h3>
            </div>
            <p className="subtle">
              Padronização de numeração de faturas e canais de notificação.
            </p>

            <div className="master-config-grid">
              <div className="master-config-card">
                <span className="master-config-label">Prefixo das Faturas SaaS</span>
                <strong className="master-config-value-lg">{config.invoice_prefix}</strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Canal Principal de Cobrança</span>
                <strong className="master-config-value">
                  {formatCollectionChannel(config.primary_collection_channel)}
                </strong>
              </div>
            </div>

            <div className="callout">
              <strong>Conformidade e Limites Legais:</strong> Os encargos moratórios (juros e multa) são calculados conforme a minuta contratual e os limites estabelecidos pela legislação aplicável. Renegociações geram novos títulos sem sobrescrever o histórico da fatura originária.
            </div>
          </section>

          {/* Section 4: Comunicação */}
          <section
            id="master-config-panel-communications"
            role="tabpanel"
            aria-labelledby="master-config-tab-communications"
            hidden={activeSection !== 'communications'}
            tabIndex={activeSection === 'communications' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <Mail size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Canais Oficiais de Comunicação
              </h3>
            </div>
            <p className="subtle">
              Contatos divulgados aos clientes para emissão de cobranças e atendimento técnico.
            </p>

            <div className="master-config-grid">
              <div className="master-config-card">
                <span className="master-config-label">E-mail de Cobrança / Faturamento</span>
                <strong className="master-config-value">
                  {config.billing_email ?? 'Não informado'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">E-mail de Suporte</span>
                <strong className="master-config-value">
                  {config.support_email ?? 'Não informado'}
                </strong>
              </div>
              <div className="master-config-card">
                <span className="master-config-label">Telefone / WhatsApp de Suporte</span>
                <strong className="master-config-value">
                  {config.support_phone ?? 'Não informado'}
                </strong>
              </div>
            </div>

            <div className="callout">
              <strong>Governança de disparos:</strong> Envios transacionais operam exclusivamente no servidor via fila persistida e Edge Functions autenticadas, sem credenciais SMTP ou tokens de mensageria expostos no cliente.
            </div>
          </section>

          {/* Section 5: Termos e Privacidade */}
          <section
            id="master-config-panel-legal"
            role="tabpanel"
            aria-labelledby="master-config-tab-legal"
            hidden={activeSection !== 'legal'}
            tabIndex={activeSection === 'legal' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <FileText size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Termos de Uso e Políticas de Privacidade
              </h3>
            </div>
            <p className="subtle">
              Documentos jurídicos versionados por vigência determinística. Versões publicadas preservam histórico imutável.
            </p>

            {terms.length === 0 ? (
              <div className="callout" role="status">
                Nenhum termo versionado cadastrado.
              </div>
            ) : (
              <div
                className="finance-table"
                role="region"
                aria-label="Tabela de termos e políticas versionadas"
                tabIndex={activeSection === 'legal' ? 0 : -1}
              >
                <table>
                  <caption>
                    Histórico de versões de Termos de Serviço, Política de Privacidade e DPA
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Documento</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Versão</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Vigência a partir de</th>
                      <th scope="col">Vigência até</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map(t => (
                      <tr key={t.id}>
                        <th scope="row">{t.title}</th>
                        <td>{formatDocumentTypeLabel(t.document_type)}</td>
                        <td>
                          <code>{t.version_number}</code>
                        </td>
                        <td>{renderTermStatusBadge(t.status)}</td>
                        <td>{new Date(t.effective_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                          {t.valid_to
                            ? new Date(t.valid_to).toLocaleDateString('pt-BR')
                            : 'Indeterminada'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 6: Integrações */}
          <section
            id="master-config-panel-integrations"
            role="tabpanel"
            aria-labelledby="master-config-tab-integrations"
            hidden={activeSection !== 'integrations'}
            tabIndex={activeSection === 'integrations' ? 0 : -1}
            className="panel master-config-panel"
          >
            <div className="section-title">
              <h3>
                <Lock size={18} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} />
                Status das Integrações Externas
              </h3>
            </div>
            <p className="subtle">
              Controle declarativo de configuração dos serviços integrados. Credenciais e tokens de API permanecem estritamente no servidor e nunca são exibidos no frontend.
            </p>

            <div className="master-config-list">
              <div className="master-config-item">
                <div className="master-config-item-copy">
                  <h4>Gateway de Pagamentos (Billing Provider)</h4>
                  <p className="master-config-meta">
                    PIX, Boleto e Webhooks operam mediante provedor comercial homologado no servidor.
                  </p>
                </div>
                <div className="master-config-badges">
                  <span className={`status ${billingReadiness.badgeTone}`}>
                    {billingReadiness.badgeLabel}
                  </span>
                  <span className="status">
                    {billingReadiness.verificationNote}
                  </span>
                  {config.billing_provider_status === 'not_configured' && (
                    <span className="status">Pendente de homologação</span>
                  )}
                </div>
              </div>

              <div className="master-config-item">
                <div className="master-config-item-copy">
                  <h4>Serviço de E-mail Transacional</h4>
                  <p className="master-config-meta">
                    Envios de convites e lembretes operam via fila persistida no servidor.
                  </p>
                </div>
                <div className="master-config-badges">
                  <span className={`status ${emailReadiness.badgeTone}`}>
                    {emailReadiness.badgeLabel}
                  </span>
                  <span className="status">
                    {emailReadiness.verificationNote}
                  </span>
                </div>
              </div>

              <div className="master-config-item">
                <div className="master-config-item-copy">
                  <h4>Emissão Fiscal (NFS-e)</h4>
                  <p className="master-config-meta">
                    Integração com prefeituras para transmissão de notas fiscais de serviço.
                  </p>
                </div>
                <div className="master-config-badges">
                  <span className={`status ${fiscalReadiness.badgeTone}`}>
                    {fiscalReadiness.badgeLabel}
                  </span>
                  <span className="status">
                    {fiscalReadiness.verificationNote}
                  </span>
                </div>
              </div>
            </div>

            <div className="callout">
              <strong>Sem falsa prontidão:</strong> O valor <code>configured</code> reflete apenas registro declarativo na tabela <code>saas_platform_configuration</code> e não comprova conectividade operacional em tempo real.
            </div>
          </section>

          <p className="subtle">
            Última atualização registrada: {new Date(config.updated_at).toLocaleString('pt-BR')}. Modificações de configurações globais exigem RPC de governança administrativa aprovada com auditoria.
          </p>
        </>
      )}
    </div>
  )
}

