import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { endOfMonth, loadAccountingCatalog, loadAccountingDetail, type Catalog, type Detail } from '../lib/accounting-plans'
import { AccountingPrepublication } from './AccountingPrepublication'
type Command = { name:string; args:Record<string,unknown> }
type Kind = 'category'|'financial_account'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function AccountingPlans({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[detail,setDetail]=useState<Detail|null>(null)
 const [selected,setSelected]=useState(''),[revision,setRevision]=useState(0)
 const [origin,setOrigin]=useState('template'),[kind,setKind]=useState<Kind>('category')
 const [source,setSource]=useState(''),[target,setTarget]=useState('')
 const [error,setError]=useState(''),[detailError,setDetailError]=useState(''),[saved,setSaved]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false)
 const current=useRef<Command|null>(null),busy=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  const abort=new AbortController();let live=true
  setCatalog(null);setDetail(null);setError('');setDetailError('')
  loadAccountingCatalog(client,organizationId,abort.signal).then(rows=>{
   if(!live)return
   setCatalog(rows);setSelected(prev=>rows.plans.some(p=>p.id===prev)?prev:rows.plans.find(p=>p.status==='draft')?.id??rows.plans[0]?.id??'')
  }).catch(()=>{if(live)setError('Não foi possível carregar planos e catálogos contábeis.')})
  return()=>{live=false;abort.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  const abort=new AbortController();let live=true
  setDetail(null);setDetailError('');setSource('');setTarget('')
  if(selected&&catalog?.plans.some(p=>p.id===selected)){
   loadAccountingDetail(client,organizationId,selected,abort.signal).then(rows=>{if(live)setDetail(rows)})
    .catch(()=>{if(live)setDetailError('Não foi possível carregar as contas e vínculos deste plano.')})
  }
  return()=>{live=false;abort.abort()}
 },[client,organizationId,selected,catalog])
 async function run(command:Command){
  if(busy.current||conflict)return
  current.current=current.current??command;busy.current=true;setPending(true);setSaved(false);setError('')
  try{
   const {data,error:failure}=await client.rpc(current.current.name,current.current.args)
   if(failure)throw failure
   if(typeof data!=='string'||!uuid.test(data))throw new Error('Unconfirmed accounting command')
   if(mounted.current){current.current=null;setUncertain(false);setSaved(true);setRevision(v=>v+1)}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','23P01','40001','42501','28000','55000'].includes(code)){
    current.current=null;setUncertain(false);setConflict(code==='40001')
    setError(code==='40001'?'O vínculo mudou. Atualize os planos antes de tentar novamente.':
     code==='42501'||code==='28000'?'Acesso negado para alterar o plano contábil.':
     code==='23514'?'A natureza da conta contábil é incompatível com o vínculo.':
     code==='23505'||code==='23P01'?'Já existe uma configuração conflitante.':
     code==='55000'?'O plano publicado é imutável. Crie um sucessor.':
     'Confira a origem, a vigência e os dados; nenhuma alteração foi confirmada.')
   }else{setUncertain(true);setError('Resultado não confirmado. Use Verificar envio para repetir a mesma operação, sem duplicar.')}
  }finally{busy.current=false;if(mounted.current)setPending(false)}
 }
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||uncertain||conflict)return
  const values=new FormData(e.currentTarget),get=(key:string)=>String(values.get(key)??'').trim()
  try{void run({name:'create_tenant_accounting_draft',args:{
   p_organization_id:organizationId,p_name:get('name'),
   p_valid_from:`${get('from')}-01`,p_valid_to:endOfMonth(get('to')),
   p_source_kind:origin,p_source_id:origin==='blank'?null:get('source_id'),
   p_reason:get('reason'),p_idempotency_key:crypto.randomUUID(),
  }})}catch(cause){setError((cause as Error).message)}
 }
 const plan=catalog?.plans.find(p=>p.id===selected)
 const sources=kind==='category'?catalog?.categories??[]:catalog?.cash??[]
 const category=catalog?.categories.find(c=>c.id===source)
 const currentMapping=(kind==='category'?detail?.categoryMappings:detail?.cashMappings)?.find(m=>kind==='category'?m.category_id===source:m.financial_account_id===source)
 const expected=currentMapping?.accounting_account_id??null
 const eligible=(detail?.accounts??[]).filter(a=>a.row_type==='analytic'&&a.active&&(
  kind==='financial_account'?a.nature==='patrimonial':
  category?.domain==='member_receivable'||category?.domain==='institutional_revenue'?a.nature==='revenue':
  category?.domain==='institutional_expense'?['cost','expense','financial_result'].includes(a.nature):false
 ))
 function saveMapping(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||uncertain||conflict||!detail||plan?.status!=='draft'||!source||!target)return
  const reason=String(new FormData(e.currentTarget).get('reason')??'').trim()
  void run({name:'set_draft_accounting_mapping',args:{
   p_organization_id:organizationId,p_accounting_plan_id:selected,p_kind:kind,p_source_id:source,
   p_accounting_account_id:target,p_expected_account_id:expected,
   p_reason:reason,p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const blocked=pending||uncertain||conflict
 return <section className="accounting-plans" aria-label="Planos contábeis e mapeamentos">
  <div className="section-title"><h2>Planos contábeis e vínculos</h2>
   <button type="button" className="secondary" disabled={pending||uncertain}
    onClick={()=>{setConflict(false);setSaved(false);setRevision(v=>v+1)}}>Atualizar planos</button></div>
  {saved&&<p role="status">Plano ou vínculo salvo. Histórico atualizado.</p>}
  {error&&<p role="alert">{error}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={pending} onClick={()=>{if(current.current)void run(current.current)}}>Verificar envio</button>}
  {!catalog?(!error&&<p role="status">Carregando planos contábeis…</p>):<>
   <form aria-label="Criar rascunho contábil" onSubmit={create}>
    <fieldset disabled={blocked}><legend>Novo plano — rascunho, sem publicação</legend>
     <div className="member-form-grid">
      <div><label htmlFor="acct-name">Nome do plano</label><input id="acct-name" name="name" required minLength={3} maxLength={120}/></div>
      <div><label htmlFor="acct-from">Mês inicial futuro</label><input id="acct-from" name="from" type="month" required/></div>
      <div><label htmlFor="acct-to">Mês final</label><input id="acct-to" name="to" type="month" required/></div>
      <div><label htmlFor="acct-origin">Origem da estrutura</label>
       <select id="acct-origin" value={origin} onChange={e=>setOrigin(e.target.value)}>
        <option value="template">Modelo padrão</option><option value="duplicate">Duplicar plano da Loja</option><option value="blank">Em branco</option>
       </select></div>
      {origin==='template'&&<div><label htmlFor="acct-source">Modelo contábil</label>
       <select id="acct-source" name="source_id" required defaultValue=""><option value="">Selecione</option>
        {catalog.templates.map(t=><option value={t.id} key={t.id}>{t.name} — versão {t.version}</option>)}
       </select></div>}
      {origin==='duplicate'&&<div><label htmlFor="acct-source">Plano da própria Loja</label>
       <select id="acct-source" name="source_id" required defaultValue=""><option value="">Selecione</option>
        {catalog.plans.map(p=><option value={p.id} key={p.id}>{p.name} ({p.status==='published'?'publicado':'rascunho'})</option>)}
       </select></div>}
      <div><label htmlFor="acct-reason">Motivo do rascunho</label><input id="acct-reason" name="reason" required minLength={3} maxLength={500}/></div>
     </div>
     <button type="submit" className="primary" disabled={blocked||(origin==='template'&&!catalog.templates.length)||(origin==='duplicate'&&!catalog.plans.length)}>Criar rascunho</button>
    </fieldset>
   </form>
   <label htmlFor="acct-select-plan">Plano para consulta e mapeamento</label>
   <select id="acct-select-plan" value={selected} onChange={e=>setSelected(e.target.value)}>
    {!catalog.plans.length&&<option value="">Nenhum plano cadastrado</option>}
    {catalog.plans.map(p=><option key={p.id} value={p.id}>{p.name} — {p.status==='draft'?'Rascunho':'Publicado (imutável)'} · {p.valid_from.slice(0,7)}–{p.valid_to.slice(0,7)}</option>)}
   </select>
   {plan&&<p className="subtle">Vigência: {plan.valid_from} a {plan.valid_to}. {plan.status==='published'?
    'Plano publicado — somente leitura, alterações exigem sucessor.':
    'Rascunho — não utilizado para lançamentos financeiros até ser validado e publicado.'}</p>}
   {detailError&&<p role="alert">{detailError}</p>}
   {plan&&!detail&&!detailError&&<p role="status">Carregando contas contábeis…</p>}
   {plan&&detail&&<>
    <p><strong>{detail.accounts.length}</strong> contas contábeis; <strong>{detail.categoryMappings.length}</strong> categorias mapeadas; <strong>{detail.cashMappings.length}</strong> contas financeiras mapeadas.</p>
    <details className="accounting-accounts-list"><summary>Consultar códigos e hierarquia contábil</summary>
     <ul>{detail.accounts.map(a=><li key={a.id}><strong>{a.code}</strong> — {a.description} · {a.nature} · {a.row_type}{a.active?'':' (inativa)'}</li>)}</ul>
    </details>
    {plan.status==='draft' && <AccountingPrepublication
     key={`${organizationId}:${selected}:${revision}`}
     client={client} organizationId={organizationId} planId={selected}
     validFrom={plan.valid_from} validTo={plan.valid_to}
     onPublished={() => setRevision(value => value + 1)} disabled={blocked}
    />}
    {plan.status==='draft'&&<form aria-label="Configurar vínculo contábil" onSubmit={saveMapping}>
     <fieldset disabled={blocked}><legend>Mapear categoria ou conta financeira</legend>
      <div className="member-form-grid">
       <div><label htmlFor="acct-kind">Tipo de origem</label><select id="acct-kind" value={kind} onChange={e=>{setKind(e.target.value as Kind);setSource('');setTarget('')}}>
        <option value="category">Categoria financeira</option><option value="financial_account">Conta bancária/caixa</option></select></div>
       <div><label htmlFor="acct-src">Cadastro da Loja</label><select id="acct-src" value={source} required onChange={e=>{setSource(e.target.value);setTarget('')}}><option value="">Selecione</option>
        {sources.map(s=><option key={s.id} value={s.id}>{s.name}{s.active?'':' (inativo)'}</option>)}</select></div>
       <div><label htmlFor="acct-target">Conta contábil analítica compatível</label><select id="acct-target" value={target} required onChange={e=>setTarget(e.target.value)}><option value="">Selecione</option>
        {eligible.map(a=><option key={a.id} value={a.id}>{a.code} — {a.description}</option>)}</select></div>
       <div><label htmlFor="acct-map-reason">Motivo do vínculo</label><input id="acct-map-reason" name="reason" required minLength={3} maxLength={500}/></div>
      </div>
      {source&&<p className="subtle">Vínculo atual: {expected?detail.accounts.find(a=>a.id===expected)?.code??'conta fora da consulta':'não configurado'}.</p>}
      <button type="submit" className="primary" disabled={blocked||!source||!target||!eligible.length}>Salvar vínculo</button>
     </fieldset>
    </form>}
   </>}
   <p className="subtle">O modelo padrão possui 91 contas. Publicação automática indisponível: exige todos os vínculos ativos, vigências sem sobreposição e homologação. Os registros históricos não são alterados. Limites: 100 planos e 300 linhas por consulta.</p>
  </>}
 </section>
}
