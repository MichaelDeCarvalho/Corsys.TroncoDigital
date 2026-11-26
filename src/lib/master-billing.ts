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
export type MasterInvoiceStatusFilter = 'all' | 'paid' | 'partial' | 'overdue' | 'open' | 'void'
export type MasterInvoiceFilters = {
 search?: string
 status?: MasterInvoiceStatusFilter
 competence?: string
}
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function enough(n:number,a:number,b:number){return Math.abs(n-(a+b))<=0.01}
export async function loadMasterInvoicePage(
 client:SupabaseClient,org:string,page:number,signal:AbortSignal,filters:MasterInvoiceFilters={}
){
 if(!id.test(org)||!Number.isSafeInteger(page)||page<0||page>800)
  throw Error('Invalid Master billing scope')
 const search=(filters.search??'').trim()
 const status=filters.status??'all'
 const competence=filters.competence??''
 if(search.length>80||!['all','paid','partial','overdue','open','void'].includes(status)||
  (competence!==''&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)))
  throw Error('Invalid Master invoice filters')
 let query=client.from('v_saas_invoice_balances')
  .select('id,organization_id,subscription_id,invoice_number,competence,due_date,original_amount,adjustment_amount,amount_due,amount_paid,amount_open,derived_status,integrity_ok')
  .eq('organization_id',org)
 // Apply filters on the server BEFORE pagination; never show a partial, client-filtered page.
 if(search)query=query.ilike('invoice_number',`%${search.replace(/[\\%_]/g,'\\$&')}%`)
 if(status!=='all')query=query.eq('derived_status',status)
 if(competence)query=query.eq('competence',`${competence}-01`)
 const {data,error}=await query.order('due_date',{ascending:false}).order('id')
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

export type MasterSaasFinancialSummary = {
 organization_id: string | null
 active_invoices_count: number
 total_billed: number | string
 total_paid_allocated: number | string
 total_open: number | string
 total_overdue: number | string
 voided_count: number
 voided_amount: number | string
 active_payments_count: number
 total_received: number | string
 total_unallocated_credit: number | string
 as_of: string
}

export type MasterPaymentAllocation = {
 id: string
 organization_id: string
 payment_id: string
 invoice_id: string
 amount: number | string
 created_at: string
}

export type MasterPaymentAgreementStatus = {
 id: string
 organization_id: string
 agreement_number: string
 agreement_date: string
 original_open_amount: number | string
 negotiated_amount: number | string
 down_payment: number | string
 installment_count: number
 charges_treatment: string
 terms: string | null
 derived_status: string
 latest_event_at: string | null
 created_at: string
}

export type MasterFiscalDocument = {
 id: string
 organization_id: string
 invoice_id: string | null
 document_type: 'nfse' | 'receipt' | 'other'
 status: 'pending' | 'issued' | 'canceled' | 'error'
 document_number: string | null
 external_reference: string | null
 issued_at: string | null
 created_at: string
}

export async function loadMasterSaasFinancialSummary(
 client: SupabaseClient,
 organizationId?: string | null
): Promise<MasterSaasFinancialSummary> {
 const org = organizationId?.trim() || null
 if (org && !id.test(org)) throw Error('Invalid Master financial summary scope')
 const { data, error } = await client.rpc('read_master_saas_financial_summary', {
  p_organization_id: org
 })
 if (error) throw error
 if (!data || typeof data !== 'object' || Array.isArray(data)) {
  throw Error('Invalid Master financial summary response')
 }
 const row = data as MasterSaasFinancialSummary
 if (org && row.organization_id !== org) throw Error('Master financial summary scope mismatch')
 return row
}

export async function loadMasterPaymentAllocations(
 client: SupabaseClient,
 org: string,
 signal: AbortSignal
): Promise<MasterPaymentAllocation[]> {
 if (!id.test(org)) throw Error('Invalid Master allocation scope')
 const { data, error } = await client.from('v_saas_active_payment_allocations')
  .select('id,organization_id,payment_id,invoice_id,amount,created_at')
  .eq('organization_id', org)
  .order('created_at', { ascending: false })
  .limit(100)
  .abortSignal(signal)
 if (error) throw error
 if (!Array.isArray(data)) throw Error('Invalid payment allocation rows')
 for (const row of data as MasterPaymentAllocation[]) {
  if (!row || row.organization_id !== org || !id.test(row.id) || checkedSigned(row.amount) <= 0) {
   throw Error('Master payment allocation integrity failure')
  }
 }
 return data as MasterPaymentAllocation[]
}

