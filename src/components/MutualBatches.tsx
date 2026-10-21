import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadManualChargeCatalog,type ChargeMember,type ChargeCategory} from '../lib/manual-charges'
import {normalizedAmount} from '../lib/member-configuration'
import {agreementCents,agreementUUID} from '../lib/member-agreements'
import {formatMoney,formatDate} from '../lib/finance-data'
import {mutualNumbers,mutualNatures,previewMutualBatch,loadMutualBatches,loadMutualAssignments,type MutualInput,type MutualPreview,type MutualBatch,type MutualDetail} from '../lib/mutual-batches'
type Reviewed={input:MutualInput;preview:MutualPreview;reason:string}
type Command=MutualInput&{p_expected_fingerprint:string;p_reason:string;p_idempotency_key:string}
export function MutualBatches({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [catalog,setCatalog]=useState<{members:ChargeMember[];categories:ChargeCategory[]}|null>(null)
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[assignments,setAssignments]=useState<Record<number,string>>({}),[number,setNumber]=useState(''),[member,setMember]=useState('')
 const [reviewed,setReviewed]=useState<Reviewed|null>(null),[confirmation,setConfirmation]=useState(''),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState(''),[page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [batches,setBatches]=useState<MutualBatch[]|null>(null),[hasNext,setHasNext]=useState(false),[details,setDetails]=useState<MutualDetail[]|null>(null)
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false),detailVersion=useRef(0),detailController=useRef<AbortController|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;detailController.current?.abort();detailVersion.current++}},[])
 useEffect(()=>{let live=true;const c=new AbortController();loadManualChargeCatalog(client,organizationId,c.signal).then(r=>{if(live)setCatalog(r)}).catch(()=>{if(live)setError('Não foi possível consultar integrantes e categorias desta Loja.')});return()=>{live=false;c.abort()}},[client,organizationId])
 useEffect(()=>{let live=true;const c=new AbortController();setBatches(null);setDetails(null);detailController.current?.abort();detailVersion.current++
  loadMutualBatches(client,organizationId,page,c.signal).then(r=>{if(live){setBatches(r.batches);setHasNext(r.hasNext)}}).catch(()=>{if(live)setError('Não foi possível conferir as mútuas desta Loja.')});return()=>{live=false;c.abort()}
 },[client,organizationId,page,revision])
 function invalidate(){setReviewed(null);setConfirmation('');setError('');setSuccess('')}
 const numbers=mutualNumbers(start,end),active=catalog?.members.filter(m=>m.status==='active')??[],locked=pending||uncertain
 const complete=numbers.length>0&&numbers.every(n=>active.some(m=>m.id===assignments[n]))
 const unapplied=Boolean(number&&member&&assignments[Number(number)]!==member)
 function range(value:string,first:boolean){invalidate();if(first)setStart(value);else setEnd(value);setAssignments({});setNumber('');setMember('')}
 async function preview(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(guard.current||uncertain||!catalog||!complete||unapplied)return
  try{const d=new FormData(e.currentTarget),reason=String(d.get('reason')??'').trim()
   const input:MutualInput={p_organization_id:organizationId,p_category_id:String(d.get('category')??''),p_number_start:Number(start),p_number_end:Number(end),p_unit_amount:normalizedAmount(String(d.get('amount')??'')),p_competence:String(d.get('competence')??'')+'-01',p_issue_date:String(d.get('issue')??''),p_due_date:String(d.get('due')??''),p_assignments:numbers.map(n=>({mutual_number:n,member_id:assignments[n]}))}
   if(reason.length<3||reason.length>500||agreementCents(input.p_unit_amount)<=0||!catalog.categories.some(c=>c.id===input.p_category_id))throw Error('Invalid mutual fields')
   guard.current=true;setPending(true);invalidate();const result=await previewMutualBatch(client,input)
   if(mounted.current){if(result.ready)setReviewed({input,preview:result,reason});else setError('Esta faixa já possui mútuas nesta competência. Confira o histórico.')}
  }catch{if(mounted.current)setError('Não foi possível preparar as mútuas. Confira faixa, integrantes, valor, datas e classificação contábil vigente.')}
  finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function run(){
  if(guard.current||(!command.current&&(!reviewed||confirmation!=='GERAR')))return
  if(!command.current&&reviewed)command.current={...reviewed.input,p_expected_fingerprint:reviewed.preview.fingerprint,p_reason:reviewed.reason,p_idempotency_key:crypto.randomUUID()}
  if(!command.current)return
  guard.current=true;setPending(true);setError('')
  try{const r=await client.rpc('create_mutual_batch',command.current);if(r.error)throw r.error
   if(typeof r.data!=='string'||!agreementUUID.test(r.data))throw Error('Unconfirmed mutual batch')
   if(mounted.current){command.current=null;setUncertain(false);setReviewed(null);setConfirmation('');setSuccess('Mútuas registradas. Confira números, integrantes e cobranças no histórico.');setPage(0);setRevision(x=>x+1)}
  }catch(cause){if(!mounted.current)return;const code=(cause as {code?:string})?.code
   if(['22023','23503','23505','23514','PT409','42501','28000','55000'].includes(code??'')){command.current=null;setUncertain(false);setReviewed(null);setConfirmation('');setError(code==='42501'||code==='28000'?'Seu perfil não pode registrar mútuas desta Loja.':'A faixa ou os dados mudaram. Confira o histórico e prepare uma nova prévia.')}
   else{setUncertain(true);setError('Envio não confirmado. Verifique com a mesma chave para evitar cobranças duplicadas.')}
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function show(batch:MutualBatch){detailController.current?.abort();const c=new AbortController();detailController.current=c;const version=++detailVersion.current;setDetails(null);setError('')
  try{const r=await loadMutualAssignments(client,organizationId,batch,c.signal);if(mounted.current&&version===detailVersion.current)setDetails(r)}catch{if(mounted.current&&version===detailVersion.current&&!c.signal.aborted)setError('Não foi possível conferir números e cobranças desta faixa.')}
 }
 return <section className="panel member-editor member-agreements" aria-label="Mútuas por faixa">
  <h2>Gerar mútuas</h2><p className="subtle">Atribua cada número a um integrante. Confira o total e a classificação contábil antes de gerar. A geração não registra pagamento.</p>
  {error&&<p role="alert" className="message error">{error}</p>}{success&&<p role="status">{success}</p>}
  {uncertain&&<button disabled={pending} onClick={()=>void run()}>Verificar envio das mútuas</button>}
  {!catalog?!error&&<p role="status">Consultando integrantes…</p>:<form aria-label="Preparar mútuas" onSubmit={e=>void preview(e)} onChange={invalidate}><fieldset disabled={locked}><legend>Faixa e cobranças</legend>
   <label>Número inicial<input inputMode="numeric" value={start} onChange={e=>range(e.target.value,true)} required/></label>
   <label>Número final<input inputMode="numeric" value={end} onChange={e=>range(e.target.value,false)} required/></label>
   <p>Até 200 números por geração. {numbers.length} número(s) nesta faixa.</p>
   <label>Valor por número (R$)<input name="amount" inputMode="decimal" required/></label>
   <label>Competência das mútuas<input name="competence" type="month" required/></label>
   <label>Data de emissão das mútuas<input name="issue" type="date" required/></label>
   <label>Vencimento das mútuas<input name="due" type="date" required/></label>
   <label>Categoria das mútuas<select name="category" required><option value="">Selecione a categoria</option>{catalog.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Justificativa das mútuas<input name="reason" minLength={3} maxLength={500} required/></label>
   <fieldset><legend>Distribuição dos números</legend>
    <label>Número para atribuir<select value={number} onChange={e=>{setNumber(e.target.value);setMember(assignments[Number(e.target.value)]??'')}}><option value="">Selecione o número</option>{numbers.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>Integrante responsável<select value={member} onChange={e=>setMember(e.target.value)}><option value="">Selecione o integrante</option>{active.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
    <button type="button" disabled={!numbers.includes(Number(number))||!active.some(m=>m.id===member)} onClick={()=>{invalidate();setAssignments(old=>({...old,[Number(number)]:member}))}}>Atribuir número</button>
    <button type="button" className="secondary" disabled={!numbers.length||!active.some(m=>m.id===member)} onClick={()=>{invalidate();setAssignments(Object.fromEntries(numbers.map(n=>[n,member])))}}>Atribuir toda a faixa ao integrante escolhido</button>
    <ul aria-label="Distribuição das mútuas">{numbers.map(n=><li key={n}>{n} · {active.find(m=>m.id===assignments[n])?.full_name??'Sem integrante'}</li>)}</ul>
   </fieldset>
   {unapplied&&<p>Aplique a atribuição escolhida antes de conferir.</p>}<button type="submit" disabled={!complete||unapplied}>Conferir mútuas</button>
  </fieldset></form>}
  {reviewed&&<div aria-label="Prévia das mútuas"><h3>Confira a faixa e os integrantes</h3><p>{reviewed.preview.charge_count} cobrança(s) · {formatMoney(agreementCents(reviewed.preview.total_amount)/100)}</p><p>Classificação: {mutualNatures[reviewed.preview.account_nature]} · conta {reviewed.preview.account_code}</p>
   <ul>{reviewed.preview.assignments.map(a=><li key={a.mutual_number}>{a.mutual_number} · {a.name} · {formatMoney(agreementCents(a.amount)/100)}</li>)}</ul>
   <label>Digite GERAR para registrar as mútuas<input disabled={locked} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={locked||confirmation!=='GERAR'} onClick={()=>void run()}>Registrar mútuas</button>
  </div>}
  <h3>Faixas registradas</h3>{batches&&<>{!batches.length?<p>Nenhuma faixa nesta página.</p>:batches.map(b=><article key={b.id}><p>{b.number_start}–{b.number_end} · {formatDate(b.competence)} · {formatMoney(agreementCents(b.unit_amount)/100)} por número</p><button className="secondary" disabled={locked} onClick={()=>void show(b)}>Ver números de {b.number_start} a {b.number_end}</button></article>)}<div className="finance-pagination"><button disabled={page===0||locked} onClick={()=>setPage(x=>x-1)}>Página anterior de mútuas</button><span>Página {page+1}</span><button disabled={!hasNext||locked} onClick={()=>setPage(x=>x+1)}>Próxima página de mútuas</button></div></>}
  {details&&<ul aria-label="Números e cobranças das mútuas">{details.map(a=><li key={a.mutual_number}>{a.mutual_number} · {catalog?.members.find(m=>m.id===a.member_id)?.full_name??'Integrante'} · {a.canceled?'Cobrança cancelada':`Em aberto: ${formatMoney(a.open)}`}</li>)}</ul>}
 </section>
}
