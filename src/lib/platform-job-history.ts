import type { SupabaseClient } from '@supabase/supabase-js'

export const PLATFORM_JOB_PAGE_SIZE = 25
export const platformJobStatuses = ['queued', 'running', 'succeeded', 'failed', 'canceled'] as const
export const platformJobTypes = [
  'generate_invoice', 'send_collection', 'apply_late_charges',
  'evaluate_dunning', 'apply_subscription_change', 'tenant_export',
  'fiscal_document', 'webhook_retry', 'onboarding_invite',
] as const

export type JobStatusFilter = '' | typeof platformJobStatuses[number]
export type JobTypeFilter = '' | typeof platformJobTypes[number]
export type PlatformJobFilters = {
  status: JobStatusFilter
  jobType: JobTypeFilter
  organizationId: string
}
export type PlatformJob = {
  id: string
  organization_id: string | null
  job_type: typeof platformJobTypes[number]
  status: typeof platformJobStatuses[number]
  attempts: number
  max_attempts: number
  last_error_code: string | null
  created_at: string
  locked_at: string | null
  completed_at: string | null
}
export type JobCursor = { created_at: string; id: string }
export type PlatformJobPage = { rows: PlatformJob[]; next: JobCursor | null }

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const errorCode=/^[\w.:-]{1,120}$/

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && timestamp.test(value) && Number.isFinite(Date.parse(value))
}

/**
 * Read-only, keyset-paginated diagnostic for the existing public.saas_jobs RLS.
 * The cursor preserves the complete PG timestamp (including microseconds) and
 * UUID: ordering by created_at DESC, id DESC avoids offset drift on new inserts.
 * No payloads, job secrets, raw idempotency keys or mutation commands are read.
 *
 * The diagnostic policy requires MASTER and JWT AAL2 after M04.03-B is applied.
 */
export async function loadPlatformJobPage(
  client: SupabaseClient,
  filters: PlatformJobFilters,
  cursor: JobCursor | null,
  signal: AbortSignal,
): Promise<PlatformJobPage> {
  if (filters.status && !platformJobStatuses.includes(filters.status as typeof platformJobStatuses[number]))
    throw Error('Invalid job status filter')
  if (filters.jobType && !platformJobTypes.includes(filters.jobType as typeof platformJobTypes[number]))
    throw Error('Invalid job type filter')
  if (filters.organizationId && !uuid.test(filters.organizationId))
    throw Error('Invalid job organization filter')
  if (cursor && (!uuid.test(cursor.id) || !validTimestamp(cursor.created_at)))
    throw Error('Invalid job cursor')

  let query=client.from('saas_jobs')
    .select('id,organization_id,job_type,status,attempts,max_attempts,last_error_code,created_at,locked_at,completed_at')
  if (filters.organizationId) query=query.eq('organization_id',filters.organizationId)
  if (filters.status) query=query.eq('status',filters.status)
  if (filters.jobType) query=query.eq('job_type',filters.jobType)
  if (cursor) {
    // The timestamp is strictly validated above before building PostgREST syntax.
    query=query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
  }
  const { data,error }=await query
    .order('created_at',{ascending:false})
    .order('id',{ascending:false})
    .limit(PLATFORM_JOB_PAGE_SIZE+1)
    .abortSignal(signal)
  if(error)throw error
  if(!Array.isArray(data) || data.length>PLATFORM_JOB_PAGE_SIZE+1)
    throw Error('Incomplete platform job history')
  const seen=new Set<string>()
  const rows:PlatformJob[]=[]
  for(const value of data) {
    if(!value || typeof value!=='object')throw Error('Invalid platform job record')
    const item=value as Record<string,unknown>
    if(typeof item.id!=='string'||!uuid.test(item.id)||seen.has(item.id)||
      (item.organization_id!==null && (typeof item.organization_id!=='string'||!uuid.test(item.organization_id)))||
      (filters.organizationId && item.organization_id!==filters.organizationId)||
      typeof item.job_type!=='string'||!platformJobTypes.includes(item.job_type as typeof platformJobTypes[number])||
      typeof item.status!=='string'||!platformJobStatuses.includes(item.status as typeof platformJobStatuses[number])||
      (filters.jobType&&item.job_type!==filters.jobType)||
      (filters.status&&item.status!==filters.status)||
      !Number.isSafeInteger(item.attempts)||Number(item.attempts)<0||
      !Number.isSafeInteger(item.max_attempts)||Number(item.max_attempts)<1||
      !validTimestamp(item.created_at)||
      (item.last_error_code!==null&&(typeof item.last_error_code!=='string'||!errorCode.test(item.last_error_code)))||
      (item.locked_at!==null&&!validTimestamp(item.locked_at))||
      (item.completed_at!==null&&!validTimestamp(item.completed_at)))
      throw Error('Invalid or unauthorized platform job record')
    seen.add(item.id)
    rows.push(item as PlatformJob)
  }
  const visible=rows.slice(0,PLATFORM_JOB_PAGE_SIZE)
  const last=visible.at(-1)
  const next=rows.length>PLATFORM_JOB_PAGE_SIZE && last
    ? {created_at:last.created_at,id:last.id} : null
  return {rows:visible,next}
}
