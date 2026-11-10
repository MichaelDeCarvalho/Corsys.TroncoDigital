import type { SupabaseClient } from '@supabase/supabase-js'
import { CASH_FLOW_MOVEMENT_PAGE_SIZE as size, movementLabels, type CashFlowMovementPage } from './cash-flow-movement-detail'
import { checkedSigned } from './treasury-balances'

type Summary = CashFlowMovementPage & {
  opening: number; closing: number; expenseNet: number
  history: { day: string; balance: number }[]
  expenses: { category_id: string | null; category: string | null; amount: number }[]
}

export async function loadCashFlowSnapshot(
  client: SupabaseClient, org: string, from: string, to: string, page: number, signal: AbortSignal,
): Promise<Summary> {
  const { data, error } = await client.rpc('read_tenant_cash_flow_detail', {
    p_organization_id: org, p_from_date: from, p_to_date: to, p_page: page,
  }).abortSignal(signal)
  if (error) throw error
  const start = Date.parse(from + 'T00:00:00Z')
  const days = (Date.parse(to + 'T00:00:00Z') - start) / 86400000 + 1
  if (!data || data.organization_id !== org || data.page !== page ||
      !Number.isSafeInteger(data.total) || data.total < 0 ||
      !Array.isArray(data.rows) || data.rows.length !== Math.min(size, Math.max(0, data.total - page * size)) ||
      !Number.isInteger(days) || days < 1 || days > 93 || !Array.isArray(data.history) ||
      data.history.length !== days || !Array.isArray(data.expenses) || data.expenses.length > 10) {
    throw Error('Invalid or incomplete cash flow snapshot')
  }
  const history = data.history.map((row: { day: string; balance: unknown }, index: number) => {
    if (row.day !== new Date(start + index * 86400000).toISOString().slice(0, 10)) throw Error('Invalid balance date')
    return { day: row.day, balance: checkedSigned(String(row.balance)) }
  })
  const closing = checkedSigned(data.closing)
  if (history.at(-1)?.balance !== closing) throw Error('Invalid closing balance')
  const rows = data.rows.map((row: {
    movement_type: keyof typeof movementLabels; movement_date: string; source_id: string;
    account: string; description: string | null; category: string | null; signed_amount: number
  }) => {
    if (!Object.hasOwn(movementLabels, row.movement_type) || row.movement_date < from || row.movement_date > to ||
        typeof row.account !== 'string' || typeof row.source_id !== 'string') throw Error('Invalid movement scope')
    const amount = checkedSigned(row.signed_amount)
    return {
      key: [row.movement_type, row.source_id].join(':'), movementDate: row.movement_date,
      movementType: row.movement_type, label: movementLabels[row.movement_type], account: row.account,
      sourceId: row.source_id, description: row.description, category: row.category,
      incoming: Math.max(0, amount), outgoing: Math.max(0, -amount),
    }
  })
  if (new Set(rows.map((row: { key: string }) => row.key)).size !== rows.length) throw Error('Duplicate cash flow movements')
  return {
    page, total: data.total, rows, hasNext: (page + 1) * size < data.total,
    opening: checkedSigned(data.opening), closing, history, expenseNet: checkedSigned(data.expense_net),
    expenses: data.expenses.map((row: Summary['expenses'][number]) => {
      const amount = checkedSigned(row.amount)
      if (amount <= 0 || (row.category !== null && typeof row.category !== 'string')) throw Error('Invalid expense')
      return { ...row, amount }
    }),
  }
}
