import type { SupabaseClient } from '@supabase/supabase-js'

export type DreEntry = {
 accounting_period: string
 accounting_plan_id: string
 accounting_account_id: string
 account_code: string
 account_description: string
 nature: 'revenue'|'cost'|'expense'|'financial_result'
 operational_classification: string | null
 signed_amount: string | number
}
const month=/^\d{4}-(0[1-9]|1[0-2])$/
const date=/^\d{4}-(0[1-9]|1[0-2])-01$/
const money=/^-?\d{1,12}(\.\d{1,2})?$/
const natures=['revenue','cost','expense','financial_result']

export function toMonthStart(value:string){
 if(!month.test(value))throw Error('Competência inválida')
 return value+'-01'
}
export function safeDreValue(value:string|number):number {
 if(!money.test(String(value)))throw Error('Montante contábil inválido')
 const num=Number(value)
 if(!Number.isFinite(num))throw Error('Montante contábil inválido')
 return num
}
export async function loadDreReport(
 client:SupabaseClient,org:string,fromMonth:string,toMonth:string,
):Promise<DreEntry[]> {
 const from=toMonthStart(fromMonth),to=toMonthStart(toMonth)
 const start=Number(fromMonth.slice(0,4))*12+Number(fromMonth.slice(5))
 const end=Number(toMonth.slice(0,4))*12+Number(toMonth.slice(5))
 if(end<start||end-start>=12)throw Error('Escolha até 12 competências consecutivas.')
 const {data,error}=await client.rpc('read_tenant_dre',{
  p_organization_id:org,p_from_period:from,p_to_period:to,
 })
 if(error)throw error
 if(!Array.isArray(data)||data.length>1500)throw Error('Consulta contábil incompleta ou inválida')
 for(const row of data){
  if(!row||typeof row!=='object'|| !date.test(row.accounting_period)||
    row.accounting_period<from||row.accounting_period>to||
    !natures.includes(row.nature)||typeof row.accounting_plan_id!=='string'||
    typeof row.accounting_account_id!=='string'||typeof row.account_code!=='string'||
    typeof row.account_description!=='string')throw Error('Relatório contábil inconsistente')
  safeDreValue(row.signed_amount)
 }
 return data as DreEntry[]
}
export function summarizeDre(rows:DreEntry[]){
 const months=new Map<string,{revenue:number;expenses:number;result:number}>()
 for(const row of rows){
  const curr=months.get(row.accounting_period)??{revenue:0,expenses:0,result:0}
  const amount=safeDreValue(row.signed_amount)
  if(row.nature==='revenue')curr.revenue+=amount
  else curr.expenses+=amount
  curr.result+=amount
  months.set(row.accounting_period,curr)
 }
 return [...months.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,...amount}))
}
