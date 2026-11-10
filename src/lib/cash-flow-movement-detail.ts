import type { SupabaseClient } from '@supabase/supabase-js'
import { checkedSigned } from './treasury-balances'

export const CASH_FLOW_MOVEMENT_PAGE_SIZE = 25
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([012][0-9]|3[01])$/
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

// Keep the same operational set as read_tenant_daily_cash_flow. Transfers and
// opening entries affect balances, not operating inflow/outflow.
export const operationalMovementTypes = [
  'member_payment',
  'member_payment_reversal',
  'institutional_receipt',
  'institutional_receipt_reversal',
  'institutional_payable_payment',
  'institutional_payable_payment_reversal',
] as const
type MovementKind = typeof operationalMovementTypes[number]

const direction: Record<MovementKind, 1 | -1> = {
  member_payment: 1,
  member_payment_reversal: -1,
  institutional_receipt: 1,
  institutional_receipt_reversal: -1,
  institutional_payable_payment: -1,
  institutional_payable_payment_reversal: 1,
}
export const movementLabels: Record<MovementKind, string> = {
  member_payment: 'Recebimento de integrante',
  member_payment_reversal: 'Estorno de recebimento de integrante',
  institutional_receipt: 'Recebimento institucional',
  institutional_receipt_reversal: 'Estorno de recebimento institucional',
  institutional_payable_payment: 'Pagamento institucional',
  institutional_payable_payment_reversal: 'Estorno de pagamento institucional',
}

type RawMovement = {
  organization_id: string
  financial_account_id: string
  movement_date: string
  signed_amount: string | number
  movement_type: string
  source_id: string
}
type RawAccount = { id: string; organization_id: string; name: string }

export type CashFlowMovement = {
  key: string
  movementDate: string
  movementType: MovementKind
  label: string
  account: string
  sourceId: string
  incoming: number
  outgoing: number
}
export type CashFlowMovementPage = {
  rows: CashFlowMovement[]
  total: number
  page: number
  hasNext: boolean
}

function utcDate(value: string): number {
  if (!datePattern.test(value)) throw Error('Invalid cash flow movement date')
  const date = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) {
    throw Error('Invalid cash flow movement date')
  }
  return date
}

/**
 * A paginated, RLS-protected operational movements view. Never aggregate the
 * current page into a global amount: daily totals come from the existing RPC.
 * An exact count detects capped/truncated pages rather than showing incomplete
 * information. Queries are read-only and do not claim snapshot isolation.
 */
export async function loadCashFlowMovementPage(
  client: SupabaseClient,
  organizationId: string,
  from: string,
  to: string,
  page: number,
  signal: AbortSignal,
): Promise<CashFlowMovementPage> {
  const first = utcDate(from)
  const last = utcDate(to)
  if (!organizationId || last < first || (last - first) / 86400000 > 92) {
    throw Error('Invalid cash flow movement period')
  }
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) {
    throw Error('Invalid cash flow movement page')
  }
  const start = page * CASH_FLOW_MOVEMENT_PAGE_SIZE
  const response = await client.from('v_financial_account_movements')
    .select('organization_id,financial_account_id,movement_date,signed_amount,movement_type,source_id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .gte('movement_date', from).lte('movement_date', to)
    .in('movement_type', [...operationalMovementTypes])
    .order('movement_date', { ascending: false })
    .order('movement_type')
    .order('source_id')
    .order('financial_account_id')
    .range(start, start + CASH_FLOW_MOVEMENT_PAGE_SIZE - 1)
    .abortSignal(signal)
  if (response.error) throw response.error

  const total = response.count
  const data: unknown = response.data
  if (!Number.isSafeInteger(total) || typeof total !== 'number' || total < 0 ||
    !Array.isArray(data) || (total > 0 && start >= total) ||
    data.length !== Math.min(CASH_FLOW_MOVEMENT_PAGE_SIZE, Math.max(0, total - start))) {
    throw Error('Incomplete cash flow movement page')
  }

  const knownTypes = new Set<string>(operationalMovementTypes)
  const seen = new Set<string>()
  const valid: Array<RawMovement & { movement_type: MovementKind; amount: number; key: string }> = []
  for (const input of data) {
    if (!input || typeof input !== 'object') throw Error('Invalid cash flow movement')
    const row = input as RawMovement
    if (row.organization_id !== organizationId ||
      !uuid.test(row.financial_account_id) || !uuid.test(row.source_id) ||
      !knownTypes.has(row.movement_type) ||
      utcDate(row.movement_date) < first || utcDate(row.movement_date) > last) {
      throw Error('Invalid cash flow movement scope')
    }
    const kind = row.movement_type as MovementKind
    const value = checkedSigned(row.signed_amount)
    if (value === 0 || Math.sign(value) !== direction[kind]) {
      throw Error('Invalid cash flow movement direction')
    }
    const key = [row.movement_date, kind, row.source_id, row.financial_account_id].join(':')
    if (seen.has(key)) throw Error('Duplicate cash flow movement')
    seen.add(key)
    valid.push({ ...row, movement_type: kind, amount: value, key })
  }
  if (!valid.length) return { rows: [], total, page, hasNext: false }

  const ids = [...new Set(valid.map(row => row.financial_account_id))]
  const accounts = await client.from('financial_accounts')
    .select('id,organization_id,name', { count: 'exact' })
    .eq('organization_id', organizationId).in('id', ids)
    .order('id').limit(ids.length).abortSignal(signal)
  if (accounts.error) throw accounts.error
  if (!Array.isArray(accounts.data) || accounts.count !== ids.length ||
    accounts.data.length !== ids.length) {
    throw Error('Incomplete cash flow account labels')
  }
  const names = new Map<string, string>()
  for (const account of accounts.data as RawAccount[]) {
    if (account.organization_id !== organizationId || !ids.includes(account.id) ||
      names.has(account.id) || typeof account.name !== 'string' || !account.name.trim()) {
      throw Error('Invalid cash flow account scope')
    }
    names.set(account.id, account.name)
  }
  return {
    rows: valid.map(row => ({
      key: row.key,
      movementDate: row.movement_date,
      movementType: row.movement_type,
      label: movementLabels[row.movement_type],
      account: names.get(row.financial_account_id)!,
      sourceId: row.source_id,
      incoming: Math.max(0, row.amount),
      outgoing: Math.max(0, -row.amount),
    })),
    total,
    page,
    hasNext: start + valid.length < total,
  }
}
