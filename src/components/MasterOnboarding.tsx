import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadMasterOnboarding,validateOnboardingDraft,type OnboardingDraft,type OnboardingPlan} from '../lib/master-onboarding'
import {formatMoney} from '../lib/finance-data'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Command={name:'create_master_onboarding_draft_idempotent'|'provision_saas_onboarding_database';args:Record<string,unknown>}
export function MasterOnboarding({client}:{client:SupabaseClient}){
 const [runs,setRuns]=useState<OnboardingDraft[]|null>(null)
 const [plans,setPlans]=useState<OnboardingPlan[]|null>(null)
 const [revision,setRevision]=useState(0)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const [selected,setSelected]=useState('')
 const [confirmed,setConfirmed]=useState(false)
 const [provisionConfirmation,setProvisionConfirmation]=useState('')
 const cmd=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let active=true;const abort=new AbortController()
  setRuns(null);setPlans(null);setError('')
  loadMasterOnboarding(client,abort.signal)
   .then(result=>{if(active){setRuns(result.runs);setPlans(result.plans)}})
   .catch(()=>{if(active)setError('Não foi possível consultar os rascunhos Master ou os planos publicados.')})
  return()=>{active=false;abort.abort()}
 },[client,revision])
 async function run(next:Command){
  if(guard.current)return
  cmd.current=cmd.current??next;guard.current=true
  setPending(true);setError('');setSuccess('')
  try{
   const response=await client.rpc(cmd.current.name,cmd.current.args)
   if(response.error)throw response.error
   if(typeof response.data!=='string'||!uuid.test(response.data))throw Error('Onboarding write unconfirmed')
   if(mounted.current){
    const wasProvision=cmd.current.name==='provision_saas_onboarding_database'
    cmd.current=null;setUncertain(false)
    setSuccess(wasProvision
     ? 'Loja e assinatura provisionadas no DEV. O convite ficou registrado como tarefa pendente; não há confirmação de envio.'
     : 'Rascunho de implantação salvo. Nenhuma Loja, assinatura ou convite foi criado.')
    setRevision(v=>v+1)
   }
  }catch(failure){
   if(!mounted.current)return
   const code=(failure as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000'].includes(code)){
    cmd.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?'Somente MASTER com MFA ativo pode salvar implantações.':
     'O banco recusou este rascunho. Verifique plano publicado, vigência e dados da Loja.')
   }else{
    setUncertain(true)
    setError('Resposta não confirmada. Verifique o envio repetindo exatamente os mesmos parâmetros.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function provision(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(!runs||!plans||pending||uncertain||provisionConfirmation!=='PROVISIONAR')return
  const draft=runs.find(r=>r.id===selected&&r.status==='draft'&&r.organization_id===null)
  const plan=plans.find(p=>p.id===draft?.plan_version_id&&p.status==='published')
  if(!draft||!plan||!draft.prospective_name||!draft.organization_number||
     !draft.admin_email||!draft.invite_email||!draft.tenant_slug||!draft.subscription_start||
     draft.subscription_start<plan.valid_from||
     (plan.valid_to!==null&&draft.subscription_start>plan.valid_to)){
   setError('Rascunho incompleto ou plano/vigência inválida. O provisionamento está bloqueado.');return
  }
  void run({name:'provision_saas_onboarding_database',args:{p_run_id:draft.id}})
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  if(!runs||!plans||pending||uncertain||!confirmed)return
  const f=new FormData(event.currentTarget)
  const get=(name:string)=>String(f.get(name)??'').trim()
  const source={
   name:get('name'),number:get('number'),adminName:get('adminName'),adminEmail:get('adminEmail'),
   billingEmail:get('billingEmail'),planId:get('planId'),price:get('price'),start:get('start'),
   trialDays:Number(get('trialDays')),city:get('city'),state:get('state'),
   tenantSlug:get('tenantSlug'),inviteEmail:get('inviteEmail'),
  }
  try{
   const valid=validateOnboardingDraft(source,plans)
   void run({name:'create_master_onboarding_draft_idempotent',args:{
    p_idempotency_key:crypto.randomUUID(),
    p_payload:{
     prospective_name:valid.name,organization_number:valid.number,
     city:valid.city||null,state_code:valid.state||null,
     admin_name:valid.adminName,admin_email:valid.adminEmail,
     billing_email:valid.billingEmail,invite_email:valid.inviteEmail,
     tenant_slug:valid.tenantSlug,plan_version_id:valid.planId,
     contract_price:valid.price,subscription_start:valid.start,
     trial_days:valid.trialDays,
    },
   }})
  }catch(e){setError((e as Error).message)}
 }
 const draft=runs?.filter(r=>r.status==='draft')??[]
 const selectedDraft=draft.find(r=>r.id===selected)
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Implantação de Loja Master">
  <div className="section-title"><h3>Implantação de Lojas — rascunhos</h3>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>{setSuccess('');setRevision(v=>v+1)}}>Atualizar rascunhos</button>
  </div>
  <p className="subtle">Preparação exclusivamente pelo Master com MFA. Salvar um rascunho não provisiona uma Loja, ativa assinatura, envia e-mail ou gera cobrança. O provisionamento exige confirmação específica de rascunho completo e gera somente uma tarefa de convite; não comprova envio do e-mail.</p>
  {success&&<p role="status">{success}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={pending}
   onClick={()=>{if(cmd.current)void run(cmd.current)}}>Verificar envio</button>}
  {!runs||!plans?(!error&&<p role="status">Consultando implantação da plataforma…</p>):<>
   <h4>Rascunhos em andamento</h4>
   {!draft.length?<p>Nenhum rascunho pendente.</p>:<>
    <label htmlFor="master-onboarding-select">Consultar rascunho</label>
    <select id="master-onboarding-select" value={selected} onChange={e=>{setSelected(e.target.value);setProvisionConfirmation('')}}>
     <option value="">Selecione</option>{draft.map(r=><option key={r.id} value={r.id}>
      {r.prospective_name??'Loja sem nome'} — {r.current_step}
     </option>)}
    </select>
    {selectedDraft&&<div className="panel">
     <p><strong>{selectedDraft.prospective_name??'Não informado'}</strong> — {selectedDraft.organization_number??'Sem número'}</p>
     <p>Etapa: {selectedDraft.current_step} · Situação: {selectedDraft.status}</p>
     <p>Contrato previsto: {selectedDraft.contract_price===null?'Sem valor definido':formatMoney(Number(selectedDraft.contract_price))} · Início: {selectedDraft.subscription_start??'Não definido'}</p>
     <p>Proposta e informações do administrador ficam restritas ao acesso Master.</p>
     <form aria-label="Provisionar Loja no DEV" onSubmit={provision}>
      <fieldset disabled={locked}>
       <legend>Provisionamento controlado</legend>
       <p className="subtle">Esta operação cria a Loja, inicia a assinatura conforme o contrato e coloca um convite na fila de tarefas. Ela não confirma entrega de e-mail, pagamento ou homologação do cliente. O comando aceita reconsulta do mesmo rascunho sem criar outra Loja.</p>
       <label htmlFor="master-provision-confirm">Para provisionar, digite PROVISIONAR</label>
       <input id="master-provision-confirm" value={provisionConfirmation}
        onChange={e=>setProvisionConfirmation(e.target.value)} autoComplete="off"/>
       <button className="primary" type="submit" disabled={locked||provisionConfirmation!=='PROVISIONAR'}>
        Criar Loja e assinatura
       </button>
      </fieldset>
     </form>
    </div>}
   </>}
   <form aria-label="Criar rascunho de implantação" onSubmit={submit}>
    <fieldset disabled={locked}>
     <legend>Novo rascunho de Loja</legend>
     <div className="member-form-grid">
      <div><label htmlFor="onboarding-name">Nome da Loja</label><input id="onboarding-name" name="name" required maxLength={180}/></div>
      <div><label htmlFor="onboarding-number">Número da Loja</label><input id="onboarding-number" name="number" required maxLength={40}/></div>
      <div><label htmlFor="onboarding-city">Cidade</label><input id="onboarding-city" name="city" maxLength={140}/></div>
      <div><label htmlFor="onboarding-state">UF</label><input id="onboarding-state" name="state" maxLength={2}/></div>
      <div><label htmlFor="onboarding-admin">Responsável inicial</label><input id="onboarding-admin" name="adminName" required maxLength={140}/></div>
      <div><label htmlFor="onboarding-admin-email">E-mail do administrador</label><input id="onboarding-admin-email" name="adminEmail" type="email" required/></div>
      <div><label htmlFor="onboarding-billing-email">E-mail financeiro</label><input id="onboarding-billing-email" name="billingEmail" type="email" required/></div>
      <div><label htmlFor="onboarding-invite">E-mail previsto para convite</label><input id="onboarding-invite" name="inviteEmail" type="email" required/></div>
      <div><label htmlFor="onboarding-slug">Identificador público sugerido</label><input id="onboarding-slug" name="tenantSlug" placeholder="loja-101" required maxLength={61}/></div>
      <div><label htmlFor="onboarding-plan">Versão comercial publicada</label><select id="onboarding-plan" name="planId" required defaultValue="">
       <option value="">Selecione</option>{plans.map(p=><option key={p.id} value={p.id}>
        {p.display_name_snapshot??'Plano'} v{p.version_number} — {formatMoney(Number(p.price))}
       </option>)}</select></div>
      <div><label htmlFor="onboarding-price">Valor contratado (R$)</label><input id="onboarding-price" name="price" inputMode="decimal" placeholder="125.00" required/></div>
      <div><label htmlFor="onboarding-start">Início da assinatura</label><input id="onboarding-start" name="start" type="date" required/></div>
      <div><label htmlFor="onboarding-trial">Dias de teste</label><input id="onboarding-trial" name="trialDays" type="number" min={0} max={365} defaultValue={0} required/></div>
     </div>
     <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      Confirmo que os dados são de proposta e autorizo apenas salvar o rascunho, sem provisionamento.</label>
     <button type="submit" className="primary" disabled={!confirmed||locked||!plans.length}>Salvar somente rascunho</button>
    </fieldset>
   </form>
  </>}
 </section>
}
