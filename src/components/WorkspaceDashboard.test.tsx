import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { Workspace } from './Workspace'

const user = { id: 'user-1', email: 'tesoureiro@loja.test' } as unknown as User

function createWorkspaceClient() {
  const from = vi.fn().mockImplementation((table: string) => {
    const empty = { data: [], error: null }
    const rows =
      table === 'organizations'
        ? [{ id: 'org-a', name: 'Loja Alpha', status: 'active' }]
        : table === 'members'
        ? [{ id: 'm-1', organization_id: 'org-a', full_name: 'Carlos Silva', status: 'active' }]
        : table === 'v_saas_support_ticket_metrics'
        ? []
        : table === 'financial_accounts'
        ? [{ id: 'acc-1', organization_id: 'org-a', name: 'Banco Principal', kind: 'bank', active: true }]
        : table === 'financial_categories'
        ? [{ id: 'cat-1', organization_id: 'org-a', name: 'Mensalidade', direction: 'inflow', active: true }]
        : []

    const builder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => Promise.resolve(rows.length ? { data: rows, error: null } : empty).then(resolve),
    }
    return builder
  })

  const rpc = vi.fn().mockImplementation((name: string, params?: Record<string, unknown>) => {
    if (name === 'read_tenant_financial_dashboard') {
      return Promise.resolve({
        data: {
          organization_id: params?.p_organization_id ?? 'org-a',
          as_of: '2026-10-15',
          member_open: '400.00',
          institutional_open: '100.00',
          receivables_open: '500.00',
          receivables_overdue: '120.00',
          received_this_month: '850.00',
          cash_bank_balance: '3200.00',
          payables_open: '250.00',
          payables_overdue: '50.00',
          integrity_ok: true,
        },
        error: null,
      })
    }
    if (name === 'read_tenant_daily_cash_flow') {
      const fromDate = typeof params?.p_from_date === 'string' ? params.p_from_date : '2026-10-15'
      const toDate = typeof params?.p_to_date === 'string' ? params.p_to_date : fromDate
      const startMs = Date.parse(`${fromDate}T00:00:00.000Z`)
      const endMs = Date.parse(`${toDate}T00:00:00.000Z`)
      const dayMs = 86400000
      const count = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
        ? Math.floor((endMs - startMs) / dayMs) + 1
        : 1
      const rows = Array.from({ length: count }, (_, idx) => {
        const day = new Date(startMs + idx * dayMs).toISOString().slice(0, 10)
        const isLast = idx === count - 1
        return {
          movement_day: day,
          received: isLast ? '850.00' : '0.00',
          paid: isLast ? '200.00' : '0.00',
          realized_net: isLast ? '650.00' : '0.00',
          member_receivables_due: isLast ? '400.00' : '0.00',
          institutional_receivables_due: isLast ? '100.00' : '0.00',
          institution_payables_due: isLast ? '250.00' : '0.00',
          projected_net: isLast ? '250.00' : '0.00',
          integrity_ok: true,
        }
      })
      return Promise.resolve({
        data: rows,
        error: null,
      })
    }
    if (name === 'read_tenant_cash_flow_detail') {
      return Promise.resolve({
        data: {
          opening_cash_balance: '2550.00',
          closing_cash_balance: '3200.00',
          received_total: '850.00',
          paid_total: '200.00',
          realized_net: '650.00',
          accounts: [],
          movements: [],
          top_expenses: [],
          integrity_ok: true,
        },
        error: null,
      })
    }
    if (name === 'read_tenant_treasury_balances') {
      return Promise.resolve({
        data: [
          {
            financial_account_id: 'acc-1',
            account_name: 'Banco Principal',
            account_kind: 'bank',
            opening_balance: '2550.00',
            movement_balance: '650.00',
            current_balance: '3200.00',
            integrity_ok: true,
          },
        ],
        error: null,
      })
    }
    if (name === 'read_master_saas_overview') {
      return Promise.resolve({ data: null, error: { code: '42501', message: 'not master' } })
    }
    return Promise.resolve({ data: [], error: null })
  })

  return { client: { from, rpc } as unknown as SupabaseClient, rpc }
}

