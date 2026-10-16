import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentMember = { id: string; organization_id: string; full_name: string; status: string }
export type PaymentMethod = { id: string; organization_id: string; name: string; active: boolean }
export type PaymentAccount = PaymentMethod & { account_type: string }
export type MemberCharge = {
  charge_id: string; organization_id: string; member_id: string; description: string
  due_date: string; open_amount: string | number; integrity_ok: boolean; is_cancelled: boolean
}
export type MemberReceipt = {
  payment_id: string; organization_id: string; member_id: string
  payment_date: string; amount: string | number; allocated_amount: string | number
  available_amount: string | number; is_reversed: boolean; integrity_ok: boolean
}
export type PaymentCatalog = { members: PaymentMember[]; methods: PaymentMethod[]; accounts: PaymentAccount[] }
export type MemberLedger = { charges: MemberCharge[]; payments: MemberReceipt[] }

function scoped<T extends { organization_id: string }>(
 result: { data: T[] | null; error: unknown }, organizationId: string, memberId?: string
): T[] {
 if (result.error) throw result.error
 const rows = result.data ?? []
 if (rows.some(row => row.organization_id !== organizationId ||
   (memberId !== undefined && (!('member_id' in row) || row.member_id !== memberId)))) {
  throw new Error('Unexpected tenant or member in payment response')
 }
 return rows
}

export function exactPaymentAmount(value: string | number): string {
 const amount = String(value)
 if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount)) throw new Error('Invalid payment amount')
 return amount
}

export async function loadPaymentCatalog(
 client: SupabaseClient, org: string, signal: AbortSignal,
): Promise<PaymentCatalog> {
 const [members, methods, accounts] = await Promise.all([
  client.from('members').select('id,organization_id,full_name,status').eq('organization_id',org)
   .order('full_name').limit(200).abortSignal(signal),
  client.from('payment_methods').select('id,organization_id,name,active').eq('organization_id',org)
   .eq('active',true).order('name').limit(100).abortSignal(signal),
  client.from('financial_accounts').select('id,organization_id,name,active,account_type').eq('organization_id',org)
   .eq('active',true).order('name').limit(100).abortSignal(signal),
 ])
 const activeMembers = scoped(members,org) as PaymentMember[]
 const activeMethods = scoped(methods,org) as PaymentMethod[]
 const activeAccounts = scoped(accounts,org) as PaymentAccount[]
 if (activeMethods.some(row=>!row.active) || activeAccounts.some(row=>!row.active))
  throw new Error('Unexpected inactive payment catalog item')
 return { members:activeMembers, methods:activeMethods, accounts:activeAccounts }
}

export async function loadMemberLedger(
 client: SupabaseClient, org: string, memberId: string, signal: AbortSignal
): Promise<MemberLedger> {
 const [charges, payments] = await Promise.all([
  client.from('v_charge_balances')
   .select('charge_id,organization_id,member_id,description,due_date,open_amount,is_cancelled,integrity_ok')
   .eq('organization_id',org).eq('member_id',memberId).order('due_date',{ascending:false})
   .limit(151).abortSignal(signal),
  client.from('v_payment_balances')
   .select('payment_id,organization_id,member_id,payment_date,amount,allocated_amount,available_amount,is_reversed,integrity_ok')
   .eq('organization_id',org).eq('member_id',memberId).order('payment_date',{ascending:false})
   .limit(151).abortSignal(signal),
 ])
 const c=scoped(charges,org,memberId) as MemberCharge[]
 const p=scoped(payments,org,memberId) as MemberReceipt[]
 if (c.length>150||p.length>150) throw new Error('Member ledger exceeds safe UI cap')
 for(const row of c){
  if(row.integrity_ok!==true || typeof row.is_cancelled!=='boolean'||
   typeof row.charge_id!=='string'||typeof row.description!=='string'||
   !/^\d{4}-\d{2}-\d{2}$/.test(row.due_date)) throw new Error('Charge integrity invalid')
  exactPaymentAmount(row.open_amount)
 }
 for(const row of p){
  if(row.integrity_ok!==true || typeof row.is_reversed!=='boolean'||
   typeof row.payment_id!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(row.payment_date))
   throw new Error('Payment integrity invalid')
  exactPaymentAmount(row.amount)
  exactPaymentAmount(row.allocated_amount)
  exactPaymentAmount(row.available_amount)
 }
 return {charges:c,payments:p}
}
