import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedSigned } from './treasury-balances'

export type BudgetKind='account'|'fund'
export type BudgetCycle={id:string;organization_id:string;name:string;status:string;period_start:string;period_end:string;currency:string}
export type BudgetAccount={id:string;organization_id:string;code:string;description:string;nature:string}
export type BudgetFund={id:string;organization_id:string;name:string}
export type BudgetRow={organization_id:string;budget_cycle_id:string;period:string;
 accounting_account_id?:string;fund_id?:string;
 budget_amount:string|number;actual_amount:string|number;
 remaining_amount?:string|number;available_amount?:string|number}
export function validMonth(value:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('Invalid budget competence')
 return value+'-01'
}
export async function loadBudgetCatalog(client:SupabaseClient,org:string,signal:AbortSignal){
 const [cycles,accounts,funds]=await Promise.all([
  client.from('budget_cycles').select('id,organization_id,name,status,period_start,period_end,currency')
   .eq('organization_id',org).order('period_start',{ascending:false}).limit(101).abortSignal(signal),
  client.from('accounting_accounts').select('id,organization_id,code,description,nature')
   .eq('organization_id',org).limit(301).abortSignal(signal),
  client.from('funds').select('id,organization_id,name')
   .eq('organization_id',org).order('name').limit(101).abortSignal(signal),
 ])
 if(cycles.error)throw cycles.error
 if(accounts.error)throw accounts.error
 if(funds.error)throw funds.error
 if(!Array.isArray(cycles.data)||!Array.isArray(accounts.data)||!Array.isArray(funds.data)||
  cycles.data.length>100||accounts.data.length>300||funds.data.length>100||
  cycles.data.some(c=>c.organization_id!==org||typeof c.id!=='string'||typeof c.name!=='string'||
   !/^\d{4}-\d{2}-\d{2}$/.test(c.period_start)||!/^\d{4}-\d{2}-\d{2}$/.test(c.period_end))||
  accounts.data.some(a=>a.organization_id!==org||typeof a.id!=='string'||typeof a.code!=='string')||
  funds.data.some(f=>f.organization_id!==org||typeof f.id!=='string'))throw Error('Invalid budget tenant catalog')
 return {cycles:cycles.data as BudgetCycle[],accounts:accounts.data as BudgetAccount[],funds:funds.data as BudgetFund[]}
}
export async function loadBudgetLines(client:SupabaseClient,org:string,cycle:string,month:string,kind:BudgetKind,
 catalog:Awaited<ReturnType<typeof loadBudgetCatalog>>,signal:AbortSignal){
 const period=validMonth(month)
 const selected=catalog.cycles.find(c=>c.id===cycle&&c.organization_id===org)
 if(!selected)throw Error('Unknown budget cycle')
 if(period<selected.period_start||period>selected.period_end)throw Error('Period outside budget cycle')
 const accountIds=new Set(catalog.accounts.map(a=>a.id))
 const fundIds=new Set(catalog.funds.map(f=>f.id))
 const isAccount=kind==='account'
 const source=isAccount?'v_accounting_budget_vs_actual':'v_fund_budget_vs_actual'
 const columns=[
  'organization_id','budget_cycle_id','period',
  isAccount?'accounting_account_id':'fund_id',
  'budget_amount','actual_amount',isAccount?'remaining_amount':'available_amount',
 ].join(',')
 const {data,error}=await client.from(source).select(columns)
  .eq('organization_id',org).eq('budget_cycle_id',cycle).eq('period',period)
  .limit(401).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>400)throw Error('Budget result truncated')
 for(const raw of data){
  const row=raw as BudgetRow
  if(!row||row.organization_id!==org||row.budget_cycle_id!==cycle||row.period!==period||
    (isAccount?!accountIds.has(row.accounting_account_id??''):!fundIds.has(row.fund_id??'')))
   throw Error('Unexpected budget scope or account')
  const budget=checkedSigned(row.budget_amount),actual=checkedSigned(row.actual_amount)
  const remaining=checkedSigned(isAccount?row.remaining_amount!:row.available_amount!)
  if(budget<0||actual<0||Math.abs(budget-actual-remaining)>0.01)
   throw Error('Budget amounts inconsistent')
 }
 return data as BudgetRow[]
}
