import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import {
  loadCashFlowMovementPage,
  operationalMovementTypes,
} from './cash-flow-movement-detail'
import { CashFlowMovementDetail } from '../components/CashFlowMovementDetail'

const organizationId = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
const otherOrg = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05c'
const accountId = 'a7618966-ad8e-466b-b11d-2ca52ce6372d'
const sourceId = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const secondSource = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec625'
const from = '2026-10-01'
const to = '2026-10-31'

function movement(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: organizationId,
    financial_account_id: accountId,
    movement_date: '2026-10-05',
    signed_amount: '25.00',
    movement_type: 'member_payment',
    source_id: sourceId,
    ...overrides,
  }
}

function mock(
  movements: unknown[] = [movement()],
  opts: {
    movementCount?: number | null
    accounts?: unknown[]
    accountCount?: number | null
    movementError?: unknown
  } = {},
) {
  const selections: Array<{ table: string; filters: Array<[string, unknown, unknown]>; selected: unknown[] }> = []
  const fromTable = vi.fn((table: string) => {
    const filters: Array<[string, unknown, unknown]> = []
    const selected: unknown[] = []
    selections.push({ table, filters, selected })
    const query = {
      select: (...args: unknown[]) => { selected.push(...args); return query },
      eq: (field: string, value: unknown) => { filters.push(['eq', field, value]); return query },
      gte: (field: string, value: unknown) => { filters.push(['gte', field, value]); return query },
      lte: (field: string, value: unknown) => { filters.push(['lte', field, value]); return query },
      in: (field: string, value: unknown) => { filters.push(['in', field, value]); return query },
      order: (..._args: unknown[]) => query,
      limit: (..._args: unknown[]) => query,
      range: (start: number, end: number) => { filters.push(['range', start, end]); return query },
      abortSignal: (..._args: unknown[]) =>
        Promise.resolve(table === 'v_financial_account_movements'
          ? { data: movements, count: opts.movementCount === undefined ? movements.length : opts.movementCount, error: opts.movementError ?? null }
          : { data: opts.accounts ?? [{ id: accountId, organization_id: organizationId, name: 'Caixa da Loja' }],
              count: opts.accountCount === undefined ? 1 : opts.accountCount, error: null }),
    }
    return query
  })
  return { client: { from: fromTable } as unknown as SupabaseClient, fromTable, selections }
}

