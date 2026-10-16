import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {parseBankStatement,type StatementPreview} from '../lib/bank-statement'
import {loadBankImports,loadBankDetail,type BankImport} from '../lib/bank-reconciliation'
import {loadTreasuryAccounts,checkedSigned} from '../lib/treasury-balances'
import {formatMoney} from '../lib/finance-data'
type Command={name:string;args:Record<string,unknown>}
export function BankReconciliation({client,organizationId}:{client:SupabaseClient;organizationId:string}){
 const [imports,setImports]=useState<BankImport[]|null>(null)
 const [accounts,setAccounts]=useState<Awaited<ReturnType<typeof loadTreasuryAccounts>>>([])
 const [selected,setSelected]=useState(''),[account,setAccount]=useState('')
 const [detail,setDetail]=useState<Awaited<ReturnType<typeof loadBankDetail>>|null>(null)
 const [preview,setPreview]=useState<(StatementPreview&{name:string;hash:string})|null>(null)
 const [reason,setReason]=useState(''),[confirmation,setConfirmation]=useState('')
 const [error,setError]=useState(''),[message,setMessage]=useState('')
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[revision,setRevision]=useState(0)
 const [line,setLine]=useState(''),[target,setTarget]=useState(''),[amount,setAmount]=useState('')
 const pending=useRef<Command|null>(null),guard=useRef(false),live=useRef(true),fileRevision=useRef(0)
 useEffect(()=>{live.current=true;return()=>{live.current=false;fileRevision.current++}},[])
 useEffect(()=>{
  let active=true;const controller=new AbortController();setImports(null);setDetail(null)
  Promise.all([loadBankImports(client,organizationId,controller.signal),loadTreasuryAccounts(client,organizationId,controller.signal)])
   .then(([i,a])=>{if(active){setImports(i);setAccounts(a)}}).catch(()=>{if(active)setError('Não foi possível validar os extratos e as contas desta Loja.')})
  return()=>{active=false;controller.abort()}
 },[client,organizationId,revision])
 const statement=imports?.find(x=>x.id===selected)
 useEffect(()=>{
  let active=true;const controller=new AbortController();setDetail(null);setLine('');setTarget('')
  if(statement)loadBankDetail(client,organizationId,statement,controller.signal).then(d=>{if(active)setDetail(d)})
   .catch(()=>{if(active)setError('Consulta incompleta ou inconsistente. Nenhuma conciliação foi autorizada.')})
  return()=>{active=false;controller.abort()}
 },[client,organizationId,statement,revision])
 async function run(command:Command){
  if(guard.current)return;guard.current=true;setBusy(true);setError('');setMessage('');pending.current=command
  try{
   const r=await client.rpc(command.name,command.args)
   if(r.error)throw r.error
   if(typeof r.data!=='string'||!/^[a-f0-9-]{36}$/i.test(r.data))throw Error('Unconfirmed response')
   if(!live.current)return
   if(command.name==='stage_tenant_bank_statement'){setSelected(r.data);setPreview(null)}
   pending.current=null;setUncertain(false);setConfirmation('');setMessage('Operação confirmada. Histórico atualizado.');setRevision(x=>x+1)
  }catch(e){
   if(!live.current)return
   const code=(e as {code?:string}).code
   if(code){pending.current=null;setUncertain(false);setError(code==='23505'?'Arquivo ou vínculo já registrado. Atualize para consultar o histórico.':code==='42501'?'Seu perfil ou assinatura não permite esta operação.':'Operação rejeitada pelo banco. Confira conta, valor, estado do extrato e permissões.');setRevision(x=>x+1)}
   else{setUncertain(true);setError('Resultado não confirmado. Repita a mesma operação para consultar ou concluir com a mesma chave.')}
  }finally{guard.current=false;if(live.current)setBusy(false)}
 }
 function command(name:string,args:Record<string,unknown>){
  if(busy||uncertain||reason.trim().length<3||reason.trim().length>500){setError('Informe um motivo entre 3 e 500 caracteres.');return}
  void run({name,args:{p_organization_id:organizationId,...args,p_reason:reason.trim(),p_idempotency_key:crypto.randomUUID()}})
 }
 async function fileChanged(file:File|undefined){
  const n=++fileRevision.current;setPreview(null);setError('')
  if(!file)return
  try{
   if(file.size>1_000_000||file.name.length>200)throw Error('Arquivo excede 1 MB ou nome muito longo.')
   const bytes=await file.arrayBuffer();const parsed=parseBankStatement(new TextDecoder('utf-8',{fatal:true}).decode(bytes),file.name)
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
   if(live.current&&n===fileRevision.current)setPreview({...parsed,name:file.name,hash})
  }catch(e){if(live.current&&n===fileRevision.current)setError((e as Error).message)}
 }
 const locked=busy||uncertain
 const candidates=detail?.movements.filter(x=>['member_payment','institutional_receipt','institutional_payable_payment','account_transfer_in','account_transfer_out'].includes(x.movement_type))??[]
 const chosen=detail?.lines.find(x=>x.statement_line_id===line)
 return <section className="panel bank-reconciliation">
  <div className="section-title"><h2>Conciliação bancária</h2><button className="secondary" disabled={locked} onClick={()=>{setError('');setRevision(x=>x+1)}}>Atualizar conciliação</button></div>
  <p className="subtle">Compare sistema × extrato. Importar e conciliar não registra pagamentos nem altera saldos. Até 500 linhas por arquivo e por consulta de movimentos.</p>
  {error&&<p role="alert" className="message error">{error}</p>}{message&&<p role="status">{message}</p>}
  {uncertain&&<button disabled={busy} onClick={()=>pending.current&&void run(pending.current)}>Repetir mesma operação</button>}
  <label>Motivo da conciliação<input value={reason} disabled={locked} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
  <fieldset disabled={locked||!imports}><legend>Importar OFX/CSV</legend>
   <label>Conta do extrato<select value={account} onChange={e=>setAccount(e.target.value)}><option value="">Selecione</option>{accounts.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <p className="subtle">OFX em BRL, sem entidades XML. CSV UTF-8: data;descricao;valor;id. Data AAAA-MM-DD, valor com ponto decimal e sinal negativo para saída; id opcional.</p>
   <label>Arquivo de extrato<input type="file" accept=".ofx,.csv" onChange={e=>void fileChanged(e.target.files?.[0])}/></label>
   {preview&&<><p>Prévia local: {preview.name} · {preview.lines.length} linhas · {preview.start} a {preview.end}. Nenhum dado enviado até confirmar.</p>
    <div className="finance-table" role="region" aria-label="Prévia do extrato" tabIndex={0}><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{preview.lines.map((l,i)=><tr key={i}><td>{l.date}</td><td>{l.description}</td><td>{formatMoney(Number(l.amount))}</td></tr>)}</tbody></table></div>
    <button disabled={!account} onClick={()=>command('stage_tenant_bank_statement',{p_account_id:account,p_file_name:preview.name,p_file_sha256:preview.hash,p_lines:preview.lines})}>Confirmar importação em revisão</button></>}
  </fieldset>
  <label>Extrato para revisar<select disabled={locked||!imports} value={selected} onChange={e=>{setSelected(e.target.value);setConfirmation('')}}><option value="">Selecione</option>{imports?.map(i=><option value={i.id} key={i.id}>{i.file_name} — {i.status}</option>)}</select></label>
  {statement&&!detail&&<p role="status">Consultando extrato…</p>}
  {statement&&detail&&<>
   <p>{statement.period_start} a {statement.period_end} · {statement.status}</p>
   <div className="metric-grid"><article className="panel metric"><h3>Variação no sistema</h3><strong>{formatMoney(detail.movements.reduce((s,m)=>s+checkedSigned(m.signed_amount),0))}</strong></article><article className="panel metric"><h3>Variação no extrato</h3><strong>{formatMoney(detail.lines.reduce((s,l)=>s+checkedSigned(l.amount),0))}</strong></article></div>
   <p className="subtle">Variações no período completo do arquivo; não representam saldo final bancário. Divergências precisam de revisão.</p>
   <div className="finance-table" role="region" aria-label="Linhas do extrato" tabIndex={0}><table><thead><tr><th>Data</th><th>Descrição do extrato</th><th>Valor</th><th>Conciliado</th><th>Status</th></tr></thead><tbody>{detail.lines.map(l=><tr key={l.statement_line_id}><td>{l.transaction_date}</td><td>{l.description}</td><td>{formatMoney(checkedSigned(l.amount))}</td><td>{formatMoney(checkedSigned(l.matched_amount))}</td><td>{l.reconciliation_status==='reconciled'?'Conciliado':l.reconciliation_status==='partial'?'Parcial':'A conferir'}</td></tr>)}</tbody></table></div>
   {statement.status==='staged'?<><label>Digite VALIDAR<input value={confirmation} disabled={locked} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={locked||confirmation!=='VALIDAR'} onClick={()=>command('validate_tenant_bank_statement',{p_import_id:statement.id})}>Validar extrato revisado</button></>:statement.status!=='canceled'&&<fieldset disabled={locked}><legend>Correspondência manual</legend>
    <label>Linha do extrato<select value={line} onChange={e=>setLine(e.target.value)}><option value="">Selecione</option>{detail.lines.map(l=><option key={l.statement_line_id} value={l.statement_line_id}>{l.transaction_date} — {l.description} — {formatMoney(checkedSigned(l.amount))}</option>)}</select></label>
    <label>Movimento do sistema<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecione</option>{candidates.filter(m=>!chosen||Math.sign(checkedSigned(m.signed_amount))===Math.sign(checkedSigned(chosen.amount))).map(m=><option key={m.movement_type+':'+m.source_id} value={m.movement_type+':'+m.source_id}>{m.movement_date} — {m.movement_type} — {formatMoney(checkedSigned(m.signed_amount))} — {m.source_id}</option>)}</select></label>
    <label>Valor para conciliar (R$)<input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></label>
    <label>Digite CONCILIAR<input value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    <button disabled={!line||!target||confirmation!=='CONCILIAR'||!/^\d{1,12}(\.\d{1,2})?$/.test(amount)||Number(amount)<=0} onClick={()=>{const [kind,id]=target.split(':');command('match_tenant_bank_statement',{p_line_id:line,p_kind:kind.startsWith('account_transfer')?'account_transfer':kind,p_target_id:id,p_amount:amount})}}>Confirmar correspondência</button>
   </fieldset>}
   {detail.matches.length>0&&<fieldset disabled={locked}><legend>Desfazer correspondência</legend><p>Preserva o vínculo original e registra o motivo. Não estorna o movimento financeiro.</p><label>Digite DESFAZER<input value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>{detail.matches.map(m=><p key={m.id}>{m.id} · {formatMoney(checkedSigned(m.matched_amount))} <button disabled={confirmation!=='DESFAZER'} onClick={()=>command('reverse_tenant_bank_match',{p_match_id:m.id})}>Desfazer vínculo {m.id}</button></p>)}</fieldset>}
  </>}
 </section>
}
