import {useEffect,useRef,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {formatDate,formatMoney} from '../lib/finance-data'
import {
 loadMasterInvoicePage,loadMasterInvoiceBreakdown,loadMasterPaymentPage,
 previewMasterManualInvoice,issueMasterManualInvoice,buildManualInvoiceIdempotencyKey,
 loadMasterSaasFinancialSummary,loadMasterPaymentAllocations,loadMasterPaymentAgreements,loadMasterFiscalDocuments,
 registerMasterSaasPayment,allocateMasterSaasPayment,reverseMasterSaasPaymentAllocation,
 reverseMasterSaasPayment,voidMasterSaasInvoice,applyMasterSaasInvoiceAdjustment,
 recordMasterSaasPaymentAgreement,registerMasterSaasFiscalDocument,
 type MasterInvoice,type MasterInvoiceBreakdown,type MasterPayment,
 type MasterManualInvoicePreview,type MasterInvoiceFilters,type MasterInvoiceStatusFilter,
 type MasterSaasFinancialSummary,type MasterPaymentAllocation,type MasterPaymentAgreementStatus,
 type MasterFiscalDocument
} from '../lib/master-billing'
import {checkedSigned} from '../lib/treasury-balances'

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DETERMINISTIC_CODES=new Set(['22023','23503','23505','42501','28000','55000'])

function isUncertainRpcError(err:unknown):boolean{
 const code=(err as {code?:string}|null)?.code
 return !code||!DETERMINISTIC_CODES.has(code)
}

function errorMessage(err:unknown,fallback:string):string{
 if(err instanceof Error&&err.message)return err.message
 if(err&&typeof err==='object'&&'message' in err&&typeof (err as {message:unknown}).message==='string'){
  return (err as {message:string}).message
 }
 return fallback
}

type BillingMode='invoices'|'payments'|'agreements_fiscal'|'summary'
type InvoicePanelKind='adjust'|'void'|'agreement'|'fiscal'|null
type PaymentPanelKind='register'|'allocate'|'reverse'|null

export function MasterBilling({client,tenants,initialOrganizationId=''}:{client:SupabaseClient;tenants:Array<{organization_id:string;organization_name:string}>;initialOrganizationId?:string}){
 const [org,setOrg]=useState(()=>tenants.some(t=>t.organization_id===initialOrganizationId)?initialOrganizationId:'')
 const [mode,setMode]=useState<BillingMode>('invoices')
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [searchDraft,setSearchDraft]=useState('')
 const [statusDraft,setStatusDraft]=useState<MasterInvoiceStatusFilter>('all')
 const [competenceDraft,setCompetenceDraft]=useState('')
 const [invoiceFilters,setInvoiceFilters]=useState<MasterInvoiceFilters>({})
 const [rows,setRows]=useState<{invoices?:MasterInvoice[];payments?:MasterPayment[];hasNext:boolean}|null>(null)
 const [selected,setSelected]=useState<MasterInvoice|null>(null)
 const [breakdown,setBreakdown]=useState<MasterInvoiceBreakdown|null>(null)
 const [error,setError]=useState(''),[breakdownError,setBreakdownError]=useState('')

 // Extra M04 read views
 const [summary,setSummary]=useState<MasterSaasFinancialSummary|null>(null)
 const [summaryError,setSummaryError]=useState('')
 const [agreements,setAgreements]=useState<MasterPaymentAgreementStatus[]|null>(null)
 const [fiscalDocs,setFiscalDocs]=useState<MasterFiscalDocument[]|null>(null)
 const [extraError,setExtraError]=useState('')
 const [showAllocations,setShowAllocations]=useState(false)
 const [allocations,setAllocations]=useState<MasterPaymentAllocation[]|null>(null)
 const [allocationsError,setAllocationsError]=useState('')
 const [allocationsRevision,setAllocationsRevision]=useState(0)

 // Manual invoice emission states (preserved)
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

 // Invoice compensatory actions
 const [invoicePanel,setInvoicePanel]=useState<InvoicePanelKind>(null)
 const [adjType,setAdjType]=useState<'discount'|'credit'|'manual_adjustment'>('discount')
 const [adjAmount,setAdjAmount]=useState('')
 const [adjReason,setAdjReason]=useState('')
 const [voidReason,setVoidReason]=useState('')
 const [agrInstallmentsText,setAgrInstallmentsText]=useState('')
 const [agrTerms,setAgrTerms]=useState('')
 const [fiscalType,setFiscalType]=useState<'nfse'|'receipt'|'other'>('nfse')
 const [fiscalStatus,setFiscalStatus]=useState<'pending'|'issued'|'canceled'|'error'>('issued')
 const [fiscalNumber,setFiscalNumber]=useState('')
 const [fiscalRef,setFiscalRef]=useState('')
 const [fiscalIssuedAt,setFiscalIssuedAt]=useState('')

 // Payment operational actions
 const [paymentPanel,setPaymentPanel]=useState<PaymentPanelKind>(null)
 const [selectedPayment,setSelectedPayment]=useState<MasterPayment|null>(null)
 const [payDate,setPayDate]=useState(()=>new Date().toISOString().slice(0,10))
 const [payAmount,setPayAmount]=useState('')
 const [payMethod,setPayMethod]=useState<'pix'|'boleto'|'card'|'transfer'|'cash'|'other'>('pix')
 const [payRef,setPayRef]=useState('')
 const [payInvoiceId,setPayInvoiceId]=useState('')
 const [allocInvoiceId,setAllocInvoiceId]=useState('')
 const [allocAmount,setAllocAmount]=useState('')
 const [reversePaymentReason,setReversePaymentReason]=useState('')
 const [reversingAllocId,setReversingAllocId]=useState<string|null>(null)
 const [reverseAllocReason,setReverseAllocReason]=useState('')

 // Unified idempotent action state for M04 mutations
 const [opPending,setOpPending]=useState(false)
 const [opUncertain,setOpUncertain]=useState(false)
 const [opError,setOpError]=useState('')
 const [opSuccess,setOpSuccess]=useState('')
 const pendingOpRef=useRef<{label:string;key:string;run:(key:string)=>Promise<string>}|null>(null)
 const opGuardRef=useRef(false)

 const previewReqRef=useRef(0)
 const previewAbortRef=useRef<AbortController|null>(null)

 function clearOpState(){
  pendingOpRef.current=null
  setOpUncertain(false)
  setOpError('')
  setOpSuccess('')
 }

 function invalidatePreview(){
  previewReqRef.current++
  previewAbortRef.current?.abort()
  setPreview(null)
  setPreviewError('')
  setIssueError('')
  setIssueSuccess(null)
 }

 useEffect(()=>{
  if(org&&!tenants.some(t=>t.organization_id===org)){
   setOrg('')
   setRows(null)
   setSelected(null)
   setSummary(null)
   setAgreements(null)
   setFiscalDocs(null)
   setAllocations(null)
   invalidatePreview()
   clearOpState()
  }
 },[org,tenants])

 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setRows(null);setError('');setSelected(null);setBreakdown(null)
  setSummary(null);setSummaryError('');setAgreements(null);setFiscalDocs(null);setExtraError('')

  if(mode==='summary'){
   if(org&&!tenants.some(t=>t.organization_id===org))return()=>{live=false;controller.abort()}
   loadMasterSaasFinancialSummary(client,org||null)
    .then(data=>{if(live)setSummary(data)})
    .catch(err=>{if(live)setSummaryError(errorMessage(err,'Não foi possível consultar o resumo financeiro SaaS.'))})
   return()=>{live=false;controller.abort()}
  }

  if(!org||!tenants.some(t=>t.organization_id===org)){
   return()=>{live=false;controller.abort()}
  }

  if(mode==='agreements_fiscal'){
   Promise.all([
    loadMasterPaymentAgreements(client,org,controller.signal),
    loadMasterFiscalDocuments(client,org,controller.signal),
   ]).then(([agr,fisc])=>{
    if(live){setAgreements(agr);setFiscalDocs(fisc)}
   }).catch(err=>{
    if(live&&!controller.signal.aborted){
     setExtraError(errorMessage(err,'Não foi possível carregar acordos e documentos fiscais SaaS.'))
    }
   })
   return()=>{live=false;controller.abort()}
  }

  const load=mode==='invoices'
   ?loadMasterInvoicePage(client,org,page,controller.signal,invoiceFilters)
   :loadMasterPaymentPage(client,org,page,controller.signal)
  load.then(result=>{
   if(live)setRows(mode==='invoices'?
    {invoices:result.rows as MasterInvoice[],hasNext:result.hasNext}:
    {payments:result.rows as MasterPayment[],hasNext:result.hasNext})
  }).catch(()=>{if(live)setError('Não foi possível conferir o histórico de cobranças SaaS desta Loja.')})
  return()=>{live=false;controller.abort()}
 },[client,org,mode,page,revision,tenants,invoiceFilters])

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

 useEffect(()=>{
  if(mode!=='payments'||!showAllocations||!org||!tenants.some(t=>t.organization_id===org))return
  let live=true;const controller=new AbortController()
  setAllocations(null);setAllocationsError('')
  loadMasterPaymentAllocations(client,org,controller.signal)
   .then(list=>{if(live)setAllocations(list)})
   .catch(err=>{if(live&&!controller.signal.aborted)setAllocationsError(errorMessage(err,'Falha ao carregar alocações ativas.'))})
  return()=>{live=false;controller.abort()}
 },[client,org,mode,showAllocations,allocationsRevision,revision,tenants])

 function switchMode(next:BillingMode){
  setMode(next)
  setPage(0)
  setInvoicePanel(null)
  setPaymentPanel(null)
  setSelectedPayment(null)
  setReversingAllocId(null)
  clearOpState()
 }

 function applyInvoiceFilters(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  setPage(0)
  setInvoiceFilters({search:searchDraft.trim(),status:statusDraft,competence:competenceDraft})
 }

 function clearInvoiceFilters(){
  setSearchDraft('')
  setStatusDraft('all')
  setCompetenceDraft('')
  setPage(0)
  setInvoiceFilters({})
 }

 async function executeMasterOp(
  label:string,
  run:(key:string)=>Promise<string>,
  onDone?:()=>void
 ){
  if(opGuardRef.current)return
  if(!pendingOpRef.current||pendingOpRef.current.label!==label){
   pendingOpRef.current={label,key:crypto.randomUUID(),run}
  }
  const active=pendingOpRef.current
  opGuardRef.current=true
  setOpPending(true)
  setOpError('')
  setOpSuccess('')
  try{
   const id=await active.run(active.key)
   pendingOpRef.current=null
   setOpUncertain(false)
   setOpSuccess(`${label} confirmado (${id.slice(0,8)}).`)
   onDone?.()
   setRevision(v=>v+1)
   if(showAllocations)setAllocationsRevision(v=>v+1)
  }catch(err:unknown){
   if(isUncertainRpcError(err)){
    setOpUncertain(true)
    setOpError(`Resultado não confirmado para "${label}". Use Verificar envio para reenviar com a mesma chave idempotente.`)
   }else{
    pendingOpRef.current=null
    setOpUncertain(false)
    setOpError(errorMessage(err,`Não foi possível concluir "${label}".`))
   }
  }finally{
   opGuardRef.current=false
   setOpPending(false)
  }
 }

 async function handleRetryUncertain(){
  if(!pendingOpRef.current||opGuardRef.current)return
  const active=pendingOpRef.current
  await executeMasterOp(active.label,active.run)
 }

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
   const msg=err instanceof Error?err.message:'Falha ao emitir a fatura contratual.'
   setIssueError(msg)
  }finally{
   setIssueLoading(false)
  }
 }

 function parseInstallments(raw:string):Array<{due_date:string;amount:number}>{
  return raw
   .split(/\r?\n/)
   .map(line=>line.trim())
   .filter(Boolean)
   .map(line=>{
    const parts=line.split(/[;,=\s]+/).filter(Boolean)
    if(parts.length!==2)throw Error('Informe cada parcela no formato AAAA-MM-DD;VALOR (uma por linha).')
    const [due_date,amountRaw]=parts
    const amount=Number(amountRaw.replace(',','.'))
    if(!/^\d{4}-\d{2}-\d{2}$/.test(due_date)||!Number.isFinite(amount)||amount<=0){
     throw Error('Parcela inválida. Use AAAA-MM-DD;VALOR positivo.')
    }
    return {due_date,amount}
   })
 }

 function handleAdjustSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selected)return
  const rawNum=Number(adjAmount.replace(',','.'))
  if(!Number.isFinite(rawNum)||rawNum===0){
   setOpError('Informe um valor diferente de zero para o ajuste.')
   return
  }
  const signedAmount=(adjType==='discount'||adjType==='credit')?-Math.abs(rawNum):rawNum
  const targetInvoiceId=selected.id
  const targetOrg=org
  const targetType=adjType
  const targetReason=adjReason.trim()
  void executeMasterOp('Ajuste de fatura SaaS',key=>applyMasterSaasInvoiceAdjustment(client,{
   organization_id:targetOrg,
   invoice_id:targetInvoiceId,
   adjustment_type:targetType,
   signed_amount:signedAmount,
   reason:targetReason,
   idempotency_key:key
  }),()=>{
   setAdjAmount('')
   setAdjReason('')
   setInvoicePanel(null)
  })
 }

 function handleVoidSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selected)return
  const targetInvoiceId=selected.id
  const targetOrg=org
  const reason=voidReason.trim()
  void executeMasterOp('Anulação de fatura SaaS',key=>voidMasterSaasInvoice(client,{
   organization_id:targetOrg,
   invoice_id:targetInvoiceId,
   reason,
   idempotency_key:key
  }),()=>{
   setVoidReason('')
   setInvoicePanel(null)
  })
 }

 function handleAgreementSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selected)return
  let installments:Array<{due_date:string;amount:number}>
  try{
   installments=parseInstallments(agrInstallmentsText)
  }catch(err:unknown){
   setOpError(errorMessage(err,'Parcelas inválidas.'))
   return
  }
  if(!installments.length){
   setOpError('Informe ao menos uma parcela para o acordo.')
   return
  }
  const targetInvoiceId=selected.id
  const targetOrg=org
  const terms=agrTerms.trim()
  void executeMasterOp('Registro de acordo comercial SaaS',key=>recordMasterSaasPaymentAgreement(client,{
   organization_id:targetOrg,
   invoice_ids:[targetInvoiceId],
   installments,
   terms,
   idempotency_key:key
  }),()=>{
   setAgrInstallmentsText('')
   setAgrTerms('')
   setInvoicePanel(null)
  })
 }

 function handleFiscalSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selected)return
  const targetInvoiceId=selected.id
  const targetOrg=org
  const docType=fiscalType
  const docStatus=fiscalStatus
  const docNum=fiscalNumber.trim()
  const extRef=fiscalRef.trim()
  const issuedAt=fiscalIssuedAt.trim()?new Date(`${fiscalIssuedAt.trim()}T12:00:00Z`).toISOString():null
  void executeMasterOp('Registro de documento fiscal SaaS',key=>registerMasterSaasFiscalDocument(client,{
   organization_id:targetOrg,
   invoice_id:targetInvoiceId,
   document_type:docType,
   status:docStatus,
   document_number:docNum||undefined,
   external_reference:extRef||undefined,
   issued_at:issuedAt,
   idempotency_key:key
  }),()=>{
   setFiscalNumber('')
   setFiscalRef('')
   setFiscalIssuedAt('')
   setInvoicePanel(null)
  })
 }

 function handleRegisterPaymentSubmit(e:FormEvent){
  e.preventDefault()
  if(!org)return
  const numericAmount=Number(payAmount.replace(',','.'))
  if(!Number.isFinite(numericAmount)||numericAmount<=0){
   setOpError('Informe um valor positivo para o pagamento SaaS.')
   return
  }
  const cleanInvoice=payInvoiceId.trim()
  if(cleanInvoice&&!UUID_RE.test(cleanInvoice)){
   setOpError('UUID da fatura para alocação inicial inválido.')
   return
  }
  const targetOrg=org
  const paidAt=new Date(`${payDate}T12:00:00Z`).toISOString()
  const method=payMethod
  const reference=payRef.trim()
  const allocationsPayload=cleanInvoice?[{invoice_id:cleanInvoice,amount:numericAmount}]:[]
  void executeMasterOp('Registro de pagamento SaaS',key=>registerMasterSaasPayment(client,{
   organization_id:targetOrg,
   paid_at:paidAt,
   amount:numericAmount,
   payment_method:method,
   reference:reference||undefined,
   allocations:allocationsPayload,
   idempotency_key:key
  }),()=>{
   setPayAmount('')
   setPayRef('')
   setPayInvoiceId('')
   setPaymentPanel(null)
  })
 }

 function handleAllocatePaymentSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selectedPayment)return
  const numericAmount=Number(allocAmount.replace(',','.'))
  if(!Number.isFinite(numericAmount)||numericAmount<=0){
   setOpError('Informe um valor positivo para alocar.')
   return
  }
  const targetOrg=org
  const paymentId=selectedPayment.id
  const invoiceId=allocInvoiceId.trim()
  void executeMasterOp('Alocação de pagamento SaaS',key=>allocateMasterSaasPayment(client,{
   organization_id:targetOrg,
   payment_id:paymentId,
   invoice_id:invoiceId,
   amount:numericAmount,
   idempotency_key:key
  }),()=>{
   setAllocInvoiceId('')
   setAllocAmount('')
   setPaymentPanel(null)
   setSelectedPayment(null)
  })
 }

 function handleReversePaymentSubmit(e:FormEvent){
  e.preventDefault()
  if(!org||!selectedPayment)return
  const targetOrg=org
  const paymentId=selectedPayment.id
  const reason=reversePaymentReason.trim()
  void executeMasterOp('Reversão de pagamento SaaS',key=>reverseMasterSaasPayment(client,{
   organization_id:targetOrg,
   payment_id:paymentId,
   reason,
   idempotency_key:key
  }),()=>{
   setReversePaymentReason('')
   setPaymentPanel(null)
   setSelectedPayment(null)
  })
 }

 function handleReverseAllocationSubmit(e:FormEvent,allocationId:string){
  e.preventDefault()
  if(!org)return
  const targetOrg=org
  const reason=reverseAllocReason.trim()
  void executeMasterOp('Estorno de alocação SaaS',key=>reverseMasterSaasPaymentAllocation(client,{
   organization_id:targetOrg,
   allocation_id:allocationId,
   reason,
   idempotency_key:key
  }),()=>{
   setReversingAllocId(null)
   setReverseAllocReason('')
  })
 }

 return <section className="panel" aria-label="Cobrança SaaS Master">
  <div className="section-title">
   <h2>Cobrança SaaS — consulta</h2>
   <div className="finance-sections" style={{display:'inline-flex',gap:'0.5rem',margin:0,flexWrap:'wrap'}}>
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
  <p className="subtle">Faturas e pagamentos do serviço SaaS, totalmente segregados da tesouraria das Lojas. Valores e saldos derivam de documentos, ajustes compensatórios e alocações do banco.</p>

  <label htmlFor="master-billing-org">Loja cliente</label>
  <select
   id="master-billing-org"
   value={org}
   onChange={e=>{
    setOrg(e.target.value)
    setPage(0)
    clearInvoiceFilters()
    invalidatePreview()
    setInvoicePanel(null)
    setPaymentPanel(null)
    setSelectedPayment(null)
    setShowAllocations(false)
    clearOpState()
   }}
  >
   <option value="">Selecione a Loja</option>
   {tenants.map(t=><option key={t.organization_id} value={t.organization_id}>{t.organization_name}</option>)}
  </select>

  {opError&&<div role="alert" className="message error" style={{marginTop:'0.75rem',display:'flex',flexWrap:'wrap',gap:'0.5rem',alignItems:'center'}}>
   <span>{opError}</span>
   {opUncertain&&<button type="button" className="secondary" disabled={opPending} onClick={handleRetryUncertain}>Verificar envio</button>}
  </div>}
  {opSuccess&&<p role="status" className="message success" style={{marginTop:'0.75rem'}}>{opSuccess}</p>}

  {!!org&&mode==='invoices'&&
   <form aria-label="Filtros de faturas SaaS" onSubmit={applyInvoiceFilters} className="finance-filters" style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'flex-end',marginTop:'1rem'}}>
    <div style={{flex:'1 1 12rem',minWidth:0}}>
     <label htmlFor="master-billing-search">Número da fatura</label>
     <input id="master-billing-search" value={searchDraft} maxLength={80} placeholder="Buscar número da fatura" onChange={e=>setSearchDraft(e.target.value)}/>
    </div>
    <div style={{flex:'1 1 10rem',minWidth:0}}>
     <label htmlFor="master-billing-status">Status da fatura</label>
     <select id="master-billing-status" value={statusDraft} onChange={e=>setStatusDraft(e.target.value as MasterInvoiceStatusFilter)}>
      <option value="all">Todos</option>
      <option value="paid">Pago</option>
      <option value="partial">Parcial</option>
      <option value="overdue">Em atraso</option>
      <option value="open">Em aberto</option>
      <option value="void">Cancelado</option>
     </select>
    </div>
    <div style={{flex:'1 1 10rem',minWidth:0}}>
     <label htmlFor="master-billing-competence">Competência da fatura</label>
     <input id="master-billing-competence" type="month" value={competenceDraft} onChange={e=>setCompetenceDraft(e.target.value)}/>
    </div>
    <button type="submit" className="secondary">Aplicar filtros</button>
    <button type="button" className="secondary" onClick={clearInvoiceFilters}>Limpar filtros</button>
   </form>
  }

  {showManual&&<section className="panel" aria-label="Emissão manual de fatura SaaS" style={{marginTop:'1rem',borderLeft:'3px solid var(--color-primary, #0284c7)'}}>
   <h3>Emissão manual de fatura SaaS</h3>
   <p className="subtle">Gera faturas internas de assinatura calculadas estritamente a partir das cláusulas e termos de preço ativos no banco (vencimento padrão dia 10). Não aceita sobreposição arbitrária de valores digitados no navegador.</p>

   {!org?<p role="alert" className="message error">Selecione uma Loja cliente acima para prosseguir com a emissão.</p>:
   <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',gap:'1rem'}}>
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
     <div className="finance-table" role="region" aria-label="Pré-visualização contratual" tabIndex={0}>
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
     </div>

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
   <button className="secondary" aria-pressed={mode==='agreements_fiscal'} onClick={()=>switchMode('agreements_fiscal')}>Acordos e Fiscais</button>
   <button className="secondary" aria-pressed={mode==='summary'} onClick={()=>switchMode('summary')}>Resumo SaaS</button>
  </div>}

  {mode==='summary'&&<section className="panel" aria-label="Resumo financeiro SaaS" style={{marginTop:'1rem'}}>
   <h3>Resumo Financeiro SaaS {org?'(Loja selecionada)':'(Consolidado da Plataforma)'}</h3>
   <p className="subtle">Métricas exclusivas de faturamento SaaS. Receitas da plataforma nunca são somadas aos fundos internos das Lojas.</p>
   {summaryError&&<p role="alert" className="message error">{summaryError}</p>}
   {!summary&&!summaryError&&<p role="status">Consolidando indicadores SaaS…</p>}
   {summary&&<div className="metric-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',gap:'0.75rem',marginTop:'0.75rem'}}>
    <div className="panel metric"><p>Faturas ativas</p><strong style={{fontVariantNumeric:'tabular-nums'}}>{summary.active_invoices_count}</strong><span className="subtle">Total faturado: {formatMoney(checkedSigned(summary.total_billed))}</span></div>
    <div className="panel metric"><p>Recebido alocado</p><strong style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(summary.total_paid_allocated))}</strong><span className="subtle">Recebimentos ativos: {summary.active_payments_count}</span></div>
    <div className="panel metric"><p>Em aberto SaaS</p><strong style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(summary.total_open))}</strong><span className="subtle">Em atraso: {formatMoney(checkedSigned(summary.total_overdue))}</span></div>
    <div className="panel metric"><p>Crédito não alocado</p><strong style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(summary.total_unallocated_credit))}</strong><span className="subtle">Total recebido: {formatMoney(checkedSigned(summary.total_received))}</span></div>
    <div className="panel metric"><p>Faturas anuladas</p><strong style={{fontVariantNumeric:'tabular-nums'}}>{summary.voided_count}</strong><span className="subtle">Base anulada: {formatMoney(checkedSigned(summary.voided_amount))}</span></div>
   </div>}
  </section>}

  {!!org&&mode==='agreements_fiscal'&&<section className="panel" aria-label="Acordos e documentos fiscais SaaS" style={{marginTop:'1rem'}}>
   <h3>Acordos comerciais e Documentos fiscais externos</h3>
   <p className="subtle">Acordos com tratamento explícito de encargos (0% de multa/juros automáticos) e registro manual de NFS-e / recibos externos.</p>
   {extraError&&<p role="alert" className="message error">{extraError}</p>}
   {(!agreements||!fiscalDocs)&&!extraError&&<p role="status">Consultando acordos e documentos fiscais…</p>}
   {agreements&&<div style={{marginTop:'0.75rem'}}>
    <h4>Acordos comerciais SaaS</h4>
    {!agreements.length?<p className="subtle">Nenhum acordo registrado para esta Loja.</p>:
     <div className="finance-table" role="region" aria-label="Acordos comerciais SaaS" tabIndex={0}>
      <table><thead><tr><th>Acordo</th><th>Data</th><th>Aberto original</th><th>Negociado</th><th>Parcelas</th><th>Encargos</th><th>Situação</th></tr></thead>
       <tbody>{agreements.map(a=><tr key={a.id}>
        <th scope="row">{a.agreement_number}</th>
        <td>{formatDate(a.agreement_date)}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(a.original_open_amount))}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(a.negotiated_amount))}</td>
        <td>{a.installment_count}x</td>
        <td>{a.charges_treatment}</td>
        <td>{a.derived_status}</td>
       </tr>)}</tbody>
      </table>
     </div>}
   </div>}
   {fiscalDocs&&<div style={{marginTop:'1rem'}}>
    <h4>Documentos fiscais externos vinculados</h4>
    {!fiscalDocs.length?<p className="subtle">Nenhum documento fiscal externo registrado.</p>:
     <div className="finance-table" role="region" aria-label="Documentos fiscais SaaS" tabIndex={0}>
      <table><thead><tr><th>Tipo</th><th>Status</th><th>Número</th><th>Referência externa</th><th>Emissão</th></tr></thead>
       <tbody>{fiscalDocs.map(doc=><tr key={doc.id}>
        <th scope="row">{doc.document_type.toUpperCase()}</th>
        <td>{doc.status}</td>
        <td>{doc.document_number||'—'}</td>
        <td>{doc.external_reference||'—'}</td>
        <td>{doc.issued_at?formatDate(doc.issued_at):formatDate(doc.created_at)}</td>
       </tr>)}</tbody>
      </table>
     </div>}
   </div>}
  </section>}

  {error&&mode!=='summary'&&mode!=='agreements_fiscal'&&<p role="alert" className="message error">{error}</p>}
  {!!org&&(mode==='invoices'||mode==='payments')&&!rows&&!error&&<p role="status">Consultando documentos SaaS…</p>}
  {rows&&(mode==='invoices'||mode==='payments')&&<>
   {mode==='invoices'&&(!rows.invoices?.length?<p>Nenhuma fatura corresponde aos filtros selecionados nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Faturas SaaS" tabIndex={0}>
     <table><thead><tr><th>Documento</th><th>Competência</th><th>Vencimento</th><th>Total atualizado</th><th>Pago</th><th>Em aberto</th><th>Status</th><th>Detalhamento</th></tr></thead>
      <tbody>{rows.invoices?.map(i=><tr key={i.id}>
       <th scope="row">{i.invoice_number}</th><td>{i.competence.slice(0,7)}</td>
       <td>{formatDate(i.due_date)}</td><td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(i.amount_due))}</td>
       <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(i.amount_paid))}</td>
       <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(i.amount_open))}</td><td>{i.derived_status}</td>
       <td><button type="button" className="secondary" onClick={()=>{setSelected(i);setInvoicePanel(null)}}>Ver composição</button></td>
      </tr>)}</tbody>
     </table>
    </div>)}
   {mode==='payments'&&<div style={{marginTop:'0.75rem'}}>
    <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem',marginBottom:'0.75rem'}}>
     <button type="button" className="primary" onClick={()=>{setPaymentPanel(v=>v==='register'?null:'register');setSelectedPayment(null);clearOpState()}}>
      {paymentPanel==='register'?'Fechar registro de pagamento':'+ Registrar pagamento SaaS'}
     </button>
     <button type="button" className="secondary" onClick={()=>setShowAllocations(v=>!v)}>
      {showAllocations?'Ocultar alocações ativas':'Gerenciar alocações ativas'}
     </button>
    </div>

    {paymentPanel==='register'&&<form aria-label="Registrar pagamento SaaS" onSubmit={handleRegisterPaymentSubmit} className="panel" style={{marginBottom:'1rem'}}>
     <h4>Novo recebimento comercial SaaS</h4>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',gap:'0.75rem'}}>
      <div><label htmlFor="saas-pay-date">Data do recebimento</label><input id="saas-pay-date" type="date" required value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
      <div><label htmlFor="saas-pay-amount">Valor recebido (R$)</label><input id="saas-pay-amount" type="number" step="0.01" min="0.01" required value={payAmount} onChange={e=>setPayAmount(e.target.value)}/></div>
      <div><label htmlFor="saas-pay-method">Meio de pagamento</label>
       <select id="saas-pay-method" value={payMethod} onChange={e=>setPayMethod(e.target.value as typeof payMethod)}>
        <option value="pix">PIX</option><option value="boleto">Boleto</option><option value="transfer">Transferência</option>
        <option value="card">Cartão</option><option value="cash">Espécie</option><option value="other">Outro</option>
       </select>
      </div>
      <div><label htmlFor="saas-pay-ref">Referência / comprovante</label><input id="saas-pay-ref" type="text" maxLength={120} value={payRef} onChange={e=>setPayRef(e.target.value)}/></div>
      <div><label htmlFor="saas-pay-invoice">UUID da fatura p/ alocar (opcional)</label><input id="saas-pay-invoice" type="text" placeholder="Opcional" value={payInvoiceId} onChange={e=>setPayInvoiceId(e.target.value)}/></div>
     </div>
     <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem'}}>
      <button type="submit" className="primary" disabled={opPending||opUncertain}>{opPending?'Registrando…':'Confirmar recebimento SaaS'}</button>
     </div>
    </form>}

    {(!rows.payments?.length?<p>Nenhum pagamento SaaS nesta página.</p>:
     <div className="finance-table" role="region" aria-label="Pagamentos comerciais SaaS" tabIndex={0}>
      <table><thead><tr><th>Pagamento</th><th>Data</th><th>Recebido</th><th>Alocado</th><th>Crédito não alocado</th><th>Situação</th><th>Ações</th></tr></thead>
       <tbody>{rows.payments?.map(p=><tr key={p.id}>
        <th scope="row">{p.id.slice(0,8)}</th><td>{new Date(p.paid_at).toLocaleDateString('pt-BR')}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(p.amount))}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(p.allocated_amount))}</td>
        <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(p.unallocated_amount))}</td>
        <td>{p.active?'Ativo':'Revertido'}</td>
        <td>
         {p.active&&<div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
          {checkedSigned(p.unallocated_amount)>0&&<button type="button" className="secondary" onClick={()=>{setSelectedPayment(p);setPaymentPanel('allocate');setAllocAmount(String(checkedSigned(p.unallocated_amount)));clearOpState()}}>Alocar em fatura</button>}
          <button type="button" className="secondary" onClick={()=>{setSelectedPayment(p);setPaymentPanel('reverse');clearOpState()}}>Reverter pagamento</button>
         </div>}
        </td>
       </tr>)}</tbody>
      </table>
     </div>)}

    {selectedPayment&&paymentPanel==='allocate'&&<form aria-label="Alocar pagamento em fatura SaaS" onSubmit={handleAllocatePaymentSubmit} className="panel" style={{marginTop:'0.75rem'}}>
     <h4>Alocar crédito do pagamento {selectedPayment.id.slice(0,8)}</h4>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',gap:'0.75rem'}}>
      <div><label htmlFor="saas-alloc-invoice">UUID da fatura destino</label><input id="saas-alloc-invoice" type="text" required value={allocInvoiceId} onChange={e=>setAllocInvoiceId(e.target.value)}/></div>
      <div><label htmlFor="saas-alloc-amount">Valor a alocar (R$)</label><input id="saas-alloc-amount" type="number" step="0.01" min="0.01" required value={allocAmount} onChange={e=>setAllocAmount(e.target.value)}/></div>
     </div>
     <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem'}}>
      <button type="submit" className="primary" disabled={opPending||opUncertain}>Confirmar alocação</button>
      <button type="button" className="secondary" onClick={()=>{setPaymentPanel(null);setSelectedPayment(null)}}>Cancelar</button>
     </div>
    </form>}

    {selectedPayment&&paymentPanel==='reverse'&&<form aria-label="Reverter pagamento SaaS" onSubmit={handleReversePaymentSubmit} className="panel" style={{marginTop:'0.75rem'}}>
     <h4>Reverter pagamento {selectedPayment.id.slice(0,8)}</h4>
     <label htmlFor="saas-rev-pay-reason">Motivo da reversão compensatória</label>
     <input id="saas-rev-pay-reason" type="text" required minLength={3} value={reversePaymentReason} onChange={e=>setReversePaymentReason(e.target.value)}/>
     <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem'}}>
      <button type="submit" className="primary" disabled={opPending||opUncertain||reversePaymentReason.trim().length<3}>Confirmar reversão</button>
      <button type="button" className="secondary" onClick={()=>{setPaymentPanel(null);setSelectedPayment(null)}}>Cancelar</button>
     </div>
    </form>}

    {showAllocations&&<section className="panel" aria-label="Alocações ativas de pagamentos SaaS" style={{marginTop:'1rem'}}>
     <h4>Alocações ativas (estorno compensatório)</h4>
     {allocationsError&&<p role="alert" className="message error">{allocationsError}</p>}
     {!allocations&&!allocationsError&&<p role="status">Carregando alocações ativas…</p>}
     {allocations&&(!allocations.length?<p className="subtle">Nenhuma alocação ativa para estorno.</p>:
      <div className="finance-table" role="region" aria-label="Tabela de alocações ativas" tabIndex={0}>
       <table><thead><tr><th>Alocação</th><th>Pagamento</th><th>Fatura</th><th>Valor</th><th>Data</th><th>Ação</th></tr></thead>
        <tbody>{allocations.map(al=><tr key={al.id}>
         <th scope="row">{al.id.slice(0,8)}</th><td>{al.payment_id.slice(0,8)}</td><td>{al.invoice_id.slice(0,8)}</td>
         <td style={{fontVariantNumeric:'tabular-nums'}}>{formatMoney(checkedSigned(al.amount))}</td>
         <td>{new Date(al.created_at).toLocaleDateString('pt-BR')}</td>
         <td><button type="button" className="secondary" onClick={()=>{setReversingAllocId(al.id);setReverseAllocReason('');clearOpState()}}>Estornar alocação</button></td>
        </tr>)}</tbody>
       </table>
      </div>)}
     {reversingAllocId&&<form aria-label="Confirmar estorno de alocação" onSubmit={e=>handleReverseAllocationSubmit(e,reversingAllocId)} style={{marginTop:'0.75rem'}}>
      <label htmlFor="saas-rev-alloc-reason">Motivo do estorno da alocação {reversingAllocId.slice(0,8)}</label>
      <input id="saas-rev-alloc-reason" type="text" required minLength={3} value={reverseAllocReason} onChange={e=>setReverseAllocReason(e.target.value)}/>
      <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem'}}>
       <button type="submit" className="primary" disabled={opPending||opUncertain||reverseAllocReason.trim().length<3}>Confirmar estorno</button>
       <button type="button" className="secondary" onClick={()=>setReversingAllocId(null)}>Cancelar</button>
      </div>
     </form>}
    </section>}
   </div>}
   <div className="finance-pagination">
    <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
    <span role="status">Página {page+1}</span>
    <button className="secondary" disabled={!rows.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
   </div>
   {selected&&mode==='invoices'&&<section className="panel" aria-label="Composição da fatura">
    <div className="section-title">
     <h3>Composição — {selected.invoice_number}</h3>
     <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
      <button type="button" className="secondary" onClick={()=>{setInvoicePanel(v=>v==='adjust'?null:'adjust');clearOpState()}}>Ajustar / Desconto</button>
      <button type="button" className="secondary" onClick={()=>{setInvoicePanel(v=>v==='void'?null:'void');clearOpState()}}>Anular fatura</button>
      <button type="button" className="secondary" onClick={()=>{setInvoicePanel(v=>v==='agreement'?null:'agreement');clearOpState()}}>Registrar acordo</button>
      <button type="button" className="secondary" onClick={()=>{setInvoicePanel(v=>v==='fiscal'?null:'fiscal');clearOpState()}}>Vincular doc. fiscal</button>
     </div>
    </div>
    {breakdownError&&<p role="alert" className="message error">{breakdownError}</p>}
    {!breakdown&&!breakdownError&&<p role="status">Conciliando composição do documento…</p>}
    {breakdown&&<div className="finance-table" role="region" aria-label="Composição da fatura" tabIndex={0}><table><tbody>
     <tr><th>Base contratual</th><td>{formatMoney(checkedSigned(breakdown.base_amount))}</td></tr>
     <tr><th>Multa</th><td>{formatMoney(checkedSigned(breakdown.late_fee_amount))}</td></tr>
     <tr><th>Juros</th><td>{formatMoney(checkedSigned(breakdown.interest_amount))}</td></tr>
     <tr><th>Descontos e créditos</th><td>{formatMoney(checkedSigned(breakdown.discount_credit_amount))}</td></tr>
     <tr><th>Outros ajustes</th><td>{formatMoney(checkedSigned(breakdown.other_increase_amount))}</td></tr>
     <tr><th>Total atualizado</th><td>{formatMoney(checkedSigned(breakdown.updated_total))}</td></tr>
    </tbody></table></div>}

    {invoicePanel==='adjust'&&<form aria-label="Ajustar fatura SaaS" onSubmit={handleAdjustSubmit} style={{marginTop:'0.75rem'}}>
     <h4>Ajuste compensatório / desconto</h4>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',gap:'0.75rem'}}>
      <div><label htmlFor="saas-adj-type">Tipo de ajuste</label>
       <select id="saas-adj-type" value={adjType} onChange={e=>setAdjType(e.target.value as typeof adjType)}>
        <option value="discount">Desconto (-)</option><option value="credit">Crédito (-)</option><option value="manual_adjustment">Ajuste manual (+/-)</option>
       </select>
      </div>
      <div><label htmlFor="saas-adj-amount">Valor (R$)</label><input id="saas-adj-amount" type="number" step="0.01" required value={adjAmount} onChange={e=>setAdjAmount(e.target.value)}/></div>
      <div><label htmlFor="saas-adj-reason">Justificativa</label><input id="saas-adj-reason" type="text" required minLength={3} value={adjReason} onChange={e=>setAdjReason(e.target.value)}/></div>
     </div>
     <div style={{marginTop:'0.5rem'}}><button type="submit" className="primary" disabled={opPending||opUncertain||adjReason.trim().length<3}>Confirmar ajuste</button></div>
    </form>}

    {invoicePanel==='void'&&<form aria-label="Anular fatura SaaS" onSubmit={handleVoidSubmit} style={{marginTop:'0.75rem'}}>
     <h4>Anular fatura (somente sem alocações ativas)</h4>
     <label htmlFor="saas-void-reason">Motivo da anulação</label>
     <input id="saas-void-reason" type="text" required minLength={3} value={voidReason} onChange={e=>setVoidReason(e.target.value)}/>
     <div style={{marginTop:'0.5rem'}}><button type="submit" className="primary" disabled={opPending||opUncertain||voidReason.trim().length<3}>Confirmar anulação</button></div>
    </form>}

    {invoicePanel==='agreement'&&<form aria-label="Registrar acordo SaaS" onSubmit={handleAgreementSubmit} style={{marginTop:'0.75rem'}}>
     <h4>Registrar acordo comercial (0% juros/multa automáticos)</h4>
     <label htmlFor="saas-agr-inst">Parcelas (AAAA-MM-DD;VALOR por linha)</label>
     <textarea id="saas-agr-inst" rows={3} placeholder="2026-11-20;100.00" required value={agrInstallmentsText} onChange={e=>setAgrInstallmentsText(e.target.value)}/>
     <label htmlFor="saas-agr-terms">Termos e justificativa do acordo</label>
     <input id="saas-agr-terms" type="text" required minLength={3} value={agrTerms} onChange={e=>setAgrTerms(e.target.value)}/>
     <div style={{marginTop:'0.5rem'}}><button type="submit" className="primary" disabled={opPending||opUncertain||agrTerms.trim().length<3}>Confirmar acordo</button></div>
    </form>}

    {invoicePanel==='fiscal'&&<form aria-label="Vincular documento fiscal externo" onSubmit={handleFiscalSubmit} style={{marginTop:'0.75rem'}}>
     <h4>Vincular documento fiscal emitido externamente</h4>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',gap:'0.75rem'}}>
      <div><label htmlFor="saas-fisc-type">Tipo</label>
       <select id="saas-fisc-type" value={fiscalType} onChange={e=>setFiscalType(e.target.value as typeof fiscalType)}>
        <option value="nfse">NFS-e</option><option value="receipt">Recibo</option><option value="other">Outro</option>
       </select>
      </div>
      <div><label htmlFor="saas-fisc-status">Status</label>
       <select id="saas-fisc-status" value={fiscalStatus} onChange={e=>setFiscalStatus(e.target.value as typeof fiscalStatus)}>
        <option value="issued">Emitido</option><option value="pending">Pendente</option><option value="canceled">Cancelado</option><option value="error">Erro</option>
       </select>
      </div>
      <div><label htmlFor="saas-fisc-num">Número do documento</label><input id="saas-fisc-num" type="text" value={fiscalNumber} onChange={e=>setFiscalNumber(e.target.value)}/></div>
      <div><label htmlFor="saas-fisc-ref">Referência externa</label><input id="saas-fisc-ref" type="text" value={fiscalRef} onChange={e=>setFiscalRef(e.target.value)}/></div>
      <div><label htmlFor="saas-fisc-date">Data emissão (opcional)</label><input id="saas-fisc-date" type="date" value={fiscalIssuedAt} onChange={e=>setFiscalIssuedAt(e.target.value)}/></div>
     </div>
     <div style={{marginTop:'0.5rem'}}><button type="submit" className="primary" disabled={opPending||opUncertain}>Registrar documento fiscal</button></div>
    </form>}
   </section>}
  </>}
  <p className="subtle">Paginação de 25 documentos. Recebimentos, alocações, estornos compensatórios, acordos e vínculos fiscais utilizam RPCs idempotentes auditadas para Master AAL2.</p>
 </section>
}
