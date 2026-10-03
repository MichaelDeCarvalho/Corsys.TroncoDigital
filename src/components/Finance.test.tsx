import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { Finance } from './Finance'

type RecordRow = Record<string, unknown>
type Result = { data: RecordRow[] | null; error: { message: string } | null }
const row = (id = 'charge-1', extra: RecordRow = {}) => ({ charge_id: id, organization_id: 'org-a', description: `Mensalidade ${id}`, due_date: '2026-10-01', effective_amount: '150.10', open_amount: '50.10', is_cancelled: false, settlement_status: 'partially_paid', integrity_ok: true, ...extra })

function mockClient(respond: (view: string, organization: string, from: number, to: number) => Promise<Result>) {
  const requests: { view: string; organization: string; from: number; to: number; signal: AbortSignal }[] = []
  const from = vi.fn((view: string) => {
    let organization = ''; let start = 0; let end = 0
    const chain = {
      select: (_: string) => chain,
      eq: (_: string, id: string) => { organization = id; return chain },
      order: (_: string, __?: unknown) => chain,
      range: (a: number, b: number) => { start = a; end = b; return chain },
      abortSignal: (signal: AbortSignal) => { requests.push({ view, organization, from: start, to: end, signal }); return respond(view, organization, start, end) },
    }
    return chain
  })
  return { client: { from } as unknown as SupabaseClient, requests }
}

describe('Financial consultation', () => {
  it('renders the backend effective/open amounts, date and partial settlement without turning them into cash', async () => {
    const mock = mockClient(async () => ({ data: [row()], error: null }))
    render(<Finance client={mock.client} organizationId="org-a" />)
    await screen.findByText('Mensalidade charge-1')
    expect(screen.getByText('01/10/2026')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /^R\$\s150,10$/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /^R\$\s50,10$/ })).toBeInTheDocument()
    expect(screen.getByText('Parcialmente liquidada')).toBeInTheDocument()
    expect(mock.requests[0].organization).toBe('org-a')
    expect(screen.getByText(/não representam saldo de caixa/)).toBeInTheDocument()
  })

  it('paginates with lookahead instead of displaying an incomplete global total', async () => {
    const mock = mockClient(async (_, __, start) => ({ data: start === 0 ? Array.from({ length: 26 }, (_, i) => row(`charge-${i}`)) : [row('last')], error: null }))
    render(<Finance client={mock.client} organizationId="org-a" />)
    await screen.findByText('Mensalidade charge-0')
    expect(screen.queryByText('Mensalidade charge-25')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Mensalidade last')
    expect(screen.queryByText('Mensalidade charge-0')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(mock.requests.at(-1)).toMatchObject({ from: 25, to: 50 })
  })

  it('keeps institutional payables and receivables separate from member charges', async () => {
    const mock = mockClient(async view => ({ data: view === 'v_institutional_payable_effective' ? [row('unused', { payable_id: 'p-1', description: 'Energia', approval_status: 'approved', is_canceled: false })] : [], error: null }))
    render(<Finance client={mock.client} organizationId="org-a" />)
    await screen.findByText('Nenhum registro nesta página.')
    fireEvent.click(within(screen.getByRole('group', { name: 'Consultas financeiras' })).getByRole('button', { name: 'Contas a pagar' }))
    await screen.findByText('Energia')
    expect(screen.getByText('Aprovada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Contas a receber' }))
    await screen.findByText('Nenhum registro nesta página.')
    expect(mock.requests.at(-1)?.view).toBe('v_institutional_receivable_effective')
    expect(screen.queryByText('Energia')).not.toBeInTheDocument()
  })

  it.each([
    { organization_id: 'org-b' },
    { integrity_ok: false },
    { open_amount: null },
    { effective_amount: 'invalid' },
  ])('fails closed for unexpected tenant, inconsistent or invalid data: %j', async extra => {
    const mock = mockClient(async () => ({ data: [row('private', extra)], error: null }))
    render(<Finance client={mock.client} organizationId="org-a" />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Mensalidade private')).not.toBeInTheDocument()
  })

  it('does not misrepresent a permission/network error as an empty balance and can retry', async () => {
    let attempt = 0
    const mock = mockClient(async () => ++attempt === 1 ? { data: null, error: { message: 'permission denied' } } : { data: [], error: null })
    render(<Finance client={mock.client} organizationId="org-a" />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhum registro nesta página.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Nenhum registro nesta página.')
  })

  it('discards a late financial response from the previous organization', async () => {
    let resolve!: (result: Result) => void
    const pending = new Promise<Result>(done => { resolve = done })
    const mock = mockClient(async (_, org) => org === 'org-a' ? pending : { data: [row('b', { organization_id: 'org-b' })], error: null })
    const { rerender } = render(<Finance client={mock.client} organizationId="org-a" />)
    rerender(<Finance client={mock.client} organizationId="org-b" />)
    await screen.findByText('Mensalidade b')
    await act(async () => { resolve({ data: [row('late-a')], error: null }); await pending })
    expect(screen.queryByText('Mensalidade late-a')).not.toBeInTheDocument()
    expect(mock.requests[0].signal.aborted).toBe(true)
  })
})
