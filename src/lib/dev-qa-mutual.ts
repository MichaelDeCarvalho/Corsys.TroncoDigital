import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQARows as rows,assertQAUUID as uuid,assertQADenied as denied} from './dev-qa-gates'
import {assertLegacyConflict} from './dev-qa-legacy'
import {previewMutualBatch,loadMutualAssignments,type MutualBatch} from './mutual-batches'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',member:'d5842ad6-913d-4a3e-8250-876fb2e2a215',category:'df01dcfa-707c-4861-a9fb-719e7ec21f65'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',member:'23bdcd76-b7a2-47b5-9f65-267d4c1053be',category:'0bef3ce2-f77a-4e29-85f6-37e737630d1d'},
]
export async function runMutualHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const user=await c.auth.getUser(),f=fixtures.find(x=>x.actor===user.data.user?.id),date=new Date().toISOString().slice(0,10)
 if(user.error||!f||date.slice(0,7)!=='2026-10')throw Error('Mutual QA identity/period absent')
 const other=fixtures.find(x=>x!==f)!,period='2026-10-01',tag=`DEV QA MUTUAL HTTP ${f.label} ${date.replaceAll('-','')}`
 rows(await c.from('organizations').select('id').eq('id',f.org).eq('name',`DEV QA FINANCE ${f.label} 20261015`),1)
 const lookup=()=>c.from('mutual_batches').select('id,organization_id,number_start,number_end,unit_amount,competence,notes').eq('organization_id',f.org).eq('number_start',810).eq('number_end',811).eq('competence',period).eq('notes',tag)
 rows(await lookup(),0)
 for(const table of ['mutual_batches','mutual_assignments'])rows(await c.from(table).select('organization_id').eq('organization_id',other.org).limit(1),0)
 const cash=async()=>{const r=await c.from('v_financial_account_balances').select('balance').eq('organization_id',f.org);if(r.error||!Array.isArray(r.data)||r.data.reduce((s,x)=>s+Number(x.balance),0)!==10)throw Error('Mutual QA cash changed')}
 await cash();const base=globalThis.fetch,traces:{name:string;status:number;code:string|null}[]=[];let expected=0
 globalThis.fetch=async(input,init)=>{const r=await base(input,init),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.origin==='https://szqkdekwhzxsoxorgvaz.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){const b=await r.clone().json().catch(()=>null);traces.push({name:url.pathname.split('/').pop()!,status:r.status,code:typeof b?.code==='string'?b.code:null})}return r}
 const rpc=(name:string,args:Record<string,unknown>)=>{expected++;return c.rpc(name,args)}
 try{
  try{
   const input={p_organization_id:f.org,p_category_id:f.category,p_number_start:810,p_number_end:811,p_unit_amount:'1.25',p_competence:period,p_issue_date:date,p_due_date:date,p_assignments:[810,811].map(n=>({mutual_number:n,member_id:f.member}))}
   denied(await rpc('preview_mutual_batch',{...input,p_organization_id:other.org}),['42501'])
   denied(await rpc('preview_mutual_batch',{...input,p_assignments:[810,811].map(n=>({mutual_number:n,member_id:other.member}))}),['23503'])
   expected++;const p=await previewMutualBatch(c,input);if(!p.ready)throw Error('Mutual range already used')
   const args={...input,p_expected_fingerprint:p.fingerprint,p_reason:tag,p_idempotency_key:crypto.randomUUID()}
   assertLegacyConflict(await rpc('create_mutual_batch',{...args,p_expected_fingerprint:'0'.repeat(64)}))
   const replay=await Promise.all([rpc('create_mutual_batch',args),rpc('create_mutual_batch',args)]),batch=uuid(replay[0]);if(uuid(replay[1])!==batch)throw Error('Mutual replay mismatch')
   denied(await rpc('create_mutual_batch',{...args,p_reason:tag+' changed'}),['22023'])
   assertLegacyConflict(await rpc('create_mutual_batch',{...args,p_idempotency_key:crypto.randomUUID()}))
   rows(await c.from('audit_logs').select('entity_id').eq('organization_id',f.org).eq('entity_id',batch).eq('action','mutual_batch.create'),1)
   const b=rows(await lookup(),1)[0] as MutualBatch,details=await loadMutualAssignments(c,f.org,b,new AbortController().signal)
   if(details.some(x=>x.member_id!==f.member||x.open!==1.25||x.canceled))throw Error('Mutual charge readback failed')
   report('Mutual: scope/member denials, exact cents, replay, payload divergence, PT409/409, audit and linked charges PASS')
  }finally{
   const found=await lookup(),batches=rows(found,Array.isArray(found.data)?found.data.length:-1);if(batches.length>1)throw Error('Mutual cleanup scope exceeded')
   if(batches.length){const b=batches[0] as MutualBatch,details=await loadMutualAssignments(c,f.org,b,new AbortController().signal)
    for(const a of details){if(a.member_id!==f.member)throw Error('Mutual cleanup member changed')
     const before=rows(await c.from('v_charge_balances').select('allocated_amount').eq('organization_id',f.org).eq('charge_id',a.charge_id),1)[0]
     if(Number(before.allocated_amount)!==0)throw Error('Mutual cleanup must not touch allocations')
     if(!a.canceled)uuid(await rpc('cancel_member_charge_idempotent',{p_organization_id:f.org,p_charge_id:a.charge_id,p_accounting_period:period,p_reason:tag+' cleanup',p_idempotency_key:crypto.randomUUID()}))
    }
    const after=await loadMutualAssignments(c,f.org,b,new AbortController().signal);if(after.some(a=>!a.canceled||a.open!==0))throw Error('Mutual cleanup unconfirmed')
   }
  }
  await cash();if(traces.length!==expected||!traces.some(x=>x.name==='create_mutual_batch'&&x.status===409&&x.code==='PT409'))throw Error('Mutual retry/conflict trace invalid')
  report(`Mutual HTTP ${f.label}: ${expected} calls / ${traces.length} requests; own test charges canceled, cash10 PASS`)
 }finally{globalThis.fetch=base}
}

