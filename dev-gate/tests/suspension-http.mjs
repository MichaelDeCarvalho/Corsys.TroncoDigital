// Fixed DEV fixture only. Suspended phase never runs while subscription is active.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { validateFixture, requireRows, assertPermissionDenied } from '../tools/isolation-assertions.mjs'
const ref = assertDevEnvironment()
const f = JSON.parse(await fs.readFile('financial.fixture.json','utf8'))
validateFixture(f,ref)
const mode = process.argv[2]
assert.ok(['blocked','restored'].includes(mode),'Choose blocked or restored phase')
const b = f.tenant_b
const paymentId = 'd2db23ad-a6f6-4cdb-a8c9-93f2bf752f29'
const chargeId = '87770102-6bd8-437d-897b-69f751458eed'
const tag = 'DEV SUSPENSION ' + randomUUID()
const clients = []
async function login(t,label) {
 const c = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}
 })
 clients.push(c)
 const auth = await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
 assert.ok(!auth.error && auth.data.session,label+': login failed')
 const identity = await c.auth.getUser()
 assert.ok(!identity.error && identity.data.user?.id===t.admin_user_id,label+': unexpected identity')
 return c
}
async function subscription(c,t,status) {
 const rows = requireRows(await c.from('saas_subscriptions').select('id,status').eq('organization_id',t.organization_id),'subscription')
 assert.equal(rows.length,1,'Exactly one DEV subscription required')
 assert.equal(rows[0].status,status,'Unexpected subscription status; no probes executed')
 const accounts=requireRows(await c.from('saas_tenant_accounts').select('access_override').eq('organization_id',t.organization_id),'account override')
 assert.equal(accounts.length,1);assert.equal(accounts[0].access_override,'none')
}
async function balances(c) {
 const charge=requireRows(await c.from('v_charge_balances').select('charge_id,organization_id,open_amount,allocated_amount,integrity_ok').eq('charge_id',chargeId),'positive charge')
 const payment=requireRows(await c.from('v_payment_balances').select('payment_id,organization_id,available_amount,allocated_amount,integrity_ok').eq('payment_id',paymentId),'positive payment')
 for(const rows of [charge,payment]) {assert.equal(rows.length,1);assert.equal(rows[0].organization_id,b.organization_id);assert.equal(rows[0].integrity_ok,true)}
 return {charge,payment}
}
const p = {p_organization_id:b.organization_id,p_member_id:b.member_id,p_payment_date:f.date,p_accounting_period:f.period,p_amount:1,p_payment_method_id:b.payment_method_id,p_financial_account_id:b.financial_account_id,p_reference:tag,p_notes:'Fictitious DEV suspension gate',p_idempotency_key:tag}
try {
 const a=await login(f.tenant_a,'A'), c=await login(b,'B')
 await subscription(a,f.tenant_a,'active')
 await subscription(c,b,mode==='blocked'?'suspended':'active')
 const before=await balances(c)
 const probes=[
 ['create_manual_charge',{p_organization_id:b.organization_id,p_member_id:b.member_id,p_category_id:b.category_id,p_description:tag,p_competence:f.period,p_issue_date:f.date,p_due_date:'2026-09-10',p_accounting_period:f.period,p_amount:1,p_reference:tag,p_idempotency_key:tag}],
 ['register_payment',p],
 ['allocate_payment_to_charge',{p_organization_id:b.organization_id,p_payment_id:paymentId,p_charge_id:chargeId,p_amount:1,p_accounting_period:f.period,p_idempotency_key:tag}],
 ['allocate_payment_fifo',{p_organization_id:b.organization_id,p_payment_id:paymentId,p_accounting_period:f.period}],
 ['cancel_charge',{p_organization_id:b.organization_id,p_charge_id:chargeId,p_accounting_period:f.period,p_reason:tag}],
 ['reverse_payment',{p_organization_id:b.organization_id,p_payment_id:paymentId,p_accounting_period:f.period,p_reason:tag}]
 ]
 if(mode==='blocked') {
  for(const [name,args] of probes) {
   await subscription(c,b,'suspended')
   assertPermissionDenied(await c.rpc(name,args),name)
   console.log(name+': exact 42501 PASS')
  }
  assert.deepEqual(await balances(c),before,'Suspension probes changed financial balances')
  const own=requireRows(await c.from('payments').select('id').eq('reference',tag),'Denied payment absence')
  const charges=requireRows(await c.from('charges').select('id').eq('reference',tag),'Denied charge absence')
  assert.equal(own.length,0);assert.equal(charges.length,0)
  console.log('PASS: real JWT suspended B denies six financial RPCs; own positive reads and balances preserved; A remains active. Restore B before finishing.')
 } else {
  const r=await c.rpc('register_payment',p)
  assert.equal(r.error,null,'Restored positive write failed');assert.match(r.data||'',/^[0-9a-f-]{36}$/i)
  const rows=requireRows(await c.from('v_payment_balances').select('organization_id,available_amount,integrity_ok').eq('payment_id',r.data),'Restored payment')
  assert.equal(rows.length,1);assert.equal(rows[0].organization_id,b.organization_id);assert.equal(Number(rows[0].available_amount),1);assert.equal(rows[0].integrity_ok,true)
  console.log('PASS: both subscriptions active; tenant B real JWT write restored with fictitious payment 1 and valid balance. MFA/revocation/full matrix remain separate.')
 }
 console.log('Fixture run: '+tag)
} finally {await Promise.allSettled(clients.map(c=>c.auth.signOut({scope:'local'})))}
