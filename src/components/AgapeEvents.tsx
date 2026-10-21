import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadManualChargeCatalog,type ChargeMember,type ChargeCategory} from '../lib/manual-charges'
import {normalizedAmount} from '../lib/member-configuration'
import {agreementCents,agreementUUID} from '../lib/member-agreements'
import {formatDate,formatMoney} from '../lib/finance-data'
import {previewAgape,loadAgapeEvents,loadAgapeParticipants,type AgapeInput,type AgapePreview,type AgapeEvent,type AgapeParticipant} from '../lib/agape-events'
type Reviewed={input:AgapeInput;preview:AgapePreview;reason:string}
type Command=AgapeInput&{p_expected_fingerprint:string;p_reason:string;p_idempotency_key:string}
export function AgapeEvents({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [catalog,setCatalog]=useState<{members:ChargeMember[];categories:ChargeCategory[]}|null>(null),[selected,setSelected]=useState<string[]>([])
 const [reviewed,setReviewed]=useState<Reviewed|null>(null),[confirmation,setConfirmation]=useState(''),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState(''),[page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [events,setEvents]=useState<AgapeEvent[]|null>(null),[hasNext,setHasNext]=useState(false),[details,setDetails]=useState<AgapeParticipant[]|null>(null)
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false),detailVersion=useRef(0),detailController=useRef<AbortController|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;detailController.current?.abort();detailVersion.current++}},[])
 useEffect(()=>{let live=true;const c=new AbortController()
  loadManualChargeCatalog(client,organizationId,c.signal).then(r=>{if(live)setCatalog(r)}).catch(()=>{if(live)setError('Não foi possível consultar participantes e categorias desta Loja.')})
  return()=>{live=false;c.abort()}
 },[client,organizationId])
 useEffect(()=>{let live=true;const c=new AbortController();setEvents(null);setDetails(null);detailController.current?.abort();detailVersion.current++
  loadAgapeEvents(client,organizationId,page,c.signal).then(r=>{if(live){setEvents(r.events);setHasNext(r.hasNext)}}).catch(()=>{if(live)setError('Não foi possível conferir os ágapes desta Loja.')})
  return()=>{live=false;c.abort()}
 },[client,organizationId,page,revision])
 function invalidate(){setReviewed(null);setConfirmation('');setError('');setSuccess('')}
 async function preview(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(guard.current||uncertain||!catalog)return
  try{
   const d=new FormData(e.currentTarget),reason=String(d.get('reason')??'').trim()
   const input:AgapeInput={p_organization_id:organizationId,p_category_id:String(d.get('category')??''),p_name:String(d.get('name')??'').trim(),p_event_date:String(d.get('date')??''),p_due_date:String(d.get('due')??''),p_default_amount:normalizedAmount(String(d.get('amount')??'')),p_member_ids:[...selected].sort()}
   if(!selected.length||selected.length>200||reason.length<3||reason.length>500||!catalog.categories.some(x=>x.id===input.p_category_id))throw Error('Invalid event fields')
   guard.current=true;setPending(true);invalidate();const r=await previewAgape(client,input)
   if(mounted.current){if(r.ready)setReviewed({input,preview:r,reason});else setError('Já existe um ágape com este nome e data. Confira o histórico.')}
  }catch{if(mounted.current)setError('Não foi possível preparar o ágape. Confira participantes ativos, valor, datas e categoria com classificação contábil vigente.')}
  finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function run(){
  if(guard.current||(!command.current&&(!reviewed||confirmation!=='GERAR')))return
  if(!command.current&&reviewed)command.current={...reviewed.input,p_expected_fingerprint:reviewed.preview.fingerprint,p_reason:reviewed.reason,p_idempotency_key:crypto.randomUUID()}
  if(!command.current)return
  guard.current=true;setPending(true);setError('')
  try{
   const r=await client.rpc('create_agape_event',command.current);if(r.error)throw r.error
   if(typeof r.data!=='string'||!agreementUUID.test(r.data))throw Error('Unconfirmed event')
   if(mounted.current){command.current=null;setUncertain(false);setReviewed(null);setSelected([]);setConfirmation('');setSuccess('Ágape registrado. Participantes e cobranças podem ser conferidos no histórico.');setPage(0);setRevision(x=>x+1)}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string})?.code
   if(['22023','23503','23505','23514','PT409','42501','28000','55000'].includes(code??'')){
    command.current=null;setUncertain(false);setReviewed(null);setConfirmation('')
    setError(code==='42501'||code==='28000'?'Seu perfil não pode registrar ágapes desta Loja.':'O ágape ou os participantes mudaram. Confira o histórico e prepare uma nova prévia.')
   }else{setUncertain(true);setError('Envio não confirmado. Verifique o envio com a mesma chave para evitar cobranças duplicadas.')}
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 async function show(event:AgapeEvent){
  detailController.current?.abort();const c=new AbortController();detailController.current=c;const version=++detailVersion.current;setDetails(null);setError('')
  try{const r=await loadAgapeParticipants(client,organizationId,event.id,c.signal);if(mounted.current&&version===detailVersion.current)setDetails(r)}
  catch{if(mounted.current&&version===detailVersion.current&&!c.signal.aborted)setError('Não foi possível conferir participantes e cobranças deste ágape.')}
 }
 const locked=pending||uncertain
 return <section className="panel member-editor member-agreements" aria-label="Ágapes e participantes">
  <h2>Novo ágape</h2><p className="subtle">Selecione os participantes e confira os débitos antes de confirmar. Valor zero registra participação gratuita, sem cobrança. O evento não registra recebimentos nem altera caixa.</p>
  {error&&<p role="alert" className="message error">{error}</p>}{success&&<p role="status">{success}</p>}
  {uncertain&&<button disabled={pending} onClick={()=>void run()}>Verificar envio do ágape</button>}
  {!catalog?!error&&<p role="status">Consultando participantes…</p>:<>
   <form aria-label="Preparar ágape" onSubmit={e=>void preview(e)} onChange={invalidate}><fieldset disabled={locked}><legend>Dados do ágape</legend>
    <label>Nome do ágape<input name="name" minLength={3} maxLength={120} required/></label>
    <label>Data do ágape<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
    <label>Vencimento do ágape<input name="due" type="date" required/></label>
    <label>Valor padrão por participante (R$)<input name="amount" inputMode="decimal" placeholder="0,00" required/></label>
    <label>Categoria do ágape<select name="category" required><option value="">Selecione a categoria</option>{catalog.categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Justificativa do ágape<input name="reason" minLength={3} maxLength={500} required/></label>
    <fieldset><legend>Participantes ativos</legend>{catalog.members.filter(x=>x.status==='active').map(m=><label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>{invalidate();setSelected(old=>e.target.checked?[...old,m.id]:old.filter(x=>x!==m.id))}}/>{m.full_name}</label>)}</fieldset>
    <button type="submit" disabled={!selected.length}>Conferir ágape</button>
   </fieldset></form>
   {reviewed&&<div aria-label="Prévia do ágape"><h3>Confira participantes e total</h3><p>{reviewed.preview.participant_count} participante(s) · {reviewed.preview.charge_count} cobrança(s) · {formatMoney(agreementCents(reviewed.preview.total_amount)/100)}</p>
    <ul>{reviewed.preview.participants.map(x=><li key={x.member_id}>{x.name} · {formatMoney(agreementCents(x.amount)/100)}</li>)}</ul>
    <label>Digite GERAR para registrar o ágape<input disabled={locked} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={locked||confirmation!=='GERAR'} onClick={()=>void run()}>Registrar ágape</button>
   </div>}
  </>}
  <h3>Ágapes registrados</h3>{!events?!error&&<p role="status">Consultando ágapes…</p>:<>
   {!events.length?<p>Nenhum ágape nesta página.</p>:events.map(e=><article key={e.id}><p>{e.name} · {formatDate(e.event_date)} · padrão {formatMoney(agreementCents(e.default_amount)/100)}</p><button className="secondary" onClick={()=>void show(e)}>Ver participantes de {e.name}</button></article>)}
   <div className="finance-pagination"><button className="secondary" disabled={page===0||locked} onClick={()=>setPage(x=>x-1)}>Página anterior de ágapes</button><span>Página {page+1}</span><button className="secondary" disabled={!hasNext||locked} onClick={()=>setPage(x=>x+1)}>Próxima página de ágapes</button></div>
  </>}
  {details&&<ul aria-label="Participantes e cobranças do ágape">{details.map(p=><li key={p.member_id}>{catalog?.members.find(m=>m.id===p.member_id)?.full_name??'Integrante'} · {p.charge_id?(p.canceled?'Cobrança cancelada':`Em aberto: ${formatMoney(p.open??0)}`):'Participação gratuita'}</li>)}</ul>}
 </section>
}
