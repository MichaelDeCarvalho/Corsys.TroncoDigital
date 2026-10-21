import type {SupabaseClient} from '@supabase/supabase-js'
import {it,expect,vi} from 'vitest'
import {runAgapeHTTPQA} from './dev-qa-agape'
it('recovers an event committed before a lost response and cancels only its unallocated charge',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
 const base=globalThis.fetch,id='11111111-1111-4111-8111-111111111111',member='d5842ad6-913d-4a3e-8250-876fb2e2a215';let created=false,canceled=false
 const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
  if(name==='preview_agape_event'){
   if(args.p_organization_id!=='94b84958-4dd9-435d-9a4e-244220835d70')return {data:null,error:{code:'42501'}}
   if((args.p_member_ids as string[])[0]!==member)return {data:null,error:{code:'23503'}}
   return {data:{organization_id:args.p_organization_id,participant_count:1,charge_count:1,ready:true,existing_id:null,total_amount:1.25,fingerprint:'a'.repeat(64)},error:null}
  }
  if(name==='create_agape_event'){
   if(args.p_expected_fingerprint==='0'.repeat(64))return {data:null,error:{code:'PT409'},status:409}
   created=true;throw Error('response lost')
  }
  if(name==='cancel_member_charge_idempotent'){canceled=true;return {data:id,error:null}}
  throw Error('Unexpected mutation')
 })
 const from=(table:string)=>{
  const q={select:()=>q,eq:()=>q,limit:()=>q,then:(resolve:(r:unknown)=>void)=>{
   let data:unknown[]=[]
   if(table==='organizations')data=[{id}]
   if(table==='v_financial_account_balances')data=[{balance:10}]
   if(table==='events'&&created)data=[{id}]
   if(table==='event_participants'&&created)data=[{member_id:member,charge_id:id}]
   if(table==='v_charge_balances')data=[{is_cancelled:canceled,allocated_amount:0,open_amount:0,integrity_ok:true}]
   resolve({data,error:null})
  }};return q
 }
 const c={auth:{getUser:async()=>({data:{user:{id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'}},error:null})},from,rpc} as unknown as SupabaseClient
 try{await expect(runAgapeHTTPQA(c,vi.fn())).rejects.toThrow('response lost');expect(canceled).toBe(true);expect(globalThis.fetch).toBe(base)}finally{vi.useRealTimers()}
})
