import type {SupabaseClient} from '@supabase/supabase-js'
import {expect,it,vi} from 'vitest'
import {runAnnualHTTPQA} from './dev-qa-annual'
it('recovers a committed annual rule after losing its create response and deactivates it before propagating failure',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
 const originalFetch=globalThis.fetch,id='11111111-1111-4111-8111-111111111111';let created=false,active=false
 const rpc=vi.fn(async(name:string)=>{
  if(name==='create_tenant_institutional_annual_rule'){created=true;active=true;throw Error('response lost')}
  if(name==='set_tenant_institutional_annual_rule_status'){active=false;return {data:id,error:null}}
  throw Error('Unexpected QA mutation')
 })
 const from=(table:string)=>{
  const q={select:()=>q,eq:()=>q,limit:()=>q,then:(resolve:(r:unknown)=>void)=>{
   let data:unknown[]=[]
   if(table==='organizations')data=[{id:'94b84958-4dd9-435d-9a4e-244220835d70'}]
   if(table==='v_financial_account_balances')data=[{balance:10}]
   if(table==='institutional_recurring_rules'&&created)data=[{id,active}]
   resolve({data,error:null})
  }};return q
 }
 const c={auth:{getUser:async()=>({data:{user:{id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'}},error:null})},from,rpc} as unknown as SupabaseClient
 try{
  await expect(runAnnualHTTPQA(c,vi.fn())).rejects.toThrow('response lost')
  expect(active).toBe(false)
  expect(globalThis.fetch).toBe(originalFetch)
  expect(rpc.mock.calls.map(([name])=>name)).toEqual(['create_tenant_institutional_annual_rule','set_tenant_institutional_annual_rule_status'])
 }finally{vi.useRealTimers()}
})
