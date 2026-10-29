import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {
 loadMasterInvoicePage,loadMasterInvoiceBreakdown,loadMasterPaymentPage,
 previewMasterManualInvoice,issueMasterManualInvoice,buildManualInvoiceIdempotencyKey,
 type MasterInvoice,type MasterInvoiceBreakdown,type MasterPayment,
 type MasterManualInvoicePreview
} from '../lib/master-billing'
import {checkedSigned} from '../lib/treasury-balances'

export function MasterBilling({client,tenants}:{client:SupabaseClient;tenants:Array<{organization_id:string;organization_name:string}>}){
 const [org,setOrg]=useState(''),[mode,setMode]=useState<'invoices'|'payments'>('invoices')
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [rows,setRows]=useState<{invoices?:MasterInvoice[];payments?:MasterPayment[];hasNext:boolean}|null>(null)
 const [selected,setSelected]=useState<MasterInvoice|null>(null)
 const [breakdown,setBreakdown]=useState<MasterInvoiceBreakdown|null>(null)
 const [error,setError]=useState(''),[breakdownError,setBreakdownError]=useState('')

 // Manual invoice emission states
 const [showManual,setShowManual]=useState(false)
 const [manualMonth,setManualMonth]=useState(()=>{
  const d=new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
 })
 const [manualDueDate,setManualDueDate]=useState('')
 const [manualDesc,setManualDesc]=useState('')
 const [preview,setPreview]=useState<MasterManualInvoicePreview|null>(null)
 const [previewLoading,setPreviewLoading]=useState(false)
 const [previewError,setPreviewError]=useState('')
 const [issueLoading,setIssueLoading]=useState(false)
 const [issueError,setIssueError]=useState('')
 const [issueSuccess,setIssueSuccess]=useState<{id:string}|null>(null)
 const [idempKey,setIdempKey]=useState('')

 const previewReqRef=useRef(0)
 const previewAbortRef=useRef<AbortController|null>(null)

 function invalidatePreview(){
  previewReqRef.current++
  previewAbortRef.current?.abort()
  setPreviewLoading(false)
  setPreview(null)
  setPreviewError('')
  setIssueError('')
  setIssueSuccess(null)
 }

 useEffect(()=>{
  if(!tenants.some(t=>t.organization_id===org)){
   setOrg('')
   setRows(null)
   setSelected(null)
   invalidatePreview()
  }
 },[org,tenants])

 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setRows(null);setError('');setSelected(null);setBreakdown(null)
  if(org&&tenants.some(t=>t.organization_id===org)){
   const load=mode==='invoices'?loadMasterInvoicePage:loadMasterPaymentPage
   load(client,org,page,controller.signal).then(result=>{
    if(live)setRows(mode==='invoices'?
     {invoices:result.rows as MasterInvoice[],hasNext:result.hasNext}:
     {payments:result.rows as MasterPayment[],hasNext:result.hasNext})
   }).catch(()=>{if(live)setError('Não foi possível conferir o histórico de cobranças SaaS desta Loja.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,org,mode,page,revision,tenants])

 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setBreakdown(null);setBreakdownError('')
  if(selected&&org&&tenants.some(t=>t.organization_id===org)){
   loadMasterInvoiceBreakdown(client,org,selected,controller.signal)
    .then(v=>{if(live)setBreakdown(v)})
    .catch(()=>{if(live)setBreakdownError('O detalhamento da fatura não pôde ser conciliado com seu saldo.')})
  }
  return()=>{live=false;controller.abort()}
 },[client,selected,org,tenants])

 function switchMode(next:'invoices'|'payments'){setMode(next);setPage(0)}

 async function handlePreview(){
  if(!org)return
  if(!/^\d{4}-\d{2}$/.test(manualMonth)){
   setPreviewError('Selecione uma competência válida (AAAA-MM).')
   return
  }

  const reqId=++previewReqRef.current
  previewAbortRef.current?.abort()
  const controller=new AbortController()
  previewAbortRef.current=controller

  const competence=`${manualMonth}-01`
  const targetOrg=org
  const targetMonth=manualMonth
  const targetDue=manualDueDate

  setPreviewLoading(true)
  setPreview(null)
  setPreviewError('')
  setIssueError('')
  setIssueSuccess(null)

  try{
   const res=await previewMasterManualInvoice(client,targetOrg,competence,targetDue||undefined,controller.signal)
   if(previewReqRef.current===reqId&&org===targetOrg&&manualMonth===targetMonth){
    setPreview(res)
    if(!targetDue){
     setManualDueDate(res.due_date)
    }
    setIdempKey(buildManualInvoiceIdempotencyKey(targetOrg,competence))
   }
  }catch(err:unknown){
   if(previewReqRef.current===reqId){
    const msg=err instanceof Error?err.message:'Não foi possível obter a prévia da fatura.'
    setPreviewError(msg)
    setPreview(null)
   }
  }finally{
   if(previewReqRef.current===reqId){
    setPreviewLoading(false)
   }
  }
 }

 async function handleIssue(){
  if(!preview||!org||issueLoading)return
  setIssueLoading(true)
  setIssueError('')
  try{
   const invId=await issueMasterManualInvoice(client,{
    organization_id:org,
    competence:preview.competence,
    due_date:manualDueDate||preview.due_date,
    description:manualDesc,
    idempotency_key:idempKey
   })
   setIssueSuccess({id:invId})
   setPreview(null)
   setRevision(v=>v+1)
   setPage(0)
  }catch(err:unknown){
   // Preserve idempKey across uncertain or network failures for safe retry
   const msg=err instanceof Error?err.message:'Falha ao emitir a fatura contratual.'
   setIssueError(msg)
  }finally{
   setIssueLoading(false)
  }
 }

 return <section className="panel" aria-label="Cobrança SaaS Master">
  <div className="section-title">
   <h2>Cobrança SaaS — consulta</h2>
   <div className="finance-sections" style={{display:'inline-flex',gap:'0.5rem',margin:0}}>
    <button type="button" className="secondary" onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar cobrança</button>
    <button
     type="button"
     className="secondary"
     aria-expanded={showManual}
     onClick={()=>{
      setShowManual(v=>!v)
      invalidatePreview()
     }}
    >
     {showManual?'Fechar emissão manual':'Emitir fatura manual'}
    </button>
   </div>
  </div>
  <p className="subtle">Faturas e pagamentos do serviço SaaS, separados da tesouraria das Lojas. Valores derivam de documentos, ajustes e alocações efetivas do banco, sem registrar pagamentos nesta tela.</p>

  <label htmlFor="master-billing-org">Loja cliente</label>
  <select
   id="master-billing-org"
   value={org}
   onChange={e=>{
    setOrg(e.target.value)
    setPage(0)
    invalidatePreview()
   }}
  >
   <option value="">Selecione a Loja</option>
   {tenants.map(t=><option key={t.organization_id} value={t.organization_id}>{t.organization_name}</option>)}
  </select>

  {showManual&&<section className="panel" aria-label="Emissão manual de fatura SaaS" style={{marginTop:'1rem',borderLeft:'3px solid var(--color-primary, #0284c7)'}}>
   <h3>Emissão manual de fatura SaaS</h3>
   <p className="subtle">Gera faturas internas de assinatura calculadas estritamente a partir das cláusulas e termos de preço ativos no banco. Não aceita sobreposição arbitrária de valores digitados no navegador.</p>

   {!org?<p role="alert" className="message error">Selecione uma Loja cliente acima para prosseguir com a emissão.</p>:
   <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'1rem'}}>
     <div>
      <label htmlFor="manual-invoice-month">Competência (mês/ano)</label>
      <input
       id="manual-invoice-month"
       type="month"
       value={manualMonth}
       onChange={e=>{
        setManualMonth(e.target.value)
        invalidatePreview()
       }}
      />
     </div>
     <div>
      <label htmlFor="manual-invoice-due">Vencimento (opcional/automático)</label>
      <input
       id="manual-invoice-due"
       type="date"
       value={manualDueDate}
       onChange={e=>{
        setManualDueDate(e.target.value)
        invalidatePreview()
       }}
      />
     </div>
    </div>
    <div>
     <label htmlFor="manual-invoice-desc">Observação da fatura (opcional)</label>
     <input
      id="manual-invoice-desc"
      type="text"
      placeholder="Ex.: Mensalidade regular SaaS"
      value={manualDesc}
      onChange={e=>{
       setManualDesc(e.target.value)
       invalidatePreview()
      }}
     />
    </div>

    <div>
     <button
      type="button"
      className="secondary"
      disabled={previewLoading||!manualMonth}
      onClick={handlePreview}
     >
      {previewLoading?'Consultando contrato…':'Consultar contrato e prévia'}
     </button>
    </div>

    {previewError&&<p role="alert" className="message error">{previewError}</p>}
    {issueError&&<p role="alert" className="message error">{issueError}</p>}
    {issueSuccess&&<p role="status" className="message success">Fatura emitida com sucesso! Identificador: {issueSuccess.id}. A lista abaixo foi atualizada.</p>}

    {preview&&<div className="panel" aria-label="Prévia da fatura contratual" style={{marginTop:'0.5rem',backgroundColor:'var(--bg-subtle, rgba(0,0,0,0.02))'}}>
     <h4>Pré-visualização contratual — {preview.organization_name}</h4>
     <table>
      <tbody>
       <tr><th>Plano contratado</th><td>{preview.plan_name}</td></tr>
       <tr><th>Competência</th><td>{preview.competence.slice(0,7)}</td></tr>
       <tr><th>Período do serviço</th><td>{formatDate(preview.service_period_start)} a {formatDate(preview.service_period_end)}</td></tr>
       <tr><th>Vencimento determinado</th><td>{formatDate(preview.due_date)}</td></tr>
       <tr><th>Preço contratual (banco)</th><td><strong>{formatMoney(preview.unit_price)}</strong></td></tr>
       <tr><th>Valor total da fatura</th><td><strong>{formatMoney(preview.total_amount)}</strong></td></tr>
      </tbody>
     </table>

     <div style={{marginTop:'0.5rem'}}>
      <h5>Discriminação de itens</h5>
      <ul>
       {preview.line_items.map((it,idx)=>(
        <li key={idx}>
         {it.description} — {it.quantity} un. x {formatMoney(it.unit_amount)} = <strong>{formatMoney(it.line_amount)}</strong>
        </li>
       ))}
      </ul>
     </div>

     {preview.already_billed?<div style={{marginTop:'0.5rem'}}>
      <p role="alert" className="message error">
       Esta competência já possui uma fatura ativa emitida ({preview.existing_invoice_number||preview.existing_invoice_id?.slice(0,8)} no valor de {formatMoney(preview.existing_amount||preview.unit_price)}). A emissão de nova fatura para o mesmo mês está bloqueada para impedir duplicidades.
      </p>
     </div>:
     <div style={{marginTop:'1rem'}}>
      <button
       type="button"
       disabled={issueLoading}
       onClick={handleIssue}
      >
       {issueLoading?'Emitindo fatura de forma idempotente…':'Confirmar e emitir fatura'}
      </button>
     </div>}
    </div>}
   </div>}
  </section>}

  {!!org&&<div className="finance-sections" role="group" aria-label="Cobrança Master">
   <button className="secondary" aria-pressed={mode==='invoices'} onClick={()=>switchMode('invoices')}>Faturas</button>
   <button className="secondary" aria-pressed={mode==='payments'} onClick={()=>switchMode('payments')}>Pagamentos SaaS</button>
  </div>}

  {error&&<p role="alert" className="message error">{error}</p>}
  {!!org&&!rows&&!error&&<p role="status">Consultando documentos SaaS…</p>}
  {rows&&<>
   {mode==='invoices'&&(!rows.invoices?.length?<p>Nenhuma fatura nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Faturas SaaS" tabIndex={0}>
     <table><thead><tr><th>Documento</th><th>Competência</th><th>Vencimento</th><th>Total atualizado</th><th>Pago</th><th>Em aberto</th><th>Status</th><th>Detalhamento</th></tr></thead>
      <tbody>{rows.invoices?.map(i=><tr key={i.id}>
       <th scope="row">{i.invoice_number}</th><td>{i.competence.slice(0,7)}</td>
       <td>{formatDate(i.due_date)}</td><td>{formatMoney(checkedSigned(i.amount_due))}</td>
       <td>{formatMoney(checkedSigned(i.amount_paid))}</td>
       <td>{formatMoney(checkedSigned(i.amount_open))}</td><td>{i.derived_status}</td>
       <td><button type="button" className="secondary" onClick={()=>setSelected(i)}>Ver composição</button></td>
      </tr>)}</tbody>
     </table>
    </div>)}
   {mode==='payments'&&(!rows.payments?.length?<p>Nenhum pagamento SaaS nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Pagamentos comerciais SaaS" tabIndex={0}>
     <table><thead><tr><th>Pagamento</th><th>Data</th><th>Recebido</th><th>Alocado</th><th>Crédito não alocado</th><th>Situação</th></tr></thead>
      <tbody>{rows.payments?.map(p=><tr key={p.id}>
       <th scope="row">{p.id.slice(0,8)}</th><td>{new Date(p.paid_at).toLocaleDateString('pt-BR')}</td>
       <td>{formatMoney(checkedSigned(p.amount))}</td>
       <td>{formatMoney(checkedSigned(p.allocated_amount))}</td>
       <td>{formatMoney(checkedSigned(p.unallocated_amount))}</td>
       <td>{p.active?'Ativo':'Revertido'}</td>
      </tr>)}</tbody>
     </table>
    </div>)}
   <div className="finance-pagination">
    <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
    <span role="status">Página {page+1}</span>
    <button className="secondary" disabled={!rows.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
   </div>
   {selected&&mode==='invoices'&&<section className="panel" aria-label="Composição da fatura">
    <h3>Composição — {selected.invoice_number}</h3>
    {breakdownError&&<p role="alert" className="message error">{breakdownError}</p>}
    {!breakdown&&!breakdownError&&<p role="status">Conciliando composição do documento…</p>}
    {breakdown&&<table><tbody>
     <tr><th>Base contratual</th><td>{formatMoney(checkedSigned(breakdown.base_amount))}</td></tr>
     <tr><th>Multa</th><td>{formatMoney(checkedSigned(breakdown.late_fee_amount))}</td></tr>
     <tr><th>Juros</th><td>{formatMoney(checkedSigned(breakdown.interest_amount))}</td></tr>
     <tr><th>Descontos e créditos</th><td>{formatMoney(checkedSigned(breakdown.discount_credit_amount))}</td></tr>
     <tr><th>Outros ajustes</th><td>{formatMoney(checkedSigned(breakdown.other_increase_amount))}</td></tr>
     <tr><th>Total atualizado</th><td>{formatMoney(checkedSigned(breakdown.updated_total))}</td></tr>
    </tbody></table>}
   </section>}
  </>}
  <p className="subtle">Paginação de 25 documentos. Emissão, recebimentos, reversões, acordos e notificações comerciais ainda exigem fluxos de autorização e auditoria próprios.</p>
 </section>
}
