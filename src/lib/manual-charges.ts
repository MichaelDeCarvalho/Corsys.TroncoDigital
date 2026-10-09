import type { SupabaseClient } from '@supabase/supabase-js'
import { exactPaymentAmount } from './member-payments'
export type ChargeMember={id:string;organization_id:string;full_name:string;status:string}
export type ChargeCategory={id:string;organization_id:string;name:string;active:boolean;domain:string}
export type ChargeBalance={charge_id:string;organization_id:string;member_id:string;description:string;competence:string;due_date:string;open_amount:string|number;integrity_ok:boolean;is_cancelled:boolean}
export async function loadManualChargeCatalog(client:SupabaseClient,org:string,signal:AbortSignal){
 const [members,categories]=await Promise.all([
  client.from('members').select('id,organization_id,full_name,status').eq('organization_id',org).order('full_name').limit(201).abortSignal(signal),
  client.from('financial_categories').select('id,organization_id,name,active,domain')
   .eq('organization_id',org).eq('domain','member_receivable').eq('active',true)
   .order('name').limit(201).abortSignal(signal),
 ])
 if(members.error)throw members.error
 if(categories.error)throw categories.error
 if(!Array.isArray(members.data)||!Array.isArray(categories.data)||
  members.data.length>200||categories.data.length>200||
  members.data.some(m=>m.organization_id!==org||typeof m.id!=='string'||typeof m.full_name!=='string')||
  categories.data.some(c=>c.organization_id!==org||c.domain!=='member_receivable'||!c.active))
  throw Error('Invalid tenant charge catalog')
 return {members:members.data as ChargeMember[],categories:categories.data as ChargeCategory[]}
}
export async function loadMemberCharges(client:SupabaseClient,org:string,member:string,signal:AbortSignal):Promise<ChargeBalance[]>{
 const {data,error}=await client.from('v_charge_balances')
  .select('charge_id,organization_id,member_id,description,competence,due_date,open_amount,is_cancelled,integrity_ok')
  .eq('organization_id',org).eq('member_id',member).order('due_date',{ascending:false})
  .limit(151).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>150||data.some(row=>row.organization_id!==org||
   row.member_id!==member||row.integrity_ok!==true||typeof row.is_cancelled!=='boolean'||
   typeof row.charge_id!=='string'||typeof row.description!=='string'||
   !/^\d{4}-\d{2}-\d{2}$/.test(row.due_date)))throw Error('Member charge integrity failure')
 for(const row of data)exactPaymentAmount(row.open_amount)
 return data as ChargeBalance[]
}
