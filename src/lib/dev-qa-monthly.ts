import type {SupabaseClient} from '@supabase/supabase-js'
import {assertQADenied as denied,assertQARows as rows,assertQAUUID as uuid,assertQAMonthlyRace} from './dev-qa-gates'
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'94b84958-4dd9-435d-9a4e-244220835d70',rules:['a4dec375-abec-4f42-bdf7-23597e2376b3','33f6406e-b8db-4528-8a1f-dd3d6a3792d0']},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'7a6aa771-524d-4d5a-9d38-7006175e1cb4',rules:['1d792556-5a99-4454-8b7f-57cb92d346de','79578aa9-20c7-4ade-9b65-ee98b57f03fe']},
]
const periods=['2026-11-01','2026-12-01']
// Optional DEV entry only; reuse precisely approved QA rules, no tokens or SQL.
export async function runMonthlyHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const user=await c.auth.getUser(),own=fixtures.find(f=>f.actor===user.data.user?.id)
 if(user.error||!own||new Date().toISOString().slice(0,7)!=='2026-10')throw Error('Approved monthly QA identity/period absent')
 const foreign=fixtures.find(f=>f!==own)!
 rows(await c.from('organizations').select('id').eq('id',own.org).eq('name',`DEV QA FINANCE ${own.label} 20261015`),1)
 const cash=async()=>{
  const r=rows(await c.from('v_financial_account_balances').select('balance').eq('organization_id',own.org),1)
  if(Number(r[0].balance)!==10)throw Error('QA cash must remain exactly 10')
 }
 await cash()
 for(const table of ['institutional_recurring_rules','institutional_recurring_rule_versions','institutional_payables','institutional_receivables']){
  rows(await c.from(table).select('organization_id').eq('organization_id',foreign.org),0)
  report(`RLS ${table}: foreign hidden PASS`)
 }
 // Validate every fixture and absence before any persisted operation. This is a one-run gate.
 for(const [index,rule] of own.rules.entries()){
  const r=rows(await c.from('institutional_recurring_rules').select('id,name,active,direction,frequency').eq('organization_id',own.org).eq('id',rule),1)[0]
  if(r.name!==`DEV QA MONTHLY ${own.label} ${index===0?'EXPENSE':'REVENUE'} 20261016`||r.active!==false||r.frequency!=='monthly'||r.direction!==(index===0?'payable':'receivable'))throw Error('Inspect monthly QA rule before running')
  rows(await c.from(index===0?'institutional_payables':'institutional_receivables').select('id').eq('organization_id',own.org).eq('recurring_rule_id',rule).in('competence',periods),0)
 }
 for(const [index,rule] of own.rules.entries()){
  const payable=index===0,kind=payable?'payable':'receivable',table=payable?'institutional_payables':'institutional_receivables',view=payable?'v_institutional_payable_effective':'v_institutional_receivable_effective',fk=payable?'payable_id':'receivable_id'
  const reason=`DEV QA HTTP MONTHLY ${own.label} ${kind}`
  const status=(active:boolean,key:string)=>({p_organization_id:own.org,p_rule_id:rule,p_expected_active:!active,p_active:active,p_reason:reason,p_idempotency_key:key})
  const preview=async(period:string)=>{
   const r=await c.rpc('preview_institutional_monthly_generation',{p_organization_id:own.org,p_rule_id:rule,p_competence:period})
   if(r.error||!r.data||r.data.organization_id!==own.org||r.data.rule_id!==rule||r.data.competence!==period||Number(r.data.amount)!==1||typeof r.data.ready!=='boolean'||!/^([a-f0-9]{64})$/.test(r.data.fingerprint))throw Error('Monthly preview invalid')
   return r.data as {fingerprint:string;ready:boolean;existing_id:string|null}
  }
  const command=(period:string,fingerprint:string,key:string)=>({p_organization_id:own.org,p_rule_id:rule,p_competence:period,p_expected_fingerprint:fingerprint,p_reason:reason,p_idempotency_key:key})
  try{
   uuid(await c.rpc('set_tenant_institutional_monthly_rule_status',status(true,crypto.randomUUID())))
   for(const [mode,period] of periods.entries()){
    const p=await preview(period);if(!p.ready||p.existing_id!==null)throw Error('Monthly preview not ready')
    const key=crypto.randomUUID(),args=command(period,p.fingerprint,key)
    denied(await c.rpc('preview_institutional_monthly_generation',{p_organization_id:foreign.org,p_rule_id:foreign.rules[index],p_competence:period}),['42501'])
    denied(await c.rpc('preview_institutional_monthly_generation',{p_organization_id:own.org,p_rule_id:foreign.rules[index],p_competence:period}),['23503'])
    denied(await c.rpc('generate_institutional_monthly_obligation',{...args,p_organization_id:foreign.org,p_rule_id:foreign.rules[index]}),['42501'])
    denied(await c.rpc('generate_institutional_monthly_obligation',{...args,p_rule_id:foreign.rules[index]}),['23503'])
    const rs=await Promise.all([c.rpc('generate_institutional_monthly_obligation',args),c.rpc('generate_institutional_monthly_obligation',mode===0?args:command(period,p.fingerprint,crypto.randomUUID()))])
    const id=assertQAMonthlyRace(rs,mode===0)
    if(mode===0)denied(await c.rpc('generate_institutional_monthly_obligation',{...args,p_reason:reason+' changed'}),['22023'])
    const facts=rows(await c.from(table).select('id,amount,generation_key').eq('organization_id',own.org).eq('recurring_rule_id',rule).eq('competence',period),1)
    if(facts[0].id!==id||Number(facts[0].amount)!==1||facts[0].generation_key!==`institutional-monthly:${rule}:${period}`)throw Error('Monthly unique fact mismatch')
    rows(await c.from('audit_logs').select('entity_id').eq('organization_id',own.org).eq('entity_id',id).eq('action','institutional_rule.generate'),1)
    uuid(await c.rpc('cancel_tenant_institutional_obligation_idempotent',{p_organization_id:own.org,p_obligation_id:id,p_kind:kind,p_accounting_period:period,p_reason:reason+' cleanup',p_idempotency_key:reason+' cancel '+period}))
    const after=await preview(period)
    if(after.ready||after.existing_id!==id)throw Error('Canceled generation history lost')
    denied(await c.rpc('generate_institutional_monthly_obligation',command(period,after.fingerprint,crypto.randomUUID())),['23514'])
    report(`${kind} ${period}: ${mode===0?'same-key replay':'different-key race'}; foreign scope/ID, one fact/audit, canceled reissue denied PASS`)
   }
  }finally{
   // Recover committed IDs after transport failure; touch only preflight-empty rule/months.
   try{
   const result=await c.from(table).select('id').eq('organization_id',own.org).eq('recurring_rule_id',rule).in('competence',periods)
   const facts=rows(result,Array.isArray(result.data)?result.data.length:-1)
   if(facts.length>2)throw Error('Monthly cleanup scope invalid')
   for(const fact of facts){
    const state=rows(await c.from(view).select('is_canceled,competence').eq('organization_id',own.org).eq(fk,fact.id),1)[0]
    if(state.is_canceled!==true)uuid(await c.rpc('cancel_tenant_institutional_obligation_idempotent',{p_organization_id:own.org,p_obligation_id:fact.id,p_kind:kind,p_accounting_period:state.competence,p_reason:reason+' cleanup',p_idempotency_key:reason+' cancel '+state.competence}))
   }
   for(const fact of facts){
    const verified=rows(await c.from(view).select('is_canceled,open_amount,integrity_ok').eq('organization_id',own.org).eq(fk,fact.id),1)[0]
    if(verified.is_canceled!==true||Number(verified.open_amount)!==0||verified.integrity_ok!==true)throw Error('Monthly cancellation cleanup not verified')
   }
   }finally{
   const state=rows(await c.from('institutional_recurring_rules').select('active').eq('organization_id',own.org).eq('id',rule),1)[0]
   if(state.active===true)uuid(await c.rpc('set_tenant_institutional_monthly_rule_status',status(false,reason+' deactivate')))
   else if(state.active!==false)throw Error('Monthly cleanup state invalid')
   if(rows(await c.from('institutional_recurring_rules').select('active').eq('organization_id',own.org).eq('id',rule),1)[0].active!==false)throw Error('Monthly rule still active')
   await cash()
   }
  }
 }
 await cash();report(`Monthly HTTP ${own.label}: rules inactive, cash 10, historical obligations canceled PASS`)
}
