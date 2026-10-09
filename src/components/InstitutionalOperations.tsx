import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizedAmount } from '../lib/member-configuration'
import { formatDate, formatMoney } from '../lib/finance-data'
import { exactPaymentAmount } from '../lib/member-payments'
import {
 loadInstitutionalCatalogs, loadInstitutionalObligations,
 type InstitutionalCatalogs, type InstitutionalObligation, type InstitutionalKind,
} from '../lib/institutional-operations'

type Operation={name:string;args:Record<string,unknown>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function monthStart(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Informe competência válida.')
 return month+'-01'
}
function positive(text:string){
 const value=normalizedAmount(text)
 if(Number(value)<=0)throw Error('Valor deve ser positivo.')
 return value
}
const label:Record<InstitutionalKind,string>={payable:'Contas a pagar',receivable:'Contas a receber'}

export function InstitutionalOperations({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [kind,setKind]=useState<InstitutionalKind>('payable')
 const [catalog,setCatalog]=useState<InstitutionalCatalogs|null>(null)
 const [rows,setRows]=useState<InstitutionalObligation[]|null>(null)
 const [revision,setRevision]=useState(0)
 const [error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[conflict,setConflict]=useState(false)
 const [selected,setSelected]=useState('')
 const guard=useRef(false),mounted=useRef(false),command=useRef<Operation|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let active=true;const controller=new AbortController()
  setCatalog(null);setRows(null);setError('');setSelected('')
  Promise.all([
   loadInstitutionalCatalogs(client,organizationId,controller.signal),
   loadInstitutionalObligations(client,organizationId,kind,controller.signal),
  ]).then(([c,r])=>{
   if(active){setCatalog(c);setRows(r)}
  }).catch(()=>{
   if(active)setError('Não foi possível consultar o financeiro institucional de forma íntegra.')
  })
  return()=>{active=false;controller.abort()}
 },[client,organizationId,kind,revision])
 async function run(next:Operation){
  if(guard.current||conflict)return
  command.current=command.current??next
  guard.current=true;setPending(true);setError('');setSaved(false)
  try{
   const response=await client.rpc(command.current.name,command.current.args)
   if(response.error)throw response.error
   if(typeof response.data!=='string'||!uuid.test(response.data))throw Error('Unconfirmed financial operation')
   if(mounted.current){command.current=null;setUncertain(false);setSaved(true);setRevision(v=>v+1)}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','22003','23502','23503','23505','23514','40001','42501','28000','55000','P0002'].includes(code)){
    command.current=null;setUncertain(false);setConflict(code==='40001')
    setError(code==='42501'||code==='28000'?'Seu perfil ou a assinatura da Loja não permite esta operação.':
     code==='40001'?'O lançamento mudou. Atualize os registros antes de tentar novamente.':
     code==='23514'||code==='55000'?'Operação bloqueada: verifique aprovação, saldo, conta contábil e competência.':
     'Operação institucional rejeitada. Revise os campos e os vínculos contábeis.')
   }else{
    setUncertain(true)
    setError('Não foi possível confirmar o resultado. Verifique o envio com a mesma chave antes de uma nova solicitação.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function get(data:FormData,key:string){return String(data.get(key)??'').trim()}
 function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||conflict||!catalog||!rows)return
  const data=new FormData(e.currentTarget),cat=get(data,'category')
  const domain=kind==='payable'?'institutional_expense':'institutional_revenue'
  if(!catalog.categories.some(c=>c.id===cat&&c.active&&c.domain===domain)){
   setError('Selecione uma categoria institucional ativa da Loja.');return
  }
  try{
   const issue=get(data,'issue'),due=get(data,'due')
   if(!/^\d{4}-\d{2}-\d{2}$/.test(issue)||!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Informe datas válidas.')
   const fund=get(data,'fund')
   if(fund&&!catalog.funds.some(f=>f.id===fund))throw Error('Fundo não autorizado para esta Loja.')
   void run({name:kind==='payable'?'create_institutional_payable':'create_institutional_receivable',args:{
    p_organization_id:organizationId,p_category_id:cat,p_fund_id:fund||null,
    p_description:get(data,'description'),p_counterparty_name:get(data,'counterparty'),
    p_competence:monthStart(get(data,'competence')),p_issue_date:issue,p_due_date:due,
    p_accounting_period:monthStart(get(data,'period')),
    p_amount:positive(get(data,'amount')),p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 const eligible=(rows??[]).filter(r=>!r.is_canceled&&Number(r.open_amount)>0&&
  (kind==='receivable'||r.approval_status==='approved'||r.approval_status==='not_required'))
 function settle(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(pending||uncertain||conflict||!catalog||!rows)return
  const row=eligible.find(r=>(kind==='payable'?r.payable_id:r.receivable_id)===selected)
  if(!row){setError('Selecione uma obrigação em aberto e apta à liquidação.');return}
  const data=new FormData(e.currentTarget),method=get(data,'method'),account=get(data,'account')
  if(!catalog.methods.some(m=>m.id===method)||!catalog.accounts.some(a=>a.id===account)){
   setError('Selecione forma de pagamento e conta financeira ativas.');return
  }
  try{
   const amount=positive(get(data,'amount')),date=get(data,'date')
   if(Number(amount)>Number(exactPaymentAmount(row.open_amount)))throw Error('Valor acima do saldo em aberto.')
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Informe uma data válida.')
   void run({name:kind==='payable'?'register_institutional_payable_payment':'register_institutional_receipt',args:{
    p_organization_id:organizationId,
    ...(kind==='payable'?{p_payable_id:selected,p_payment_date:date}:{p_receivable_id:selected,p_receipt_date:date}),
    p_accounting_period:monthStart(get(data,'period')),p_amount:amount,p_allocate_amount:amount,
    p_payment_method_id:method,p_financial_account_id:account,p_reference:get(data,'reference')||null,
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 const locked=pending||uncertain||conflict
 const categories=catalog?.categories.filter(c=>c.active&&c.domain===(kind==='payable'?'institutional_expense':'institutional_revenue'))??[]
 return <section className="panel member-editor institutional-operations" aria-label="Tesouraria institucional">
  <div className="section-title"><h2>Contas a pagar e a receber — tesouraria</h2>
   <button className="secondary" type="button" disabled={pending||uncertain} onClick={()=>{setConflict(false);setSaved(false);setRevision(v=>v+1)}}>Atualizar lançamentos</button>
  </div>
  <div className="finance-sections" role="group" aria-label="Tipo de obrigação institucional">
   {(['payable','receivable'] as const).map(value=><button key={value} type="button" className="secondary"
    aria-pressed={kind===value} disabled={pending||uncertain} onClick={()=>{setKind(value);setSaved(false)}}>{label[value]}</button>)}
  </div>
  <p className="subtle">A obrigação é registrada e classificada na competência. A liquidação financeira é um evento diferente; pagamentos pendentes de aprovação não são liberados por esta tela.</p>
  {saved&&<p role="status">Operação institucional confirmada. A consulta foi atualizada.</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button type="button" className="secondary" disabled={pending}
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!catalog||!rows?(!error&&<p role="status">Carregando lançamentos institucionais…</p>):<>
   <form aria-label="Cadastrar obrigação institucional" onSubmit={create}>
    <fieldset disabled={locked}><legend>Cadastrar {kind==='payable'?'despesa':'receita'} institucional</legend>
     <div className="member-form-grid">
      <div><label htmlFor="inst-description">Descrição</label><input id="inst-description" name="description" required maxLength={300}/></div>
      <div><label htmlFor="inst-counterparty">Fornecedor / origem</label><input id="inst-counterparty" name="counterparty" required maxLength={200}/></div>
      <div><label htmlFor="inst-category">Categoria institucional</label>
       <select id="inst-category" name="category" required defaultValue=""><option value="">Selecione</option>
        {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor="inst-fund">Fundo (opcional)</label><select id="inst-fund" name="fund" defaultValue="">
       <option value="">Sem fundo</option>{catalog.funds.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
      </select></div>
      <div><label htmlFor="inst-competence">Competência da obrigação</label><input id="inst-competence" name="competence" type="month" required/></div>
      <div><label htmlFor="inst-issue">Data de emissão</label><input id="inst-issue" name="issue" type="date" required/></div>
      <div><label htmlFor="inst-due">Data de vencimento</label><input id="inst-due" name="due" type="date" required/></div>
      <div><label htmlFor="inst-period">Competência de registro</label><input id="inst-period" name="period" type="month" required/></div>
      <div><label htmlFor="inst-amount">Valor da obrigação (R$)</label><input id="inst-amount" name="amount" inputMode="decimal" required/></div>
     </div>
     <button type="submit" className="primary" disabled={locked||!categories.length}>Cadastrar {kind==='payable'?'despesa':'receita'}</button>
    </fieldset>
   </form>
   <h3>{label[kind]} — registros consultados</h3>
   {!rows.length?<p>Nenhuma obrigação cadastrada nesta consulta.</p>:
    <div className="finance-table" role="region" aria-label="Obrigações institucionais consultadas" tabIndex={0}>
     <table><thead><tr><th>Descrição</th><th>Fornecedor / origem</th><th>Vencimento</th><th>Em aberto</th><th>Situação</th></tr></thead>
      <tbody>{rows.map(r=><tr key={kind==='payable'?r.payable_id:r.receivable_id}>
       <th scope="row">{r.description}</th><td>{r.counterparty_name}</td>
       <td>{formatDate(r.due_date)}</td><td>{formatMoney(Number(r.open_amount))}</td>
       <td>{r.is_canceled?'Cancelado':kind==='payable'?(r.approval_status??'Sem aprovação'):'Registrado'}</td>
      </tr>)}</tbody></table>
    </div>}
   <form aria-label="Liquidar obrigação institucional" onSubmit={settle}>
    <fieldset disabled={locked||!eligible.length}><legend>{kind==='payable'?'Pagar obrigação':'Receber obrigação'}</legend>
     <label htmlFor="inst-target">Obrigação disponível</label>
     <select id="inst-target" required value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">Selecione</option>
      {eligible.map(r=><option key={kind==='payable'?r.payable_id:r.receivable_id}
        value={kind==='payable'?r.payable_id:r.receivable_id}>
         {r.description} — {formatMoney(Number(r.open_amount))}
       </option>)}
     </select>
     <div className="member-form-grid">
      <div><label htmlFor="inst-settle-date">Data da liquidação</label><input id="inst-settle-date" name="date" type="date" required/></div>
      <div><label htmlFor="inst-settle-period">Competência da liquidação</label><input id="inst-settle-period" name="period" type="month" required/></div>
      <div><label htmlFor="inst-settle-amount">Valor a liquidar (R$)</label><input id="inst-settle-amount" name="amount" required inputMode="decimal"/></div>
      <div><label htmlFor="inst-settle-method">Forma de pagamento</label><select id="inst-settle-method" name="method" required defaultValue="">
       <option value="">Selecione</option>{catalog.methods.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
      </select></div>
      <div><label htmlFor="inst-settle-account">Conta financeira ativa</label><select id="inst-settle-account" name="account" required defaultValue="">
       <option value="">Selecione</option>{catalog.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select></div>
      <div><label htmlFor="inst-settle-reference">Referência (opcional)</label><input id="inst-settle-reference" name="reference" maxLength={150}/></div>
     </div>
     <p className="subtle">Valor pode ser parcial. O saldo é sempre recalculado pelo banco; aprovações exigidas precisam ser concluídas antes do pagamento.</p>
     <button type="submit" className="primary" disabled={locked||!selected||!catalog.methods.length||!catalog.accounts.length}>{kind==='payable'?'Registrar pagamento':'Registrar recebimento'}</button>
    </fieldset>
   </form>
   <p className="subtle">Consulta limitada a 150 obrigações por tipo, sem somar páginas como saldo total. Se exceder a capacidade, a operação é bloqueada. Correções, cancelamentos, política de aprovação e negociação possuem fluxos próprios ainda pendentes.</p>
  </>}
 </section>
}
