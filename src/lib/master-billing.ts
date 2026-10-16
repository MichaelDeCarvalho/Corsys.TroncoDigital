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
