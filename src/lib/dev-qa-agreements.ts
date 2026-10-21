import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQARows as rows,assertQAUUID as uuid,assertQADenied as denied} from './dev-qa-gates'
import {assertLegacyConflict} from './dev-qa-legacy'
import {validateAgreementPreview,agreementCents,type AgreementInput} from './member-agreements'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',member:'d5842ad6-913d-4a3e-8250-876fb2e2a215',category:'df01dcfa-707c-4861-a9fb-719e7ec21f65'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',member:'23bdcd76-b7a2-47b5-9f65-267d4c1053be',category:'0bef3ce2-f77a-4e29-85f6-37e737630d1d'},
]
export async function runAgreementHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const u=await c.auth.getUser(),f=fixtures.find(x=>x.actor===u.data.user?.id),date=new Date().toISOString().slice(0,10),period='2026-10-01'
 if(u.error||!f||date.slice(0,7)!=='2026-10')throw Error('Agreement QA identity/date absent')
 const other=fixtures.find(x=>x!==f)!,tag=`DEV QA AGREEMENT HTTP ${f.label} ${date.replaceAll('-','')}`
 rows(await c.from('organizations').select('id').eq('id',f.org).eq('name',`DEV QA FINANCE ${f.label} 20261015`),1)
 rows(await c.from('financial_categories').select('id').eq('organization_id',f.org).eq('id',f.category).eq('allow_installments',true),1)
 rows(await c.from('charges').select('id').eq('organization_id',f.org).eq('description',tag),0)
 for(const table of ['member_debt_agreements','member_debt_agreement_items','member_debt_agreement_installments','member_debt_agreement_events'])rows(await c.from(table).select('organization_id').eq('organization_id',other.org).limit(1),0)
 const cash=async()=>{const r=await c.from('v_financial_account_balances').select('balance').eq('organization_id',f.org);if(r.error||!Array.isArray(r.data)||r.data.reduce((s,x)=>s+Number(x.balance),0)!==10)throw Error('Agreement QA cash changed')}
 await cash()
 let charge:string|null=null;const base=globalThis.fetch,traces:{name:string;status:number;code:string|null}[]=[];let expected=0
 globalThis.fetch=async(input,init)=>{
  const response=await base(input,init),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.origin==='https://szqkdekwhzxsoxorgvaz.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){
   const b=await response.clone().json().catch(()=>null);traces.push({name:url.pathname.split('/').pop()!,status:response.status,code:typeof b?.code==='string'?b.code:null})
  }return response
 }
 const rpc=(name:string,args:Record<string,unknown>)=>{expected++;return c.rpc(name,args)}
 try{
  try{
   charge=uuid(await rpc('create_manual_charge',{p_organization_id:f.org,p_member_id:f.member,p_category_id:f.category,p_description:tag,p_competence:period,p_issue_date:date,p_due_date:'2026-10-20',p_accounting_period:period,p_amount:3,p_reference:tag,p_idempotency_key:crypto.randomUUID()}))
   const input:AgreementInput={p_organization_id:f.org,p_member_id:f.member,p_charge_ids:[charge],p_amount:'2.50',p_installment_count:3,p_agreement_date:date,p_first_due:'2027-01-31'}
   denied(await rpc('preview_member_debt_agreement',{...input,p_organization_id:other.org}),['42501'])
   denied(await rpc('preview_member_debt_agreement',{...input,p_member_id:other.member}),['23503'])
   const result=await rpc('preview_member_debt_agreement',input);if(result.error)throw result.error
   const p=validateAgreementPreview(result.data,input)
   if(agreementCents(p.installments[0].amount)!==84||p.installments[1].due_date!=='2027-02-28'||p.installments[2].due_date!=='2027-03-31')throw Error('Agreement HTTP schedule mismatch')
   const args={...input,p_expected_fingerprint:p.fingerprint,p_reason:tag,p_idempotency_key:crypto.randomUUID()}
   assertLegacyConflict(await rpc('create_member_debt_agreement',{...args,p_expected_fingerprint:'0'.repeat(64)}))
   const race=await Promise.all([rpc('create_member_debt_agreement',args),rpc('create_member_debt_agreement',args)]),agreement=uuid(race[0])
   if(uuid(race[1])!==agreement)throw Error('Agreement replay mismatch')
   denied(await rpc('create_member_debt_agreement',{...args,p_amount:'2.40'}),['22023'])
   denied(await rpc('create_member_debt_agreement',{...args,p_idempotency_key:crypto.randomUUID()}),['23503'])
   denied(await rpc('create_member_debt_agreement',{...args,p_organization_id:other.org,p_idempotency_key:crypto.randomUUID()}),['42501'])
   const installments=rows(await c.from('member_debt_agreement_installments').select('charge_id,amount').eq('organization_id',f.org).eq('agreement_id',agreement),3)
   if(installments.reduce((s,x)=>s+agreementCents(x.amount),0)!==250)throw Error('Agreement installment sum mismatch')
   rows(await c.from('member_debt_agreement_items').select('agreement_id').eq('organization_id',f.org).eq('agreement_id',agreement).eq('original_charge_id',charge).eq('included_amount',3),1)
   rows(await c.from('audit_logs').select('entity_id').eq('organization_id',f.org).eq('entity_id',agreement).eq('action','member_agreement.create'),1)
   const original=rows(await c.from('v_charge_balances').select('original_amount,effective_amount,allocated_amount,open_amount,integrity_ok').eq('organization_id',f.org).eq('charge_id',charge),1)[0]
   if(Number(original.original_amount)!==3||Number(original.effective_amount)!==0||Number(original.allocated_amount)!==0||Number(original.open_amount)!==0||original.integrity_ok!==true)throw Error('Agreement original not preserved')
   report('Agreement: exact cents/month-end, linked installments, replay, PT409, payload divergence, tenant/member denial and audit PASS')
  }finally{
   // Recover a committed original or agreement even when the corresponding response is lost.
   const originalResult=await c.from('charges').select('id').eq('organization_id',f.org).eq('description',tag)
   const originals=rows(originalResult,Array.isArray(originalResult.data)?originalResult.data.length:-1)
   if(originals.length>1)throw Error('Agreement cleanup original scope exceeded')
   if(originals.length){charge=uuid({data:originals[0].id,error:null})
   const items=await c.from('member_debt_agreement_items').select('agreement_id').eq('organization_id',f.org).eq('original_charge_id',charge)
   if(items.error||!Array.isArray(items.data)||items.data.length>1)throw Error('Agreement cleanup lineage unavailable')
   const targets=[charge]
   if(items.data.length){
    const parts=rows(await c.from('member_debt_agreement_installments').select('charge_id').eq('organization_id',f.org).eq('agreement_id',items.data[0].agreement_id),3)
    targets.push(...parts.map(x=>String(x.charge_id)))
   }
   for(const target of targets){
    const before=rows(await c.from('v_charge_balances').select('is_cancelled').eq('organization_id',f.org).eq('charge_id',target),1)[0]
    if(before.is_cancelled!==true)uuid(await rpc('cancel_member_charge_idempotent',{p_organization_id:f.org,p_charge_id:target,p_accounting_period:period,p_reason:tag+' cleanup',p_idempotency_key:crypto.randomUUID()}))
    const after=rows(await c.from('v_charge_balances').select('is_cancelled,open_amount,integrity_ok').eq('organization_id',f.org).eq('charge_id',target),1)[0]
    if(after.is_cancelled!==true||Number(after.open_amount)!==0||after.integrity_ok!==true)throw Error('Agreement cleanup unconfirmed')
   }
   }
  }
  await cash()
  if(expected!==traces.length||!traces.some(t=>t.name==='create_member_debt_agreement'&&t.status===409&&t.code==='PT409'))throw Error('Agreement HTTP retries/conflict trace invalid')
  report(`Agreement HTTP ${f.label}: ${expected} calls / ${traces.length} requests; original/3 installments canceled, cash10 PASS`)
 }finally{globalThis.fetch=base}
}
