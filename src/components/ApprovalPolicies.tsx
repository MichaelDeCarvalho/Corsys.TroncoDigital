import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizedAmount} from '../lib/member-configuration'
import {formatDate,formatMoney} from '../lib/finance-data'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
type Policy={
 id:string;organization_id:string;name:string;mode:string;
 threshold_amount:string|number|null;minimum_approvers:number;
 status:string;valid_from:string;valid_to:string
}
type Command={name:'create_tenant_approval_policy_draft'|'publish_tenant_approval_policy_idempotent';args:Record<string,unknown>}
export function ApprovalPolicies({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [policies,setPolicies]=useState<Policy[]|null>(null)
 const [mode,setMode]=useState('all'),[draft,setDraft]=useState('')
 const [confirmation,setConfirmation]=useState('')
 const [revision,setRevision]=useState(0)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const cmd=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setPolicies(null);setError('')
  client.from('expense_approval_policies')
   .select('id,organization_id,name,mode,threshold_amount,minimum_approvers,status,valid_from,valid_to')
   .eq('organization_id',organizationId).order('valid_from',{ascending:false}).limit(151)
   .abortSignal(controller.signal).then(({data,error:failure})=>{
    if(!live)return
    if(failure||!Array.isArray(data)||data.length>150||
     data.some(p=>p.organization_id!==organizationId||!uuid.test(p.id)||
      !['draft','published'].includes(p.status)||
      !['off','all','threshold'].includes(p.mode)||
      !Number.isSafeInteger(p.minimum_approvers)||p.minimum_approvers<1||p.minimum_approvers>10)){
     setError('Não foi possível conferir as políticas financeiras desta Loja.');return
    }
    setPolicies(data as Policy[])
   }).catch(()=>{if(live)setError('Não foi possível conferir as políticas financeiras desta Loja.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,revision])
 async function run(next:Command){
  if(guard.current)return
  cmd.current=cmd.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  try{
   const r=await client.rpc(cmd.current.name,cmd.current.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!uuid.test(r.data))throw Error('Policy RPC result unconfirmed')
   if(mounted.current){
    const created=cmd.current.name==='create_tenant_approval_policy_draft'
    cmd.current=null;setUncertain(false)
    setSuccess(created?'Rascunho de política criado, sem alterar regras publicadas.':
     'Política publicada com vigência e auditoria confirmadas.')
    setRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000','40001'].includes(code)){
    cmd.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?
     'Seu perfil não tem permissão de configurar aprovações.':
     code==='23514'||code==='23505'?
     'A vigência se sobrepõe a uma política publicada ou existe outra restrição contábil.':
     'A operação foi rejeitada. Confira vigência, modo e aprovadores.')
   }else{
    setUncertain(true)
    setError('Resultado não confirmado. Use Verificar envio para repetir a mesma solicitação sem duplicidade.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!policies||pending||uncertain)return
  const d=new FormData(event.currentTarget),get=(name:string)=>String(d.get(name)??'').trim()
  try{
   const name=get('name'),from=get('from'),to=get('to')
   const approvers=Number(get('approvers'))
   const threshold=mode==='threshold'?normalizedAmount(get('threshold')):null
   const reason=get('reason')
   if(name.length<3||name.length>120||!['off','all','threshold'].includes(mode)||
    !/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||
    !Number.isSafeInteger(approvers)||approvers<1||approvers>10||
    (threshold!==null&&Number(threshold)<0)||
    reason.length<3||reason.length>500)throw Error('Parâmetros da política inválidos.')
   void run({name:'create_tenant_approval_policy_draft',args:{
    p_organization_id:organizationId,p_name:name,p_mode:mode,p_threshold_amount:threshold,
    p_minimum_approvers:approvers,p_valid_from:from,p_valid_to:to,
    p_reason:reason,p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(e){setError((e as Error).message)}
 }
 function publish(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending||uncertain||confirmation!=='PUBLICAR')return
  const policy=policies?.find(p=>p.id===draft&&p.status==='draft')
  if(!policy){setError('O rascunho foi alterado. Atualize o histórico.');return}
  const d=new FormData(event.currentTarget),reason=String(d.get('reason')??'').trim()
  if(reason.length<3||reason.length>500){setError('Informe motivo para publicar a política.');return}
  void run({name:'publish_tenant_approval_policy_idempotent',args:{
   p_organization_id:organizationId,p_policy_id:policy.id,p_reason:reason,
   p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const draftPolicies=policies?.filter(p=>p.status==='draft')??[]
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Políticas de aprovação">
  <div className="section-title"><h2>Políticas e limites de aprovação</h2>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>{setSuccess('');setRevision(v=>v+1)}}>Atualizar políticas</button>
  </div>
  <p className="subtle">As políticas têm vigência. Criar um rascunho não muda a aprovação atual; publicar exige comando separado. Despesas já registradas mantêm seu histórico de solicitações e votos.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {success&&<p role="status">{success}</p>}
  {uncertain&&<button className="secondary" type="button" disabled={pending}
   onClick={()=>{if(cmd.current)void run(cmd.current)}}>Verificar envio</button>}
  {!policies?(!error&&<p role="status">Consultando políticas…</p>):<>
   <h3>Histórico e vigência</h3>
   {!policies.length?<p>Nenhuma política de aprovação cadastrada nesta Loja.</p>:
    <div className="finance-table" role="region" tabIndex={0} aria-label="Políticas financeiras">
     <table><thead><tr><th>Nome</th><th>Modo</th><th>Valor limite</th><th>Aprovadores</th><th>Vigência</th><th>Status</th></tr></thead>
      <tbody>{policies.map(p=><tr key={p.id}>
       <th scope="row">{p.name}</th><td>{p.mode==='off'?'Sem aprovação':p.mode==='all'?'Todas as despesas':'Acima do limite'}</td>
       <td>{p.threshold_amount===null?'—':formatMoney(Number(p.threshold_amount))}</td>
       <td>{p.minimum_approvers}</td><td>{formatDate(p.valid_from)} a {formatDate(p.valid_to)}</td>
       <td>{p.status}</td>
      </tr>)}</tbody>
     </table>
    </div>}
   <form aria-label="Criar política de aprovação" onSubmit={create}>
    <fieldset disabled={locked}><legend>Nova política em rascunho</legend>
     <label htmlFor="policy-name">Nome da política</label><input id="policy-name" name="name" maxLength={120} required/>
     <label htmlFor="policy-mode">Quando exigir aprovação</label><select id="policy-mode" value={mode} onChange={e=>setMode(e.target.value)}>
      <option value="off">Não exigir</option><option value="all">Todas as despesas</option>
      <option value="threshold">Acima do limite</option>
     </select>
     {mode==='threshold'&&<>
      <label htmlFor="policy-threshold">Limite da despesa (R$)</label><input id="policy-threshold" name="threshold" required inputMode="decimal"/>
     </>}
     <label htmlFor="policy-approvers">Número mínimo de aprovadores</label><input id="policy-approvers" name="approvers" type="number" min={1} max={10} defaultValue={1} required/>
     <label htmlFor="policy-from">Vigência inicial</label><input id="policy-from" name="from" type="date" required/>
     <label htmlFor="policy-to">Vigência final</label><input id="policy-to" name="to" type="date" required/>
     <label htmlFor="policy-reason">Justificativa</label><input id="policy-reason" name="reason" required minLength={3} maxLength={500}/>
     <button className="primary" disabled={locked} type="submit">Criar rascunho da política</button>
    </fieldset>
   </form>
   <form aria-label="Publicar política de aprovação" onSubmit={publish}>
    <fieldset disabled={locked||!draftPolicies.length}><legend>Publicação controlada</legend>
     <label htmlFor="policy-publish-target">Rascunho para publicar</label>
     <select id="policy-publish-target" required value={draft} onChange={e=>{setDraft(e.target.value);setConfirmation('')}}>
      <option value="">Selecione</option>{draftPolicies.map(p=><option value={p.id} key={p.id}>{p.name} — {formatDate(p.valid_from)}</option>)}
     </select>
     <label htmlFor="policy-publish-reason">Motivo da publicação</label><input id="policy-publish-reason" name="reason" required minLength={3} maxLength={500}/>
     <label htmlFor="policy-publish-confirm">Digite PUBLICAR</label><input id="policy-publish-confirm" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
     <p className="subtle">Publicar uma política sobreposta a outra já publicada é bloqueado pelo banco. Votos existentes não são excluídos nem convertidos.</p>
     <button className="primary" type="submit" disabled={locked||!draft||confirmation!=='PUBLICAR'}>Publicar política</button>
    </fieldset>
   </form>
  </>}
 </section>
}
