import type { SupabaseClient } from '@supabase/supabase-js'
import { exactPaymentAmount } from './member-payments'

export type InstitutionalKind='payable'|'receivable'
export type InstitutionalCategory={id:string;organization_id:string;name:string;domain:string;active:boolean}
export type InstitutionalCatalogItem={id:string;organization_id:string;name:string;active:boolean}
export type InstitutionalObligation={
 organization_id:string;payable_id?:string;receivable_id?:string;description:string;due_date:string;
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
   'description','counterparty_name','due_date','open_amount','is_canceled','integrity_ok',
   ...(kind==='payable'?['approval_status']:[])].join(',')
 const result=await client.from(name).select(fields).eq('organization_id',org)
  .order('due_date',{ascending:false}).limit(151).abortSignal(signal)
 const rows=tenantScoped(result,org) as InstitutionalObligation[]
 if(rows.length>150)throw Error('Institutional obligation list truncated')
 for(const r of rows){
  const id=kind==='payable'?r.payable_id:r.receivable_id
  if(!id||r.integrity_ok!==true||typeof r.is_canceled!=='boolean'||typeof r.description!=='string'
    ||typeof r.counterparty_name!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.due_date))throw Error('Invalid institutional obligation record')
  exactPaymentAmount(r.open_amount)
 }
 return rows
}
