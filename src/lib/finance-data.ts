import type { SupabaseClient } from '@supabase/supabase-js'

export type FinanceKind = 'charges' | 'payables' | 'receivables'
export type FinanceRow = { id: string; description: string; dueDate: string; amount: number; openAmount: number; status: string }
export const FINANCE_PAGE_SIZE = 25
export const financeSources = {
  charges: { label: 'Cobranças de integrantes', view: 'v_charge_balances', id: 'charge_id', status: 'settlement_status' },
  payables: { label: 'Contas a pagar', view: 'v_institutional_payable_effective', id: 'payable_id', status: 'approval_status' },
  receivables: { label: 'Contas a receber', view: 'v_institutional_receivable_effective', id: 'receivable_id', status: 'is_canceled' },
} as const

export class FinanceIntegrityError extends Error {}

function amount(value: unknown): number {
  if (!['number', 'string'].includes(typeof value) || !/^\d{1,12}(\.\d{1,2})?$/.test(String(value))) {
    throw new FinanceIntegrityError('Invalid financial amount')
  }
  return Number(value)
}

export async function loadFinancePage(client: SupabaseClient, organizationId: string, kind: FinanceKind, page: number, signal: AbortSignal) {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page')
  const source = financeSources[kind]
  const cancellation = kind === 'charges' ? 'is_cancelled' : 'is_canceled'
  const fields = [...new Set([source.id, 'organization_id', 'description', 'due_date', 'effective_amount', 'open_amount', 'integrity_ok', cancellation, source.status])].join(',')
  const { data, error } = await client.from(source.view).select(fields).eq('organization_id', organizationId)
    .order('due_date', { ascending: false }).order(source.id).range(page * FINANCE_PAGE_SIZE, (page + 1) * FINANCE_PAGE_SIZE).abortSignal(signal)
  if (error) throw error
  const records: unknown = data ?? []
  if (!Array.isArray(records)) throw new FinanceIntegrityError('Invalid financial response')
  const rows: FinanceRow[] = records.map((record: unknown) => {
    if (!record || typeof record !== 'object') throw new FinanceIntegrityError('Invalid financial record')
    const row = record as Record<string, unknown>
    const id = row[source.id]; const description = row.description; const dueDate = row.due_date
    if (row.organization_id !== organizationId) throw new Error('Unexpected organization in response')
    if (row.integrity_ok !== true || typeof id !== 'string' || typeof description !== 'string' || typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || typeof row[cancellation] !== 'boolean' || (kind !== 'receivables' && typeof row[source.status] !== 'string')) {
      throw new FinanceIntegrityError('Invalid financial record')
    }
    const status = row[cancellation] === true ? 'cancelled' : kind === 'receivables' ? 'posted' : row[source.status]
    return { id, description, dueDate, amount: amount(row.effective_amount), openAmount: amount(row.open_amount), status: String(status) }
  })
  // One extra row determines whether another page exists. Never turn a page subtotal into a global balance.
  return { rows: rows.slice(0, FINANCE_PAGE_SIZE), hasNext: rows.length > FINANCE_PAGE_SIZE }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(value: string) {
  // Database DATE has no timezone; do not shift the due date in local time.
  return value.split('-').reverse().join('/')
}
