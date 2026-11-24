import type { SupabaseClient } from '@supabase/supabase-js'

export type CollectionChannel = 'email' | 'whatsapp' | 'email_whatsapp'
export type TermVersionStatus = 'draft' | 'published' | 'retired'
export type TermDocumentType =
  | 'terms'
  | 'privacy'
  | 'dpa'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'data_processing'

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
  primary_collection_channel: CollectionChannel
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
  status: TermVersionStatus
  effective_at: string
  valid_to: string | null
}

export type PlatformStaff = {
  id: string
  user_id: string
  staff_role: string
  mfa_enforced: boolean
  status: string
  created_at: string
}

export const PLATFORM_CONFIGURATION_SELECT =
  'singleton,trade_name,legal_name,tax_id,postal_code,address_line,city,state_code,billing_email,support_email,support_phone,default_trial_days,default_grace_days,default_retention_days,default_due_day,invoice_prefix,primary_collection_channel,billing_provider_status,email_provider_status,fiscal_provider_status,updated_at'

export const PLATFORM_TERMS_SELECT =
  'id,document_type,version,status,effective_at,valid_to'

const VALID_COLLECTION_CHANNELS = new Set<CollectionChannel>([
  'email',
  'whatsapp',
  'email_whatsapp',
])

const VALID_TERM_STATUSES = new Set<TermVersionStatus>([
  'draft',
  'published',
  'retired',
])

const VALID_TERM_DOCUMENT_TYPES = new Set<TermDocumentType>([
  'terms',
  'privacy',
  'dpa',
  'terms_of_service',
  'privacy_policy',
  'data_processing',
])

