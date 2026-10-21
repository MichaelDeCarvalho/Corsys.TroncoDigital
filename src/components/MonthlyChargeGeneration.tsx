import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
 fetchMonthlyPreview, loadMonthlyRules, monthStart,
 type MonthlyGenerationPreview,type MonthlyRuleSummary
} from '../lib/monthly-generation'

type Command={name:'generate_monthly_member_charges';args:Record<string,unknown>}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function MonthlyChargeGeneration({client,organizationId}:{
 client:SupabaseClient;organizationId:string
}){
 const [rules,setRules]=useState<MonthlyRuleSummary[]|null>(null)
 const [rule,setRule]=useState(''),[month,setMonth]=useState('')
 const [preview,setPreview]=useState<MonthlyGenerationPreview|null>(null)
 const [reason,setReason]=useState('')
 const [previewPending,setPreviewPending]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[batch,setBatch]=useState('')
 const [revision,setRevision]=useState(0)
 const request=useRef(0),command=useRef<Command|null>(null)
 const mounted=useRef(false),guard=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  const abort=new AbortController();let live=true
  setRules(null);setPreview(null);setError('')
  loadMonthlyRules(client,organizationId,abort.signal)
    .then(rows=>{if(live){setRules(rows);setRule(previous=>rows.some(r=>r.id===previous)?previous:'')}})
    .catch(()=>{if(live)setError('Não foi possível consultar as regras mensais desta Loja.')})
  return()=>{live=false;abort.abort()}
 },[client,organizationId,revision])
 function resetPreview(){
  request.current+=1
  setPreviewPending(false);setPreview(null);setBatch('');setError('')
 }
 async function check(){
  if(!rule||!month||uncertain||pending)return
  const seq=++request.current
  setPreviewPending(true);setPreview(null);setError('');setBatch('')
  try{
   const result=await fetchMonthlyPreview(client,organizationId,rule,month)
   if(seq===request.current&&mounted.current)setPreview(result)
  }catch(e){
   if(seq===request.current&&mounted.current)
    setError((e as {code?:string}|null)?.code==='42501'?
      'Sua conta não tem autorização para gerar cobranças nesta Loja.':
      'Não foi possível conferir esta competência. Revise a regra e tente novamente.')
  }finally{
   if(seq===request.current&&mounted.current)setPreviewPending(false)
  }
 }
 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next
  guard.current=true;setPending(true);setError('');setBatch('')
  try{
   const result=await client.rpc(command.current.name,command.current.args)
   if(result.error)throw result.error
   if(typeof result.data!=='string'||!uuid.test(result.data))
    throw Error('Unconfirmed monthly batch identifier')
   if(mounted.current){
    command.current=null;setUncertain(false);setBatch(result.data);setPreview(null)
    setRevision(v=>v+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code
   if(['22023','23503','23505','23514','40001','PT409','42501','28000','55000'].includes(code??'')){
    command.current=null;setUncertain(false);setPreview(null)
    setError((code === '40001' || code === 'PT409')?
     'A prévia ficou desatualizada. Consulte novamente antes de gerar as cobranças.':
     code==='23514'||code==='23505'?
     'Geração bloqueada: confira mapeamentos, competência, situação da Loja e cobranças já emitidas.':
     code==='42501'||code==='28000'?
     'Seu perfil ou a assinatura da Loja não permite gerar cobranças.':
     'Não foi possível gerar: confira os parâmetros e consulte novamente.')
   }else{
    setUncertain(true)
    setError('Resultado não confirmado. Use Verificar envio: será reenviada exatamente a mesma solicitação para evitar duplicidade.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function generate(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(guard.current||pending||uncertain||!preview?.ready||
    preview.organization_id!==organizationId||preview.rule_id!==rule||
    preview.competence!==monthStart(month))return
  if(reason.trim().length<3||reason.trim().length>500){
   setError('Informe o motivo da geração (3 a 500 caracteres).');return
  }
  void run({name:'generate_monthly_member_charges',args:{
   p_organization_id:organizationId,p_rule_id:rule,p_competence:preview.competence,
   p_expected_fingerprint:preview.fingerprint,p_reason:reason.trim(),
   p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Gerar mensalidades">
  <div className="section-title">
   <h2>Geração mensal de cobranças</h2>
   <button className="secondary" disabled={pending||uncertain} type="button"
    onClick={()=>{resetPreview();setRevision(v=>v+1)}}>Atualizar regras</button>
  </div>
  <p className="subtle">A prévia utiliza preços por vigência e condições individuais dos integrantes. Isenções e valores zero não geram cobrança. Uma cobrança já emitida para o mesmo integrante, regra e competência não será duplicada. A operação é separada dos pagamentos.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {batch&&<p role="status">Lote de cobranças confirmado. Identificador: <code>{batch}</code>. Atualize o Financeiro para consultar os lançamentos.</p>}
  {uncertain&&<button className="secondary" type="button" disabled={pending}
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!rules?(!error&&<p role="status">Carregando regras financeiras…</p>):<>
   {!rules.length&&<p>Nenhuma regra mensal ativa. Configure a categoria, a regra e sua vigência no Plano de Contas.</p>}
   <label htmlFor="monthly-generator-rule">Regra mensal</label>
   <select id="monthly-generator-rule" value={rule} disabled={locked||previewPending}
    onChange={e=>{setRule(e.target.value);resetPreview()}} required>
    <option value="">Selecione a regra</option>
    {rules.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
   </select>
   <label htmlFor="monthly-generator-competence">Competência para emissão</label>
   <input id="monthly-generator-competence" type="month" value={month} disabled={locked||previewPending}
    onChange={e=>{setMonth(e.target.value);resetPreview()}} required/>
   <button type="button" className="secondary"
    disabled={!rule||!month||locked||previewPending} onClick={()=>void check()}>
    {previewPending?'Verificando…':'Verificar prévia'}
   </button>
   {preview&&<section aria-label="Prévia mensal" className="panel">
    <h3>Conferência da competência {preview.competence.slice(0,7)}</h3>
    <p>Regra: <strong>{preview.rule_name}</strong></p>
    <p>Integrantes elegíveis: <strong>{preview.eligible_members}</strong> · Novas cobranças: <strong>{preview.to_create}</strong></p>
    <p>Isentos: {preview.exempt} · Já gerados: {preview.already_generated} · Sem preço vigente: {preview.missing_price}</p>
    <p>Classificação contábil: {preview.accounting_mapping_ready?'Disponível':'Não disponível'} · Competência: {preview.period_closed?'Fechada':'Não fechada'}</p>
    {!preview.ready&&<p role="alert" className="message error">A geração não está liberada. Verifique regras, vigências, lançamentos existentes e classificação contábil.</p>}
    {preview.ready&&<form aria-label="Confirmar geração mensal" onSubmit={generate}>
      <label htmlFor="monthly-generator-reason">Motivo da geração</label>
      <input id="monthly-generator-reason" value={reason} disabled={locked} minLength={3}
       maxLength={500} required onChange={e=>setReason(e.target.value)}/>
      <p className="subtle">Ao confirmar serão criadas {preview.to_create} cobranças para esta competência. O valor e o plano contábil serão preservados historicamente; correções exigem lançamentos apropriados, nunca edição direta.</p>
      <button className="primary" type="submit" disabled={locked}>Confirmar geração de {preview.to_create} cobranças</button>
     </form>}
    </section>}
  </>}
 </section>
}
