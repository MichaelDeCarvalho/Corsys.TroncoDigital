import {getSupabaseClient} from './lib/supabase'
import {assertQADenied as denied,assertQARows as rows,assertQAUUID as uuid,assertQAOneWinner as winner} from './lib/dev-qa-gates'
const target='https://szqkdekwhzxsoxorgvaz.supabase.co'
if(import.meta.env.VITE_DEV_QA_ENABLED!=='true'||import.meta.env.VITE_SUPABASE_URL!==target||location.hostname!=='corsys-tronco-digital-dev.corsys1.workers.dev')throw Error('DEV QA target denied')
const c=getSupabaseClient()
const fixtures=[
 {label:'A',actor:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',org:'68ca5c28-b1bd-4d42-b758-f80b4b31a97f',source:'d6e9a3e6-cacf-491f-b2fa-55f7ab54028f',destination:'92d120d5-0f45-47f1-8cee-c06ea6925e15',original:'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',budget:'ce7f052b-2f0b-4db0-9ff7-e29d44f0b195'},
 {label:'B',actor:'559ba052-c408-4418-b806-0c0c4b8e3603',org:'98b857a9-0547-4c83-a3fa-11783ae4912e',source:'ca86e4c5-de93-4134-ba0e-ea47b3e56e3a',destination:'aade161d-62ab-4576-9446-a979aa60977f',original:'b112d600-bf1a-4bfd-bc1c-e9e9b749b539',budget:'73d7be4f-bfc2-474c-a7ea-26320fb5b3a5'},
]
const identity=document.querySelector('#identity')!,actions=document.querySelector('#actions')!,output=document.querySelector('#results')!
const report=(s:string)=>{output.textContent+=(s+'\n')}
let running=false
async function session(){const r=await c.auth.getUser();const t=fixtures.find(f=>f.actor===r.data.user?.id);if(r.error||!t)throw Error('Expected DEV session absent');return t}
const date=()=>new Date().toISOString().slice(0,10)
function add(label:string,run:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{if(running)return;running=true;for(const el of actions.querySelectorAll('button'))el.disabled=true;output.textContent='';try{await run();report('RESULT: PASS')}catch(e){report('RESULT: FAIL '+(e as Error).message)}finally{running=false;for(const el of actions.querySelectorAll('button'))el.disabled=false}};actions.append(b)}
async function isolation(){
 const own=await session(),foreign=fixtures.find(f=>f!==own)!
 rows(await c.from('financial_accounts').select('id').eq('organization_id',own.org),2)
 for(const [table,org] of [['financial_accounts',foreign.org],['payments',foreign.org],['financial_account_transfers',foreign.org],['bank_statement_imports',foreign.original],['bank_reconciliation_matches',foreign.original]]){
  rows(await c.from(table).select('*').eq('organization_id',org),0);report('RLS '+table+': foreign hidden PASS')
 }
 const positive=await c.rpc('read_tenant_budget_detail',{p_organization_id:own.original,p_cycle_id:own.budget})
 if(positive.error||positive.data?.cycle?.organization_id!==own.original)throw Error('Own budget read failed')
 denied(await c.rpc('read_tenant_budget_detail',{p_organization_id:foreign.original,p_cycle_id:foreign.budget}))
 denied(await c.rpc('read_tenant_budget_detail',{p_organization_id:own.original,p_cycle_id:foreign.budget}),['23503'])
 const args={p_organization_id:own.org,p_from_account_id:own.source,p_to_account_id:foreign.destination,p_transfer_date:date(),p_amount:'1.00',p_reference:'DEV QA cross',p_reason:'DEV QA real session cross-tenant rejection',p_idempotency_key:crypto.randomUUID()}
 denied(await c.rpc('register_tenant_account_transfer_idempotent',args),['23503'])
 denied(await c.rpc('register_tenant_account_transfer_idempotent',{...args,p_organization_id:foreign.org,p_from_account_id:foreign.source,p_idempotency_key:crypto.randomUUID()}))
 report('Identity '+own.label+': own reads, foreign scope and foreign identifiers PASS')
}
async function transfers(){
 const own=await session(),created=new Set<string>()
 const balances=async()=>{
  rows(await c.from('financial_accounts').select('id').eq('organization_id',own.org),2)
  const r=await c.from('v_financial_account_balances').select('financial_account_id,balance').eq('organization_id',own.org)
  const data=rows(r,Array.isArray(r.data)?r.data.length:-1)
  if(data.length>2||new Set(data.map(x=>x.financial_account_id)).size!==data.length||data.some(x=>![own.source,own.destination].includes(String(x.financial_account_id))))throw Error('Balance scope invalid')
  return data
 }
 const before=await balances();const byId=(r:Record<string,unknown>[],id:string)=>Number(r.find(x=>x.financial_account_id===id)?.balance??0)
 if(byId(before,own.source)!==10||byId(before,own.destination)!==0)throw Error('Fixture must start at 10/0; inspect before rerunning')
 const dreBefore=rows(await c.from('v_dre_entries').select('*').eq('organization_id',own.org),0)
 const args=(key:string,amount:string)=>({p_organization_id:own.org,p_from_account_id:own.source,p_to_account_id:own.destination,p_transfer_date:date(),p_amount:amount,p_reference:'DEV QA HTTP '+own.label,p_reason:'DEV QA concurrent transfer test',p_idempotency_key:key})
 const reverse=async(id:string)=>{uuid(await c.rpc('reverse_tenant_account_transfer_idempotent',{p_organization_id:own.org,p_transfer_id:id,p_reversal_date:date(),p_reason:'DEV QA concurrency cleanup preserves history',p_idempotency_key:crypto.randomUUID()}));created.delete(id)}
 try{
  const key=crypto.randomUUID();const replay=await Promise.all([c.rpc('register_tenant_account_transfer_idempotent',args(key,'1.00')),c.rpc('register_tenant_account_transfer_idempotent',args(key,'1.00'))])
  for(const r of replay)if(!r.error&&typeof r.data==='string')created.add(r.data)
  if(uuid(replay[0])!==uuid(replay[1]))throw Error('Concurrent replay differs')
  denied(await c.rpc('register_tenant_account_transfer_idempotent',args(key,'2.00')),['22023'])
  await reverse(uuid(replay[0]));report('Transfer same-key concurrent replay and mismatch PASS')
  const race=await Promise.all([c.rpc('register_tenant_account_transfer_idempotent',args(crypto.randomUUID(),'9.00')),c.rpc('register_tenant_account_transfer_idempotent',args(crypto.randomUUID(),'9.00'))])
  for(const r of race)if(!r.error&&typeof r.data==='string')created.add(r.data)
  const id=winner(race);const after=await balances()
  if(byId(after,own.source)!==1||byId(after,own.destination)!==9)throw Error('Capacity balance invariant failed')
  await reverse(id);report('Transfer capacity race: one winner, 23514 loser, 1/9 balances PASS')
 }finally{for(const id of [...created])await reverse(id)}
 const after=await balances();if(byId(after,own.source)!==10||byId(after,own.destination)!==0)throw Error('Cleanup balance failed')
 rows(await c.from('v_dre_entries').select('*').eq('organization_id',own.org),dreBefore.length)
 report('Identity '+own.label+': 10/0 restored; DRE unchanged PASS')
}
async function bank(){
 const own=await session();if(own.label!=='B')throw Error('Bank approved fixtures belong to B; use B session')
 const org=own.original,lines=['703752c6-872d-421d-804b-6923a062377d','1af4f52c-04be-441d-910d-bd5b99ad2028'],created=new Set<string>()
 const args=(line:string,key:string)=>({p_organization_id:org,p_line_id:line,p_kind:'member_payment',p_target_id:'2643e646-2160-4309-ab07-8ec3fe6b6b0b',p_amount:'100.00',p_reason:'DEV QA signed browser concurrency',p_idempotency_key:key})
 const imports=rows(await c.from('bank_statement_imports').select('id,status,file_name').in('id',['d42c6633-6b71-4261-ab94-6dfd45773726','209e5ce1-4dab-4d80-9cca-fee64d3422f7']),2)
 if(imports.some(i=>i.status!=='validated'||!String(i.file_name).startsWith('DEV QA CONCURRENCY 20261014-')))throw Error('Inspect approved fixtures before rerunning')
 const reverse=async(id:string)=>{uuid(await c.rpc('reverse_tenant_bank_match',{p_organization_id:org,p_match_id:id,p_reason:'DEV QA browser cleanup preserves history',p_idempotency_key:crypto.randomUUID()}));created.delete(id)}
 try{
  const key=crypto.randomUUID();const replay=await Promise.all([c.rpc('match_tenant_bank_statement',args(lines[0],key)),c.rpc('match_tenant_bank_statement',args(lines[0],key))])
  for(const r of replay)if(!r.error&&typeof r.data==='string')created.add(r.data)
  if(uuid(replay[0])!==uuid(replay[1]))throw Error('Bank same-key replay differs')
  await reverse(uuid(replay[0]));report('Bank same-key concurrent replay PASS')
  const race=await Promise.all(lines.map(l=>c.rpc('match_tenant_bank_statement',args(l,crypto.randomUUID()))))
  for(const r of race)if(!r.error&&typeof r.data==='string')created.add(r.data)
  const id=winner(race);await reverse(id);report('Bank capacity race one winner / 23514 PASS')
 }finally{for(const id of [...created])await reverse(id)}
 const detail=rows(await c.from('v_bank_reconciliation_lines').select('matched_amount').in('statement_line_id',lines),2)
 if(detail.some(l=>Number(l.matched_amount)!==0))throw Error('Bank cleanup failed')
 report('Bank cleanup: zero matched amount PASS')
}
void session().then(t=>{identity.textContent='Sessão DEV '+t.label+' validada. Somente fixtures autorizadas.';add('Verificar isolamento HTTP',isolation);add('Testar concorrência de transferências',transfers);if(t.label==='B')add('Testar concorrência de conciliação',bank)}).catch(()=>{identity.textContent='Entre primeiro na aplicação DEV com a identidade de teste A ou B.'})
