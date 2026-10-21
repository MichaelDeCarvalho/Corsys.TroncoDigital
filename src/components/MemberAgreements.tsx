import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadManualChargeCatalog,loadMemberCharges,type ChargeMember,type ChargeBalance} from '../lib/manual-charges'
import {normalizedAmount} from '../lib/member-configuration'
import {formatDate,formatMoney} from '../lib/finance-data'
import {agreementCents,agreementUUID,previewMemberAgreement,loadMemberAgreements,loadAgreementInstallments,type AgreementInput,type AgreementPreview,type AgreementRecord} from '../lib/member-agreements'
type Reviewed={input:AgreementInput;preview:AgreementPreview;reason:string}
type Command=AgreementInput&{p_expected_fingerprint:string;p_reason:string;p_idempotency_key:string}
export function MemberAgreements({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [members,setMembers]=useState<ChargeMember[]|null>(null),[member,setMember]=useState('')
 const [charges,setCharges]=useState<ChargeBalance[]|null>(null),[selected,setSelected]=useState<string[]>([])
 const [history,setHistory]=useState<AgreementRecord[]>([]),[details,setDetails]=useState<Awaited<ReturnType<typeof loadAgreementInstallments>>|null>(null)
 const [reviewed,setReviewed]=useState<Reviewed|null>(null),[confirmation,setConfirmation]=useState('')
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[revision,setRevision]=useState(0)
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false),detailsRequest=useRef(0)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const c=new AbortController();setMembers(null)
  loadManualChargeCatalog(client,organizationId,c.signal).then(r=>{if(live)setMembers(r.members)}).catch(()=>{if(live)setError('Não foi possível consultar os integrantes da Loja.')})
  return()=>{live=false;c.abort()}
 },[client,organizationId])
 useEffect(()=>{
  let live=true;const c=new AbortController();setCharges(null);setSelected([]);setReviewed(null);setDetails(null);setHistory([]);detailsRequest.current++
  if(member&&members?.some(m=>m.id===member))Promise.all([loadMemberCharges(client,organizationId,member,c.signal),loadMemberAgreements(client,organizationId,member,c.signal)])
   .then(([a,b])=>{if(live){setCharges(a);setHistory(b)}}).catch(()=>{if(live)setError('Consulta incompleta. Atualize antes de negociar.')})
  return()=>{live=false;c.abort()}
 },[client,organizationId,member,members,revision])
 function invalidate(){setReviewed(null);setConfirmation('');setError('');setSuccess('')}
 async function preview(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(guard.current||uncertain||!charges)return
  const d=new FormData(e.currentTarget),reason=String(d.get('reason')??'').trim()
  try{
   const input:AgreementInput={p_organization_id:organizationId,p_member_id:member,p_charge_ids:[...selected].sort(),p_amount:normalizedAmount(String(d.get('amount')??'')),p_installment_count:Number(d.get('count')),p_agreement_date:String(d.get('date')??''),p_first_due:String(d.get('due')??'')}
   if(!selected.length||selected.length>50||reason.length<3||reason.length>500||agreementCents(input.p_amount)<=0||!Number.isInteger(input.p_installment_count)||input.p_installment_count<1||input.p_installment_count>24)throw Error('Confira débitos, valor, parcelas e motivo.')
   guard.current=true;setPending(true);invalidate()
   const value=await previewMemberAgreement(client,input)
   if(mounted.current)setReviewed({input,preview:value,reason})
  }catch{if(mounted.current)setError('Prévia indisponível. Selecione débitos da mesma categoria, com saldo, classificação contábil vigente e parcelamento permitido. Confira datas e valor; juros adicionais não estão disponíveis.')}
  finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function run(){
  if(guard.current||(!command.current&&(!reviewed||confirmation!=='NEGOCIAR')))return
  if(!command.current&&reviewed)command.current={...reviewed.input,p_expected_fingerprint:reviewed.preview.fingerprint,p_reason:reviewed.reason,p_idempotency_key:crypto.randomUUID()}
  if(!command.current)return
  guard.current=true;setPending(true);setError('')
  try{
   const r=await client.rpc('create_member_debt_agreement',command.current)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!agreementUUID.test(r.data))throw Error('Unconfirmed agreement')
   if(mounted.current){command.current=null;setUncertain(false);setReviewed(null);setConfirmation('');setSuccess('Acordo confirmado. Cobranças e parcelas atualizadas.');setRevision(v=>v+1)}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string})?.code
   if(['22023','23503','23505','23514','PT409','42501','28000','55000'].includes(code??'')){
    command.current=null;setUncertain(false);setReviewed(null);setConfirmation('');setRevision(v=>v+1)
    setError(code==='42501'||code==='28000'?'Seu acesso não autoriza a negociação.':'Os débitos ou condições mudaram. Confira uma nova prévia antes de confirmar.')
   }else{setUncertain(true);setError('Resultado não confirmado. Use Verificar envio para consultar com a mesma chave, sem duplicar o acordo.')}
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function showDetails(a:AgreementRecord){
  const request=++detailsRequest.current;setDetails(null)
  try{const r=await loadAgreementInstallments(client,organizationId,a,new AbortController().signal);if(mounted.current&&request===detailsRequest.current)setDetails(r)}
  catch{if(mounted.current&&request===detailsRequest.current)setError('Não foi possível conferir as parcelas do acordo.')}
 }
 const locked=pending||uncertain,open=charges?.filter(c=>!c.is_cancelled&&agreementCents(c.open_amount)>0)??[]
 const total=open.filter(c=>selected.includes(c.charge_id)).reduce((s,c)=>s+agreementCents(c.open_amount),0)/100
 return <section className="panel member-editor member-agreements" aria-label="Negociação de débitos">
  <div className="section-title"><h2>Negociar dívida</h2><button className="secondary" disabled={locked} onClick={()=>{invalidate();setRevision(v=>v+1)}}>Atualizar débitos</button></div>
  <p className="subtle">Preserva cobranças e pagamentos anteriores. O saldo selecionado é vinculado a um acordo com novas parcelas; o acordo não movimenta o caixa. Até 24 parcelas, com ou sem desconto.</p>
  {error&&<p role="alert" className="message error">{error}</p>}{success&&<p role="status">{success}</p>}
  {uncertain&&<button disabled={pending} onClick={()=>void run()}>Verificar envio</button>}
  <label htmlFor="agreement-member">Integrante da negociação</label><select id="agreement-member" disabled={locked||!members} value={member} onChange={e=>{invalidate();setMember(e.target.value)}}>
   <option value="">Selecione o integrante</option>{members?.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
  {member&&!charges&&!error&&<p role="status">Consultando débitos e acordos…</p>}
  {charges&&<>
   <fieldset disabled={locked}><legend>Débitos que serão negociados</legend>{!open.length?<p>Nenhum débito em aberto.</p>:open.map(c=><label key={c.charge_id}><input type="checkbox" checked={selected.includes(c.charge_id)} onChange={e=>{invalidate();setSelected(old=>e.target.checked?[...old,c.charge_id]:old.filter(id=>id!==c.charge_id))}}/>{c.description} · {formatDate(c.due_date)} · {formatMoney(agreementCents(c.open_amount)/100)}</label>)}</fieldset>
   <p>Saldo devedor selecionado: <strong>{formatMoney(total)}</strong></p>
   <form aria-label="Preparar negociação" onSubmit={e=>void preview(e)} onChange={invalidate}>
    <fieldset disabled={locked}><legend>Condições do acordo</legend>
     <label>Valor negociado (R$)<input name="amount" inputMode="decimal" required placeholder="0,00"/></label>
     <label>Quantidade de parcelas<input name="count" type="number" min="1" max="24" defaultValue="1" required/></label>
     <label>Data do acordo<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
     <label>Primeiro vencimento<input name="due" type="date" required/></label>
     <label>Motivo e condições<input name="reason" minLength={3} maxLength={500} required/></label>
     <button disabled={!selected.length} type="submit">Conferir negociação</button>
    </fieldset>
   </form>
   {reviewed&&<div aria-label="Prévia da negociação"><h3>Confira as parcelas</h3>
    <p>Saldo original: {formatMoney(agreementCents(reviewed.preview.original_amount)/100)} · Negociado: {formatMoney(agreementCents(reviewed.preview.negotiated_amount)/100)}</p>
    <ol>{reviewed.preview.installments.map(x=><li key={x.number}>{formatDate(x.due_date)} · {formatMoney(agreementCents(x.amount)/100)}</li>)}</ol>
    <label>Digite NEGOCIAR para confirmar<input disabled={locked} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    <button disabled={locked||confirmation!=='NEGOCIAR'} onClick={()=>void run()}>Confirmar acordo</button>
   </div>}
   <h3>Acordos do integrante</h3>{!history.length?<p>Nenhum acordo registrado.</p>:history.map(a=><article key={a.id}>
    <p>{formatDate(a.agreement_date)} · {formatMoney(agreementCents(a.negotiated_amount)/100)} · {a.installment_count} parcela(s) · {a.reason}</p>
    <button className="secondary" onClick={()=>void showDetails(a)}>Ver parcelas de {formatDate(a.agreement_date)} · {formatMoney(agreementCents(a.negotiated_amount)/100)}</button>
   </article>)}
   {details&&<ol aria-label="Parcelas do acordo">{details.map(x=><li key={x.charge_id}>Parcela {x.installment_number}: {formatDate(x.due_date)} · {formatMoney(agreementCents(x.amount)/100)}. Consulte a liquidação no extrato do integrante.</li>)}</ol>}
  </>}
 </section>
}
