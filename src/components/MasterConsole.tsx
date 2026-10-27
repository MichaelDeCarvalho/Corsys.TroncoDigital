import { useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate } from '../lib/finance-data'
import { MasterCommercialCatalog } from './MasterCommercialCatalog'
import { MasterOperations } from './MasterOperations'
import { MasterBilling } from './MasterBilling'
import { MasterOnboarding } from './MasterOnboarding'
import { MasterClient360 } from './MasterClient360'
import { MasterPlatformConfig } from './MasterPlatformConfig'
import {
  loadMasterOverview,
  loadMasterTenants,
  type MasterOverview,
  type MasterTenant,
  type MasterTenantFilters,
  DEFAULT_MASTER_TENANT_FILTERS,
} from '../lib/master-console'
import {
  ShieldCheck,
  Building2,
  DollarSign,
  Package,
  Headphones,
  Settings,
  Plus,
  Users,
  Search,
} from 'lucide-react'

export function MasterConsole({ client }: { client: SupabaseClient }) {
  const [overview, setOverview] = useState<MasterOverview | null>(null)
  const [tab, setTab] = useState<
    'overview' | 'commercial' | 'support' | 'billing' | 'onboarding' | 'client360' | 'config' | 'clients'
  >('overview')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'past_due'>('all')
  const [plan, setPlan] = useState('')
  const [filters, setFilters] = useState<MasterTenantFilters>(DEFAULT_MASTER_TENANT_FILTERS)
  const [tenants, setTenants] = useState<{ rows: MasterTenant[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let live = true
    setOverview(null)
    setTenants(null)
    setError('')
    setDenied(false)

    Promise.all([loadMasterOverview(client), loadMasterTenants(client, page, filters)])
      .then(([o, t]) => {
        if (live) {
          setOverview(o)
          setTenants(t)
        }
      })
      .catch(cause => {
        if (!live) return
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') setDenied(true)
        else
          setError(
            'Não foi possível validar a consulta do Master SaaS. Os dados permaneceram ocultos.'
          )
      })

    return () => {
      live = false
    }
  }, [client, page, revision, filters])

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    setFilters({ search: search.trim(), status, plan: plan.trim() })
  }

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setPlan('')
    setPage(0)
    setFilters({ search: '', status: 'all', plan: '' })
  }

  const metrics = overview
    ? ([
        ['Lojas cadastradas', overview.tenants_total],
        ['Lojas ativas', overview.tenants_active],
        ['Lojas inativas', overview.tenants_other],
        ['Assinaturas ativas ou teste', overview.subscriptions_active_or_trial],
        ['Assinaturas em atraso', overview.subscriptions_past_due],
        ['Chamados abertos', overview.support_tickets_open],
        ['Rascunhos de plano', overview.plan_drafts],
      ] as const)
    : []

  return (
    <section aria-label="Master SaaS — visão geral" className="space-y-6">
      <div className="section-title">
        <h2>Painel Master SaaS</h2>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setPage(0)
            setRevision(v => v + 1)
          }}
        >
          Atualizar plataforma
        </button>
      </div>

      <p className="subtle">
        Acesso exclusivo de administrador da plataforma com MFA (AAL2). Esta área é separada dos dados e das
        permissões financeiras das Lojas. Somente leitura nesta etapa; não há sessão de suporte nem impersonação de cliente.
      </p>

      {denied && (
        <p role="alert" className="message error">
          Sua autenticação não possui autorização Master com MFA ativo. Os dados não estão disponíveis.
        </p>
      )}

      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}

      {!overview && !error && !denied && <p role="status">Validando Master e consultando indicadores…</p>}

      {overview && tenants && (
        <>
          {/* V35 6 Primary Navigation Views */}
          <div className="finance-sections" role="group" aria-label="Áreas do Master SaaS">
            <button
              className="secondary"
              aria-pressed={tab === 'overview'}
              onClick={() => setTab('overview')}
            >
              Visão geral
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'clients'}
              onClick={() => setTab('clients')}
            >
              Clientes SaaS
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'commercial'}
              onClick={() => setTab('commercial')}
            >
              Planos e ofertas
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'billing'}
              onClick={() => setTab('billing')}
            >
              Cobrança SaaS
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'support'}
              onClick={() => setTab('support')}
            >
              Operação e suporte
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'config'}
              onClick={() => setTab('config')}
            >
              Configurações
            </button>

            {/* Quick access tabs for backward compatibility with existing tests */}
            <button
              className="secondary"
              aria-pressed={tab === 'onboarding'}
              onClick={() => setTab('onboarding')}
            >
              Implantação de Lojas
            </button>
            <button
              className="secondary"
              aria-pressed={tab === 'client360'}
              onClick={() => setTab('client360')}
            >
              Cliente 360°
            </button>
          </div>

          {/* VIEW 1: view-master (Painel Master SaaS) */}
          {tab === 'overview' && (
            <div className="space-y-6" id="view-master">
              <p className="subtle">
                Indicadores da plataforma em {formatDate(overview.as_of)}. Não representam faturamento recebido.
              </p>

              {/* KPIs */}
              <div className="metric-grid">
                {metrics.map(([label, value]) => (
                  <article className="panel metric" key={label}>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>

              {/* Actions Requiring Attention & Fast Shortcuts */}
              <section className="panel space-y-3" aria-label="Ações rápidas da Plataforma">
                <div className="section-title">
                  <h3>Ações Rápidas do Master</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                    data-v34-onboarding=""
                    onClick={() => setTab('onboarding')}
                  >
                    <Plus size={16} aria-hidden="true" />
                    + Novo cliente
                  </button>
                  <button
                    type="button"
                    className="secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                    onClick={() => setTab('client360')}
                  >
                    <Users size={16} aria-hidden="true" />
                    Cliente 360º
                  </button>
                  <button
                    type="button"
                    className="secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                    onClick={() => setTab('support')}
                  >
                    <Headphones size={16} aria-hidden="true" />
                    Fila de Suporte
                  </button>
                </div>
              </section>

              {/* Directory with Search & Tenant List */}
              <TenantDirectorySection
                search={search}
                setSearch={setSearch}
                status={status}
                setStatus={setStatus}
                plan={plan}
                setPlan={setPlan}
                submitFilters={submitFilters}
                clearFilters={clearFilters}
                tenants={tenants}
                page={page}
                setPage={setPage}
                onSelectClient360={() => setTab('client360')}
                onSelectSupport={() => setTab('support')}
              />

              <div className="bg-slate-50 border rounded-md p-4 text-xs text-slate-600">
                <strong>Boundary de segurança:</strong> status comercial, billing e suporte pertencem ao control
                plane. Para consultar dados internos de uma Loja, o Master abre uma sessão temporária somente leitura,
                informa motivo e gera auditoria. Escrita financeira por suporte continua bloqueada.
              </div>
            </div>
          )}

          {/* VIEW 2: view-master-clientes (Clientes SaaS) */}
          {tab === 'clients' && (
            <div className="space-y-6" id="view-master-clientes">
              <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Clientes SaaS e Implantação</h3>
                  <p className="text-sm text-slate-500">
                    Diretório completo de organizações, onboarding transacional e panorama consolidado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                    data-v34-onboarding=""
                    onClick={() => setTab('onboarding')}
                  >
                    <Plus size={16} aria-hidden="true" />
                    + Novo cliente
                  </button>
                </div>
              </section>

              <TenantDirectorySection
                search={search}
                setSearch={setSearch}
                status={status}
                setStatus={setStatus}
                plan={plan}
                setPlan={setPlan}
                submitFilters={submitFilters}
                clearFilters={clearFilters}
                tenants={tenants}
                page={page}
                setPage={setPage}
                onSelectClient360={() => setTab('client360')}
                onSelectSupport={() => setTab('support')}
              />
            </div>
          )}

          {/* VIEW 3: view-master-cobranca (Cobrança SaaS) */}
          {tab === 'billing' && (
            <div id="view-master-cobranca">
              <MasterBilling client={client} tenants={tenants.rows} />
            </div>
          )}

          {/* VIEW 4: view-master-planos (Planos e Ofertas) */}
          {tab === 'commercial' && (
            <div id="view-master-planos">
              <MasterCommercialCatalog client={client} />
            </div>
          )}

          {/* VIEW 5: view-master-operacao (Operação e Suporte) */}
          {tab === 'support' && (
            <div id="view-master-operacao">
              <MasterOperations client={client} />
            </div>
          )}

          {/* VIEW 6: view-master-config (Configurações da Plataforma) */}
          {tab === 'config' && (
            <div id="view-master-config">
              <MasterPlatformConfig client={client} />
            </div>
          )}

          {/* Direct Sub-Views */}
          {tab === 'onboarding' && <MasterOnboarding client={client} />}
          {tab === 'client360' && <MasterClient360 client={client} tenants={tenants.rows} />}
        </>
      )}
    </section>
  )
}

