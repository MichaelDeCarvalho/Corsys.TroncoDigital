import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { Relatorios } from './Relatorios'

function mockSupabaseClient() {
  const from = vi.fn().mockImplementation((table: string) => {
    let mockData: unknown[] = []
    if (table === 'v_institutional_payable_effective') {
      mockData = [
        {
          payable_id: 'p1',
          organization_id: 'org-1',
          description: 'Energia Elétrica',
          due_date: '2026-10-15',
          competence: '2026-10-01',
          effective_amount: '250.00',
          open_amount: '250.00',
          approval_status: 'approved',
          is_canceled: false,
        },
      ]
    } else if (table === 'v_institutional_receivable_effective') {
      mockData = [
        {
          receivable_id: 'r1',
          organization_id: 'org-1',
          description: 'Aporte de Evento',
          due_date: '2026-10-20',
          competence: '2026-10-01',
          effective_amount: '1000.00',
          open_amount: '0.00',
          is_canceled: false,
        },
      ]
    } else if (table === 'v_charge_balances') {
      mockData = [
        {
          charge_id: 'c1',
          organization_id: 'org-1',
          description: 'Mensalidade Outubro',
          due_date: '2026-10-10',
          competence: '2026-10-01',
          effective_amount: '150.00',
          open_amount: '0.00',
          settlement_status: 'paid',
          is_cancelled: false,
        },
      ]
    } else if (table === 'v_chart_of_accounts') {
      mockData = [
        { account_code: '1.1.01', account_name: 'Caixa Geral', account_type: 'asset', is_active: true },
        { account_code: '2.1.01', account_name: 'Fornecedores', account_type: 'liability', is_active: true },
      ]
    }

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => Promise.resolve({ data: mockData, error: null }).then(resolve),
    }

    return queryBuilder
  })

  const rpc = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'read_tenant_delinquency') {
      return Promise.resolve({
        data: [
          {
            member_id: 'm1',
            member_name: 'Silva',
            oldest_due: '2026-09-01',
            overdue_items: 1,
            overdue_amount: 150,
            unallocated_credit: 0,
            net_delinquent_amount: 150,
          },
        ],
        error: null,
      })
    }
    if (fnName === 'read_tenant_dre_report') {
      return Promise.resolve({
        data: [
          {
            account_code: '3.1',
            account_name: 'Receitas Operacionais',
            group_level: 1,
            amount: 1500,
          },
        ],
        error: null,
      })
    }
    if (fnName === 'read_tenant_financial_periods') {
      return Promise.resolve({
        data: [
          {
            period_id: 'p-1',
            competence: '2026-10-01',
            is_closed: false,
          },
        ],
        error: null,
      })
    }
    return Promise.resolve({ data: [], error: null })
  })

  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('Relatorios component', () => {
  it('renders report navigation tabs and loads default Posição Geral report', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    expect(screen.getByText('Relatórios Gerenciais')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Posição Geral' })).toHaveAttribute('aria-pressed', 'true')

    await screen.findByText('A. Posição Financeira Geral')
    await screen.findByText('Energia Elétrica')
    await screen.findByText('Aporte de Evento')
  })

  it('switches to Recebimentos tab and renders receipts report', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Recebimentos' })
    fireEvent.click(tab)

    await screen.findByText('B. Relatório de Recebimentos')
    await screen.findByText('Total Recebido')
  })

  it('switches to Inadimplência tab and renders delinquency component', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Inadimplência' })
    fireEvent.click(tab)

    await screen.findByText('C. Relatório de Inadimplência')
  })

  it('switches to Exportação Contábil tab and renders chart of accounts', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    const tab = screen.getByRole('button', { name: 'Exportação Contábil' })
    fireEvent.click(tab)

    await screen.findByText('E. Plano de Contas & Exportação Contábil')
    await screen.findByText('Caixa Geral')
  })

  it('shows PDF export notice modal when PDF button is clicked', async () => {
    const { client } = mockSupabaseClient()
    render(<Relatorios client={client} organizationId="org-1" />)

    await screen.findByText('A. Posição Financeira Geral')
    const pdfBtn = screen.getByRole('button', { name: 'PDF' })
    fireEvent.click(pdfBtn)

    await screen.findByText('Serviço de Exportação PDF')
    expect(screen.getByText(/necessita do serviço estendido de relatórios/)).toBeInTheDocument()
  })
})
