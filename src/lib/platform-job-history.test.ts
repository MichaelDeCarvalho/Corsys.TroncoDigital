import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import {
  loadPlatformJobPage, PLATFORM_JOB_PAGE_SIZE,
  type PlatformJobFilters, type JobCursor,
} from './platform-job-history'

const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherOrg='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const filters:PlatformJobFilters={status:'',jobType:'',organizationId:''}
const stamp='2026-11-10T15:22:15.123456+00:00'
function job(i:number,other:Record<string,unknown>={}){
  return {
    id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,
    organization_id:org,job_type:'generate_invoice',status:'failed',
    attempts:2,max_attempts:3,correlation_id:null,last_error_code:'SMTP_TIMEOUT',
    created_at:stamp,locked_at:null,completed_at:null,...other
  }
}
function makeClient(rows:unknown[],error:unknown=null){
  const operations:Array<[string,...unknown[]]>=[]
  const q:any={
    select:(...args:unknown[])=>{operations.push(['select',...args]);return q},
    eq:(...args:unknown[])=>{operations.push(['eq',...args]);return q},
    or:(...args:unknown[])=>{operations.push(['or',...args]);return q},
    order:(...args:unknown[])=>{operations.push(['order',...args]);return q},
    limit:(...args:unknown[])=>{operations.push(['limit',...args]);return q},
    abortSignal:(...args:unknown[])=>{
      operations.push(['abortSignal',...args])
      return Promise.resolve({data:rows,error})
    }
  }
  const from=vi.fn(()=>q)
  return {client:{from} as unknown as SupabaseClient,from,operations}
}
const signal=new AbortController().signal

describe('Master platform job history keyset reader',()=>{
  it('filters status, type and Loja, with stable dual-column descending order and no payload fields',async()=>{
    const m=makeClient([job(1)])
    const f:PlatformJobFilters={status:'failed',jobType:'generate_invoice',organizationId:org}
    const result=await loadPlatformJobPage(m.client,f,null,signal)
    expect(result.rows).toHaveLength(1)
    expect(result.next).toBeNull()
    expect(m.from).toHaveBeenCalledWith('saas_jobs')
    expect(m.operations).toContainEqual(['eq','status','failed'])
    expect(m.operations).toContainEqual(['eq','job_type','generate_invoice'])
    expect(m.operations).toContainEqual(['eq','organization_id',org])
    expect(m.operations).toContainEqual(['order','created_at',{ascending:false}])
    expect(m.operations).toContainEqual(['order','id',{ascending:false}])
    expect(m.operations).toContainEqual(['limit',PLATFORM_JOB_PAGE_SIZE+1])
    const fields=String(m.operations.find(x=>x[0]==='select')?.[1]??'')
    expect(fields).not.toContain('sanitized_payload')
    expect(fields).not.toContain('idempotency_key')
  })

  it('exposes the next cursor at the 25th row preserving all microseconds',async()=>{
    const records=Array.from({length:26},(_,i)=>job(i+1))
    const m=makeClient(records)
    const result=await loadPlatformJobPage(m.client,filters,null,signal)
    expect(result.rows).toHaveLength(25)
    expect(result.next).toEqual({created_at:stamp,id:records[24].id})
    const m2=makeClient([job(26)])
    await loadPlatformJobPage(m2.client,filters,result.next!,signal)
    expect(m2.operations).toContainEqual(['or',
      `created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${records[24].id})`])
  })

  it('rejects invalid filters or cursor before querying',async()=>{
    for(const [f,c] of [
      [{...filters,organizationId:'not-a-uuid'},null],
      [{...filters,status:'completed'},null],
      [{...filters,jobType:'custom_sql'},null],
      [filters,{created_at:'2026-11-10T15:00:00Z);status.eq.failed',id:job(1).id}],
      [filters,{created_at:stamp,id:'not-a-uuid'}],
    ] as Array<[PlatformJobFilters,JobCursor|null]>) {
      const m=makeClient([])
      await expect(loadPlatformJobPage(m.client,f,c,signal)).rejects.toThrow()
      expect(m.from).not.toHaveBeenCalled()
    }
  })

  it('rejects incomplete, duplicate, cross-tenant or inconsistent server results',async()=>{
    const cases=[
      Array.from({length:27},(_,i)=>job(i+1)),
      [job(1),job(1)],
      [job(1,{organization_id:otherOrg})],
      [job(1,{status:'completed'})],
      [job(1,{attempts:-1})],
      [job(1,{last_error_code:'sensitive error message with spaces'})],
      [job(1,{created_at:'invalid'})],
    ]
    for(const rows of cases){
      const m=makeClient(rows)
      await expect(loadPlatformJobPage(m.client,
        {...filters,organizationId:org},null,signal)).rejects.toThrow()
    }
  })

  it('fails closed when RLS denies access, without reporting an empty history',async()=>{
    const m=makeClient([],{code:'42501',message:'denied'})
    await expect(loadPlatformJobPage(m.client,filters,null,signal)).rejects.toMatchObject({code:'42501'})
  })

  it('allows empty pages and standalone platform-wide jobs without a tenant filter',async()=>{
    const empty=await loadPlatformJobPage(makeClient([]).client,filters,null,signal)
    expect(empty).toEqual({rows:[],next:null})
    const global=await loadPlatformJobPage(makeClient([job(1,{organization_id:null})]).client,filters,null,signal)
    expect(global.rows[0].organization_id).toBeNull()
  })
})
