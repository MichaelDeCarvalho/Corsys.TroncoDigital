import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterBilling} from './MasterBilling'
import {
 loadMasterInvoiceBreakdown,
 loadMasterInvoicePage,
 loadMasterPaymentPage,
 previewMasterManualInvoice,
 issueMasterManualInvoice,
 buildManualInvoiceIdempotencyKey
} from '../lib/master-billing'

const org='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const invoice='559ba052-c408-4418-b806-0c0c4b8e3603'
const subscription='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'

const inv={
 id:invoice,organization_id:org,subscription_id:subscription,invoice_number:'DEV-0001',
 competence:'2026-10-01',due_date:'2026-10-10',
 original_amount:'100.00',adjustment_amount:'10.00',amount_due:'110.00',
 amount_paid:'60.00',amount_open:'50.00',derived_status:'partial',integrity_ok:true,
}
const breakdown={
 organization_id:org,invoice_id:invoice,invoice_number:'DEV-0001',base_amount:'100.00',
 late_fee_amount:'5.00',interest_amount:'8.00',discount_credit_amount:'-3.00',
 other_increase_amount:'0.00',net_adjustments:'10.00',updated_total:'110.00',
}
const payment={
 id:'faaf76e4-d796-430f-929f-71df5beaf832',organization_id:org,
 paid_at:'2026-10-09T12:00:00Z',amount:'70.00',allocated_amount:'60.00',
 unallocated_amount:'10.00',active:true,
}

const mockPreviewData = {
 organization_id: org,
 organization_name: 'Loja DEV',
 subscription_id: subscription,
 plan_id: '44577f80-0a25-45d4-8395-5cb95ad78901',
 plan_name: 'Plano V35 Enterprise',
 competence: '2026-11-01',
 service_period_start: '2026-11-01',
 service_period_end: '2026-11-30',
 due_date: '2026-11-10',
 unit_price: 250.00,
 currency: 'BRL',
 line_items: [
  {
   item_type: 'subscription',
   description: 'Assinatura SaaS — Plano Plano V35 Enterprise (11/2026)',
   quantity: 1,
   unit_amount: 250.00,
   line_amount: 250.00
  }
 ],
 total_amount: 250.00,
 already_billed: false,
 existing_invoice_id: null,
 existing_invoice_number: null
}

function fixture(opts:{foreign?:boolean;integrity?:boolean;badBreakdown?:boolean;previewData?:unknown;rpcError?:boolean}={}){
 const rows:Record<string,unknown[]>={
  v_saas_invoice_balances:[{...inv,organization_id:opts.foreign?'other':org,
   integrity_ok:opts.integrity===false?false:true}],
  v_saas_invoice_charge_breakdown:[{...breakdown,updated_total:opts.badBreakdown?'115.00':'110.00'}],
  v_saas_payment_balances:[payment],
 }
 const from=vi.fn((name:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:rows[name],error:null})}
  return chain
 })
 const rpc=vi.fn((fnName:string)=>{
  if(opts.rpcError){
   const p=Promise.resolve({data:null,error:new Error('RPC failed')})
   return Object.assign(p,{abortSignal:()=>p})
  }
  if(fnName==='preview_saas_manual_invoice'){
   const p=Promise.resolve({data:opts.previewData||mockPreviewData,error:null})
   return Object.assign(p,{abortSignal:()=>p})
  }
  if(fnName==='issue_saas_manual_invoice'){
   const p=Promise.resolve({data:'c37bf872-97ec-4475-ba10-6395b285dd0a',error:null})
   return Object.assign(p,{abortSignal:()=>p})
  }
  const p=Promise.resolve({data:null,error:null})
  return Object.assign(p,{abortSignal:()=>p})
 })
 return {client:{from,rpc} as unknown as SupabaseClient,from,rpc}
}

const tenants=[{organization_id:org,organization_name:'Loja DEV'}]
async function choose(){
 await screen.findByLabelText('Loja cliente')
 fireEvent.change(screen.getByLabelText('Loja cliente'),{target:{value:org}})
}

