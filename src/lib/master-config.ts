import type { SupabaseClient } from '@supabase/supabase-js'

export type PlatformConfiguration = {
  singleton: boolean
  trade_name: string
  legal_name: string | null
  tax_id: string | null
  postal_code: string | null
  address_line: string | null
  city: string | null
  state_code: string | null
  billing_email: string | null
  support_email: string | null
  support_phone: string | null
  default_trial_days: number
  default_grace_days: number
  default_retention_days: number
  default_due_day: number
  invoice_prefix: string
  primary_collection_channel: 'email' | 'whatsapp' | 'email_whatsapp'
  billing_provider_status: string
  email_provider_status: string
  fiscal_provider_status: string
  updated_at: string
}

export type PlatformTermVersion = {
  id: string
  document_type: string
  version_number: string
  title: string
  status: 'draft' | 'published' | 'retired'
  effective_at: string
  valid_to: string | null
}

export type PlatformJob = {
  id: string
  job_type: string
  status: string
  attempts: number
  max_attempts: number
  idempotency_key: string
  correlation_id: string | null
  last_error_code: string | null
  created_at: string
  locked_at: string | null
  completed_at: string | null
}

export type PlatformStaff = {
  id: string
  user_id: string
  staff_role: string
  mfa_enforced: boolean
  status: string
  created_at: string
}

export async function loadPlatformConfiguration(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<PlatformConfiguration> {
  const { data, error } = await client
    .from('saas_platform_configuration')
    .select('*')
    .eq('singleton', true)
    .abortSignal(signal)
    .single()

  if (error) throw error
  if (!data) throw new Error('Configuração da plataforma não encontrada.')
  return data as PlatformConfiguration
}

export async function loadPlatformTerms(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<PlatformTermVersion[]> {
  const { data, error } = await client
    .from('saas_terms_versions')
    .select('id,document_type,version_number,title,status,effective_at,valid_to')
    .order('effective_at', { ascending: false })
    .abortSignal(signal)

  if (error) throw error
  return (data ?? []) as PlatformTermVersion[]
}

export async function loadPlatformJobs(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<PlatformJob[]> {
  const { data, error } = await client
    .from('saas_jobs')
    .select('id,job_type,status,attempts,max_attempts,idempotency_key,correlation_id,last_error_code,created_at,locked_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(25)
    .abortSignal(signal)

  if (error) throw error
  return (data ?? []) as PlatformJob[]
}
