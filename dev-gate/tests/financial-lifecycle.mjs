// Authorized DEV only; new fictitious ledger facts, never deletes prior facts.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {validateFixture,requireRows,assertHidden,assertPermissionDenied} from '../tools/isolation-assertions.mjs'
import {oneLifecycleEvent} from '../tools/financial-assertions.mjs'
const ref=assertDevEnvironment()
const f=JSON.parse(await fs.readFile('financial.fixture.json','utf8'))
validateFixture(f,ref)
assert.equal(f.period,'2026-09-01');assert.equal(f.date,'2026-09-05')
const tag='DEV LIFECYCLE '+randomUUID()
const clients=[]
console.log('Fixture run: '+tag+'; inspect this tag if execution fails')
function ok(r,label) {assert.equal(r.error,null,label+': '+(r.error?.code||'request failed'));assert.match(r.data||'',/^[0-9a-f-]{36}$/i);return r.data}
async function row(c,table,key,id,t) {
 const rows=requireRows(await c.from(table).select('*').eq(key,id),table)
 assert.equal(rows.length,1,table+': positive row required')
 assert.equal(rows[0].organization_id,t.organization_id)
 return rows[0]
}
async function login(t,label) {
 const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}
 })
 clients.push(c)
 const auth=await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
 assert.ok(!auth.error&&auth.data.session,label+': login failed')
 const user=await c.auth.getUser();assert.ok(!user.error&&user.data.user?.id===t.admin_user_id,label+': unexpected identity')
 const subs=requireRows(await c.from('saas_subscriptions').select('status').eq('organization_id',t.organization_id),'subscription')
 assert.equal(subs.length,1);assert.equal(subs[0].status,'active')
 const account=await row(c,'saas_tenant_accounts','organization_id',t.organization_id,t);assert.equal(account.access_override,'none')
 for(const [table,key] of [['members','member_id'],['financial_categories','category_id'],['payment_methods','payment_method_id'],['financial_accounts','financial_account_id']]) await row(c,table,'id',t[key],t)
 return {c,t,label,scenarios:[]}
}
async function setup(x,suffix) {
 const {c,t}=x
 const common={p_organization_id:t.organization_id,p_member_id:t.member_id,p_accounting_period:f.period,p_reference:tag}
 const charge=ok(await c.rpc('create_manual_charge',{...common,p_category_id:t.category_id,p_description:tag+' '+suffix,p_competence:f.period,p_issue_date:f.date,p_due_date:'2026-09-10',p_amount:100,p_idempotency_key:tag+' '+x.label+' '+suffix+' charge'}),'create charge')
 const payment=ok(await c.rpc('register_payment',{...common,p_payment_date:f.date,p_amount:100,p_payment_method_id:t.payment_method_id,p_financial_account_id:t.financial_account_id,p_notes:'Fictitious DEV lifecycle',p_idempotency_key:tag+' '+x.label+' '+suffix+' payment'}),'register payment')
 const allocation=ok(await c.rpc('allocate_payment_to_charge',{p_organization_id:t.organization_id,p_payment_id:payment,p_charge_id:charge,p_amount:40,p_accounting_period:f.period,p_idempotency_key:tag+' '+x.label+' '+suffix+' allocation'}),'allocate')
 const s={charge,payment,allocation}
 await balances(x,s,60,40,60,40,false,false)
 return s
}
async function balances(x,s,open,allocated,available,paymentAllocated,cancelled,reversed) {
 const ch=await row(x.c,'v_charge_balances','charge_id',s.charge,x.t)
 const p=await row(x.c,'v_payment_balances','payment_id',s.payment,x.t)
 assert.equal(Number(ch.original_amount),100);assert.equal(Number(ch.open_amount),open);assert.equal(Number(ch.allocated_amount),allocated);assert.equal(ch.is_cancelled,cancelled);assert.equal(ch.integrity_ok,true)
 assert.equal(Number(p.amount),100);assert.equal(Number(p.available_amount),available);assert.equal(Number(p.allocated_amount),paymentAllocated);assert.equal(p.is_reversed,reversed);assert.equal(p.integrity_ok,true)
}
function args(x,key,id) {return {p_organization_id:x.t.organization_id,[key]:id,p_accounting_period:f.period,p_reason:tag}}
async function event(x,table,key,id,action,entity,expected=1) {
 const rows=requireRows(await x.c.from(table).select('id,organization_id,created_by').eq(key,id),table)
 assert.equal(rows.length,expected)
 for(const r of rows) {assert.equal(r.organization_id,x.t.organization_id);assert.equal(r.created_by,x.t.admin_user_id)}
 const audit=requireRows(await x.c.from('audit_logs').select('id,actor_user_id').eq('entity_id',entity).eq('action',action),'audit')
 assert.equal(audit.length,1);assert.equal(audit[0].actor_user_id,x.t.admin_user_id)
}
try {
 const a=await login(f.tenant_a,'A'),b=await login(f.tenant_b,'B')
 for(const x of [a,b]) for(const suffix of ['reverse-first','cancel-first']) x.scenarios.push(await setup(x,suffix))
 for(const [x,other] of [[a,b],[b,a]]) {
  const [s,u]=x.scenarios, foreign=other.scenarios[0]
  for(const [rpc,key,id] of [['reverse_payment','p_payment_id',foreign.payment],['cancel_charge','p_charge_id',foreign.charge],['allocate_payment_fifo','p_payment_id',foreign.payment]]) {
   const base={p_organization_id:x.t.organization_id,[key]:id,p_accounting_period:f.period,...(rpc==='allocate_payment_fifo'?{}:{p_reason:tag})}
   assert.equal((await x.c.rpc(rpc,base)).error?.code,'P0002','Foreign resource must be absent inside own tenant')
   assertPermissionDenied(await x.c.rpc(rpc,{...base,p_organization_id:other.t.organization_id}),'Foreign organization '+rpc)
  }
  for(const [rpc,key,id] of [['reverse_payment','p_payment_id',s.payment],['cancel_charge','p_charge_id',s.charge]]) {
   assert.equal((await x.c.rpc(rpc,{...args(x,key,id),p_reason:' '})).error?.code,'22023','Empty reason rejection')
   assert.equal((await x.c.rpc(rpc,{...args(x,key,id),p_accounting_period:'2026-09-02'})).error?.code,'22023','Invalid accounting period rejection')
  }
  await balances(x,s,60,40,60,40,false,false)
  const reverse=args(x,'p_payment_id',s.payment)
  oneLifecycleEvent(await Promise.all([x.c.rpc('reverse_payment',reverse),x.c.rpc('reverse_payment',reverse)]))
  await balances(x,s,100,0,0,0,false,true)
  await event(x,'payment_reversals','payment_id',s.payment,'payment.reverse',s.payment)
  const allocReverse=requireRows(await x.c.from('allocation_reversals').select('id,organization_id').eq('allocation_id',s.allocation),'allocation reversal')
  assert.equal(allocReverse.length,1);assert.equal(allocReverse[0].organization_id,x.t.organization_id)
  assert.equal((await x.c.rpc('reverse_payment',reverse)).error?.code,'23505')
  assert.equal((await x.c.rpc('allocate_payment_fifo',{p_organization_id:x.t.organization_id,p_payment_id:s.payment,p_accounting_period:f.period})).error?.code,'55000','Reversed payment cannot run FIFO')
  const cancel=args(x,'p_charge_id',u.charge)
  oneLifecycleEvent(await Promise.all([x.c.rpc('cancel_charge',cancel),x.c.rpc('cancel_charge',cancel)]))
  await balances(x,u,0,0,100,0,true,false)
  await event(x,'charge_cancellations','charge_id',u.charge,'charge.cancel',u.charge)
  const allocCancel=requireRows(await x.c.from('allocation_reversals').select('id,organization_id').eq('allocation_id',u.allocation),'cancellation allocation reversal')
  assert.equal(allocCancel.length,1);assert.equal(allocCancel[0].organization_id,x.t.organization_id)
  assert.equal((await x.c.rpc('cancel_charge',cancel)).error?.code,'23505')
  ok(await x.c.rpc('reverse_payment',args(x,'p_payment_id',u.payment)),'Reverse remaining payment')
  ok(await x.c.rpc('cancel_charge',args(x,'p_charge_id',s.charge)),'Cancel reopened charge')
  await balances(x,s,0,0,0,0,true,true);await balances(x,u,0,0,0,0,true,true)
  // Original ledger facts remain present; event tables record corrections.
  for(const fact of [s,u]) {
   await event(x,'payment_reversals','payment_id',fact.payment,'payment.reverse',fact.payment)
   await event(x,'charge_cancellations','charge_id',fact.charge,'charge.cancel',fact.charge)
   const original=await row(x.c,'charges','id',fact.charge,x.t);assert.equal(Number(original.original_amount),100)
   const payment=await row(x.c,'payments','id',fact.payment,x.t);assert.equal(Number(payment.amount),100)
   const allocation=await row(x.c,'receivable_allocations','id',fact.allocation,x.t);assert.equal(Number(allocation.amount),40)
  }
  console.log('Tenant '+x.label+': reversal/cancellation, concurrent single events, original ledger and balances PASS')
 }
 for(const [x,other] of [[a,b],[b,a]]) for(const fact of other.scenarios) {
  for(const [table,key,id] of [['payment_reversals','payment_id',fact.payment],['charge_cancellations','charge_id',fact.charge],['allocation_reversals','allocation_id',fact.allocation]]) assertHidden(await x.c.from(table).select('id').eq(key,id),'Cross '+table)
 }
 console.log('PASS: lifecycle HTTP/JWT both tenants, reversal/cancellation effects, concurrent duplicates, audit and cross-resource denials. MFA/revocation/positive FIFO/institutional/full matrix remain separate.')
 console.log('Fixture run: '+tag+'; corrected fictitious ledger facts remain DEV. Do not repeat blindly after failure.')
} finally {await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'})))}
