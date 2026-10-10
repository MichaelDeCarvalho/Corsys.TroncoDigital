import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizedAmount} from '../lib/member-configuration'
import {loadPlatformCommercialCatalog,type PlatformPromotion} from '../lib/master-commercial'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
type Command={name:'create_master_promotion_draft_idempotent'|'publish_master_promotion_draft_idempotent';args:Record<string,unknown>}
function when(input:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error('Data e horário inválidos.')
 const date=new Date(input)
 if(Number.isNaN(date.getTime()))throw Error('Data e horário inválidos.')
 return date.toISOString()
}
export function MasterPromotions({client}:{client:SupabaseClient}){
 const [promotions,setPromotions]=useState<PlatformPromotion[]|null>(null)
 const [draft,setDraft]=useState(''),[confirmed,setConfirmed]=useState('')
 const [revision,setRevision]=useState(0),[pending,setPending]=useState(false)
 const [uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [duration,setDuration]=useState('once')
 const guard=useRef(false),mounted=useRef(false),cmd=useRef<Command|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let active=true;const abort=new AbortController()
  setPromotions(null);setError('')
  loadPlatformCommercialCatalog(client,abort.signal)
   .then(res=>{if(active){setPromotions(res.promotions);setDraft('');setConfirmed('')}})
   .catch(()=>{if(active)setError('Não foi possível consultar rascunhos de ofertas no Master.')})
  return()=>{active=false;abort.abort()}
 },[client,revision])
 async function run(next:Command){
  if(guard.current)return
  cmd.current=cmd.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  try{
   const response=await client.rpc(cmd.current.name,cmd.current.args)
   if(response.error)throw response.error
   if(typeof response.data!=='string'||!uuid.test(response.data))
    throw Error('Master promotion command unconfirmed')
   if(mounted.current){
    const created=cmd.current.name==='create_master_promotion_draft_idempotent'
    cmd.current=null;setUncertain(false)
    setSuccess(created?'Rascunho promocional confirmado. A oferta ainda não está publicada.':
      'Oferta publicada com confirmação no banco. Verifique a vigência no catálogo.')
    setRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000'].includes(code)){
    cmd.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?'Operação exclusiva MASTER com MFA ativo.':
     'Operação recusada. Confira as datas, regras e histórico antes de tentar novamente.')
   }else{
    setUncertain(true);setError('Resposta não confirmada. Verifique o envio para repetir a mesma chave e parâmetros.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||!promotions)return
  const data=new FormData(event.currentTarget),get=(key:string)=>String(data.get(key)??'').trim()
  try{
   const code=get('code').toUpperCase(),name=get('name')
   const type=get('type'),durationType=get('duration')
   const value=normalizedAmount(get('value'))
   const cycles=durationType==='cycles'?Number(get('cycles')):null
   const limit=get('limit')?Number(get('limit')):null
   const from=when(get('from')),to=get('to')?when(get('to')):null
   if(name.length<3||name.length>120||!/^[A-Z0-9_-]{3,40}$/.test(code)||
    !['percent','fixed_amount','trial_price'].includes(type)||
    Number(value)<=0||(type==='percent'&&Number(value)>100)||
    !['once','cycles','date_range'].includes(durationType)||
    (durationType==='cycles'&&(!Number.isSafeInteger(cycles)||cycles===null||cycles<1||cycles>36))||
    (limit!==null&&(!Number.isSafeInteger(limit)||limit<1||limit>1000000))||
    (to!==null&&to<=from))throw Error('Parâmetros da oferta inválidos.')
   void run({name:'create_master_promotion_draft_idempotent',args:{
    p_name:name,p_public_code:code,p_benefit_type:type,p_benefit_value:value,
    p_duration_type:durationType,p_duration_cycles:cycles,
    p_valid_from:from,p_valid_to:to,p_eligibility_scope:get('scope'),
    p_max_redemptions:limit,p_stackable:data.has('stackable'),
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(e){setError((e as Error).message)}
 }
 function publish(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(pending||uncertain||confirmed!=='PUBLICAR')return
  const selected=promotions?.find(p=>p.latest_promotion_id===draft&&p.latest_version_status==='draft')
  if(!selected){setError('O rascunho mudou. Atualize o catálogo.');return}
  void run({name:'publish_master_promotion_draft_idempotent',args:{
   p_promotion_id:selected.latest_promotion_id,p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const drafts=promotions?.filter(p=>p.latest_version_status==='draft')??[]
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Operar ofertas Master">
  <div className="section-title"><h3>Rascunhos e publicação de ofertas</h3>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>{setSuccess('');setRevision(v=>v+1)}}>Atualizar ofertas</button>
  </div>
  <p className="subtle">Operações restritas ao MASTER com MFA. Criar rascunho não concede benefício nem altera contratos existentes. Publicar registra nova versão comercial, sem executar resgate automático.</p>
  {success&&<p role="status">{success}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" disabled={pending} className="secondary"
   onClick={()=>{if(cmd.current)void run(cmd.current)}}>Verificar envio</button>}
  {!promotions?(!error&&<p role="status">Consultando ofertas…</p>):<>
   <form aria-label="Criar rascunho de promoção" onSubmit={create}>
    <fieldset disabled={locked}>
     <legend>Nova oferta em rascunho</legend>
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
  </>}
 </section>
}
