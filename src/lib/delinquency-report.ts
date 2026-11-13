import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedSigned } from './treasury-balances'

export type DelinquencyRow={
 member_id:string;full_name:string;member_status:string;overdue_items:number;
 overdue_amount:string|number;available_credit:string|number;oldest_due:string;
 net_position:string|number
}

export type DelinquencyBucketSummary = {
 bucket_id: string
 member_count: number
 overdue_items: number
 overdue_amount: number
 server_date: string
}

export const DELINQUENCY_PAGE=25

export async function loadDelinquencyPage(client:SupabaseClient,org:string,page:number){
 return loadFilteredDelinquencyPage(client, org, null, page)
}

export async function loadFilteredDelinquencyPage(client: SupabaseClient, org: string, bucket: string | null, page: number) {
 if (!Number.isSafeInteger(page) || page < 0 || page > 400) throw Error('Invalid overdue page')
 
 // Try new filtered RPC first, fall back to base read_tenant_delinquency if not yet migrated in DEV
 let data: unknown = null
 let error: unknown = null

 const rpcRes = await client.rpc('read_tenant_delinquency_filtered', {
  p_organization_id: org,
  p_bucket: bucket,
  p_limit: DELINQUENCY_PAGE + 1,
  p_offset: page * DELINQUENCY_PAGE,
 })
 
 data = rpcRes.data
 error = rpcRes.error

 if (error && (error as { code?: string }).code === '42883') {
  // Function does not exist yet co-existing in DEV, fall back to base RPC
  if (bucket) {
   // Client-side fallback filter if base RPC is used before migration
   const fallbackRes = await client.rpc('read_tenant_delinquency', {
    p_organization_id: org,
    p_limit: 1000,
    p_offset: 0,
   })
   if (fallbackRes.error) throw fallbackRes.error
   const allRows = (fallbackRes.data as DelinquencyRow[]) || []
   const filtered = allRows.filter(row => {
    const days = calculateDaysOverdue(row.oldest_due)
    return classifyMemberBucket(days) === bucket
   })
   const start = page * DELINQUENCY_PAGE
   const pageRows = filtered.slice(start, start + DELINQUENCY_PAGE)
   return { rows: pageRows, hasNext: start + DELINQUENCY_PAGE < filtered.length }
  } else {
   const fallbackRes = await client.rpc('read_tenant_delinquency', {
    p_organization_id: org,
    p_limit: DELINQUENCY_PAGE + 1,
    p_offset: page * DELINQUENCY_PAGE,
   })
   if (fallbackRes.error) throw fallbackRes.error
   data = fallbackRes.data
  }
 } else if (error) {
  throw error
 }

 if (!Array.isArray(data) || data.length > DELINQUENCY_PAGE + 1) throw Error('Delinquency result incomplete')
 for (const row of data as DelinquencyRow[]) {
  if (!row || typeof row !== 'object' || typeof row.member_id !== 'string' ||
   typeof row.full_name !== 'string' || typeof row.member_status !== 'string' ||
   !Number.isSafeInteger(row.overdue_items) || row.overdue_items < 1 ||
   !/^\d{4}-\d{2}-\d{2}$/.test(row.oldest_due)) throw Error('Delinquency data integrity failure')
  const overdue = checkedSigned(row.overdue_amount)
  const credit = checkedSigned(row.available_credit)
  checkedSigned(row.net_position)
  if (overdue <= 0 || credit < 0) throw Error('Negative or zero overdue balance')
 }
 return { rows: (data as DelinquencyRow[]).slice(0, DELINQUENCY_PAGE), hasNext: (data as DelinquencyRow[]).length > DELINQUENCY_PAGE }
}

export async function loadDelinquencyBucketSummary(client: SupabaseClient, org: string): Promise<DelinquencyBucketSummary[]> {
 const { data, error } = await client.rpc('read_tenant_delinquency_bucket_summary', {
  p_organization_id: org,
 })
 if (error) {
  if ((error as { code?: string }).code === '42883') {
   return [] // Fallback if RPC not yet migrated in DEV
  }
  throw error
 }
 if (!Array.isArray(data)) return []
 return data.map((row: any) => ({
  bucket_id: String(row.bucket_id),
  member_count: Number(row.member_count),
  overdue_items: Number(row.overdue_items),
  overdue_amount: checkedSigned(row.overdue_amount),
  server_date: String(row.server_date),
 }))
}

export const AGING_BUCKETS = [
  { id: 'up30', label: 'Até 30 dias', rangeLabel: '0-30 dias', min: 0, max: 30 },
  { id: '31-60', label: '31 a 60 dias', rangeLabel: '31-60 dias', min: 31, max: 60 },
  { id: '61-90', label: '61 a 90 dias', rangeLabel: '61-90 dias', min: 61, max: 90 },
  { id: 'over90', label: 'Mais de 90 dias', rangeLabel: '>90 dias', min: 91, max: Infinity },
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

export function formatBucketRangeLabel(bucketId: DelinquencyBucketId | null): string {
  if (!bucketId) return '0 dias'
  const found = AGING_BUCKETS.find(b => b.id === bucketId)
  return found ? found.rangeLabel : 'Indefinido'
}