const DEFAULT_TERM_TITLES: Record<TermDocumentType, string> = {
  terms: 'Termos de Serviço da Plataforma',
  terms_of_service: 'Termos de Serviço da Plataforma',
  privacy: 'Política de Privacidade e LGPD',
  privacy_policy: 'Política de Privacidade e LGPD',
  dpa: 'Acordo de Processamento de Dados (DPA)',
  data_processing: 'Acordo de Processamento de Dados (DPA)',
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new Error(`Invalid nullable string field: ${field}`)
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid required string field: ${field}`)
  }
  return value.trim()
}

function requireValidTimestamp(value: unknown, field: string): string {
  const str = requireNonEmptyString(value, field)
  if (Number.isNaN(Date.parse(str))) {
    throw new Error(`Invalid timestamp field: ${field}`)
  }
  return str
}

export function validatePlatformConfiguration(raw: unknown): PlatformConfiguration {
  if (!isPlainRecord(raw)) {
    throw new Error('Configuração da plataforma não encontrada.')
  }
  if (raw.singleton !== true) {
    throw new Error('Invalid platform configuration singleton')
  }

  const trade_name = requireNonEmptyString(raw.trade_name, 'trade_name')
  const legal_name = normalizeNullableString(raw.legal_name, 'legal_name')
  const tax_id = normalizeNullableString(raw.tax_id, 'tax_id')
  const postal_code = normalizeNullableString(raw.postal_code, 'postal_code')
  const address_line = normalizeNullableString(raw.address_line, 'address_line')
  const city = normalizeNullableString(raw.city, 'city')
  const state_code = normalizeNullableString(raw.state_code, 'state_code')
  const billing_email = normalizeNullableString(raw.billing_email, 'billing_email')
  const support_email = normalizeNullableString(raw.support_email, 'support_email')
  const support_phone = normalizeNullableString(raw.support_phone, 'support_phone')

  const default_trial_days = raw.default_trial_days
  const default_grace_days = raw.default_grace_days
  const default_retention_days = raw.default_retention_days
  const default_due_day = raw.default_due_day

  if (
    typeof default_trial_days !== 'number' ||
    !Number.isSafeInteger(default_trial_days) ||
    default_trial_days < 0
  ) {
    throw new Error('Invalid default_trial_days')
  }
  if (
    typeof default_grace_days !== 'number' ||
    !Number.isSafeInteger(default_grace_days) ||
    default_grace_days < 0
  ) {
    throw new Error('Invalid default_grace_days')
  }
  if (
    typeof default_retention_days !== 'number' ||
    !Number.isSafeInteger(default_retention_days) ||
    default_retention_days < 0
  ) {
    throw new Error('Invalid default_retention_days')
  }
  if (
    typeof default_due_day !== 'number' ||
    !Number.isSafeInteger(default_due_day) ||
    default_due_day < 1 ||
    default_due_day > 28
  ) {
    throw new Error('Invalid default_due_day')
  }

  const invoice_prefix = requireNonEmptyString(raw.invoice_prefix, 'invoice_prefix')

  if (
    typeof raw.primary_collection_channel !== 'string' ||
    !VALID_COLLECTION_CHANNELS.has(raw.primary_collection_channel as CollectionChannel)
  ) {
    throw new Error('Invalid primary_collection_channel')
  }
  const primary_collection_channel = raw.primary_collection_channel as CollectionChannel

  const billing_provider_status = requireNonEmptyString(
    raw.billing_provider_status,
    'billing_provider_status'
  )
  const email_provider_status = requireNonEmptyString(
    raw.email_provider_status,
    'email_provider_status'
  )
  const fiscal_provider_status = requireNonEmptyString(
    raw.fiscal_provider_status,
    'fiscal_provider_status'
  )
  const updated_at = requireValidTimestamp(raw.updated_at, 'updated_at')

  return {
    singleton: true,
    trade_name,
    legal_name,
    tax_id,
    postal_code,
    address_line,
    city,
    state_code,
    billing_email,
    support_email,
    support_phone,
    default_trial_days,
    default_grace_days,
    default_retention_days,
    default_due_day,
    invoice_prefix,
    primary_collection_channel,
    billing_provider_status,
    email_provider_status,
    fiscal_provider_status,
    updated_at,
  }
}

export function validatePlatformTerms(raw: unknown): PlatformTermVersion[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid platform terms list')
  }

  const seenIds = new Set<string>()
  return raw.map((item, index) => {
    if (!isPlainRecord(item)) {
      throw new Error(`Invalid platform term row at index ${index}`)
    }

    const id = requireNonEmptyString(item.id, `terms[${index}].id`)
    if (seenIds.has(id)) {
      throw new Error(`Duplicate platform term id: ${id}`)
    }
    seenIds.add(id)

    if (
      typeof item.document_type !== 'string' ||
      !VALID_TERM_DOCUMENT_TYPES.has(item.document_type as TermDocumentType)
    ) {
      throw new Error(`Invalid platform term document_type at index ${index}`)
    }
    const document_type = item.document_type as TermDocumentType

    const hasVersion = item.version !== undefined && item.version !== null
    const hasVersionNumber = item.version_number !== undefined && item.version_number !== null
    if (!hasVersion && !hasVersionNumber) {
      throw new Error(`Missing platform term version at index ${index}`)
    }
    const versionFromDb = hasVersion
      ? requireNonEmptyString(item.version, `terms[${index}].version`)
      : null
    const versionFromNumber = hasVersionNumber
      ? requireNonEmptyString(item.version_number, `terms[${index}].version_number`)
      : null
    if (versionFromDb && versionFromNumber && versionFromDb !== versionFromNumber) {
      throw new Error(`Conflicting platform term version fields at index ${index}`)
    }
    const version_number = (versionFromNumber ?? versionFromDb)!

    let title: string
    if (item.title !== undefined && item.title !== null) {
      title = requireNonEmptyString(item.title, `terms[${index}].title`)
    } else {
      title = DEFAULT_TERM_TITLES[document_type]
    }

    if (
      typeof item.status !== 'string' ||
      !VALID_TERM_STATUSES.has(item.status as TermVersionStatus)
    ) {
      throw new Error(`Invalid platform term status at index ${index}`)
    }
    const status = item.status as TermVersionStatus

    const effective_at = requireValidTimestamp(item.effective_at, `terms[${index}].effective_at`)

    let valid_to: string | null = null
    if (item.valid_to !== null && item.valid_to !== undefined) {
      valid_to = requireValidTimestamp(item.valid_to, `terms[${index}].valid_to`)
      if (Date.parse(valid_to) <= Date.parse(effective_at)) {
        throw new Error(`Invalid platform term validity window at index ${index}`)
      }
    }

    return {
      id,
      document_type,
      version_number,
      title,
      status,
      effective_at,
      valid_to,
    }
  })
}

export async function loadPlatformConfiguration(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<PlatformConfiguration> {
  const { data, error } = await client
    .from('saas_platform_configuration')
    .select(PLATFORM_CONFIGURATION_SELECT)
    .eq('singleton', true)
    .abortSignal(signal)
    .single()

  if (error) throw error
  return validatePlatformConfiguration(data)
}

export async function loadPlatformTerms(
  client: SupabaseClient,
  signal: AbortSignal
): Promise<PlatformTermVersion[]> {
  const { data, error } = await client
    .from('saas_terms_versions')
    .select(PLATFORM_TERMS_SELECT)
    .order('effective_at', { ascending: false })
    .abortSignal(signal)

  if (error) throw error
  return validatePlatformTerms(data)
}

