import { useEffect,useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney,formatDate } from '../lib/finance-data'
import { loadFinancialDashboard,type DashboardValues } from '../lib/finance-dashboard'
export function FinancialDashboard({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [values,setValues]=useState<DashboardValues|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
 const [loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let live=true
  setValues(null);setError('');setDenied(false);setLoading(true)
  loadFinancialDashboard(client,organizationId).then(data=>{
   if(live)setValues(data)
  }).catch(cause=>{
   if(!live)return
   const code=(cause as {code?:string}|null)?.code
   if(code==='42501'||code==='28000')setDenied(true)
   else setError('Os indicadores financeiros não puderam ser verificados. Valores não são exibidos.')
  }).finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[client,organizationId,revision])
 const metrics=values?[
  ['Total a receber',values.receivables_open,'Cobranças de integrantes e recebíveis institucionais em aberto'],
  ['A receber vencido',values.receivables_overdue,'Somente vencimentos anteriores à data da consulta'],
  ['Recebido no mês',values.received_this_month,'Entradas operacionais menos estornos no mês corrente'],
  ['Saldo das contas',values.cash_bank_balance,'Caixa e bancos, sem implicar conciliação bancária'],
  ['Contas a pagar',values.payables_open,'Obrigações institucionais em aberto'],
  ['Contas a pagar vencidas',values.payables_overdue,'Despesas vencidas ainda não liquidadas'],
 ] as const:[]

 const netPosition = Number(values?.cash_bank_balance ?? 0) + Number(values?.receivables_open ?? 0) - Number(values?.payables_open ?? 0)
 const inflowOutflowRatio = Number(values?.payables_open ?? 0) > 0 ? (Number(values?.received_this_month ?? 0) / Number(values?.payables_open)) * 100 : null

 return <section aria-label="Indicadores financeiros da Loja">
  <div className="section-title"><h2>Indicadores financeiros — Dashboard V35</h2>
   <button className="quiet" type="button" onClick={()=>setRevision(v=>v+1)} disabled={loading}>Atualizar indicadores</button>
  </div>
  {loading&&<p role="status">Consultando indicadores financeiros…</p>}
  {denied&&<p className="subtle">Os indicadores financeiros exigem autorização específica na Loja.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {values&&<>
   <p className="subtle">Consolidado da Loja em {formatDate(values.as_of)}, calculado no banco. Obrigações não são recebimentos e recebimentos não são receita contábil adicional.</p>
   <div className="metric-grid">
    {metrics.map(([title,amount,description])=>
     <article key={title} className="panel metric">
      <p>{title}</p>
      <strong>{formatMoney(Number(amount))}</strong>
      <p className="subtle">{description}</p>
     </article>)}
   </div>
   <div className="panel" style={{ marginTop: '1.25rem', padding: '1rem' }}>
    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>Receitas vs. Despesas e Posição Líquida</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
     <div style={{ padding: '0.6rem', background: 'rgba(148,163,184,0.06)', borderRadius: '4px' }}>
      <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted, #666)' }}>Entradas vs Obrigações do Mês</p>
      <div style={{ fontSize: '0.88rem', marginTop: '0.3rem', color: '#16a34a', fontWeight: 600 }}>
       Entradas efetivadas: {formatMoney(Number(values.received_this_month))}
      </div>
      {inflowOutflowRatio !== null && (
       <p className="subtle" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
        Cobertura de obrigações correntes: {inflowOutflowRatio.toFixed(1)}%
       </p>
      )}
     </div>
     <div style={{ padding: '0.6rem', background: 'rgba(148,163,184,0.06)', borderRadius: '4px' }}>
      <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted, #666)' }}>Posição Líquida Estimada</p>
      <strong style={{ fontSize: '1rem', display: 'block', marginTop: '0.2rem', color: netPosition >= 0 ? '#16a34a' : '#dc2626' }}>
       {formatMoney(netPosition)}
      </strong>
      <p className="subtle" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
       Caixa + Recebíveis abertos - Pagar em aberto
      </p>
     </div>
    </div>
   </div>
  </>}
 </section>
}
