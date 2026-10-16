import type {SupabaseClient} from '@supabase/supabase-js'
import {checkedSigned} from './treasury-balances'
export type BankImport={id:string;organization_id:string;financial_account_id:string;file_name:string;period_start:string;period_end:string;status:string}
export type BankLine={organization_id:string;statement_line_id:string;statement_import_id:string;transaction_date:string;description:string;amount:string|number;matched_amount:string|number;reconciliation_status:string;integrity_ok:boolean}
export type BankMatch={id:string;organization_id:string;statement_line_id:string;matched_amount:string|number}
export type BankMovement={organization_id:string;financial_account_id:string;source_id:string;movement_type:string;movement_date:string;signed_amount:string|number}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
function rows<T extends {organization_id:string}>(data:T[]|null,error:unknown,org:string,max:number):T[]{
 if(error)throw error
 if(!Array.isArray(data)||data.length>max||data.some(x=>x.organization_id!==org))throw Error('Invalid bank reconciliation scope or limit')
 return data
}
export async function loadBankImports(client:SupabaseClient,org:string,signal:AbortSignal){
 const r=await client.from('bank_statement_imports').select('id,organization_id,financial_account_id,file_name,period_start,period_end,status')
  .eq('organization_id',org).order('created_at',{ascending:false}).limit(101).abortSignal(signal)
 const data=rows(r.data,r.error,org,100) as BankImport[]
 if(new Set(data.map(x=>x.id)).size!==data.length||data.some(x=>!uuid.test(x.id)||!uuid.test(x.financial_account_id)||!['staged','validated','reconciled','canceled'].includes(x.status)))throw Error('Invalid statement catalog')
 return data
}
export async function loadBankDetail(client:SupabaseClient,org:string,statement:BankImport,signal:AbortSignal){
 if(statement.organization_id!==org)throw Error('Invalid statement tenant')
 const r=await client.from('v_bank_reconciliation_lines').select('organization_id,statement_line_id,statement_import_id,transaction_date,description,amount,matched_amount,reconciliation_status,integrity_ok')
  .eq('organization_id',org).eq('statement_import_id',statement.id).order('transaction_date').order('statement_line_id').limit(501).abortSignal(signal)
 const lines=rows(r.data,r.error,org,500) as BankLine[]
 if(!lines.length||new Set(lines.map(x=>x.statement_line_id)).size!==lines.length||lines.some(x=>x.statement_import_id!==statement.id||!uuid.test(x.statement_line_id)||!x.integrity_ok||checkedSigned(x.matched_amount)<0||checkedSigned(x.matched_amount)>Math.abs(checkedSigned(x.amount))))throw Error('Invalid statement detail')
 const [m,v,c]=await Promise.all([
  client.from('bank_reconciliation_matches').select('id,organization_id,statement_line_id,matched_amount').eq('organization_id',org).in('statement_line_id',lines.map(x=>x.statement_line_id)).limit(1001).abortSignal(signal),
  client.from('bank_reconciliation_match_reversals').select('match_id,organization_id').eq('organization_id',org).limit(1001).abortSignal(signal),
  client.from('v_financial_account_movements').select('organization_id,financial_account_id,source_id,movement_type,movement_date,signed_amount')
   .eq('organization_id',org).eq('financial_account_id',statement.financial_account_id).gte('movement_date',statement.period_start).lte('movement_date',statement.period_end)
   .order('movement_date').order('source_id').limit(501).abortSignal(signal),
 ])
 const matches=rows(m.data,m.error,org,1000) as BankMatch[]
 const reversed=rows(v.data,v.error,org,1000) as {organization_id:string;match_id:string}[]
 const movements=rows(c.data,c.error,org,500) as BankMovement[]
 if(matches.some(x=>!uuid.test(x.id)||!lines.some(l=>l.statement_line_id===x.statement_line_id)||checkedSigned(x.matched_amount)<=0)||new Set(matches.map(x=>x.id)).size!==matches.length||movements.some(x=>x.financial_account_id!==statement.financial_account_id||!uuid.test(x.source_id)||!Number.isFinite(checkedSigned(x.signed_amount))))throw Error('Invalid bank facts')
 return {lines,matches:matches.filter(x=>!reversed.some(v=>v.match_id===x.id)),movements}
}
