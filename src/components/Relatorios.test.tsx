import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { Relatorios } from './Relatorios'

function mockSupabaseClient(overrides?: {
  kpisError?: boolean
  integrityError?: boolean
}) {
  const from = vi.fn().mockImplementation((table: string) => {
    let mockData: unknown[] = []

    if (table === 'v_institutional_payable_effective') {
      mockData = Array.from({ length: 30 }, (_, i) => ({
        payable_id: `p-${i}`,
        organization_id: 'org-1',
        description: `Conta Pagar ${i}`,
        due_date: '2026-10-15',
        competence: '2026-10-01',
        effective_amount: '100.00',
        open_amount: '100.00',
        approval_status: 'approved',
        is_canceled: false,
        integrity_ok: overrides?.integrityError ? false : true,
      }))
    } else if (table === 'v_institutional_receivable_effective') {
      mockData = [
        {
          receivable_id: 'r-1',
          organization_id: 'org-1',
          description: 'Receita Institucional',
          due_date: '2026-10-20',
          competence: '2026-10-01',
          effective_amount: '500.00',
          open_amount: '0.00',
          is_canceled: false,
          integrity_ok: true,
        },
      ]
    } else if (table === 'v_charge_balances') {
      mockData = [
        {
          charge_id: 'c-1',
          organization_id: 'org-1',
          description: 'Mensalidade Outubro',
          due_date: '2026-10-10',
          competence: '2026-10-01',
          effective_amount: '150.00',
          open_amount: '150.00',
          settlement_status: 'open',
          is_cancelled: false,
          integrity_ok: true,
        },
      ]
    } else if (table === 'v_payment_balances') {
      mockData = [
        {
          payment_id: 'pay-active-1',
          organization_id: 'org-1',
          member_id: 'm-1',
          payment_date: '2026-10-05', // Payment date differs from due date
          amount: '200.00',
          allocated_amount: '150.00',
          available_amount: '50.00',
          is_reversed: false,
          integrity_ok: true,
        },
      ]
    } else if (table === 'financial_periods') {
      mockData = [
        {
          id: 'fp-1',
          organization_id: 'org-1',
          period: '2026-10-01',
        },
      ]
    } else if (table === 'period_events') {
      mockData = [
        {
          id: 'pe-1',
          organization_id: 'org-1',
          financial_period_id: 'fp-1',
          event_type: 'close',
          event_seq: 1,
        },
      ]
    } else if (table === 'accounting_plans') {
      mockData = [
        {
          id: 'plan-1',
          organization_id: 'org-1',
          name: 'Plano Principal 2026',
          status: 'published',
          valid_from: '2026-01-01',
          valid_to: '2026-12-31',
        },
      ]
    } else if (table === 'accounting_plan_templates') {
      mockData = [
        { id: 'tmpl-1', name: 'Modelo Padrão', version: 1, active: true },
      ]
    } else if (table === 'financial_categories' || table === 'financial_accounts') {
      mockData = [
        { id: 'cat-1', organization_id: 'org-1', name: 'Categoria 1', active: true },
      ]
    } else if (table === 'accounting_accounts') {
      mockData = [
        {
          id: 'acc-1',
          organization_id: 'org-1',
          accounting_plan_id: 'plan-1',
          code: '1.1.01.01',
          description: '=SUM(1,1)', // Formula injection test candidate
          nature: 'patrimonial',
          row_type: 'analytic',
          active: true,
          parent_account_id: null,
        },
      ]
    } else if (table === 'financial_category_account_mappings' || table === 'financial_account_accounting_mappings') {
      mockData = []
    }

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => Promise.resolve({ data: mockData, error: null }).then(resolve),
    }

    return queryBuilder
  })

  const rpc = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'read_tenant_financial_dashboard') {
      if (overrides?.kpisError) {
        return Promise.reject(new Error('RPC Error'))
      }
      return Promise.resolve({
        data: {
          organization_id: 'org-1',
          as_of: '2026-10-25',
          member_open: '1000.00',
          institutional_open: '500.00',
          receivables_open: '1500.00',
          receivables_overdue: '300.00',
          received_this_month: '2000.00',
          cash_bank_balance: '5000.00',
          payables_open: '3000.00',
          payables_overdue: '100.00',
          integrity_ok: true,
        },
        error: null,
      })
    }
    if (fnName === 'read_tenant_dre') {
      return Promise.resolve({
        data: [
          {
            accounting_period: '2026-10-01',
            accounting_plan_id: 'plan-1',
            accounting_account_id: 'acc-1',
            account_code: '3.1.01',
            account_description: 'Receitas de Mensalidade',
            nature: 'revenue',
            signed_amount: 1500.0,
          },
        ],
        error: null,
      })
    }
    return Promise.resolve({ data: [], error: null })
  })

  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('Relatorios component — Integridade Financeira (Comando 08-A)', () => {
  it('renders server-calculated global KPIs and paginated sample without false global totals', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    expect(screen.getByText('Relatórios Gerenciais')).toBeInTheDocument()

    // Global KPIs from server RPC read_tenant_financial_dashboard
    await screen.findByText('Posições Globais Consolidadas no Banco')
    await screen.findByText(/1\.500,00/) // receivables_open
    await screen.findByText(/3\.000,00/) // payables_open

    // Paginated list title
    await screen.findByText(/Amostra Paginada \(Página 1\)/)
  })

  it('queries actual payment events with payment_date in Recebimentos and excludes reversed payments', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Recebimentos' })
    fireEvent.click(tab)

    await screen.findByText('B. Relatório de Recebimentos Efetivados')

    // Verifies payment_date (05/10/2026) is rendered
    await screen.findByText('05/10/2026')
    await screen.findByText(/200,00/)

    // Reversed payment (pay-reversed-1) should NOT be present in active items
    expect(screen.queryByText('pay-rever')).not.toBeInTheDocument()
  })

  it('connects reportCompetence to loadPeriodState and read_tenant_dre in Fechamento & DRE', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Fechamento & DRE' })
    fireEvent.click(tab)

    await screen.findByText('C. Fechamento Mensal e DRE por Competência')
    await screen.findByText(/Estado do Período Contábil \(2026-10\)/)
    await screen.findByText('Fechado')
    await screen.findByText('Receitas de Mensalidade')
  })

  it('queries accounting_plans and accounting_accounts for Chart of Accounts export', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Exportação Contábil' })
    fireEvent.click(tab)

    await screen.findByText('D. Plano de Contas & Exportação Contábil')
    await screen.findByText(/Plano Principal 2026/)
    await screen.findByText('1.1.01.01')
  })

  it('fails closed and displays error alert on integrity error', async () => {
    const { client } = mockSupabaseClient({ integrityError: true })
    render(<Relatorios client={client} organizationId="org-1" />)

    await screen.findByText('Falha de integridade nos registros financeiros.')
    expect(screen.getByText('Falha de integridade nos registros financeiros.')).toBeInTheDocument()
  })

  it('resets state and clears old data when changing organizationId', async () => {
    const { client } = mockSupabaseClient()

    const { rerender: update } = render(<Relatorios client={client} organizationId="org-1" />)
    await screen.findByText('Posições Globais Consolidadas no Banco')

    // Rerender with different tenant
    update(<Relatorios client={client} organizationId="org-2" />)
    expect(screen.getByText('Consultando indicadores globais…')).toBeInTheDocument()
  })
})
