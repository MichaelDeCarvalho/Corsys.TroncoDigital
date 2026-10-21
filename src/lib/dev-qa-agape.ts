import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQARows as rows,assertQAUUID as uuid,assertQADenied as denied} from './dev-qa-gates'
import {assertLegacyConflict} from './dev-qa-legacy'
import {agreementCents} from './member-agreements'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',member:'d5842ad6-913d-4a3e-8250-876fb2e2a215',category:'df01dcfa-707c-4861-a9fb-719e7ec21f65'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',member:'23bdcd76-b7a2-47b5-9f65-267d4c1053be',category:'0bef3ce2-f77a-4e29-85f6-37e737630d1d'},
]
export async function runAgapeHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const u=await c.auth.getUser(),f=fixtures.find(x=>x.actor===u.data.user?.id),date=new Date().toISOString().slice(0,10)
 if(u.error||!f||date.slice(0,7)!=='2026-10')throw Error('Agape QA identity/period absent')
 const other=fixtures.find(x=>x!==f)!,period='2026-10-01',tag=`DEV QA AGAPE HTTP ${f.label} ${date.replaceAll('-','')}`
 const nextDay=new Date(date+'T12:00:00Z');nextDay.setUTCDate(nextDay.getUTCDate()+1)
 rows(await c.from('organizations').select('id').eq('id',f.org).eq('name',`DEV QA FINANCE ${f.label} 20261015`),1)
 for(const kind of ['paid','free'])rows(await c.from('events').select('id').eq('organization_id',f.org).eq('name',tag+' '+kind).eq('event_date',date),0)
 for(const table of ['events','event_participants'])rows(await c.from(table).select('organization_id').eq('organization_id',other.org).limit(1),0)
 const cash=async()=>{const r=await c.from('v_financial_account_balances').select('balance').eq('organization_id',f.org);if(r.error||!Array.isArray(r.data)||r.data.reduce((s,x)=>s+Number(x.balance),0)!==10)throw Error('Agape QA cash changed')}
 await cash();const base=globalThis.fetch,traces:{name:string;status:number;code:string|null}[]=[];let expected=0
 globalThis.fetch=async(input,init)=>{
  const response=await base(input,init),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.origin==='https://szqkdekwhzxsoxorgvaz.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){
   const b=await response.clone().json().catch(()=>null);traces.push({name:url.pathname.split('/').pop()!,status:response.status,code:typeof b?.code==='string'?b.code:null})
  }return response
 }
 const rpc=(name:string,args:Record<string,unknown>)=>{expected++;return c.rpc(name,args)}
 try{
  for(const kind of ['paid','free']){
   const amount=kind==='paid'?'1.25':'0.00',name=tag+' '+kind
   try{
    const input={p_organization_id:f.org,p_category_id:f.category,p_name:name,p_event_date:date,p_due_date:nextDay.toISOString().slice(0,10),p_default_amount:amount,p_member_ids:[f.member]}
    denied(await rpc('preview_agape_event',{...input,p_organization_id:other.org}),['42501'])
    denied(await rpc('preview_agape_event',{...input,p_member_ids:[other.member]}),['23503'])
    const r=await rpc('preview_agape_event',input),p=r.data
    if(r.error||!p||p.organization_id!==f.org||p.participant_count!==1||p.charge_count!==(kind==='paid'?1:0)||!p.ready||p.existing_id!==null||agreementCents(p.total_amount)!==agreementCents(amount)||!/^[a-f0-9]{64}$/.test(p.fingerprint))throw Error('Agape QA preview invalid')
    const args={...input,p_expected_fingerprint:p.fingerprint,p_reason:name,p_idempotency_key:crypto.randomUUID()}
    assertLegacyConflict(await rpc('create_agape_event',{...args,p_expected_fingerprint:'0'.repeat(64)}))
    const replay=await Promise.all([rpc('create_agape_event',args),rpc('create_agape_event',args)]),event=uuid(replay[0])
    if(uuid(replay[1])!==event)throw Error('Agape replay mismatch')
    denied(await rpc('create_agape_event',{...args,p_reason:name+' changed'}),['22023'])
    assertLegacyConflict(await rpc('create_agape_event',{...args,p_idempotency_key:crypto.randomUUID()}))
    rows(await c.from('audit_logs').select('entity_id').eq('organization_id',f.org).eq('entity_id',event).eq('action','agape.create'),1)
    const participant=rows(await c.from('event_participants').select('member_id,charged_amount,charge_id').eq('organization_id',f.org).eq('event_id',event),1)[0]
    if(participant.member_id!==f.member||agreementCents(participant.charged_amount)!==agreementCents(amount)||(kind==='free'&&participant.charge_id!==null))throw Error('Agape participant scope/amount mismatch')
    if(kind==='paid')rows(await c.from('charges').select('id').eq('organization_id',f.org).eq('id',participant.charge_id).eq('member_id',f.member).eq('source_kind','event').eq('generation_key',`agape:${event}:${f.member}`),1)
    const after=await rpc('preview_agape_event',input)
    if(after.error||after.data?.ready!==false||after.data?.existing_id!==event)throw Error('Agape duplicate history absent')
    report(`Agape ${kind}: replay, PT409/409, payload divergence, scope/member denials, unique participant/audit PASS`)
   }finally{
    const found=await c.from('events').select('id').eq('organization_id',f.org).eq('name',name).eq('event_date',date)
    const events=rows(found,Array.isArray(found.data)?found.data.length:-1);if(events.length>1)throw Error('Agape cleanup event scope exceeded')
    if(events.length){
     const participants=rows(await c.from('event_participants').select('member_id,charge_id').eq('organization_id',f.org).eq('event_id',events[0].id),1)
     if(participants[0].member_id!==f.member)throw Error('Agape cleanup participant changed')
     const charge=participants[0].charge_id
     if(charge!==null){
      const id=uuid({data:charge,error:null}),before=rows(await c.from('v_charge_balances').select('is_cancelled,allocated_amount').eq('organization_id',f.org).eq('charge_id',id),1)[0]
      if(Number(before.allocated_amount)!==0)throw Error('Agape cleanup must not touch allocations')
      if(before.is_cancelled!==true)uuid(await rpc('cancel_member_charge_idempotent',{p_organization_id:f.org,p_charge_id:id,p_accounting_period:period,p_reason:name+' cleanup',p_idempotency_key:crypto.randomUUID()}))
      const after=rows(await c.from('v_charge_balances').select('is_cancelled,open_amount,integrity_ok').eq('organization_id',f.org).eq('charge_id',id),1)[0]
      if(after.is_cancelled!==true||Number(after.open_amount)!==0||after.integrity_ok!==true)throw Error('Agape cleanup unconfirmed')
     }else if(kind==='paid')throw Error('Paid event has no charge')
    }
   }
  }
  await cash();if(traces.length!==expected||!traces.some(x=>x.name==='create_agape_event'&&x.status===409&&x.code==='PT409'))throw Error('Agape HTTP retry/conflict trace invalid')
  report(`Agape HTTP ${f.label}: ${expected} calls / ${traces.length} requests; paid charge canceled, free attendance without debt, cash10 PASS`)
 }finally{globalThis.fetch=base}
}
