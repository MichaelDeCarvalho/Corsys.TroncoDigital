import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'
export type MasterClient360={
 organization_id:string;name:string;number:string|null;status:string;
 commercial_status:string|null;customer_since:string|null;
 billing_email:string|null;billing_provider:string|null;
 subscription_id:string|null;subscription_status:string|null;
 subscription_start:string|null;subscription_end:string|null;
 plan_version_id:string|null;invoices_total:number;
 invoices_open_amount:string|number;invoices_overdue_amount:string|number;
 tickets_total:number;tickets_open:number;as_of:string;integrity_ok:boolean
}
export function validateMasterClient360(input:unknown,id:string):MasterClient360{
 if(!input||typeof input!=='object')throw Error('Invalid Client360 response')
 const d=input as MasterClient360
 if(d.organization_id!==id||d.integrity_ok!==true||
  typeof d.name!=='string'||typeof d.status!=='string'||
  !/^\d{4}-\d{2}-\d{2}$/.test(d.as_of)||
  !Number.isSafeInteger(d.invoices_total)||!Number.isSafeInteger(d.tickets_total)||
  !Number.isSafeInteger(d.tickets_open)||d.invoices_total<0||
  d.tickets_total<d.tickets_open||d.tickets_open<0)
  throw Error('Client360 integrity mismatch')
 const open=checkedSigned(d.invoices_open_amount),overdue=checkedSigned(d.invoices_overdue_amount)
 if(open<0||overdue<0||overdue>open+0.01)throw Error('Client360 invoice totals inconsistent')
 return d
}
export async function loadMasterClient360(client:SupabaseClient,org:string){
 const {data,error}=await client.rpc('read_master_client_360',{p_organization_id:org})
 if(error)throw error
 return validateMasterClient360(data,org)
}
