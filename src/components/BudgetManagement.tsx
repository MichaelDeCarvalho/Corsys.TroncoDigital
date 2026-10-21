import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadBudgetCatalog,validMonth,type BudgetKind} from '../lib/budget-report'
import {loadBudgetDetail,type BudgetDetail,type BudgetLine} from '../lib/budget-management'
import {normalizedAmount} from '../lib/member-configuration'
import {formatMoney} from '../lib/finance-data'
type Command={name:string;args:Record<string,unknown>}
type Catalog=Awaited<ReturnType<typeof loadBudgetCatalog>>
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function BudgetManagement({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[detail,setDetail]=useState<BudgetDetail|null>(null)
 const [cycle,setCycle]=useState(''),[revision,setRevision]=useState(0)
 const [kind,setKind]=useState<BudgetKind>('account'),[item,setItem]=useState('')
 const [period,setPeriod]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState('')
 const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const pending=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController();setCatalog(null);setDetail(null)
  loadBudgetCatalog(client,organizationId,controller.signal).then(c=>{if(live)setCatalog(c)})
   .catch(()=>{if(live)setError('Não foi possível carregar os ciclos e as contas desta Loja.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  let live=true;const controller=new AbortController();setDetail(null);setConfirmation('')
  if(cycle)loadBudgetDetail(client,organizationId,cycle,controller.signal)
   .then(d=>{if(live)setDetail(d)}).catch(()=>{if(live)setError('Não foi possível conferir o orçamento. Atualize antes de editar.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,cycle,revision])
 async function run(next:Command){
  if(guard.current)return
  pending.current=pending.current??next;guard.current=true;setBusy(true);setError('');setSuccess('')
  try{
   const cmd=pending.current,result=await client.rpc(cmd.name,cmd.args)
   if(result.error)throw result.error
   if(typeof result.data!=='string'||!uuid.test(result.data))throw Error('Unconfirmed budget command')
   if(mounted.current){
    pending.current=null;setUncertain(false);setConfirmation('')
    setCycle(result.data);setRevision(v=>v+1)
    setSuccess(cmd.name==='publish_tenant_budget'?'Orçamento publicado. Valores e linhas preservados como histórico.':
     cmd.name==='create_tenant_budget_draft'?'Rascunho criado. Adicione e revise as linhas antes de publicar.':'Linha orçamentária salva. Revise o orçamento atualizado.')
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000','40001','PT409'].includes(code)){
    pending.current=null;setUncertain(false);setRevision(v=>v+1)
    setError((code === '40001' || code === 'PT409')?'O orçamento mudou. Confira os dados atualizados antes de reenviar.':
     code==='42501'||code==='28000'?'Seu perfil ou assinatura não permite gerenciar orçamentos.':
     code==='55000'?'Este orçamento já foi publicado e não pode ser alterado. Crie outro ciclo.':
     'O banco recusou a operação. Confira nome, competência, conta ativa em plano publicado, fundo e valores.')
   }else{setUncertain(true);setError('Resultado não confirmado. Use Verificar envio; a mesma solicitação e chave serão reenviadas.')}
  }finally{guard.current=false;if(mounted.current)setBusy(false)}
 }
 const locked=busy||uncertain
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked||!catalog)return
  const d=new FormData(e.currentTarget),get=(key:string)=>String(d.get(key)??'').trim()
  try{
   const name=get('name'),why=get('reason'),from=validMonth(get('from')),to=validMonth(get('to'))
   if(name.length<3||name.length>120||why.length<3||why.length>500||from>to)throw Error('Confira nome, competências e motivo.')
   void run({name:'create_tenant_budget_draft',args:{p_organization_id:organizationId,p_name:name,
    p_period_start:from,p_period_end:to,p_reason:why,p_idempotency_key:crypto.randomUUID()}})
  }catch(cause){setError((cause as Error).message)}
 }
 function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked||!detail||detail.cycle.status!=='draft')return
  try{
   const value=normalizedAmount(amount),month=validMonth(period)
   if(!uuid.test(item)||reason.trim().length<3||reason.trim().length>500)throw Error('Selecione o item e informe o motivo.')
   void run({name:'set_tenant_budget_line',args:{p_organization_id:organizationId,p_cycle_id:cycle,
    p_kind:kind,p_item_id:item,p_period:month,p_amount:value,p_expected_revision:detail.revision,
    p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}})
  }catch(cause){setError((cause as Error).message)}
 }
 function remove(line:BudgetLine){
  if(locked||!detail||detail.cycle.status!=='draft')return
  if(reason.trim().length<3||reason.trim().length>500){setError('Informe o motivo da remoção no campo Motivo da alteração.');return}
  void run({name:'set_tenant_budget_line',args:{p_organization_id:organizationId,p_cycle_id:cycle,
   p_kind:line.kind,p_item_id:line.item_id,p_period:line.period,p_amount:null,
   p_expected_revision:detail.revision,p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}})
 }
 function publish(){
  if(locked||!detail||detail.cycle.status!=='draft'||confirmation!=='PUBLICAR'||!detail.lines.length)return
  if(reason.trim().length<3||reason.trim().length>500){setError('Informe o motivo da publicação.');return}
  void run({name:'publish_tenant_budget',args:{p_organization_id:organizationId,p_cycle_id:cycle,
   p_expected_revision:detail.revision,p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}})
 }
 return <section className="panel member-editor" aria-label="Gerenciar orçamento">
  <div className="section-title"><h2>Planejamento do orçamento</h2><button className="secondary" disabled={locked} onClick={()=>{setError('');setRevision(v=>v+1)}}>Atualizar planejamento</button></div>
  <p className="subtle">Crie um ciclo e defina valores por competência, conta contábil ou fundo. Publicar preserva as linhas; revisões posteriores usam outro ciclo. O planejamento não movimenta caixa nem gera cobranças.</p>
  {error&&<p role="alert" className="message error">{error}</p>}{success&&<p role="status">{success}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={busy} onClick={()=>{if(pending.current)void run(pending.current)}}>Verificar envio</button>}
  <form aria-label="Criar ciclo orçamentário" onSubmit={create}><fieldset disabled={locked||!catalog}>
   <legend>Novo ciclo em rascunho</legend><div className="member-form-grid">
    <label>Nome do ciclo<input name="name" required minLength={3} maxLength={120}/></label>
    <label>Competência inicial<input name="from" type="month" required/></label>
    <label>Competência final<input name="to" type="month" required/></label>
    <label>Motivo do novo ciclo<input name="reason" required minLength={3} maxLength={500}/></label>
   </div><button className="primary" type="submit">Criar rascunho de orçamento</button>
  </fieldset></form>
  <label htmlFor="budget-edit-cycle">Orçamento para revisar</label>
  <select id="budget-edit-cycle" disabled={locked||!catalog} value={cycle} onChange={e=>{setCycle(e.target.value);setError('');setSuccess('');setItem('')}}>
   <option value="">Selecione</option>{catalog?.cycles.map(c=><option key={c.id} value={c.id}>{c.name} — {c.status}</option>)}
  </select>
  {cycle&&!detail&&!error&&<p role="status">Conferindo linhas do orçamento…</p>}
  {detail&&<>
   <h3>{detail.cycle.name} — {detail.cycle.status}</h3>
   <p className="subtle">{detail.cycle.period_start} a {detail.cycle.period_end} · BRL. Contas e fundos são visões distintas; seus valores não são somados entre si.</p>
   {detail.cycle.status==='draft'&&<form aria-label="Salvar linha orçamentária" onSubmit={save}><fieldset disabled={locked}>
    <legend>Adicionar ou substituir linha</legend><div className="member-form-grid">
     <label>Tipo de linha<select value={kind} onChange={e=>{setKind(e.target.value as BudgetKind);setItem('')}}><option value="account">Conta contábil</option><option value="fund">Fundo</option></select></label>
     <label>Conta ou fundo<select required value={item} onChange={e=>setItem(e.target.value)}><option value="">Selecione</option>
      {kind==='account'?catalog?.accounts.filter(a=>['revenue','cost','expense','financial_result'].includes(a.nature)).map(a=><option key={a.id} value={a.id}>{a.code} — {a.description}</option>):catalog?.funds.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
     </select></label>
     <label>Competência da linha<input type="month" required value={period} onChange={e=>setPeriod(e.target.value)}/></label>
     <label>Valor orçado (R$)<input inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    </div><button className="primary" type="submit">Salvar linha</button>
   </fieldset></form>}
   <label htmlFor="budget-change-reason">Motivo da alteração</label><input id="budget-change-reason" disabled={locked||detail.cycle.status!=='draft'} value={reason} minLength={3} maxLength={500} onChange={e=>setReason(e.target.value)}/>
   {!detail.lines.length?<p>Rascunho sem linhas. Adicione ao menos uma antes de publicar.</p>:<div className="finance-table" role="region" tabIndex={0} aria-label="Linhas do planejamento"><table><thead><tr><th>Tipo</th><th>Item</th><th>Competência</th><th>Orçado</th><th>Ação</th></tr></thead>
    <tbody>{detail.lines.map(l=><tr key={`${l.kind}:${l.item_id}:${l.period}`}><td>{l.kind==='account'?'Conta contábil':'Fundo'}</td><th scope="row">{l.label}</th><td>{l.period.slice(0,7)}</td><td>{formatMoney(Number(l.amount))}</td><td>{detail.cycle.status==='draft'?<button type="button" className="secondary" disabled={locked} onClick={()=>remove(l)}>Remover linha</button>:'Preservada'}</td></tr>)}</tbody></table></div>}
   {detail.cycle.status==='draft'?<><label htmlFor="budget-publish-confirm">Digite PUBLICAR</label><input id="budget-publish-confirm" disabled={locked} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
    <button type="button" className="primary" disabled={locked||confirmation!=='PUBLICAR'||!detail.lines.length} onClick={publish}>Publicar orçamento revisado</button></>:<p>Orçamento publicado: alterações bloqueadas. Consulte Orçado × realizado para acompanhar a execução.</p>}
  </>}
 </section>
}
