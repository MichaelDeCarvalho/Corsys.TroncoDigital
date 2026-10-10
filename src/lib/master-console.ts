import type { SupabaseClient } from '@supabase/supabase-js'

export type MasterOverview = {
 as_of: string
 tenants_total: number
 tenants_active: number
 tenants_other: number
 subscriptions_active_or_trial: number
 subscriptions_past_due: number
 support_tickets_open: number
 plan_drafts: number
 access: 'MASTER'
 mfa_required: true
}
export type MasterTenant = {
 organization_id: string
 organization_name: string
 organization_number: string | null
 organization_status: string
 subscription_status: string
 plan_name: string
 open_support_tickets: number
}
export const MASTER_PAGE_SIZE=25
function safeCount(value:unknown):number{
 const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value
 if(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>1000000)
  throw Error('Invalid Master metric')
 return Number(n)
}
export function validateMasterOverview(input:unknown):MasterOverview{
 if(!input||typeof input!=='object')throw Error('Invalid Master payload')
 const value=input as Record<string,unknown>
 if(value.access!=='MASTER'||value.mfa_required!==true||
  typeof value.as_of!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.as_of))
  throw Error('Untrusted Master authorization response')
 const keys=[
  'tenants_total','tenants_active','tenants_other','subscriptions_active_or_trial',
  'subscriptions_past_due','support_tickets_open','plan_drafts',
 ] as const
 const parsed:Record<string,number>={}
 for(const key of keys)parsed[key]=safeCount(value[key])
 if(parsed.tenants_total!==parsed.tenants_active+parsed.tenants_other)
  throw Error('Master dashboard totals inconsistent')
 return {...value,...parsed} as MasterOverview
}
export async function loadMasterOverview(client:SupabaseClient){
 const {data,error}=await client.rpc('read_platform_master_overview')
 if(error)throw error
 return validateMasterOverview(data)
}
export async function loadMasterTenants(client:SupabaseClient,page:number){
 if(!Number.isSafeInteger(page)||page<0||page>800)throw Error('Invalid Master page')
 const {data,error}=await client.rpc('list_platform_master_tenants',{
  p_limit:MASTER_PAGE_SIZE+1,p_offset:page*MASTER_PAGE_SIZE,
 })
 if(error)throw error
 if(!Array.isArray(data)||data.length>MASTER_PAGE_SIZE+1)
  throw Error('Invalid Master directory pagination')
 const ids=new Set<string>()
 const rows:MasterTenant[]=[]
 for(const value of data as Record<string,unknown>[]){
  if(!value||typeof value!=='object'||typeof value.organization_id!=='string'||
    typeof value.organization_name!=='string'||typeof value.organization_status!=='string'||
    typeof value.subscription_status!=='string'||typeof value.plan_name!=='string'||
    !(value.organization_number===null||typeof value.organization_number==='string')||
    ids.has(value.organization_id))throw Error('Invalid tenant directory entry')
  ids.add(value.organization_id)
  rows.push({...value,open_support_tickets:safeCount(value.open_support_tickets)} as MasterTenant)
 }
 return {rows:rows.slice(0,MASTER_PAGE_SIZE),hasNext:rows.length>MASTER_PAGE_SIZE}
}
