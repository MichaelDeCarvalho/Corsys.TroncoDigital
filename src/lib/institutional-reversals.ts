import type {SupabaseClient} from '@supabase/supabase-js'
import {exactPaymentAmount} from './member-payments'

export type MovementKind='payable_payment'|'institutional_receipt'
export type InstitutionalMovement={id:string;date:string;amount:string;reference:string|null;reversed:boolean;reason:string|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validMovementDate(value:string){
 return /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)&&value>='2020-01-01'&&
  Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
}
function scoped(result:{data:unknown;error:unknown},org:string):Record<string,unknown>[] {
 if(result.error)throw result.error
 if(!Array.isArray(result.data)||result.data.length>150)throw Error('Incomplete movement history')
 if(result.data.some(r=>!r||typeof r!=='object'||r.organization_id!==org))throw Error('Foreign movement data')
 return result.data
}
export async function loadInstitutionalMovements(client:SupabaseClient,org:string,kind:MovementKind,signal:AbortSignal):Promise<InstitutionalMovement[]>{
 const payable=kind==='payable_payment',date=payable?'payment_date':'receipt_date',fk=payable?'payment_id':'receipt_id'
 const facts=scoped(await client.from(payable?'institutional_payable_payments':'institutional_receipts')
  .select(`id,organization_id,${date},amount,reference`).eq('organization_id',org)
  .order(date,{ascending:false}).order('id').limit(151).abortSignal(signal),org)
 const ids=new Set<string>()
 const rows=facts.map(f=>{
  if(typeof f.id!=='string'||!uuid.test(f.id)||ids.has(f.id)||typeof f[date]!=='string'||!validMovementDate(f[date] as string)
   ||(f.reference!==null&&typeof f.reference!=='string')||!['string','number'].includes(typeof f.amount))throw Error('Invalid movement')
  ids.add(f.id)
  const amount=exactPaymentAmount(f.amount as string|number)
  if(Number(amount)<=0)throw Error('Invalid movement amount')
  return {id:f.id,date:f[date] as string,amount,reference:f.reference as string|null,reversed:false,reason:null} as InstitutionalMovement
 })
 if(!rows.length)return rows
 const reversals=scoped(await client.from(payable?'institutional_payable_payment_reversals':'institutional_receipt_reversals')
  .select(`${fk},organization_id,reversal_date,reason`).eq('organization_id',org).in(fk,[...ids])
  .limit(151).abortSignal(signal),org)
 const seen=new Set<string>()
 for(const r of reversals){
  const id=r[fk],row=rows.find(f=>f.id===id)
  if(typeof id!=='string'||!row||seen.has(id)||typeof r.reason!=='string'||!r.reason.trim()
   ||typeof r.reversal_date!=='string'||!validMovementDate(r.reversal_date)||r.reversal_date<row.date)throw Error('Invalid reversal history')
  seen.add(id);row.reversed=true;row.reason=r.reason
 }
 return rows
}
