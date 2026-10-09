import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Approval = {
 organization_id:string;payable_id:string;approval_required:boolean;
 minimum_approvers:number;approval_request_id:string|null;
 approvals:number;rejections:number;approval_status:string
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function PayableApprovals({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [rows,setRows]=useState<Approval[]|null>(null)
 const [selected,setSelected]=useState('')
 const [revision,setRevision]=useState(0)
 const [pending,setPending]=useState(false)
 const [uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [decision,setDecision]=useState('approve')
 const command=useRef<{name:string;args:Record<string,unknown>}|null>(null)
 const guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  const controller=new AbortController();let live=true
  setRows(null);setError('');setSelected('')
  Promise.resolve(client.from('v_payable_approval_state')
   .select('organization_id,payable_id,approval_required,minimum_approvers,approval_request_id,approvals,rejections,approval_status')
   .eq('organization_id',organizationId).eq('approval_status','pending')
   .limit(151).abortSignal(controller.signal)).then(({data,error:failure})=>{
    if(!live)return
    if(failure||!data||data.length>150||data.some(r=>r.organization_id!==organizationId||
     r.approval_status!=='pending'||!r.approval_request_id||!r.approval_required)) {
      setError('Não foi possível carregar a fila de aprovação íntegra.');return
    }
    setRows(data as Approval[])
  }).catch(()=>{if(live)setError('Não foi possível carregar a fila de aprovação íntegra.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,revision])
 async function run(next:{name:string;args:Record<string,unknown>}){
  if(guard.current)return
  command.current=command.current??next;guard.current=true;setPending(true);setError('');setSaved(false)
  try{
   const r=await client.rpc(command.current.name,command.current.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!uuid.test(r.data))throw Error('Unconfirmed approval response')
   if(mounted.current){command.current=null;setUncertain(false);setSaved(true);setRevision(v=>v+1)}
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','42501','28000','55000'].includes(code)){
    command.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?'Seu perfil não pode decidir aprovações desta Loja.':
     'Decisão rejeitada ou já registrada. Atualize a fila para conferir a situação.')
   }else{
    setUncertain(true)
    setError('Decisão não confirmada. Verifique o envio com a mesma chave antes de tentar novamente.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||!rows)return
  const request=rows.find(r=>r.approval_request_id===selected)
  const reason=String(new FormData(e.currentTarget).get('reason')??'').trim()
  if(!request||reason.length<3||reason.length>500){setError('Selecione uma solicitação pendente e informe o motivo.');return}
  void run({name:'decide_payable_approval_idempotent',args:{
   p_organization_id:organizationId,p_approval_request_id:selected,p_decision:decision,
   p_reason:reason,p_idempotency_key:crypto.randomUUID(),
  }})
 }
 return <section className="panel member-editor" aria-label="Aprovação de despesas">
  <div className="section-title"><h2>Aprovação de despesas</h2>
   <button className="secondary" type="button" disabled={pending||uncertain}
    onClick={()=>{setSaved(false);setRevision(v=>v+1)}}>Atualizar fila</button></div>
  <p className="subtle">A decisão é individual e auditada. O banco valida o perfil, registra cada voto uma única vez e calcula a quantidade mínima necessária; uma decisão não liquida a despesa.</p>
  {saved&&<p role="status">Decisão registrada. A fila foi atualizada.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button className="secondary" disabled={pending} type="button"
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!rows?(!error&&<p role="status">Carregando solicitações…</p>):<>
   {!rows.length?<p>Nenhuma solicitação pendente nesta consulta.</p>:
   <form aria-label="Decidir aprovação de despesa" onSubmit={submit}>
    <fieldset disabled={pending||uncertain}>
     <label htmlFor="payable-approval-request">Solicitação pendente</label>
     <select id="payable-approval-request" required value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Selecione</option>{rows.map(r=><option key={r.approval_request_id} value={r.approval_request_id??''}>
       Despesa {r.payable_id.slice(0,8)} — {r.approvals}/{r.minimum_approvers} aprovações
      </option>)}
     </select>
     <label htmlFor="payable-approval-decision">Decisão</label>
     <select id="payable-approval-decision" value={decision} onChange={e=>setDecision(e.target.value)}>
      <option value="approve">Aprovar</option><option value="reject">Rejeitar</option>
     </select>
     <label htmlFor="payable-approval-reason">Motivo</label>
     <input id="payable-approval-reason" name="reason" maxLength={500} minLength={3} required />
     <button className="primary" disabled={!selected||pending||uncertain} type="submit">Registrar decisão</button>
    </fieldset>
   </form>}
   <p className="subtle">A fila está limitada a 150 solicitações. Se houver mais registros, o sistema bloqueia a consulta em vez de apresentar uma lista incompleta.</p>
  </>}
 </section>
}
