import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {loadInstitutionalMovements,validMovementDate,type MovementKind,type InstitutionalMovement} from '../lib/institutional-reversals'

type Props={client:SupabaseClient;organizationId:string;onReversed?:()=>void}
type Request={p_organization_id:string;p_kind:MovementKind;p_movement_id:string;p_reversal_date:string;p_reason:string;p_idempotency_key:string}
export function InstitutionalReversals(props:Props){return <ReversalPanel key={props.organizationId} {...props}/>}
function ReversalPanel({client,organizationId,onReversed}:Props){
 const [kind,setKind]=useState<MovementKind>('payable_payment'),[rows,setRows]=useState<InstitutionalMovement[]|null>(null)
 const [selected,setSelected]=useState(''),[date,setDate]=useState(''),[reason,setReason]=useState(''),[confirmation,setConfirmation]=useState('')
 const [revision,setRevision]=useState(0),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const request=useRef<Request|null>(null),guard=useRef(false),mounted=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let active=true;const controller=new AbortController();setRows(null);setSelected('')
  loadInstitutionalMovements(client,organizationId,kind,controller.signal).then(data=>{if(active)setRows(data)})
   .catch(()=>{if(active)setError('Não foi possível consultar o histórico institucional de forma íntegra.')})
  return()=>{active=false;controller.abort()}
 },[client,organizationId,kind,revision])
 async function run(){
  if(guard.current||!request.current)return
  guard.current=true;setPending(true);setSaved(false);setError('')
  try{
   const command=request.current,{data,error:failure}=await client.rpc('reverse_tenant_institutional_movement',command)
   if(failure)throw failure
   if(data!==command.p_movement_id)throw Error('Unconfirmed reversal')
   if(mounted.current){request.current=null;setUncertain(false);setSaved(true);setSelected('');setConfirmation('');setRevision(n=>n+1);onReversed?.()}
  }catch(cause){
   if(!mounted.current)return
   const code=(cause as {code?:string}|null)?.code??''
   if(['22023','23502','23503','23505','23514','40001','PT409','42501','28000','55000'].includes(code)){
    request.current=null;setUncertain(false)
    setError(code==='42501'||code==='28000'?'Seu perfil ou a assinatura da Loja não permite este estorno.':
     code==='55000'?'Estorno bloqueado: confira competência aberta, conciliação desfeita e obrigação não cancelada.':
     (code === '40001' || code === 'PT409')?'As alocações mudaram. Atualize o histórico antes de tentar novamente.':'Estorno rejeitado. Atualize o histórico e confira os dados.')
    setRevision(n=>n+1)
   }else{setUncertain(true);setError('Resultado não confirmado. Verifique novamente com a mesma chave antes de iniciar outro estorno.')}
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 function submit(e:FormEvent){
  e.preventDefault();if(pending||uncertain||guard.current)return
  const row=rows?.find(r=>r.id===selected&&!r.reversed)
  if(!row||!validMovementDate(date)||date<row.date||reason.trim().length<3||reason.trim().length>500||confirmation!=='ESTORNAR'){
   setError('Selecione um movimento ativo, informe data válida, justificativa e digite ESTORNAR.');return
  }
  request.current={p_organization_id:organizationId,p_kind:kind,p_movement_id:row.id,p_reversal_date:date,p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}
  void run()
 }
 const locked=pending||uncertain
 return <section className="panel" aria-label="Histórico e estornos institucionais">
  <h3>Pagamentos e recebimentos institucionais</h3>
  <p className="subtle">O estorno desfaz o efeito no caixa e reabre os valores alocados, preservando o histórico. Desfaça a conciliação antes. Obrigações canceladas com alocação exigem revisão.</p>
  <label htmlFor="inst-movement-kind">Tipo de movimento</label>
  <select id="inst-movement-kind" value={kind} disabled={locked} onChange={e=>{setKind(e.target.value as MovementKind);setError('');setSaved(false)}}>
   <option value="payable_payment">Pagamentos de despesas</option><option value="institutional_receipt">Recebimentos de receitas</option>
  </select>
  <button className="secondary" disabled={locked} onClick={()=>{setError('');setSaved(false);setRevision(n=>n+1)}}>Atualizar histórico institucional</button>
  {error&&<p className="message error" role="alert">{error}</p>}
  {saved&&<p className="message" role="status">Estorno institucional confirmado. Consulte novamente a obrigação e o caixa.</p>}
  {uncertain&&<button disabled={pending} onClick={()=>void run()}>Verificar estorno com a mesma chave</button>}
  {!rows?<p role="status">Consultando movimentos institucionais…</p>:!rows.length?<p>Nenhum movimento institucional encontrado.</p>:<>
   <div className="finance-table" role="region" aria-label="Movimentos institucionais consultados" tabIndex={0}>
    <table><thead><tr><th>Data</th><th>Referência</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
     {rows.map(row=><tr key={row.id}><td>{formatDate(row.date)}</td><td>{row.reference||row.id.slice(0,8)}</td>
      <td>{formatMoney(Number(row.amount))}</td><td>{row.reversed?'Estornado':'Registrado'}</td><td>{row.reversed?<span>{row.reason}</span>:
       <button className="secondary" disabled={locked} onClick={()=>{setSelected(row.id);setDate(row.date);setConfirmation('');setSaved(false)}}>Selecionar estorno {row.id.slice(0,8)}</button>}</td></tr>)}
    </tbody></table>
   </div>
   {selected&&<form aria-label="Confirmar estorno institucional" onSubmit={submit}>
    <fieldset disabled={locked}><legend>Confirmar estorno do movimento {selected.slice(0,8)}</legend>
     <div className="member-form-grid">
      <div><label htmlFor="inst-reversal-date">Data do estorno institucional</label><input id="inst-reversal-date" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div><label htmlFor="inst-reversal-reason">Justificativa do estorno institucional</label><input id="inst-reversal-reason" required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></div>
      <div><label htmlFor="inst-reversal-confirm">Digite ESTORNAR para o movimento institucional</label><input id="inst-reversal-confirm" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></div>
     </div>
     <button type="submit" disabled={confirmation!=='ESTORNAR'||reason.trim().length<3}>Confirmar estorno institucional</button>
    </fieldset>
   </form>}
  </>}
  <p className="subtle">Consulta limitada a 150 movimentos por tipo. O caixa considera os registros efetivos, incluindo estornos.</p>
 </section>
}
