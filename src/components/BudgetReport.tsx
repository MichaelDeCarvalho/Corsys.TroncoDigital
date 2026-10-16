import { useEffect,useRef,useState,type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney } from '../lib/finance-data'
import {
 loadBudgetCatalog,loadBudgetLines,validMonth,budgetExecution,
 type BudgetKind,type BudgetRow,
} from '../lib/budget-report'
import { checkedSigned } from '../lib/treasury-balances'
type Catalog=Awaited<ReturnType<typeof loadBudgetCatalog>>
export function BudgetReport({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [catalog,setCatalog]=useState<Catalog|null>(null)
 const [cycle,setCycle]=useState(''),[month,setMonth]=useState('')
 const [kind,setKind]=useState<BudgetKind>('account')
 const [rows,setRows]=useState<BudgetRow[]|null>(null)
 const [error,setError]=useState(''),[loading,setLoading]=useState(false)
 const [revision,setRevision]=useState(0)
 const sequence=useRef(0)
 const ongoing=useRef<AbortController|null>(null)
 function invalidate(){
  sequence.current+=1
  ongoing.current?.abort()
  ongoing.current=null
  setRows(null);setError('');setLoading(false)
 }
 useEffect(()=>{
  sequence.current+=1;ongoing.current?.abort();ongoing.current=null
  setLoading(false)
  let live=true;const controller=new AbortController()
  setCatalog(null);setRows(null);setError('')
  loadBudgetCatalog(client,organizationId,controller.signal)
   .then(c=>{if(live){
    setCatalog(c)
    setCycle(old=>c.cycles.some(x=>x.id===old)?old:'')
   }}).catch(()=>{if(live)setError('Não foi possível ler os planos orçamentários da Loja.')})
  return()=>{live=false;controller.abort();sequence.current+=1;ongoing.current?.abort();ongoing.current=null}
 },[client,organizationId,revision])
 const validCycle=catalog?.cycles.find(c=>c.id===cycle)
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!catalog||!validCycle||loading)return
  ongoing.current?.abort()
  const controller=new AbortController()
  ongoing.current=controller
  const issued=++sequence.current
  setRows(null);setError('');setLoading(true)
  try{
   validMonth(month)
   const r=await loadBudgetLines(client,organizationId,cycle,month,kind,catalog,controller.signal)
   if(issued===sequence.current)setRows(r)
  }catch{
   if(issued===sequence.current)setError('Consulta orçamentária indisponível ou inconsistente. Não foram exibidos totais parciais.')
  }finally{if(issued===sequence.current){ongoing.current=null;setLoading(false)}}
 }
 const budget=rows?.reduce((v,r)=>v+checkedSigned(r.budget_amount),0)
 const actual=rows?.reduce((v,r)=>v+checkedSigned(r.actual_amount),0)
 return <section className="panel member-editor" aria-label="Orçamento versus realizado">
  <div className="section-title"><h2>Orçamento × realizado</h2>
   <button type="button" className="secondary" onClick={()=>{invalidate();setRevision(v=>v+1)}} disabled={loading}>Atualizar orçamento</button>
  </div>
  <p className="subtle">Consulta somente das contas ou fundos que possuem linhas orçamentárias no ciclo escolhido. Não equivale à DRE total, ao saldo bancário nem à projeção de caixa. Valores são obtidos das views de realização do PostgreSQL.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {!catalog?(!error&&<p role="status">Consultando orçamento…</p>):<>
   {!catalog.cycles.length&&<p>Não há ciclo de orçamento cadastrado nesta Loja. Nenhum total é estimado.</p>}
   <form aria-label="Consultar orçamento versus realizado" onSubmit={submit}>
    <fieldset disabled={loading||!catalog.cycles.length}>
     <label htmlFor="budget-cycle">Ciclo orçamentário</label>
     <select id="budget-cycle" value={cycle} required onChange={e=>{invalidate();setCycle(e.target.value)}}>
      <option value="">Selecione o ciclo</option>{catalog.cycles.map(c=><option key={c.id} value={c.id}>
       {c.name} — {c.status} ({c.period_start} a {c.period_end})
      </option>)}
     </select>
     <label htmlFor="budget-month">Competência</label>
     <input id="budget-month" type="month" required value={month} onChange={e=>{invalidate();setMonth(e.target.value)}}/>
     <label htmlFor="budget-kind">Agrupamento</label>
     <select id="budget-kind" value={kind} onChange={e=>{invalidate();setKind(e.target.value as BudgetKind)}}>
      <option value="account">Conta contábil</option><option value="fund">Fundo</option>
     </select>
     <button className="primary" disabled={!cycle||!month||loading} type="submit">
      {loading?'Consultando…':'Comparar orçamento'}
     </button>
    </fieldset>
   </form>
   {rows&&<>
    <p className="subtle">{validCycle?.name} — {month}. A soma abrange exclusivamente os itens orçados desta consulta.</p>
    {!rows.length?<p>Não há linhas de orçamento para esta competência e agrupamento.</p>:<>
     <div className="metric-grid">
      <article className="panel metric"><p>Total orçado (itens consultados)</p><strong>{formatMoney(budget??0)}</strong></article>
      <article className="panel metric"><p>Total realizado (itens consultados)</p><strong>{formatMoney(actual??0)}</strong></article>
     </div>
     <div className="finance-table" role="region" tabIndex={0} aria-label="Linhas de execução orçamentária">
      <table><thead><tr><th>Conta ou fundo</th><th>Orçado</th><th>Realizado</th><th>Restante</th><th>Execução</th></tr></thead>
       <tbody>{rows.map((r,i)=>{
        const item=kind==='account'?
         catalog.accounts.find(a=>a.id===r.accounting_account_id):
         catalog.funds.find(f=>f.id===r.fund_id)
        const name=item
         ? ('code' in item ? `${item.code} — ${item.description}` : item.name)
         : 'Não identificado'
        const execution=budgetExecution(r.budget_amount,r.actual_amount)
        return <tr key={`${r.accounting_account_id??r.fund_id}:${i}`}>
         <th scope="row">{name}</th><td>{formatMoney(checkedSigned(r.budget_amount))}</td>
         <td>{formatMoney(checkedSigned(r.actual_amount))}</td>
         <td>{formatMoney(checkedSigned(kind==='account'?r.remaining_amount!:r.available_amount!))}</td>
         <td>{execution===null?'Sem base orçada':<>
          <progress className="budget-execution" aria-label={`Execução de ${name}`} max={100} value={Math.min(execution,100)}/>
          <span>{execution.toLocaleString('pt-BR',{maximumFractionDigits:1})}%{execution>100?' — acima do orçamento':''}</span>
         </>}</td>
        </tr>
       })}</tbody>
      </table>
     </div>
    </>}
    <p className="subtle">O realizado acompanha a competência contábil dos eventos e as regras da view. A diferença é orçamento menos realizado; não implica disponibilidade financeira para pagamento.</p>
   </>}
  </>}
 </section>
}
