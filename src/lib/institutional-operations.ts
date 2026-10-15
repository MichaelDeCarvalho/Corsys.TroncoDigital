import type { SupabaseClient } from '@supabase/supabase-js'
import { exactPaymentAmount } from './member-payments'

export type InstitutionalKind='payable'|'receivable'
export type InstitutionalCategory={id:string;organization_id:string;name:string;domain:string;active:boolean}
export type InstitutionalCatalogItem={id:string;organization_id:string;name:string;active:boolean}
export type InstitutionalObligation={
 organization_id:string;payable_id?:string;receivable_id?:string;description:string;due_date:string;
 category_id:string;fund_id:string|null;competence:string;
 effective_amount:string|number;allocated_amount:string|number;
 counterparty_name:string;open_amount:string|number;is_canceled:boolean;integrity_ok:boolean;
 approval_status?:string
}
export type InstitutionalCatalogs={
 categories:InstitutionalCategory[];funds:InstitutionalCatalogItem[];
 methods:InstitutionalCatalogItem[];accounts:InstitutionalCatalogItem[]
}
function tenantScoped<T extends {organization_id:string}>(r:{data:unknown;error:unknown},org:string):T[]{
 if(r.error)throw r.error
 if(r.data!==null && !Array.isArray(r.data))throw Error('Invalid institutional API payload')
 const data=(r.data??[]) as T[]
 if(data.some(row=>!row||typeof row!=='object'||row.organization_id!==org))
  throw Error('Unexpected institutional tenant data')
 return data
}
export async function loadInstitutionalCatalogs(client:SupabaseClient,org:string,signal:AbortSignal):Promise<InstitutionalCatalogs>{
 const [categories,funds,methods,accounts]=await Promise.all([
  client.from('financial_categories').select('id,organization_id,name,domain,active').eq('organization_id',org).eq('active',true).order('name').limit(200).abortSignal(signal),
  client.from('funds').select('id,organization_id,name,active').eq('organization_id',org).eq('active',true).order('name').limit(200).abortSignal(signal),
  client.from('payment_methods').select('id,organization_id,name,active').eq('organization_id',org).eq('active',true).order('name').limit(100).abortSignal(signal),
  client.from('financial_accounts').select('id,organization_id,name,active').eq('organization_id',org).eq('active',true).order('name').limit(100).abortSignal(signal),
 ])
 const result={
  categories:tenantScoped(categories,org) as InstitutionalCategory[],
  funds:tenantScoped(funds,org) as InstitutionalCatalogItem[],
  methods:tenantScoped(methods,org) as InstitutionalCatalogItem[],
  accounts:tenantScoped(accounts,org) as InstitutionalCatalogItem[],
 }
 if([...result.categories,...result.funds,...result.methods,...result.accounts].some(x=>!x.active))throw Error('Inactive catalog returned')
 return result
}
export async function loadInstitutionalObligations(client:SupabaseClient,org:string,kind:InstitutionalKind,signal:AbortSignal):Promise<InstitutionalObligation[]>{
 const name=kind==='payable'?'v_institutional_payable_effective':'v_institutional_receivable_effective'
 const fields=['organization_id',kind==='payable'?'payable_id':'receivable_id',
   'category_id','fund_id','competence','effective_amount','allocated_amount',
   'description','counterparty_name','due_date','open_amount','is_canceled','integrity_ok',
   ...(kind==='payable'?['approval_status']:[])].join(',')
 const result=await client.from(name).select(fields).eq('organization_id',org)
  .order('due_date',{ascending:false}).limit(151).abortSignal(signal)
 const rows=tenantScoped(result,org) as InstitutionalObligation[]
 if(rows.length>150)throw Error('Institutional obligation list truncated')
 const ids=new Set<string>()
 const cents=(value:string|number)=>{
  const [units,fraction='']=exactPaymentAmount(value).split('.')
  return Number(units)*100+Number(fraction.padEnd(2,'0'))
 }
 for(const r of rows){
  const id=kind==='payable'?r.payable_id:r.receivable_id
  if(!id||r.integrity_ok!==true||typeof r.is_canceled!=='boolean'||typeof r.description!=='string'
    ||typeof r.category_id!=='string'||(r.fund_id!==null&&typeof r.fund_id!=='string')||
   typeof r.counterparty_name!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.due_date)||
   !/^\d{4}-\d{2}-01$/.test(r.competence))throw Error('Invalid institutional obligation record')
  if(ids.has(id))throw Error('Duplicate institutional obligation')
  ids.add(id)
  if(kind==='payable'&&!['not_required','missing_request','pending','approved','rejected'].includes(r.approval_status??''))
   throw Error('Invalid institutional approval status')
  const open=cents(r.open_amount),amount=cents(r.effective_amount),allocated=cents(r.allocated_amount)
  if(allocated>amount||open!==(r.is_canceled?0:amount-allocated))
   throw Error('Institutional obligation financial amount mismatch')
 }
 return rows
}

export function expectedInstitutionalState(row:InstitutionalObligation){
 return {
  category_id:row.category_id,fund_id:row.fund_id,
  description:row.description,competence:row.competence,due_date:row.due_date,
  effective_amount:Number(exactPaymentAmount(row.effective_amount)),
  allocated_amount:Number(exactPaymentAmount(row.allocated_amount)),
 }
}
