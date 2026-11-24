import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizedAmount} from '../lib/member-configuration'
import {
 formatPromotionDeleteBlockReason,
 formatPromotionStatus,
 loadPlatformCommercialCatalog,
 loadPromotionDraftDetails,
 toDatetimeLocalValue,
 type PlatformPromotion,
} from '../lib/master-commercial'

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

type Command=
 |{name:'create_master_promotion_draft_idempotent'|'create_master_promotion_successor_idempotent';args:Record<string,unknown>;retryable:true;kind:'create_draft'}
 |{name:'update_saas_promotion_draft';args:Record<string,unknown>;retryable:false;kind:'update_draft'}
 |{name:'publish_master_promotion_draft_idempotent';args:Record<string,unknown>;retryable:true;kind:'publish'}
 |{name:'set_saas_promotion_series_active';args:{p_promotion_series_id:string;p_active:boolean;p_reason:string};retryable:false;kind:'set_active'}
 |{name:'delete_saas_promotion_series_if_unused';args:{p_promotion_series_id:string;p_reason:string};retryable:false;kind:'delete_series'}

function when(input:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error('Data e horário inválidos.')
 const date=new Date(input)
 if(Number.isNaN(date.getTime()))throw Error('Data e horário inválidos.')
 return date.toISOString()
}

function parsePromotionFields(params:{
 nameRaw:string
 codeRaw:string
 typeRaw:string
 valueRaw:string
 durationRaw:string
 cyclesRaw:string
 fromRaw:string
 toRaw:string
 scopeRaw:string
 limitRaw:string
 stackable:boolean
}){
 const code=params.codeRaw.trim().toUpperCase(),name=params.nameRaw.trim()
 const type=params.typeRaw.trim(),durationType=params.durationRaw.trim()
 const scope=params.scopeRaw.trim()
 const value=normalizedAmount(params.valueRaw.trim())
 const cycles=durationType==='cycles'?Number(params.cyclesRaw.trim()):null
 const limit=params.limitRaw.trim()?Number(params.limitRaw.trim()):null
 const from=when(params.fromRaw.trim()),to=params.toRaw.trim()?when(params.toRaw.trim()):null
 if(
  name.length<3||name.length>120||!/^[A-Z0-9_-]{3,40}$/.test(code)||
  !['percent','fixed_amount','trial_price'].includes(type)||
  Number(value)<=0||(type==='percent'&&Number(value)>100)||
  !['once','cycles','date_range'].includes(durationType)||
  (durationType==='cycles'&&(!Number.isSafeInteger(cycles)||cycles===null||cycles<1||cycles>36))||
  !['new_customers','selected_customers','all_eligible'].includes(scope)||
  (limit!==null&&(!Number.isSafeInteger(limit)||limit<1||limit>1000000))||
  (to!==null&&to<=from)
 ){
  throw Error('Parâmetros da oferta inválidos.')
 }
 return {
  p_name:name,p_public_code:code,p_benefit_type:type,p_benefit_value:value,
  p_duration_type:durationType,p_duration_cycles:cycles,
  p_valid_from:from,p_valid_to:to,p_eligibility_scope:scope,
  p_max_redemptions:limit,p_stackable:params.stackable,
 }
}

