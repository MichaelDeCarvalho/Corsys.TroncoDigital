import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InstitutionalOperations } from './InstitutionalOperations'
import { MemberPayments } from './MemberPayments'
import { ManualCharges } from './ManualCharges'
import { loadFinancePage, formatDate, formatMoney, statusLabels, type FinanceRow } from '../lib/finance-data'

export function ContasReceber({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<'institutional' | 'memberPayments' | 'manualCharges'>('institutional')
  const [originFilter, setOriginFilter] = useState<'all' | 'member' | 'institutional'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ rows: FinanceRow[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setResult(null)
    setError('')

    const kind = originFilter === 'member' ? 'charges' : 'receivables'

    loadFinancePage(client, organizationId, kind, page, controller.signal, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then(data => { if (live) setResult(data) })
      .catch(() => { if (live) setError('Não foi possível carregar as contas a receber.') })

    return () => { live = false; controller.abort() }
  }, [client, organizationId, page, originFilter, startDate, endDate])

  return (
    <div className="contas-receber-view">
      <section className="panel">
        <div className="section-title">
          <h2>Contas a Receber — Recebíveis e Receitas Institucionais</h2>
        </div>
        <p className="subtle">
          Visão consolidada dos recebíveis de integrantes e receitas institucionais previstas. Os valores previstos não correspondem a dinheiro em caixa.
        </p>

        {/* KPIs */}
        <div className="metric-grid" style={{ margin: '1rem 0' }}>
          <article className="panel metric">
            <p className="eyebrow">Origem Integrantes</p>
            <strong>Cobranças de mensalidades e eventos</strong>
            <span className="subtle">Saldo aberto de integrantes</span>
          </article>
          <article className="panel metric">
            <p className="eyebrow">Receitas Institucionais</p>
            <strong>Doações e rendimentos</strong>
            <span className="subtle">Aporte institucional</span>
          </article>
          <article className="panel metric">
            <p className="eyebrow">Sem misturar com caixa</p>
            <strong>Valores previstos</strong>
            <span className="subtle">Disponibilidade somente pós-liquidação</span>
          </article>
        </div>

        {/* Filters */}
        <div className="finance-filters" role="search" aria-label="Filtros de contas a receber" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div className="filter-group">
            <label htmlFor="receivableOriginFilter" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Origem dos recebíveis</label>
            <select
              id="receivableOriginFilter"
              value={originFilter}
              onChange={e => { setOriginFilter(e.target.value as 'all' | 'member' | 'institutional'); setPage(0) }}
            >
              <option value="all">Todas as origens</option>
              <option value="member">Integrantes</option>
              <option value="institutional">Receitas Institucionais</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="receivable-start" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento de</label>
            <input
              id="receivable-start"
              type="date"
              data-date-target="receivable-start"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(0) }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="receivable-end" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento até</label>
            <input
              id="receivable-end"
              type="date"
              data-date-target="receivable-end"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(0) }}
            />
          </div>

          <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => { setOriginFilter('all'); setStartDate(''); setEndDate(''); setPage(0) }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Table */}
        {error ? (
          <p role="alert" className="message error">{error}</p>
        ) : !result ? (
          <p role="status">Consultando contas a receber…</p>
        ) : !result.rows.length ? (
          <p className="empty">Nenhum recebível encontrado para a consulta efetuada.</p>
        ) : (
          <div className="finance-table" role="region" aria-label="Resumo de contas a receber" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Descrição</th>
                  <th scope="col">Vencimento</th>
                  <th scope="col">Valor previsto</th>
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
        )}
      </section>

      {/* Tabs */}
      <div className="finance-sections" role="group" aria-label="Módulos de contas a receber" style={{ margin: '1rem 0' }}>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'institutional'}
          onClick={() => setActiveTab('institutional')}
        >
          Receitas Institucionais
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'memberPayments'}
          onClick={() => setActiveTab('memberPayments')}
        >
          Pagamentos de Integrantes
        </button>
        <button
          className="secondary"
          type="button"
          aria-pressed={activeTab === 'manualCharges'}
          onClick={() => setActiveTab('manualCharges')}
        >
          Cobranças Avulsas
        </button>
      </div>

      {activeTab === 'institutional' && <InstitutionalOperations key={`${organizationId}:receivable`} client={client} organizationId={organizationId} />}
      {activeTab === 'memberPayments' && <MemberPayments key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'manualCharges' && <ManualCharges key={organizationId} client={client} organizationId={organizationId} />}
    </div>
  )
}
