import type { SupabaseClient } from '@supabase/supabase-js'

export type FinanceKind = 'charges' | 'payables' | 'receivables'
export type FinanceRow = {
  id: string
  description: string
  dueDate: string
  competence: string | null
  amount: number
  openAmount: number
  status: string
}
export type FinanceFilters = {
  competence?: string
  startDate?: string
  endDate?: string
  expenseClassification?: string
  status?: string
}
export const statusLabels: Record<string, string> = {
  open: 'Em aberto',
  paid: 'Liquidada',
  partially_paid: 'Parcialmente liquidada',
  cancelled: 'Cancelada',
  posted: 'Contabilizada',
  approved: 'Aprovada',
  pending: 'Pendente',
  missing_request: 'Aprovação não solicitada',
  not_required: 'Dispensada',
  rejected: 'Rejeitada',
}
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

export async function loadFinancePage(
  client: SupabaseClient,
  organizationId: string,
  kind: FinanceKind,
  page: number,
  signal: AbortSignal,
  filters?: FinanceFilters,
) {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page')
  const source = financeSources[kind]
  const cancellation = kind === 'charges' ? 'is_cancelled' : 'is_canceled'
  const fields = [...new Set([source.id, 'organization_id', 'description', 'competence', 'due_date', 'effective_amount', 'open_amount', 'integrity_ok', cancellation, source.status, ...(kind === 'payables' ? ['expense_classification'] : [])])].join(',')
  let query = client.from(source.view).select(fields).eq('organization_id', organizationId)

  if (filters?.expenseClassification && kind === 'payables') {
    query = query.eq('expense_classification', filters.expenseClassification)
  }

  if (filters?.status) {
    const todayIso = new Date().toISOString().slice(0, 10)
    if (filters.status === 'pending') {
      query = query.gt('open_amount', 0).eq(cancellation, false)
    } else if (filters.status === 'paid') {
      query = query.eq('open_amount', 0).eq(cancellation, false)
    } else if (filters.status === 'overdue') {
      query = query.gt('open_amount', 0).eq(cancellation, false).lt('due_date', todayIso)
    }
  }

  if (filters?.competence) {
    if (!/^\d{4}-\d{2}$/.test(filters.competence)) {
      throw new Error('Formato de competência inválido (use AAAA-MM)')
    }
    // Database competence is stored as first day of month (YYYY-MM-01)
    query = query.eq('competence', `${filters.competence}-01`)
  }

  if (filters?.startDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)) {
      throw new Error('Data inicial inválida (use AAAA-MM-DD)')
    }
    query = query.gte('due_date', filters.startDate)
  }

  if (filters?.endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) {
      throw new Error('Data final inválida (use AAAA-MM-DD)')
    }
    query = query.lte('due_date', filters.endDate)
  }

  const { data, error } = await query
    .order('due_date', { ascending: false })
    .order(source.id)
    .range(page * FINANCE_PAGE_SIZE, (page + 1) * FINANCE_PAGE_SIZE)
    .abortSignal(signal)

  if (error) throw error
  const records: unknown = data ?? []
  if (!Array.isArray(records)) throw new FinanceIntegrityError('Invalid financial response')
  const rows: FinanceRow[] = records.map((record: unknown) => {
    if (!record || typeof record !== 'object') throw new FinanceIntegrityError('Invalid financial record')
    const row = record as Record<string, unknown>
    const id = row[source.id]; const description = row.description; const dueDate = row.due_date
    if (row.organization_id !== organizationId) throw new Error('Unexpected organization in response')
    if (
      row.integrity_ok !== true ||
      typeof id !== 'string' ||
      typeof description !== 'string' ||
      typeof dueDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      (row.competence !== null && row.competence !== undefined && (typeof row.competence !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.competence))) ||
      typeof row[cancellation] !== 'boolean' ||
      (kind !== 'receivables' && typeof row[source.status] !== 'string')
    ) {
      throw new FinanceIntegrityError('Invalid financial record')
    }
    const status = row[cancellation] === true ? 'cancelled' : kind === 'receivables' ? 'posted' : row[source.status]
    const competence = row.competence ? String(row.competence) : null
    return { id, description, dueDate, competence, amount: amount(row.effective_amount), openAmount: amount(row.open_amount), status: String(status) }
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

export function formatCompetence(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '—'
  // YYYY-MM-DD -> MM/YYYY
  const parts = value.split('-')
  if (parts.length >= 2) {
    return `${parts[1]}/${parts[0]}`
  }
  return value
}
