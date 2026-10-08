// Fixed DEV only. New isolated member and 2027 plan; real JWT required.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {validateFixture,requireRows,assertHidden,assertPermissionDenied} from '../tools/isolation-assertions.mjs'
import {sameResult} from '../tools/financial-assertions.mjs'
const ref=assertDevEnvironment(),f=JSON.parse(await fs.readFile('remaining.fixture.json','utf8'))
validateFixture(f,ref);assert.equal(f.period,'2027-01-01');assert.equal(f.date,'2027-01-03')
const catalog=JSON.parse(await fs.readFile('tenant-command-catalog.json','utf8'))
assert.equal(catalog.project_ref,ref);assert.equal(catalog.commands.length,20)
assert.equal(new Set(catalog.commands.map(x=>x.name)).size,20)
const tag='DEV STAGE1 REMAINING '+randomUUID(),clients=[]
console.log('Fixture run: '+tag+'; do not repeat blindly after failure')
function ok(r,label) {assert.equal(r.error,null,label+': '+(r.error?.code||'request failed'));assert.match(r.data||'',/^[0-9a-f-]{36}$/i);return r.data}
async function row(c,table,key,id,t) {
 const rows=requireRows(await c.from(table).select('*').eq(key,id),table)
 assert.equal(rows.length,1,table+': own positive row required');assert.equal(rows[0].organization_id,t.organization_id)
 return rows[0]
}
async function login(t,label) {
 const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}})
 clients.push(c)
 const r=await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
 assert.ok(!r.error&&r.data.session,label+': login failed')
 const u=await c.auth.getUser();assert.ok(!u.error&&u.data.user?.id===t.admin_user_id,label+': unexpected identity')
 const sub=requireRows(await c.from('saas_subscriptions').select('status').eq('organization_id',t.organization_id),'subscription')
 assert.equal(sub.length,1);assert.equal(sub[0].status,'active')
 assert.equal((await row(c,'saas_tenant_accounts','organization_id',t.organization_id,t)).access_override,'none')
 assert.equal((await row(c,'members','id',t.member_id,t)).full_name,'DEV STAGE1 ISOLATED FIFO')
 for(const key of ['category_id','revenue_category_id','expense_category_id']) await row(c,'financial_categories','id',t[key],t)
 await row(c,'accounting_plans','id',t.accounting_plan_id,t)
 return {c,t,label,facts:{}}
}
function payment(x,suffix,amount) {return {p_organization_id:x.t.organization_id,p_member_id:x.t.member_id,p_payment_date:f.date,p_accounting_period:f.period,p_amount:amount,p_payment_method_id:x.t.payment_method_id,p_financial_account_id:x.t.financial_account_id,p_reference:tag,p_notes:'Fictitious DEV only',p_idempotency_key:tag+' '+x.label+' '+suffix}}
async function financial(x) {
 const {c,t}=x,prior=requireRows(await c.from('charges').select('id').eq('member_id',t.member_id),'FIFO clean fixture')
 assert.equal(prior.length,0,'Isolated FIFO member already has facts; inspect before rerun')
 const charges=[]
 for(const [suffix,due] of [['first','2027-01-05'],['second','2027-01-10']]) {
  charges.push(ok(await c.rpc('create_manual_charge',{p_organization_id:t.organization_id,p_member_id:t.member_id,p_category_id:t.category_id,p_description:tag+' '+suffix,p_competence:f.period,p_issue_date:'2027-01-02',p_due_date:due,p_accounting_period:f.period,p_amount:100,p_reference:tag,p_idempotency_key:tag+' '+x.label+' '+suffix}),'FIFO charge'))
 }
 const pay=ok(await c.rpc('register_payment',payment(x,'fifo payment',150)),'FIFO payment')
 const fifo={p_organization_id:t.organization_id,p_payment_id:pay,p_accounting_period:f.period}
 for(const r of await Promise.all([c.rpc('allocate_payment_fifo',fifo),c.rpc('allocate_payment_fifo',fifo)])) {assert.equal(r.error,null,'FIFO failed');assert.equal(Number(r.data),0)}
 for(const [i,id] of charges.entries()) {const r=await row(c,'v_charge_balances','charge_id',id,t);assert.equal(Number(r.open_amount),i===0?0:50);assert.equal(Number(r.allocated_amount),i===0?100:50);assert.equal(r.integrity_ok,true)}
 const allocations=requireRows(await c.from('receivable_allocations').select('amount,charge_id').eq('payment_id',pay),'FIFO allocations')
 assert.equal(allocations.length,2);assert.equal(allocations.reduce((s,r)=>s+Number(r.amount),0),150)
 const pb=await row(c,'v_payment_balances','payment_id',pay,t);assert.equal(Number(pb.available_amount),0);assert.equal(pb.integrity_ok,true)
 x.facts.fifoPayment=pay
 for(const kind of ['payable','receivable']) {
  const args={p_organization_id:t.organization_id,p_category_id:kind==='payable'?t.expense_category_id:t.revenue_category_id,p_fund_id:null,p_description:tag+' '+kind,p_counterparty_name:'DEV fictitious counterparty',p_competence:f.period,p_issue_date:'2027-01-02',p_due_date:'2027-01-10',p_accounting_period:f.period,p_amount:100,p_idempotency_key:tag+' '+x.label+' '+kind}
  const create='create_institutional_'+kind,id=sameResult(await Promise.all([c.rpc(create,args),c.rpc(create,args)]))
  assert.equal((await c.rpc(create,{...args,p_amount:101})).error?.code,'22023','Institutional payload conflict')
  const transfer={p_organization_id:t.organization_id,[kind==='payable'?'p_payable_id':'p_receivable_id']:id,[kind==='payable'?'p_payment_date':'p_receipt_date']:f.date,p_accounting_period:f.period,p_amount:60,p_allocate_amount:50,p_payment_method_id:t.payment_method_id,p_financial_account_id:t.financial_account_id,p_reference:tag,p_idempotency_key:tag+' '+x.label+' '+kind+' transfer'}
  const rpc=kind==='payable'?'register_institutional_payable_payment':'register_institutional_receipt'
  const transferId=sameResult(await Promise.all([c.rpc(rpc,transfer),c.rpc(rpc,transfer)]))
  const bal=await row(c,'v_institutional_'+kind+'_effective',kind+'_id',id,t)
  assert.equal(Number(bal.effective_amount),100);assert.equal(Number(bal.open_amount),50);assert.equal(Number(bal.allocated_amount),50);assert.equal(bal.integrity_ok,true)
  const table=kind==='payable'?'institutional_payable_payment_allocations':'institutional_receipt_allocations',key=kind==='payable'?'payable_payment_id':'receipt_id'
  const rows=requireRows(await c.from(table).select('id,amount,organization_id').eq(key,transferId),'Institutional allocation')
  assert.equal(rows.length,1);assert.equal(Number(rows[0].amount),50);assert.equal(rows[0].organization_id,t.organization_id)
  for(const [entity,action] of [[id,'institutional_'+kind+'.create'],[transferId,kind==='payable'?'institutional_payable.payment':'institutional_receivable.receipt']]) {
   const audit=requireRows(await c.from('audit_logs').select('actor_user_id').eq('entity_id',entity).eq('action',action),'Institutional audit')
   assert.equal(audit.length,1);assert.equal(audit[0].actor_user_id,t.admin_user_id)
  }
  x.facts[kind]={id,transferId,transfer,rpc}
 }
 console.log('Tenant '+x.label+': FIFO order/concurrency and institutional idempotency/balances/audit PASS')
}
async function periods(x) {
 const {c,t}=x,args={p_organization_id:t.organization_id,p_period:f.period,p_reason:tag}
 let closed=false,closeAttempted=false
 try {
  closeAttempted=true
  ok(await c.rpc('close_financial_period',args),'Close isolated 2027 period');closed=true
  assert.equal((await c.rpc('close_financial_period',args)).error?.code,'55000','Duplicate close rejection')
  assert.equal((await c.rpc('register_payment',payment(x,'closed period blocked',1))).error?.code,'55000','Closed period posting rejection')
  const blocked=requireRows(await c.from('payments').select('id').eq('reference',tag).eq('amount',1),'Failed payment must leave no fact')
  assert.equal(blocked.length,0)
 } finally {
  if(closeAttempted&&!closed)console.error('STATE CHECK REQUIRED: close request failed; operator must inspect DEV period 2027-01-01 for Tenant '+x.label)
  if(closed) {
   const r=await c.rpc('reopen_financial_period',args)
   if(r.error) console.error('RESTORATION REQUIRED: DEV period 2027-01-01 for Tenant '+x.label)
   ok(r,'Reopen isolated 2027 period')
  }
 }
 const id=ok(await c.rpc('register_payment',payment(x,'reopened positive',1)),'Reopened positive write')
 const balance=await row(c,'v_payment_balances','payment_id',id,t);assert.equal(Number(balance.available_amount),1);assert.equal(balance.integrity_ok,true)
 const period=await row(c,'financial_periods','period',f.period,t)
 const events=requireRows(await c.from('period_events').select('event_type,actor_user_id').eq('financial_period_id',period.id).order('event_seq',{ascending:false}),'Period events')
 assert.equal(events[0]?.event_type,'reopen');assert.equal(events[0]?.actor_user_id,t.admin_user_id)
 console.log('Tenant '+x.label+': close denies posting; finally reopened and positive write PASS')
}
try {
 const a=await login(f.tenant_a,'A'),b=await login(f.tenant_b,'B')
 for(const [x,other] of [[a,b],[b,a]]) {
  for(const command of catalog.commands) {
   const args=Object.fromEntries(command.arguments.map(name=>[name,name==='p_organization_id'?other.t.organization_id:null]))
   assertPermissionDenied(await x.c.rpc(command.name,args),'Cross organization '+command.name)
  }
  console.log('Tenant '+x.label+': all 20 catalog cross-organization RPC denials PASS')
 }
 for(const x of [a,b]) await financial(x)
 for(const [x,other] of [[a,b],[b,a]]) for(const kind of ['payable','receivable']) {
  const otherFact=other.facts[kind]
  assertHidden(await x.c.from('v_institutional_'+kind+'_effective').select('*').eq(kind+'_id',otherFact.id),'Cross institutional positive fact')
  // Foreign resource inside own organization is rejected by composite ownership FK.
  const foreignArgs={...x.facts[kind].transfer,[kind==='payable'?'p_payable_id':'p_receivable_id']:otherFact.id,p_idempotency_key:tag+' cross '+x.label+' '+kind}
  assert.equal((await x.c.rpc(otherFact.rpc,foreignArgs)).error?.code,'23503','Foreign institutional resource FK')
 }
 for(const x of [a,b]) await periods(x)
 console.log('PASS: real JWT 20-command tenant denial catalog, isolated FIFO, institutional positive/cross/idempotency/audit, period close/reopen on both tenants. MFA/staff/profile/revocation remain OPEN.')
 console.log('Fixture run: '+tag+'; fictitious 2027 ledger remains DEV, periods reopened. Do not rerun this clean-member gate without inspection.')
} finally {await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'})))}
