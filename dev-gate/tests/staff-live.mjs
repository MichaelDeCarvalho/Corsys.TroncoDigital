// DEV dedicated staff only; operator ends sessions/removes temporary staff on any failure.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createInterface} from 'node:readline/promises'
import {createClient} from '@supabase/supabase-js'
import {qrDataUrl} from '../tools/mfa-local.mjs'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {assertHidden,assertPermissionDenied,requireRows,validateFixture} from '../tools/isolation-assertions.mjs'
assert.equal(assertDevEnvironment(),'szqkdekwhzxsoxorgvaz')
const email='michael.c.carvalho+corsys-dev-staff@gmail.com',id=process.env.TEST_STAFF_USER_ID
assert.match(id||'',/^[0-9a-f-]{36}$/i,'Fill dedicated TEST_STAFF_USER_ID')
assert.ok(process.env.TEST_STAFF_PASSWORD,'Fill private TEST_STAFF_PASSWORD')
assert.ok(process.stdin.isTTY,'Interactive terminal required')
const f=JSON.parse(await fs.readFile('financial.fixture.json','utf8')),a=f.tenant_a,b=f.tenant_b
validateFixture(f,'szqkdekwhzxsoxorgvaz')
assert.equal(a.organization_id,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b');assert.equal(b.organization_id,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
const catalog=JSON.parse(await fs.readFile('tenant-command-catalog.json','utf8'));assert.equal(catalog.commands.length,20)
const tag='DEV STAFF LIVE '+randomUUID(),planId='7c71fda8-13b9-4bd4-999a-7df06937666d'
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}}
const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,options)
let qrPath,newFactor,verified=false,originalToken,rl,cleaned=false
function demand(r,label){if(r.error)throw Error(label+': '+(r.error.code||r.error.name||'API error'));return r.data}
async function identity(){
 const session=demand(await c.auth.getSession(),'Session').session
 assert.equal(session?.access_token,originalToken,'JWT changed/expired; live gate invalid')
 assert.equal(demand(await c.auth.getUser(),'Live identity').user?.id,id)
 assert.equal(demand(await c.auth.mfa.getAuthenticatorAssuranceLevel(),'Live assurance').currentLevel,'aal2')
}
async function staff(role,active=true){
 const rows=requireRows(await c.from('platform_staff').select('user_id,role,active'),'Own staff scope')
 assert.equal(rows.length,role?1:0)
 if(role){assert.equal(rows[0].user_id,id);assert.equal(rows[0].role,role);assert.equal(rows[0].active,active)}
}
async function hiddenTenant(tenant){
 for(const table of ['members','v_charge_balances','v_payment_balances'])assertHidden(await c.from(table).select('*').eq('organization_id',tenant.organization_id),'Hidden tenant '+table)
}
async function readonly(){
 for(const tenant of [a,b])for(const command of catalog.commands){
  const args=Object.fromEntries(command.arguments.map(name=>[name,name==='p_organization_id'?tenant.organization_id:null]))
  assertPermissionDenied(await c.rpc(command.name,args),'Staff tenant write '+command.name)
 }
 assertPermissionDenied(await c.rpc('set_saas_plan_active',{p_plan_id:planId,p_active:true,p_reason:tag}),'Staff cannot command Master')
}
async function wait(phase,script){
 console.log('WAIT: '+phase+'; operador aplica scripts/'+script+'. Nao pressione Enter antes da confirmacao.')
 await rl.question('Depois da confirmacao, pressione Enter: ');await identity()
}
async function positiveA(){
 const rows=requireRows(await c.from('members').select('id,organization_id').eq('id',a.member_id),'Support A positive member')
 assert.equal(rows.length,1);assert.equal(rows[0].organization_id,a.organization_id)
 const money=requireRows(await c.from('v_charge_balances').select('organization_id,integrity_ok').eq('organization_id',a.organization_id),'Support A positive finance')
 assert.ok(money.length>0);assert.ok(money.every(x=>x.organization_id===a.organization_id&&x.integrity_ok===true))
 await hiddenTenant(b);await readonly()
}
try {
 const login=demand(await c.auth.signInWithPassword({email,password:process.env.TEST_STAFF_PASSWORD}),'Staff login');assert.ok(login.session)
 const user=demand(await c.auth.getUser(),'Staff identity').user;assert.equal(user?.id,id);assert.equal(user.email?.toLowerCase(),email)
 assert.equal(demand(await c.auth.mfa.getAuthenticatorAssuranceLevel(),'AAL1').currentLevel,'aal1')
 await staff('SUPPORT');await hiddenTenant(a);await hiddenTenant(b)
 assertHidden(await c.from('saas_support_tickets').select('id'),'AAL1 support tickets')
 const internalArgs={p_related_organization_id:a.organization_id,p_subject:tag,p_category:'access',p_priority:'low',p_message:'Fictitious DEV authorization test',p_assigned_staff_user_id:null}
 assertPermissionDenied(await c.rpc('create_saas_internal_ticket',internalArgs),'AAL1 internal ticket')
 await readonly();console.log('PASS: dedicated SUPPORT AAL1 denies tenant data, tickets and privileged commands')
async function code() {
 return await new Promise((resolve,reject)=>{
  let value=''
  process.stdout.write('Digite o codigo de 6 digitos do autenticador (oculto): ')
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8')
  function finish(error) {process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value)}
  function onData(chunk) {for(const char of chunk) {
   if(char==='\u0003')return finish(Error('MFA cancelled locally'))
   if(char==='\r'||char==='\n'){if(value.length===6)return finish();continue}
   if(char==='\u007f'||char==='\b'){if(value.length){value=value.slice(0,-1);process.stdout.write('\b \b')}continue}
   if(/[0-9]/.test(char)&&value.length<6){value+=char;process.stdout.write('*')}
  }}
  process.stdin.on('data',onData)
 })
}
 const factors=demand(await c.auth.mfa.listFactors(),'Factor list')
 assert.ok(Array.isArray(factors.all),'Missing factor inventory')
 const totp=factors.all.filter(x=>x.factor_type==='totp')
 const valid=totp.filter(x=>x.status==='verified')
 assert.ok(valid.length<=1,'Select/resolve multiple verified TOTP factors before testing')
 let factor=valid[0]?.id
 if(!factor) {
  assert.equal(totp.length,0,'Unverified factor already exists; inspect it before enrolling another')
  const enrolled=demand(await c.auth.mfa.enroll({factorType:'totp',friendlyName:'CORSYS DEV Master authenticator'}),'TOTP enrollment')
  newFactor=enrolled.id;factor=enrolled.id
  const qr=enrolled.totp?.qr_code
  assert.ok(typeof qr==='string','Missing TOTP QR')
  const data=qrDataUrl(qr)
  const escaped=data.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  const dir=path.resolve('.mfa-local');await fs.mkdir(dir,{recursive:true,mode:0o700})
  qrPath=path.join(dir,randomUUID()+'.html')
  await fs.writeFile(qrPath,'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:"><title>CORSYS DEV MFA — privado</title><h1>Autenticador Master DEV</h1><p>Escaneie no seu aplicativo autenticador. Nao envie este QR a terceiros ou ao chat.</p><img alt="QR privado para autenticador" width="320" height="320" src="'+escaped+'">',{mode:0o600,flag:'wx'})
  console.log('Abra este arquivo no navegador local e escaneie com seu autenticador: '+qrPath)
 }
 let otp=await code()
 const result=await c.auth.mfa.challengeAndVerify({factorId:factor,code:otp});otp=''
 demand(result,'TOTP challenge/verification');verified=true
 const after=demand(await c.auth.mfa.getAuthenticatorAssuranceLevel(),'Verified assurance')
 assert.equal(after.currentLevel,'aal2')
 assert.equal(demand(await c.auth.getUser(),'Verified server identity').user?.id,id)

 originalToken=demand(await c.auth.getSession(),'Verified session').session.access_token
 await identity();await staff('SUPPORT');await hiddenTenant(a);await hiddenTenant(b);await readonly()
 const ticket=demand(await c.rpc('create_saas_internal_ticket',internalArgs),'SUPPORT positive internal ticket')
 assert.match(ticket||'',/^[0-9a-f-]{36}$/i)
 const tickets=requireRows(await c.from('saas_support_tickets').select('id,ticket_scope,opened_by_user_id').eq('id',ticket),'SUPPORT positive ticket')
 assert.equal(tickets.length,1);assert.equal(tickets[0].ticket_scope,'internal');assert.equal(tickets[0].opened_by_user_id,id)
 const msgs=requireRows(await c.from('saas_support_ticket_messages').select('sender_user_id,visibility').eq('ticket_id',ticket),'SUPPORT internal message')
 assert.equal(msgs.length,1);assert.equal(msgs[0].sender_user_id,id);assert.equal(msgs[0].visibility,'internal_note')
 console.log('PASS: real SUPPORT AAL2 positive internal ticket/message, no tenant session, Master and tenant writes denied; Fixture run: '+tag)
 rl=createInterface({input:process.stdin,output:process.stdout})
 await wait('GRANT A','staff_dev_grant_a.sql');await positiveA();console.log('PASS: same JWT read-only support A positive, B hidden, all tenant writes denied')
 await wait('EXPIRE A','staff_dev_expire_a.sql');await hiddenTenant(a);await hiddenTenant(b);await readonly();console.log('PASS: same JWT expired support loses tenant data')
 await wait('REOPEN A','staff_dev_reopen_a.sql');await positiveA();console.log('PASS: same JWT renewed support window positive')
 await wait('REVOKE A','staff_dev_revoke_a.sql');await hiddenTenant(a);await hiddenTenant(b);await readonly();console.log('PASS: same JWT ended support loses tenant data')
 await wait('BILLING','staff_dev_billing.sql');await staff('BILLING');await hiddenTenant(a);await hiddenTenant(b);await readonly()
 for(const tenant of [a,b]){
  const subs=requireRows(await c.from('saas_subscriptions').select('organization_id,status').eq('organization_id',tenant.organization_id),'BILLING positive subscription')
  assert.equal(subs.length,1);assert.equal(subs[0].status,'active')
 }
 assertHidden(await c.from('saas_support_tickets').select('id').eq('id',ticket),'BILLING support ticket hidden')
 assertPermissionDenied(await c.rpc('reply_saas_support_ticket',{p_organization_id:a.organization_id,p_ticket_id:randomUUID(),p_message:tag,p_next_status:null}),'BILLING tenant reply denied')
 console.log('PASS: same JWT BILLING subscription positives; tenant finance, Support and Master boundaries')
 await wait('INACTIVE','staff_dev_inactive.sql');await staff('BILLING',false);await hiddenTenant(a);await hiddenTenant(b);await readonly()
 assertHidden(await c.from('saas_subscriptions').select('organization_id'),'Inactive billing subscriptions')
 assertPermissionDenied(await c.rpc('create_saas_internal_ticket',internalArgs),'Inactive staff command')
 console.log('PASS: same JWT inactive staff loses subscriptions and privileged write')
 await wait('CLEANUP','staff_dev_cleanup.sql');await staff(null);await hiddenTenant(a);await hiddenTenant(b);cleaned=true
 const refreshToken=demand(await c.auth.getSession(),'Before global signout').session.refresh_token
 demand(await c.auth.signOut({scope:'global'}),'Dedicated staff global signout')
 const probe=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,options)
 const refresh=await probe.auth.refreshSession({refresh_token:refreshToken})
 assert.equal(refresh.data.session,null,'Revoked refresh unexpectedly issued session')
 assert.ok(refresh.error&&['refresh_token_not_found','refresh_token_already_used','session_not_found'].includes(refresh.error.code),'Require exact Auth revocation error; network failure is not PASS')
 assert.ok([400,401].includes(refresh.error.status),'Require actual Auth response')
 console.log('PASS: dedicated staff global signout rejects old refresh token; existing signed access JWT expiry is a separate property')
 console.log('PASS: staff HTTP/MFA, same-JWT support expiry/revocation and Billing/inactive boundaries; fixture cleanup verified. Stage 1 closure still requires full evidence review.')
 console.log('Fixture run: '+tag+'; fictitious internal ticket remains DEV; verified TOTP retained')
} finally {
 rl?.close()
 if(qrPath)await fs.unlink(qrPath).catch(()=>{})
 if(newFactor&&!verified){const r=await c.auth.mfa.unenroll({factorId:newFactor});if(r.error)console.error('INFO: inspect unverified factor cleanup locally')}
 if(!cleaned)console.error('CLEANUP REQUIRED: operator execute scripts/staff_dev_cleanup.sql, ending fixture sessions and removing temporary staff; preserve dedicated Master')
 await c.auth.signOut({scope:'local'})
}
