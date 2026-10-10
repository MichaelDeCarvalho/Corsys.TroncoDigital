import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatMoney} from '../lib/finance-data'
import {
 loadPlatformCommercialCatalog,type PlatformPlanVersion,type PlatformPromotion
} from '../lib/master-commercial'

export function MasterCommercialCatalog({client}:{client:SupabaseClient}){
 const [rows,setRows]=useState<{plans:PlatformPlanVersion[];promotions:PlatformPromotion[]}|null>(null)
 const [error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setRows(null);setError('')
  loadPlatformCommercialCatalog(client,controller.signal)
   .then(result=>{if(live)setRows(result)})
   .catch(()=>{if(live)setError('O catálogo de planos e ofertas não está disponível para esta autenticação.')})
  return()=>{live=false;controller.abort()}
 },[client,revision])
 return <section className="panel" aria-label="Catálogo comercial Master">
  <div className="section-title"><h2>Planos e ofertas comerciais</h2>
   <button className="secondary" type="button" onClick={()=>setRevision(v=>v+1)}>Atualizar catálogo</button>
  </div>
  <p className="subtle">Versões comerciais reais, com histórico de publicação e vigência. Alterações contratuais dependem do fluxo separado de rascunho, publicação e auditoria. Nenhum plano é publicado por esta consulta.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {!rows&&!error&&<p role="status">Consultando planos e ofertas…</p>}
  {rows&&<>
   <h3>Versões de planos</h3>
   {!rows.plans.length?<p>Nenhuma versão de plano encontrada nesta consulta.</p>:
    <div className="finance-table" role="region" aria-label="Versões comerciais de planos" tabIndex={0}>
     <table><thead><tr><th>Plano</th><th>Código</th><th>Versão</th><th>Preço</th><th>Periodicidade</th><th>Vigência</th><th>Situação</th></tr></thead>
      <tbody>{rows.plans.map(p=><tr key={p.plan_version_id}>
       <th scope="row">{p.display_name_snapshot}</th><td>{p.internal_code_snapshot}</td>
       <td>{p.version_number}</td><td>{p.currency==='BRL'?formatMoney(Number(p.price)):`${p.currency} ${p.price}`}</td>
       <td>{p.billing_interval}</td><td>{p.valid_from}{p.valid_to?` a ${p.valid_to}`:' em diante'}</td>
       <td>{p.admin_status} {p.plan_active?'':'(inativo)'}</td>
      </tr>)}</tbody>
     </table>
    </div>}
   <h3>Ofertas e promoções</h3>
   {!rows.promotions.length?<p>Nenhuma oferta encontrada nesta consulta.</p>:
    <div className="finance-table" role="region" aria-label="Ofertas Master" tabIndex={0}>
     <table><thead><tr><th>Oferta</th><th>Código</th><th>Versão</th><th>Status</th><th>Resgates</th></tr></thead>
      <tbody>{rows.promotions.map(p=><tr key={p.promotion_series_id}>
       <th scope="row">{p.name}</th><td>{p.public_code}</td>
       <td>{p.version_number}</td><td>{p.active?p.latest_version_status:'Inativa'}</td>
       <td>{p.redemption_count}</td>
      </tr>)}</tbody>
     </table>
    </div>}
   <p className="subtle">Limite de consulta: 200 versões de planos e 200 séries de ofertas. Dados acima desse limite bloqueiam o módulo, sem exibir catálogo incompleto.</p>
  </>}
 </section>
}
