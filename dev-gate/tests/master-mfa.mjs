// DEV dedicated Master only. Owner enters TOTP locally; no token/secret/OTP logging.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {qrDataUrl} from '../tools/mfa-local.mjs'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
import {assertHidden,assertPermissionDenied,requireRows} from '../tools/isolation-assertions.mjs'
assert.equal(assertDevEnvironment(),'szqkdekwhzxsoxorgvaz')
const email='michael.c.carvalho+corsys-dev-master@gmail.com',id=process.env.TEST_MASTER_USER_ID
assert.match(id||'',/^[0-9a-f-]{36}$/i,'Fill TEST_MASTER_USER_ID from the dedicated Auth account')
assert.ok(process.env.TEST_MASTER_PASSWORD,'Fill TEST_MASTER_PASSWORD only in private .env.dev')
assert.ok(process.stdin.isTTY,'Interactive terminal required for masked authenticator code')
const tag='DEV MASTER MFA '+randomUUID(),planId='7c71fda8-13b9-4bd4-999a-7df06937666d'
const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}})
let qrPath,newFactor,verified=false
function demand(r,label) {if(r.error)throw Error(label+': '+(r.error.code||r.error.name||'API error'));return r.data}
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
try {
 const login=demand(await c.auth.signInWithPassword({email,password:process.env.TEST_MASTER_PASSWORD}),'Master login')
 assert.ok(login.session)
 const user=demand(await c.auth.getUser(),'Master getUser').user
 assert.equal(user?.id,id);assert.equal(user.email?.toLowerCase(),email)
 const aal=demand(await c.auth.mfa.getAuthenticatorAssuranceLevel(),'Initial assurance')
 assert.equal(aal.currentLevel,'aal1')
 const args={p_plan_id:planId,p_active:true,p_reason:tag}
 assertPermissionDenied(await c.rpc('set_saas_plan_active',args),'Master password-only operation')
 assertHidden(await c.from('platform_staff').select('user_id').eq('user_id',id),'AAL1 staff RLS')
 console.log('PASS: dedicated identity, signed password session and privileged AAL1 denial')
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
 const staff=requireRows(await c.from('platform_staff').select('user_id,role,active').eq('user_id',id),'AAL2 own staff')
 assert.equal(staff.length,1,'Dedicated Master must be bound before this test');assert.equal(staff[0].role,'MASTER');assert.equal(staff[0].active,true)
 const plans=requireRows(await c.from('saas_plans').select('id,code,price,active').eq('id',planId),'DEV plan')
 assert.equal(plans.length,1);assert.equal(plans[0].code,'dev_http_financial_20261007');assert.equal(Number(plans[0].price),0);assert.equal(plans[0].active,true)
 assert.equal(demand(await c.rpc('set_saas_plan_active',args),'Master AAL2 positive RPC'),planId)
 const audit=requireRows(await c.from('saas_master_audit_logs').select('staff_user_id,metadata').eq('resource_id',planId).eq('staff_user_id',id),'Master audit')
 const own=audit.filter(x=>x.metadata?.reason===tag)
 assert.equal(own.length,1);assert.equal(own[0].metadata.previous_active,true);assert.equal(own[0].metadata.new_active,true)
 console.log('PASS: real TOTP verification, signed AAL2, dedicated Master positive RLS/RPC and audit; DEV zero-price plan remains active. Support/Billing/expiry/revocation/full stage remain separate.')
 console.log('Fixture run: '+tag+'; verified authenticator remains enrolled. No secrets printed.')
} finally {
 if(qrPath)await fs.unlink(qrPath).catch(()=>{})
 if(newFactor&&!verified){const cleanup=await c.auth.mfa.unenroll({factorId:newFactor});if(cleanup.error)console.error('INFO: unverified factor cleanup requires local inspection; no automatic retry')}
 await c.auth.signOut({scope:'local'})
}
