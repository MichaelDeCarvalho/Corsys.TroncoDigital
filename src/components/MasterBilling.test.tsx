import {fireEvent,render,screen} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterBilling} from './MasterBilling'
import {loadMasterInvoiceBreakdown,loadMasterInvoicePage,loadMasterPaymentPage} from '../lib/master-billing'
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
function fixture(opts:{foreign?:boolean;integrity?:boolean;badBreakdown?:boolean}={}){
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
 return {client:{from} as unknown as SupabaseClient,from}
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
