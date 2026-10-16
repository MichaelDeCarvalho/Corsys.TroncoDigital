import type { SupabaseClient } from '@supabase/supabase-js'

export type OfficeType = { id: string; organization_id: string; name: string; active: boolean }
export type RecurringRule = OfficeType & { frequency: string }
export type OfficeHistory = { id: string; organization_id: string; member_id: string; office_type_id: string; effective_from: string; effective_to: string | null }
export type TermHistory = { id: string; organization_id: string; member_id: string; recurring_rule_id: string; effective_from: string; effective_to: string | null; term_type: string; override_amount: number | string | null }
export type MemberConfigurationData = { offices: OfficeType[]; rules: RecurringRule[]; history: OfficeHistory[]; terms: TermHistory[] }
export async function loadMemberConfiguration(client: SupabaseClient, org: string, member: string, signal: AbortSignal): Promise<MemberConfigurationData> {
  const results = await Promise.all([
    client.from('office_types').select('id,organization_id,name,active').eq('organization_id', org).order('name').limit(200).abortSignal(signal),
    client.from('recurring_rules').select('id,organization_id,name,active,frequency').eq('organization_id', org).order('name').limit(200).abortSignal(signal),
    client.from('member_offices').select('id,organization_id,member_id,office_type_id,effective_from,effective_to').eq('organization_id', org).eq('member_id', member).order('effective_from', { ascending: false }).limit(200).abortSignal(signal),
    client.from('recurring_member_terms').select('id,organization_id,member_id,recurring_rule_id,effective_from,effective_to,term_type,override_amount').eq('organization_id', org).eq('member_id', member).order('effective_from', { ascending: false }).limit(200).abortSignal(signal),
  ])
  for (const [index, result] of results.entries()) {
    if (result.error) throw result.error
    if (result.data?.some(row => row.organization_id !== org || (index >= 2 && (!('member_id' in row) || row.member_id !== member)))) throw new Error('Unexpected member scope')
  }
  return { offices: results[0].data ?? [], rules: results[1].data ?? [], history: results[2].data ?? [], terms: results[3].data ?? [] }
}

export function normalizedAmount(value: string) {
  const text = value.trim()
  if (!/^\d{1,12}([.,]\d{1,2})?$/.test(text)) throw new Error('Informe um valor positivo ou zero com até duas casas decimais, sem separador de milhar.')
  return text.replace(',', '.')
}
