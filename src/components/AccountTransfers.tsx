import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTreasuryAccounts,type TreasuryAccount} from '../lib/treasury-balances'
import {loadAccountTransferPage,type AccountTransfer,type AccountTransferReversal} from '../lib/account-transfers'
import {normalizedAmount} from '../lib/member-configuration'
import {formatMoney,formatDate} from '../lib/finance-data'
type Account=TreasuryAccount&{balance:number|null}
type Command={name:'register_tenant_account_transfer_idempotent'|'reverse_tenant_account_transfer_idempotent';args:Record<string,unknown>}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function AccountTransfers({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [accounts,setAccounts]=useState<Account[]|null>(null)
 const [transfers,setTransfers]=useState<{rows:AccountTransfer[];reversals:AccountTransferReversal[];hasNext:boolean}|null>(null)
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [selected,setSelected]=useState(''),[confirmation,setConfirmation]=useState('')
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[success,setSuccess]=useState('')
 const command=useRef<Command|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setAccounts(null);setTransfers(null);setSelected('')
  loadTreasuryAccounts(client,organizationId,controller.signal)
   .then(value=>{if(live)setAccounts(value)})
   .catch(()=>{if(live)setError('Não foi possível validar as contas e os saldos desta Loja.')})
  return()=>{live=false;controller.abort()}
 },[client,organizationId,revision])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setTransfers(null)
  if(accounts){
   loadAccountTransferPage(client,organizationId,page,controller.signal)
    .then(result=>{if(live)setTransfers(result)})
    .catch(()=>{if(live)setError('A movimentação entre contas não pôde ser conciliada. Nenhuma operação foi autorizada.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,organizationId,accounts,page])
 async function run(next:Command){
  if(guard.current)return
  command.current=command.current??next;guard.current=true
  setBusy(true);setError('');setSuccess('')
  try{
   const result=await client.rpc(command.current.name,command.current.args)
   if(result.error)throw result.error
   if(typeof result.data!=='string'||!uuid.test(result.data))throw Error('Unconfirmed transfer response')
   if(mounted.current){
    const wasReversal=command.current.name==='reverse_tenant_account_transfer_idempotent'
    command.current=null;setUncertain(false)
    setSuccess(wasReversal?'Estorno contabilizado como evento independente.':'Transferência contabilizada entre contas da Loja.')
    setSelected('');setConfirmation('');setPage(0);setRevision(v=>v+1)
   }
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','23503','23505','23514','42501','28000','55000','40001'].includes(code)){
    command.current=null;setUncertain(false)
    setError(
     code==='42501'||code==='28000'?'Seu perfil ou assinatura não permite transferências financeiras.':
     code==='23514'?'O saldo de origem/destino é insuficiente, ou o lançamento já foi estornado.':
     code==='55000'?'A competência do lançamento está fechada. Confira os eventos antes de prosseguir.':
     'Transferência ou estorno recusado pelo banco. Confira contas, datas e informações.'
    )
    setRevision(v=>v+1)
   }else{
    setUncertain(true)
    setError('O resultado do lançamento não foi confirmado. Use Verificar envio com a mesma chave, sem repetir a operação manualmente.')
   }
  }finally{guard.current=false;if(mounted.current)setBusy(false)}
 }
 function submitTransfer(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!accounts||!transfers||busy||uncertain)return
  const data=new FormData(e.currentTarget)
  const get=(name:string)=>String(data.get(name)??'').trim()
  const from=get('from'),to=get('to'),reason=get('reason'),date=get('date')
  const reference=get('reference')
  const source=accounts.find(a=>a.id===from&&a.active),dest=accounts.find(a=>a.id===to&&a.active)
  try{
   const amount=normalizedAmount(get('amount'))
   if(!source||!dest||from===to||source.balance===null||
    Number(amount)>source.balance||Number(amount)<=0||
    reason.length<3||reason.length>500||reference.length>120||
    !/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Confira as contas ativas, o saldo, a data e o motivo.')
   void run({name:'register_tenant_account_transfer_idempotent',args:{
    p_organization_id:organizationId,p_from_account_id:from,p_to_account_id:to,
    p_transfer_date:date,p_amount:amount,p_reference:reference||null,
    p_reason:reason,p_idempotency_key:crypto.randomUUID(),
   }})
  }catch(e){setError((e as Error).message)}
 }
 function submitReversal(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!transfers||busy||uncertain||confirmation!=='ESTORNAR')return
  const selectedTransfer=transfers.rows.find(t=>t.id===selected)
  if(!selectedTransfer||transfers.reversals.some(r=>r.transfer_id===selected))return
  const data=new FormData(e.currentTarget),reason=String(data.get('reason')??'').trim()
  const date=String(data.get('date')??'').trim()
  if(reason.length<3||reason.length>500||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
   date<selectedTransfer.transfer_date){setError('Informe data e motivo válidos para estornar o lançamento.');return}
  void run({name:'reverse_tenant_account_transfer_idempotent',args:{
   p_organization_id:organizationId,p_transfer_id:selected,p_reversal_date:date,
   p_reason:reason,p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const locked=busy||uncertain
 const eligible=accounts?.filter(a=>a.active)??[]
 const pendingReversal=transfers?.rows.find(t=>t.id===selected&&
  !transfers.reversals.some(r=>r.transfer_id===t.id))
 const accountLabel=(id:string)=>accounts?.find(a=>a.id===id)?.name??'Conta não identificada'
 return <section className="panel member-editor" aria-label="Transferências entre contas">
  <div className="section-title"><h2>Transferências e estornos de contas</h2>
   <button className="secondary" type="button" disabled={locked}
    onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar movimentos</button>
  </div>
  <p className="subtle">Movimentações internas de caixa/banco: saída de uma conta e entrada igual em outra, sem gerar receita ou despesa na DRE. Só é possível debitar o saldo contabilizado de conta ativa. Estorno gera novos lançamentos, preservando o original.</p>
  {success&&<p role="status">{success}</p>}
  {error&&<p role="alert" className="message error">{error}</p>}
  {uncertain&&<button className="secondary" type="button" disabled={busy}
   onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
  {!accounts?(!error&&<p role="status">Conferindo contas e saldos…</p>):<>
   {eligible.length<2&&<p>Para transferir, a Loja precisa de pelo menos duas contas financeiras ativas e corretamente mapeadas no plano contábil.</p>}
   <form aria-label="Registrar transferência bancária" onSubmit={submitTransfer}>
    <fieldset disabled={locked||!transfers||eligible.length<2}>
     <legend>Nova transferência</legend>
     <div className="member-form-grid">
      <div><label htmlFor="transfer-from">Conta de origem</label><select id="transfer-from" name="from" defaultValue="" required>
       <option value="">Selecione</option>{eligible.map(a=><option value={a.id} key={a.id}>{a.name} — {a.balance===null?'sem saldo identificado':formatMoney(a.balance)}</option>)}
      </select></div>
      <div><label htmlFor="transfer-to">Conta de destino</label><select id="transfer-to" name="to" defaultValue="" required>
       <option value="">Selecione</option>{eligible.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
      </select></div>
      <div><label htmlFor="transfer-date">Data da transferência</label><input id="transfer-date" name="date" type="date" required/></div>
      <div><label htmlFor="transfer-amount">Valor transferido (R$)</label><input id="transfer-amount" name="amount" inputMode="decimal" required/></div>
      <div><label htmlFor="transfer-reference">Referência (opcional)</label><input id="transfer-reference" name="reference" maxLength={120}/></div>
      <div><label htmlFor="transfer-reason">Motivo da transferência</label><input id="transfer-reason" name="reason" minLength={3} maxLength={500} required/></div>
     </div>
     <button type="submit" className="primary" disabled={locked||eligible.length<2}>Registrar transferência</button>
    </fieldset>
   </form>
   <h3>Histórico de transferências da Loja</h3>
   {!transfers&&!error&&<p role="status">Consultando movimentações internas…</p>}
   {transfers&&<>
    {!transfers.rows.length?<p>Não existem transferências nesta página.</p>:
     <div className="finance-table" tabIndex={0} role="region" aria-label="Histórico de transferências">
      <table><thead><tr><th>Data</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Status</th><th>Estorno</th></tr></thead>
       <tbody>{transfers.rows.map(t=>{
        const reversed=transfers.reversals.find(r=>r.transfer_id===t.id)
        return <tr key={t.id}>
         <td>{formatDate(t.transfer_date)}</td><td>{accountLabel(t.from_account_id)}</td>
         <td>{accountLabel(t.to_account_id)}</td><td>{formatMoney(Number(t.amount))}</td>
         <td>{reversed?'Estornada':'Contabilizada'}</td><td>{reversed?formatDate(reversed.reversal_date):
          <button className="secondary" type="button" disabled={locked}
           onClick={()=>{setSelected(t.id);setConfirmation('')}}>Selecionar para estorno</button>}</td>
        </tr>
       })}</tbody>
      </table>
     </div>}
    <div className="finance-pagination">
     <button className="secondary" disabled={page===0||locked} onClick={()=>{setPage(v=>v-1);setSelected('')}}>Anterior</button>
     <span role="status">Página {page+1} — {transfers.rows.length} transferências</span>
     <button className="secondary" disabled={!transfers.hasNext||locked} onClick={()=>{setPage(v=>v+1);setSelected('')}}>Próxima</button>
    </div>
    {pendingReversal&&<form aria-label="Confirmar estorno de transferência" onSubmit={submitReversal}>
     <fieldset disabled={locked}>
      <legend>Estornar transferência selecionada</legend>
      <p>{formatDate(pendingReversal.transfer_date)} · {accountLabel(pendingReversal.from_account_id)} → {accountLabel(pendingReversal.to_account_id)} · {formatMoney(Number(pendingReversal.amount))}</p>
      <label htmlFor="transfer-reversal-date">Data do estorno</label><input id="transfer-reversal-date" name="date" type="date" min={pendingReversal.transfer_date} required/>
      <label htmlFor="transfer-reversal-reason">Justificativa do estorno</label><input id="transfer-reversal-reason" name="reason" required minLength={3} maxLength={500}/>
      <label htmlFor="transfer-reversal-confirm">Digite ESTORNAR</label><input id="transfer-reversal-confirm" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
      <button className="primary" type="submit" disabled={locked||confirmation!=='ESTORNAR'}>Confirmar estorno</button>
     </fieldset>
    </form>}
   </>}
  </>}
  <p className="subtle">As transferências exigem competência aberta e autorização institucional; saldo do banco não equivale a saldo conciliado com OFX/CSV. O servidor revalida as contas, os valores e o lançamento mesmo após a conferência na tela.</p>
 </section>
}
