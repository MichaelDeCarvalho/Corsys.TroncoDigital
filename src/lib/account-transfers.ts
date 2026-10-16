import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'
export type AccountTransfer={
 id:string;organization_id:string;from_account_id:string;to_account_id:string;
 transfer_date:string;accounting_period:string;amount:string|number;
 reference:string|null;reason:string|null
}
export type AccountTransferReversal={
 transfer_id:string;organization_id:string;reversal_date:string;reason:string
}
export const TRANSFER_PAGE_SIZE=25
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const date=/^\d{4}-(0[1-9]|1[0-2])-([012][0-9]|3[01])$/
export async function loadAccountTransferPage(client:SupabaseClient,org:string,page:number,signal:AbortSignal){
 if(!uuid.test(org)||!Number.isSafeInteger(page)||page<0||page>10000)
  throw Error('Invalid account transfer page')
 const {data,error}=await client.from('financial_account_transfers')
  .select('id,organization_id,from_account_id,to_account_id,transfer_date,accounting_period,amount,reference,reason')
  .eq('organization_id',org).order('transfer_date',{ascending:false})
  .order('id',{ascending:false}).range(page*TRANSFER_PAGE_SIZE,(page+1)*TRANSFER_PAGE_SIZE)
  .abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>TRANSFER_PAGE_SIZE+1)
  throw Error('Account transfers truncated')
 const seen=new Set<string>()
 for(const row of data as AccountTransfer[]){
  if(row.organization_id!==org||!uuid.test(row.id)||!uuid.test(row.from_account_id)||
   !uuid.test(row.to_account_id)||row.from_account_id===row.to_account_id||
   seen.has(row.id)||!date.test(row.transfer_date)||!date.test(row.accounting_period)||
   row.accounting_period!==row.transfer_date.slice(0,7)+'-01'||
   checkedSigned(row.amount)<=0)throw Error('Invalid tenant transfer row')
  seen.add(row.id)
 }
 const rows=(data as AccountTransfer[]).slice(0,TRANSFER_PAGE_SIZE)
 if(rows.length===0)return {rows,reversals:[] as AccountTransferReversal[],hasNext:false}
 const reversals=await client.from('financial_account_transfer_reversals')
  .select('transfer_id,organization_id,reversal_date,reason')
  .eq('organization_id',org).in('transfer_id',rows.map(x=>x.id))
  .limit(TRANSFER_PAGE_SIZE+1).abortSignal(signal)
 if(reversals.error)throw reversals.error
 if(!Array.isArray(reversals.data)||reversals.data.length>TRANSFER_PAGE_SIZE)
  throw Error('Transfer reversals truncated')
 const seenReversal=new Set<string>()
 for(const row of reversals.data as AccountTransferReversal[]){
  if(row.organization_id!==org||!rows.some(t=>t.id===row.transfer_id)||
   seenReversal.has(row.transfer_id)||!date.test(row.reversal_date)||
   typeof row.reason!=='string'||row.reason.length<1)
   throw Error('Invalid tenant transfer reversal row')
  seenReversal.add(row.transfer_id)
 }
 return {rows,reversals:reversals.data as AccountTransferReversal[],hasNext:data.length>TRANSFER_PAGE_SIZE}
}
