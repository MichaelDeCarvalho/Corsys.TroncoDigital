import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizedAmount} from '../lib/member-configuration'
import {
 formatBillingInterval,
 formatPlanDeleteBlockReason,
 loadPlanVersionEntitlements,
 loadPlatformCommercialCatalog,
 type PlatformPlanVersion,
} from '../lib/master-commercial'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const codePattern=/^[a-z0-9][a-z0-9_-]{1,40}$/

type Command=
 |{name:'create_master_plan_draft_idempotent';args:Record<string,unknown>;retryable:true;kind:'create_draft'}
 |{name:'publish_master_plan_draft_idempotent';args:Record<string,unknown>;retryable:true;kind:'publish'}
 |{name:'update_saas_plan_version_draft';args:Record<string,unknown>;retryable:false;kind:'update_draft'}
 |{name:'create_saas_plan_successor_draft';args:Record<string,unknown>;retryable:false;kind:'create_successor'}
 |{name:'set_saas_plan_active';args:{p_plan_id:string;p_active:boolean;p_reason:string};retryable:false;kind:'set_active'}
 |{name:'delete_saas_plan_if_unused';args:{p_plan_id:string;p_reason:string};retryable:false;kind:'delete_plan'}

function formatInputPrice(price:string|number):string{
 return Number(price).toFixed(2).replace('.',',')
}

function parsePlanTerms(params:{
 priceRaw:string
 interval:string
 trialRaw:string
 graceRaw:string
 validFrom:string
 entitlementsRaw:string
}){
 const interval=params.interval.trim()
 const trial=Number(params.trialRaw.trim())
 const grace=Number(params.graceRaw.trim())
 const validFrom=params.validFrom.trim()
 const price=normalizedAmount(params.priceRaw.trim())
 const entitlements=JSON.parse(params.entitlementsRaw.trim()) as unknown
 if(
  !['monthly','yearly','custom'].includes(interval)||
  !Number.isSafeInteger(trial)||trial<0||trial>365||
  !Number.isSafeInteger(grace)||grace<0||grace>365||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(validFrom)||
  Number(price)<0||Number(price)>999999999999.99||
  !entitlements||typeof entitlements!=='object'||Array.isArray(entitlements)||
  JSON.stringify(entitlements).length>12000
 ){
  throw Error('Confira os campos do plano, a competência e os recursos JSON.')
 }
 return {price,interval,trial,grace,validFrom:validFrom+'-01',entitlements}
}

