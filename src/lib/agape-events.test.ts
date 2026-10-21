import type {SupabaseClient} from '@supabase/supabase-js'
import {it,expect,vi} from 'vitest'
import {loadAgapeParticipants} from './agape-events'
const member='d5842ad6-913d-4a3e-8250-876fb2e2a215',id='11111111-1111-4111-8111-111111111111'
function fixture(free=false,foreign=false){
 const from=vi.fn((table:string)=>{
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,abortSignal:async()=>({error:null,data:table==='event_participants'?
   [{organization_id:'org',event_id:id,member_id:member,charged_amount:free?0:1.25,charge_id:free?null:id}]:
   [{charge_id:id,organization_id:foreign?'other':'org',member_id:member,open_amount:0,is_cancelled:true,integrity_ok:true}]})};return q
 });return {client:{from} as unknown as SupabaseClient,from}
}
it('distinguishes canceled debt from free attendance without reading a nonexistent charge',async()=>{
 const f=fixture();expect((await loadAgapeParticipants(f.client,'org',id,new AbortController().signal))[0]).toMatchObject({canceled:true,open:0})
 const free=fixture(true);expect((await loadAgapeParticipants(free.client,'org',id,new AbortController().signal))[0]).toMatchObject({charge_id:null,canceled:null,open:null})
 expect(free.from).not.toHaveBeenCalledWith('v_charge_balances')
})
it('rejects a charge balance from another organization',async()=>{
 await expect(loadAgapeParticipants(fixture(false,true).client,'org',id,new AbortController().signal)).rejects.toThrow('Event balances inconsistent')
})