describe('Workspace V35 dashboard modes, shortcuts and KPI navigation', () => {
  it('switches dashboard modes using accessible aria-pressed group buttons and toggles expanded flow view', async () => {
    const { client } = createWorkspaceClient()
    render(<Workspace client={client} user={user} onSignOut={vi.fn()} />)

    // The full 85-file suite can delay tenant initialization beyond findByRole's 1s default.
    // Wait for the user's actual Dashboard to become ready before asserting its controls.
    await screen.findByRole('heading', { name: 'Atalhos e Ações Rápidas' }, { timeout: 8000 })
    const consolidadoBtn = screen.getByRole('button', { name: 'Consolidado' })
    const movimentosBtn = screen.getByRole('button', { name: 'Receitas x Desp.' })
    const saldoBtn = screen.getByRole('button', { name: 'Saldo' })

    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(movimentosBtn)
    expect(movimentosBtn).toHaveAttribute('aria-pressed', 'true')
    expect(consolidadoBtn).toHaveAttribute('aria-pressed', 'false')
    expect(await screen.findByText('Fluxo de Caixa — Movimentos Realizados (Entradas × Saídas)')).toBeInTheDocument()

    fireEvent.click(saldoBtn)
    expect(saldoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Saldos contábeis de caixa e bancos')).toBeInTheDocument()

    const expandBtn = screen.getByRole('button', { name: 'Expandir visão do fluxo' })
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expandBtn)
    expect(screen.getByRole('button', { name: 'Recolher visão do fluxo' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('routes Total a receber KPI to Integrantes and dashboard quick actions directly to Finance sections', async () => {
    const { client } = createWorkspaceClient()
    render(<Workspace client={client} user={user} onSignOut={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Atalhos e Ações Rápidas' }, { timeout: 8000 })
    // KPI values load from an independent read-only RPC after the tenant panel appears.
    const totalReceberCard = await screen.findByRole('button', { name: /Total a receber/i }, { timeout: 8000 })
    fireEvent.click(totalReceberCard)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Integrantes' })).toBeInTheDocument()
    })

    // Return to Dashboard via sidebar nav "Início" and click operational quick action "Registrar pagamento"
    fireEvent.click(screen.getAllByRole('button', { name: 'Início' })[0])
    const registerPaymentShortcut = await screen.findByRole('button', { name: /Registrar pagamento/i })
    fireEvent.click(registerPaymentShortcut)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pagamentos de integrantes' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it.each([
    ['Criar cobrança avulsa', 'Financeiro', 'Cobranças avulsas'],
    ['Novo Ágape', 'Financeiro', 'Ágapes e participantes'],
    ['Gerar mensalidades', 'Financeiro', 'Gerar mensalidades'],
    ['Negociar dívida', 'Financeiro', 'Negociar dívida'],
  ])('navigates from Dashboard quick action "%s" to %s (%s)', async (buttonLabel, expectedH1, expectedPressedTab) => {
    const { client } = createWorkspaceClient()
    render(<Workspace client={client} user={user} onSignOut={vi.fn()} />)

    const shortcut = await screen.findByRole('button', { name: new RegExp(buttonLabel, 'i') })
    fireEvent.click(shortcut)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: expectedH1 })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: expectedPressedTab })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('recovers cleanly from transient tenant load failure via Tentar novamente', async () => {
    const { client } = createWorkspaceClient()
    let failMembersOnce = true
    const origFrom = client.from
    ;(client as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'members' && failMembersOnce) {
        failMembersOnce = false
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockResolvedValue({ data: null, error: { message: 'temporary failure' } }),
        }
      }
      return origFrom(table)
    })

    render(<Workspace client={client} user={user} onSignOut={vi.fn()} />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Não foi possível carregar os dados desta Loja/)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Atalhos e Ações Rápidas')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