describe('Master billing read model',()=>{
 it('renders commercial invoices and reconciles base, interest, fees, adjustments',async()=>{
  const {client,from}=fixture()
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()
  await screen.findByText('DEV-0001')
  expect(screen.getByText(/R\$\s?50,00/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Ver composição'}))
  await screen.findByText('Composição — DEV-0001')
  expect(screen.getAllByText(/R\$\s?110,00/).length).toBeGreaterThan(0)
  expect(from).toHaveBeenCalledWith('v_saas_invoice_balances')
  expect(from).toHaveBeenCalledWith('v_saas_invoice_charge_breakdown')
 })
 it('shows SaaS payments separately from Lodge funds and available credits',async()=>{
  const {client,from}=fixture()
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()
  fireEvent.click(screen.getByRole('button',{name:'Pagamentos SaaS'}))
  await screen.findByText(/R\$\s?10,00/)
  expect(from).toHaveBeenCalledWith('v_saas_payment_balances')
 })
 it('fails closed when a different tenant or inconsistent invoice is returned',async()=>{
  const bad=fixture({foreign:true})
  await expect(loadMasterInvoicePage(bad.client,org,0,new AbortController().signal)).rejects.toThrow()
  const err=fixture({integrity:false})
  await expect(loadMasterInvoicePage(err.client,org,0,new AbortController().signal)).rejects.toThrow()
 })
 it('rejects a charge breakdown that disagrees with invoice totals',async()=>{
  const f=fixture({badBreakdown:true})
  await expect(loadMasterInvoiceBreakdown(f.client,org,inv,new AbortController().signal)).rejects.toThrow()
 })
 it('rejects mismatched SaaS payment allocations',async()=>{
  const f=fixture()
  const v=f.client.from('v_saas_payment_balances')
  expect(v).toBeDefined()
  await expect(loadMasterPaymentPage(f.client,org,900,new AbortController().signal)).rejects.toThrow()
 })
})

describe('Master manual SaaS invoice issuance',()=>{
 it('opens the manual issuance panel and queries contractual preview without client-side prices',async()=>{
  const {client,rpc}=fixture()
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()

  // Toggle manual invoice section
  const emitBtn=screen.getByRole('button',{name:'Emitir fatura manual'})
  fireEvent.click(emitBtn)

  expect(screen.getByRole('heading',{name:'Emissão manual de fatura SaaS'})).toBeInTheDocument()

  // Change competence
  const monthInput=screen.getByLabelText(/Competência/)
  fireEvent.change(monthInput,{target:{value:'2026-11'}})

  // Click preview
  const previewBtn=screen.getByRole('button',{name:'Consultar contrato e prévia'})
  fireEvent.click(previewBtn)

  // Verify preview is rendered from server contract
  await screen.findByText('Pré-visualização contratual — Loja DEV')
  expect(screen.getByText('Plano V35 Enterprise')).toBeInTheDocument()
  expect(screen.getAllByText(/R\$\s?250,00/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Assinatura SaaS — Plano Plano V35 Enterprise/)).toBeInTheDocument()

  expect(rpc).toHaveBeenCalledWith('preview_saas_manual_invoice',{
   p_organization_id:org,
   p_competence:'2026-11-01',
   p_due_date:null
  })
 })

 it('issues manual invoice with idempotency key and updates invoice list',async()=>{
  const {client,rpc}=fixture()
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()

  fireEvent.click(screen.getByRole('button',{name:'Emitir fatura manual'}))
  fireEvent.change(screen.getByLabelText(/Competência/),{target:{value:'2026-11'}})
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))

  await screen.findByText('Pré-visualização contratual — Loja DEV')

  // Click confirm and issue
  const confirmBtn=screen.getByRole('button',{name:'Confirmar e emitir fatura'})
  fireEvent.click(confirmBtn)

  await screen.findByText(/Fatura emitida com sucesso!/)
  expect(rpc).toHaveBeenCalledWith('issue_saas_manual_invoice',expect.objectContaining({
   p_organization_id:org,
   p_competence:'2026-11-01',
   p_due_date:'2026-11-10'
  }))
 })

 it('blocks issuance when competence is already billed',async()=>{
  const alreadyBilledData={
   ...mockPreviewData,
   already_billed:true,
   existing_invoice_number:'CORSYS-202611-00001',
   existing_amount:250.00
  }
  const {client}=fixture({previewData:alreadyBilledData})
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()

  fireEvent.click(screen.getByRole('button',{name:'Emitir fatura manual'}))
  fireEvent.change(screen.getByLabelText(/Competência/),{target:{value:'2026-11'}})
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))

  await screen.findByText(/Esta competência já possui uma fatura ativa emitida/)
  expect(screen.queryByRole('button',{name:'Confirmar e emitir fatura'})).not.toBeInTheDocument()
 })

 it('handles preview error and rejects invalid client inputs',async()=>{
  const {client}=fixture({rpcError:true})
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()

  fireEvent.click(screen.getByRole('button',{name:'Emitir fatura manual'}))
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))

  await screen.findByText('RPC failed')
 })

 it('unit tests: previewMasterManualInvoice, issueMasterManualInvoice, and buildManualInvoiceIdempotencyKey',async()=>{
  const key=buildManualInvoiceIdempotencyKey(org,'2026-11-01')
  expect(key).toMatch(/^master-inv-a752dda8-2026-11-[a-z0-9]+$/)

  expect(()=>buildManualInvoiceIdempotencyKey('bad-uuid','2026-11-01')).toThrow()
  expect(()=>buildManualInvoiceIdempotencyKey(org,'invalid-date')).toThrow()

  const {client}=fixture()
  const p=await previewMasterManualInvoice(client,org,'2026-11-01')
  expect(p.unit_price).toBe(250)

  await expect(previewMasterManualInvoice(client,org,'2026-11-15')).rejects.toThrow('Competence must be first day of month')

  const invId=await issueMasterManualInvoice(client,{
   organization_id:org,
   competence:'2026-11-01',
   due_date:'2026-11-10',
   idempotency_key:key
  })
  expect(invId).toBe('c37bf872-97ec-4475-ba10-6395b285dd0a')

  await expect(issueMasterManualInvoice(client,{
   organization_id:org,
   competence:'2026-11-15',
   due_date:'2026-11-10',
   idempotency_key:key
  })).rejects.toThrow()
 })

 it('invalidates preview when changing competence, due date, description or Loja',async()=>{
  const {client}=fixture()
  render(<MasterBilling client={client} tenants={tenants}/>)
  await choose()

  fireEvent.click(screen.getByRole('button',{name:'Emitir fatura manual'}))
  fireEvent.change(screen.getByLabelText(/Competência/),{target:{value:'2026-11'}})
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))

  await screen.findByText('Pré-visualização contratual — Loja DEV')
  expect(screen.getByRole('button',{name:'Confirmar e emitir fatura'})).toBeInTheDocument()

  // Changing competence must immediately invalidate preview and hide confirm button
  fireEvent.change(screen.getByLabelText(/Competência/),{target:{value:'2026-12'}})
  expect(screen.queryByText('Pré-visualização contratual — Loja DEV')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Confirmar e emitir fatura'})).not.toBeInTheDocument()

  // Preview again
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))
  await screen.findByText('Pré-visualização contratual — Loja DEV')

  // Changing due date must also invalidate
  fireEvent.change(screen.getByLabelText(/Vencimento/),{target:{value:'2026-12-20'}})
  expect(screen.queryByText('Pré-visualização contratual — Loja DEV')).not.toBeInTheDocument()

  // Preview again
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))
  await screen.findByText('Pré-visualização contratual — Loja DEV')

  // Changing description must also invalidate
  fireEvent.change(screen.getByLabelText(/Observação da fatura/),{target:{value:'Nova obs'}})
  expect(screen.queryByText('Pré-visualização contratual — Loja DEV')).not.toBeInTheDocument()
 })

 it('preserves idempotency key on network failure so retries use the identical key',async()=>{
  let attemptCount=0
  let capturedKey1=''
  let capturedKey2=''

  const rpc=vi.fn((fnName:string,args?:Record<string,unknown>)=>{
   if(fnName==='preview_saas_manual_invoice'){
    const p=Promise.resolve({data:mockPreviewData,error:null})
    return Object.assign(p,{abortSignal:()=>p})
   }
   if(fnName==='issue_saas_manual_invoice'){
    attemptCount++
    if(attemptCount===1){
     capturedKey1=String(args?.p_idempotency_key||'')
     const p=Promise.resolve({data:null,error:new Error('Falha de rede temporária')})
     return Object.assign(p,{abortSignal:()=>p})
    }else{
     capturedKey2=String(args?.p_idempotency_key||'')
     const p=Promise.resolve({data:'c37bf872-97ec-4475-ba10-6395b285dd0a',error:null})
     return Object.assign(p,{abortSignal:()=>p})
    }
   }
   const p=Promise.resolve({data:null,error:null})
   return Object.assign(p,{abortSignal:()=>p})
  })

  const from=vi.fn(()=>{
   const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:()=>chain,limit:()=>chain,
    abortSignal:()=>Promise.resolve({data:[],error:null})}
   return chain
  })

  render(<MasterBilling client={{from,rpc} as unknown as SupabaseClient} tenants={tenants}/>)
  await choose()

  fireEvent.click(screen.getByRole('button',{name:'Emitir fatura manual'}))
  fireEvent.change(screen.getByLabelText(/Competência/),{target:{value:'2026-11'}})
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))
  await screen.findByText('Pré-visualização contratual — Loja DEV')

  // First attempt: fails
  fireEvent.click(screen.getByRole('button',{name:'Confirmar e emitir fatura'}))
  await screen.findByText('Falha de rede temporária')

  // Retry attempt: preview remains, button still available, click again
  fireEvent.click(screen.getByRole('button',{name:'Confirmar e emitir fatura'}))
  await screen.findByText(/Fatura emitida com sucesso!/)

  // Both calls must have used the EXACT same idempotency key
  expect(capturedKey1).toBeTruthy()
  expect(capturedKey2).toBe(capturedKey1)
 })
})
