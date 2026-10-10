import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {loadMasterClient360,type MasterClient360} from '../lib/master-client-360'
export function MasterClient360({client,tenants}:{
 client:SupabaseClient;tenants:Array<{organization_id:string;organization_name:string}>
}){
 const [organization,setOrganization]=useState('')
 const [state,setState]=useState<MasterClient360|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
 const [revision,setRevision]=useState(0)
 useEffect(()=>{
  if(organization&&!tenants.some(t=>t.organization_id===organization))setOrganization('')
 },[organization,tenants])
 useEffect(()=>{
  let live=true;setState(null);setError('');setDenied(false)
  if(organization&&tenants.some(t=>t.organization_id===organization))
   loadMasterClient360(client,organization).then(d=>{if(live)setState(d)})
    .catch(e=>{
     if(!live)return
     const code=(e as {code?:string}|null)?.code
     if(code==='42501'||code==='28000')setDenied(true)
     else setError('Não foi possível validar os dados consolidados do cliente. Dados omitidos.')
    })
  return()=>{live=false}
 },[client,organization,tenants,revision])
 return <section className="panel" aria-label="Cliente 360 Master">
  <div className="section-title"><h3>Cliente 360° — panorama da Loja</h3>
   <button type="button" className="secondary" disabled={!organization}
    onClick={()=>setRevision(v=>v+1)}>Atualizar cliente</button>
  </div>
  <p className="subtle">Consulta exclusiva MASTER com MFA. Mostra contrato, assinatura, títulos SaaS e chamados do cliente; não exibe saldos privados dos integrantes e não cria sessões em nome da Loja.</p>
  <label htmlFor="master-client-360-tenant">Loja cliente</label>
  <select id="master-client-360-tenant" value={organization}
   onChange={e=>setOrganization(e.target.value)}>
   <option value="">Selecione uma Loja</option>
   {tenants.map(t=><option key={t.organization_id} value={t.organization_id}>{t.organization_name}</option>)}
  </select>
  {denied&&<p role="alert" className="message error">Esta consulta exige MASTER com MFA ativo.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {organization&&!state&&!error&&!denied&&<p role="status">Consultando Cliente 360°…</p>}
  {state&&<>
   <h4>{state.name}{state.number?' — nº '+state.number:''}</h4>
   <p>Situação da Loja: <strong>{state.status}</strong> · Situação comercial: <strong>{state.commercial_status??'Não informada'}</strong></p>
   <p>Cliente desde: {state.customer_since?formatDate(state.customer_since):'Não informado'} · Cobrança: {state.billing_provider??'Não configurada'}</p>
   <p>Contato financeiro: {state.billing_email??'Não informado'}</p>
   <p>Assinatura: <strong>{state.subscription_status??'Não cadastrada'}</strong> · Início: {state.subscription_start?formatDate(state.subscription_start):'—'} · Fim do período: {state.subscription_end?formatDate(state.subscription_end):'—'}</p>
   <div className="metric-grid">
    <article className="panel metric"><p>Faturas SaaS emitidas</p><strong>{state.invoices_total}</strong></article>
    <article className="panel metric"><p>Saldo comercial em aberto</p><strong>{formatMoney(Number(state.invoices_open_amount))}</strong></article>
    <article className="panel metric"><p>Saldo comercial vencido</p><strong>{formatMoney(Number(state.invoices_overdue_amount))}</strong></article>
    <article className="panel metric"><p>Chamados do cliente</p><strong>{state.tickets_total}</strong></article>
    <article className="panel metric"><p>Chamados ainda abertos</p><strong>{state.tickets_open}</strong></article>
   </div>
   <p className="subtle">Atualizado em {formatDate(state.as_of)}. Valores refletem apenas o faturamento SaaS, não a tesouraria institucional. Não há alterações automáticas em contrato, cobrança, conta ou suporte.</p>
  </>}
 </section>
}
