import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney, formatDate } from '../lib/finance-data'
import { loadFinancialDashboard, type DashboardValues } from '../lib/finance-dashboard'
import type { Page } from './AppShell'

export function FinancialDashboard({
  client,
  organizationId,
  onNavigate,
}: {
  client: SupabaseClient
  organizationId: string
  onNavigate?: (page: Page) => void
}) {
  const [values, setValues] = useState<DashboardValues | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let live = true
    setValues(null)
    setError('')
    setDenied(false)
    setLoading(true)
    loadFinancialDashboard(client, organizationId).then(data => {
      if (live) setValues(data)
    }).catch(cause => {
      if (!live) return
      const code = (cause as { code?: string } | null)?.code
      if (code === '42501' || code === '28000') setDenied(true)
      else setError('Os indicadores financeiros não puderam ser verificados. Valores não são exibidos.')
    }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [client, organizationId, revision])

  const metrics = values ? [
    ['Total a receber', values.receivables_open, 'Cobranças de integrantes e recebíveis institucionais em aberto', 'contas-receber' as Page, 'view-dashboard-A001'],
    ['A receber vencido', values.receivables_overdue, 'Somente vencimentos anteriores à data da consulta', 'inadimplencia' as Page, 'view-dashboard-A002'],
    ['Recebido no mês', values.received_this_month, 'Entradas operacionais menos estornos no mês corrente', 'fluxo-caixa' as Page, 'view-dashboard-A003'],
    ['Saldo das contas', values.cash_bank_balance, 'Caixa e bancos, sem implicar conciliação bancária', 'tesouraria' as Page, 'view-dashboard-A003'],
    ['Contas a pagar', values.payables_open, 'Obrigações institucionais em aberto', 'contas-pagar' as Page, 'view-dashboard-A004'],
    ['Contas a pagar vencidas', values.payables_overdue, 'Despesas vencidas ainda não liquidadas', 'contas-pagar' as Page, 'view-dashboard-A005'],
  ] as const : []

  return (
    <section aria-label="Indicadores financeiros da Loja">
      <div className="section-title">
        <h2>Indicadores financeiros</h2>
        <button className="quiet" type="button" onClick={() => setRevision(v => v + 1)} disabled={loading}>
          Atualizar indicadores
        </button>
      </div>
      {loading && <p role="status">Consultando indicadores financeiros…</p>}
      {denied && <p className="subtle">Os indicadores financeiros exigem autorização específica na Loja.</p>}
      {error && <p role="alert" className="message error">{error}</p>}
      {values && (
        <>
          <p className="subtle">
            Consolidado da Loja em {formatDate(values.as_of)}, calculado no banco. Obrigações não são recebimentos e recebimentos não são receita contábil adicional.
          </p>
          <div className="metric-grid">
            {metrics.map(([title, amount, description, targetPage]) => {
              const handleClick = () => {
                if (onNavigate) onNavigate(targetPage)
              }
              return (
                <article
                  key={title}
                  className="panel metric"
                  role={onNavigate ? 'button' : undefined}
                  tabIndex={onNavigate ? 0 : undefined}
                  onClick={handleClick}
                  onKeyDown={e => { if (onNavigate && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick() } }}
                  style={{ cursor: onNavigate ? 'pointer' : 'default', textAlign: 'left' }}
                  title={onNavigate ? `Ir para ${targetPage}` : undefined}
                >
                  <p>{title}</p>
                  <strong>{formatMoney(Number(amount))}</strong>
                  <p className="subtle">{description}</p>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
