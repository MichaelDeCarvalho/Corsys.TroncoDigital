import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate, formatMoney } from '../lib/finance-data'
import {
  CASH_FLOW_MOVEMENT_PAGE_SIZE,
  loadCashFlowMovementPage,
  type CashFlowMovementPage,
} from '../lib/cash-flow-movement-detail'

export function CashFlowMovementDetail({
  client, organizationId, from, to,
}: {
  client: SupabaseClient
  organizationId: string
  from: string
  to: string
}) {
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<CashFlowMovementPage | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let active = true
    const abort = new AbortController()
    setDetail(null)
    setError('')
    setDenied(false)
    loadCashFlowMovementPage(client, organizationId, from, to, page, abort.signal)
      .then(data => { if (active) setDetail(data) })
      .catch(failure => {
        if (!active) return
        if (['42501', '28000'].includes((failure as { code?: string } | null)?.code ?? '')) {
          setDenied(true)
        } else {
          setError('Não foi possível verificar a lista completa desta página de movimentações.')
        }
      })
    return () => { active = false; abort.abort() }
  }, [client, organizationId, from, to, page])

  return <section aria-label="Movimentações operacionais detalhadas" className="panel">
    <h3>Movimentações realizadas — detalhamento por conta</h3>
    <p className="subtle">Recebimentos, pagamentos e seus estornos efetivos. Transferências internas e saldos de abertura ficam fora do fluxo operacional. Este detalhe é paginado e não constitui um saldo ou total global.</p>
    {error && <p role="alert" className="message error">{error}</p>}
    {denied && <p role="alert" className="message error">Seu perfil não autoriza consultar estas movimentações.</p>}
    {!detail && !error && !denied && <p role="status">Consultando movimentos do período…</p>}
    {detail && <>
      {!detail.total ? <p>Nenhum movimento efetivo no período selecionado.</p> :
        <div className="finance-table" role="region" tabIndex={0} aria-label="Detalhamento de movimentos realizados">
          <table>
            <thead><tr>
              <th>Data</th><th>Descrição do evento</th><th>Conta financeira</th>
              <th>Referência</th><th>Entrada</th><th>Saída</th>
            </tr></thead>
            <tbody>{detail.rows.map(movement => <tr key={movement.key}>
              <td>{formatDate(movement.movementDate)}</td>
              <td>{movement.label}</td>
              <td>{movement.account}</td>
              <td><code>{movement.sourceId.slice(0, 8)}</code></td>
              <td>{movement.incoming ? formatMoney(movement.incoming) : '—'}</td>
              <td>{movement.outgoing ? formatMoney(movement.outgoing) : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <div className="finance-pagination">
        <button type="button" className="secondary" disabled={page === 0}
          onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span role="status">Página {page + 1} — {detail.total} movimentos no período (até {CASH_FLOW_MOVEMENT_PAGE_SIZE} nesta página)</span>
        <button type="button" className="secondary" disabled={!detail.hasNext}
          onClick={() => setPage(value => value + 1)}>Próxima</button>
      </div>
      <p className="subtle">A categoria e a descrição do lançamento de origem ainda exigem um modelo de consulta consolidada; não são inferidas do tipo do movimento. Os totais globais são apresentados apenas pelo relatório diário.</p>
    </>}
  </section>
}
