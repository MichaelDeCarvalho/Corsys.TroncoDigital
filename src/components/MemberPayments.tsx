import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizedAmount } from '../lib/member-configuration'
import { formatDate, formatMoney } from '../lib/finance-data'
import {
 loadMemberLedger, loadPaymentCatalog, exactPaymentAmount,
 type PaymentCatalog, type MemberLedger,
} from '../lib/member-payments'

type Command = { name: string; args: Record<string, unknown> }
const isUuid = (value: unknown): value is string =>
 typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function displayAmount(value: string | number) {
 return formatMoney(Number(exactPaymentAmount(value)))
}
function period(value: string) {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Informe uma competência válida.')
 return `${value}-01`
}
function parseAmount(value: string): string {
 const amount = normalizedAmount(value)
 if (Number(amount) <= 0) throw new Error('Informe um valor positivo.')
 return amount
}

export function MemberPayments({client,organizationId}:{client:SupabaseClient;organizationId:string}) {
 const [catalog,setCatalog] = useState<PaymentCatalog|null>(null)
 const [ledger,setLedger] = useState<MemberLedger|null>(null)
 const [memberId,setMemberId] = useState('')
 const [revision,setRevision] = useState(0)
 const [busy,setBusy] = useState(false)
 const [uncertain,setUncertain] = useState(false)
 const [conflict,setConflict] = useState(false)
 const [error,setError] = useState('')
 const [ledgerError,setLedgerError] = useState('')
 const [saved,setSaved] = useState('')
 const [allocationPayment,setAllocationPayment] = useState('')
 const [allocationCharge,setAllocationCharge] = useState('')
 const [reversalPayment,setReversalPayment] = useState('')
 const guard=useRef(false),mounted=useRef(false),command=useRef<Command|null>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setCatalog(null);setLedger(null);setError('');setLedgerError('')
  loadPaymentCatalog(client,organizationId,abort.signal).then(next=>{
   if(!live)return
   setCatalog(next)
   setMemberId(previous=>next.members.some(m=>m.id===previous)?previous:'')
  }).catch(()=>{if(live)setError('Não foi possível carregar os cadastros necessários para pagamentos.')})
  return()=>{live=false;abort.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setLedger(null);setLedgerError('')
  setAllocationPayment('');setAllocationCharge('');setReversalPayment('')
  if(memberId && catalog?.members.some(m=>m.id===memberId)) {
   loadMemberLedger(client,organizationId,memberId,abort.signal).then(next=>{
    if(live)setLedger(next)
   }).catch(()=>{if(live)setLedgerError('Não foi possível verificar o extrato. Nenhuma operação deve ser realizada sem consulta íntegra.')})
  }
  return()=>{live=false;abort.abort()}
 },[client,organizationId,memberId,catalog])
 async function run(next:Command) {
  if(guard.current||conflict)return
  command.current=command.current??next
  guard.current=true;setBusy(true);setError('');setSaved('')
  try{
   const {data,error:failure}=await client.rpc(command.current.name,command.current.args)
   if(failure)throw failure
   if(!isUuid(data)) throw new Error('Payment operation did not return a confirmed UUID')
   if(mounted.current){
    command.current=null;setUncertain(false)
    setSaved('Operação confirmada. O extrato foi atualizado.')
    setRevision(value=>value+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','22003','23502','23503','23505','23514','40001','42501','28000','55000','P0002'].includes(code)){
    command.current=null;setUncertain(false)
    setConflict(code==='40001')
    setError(code==='42501'||code==='28000'?
     'Seu perfil ou a situação da Loja não autoriza esta operação.':
     code==='55000'||code==='23505'?
     'O pagamento ou lançamento já foi revertido ou a competência não permite a operação. Atualize o extrato.':
     code==='40001'?
     'O registro foi alterado. Atualize antes de realizar nova operação.':
     'Pagamento ou alocação rejeitado pelo banco. Confira valor, competência, contas e saldo disponível.')
   }else{
    setUncertain(true)
    setError('Resultado não confirmado. Use Verificar envio para repetir a mesma solicitação sem duplicar.')
   }
  }finally{guard.current=false;if(mounted.current)setBusy(false)}
 }
 function get(form:FormData,key:string){return String(form.get(key)??'').trim()}
 function submitPayment(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(busy||uncertain||conflict||!memberId||!catalog||!ledger)return
  const form=new FormData(e.currentTarget)
  try{
   const date=get(form,'date'),competence=get(form,'period')
   const method=get(form,'method'),account=get(form,'account')
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||
      !catalog.methods.some(x=>x.id===method&&x.active)||
      !catalog.accounts.some(x=>x.id===account&&x.active))throw Error('Selecione data, forma de pagamento e conta financeira ativa.')
   void run({name:'register_payment',args:{
    p_organization_id:organizationId,p_member_id:memberId,
    p_payment_date:date,p_accounting_period:period(competence),
    p_amount:parseAmount(get(form,'amount')),p_payment_method_id:method,
    p_financial_account_id:account,p_reference:get(form,'reference')||null,
    p_notes:get(form,'notes')||null,p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 const available=(ledger?.payments??[]).filter(p=>!p.is_reversed&&Number(p.available_amount)>0)
 const openCharges=(ledger?.charges??[]).filter(c=>!c.is_cancelled&&Number(c.open_amount)>0)
 function submitAllocation(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(busy||uncertain||conflict||!ledger||!memberId)return
  const form=new FormData(e.currentTarget)
  try{
   const p=available.find(x=>x.payment_id===allocationPayment)
   const c=openCharges.find(x=>x.charge_id===allocationCharge)
   const amount=parseAmount(get(form,'amount'))
   if(!p||!c)throw Error('Selecione pagamento com crédito e cobrança em aberto.')
   if(Number(amount)>Number(p.available_amount)||Number(amount)>Number(c.open_amount))throw Error('Valor maior que o crédito ou o saldo em aberto. Atualize antes de alocar.')
   void run({name:'allocate_payment_to_charge',args:{
    p_organization_id:organizationId,p_payment_id:p.payment_id,p_charge_id:c.charge_id,
    p_amount:amount,p_accounting_period:period(get(form,'period')),
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 function submitReversal(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(busy||uncertain||conflict||!ledger||!memberId)return
  const form=new FormData(e.currentTarget)
  const p=ledger.payments.find(x=>x.payment_id===reversalPayment&&!x.is_reversed)
  const reason=get(form,'reason')
  if(!p||reason.length<3||reason.length>500){setError('Selecione um pagamento não estornado e informe um motivo válido.');return}
  try{
   void run({name:'reverse_member_payment_idempotent',args:{
    p_organization_id:organizationId,p_payment_id:p.payment_id,
    p_accounting_period:period(get(form,'period')),p_reason:reason,
    p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 function refresh(){
  if(busy||uncertain)return
  setConflict(false);setSaved('');setRevision(v=>v+1)
 }
 const disabled=busy||uncertain||conflict
 return <section className="panel member-editor member-payments" aria-label="Pagamentos de integrantes">
  <div className="section-title"><h2>Pagamentos, alocações e estornos</h2>
   <button type="button" className="secondary" disabled={busy||uncertain} onClick={refresh}>Atualizar extrato</button>
  </div>
  <p className="subtle">Receber dinheiro não liquida automaticamente todas as cobranças. A alocação de crédito e o estorno são operações separadas, auditadas pelo banco.</p>
  {saved&&<p role="status">{saved}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button className="secondary" type="button" disabled={busy} onClick={()=>{
   if(command.current)void run(command.current)
  }}>Verificar envio</button>}
  {!catalog?(!error&&<p role="status">Carregando cadastros…</p>):<>
   <label htmlFor="member-payments-member">Integrante</label>
   <select id="member-payments-member" value={memberId} disabled={disabled} onChange={e=>setMemberId(e.target.value)}>
    <option value="">Selecione um integrante</option>
    {catalog.members.map(m=><option key={m.id} value={m.id}>{m.full_name}{m.status==='active'?'':' (inativo)'}</option>)}
   </select>
   {memberId&&ledgerError&&<p role="alert">{ledgerError}</p>}
   {memberId&&!ledger&&!ledgerError&&<p role="status">Carregando extrato financeiro do integrante…</p>}
   {memberId&&ledger&&<>
    <form aria-label="Registrar pagamento de integrante" onSubmit={submitPayment}>
     <fieldset disabled={disabled}><legend>Registrar recebimento</legend>
      <div className="member-form-grid">
       <div><label htmlFor="member-pay-date">Data do pagamento</label><input id="member-pay-date" name="date" type="date" required/></div>
       <div><label htmlFor="member-pay-period">Competência contábil</label><input id="member-pay-period" name="period" type="month" required/></div>
       <div><label htmlFor="member-pay-amount">Valor recebido (R$)</label><input id="member-pay-amount" name="amount" required inputMode="decimal" placeholder="150,00"/></div>
       <div><label htmlFor="member-pay-method">Forma de pagamento</label><select id="member-pay-method" name="method" required defaultValue="">
        <option value="">Selecione</option>{catalog.methods.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
       </select></div>
       <div><label htmlFor="member-pay-account">Conta de caixa/banco ativa</label><select id="member-pay-account" name="account" required defaultValue="">
        <option value="">Selecione</option>{catalog.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
       </select></div>
       <div><label htmlFor="member-pay-reference">Referência (opcional)</label><input id="member-pay-reference" name="reference" maxLength={150}/></div>
       <div><label htmlFor="member-pay-notes">Observação (opcional)</label><input id="member-pay-notes" name="notes" maxLength={500}/></div>
      </div>
      <button className="primary" type="submit" disabled={disabled||!catalog.methods.length||!catalog.accounts.length}>Registrar pagamento</button>
     </fieldset>
    </form>
    <h3>Pagamentos do integrante</h3>
    {!ledger.payments.length?<p>Não há pagamentos no extrato consultado.</p>:
    <div className="finance-table" role="region" aria-label="Pagamentos consultados" tabIndex={0}>
     <table><thead><tr><th>Data</th><th>Recebido</th><th>Alocado</th><th>Crédito disponível</th><th>Situação</th></tr></thead>
      <tbody>{ledger.payments.map(p=><tr key={p.payment_id}>
       <td>{formatDate(p.payment_date)}</td><td>{displayAmount(p.amount)}</td>
       <td>{displayAmount(p.allocated_amount)}</td><td>{displayAmount(p.available_amount)}</td>
       <td>{p.is_reversed?'Estornado':'Registrado'}</td>
      </tr>)}</tbody></table>
    </div>}
    <h3>Cobranças em aberto</h3>
    {!openCharges.length?<p>Nenhuma cobrança em aberto na consulta do integrante.</p>:
     <ul>{openCharges.map(c=><li key={c.charge_id}>{c.description} — vence {formatDate(c.due_date)} — em aberto {displayAmount(c.open_amount)}</li>)}</ul>}
    <form aria-label="Alocar pagamento à cobrança" onSubmit={submitAllocation}>
     <fieldset disabled={disabled||!available.length||!openCharges.length}><legend>Alocar crédito em cobrança</legend>
      <label htmlFor="member-alloc-pay">Pagamento com crédito disponível</label>
      <select id="member-alloc-pay" required value={allocationPayment} onChange={e=>setAllocationPayment(e.target.value)}>
       <option value="">Selecione</option>
       {available.map(p=><option key={p.payment_id} value={p.payment_id}>{formatDate(p.payment_date)} — disponível {displayAmount(p.available_amount)} — {p.payment_id.slice(0,8)}</option>)}
      </select>
      <label htmlFor="member-alloc-charge">Cobrança em aberto</label>
      <select id="member-alloc-charge" required value={allocationCharge} onChange={e=>setAllocationCharge(e.target.value)}>
       <option value="">Selecione</option>
       {openCharges.map(c=><option key={c.charge_id} value={c.charge_id}>{c.description} — {displayAmount(c.open_amount)}</option>)}
      </select>
      <label htmlFor="member-alloc-amount">Valor a alocar (R$)</label><input id="member-alloc-amount" name="amount" inputMode="decimal" required/>
      <label htmlFor="member-alloc-period">Competência contábil</label><input id="member-alloc-period" name="period" type="month" required/>
      <button className="primary" type="submit" disabled={disabled||!allocationPayment||!allocationCharge}>Alocar pagamento</button>
     </fieldset>
    </form>
    <form aria-label="Estornar pagamento de integrante" onSubmit={submitReversal}>
     <fieldset disabled={disabled||!ledger.payments.some(p=>!p.is_reversed)}><legend>Estorno auditado</legend>
      <label htmlFor="member-reverse-pay">Pagamento</label>
      <select id="member-reverse-pay" value={reversalPayment} required onChange={e=>setReversalPayment(e.target.value)}>
       <option value="">Selecione</option>
       {ledger.payments.filter(p=>!p.is_reversed).map(p=><option key={p.payment_id} value={p.payment_id}>
        {formatDate(p.payment_date)} — {displayAmount(p.amount)} — {p.payment_id.slice(0,8)}
       </option>)}
      </select>
      <label htmlFor="member-reverse-period">Competência do estorno</label><input id="member-reverse-period" name="period" type="month" required/>
      <label htmlFor="member-reverse-reason">Motivo do estorno</label><input id="member-reverse-reason" name="reason" required minLength={3} maxLength={500}/>
      <p className="subtle">A reversão preserva o lançamento original e desfaz as alocações vigentes por eventos financeiros, sem apagar o histórico.</p>
      <button className="secondary" type="submit" disabled={disabled||!reversalPayment}>Estornar pagamento</button>
     </fieldset>
    </form>
    <p className="subtle">Extrato limitado a 150 cobranças e 150 pagamentos por integrante; se ultrapassar o limite, a consulta bloqueia operações. Não use os valores desta página como saldo global da Loja.</p>
   </>}
  </>}
 </section>
}
