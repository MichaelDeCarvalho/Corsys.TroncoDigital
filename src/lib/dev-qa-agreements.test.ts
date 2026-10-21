import type {SupabaseClient} from '@supabase/supabase-js'
import {it,expect,vi} from 'vitest'
import {runAgreementHTTPQA} from './dev-qa-agreements'
it('recovers a committed original after a lost response, cancels it and restores transport',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
 const base=globalThis.fetch,id='11111111-1111-4111-8111-111111111111';let created=false,canceled=false
 const rpc=vi.fn(async(name:string)=>{
  if(name==='create_manual_charge'){created=true;throw Error('response lost')}
  if(name==='cancel_member_charge_idempotent'){canceled=true;return {data:id,error:null}}
  throw Error('Unexpected mutation')
 })
 const from=(table:string)=>{
  const q={select:()=>q,eq:()=>q,limit:()=>q,then:(resolve:(r:unknown)=>void)=>{
   let data:unknown[]=[]
   if(table==='organizations'||table==='financial_categories')data=[{id}]
   if(table==='v_financial_account_balances')data=[{balance:10}]
   if(table==='charges'&&created)data=[{id}]
   if(table==='v_charge_balances')data=[{is_cancelled:canceled,open_amount:0,integrity_ok:true}]
   resolve({data,error:null})
  }};return q
 }
 const c={auth:{getUser:async()=>({data:{user:{id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'}},error:null})},rpc,from} as unknown as SupabaseClient
 try{
  await expect(runAgreementHTTPQA(c,vi.fn())).rejects.toThrow('response lost')
  expect(canceled).toBe(true);expect(globalThis.fetch).toBe(base)
  expect(rpc.mock.calls.map(([name])=>name)).toEqual(['create_manual_charge','cancel_member_charge_idempotent'])
 }finally{vi.useRealTimers()}
})
