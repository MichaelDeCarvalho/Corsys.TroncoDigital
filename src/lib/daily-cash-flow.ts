import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'

export type DailyCashFlowRow={
 movement_day:string;received:string|number;paid:string|number;
 realized_net:string|number;member_receivables_due:string|number;
 institutional_receivables_due:string|number;institution_payables_due:string|number;
 projected_net:string|number
}
const datePattern=/^\d{4}-(0[1-9]|1[0-2])-([012][0-9]|3[01])$/
const utcDay=(day:string)=>{
 if(!datePattern.test(day))throw Error('Invalid date')
 const timestamp=Date.parse(day+'T00:00:00.000Z')
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==day)
  throw Error('Invalid calendar day')
 return timestamp
}
export function validateCashFlowRows(input:unknown,from:string,to:string):DailyCashFlowRow[]{
 const first=utcDay(from),last=utcDay(to),dayMs=86400000
 const expected=(last-first)/dayMs+1
 if(!Number.isSafeInteger(expected)||expected<1||expected>93)
  throw Error('Invalid cash flow date interval')
 if(!Array.isArray(input)||input.length!==expected)throw Error('Incomplete cash flow interval')
 const rows=input as DailyCashFlowRow[]
 const withinCent=(a:number,b:number)=>Math.abs(a-b)<0.011
 for(let i=0;i<rows.length;i++){
  const row=rows[i]
  if(!row||typeof row!=='object'||utcDay(row.movement_day)!==first+i*dayMs)
   throw Error('Out-of-sequence cash flow day')
  const received=checkedSigned(row.received),paid=checkedSigned(row.paid)
  const actual=checkedSigned(row.realized_net)
  const member=checkedSigned(row.member_receivables_due)
  const institutional=checkedSigned(row.institutional_receivables_due)
  const payables=checkedSigned(row.institution_payables_due)
  const projected=checkedSigned(row.projected_net)
  if(member<0||institutional<0||payables<0||
   !withinCent(actual,received-paid)||!withinCent(projected,member+institutional-payables))
   throw Error('Daily cash flow integrity mismatch')
 }
 return rows
}
export async function loadDailyCashFlow(client:SupabaseClient,org:string,from:string,to:string){
 const first=utcDay(from),last=utcDay(to)
 if(last<first||(last-first)/86400000>92)throw Error('Select a range of at most 93 days')
 const {data,error}=await client.rpc('read_tenant_daily_cash_flow',{
  p_organization_id:org,p_from_date:from,p_to_date:to,
 })
 if(error)throw error
 return validateCashFlowRows(data,from,to)
}
export function summarizeCashFlow(rows:DailyCashFlowRow[]){
 const totals={
  received:0,paid:0,realized:0,receivables:0,payables:0,projected:0,
 }
 for(const row of rows){
  totals.received+=checkedSigned(row.received)
  totals.paid+=checkedSigned(row.paid)
  totals.realized+=checkedSigned(row.realized_net)
  totals.receivables+=checkedSigned(row.member_receivables_due)+checkedSigned(row.institutional_receivables_due)
  totals.payables+=checkedSigned(row.institution_payables_due)
  totals.projected+=checkedSigned(row.projected_net)
 }
 return totals
}