export async function loadMasterPaymentAgreements(
 client: SupabaseClient,
 org: string,
 signal: AbortSignal
): Promise<MasterPaymentAgreementStatus[]> {
 if (!id.test(org)) throw Error('Invalid Master agreement scope')
 const { data, error } = await client.from('v_saas_payment_agreement_status')
  .select('id,organization_id,agreement_number,agreement_date,original_open_amount,negotiated_amount,down_payment,installment_count,charges_treatment,terms,derived_status,latest_event_at,created_at')
  .eq('organization_id', org)
  .order('created_at', { ascending: false })
  .limit(50)
  .abortSignal(signal)
 if (error) throw error
 if (!Array.isArray(data)) throw Error('Invalid Master agreement list')
 for (const row of data as MasterPaymentAgreementStatus[]) {
  if (!row || row.organization_id !== org || !id.test(row.id)) {
   throw Error('Master payment agreement scope mismatch')
  }
 }
 return data as MasterPaymentAgreementStatus[]
}

export async function loadMasterFiscalDocuments(
 client: SupabaseClient,
 org: string,
 signal: AbortSignal
): Promise<MasterFiscalDocument[]> {
 if (!id.test(org)) throw Error('Invalid Master fiscal document scope')
 const { data, error } = await client.from('saas_fiscal_documents')
  .select('id,organization_id,invoice_id,document_type,status,document_number,external_reference,issued_at,created_at')
  .eq('organization_id', org)
  .order('created_at', { ascending: false })
  .limit(50)
  .abortSignal(signal)
 if (error) throw error
 if (!Array.isArray(data)) throw Error('Invalid Master fiscal document list')
 for (const row of data as MasterFiscalDocument[]) {
  if (!row || row.organization_id !== org || !id.test(row.id)) {
   throw Error('Master fiscal document scope mismatch')
  }
 }
 return data as MasterFiscalDocument[]
}

