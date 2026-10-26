import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InstitutionalOperations } from './InstitutionalOperations'
import { PayableApprovals } from './PayableApprovals'
import { ApprovalPolicies } from './ApprovalPolicies'
import { loadFinancePage, formatDate, formatMoney, statusLabels, type FinanceRow } from '../lib/finance-data'

export function ContasPagar({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<'operations' | 'approvals' | 'policies'>('operations')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [competence, setCompetence] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ rows: FinanceRow[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setResult(null)
    setError('')

    const mappedType = typeFilter === 'Fixa' ? 'fixed' : typeFilter === 'Variável' ? 'variable' : undefined
    const mappedStatus = statusFilter === 'Pendente' ? 'pending' : statusFilter === 'Pago' ? 'paid' : statusFilter === 'Vencido' ? 'overdue' : undefined

    loadFinancePage(client, organizationId, 'payables', page, controller.signal, {
      competence: competence || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      expenseClassification: mappedType,
      status: mappedStatus,
    })
      .then(data => { if (live) setResult(data) })
      .catch(() => { if (live) setError('Não foi possível carregar a lista de contas a pagar.') })

    return () => { live = false; controller.abort() }
  }, [client, organizationId, page, competence, startDate, endDate, typeFilter, statusFilter])

  return (
    <div className="contas-pagar-view">
      <section className="panel">
        <div className="section-title">
          <h2>Contas a Pagar — Obrigações Institucionais</h2>
        </div>
        <p className="subtle">
          Gestão de despesas institucionais fixas, variáveis e parceladas. Opcionalidades de aprovação e estorno dependem dos contratos do servidor.
        </p>

        {/* KPIs */}
        <div className="metric-grid" style={{ margin: '1rem 0' }}>
          <article className="panel metric">
            <p className="eyebrow">A pagar (nesta página)</p>
            <strong>
              {result ? (
                (() => {
                  const count = result.rows.filter(r => r.status !== 'cancelled' && r.openAmount > 0).length
                  return `${count} ${count === 1 ? 'obrigação' : 'obrigações'}`
                })()
              ) : '…'}
            </strong>
            <span className="subtle">Somente página atual ({result?.rows.length ?? 0} carregados)</span>
          </article>
          <article className="panel metric">
            <p className="eyebrow">Aprovação</p>
            <strong>Fila de alçada</strong>
            <span className="subtle">Verificação por políticas</span>
          </article>
          <article className="panel metric">
            <p className="eyebrow">Classificação</p>
            <strong>Por tipo de despesa</strong>
            <span className="subtle">Fixas e variáveis</span>
          </article>
        </div>

        {/* Filters */}
        <div className="finance-filters" role="search" aria-label="Filtros de contas a pagar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div className="filter-group">
            <label htmlFor="payableTypeFilter" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Tipo de obrigação</label>
            <select
              id="payableTypeFilter"
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
            >
              <option value="all">Todos os tipos</option>
              <option value="Fixa">Fixa</option>
              <option value="Variável">Variável</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="payableStatusFilter" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Situação</label>
            <select
              id="payableStatusFilter"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            >
              <option value="all">Todos os status</option>
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
              <option value="Vencido">Vencido</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="payable-start" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento de</label>
            <input
              id="payable-start"
              type="date"
              data-date-target="payable-start"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(0) }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="payable-end" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento até</label>
            <input
              id="payable-end"
              type="date"
              data-date-target="payable-end"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(0) }}
            />
          </div>

          <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setStartDate(''); setEndDate(''); setCompetence(''); setPage(0) }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Summary List / Table */}
        {error ? (
          <p role="alert" className="message error">{error}</p>
        ) : !result ? (
          <p role="status">Consultando contas a pagar…</p>
        ) : !result.rows.length ? (
          <p className="empty">Nenhuma conta a pagar encontrada para os filtros selecionados.</p>
        ) : (
          <>
            <div className="finance-table" role="region" aria-label="Resumo de contas a pagar" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Descrição</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Valor efetivo</th>
                    <th scope="col">Em aberto</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(row => (
                    <tr key={row.id}>
                      <th scope="row">{row.description}</th>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>{formatMoney(row.amount)}</td>
                      <td>{formatMoney(row.openAmount)}</td>
                      <td><span className="pill">{statusLabels[row.status] ?? row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="finance-pagination" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.75rem 0' }}>
              <button className="secondary" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
              <span role="status">Página {page + 1} ({result.rows.length} registros)</span>
              <button className="secondary" disabled={!result.hasNext} onClick={() => setPage(p => p + 1)}>Próxima</button>
            </div>
          </>
        )}
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="finance-sections" role="group" aria-label="Módulos de contas a pagar" style={{ margin: '1rem 0' }}>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'operations'}
          onClick={() => setActiveTab('operations')}
        >
          Operacional e Liquidação
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
        >
          Fila de Aprovação
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'policies'}
          onClick={() => setActiveTab('policies')}
        >
          Políticas de Alçada
        </button>
      </div>

      {activeTab === 'operations' && <InstitutionalOperations key={`${organizationId}:payable`} client={client} organizationId={organizationId} />}
      {activeTab === 'approvals' && <PayableApprovals key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'policies' && <ApprovalPolicies key={organizationId} client={client} organizationId={organizationId} />}
    </div>
  )
}
