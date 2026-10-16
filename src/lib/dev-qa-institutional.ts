import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQADenied as denied,assertQARows as rows,assertQAUUID as uuid,assertQAOneReversal} from './dev-qa-gates'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',account:'b6116441-5a43-4661-8d5b-1a844c48f6b5',pay:'5faca7ff-d2a8-4af8-ac51-e9092437a1d7',receipt:'3888546e-bdfa-46da-867c-3004a065720f'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',account:'27f1f82c-5487-41f3-b269-7abc692a4bca',pay:'df07315b-31a3-4ecb-b3c0-199626f47e69',receipt:'537d75b6-e41b-4e6a-bec2-eee51d912cc8'},
]
// Only called by the separately gated DEV QA entry. Uses the SDK session normally;
// no token extraction, new grants, raw SQL, original tenant or external provider.
export async function runInstitutionalHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const user=await c.auth.getUser(),own=fixtures.find(f=>f.actor===user.data.user?.id)
 if(user.error||!own)throw Error('Expected financial QA identity absent')
 const foreign=fixtures.find(f=>f!==own)!,day=new Date().toISOString().slice(0,10),period=day.slice(0,7)+'-01'
 if(period!=='2026-10-01')throw Error('Approved QA period expired; review fixtures')
 rows(await c.from('organizations').select('id').eq('id',own.org).eq('name',`DEV QA FINANCE ${own.label} 20261015`),1)
 const methods=rows(await c.from('payment_methods').select('id').eq('organization_id',own.org).eq('name','DEV QA método fictício').eq('active',true),1)
 const balance=async()=>{
  const r=rows(await c.from('v_financial_account_balances').select('financial_account_id,balance').eq('organization_id',own.org),1)
  if(r[0].financial_account_id!==own.account||Number(r[0].balance)!==10)throw Error('QA cash must be exactly 10 before/after test')
 }
 const dre=async()=>{
  const r=await c.rpc('read_tenant_dre',{p_organization_id:own.org,p_from_period:period,p_to_period:period})
  if(r.error||!Array.isArray(r.data)||r.data.length>10||r.data.some(d=>!Number.isFinite(Number(d.signed_amount))))throw Error('DRE read failed')
  return JSON.stringify(r.data.map(d=>[d.account_code,d.nature,String(d.signed_amount)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))
 }
 await balance();const before=await dre()
 for(const table of ['institutional_payable_payments','institutional_receipts','institutional_payable_payment_reversals','institutional_receipt_reversals']){
  rows(await c.from(table).select('organization_id').eq('organization_id',foreign.org),0)
  report(`RLS ${table}: foreign hidden PASS`)
 }
 for(const kind of ['payable_payment','institutional_receipt'] as const){
  const payable=kind==='payable_payment',obKind=payable?'payable':'receivable'
  const category=rows(await c.from('financial_categories').select('id').eq('organization_id',own.org).eq('active',true)
   .eq('domain',payable?'institutional_expense':'institutional_revenue'),1)[0]
  const tag=`DEV QA HTTP REVERSAL ${own.label} ${crypto.randomUUID()}`
  const obligation=uuid(await c.rpc(payable?'create_institutional_payable':'create_institutional_receivable',{
   p_organization_id:own.org,p_category_id:category.id,p_fund_id:null,p_description:tag,p_counterparty_name:'DEV QA fictício',
   p_competence:period,p_issue_date:day,p_due_date:day,p_accounting_period:period,p_amount:'1.00',p_idempotency_key:crypto.randomUUID()}))
  report(`Created QA ${obKind} ${obligation}`)
  const created=new Set<string>(),reversalTable=payable?'institutional_payable_payment_reversals':'institutional_receipt_reversals',fk=payable?'payment_id':'receipt_id'
  const command=(id:string,key:string)=>({p_organization_id:own.org,p_kind:kind,p_movement_id:id,p_reversal_date:day,p_reason:tag,p_idempotency_key:key})
  const cancel=async()=>uuid(await c.rpc('cancel_tenant_institutional_obligation_idempotent',{
   p_organization_id:own.org,p_obligation_id:obligation,p_kind:obKind,p_accounting_period:period,p_reason:tag,p_idempotency_key:tag+' cancel'}))
  try{
   for(const mode of ['same-key','different-keys']){
    const id=uuid(await c.rpc(payable?'register_institutional_payable_payment':'register_institutional_receipt',{
     p_organization_id:own.org,[payable?'p_payable_id':'p_receivable_id']:obligation,[payable?'p_payment_date':'p_receipt_date']:day,
     p_accounting_period:period,p_amount:'1.00',p_allocate_amount:'1.00',p_payment_method_id:methods[0].id,p_financial_account_id:own.account,
     p_reference:tag,p_idempotency_key:crypto.randomUUID()}))
    created.add(id);report(`Created QA ${kind} ${id}`)
    const key=crypto.randomUUID(),args=command(id,key)
    denied(await c.rpc('reverse_tenant_institutional_movement',{...args,p_organization_id:foreign.org}),['42501'])
    denied(await c.rpc('reverse_tenant_institutional_movement',{...args,p_movement_id:payable?foreign.pay:foreign.receipt}),['23503'])
    const responses=await Promise.all([c.rpc('reverse_tenant_institutional_movement',args),c.rpc('reverse_tenant_institutional_movement',mode==='same-key'?args:command(id,crypto.randomUUID()))])
    if(mode==='same-key'){
     if(uuid(responses[0])!==id||uuid(responses[1])!==id)throw Error('Institutional replay returned different result')
     denied(await c.rpc('reverse_tenant_institutional_movement',{...args,p_reason:tag+' changed'}),['22023'])
    }else if(assertQAOneReversal(responses)!==id)throw Error('Institutional race returned different fact')
    rows(await c.from(reversalTable).select(fk).eq('organization_id',own.org).eq(fk,id),1)
    const audit=rows(await c.from('audit_logs').select('entity_id').eq('organization_id',own.org).eq('entity_id',id).eq('action','institutional_movement.reverse'),1)
    if(audit[0].entity_id!==id)throw Error('Reversal audit mismatch')
    created.delete(id);report(`${kind} ${mode}: scoped denials, concurrent requests, one event/audit PASS`)
   }
  }finally{
   // Recover IDs even if a registration committed but its HTTP response was lost.
   const facts=await c.from(payable?'institutional_payable_payments':'institutional_receipts')
    .select('id').eq('organization_id',own.org).eq('reference',tag).limit(3)
   if(facts.error||!Array.isArray(facts.data)||facts.data.length>2)throw Error(`Inspect uncertain QA facts ${obligation}`)
   for(const f of facts.data)created.add(uuid({data:f.id,error:null}))
   for(const id of created){
    const r=await c.from(reversalTable).select(fk).eq('organization_id',own.org).eq(fk,id)
    if(r.error||!Array.isArray(r.data)||r.data.length>1)throw Error(`Inspect uncertain QA cleanup ${id}`)
    if(!r.data.length)uuid(await c.rpc('reverse_tenant_institutional_movement',command(id,tag+' cleanup '+id)))
   }
   await cancel()
  }
  const effective=rows(await c.from(payable?'v_institutional_payable_effective':'v_institutional_receivable_effective')
   .select('open_amount,allocated_amount,is_canceled,integrity_ok').eq('organization_id',own.org).eq(payable?'payable_id':'receivable_id',obligation),1)[0]
  if(Number(effective.open_amount)!==0||Number(effective.allocated_amount)!==0||effective.is_canceled!==true||effective.integrity_ok!==true)throw Error('QA obligation cleanup invalid')
 }
 await balance();if(await dre()!==before)throw Error('QA DRE changed after cleanup')
 report(`Identity ${own.label}: institutional HTTP, cash 10 and DRE restored PASS`)
}
