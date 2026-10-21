import type {SupabaseClient} from '@supabase/supabase-js'
import {legacyFixtures} from './dev-qa-legacy-fixtures'
import {assertQADenied as denied,assertQAUUID as uuid} from './dev-qa-gates'
type Case={label:string;actor:string;org:string;name:string;args:Record<string,unknown>;replay?:Record<string,unknown>;result?:string}
const cases:Case[]=legacyFixtures
const resourceFields:Record<string,string[]>={
 save_member_profile:['p_member_id'],schedule_tenant_monthly_price:['p_rule_id','p_expected_version_id'],
 transition_member_term:['p_member_id','p_current_term_id'],generate_monthly_member_charges:['p_rule_id'],
 publish_tenant_budget:['p_cycle_id'],set_tenant_budget_line:['p_cycle_id'],
 set_draft_accounting_mapping:['p_accounting_plan_id','p_source_id','p_accounting_account_id'],
 publish_validated_accounting_plan:['p_plan_id'],schedule_institutional_recurring_price:['p_rule_id','p_expected_version_id'],
}
export function assertLegacyConflict(r:{status:number;error:{code?:string}|null}){
 if(r.status!==409||r.error?.code!=='PT409')throw Error('HTTP conflict absent: '+r.status+'/'+(r.error?.code??'success'))
}
// Optional DEV page only. Requests use the live application client; credentials are never inspected or logged.
export async function runRemainingLegacyHTTPQA(c:SupabaseClient,report:(s:string)=>void){
 const user=await c.auth.getUser(),own=cases.filter(f=>f.actor===user.data.user?.id)
 if(user.error||own.length!==9||new Set(own.map(f=>f.name)).size!==9)throw Error('Expected DEV actor/case manifest absent')
 const label=own[0].label,org=own[0].org,other=cases.filter(f=>f.label!==label),foreignOrg=other[0].org
 const preflight=await c.from('organizations').select('id,name').eq('id',org)
 if(preflight.error||preflight.data?.length!==1||preflight.data[0].name!==`DEV QA FINANCE ${label} 20261015`)throw Error('DEV fixture mismatch')
 for(const [table,name] of [['recurring_rules','schedule_tenant_monthly_price'],['institutional_recurring_rules','schedule_institutional_recurring_price']]){
  const row=await c.from(table).select('id,active').eq('organization_id',org).eq('id',own.find(f=>f.name===name)!.args.p_rule_id)
  if(row.error||row.data?.length!==1||row.data[0].active!==true)throw Error('QA gate already cleaned; inspect before repeating')
 }
 async function snapshot(){
  const tables=['members','recurring_rules','recurring_member_terms','budget_cycles','accounting_plans',
   'financial_category_account_mappings','institutional_recurring_rules','institutional_recurring_rule_versions',
   'charges','payments','institutional_payables','institutional_receivables']
  const result:Record<string,unknown>={}
  for(const table of tables){
   const r=await c.from(table).select('*').eq('organization_id',org).order('id').limit(151)
   if(r.error||!Array.isArray(r.data)||r.data.length>150||r.data.some(x=>x.organization_id!==org))throw Error('Readback unavailable: '+table)
   result[table]=r.data
  }
  const cash=await c.from('v_financial_account_balances').select('financial_account_id,balance').eq('organization_id',org).order('financial_account_id')
  if(cash.error||!Array.isArray(cash.data))throw Error('Cash readback unavailable')
  result.cash=cash.data
  return JSON.stringify(result)
 }
 const before=await snapshot(),base=globalThis.fetch,traces:{name:string;status:number;code:string|null}[]=[]
 let requests=0
 globalThis.fetch=async(input,init)=>{
  const response=await base(input,init),url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.origin==='https://szqkdekwhzxsoxorgvaz.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){
   const body=await response.clone().json().catch(()=>null)
   traces.push({name:url.pathname.split('/').pop()!,status:response.status,code:typeof body?.code==='string'?body.code:null})
  }
  return response
 }
 const rpc=(name:string,args:Record<string,unknown>)=>{requests++;return c.rpc(name,args)}
 try{
  for(const f of own){
   const foreign=other.find(x=>x.name===f.name)!
   if(f.replay){
    const replay=await Promise.all([rpc(f.name,f.replay),rpc(f.name,f.replay)])
    if(uuid(replay[0])!==f.result||uuid(replay[1])!==f.result)throw Error('Replay mismatch: '+f.name)
    denied(await rpc(f.name,{...f.replay,p_reason:String(f.replay.p_reason)+' changed'}),['22023'])
   }
   const key=crypto.randomUUID(),args={...f.args,p_idempotency_key:key}
   const rejected=await Promise.all([rpc(f.name,args),rpc(f.name,args)])
   rejected.forEach(assertLegacyConflict)
   const race=await Promise.all([rpc(f.name,{...args,p_idempotency_key:crypto.randomUUID()}),rpc(f.name,{...args,p_idempotency_key:crypto.randomUUID()})])
   race.forEach(assertLegacyConflict)
   denied(await rpc(f.name,{...args,p_organization_id:foreignOrg,p_idempotency_key:crypto.randomUUID()}))
   const mixed={...args,p_idempotency_key:crypto.randomUUID()}
   for(const field of resourceFields[f.name])Object.assign(mixed,{[field]:foreign.args[field]})
   denied(await rpc(f.name,mixed),['23503'])
   report(f.name+': HTTP409/PT409, same/distinct-key rejected races, foreign scope/IDs denied'+(f.replay?', successful concurrent replay and payload mismatch':'')+' PASS')
  }
  if(await snapshot()!==before)throw Error('Metadata or financial snapshot changed')
  if(traces.length!==requests)throw Error('Unexpected automatic retry: '+traces.length+'/'+requests)
  for(const f of own)if(traces.filter(t=>t.name===f.name&&t.status===409&&t.code==='PT409').length!==4)throw Error('Conflict trace count mismatch: '+f.name)
  report(`Identity ${label}: ${requests} calls / ${traces.length} requests, no automatic retries; exact metadata/financial readback unchanged PASS`)
  report('Eight additional legacy RPCs and institutional repricing covered. Correction/reversal/Master remain separate; operator must deactivate the two dedicated QA rules after A/B.')
 }finally{globalThis.fetch=base}
}
