import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPeriodState,type PeriodState } from '../lib/periods'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
type Command={name:'close_financial_period_idempotent'|'reopen_financial_period_idempotent';args:Record<string,unknown>}
export function FinancialPeriods({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [month,setMonth]=useState('')
 const [state,setState]=useState<PeriodState|null>(null)
 const [revision,setRevision]=useState(0)
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setState(null);setError('');setSaved(false);setConfirmed(false)
  if(month){
   loadPeriodState(client,organizationId,month,controller.signal)
    .then(s=>{if(live)setState(s)})
    .catch(()=>{if(live)setError('Não foi possível conferir o estado da competência. Nenhuma alteração está liberada.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,organizationId,month,revision])
 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next
  guard.current=true;setBusy(true);setError('');setSaved(false)
  try{
   const result=await client.rpc(command.current.name,command.current.args)
   if(result.error)throw result.error
   if(typeof result.data!=='string'||!uuid.test(result.data))
    throw Error('Unconfirmed period event')
   if(mounted.current){
    command.current=null;setUncertain(false);setSaved(true);setRevision(v=>v+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code
   if(['22023','23503','23505','23514','42501','28000','55000'].includes(code??'')){
    command.current=null;setUncertain(false);setState(null)
    setError(code==='42501'||code==='28000'?
     'Seu perfil não possui autorização para alterar o fechamento desta competência.':
     'A competência foi alterada ou a operação foi bloqueada. Atualize e confira o estado antes de tentar novamente.')
   }else{
    setUncertain(true)
    setError('O resultado não foi confirmado. Use Verificar envio para repetir o mesmo comando com chave idempotente.')
   }
  }finally{guard.current=false;if(mounted.current)setBusy(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(busy||uncertain||!state||!confirmed)return
  if(state.period!==month+'-01'||state.organizationId!==organizationId)return
  if(reason.trim().length<3||reason.trim().length>500){
   setError('Informe justificativa com 3 a 500 caracteres.');return
  }
  void run({name:state.closed?'reopen_financial_period_idempotent':'close_financial_period_idempotent',args:{
   p_organization_id:organizationId,p_period:state.period,p_reason:reason.trim(),
   p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const locked=busy||uncertain
 return <section className="panel member-editor" aria-label="Fechamento de competência">
  <div className="section-title"><h2>Fechamento e reabertura de competência</h2>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>setRevision(v=>v+1)}>Atualizar competência</button>
  </div>
  <p className="subtle">O fechamento é registrado como evento auditável, bloqueando novas operações na competência fechada. A reabertura também é um evento histórico, sujeito a permissão específica.</p>
  {saved&&<p role="status">Evento de competência confirmado. O estado foi consultado novamente.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button className="secondary" type="button" disabled={busy}
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  <label htmlFor="period-month">Competência</label>
  <input id="period-month" type="month" value={month} disabled={locked}
   onChange={e=>{setMonth(e.target.value);setReason('');setConfirmed(false)}}/>
  {month&&!state&&!error&&<p role="status">Conferindo eventos da competência…</p>}
  {state&&<section aria-label="Estado da competência">
   <p>Estado atual: <strong>{state.closed?'Fechada':state.exists?'Reaberta ou sem fechamento':'Ainda sem eventos'}</strong>.</p>
   <form aria-label="Alterar estado da competência" onSubmit={submit}>
    <fieldset disabled={locked}>
     <label htmlFor="period-reason">Justificativa</label>
     <textarea id="period-reason" maxLength={500} minLength={3} required rows={3}
      value={reason} onChange={e=>setReason(e.target.value)} />
     <label className="check-label"><input type="checkbox" checked={confirmed}
      onChange={e=>setConfirmed(e.target.checked)}/>
      Confirmo que conferi lançamentos, aprovações, pagamentos e o impacto sobre a competência.</label>
     <button className="primary" type="submit" disabled={!confirmed||!reason.trim()||locked}>
      {state.closed?'Reabrir competência':'Fechar competência'}
     </button>
    </fieldset>
   </form>
   <p className="subtle">É vedado apagar lançamentos históricos. Para corrigir um lançamento já contabilizado, utilize operações de ajuste, cancelamento e estorno; o sistema mantém os eventos originais.</p>
  </section>}
 </section>
}