export function MasterPlanLifecycle({
 client,
 onCatalogChange,
}:{
 client:SupabaseClient
 onCatalogChange?:()=>void
}){
 const [plans,setPlans]=useState<PlatformPlanVersion[]|null>(null)
 const [draft,setDraft]=useState('')
 const [confirmation,setConfirmation]=useState('')

 const [editDraftId,setEditDraftId]=useState('')
 const [editCode,setEditCode]=useState('')
 const [editName,setEditName]=useState('')
 const [editPrice,setEditPrice]=useState('')
 const [editInterval,setEditInterval]=useState('monthly')
 const [editTrial,setEditTrial]=useState('0')
 const [editGrace,setEditGrace]=useState('7')
 const [editFrom,setEditFrom]=useState('')
 const [editEntitlements,setEditEntitlements]=useState('{}')
 const [editLoadingDetails,setEditLoadingDetails]=useState(false)
 const [editDetailsError,setEditDetailsError]=useState('')

 const [successorPlanId,setSuccessorPlanId]=useState('')
 const [succPrice,setSuccPrice]=useState('')
 const [succInterval,setSuccInterval]=useState('monthly')
 const [succTrial,setSuccTrial]=useState('0')
 const [succGrace,setSuccGrace]=useState('7')
 const [succFrom,setSuccFrom]=useState('')
 const [succEntitlements,setSuccEntitlements]=useState('{}')
 const [succLoadingDetails,setSuccLoadingDetails]=useState(false)
 const [succDetailsError,setSuccDetailsError]=useState('')

 const [governancePlanId,setGovernancePlanId]=useState('')
 const [governanceReason,setGovernanceReason]=useState('')
 const [deleteConfirm,setDeleteConfirm]=useState('')

 const [revision,setRevision]=useState(0)
 const [pending,setPending]=useState(false)
 const [uncertain,setUncertain]=useState(false)
 const [reconcileRequired,setReconcileRequired]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')

 const guard=useRef(false),mounted=useRef(false),command=useRef<Command|null>(null)

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])

 useEffect(()=>{
  const controller=new AbortController();let live=true
  setPlans(null);setError('');setDraft('');setConfirmation('')
  setEditDraftId('');setEditDetailsError('')
  setSuccessorPlanId('');setSuccDetailsError('')
  setGovernancePlanId('');setGovernanceReason('');setDeleteConfirm('')
  loadPlatformCommercialCatalog(client,controller.signal)
   .then(res=>{if(live){setPlans(res.plans);setReconcileRequired(false)}})
   .catch(()=>{if(live)setError('Não foi possível consultar as versões comerciais em rascunho.')})
  return()=>{live=false;controller.abort()}
 },[client,revision])

 const drafts=useMemo(
  ()=>plans?.filter(v=>v.publication_status==='draft')??[],
  [plans],
 )

 const distinctPlans=useMemo(()=>{
  if(!plans)return []
  const byPlan=new Map<string,PlatformPlanVersion>()
  for(const row of plans){
   const current=byPlan.get(row.plan_id)
   if(!current||row.version_number>current.version_number){
    byPlan.set(row.plan_id,row)
   }
  }
  return Array.from(byPlan.values()).sort((a,b)=>
   a.display_name_snapshot.localeCompare(b.display_name_snapshot,'pt-BR'),
  )
 },[plans])

 const selectedEditDraft=useMemo(
  ()=>drafts.find(d=>d.plan_version_id===editDraftId)??null,
  [drafts,editDraftId],
 )

 const selectedSuccessorPlan=useMemo(
  ()=>distinctPlans.find(p=>p.plan_id===successorPlanId)??null,
  [distinctPlans,successorPlanId],
 )

 const selectedGovernancePlan=useMemo(
  ()=>distinctPlans.find(p=>p.plan_id===governancePlanId)??null,
  [distinctPlans,governancePlanId],
 )

 useEffect(()=>{
  if(!selectedEditDraft){
   setEditCode('');setEditName('');setEditPrice('');setEditInterval('monthly')
   setEditTrial('0');setEditGrace('7');setEditFrom('');setEditEntitlements('{}')
   setEditLoadingDetails(false);setEditDetailsError('')
   return
  }
  const controller=new AbortController();let live=true
  setEditCode(selectedEditDraft.internal_code_snapshot)
  setEditName(selectedEditDraft.display_name_snapshot)
  setEditPrice(formatInputPrice(selectedEditDraft.price))
  setEditInterval(selectedEditDraft.billing_interval)
  setEditTrial(String(selectedEditDraft.trial_days))
  setEditGrace(String(selectedEditDraft.grace_days))
  setEditFrom(selectedEditDraft.valid_from.slice(0,7))
  setEditEntitlements('{}')
  setEditLoadingDetails(true);setEditDetailsError('')
  loadPlanVersionEntitlements(client,selectedEditDraft.plan_version_id,controller.signal)
   .then(entitlements=>{
    if(live){
     setEditEntitlements(JSON.stringify(entitlements,null,2))
     setEditLoadingDetails(false)
    }
   })
   .catch(()=>{
    if(live&&!controller.signal.aborted){
     setEditDetailsError('Não foi possível carregar os recursos do rascunho selecionado.')
     setEditLoadingDetails(false)
    }
   })
  return()=>{live=false;controller.abort()}
 },[client,selectedEditDraft])

 useEffect(()=>{
  if(!selectedSuccessorPlan){
   setSuccPrice('');setSuccInterval('monthly');setSuccTrial('0');setSuccGrace('7')
   setSuccFrom('');setSuccEntitlements('{}');setSuccLoadingDetails(false);setSuccDetailsError('')
   return
  }
  const controller=new AbortController();let live=true
  setSuccPrice(formatInputPrice(selectedSuccessorPlan.price))
  setSuccInterval(selectedSuccessorPlan.billing_interval)
  setSuccTrial(String(selectedSuccessorPlan.trial_days))
  setSuccGrace(String(selectedSuccessorPlan.grace_days))
  setSuccFrom(selectedSuccessorPlan.valid_from.slice(0,7))
  setSuccEntitlements('{}')
  setSuccLoadingDetails(true);setSuccDetailsError('')
  loadPlanVersionEntitlements(client,selectedSuccessorPlan.plan_version_id,controller.signal)
   .then(entitlements=>{
    if(live){
     setSuccEntitlements(JSON.stringify(entitlements,null,2))
     setSuccLoadingDetails(false)
    }
   })
   .catch(()=>{
    if(live&&!controller.signal.aborted){
     setSuccDetailsError('Não foi possível carregar os recursos da versão base do plano.')
     setSuccLoadingDetails(false)
    }
   })
  return()=>{live=false;controller.abort()}
 },[client,selectedSuccessorPlan])

 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  const executed=command.current
  try{
   const r=await client.rpc(executed.name,executed.args)
   if(r.error)throw r.error
   if(executed.kind==='delete_plan'){
    if(r.data!==true)throw Error('Unconfirmed Master plan deletion')
   }else if(typeof r.data!=='string'||!uuid.test(r.data)){
    throw Error('Unconfirmed Master plan command')
   }
   if(mounted.current){
    command.current=null;setUncertain(false);setReconcileRequired(false)
    if(executed.kind==='create_draft'){
     setSuccess('Rascunho comercial confirmado. Ainda não está publicado.')
    }else if(executed.kind==='create_successor'){
     setSuccess('Nova versão sucessora salva em rascunho. Ainda não está publicada.')
    }else if(executed.kind==='update_draft'){
     setSuccess('Alterações no rascunho de plano confirmadas. Ainda não está publicado.')
    }else if(executed.kind==='publish'){
     setSuccess('Versão comercial publicada com confirmação no banco. Consulte o histórico.')
    }else if(executed.kind==='set_active'){
     setSuccess(executed.args.p_active?
      'Plano reativado com confirmação e trilha de auditoria.':
      'Plano desativado com confirmação. Assinaturas e histórico publicados foram preservados.')
    }else{
     setSuccess('Plano sem vínculos excluído com registro de auditoria.')
    }
    setRevision(v=>v+1)
    onCatalogChange?.()
   }
  }catch(e){
   if(!mounted.current)return
   const errCode=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000'].includes(errCode)){
    command.current=null;setUncertain(false);setReconcileRequired(false)
    if(errCode==='42501'||errCode==='28000'){
     setError('A operação exige perfil MASTER da plataforma e MFA ativo.')
    }else if(errCode==='55000'&&executed.kind==='delete_plan'){
     setError('O banco bloqueou a exclusão porque o plano possui vínculos publicados ou ativos; desative o plano em vez de excluir.')
    }else{
     setError('O banco rejeitou a operação. Atualize a lista e verifique nome, código, vigência e status.')
    }
   }else if(executed.retryable){
    setUncertain(true)
    setError('Não foi possível confirmar o resultado. Use Verificar envio para repetir a mesma chave e parâmetros.')
   }else{
    command.current=null;setUncertain(false);setReconcileRequired(true)
    setError('Resultado de rede incerto para operação sem chave de idempotência. Clique em Atualizar rascunhos para reconciliar o estado atual antes de tentar nova ação.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }

 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||reconcileRequired||!plans)return
  const d=new FormData(e.currentTarget),get=(n:string)=>String(d.get(n)??'').trim()
  try{
   const planCode=get('code').toLowerCase(),name=get('name')
   if(!codePattern.test(planCode)||name.length<2||name.length>120){
    throw Error('Confira código e nome comercial.')
   }
   const parsed=parsePlanTerms({
    priceRaw:get('price'),interval:get('interval'),trialRaw:get('trial'),
    graceRaw:get('grace'),validFrom:get('from'),entitlementsRaw:get('entitlements'),
   })
   void run({name:'create_master_plan_draft_idempotent',retryable:true,kind:'create_draft',args:{
    p_code:planCode,p_name:name,p_price:parsed.price,p_billing_interval:parsed.interval,
    p_trial_days:parsed.trial,p_grace_days:parsed.grace,p_valid_from:parsed.validFrom,
    p_entitlements:parsed.entitlements,p_idempotency_key:crypto.randomUUID(),
   }})
  }catch{setError('Confira código, preço, competência futura e recursos em JSON válido.')}
 }

 function createSuccessor(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||reconcileRequired||!plans||succLoadingDetails||succDetailsError)return
  if(!selectedSuccessorPlan){setError('Selecione um plano base para criar a nova versão.');return}
  try{
   const parsed=parsePlanTerms({
    priceRaw:succPrice,interval:succInterval,trialRaw:succTrial,
    graceRaw:succGrace,validFrom:succFrom,entitlementsRaw:succEntitlements,
   })
   void run({name:'create_saas_plan_successor_draft',retryable:false,kind:'create_successor',args:{
    p_plan_id:selectedSuccessorPlan.plan_id,
    p_price:parsed.price,p_billing_interval:parsed.interval,
    p_trial_days:parsed.trial,p_grace_days:parsed.grace,p_valid_from:parsed.validFrom,
    p_entitlements:parsed.entitlements,
   }})
  }catch{setError('Confira preço, competência e recursos em JSON válido para a nova versão.')}
 }

 function updateDraft(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||reconcileRequired||!plans||editLoadingDetails||editDetailsError)return
  if(!selectedEditDraft||selectedEditDraft.publication_status!=='draft'){
   setError('Selecione uma versão em rascunho válida para editar.');return
  }
  try{
   const planCode=editCode.trim().toLowerCase(),name=editName.trim()
   if(!codePattern.test(planCode)||name.length<2||name.length>120){
    throw Error('Confira código e nome comercial.')
   }
   const parsed=parsePlanTerms({
    priceRaw:editPrice,interval:editInterval,trialRaw:editTrial,
    graceRaw:editGrace,validFrom:editFrom,entitlementsRaw:editEntitlements,
   })
   void run({name:'update_saas_plan_version_draft',retryable:false,kind:'update_draft',args:{
    p_plan_version_id:selectedEditDraft.plan_version_id,
    p_name:name,p_code:planCode,p_price:parsed.price,p_billing_interval:parsed.interval,
    p_trial_days:parsed.trial,p_grace_days:parsed.grace,p_valid_from:parsed.validFrom,
    p_entitlements:parsed.entitlements,
   }})
  }catch{setError('Confira código, preço, competência e recursos em JSON válido antes de salvar o rascunho.')}
 }

 function publish(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||reconcileRequired||confirmation!=='PUBLICAR')return
  const target=drafts.find(p=>p.plan_version_id===draft&&p.publication_status==='draft')
  if(!target){setError('O rascunho foi modificado. Atualize e tente novamente.');return}
  void run({name:'publish_master_plan_draft_idempotent',retryable:true,kind:'publish',args:{
   p_plan_version_id:target.plan_version_id,p_idempotency_key:crypto.randomUUID(),
  }})
 }

 function togglePlanActive(){
  if(pending||uncertain||reconcileRequired||!selectedGovernancePlan)return
  const reason=governanceReason.trim()
  if(reason.length<3||reason.length>300){
   setError('Informe o motivo (mínimo de 3 caracteres) para ativar ou desativar o plano.')
   return
  }
  void run({name:'set_saas_plan_active',retryable:false,kind:'set_active',args:{
   p_plan_id:selectedGovernancePlan.plan_id,
   p_active:!selectedGovernancePlan.plan_active,
   p_reason:reason,
  }})
 }

 function deleteUnusedPlan(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||reconcileRequired||!selectedGovernancePlan)return
  if(!selectedGovernancePlan.can_delete_plan){
   setError(formatPlanDeleteBlockReason(false,selectedGovernancePlan.delete_block_reason))
   return
  }
  const reason=governanceReason.trim()
  if(reason.length<3||reason.length>300||deleteConfirm!=='EXCLUIR'){
   setError('Informe o motivo e digite EXCLUIR para remover um plano sem vínculos.')
   return
  }
  void run({name:'delete_saas_plan_if_unused',retryable:false,kind:'delete_plan',args:{
   p_plan_id:selectedGovernancePlan.plan_id,
   p_reason:reason,
  }})
 }

 const locked=pending||uncertain||reconcileRequired
 const normalizedReason=governanceReason.trim()
 const canTogglePlan=Boolean(selectedGovernancePlan&&normalizedReason.length>=3&&normalizedReason.length<=300)
 const canDeletePlan=Boolean(canTogglePlan&&selectedGovernancePlan?.can_delete_plan&&deleteConfirm==='EXCLUIR')

 return <section className="panel member-editor" aria-label="Gerenciar rascunhos comerciais">
  <div className="section-title"><h3>Rascunhos e publicação de planos</h3>
   <button className="secondary" type="button" disabled={pending||uncertain}
    onClick={()=>{setSuccess('');setRevision(v=>v+1);if(reconcileRequired)onCatalogChange?.()}}>Atualizar rascunhos</button>
  </div>
  <p className="subtle">Os comandos exigem MASTER com MFA. Criar ou editar um rascunho não altera assinaturas vigentes nem migra clientes. Criação inicial idempotente, edição de rascunho, criação de versão sucessora, publicação, ativação/desativação e exclusão registram evento transacional em saas_master_audit_logs.</p>
  {success&&<p role="status">{success}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={pending}
    onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!plans?(!error&&<p role="status">Consultando rascunhos…</p>):<>
   <form aria-label="Criar rascunho SaaS" onSubmit={create}>
    <fieldset disabled={locked}>
     <legend>Novo plano em rascunho</legend>
     <div className="member-form-grid">
      <div><label htmlFor="master-plan-code">Código interno</label>
       <input id="master-plan-code" name="code" placeholder="essencial" maxLength={41} required/></div>
      <div><label htmlFor="master-plan-name">Nome comercial</label>
       <input id="master-plan-name" name="name" maxLength={120} required/></div>
      <div><label htmlFor="master-plan-price">Preço (R$)</label>
       <input id="master-plan-price" name="price" required inputMode="decimal" placeholder="125,00"/></div>
      <div><label htmlFor="master-plan-interval">Periodicidade</label>
       <select id="master-plan-interval" name="interval">
        <option value="monthly">Mensal</option><option value="yearly">Anual</option>
        <option value="custom">Personalizada</option>
       </select></div>
      <div><label htmlFor="master-plan-trial">Dias de teste</label>
       <input id="master-plan-trial" name="trial" type="number" min={0} max={365} defaultValue={0} required/></div>
      <div><label htmlFor="master-plan-grace">Dias de tolerância</label>
       <input id="master-plan-grace" name="grace" type="number" min={0} max={365} defaultValue={7} required/></div>
      <div><label htmlFor="master-plan-from">Competência inicial</label>
       <input id="master-plan-from" name="from" type="month" required/></div>
     </div>
     <label htmlFor="master-plan-entitlements">Recursos do plano (JSON)</label>
     <textarea id="master-plan-entitlements" name="entitlements" defaultValue="{}"
      rows={3} required aria-describedby="master-plan-entitlements-hint"/>
     <p id="master-plan-entitlements-hint" className="subtle">Objeto JSON de parâmetros contratados. Use chaves definidas pelo contrato V35; um objeto vazio não atribui permissões automaticamente.</p>
     <button className="primary" disabled={locked}>Criar somente rascunho</button>
    </fieldset>
   </form>

   <form aria-label="Criar versão sucessora de plano" onSubmit={createSuccessor}>
    <fieldset disabled={locked||!distinctPlans.length}>
     <legend>Nova versão sucessora de plano existente</legend>
     <label htmlFor="master-plan-successor-id">Plano base para nova versão</label>
     <select id="master-plan-successor-id" value={successorPlanId} required
      onChange={e=>setSuccessorPlanId(e.target.value)}>
      <option value="">Selecione um plano</option>
      {distinctPlans.map(p=><option key={p.plan_id} value={p.plan_id}>
       {p.display_name_snapshot} ({p.internal_code_snapshot}) — última v{p.version_number}
      </option>)}
     </select>
     {selectedSuccessorPlan&&<>
      <p className="subtle">
       Identidade do plano mantida no catálogo: {selectedSuccessorPlan.display_name_snapshot} ({selectedSuccessorPlan.internal_code_snapshot}) · referência atual {formatBillingInterval(selectedSuccessorPlan.billing_interval)}. Versões publicadas nunca são sobrescritas.
      </p>
      {succLoadingDetails&&<p role="status">Carregando recursos da versão base…</p>}
      {succDetailsError&&<p role="alert" className="message error">{succDetailsError}</p>}
      <div className="member-form-grid">
       <div><label htmlFor="master-plan-succ-price">Novo preço (R$)</label>
        <input id="master-plan-succ-price" value={succPrice} onChange={e=>setSuccPrice(e.target.value)} required inputMode="decimal"/></div>
       <div><label htmlFor="master-plan-succ-interval">Nova periodicidade</label>
        <select id="master-plan-succ-interval" value={succInterval} onChange={e=>setSuccInterval(e.target.value)}>
         <option value="monthly">Mensal</option><option value="yearly">Anual</option>
         <option value="custom">Personalizada</option>
        </select></div>
       <div><label htmlFor="master-plan-succ-trial">Novos dias de teste</label>
        <input id="master-plan-succ-trial" type="number" min={0} max={365} value={succTrial} onChange={e=>setSuccTrial(e.target.value)} required/></div>
       <div><label htmlFor="master-plan-succ-grace">Novos dias de tolerância</label>
        <input id="master-plan-succ-grace" type="number" min={0} max={365} value={succGrace} onChange={e=>setSuccGrace(e.target.value)} required/></div>
       <div><label htmlFor="master-plan-succ-from">Nova competência inicial</label>
        <input id="master-plan-succ-from" type="month" value={succFrom} onChange={e=>setSuccFrom(e.target.value)} required/></div>
      </div>
      <label htmlFor="master-plan-succ-entitlements">Novos recursos do plano (JSON)</label>
      <textarea id="master-plan-succ-entitlements" value={succEntitlements} onChange={e=>setSuccEntitlements(e.target.value)} rows={3} required/>
      <button className="primary" type="submit" disabled={locked||succLoadingDetails||Boolean(succDetailsError)}>
       Criar versão sucessora em rascunho
      </button>
     </>}
    </fieldset>
   </form>

   <form aria-label="Editar rascunho de plano" onSubmit={updateDraft}>
    <fieldset disabled={locked||!drafts.length}>
     <legend>Editar versão em rascunho</legend>
     <label htmlFor="master-plan-edit-id">Rascunho de plano para editar</label>
     <select id="master-plan-edit-id" value={editDraftId} required
      onChange={e=>setEditDraftId(e.target.value)}>
      <option value="">{drafts.length?'Selecione um rascunho':'Nenhum rascunho disponível para edição'}</option>
      {drafts.map(p=><option key={p.plan_version_id} value={p.plan_version_id}>
       {p.display_name_snapshot} (v{p.version_number}) — R$ {p.price}
      </option>)}
     </select>
     {selectedEditDraft&&<>
      {editLoadingDetails&&<p role="status">Carregando recursos do rascunho…</p>}
      {editDetailsError&&<p role="alert" className="message error">{editDetailsError}</p>}
      <fieldset disabled={locked||editLoadingDetails||Boolean(editDetailsError)}>
       <div className="member-form-grid">
        <div><label htmlFor="master-plan-edit-code">Código interno do rascunho</label>
         <input id="master-plan-edit-code" value={editCode} onChange={e=>setEditCode(e.target.value)} maxLength={41} required/></div>
        <div><label htmlFor="master-plan-edit-name">Nome comercial do rascunho</label>
         <input id="master-plan-edit-name" value={editName} onChange={e=>setEditName(e.target.value)} maxLength={120} required/></div>
        <div><label htmlFor="master-plan-edit-price">Preço do rascunho (R$)</label>
         <input id="master-plan-edit-price" value={editPrice} onChange={e=>setEditPrice(e.target.value)} required inputMode="decimal"/></div>
        <div><label htmlFor="master-plan-edit-interval">Periodicidade do rascunho</label>
         <select id="master-plan-edit-interval" value={editInterval} onChange={e=>setEditInterval(e.target.value)}>
          <option value="monthly">Mensal</option><option value="yearly">Anual</option>
          <option value="custom">Personalizada</option>
         </select></div>
        <div><label htmlFor="master-plan-edit-trial">Dias de teste do rascunho</label>
         <input id="master-plan-edit-trial" type="number" min={0} max={365} value={editTrial} onChange={e=>setEditTrial(e.target.value)} required/></div>
        <div><label htmlFor="master-plan-edit-grace">Dias de tolerância do rascunho</label>
         <input id="master-plan-edit-grace" type="number" min={0} max={365} value={editGrace} onChange={e=>setEditGrace(e.target.value)} required/></div>
        <div><label htmlFor="master-plan-edit-from">Competência inicial do rascunho</label>
         <input id="master-plan-edit-from" type="month" value={editFrom} onChange={e=>setEditFrom(e.target.value)} required/></div>
       </div>
       <label htmlFor="master-plan-edit-entitlements">Recursos do rascunho (JSON)</label>
       <textarea id="master-plan-edit-entitlements" value={editEntitlements} onChange={e=>setEditEntitlements(e.target.value)} rows={3} required/>
       <button className="primary" type="submit" disabled={locked||editLoadingDetails||Boolean(editDetailsError)}>
        Salvar alterações do rascunho
       </button>
      </fieldset>
     </>}
    </fieldset>
   </form>

   <form aria-label="Publicar plano SaaS" onSubmit={publish}>
    <fieldset disabled={locked||!drafts.length}>
     <legend>Publicar versão aprovada</legend>
     <label htmlFor="master-publish-version">Versão em rascunho</label>
     <select id="master-publish-version" value={draft} required onChange={e=>{setDraft(e.target.value);setConfirmation('')}}>
      <option value="">Selecione</option>
      {drafts.map(p=><option key={p.plan_version_id} value={p.plan_version_id}>
       {p.display_name_snapshot} (v{p.version_number}) — R$ {p.price} — {p.valid_from}
      </option>)}
     </select>
     <label htmlFor="master-publish-confirmation">Para confirmar, digite PUBLICAR</label>
     <input id="master-publish-confirmation" value={confirmation}
      onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/>
     <p className="subtle">A versão publicada torna-se histórica/contratual. Revise preço, vigência e recursos antes de publicar. Clientes existentes não são migrados automaticamente.</p>
     <button className="primary" disabled={locked||!draft||confirmation!=='PUBLICAR'}>
      Publicar versão comercial
     </button>
    </fieldset>
   </form>

   <form aria-label="Gerenciar ciclo do plano" onSubmit={deleteUnusedPlan}>
    <fieldset disabled={locked||!distinctPlans.length}>
     <legend>Ativação e exclusão segura de planos</legend>
     <label htmlFor="master-plan-governance-id">Plano para ativação ou exclusão</label>
     <select id="master-plan-governance-id" value={governancePlanId}
      onChange={e=>{setGovernancePlanId(e.target.value);setDeleteConfirm('')}}>
      <option value="">Selecione um plano</option>
      {distinctPlans.map(p=><option key={p.plan_id} value={p.plan_id}>
       {p.display_name_snapshot} ({p.internal_code_snapshot}) — {p.plan_active?'Ativo':'Desativado'}
      </option>)}
     </select>
     {selectedGovernancePlan&&<>
      <div className="callout">
       <p style={{margin:'0 0 0.35rem'}}>
        <strong>Situação do plano:</strong> {selectedGovernancePlan.plan_active?'Ativo para novas vendas/gestão':'Plano desativado'}
       </p>
       <p style={{margin:0}}>
        <strong>Regra de exclusão:</strong> {formatPlanDeleteBlockReason(selectedGovernancePlan.can_delete_plan,selectedGovernancePlan.delete_block_reason)}
       </p>
      </div>
      <label htmlFor="master-plan-governance-reason">Motivo da alteração do plano</label>
      <input id="master-plan-governance-reason" value={governanceReason}
       onChange={e=>setGovernanceReason(e.target.value)} maxLength={300}
       placeholder="Ex.: Descontinuação comercial ou correção antes da publicação"/>
      <div className="finance-sections" style={{marginTop:'0.75rem'}}>
       <button className="secondary" type="button" disabled={locked||!canTogglePlan} onClick={togglePlanActive}>
        {selectedGovernancePlan.plan_active?'Desativar plano':'Reativar plano'}
       </button>
      </div>
      <label htmlFor="master-plan-delete-confirm">Para excluir plano sem vínculos, digite EXCLUIR</label>
      <input id="master-plan-delete-confirm" value={deleteConfirm}
       onChange={e=>setDeleteConfirm(e.target.value)} autoComplete="off"/>
      <p className="subtle">Planos com versão publicada, assinatura, onboarding ou oferta vinculada não podem ser excluídos; nesses casos utilize Desativar plano para preservar contratos.</p>
      <button className="secondary" type="submit" disabled={locked||!canDeletePlan}>
       Excluir plano sem vínculos
      </button>
     </>}
    </fieldset>
   </form>
  </>}
 </section>
}
