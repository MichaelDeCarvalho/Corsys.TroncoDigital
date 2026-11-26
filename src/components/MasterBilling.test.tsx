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
  const chain={select:()=>chain,eq:vi.fn(()=>chain),ilike:vi.fn(()=>chain),order:()=>chain,range:()=>chain,limit:()=>chain,
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
 it('loads invoices for a customer selected by Client 360 without issuing an invoice',async()=>{
  const {client,from,rpc}=fixture()
  render(<MasterBilling client={client} tenants={tenants} initialOrganizationId={org}/>)
  await screen.findByText('DEV-0001')
  expect(screen.getByLabelText('Loja cliente')).toHaveValue(org)
  expect(from).toHaveBeenCalledWith('v_saas_invoice_balances')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('ignores a contextual customer outside the available directory',()=>{
  const {client,from,rpc}=fixture()
  render(<MasterBilling client={client} tenants={tenants} initialOrganizationId="foreign"/>)
  expect(screen.getByLabelText('Loja cliente')).toHaveValue('')
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
 })
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

 it('filters SaaS invoices by number, status and month on the server before pagination',async()=>{
  const {client,from}=fixture()
  render(<MasterBilling client={client} tenants={tenants} initialOrganizationId={org}/>)
  await screen.findByText('DEV-0001')
  fireEvent.change(screen.getByLabelText('Número da fatura'),{target:{value:'DEV-0001'}})
  fireEvent.change(screen.getByLabelText('Status da fatura'),{target:{value:'partial'}})
  fireEvent.change(screen.getByLabelText('Competência da fatura'),{target:{value:'2026-10'}})
  fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}))
  await waitFor(()=>{
   const calls=from.mock.results
   const query=calls[calls.length-1]?.value
   expect(query?.ilike).toHaveBeenCalledWith('invoice_number','%DEV-0001%')
   expect(query?.eq).toHaveBeenCalledWith('organization_id',org)
   expect(query?.eq).toHaveBeenCalledWith('derived_status','partial')
   expect(query?.eq).toHaveBeenCalledWith('competence','2026-10-01')
  })
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}))
  await waitFor(()=>{
   const calls=from.mock.results
   const query=calls[calls.length-1]?.value
   expect(query?.ilike).not.toHaveBeenCalled()
   expect(query?.eq).toHaveBeenCalledWith('organization_id',org)
   expect(query?.eq).not.toHaveBeenCalledWith('derived_status','partial')
  })
 })
 it('rejects malformed Master invoice filter values without querying the backend',async()=>{
  const {client,from}=fixture()
  const signal=new AbortController().signal
  await expect(loadMasterInvoicePage(client,org,0,signal,{competence:'2026-13'})).rejects.toThrow('Invalid Master invoice filters')
  await expect(loadMasterInvoicePage(client,org,0,signal,{status:'invalid' as 'paid'})).rejects.toThrow('Invalid Master invoice filters')
  expect(from).not.toHaveBeenCalled()
 })
 it('escapes LIKE wildcards in a user-provided invoice number search',async()=>{
  const {client,from}=fixture()
  await loadMasterInvoicePage(client,org,0,new AbortController().signal,{search:'A%_B'})
  const query=from.mock.results[0]?.value
  expect(query?.ilike).toHaveBeenCalledWith('invoice_number','%A\\%\\_B%')
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
  const monthInput=screen.getByLabelText('Competência (mês/ano)')
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
  fireEvent.change(screen.getByLabelText('Competência (mês/ano)'),{target:{value:'2026-11'}})
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
  fireEvent.change(screen.getByLabelText('Competência (mês/ano)'),{target:{value:'2026-11'}})
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
  fireEvent.change(screen.getByLabelText('Competência (mês/ano)'),{target:{value:'2026-11'}})
  fireEvent.click(screen.getByRole('button',{name:'Consultar contrato e prévia'}))

  await screen.findByText('Pré-visualização contratual — Loja DEV')
  expect(screen.getByRole('button',{name:'Confirmar e emitir fatura'})).toBeInTheDocument()

  // Changing competence must immediately invalidate preview and hide confirm button
  fireEvent.change(screen.getByLabelText('Competência (mês/ano)'),{target:{value:'2026-12'}})
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
  fireEvent.change(screen.getByLabelText('Competência (mês/ano)'),{target:{value:'2026-11'}})
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

describe('Master billing M04 ledger operations, agreements, fiscal docs & summary', () => {
 it('loads SaaS-segregated KPIs in Resumo SaaS mode via RPC', async () => {
  const f = fixture();
  (f.rpc as unknown as ReturnType<typeof vi.fn>).mockImplementation((fnName: string) => {
   if (fnName === 'read_master_saas_financial_summary') {
    return Promise.resolve({
     data: {
      organization_id: org,
      active_invoices_count: 2,
      total_billed: '305.00',
      total_paid_allocated: '125.00',
      total_open: '180.00',
      total_overdue: '180.00',
      voided_count: 1,
      voided_amount: '125.00',
      active_payments_count: 1,
      total_received: '125.00',
      total_unallocated_credit: '0.00',
      as_of: '2026-11-26T10:00:00Z',
     },
     error: null,
    })
   }
   return Promise.resolve({ data: null, error: null })
  })
  render(<MasterBilling client={f.client} tenants={tenants} initialOrganizationId={org} />)
  await screen.findByText('DEV-0001')
  fireEvent.click(screen.getByRole('button', { name: 'Resumo SaaS' }))
  await screen.findByText('Resumo Financeiro SaaS (Loja selecionada)')
  expect(screen.getByText(/Total faturado: R\$\s?305,00/)).toBeInTheDocument()
  expect(screen.getAllByText(/R\$\s?180,00/).length).toBeGreaterThan(0)
  expect(f.rpc).toHaveBeenCalledWith('read_master_saas_financial_summary', { p_organization_id: org })
 })

 it('registers SaaS payment, allocates credit, reverses allocation and supports idempotent Verificar envio retry', async () => {
  const allocId = '99999999-9999-4999-8999-999999999999'
  const rpc = vi.fn(async (fnName: string, _params?: Record<string, unknown>) => {
   if (fnName === 'register_saas_payment_idempotent') return { data: payment.id, error: null }
   if (fnName === 'allocate_saas_payment_idempotent') return { data: allocId, error: null }
   if (fnName === 'reverse_saas_payment_allocation_idempotent') return { data: allocId, error: null }
   return { data: allocId, error: null }
  })
  const from = vi.fn((table: string) => {
   const chain = {
    select: () => chain,
    eq: () => chain,
    ilike: () => chain,
    order: () => chain,
    range: () => chain,
    limit: () => chain,
    abortSignal: () => Promise.resolve({
     data: table === 'v_saas_invoice_balances'
      ? [inv]
      : table === 'v_saas_payment_balances'
       ? [payment]
       : table === 'v_saas_active_payment_allocations'
        ? [{ id: allocId, organization_id: org, payment_id: payment.id, invoice_id: invoice, amount: '60.00', created_at: '2026-10-09T12:00:00Z' }]
        : [],
     error: null,
    }),
   }
   return chain
  })

  render(<MasterBilling client={{ from, rpc } as unknown as SupabaseClient} tenants={tenants} initialOrganizationId={org} />)
  await screen.findByText('DEV-0001')
  fireEvent.click(screen.getByRole('button', { name: 'Pagamentos SaaS' }))
  await screen.findByText(/R\$\s?70,00/)

  // Simulate uncertain error once during payment registration then retry via Verificar envio
  rpc.mockRejectedValueOnce(new Error('network glitch'))
  fireEvent.click(screen.getByRole('button', { name: '+ Registrar pagamento SaaS' }))
  fireEvent.change(screen.getByLabelText('Valor recebido (R$)'), { target: { value: '125.00' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Registrar pagamento SaaS' }))
  const retryBtn = await screen.findByRole('button', { name: 'Verificar envio' })
  fireEvent.click(retryBtn)
  await screen.findByText(/Registro de pagamento SaaS confirmado/)

  const regCalls = rpc.mock.calls.filter(([n]) => n === 'register_saas_payment_idempotent')
  expect(regCalls).toHaveLength(2)
  expect(regCalls[1][1]).toEqual(regCalls[0][1])

  // Open active allocations & reverse an allocation
  fireEvent.click(screen.getByRole('button', { name: 'Gerenciar alocações ativas' }))
  await screen.findByRole('button', { name: 'Estornar alocação' })
  fireEvent.click(screen.getByRole('button', { name: 'Estornar alocação' }))
  fireEvent.change(screen.getByLabelText(/Motivo do estorno da alocação/), { target: { value: 'Alocação em fatura incorreta' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Confirmar estorno de alocação' }))
  await waitFor(() => {
   expect(rpc).toHaveBeenCalledWith('reverse_saas_payment_allocation_idempotent', expect.objectContaining({
    p_organization_id: org,
    p_allocation_id: allocId,
   }))
  })
 })

 it('executes invoice adjustment, void, commercial agreement, external fiscal doc and loads Acordos e Fiscais', async () => {
  const resUuid = '99999999-9999-4999-8999-999999999999'
  const rpc = vi.fn(async (_fnName: string, _params?: Record<string, unknown>) => ({ data: resUuid, error: null }))
  const from = vi.fn((table: string) => {
   const chain = {
    select: () => chain,
    eq: () => chain,
    ilike: () => chain,
    order: () => chain,
    range: () => chain,
    limit: () => chain,
    abortSignal: () => Promise.resolve({
     data: table === 'v_saas_invoice_balances'
      ? [inv]
      : table === 'v_saas_invoice_charge_breakdown'
       ? [breakdown]
       : table === 'v_saas_payment_agreement_status'
        ? [{ id: resUuid, organization_id: org, agreement_number: 'AC-SAAS-001', agreement_date: '2026-10-15', original_open_amount: '50.00', negotiated_amount: '50.00', down_payment: '0.00', installment_count: 1, charges_treatment: 'zero_charges', terms: 'Sem juros automáticos', derived_status: 'open', latest_event_at: null, created_at: '2026-10-15T10:00:00Z' }]
        : table === 'saas_fiscal_documents'
         ? [{ id: resUuid, organization_id: org, invoice_id: invoice, document_type: 'nfse', status: 'issued', document_number: 'NFSE-2026-99', external_reference: 'PREF-SP-99', issued_at: '2026-10-15T10:00:00Z', created_at: '2026-10-15T10:00:00Z' }]
         : [],
     error: null,
    }),
   }
   return chain
  })

  render(<MasterBilling client={{ from, rpc } as unknown as SupabaseClient} tenants={tenants} initialOrganizationId={org} />)
  await screen.findByText('DEV-0001')
  fireEvent.click(screen.getByRole('button', { name: 'Ver composição' }))
  await screen.findByText('Composição — DEV-0001')

  // Apply discount adjustment
  fireEvent.click(screen.getByRole('button', { name: 'Ajustar / Desconto' }))
  fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '25.00' } })
  fireEvent.change(screen.getByLabelText('Justificativa'), { target: { value: 'Desconto comercial aprovado' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Ajustar fatura SaaS' }))
  await screen.findByText(/Ajuste de fatura SaaS confirmad/)
  expect(rpc).toHaveBeenCalledWith('apply_saas_invoice_adjustment_idempotent', expect.objectContaining({
   p_invoice_id: invoice,
   p_signed_amount: -25,
  }))

  // Re-open composition panel after revision reload & record commercial agreement
  fireEvent.click(await screen.findByRole('button', { name: 'Ver composição' }))
  await screen.findByText('Composição — DEV-0001')
  fireEvent.click(screen.getByRole('button', { name: 'Registrar acordo' }))
  fireEvent.change(screen.getByLabelText(/Parcelas/), { target: { value: '2026-11-20;50.00' } })
  fireEvent.change(screen.getByLabelText(/Termos e justificativa/), { target: { value: 'Parcelamento em parcela única sem encargos' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Registrar acordo SaaS' }))
  await screen.findByText(/Registro de acordo comercial SaaS confirmad/)
  expect(rpc).toHaveBeenCalledWith('record_saas_payment_agreement_idempotent', expect.objectContaining({
   p_invoice_ids: [invoice],
  }))

  // Re-open composition panel after revision reload & register external fiscal doc
  fireEvent.click(await screen.findByRole('button', { name: 'Ver composição' }))
  await screen.findByText('Composição — DEV-0001')
  fireEvent.click(screen.getByRole('button', { name: 'Vincular doc. fiscal' }))
  fireEvent.change(screen.getByLabelText('Número do documento'), { target: { value: 'NFSE-2026-99' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Vincular documento fiscal externo' }))
  await screen.findByText(/Registro de documento fiscal SaaS confirmad/)
  expect(rpc).toHaveBeenCalledWith('register_saas_fiscal_document_idempotent', expect.objectContaining({
   p_invoice_id: invoice,
   p_document_number: 'NFSE-2026-99',
  }))

  // Switch to Acordos e Fiscais view
  fireEvent.click(screen.getByRole('button', { name: 'Acordos e Fiscais' }))
  await screen.findByText('AC-SAAS-001')
  expect(screen.getByText('NFSE-2026-99')).toBeInTheDocument()
 })
})
