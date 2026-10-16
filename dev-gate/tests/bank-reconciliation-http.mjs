// Uses only two explicitly approved, already persisted synthetic DEV statements.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {assertDevEnvironment} from '../tools/dev-environment.mjs'
const ref=assertDevEnvironment()
const f=JSON.parse(await fs.readFile('bank-reconciliation.fixture.json','utf8'))
assert.equal(ref,f.project_ref)
for(const k of ['TEST_ADMIN_A_EMAIL','TEST_ADMIN_A_PASSWORD','TEST_ADMIN_B_EMAIL','TEST_ADMIN_B_PASSWORD','SUPABASE_PUBLISHABLE_KEY'])assert.ok(process.env[k],'Missing variable: '+k)
const clients=[],created=[]
const ok=(r)=>{assert.equal(r.error,null,'RPC failed: '+(r.error?.code??'transport'));assert.match(r.data??'',/^[a-f0-9-]{36}$/i);return r.data}
const rows=(r)=>{assert.equal(r.error,null,'Read failed: '+(r.error?.code??'transport'));assert.ok(Array.isArray(r.data));return r.data}
const denied=(r,codes=['42501'])=>assert.ok(r.error&&codes.includes(r.error.code),'Expected denial, received '+(r.error?.code??'success'))
async function login(label,t){
 const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 clients.push(c)
 const r=await c.auth.signInWithPassword({email:process.env['TEST_ADMIN_'+label+'_EMAIL'],password:process.env['TEST_ADMIN_'+label+'_PASSWORD']})
 assert.ok(!r.error&&r.data.user?.id===t.admin_user_id,'Unexpected DEV identity '+label)
 return c
}
let b
const args=(line,key)=>({p_organization_id:f.tenant_b.organization_id,p_line_id:line,p_kind:'member_payment',p_target_id:f.payment_id,p_amount:f.amount,p_reason:'DEV QA concurrent HTTP test',p_idempotency_key:key})
async function reverse(id){ok(await b.rpc('reverse_tenant_bank_match',{p_organization_id:f.tenant_b.organization_id,p_match_id:id,p_reason:'DEV QA HTTP cleanup preserves history',p_idempotency_key:randomUUID()}))}
try{
 const a=await login('A',f.tenant_a);b=await login('B',f.tenant_b)
 for(const [c,t,other] of [[a,f.tenant_a,f.tenant_b],[b,f.tenant_b,f.tenant_a]]){
  const own=await c.rpc('read_tenant_budget_detail',{p_organization_id:t.organization_id,p_cycle_id:t.budget_id})
  assert.equal(own.error,null);assert.equal(own.data.cycle.organization_id,t.organization_id)
  denied(await c.rpc('read_tenant_budget_detail',{p_organization_id:other.organization_id,p_cycle_id:other.budget_id}))
  denied(await c.rpc('read_tenant_budget_detail',{p_organization_id:t.organization_id,p_cycle_id:other.budget_id}),['23503'])
  assert.equal(rows(await c.from('bank_statement_imports').select('id').eq('organization_id',other.organization_id)).length,0)
  assert.equal(rows(await c.from('bank_statement_lines').select('id').eq('organization_id',other.organization_id)).length,0)
 }
 denied(await a.rpc('match_tenant_bank_statement',args(f.lines[0],randomUUID())))
 denied(await a.rpc('match_tenant_bank_statement',{...args(f.lines[0],randomUUID()),p_organization_id:f.tenant_a.organization_id}),['23503'])
 const imports=rows(await b.from('bank_statement_imports').select('id,file_name,status').in('id',f.imports))
 assert.equal(imports.length,2);assert.ok(imports.every(i=>i.file_name.startsWith('DEV QA CONCURRENCY 20261014-')&&i.status==='validated'),'Fixtures must be validated and have no active matches; inspect before rerunning')
 const key=randomUUID()
 const replay=await Promise.all([b.rpc('match_tenant_bank_statement',args(f.lines[0],key)),b.rpc('match_tenant_bank_statement',args(f.lines[0],key))])
 for(const r of replay)if(!r.error&&r.data&&!created.includes(r.data))created.push(r.data)
 assert.equal(ok(replay[0]),ok(replay[1]),'Concurrent same-key replay differs')
 await reverse(created[0]);created.length=0
 const race=await Promise.all(f.lines.map(l=>b.rpc('match_tenant_bank_statement',args(l,randomUUID()))))
 for(const r of race)if(!r.error&&r.data)created.push(r.data)
 assert.equal(race.filter(r=>!r.error).length,1,'Exactly one capacity winner required')
 assert.equal(race.find(r=>r.error)?.error.code,'23514','Capacity loser must fail closed')
 console.log('DEV_BANK_HTTP_ISOLATION_REPLAY_CAPACITY_PASS')
}finally{
 if(b)for(const id of created)await reverse(id)
 for(const c of clients)await c.auth.signOut({scope:'local'})
}
