import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'
import type {BudgetCycle,BudgetKind} from './budget-report'
export type BudgetLine={kind:BudgetKind;item_id:string;period:string;amount:string;label:string}
export type BudgetDetail={cycle:BudgetCycle;lines:BudgetLine[];revision:string}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export async function loadBudgetDetail(client:SupabaseClient,org:string,cycle:string,signal:AbortSignal){
 const {data,error}=await client.rpc('read_tenant_budget_detail',{
  p_organization_id:org,p_cycle_id:cycle,
 }).abortSignal(signal)
 if(error)throw error
 const d=data as BudgetDetail|null
 if(!d||!d.cycle||d.cycle.id!==cycle||d.cycle.organization_id!==org||d.cycle.currency!=='BRL'||
  !['draft','published','closed'].includes(d.cycle.status)||typeof d.cycle.name!=='string'||
  !/^\d{4}-\d{2}-\d{2}$/.test(d.cycle.period_start)||!/^\d{4}-\d{2}-\d{2}$/.test(d.cycle.period_end)||
  !/^[0-9a-f]{32}$/.test(d.revision)||!Array.isArray(d.lines)||d.lines.length>400)
  throw Error('Invalid budget detail')
 const seen=new Set<string>()
 for(const row of d.lines){
  if(!row||!['account','fund'].includes(row.kind)||!uuid.test(row.item_id)||
   !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(row.period)||typeof row.label!=='string'||
   row.period<d.cycle.period_start||row.period>d.cycle.period_end||checkedSigned(row.amount)<0)
   throw Error('Invalid budget detail row')
  const key=`${row.kind}:${row.item_id}:${row.period}`
  if(seen.has(key))throw Error('Duplicate budget line')
  seen.add(key)
 }
 return d
}
