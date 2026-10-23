import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedSigned } from './treasury-balances'
export type DelinquencyRow={
 member_id:string;full_name:string;member_status:string;overdue_items:number;
 overdue_amount:string|number;available_credit:string|number;oldest_due:string;
 net_position:string|number
}
export const DELINQUENCY_PAGE=25
export async function loadDelinquencyPage(client:SupabaseClient,org:string,page:number){
 if(!Number.isSafeInteger(page)||page<0||page>400)throw Error('Invalid overdue page')
 const {data,error}=await client.rpc('read_tenant_delinquency',{
  p_organization_id:org,p_limit:DELINQUENCY_PAGE+1,p_offset:page*DELINQUENCY_PAGE,
 })
 if(error)throw error
 if(!Array.isArray(data)||data.length>DELINQUENCY_PAGE+1)throw Error('Delinquency result incomplete')
 for(const row of data as DelinquencyRow[]){
  if(!row||typeof row!=='object'||typeof row.member_id!=='string'||
   typeof row.full_name!=='string'||typeof row.member_status!=='string'||
   !Number.isSafeInteger(row.overdue_items)||row.overdue_items<1||
   !/^\d{4}-\d{2}-\d{2}$/.test(row.oldest_due))throw Error('Delinquency data integrity failure')
  const overdue=checkedSigned(row.overdue_amount)
  const credit=checkedSigned(row.available_credit)
  checkedSigned(row.net_position)
  if(overdue<=0||credit<0)throw Error('Negative or zero overdue balance')
 }
 return {rows:data.slice(0,DELINQUENCY_PAGE) as DelinquencyRow[],hasNext:data.length>DELINQUENCY_PAGE}
}

export const AGING_BUCKETS = [
  { id: 'up30', label: 'Até 30 dias', min: 0, max: 30 },
  { id: '31-60', label: '31 a 60 dias', min: 31, max: 60 },
  { id: '61-90', label: '61 a 90 dias', min: 61, max: 90 },
  { id: 'over90', label: 'Mais de 90 dias', min: 91, max: Infinity },
] as const

export type DelinquencyBucketId = typeof AGING_BUCKETS[number]['id']

export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function calculateDaysOverdue(oldestDue: string, referenceDate?: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(oldestDue)) return 0
  const ref = referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? parseDateOnly(referenceDate)
    : new Date()
  const refUtc = referenceDate
    ? ref
    : new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  const due = parseDateOnly(oldestDue)
  const diffMs = refUtc.getTime() - due.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

export function classifyMemberBucket(days: number): DelinquencyBucketId | null {
  if (days < 0) return null
  if (days <= 30) return 'up30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return 'over90'
}

export function formatBucketLabel(bucketId: DelinquencyBucketId | null): string {
  if (!bucketId) return 'Em dia'
  const found = AGING_BUCKETS.find(b => b.id === bucketId)
  return found ? found.label : 'Indefinido'
}
