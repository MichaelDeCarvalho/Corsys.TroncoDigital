import type { SupabaseClient } from '@supabase/supabase-js'

export type FinancialCategory = { id: string; organization_id: string; name: string; domain: string; active: boolean; allow_recurrence: boolean; allow_installments: boolean }
export type MonthlyRule = { id: string; organization_id: string; category_id: string; name: string; frequency: string; due_day: number; active: boolean }
export type MonthlyPrice = { id: string; recurring_rule_id: string; valid_from_competence: string; valid_to_competence: string | null; unit_amount: number | string }
export async function loadFinancialStructure(client: SupabaseClient, org: string, signal: AbortSignal) {
  const [categories, rules] = await Promise.all([
    client.from('financial_categories').select('id,organization_id,name,domain,active,allow_recurrence,allow_installments').eq('organization_id', org).order('name').limit(200).abortSignal(signal),
    client.from('recurring_rules').select('id,organization_id,category_id,name,frequency,due_day,active').eq('organization_id', org).order('name').limit(200).abortSignal(signal),
  ])
  if (categories.error) throw categories.error
  if (rules.error) throw rules.error
  if (categories.data?.some(row => row.organization_id !== org) || rules.data?.some(row => row.organization_id !== org)) throw new Error('Unexpected structure scope')
  const ruleIds = (rules.data ?? []).map(row => row.id)
  const prices = ruleIds.length ? await client.from('recurring_rule_versions').select('id,recurring_rule_id,valid_from_competence,valid_to_competence,unit_amount').in('recurring_rule_id', ruleIds).order('valid_from_competence', { ascending: false }).limit(200).abortSignal(signal) : { data: [], error: null }
  if (prices.error) throw prices.error
  if (prices.data?.some(row => !ruleIds.includes(row.recurring_rule_id) || !Number.isFinite(Number(row.unit_amount)) || Number(row.unit_amount) <= 0)) throw new Error('Unexpected price scope or amount')
  return { categories: (categories.data ?? []) as FinancialCategory[], rules: (rules.data ?? []) as MonthlyRule[], prices: (prices.data ?? []) as MonthlyPrice[] }
}
