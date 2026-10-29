import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'
export type MasterInvoice={
 id:string;organization_id:string;subscription_id:string;invoice_number:string;
 competence:string;due_date:string;original_amount:string|number;
 adjustment_amount:string|number;amount_due:string|number;amount_paid:string|number;
 amount_open:string|number;derived_status:string;integrity_ok:boolean
}
export type MasterInvoiceBreakdown={
 organization_id:string;invoice_id:string;invoice_number:string;
 base_amount:string|number;late_fee_amount:string|number;interest_amount:string|number;
 discount_credit_amount:string|number;other_increase_amount:string|number;
 net_adjustments:string|number;updated_total:string|number
}
export type MasterPayment={
 id:string;organization_id:string;paid_at:string;amount:string|number;
 allocated_amount:string|number;unallocated_amount:string|number;active:boolean
}
export const MASTER_BILLING_PAGE=25
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function enough(n:number,a:number,b:number){return Math.abs(n-(a+b))<=0.01}
export async function loadMasterInvoicePage(
 client:SupabaseClient,org:string,page:number,signal:AbortSignal
){
 if(!id.test(org)||!Number.isSafeInteger(page)||page<0||page>800)
  throw Error('Invalid Master billing scope')
 const {data,error}=await client.from('v_saas_invoice_balances')
  .select('id,organization_id,subscription_id,invoice_number,competence,due_date,original_amount,adjustment_amount,amount_due,amount_paid,amount_open,derived_status,integrity_ok')
  .eq('organization_id',org).order('due_date',{ascending:false}).order('id')
  .range(page*MASTER_BILLING_PAGE,(page+1)*MASTER_BILLING_PAGE).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>MASTER_BILLING_PAGE+1)throw Error('Master invoices truncated')
 for(const item of data as MasterInvoice[]){
  if(!item||item.organization_id!==org||!id.test(item.id)||!id.test(item.subscription_id)||
   item.integrity_ok!==true||typeof item.invoice_number!=='string'||
   !/^\d{4}-\d{2}-\d{2}$/.test(item.competence)||
   !/^\d{4}-\d{2}-\d{2}$/.test(item.due_date)||
   typeof item.derived_status!=='string')
   throw Error('Invalid Master invoice')
  const original=checkedSigned(item.original_amount),adjustment=checkedSigned(item.adjustment_amount)
  const due=checkedSigned(item.amount_due),paid=checkedSigned(item.amount_paid)
  const open=checkedSigned(item.amount_open)
  if(original<0||due<0||paid<0||open<0||
   !enough(due,original,adjustment)||
   (item.derived_status!=='void'&&!enough(due,paid,open))||
   (item.derived_status==='void'&&open!==0))
   throw Error('Master invoice amount integrity failure')
 }
 return {rows:data.slice(0,MASTER_BILLING_PAGE) as MasterInvoice[],hasNext:data.length>MASTER_BILLING_PAGE}
}
export async function loadMasterInvoiceBreakdown(
 client:SupabaseClient,org:string,invoice:MasterInvoice,signal:AbortSignal
){
 if(invoice.organization_id!==org)throw Error('Wrong Master invoice scope')
 const {data,error}=await client.from('v_saas_invoice_charge_breakdown')
  .select('organization_id,invoice_id,invoice_number,base_amount,late_fee_amount,interest_amount,discount_credit_amount,other_increase_amount,net_adjustments,updated_total')
  .eq('organization_id',org).eq('invoice_id',invoice.id).limit(2).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length!==1)throw Error('Master invoice breakdown incomplete')
 const row=data[0] as MasterInvoiceBreakdown
 if(row.organization_id!==org||row.invoice_id!==invoice.id||
  row.invoice_number!==invoice.invoice_number)throw Error('Master invoice breakdown scope')
 const base=checkedSigned(row.base_amount),fee=checkedSigned(row.late_fee_amount)
 const interest=checkedSigned(row.interest_amount),discount=checkedSigned(row.discount_credit_amount)
 const other=checkedSigned(row.other_increase_amount),net=checkedSigned(row.net_adjustments)
 const total=checkedSigned(row.updated_total)
 if(base<0||fee<0||interest<0||other<0||
   !enough(net,fee+interest+other,discount)||
   !enough(total,base,net)||
   Math.abs(total-checkedSigned(invoice.amount_due))>0.01)
  throw Error('Master invoice charges inconsistent')
 return row
}
export async function loadMasterPaymentPage(
 client:SupabaseClient,org:string,page:number,signal:AbortSignal
){
 if(!id.test(org)||!Number.isSafeInteger(page)||page<0||page>800)throw Error('Invalid Master payment scope')
 const {data,error}=await client.from('v_saas_payment_balances')
  .select('id,organization_id,paid_at,amount,allocated_amount,unallocated_amount,active')
  .eq('organization_id',org).order('paid_at',{ascending:false}).order('id')
  .range(page*MASTER_BILLING_PAGE,(page+1)*MASTER_BILLING_PAGE).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>MASTER_BILLING_PAGE+1)throw Error('Master payment page truncated')
 for(const p of data as MasterPayment[]){
  if(p.organization_id!==org||!id.test(p.id)||typeof p.paid_at!=='string'||
   typeof p.active!=='boolean')throw Error('Master payment scope invalid')
  const amount=checkedSigned(p.amount),allocated=checkedSigned(p.allocated_amount)
  const open=checkedSigned(p.unallocated_amount)
  if(amount<0||allocated<0||open<0||!enough(amount,allocated,open))throw Error('Master payment balances inconsistent')
 }
 return {rows:data.slice(0,MASTER_BILLING_PAGE) as MasterPayment[],hasNext:data.length>MASTER_BILLING_PAGE}
}

