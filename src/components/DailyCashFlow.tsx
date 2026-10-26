import {useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadDailyCashFlow,summarizeCashFlow,type DailyCashFlowRow} from '../lib/daily-cash-flow'
import {formatDate,formatMoney} from '../lib/finance-data'
import {checkedSigned} from '../lib/treasury-balances'
const pad=(n:number)=>String(n).padStart(2,'0')
const today=()=>{
 const now=new Date()
 return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
}
export function DailyCashFlow({
  client,
  organizationId,
  viewMode = 'consolidado',
}: {
  client: SupabaseClient
  organizationId: string
  viewMode?: 'consolidado' | 'projetado' | 'movimentos' | 'saldo'
}) {
  const [from, setFrom] = useState(() => today().slice(0, 7) + '-01')
  const [to, setTo] = useState(() => today())
  const [period, setPeriod] = useState(() => ({ from: today().slice(0, 7) + '-01', to: today() }))
  const [revision, setRevision] = useState(0)
  const [rows, setRows] = useState<DailyCashFlowRow[] | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let active = true
    setRows(null)
    setError('')
    setDenied(false)
    loadDailyCashFlow(client, organizationId, period.from, period.to)
      .then(data => { if (active) setRows(data) })
      .catch(failure => {
        if (!active) return
        if (['42501', '28000'].includes((failure as { code?: string } | null)?.code ?? '')) setDenied(true)
        else setError('O fluxo de caixa não pôde ser calculated com integridade. Nenhum total parcial foi apresentado.')
      })
    return () => { active = false }
  }, [client, organizationId, period, revision])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const msStart = Date.parse(from + 'T00:00:00.000Z')
    const msEnd = Date.parse(to + 'T00:00:00.000Z')
    const days = (msEnd - msStart) / 86400000 + 1
    if (!Number.isSafeInteger(days) || days < 1 || days > 93) {
      setError('Selecione de 1 a 93 dias consecutivos para consultar o fluxo.')
      return
    }
    setPeriod({ from, to })
    setRevision(v => v + 1)
  }

  if (viewMode === 'saldo') {
    return (
      <section className="panel" aria-label="Saldo do fluxo de caixa">
        <div className="section-title">
          <h2>Saldo de Caixa e Bancos — Dependência de Conciliação</h2>
        </div>
        <div className="message subtle" style={{ padding: '1rem', background: 'var(--highlight, #f3f4f6)', borderRadius: '6px', margin: '1rem 0' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Visualização de saldos indisponível neste relatório</p>
          <p>
            Os saldos acumulados de caixa dependem dos registros de conciliação e extratos bancários da Tesouraria e não são calculados cumulativamente no navegador para evitar inconsistências contábeis.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}>
            Para consultar saldos de contas bancárias e fundos, utilize o módulo de <strong>Tesouraria</strong>.
          </p>
        </div>
      </section>
    )
  }

  const metrics = rows ? (() => {
    const v = summarizeCashFlow(rows)
    if (viewMode === 'movimentos') {
      return [
        ['Recebimentos realizados', v.received, 'Entradas operacionais, já líquidas de estornos'],
        ['Pagamentos realizados', v.paid, 'Saídas operacionais, já líquidas de estornos'],
        ['Fluxo realizado líquido', v.realized, 'Recebimentos menos pagamentos; não é saldo bancário'],
      ] as const
    }
    if (viewMode === 'projetado') {
      return [
        ['A receber pendente', v.receivables, 'Cobranças e recebíveis em aberto por vencimento'],
        ['A pagar pendente', v.payables, 'Obrigações em aberto por vencimento'],
        ['Projeção líquida pendente', v.projected, 'Diferença entre valores a receber e a pagar, não caixa efetivo'],
      ] as const
    }
    return [
      ['Recebimentos realizados', v.received, 'Entradas operacionais, já líquidas de estornos'],
      ['Pagamentos realizados', v.paid, 'Saídas operacionais, já líquidas de estornos'],
      ['Fluxo realizado líquido', v.realized, 'Recebimentos menos pagamentos; não é saldo bancário'],
      ['A receber pendente', v.receivables, 'Cobranças e recebíveis em aberto por vencimento'],
      ['A pagar pendente', v.payables, 'Obrigações em aberto por vencimento'],
      ['Projeção líquida pendente', v.projected, 'Diferença entre valores a receber e a pagar, não caixa efetivo'],
    ] as const
  })() : []

  return (
    <section className="panel" aria-label="Fluxo de caixa diário">
      <div className="section-title">
        <h2>
          {viewMode === 'movimentos' ? 'Fluxo de Caixa — Movimentos Realizados (Entradas × Saídas)' :
           viewMode === 'projetado' ? 'Fluxo de Caixa — Posição Projetada por Vencimento' :
           'Fluxo de caixa diário — Consolidado'}
        </h2>
        <button type="button" className="secondary" onClick={() => setRevision(v => v + 1)}>Atualizar dados</button>
      </div>
      <p className="subtle">
        {viewMode === 'movimentos'
          ? 'Visão focada exclusivamente nas entradas e saídas operacionais efetivadas no período.'
          : viewMode === 'projetado'
          ? 'Visão focada exclusivamente nas cobranças a receber e obrigações a pagar pendentes por vencimento.'
          : 'O realizado utiliza somente entradas e saídas operacionais efetivadas, incluindo estornos. Transferências internas e lançamentos de abertura não são receitas ou despesas. A projeção mostra valores ainda em aberto pela data de vencimento.'}
      </p>
      <form aria-label="Filtrar fluxo de caixa" onSubmit={search}>
        <div className="member-form-grid">
          <div>
            <label htmlFor="cash-flow-from">Data inicial</label>
            <input id="cash-flow-from" type="date" value={from} onChange={e => setFrom(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="cash-flow-to">Data final</label>
            <input id="cash-flow-to" type="date" value={to} onChange={e => setTo(e.target.value)} required />
          </div>
        </div>
        <button className="secondary" type="submit">Consultar período</button>
      </form>
      {error && <p role="alert" className="message error">{error}</p>}
      {denied && <p role="alert" className="message error">Seu perfil ou assinatura não autoriza esta consulta financeira.</p>}
      {!rows && !error && !denied && <p role="status">Calculando fluxo no banco…</p>}
      {rows && (
        <>
          <p className="subtle">Período de {formatDate(period.from)} a {formatDate(period.to)} ({rows.length} dias completos).</p>
          <div className="metric-grid">
            {metrics.map(([label, value, description]) => (
              <article className="panel metric" key={label}>
                <p>{label}</p>
                <strong>{formatMoney(value)}</strong>
                <p className="subtle">{description}</p>
              </article>
            ))}
          </div>
          <div className="finance-table" role="region" tabIndex={0} aria-label="Movimentos do fluxo de caixa">
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  {(viewMode === 'consolidado' || viewMode === 'movimentos') && <th>Entradas realizadas</th>}
                  {(viewMode === 'consolidado' || viewMode === 'movimentos') && <th>Saídas realizadas</th>}
                  {(viewMode === 'consolidado' || viewMode === 'movimentos') && <th>Fluxo líquido</th>}
                  {(viewMode === 'consolidado' || viewMode === 'projetado') && <th>Integrantes a receber</th>}
                  {(viewMode === 'consolidado' || viewMode === 'projetado') && <th>Institucional a receber</th>}
                  {(viewMode === 'consolidado' || viewMode === 'projetado') && <th>Institucional a pagar</th>}
                  {(viewMode === 'consolidado' || viewMode === 'projetado') && <th>Projeção líquida</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.movement_day}>
                    <th scope="row">{formatDate(row.movement_day)}</th>
                    {(viewMode === 'consolidado' || viewMode === 'movimentos') && <td>{formatMoney(checkedSigned(row.received))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'movimentos') && <td>{formatMoney(checkedSigned(row.paid))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'movimentos') && <td>{formatMoney(checkedSigned(row.realized_net))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'projetado') && <td>{formatMoney(checkedSigned(row.member_receivables_due))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'projetado') && <td>{formatMoney(checkedSigned(row.institutional_receivables_due))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'projetado') && <td>{formatMoney(checkedSigned(row.institution_payables_due))}</td>}
                    {(viewMode === 'consolidado' || viewMode === 'projetado') && <td>{formatMoney(checkedSigned(row.projected_net))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle">Consulta completa de até 93 dias, sem somar páginas limitadas. Não confundir total a receber com recebimento provável ou projeção com saldo conciliado.</p>
        </>
      )}
    </section>
  )
}
