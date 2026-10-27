import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LifeBuoy,
  Activity,
  Shield,
  Users,
  FileCheck,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { MasterSupportQueue } from './MasterSupportQueue'
import { loadPlatformJobs, type PlatformJob } from '../lib/master-config'

export function MasterOperations({ client }: { client: SupabaseClient }) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'health' | 'support' | 'team' | 'audit'>('tickets')
  const [jobs, setJobs] = useState<PlatformJob[] | null>(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobsRevision, setJobsRevision] = useState(0)

  useEffect(() => {
    if (activeTab !== 'health') return
    let live = true
    const controller = new AbortController()

    setJobsLoading(true)
    setJobsError('')

    loadPlatformJobs(client, controller.signal)
      .then(rows => {
        if (live) {
          setJobs(rows)
          setJobsLoading(false)
        }
      })
      .catch((err: any) => {
        if (!live || controller.signal.aborted) return
        setJobsError(
          err?.message ||
            'Não foi possível consultar os jobs da plataforma. Acesso restrito a MASTER/MFA.'
        )
        setJobsLoading(false)
      })

    return () => {
      live = false
      controller.abort()
    }
  }, [client, activeTab, jobsRevision])

  return (
    <div className="space-y-6" id="view-master-operacao">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Operação e Suporte Master
          </h2>
          <p className="text-sm text-slate-500">
            Fila de atendimento com resposta autorizada, consulta a jobs assíncronos e diretrizes operacionais.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-2 border-b pb-2"
        role="tablist"
        aria-label="Abas operacionais"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tickets'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'tickets'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          data-operation-tab="tickets"
          onClick={() => setActiveTab('tickets')}
        >
          Chamados (Operação Funcional)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'health'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'health'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          data-operation-tab="health"
          onClick={() => setActiveTab('health')}
        >
          Saúde / Jobs (Consulta sob demanda)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'support'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'support'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          data-operation-tab="support"
          onClick={() => setActiveTab('support')}
        >
          Sessões de Suporte (Informativo)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'team'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'team'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          data-operation-tab="team"
          onClick={() => setActiveTab('team')}
        >
          Equipe e Segurança (Governança)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audit'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          data-operation-tab="audit"
          onClick={() => setActiveTab('audit')}
        >
          Auditoria Master (Informativo)
        </button>
      </div>

      {/* Tab 1: Chamados (MasterSupportQueue - Operação Funcional e Escrita Autorizada) */}
      {activeTab === 'tickets' && <MasterSupportQueue client={client} />}

      {/* Tab 2: Saúde / Jobs (Consulta pontual sob demanda à tabela saas_jobs) */}
      {activeTab === 'health' && (
        <section className="panel space-y-4">
          <div className="section-title">
            <h3 className="flex items-center gap-2">
              <Activity size={18} aria-hidden="true" />
              Fila de Tarefas Assíncronas (Consulta pontual sob demanda)
            </h3>
            <button
              type="button"
              className="secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              onClick={() => setJobsRevision(v => v + 1)}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Atualizar lista de jobs
            </button>
          </div>
          <p className="subtle text-xs">
            Esta visualização realiza <strong>consultas pontuais sob demanda</strong> à tabela <code>saas_jobs</code> no
            banco de dados. Não constitui monitoramento contínuo em tempo real via streaming/WebSocket.
          </p>

          {jobsError && (
            <p role="alert" className="message error">
              {jobsError}
            </p>
          )}

          {jobsLoading ? (
            <p role="status" className="py-6 text-center text-slate-500 text-sm">
              Consultando tarefas assíncronas registradas no servidor…
            </p>
          ) : !jobs || jobs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Nenhum job pendente ou executado recentemente.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Tipo de Tarefa</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Tentativas</th>
                    <th className="py-3 px-3">Chave de Idempotência</th>
                    <th className="py-3 px-3">Último Erro</th>
                    <th className="py-3 px-3">Data de Criação</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900">{job.job_type}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            job.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : job.status === 'locked'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {job.attempts} / {job.max_attempts}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs max-w-xs truncate">
                        {job.idempotency_key}
                      </td>
                      <td className="py-3 px-3 text-red-600 font-mono text-xs">
                        {job.last_error_code || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(job.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Sessões de Suporte (Painel Informativo — Dependência de Backend) */}
      {activeTab === 'support' && (
        <section className="panel space-y-4">
          <div className="section-title">
            <h3 className="flex items-center gap-2">
              <LifeBuoy size={18} aria-hidden="true" />
              Sessões Temporárias de Suporte — Diretrizes de Segurança
            </h3>
            <span className="pill text-xs">Painel Informativo / Dependência de Backend</span>
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-950">
              <Info size={16} className="text-amber-700" aria-hidden="true" />
              Funcionalidade não implementada / Dependente de RPC de Backend (ADR 001)
            </div>
            <p>
              A abertura de sessões temporárias de suporte com emissão de token efêmero com expiração determinística
              e encerramento auditado <strong>não está disponível nesta interface</strong>. A funcionalidade depende
              da especificação e aplicação de RPC server-side autorizada.
            </p>
          </div>

          <div className="bg-slate-50 border rounded-md p-4 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">
              Boundary de Segurança e Imutabilidade Financeira:
            </p>
            <p>
              Conforme as diretrizes arquiteturais, o acesso Master não possui impersonação client-side. Sessões de
              suporte serão estritamente <strong>somente leitura (read_only)</strong>, motivadas e auditadas.
            </p>
            <p>
              A escrita financeira em contas de Lojas permanece tecnicamente proibida em todas as camadas de autorização.
            </p>
          </div>
        </section>
      )}

      {/* Tab 4: Equipe e Segurança (Painel de Governança) */}
      {activeTab === 'team' && (
        <section className="panel space-y-4">
          <div className="section-title">
            <h3 className="flex items-center gap-2">
              <Users size={18} aria-hidden="true" />
              Equipe da Plataforma e Diretrizes de Controle de Acesso
            </h3>
            <span className="pill text-xs">Governança</span>
          </div>
          <p className="subtle text-xs">
            A concessão de papéis da plataforma é gerenciada exclusivamente pelo banco de dados através de funções
            administrativas com exigência compulsória de MFA (AAL2).
          </p>

          <div className="border rounded-md p-4 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-blue-600" aria-hidden="true" />
              <strong className="text-slate-900 text-sm">Política de Least Privilege</strong>
            </div>
            <p className="text-xs text-slate-600">
              Papéis administrativos da Corsys são estritamente particionados em <code>MASTER</code>, <code>SUPPORT</code> e <code>BILLING</code>.
              Nenhum papel administrativo possui acesso irrestrito às contas bancárias ou credenciais privadas dos tenants.
            </p>
          </div>
        </section>
      )}

      {/* Tab 5: Auditoria Master (Painel Informativo — Dependência de Backend) */}
      {activeTab === 'audit' && (
        <section className="panel space-y-4">
          <div className="section-title">
            <h3 className="flex items-center gap-2">
              <FileCheck size={18} aria-hidden="true" />
              Trilha de Auditoria do Control Plane
            </h3>
            <span className="pill text-xs">Painel Informativo / Dependência de Backend</span>
          </div>

          <div className="bg-slate-50 border rounded-md p-4 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">
              Persistência Server-side e Status da Interface:
            </p>
            <p>
              Os eventos administrativos, alterações de planos, aprovações e ações da equipe são gravados
              de forma imutável no banco com <code>actor_user_id</code>, timestamp e chave de idempotência.
            </p>
            <p>
              A interface de consulta com filtros cronológicos, busca textual e exportação de logs de auditoria
              depende de RPC dedicada com controle de acesso, mantida como dependência técnica de homologação.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