describe('V35 operational cash flow movement detail', () => {
  it('reads exact tenant-scoped, time-bound operational events with account labels', async () => {
    const { client, selections } = mock([
      movement(),
      movement({ movement_type: 'institutional_payable_payment', signed_amount: '-15.00', source_id: secondSource }),
    ], { movementCount: 2 })
    const response = await loadCashFlowMovementPage(client, organizationId, from, to, 0, new AbortController().signal)
    expect(response.total).toBe(2)
    expect(response.hasNext).toBe(false)
    expect(response.rows.map(row => [row.incoming, row.outgoing])).toEqual([[25, 0], [0, 15]])
    expect(response.rows[0].account).toBe('Caixa da Loja')
    const query = selections[0]
    expect(query.table).toBe('v_financial_account_movements')
    expect(query.filters).toContainEqual(['eq', 'organization_id', organizationId])
    expect(query.filters).toContainEqual(['gte', 'movement_date', from])
    expect(query.filters).toContainEqual(['lte', 'movement_date', to])
    expect(query.filters).toContainEqual(['in', 'movement_type', operationalMovementTypes])
    expect(query.filters).toContainEqual(['range', 0, 24])
    expect(query.selected).toContainEqual({ count: 'exact' })
  })

  it('accepts exact page limits without treating one page as a global total', async () => {
    const records = Array.from({ length: 25 }, (_, i) =>
      movement({ source_id: `a752dda8-4ef0-4c58-9d3b-${String(i + 1).padStart(12, '0')}` }))
    const result = await loadCashFlowMovementPage(
      mock(records, { movementCount: 26 }).client,
      organizationId, from, to, 0, new AbortController().signal,
    )
    expect(result.rows).toHaveLength(25)
    expect(result.hasNext).toBe(true)
    expect(result.total).toBe(26)
  })

  it('fails closed for truncated pages and malformed count', async () => {
    for (const options of [{ movementCount: 2 }, { movementCount: null }]) {
      await expect(loadCashFlowMovementPage(
        mock([movement()], options).client,
        organizationId, from, to, 0, new AbortController().signal,
      )).rejects.toThrow('Incomplete cash flow movement page')
    }
  })

  it('rejects cross-tenant, excluded event types, duplicates and invalid movement direction', async () => {
    const cases = [
      [movement({ organization_id: otherOrg })],
      [movement({ movement_type: 'account_transfer_in' })],
      [movement({ signed_amount: '-25.00' })],
      [movement(), movement()],
    ]
    for (const records of cases) {
      await expect(loadCashFlowMovementPage(
        mock(records).client, organizationId, from, to, 0, new AbortController().signal,
      )).rejects.toThrow()
    }
  })

  it('rejects missing, duplicate or foreign account names instead of leaking incomplete data', async () => {
    for (const options of [
      { accounts: [], accountCount: 0 },
      { accounts: [{ id: accountId, organization_id: otherOrg, name: 'Outra Loja' }] },
      { accounts: [{ id: accountId, organization_id: organizationId, name: '' }] },
    ]) {
      await expect(loadCashFlowMovementPage(
        mock([movement()], options).client, organizationId, from, to, 0, new AbortController().signal,
      )).rejects.toThrow()
    }
  })

  it('validates the period and page before any external request', async () => {
    const { client, fromTable } = mock()
    for (const [start, end, page] of [
      ['2026-02-29', to, 0], [to, from, 0], [from, '2027-10-01', 0], [from, to, -1],
    ] as const) {
      await expect(loadCashFlowMovementPage(client, organizationId, start, end, page, new AbortController().signal)).rejects.toThrow()
    }
    expect(fromTable).not.toHaveBeenCalled()
  })

  it('shows only verified detail, without suggesting the page is a global balance', async () => {
    const { client } = mock([movement()])
    render(<CashFlowMovementDetail client={client} organizationId={organizationId} from={from} to={to} />)
    expect(await screen.findByText('Recebimento de integrante')).toBeInTheDocument()
    expect(screen.getByText('Caixa da Loja')).toBeInTheDocument()
    expect(screen.getByText(/1 movimentos no período/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(screen.getByText(/não constitui um saldo ou total global/)).toBeInTheDocument()
  })

  it('hides previous tenant data on a subsequent denied request', async () => {
    const first = mock()
    const view = render(<CashFlowMovementDetail client={first.client} organizationId={organizationId} from={from} to={to} />)
    await screen.findByText('Caixa da Loja')
    const second = mock([movement()], { movementError: { code: '42501' } })
    view.rerender(<CashFlowMovementDetail client={second.client} organizationId={otherOrg} from={from} to={to} />)
    await screen.findByText('Seu perfil não autoriza consultar estas movimentações.')
    await waitFor(() => expect(screen.queryByText('Caixa da Loja')).not.toBeInTheDocument())
  })

  it('keeps pagination read-only and disables next while the following page is loading', async () => {
    const count = 26
    const records = Array.from({ length: 25 }, (_, i) =>
      movement({ source_id: `a752dda8-4ef0-4c58-9d3b-${String(i + 1).padStart(12, '0')}` }))
    const { client, selections } = mock(records, { movementCount: count })
    render(<CashFlowMovementDetail client={client} organizationId={organizationId} from={from} to={to} />)
    const next = await screen.findByRole('button', { name: 'Próxima' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
    await waitFor(() => expect(selections.some(query => query.filters.some(f => f[0] === 'range' && f[1] === 25))).toBe(true))
  })
})
