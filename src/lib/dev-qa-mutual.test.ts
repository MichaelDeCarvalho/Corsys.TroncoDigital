import type {SupabaseClient} from '@supabase/supabase-js'
import {it,expect,vi} from 'vitest'
import {runMutualHTTPQA} from './dev-qa-mutual'
import {loadMutualAssignments} from './mutual-batches'
vi.mock('./mutual-batches',async original=>({...await original<typeof import('./mutual-batches')>(),loadMutualAssignments:vi.fn()}))
it('recovers committed batch on response loss and cancels only scoped unallocated charges',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
 const base=globalThis.fetch,id='11111111-1111-4111-8111-111111111111',member='d5842ad6-913d-4a3e-8250-876fb2e2a215',org='94b84958-4dd9-435d-9a4e-244220835d70';let created=false,canceled=false
 vi.mocked(loadMutualAssignments).mockImplementation(async()=>[{mutual_number:810,member_id:member,charge_id:id,open:canceled?0:1.25,canceled}])
 const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
  if(name==='preview_mutual_batch'){
   if(args.p_organization_id!==org)return {data:null,error:{code:'42501'}}
   if((args.p_assignments as {member_id:string}[])[0].member_id!==member)return {data:null,error:{code:'23503'}}
   return {data:{organization_id:org,category_id:args.p_category_id,number_start:810,number_end:811,unit_amount:1.25,competence:'2026-10-01',issue_date:'2026-10-21',due_date:'2026-10-21',assignments:[810,811].map(n=>({mutual_number:n,member_id:member,name:'QA',amount:1.25})),charge_count:2,total_amount:2.50,account_nature:'revenue',account_code:'3.1',existing_batch_id:null,ready:true,fingerprint:'a'.repeat(64)},error:null}
  }
  if(name==='create_mutual_batch'){if(args.p_expected_fingerprint==='0'.repeat(64))return {data:null,error:{code:'PT409'},status:409};created=true;throw Error('response lost')}
  if(name==='cancel_member_charge_idempotent'){canceled=true;return {data:id,error:null}}
  throw Error('Unexpected mutation')
 })
 const from=(table:string)=>{const q={select:()=>q,eq:()=>q,limit:()=>q,then:(resolve:(r:unknown)=>void)=>{
  let data:unknown[]=[];if(table==='organizations')data=[{id}];if(table==='v_financial_account_balances')data=[{balance:10}]
  if(table==='mutual_batches'&&created)data=[{id,organization_id:org,number_start:810,number_end:811,unit_amount:1.25,competence:'2026-10-01',notes:'QA'}]
  if(table==='v_charge_balances')data=[{allocated_amount:0}];resolve({data,error:null})
 }};return q}
 const c={auth:{getUser:async()=>({data:{user:{id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'}},error:null})},from,rpc} as unknown as SupabaseClient
 try{await expect(runMutualHTTPQA(c,vi.fn())).rejects.toThrow('response lost');expect(canceled).toBe(true);expect(globalThis.fetch).toBe(base)}finally{vi.useRealTimers()}
})
