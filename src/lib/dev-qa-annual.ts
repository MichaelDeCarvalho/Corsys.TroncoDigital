import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQADenied as denied,assertQARows as rows,assertQAUUID as uuid,assertQAMonthlyRace} from './dev-qa-gates'
import {assertLegacyConflict} from './dev-qa-legacy'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',expense:'1f902e8f-9fae-4c9a-aeaa-a8a4a5483e73',revenue:'3d74e103-0614-49d7-9622-0fe4496c516a',foreignPay:'75dcff52-5c58-494b-bb24-3bcd06b5a4ff',foreignReceivable:'a3993d44-5d03-4531-9563-74edfc56cf8a'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',expense:'9917a5ed-d457-4a00-80fc-fe8d9042ac75',revenue:'763349e5-49bb-4c8d-ace6-a52c6feb6d82',foreignPay:'05ba3bc7-ea9c-4671-9765-feaa21f60c3b',foreignReceivable:'d116ea09-e81d-44ad-96ae-60cfb458d876'},
]
export async function runAnnualHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const user=await c.auth.getUser(),own=fixtures.find(f=>f.actor===user.data.user?.id)
 if(user.error||!own||new Date().toISOString().slice(0,7)!=='2026-10')throw Error('Annual QA identity/period absent')
 const foreign=fixtures.find(f=>f!==own)!,period='2027-02-01',tag=`DEV QA ANNUAL HTTP ${own.label} 20261019`
 rows(await c.from('organizations').select('id').eq('id',own.org).eq('name',`DEV QA FINANCE ${own.label} 20261015`),1)
 for(const kind of ['payable','receivable'])rows(await c.from('institutional_recurring_rules').select('id').eq('organization_id',own.org).eq('name',tag+' '+kind),0)
 const cash=async()=>{const r=await c.from('v_financial_account_balances').select('balance').eq('organization_id',own.org);if(r.error||!Array.isArray(r.data)||r.data.reduce((s,x)=>s+Number(x.balance),0)!==10)throw Error('Cash fixture changed')}
 await cash()
 const base=globalThis.fetch,traces:{name:string;status:number;code:string|null}[]=[];let expected=0
 globalThis.fetch=async(input,init)=>{
  const response=await base(input,init),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.origin==='https://szqkdekwhzxsoxorgvaz.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){
   const b=await response.clone().json().catch(()=>null);traces.push({name:url.pathname.split('/').pop()!,status:response.status,code:typeof b?.code==='string'?b.code:null})
  }return response
 }
 const rpc=(name:string,args:Record<string,unknown>)=>{expected++;return c.rpc(name,args)}
 try{
 for(const [index,kind] of ['payable','receivable'].entries()){
  const table=kind==='payable'?'institutional_payables':'institutional_receivables',view=kind==='payable'?'v_institutional_payable_effective':'v_institutional_receivable_effective',fk=kind==='payable'?'payable_id':'receivable_id'
  const reason=tag+' '+kind;let rule:string|null=null
  const preview=async(p:string)=>{
   const r=await rpc('preview_institutional_annual_generation',{p_organization_id:own.org,p_rule_id:rule,p_competence:p})
   if(r.error||r.data?.organization_id!==own.org||r.data.rule_id!==rule||r.data.frequency!=='annual'||r.data.annual_month!==2||Number(r.data.amount)!==1||!/^[a-f0-9]{64}$/.test(r.data.fingerprint))throw Error('Annual preview invalid')
   return r.data as {ready:boolean;fingerprint:string;existing_id:string|null;due_date:string}
  }
  try{
   rule=uuid(await rpc('create_tenant_institutional_annual_rule',{p_organization_id:own.org,p_direction:kind,p_category_id:kind==='payable'?own.expense:own.revenue,p_name:reason,p_counterparty:'DEV QA fictício',p_amount:'1.00',p_valid_from:period,p_due_day:31,p_reason:reason,p_idempotency_key:crypto.randomUUID()}))
   const wrong=await preview('2027-03-01');if(wrong.ready)throw Error('Wrong anniversary ready')
   denied(await rpc('generate_institutional_annual_obligation',{p_organization_id:own.org,p_rule_id:rule,p_competence:'2027-03-01',p_expected_fingerprint:wrong.fingerprint,p_reason:reason,p_idempotency_key:crypto.randomUUID()}),['23514'])
   const p=await preview(period);if(!p.ready||p.existing_id!==null||p.due_date!=='2027-02-28')throw Error('Annual preflight not ready')
   const args={p_organization_id:own.org,p_rule_id:rule,p_competence:period,p_expected_fingerprint:p.fingerprint,p_reason:reason,p_idempotency_key:crypto.randomUUID()}
   denied(await rpc('generate_institutional_annual_obligation',{...args,p_organization_id:foreign.org}),['42501'])
   const race=await Promise.all([rpc('generate_institutional_annual_obligation',args),rpc('generate_institutional_annual_obligation',index===0?args:{...args,p_idempotency_key:crypto.randomUUID()})])
   const fact=assertQAMonthlyRace(race,index===0)
   if(index===0)denied(await rpc('generate_institutional_annual_obligation',{...args,p_reason:reason+' changed'}),['22023'])
   else assertLegacyConflict(race.find(r=>r.error)!)
   const state=rows(await c.from(view).select('category_id,fund_id,description,competence,due_date,effective_amount,allocated_amount').eq('organization_id',own.org).eq(fk,fact),1)[0]
   const correct={p_organization_id:own.org,p_obligation_id:fact,p_kind:kind,p_expected_state:state,p_new_category_id:kind==='payable'?own.expense:own.revenue,p_new_fund_id:null,p_new_description:reason+' corrected',p_new_competence:period,p_new_due_date:'2027-02-27',p_new_amount:1,p_accounting_period:period,p_reason:reason,p_idempotency_key:crypto.randomUUID()}
   const replay=await Promise.all([rpc('correct_tenant_institutional_obligation_idempotent',correct),rpc('correct_tenant_institutional_obligation_idempotent',correct)])
   if(uuid(replay[0])!==uuid(replay[1]))throw Error('Correction replay mismatch')
   denied(await rpc('correct_tenant_institutional_obligation_idempotent',{...correct,p_new_amount:2}),['22023'])
   assertLegacyConflict(await rpc('correct_tenant_institutional_obligation_idempotent',{...correct,p_idempotency_key:crypto.randomUUID()}))
   denied(await rpc('correct_tenant_institutional_obligation_idempotent',{...correct,p_organization_id:foreign.org,p_idempotency_key:crypto.randomUUID()}))
   denied(await rpc('correct_tenant_institutional_obligation_idempotent',{...correct,p_obligation_id:kind==='payable'?own.foreignPay:own.foreignReceivable,p_idempotency_key:crypto.randomUUID()}),['23503'])
   rows(await c.from(table).select('id').eq('organization_id',own.org).eq('recurring_rule_id',rule).eq('competence',period),1)
   rows(await c.from('audit_logs').select('entity_id').eq('organization_id',own.org).eq('entity_id',fact).eq('action','institutional_rule.generate'),1)
   report(`${kind}: annual ${index===0?'same-key replay':'distinct-key race'}, wrong month, scope denial; correction replay/PT409/foreign scope+ID PASS`)
  }finally{
   // Recover a committed creation even if its HTTP response was lost.
   const found=await c.from('institutional_recurring_rules').select('id,active').eq('organization_id',own.org).eq('name',reason)
   if(found.error||!Array.isArray(found.data)||found.data.length>1)throw Error('Annual cleanup rule scope unavailable')
   if(found.data.length){
    rule=found.data[0].id
    try{
     const result=await c.from(table).select('id').eq('organization_id',own.org).eq('recurring_rule_id',rule).eq('competence',period).limit(3)
     const facts=rows(result,Array.isArray(result.data)?result.data.length:-1);if(facts.length>2)throw Error('Annual cleanup scope exceeded')
     for(const f of facts){
      const s=rows(await c.from(view).select('is_canceled').eq('organization_id',own.org).eq(fk,f.id),1)[0]
      if(s.is_canceled!==true)uuid(await rpc('cancel_tenant_institutional_obligation_idempotent',{p_organization_id:own.org,p_obligation_id:f.id,p_kind:kind,p_accounting_period:period,p_reason:reason+' cleanup',p_idempotency_key:crypto.randomUUID()}))
      const verified=rows(await c.from(view).select('is_canceled,open_amount,integrity_ok').eq('organization_id',own.org).eq(fk,f.id),1)[0]
      if(!verified.is_canceled||Number(verified.open_amount)!==0||verified.integrity_ok!==true)throw Error('Annual obligation cleanup unconfirmed')
     }
     if(facts.length===1){const after=await preview(period);if(after.ready||after.existing_id!==facts[0].id)throw Error('Annual canceled history lost');denied(await rpc('generate_institutional_annual_obligation',{p_organization_id:own.org,p_rule_id:rule,p_competence:period,p_expected_fingerprint:after.fingerprint,p_reason:reason,p_idempotency_key:crypto.randomUUID()}),['23514'])}
    }finally{
     if(found.data[0].active)uuid(await rpc('set_tenant_institutional_annual_rule_status',{p_organization_id:own.org,p_rule_id:rule,p_expected_active:true,p_active:false,p_reason:reason+' cleanup',p_idempotency_key:crypto.randomUUID()}))
     if(rows(await c.from('institutional_recurring_rules').select('active').eq('organization_id',own.org).eq('id',rule),1)[0].active!==false)throw Error('Annual rule still active')
    }
   }
  }
 }
 await cash();if(traces.length!==expected)throw Error('Unexpected annual HTTP retry')
 if(!traces.some(t=>t.name==='generate_institutional_annual_obligation'&&t.status===409&&t.code==='PT409'))throw Error('Annual HTTP conflict trace absent')
 report(`Annual/correction HTTP ${own.label}: ${expected} calls / ${traces.length} requests; rules inactive, obligations canceled, cash10 PASS`)
 }finally{globalThis.fetch=base}
}
