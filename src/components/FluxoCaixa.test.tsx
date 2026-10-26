import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FluxoCaixa } from './FluxoCaixa'

function mockClient() {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        movement_day: '2026-10-01',
        received: '1500.00',
        paid: '500.00',
        realized_net: '1000.00',
        member_receivables_due: '200.00',
        institutional_receivables_due: '300.00',
        institution_payables_due: '100.00',
        projected_net: '400.00',
      },
    ],
    error: null,
  })
  return { client: { rpc } as unknown as SupabaseClient }
}

describe('FluxoCaixa view', () => {
  it('renders cash flow view and handles view mode switches with distinct representations', async () => {
    const { client } = mockClient()
    render(<FluxoCaixa client={client} organizationId="org-1" />)

    expect(screen.getByText('Fluxo de Caixa — Entradas e Saídas Efetivas')).toBeInTheDocument()

    // Switch to Projetado mode
    const projectedBtn = screen.getByRole('button', { name: 'Projetado' })
    fireEvent.click(projectedBtn)

    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/A visão projetada considera exclusivamente obrigações efetivas/)).toBeInTheDocument()

    // Switch to Saldo mode
    const saldoBtn = screen.getByRole('button', { name: 'Saldo' })
    fireEvent.click(saldoBtn)

    expect(saldoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Visualização de saldos indisponível neste relatório/)).toBeInTheDocument()
    expect(screen.getByText(/Os saldos acumulados de caixa dependem dos registros de conciliação/)).toBeInTheDocument()
  })
})
