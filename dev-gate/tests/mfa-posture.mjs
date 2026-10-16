// Read-only MFA inventory. Does not enroll factors, grant staff or prove AAL2.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { assertDevEnvironment } from '../tools/dev-environment.mjs'
import { validateFixture } from '../tools/isolation-assertions.mjs'
const ref=assertDevEnvironment()
const f=JSON.parse(await fs.readFile('financial.fixture.json','utf8'))
validateFixture(f,ref)
for(const [label,t] of [['A',f.tenant_a],['B',f.tenant_b]]) {
 const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}
 })
 try {
  const r=await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
  assert.ok(!r.error && r.data.session,label+': login failed')
  const user=await c.auth.getUser()
  assert.ok(!user.error && user.data.user?.id===t.admin_user_id,label+': unexpected identity')
  const aal=await c.auth.mfa.getAuthenticatorAssuranceLevel()
  assert.equal(aal.error,null,'MFA assurance request failed')
  const factors=await c.auth.mfa.listFactors()
  assert.equal(factors.error,null,'MFA factors request failed')
  assert.ok(['aal1','aal2'].includes(aal.data?.currentLevel),'Missing current assurance level')
  assert.ok(['aal1','aal2'].includes(aal.data?.nextLevel),'Missing next assurance level')
  assert.ok(Array.isArray(factors.data?.all),'Missing factor list')
  const verified=factors.data.all.filter(x=>x.status==='verified').length
  console.log('INFO: Tenant '+label+' current='+aal.data.currentLevel+' next='+aal.data.nextLevel+' verified_factors='+verified)
 } finally {await c.auth.signOut({scope:'local'})}
}
console.log('INFO: read-only MFA posture collected. Not MFA PASS; enrollment/challenge, signed AAL2, privileged staff RPC and session lifecycle remain unverified.')
