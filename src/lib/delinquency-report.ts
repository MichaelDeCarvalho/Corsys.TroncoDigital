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

export const AGING_BUCKETS = [
 { id: 'up30', label: 'Até 30 dias', rangeLabel: '0-30 dias', min: 0, max: 30 },
 { id: '31-60', label: '31 a 60 dias', rangeLabel: '31-60 dias', min: 31, max: 60 },
 { id: '61-90', label: '61 a 90 dias', rangeLabel: '61-90 dias', min: 61, max: 90 },
 { id: 'over90', label: 'Mais de 90 dias', rangeLabel: '>90 dias', min: 91, max: Infinity },
] as const

export type DelinquencyBucketId = typeof AGING_BUCKETS[number]['id']

export type DelinquencyPageResult = {
 rows: DelinquencyRow[]
 hasNext: boolean
 migrationPending?: boolean
}

export type DelinquencyBucketSummaryResult = {
 summaries: DelinquencyBucketSummary[]
 serverDate: string | null
 migrationPending: boolean
}

const VALID_BUCKET_IDS = new Set<string>(AGING_BUCKETS.map(b => b.id))

export class DelinquencyMigrationPendingError extends Error {
 constructor(message = 'Filtro global por faixas indisponível até aplicação da migration no banco de dados.') {
  super(message)
  this.name = 'DelinquencyMigrationPendingError'
 }
}

export function isMissingRpcError(error: unknown): boolean {
 if (!error || typeof error !== 'object') return false
 const err = error as { code?: unknown; message?: unknown }
 return err.code === '42883' || err.code === 'PGRST202'
}

function validateDelinquencyRows(data: unknown): { rows: DelinquencyRow[]; hasNext: boolean } {
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

export async function loadDelinquencyPage(client: SupabaseClient, org: string, page: number): Promise<{ rows: DelinquencyRow[]; hasNext: boolean }> {
 if (!Number.isSafeInteger(page) || page < 0 || page > 400) throw Error('Invalid overdue page')
 const { data, error } = await client.rpc('read_tenant_delinquency', {
  p_organization_id: org,
  p_limit: DELINQUENCY_PAGE + 1,
  p_offset: page * DELINQUENCY_PAGE,
 })
 if (error) throw error
 return validateDelinquencyRows(data)
}

export async function loadFilteredDelinquencyPage(
 client: SupabaseClient,
 org: string,
 bucket: DelinquencyBucketId | null,
 page: number,
): Promise<DelinquencyPageResult> {
 if (!Number.isSafeInteger(page) || page < 0 || page > 400) throw Error('Invalid overdue page')
 if (bucket !== null && !VALID_BUCKET_IDS.has(bucket)) throw Error('Invalid delinquency bucket')

 const rpcRes = await client.rpc('read_tenant_delinquency_filtered', {
  p_organization_id: org,
  p_bucket: bucket,
  p_limit: DELINQUENCY_PAGE + 1,
  p_offset: page * DELINQUENCY_PAGE,
 })

 if (rpcRes.error) {
  if (isMissingRpcError(rpcRes.error)) {
   if (bucket !== null) {
    throw new DelinquencyMigrationPendingError()
   }
   const legacy = await loadDelinquencyPage(client, org, page)
   return { ...legacy, migrationPending: true }
  }
  throw rpcRes.error
 }

 return { ...validateDelinquencyRows(rpcRes.data), migrationPending: false }
}

export async function loadDelinquencyBucketSummary(client: SupabaseClient, org: string): Promise<DelinquencyBucketSummaryResult> {
 const { data, error } = await client.rpc('read_tenant_delinquency_bucket_summary', {
  p_organization_id: org,
 })
 if (error) {
  if (isMissingRpcError(error)) {
   return { summaries: [], serverDate: null, migrationPending: true }
  }
  throw error
 }
 if (!Array.isArray(data)) throw Error('Delinquency summary incomplete')

 let serverDate: string | null = null
 const seenBuckets = new Set<string>()
 const summaries: DelinquencyBucketSummary[] = data.map((raw: unknown) => {
  if (!raw || typeof raw !== 'object') throw Error('Delinquency summary integrity failure')
  const row = raw as Record<string, unknown>
  const bucketId = typeof row.bucket_id === 'string' ? row.bucket_id : ''
  const memberCount = Number(row.member_count)
  const overdueItems = Number(row.overdue_items)
  const overdueAmount = checkedSigned(row.overdue_amount as string | number)
  const rowDate = typeof row.server_date === 'string' ? row.server_date : ''
  if (!VALID_BUCKET_IDS.has(bucketId) || seenBuckets.has(bucketId)) {
   throw Error('Delinquency bucket integrity failure')
  }
  seenBuckets.add(bucketId)
  if (!Number.isSafeInteger(memberCount) || memberCount < 0 ||
   !Number.isSafeInteger(overdueItems) || overdueItems < 0 ||
   overdueAmount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
   throw Error('Delinquency summary values invalid')
  }
  if ((memberCount === 0 && (overdueItems !== 0 || overdueAmount !== 0)) ||
   (memberCount > 0 && overdueItems < memberCount)) {
   throw Error('Delinquency summary count mismatch')
  }
  if (serverDate === null) serverDate = rowDate
  else if (serverDate !== rowDate) throw Error('Delinquency server date mismatch')

  return {
   bucket_id: bucketId,
   member_count: memberCount,
   overdue_items: overdueItems,
   overdue_amount: overdueAmount,
   server_date: rowDate,
  }
 })

 return { summaries, serverDate, migrationPending: false }
}

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
