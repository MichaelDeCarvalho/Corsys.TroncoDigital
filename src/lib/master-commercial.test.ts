import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {loadPlanVersionEntitlements} from './master-commercial'

const versionA='faaf76e4-d796-430f-929f-71df5beaf832'
const versionB='11111111-1111-4111-8111-111111111111'

function makeEntitlementClient(response:{data:unknown;error:unknown}){
 const abortSignal=vi.fn().mockResolvedValue(response)
 const limit=vi.fn(()=>({abortSignal}))
 const eq=vi.fn(()=>({limit}))
 const select=vi.fn(()=>({eq,limit}))
 const from=vi.fn(()=>({select}))
 return {
  client:{from} as unknown as SupabaseClient,
  from,
  select,
  eq,
  limit,
  abortSignal,
 }
}

describe('loadPlanVersionEntitlements fail-closed integrity',()=>{
 it('reads matching entitlements with explicit projection and limit(201)',async()=>{
  const stub=makeEntitlementClient({
   data:[
    {plan_version_id:versionA,entitlement_key:'members_max',entitlement_value:250},
    {plan_version_id:versionA,entitlement_key:'api_access',entitlement_value:true},
   ],
   error:null,
  })
  const controller=new AbortController()
  const result=await loadPlanVersionEntitlements(stub.client,versionA,controller.signal)
  expect(result).toEqual({members_max:250,api_access:true})
  expect(stub.from).toHaveBeenCalledWith('saas_plan_version_entitlements')
  expect(stub.select).toHaveBeenCalledWith('plan_version_id,entitlement_key,entitlement_value')
  expect(stub.eq).toHaveBeenCalledWith('plan_version_id',versionA)
  expect(stub.limit).toHaveBeenCalledWith(201)
  expect(stub.abortSignal).toHaveBeenCalledWith(controller.signal)
 })

 it('returns empty object when no entitlements exist for the version',async()=>{
  const stub=makeEntitlementClient({data:[],error:null})
  const result=await loadPlanVersionEntitlements(stub.client,versionA,new AbortController().signal)
  expect(result).toEqual({})
 })

 it('fails closed on mixed plan_version_id rows instead of silently skipping foreign rows',async()=>{
  const stub=makeEntitlementClient({
   data:[
    {plan_version_id:versionA,entitlement_key:'members_max',entitlement_value:200},
    {plan_version_id:versionB,entitlement_key:'members_max',entitlement_value:999},
   ],
   error:null,
  })
  await expect(
   loadPlanVersionEntitlements(stub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Mismatched plan version entitlement row')
 })

 it('fails closed when plan_version_id is missing or non-string',async()=>{
  const stub=makeEntitlementClient({
   data:[{entitlement_key:'members_max',entitlement_value:200}],
   error:null,
  })
  await expect(
   loadPlanVersionEntitlements(stub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Mismatched plan version entitlement row')
 })

 it('fails closed on invalid, prototype-polluting, or duplicate entitlement keys',async()=>{
  const badKeyStub=makeEntitlementClient({
   data:[{plan_version_id:versionA,entitlement_key:'__proto__',entitlement_value:{polluted:true}}],
   error:null,
  })
  await expect(
   loadPlanVersionEntitlements(badKeyStub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Untrusted plan entitlement key or value')

  const blankKeyStub=makeEntitlementClient({
   data:[{plan_version_id:versionA,entitlement_key:' members_max',entitlement_value:10}],
   error:null,
  })
  await expect(
   loadPlanVersionEntitlements(blankKeyStub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Untrusted plan entitlement key or value')

  const duplicateStub=makeEntitlementClient({
   data:[
    {plan_version_id:versionA,entitlement_key:'members_max',entitlement_value:100},
    {plan_version_id:versionA,entitlement_key:'members_max',entitlement_value:200},
   ],
   error:null,
  })
  await expect(
   loadPlanVersionEntitlements(duplicateStub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Duplicate plan entitlement key')
 })

 it('fails closed on partial/truncated payloads (>200 rows) or invalid version UUID',async()=>{
  const rows=Array.from({length:201},(_,index)=>({
   plan_version_id:versionA,
   entitlement_key:`feature_${index}`,
   entitlement_value:true,
  }))
  const truncatedStub=makeEntitlementClient({data:rows,error:null})
  await expect(
   loadPlanVersionEntitlements(truncatedStub.client,versionA,new AbortController().signal),
  ).rejects.toThrow('Plan entitlements payload incomplete')

  await expect(
   loadPlanVersionEntitlements(truncatedStub.client,'not-a-uuid',new AbortController().signal),
  ).rejects.toThrow('Invalid plan version id')
 })
})
