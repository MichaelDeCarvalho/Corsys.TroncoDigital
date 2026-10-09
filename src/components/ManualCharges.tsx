import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizedAmount } from '../lib/member-configuration'
import { formatDate, formatMoney } from '../lib/finance-data'
import { loadManualChargeCatalog,loadMemberCharges,type ChargeBalance,
 type ChargeCategory,type ChargeMember } from '../lib/manual-charges'

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
type Command={name:'create_manual_charge'|'cancel_member_charge_idempotent';args:Record<string,unknown>}
function get(data:FormData,name:string){return String(data.get(name)??'').trim()}
function start(value:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('Competência inválida')
 return value+'-01'
}
function positive(value:string){
 const n=normalizedAmount(value)
 if(Number(n)<=0)throw Error('Informe um valor positivo.')
 return n
}
export function ManualCharges({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [members,setMembers]=useState<ChargeMember[]|null>(null)
 const [categories,setCategories]=useState<ChargeCategory[]|null>(null)
 const [member,setMember]=useState('')
 const [charges,setCharges]=useState<ChargeBalance[]|null>(null)
 const [selectedCharge,setSelectedCharge]=useState('')
 const [revision,setRevision]=useState(0)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[chargeError,setChargeError]=useState('')
 const [success,setSuccess]=useState(false)
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  const controller=new AbortController();let live=true
  setMembers(null);setCategories(null);setError('')
  loadManualChargeCatalog(client,organizationId,controller.signal)
   .then(c=>{if(live){
     setMembers(c.members);setCategories(c.categories)
     setMember(old=>c.members.some(x=>x.id===old)?old:'')
   }}).catch(()=>{if(live)setError('Não foi possível carregar integrantes e categorias desta Loja.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  const controller=new AbortController();let live=true
  setCharges(null);setSelectedCharge('');setChargeError('')
  if(member&&members?.some(m=>m.id===member))
   loadMemberCharges(client,organizationId,member,controller.signal)
    .then(result=>{if(live)setCharges(result)})
    .catch(()=>{if(live)setChargeError('Consulta de cobranças incompleta ou inconsistente. Bloqueadas novas operações.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,member,members])
 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next
  guard.current=true;setPending(true);setError('');setSuccess(false)
  try{
   const r=await client.rpc(command.current.name,command.current.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!uuid.test(r.data))throw Error('Unconfirmed charge operation')
   if(mounted.current){
    command.current=null;setUncertain(false);setSuccess(true);setRevision(v=>v+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code
   if(['22023','23503','23505','23514','40001','42501','28000','55000','P0002'].includes(code??'')){
    command.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?
     'Seu perfil ou a assinatura da Loja não autoriza esta operação.':
     code==='23514'?'Categoria ou competência sem classificação contábil publicada.':
     code==='23505'||code==='55000'?
     'A cobrança já foi cancelada ou a competência não permite o lançamento. Atualize o extrato.':
     'Operação rejeitada. Confira datas, categorias, integrante e valor.')
   }else{
    setUncertain(true)
    setError('Resultado não confirmado. Verifique o envio com a mesma chave para não duplicar lançamentos.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||!charges||!categories||!member)return
  const d=new FormData(e.currentTarget),category=get(d,'category'),issue=get(d,'issue'),due=get(d,'due')
  if(!categories.some(c=>c.id===category&&c.active)){
   setError('Escolha categoria de integrantes ativa na Loja.');return
  }
  try{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(issue)||!/^\d{4}-\d{2}-\d{2}$/.test(due))
    throw Error('Datas inválidas')
   const description=get(d,'description')
   if(description.length<3)throw Error('Informe descrição da cobrança.')
   void run({name:'create_manual_charge',args:{
    p_organization_id:organizationId,p_member_id:member,p_category_id:category,
    p_description:description,p_competence:start(get(d,'competence')),
    p_issue_date:issue,p_due_date:due,p_accounting_period:start(get(d,'period')),
    p_amount:positive(get(d,'amount')),p_reference:get(d,'reference')||null,
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 const canCancel=charges?.filter(c=>!c.is_cancelled)??[]
 function cancel(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||!charges||!canCancel.some(c=>c.charge_id===selectedCharge))return
  const d=new FormData(e.currentTarget),reason=get(d,'reason')
  if(reason.length<3||reason.length>500){setError('Informe motivo entre 3 e 500 caracteres.');return}
  try{
   void run({name:'cancel_member_charge_idempotent',args:{
    p_organization_id:organizationId,p_charge_id:selectedCharge,
    p_accounting_period:start(get(d,'period')),p_reason:reason,
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 const locked=pending||uncertain
 return <section className="panel member-editor" aria-label="Cobranças manuais">
  <div className="section-title"><h2>Cobranças avulsas e cancelamentos</h2>
   <button type="button" className="secondary" disabled={locked}
    onClick={()=>{setSuccess(false);setRevision(v=>v+1)}}>Atualizar cobranças</button></div>
  <p className="subtle">Lançamentos avulsos para categorias já configuradas, com plano contábil vigente. Uma cobrança não representa pagamento; o cancelamento é auditado e desfaz alocações pertinentes sem apagar o fato original.</p>
  {success&&<p role="status">Lançamento confirmado. As cobranças foram atualizadas.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={pending}
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!members||!categories?(!error&&<p role="status">Carregando cadastros…</p>):<>
   <label htmlFor="manual-member">Integrante</label>
   <select id="manual-member" value={member} disabled={locked} onChange={e=>setMember(e.target.value)}>
    <option value="">Selecione</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
   </select>
   {chargeError&&<p role="alert" className="message error">{chargeError}</p>}
   {member&&!charges&&!chargeError&&<p role="status">Consultando cobranças do integrante…</p>}
   {member&&charges&&<>
    <form aria-label="Cadastrar cobrança avulsa" onSubmit={create}>
     <fieldset disabled={locked}><legend>Nova cobrança</legend>
      <div className="member-form-grid">
       <div><label htmlFor="manual-desc">Descrição</label><input id="manual-desc" name="description" required maxLength={200}/></div>
       <div><label htmlFor="manual-category">Categoria</label><select id="manual-category" name="category" required defaultValue="">
        <option value="">Selecione</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
       </select></div>
       <div><label htmlFor="manual-competence">Competência da cobrança</label><input id="manual-competence" name="competence" type="month" required/></div>
       <div><label htmlFor="manual-issue">Emissão</label><input id="manual-issue" name="issue" type="date" required/></div>
       <div><label htmlFor="manual-due">Vencimento</label><input id="manual-due" name="due" type="date" required/></div>
       <div><label htmlFor="manual-period">Competência contábil</label><input id="manual-period" name="period" type="month" required/></div>
       <div><label htmlFor="manual-amount">Valor (R$)</label><input id="manual-amount" name="amount" inputMode="decimal" required/></div>
       <div><label htmlFor="manual-reference">Referência (opcional)</label><input id="manual-reference" name="reference" maxLength={150}/></div>
      </div>
      <button type="submit" className="primary" disabled={locked||!categories.length}>Cadastrar cobrança avulsa</button>
     </fieldset>
    </form>
    <h3>Histórico das cobranças consultadas</h3>
    {!charges.length?<p>Este integrante ainda não possui cobranças visíveis.</p>:
     <div className="finance-table" role="region" aria-label="Cobranças de integrante" tabIndex={0}>
      <table><thead><tr><th>Descrição</th><th>Competência</th><th>Vencimento</th><th>Em aberto</th><th>Situação</th></tr></thead>
       <tbody>{charges.map(c=><tr key={c.charge_id}>
        <th scope="row">{c.description}</th><td>{c.competence.slice(0,7)}</td>
        <td>{formatDate(c.due_date)}</td><td>{formatMoney(Number(c.open_amount))}</td>
        <td>{c.is_cancelled?'Cancelada':'Registrada'}</td>
       </tr>)}</tbody>
      </table>
     </div>}
    <form aria-label="Cancelar cobrança" onSubmit={cancel}>
     <fieldset disabled={locked||!canCancel.length}><legend>Cancelamento com histórico</legend>
      <label htmlFor="manual-cancel-target">Cobrança</label>
      <select id="manual-cancel-target" value={selectedCharge} required onChange={e=>setSelectedCharge(e.target.value)}>
       <option value="">Selecione</option>{canCancel.map(c=><option key={c.charge_id} value={c.charge_id}>{c.description} — {formatDate(c.due_date)}</option>)}
      </select>
      <label htmlFor="manual-cancel-period">Competência do cancelamento</label><input id="manual-cancel-period" name="period" type="month" required/>
      <label htmlFor="manual-cancel-reason">Motivo</label><input id="manual-cancel-reason" name="reason" required minLength={3} maxLength={500}/>
      <p className="subtle">O lançamento original permanecerá em histórico. Lançamentos alocados podem produzir eventos de reversão conforme as regras contábeis existentes.</p>
      <button type="submit" className="secondary" disabled={locked||!selectedCharge}>Cancelar cobrança</button>
     </fieldset>
    </form>
    <p className="subtle">Limitado a 150 cobranças do integrante. Consultas incompletas bloqueiam novas ações para evitar decisões baseadas em saldos parciais.</p>
   </>}
  </>}
 </section>
}
