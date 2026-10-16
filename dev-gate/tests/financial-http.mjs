// Authorized DEV only. Real JWT requests; persistent fictitious financial facts.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { validateFixture, assertHidden, assertPermissionDenied, requireRows } from '../tools/isolation-assertions.mjs'
import { sameResult, oneWinner } from '../tools/financial-assertions.mjs'
const ref = assertDevEnvironment()
const f = JSON.parse(await fs.readFile('financial.fixture.json', 'utf8'))
validateFixture(f, ref)
for (const t of [f.tenant_a, f.tenant_b]) {
 for (const key of ['member_id','category_id','payment_method_id','financial_account_id']) assert.match(t[key] || '', /^[0-9a-f-]{36}$/i)
}
assert.equal(f.period, '2026-09-01')
assert.equal(f.date, '2026-09-05')
for (const k of ['SUPABASE_PUBLISHABLE_KEY','TEST_ADMIN_A_PASSWORD','TEST_ADMIN_B_PASSWORD']) assert.ok(process.env[k], 'Missing variable: ' + k)
const tag = 'DEV HTTP ' + randomUUID()
const clients = []
const facts = []
function ok(r, label) {
 assert.equal(r.error, null, label + ': request failed with ' + (r.error?.code || 'transport error'))
 assert.match(r.data || '', /^[0-9a-f-]{36}$/i, label + ': missing UUID')
 return r.data
}
async function login(t, email, password, label) {
 const c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}
 })
 clients.push(c)
 const auth = await c.auth.signInWithPassword({email,password})
 assert.ok(!auth.error && auth.data.session, label + ': login failed')
 const identity = await c.auth.getUser()
 assert.ok(!identity.error && identity.data.user?.id === t.admin_user_id, label + ': unexpected identity')
 return c
}
function charge(t, suffix, overrides={}) {
 return {p_organization_id:t.organization_id,p_member_id:t.member_id,p_category_id:t.category_id,
 p_description:tag + ' ' + suffix,p_competence:f.period,p_issue_date:f.date,p_due_date:'2026-09-10',
 p_accounting_period:f.period,p_amount:100,p_reference:tag,p_idempotency_key:tag+' charge '+suffix,...overrides}
}
function payment(t, suffix, amount) {
 return {p_organization_id:t.organization_id,p_member_id:t.member_id,p_payment_date:f.date,
 p_accounting_period:f.period,p_amount:amount,p_payment_method_id:t.payment_method_id,
 p_financial_account_id:t.financial_account_id,p_reference:tag,p_notes:'Fictitious DEV only',
 p_idempotency_key:tag+' payment '+suffix}
}
function allocation(t, paymentId, chargeId, amount, suffix) {
 return {p_organization_id:t.organization_id,p_payment_id:paymentId,p_charge_id:chargeId,p_amount:amount,
 p_accounting_period:f.period,p_idempotency_key:tag+' allocation '+suffix}
}
async function row(c, table, key, id) {
 const rows = requireRows(await c.from(table).select('*').eq(key,id),table)
 assert.equal(rows.length,1,table+': positive own row required')
 return rows[0]
}
try {
 const a = await login(f.tenant_a,process.env.TEST_ADMIN_A_EMAIL,process.env.TEST_ADMIN_A_PASSWORD,'A')
 const b = await login(f.tenant_b,process.env.TEST_ADMIN_B_EMAIL,process.env.TEST_ADMIN_B_PASSWORD,'B')
 for (const [c,t,other,label] of [[a,f.tenant_a,f.tenant_b,'A'],[b,f.tenant_b,f.tenant_a,'B']]) {
  for (const [table,key] of [['members','member_id'],['financial_categories','category_id'],['payment_methods','payment_method_id'],['financial_accounts','financial_account_id']]) {
   const fixtureRow = await row(c,table,'id',t[key])
   assert.equal(fixtureRow.organization_id,t.organization_id,'Fixture resource belongs to a different tenant')
  }
  const args = charge(t,'base')
  const chargeId = sameResult(await Promise.all([c.rpc('create_manual_charge',args),c.rpc('create_manual_charge',args)]))
  const changed = await c.rpc('create_manual_charge',{...args,p_amount:101})
  assert.equal(changed.error?.code,'22023','Changed payload must fail with 22023')
  const p = payment(t,'base',150)
  const paymentId = sameResult(await Promise.all([c.rpc('register_payment',p),c.rpc('register_payment',p)]))
  const al = allocation(t,paymentId,chargeId,100,'base')
  const allocationId = sameResult(await Promise.all([c.rpc('allocate_payment_to_charge',al),c.rpc('allocate_payment_to_charge',al)]))
  const cb = await row(c,'v_charge_balances','charge_id',chargeId)
  assert.equal(Number(cb.open_amount),0); assert.equal(Number(cb.allocated_amount),100); assert.equal(cb.integrity_ok,true)
  const pb = await row(c,'v_payment_balances','payment_id',paymentId)
  assert.equal(Number(pb.available_amount),50); assert.equal(pb.integrity_ok,true)
  const audit = requireRows(await c.from('audit_logs').select('entity_id').in('entity_id',[chargeId,paymentId,allocationId]),'Audit')
  assert.equal(audit.length,3,'Idempotency must not duplicate audit events')
  assertPermissionDenied(await c.rpc('create_manual_charge',charge(other,'cross-'+label)),'Cross organization command')
  assert.equal((await c.rpc('create_manual_charge',charge(t,'foreign-member',{p_member_id:other.member_id}))).error?.code,'23503','Foreign member must fail with composite FK')
  assert.equal((await c.rpc('allocate_payment_to_charge',allocation(t,paymentId,chargeId,1,'over'))).error?.code,'23514','Over-allocation must fail with balance constraint')

  const c1 = ok(await c.rpc('create_manual_charge',charge(t,'race-1')),'Race charge 1')
  const c2 = ok(await c.rpc('create_manual_charge',charge(t,'race-2')),'Race charge 2')
  const raceP = ok(await c.rpc('register_payment',payment(t,'race',100)),'Race payment')
  const races = await Promise.all([
   c.rpc('allocate_payment_to_charge',allocation(t,raceP,c1,100,'race-1')),
   c.rpc('allocate_payment_to_charge',allocation(t,raceP,c2,100,'race-2'))
  ])
  oneWinner(races)
  const raceBalance = await row(c,'v_payment_balances','payment_id',raceP)
  assert.equal(Number(raceBalance.allocated_amount),100)
  assert.equal(Number(raceBalance.available_amount),0)
  assert.equal(raceBalance.integrity_ok,true)
  const allocations = requireRows(await c.from('receivable_allocations').select('id,amount').eq('payment_id',raceP),'Race allocations')
  assert.equal(allocations.length,1,'Exactly one allocation must persist')
  assert.equal(Number(allocations[0].amount),100)
  const balances = await Promise.all([row(c,'v_charge_balances','charge_id',c1),row(c,'v_charge_balances','charge_id',c2)])
  assert.deepEqual(balances.map(x=>Number(x.open_amount)).sort((x,y)=>x-y),[0,100])
  assert.ok(balances.every(x=>x.integrity_ok===true))
  const position = await row(c,'v_member_financial_position','member_id',t.member_id)
  assert.equal(position.integrity_ok,true)
  facts.push({c,t,chargeId,paymentId})
  console.log('Tenant '+label+': financial commands, audit and concurrent allocation checks PASS')
 }
 // Both tenants now have positive posted facts before testing cross financial reads.
 for (const own of facts) {
  const other = facts.find(x=>x!==own)
  for (const [view,key,id] of [['v_charge_balances','charge_id',other.chargeId],['v_payment_balances','payment_id',other.paymentId],['v_member_financial_position','member_id',other.t.member_id]]) {
   assertHidden(await own.c.from(view).select('organization_id').eq(key,id),'Cross financial view '+view)
  }
  assert.equal((await own.c.rpc('allocate_payment_to_charge',allocation(own.t,other.paymentId,own.chargeId,1,'foreign-payment'))).error?.code,'P0002','Foreign payment must not be found within own organization')
 }
 console.log('PASS: financial HTTP/JWT on both tenants, positive/cross views, audit, concurrent idempotency and allocation competition. MFA/suspension/remaining RPC matrix are separate gates.')
 console.log('Fixture run: '+tag+'; fictitious posted facts remain in DEV. Do not repeat blindly after failure.')
} finally {
 await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'})))
}

