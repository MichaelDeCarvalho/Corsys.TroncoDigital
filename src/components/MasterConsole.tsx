import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate} from '../lib/finance-data'
import {MasterCommercialCatalog} from './MasterCommercialCatalog'
import {MasterSupportQueue} from './MasterSupportQueue'
import {MasterBilling} from './MasterBilling'
import {MasterOnboarding} from './MasterOnboarding'
import {MasterClient360} from './MasterClient360'
import {loadMasterOverview,loadMasterTenants,type MasterOverview,type MasterTenant} from '../lib/master-console'

export function MasterConsole({client}:{client:SupabaseClient}){
 const [overview,setOverview]=useState<MasterOverview|null>(null)
 const [tab,setTab]=useState<'overview'|'commercial'|'support'|'billing'|'onboarding'|'client360'>('overview')
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [tenants,setTenants]=useState<{rows:MasterTenant[];hasNext:boolean}|null>(null)
 const [error,setError]=useState(''),[denied,setDenied]=useState(false)
 useEffect(()=>{
  let live=true
  setOverview(null);setTenants(null);setError('');setDenied(false)
  Promise.all([loadMasterOverview(client),loadMasterTenants(client,page)]).then(([o,t])=>{
   if(live){setOverview(o);setTenants(t)}
  }).catch(cause=>{
   if(!live)return
   const code=(cause as {code?:string}|null)?.code
   if(code==='42501'||code==='28000')setDenied(true)
   else setError('Não foi possível validar a consulta do Master SaaS. Os dados permaneceram ocultos.')
  })
  return()=>{live=false}
 },[client,page,revision])
 const metrics=overview?[
  ['Lojas cadastradas',overview.tenants_total],
  ['Lojas ativas',overview.tenants_active],
  ['Lojas inativas',overview.tenants_other],
  ['Assinaturas ativas ou teste',overview.subscriptions_active_or_trial],
  ['Assinaturas em atraso',overview.subscriptions_past_due],
  ['Chamados abertos',overview.support_tickets_open],
  ['Rascunhos de plano',overview.plan_drafts],
 ] as const:[]
 return <section aria-label="Master SaaS — visão geral">
  <div className="section-title"><h2>Painel Master SaaS</h2>
   <button className="secondary" type="button"
    onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar plataforma</button>
  </div>
  <p className="subtle">Acesso exclusivo de administrador da plataforma com MFA (AAL2). Esta área é separada dos dados e das permissões financeiras das Lojas. Somente leitura nesta etapa; não há sessão de suporte nem impersonação de cliente.</p>
  {denied&&<p role="alert" className="message error">Sua autenticação não possui autorização Master com MFA ativo. Os dados não estão disponíveis.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {!overview&&!error&&!denied&&<p role="status">Validando Master e consultando indicadores…</p>}
  {overview&&tenants&&<>
   <div className="finance-sections" role="group" aria-label="Áreas do Master SaaS">
    <button className="secondary" aria-pressed={tab==='overview'} onClick={()=>setTab('overview')}>Visão geral</button>
    <button className="secondary" aria-pressed={tab==='commercial'} onClick={()=>setTab('commercial')}>Planos e ofertas</button>
    <button className="secondary" aria-pressed={tab==='support'} onClick={()=>setTab('support')}>Operação e suporte</button>
    <button className="secondary" aria-pressed={tab==='billing'} onClick={()=>setTab('billing')}>Cobrança SaaS</button>
    <button className="secondary" aria-pressed={tab==='onboarding'} onClick={()=>setTab('onboarding')}>Implantação de Lojas</button>
    <button className="secondary" aria-pressed={tab==='client360'} onClick={()=>setTab('client360')}>Cliente 360°</button>
   </div>
   {tab==='overview'&&<>
   <p className="subtle">Indicadores da plataforma em {formatDate(overview.as_of)}. Não representam faturamento recebido.</p>
   <div className="metric-grid">
    {metrics.map(([label,value])=><article className="panel metric" key={label}>
     <p>{label}</p><strong>{value}</strong>
    </article>)}
   </div>
   <section className="panel">
    <h3>Diretório de Lojas</h3>
    {!tenants.rows.length?<p>Nenhuma Loja encontrada nesta página.</p>:
     <div className="finance-table" role="region" aria-label="Lojas Master" tabIndex={0}>
      <table><thead><tr><th>Loja</th><th>Nº</th><th>Situação</th><th>Assinatura</th><th>Plano</th><th>Chamados abertos</th></tr></thead>
       <tbody>{tenants.rows.map(row=><tr key={row.organization_id}>
        <th scope="row">{row.organization_name}</th>
        <td>{row.organization_number??'—'}</td><td>{row.organization_status}</td>
        <td>{row.subscription_status}</td><td>{row.plan_name}</td>
        <td>{row.open_support_tickets}</td>
       </tr>)}</tbody>
      </table>
     </div>}
    <div className="finance-pagination">
     <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
     <span role="status">Página {page+1} — {tenants.rows.length} Lojas</span>
     <button className="secondary" disabled={!tenants.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
    </div>
    <p className="subtle">Cadastro, planos comerciais, cobranças SaaS e suporte Master terão fluxos próprios com autorização e auditoria. Nenhum valor de contrato é alterado neste painel.</p>
   </section>
   </>}
   {tab==='commercial'&&<MasterCommercialCatalog client={client}/>}
   {tab==='support'&&<MasterSupportQueue client={client}/>}
   {tab==='billing'&&<MasterBilling client={client} tenants={tenants.rows}/>}
   {tab==='onboarding'&&<MasterOnboarding client={client}/>}
   {tab==='client360'&&<MasterClient360 client={client} tenants={tenants.rows}/>} 
  </>}
 </section>
}
