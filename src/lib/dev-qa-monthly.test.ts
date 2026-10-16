import type {SupabaseClient} from '@supabase/supabase-js'
import {vi,expect,it} from 'vitest'
import {assertQAMonthlyRace} from './dev-qa-gates'
import {runMonthlyHTTPQA} from './dev-qa-monthly'
const id='a4dec375-abec-4f42-bdf7-23597e2376b3',org='94b84958-4dd9-435d-9a4e-244220835d70'
it('requires same UUID for simultaneous replay and exactly one 40001 loser for distinct keys',()=>{
 expect(assertQAMonthlyRace([{data:id,error:null},{data:id,error:null}],true)).toBe(id)
 expect(assertQAMonthlyRace([{data:id,error:null},{data:null,error:{code:'PT409'}}],false)).toBe(id)
 for(const loser of ['23505','42501','transport'])expect(()=>assertQAMonthlyRace([{data:id,error:null},{data:null,error:{code:loser}}],false)).toThrow()
 expect(()=>assertQAMonthlyRace([{data:id,error:null},{data:id,error:null}],false)).toThrow()
 expect(()=>assertQAMonthlyRace([{data:id,error:null},{data:org,error:null}],true)).toThrow()
})
it('restores inactive QA rule when preview fails before creating any obligation',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T12:00:00Z'))
 let active=false
 const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
  if(name==='set_tenant_institutional_monthly_rule_status'){active=Boolean(args.p_active);return {data:id,error:null}}
  return {data:null,error:{code:'NETWORK'}}
 })
 const from=(table:string)=>{
  const filters:Record<string,unknown>={}
  const q={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q},in:()=>q,then:(resolve:(r:unknown)=>void)=>{
   let data:unknown[]=[]
   if(table==='organizations')data=[{id:org}]
   if(table==='v_financial_account_balances')data=[{balance:10}]
   if(table==='institutional_recurring_rules'&&filters.organization_id===org){
    if(filters.id===id)data=[{id,name:'DEV QA MONTHLY A EXPENSE 20261016',active,direction:'payable',frequency:'monthly'}]
    else data=[{id:filters.id,name:'DEV QA MONTHLY A REVENUE 20261016',active:false,direction:'receivable',frequency:'monthly'}]
   }
   resolve({data,error:null})
  }};return q
 }
 const c={auth:{getUser:async()=>({data:{user:{id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'}},error:null})},from,rpc} as unknown as SupabaseClient
 try{
  await expect(runMonthlyHTTPQA(c,vi.fn())).rejects.toThrow('Monthly preview invalid')
  expect(active).toBe(false)
  expect(rpc.mock.calls.filter(([name])=>name==='set_tenant_institutional_monthly_rule_status')).toHaveLength(2)
  await expect(runMonthlyHTTPQA(c,vi.fn())).rejects.toThrow('Monthly preview invalid')
  const cleanupKeys=rpc.mock.calls.filter(([name,args])=>name==='set_tenant_institutional_monthly_rule_status'&&args.p_active===false).map(([,args])=>args.p_idempotency_key)
  expect(cleanupKeys).toHaveLength(2);expect(new Set(cleanupKeys).size).toBe(2);expect(active).toBe(false)
 }finally{vi.useRealTimers()}
})
