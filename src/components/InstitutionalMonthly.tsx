import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {normalizedAmount} from '../lib/member-configuration'
import {loadInstitutionalMonthlyCatalog,previewInstitutionalMonthly,type InstitutionalMonthlyCatalog,type InstitutionalMonthlyPreview} from '../lib/institutional-monthly'
type Props={client:SupabaseClient;organizationId:string}
type Command={name:string;args:Record<string,unknown>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function month(value:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('Informe uma competência válida.');return value+'-01'}
export function InstitutionalMonthly(props:Props){return <MonthlyPanel key={props.organizationId} {...props}/>}
function MonthlyPanel({client,organizationId}:Props){
 const [catalog,setCatalog]=useState<InstitutionalMonthlyCatalog|null>(null),[revision,setRevision]=useState(0)
 const [direction,setDirection]=useState('payable'),[selected,setSelected]=useState(''),[competence,setCompetence]=useState('')
 const [preview,setPreview]=useState<InstitutionalMonthlyPreview|null>(null),[previewPending,setPreviewPending]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [reason,setReason]=useState(''),[confirmation,setConfirmation]=useState('')
 const request=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false),sequence=useRef(0)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++}},[])
 function resetPreview(){sequence.current++;setPreview(null);setPreviewPending(false);setConfirmation('')}
 useEffect(()=>{
  let active=true;const controller=new AbortController();setCatalog(null);setSelected('')
  loadInstitutionalMonthlyCatalog(client,organizationId,controller.signal).then(c=>{if(active)setCatalog(c)})
   .catch(()=>{if(active)setError('Não foi possível consultar as recorrências institucionais de forma íntegra.')})
  return()=>{active=false;controller.abort()}
 },[client,organizationId,revision])
 async function run(command:Command){
  if(guard.current)return
  request.current=request.current??command;guard.current=true;setPending(true);setError('');setSaved(false)
  try{
   const r=await client.rpc(request.current.name,request.current.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!uuid.test(r.data))throw Error('Unconfirmed institutional recurring command')
   if(mounted.current){request.current=null;setUncertain(false);setSaved(true);resetPreview();setRevision(n=>n+1)}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','22003','23502','23503','23505','23514','40001','PT409','42501','28000','55000'].includes(code)){
    request.current=null;setUncertain(false);resetPreview()
    setError(code==='42501'||code==='28000'?'Seu perfil ou a assinatura da Loja não permite esta operação.':(code==='40001'||code==='PT409')?'A regra ou a prévia mudou. Atualize e confira uma nova prévia.':'Operação rejeitada. Confira vigência, categoria, plano contábil, competência e duplicidade.')
   }else{setUncertain(true);setError('Resultado não confirmado. Verifique novamente com a mesma chave antes de iniciar outra operação.')}
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||uncertain||!catalog)return
  const d=new FormData(e.currentTarget),get=(k:string)=>String(d.get(k)??'').trim()
  try{
   const category=get('category'),amount=normalizedAmount(get('amount')),due=Number(get('due')),why=get('reason')
   if(!catalog.categories.some(c=>c.id===category&&c.domain===(direction==='payable'?'institutional_expense':'institutional_revenue'))
    ||Number(amount)<=0||!Number.isInteger(due)||due<1||due>31||get('name').length<3||!get('counterparty')||why.length<3)throw Error('Confira os dados da regra e sua justificativa.')
   void run({name:'create_tenant_institutional_monthly_rule',args:{p_organization_id:organizationId,p_direction:direction,p_category_id:category,
    p_name:get('name'),p_counterparty:get('counterparty'),p_amount:amount,p_valid_from:month(get('from')),p_due_day:due,p_reason:why,p_idempotency_key:crypto.randomUUID()}})
  }catch(cause){setError((cause as Error).message)}
 }
 const candidate=catalog?.rules.find(r=>r.id===selected),locked=pending||uncertain
 async function consult(){
  if(locked||!candidate)return
  resetPreview();const token=++sequence.current;setPreviewPending(true);setError('');setSaved(false)
  try{const p=await previewInstitutionalMonthly(client,organizationId,candidate,month(competence));if(mounted.current&&sequence.current===token)setPreview(p)}
  catch{if(mounted.current&&sequence.current===token)setError('Não foi possível conferir uma prévia íntegra. Atualize a regra, a competência e o acesso.')}
  finally{if(mounted.current&&sequence.current===token)setPreviewPending(false)}
 }
 function generate(e:FormEvent){
  e.preventDefault();if(locked||previewPending||!preview?.ready||preview.rule_id!==selected||preview.competence!==competence+'-01'||confirmation!=='GERAR'||reason.trim().length<3)return
  void run({name:'generate_institutional_monthly_obligation',args:{p_organization_id:organizationId,p_rule_id:selected,p_competence:preview.competence,
   p_expected_fingerprint:preview.fingerprint,p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}})
 }
 function status(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked||!candidate)return
  const why=String(new FormData(e.currentTarget).get('reason')??'').trim();if(why.length<3)return
  resetPreview();void run({name:'set_tenant_institutional_monthly_rule_status',args:{p_organization_id:organizationId,p_rule_id:candidate.id,
   p_expected_active:candidate.active,p_active:!candidate.active,p_reason:why,p_idempotency_key:crypto.randomUUID()}})
 }
 return <section className="panel member-editor" aria-label="Recorrências mensais institucionais">
  <div className="section-title"><h2>Recorrências mensais institucionais</h2><button className="secondary" disabled={locked} onClick={()=>{resetPreview();setError('');setSaved(false);setRevision(n=>n+1)}}>Atualizar regras institucionais</button></div>
  <p className="subtle">Cadastre uma despesa ou receita mensal e confira a prévia antes de emitir a obrigação. A emissão não movimenta caixa nem registra pagamento. Dias 29–31 são ajustados ao último dia do mês.</p>
  {error&&<p className="message error" role="alert">{error}</p>}{saved&&<p role="status">Operação recorrente institucional confirmada. Consulte os registros atualizados.</p>}
  {uncertain&&<button disabled={pending} onClick={()=>request.current&&void run(request.current)}>Verificar operação recorrente com a mesma chave</button>}
  {!catalog?<p role="status">Consultando regras institucionais…</p>:<>
   <form aria-label="Cadastrar recorrência institucional" key={`create:${revision}`} onSubmit={create}><fieldset disabled={locked}><legend>Nova regra mensal</legend>
    <div className="member-form-grid">
     <div><label htmlFor="im-direction">Tipo da recorrência</label><select id="im-direction" value={direction} onChange={e=>setDirection(e.target.value)}><option value="payable">Despesa</option><option value="receivable">Receita</option></select></div>
     <div><label htmlFor="im-name">Descrição da regra institucional</label><input id="im-name" name="name" minLength={3} maxLength={120} required/></div>
     <div><label htmlFor="im-category">Categoria da regra institucional</label><select id="im-category" name="category" key={direction} required><option value="">Selecione</option>{catalog.categories.filter(c=>c.domain===(direction==='payable'?'institutional_expense':'institutional_revenue')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
     <div><label htmlFor="im-counterparty">Fornecedor ou origem recorrente</label><input id="im-counterparty" name="counterparty" required maxLength={120}/></div>
     <div><label htmlFor="im-amount">Valor mensal institucional (R$)</label><input id="im-amount" name="amount" required inputMode="decimal"/></div>
     <div><label htmlFor="im-from">Vigência inicial institucional</label><input id="im-from" name="from" type="month" required/></div>
     <div><label htmlFor="im-due">Dia do vencimento institucional</label><input id="im-due" name="due" type="number" min={1} max={31} required defaultValue={20}/></div>
     <div><label htmlFor="im-create-reason">Justificativa da nova regra</label><input id="im-create-reason" name="reason" required minLength={3} maxLength={500}/></div>
    </div><button type="submit">Cadastrar regra institucional</button>
   </fieldset></form>
   <h3>Regras consultadas</h3>{!catalog.rules.length?<p>Nenhuma regra institucional mensal cadastrada.</p>:<ul>{catalog.rules.map(r=><li key={r.id}>{r.name} — {r.direction==='payable'?'Despesa':'Receita'} — {r.active?'Ativa':'Inativa'}</li>)}</ul>}
   <fieldset disabled={locked}><legend>Escolher regra e competência</legend><label htmlFor="im-selected">Regra institucional para emissão</label><select id="im-selected" value={selected} onChange={e=>{resetPreview();setSelected(e.target.value);setSaved(false)}}><option value="">Selecione</option>{catalog.rules.map(r=><option key={r.id} value={r.id}>{r.name}{r.active?'':' (inativa)'}</option>)}</select>
    <label htmlFor="im-competence">Competência da emissão institucional</label><input id="im-competence" type="month" value={competence} onChange={e=>{resetPreview();setCompetence(e.target.value)}}/>
    <button type="button" className="secondary" disabled={!candidate||!competence||previewPending} onClick={()=>void consult()}>{previewPending?'Conferindo prévia…':'Conferir prévia institucional'}</button>
   </fieldset>
   {preview&&<section aria-label="Prévia institucional conferida"><h3>Prévia da obrigação mensal</h3><p>{preview.name} — {preview.direction==='payable'?'Despesa':'Receita'} — competência {preview.competence.slice(0,7)}</p>
    <p>Valor: {preview.amount===null?'Sem preço vigente':formatMoney(Number(preview.amount))} · Vencimento: {formatDate(preview.due_date)}</p>
    <p>{preview.ready?'Uma obrigação pronta para emissão.':preview.existing_id?'Já emitida nesta competência, inclusive se cancelada.':preview.period_closed?'Competência fechada.':!preview.active?'Regra inativa.':'Confira vigência, categoria e vínculo contábil.'}</p>
    {preview.ready&&<form aria-label="Confirmar emissão institucional" onSubmit={generate}><fieldset disabled={locked||previewPending}><legend>Confirmar emissão desta obrigação</legend>
     <label htmlFor="im-generate-reason">Justificativa da emissão institucional</label><input id="im-generate-reason" value={reason} required minLength={3} maxLength={500} onChange={e=>setReason(e.target.value)}/>
     <label htmlFor="im-confirm">Digite GERAR para emitir a obrigação</label><input id="im-confirm" value={confirmation} required onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/>
     <button type="submit" disabled={confirmation!=='GERAR'||reason.trim().length<3}>Confirmar emissão institucional</button>
    </fieldset></form>}
   </section>}
   {candidate&&<form aria-label="Alterar situação da regra institucional" onSubmit={status}><fieldset disabled={locked}><legend>{candidate.active?'Desativar':'Reativar'} {candidate.name}</legend>
    <p className="subtle">O histórico e as obrigações já emitidas permanecem preservados.</p><label htmlFor="im-status-reason">Justificativa da situação da regra</label><input id="im-status-reason" name="reason" minLength={3} maxLength={500} required/>
    <button type="submit" className="secondary">{candidate.active?'Desativar regra institucional':'Reativar regra institucional'}</button>
   </fieldset></form>}
   <p className="subtle">Regras mensais institucionais, até 150 por consulta. Anuidades, cobranças especiais e reajustes futuros têm fluxos próprios ainda pendentes.</p>
  </>}
 </section>
}
