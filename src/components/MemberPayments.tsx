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
const isConfirmedRemaining = (value: unknown): value is string | number =>
 (typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
 (typeof value === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(value))
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
 const [fifoUncertain,setFifoUncertain] = useState(false)
 const [fifoUncertainNotice,setFifoUncertainNotice] = useState('')
 const [fifoReloadPending,setFifoReloadPending] = useState(false)
 const [fifoReloadFailed,setFifoReloadFailed] = useState(false)
 const [conflict,setConflict] = useState(false)
 const [error,setError] = useState('')
 const [ledgerError,setLedgerError] = useState('')
 const [saved,setSaved] = useState('')
 const [allocationPayment,setAllocationPayment] = useState('')
 const [allocationCharge,setAllocationCharge] = useState('')
 const [fifoPayment,setFifoPayment] = useState('')
 const [fifoPeriod,setFifoPeriod] = useState('')
 const [fifoConfirmed,setFifoConfirmed] = useState(false)
 const [reversalPayment,setReversalPayment] = useState('')
 const guard=useRef(false),mounted=useRef(false),command=useRef<Command|null>(null)
 const pendingUncertainReload=useRef(false),selectedMemberRef=useRef('')
 const pendingFifoReload=useRef<{organizationId:string;memberId:string;remaining:string|number}|null>(null)
 selectedMemberRef.current=memberId
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setCatalog(null);setLedger(null);setError('');setLedgerError('')
  if(pendingFifoReload.current&&pendingFifoReload.current.organizationId!==organizationId){
   pendingFifoReload.current=null;setFifoReloadPending(false);setFifoReloadFailed(false)
  }
  loadPaymentCatalog(client,organizationId,abort.signal).then(next=>{
   if(!live)return
   setCatalog(next)
   const currentMember=selectedMemberRef.current
   if(!next.members.some(m=>m.id===currentMember)){
    pendingUncertainReload.current=false
    setFifoUncertain(false)
    pendingFifoReload.current=null
    setFifoReloadPending(false)
    setFifoReloadFailed(false)
   }
   setMemberId(previous=>next.members.some(m=>m.id===previous)?previous:'')
  }).catch(()=>{
   if(!live)return
   if(pendingUncertainReload.current){
    pendingUncertainReload.current=false
    setFifoUncertain(true)
    setFifoUncertainNotice('Não foi possível recarregar o extrato após resposta incerta. Recarregue os dados antes de tentar novamente.')
   }
   const fifoTarget=pendingFifoReload.current
   if(fifoTarget&&fifoTarget.organizationId===organizationId&&fifoTarget.memberId===selectedMemberRef.current){
    setFifoReloadPending(true)
    setFifoReloadFailed(true)
    setSaved(`Baixa FIFO confirmada. Crédito restante previsto: ${displayAmount(fifoTarget.remaining)}.`)
    setError('O extrato está indisponível. Faça uma nova consulta para conferir os saldos, sem repetir a operação.')
    return
   }
   setError('Não foi possível carregar os cadastros necessários para pagamentos.')
  })
  return()=>{live=false;abort.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  let live=true;const abort=new AbortController()
  setLedger(null);setLedgerError('')
  setAllocationPayment('');setAllocationCharge('');setReversalPayment('')
  setFifoPayment('');setFifoPeriod('');setFifoConfirmed(false)
  if(memberId && catalog?.members.some(m=>m.id===memberId)) {
   loadMemberLedger(client,organizationId,memberId,abort.signal).then(next=>{
    if(!live)return
    setLedger(next)
    if(pendingUncertainReload.current){
     pendingUncertainReload.current=false
     setFifoUncertain(false)
     setFifoUncertainNotice('Resposta anterior da baixa FIFO foi incerta; os dados foram recarregados. Confira crédito, títulos e alocações antes de uma nova tentativa.')
    }
    const fifoTarget=pendingFifoReload.current
    if(fifoTarget&&fifoTarget.organizationId===organizationId&&fifoTarget.memberId===memberId){
     pendingFifoReload.current=null
     setFifoReloadPending(false)
     setFifoReloadFailed(false)
     setSaved(`Baixa FIFO confirmada. Crédito restante: ${displayAmount(fifoTarget.remaining)}. O extrato foi atualizado.`)
    }
   }).catch(()=>{
    if(!live)return
    if(pendingUncertainReload.current){
     pendingUncertainReload.current=false
     setFifoUncertain(true)
     setFifoUncertainNotice('Não foi possível recarregar o extrato após resposta incerta. Recarregue os dados antes de tentar novamente.')
    }
    const fifoTarget=pendingFifoReload.current
    if(fifoTarget&&fifoTarget.organizationId===organizationId&&fifoTarget.memberId===memberId){
     setFifoReloadPending(true)
     setFifoReloadFailed(true)
     setSaved(`Baixa FIFO confirmada. Crédito restante previsto: ${displayAmount(fifoTarget.remaining)}.`)
     setLedgerError('O extrato está indisponível. Faça uma nova consulta para conferir os saldos, sem repetir a operação.')
     return
    }
    setLedgerError('Não foi possível verificar o extrato. Nenhuma operação deve ser realizada sem consulta íntegra.')
   })
  }
  return()=>{live=false;abort.abort()}
 },[client,organizationId,memberId,catalog])
 async function run(next:Command) {
  if(guard.current||conflict||fifoReloadPending)return
  command.current=command.current??next
  const isFifo=command.current.name==='allocate_payment_fifo'
  guard.current=true;setBusy(true);setError('');setSaved('');setFifoUncertainNotice('')
  try{
   const {data,error:failure}=await client.rpc(command.current.name,command.current.args)
   if(failure)throw failure
   if(isFifo){
    if(!isConfirmedRemaining(data)) throw new Error('FIFO allocation did not return a confirmed remaining credit')
   }else if(!isUuid(data)) throw new Error('Payment operation did not return a confirmed UUID')
   if(mounted.current){
    command.current=null;setUncertain(false);setFifoUncertain(false);setFifoConfirmed(false)
    if(isFifo){
     const remaining=data as string|number
     pendingFifoReload.current={organizationId,memberId,remaining}
     setFifoReloadPending(true)
     setFifoReloadFailed(false)
     setSaved(`Baixa FIFO confirmada. Crédito restante previsto: ${displayAmount(remaining)}. O extrato está sendo atualizado.`)
    }else{
     setSaved('Operação confirmada. O extrato foi atualizado.')
    }
    setRevision(value=>value+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','22003','23502','23503','23505','23514','40001','55P03','PT409','42501','28000','55000','P0002'].includes(code)){
    command.current=null;setUncertain(false);setFifoUncertain(false);setFifoConfirmed(false)
    const isConflict=code==='40001'||code==='55P03'||code==='PT409'
    setConflict(isConflict)
    setError(code==='42501'||code==='28000'?
     'Seu perfil ou a situação da Loja não autoriza esta operação.':
     code==='55000'||code==='23505'?
     'O pagamento ou lançamento já foi revertido ou a competência não permite a operação. Atualize o extrato.':
     isConflict?
     'O registro foi alterado. Atualize antes de realizar nova operação.':
     'Pagamento ou alocação rejeitado pelo banco. Confira valor, competência, contas e saldo disponível.')
   }else if(isFifo){
    command.current=null;setFifoConfirmed(false);setFifoUncertain(true)
    pendingUncertainReload.current=true
    setFifoUncertainNotice('Resultado da baixa FIFO não confirmado. Recarregando os dados para conferir o estado antes de permitir nova tentativa.')
    setRevision(value=>value+1)
   }else{
    setUncertain(true)
    setError('Resultado não confirmado. Use Verificar envio para repetir a mesma solicitação sem duplicar.')
   }
  }finally{guard.current=false;if(mounted.current)setBusy(false)}
 }
 function get(form:FormData,key:string){return String(form.get(key)??'').trim()}
 function submitPayment(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(guard.current||busy||uncertain||fifoUncertain||fifoReloadPending||conflict||!memberId||!catalog||!ledger)return
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
 const selectedFifoPayment=available.find(x=>x.payment_id===fifoPayment)
 function submitAllocation(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(guard.current||busy||uncertain||fifoUncertain||fifoReloadPending||conflict||!ledger||!memberId)return
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
 function submitFifo(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(guard.current||busy||uncertain||fifoUncertain||fifoReloadPending||conflict||!ledger||!memberId)return
  try{
   const p=available.find(x=>x.payment_id===fifoPayment)
   if(!p)throw Error('Selecione um pagamento elegível com crédito disponível.')
   if(!fifoConfirmed)throw Error('Confirme explicitamente a baixa pelos débitos mais antigos (FIFO) antes de continuar.')
   void run({name:'allocate_payment_fifo',args:{
    p_organization_id:organizationId,
    p_payment_id:p.payment_id,
    p_accounting_period:period(fifoPeriod),
   }})
  }catch(cause){setError((cause as Error).message)}
 }
 function submitReversal(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(guard.current||busy||uncertain||fifoUncertain||fifoReloadPending||conflict||!ledger||!memberId)return
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
  if(fifoUncertain){
   pendingUncertainReload.current=true
   setFifoUncertainNotice('Recarregando os dados para conferir o estado antes de permitir nova tentativa.')
  }else{
   setFifoUncertainNotice('')
  }
  const fifoTarget=pendingFifoReload.current
  if(fifoTarget&&fifoTarget.organizationId===organizationId&&fifoTarget.memberId===memberId){
   setFifoReloadFailed(false)
   setSaved(`Baixa FIFO confirmada. Crédito restante previsto: ${displayAmount(fifoTarget.remaining)}. O extrato está sendo atualizado.`)
  }else{
   setSaved('')
  }
  setConflict(false);setRevision(v=>v+1)
 }
 const disabled=busy||uncertain||fifoUncertain||fifoReloadPending||conflict
 return <section className="panel member-editor member-payments" aria-label="Pagamentos de integrantes">
  <div className="section-title"><h2>Pagamentos, alocações e estornos</h2>
   <button type="button" className="secondary" disabled={busy||uncertain} onClick={refresh}>Atualizar extrato</button>
  </div>
  <p className="subtle">Receber dinheiro não liquida automaticamente todas as cobranças. A alocação de crédito e o estorno são operações separadas, auditadas pelo banco.</p>
  {saved&&<p role="status">{saved}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {fifoUncertainNotice&&<p role="alert" className="message error">{fifoUncertainNotice}</p>}
  {fifoReloadFailed&&<button className="secondary" type="button" disabled={busy||uncertain} onClick={refresh}>Nova consulta</button>}
  {fifoUncertain&&!pendingUncertainReload.current&&<button className="secondary" type="button" disabled={busy||uncertain} onClick={refresh}>Recarregar dados</button>}
  {uncertain&&<button className="secondary" type="button" disabled={busy} onClick={()=>{
   if(command.current)void run(command.current)
  }}>Verificar envio</button>}
  {!catalog?(!error&&<p role="status">Carregando cadastros…</p>):<>
   <label htmlFor="member-payments-member">Integrante</label>
   <select id="member-payments-member" value={memberId} disabled={disabled} onChange={e=>{
    pendingUncertainReload.current=false;setFifoUncertain(false);setFifoUncertainNotice('')
    pendingFifoReload.current=null;setFifoReloadPending(false);setFifoReloadFailed(false)
    setConflict(false);setSaved('');setError('');setMemberId(e.target.value)
   }}>
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
    {available.length>0&&<form aria-label="Baixar pelos débitos mais antigos (FIFO)" onSubmit={submitFifo}>
     <fieldset disabled={disabled}><legend>Baixar pelos débitos mais antigos (FIFO)</legend>
      <p className="subtle">Aplica automaticamente o crédito disponível nos débitos em aberto elegíveis, na ordem definida pelo servidor.</p>
      <label htmlFor="member-fifo-pay">Pagamento elegível para FIFO</label>
      <select id="member-fifo-pay" required value={fifoPayment} onChange={e=>{setFifoPayment(e.target.value);setFifoConfirmed(false)}}>
       <option value="">Selecione</option>
       {available.map(p=><option key={p.payment_id} value={p.payment_id}>{formatDate(p.payment_date)} — disponível {displayAmount(p.available_amount)} — {p.payment_id.slice(0,8)}</option>)}
      </select>
      <label htmlFor="member-fifo-period">Competência contábil</label>
      <input id="member-fifo-period" name="period" type="month" required value={fifoPeriod} onChange={e=>{setFifoPeriod(e.target.value);setFifoConfirmed(false)}}/>
      <label htmlFor="member-fifo-confirm">
       <input id="member-fifo-confirm" type="checkbox" checked={fifoConfirmed} disabled={!fifoPayment||!fifoPeriod} onChange={e=>setFifoConfirmed(e.target.checked)}/>{' '}
       Confirmar baixa automática pelos débitos mais antigos (FIFO)
      </label>
      {selectedFifoPayment&&fifoPeriod&&<p className="subtle">Crédito disponível selecionado: {displayAmount(selectedFifoPayment.available_amount)}. Os títulos elegíveis e valores aplicados são decididos pelo servidor.</p>}
      <button className="primary" type="submit" disabled={disabled||!fifoPayment||!fifoPeriod||!fifoConfirmed}>Baixar pelos débitos mais antigos (FIFO)</button>
     </fieldset>
    </form>}
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
