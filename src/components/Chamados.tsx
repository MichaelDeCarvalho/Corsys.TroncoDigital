import { useEffect, useRef, useState, useMemo, Fragment, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MessagesSquare,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  PlusCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  History,
} from 'lucide-react'
import {
  loadTenantTickets,
  loadTenantTicketMessages,
  createTenantSupportTicket,
  replyTenantSupportTicket,
  type TenantSupportTicket,
  type TenantTicketMessage,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../lib/support'

const categoryLabels: Record<SupportTicketCategory, string> = {
  finance: 'Financeiro',
  reports: 'Relatórios',
  access: 'Acesso',
  configuration: 'Configurações',
  billing: 'Cobrança',
  other: 'Outros',
}

const priorityLabels: Record<SupportTicketPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

const statusLabels: Record<SupportTicketStatus, string> = {
  new: 'Novo',
  triage: 'Em triagem',
  working: 'Em atendimento',
  waiting_client: 'Aguardando cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export function Chamados({
  client,
  organizationId,
}: {
  client: SupabaseClient
  organizationId: string
}) {
  const storageKey = `v35_tenant_ticket_search_${organizationId}`

  // Filters & Pagination with sessionStorage persistence across screens
  const [search, setSearch] = useState(() => {
    try {
      return sessionStorage.getItem(`v35_tenant_ticket_search_${organizationId}`) || ''
    } catch {
      return ''
    }
  })
  const [appliedSearch, setAppliedSearch] = useState(() => {
    try {
      return sessionStorage.getItem(`v35_tenant_ticket_search_${organizationId}`) || ''
    } catch {
      return ''
    }
  })
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'waiting_client' | 'resolved'>('all')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)

  // Persist search filter state to sessionStorage
  useEffect(() => {
    try {
      if (search) {
        sessionStorage.setItem(storageKey, search)
      } else {
        sessionStorage.removeItem(storageKey)
      }
    } catch {
      // Ignore storage errors
    }
  }, [search, storageKey])

  // Data
  const [tickets, setTickets] = useState<{ rows: TenantSupportTicket[]; hasNext: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Selected ticket for thread detail view
  const [selectedTicket, setSelectedTicket] = useState<TenantSupportTicket | null>(null)

  // Expanded ticket row ID for inline drawer details
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

  // Form State for New Ticket
  const [newSubject, setNewSubject] = useState('')
  const [newCategory, setNewCategory] = useState<SupportTicketCategory>('other')
  const [newPriority, setNewPriority] = useState<SupportTicketPriority>('medium')
  const [newMessage, setNewMessage] = useState('')
  const [formPending, setFormPending] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  const [formUncertain, setFormUncertain] = useState(false)
  const createIdempotencyKeyRef = useRef<string>(crypto.randomUUID())
  const submitGuard = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Load Tickets
  useEffect(() => {
    const controller = new AbortController()
    let live = true

    setLoading(true)
    setError('')

    loadTenantTickets(
      client,
      organizationId,
      page,
      { search: appliedSearch, statusFilter },
      controller.signal
    )
      .then(res => {
        if (live) {
          setTickets(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (live && !controller.signal.aborted) {
          setError(
            err?.message ||
              'Não foi possível consultar os chamados desta Loja. Verifique as permissões de acesso.'
          )
          setLoading(false)
        }
      })

    return () => {
      live = false
      controller.abort()
    }
  }, [client, organizationId, page, appliedSearch, statusFilter, revision])

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    setPage(0)
    setAppliedSearch(search.trim())
  }

  function handleClearFilters() {
    setSearch('')
    setAppliedSearch('')
    setStatusFilter('all')
    setPage(0)
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Ignore storage errors
    }
  }

  async function handleVerifyTicketCreated() {
    try {
      setLoading(true)
      const res = await loadTenantTickets(
        client,
        organizationId,
        0,
        { search: appliedSearch, statusFilter },
        new AbortController().signal
      )
      if (mounted.current) {
        setTickets(res)
        setLoading(false)
        const match = res.rows.find(
          t => t.subject.toLowerCase() === newSubject.trim().toLowerCase()
        )
        if (match) {
          setNewSubject('')
          setNewMessage('')
          setNewCategory('other')
          setNewPriority('medium')
          setFormSuccess(true)
          setFormUncertain(false)
          setFormError('')
          createIdempotencyKeyRef.current = crypto.randomUUID()
          setRevision(v => v + 1)
        } else {
          setFormError(
            'Consulta realizada: o chamado não foi localizado na lista do servidor. O formulário foi liberado para nova tentativa.'
          )
          setFormUncertain(false)
        }
      }
    } catch (err: any) {
      if (mounted.current) {
        setLoading(false)
        setFormError(
          'Não foi possível consultar a lista no servidor. Você pode usar a liberação manual se desejar tentar novamente.'
        )
      }
    }
  }

  async function handleCreateTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitGuard.current || formPending || formUncertain) return

    const form = e.currentTarget
    const values = new FormData(form)
    const subjectTrimmed = String(values.get('subject') || newSubject).trim()
    const messageTrimmed = String(values.get('message') || values.get('description') || newMessage).trim()

    if (!subjectTrimmed || !messageTrimmed) {
      setFormError('Informe o assunto e a descrição.')
      return
    }

    submitGuard.current = true
    setFormPending(true)
    setFormError('')
    setFormSuccess(false)
    setFormUncertain(false)

    try {
      await createTenantSupportTicket(client, {
        organizationId,
        subject: subjectTrimmed,
        category: newCategory,
        priority: newPriority,
        message: messageTrimmed,
        idempotencyKey: createIdempotencyKeyRef.current,
      })

      if (mounted.current) {
        form.reset()
        setNewSubject('')
        setNewMessage('')
        setNewCategory('other')
        setNewPriority('medium')
        setFormSuccess(true)
        setFormUncertain(false)
        createIdempotencyKeyRef.current = crypto.randomUUID()
        setRevision(v => v + 1)
      }
    } catch (err: any) {
      if (mounted.current) {
        // Safe treatment of network failures / unconfirmed results:
        // Do NOT clear form inputs. Mark as uncertain and block re-submit.
        setFormUncertain(true)
        setFormError(
          err?.message ||
            'Envio não confirmado pelo servidor. O envio foi bloqueado para evitar duplicação. Os campos foram preservados.'
        )
      }
    } finally {
      submitGuard.current = false
      if (mounted.current) {
        setFormPending(false)
      }
    }
  }

  // Derive counts from current loaded rows
  const currentRows = tickets?.rows ?? []
  const countOpen = currentRows.filter(t => ['new', 'triage', 'working', 'waiting_client'].includes(t.status)).length
  const countWaiting = currentRows.filter(t => t.status === 'waiting_client').length
  const countResolved = currentRows.filter(t => ['resolved', 'closed'].includes(t.status)).length

  // Instant real-time filtering across loaded rows by client, title/subject, or ID
  const displayedTickets = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return currentRows

    const cleanNum = term.replace(/^#/, '')
    const isNum = /^\d+$/.test(cleanNum)

    return currentRows.filter(ticket => {
      // 1. Match ID / ticket_seq / #seq / UUID
      if (isNum && String(ticket.ticket_seq) === cleanNum) return true
      if (ticket.id.toLowerCase().includes(term)) return true
      if (`#${ticket.ticket_seq}`.toLowerCase().includes(term)) return true

      // 2. Match Title / Subject
      if (ticket.subject.toLowerCase().includes(term)) return true

      // 3. Match Category / Client / Organization
      const catLabel = categoryLabels[ticket.category] || ''
      if (catLabel.toLowerCase().includes(term)) return true
      if (ticket.category.toLowerCase().includes(term)) return true
      if (ticket.organization_id && ticket.organization_id.toLowerCase().includes(term)) return true

      return false
    })
  }, [currentRows, search])

  return (
    <div className="space-y-6" id="view-chamados">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Atendimento da Loja</h2>
          <p className="text-sm text-slate-500">
            Abra, acompanhe e consulte o histórico de suporte da sua Loja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
            onClick={() => {
              setRevision(v => v + 1)
              setFormUncertain(false)
            }}
            aria-label="Atualizar lista de chamados"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Indicadores de chamados">
        <article className="panel metric">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Clock size={20} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Abertos</span>
          </div>
          <strong className="text-2xl font-bold text-slate-900">{countOpen}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Na amostra da página ativa</span>
        </article>

        <article className="panel metric">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertCircle size={20} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aguardando cliente
            </span>
          </div>
          <strong className="text-2xl font-bold text-slate-900">{countWaiting}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Precisam de retorno da Loja</span>
        </article>

        <article className="panel metric">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolvidos</span>
          </div>
          <strong className="text-2xl font-bold text-slate-900">{countResolved}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Concluídos e histórico</span>
        </article>
      </section>

      {/* Ticket Details View (when a ticket is clicked) */}
      {selectedTicket ? (
        <TicketDetails
          client={client}
          organizationId={organizationId}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => setRevision(v => v + 1)}
        />
      ) : (
        /* Grid with Table & Creation Form */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Table Column (2/3) */}
          <section className="panel space-y-4 lg:col-span-2">
            <div className="section-title">
              <h3>Meus chamados</h3>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              aria-label="Filtros de chamados"
            >
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="v34TenantTicketSearch"
                  type="text"
                  placeholder="Buscar por cliente, título ou ID (#seq / UUID)..."
                  aria-label="Buscar por cliente, título ou ID"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
                />
              </div>

              <div className="w-full sm:w-48">
                <select
                  id="v34TenantTicketStatus"
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value as any)
                    setPage(0)
                  }}
                  className="w-full py-2 px-3 text-sm border rounded-md"
                  aria-label="Filtrar por status"
                >
                  <option value="all">Todos os status</option>
                  <option value="open">Abertos</option>
                  <option value="waiting_client">Aguardando cliente</option>
                  <option value="resolved">Resolvidos</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" className="secondary px-4 py-2 text-sm">
                  Filtrar
                </button>
                {(appliedSearch || search || statusFilter !== 'all') && (
                  <button
                    type="button"
                    className="secondary px-3 py-2 text-sm text-slate-600"
                    onClick={handleClearFilters}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </form>

            {error && (
              <p role="alert" className="message error">
                {error}
              </p>
            )}

            {search.trim() && displayedTickets.length > 0 && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-md border border-amber-200 inline-flex items-center gap-2 font-medium transition-all duration-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Realce ativo: {displayedTickets.length} chamado(s) localizado(s) para "{search.trim()}".
                </p>
              </div>
            )}

            {loading ? (
              <p role="status" className="py-8 text-center text-slate-500 text-sm">
                Consultando chamados da Loja…
              </p>
            ) : !tickets || tickets.rows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <MessagesSquare size={36} className="mx-auto text-slate-300" aria-hidden="true" />
                <p className="font-medium text-slate-700">Nenhum chamado encontrado</p>
                <p className="text-xs text-slate-400">
                  {appliedSearch || statusFilter !== 'all'
                    ? 'Tente ajustar os filtros de busca.'
                    : 'Suas solicitações aparecerão nesta lista.'}
                </p>
              </div>
            ) : displayedTickets.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <MessagesSquare size={36} className="mx-auto text-slate-300" aria-hidden="true" />
                <p className="font-medium text-slate-700">Nenhum chamado encontrado na busca</p>
                <p className="text-xs text-slate-400">
                  Nenhum chamado atende ao termo "{search}".
                </p>
                <button
                  type="button"
                  className="secondary text-xs px-3 py-1.5 mt-2"
                  onClick={() => setSearch('')}
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-md" id="v34TenantTicketsTable">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Chamado</th>
                      <th className="py-3 px-3">Assunto</th>
                      <th className="py-3 px-3">Categoria</th>
                      <th className="py-3 px-3">Prioridade</th>
                      <th className="py-3 px-3">Abertura</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {displayedTickets.map(ticket => {
                      const isHighlighted = Boolean(search.trim())
                      const isExpanded = expandedTicketId === ticket.id
                      return (
                        <Fragment key={ticket.id}>
                          <tr
                            className={
                              isHighlighted
                                ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500 transition-all duration-300 shadow-2xs'
                                : 'hover:bg-slate-50 transition-colors'
                            }
                            data-search-highlight={isHighlighted ? 'true' : 'false'}
                          >
                            <td className="py-3 px-3 font-mono font-medium text-slate-900">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
                                  aria-label={
                                    isExpanded
                                      ? `Recolher detalhes do chamado #${ticket.ticket_seq}`
                                      : `Expandir detalhes do chamado #${ticket.ticket_seq}`
                                  }
                                  onClick={() =>
                                    setExpandedTicketId(prev => (prev === ticket.id ? null : ticket.id))
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronUp size={15} aria-hidden="true" />
                                  ) : (
                                    <ChevronDown size={15} aria-hidden="true" />
                                  )}
                                </button>
                                <span>#{ticket.ticket_seq}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900 max-w-xs truncate">
                              {ticket.subject}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {categoryLabels[ticket.category] ?? ticket.category}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 text-xs rounded-full border ${
                                  ticket.priority === 'urgent'
                                    ? 'bg-red-100 text-red-800 border-red-200/80 font-semibold'
                                    : ticket.priority === 'high'
                                    ? 'bg-amber-100 text-amber-900 border-amber-200/80 font-semibold'
                                    : ticket.priority === 'medium'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200/80 font-medium'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-medium'
                                }`}
                              >
                                {priorityLabels[ticket.priority] ?? ticket.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(ticket.opened_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                  ticket.status === 'waiting_client'
                                    ? 'bg-amber-100 text-amber-800'
                                    : ticket.status === 'resolved' || ticket.status === 'closed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {statusLabels[ticket.status] ?? ticket.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  className="secondary text-xs px-2.5 py-1.5"
                                  aria-label={`Detalhes do chamado #${ticket.ticket_seq}`}
                                  onClick={() =>
                                    setExpandedTicketId(prev => (prev === ticket.id ? null : ticket.id))
                                  }
                                >
                                  {isExpanded ? 'Ocultar' : 'Detalhes'}
                                </button>
                                <button
                                  type="button"
                                  className="secondary text-xs px-2.5 py-1.5"
                                  onClick={() => setSelectedTicket(ticket)}
                                >
                                  Ver conversa
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${ticket.id}-expansion`} className="bg-slate-50/90 border-b">
                              <td colSpan={7} className="p-4">
                                <div className="bg-white p-4 rounded-md border border-slate-200 shadow-2xs space-y-4 text-xs text-slate-700">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                                      <History size={16} className="text-blue-600" aria-hidden="true" />
                                      <span>
                                        Detalhes e Histórico de Atualizações · Chamado #{ticket.ticket_seq}
                                      </span>
                                    </div>
                                    <span className="text-slate-500 font-mono text-[11px]">
                                      ID da Loja: {ticket.organization_id}
                                    </span>
                                  </div>

                                  {/* Grid with Timeline and Attachments */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Timeline / Update History */}
                                    <div className="space-y-2 border-r-0 md:border-r md:pr-4 border-slate-200">
                                      <p className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                                        Histórico de Atualizações
                                      </p>
                                      <ul className="space-y-2 text-slate-600">
                                        <li className="flex items-start gap-2">
                                          <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                                          <div>
                                            <strong>Abertura do Chamado:</strong>{' '}
                                            {new Date(ticket.opened_at).toLocaleString('pt-BR')}
                                          </div>
                                        </li>
                                        <li className="flex items-start gap-2">
                                          <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                                          <div>
                                            <strong>Última Alteração Registrada:</strong>{' '}
                                            {new Date(ticket.updated_at).toLocaleString('pt-BR')}
                                          </div>
                                        </li>
                                        {ticket.resolved_at && (
                                          <li className="flex items-start gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                            <div>
                                              <strong>Resolução Concluída:</strong>{' '}
                                              {new Date(ticket.resolved_at).toLocaleString('pt-BR')}
                                            </div>
                                          </li>
                                        )}
                                        {ticket.closed_at && (
                                          <li className="flex items-start gap-2">
                                            <span className="w-2 h-2 rounded-full bg-slate-400 mt-1 shrink-0" />
                                            <div>
                                              <strong>Encerramento do Chamado:</strong>{' '}
                                              {new Date(ticket.closed_at).toLocaleString('pt-BR')}
                                            </div>
                                          </li>
                                        )}
                                      </ul>
                                    </div>

                                    {/* Attachments Section */}
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                                        <Paperclip size={14} className="text-slate-500" aria-hidden="true" />
                                        <span>Anexos e Documentos de Suporte</span>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded border border-slate-200/80 text-slate-500 text-xs">
                                        <p className="font-medium text-slate-700 mb-1">
                                          Documentos vinculados à solicitação:
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                          Nenhum arquivo anexado nesta abertura. Comprovantes e capturas de tela podem ser anexados ou consultados no histórico da conversa.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer Actions */}
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                    <button
                                      type="button"
                                      className="secondary text-xs px-3 py-1.5"
                                      onClick={() => setExpandedTicketId(null)}
                                    >
                                      Recolher painel
                                    </button>
                                    <button
                                      type="button"
                                      className="primary text-xs px-3 py-1.5"
                                      onClick={() => setSelectedTicket(ticket)}
                                    >
                                      Ver conversa completa
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 border-t text-sm text-slate-600">
              <span role="status">
                Página {page + 1}
                {tickets?.rows
                  ? search.trim()
                    ? ` · ${displayedTickets.length} de ${tickets.rows.length} chamados filtrados`
                    : ` · ${tickets.rows.length} chamados nesta página`
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="secondary px-3 py-1.5 text-xs inline-flex items-center gap-1"
                  disabled={page === 0 || loading}
                  onClick={() => setPage(v => Math.max(0, v - 1))}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  className="secondary px-3 py-1.5 text-xs inline-flex items-center gap-1"
                  disabled={!tickets?.hasNext || loading}
                  onClick={() => setPage(v => v + 1)}
                >
                  Próxima
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="subtle text-xs text-slate-400">
              Filtros e paginação executados no servidor com isolamento estrito da Loja.
            </p>
          </section>

          {/* New Ticket Form Column (1/3) */}
          <section className="panel space-y-4 lg:col-span-1">
            <div className="section-title">
              <h3 className="flex items-center gap-2">
                <PlusCircle size={18} aria-hidden="true" />
                Novo chamado
              </h3>
            </div>
            <p className="subtle text-xs">
              Conte como podemos ajudar a sua Loja.
            </p>

            <form
              onSubmit={handleCreateTicket}
              aria-label="Novo chamado"
              className="space-y-3"
            >
              <div>
                <label htmlFor="subject" className="block text-xs font-semibold text-slate-700 mb-1">
                  Assunto
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  maxLength={180}
                  placeholder="Resumo do chamado"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  disabled={formPending}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="category" className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    disabled={formPending}
                    className="w-full px-2 py-2 text-sm border rounded-md"
                  >
                    <option value="finance">Financeiro</option>
                    <option value="reports">Relatórios</option>
                    <option value="access">Acesso</option>
                    <option value="configuration">Configuração</option>
                    <option value="billing">Cobrança</option>
                    <option value="other">Outros</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-xs font-semibold text-slate-700 mb-1">
                    Prioridade
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    disabled={formPending}
                    className="w-full px-2 py-2 text-sm border rounded-md"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Descreva sua dúvida ou solicitação…"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  disabled={formPending}
                  className="w-full p-2.5 text-sm border rounded-md"
                />
              </div>

              {formSuccess && (
                <p role="status" className="message">
                  Chamado enviado com sucesso! A lista foi atualizada.
                </p>
              )}

              {formError && (
                <p role="alert" className="message error">
                  {formError}
                </p>
              )}

              {formUncertain && (
                <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 space-y-2" role="alert">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle size={15} className="text-amber-700" aria-hidden="true" />
                    Envio não confirmado com resposta autoritativa
                  </div>
                  <p>
                    O envio foi temporariamente <strong>bloqueado</strong> para evitar duplicação. O texto preenchido foi preservado.
                    Verifique se o chamado consta na lista do servidor antes de tentar novo envio.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      className="secondary w-full py-1 text-xs"
                      onClick={handleVerifyTicketCreated}
                    >
                      Verificar na lista se foi criado
                    </button>
                    <button
                      type="button"
                      className="secondary w-full py-1 text-xs text-amber-900 border-amber-300 hover:bg-amber-100"
                      onClick={() => {
                        setFormUncertain(false)
                        setFormError('')
                      }}
                    >
                      Confirmar que não foi criado e liberar novo envio
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="primary wide w-full py-2.5 text-sm font-medium"
                data-v34-tenant-new-ticket=""
                disabled={formPending || formUncertain}
              >
                {formPending ? 'Enviando…' : formUncertain ? 'Envio bloqueado (incerto)' : 'Enviar chamado'}
              </button>

              <p className="text-[11px] text-slate-400 text-center leading-tight">
                Operação com resposta autoritativa do banco. Em caso de instabilidade de rede, verifique a lista antes de reenviar.
              </p>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function TicketDetails({
  client,
  organizationId,
  ticket,
  onClose,
  onUpdated,
}: {
  client: SupabaseClient
  organizationId: string
  ticket: TenantSupportTicket
  onClose: () => void
  onUpdated: () => void
}) {
  const [messages, setMessages] = useState<TenantTicketMessage[] | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)
  const [replyUncertain, setReplyUncertain] = useState(false)

  const replyIdempotencyKeyRef = useRef<string>(crypto.randomUUID())
  const replyGuard = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function loadMessages() {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    loadTenantTicketMessages(client, organizationId, ticket.id, controller.signal)
      .then(res => {
        setMessages(res.messages)
        setIsTruncated(res.isTruncated)
        setLoading(false)
      })
      .catch((err: any) => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Não foi possível carregar as mensagens deste chamado.')
          setLoading(false)
        }
      })

    return controller
  }

  useEffect(() => {
    const controller = loadMessages()
    return () => {
      controller.abort()
    }
  }, [client, organizationId, ticket.id])

  async function handleVerifyReplyDelivered() {
    const textToCheck = replyText.trim().toLowerCase()
    try {
      setLoading(true)
      const res = await loadTenantTicketMessages(
        client,
        organizationId,
        ticket.id,
        new AbortController().signal
      )
      setMessages(res.messages)
      setIsTruncated(res.isTruncated)
      setLoading(false)

      const found = textToCheck && res.messages.some(m => m.body.toLowerCase().includes(textToCheck))
      if (found) {
        setReplyText('')
        setSendSuccess(true)
        setReplyUncertain(false)
        setSendError('')
        replyIdempotencyKeyRef.current = crypto.randomUUID()
      } else {
        setSendError('Consulta realizada: a mensagem não foi localizada no histórico. O formulário foi liberado para nova tentativa.')
        setReplyUncertain(false)
      }
    } catch (err: any) {
      setLoading(false)
      setSendError('Não foi possível atualizar a conversa. Utilize o botão de confirmação manual se desejar reenviar.')
    }
  }

  async function handleReplySubmit(e: FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || sending || replyGuard.current || replyUncertain) return

    replyGuard.current = true
    setSending(true)
    setSendError('')
    setSendSuccess(false)
    setReplyUncertain(false)

    let rpcSucceeded = false
    try {
      await replyTenantSupportTicket(client, {
        organizationId,
        ticketId: ticket.id,
        message: replyText.trim(),
        idempotencyKey: replyIdempotencyKeyRef.current,
      })

      rpcSucceeded = true
      setReplyText('')
      setSendSuccess(true)
      setReplyUncertain(false)
      replyIdempotencyKeyRef.current = crypto.randomUUID()
      onUpdated()
    } catch (err: any) {
      // Safe failure treatment: preserve replyText, mark as uncertain and block submit
      setReplyUncertain(true)
      setSendError(
        err?.message || 'Resposta não confirmada pelo servidor. O reenvio foi bloqueado para evitar duplicação.'
      )
      return
    } finally {
      replyGuard.current = false
      setSending(false)
    }

    if (rpcSucceeded) {
      try {
        const res = await loadTenantTicketMessages(
          client,
          organizationId,
          ticket.id,
          new AbortController().signal
        )
        setMessages(res.messages)
        setIsTruncated(res.isTruncated)
      } catch (reloadErr) {
        // Successful RPC, but history reload failed: do NOT mark creation as uncertain
        setSendError('Resposta enviada e confirmada pelo servidor. Clique em "Recarregar conversa" para atualizar a exibição.')
      }
    }
  }

  const isClosed = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="panel space-y-6" aria-label="Detalhes do chamado">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            onClick={onClose}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar aos chamados
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="font-mono text-slate-500">#{ticket.ticket_seq}</span>
              {ticket.subject}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Categoria: {categoryLabels[ticket.category] ?? ticket.category}</span>
              <span>·</span>
              <span>Prioridade: {priorityLabels[ticket.priority] ?? ticket.priority}</span>
              <span>·</span>
              <span>Aberto em: {new Date(ticket.opened_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        <span
          className={`inline-block px-3 py-1 text-xs rounded-full font-medium ${
            ticket.status === 'waiting_client'
              ? 'bg-amber-100 text-amber-800'
              : isClosed
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {statusLabels[ticket.status] ?? ticket.status}
        </span>
      </div>

      {/* Messages Thread */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <MessageCircle size={16} aria-hidden="true" />
            Histórico da conversa
          </h4>
          <button
            type="button"
            className="secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
            onClick={() => loadMessages()}
            aria-label="Recarregar histórico da conversa"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Recarregar conversa
          </button>
        </div>

        {isTruncated && (
          <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong>Atenção ao limite de consulta:</strong> Esta conversa atingiu o limite de 200 mensagens suportado nesta visão direta. Mensagens adicionais podem existir no histórico da plataforma. Para auditoria integral, contate o suporte.
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="message error">
            {error}
          </p>
        )}

        {loading ? (
          <p role="status" className="py-6 text-center text-slate-500 text-sm">
            Carregando histórico de mensagens…
          </p>
        ) : !messages || messages.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">Nenhuma mensagem registrada neste chamado.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto p-4 bg-slate-50 rounded-lg border">
            {messages.map(msg => {
              const isMe = msg.sender_kind === 'tenant_user'
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border rounded-bl-none'
                    }`}
                  >
                    <div
                      className={`text-xs mb-1 font-medium flex items-center justify-between gap-4 ${
                        isMe ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      <span>{isMe ? 'Loja (Você)' : 'Suporte Corsys'}</span>
                      <span>
                        {new Date(msg.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Form */}
      <form onSubmit={handleReplySubmit} className="space-y-3 pt-2" aria-label="Responder chamado">
        {isClosed && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            <strong>Atenção:</strong> Este chamado está marcado como{' '}
            {statusLabels[ticket.status].toLowerCase()}. Ao enviar uma nova mensagem, ele será
            automaticamente reaberto para atendimento da equipe.
          </div>
        )}

        <div>
          <label htmlFor="reply-message" className="block text-xs font-semibold text-slate-700 mb-1">
            Nova mensagem
          </label>
          <textarea
            id="reply-message"
            rows={3}
            maxLength={4000}
            required
            placeholder="Digite sua resposta ou esclarecimento…"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            disabled={sending}
            className="w-full p-2.5 text-sm border rounded-md"
          />
        </div>

        {sendSuccess && (
          <p role="status" className="message">
            Resposta enviada com sucesso!
          </p>
        )}
        {sendError && (
          <p role="alert" className="message error">
            {sendError}
          </p>
        )}

        {replyUncertain && (
          <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 space-y-2" role="alert">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={15} className="text-amber-700" aria-hidden="true" />
              Envio de resposta não confirmado pelo servidor
            </div>
            <p>
              O envio foi <strong>bloqueado</strong> para evitar duplicação. Seu texto permanece preservado acima.
            </p>
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                className="secondary w-full py-1 px-3 text-xs"
                onClick={handleVerifyReplyDelivered}
              >
                Recarregar conversa para verificar entrega
              </button>
              <button
                type="button"
                className="secondary w-full py-1 px-3 text-xs text-amber-900 border-amber-300 hover:bg-amber-100"
                onClick={() => {
                  setReplyUncertain(false)
                  setSendError('')
                }}
              >
                Confirmar que não foi enviada e liberar novo envio
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            className="primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            disabled={!replyText.trim() || sending || replyUncertain}
          >
            <Send size={14} aria-hidden="true" />
            {sending ? 'Enviando…' : replyUncertain ? 'Envio bloqueado (incerto)' : 'Enviar resposta'}
          </button>
        </div>
      </form>
    </div>
  )
}
