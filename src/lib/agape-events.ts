import type {SupabaseClient} from '@supabase/supabase-js'
import {agreementCents,agreementUUID} from './member-agreements'
export type AgapeInput={p_organization_id:string;p_category_id:string;p_name:string;p_event_date:string;p_due_date:string;p_default_amount:string;p_member_ids:string[]}
export type AgapePreview={organization_id:string;category_id:string;name:string;event_date:string;due_date:string;default_amount:string|number;
 participant_count:number;charge_count:number;total_amount:string|number;participants:{member_id:string;name:string;amount:string|number}[];existing_id:string|null;ready:boolean;fingerprint:string}
export async function previewAgape(client:SupabaseClient,input:AgapeInput){
 const r=await client.rpc('preview_agape_event',input);if(r.error)throw r.error
 const v=r.data as AgapePreview|null,n=input.p_member_ids.length,amount=agreementCents(input.p_default_amount)
 if(!v||v.organization_id!==input.p_organization_id||v.category_id!==input.p_category_id||v.name!==input.p_name.trim()||
  v.event_date!==input.p_event_date||v.due_date!==input.p_due_date||agreementCents(v.default_amount)!==amount||
  v.participant_count!==n||v.charge_count!==(amount>0?n:0)||agreementCents(v.total_amount)!==amount*n||
  !Array.isArray(v.participants)||v.participants.length!==n||new Set(v.participants.map(x=>x.member_id)).size!==n||
  v.participants.some(x=>!input.p_member_ids.includes(x.member_id)||typeof x.name!=='string'||agreementCents(x.amount)!==amount)||
  (v.existing_id!==null&&!agreementUUID.test(v.existing_id))||v.ready!==(v.existing_id===null)||!/^[a-f0-9]{64}$/.test(v.fingerprint))throw Error('Agape preview integrity failure')
 return v
}
export type AgapeEvent={id:string;organization_id:string;name:string;event_type:'agape';event_date:string;default_amount:string|number}
export async function loadAgapeEvents(client:SupabaseClient,org:string,page:number,signal:AbortSignal){
 const r=await client.from('events').select('id,organization_id,name,event_type,event_date,default_amount')
  .eq('organization_id',org).eq('event_type','agape').order('event_date',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+20).abortSignal(signal)
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length>21||r.data.some(x=>x.organization_id!==org||x.event_type!=='agape'||!agreementUUID.test(x.id)||typeof x.name!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.event_date)||agreementCents(x.default_amount)<0))throw Error('Invalid agape history')
 return {events:r.data.slice(0,20) as AgapeEvent[],hasNext:r.data.length>20}
}
export type AgapeParticipant={member_id:string;charged_amount:string|number;charge_id:string|null;open:number|null;canceled:boolean|null}
export async function loadAgapeParticipants(client:SupabaseClient,org:string,event:string,signal:AbortSignal):Promise<AgapeParticipant[]>{
 const r=await client.from('event_participants').select('organization_id,event_id,member_id,charged_amount,charge_id')
  .eq('organization_id',org).eq('event_id',event).order('member_id').limit(201).abortSignal(signal)
 if(r.error)throw r.error
 if(!Array.isArray(r.data)||r.data.length>200||new Set(r.data.map(x=>x.member_id)).size!==r.data.length||
  r.data.some(x=>x.organization_id!==org||x.event_id!==event||!agreementUUID.test(x.member_id)||
   (agreementCents(x.charged_amount)>0?!agreementUUID.test(x.charge_id):x.charge_id!==null)))throw Error('Invalid event participants')
 const chargeIds=r.data.map(x=>x.charge_id).filter((x):x is string=>x!==null)
 if(new Set(chargeIds).size!==chargeIds.length)throw Error('Duplicate event charge')
 if(!chargeIds.length)return r.data.map(x=>({...x,open:null,canceled:null}))
 const balances=await client.from('v_charge_balances').select('charge_id,organization_id,member_id,open_amount,is_cancelled,integrity_ok')
  .eq('organization_id',org).in('charge_id',chargeIds).limit(201).abortSignal(signal)
 if(balances.error)throw balances.error
 if(!Array.isArray(balances.data)||balances.data.length!==chargeIds.length||new Set(balances.data.map(x=>x.charge_id)).size!==chargeIds.length||
  balances.data.some(x=>x.organization_id!==org||!chargeIds.includes(x.charge_id)||!r.data.some(p=>p.charge_id===x.charge_id&&p.member_id===x.member_id)||
   x.integrity_ok!==true||typeof x.is_cancelled!=='boolean'||agreementCents(x.open_amount)<0))throw Error('Event balances inconsistent')
 return r.data.map(x=>{const b=balances.data.find(y=>y.charge_id===x.charge_id);return {...x,open:b?agreementCents(b.open_amount)/100:null,canceled:b?.is_cancelled??null}})
}