export async function registerMasterSaasPayment(
 client: SupabaseClient,
 input: {
  organization_id: string
  paid_at: string
  amount: number
  payment_method: 'pix' | 'boleto' | 'card' | 'transfer' | 'cash' | 'other'
  reference?: string
  allocations?: Array<{ invoice_id: string; amount: number }>
  idempotency_key: string
 }
): Promise<string> {
 if (!id.test(input.organization_id)) throw Error('Invalid Master payment scope')
 if (!Number.isFinite(input.amount) || input.amount <= 0) throw Error('Valor do pagamento deve ser positivo.')
 if (!['pix', 'boleto', 'card', 'transfer', 'cash', 'other'].includes(input.payment_method)) {
  throw Error('Método de pagamento inválido.')
 }
 if (!input.idempotency_key || input.idempotency_key.trim().length < 1 || input.idempotency_key.trim().length > 200) {
  throw Error('Chave de idempotência obrigatória.')
 }
 const allocations = (input.allocations ?? []).map(a => {
  if (!id.test(a.invoice_id) || !Number.isFinite(a.amount) || a.amount <= 0) {
   throw Error('Alocação de fatura inválida.')
  }
  return { invoice_id: a.invoice_id, amount: Number(a.amount.toFixed(2)) }
 })
 const { data, error } = await client.rpc('register_saas_payment_idempotent', {
  p_organization_id: input.organization_id,
  p_paid_at: input.paid_at,
  p_amount: Number(input.amount.toFixed(2)),
  p_payment_method: input.payment_method,
  p_reference: input.reference?.trim() || null,
  p_allocations: allocations,
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected payment UUID')
 return data
}

export async function allocateMasterSaasPayment(
 client: SupabaseClient,
 input: {
  organization_id: string
  payment_id: string
  invoice_id: string
  amount: number
  idempotency_key: string
 }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.payment_id) || !id.test(input.invoice_id)) {
  throw Error('Identificadores inválidos para alocação.')
 }
 if (!Number.isFinite(input.amount) || input.amount <= 0) throw Error('Valor da alocação deve ser positivo.')
 const { data, error } = await client.rpc('allocate_saas_payment_idempotent', {
  p_organization_id: input.organization_id,
  p_payment_id: input.payment_id,
  p_invoice_id: input.invoice_id,
  p_amount: Number(input.amount.toFixed(2)),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected allocation UUID')
 return data
}

export async function reverseMasterSaasPaymentAllocation(
 client: SupabaseClient,
 input: { organization_id: string; allocation_id: string; reason: string; idempotency_key: string }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.allocation_id)) throw Error('Identificador de alocação inválido.')
 if (input.reason.trim().length < 3) throw Error('Motivo do estorno obrigatório.')
 const { data, error } = await client.rpc('reverse_saas_payment_allocation_idempotent', {
  p_organization_id: input.organization_id,
  p_allocation_id: input.allocation_id,
  p_reason: input.reason.trim(),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected reversed allocation UUID')
 return data
}

export async function reverseMasterSaasPayment(
 client: SupabaseClient,
 input: { organization_id: string; payment_id: string; reason: string; idempotency_key: string }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.payment_id)) throw Error('Identificador de pagamento inválido.')
 if (input.reason.trim().length < 3) throw Error('Motivo da reversão obrigatório.')
 const { data, error } = await client.rpc('reverse_saas_payment_idempotent', {
  p_organization_id: input.organization_id,
  p_payment_id: input.payment_id,
  p_reason: input.reason.trim(),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected reversed payment UUID')
 return data
}

export async function voidMasterSaasInvoice(
 client: SupabaseClient,
 input: { organization_id: string; invoice_id: string; reason: string; idempotency_key: string }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.invoice_id)) throw Error('Identificador de fatura inválido.')
 if (input.reason.trim().length < 3) throw Error('Motivo do cancelamento obrigatório.')
 const { data, error } = await client.rpc('void_saas_invoice_idempotent', {
  p_organization_id: input.organization_id,
  p_invoice_id: input.invoice_id,
  p_reason: input.reason.trim(),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected voided invoice UUID')
 return data
}

export async function applyMasterSaasInvoiceAdjustment(
 client: SupabaseClient,
 input: {
  organization_id: string
  invoice_id: string
  adjustment_type: 'discount' | 'credit' | 'manual_adjustment'
  signed_amount: number
  reason: string
  idempotency_key: string
 }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.invoice_id)) throw Error('Identificador de fatura inválido.')
 if (!Number.isFinite(input.signed_amount) || input.signed_amount === 0) throw Error('Informe um valor diferente de zero.')
 if (input.reason.trim().length < 3) throw Error('Motivo do ajuste obrigatório.')
 const { data, error } = await client.rpc('apply_saas_invoice_adjustment_idempotent', {
  p_organization_id: input.organization_id,
  p_invoice_id: input.invoice_id,
  p_adjustment_type: input.adjustment_type,
  p_signed_amount: Number(input.signed_amount.toFixed(2)),
  p_reason: input.reason.trim(),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected adjustment UUID')
 return data
}

export async function recordMasterSaasPaymentAgreement(
 client: SupabaseClient,
 input: {
  organization_id: string
  invoice_ids: string[]
  installments: Array<{ due_date: string; amount: number }>
  terms: string
  idempotency_key: string
 }
): Promise<string> {
 if (!id.test(input.organization_id) || !input.invoice_ids.length || !input.invoice_ids.every(x => id.test(x))) {
  throw Error('Selecione ao menos uma fatura válida para o acordo.')
 }
 if (!input.installments.length || input.installments.some(i => !/^\d{4}-\d{2}-\d{2}$/.test(i.due_date) || !Number.isFinite(i.amount) || i.amount <= 0)) {
  throw Error('Parcelas inválidas para o acordo comercial.')
 }
 if (input.terms.trim().length < 3) throw Error('Informe os termos e justificativa do acordo.')
 const { data, error } = await client.rpc('record_saas_payment_agreement_idempotent', {
  p_organization_id: input.organization_id,
  p_invoice_ids: input.invoice_ids,
  p_installments: input.installments.map(i => ({ due_date: i.due_date, amount: Number(i.amount.toFixed(2)) })),
  p_terms: input.terms.trim(),
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected agreement UUID')
 return data
}

export async function registerMasterSaasFiscalDocument(
 client: SupabaseClient,
 input: {
  organization_id: string
  invoice_id: string
  document_type: 'nfse' | 'receipt' | 'other'
  status: 'pending' | 'issued' | 'canceled' | 'error'
  document_number?: string
  external_reference?: string
  issued_at?: string | null
  idempotency_key: string
 }
): Promise<string> {
 if (!id.test(input.organization_id) || !id.test(input.invoice_id)) throw Error('Selecione uma fatura válida.')
 const { data, error } = await client.rpc('register_saas_fiscal_document_idempotent', {
  p_organization_id: input.organization_id,
  p_invoice_id: input.invoice_id,
  p_document_type: input.document_type,
  p_status: input.status,
  p_document_number: input.document_number?.trim() || null,
  p_external_reference: input.external_reference?.trim() || null,
  p_issued_at: input.issued_at || null,
  p_idempotency_key: input.idempotency_key.trim()
 })
 if (error) throw error
 if (typeof data !== 'string' || !id.test(data)) throw Error('Expected fiscal document UUID')
 return data
}
