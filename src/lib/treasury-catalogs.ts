import type { SupabaseClient } from '@supabase/supabase-js'

export type TreasuryKind = 'account' | 'fund' | 'method'
export type TreasuryItem = {
  id: string
  organization_id: string
  name: string
  active: boolean
  account_type?: string | null
  institution?: string | null
  identification?: string | null
  description?: string | null
}
export type TreasuryCatalogsData = {
  accounts: TreasuryItem[]
  funds: TreasuryItem[]
  methods: TreasuryItem[]
}

export async function loadTreasuryCatalogs(
  client: SupabaseClient, organizationId: string, signal: AbortSignal,
): Promise<TreasuryCatalogsData> {
  const [accounts, funds, methods] = await Promise.all([
    client.from('financial_accounts')
      .select('id,organization_id,name,active,account_type,institution,identification')
      .eq('organization_id', organizationId).order('name').limit(200).abortSignal(signal),
    client.from('funds')
      .select('id,organization_id,name,active,description')
      .eq('organization_id', organizationId).order('name').limit(200).abortSignal(signal),
    client.from('payment_methods')
      .select('id,organization_id,name,active')
      .eq('organization_id', organizationId).order('name').limit(200).abortSignal(signal),
  ])
  for (const result of [accounts, funds, methods]) {
    if (result.error) throw result.error
    if (result.data?.some(item => item.organization_id !== organizationId)) {
      throw new Error('Unexpected treasury catalog scope')
    }
  }
  return {
    accounts: (accounts.data ?? []) as TreasuryItem[],
    funds: (funds.data ?? []) as TreasuryItem[],
    methods: (methods.data ?? []) as TreasuryItem[],
  }
}
