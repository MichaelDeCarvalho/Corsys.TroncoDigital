import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatMoney} from '../lib/finance-data'
import {MasterPlanLifecycle} from './MasterPlanLifecycle'
import {MasterPromotions} from './MasterPromotions'
import {
 formatBillingInterval,
 formatPlanAdminStatus,
 formatPlanDeleteBlockReason,
 formatPlanPublicationStatus,
 formatPromotionDeleteBlockReason,
 formatPromotionStatus,
 formatPromotionValidity,
 loadPlatformCommercialCatalog,
 resolveEffectivePlanStatus,
 type PlatformPlanVersion,
 type PlatformPromotion,
} from '../lib/master-commercial'

type VersionHistoryStatus = 'all' | 'draft' | 'current' | 'future' | 'historical' | 'inactive'

function formatCardAmount(price:string|number,currency:string):string{
 const formatted=Number(price).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
 return `${currency} ${formatted}`
}

export function MasterCommercialCatalog({client}:{client:SupabaseClient}){
 const [rows,setRows]=useState<{plans:PlatformPlanVersion[];promotions:PlatformPromotion[]}|null>(null)
 const [error,setError]=useState(''),[revision,setRevision]=useState(0)
 const [historyFrom,setHistoryFrom]=useState('')
 const [historyTo,setHistoryTo]=useState('')
 const [historyStatus,setHistoryStatus]=useState<VersionHistoryStatus>('all')
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setRows(null);setError('')
  loadPlatformCommercialCatalog(client,controller.signal)
   .then(result=>{if(live)setRows(result)})
   .catch(()=>{if(live)setError('O catálogo de planos e ofertas não está disponível para esta autenticação.')})
  return()=>{live=false;controller.abort()}
 },[client,revision])
 // The read-model is a complete, validated catalog (up to 200 rows). Match the
 // V35 pilot: both dates filter the version's starting date, not valid_to.
 const visiblePlans=rows?.plans.filter(plan=>
  (!historyFrom||plan.valid_from>=historyFrom)&&
  (!historyTo||plan.valid_from<=historyTo)&&
  (historyStatus==='all'||resolveEffectivePlanStatus(plan)===historyStatus)
 )??[]
 function clearHistoryFilters(){
  setHistoryFrom('')
  setHistoryTo('')
  setHistoryStatus('all')
 }
 return <>
  <MasterPlanLifecycle client={client}/>
  <MasterPromotions client={client}/>
  <section className="panel" aria-label="Catálogo comercial Master">
  <div className="section-title"><h2>Planos e ofertas comerciais</h2>
   <button className="secondary" type="button" onClick={()=>setRevision(v=>v+1)}>Atualizar catálogo</button>
  </div>
  <p className="subtle">Versões comerciais reais, com histórico de publicação e vigência. Alterações contratuais dependem do fluxo separado de rascunho, publicação e auditoria. Nenhum plano é publicado por esta consulta.</p>
  <div className="callout">
   <strong>Regra contratual:</strong> versão publicada não é sobrescrita. Clientes existentes permanecem fixados na versão contratada até migração explícita.
  </div>
  {error&&<p role="alert" className="message error">{error}</p>}
  {!rows&&!error&&<p role="status">Consultando planos e ofertas…</p>}
  {rows&&<>
   <h3>Versões de planos</h3>
   <div className="finance-filters" role="group" aria-label="Filtros do histórico de versões" style={{display:'flex',flexWrap:'wrap',gap:'0.75rem',alignItems:'flex-end',marginBottom:'1rem'}}>
    <div style={{flex:'1 1 10rem',minWidth:0}}>
     <label htmlFor="master-plan-history-from">Vigência a partir de</label>
     <input id="master-plan-history-from" type="date" value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/>
    </div>
    <div style={{flex:'1 1 10rem',minWidth:0}}>
     <label htmlFor="master-plan-history-to">Vigência até</label>
     <input id="master-plan-history-to" type="date" value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/>
    </div>
    <div style={{flex:'1 1 12rem',minWidth:0}}>
     <label htmlFor="master-plan-history-status">Status do plano</label>
     <select id="master-plan-history-status" value={historyStatus} onChange={e=>setHistoryStatus(e.target.value as VersionHistoryStatus)}>
      <option value="all">Todos</option>
      <option value="draft">Rascunho</option>
      <option value="current">Vigente para novas contratações</option>
      <option value="future">Publicada futura</option>
      <option value="historical">Histórica / contratos existentes</option>
      <option value="inactive">Plano desativado</option>
     </select>
    </div>
    <button className="secondary" type="button" onClick={clearHistoryFilters}>Limpar filtros</button>
   </div>
   <p role="status">Exibindo {visiblePlans.length} de {rows.plans.length} versão(ões).</p>
   {!rows.plans.length?<p>Nenhuma versão de plano encontrada nesta consulta.</p>:
    !visiblePlans.length?<p>Nenhuma versão corresponde aos filtros selecionados.</p>:
    <>
     <div className="master-config-grid" role="region" aria-label="Cards de versões comerciais de planos" style={{marginBottom:'1.25rem'}}>
      {visiblePlans.map(p=><article key={`card-${p.plan_version_id}`} className="master-config-card">
       <span className="master-config-label">Plano · Código interno</span>
       <h4 className="master-config-value" style={{margin:'0 0 0.5rem'}}>{p.display_name_snapshot} ({p.internal_code_snapshot})</h4>
       <div className="master-config-badges" style={{marginBottom:'0.5rem'}}>
        <span className="badge">v{p.version_number} · {formatPlanPublicationStatus(p.publication_status)}</span>
        <span className="status">{formatPlanAdminStatus(p)}</span>
       </div>
       <strong className="master-config-value-lg">{formatCardAmount(p.price,p.currency)}</strong>
       <p className="master-config-meta">Periodicidade: {formatBillingInterval(p.billing_interval)}</p>
       <p className="master-config-meta">Vigência: {p.valid_from}{p.valid_to?` a ${p.valid_to}`:' em diante'}</p>
       <p className="master-config-meta">Trial: {p.trial_days} dia(s) · Tolerância: {p.grace_days} dia(s)</p>
       <p className="master-config-meta">{formatPlanDeleteBlockReason(p.can_delete_plan,p.delete_block_reason)}</p>
      </article>)}
     </div>
     <div className="finance-table" role="region" aria-label="Versões comerciais de planos" tabIndex={0}>
      <table><thead><tr><th>Plano</th><th>Código</th><th>Versão</th><th>Preço</th><th>Periodicidade</th><th>Vigência</th><th>Situação</th></tr></thead>
       <tbody>{visiblePlans.map(p=><tr key={p.plan_version_id}>
        <th scope="row">{p.display_name_snapshot}</th><td>{p.internal_code_snapshot}</td>
        <td>v{p.version_number}</td><td>{p.currency==='BRL'?formatMoney(Number(p.price)):`${p.currency} ${p.price}`}</td>
        <td>{formatBillingInterval(p.billing_interval)}</td><td>{p.valid_from}{p.valid_to?` a ${p.valid_to}`:' em diante'}</td>
        <td>{formatPlanAdminStatus(p)}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </>}
   <h3>Ofertas e promoções</h3>
   {!rows.promotions.length?<p>Nenhuma oferta encontrada nesta consulta.</p>:
    <>
     <div className="master-config-grid" role="region" aria-label="Cards de ofertas Master" style={{marginBottom:'1.25rem'}}>
      {rows.promotions.map(p=><article key={`promo-card-${p.promotion_series_id}`} className="master-config-card">
       <span className="master-config-label">Série promocional · Código público</span>
       <h4 className="master-config-value" style={{margin:'0 0 0.5rem'}}>{p.name} ({p.public_code})</h4>
       <div className="master-config-badges" style={{marginBottom:'0.5rem'}}>
        <span className="badge">v{p.version_number}</span>
        <span className="status">{formatPromotionStatus(p)}</span>
       </div>
       <p className="master-config-meta">Vigência: {formatPromotionValidity(p.valid_from,p.valid_to)}</p>
       <p className="master-config-meta">Resgates confirmados: {p.redemption_count}</p>
       <p className="master-config-meta">{formatPromotionDeleteBlockReason(p.can_delete,p.delete_block_reason)}</p>
      </article>)}
     </div>
     <div className="finance-table" role="region" aria-label="Ofertas Master" tabIndex={0}>
      <table><thead><tr><th>Oferta</th><th>Código</th><th>Versão</th><th>Status</th><th>Resgates</th></tr></thead>
       <tbody>{rows.promotions.map(p=><tr key={p.promotion_series_id}>
        <th scope="row">{p.name}</th><td>{p.public_code}</td>
        <td>v{p.version_number}</td><td>{formatPromotionStatus(p)}</td>
        <td>{p.redemption_count}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </>}
   <div className="callout">
    <strong>Boa prática comercial:</strong> desconto é separado do preço-base do plano. A publicação de ofertas registra nova versão comercial sem alterar retroativamente faturas emitidas.
   </div>
   <p className="subtle">Limite de consulta: 200 versões de planos e 200 séries de ofertas. Dados acima desse limite bloqueiam o módulo, sem exibir catálogo incompleto.</p>
  </>}
 </section>
 </>
}

