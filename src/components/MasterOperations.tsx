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
import { loadMasterTenants, type MasterTenant } from '../lib/master-console'
import {
  getActiveMasterSupportSession,
  startMasterSupportSession,
  endMasterSupportSession,
  type ActiveMasterSupportSession,
} from '../lib/master-support-sessions'

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

  // Support Sessions State (P1 Master Read-Only Support Sessions)
  const [supportOrgId, setSupportOrgId] = useState('')
  const [tenants, setTenants] = useState<MasterTenant[]>([])
  const [activeSession, setActiveSession] = useState<ActiveMasterSupportSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [sessionSuccess, setSessionSuccess] = useState('')
  const [sessionReason, setSessionReason] = useState('')
  const [sessionPending, setSessionPending] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  // Load tenants for selection in support tab
  useEffect(() => {
    if (activeTab !== 'support') return
    let live = true
    loadMasterTenants(client, 0)
      .then(res => {
        if (live && res.rows) {
          setTenants(res.rows)
          if (!supportOrgId && res.rows.length > 0) {
            setSupportOrgId(res.rows[0].organization_id)
          }
        }
      })
      .catch(() => {
        // Tenants list is optional convenience; manual input remains available
      })
    return () => {
      live = false
    }
  }, [client, activeTab, supportOrgId])

  // Query active session when organization changes
  useEffect(() => {
    if (activeTab !== 'support' || !supportOrgId.trim()) return
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(supportOrgId.trim())) return

    let live = true
    setSessionLoading(true)
    setSessionError('')

    getActiveMasterSupportSession(client, supportOrgId.trim())
      .then(session => {
        if (!live) return
        setActiveSession(session)
        if (session && session.seconds_remaining > 0) {
          setRemainingSeconds(session.seconds_remaining)
        } else {
          setRemainingSeconds(0)
        }
        setSessionLoading(false)
      })
      .catch((err: any) => {
        if (!live) return
        setSessionError(err?.message || 'Falha ao consultar sessão ativa de suporte.')
        setSessionLoading(false)
      })

    return () => {
      live = false
    }
  }, [client, activeTab, supportOrgId])

  // Countdown timer for active session
  useEffect(() => {
    if (!activeSession || remainingSeconds <= 0) return
    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setActiveSession(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeSession, remainingSeconds])

  async function handleStartSession(e: React.FormEvent) {
    e.preventDefault()
    setSessionError('')
    setSessionSuccess('')
    if (!supportOrgId.trim()) {
      setSessionError('Selecione ou informe o ID da Loja para abrir a sessão.')
      return
    }
    if (sessionReason.trim().length < 5 || sessionReason.trim().length > 500) {
      setSessionError('O motivo do acesso deve conter entre 5 e 500 caracteres.')
      return
    }

    setSessionPending(true)
    try {
      await startMasterSupportSession(client, {
        organizationId: supportOrgId.trim(),
        reason: sessionReason.trim(),
      })
      setSessionSuccess('Sessão de suporte iniciada com sucesso. Prazo fixo de 15 minutos (somente leitura).')
      setSessionReason('')
      // Refresh active session
      const freshSession = await getActiveMasterSupportSession(client, supportOrgId.trim())
      setActiveSession(freshSession)
      if (freshSession) {
        setRemainingSeconds(freshSession.seconds_remaining)
      }
    } catch (err: any) {
      setSessionError(err?.message || 'Falha ao iniciar sessão de suporte Master.')
    } finally {
      setSessionPending(false)
    }
  }

  async function handleEndSession() {
    if (!activeSession) return
    setSessionError('')
    setSessionSuccess('')
    setSessionPending(true)
    try {
      await endMasterSupportSession(client, {
        organizationId: activeSession.organization_id,
        sessionId: activeSession.id,
      })
      setActiveSession(null)
      setRemainingSeconds(0)
      setSessionSuccess('Sessão de suporte encerrada com sucesso sob auditoria.')
    } catch (err: any) {
      setSessionError(err?.message || 'Falha ao encerrar sessão de suporte Master.')
    } finally {
      setSessionPending(false)
    }
  }

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

      {/* Tab 3: Sessões de Suporte (Gestão de Sessão Temporária Somente Leitura) */}
      {activeTab === 'support' && (
        <section className="panel space-y-4">
          <div className="section-title">
            <h3 className="flex items-center gap-2">
              <LifeBuoy size={18} aria-hidden="true" />
              Sessões Temporárias de Suporte — Diretrizes de Segurança
            </h3>
            <span className="pill text-xs">Acesso Controlado / Somente Leitura (15 min)</span>
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

          {sessionError && (
            <p role="alert" className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-md text-xs font-mono">
              {sessionError}
            </p>
          )}

          {sessionSuccess && (
            <p role="status" className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md text-xs">
              {sessionSuccess}
            </p>
          )}

          <div className="space-y-4 border rounded-md p-4 bg-white">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield size={16} className="text-blue-600" aria-hidden="true" />
              Gestão de Sessão Temporária por Loja
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="support-org-select" className="block text-xs font-medium text-slate-700 mb-1">
                  Selecionar Loja (Diretório Master)
                </label>
                <select
                  id="support-org-select"
                  className="w-full text-xs border rounded p-2 bg-slate-50"
                  value={supportOrgId}
                  onChange={e => setSupportOrgId(e.target.value)}
                  disabled={sessionPending || Boolean(activeSession)}
                >
                  <option value="">Selecione uma Loja...</option>
                  {tenants.map(t => (
                    <option key={t.organization_id} value={t.organization_id}>
                      {t.organization_name} ({t.organization_number || t.organization_id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="support-org-id-input" className="block text-xs font-medium text-slate-700 mb-1">
                  ID da Loja (UUID da Organização)
                </label>
                <input
                  id="support-org-id-input"
                  type="text"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full text-xs font-mono border rounded p-2"
                  value={supportOrgId}
                  onChange={e => setSupportOrgId(e.target.value)}
                  disabled={sessionPending || Boolean(activeSession)}
                />
              </div>
            </div>

            {sessionLoading && (
              <p className="text-xs text-slate-500 py-2">Consultando status da sessão no servidor…</p>
            )}

            {/* Active Session Card */}
            {activeSession ? (
              <div className="border border-emerald-300 bg-emerald-50/50 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle size={14} /> Sessão Ativa (Somente Leitura)
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1 rounded border">
                    <Clock size={14} className="text-blue-600" />
                    Tempo restante: {Math.floor(remainingSeconds / 60)}m {String(remainingSeconds % 60).padStart(2, '0')}s
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">ID da Sessão:</span>{' '}
                    <span className="font-mono">{activeSession.id}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Loja (Org ID):</span>{' '}
                    <span className="font-mono">{activeSession.organization_id}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Escopo:</span>{' '}
                    <span className="font-mono bg-slate-200 px-1 rounded">{activeSession.scope}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Expiração:</span>{' '}
                    <span>{new Date(activeSession.expires_at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <div className="col-span-full">
                    <span className="font-semibold text-slate-900">Motivo registrado:</span>{' '}
                    <span>{activeSession.reason}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleEndSession}
                    disabled={sessionPending}
                    className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors inline-flex items-center gap-1.5"
                  >
                    <AlertTriangle size={14} />
                    {sessionPending ? 'Encerrando sessão…' : 'Encerrar Sessão de Suporte'}
                  </button>
                </div>
              </div>
            ) : (
              /* Start Session Form */
              <form onSubmit={handleStartSession} className="space-y-3 pt-2">
                <div>
                  <label htmlFor="support-reason" className="block text-xs font-medium text-slate-700 mb-1">
                    Motivo do Acesso de Suporte (obrigatório, auditado)
                  </label>
                  <textarea
                    id="support-reason"
                    rows={3}
                    placeholder="Descreva a justificativa operacional/técnica para abertura de sessão nesta Loja..."
                    value={sessionReason}
                    onChange={e => setSessionReason(e.target.value)}
                    disabled={sessionPending}
                    className="w-full text-xs border rounded p-2 focus:ring-1 focus:ring-blue-500"
                    maxLength={500}
                  />
                  <span className="text-[11px] text-slate-400">
                    {sessionReason.length}/500 caracteres (mínimo de 5 caracteres)
                  </span>
                </div>

                <div className="bg-slate-50 border rounded p-3 text-xs text-slate-600 space-y-1">
                  <p className="font-medium text-slate-800">
                    Condições do Acesso de Suporte Master:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>Prazo fixo no servidor: exatamente 15 minutos (sem renovação automática).</li>
                    <li>Escopo imutável: estritamente <code>read_only</code>.</li>
                    <li>Operação gravada em log de auditoria com vínculo imutável a <code>auth.uid()</code>.</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={sessionPending || sessionReason.trim().length < 5 || !supportOrgId.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {sessionPending ? 'Iniciando sessão…' : 'Iniciar Sessão Temporária (15 min)'}
                </button>
              </form>
            )}
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
