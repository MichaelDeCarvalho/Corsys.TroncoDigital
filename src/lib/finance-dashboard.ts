import type { SupabaseClient } from '@supabase/supabase-js'
export type DashboardValues={
 organization_id:string;as_of:string;member_open:string|number;
 institutional_open:string|number;receivables_open:string|number;
 receivables_overdue:string|number;received_this_month:string|number;
 cash_bank_balance:string|number;payables_open:string|number;
 payables_overdue:string|number;integrity_ok:boolean
}
const signed=/^-?\d{1,12}(\.\d{1,2})?$/
export function normalizeDashboard(input:unknown,org:string):DashboardValues {
 if(!input||typeof input!=='object')throw Error('Invalid dashboard response')
 const data=input as DashboardValues
 if(data.organization_id!==org||data.integrity_ok!==true||
   !/^\d{4}-\d{2}-\d{2}$/.test(data.as_of))throw Error('Dashboard tenant/integrity error')
 const keys=[
  'member_open','institutional_open','receivables_open','receivables_overdue',
  'received_this_month','cash_bank_balance','payables_open','payables_overdue'
 ] as const
 for(const name of keys) {
  if(!signed.test(String(data[name]))||!Number.isFinite(Number(data[name])))
   throw Error('Invalid financial dashboard amount')
  if(name!=='cash_bank_balance'&&name!=='received_this_month'&&Number(data[name])<0)
   throw Error('Negative obligation amount')
 }
 const expected=Number(data.member_open)+Number(data.institutional_open)
 if(Math.abs(expected-Number(data.receivables_open))>0.01||
   Number(data.receivables_overdue)>Number(data.receivables_open)+0.01||
   Number(data.payables_overdue)>Number(data.payables_open)+0.01)throw Error('Dashboard financial invariants invalid')
 return data
}
export async function loadFinancialDashboard(client:SupabaseClient,org:string){
 const {data,error}=await client.rpc('read_tenant_financial_dashboard',{p_organization_id:org})
 if(error)throw error
 return normalizeDashboard(data,org)
}