export type MasterManualInvoiceLineItem = {
 item_type: string;
 description: string;
 quantity: number;
 unit_amount: number;
 line_amount: number;
}

export type MasterManualInvoicePreview = {
 organization_id: string;
 organization_name: string;
 subscription_id: string;
 plan_id: string;
 plan_name: string;
 competence: string;
 service_period_start: string;
 service_period_end: string;
 due_date: string;
 unit_price: number;
 currency: string;
 line_items: MasterManualInvoiceLineItem[];
 total_amount: number;
 already_billed: boolean;
 existing_invoice_id?: string | null;
 existing_invoice_number?: string | null;
 existing_amount?: number | null;
}

export type MasterManualInvoiceInput = {
 organization_id: string;
 competence: string;
 due_date: string;
 description?: string;
 idempotency_key: string;
}

export function buildManualInvoiceIdempotencyKey(org: string, competence: string): string {
 if (!id.test(org) || !/^\d{4}-\d{2}-\d{2}$/.test(competence)) {
  throw Error('Invalid scope for idempotency key')
 }
 const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID().slice(0, 8)
  : Math.random().toString(36).slice(2, 10)
 return `master-inv-${org.slice(0, 8)}-${competence.slice(0, 7)}-${suffix}`
}

export async function previewMasterManualInvoice(
 client: SupabaseClient,
 org: string,
 competence: string,
 dueDate?: string,
 signal?: AbortSignal
): Promise<MasterManualInvoicePreview> {
 if (!id.test(org)) throw Error('Invalid Master invoice scope')
 if (!/^\d{4}-\d{2}-01$/.test(competence)) throw Error('Competence must be first day of month (YYYY-MM-01)')
 if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw Error('Invalid due date format')

 let query = client.rpc('preview_saas_manual_invoice', {
  p_organization_id: org,
  p_competence: competence,
  p_due_date: dueDate || null
 })
 if (signal) {
  query = query.abortSignal(signal)
 }
 const { data, error } = await query
 if (error) throw error
 if (!data || typeof data !== 'object') throw Error('Invalid preview response')

 const preview = data as MasterManualInvoicePreview
 if (preview.organization_id !== org || !id.test(preview.subscription_id)) {
  throw Error('Preview response scope mismatch')
 }
 if (typeof preview.unit_price !== 'number' || preview.unit_price <= 0) {
  throw Error('Preview contractual price invalid')
 }
 if (!Array.isArray(preview.line_items) || preview.line_items.length === 0) {
  throw Error('Preview line items missing')
 }
 return preview
}

export async function issueMasterManualInvoice(
 client: SupabaseClient,
 input: MasterManualInvoiceInput
): Promise<string> {
 if (!id.test(input.organization_id)) throw Error('Invalid Master invoice scope')
 if (!/^\d{4}-\d{2}-01$/.test(input.competence)) throw Error('Competence must be first day of month (YYYY-MM-01)')
 if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) throw Error('Invalid due date format')
 if (!input.idempotency_key || input.idempotency_key.length < 1 || input.idempotency_key.length > 200) {
  throw Error('Idempotency key required (1..200 chars)')
 }

 const { data, error } = await client.rpc('issue_saas_manual_invoice', {
  p_organization_id: input.organization_id,
  p_competence: input.competence,
  p_due_date: input.due_date,
  p_description: input.description?.trim() || null,
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) {
  throw Error('Expected invoice UUID from manual issuance')
 }
 return data
}

