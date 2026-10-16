import type { SupabaseClient } from '@supabase/supabase-js'

export type Plan = { id:string; organization_id:string; name:string; status:'draft'|'published'; valid_from:string; valid_to:string }
export type Account = { id:string; organization_id:string; accounting_plan_id:string; code:string; description:string; nature:string; row_type:string; active:boolean; parent_account_id:string|null }
export type Mapping = { id:string; organization_id:string; accounting_plan_id:string; accounting_account_id:string; category_id?:string; financial_account_id?:string }
export type Source = { id:string; organization_id:string; name:string; domain?:string; active:boolean }
export type Catalog = { plans:Plan[]; templates:{id:string;name:string;version:number;active:boolean}[]; categories:Source[]; cash:Source[] }
export type Detail = { accounts:Account[]; categoryMappings:Mapping[]; cashMappings:Mapping[] }
function scoped<T extends {organization_id:string}>(result:{data:T[]|null;error:unknown},org:string):T[]{
 if(result.error)throw result.error
 if((result.data??[]).some(r=>r.organization_id!==org))throw new Error('Foreign tenant data returned')
 return result.data??[]
}
export async function loadAccountingCatalog(client:SupabaseClient,org:string,signal:AbortSignal):Promise<Catalog>{
 const [plans,templates,categories,cash]=await Promise.all([
 client.from('accounting_plans').select('id,organization_id,name,status,valid_from,valid_to').eq('organization_id',org).order('valid_from',{ascending:false}).limit(100).abortSignal(signal),
 client.from('accounting_plan_templates').select('id,name,version,active').eq('active',true).order('name').limit(100).abortSignal(signal),
 client.from('financial_categories').select('id,organization_id,name,domain,active').eq('organization_id',org).order('name').limit(200).abortSignal(signal),
 client.from('financial_accounts').select('id,organization_id,name,active').eq('organization_id',org).order('name').limit(200).abortSignal(signal),
 ])
 if(templates.error||templates.data?.some(t=>t.active!==true))throw templates.error??new Error('Inactive template returned')
 return {plans:scoped(plans,org) as Plan[],templates:templates.data??[],
 categories:scoped(categories,org) as Source[],cash:scoped(cash,org) as Source[]}
}
export async function loadAccountingDetail(client:SupabaseClient,org:string,plan:string,signal:AbortSignal):Promise<Detail>{
 const [accounts,categories,cash]=await Promise.all([
 client.from('accounting_accounts').select('id,organization_id,accounting_plan_id,code,description,nature,row_type,active,parent_account_id').eq('organization_id',org).eq('accounting_plan_id',plan).order('code').limit(300).abortSignal(signal),
 client.from('financial_category_account_mappings').select('id,organization_id,accounting_plan_id,category_id,accounting_account_id').eq('organization_id',org).eq('accounting_plan_id',plan).limit(300).abortSignal(signal),
 client.from('financial_account_accounting_mappings').select('id,organization_id,accounting_plan_id,financial_account_id,accounting_account_id').eq('organization_id',org).eq('accounting_plan_id',plan).limit(300).abortSignal(signal)
 ])
 const result={accounts:scoped(accounts,org) as Account[],categoryMappings:scoped(categories,org) as Mapping[],cashMappings:scoped(cash,org) as Mapping[]}
 if([...result.accounts,...result.categoryMappings,...result.cashMappings].some(row=>row.accounting_plan_id!==plan))throw new Error('Foreign plan data returned')
 return result
}
export function endOfMonth(month:string):string{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Competência inválida')
 const [y,m]=month.split('-').map(Number)
 return `${month}-${String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0')}`
}
