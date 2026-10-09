import type { SupabaseClient } from '@supabase/supabase-js'
export type TreasuryAccount={id:string;organization_id:string;name:string;account_type:string;active:boolean}
export type TreasuryBalance={organization_id:string;financial_account_id:string;balance:string|number}
export type TreasuryMovement={
 organization_id:string;financial_account_id:string;movement_date:string;
 signed_amount:string|number;movement_type:string;source_id:string
}
const amount=/^-?\d{1,12}(\.\d{1,2})?$/
export function checkedSigned(value:string|number):number{
 if(!amount.test(String(value)))throw Error('Valor financeiro de movimentação inválido')
 const number=Number(value)
 if(!Number.isFinite(number))throw Error('Valor financeiro de movimentação inválido')
 return number
}
export async function loadTreasuryAccounts(client:SupabaseClient,org:string,signal:AbortSignal){
 const [accounts,balances]=await Promise.all([
  client.from('financial_accounts').select('id,organization_id,name,account_type,active')
   .eq('organization_id',org).order('name').limit(201).abortSignal(signal),
  client.from('v_financial_account_balances').select('organization_id,financial_account_id,balance')
   .eq('organization_id',org).limit(201).abortSignal(signal),
 ])
 if(accounts.error)throw accounts.error
 if(balances.error)throw balances.error
 if(!Array.isArray(accounts.data)||!Array.isArray(balances.data)||
  accounts.data.length>200||balances.data.length>200)throw Error('Treasury list truncated')
 if(accounts.data.some(a=>a.organization_id!==org||typeof a.id!=='string'||
  typeof a.name!=='string'||typeof a.active!=='boolean'))throw Error('Unexpected treasury account')
 const ids=new Set(accounts.data.map(a=>a.id))
 if(balances.data.some(b=>b.organization_id!==org||!ids.has(b.financial_account_id)))
  throw Error('Unexpected financial balance scope')
 const byId=new Map<string,number>()
 for(const b of balances.data){
  if(byId.has(b.financial_account_id))throw Error('Duplicate financial account balance')
  byId.set(b.financial_account_id,checkedSigned(b.balance))
 }
 return accounts.data.map(a=>({...a,balance:byId.get(a.id)??null})) as Array<TreasuryAccount&{balance:number|null}>
}
export const MOVEMENTS_PAGE=25
export async function loadTreasuryMovements(client:SupabaseClient,org:string,account:string,page:number,signal:AbortSignal){
 if(!Number.isSafeInteger(page)||page<0||page>10000)throw Error('Invalid movement page')
 const {data,error}=await client.from('v_financial_account_movements')
  .select('organization_id,financial_account_id,movement_date,signed_amount,movement_type,source_id')
  .eq('organization_id',org).eq('financial_account_id',account)
  .order('movement_date',{ascending:false}).order('source_id',{ascending:false})
  .range(page*MOVEMENTS_PAGE,(page+1)*MOVEMENTS_PAGE).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>MOVEMENTS_PAGE+1||data.some(row=>
  row.organization_id!==org||row.financial_account_id!==account||
  !/^\d{4}-\d{2}-\d{2}$/.test(row.movement_date)||typeof row.source_id!=='string'||
  typeof row.movement_type!=='string'))throw Error('Inconsistent treasury movement')
 for(const row of data)checkedSigned(row.signed_amount)
 return {rows:data.slice(0,MOVEMENTS_PAGE) as TreasuryMovement[],hasNext:data.length>MOVEMENTS_PAGE}
}
