// Coordinated DEV test. Keep original JWT; SQL operator restores ADMIN on any failure.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createInterface} from 'node:readline/promises'
import {createClient} from '@supabase/supabase-js'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {validateFixture,requireRows,assertHidden,assertPermissionDenied} from '../tools/isolation-assertions.mjs'
const ref=assertDevEnvironment(),f=JSON.parse(await fs.readFile('financial.fixture.json','utf8')),extra=JSON.parse(await fs.readFile('remaining.fixture.json','utf8'))
validateFixture(f,ref);validateFixture(extra,ref)
const catalog=JSON.parse(await fs.readFile('tenant-command-catalog.json','utf8'));assert.equal(catalog.commands.length,20)
const b=f.tenant_b,a=f.tenant_a,tag='DEV LIVE PROFILES '+randomUUID()
assert.ok(process.stdin.isTTY,'Interactive terminal required')
const rl=createInterface({input:process.stdin,output:process.stdout})
const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}})
let originalToken,restored=false
async function identity() {
 const session=await c.auth.getSession()
 assert.ok(!session.error&&session.data.session?.access_token===originalToken,'Session token changed or expired; cannot prove live revocation')
 const user=await c.auth.getUser();assert.ok(!user.error&&user.data.user?.id===b.admin_user_id,'Real B identity required')
}
async function profile(code,linked=false) {
 const roles=requireRows(await c.from('user_roles').select('role_id').eq('user_id',b.admin_user_id),'Own roles')
 const links=requireRows(await c.from('member_user_links').select('member_id,organization_id').eq('user_id',b.admin_user_id),'Own member links')
 if(code) {
  assert.equal(roles.length,1)
  const names=requireRows(await c.from('roles').select('code').eq('id',roles[0].role_id),'Role code')
  assert.equal(names.length,1);assert.equal(names[0].code,code);assert.equal(links.length,0)
 } else {
  assert.equal(roles.length,0);assert.equal(links.length,linked?1:0)
  if(linked){assert.equal(links[0].member_id,b.member_id);assert.equal(links[0].organization_id,b.organization_id)}
 }
}
async function positiveAll() {
 for(const id of [b.member_id,extra.tenant_b.member_id]) {
  const own=requireRows(await c.from('members').select('id,organization_id').eq('id',id),'Positive B member')
  assert.equal(own.length,1);assert.equal(own[0].organization_id,b.organization_id)
 }
 assertHidden(await c.from('members').select('id').eq('organization_id',a.organization_id),'Foreign A members')
}
async function deniedCatalog() {
 for(const command of catalog.commands) {
  const args=Object.fromEntries(command.arguments.map(name=>[name,name==='p_organization_id'?b.organization_id:null]))
  assertPermissionDenied(await c.rpc(command.name,args),'Readonly/revoked '+command.name)
 }
}
async function wait(phase,script) {
 console.log('WAIT: '+phase+'; operador aplica scripts/'+script+'. Nao pressione Enter antes da confirmacao.')
 await rl.question('Depois da confirmacao do operador, pressione Enter: ')
 await identity()
}
async function payment(label) {
 const result=await c.rpc('register_payment',{p_organization_id:b.organization_id,p_member_id:b.member_id,p_payment_date:f.date,p_accounting_period:f.period,p_amount:1,p_payment_method_id:b.payment_method_id,p_financial_account_id:b.financial_account_id,p_reference:tag,p_notes:'Fictitious DEV live profile test',p_idempotency_key:tag+' '+label})
 assert.equal(result.error,null,'Authorized profile positive write failed');assert.match(result.data||'',/^[0-9a-f-]{36}$/i)
 const rows=requireRows(await c.from('v_payment_balances').select('available_amount,organization_id,integrity_ok').eq('payment_id',result.data),'Profile positive balance')
 assert.equal(rows.length,1);assert.equal(rows[0].organization_id,b.organization_id);assert.equal(Number(rows[0].available_amount),1);assert.equal(rows[0].integrity_ok,true)
}
try {
 const login=await c.auth.signInWithPassword({email:process.env.TEST_ADMIN_B_EMAIL,password:process.env.TEST_ADMIN_B_PASSWORD})
 assert.ok(!login.error&&login.data.session,'B login failed');originalToken=login.data.session.access_token
 await identity();await profile('ADMIN');await positiveAll()
 console.log('PASS: original B ADMIN JWT baseline; Fixture run: '+tag)
 await wait('TREASURER','profile_dev_b_treasurer.sql')
 await profile('TREASURER');await positiveAll();await payment('treasurer')
 assertPermissionDenied(await c.rpc('set_saas_plan_active',{p_plan_id:randomUUID(),p_active:true,p_reason:tag}),'Treasurer Master denial')
 assertHidden(await c.from('user_roles').select('user_id').eq('user_id',a.admin_user_id),'Treasurer other-user role privacy')
 console.log('PASS: same JWT TREASURER positive financial write and tenant/Master boundaries')
 await wait('VIEWER','profile_dev_b_viewer.sql')
 await profile('VIEWER');await positiveAll();await deniedCatalog()
 console.log('PASS: same JWT VIEWER own positive reads and 20 write denials')
 await wait('LINKED MEMBER','profile_dev_b_member.sql')
 await profile(null,true)
 const own=requireRows(await c.from('members').select('id,organization_id'),'Linked member scope')
 assert.equal(own.length,1);assert.equal(own[0].id,b.member_id);assert.equal(own[0].organization_id,b.organization_id)
 const finance=requireRows(await c.from('v_charge_balances').select('member_id,organization_id,integrity_ok'),'Linked financial scope')
 assert.ok(finance.length>0,'Linked member financial positive facts required')
 assert.ok(finance.every(x=>x.member_id===b.member_id&&x.organization_id===b.organization_id&&x.integrity_ok===true))
 await deniedCatalog()
 console.log('PASS: same JWT member sees only linked member and financial facts; 20 write denials')
 await wait('REVOKED LINK','profile_dev_b_revoke.sql')
 await profile(null,false)
 for(const table of ['members','v_charge_balances','v_payment_balances'])assertHidden(await c.from(table).select('*'),'Revoked '+table)
 await deniedCatalog()
 console.log('PASS: same unrefreshed JWT revoked link loses member/financial access; 20 write denials')
 await wait('RESTORE ADMIN','profile_dev_b_restore.sql')
 await profile('ADMIN');await positiveAll();await payment('restored');await identity();restored=true
 console.log('PASS: same JWT ADMIN restored; all original scopes and positive write restored. MFA/staff/support/session revocation remain separate.')
 console.log('Fixture run: '+tag+'; two fictitious payments 1 remain DEV')
} finally {
 rl.close()
 if(!restored)console.error('RESTORE REQUIRED: operator must execute scripts/profile_dev_b_restore.sql now, even if cancelled or failed')
 await c.auth.signOut({scope:'local'})
}