export function MasterPromotions({
 client,
 onCatalogChange,
}:{
 client:SupabaseClient
 onCatalogChange?:()=>void
}){
 const [promotions,setPromotions]=useState<PlatformPromotion[]|null>(null)
 const [draft,setDraft]=useState(''),[confirmed,setConfirmed]=useState('')
 const [sourcePromotion,setSourcePromotion]=useState('')
 const [revision,setRevision]=useState(0),[pending,setPending]=useState(false)
 const [uncertain,setUncertain]=useState(false),[reconcileRequired,setReconcileRequired]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const [duration,setDuration]=useState('once')

 const [editPromotionId,setEditPromotionId]=useState('')
 const [editName,setEditName]=useState('')
 const [editCode,setEditCode]=useState('')
 const [editType,setEditType]=useState<'percent'|'fixed_amount'|'trial_price'>('percent')
 const [editValue,setEditValue]=useState('')
 const [editDuration,setEditDuration]=useState<'once'|'cycles'|'date_range'>('once')
 const [editCycles,setEditCycles]=useState('')
 const [editFrom,setEditFrom]=useState('')
 const [editTo,setEditTo]=useState('')
 const [editScope,setEditScope]=useState<'new_customers'|'selected_customers'|'all_eligible'>('new_customers')
 const [editLimit,setEditLimit]=useState('')
 const [editStackable,setEditStackable]=useState(false)
 const [editLoadingDetails,setEditLoadingDetails]=useState(false)
 const [editDetailsError,setEditDetailsError]=useState('')

 const [governanceSeriesId,setGovernanceSeriesId]=useState('')
 const [governanceReason,setGovernanceReason]=useState('')
 const [deleteConfirm,setDeleteConfirm]=useState('')

 const guard=useRef(false),mounted=useRef(false),cmd=useRef<Command|null>(null)

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])

 useEffect(()=>{
  let active=true;const abort=new AbortController()
  setPromotions(null);setError('')
  setEditPromotionId('');setEditDetailsError('')
  setGovernanceSeriesId('');setGovernanceReason('');setDeleteConfirm('')
  loadPlatformCommercialCatalog(client,abort.signal)
   .then(res=>{if(active){setPromotions(res.promotions);setDraft('');setConfirmed('');setReconcileRequired(false)}})
   .catch(()=>{if(active)setError('Não foi possível consultar rascunhos de ofertas no Master.')})
  return()=>{active=false;abort.abort()}
 },[client,revision])

 const drafts=useMemo(
  ()=>promotions?.filter(p=>p.latest_version_status==='draft')??[],
  [promotions],
 )

 const selectedEditDraft=useMemo(
  ()=>drafts.find(p=>p.latest_promotion_id===editPromotionId)??null,
  [drafts,editPromotionId],
 )

 const selectedGovernanceSeries=useMemo(
  ()=>promotions?.find(p=>p.promotion_series_id===governanceSeriesId)??null,
  [promotions,governanceSeriesId],
 )

 useEffect(()=>{
  if(!selectedEditDraft){
   setEditName('');setEditCode('');setEditType('percent');setEditValue('')
   setEditDuration('once');setEditCycles('');setEditFrom('');setEditTo('')
   setEditScope('new_customers');setEditLimit('');setEditStackable(false)
   setEditLoadingDetails(false);setEditDetailsError('')
   return
  }
  let active=true;const abort=new AbortController()
  setEditLoadingDetails(true);setEditDetailsError('')
  loadPromotionDraftDetails(client,selectedEditDraft.latest_promotion_id,abort.signal)
   .then(detail=>{
    if(!active)return
    setEditName(detail.name)
    setEditCode(detail.public_code??'')
    setEditType(detail.benefit_type)
    setEditValue(detail.benefit_value.toFixed(2).replace('.',','))
    setEditDuration(detail.duration_type)
    setEditCycles(detail.duration_cycles!==null?String(detail.duration_cycles):'')
    setEditFrom(toDatetimeLocalValue(detail.valid_from))
    setEditTo(toDatetimeLocalValue(detail.valid_to))
    setEditScope(detail.eligibility_scope)
    setEditLimit(detail.max_redemptions!==null?String(detail.max_redemptions):'')
    setEditStackable(detail.stackable)
    setEditLoadingDetails(false)
   })
   .catch(()=>{
    if(active&&!abort.signal.aborted){
     setEditDetailsError('Não foi possível carregar os detalhes completos do rascunho da oferta.')
     setEditLoadingDetails(false)
    }
   })
  return()=>{active=false;abort.abort()}
 },[client,selectedEditDraft])

 async function run(next:Command){
  if(guard.current)return
  cmd.current=cmd.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  const executed=cmd.current
  try{
   const response=await client.rpc(executed.name,executed.args)
   if(response.error)throw response.error
   if(executed.kind==='delete_series'){
    if(response.data!==true)throw Error('Master promotion deletion unconfirmed')
   }else if(typeof response.data!=='string'||!uuid.test(response.data)){
    throw Error('Master promotion command unconfirmed')
   }
   if(mounted.current){
    cmd.current=null;setUncertain(false);setReconcileRequired(false)
    if(executed.kind==='create_draft'){
     setSuccess('Rascunho promocional confirmado. A oferta ainda não está publicada.')
    }else if(executed.kind==='update_draft'){
     setSuccess('Alterações no rascunho promocional confirmadas. A oferta ainda não está publicada.')
    }else if(executed.kind==='publish'){
     setSuccess('Oferta publicada com confirmação no banco. Verifique a vigência no catálogo.')
    }else if(executed.kind==='set_active'){
     setSuccess(executed.args.p_active?
      'Série promocional reativada com confirmação e auditoria.':
      'Série promocional desativada com confirmação. O histórico publicado foi preservado.')
    }else{
     setSuccess('Série promocional sem uso excluída com registro de auditoria.')
    }
    setRevision(v=>v+1)
    onCatalogChange?.()
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000','PT409'].includes(code)){
    cmd.current=null;setUncertain(false);setReconcileRequired(false)
    if(code==='PT409'){
     setError('A oferta foi alterada. Atualize o catálogo antes de criar uma nova versão.')
    }else if(code==='42501'||code==='28000'){
     setError('Operação exclusiva MASTER com MFA ativo.')
    }else if(code==='55000'&&executed.kind==='delete_series'){
     setError('O banco bloqueou a exclusão porque a série possui histórico publicado ou uso registrado; desative a série em vez de excluir.')
    }else{
     setError('Operação recusada. Confira as datas, regras e histórico antes de tentar novamente.')
    }
   }else if(executed.retryable){
    setUncertain(true);setError('Resposta não confirmada. Verifique o envio para repetir a mesma chave e parâmetros.')
   }else{
    cmd.current=null;setUncertain(false);setReconcileRequired(true)
    setError('Resultado de rede incerto para operação sem chave de idempotência. Clique em Atualizar ofertas para reconciliar o estado atual antes de tentar nova ação.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }

 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||reconcileRequired||!promotions)return
  const data=new FormData(event.currentTarget),get=(key:string)=>String(data.get(key)??'').trim()
  try{
   const fields=parsePromotionFields({
    nameRaw:get('name'),codeRaw:get('code'),typeRaw:get('type'),
    valueRaw:get('value'),durationRaw:get('duration'),cyclesRaw:get('cycles'),
    fromRaw:get('from'),toRaw:get('to'),scopeRaw:get('scope'),
    limitRaw:get('limit'),stackable:data.has('stackable'),
   })
   void run({
    name:sourcePromotion?'create_master_promotion_successor_idempotent':'create_master_promotion_draft_idempotent',
    retryable:true,
    kind:'create_draft',
    args:{
     ...(sourcePromotion?{p_current_promotion_id:sourcePromotion}:{}),
     ...fields,
     p_idempotency_key:crypto.randomUUID(),
    },
   })
  }catch(e){setError((e as Error).message)}
 }

 function updateDraft(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||reconcileRequired||!promotions||editLoadingDetails||editDetailsError)return
  if(!selectedEditDraft||selectedEditDraft.latest_version_status!=='draft'){
   setError('Selecione uma oferta em rascunho válida para editar.')
   return
  }
  try{
   const fields=parsePromotionFields({
    nameRaw:editName,codeRaw:editCode,typeRaw:editType,
    valueRaw:editValue,durationRaw:editDuration,cyclesRaw:editCycles,
    fromRaw:editFrom,toRaw:editTo,scopeRaw:editScope,
    limitRaw:editLimit,stackable:editStackable,
   })
   void run({
    name:'update_saas_promotion_draft',
    retryable:false,
    kind:'update_draft',
    args:{
     p_promotion_id:selectedEditDraft.latest_promotion_id,
     ...fields,
    },
   })
  }catch(e){setError((e as Error).message)}
 }

 function publish(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||reconcileRequired||confirmed!=='PUBLICAR')return
  const selected=drafts.find(p=>p.latest_promotion_id===draft&&p.latest_version_status==='draft')
  if(!selected){setError('O rascunho mudou. Atualize o catálogo.');return}
  void run({
   name:'publish_master_promotion_draft_idempotent',
   retryable:true,
   kind:'publish',
   args:{
    p_promotion_id:selected.latest_promotion_id,p_idempotency_key:crypto.randomUUID(),
   },
  })
 }

 function toggleSeriesActive(){
  if(pending||uncertain||reconcileRequired||!selectedGovernanceSeries)return
  const reason=governanceReason.trim()
  if(reason.length<3||reason.length>300){
   setError('Informe o motivo (mínimo de 3 caracteres) para ativar ou desativar a série de oferta.')
   return
  }
  void run({
   name:'set_saas_promotion_series_active',
   retryable:false,
   kind:'set_active',
   args:{
    p_promotion_series_id:selectedGovernanceSeries.promotion_series_id,
    p_active:!selectedGovernanceSeries.active,
    p_reason:reason,
   },
  })
 }

 function deleteUnusedSeries(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||reconcileRequired||!selectedGovernanceSeries)return
  if(!selectedGovernanceSeries.can_delete){
   setError(formatPromotionDeleteBlockReason(false,selectedGovernanceSeries.delete_block_reason))
   return
  }
  const reason=governanceReason.trim()
  if(reason.length<3||reason.length>300||deleteConfirm!=='EXCLUIR'){
   setError('Informe o motivo e digite EXCLUIR para remover uma série de oferta sem uso.')
   return
  }
  void run({
   name:'delete_saas_promotion_series_if_unused',
   retryable:false,
   kind:'delete_series',
   args:{
    p_promotion_series_id:selectedGovernanceSeries.promotion_series_id,
    p_reason:reason,
   },
  })
 }

 const locked=pending||uncertain||reconcileRequired
 const normalizedReason=governanceReason.trim()
 const canToggleSeries=Boolean(selectedGovernanceSeries&&normalizedReason.length>=3&&normalizedReason.length<=300)
 const canDeleteSeries=Boolean(canToggleSeries&&selectedGovernanceSeries?.can_delete&&deleteConfirm==='EXCLUIR')

 return <section className="panel member-editor" aria-label="Operar ofertas Master">
  <div className="section-title"><h3>Rascunhos e publicação de ofertas</h3>
   <button className="secondary" type="button" disabled={pending||uncertain}
    onClick={()=>{setSuccess('');setRevision(v=>v+1);if(reconcileRequired)onCatalogChange?.()}}>Atualizar ofertas</button>
  </div>
  <p className="subtle">Operações restritas ao MASTER com MFA. Criar ou editar rascunho não concede benefício nem altera contratos existentes. Criação/sucessora idempotente, publicação, ativação/desativação e exclusão registram evento em saas_master_audit_logs; edição de rascunho atualiza updated_at na versão.</p>
  {success&&<p role="status">{success}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" disabled={pending} className="secondary"
   onClick={()=>{if(cmd.current)void run(cmd.current)}}>Verificar envio</button>}
  {!promotions?(!error&&<p role="status">Consultando ofertas…</p>):<>
   <form aria-label="Criar rascunho de promoção" onSubmit={create}>
    <fieldset disabled={locked}>
     <legend>Nova oferta em rascunho</legend>
     <label htmlFor="promo-successor-source">Modalidade da versão</label>
     <select id="promo-successor-source" value={sourcePromotion} onChange={e=>setSourcePromotion(e.target.value)}>
      <option value="">Nova série de oferta</option>
      {promotions.filter(p=>p.latest_version_status==='published').map(p=>
       <option key={p.latest_promotion_id} value={p.latest_promotion_id}>
        Nova versão de {p.name} (v{p.version_number})
       </option>)}
     </select>
     <p className="subtle">Uma versão sucessora inicia vigência futura e não edita o desconto histórico; se já existe rascunho sucessor, conclua-o antes de criar outro.</p>
     <div className="member-form-grid">
      <div><label htmlFor="promo-name">Nome da oferta</label><input id="promo-name" name="name" maxLength={120} required/></div>
      <div><label htmlFor="promo-code">Código público</label><input id="promo-code" name="code" maxLength={40} required/></div>
      <div><label htmlFor="promo-type">Benefício</label><select id="promo-type" name="type">
       <option value="percent">Desconto percentual</option><option value="fixed_amount">Desconto fixo</option><option value="trial_price">Preço de teste</option>
      </select></div>
      <div><label htmlFor="promo-value">Valor (R$ ou %)</label><input id="promo-value" name="value" required inputMode="decimal"/></div>
      <div><label htmlFor="promo-duration">Duração</label><select id="promo-duration" name="duration" value={duration} onChange={e=>setDuration(e.target.value)}>
       <option value="once">Uma vez</option><option value="cycles">Ciclos</option><option value="date_range">Período</option>
      </select></div>
      {duration==='cycles'&&<div><label htmlFor="promo-cycles">Número de ciclos</label><input id="promo-cycles" name="cycles" type="number" min={1} max={36} required/></div>}
      <div><label htmlFor="promo-start">Início (data e horário)</label><input id="promo-start" name="from" type="datetime-local" required/></div>
      <div><label htmlFor="promo-end">Término (opcional)</label><input id="promo-end" name="to" type="datetime-local"/></div>
      <div><label htmlFor="promo-scope">Elegibilidade</label><select id="promo-scope" name="scope">
       <option value="new_customers">Novos clientes</option>
       <option value="selected_customers">Clientes selecionados</option>
       <option value="all_eligible">Todos elegíveis</option>
      </select></div>
      <div><label htmlFor="promo-limit">Limite de resgates (opcional)</label><input id="promo-limit" name="limit" type="number" min={1} max={1000000}/></div>
     </div>
     <label><input type="checkbox" name="stackable"/>Permitir combinação com outras ofertas</label>
     <button className="primary" type="submit" disabled={locked}>Criar somente rascunho</button>
    </fieldset>
   </form>

   <form aria-label="Editar rascunho de promoção" onSubmit={updateDraft}>
    <fieldset disabled={locked||!drafts.length}>
     <legend>Editar oferta em rascunho</legend>
     <label htmlFor="promo-edit-draft-id">Rascunho de oferta para editar</label>
     <select id="promo-edit-draft-id" value={editPromotionId} required
      onChange={e=>setEditPromotionId(e.target.value)}>
      <option value="">{drafts.length?'Selecione um rascunho':'Nenhum rascunho disponível para edição'}</option>
      {drafts.map(p=><option key={p.latest_promotion_id} value={p.latest_promotion_id}>
       {p.name} ({p.public_code}) — v{p.version_number}
      </option>)}
     </select>
     <p className="subtle">Apenas versões ainda em rascunho podem ser alteradas. Ofertas publicadas preservam seu histórico imutável.</p>
     {selectedEditDraft&&<>
      {editLoadingDetails&&<p role="status">Carregando dados completos do rascunho…</p>}
      {editDetailsError&&<p role="alert" className="message error">{editDetailsError}</p>}
      {!editLoadingDetails&&!editDetailsError&&<>
       <div className="member-form-grid">
        <div><label htmlFor="promo-edit-name">Nome do rascunho da oferta</label>
         <input id="promo-edit-name" value={editName} onChange={e=>setEditName(e.target.value)} maxLength={120} required/></div>
        <div><label htmlFor="promo-edit-code">Código público do rascunho</label>
         <input id="promo-edit-code" value={editCode} onChange={e=>setEditCode(e.target.value)} maxLength={40} required/></div>
        <div><label htmlFor="promo-edit-type">Benefício do rascunho</label>
         <select id="promo-edit-type" value={editType} onChange={e=>setEditType(e.target.value as typeof editType)}>
          <option value="percent">Desconto percentual</option><option value="fixed_amount">Desconto fixo</option><option value="trial_price">Preço de teste</option>
         </select></div>
        <div><label htmlFor="promo-edit-value">Valor do rascunho (R$ ou %)</label>
         <input id="promo-edit-value" value={editValue} onChange={e=>setEditValue(e.target.value)} required inputMode="decimal"/></div>
        <div><label htmlFor="promo-edit-duration">Duração do rascunho</label>
         <select id="promo-edit-duration" value={editDuration} onChange={e=>setEditDuration(e.target.value as typeof editDuration)}>
          <option value="once">Uma vez</option><option value="cycles">Ciclos</option><option value="date_range">Período</option>
         </select></div>
        {editDuration==='cycles'&&<div><label htmlFor="promo-edit-cycles">Ciclos do rascunho</label>
         <input id="promo-edit-cycles" type="number" min={1} max={36} value={editCycles} onChange={e=>setEditCycles(e.target.value)} required/></div>}
        <div><label htmlFor="promo-edit-start">Início do rascunho (data e horário)</label>
         <input id="promo-edit-start" type="datetime-local" value={editFrom} onChange={e=>setEditFrom(e.target.value)} required/></div>
        <div><label htmlFor="promo-edit-end">Término do rascunho (opcional)</label>
         <input id="promo-edit-end" type="datetime-local" value={editTo} onChange={e=>setEditTo(e.target.value)}/></div>
        <div><label htmlFor="promo-edit-scope">Elegibilidade do rascunho</label>
         <select id="promo-edit-scope" value={editScope} onChange={e=>setEditScope(e.target.value as typeof editScope)}>
          <option value="new_customers">Novos clientes</option>
          <option value="selected_customers">Clientes selecionados</option>
          <option value="all_eligible">Todos elegíveis</option>
         </select></div>
        <div><label htmlFor="promo-edit-limit">Limite de resgates do rascunho (opcional)</label>
         <input id="promo-edit-limit" type="number" min={1} max={1000000} value={editLimit} onChange={e=>setEditLimit(e.target.value)}/></div>
       </div>
       <label><input type="checkbox" checked={editStackable} onChange={e=>setEditStackable(e.target.checked)}/>Permitir combinação neste rascunho</label>
       <button className="primary" type="submit" disabled={locked}>Salvar alterações da oferta</button>
      </>}
     </>}
    </fieldset>
   </form>

   <form aria-label="Publicar promoção Master" onSubmit={publish}>
    <fieldset disabled={locked||!drafts.length}>
     <legend>Publicar rascunho verificado</legend>
     <label htmlFor="promo-draft">Oferta em rascunho</label>
     <select id="promo-draft" required value={draft} onChange={e=>{setDraft(e.target.value);setConfirmed('')}}>
      <option value="">Selecione</option>{drafts.map(p=><option key={p.latest_promotion_id} value={p.latest_promotion_id}>
       {p.name} ({p.public_code}) — v{p.version_number}</option>)}
     </select>
     <label htmlFor="promo-confirm">Para publicar, digite PUBLICAR</label>
     <input id="promo-confirm" value={confirmed} onChange={e=>setConfirmed(e.target.value)} autoComplete="off"/>
     <p className="subtle">Confira o público-alvo, benefício e vigência. Publicação não aplica descontos retrospectivamente e não garante resgate.</p>
     <button className="primary" type="submit" disabled={locked||!draft||confirmed!=='PUBLICAR'}>Publicar oferta</button>
    </fieldset>
   </form>

   <form aria-label="Gerenciar série da oferta" onSubmit={deleteUnusedSeries}>
    <fieldset disabled={locked||!promotions.length}>
     <legend>Ativação e exclusão segura de séries</legend>
     <label htmlFor="promo-governance-series-id">Série de oferta para ativação ou exclusão</label>
     <select id="promo-governance-series-id" value={governanceSeriesId}
      onChange={e=>{setGovernanceSeriesId(e.target.value);setDeleteConfirm('')}}>
      <option value="">Selecione uma série</option>
      {promotions.map(p=><option key={p.promotion_series_id} value={p.promotion_series_id}>
       {p.name} ({p.public_code}) — {formatPromotionStatus(p)}
      </option>)}
     </select>
     {selectedGovernanceSeries&&<>
      <div className="callout">
       <p style={{margin:'0 0 0.35rem'}}>
        <strong>Situação da série:</strong> {formatPromotionStatus(selectedGovernanceSeries)} · resgates: {selectedGovernanceSeries.redemption_count}
       </p>
       <p style={{margin:0}}>
        <strong>Regra de exclusão:</strong> {formatPromotionDeleteBlockReason(selectedGovernanceSeries.can_delete,selectedGovernanceSeries.delete_block_reason)}
       </p>
      </div>
      <label htmlFor="promo-governance-reason">Motivo da alteração da oferta</label>
      <input id="promo-governance-reason" value={governanceReason}
       onChange={e=>setGovernanceReason(e.target.value)} maxLength={300}
       placeholder="Ex.: Encerramento de campanha ou ajuste antes de publicar"/>
      <div className="finance-sections" style={{marginTop:'0.75rem'}}>
       <button className="secondary" type="button" disabled={locked||!canToggleSeries} onClick={toggleSeriesActive}>
        {selectedGovernanceSeries.active?'Desativar série de oferta':'Reativar série de oferta'}
       </button>
      </div>
      <label htmlFor="promo-delete-confirm">Para excluir oferta sem uso, digite EXCLUIR</label>
      <input id="promo-delete-confirm" value={deleteConfirm}
       onChange={e=>setDeleteConfirm(e.target.value)} autoComplete="off"/>
      <p className="subtle">Séries com histórico publicado, resgates, clientes vinculados ou ajuste em fatura não podem ser excluídas; utilize Desativar série de oferta.</p>
      <button className="secondary" type="submit" disabled={locked||!canDeleteSeries}>
       Excluir série sem uso
      </button>
     </>}
    </fieldset>
   </form>
  </>}
 </section>
}
