import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {createDelinquencyCsv,loadDelinquencyExport,MAX_DELINQUENCY_EXPORT} from './delinquency-export'
import type {DelinquencyRow} from './delinquency-report'
const member=(index:number):DelinquencyRow=>({
 member_id:`test-member-${index}`,full_name:`Integrante ${index}`,member_status:'active',
 overdue_items:1,overdue_amount:'123.45',available_credit:'10.00',net_position:'113.45',
 oldest_due:'2026-10-01',
})
function fakeClient(rows:DelinquencyRow[]){
 const rpc=vi.fn().mockImplementation((_:string,params:{p_offset:number;p_limit:number})=>
  Promise.resolve({data:rows.slice(params.p_offset,params.p_offset+params.p_limit),error:null}))
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
describe('Private delinquency CSV export',()=>{
 it('neutralizes formula injection, embedded delimiters and control characters from member names',()=>{
  const data=createDelinquencyCsv([{...member(1),full_name:'  =HYPERLINK("https://invalid.test";"click")\r\n'}])
  expect(data.startsWith('\uFEFF')).toBe(true)
  expect(data).toContain('"\'=HYPERLINK(""https://invalid.test"";""click"")"')
  expect(data).not.toContain('"=HYPERLINK(')
  expect(data).toContain('"123,45"')
  expect(data).toContain('"10,00"')
  expect(data.split('\r\n').length).toBe(3)
 })
 it('exports every available page of a report rather than only currently displayed rows',async()=>{
  const {client,rpc}=fakeClient(Array.from({length:31},(_,i)=>member(i)))
  const rows=await loadDelinquencyExport(client,'org-a')
  expect(rows).toHaveLength(31)
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(rpc).toHaveBeenNthCalledWith(2,'read_tenant_delinquency',{
   p_organization_id:'org-a',p_limit:26,p_offset:25,
  })
 })
 it('aborts without exporting when the tenant changes',async()=>{
  const {client}=fakeClient([member(0)])
  await expect(loadDelinquencyExport(client,'org-a',()=>false)).rejects.toThrow('cancelada')
 })
 it('fails closed on duplicated member rows across changing pages',async()=>{
  const rows=Array.from({length:27},(_,i)=>member(i))
  const {client,rpc}=fakeClient(rows)
  rpc.mockResolvedValueOnce({data:rows.slice(0,26),error:null})
   .mockResolvedValueOnce({data:[rows[0]],error:null})
  await expect(loadDelinquencyExport(client,'org-a')).rejects.toThrow('duplicada')
 })
 it('fails closed when the report exceeds the security limit; no partial CSV',async()=>{
  const {client}=fakeClient(Array.from({length:MAX_DELINQUENCY_EXPORT+1},(_,i)=>member(i)))
  await expect(loadDelinquencyExport(client,'org-a')).rejects.toThrow('1.000 integrantes')
 })
 it('rejects invalid negative amounts instead of producing a dangerous financial file',()=>{
  expect(()=>createDelinquencyCsv([{...member(3),overdue_amount:'NaN'}])).toThrow()
  expect(()=>createDelinquencyCsv([{...member(3),available_credit:'-5.00'}])).toThrow()
 })
})