function TenantDirectorySection({
  search,
  setSearch,
  status,
  setStatus,
  plan,
  setPlan,
  submitFilters,
  clearFilters,
  tenants,
  page,
  setPage,
  onSelectClient360,
  onSelectSupport,
}: {
  search: string
  setSearch: (v: string) => void
  status: 'all' | 'active' | 'past_due'
  setStatus: (v: 'all' | 'active' | 'past_due') => void
  plan: string
  setPlan: (v: string) => void
  submitFilters: (e: FormEvent<HTMLFormElement>) => void
  clearFilters: () => void
  tenants: { rows: MasterTenant[]; hasNext: boolean }
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  onSelectClient360: () => void
  onSelectSupport: () => void
}) {
  return (
    <section className="panel space-y-4">
      <h3>Diretório de Lojas</h3>
      <form aria-label="Filtrar clientes SaaS" onSubmit={submitFilters}>
        <div className="member-form-grid">
          <div>
            <label htmlFor="master-search-client">Buscar cliente</label>
            <input
              id="master-search-client"
              placeholder="Nome, número, cidade ou contato"
              value={search}
              maxLength={100}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="master-search-status">Status comercial</label>
            <select
              id="master-search-status"
              value={status}
              onChange={e => setStatus(e.target.value as 'all' | 'active' | 'past_due')}
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="past_due">Em atraso</option>
            </select>
          </div>
          <div>
            <label htmlFor="master-search-plan">Plano comercial</label>
            <input
              id="master-search-plan"
              maxLength={100}
              value={plan}
              placeholder="Nome ou código do plano"
              onChange={e => setPlan(e.target.value)}
            />
          </div>
        </div>
        <div className="finance-sections">
          <button type="submit" className="secondary">
            Aplicar filtros
          </button>
          <button type="button" className="secondary" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      </form>

      <p className="subtle text-xs">
        Busca processada no banco sob autorização MASTER/MFA, inclusive por cidade e contato. Resultado paginado;
        não equivale ao cadastro completo de todos os clientes da plataforma.
      </p>

      {!tenants.rows.length ? (
        <p>Nenhuma Loja encontrada nesta página.</p>
      ) : (
        <div className="finance-table" role="region" aria-label="Lojas Master" tabIndex={0} id="masterClientTable">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Nº</th>
                <th>Situação</th>
                <th>Assinatura</th>
                <th>Plano</th>
                <th>Chamados abertos</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.rows.map(row => (
                <tr key={row.organization_id}>
                  <th scope="row">{row.organization_name}</th>
                  <td>{row.organization_number ?? '—'}</td>
                  <td>{row.organization_status}</td>
                  <td>{row.subscription_status}</td>
                  <td>{row.plan_name}</td>
                  <td>{row.open_support_tickets}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="secondary text-xs px-2 py-1"
                        data-client360={row.organization_id}
                        onClick={onSelectClient360}
                      >
                        Cliente 360º
                      </button>
                      <button
                        type="button"
                        className="secondary text-xs px-2 py-1"
                        data-v32-support={row.organization_id}
                        onClick={onSelectSupport}
                      >
                        Suporte
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="finance-pagination">
        <button className="secondary" disabled={page === 0} onClick={() => setPage(v => v - 1)}>
          Anterior
        </button>
        <span role="status">
          Página {page + 1} — {tenants.rows.length} Lojas
        </span>
        <button className="secondary" disabled={!tenants.hasNext} onClick={() => setPage(v => v + 1)}>
          Próxima
        </button>
      </div>

      <p className="subtle text-xs">
        Cadastro, planos comerciais, cobranças SaaS e suporte Master têm fluxos separados com autorização e
        auditoria. Nenhum valor de contrato é alterado pelos filtros deste painel.
      </p>
    </section>
  )
}
