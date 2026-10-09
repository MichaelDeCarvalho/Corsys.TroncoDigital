import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedSigned } from './treasury-balances'
export type DelinquencyRow={
 member_id:string;full_name:string;member_status:string;overdue_items:number;
 overdue_amount:string|number;available_credit:string|number;oldest_due:string;
 net_position:string|number
}
export const DELINQUENCY_PAGE=25
export async function loadDelinquencyPage(client:SupabaseClient,org:string,page:number){
 if(!Number.isSafeInteger(page)||page<0||page>400)throw Error('Invalid overdue page')
 const {data,error}=await client.rpc('read_tenant_delinquency',{
  p_organization_id:org,p_limit:DELINQUENCY_PAGE+1,p_offset:page*DELINQUENCY_PAGE,
 })
 if(error)throw error
 if(!Array.isArray(data)||data.length>DELINQUENCY_PAGE+1)throw Error('Delinquency result incomplete')
 for(const row of data as DelinquencyRow[]){
  if(!row||typeof row!=='object'||typeof row.member_id!=='string'||
   typeof row.full_name!=='string'||typeof row.member_status!=='string'||
   !Number.isSafeInteger(row.overdue_items)||row.overdue_items<1||
   !/^\d{4}-\d{2}-\d{2}$/.test(row.oldest_due))throw Error('Delinquency data integrity failure')
  const overdue=checkedSigned(row.overdue_amount)
  const credit=checkedSigned(row.available_credit)
  checkedSigned(row.net_position)
  if(overdue<=0||credit<0)throw Error('Negative or zero overdue balance')
 }
 return {rows:data.slice(0,DELINQUENCY_PAGE) as DelinquencyRow[],hasNext:data.length>DELINQUENCY_PAGE}
}
