import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FluxoCaixa } from './FluxoCaixa'

function mockClient() {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        movement_date: '2026-10-01',
        inflow_amount: '1500.00',
        outflow_amount: '500.00',
        net_amount: '1000.00',
        forecast_inflow: '0.00',
        forecast_outflow: '0.00',
        integrity_ok: true,
      },
    ],
    error: null,
  })
  return { client: { rpc } as unknown as SupabaseClient }
}

describe('FluxoCaixa view', () => {
  it('renders cash flow view and handles view mode switches', async () => {
    const { client } = mockClient()
    render(<FluxoCaixa client={client} organizationId="org-1" />)

    expect(screen.getByText('Fluxo de Caixa — Entradas e Saídas Efetivas')).toBeInTheDocument()

    // Switch mode
    const projectedBtn = screen.getByRole('button', { name: 'Projetado' })
    fireEvent.click(projectedBtn)

    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/A visão projetada considera exclusivamente obrigações efetivas/)).toBeInTheDocument()
  })
})
