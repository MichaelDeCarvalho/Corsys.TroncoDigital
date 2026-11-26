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

  it('renders the expected main h1 heading for all six dedicated financial routes and preserves Atendimento on support', async () => {
    const { client } = createWorkspaceClient()
    render(<Workspace client={client} user={user} onSignOut={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Atalhos e Ações Rápidas' }, { timeout: 8000 })

    const routeExpectations: Array<[string, string]> = [
      ['Inadimplência', 'Inadimplência'],
      ['Contas a Pagar', 'Contas a Pagar'],
      ['Contas a Receber', 'Contas a Receber'],
      ['Tesouraria', 'Tesouraria'],
      ['Fluxo de Caixa', 'Fluxo de Caixa'],
      ['DRE Gerencial', 'DRE Gerencial'],
      ['Chamados', 'Atendimento'],
    ]

    const sideNav = screen.getByRole('navigation', { name: 'Navegação principal' })
    for (const [navLabel, expectedHeading] of routeExpectations) {
      const navButton = Array.from(sideNav.querySelectorAll('button')).find(
        btn => btn.textContent?.trim() === navLabel,
      )
      expect(navButton).toBeTruthy()
      fireEvent.click(navButton!)

      await waitFor(() => {
        const mainHeading = document.querySelector('.workspace-heading h1')
        expect(mainHeading).toHaveTextContent(expectedHeading)
      })
    }
  })

  it('preserves active Ágapes section and form input when clicking Financeiro again, resets on normal re-entry from another page, and isolates state on organization switch', async () => {
    const base = createWorkspaceClient()
    const origFrom = base.client.from
    ;(base.client as unknown as { from: ReturnType<typeof vi.fn> }).from = vi.fn().mockImplementation((table: string) => {
      let currentOrg = 'org-a'
      const makeBuilder = (getRows: (org: string) => unknown[]) => {
        const builder: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => {
            if (col === 'organization_id') currentOrg = val
            return builder
          }),
          neq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          abortSignal: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(() => Promise.resolve({ data: getRows(currentOrg)[0] ?? null, error: null })),
          then: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data: getRows(currentOrg), error: null }).then(resolve),
        }
        return builder
      }

      if (table === 'organizations') {
        return makeBuilder(() => [
          { id: 'org-a', name: 'Loja Alpha', status: 'active' },
          { id: 'org-b', name: 'Loja Beta', status: 'active' },
        ])
      }
      if (table === 'members') {
        return makeBuilder(org => [
          { id: '11111111-1111-4111-8111-111111111111', organization_id: org, full_name: 'Carlos Silva', status: 'active' },
        ])
      }
      if (table === 'financial_categories') {
        return makeBuilder(org => [
          {
            id: '22222222-2222-4222-8222-222222222222',
            organization_id: org,
            name: 'Ágape Fraternal',
            direction: 'inflow',
            domain: 'member_receivable',
            active: true,
          },
        ])
      }
      if (table === 'agape_events') {
        return makeBuilder(() => [])
      }
      return origFrom(table)
    })

    render(<Workspace client={base.client} user={user} onSignOut={vi.fn()} />)

    // 1. Click Novo Ágape on Dashboard
    const novoAgapeShortcut = await screen.findByRole('button', { name: /Novo Ágape/i }, { timeout: 8000 })
    fireEvent.click(novoAgapeShortcut)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ágapes e participantes' })).toHaveAttribute('aria-pressed', 'true')
    })

    // Wait for AgapeEvents form to load and fill a draft field
    const agapeNameInput = await screen.findByLabelText(/Nome do ágape/i)
    fireEvent.change(agapeNameInput, { target: { value: 'Ágape de Solstício' } })
    expect(agapeNameInput).toHaveValue('Ágape de Solstício')

    // 2. Click Financeiro again on the mobile bottom navigation bar (and main nav)
    const mobileNav = screen.getByRole('navigation', { name: 'Navegação móvel' })
    const mobileFinanceBtn = Array.from(mobileNav.querySelectorAll('button')).find(
      btn => btn.textContent?.trim() === 'Financeiro',
    )!
    fireEvent.click(mobileFinanceBtn)

    // Section remains Ágapes e participantes, form is NOT remounted, and input value is preserved
    expect(screen.getByRole('button', { name: 'Ágapes e participantes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/Nome do ágape/i)).toBe(agapeNameInput)
    expect(screen.getByLabelText(/Nome do ágape/i)).toHaveValue('Ágape de Solstício')

    // 3. Switch to another organization (Loja Beta): state is isolated and draft is not carried over
    const orgSelect = screen.getByLabelText('Loja')
    fireEvent.change(orgSelect, { target: { value: 'org-b' } })

    const newOrgAgapeInput = await screen.findByLabelText(/Nome do ágape/i)
    expect(newOrgAgapeInput).not.toBe(agapeNameInput)
    expect(newOrgAgapeInput).toHaveValue('')

    // 4. Navigate to another route (Integrantes) and then click Financeiro normally -> opens default Cobranças de integrantes
    const mobileMembersBtn = Array.from(mobileNav.querySelectorAll('button')).find(
      btn => btn.textContent?.trim() === 'Integrantes',
    )!
    fireEvent.click(mobileMembersBtn)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Integrantes' })).toBeInTheDocument()
    })

    fireEvent.click(mobileFinanceBtn)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cobranças de integrantes' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Ágapes e participantes' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('keeps 6 structural KPI placeholders above Atalhos e Ações Rápidas while dashboard RPC is pending and navigates Novo Ágape to Ágapes e participantes', async () => {
    const base = createWorkspaceClient()
    let resolveKpis!: (value: unknown) => void
    const origRpcImpl = base.rpc.getMockImplementation()!
    base.rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
      if (name === 'read_tenant_financial_dashboard') {
        return new Promise(resolve => {
          resolveKpis = resolve
        })
      }
      return origRpcImpl(name, params)
    })

    render(<Workspace client={base.client} user={user} onSignOut={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Atalhos e Ações Rápidas' }, { timeout: 8000 })

    // Verify non-intercepted RPCs (e.g., read_tenant_daily_cash_flow) continue resolving via origRpcImpl without recursion
    await waitFor(
      () => {
        expect(base.rpc).toHaveBeenCalledWith(
          'read_tenant_daily_cash_flow',
          expect.objectContaining({ p_organization_id: 'org-a' }),
        )
      },
      { timeout: 8000 },
    )
    expect((await screen.findAllByText(/R\$\s?850,00/)).length).toBeGreaterThan(0)

    // While KPIs are pending, the 6 structural placeholders are rendered in the KPI metric-grid
    const placeholderGrid = screen.getByTestId('financial-kpi-placeholders')
    expect(placeholderGrid.querySelectorAll('.panel.metric.metric-placeholder')).toHaveLength(6)

    const novoAgapeBtn = screen.getByRole('button', { name: /Novo Ágape/i })
    expect(novoAgapeBtn).toBeInTheDocument()

    // Resolve the delayed KPI RPC
    resolveKpis({
      data: {
        organization_id: 'org-a',
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

    await screen.findByRole('button', { name: /A receber vencido/i })
    expect(screen.queryByTestId('financial-kpi-placeholders')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Novo Ágape/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ágapes e participantes' })).toHaveAttribute('aria-pressed', 'true')
    })
  })
})

describe('Workspace M04 tenant notices (read-only support session, past_due, suspended, D01)', () => {
  it('displays active read_only support session banner and suspended/D01 commercial notices', async () => {
    const orgUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const base = createWorkspaceClient()
    const origFromImpl = (base.client.from as unknown as { getMockImplementation: () => ((table: string) => unknown) | undefined }).getMockImplementation()!
    ;(base.client.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const overrideRows =
        table === 'organizations'
          ? [{ id: orgUuid, name: 'Loja Alpha', status: 'active' }]
          : table === 'members'
          ? [{ id: 'm-1', organization_id: orgUuid, full_name: 'Carlos Silva', status: 'active' }]
          : table === 'financial_accounts'
          ? [{ id: 'acc-1', organization_id: orgUuid, name: 'Banco Principal', kind: 'bank', active: true }]
          : table === 'financial_categories'
          ? [{ id: 'cat-1', organization_id: orgUuid, name: 'Mensalidade', direction: 'inflow', active: true }]
          : null
      if (overrideRows) {
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
          maybeSingle: vi.fn().mockResolvedValue({ data: overrideRows[0] ?? null, error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: overrideRows, error: null }).then(resolve),
        }
        return builder
      }
      return origFromImpl(table)
    })
    const origRpcImpl = base.rpc.getMockImplementation()!
    base.rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
      if (name === 'read_tenant_active_support_session') {
        return Promise.resolve({
          data: {
            organization_id: orgUuid,
            active: true,
            scope: 'read_only',
            expires_at: '2026-11-26T15:15:00Z',
          },
          error: null,
        })
      }
      if (name === 'read_tenant_commercial_status') {
        return Promise.resolve({
          data: {
            organization_id: orgUuid,
            subscription_id: 'sub-1',
            subscription_status: 'suspended',
            commercial_status: 'suspended',
            access_override: 'none',
            write_allowed: false,
            plan_id: 'p1',
            plan_code: 'corsys_essencial_125',
            plan_name: 'Corsys Essencial',
            plan_version_id: 'v1',
            contract_price: 125,
            active_users: 2,
            max_admin_users: 3,
            current_period_start: '2026-11-01',
            current_period_end: '2026-11-30',
            billing_anchor_day: 10,
            past_due_since: '2026-11-11T00:00:00Z',
            grace_until: '2026-11-18T23:59:59Z',
            cancel_at_period_end: false,
            canceled_at: null,
            export_window_until: null,
            open_amount: '125.00',
            overdue_amount: '125.00',
            scheduled_change: null,
          },
          error: null,
        })
      }
      return origRpcImpl(name, params)
    })

    render(<Workspace client={base.client} user={user} onSignOut={vi.fn()} />)
    expect(await screen.findByText(/Sessão de suporte da plataforma ativa \(somente leitura\)/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(await screen.findByText(/Assinatura suspensa — modo somente leitura/)).toBeInTheDocument()
  })

  it("keeps write_allowed=true and displays C03 grace-expired overdue warning while past_due after grace_until before manual suspension", async () => {
    const orgUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const base = createWorkspaceClient()
    const origFromImpl = (base.client.from as unknown as { getMockImplementation: () => ((table: string) => unknown) | undefined }).getMockImplementation()!
    ;(base.client.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      const overrideRows =
        table === "organizations"
          ? [{ id: orgUuid, name: "Loja Alpha", status: "active" }]
          : table === "members"
          ? [{ id: "m-1", organization_id: orgUuid, full_name: "Carlos Silva", status: "active" }]
          : table === "financial_accounts"
          ? [{ id: "acc-1", organization_id: orgUuid, name: "Banco Principal", kind: "bank", active: true }]
          : table === "financial_categories"
          ? [{ id: "cat-1", organization_id: orgUuid, name: "Mensalidade", direction: "inflow", active: true }]
          : null
      if (overrideRows) {
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
          maybeSingle: vi.fn().mockResolvedValue({ data: overrideRows[0] ?? null, error: null }),
          then: (resolve: (v: unknown) => void) => Promise.resolve({ data: overrideRows, error: null }).then(resolve),
        }
        return builder
      }
      return origFromImpl(table)
    })

    const origRpcImpl = base.rpc.getMockImplementation()!
    base.rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
      if (name === "read_tenant_commercial_status") {
        return Promise.resolve({
          data: {
            organization_id: orgUuid,
            subscription_id: "sub-1",
            subscription_status: "past_due",
            commercial_status: "past_due",
            access_override: "none",
            write_allowed: true,
            plan_id: "p1",
            plan_code: "corsys_essencial_125",
            plan_name: "Corsys Essencial",
            plan_version_id: "v1",
            contract_price: 125,
            active_users: 2,
            max_admin_users: 3,
            current_period_start: "2026-11-01",
            current_period_end: "2026-11-30",
            billing_anchor_day: 10,
            past_due_since: "2026-11-01T00:00:00Z",
            grace_until: "2026-11-08T23:59:59Z",
            cancel_at_period_end: false,
            canceled_at: null,
            export_window_until: null,
            open_amount: "125.00",
            overdue_amount: "125.00",
            scheduled_change: null,
          },
          error: null,
        })
      }
      return origRpcImpl(name, params)
    })

    render(<Workspace client={base.client} user={user} onSignOut={vi.fn()} />)
    expect(
      await screen.findByText(/Fatura SaaS em atraso — tolerância encerrada \(sujeita a suspensão manual C03\)/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Assinatura suspensa — modo somente leitura/)).not.toBeInTheDocument()
  })
})
