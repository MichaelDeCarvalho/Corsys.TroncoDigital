// DEV only; ownership-ID matrix and direct views. No status/MFA/role changes.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {validateFixture,requireRows,assertHidden,assertPermissionDenied} from '../tools/isolation-assertions.mjs'
const ref=assertDevEnvironment(),f=JSON.parse(await fs.readFile('remaining.fixture.json','utf8')),extra=JSON.parse(await fs.readFile('final-authorization.fixture.json','utf8'))
validateFixture(f,ref);assert.equal(extra.project_ref,ref);assert.equal(extra.resources.length,2);assert.equal(extra.views.length,28)
const tag='DEV FINAL AUTHORIZATION '+randomUUID(),clients=[]
function success(r,label){assert.equal(r.error,null,label+' API failure');assert.match(r.data||'',/^[0-9a-f-]{36}$/i,label+' UUID');return r.data}
async function login(t,label){
 const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}});clients.push(c)
 const l=await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
 assert.ok(!l.error&&l.data.session,'Login required '+label)
 const u=await c.auth.getUser();assert.ok(!u.error&&u.data.user?.id===t.admin_user_id,'Exact identity '+label)
 const rows=requireRows(await c.from('members').select('id,organization_id').eq('id',t.member_id),'Positive own fixture')
 assert.equal(rows.length,1);assert.equal(rows[0].organization_id,t.organization_id)
 const ids=extra.resources.find(x=>x.organization_id===t.organization_id);assert.ok(ids)
 for(const [table,key]of[['expense_approval_policies','policy_id'],['payable_approval_requests','approval_request_id']]){
  const r=requireRows(await c.from(table).select('id,organization_id').eq('id',ids[key]),'Positive authorization fixture')
  assert.equal(r.length,1);assert.equal(r[0].organization_id,t.organization_id)
 }
 const policy=requireRows(await c.from('expense_approval_policies').select('status,name,valid_from').eq('id',ids.policy_id),'Fresh policy')
 assert.equal(policy[0].status,'draft','Already executed; inspect before repeating');assert.equal(policy[0].name,'DEV FINAL IDOR 20261008');assert.equal(policy[0].valid_from,'2030-01-01')
 const decision=requireRows(await c.from('payable_approval_decisions').select('id').eq('approval_request_id',ids.approval_request_id),'Fresh approval decision');assert.equal(decision.length,0,'Already executed; do not repeat blindly')
 return {c,t,label,ids}
}
async function views(x,other){
 const positives=new Set(['v_charge_balances','v_payment_balances','v_member_statement','v_member_financial_position','v_member_financial_reconciliation','v_institutional_payable_effective','v_institutional_receivable_effective','v_financial_account_movements','v_dre_entries','v_payable_approval_state'])
 for(const v of extra.views){
  assert.match(v.name,/^v_[a-z_]+$/)
  const result=await x.c.from(v.name).select(v.org_filter?'organization_id':'*').limit(1000)
  if(!v.readable){assertPermissionDenied(result,'Backend-only view '+v.name);continue}
  const rows=requireRows(result,'Direct view '+v.name)
  if(v.org_filter){
   assert.ok(rows.every(row=>row.organization_id===x.t.organization_id),'Foreign/null org in '+v.name)
   assertHidden(await x.c.from(v.name).select('organization_id').eq('organization_id',other.t.organization_id),'Explicit foreign view '+v.name)
   if(positives.has(v.name))assert.ok(rows.length>0,'Positive own facts required '+v.name)
   else if(rows.length===0)console.log('INFO: '+x.label+' '+v.name+' empty; no positive domain data claim')
  }else assert.equal(rows.length,0,'Administrative view exposed '+v.name)
 }
 console.log('Tenant '+x.label+': all 28 direct view boundaries PASS, including positive DRE/finance')
}
async function denied(x,rpc,args,code){
 const r=await x.c.rpc(rpc,args);assert.equal(r.data,null,rpc+' returned foreign success');assert.equal(r.error?.code,code,rpc+' exact foreign resource denial')
}
function correction(x,kind,id){return {p_organization_id:x.t.organization_id,['p_'+kind+'_id']:id,p_new_category_id:kind==='payable'?x.t.expense_category_id:x.t.revenue_category_id,p_new_fund_id:null,p_new_description:tag+' no amount change',p_new_competence:f.period,p_new_due_date:f.date,p_new_amount:100,p_correction_accounting_period:f.period,p_reason:tag}}
try{
 console.log('Fixture run: '+tag+'; inspect tag/fixture before any repeat after failure')
 const a=await login(f.tenant_a,'A'),b=await login(f.tenant_b,'B')
 for(const x of [a,b]){
  const ownPlan=requireRows(await x.c.from('accounting_plans').select('id,status').eq('id',x.t.accounting_plan_id),'Positive source plan');assert.equal(ownPlan.length,1)
  x.planArgs={p_organization_id:x.t.organization_id,p_name:tag+' draft '+x.label,p_valid_from:'2030-01-01',p_valid_to:'2030-12-31',p_source_kind:'duplicate',p_source_id:x.t.accounting_plan_id}
  x.draft=success(await x.c.rpc('create_accounting_plan',x.planArgs),'Own plan duplicate')
  const draft=requireRows(await x.c.from('accounting_plans').select('id,organization_id,status').eq('id',x.draft),'Positive own draft');assert.equal(draft.length,1);assert.equal(draft[0].status,'draft')
 }
 for(const [x,other]of[[a,b],[b,a]]){
  await views(x,other)
  await denied(x,'create_accounting_plan',{...x.planArgs,p_source_id:other.t.accounting_plan_id},'23503')
  await denied(x,'publish_accounting_plan',{p_organization_id:x.t.organization_id,p_plan_id:other.draft},'23503')
  await denied(x,'publish_expense_approval_policy',{p_organization_id:x.t.organization_id,p_policy_id:other.ids.policy_id},'23503')
  await denied(x,'decide_payable_approval',{p_organization_id:x.t.organization_id,p_approval_request_id:other.ids.approval_request_id,p_decision:'approve',p_reason:tag},'23503')
  const otherReceivable=requireRows(await other.c.from('institutional_receivables').select('id').eq('description','DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696 receivable'),'Positive foreign receivable identity');assert.equal(otherReceivable.length,1)
  await denied(x,'correct_institutional_payable',correction(x,'payable',other.ids.payable_id),'23503')
  await denied(x,'correct_institutional_receivable',correction(x,'receivable',otherReceivable[0].id),'23503')
  for(const [kind,id]of[['payable',other.ids.payable_id],['receivable',otherReceivable[0].id]])await denied(x,'cancel_institutional_'+kind,{p_organization_id:x.t.organization_id,['p_'+kind+'_id']:id,p_accounting_period:f.period,p_reason:tag},'23503')
  for(const [table,id]of[['accounting_plans',other.draft],['expense_approval_policies',other.ids.policy_id],['payable_approval_requests',other.ids.approval_request_id]])assertHidden(await x.c.from(table).select('id').eq('id',id),'Foreign configuration row '+table)
  console.log('Tenant '+x.label+': 8 own-organization foreign-resource RPC denials PASS')
 }
 for(const x of [a,b]){
  success(await x.c.rpc('publish_expense_approval_policy',{p_organization_id:x.t.organization_id,p_policy_id:x.ids.policy_id}),'Own future policy publication')
  const published=requireRows(await x.c.from('expense_approval_policies').select('status,published_by,published_at,valid_from,mode').eq('id',x.ids.policy_id),'Positive published future policy')
  assert.equal(published.length,1);assert.equal(published[0].status,'published');assert.equal(published[0].published_by,x.t.admin_user_id);assert.ok(published[0].published_at);assert.equal(published[0].valid_from,'2030-01-01');assert.equal(published[0].mode,'off')
  const decision=success(await x.c.rpc('decide_payable_approval',{p_organization_id:x.t.organization_id,p_approval_request_id:x.ids.approval_request_id,p_decision:'approve',p_reason:tag}),'Own fictitious approval')
  const rows=requireRows(await x.c.from('payable_approval_decisions').select('actor_user_id,organization_id,approval_request_id').eq('id',decision),'Positive own decision')
  assert.equal(rows.length,1);assert.equal(rows[0].actor_user_id,x.t.admin_user_id);assert.equal(rows[0].organization_id,x.t.organization_id);assert.equal(rows[0].approval_request_id,x.ids.approval_request_id)
  const audits=requireRows(await x.c.from('audit_logs').select('action,actor_user_id').eq('organization_id',x.t.organization_id).eq('entity_id',x.ids.approval_request_id).eq('reason',tag),'Positive decision audit');assert.equal(audits.length,1);assert.equal(audits[0].actor_user_id,x.t.admin_user_id)
  const base=requireRows(await x.c.from('institutional_payables').select('amount').eq('id',x.ids.payable_id),'Original posted amount');assert.equal(base.length,1);assert.equal(Number(base[0].amount),100)
 }
 console.log('PASS: both real tenants, direct views/DRE, ownership IDs in configuration/approval/institutional commands, positive future policy/decision and audit. Does not homologate all business workflows or production.')
 console.log('Fixture run: '+tag+'; future drafts/policies/manual fictitious decisions remain DEV; no current policy/ledger amount changed')
}finally{await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'})))}
