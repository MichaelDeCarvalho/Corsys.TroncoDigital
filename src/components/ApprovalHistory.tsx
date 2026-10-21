import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {agreementCents,agreementUUID} from '../lib/member-agreements'
type Request={id:string;organization_id:string;payable_id:string;correction_id:string|null;minimum_approvers:number;amount_snapshot:string|number;created_at:string}
type Vote={id:string;organization_id:string;approval_request_id:string;actor_user_id:string;decision:'approve'|'reject';reason:string|null;created_at:string}
export function ApprovalHistory({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0),[requests,setRequests]=useState<Request[]|null>(null),[hasNext,setHasNext]=useState(false)
 const [selected,setSelected]=useState<Request|null>(null),[votes,setVotes]=useState<Vote[]|null>(null),[error,setError]=useState('')
 const detailController=useRef<AbortController|null>(null),detailVersion=useRef(0)
 useEffect(()=>{
  const c=new AbortController();let live=true;detailController.current?.abort();detailVersion.current++
  setRequests(null);setSelected(null);setVotes(null);setError('')
  Promise.resolve(client.from('payable_approval_requests')
   .select('id,organization_id,payable_id,correction_id,minimum_approvers,amount_snapshot,created_at')
   .eq('organization_id',organizationId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20).abortSignal(c.signal))
   .then(r=>{
    if(!live)return
    if(r.error||!Array.isArray(r.data)||r.data.length>21||r.data.some(x=>x.organization_id!==organizationId||!agreementUUID.test(x.id)||!agreementUUID.test(x.payable_id)||
     !Number.isInteger(x.minimum_approvers)||x.minimum_approvers<1||x.minimum_approvers>10||agreementCents(x.amount_snapshot)<=0||!Number.isFinite(Date.parse(x.created_at))))throw Error('Invalid approval history')
    setHasNext(r.data.length>20);setRequests(r.data.slice(0,20) as Request[])
   }).catch(()=>{if(live)setError('Não foi possível conferir o histórico de aprovações desta Loja.')})
  return()=>{live=false;c.abort();detailController.current?.abort();detailVersion.current++}
 },[client,organizationId,page,revision])
 async function open(request:Request){
  detailController.current?.abort();const c=new AbortController();detailController.current=c;const version=++detailVersion.current
  setSelected(request);setVotes(null);setError('')
  try{
   const r=await client.from('payable_approval_decisions').select('id,organization_id,approval_request_id,actor_user_id,decision,reason,created_at')
    .eq('organization_id',organizationId).eq('approval_request_id',request.id).order('created_at').order('id').limit(151).abortSignal(c.signal)
   if(r.error||!Array.isArray(r.data)||r.data.length>150||new Set(r.data.map(x=>x.actor_user_id)).size!==r.data.length||
    r.data.some(x=>x.organization_id!==organizationId||x.approval_request_id!==request.id||!agreementUUID.test(x.id)||!agreementUUID.test(x.actor_user_id)||
     !['approve','reject'].includes(x.decision)||(x.reason!==null&&typeof x.reason!=='string')||!Number.isFinite(Date.parse(x.created_at))))throw Error('Invalid vote history')
   if(version===detailVersion.current)setVotes(r.data as Vote[])
  }catch{if(version===detailVersion.current&&!c.signal.aborted)setError('Decisões incompletas ou inconsistentes. Não é possível confirmar o resultado desta solicitação.')}
 }
 const approvals=votes?.filter(x=>x.decision==='approve').length??0,rejections=votes?.filter(x=>x.decision==='reject').length??0
 return <section aria-label="Histórico de aprovações">
  <div className="section-title"><h3>Histórico de aprovações</h3><button className="secondary" onClick={()=>setRevision(x=>x+1)}>Atualizar histórico</button></div>
  <p className="subtle">Cada solicitação conserva o valor e o número de aprovadores exigidos naquela versão. As decisões não representam pagamento da despesa.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {!requests?!error&&<p role="status">Consultando histórico…</p>:<>
   {!requests.length?<p>Nenhuma solicitação nesta página.</p>:<ol>{requests.map(r=><li key={r.id}>
    <p>{formatDate(r.created_at.slice(0,10))} · {formatMoney(agreementCents(r.amount_snapshot)/100)} · mínimo de {r.minimum_approvers} aprovador(es){r.correction_id?' · revisão da despesa':''}</p>
    <button className="secondary" onClick={()=>void open(r)}>Ver decisões da solicitação {r.id.slice(0,8)}</button>
   </li>)}</ol>}
   <div className="finance-pagination"><button className="secondary" disabled={page===0} onClick={()=>setPage(x=>x-1)}>Página anterior do histórico</button><span>Página {page+1}</span><button className="secondary" disabled={!hasNext} onClick={()=>setPage(x=>x+1)}>Próxima página do histórico</button></div>
  </>}
  {selected&&<div aria-label="Decisões da solicitação"><h3>Decisões registradas</h3>
   {!votes?!error&&<p role="status">Consultando decisões…</p>:<>
    <p role="status">{rejections?'Rejeitada':approvals>=selected.minimum_approvers?'Aprovada':'Pendente'} · {approvals}/{selected.minimum_approvers} aprovações · {rejections} rejeição(ões).</p>
    {!votes.length?<p>Nenhuma decisão registrada.</p>:<ol>{votes.map(v=><li key={v.id}>{v.decision==='approve'?'Aprovação':'Rejeição'} em {formatDate(v.created_at.slice(0,10))} · {v.reason||'Sem justificativa registrada.'}</li>)}</ol>}
   </>}
  </div>}
 </section>
}
