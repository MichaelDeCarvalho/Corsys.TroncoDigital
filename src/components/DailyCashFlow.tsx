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
export function DailyCashFlow({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [from,setFrom]=useState(()=>today().slice(0,7)+'-01')
 const [to,setTo]=useState(()=>today())
 const [period,setPeriod]=useState(()=>({from:today().slice(0,7)+'-01',to:today()}))
 const [revision,setRevision]=useState(0)
 const [rows,setRows]=useState<DailyCashFlowRow[]|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
 useEffect(()=>{
  let active=true
  setRows(null);setError('');setDenied(false)
  loadDailyCashFlow(client,organizationId,period.from,period.to)
   .then(data=>{if(active)setRows(data)})
   .catch(failure=>{
    if(!active)return
    if(['42501','28000'].includes((failure as {code?:string}|null)?.code??''))setDenied(true)
    else setError('O fluxo de caixa não pôde ser calculado com integridade. Nenhum total parcial foi apresentado.')
   })
  return()=>{active=false}
 },[client,organizationId,period,revision])
 function search(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  const msStart=Date.parse(from+'T00:00:00.000Z'),msEnd=Date.parse(to+'T00:00:00.000Z')
  const days=(msEnd-msStart)/86400000+1
  if(!Number.isSafeInteger(days)||days<1||days>93){
   setError('Selecione de 1 a 93 dias consecutivos para consultar o fluxo.');return
  }
  setPeriod({from,to})
  setRevision(v=>v+1)
 }
 const metrics=rows?(()=>{
  const v=summarizeCashFlow(rows)
  return [
   ['Recebimentos realizados',v.received,'Entradas operacionais, já líquidas de estornos'],
   ['Pagamentos realizados',v.paid,'Saídas operacionais, já líquidas de estornos'],
   ['Fluxo realizado líquido',v.realized,'Recebimentos menos pagamentos; não é saldo bancário'],
   ['A receber pendente',v.receivables,'Cobranças e recebíveis em aberto por vencimento'],
   ['A pagar pendente',v.payables,'Obrigações em aberto por vencimento'],
   ['Projeção líquida pendente',v.projected,'Diferença entre valores a receber e a pagar, não caixa efetivo'],
  ] as const
 })():[]
 return <section className="panel" aria-label="Fluxo de caixa diário">
  <div className="section-title"><h2>Fluxo de caixa diário</h2>
   <button type="button" className="secondary" onClick={()=>setRevision(v=>v+1)}>Atualizar dados</button>
  </div>
  <p className="subtle">O realizado utiliza somente entradas e saídas operacionais efetivadas, incluindo estornos. Transferências internas e lançamentos de abertura não são receitas ou despesas. A projeção mostra valores ainda em aberto pela data de vencimento, calculados na consulta, sem hipótese de recebimento garantido.</p>
  <form aria-label="Filtrar fluxo de caixa" onSubmit={search}>
   <div className="member-form-grid">
    <div><label htmlFor="cash-flow-from">Data inicial</label>
     <input id="cash-flow-from" type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></div>
    <div><label htmlFor="cash-flow-to">Data final</label>
     <input id="cash-flow-to" type="date" value={to} onChange={e=>setTo(e.target.value)} required/></div>
   </div>
   <button className="secondary" type="submit">Consultar período</button>
  </form>
  {error&&<p role="alert" className="message error">{error}</p>}
  {denied&&<p role="alert" className="message error">Seu perfil ou assinatura não autoriza esta consulta financeira.</p>}
  {!rows&&!error&&!denied&&<p role="status">Calculando fluxo consolidado no banco…</p>}
  {rows&&<>
   <p className="subtle">Período de {formatDate(period.from)} a {formatDate(period.to)} ({rows.length} dias completos). O realizado é por data de movimento; valores pendentes são posição atual por vencimento, não saldo histórico daquela data.</p>
   <div className="metric-grid">
    {metrics.map(([label,value,description])=>
     <article className="panel metric" key={label}>
      <p>{label}</p><strong>{formatMoney(value)}</strong><p className="subtle">{description}</p>
     </article>)}
   </div>
   <div className="finance-table" role="region" tabIndex={0} aria-label="Movimentos e projeções por dia">
    <table><thead><tr><th>Dia</th><th>Entradas realizadas</th><th>Saídas realizadas</th><th>Fluxo líquido</th>
     <th>Integrantes a receber</th><th>Institucional a receber</th><th>Institucional a pagar</th><th>Projeção líquida</th></tr></thead>
     <tbody>{rows.map(row=><tr key={row.movement_day}>
      <th scope="row">{formatDate(row.movement_day)}</th>
      <td>{formatMoney(checkedSigned(row.received))}</td>
      <td>{formatMoney(checkedSigned(row.paid))}</td>
      <td>{formatMoney(checkedSigned(row.realized_net))}</td>
      <td>{formatMoney(checkedSigned(row.member_receivables_due))}</td>
      <td>{formatMoney(checkedSigned(row.institutional_receivables_due))}</td>
      <td>{formatMoney(checkedSigned(row.institution_payables_due))}</td>
      <td>{formatMoney(checkedSigned(row.projected_net))}</td>
     </tr>)}</tbody>
    </table>
   </div>
   <p className="subtle">Consulta completa de até 93 dias, sem somar páginas limitadas. Não confundir total a receber com recebimento provável ou projeção com saldo conciliado. Gráficos comparativos e filtros avançados do piloto V35 permanecem pendentes.</p>
  </>}
 </section>
}
