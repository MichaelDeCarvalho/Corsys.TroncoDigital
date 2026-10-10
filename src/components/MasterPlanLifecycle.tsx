import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizedAmount} from '../lib/member-configuration'
import {loadPlatformCommercialCatalog,type PlatformPlanVersion} from '../lib/master-commercial'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const code=/^[a-z0-9][a-z0-9_-]{1,40}$/
type Command={name:'create_master_plan_draft_idempotent'|'publish_master_plan_draft_idempotent';args:Record<string,unknown>}
export function MasterPlanLifecycle({client}:{client:SupabaseClient}){
 const [plans,setPlans]=useState<PlatformPlanVersion[]|null>(null)
 const [draft,setDraft]=useState('')
 const [revision,setRevision]=useState(0)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const [confirmation,setConfirmation]=useState('')
 const guard=useRef(false),mounted=useRef(false),command=useRef<Command|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  const controller=new AbortController();let live=true
  setPlans(null);setError('');setDraft('');setConfirmation('')
  loadPlatformCommercialCatalog(client,controller.signal)
   .then(res=>{if(live)setPlans(res.plans.filter(v=>v.publication_status==='draft'))})
   .catch(()=>{if(live)setError('Não foi possível consultar as versões comerciais em rascunho.')})
  return()=>{live=false;controller.abort()}
 },[client,revision])
 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  try{
   const r=await client.rpc(command.current.name,command.current.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!uuid.test(r.data))throw Error('Unconfirmed Master plan command')
   if(mounted.current){
    const created=command.current.name==='create_master_plan_draft_idempotent'
    command.current=null;setUncertain(false)
    setSuccess(created?'Rascunho comercial confirmado. Ainda não está publicado.':
     'Versão comercial publicada com confirmação no banco. Consulte o histórico.')
    setRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000'].includes(code)){
    command.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?
     'A operação exige perfil MASTER da plataforma e MFA ativo.':
     'O banco rejeitou a operação. Atualize a lista e verifique nome, código, vigência e status.')
   }else{
    setUncertain(true)
    setError('Não foi possível confirmar o resultado. Use Verificar envio para repetir a mesma chave e parâmetros.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||!plans)return
  const d=new FormData(e.currentTarget),get=(n:string)=>String(d.get(n)??'').trim()
  try{
   const planCode=get('code').toLowerCase(),name=get('name'),interval=get('interval')
   const trial=Number(get('trial')),grace=Number(get('grace'))
   const validFrom=get('from'),price=normalizedAmount(get('price'))
   const entitlements=JSON.parse(get('entitlements')) as unknown
   if(!code.test(planCode)||name.length<2||name.length>120||
    !['monthly','yearly','custom'].includes(interval)||
    !Number.isSafeInteger(trial)||trial<0||trial>365||
    !Number.isSafeInteger(grace)||grace<0||grace>365||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(validFrom)||
    Number(price)<0||Number(price)>999999999999.99||
    !entitlements||typeof entitlements!=='object'||Array.isArray(entitlements)||
    JSON.stringify(entitlements).length>12000)
    throw Error('Confira os campos do plano, a competência e os recursos JSON.')
   void run({name:'create_master_plan_draft_idempotent',args:{
    p_code:planCode,p_name:name,p_price:price,p_billing_interval:interval,
    p_trial_days:trial,p_grace_days:grace,p_valid_from:validFrom+'-01',
    p_entitlements:entitlements,p_idempotency_key:crypto.randomUUID(),
   }})
  }catch{setError('Confira código, preço, competência futura e recursos em JSON válido.')}
 }
 function publish(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||confirmation!=='PUBLICAR')return
  const target=plans?.find(p=>p.plan_version_id===draft&&p.publication_status==='draft')
  if(!target){setError('O rascunho foi modificado. Atualize e tente novamente.');return}
  void run({name:'publish_master_plan_draft_idempotent',args:{
   p_plan_version_id:target.plan_version_id,p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Gerenciar rascunhos comerciais">
  <div className="section-title"><h3>Rascunhos e publicação de planos</h3>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>{setSuccess('');setRevision(v=>v+1)}}>Atualizar rascunhos</button>
  </div>
  <p className="subtle">Os comandos exigem MASTER com MFA. Criar um rascunho não cria assinaturas, faturas nem migra clientes. A publicação é uma decisão explícita e fica registrada no histórico.</p>
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
   <form aria-label="Publicar plano SaaS" onSubmit={publish}>
    <fieldset disabled={locked||!plans.length}>
     <legend>Publicar versão aprovada</legend>
     <label htmlFor="master-publish-version">Versão em rascunho</label>
     <select id="master-publish-version" value={draft} required onChange={e=>{setDraft(e.target.value);setConfirmation('')}}>
      <option value="">Selecione</option>
      {plans.map(p=><option key={p.plan_version_id} value={p.plan_version_id}>
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
  </>}
 </section>
}
