import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  Building2,
  FileText,
  Sliders,
  DollarSign,
  Mail,
  ShieldAlert,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import {
  loadPlatformConfiguration,
  loadPlatformTerms,
  type PlatformConfiguration,
  type PlatformTermVersion,
} from '../lib/master-config'

export function MasterPlatformConfig({ client }: { client: SupabaseClient }) {
  const [config, setConfig] = useState<PlatformConfiguration | null>(null)
  const [terms, setTerms] = useState<PlatformTermVersion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [revision, setRevision] = useState(0)
  const [activeSection, setActiveSection] = useState<
    'identity' | 'commercial' | 'billing' | 'communications' | 'legal' | 'integrations'
  >('identity')

  useEffect(() => {
    let live = true
    const controller = new AbortController()

    setLoading(true)
    setError('')
    setDenied(false)

    Promise.all([
      loadPlatformConfiguration(client, controller.signal),
      loadPlatformTerms(client, controller.signal),
    ])
      .then(([cfg, trm]) => {
        if (live) {
          setConfig(cfg)
          setTerms(trm)
          setLoading(false)
        }
      })
      .catch((err: any) => {
        if (!live || controller.signal.aborted) return
        const code = err?.code
        if (code === '42501' || code === '28000') {
          setDenied(true)
        } else {
          setError(
            err?.message ||
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

  return (
    <div className="space-y-6" id="view-master-config">
      {/* Title & Refresh */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Configurações da Plataforma
          </h2>
          <p className="text-sm text-slate-500">
            Parâmetros globais de governança, identidade, cobrança e termos do SaaS Corsys.
          </p>
        </div>
        <button
          type="button"
          className="secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm self-start md:self-auto"
          onClick={() => setRevision(v => v + 1)}
          aria-label="Atualizar configurações da plataforma"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Atualizar
        </button>
      </section>

      {denied && (
        <p role="alert" className="message error">
          Acesso restrito: sua autenticação requer papel MASTER e validação em dois fatores (MFA/AAL2).
        </p>
      )}

      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}

      {loading && !denied && (
        <p role="status" className="py-8 text-center text-slate-500 text-sm">
          Consultando configurações da plataforma sob governança Master…
        </p>
      )}

      {config && (
        <>
          {/* Section Navigation Tabs */}
          <div
            className="flex flex-wrap gap-2 border-b pb-2"
            role="tablist"
            aria-label="Seções de configuração"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'identity'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'identity'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="identity"
              onClick={() => setActiveSection('identity')}
            >
              Identidade / Fiscal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'commercial'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'commercial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="commercial"
              onClick={() => setActiveSection('commercial')}
            >
              Regras Comerciais
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'billing'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'billing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="billing"
              onClick={() => setActiveSection('billing')}
            >
              Cobrança / Encargos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'communications'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'communications'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="communications"
              onClick={() => setActiveSection('communications')}
            >
              Comunicação
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'legal'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'legal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="legal"
              onClick={() => setActiveSection('legal')}
            >
              Termos e Privacidade
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'integrations'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSection === 'integrations'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-v33-config-section="integrations"
              onClick={() => setActiveSection('integrations')}
            >
              Integrações
            </button>
          </div>

          {/* Section 1: Identidade / Fiscal */}
          {activeSection === 'identity' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <Building2 size={18} aria-hidden="true" />
                  Identidade e Cadastro Fiscal
                </h3>
              </div>
              <p className="subtle text-xs">
                Dados cadastrais da operadora da plataforma para emissão de faturas e identificação legal.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Nome Fantasia</span>
                  <strong className="text-slate-900">{config.trade_name || '—'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Razão Social</span>
                  <strong className="text-slate-900">{config.legal_name || 'Não informada'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">CNPJ</span>
                  <strong className="text-slate-900 font-mono">{config.tax_id || 'Não informado'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Endereço</span>
                  <strong className="text-slate-900">{config.address_line || 'Não informado'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Cidade / UF</span>
                  <strong className="text-slate-900">
                    {config.city ? `${config.city} - ${config.state_code}` : 'Não informado'}
                  </strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">CEP</span>
                  <strong className="text-slate-900 font-mono">{config.postal_code || 'Não informado'}</strong>
                </div>
              </div>
            </section>
          )}

          {/* Section 2: Regras Comerciais */}
          {activeSection === 'commercial' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <Sliders size={18} aria-hidden="true" />
                  Regras Comerciais Padrão
                </h3>
              </div>
              <p className="subtle text-xs">
                Parâmetros aplicados a novas assinaturas, ressalvadas condições expressas em contratos individuais.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Período de Testes (Trial)</span>
                  <strong className="text-slate-900 text-lg">{config.default_trial_days} dias</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Dia de Vencimento Padrão</span>
                  <strong className="text-slate-900 text-lg">Dia {config.default_due_day}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Tolerância (Grace Period)</span>
                  <strong className="text-slate-900 text-lg">{config.default_grace_days} dias</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Retenção Pós-Cancelamento</span>
                  <strong className="text-slate-900 text-lg">{config.default_retention_days} dias</strong>
                </div>
              </div>
            </section>
          )}

          {/* Section 3: Cobrança / Encargos */}
          {activeSection === 'billing' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <DollarSign size={18} aria-hidden="true" />
                  Cobrança e Encargos da Plataforma
                </h3>
              </div>
              <p className="subtle text-xs">
                Padronização de numeração de faturas e canais de notificação.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Prefixo das Faturas SaaS</span>
                  <strong className="text-slate-900 font-mono text-base">{config.invoice_prefix}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Canal Principal de Cobrança</span>
                  <strong className="text-slate-900 capitalize">
                    {config.primary_collection_channel === 'email_whatsapp'
                      ? 'E-mail + WhatsApp'
                      : config.primary_collection_channel}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-50 border rounded-md p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Conformidade e Limites Legais:</p>
                <p>
                  Os encargos moratórios (juros e multa) são calculados conforme a minuta contratual e os limites
                  estabelecidos pela legislação aplicável. Renegociações geram novos títulos sem sobrescrever
                  o histórico da fatura originária.
                </p>
              </div>
            </section>
          )}

          {/* Section 4: Comunicação */}
          {activeSection === 'communications' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <Mail size={18} aria-hidden="true" />
                  Canais Oficiais de Comunicação
                </h3>
              </div>
              <p className="subtle text-xs">
                Contatos divulgados aos clientes para emissão de cobranças e atendimento técnico.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">E-mail de Cobrança / Faturamento</span>
                  <strong className="text-slate-900 font-mono">{config.billing_email || 'Não informado'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">E-mail de Suporte</span>
                  <strong className="text-slate-900 font-mono">{config.support_email || 'Não informado'}</strong>
                </div>
                <div className="border rounded-md p-3 bg-slate-50">
                  <span className="text-xs text-slate-500 block font-medium">Telefone / WhatsApp de Suporte</span>
                  <strong className="text-slate-900 font-mono">{config.support_phone || 'Não informado'}</strong>
                </div>
              </div>
            </section>
          )}

          {/* Section 5: Termos e Privacidade */}
          {activeSection === 'legal' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <FileText size={18} aria-hidden="true" />
                  Termos de Uso e Políticas de Privacidade
                </h3>
              </div>
              <p className="subtle text-xs">
                Documentos jurídicos versionados por vigência determinística. Versões publicadas preservam histórico
                imutável.
              </p>

              {!terms || terms.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum termo versionado cadastrado.</p>
              ) : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3">Documento</th>
                        <th className="py-3 px-3">Versão</th>
                        <th className="py-3 px-3">Estado</th>
                        <th className="py-3 px-3">Vigência a partir de</th>
                        <th className="py-3 px-3">Vigência até</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {terms.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-900">{t.title}</td>
                          <td className="py-3 px-3 font-mono">{t.version_number}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                t.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : t.status === 'draft'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {t.status === 'published'
                                ? 'Publicado'
                                : t.status === 'draft'
                                ? 'Rascunho'
                                : 'Revogado'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {new Date(t.effective_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {t.valid_to ? new Date(t.valid_to).toLocaleDateString('pt-BR') : 'Indeterminada'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Section 6: Integrações */}
          {activeSection === 'integrations' && (
            <section className="panel space-y-4">
              <div className="section-title">
                <h3 className="flex items-center gap-2">
                  <Lock size={18} aria-hidden="true" />
                  Status das Integrações Externas
                </h3>
              </div>
              <p className="subtle text-xs">
                Controle de prontidão dos serviços integrados. Credenciais e tokens de API permanecem
                estritamente no servidor e nunca são exibidos no frontend.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Gateway de Pagamentos (Billing Provider)
                  </span>
                  <div className="flex items-center gap-2">
                    {config.billing_provider_status === 'configured' ? (
                      <>
                        <CheckCircle size={16} className="text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-emerald-800">Conectado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-amber-800">
                          {config.billing_provider_status === 'not_configured'
                            ? 'Pendente de homologação'
                            : config.billing_provider_status}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    PIX, Boleto e Webhooks aguardam definição de provedor comercial.
                  </p>
                </div>

                <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Serviço de E-mail Transacional
                  </span>
                  <div className="flex items-center gap-2">
                    {config.email_provider_status === 'configured' ? (
                      <>
                        <CheckCircle size={16} className="text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-emerald-800">Conectado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-amber-800">
                          {config.email_provider_status === 'not_configured'
                            ? 'Não configurado'
                            : config.email_provider_status}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Envios de convites e lembretes operam via fila persistida.
                  </p>
                </div>

                <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">
                    Emissão Fiscal (NFS-e)
                  </span>
                  <div className="flex items-center gap-2">
                    {config.fiscal_provider_status === 'configured' ? (
                      <>
                        <CheckCircle size={16} className="text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-emerald-800">Conectado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-amber-800">
                          {config.fiscal_provider_status === 'not_configured'
                            ? 'Não configurado'
                            : config.fiscal_provider_status}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Integração com prefeituras para notas fiscais de serviço.
                  </p>
                </div>
              </div>
            </section>
          )}

          <p className="subtle text-xs text-slate-400">
            Última atualização registrada: {new Date(config.updated_at).toLocaleString('pt-BR')}. Modificações de
            configurações globais exigem RPC de governança administrativa aprovada com auditoria.
          </p>
        </>
      )}
    </div>
  )
}
