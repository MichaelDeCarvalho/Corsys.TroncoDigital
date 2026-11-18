import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney, formatDate } from '../lib/finance-data'
import { loadFinancialDashboard, type DashboardValues } from '../lib/finance-dashboard'
import type { Page } from './AppShell'

const METRIC_ITEMS = [
  ['Total a receber', 'receivables_open', 'Cobranças de integrantes e recebíveis institucionais em aberto', 'members', 'view-dashboard-A001'],
  ['A receber vencido', 'receivables_overdue', 'Somente vencimentos anteriores à data da consulta', 'inadimplencia', 'view-dashboard-A002'],
  ['Recebido no mês', 'received_this_month', 'Entradas operacionais menos estornos no mês corrente', 'fluxo-caixa', 'view-dashboard-A003-received'],
  ['Saldo das contas', 'cash_bank_balance', 'Caixa e bancos, sem implicar conciliação bancária', 'tesouraria', 'view-dashboard-A003'],
  ['Contas a pagar', 'payables_open', 'Obrigações institucionais em aberto', 'contas-pagar', 'view-dashboard-A004'],
  ['Contas a pagar vencidas', 'payables_overdue', 'Despesas vencidas ainda não liquidadas', 'contas-pagar', 'view-dashboard-A005'],
] as const

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

  const metrics = values
    ? METRIC_ITEMS.map(([title, key, description, targetPage, requirementId]) => [
        title,
        values[key],
        description,
        targetPage,
        requirementId,
      ] as const)
    : []

  return (
    <section aria-label="Indicadores financeiros da Loja">
      <div className="section-title">
        <h2>Indicadores financeiros</h2>
        <button className="quiet" type="button" onClick={() => setRevision(v => v + 1)} disabled={loading}>
          Atualizar indicadores
        </button>
      </div>
      {loading && (
        <>
          <p role="status" className="subtle">
            <span>Consultando indicadores financeiros…</span>{' '}
            <span aria-hidden="true">
              Calculado no banco. Obrigações não são recebimentos e recebimentos não são receita contábil adicional.
            </span>
          </p>
          <div
            className="metric-grid"
            aria-hidden="true"
            data-testid="financial-kpi-placeholders"
          >
            {METRIC_ITEMS.map(([title, , description, , requirementId]) => (
              <article
                key={requirementId}
                className="panel metric metric-placeholder"
                style={{
                  textAlign: 'left',
                  background: 'var(--panel-bg, inherit)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  width: '100%',
                  borderRadius: '6px',
                }}
              >
                <p>{title}</p>
                <strong>—</strong>
                <p className="subtle">{description}</p>
              </article>
            ))}
          </div>
        </>
      )}
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
              if (onNavigate) {
                return (
                  <button
                    key={title}
                    type="button"
                    className="panel metric"
                    onClick={handleClick}
                    style={{ cursor: 'pointer', textAlign: 'left', background: 'var(--panel-bg, inherit)', border: '1px solid var(--border-color, #e5e7eb)', width: '100%', borderRadius: '6px' }}
                    title={`Ir para ${targetPage}`}
                  >
                    <p>{title}</p>
                    <strong>{formatMoney(Number(amount))}</strong>
                    <p className="subtle">{description}</p>
                  </button>
                )
              }
              return (
                <article key={title} className="panel metric">
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
