import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { ContasPagar } from './ContasPagar'

function mockClient() {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({
      data: [
        {
          payable_id: 'p1',
          organization_id: 'org-1',
          description: 'Conta de Energia',
          due_date: '2026-10-15',
          competence: '2026-10-01',
          effective_amount: '350.00',
          open_amount: '350.00',
          integrity_ok: true,
          is_canceled: false,
          approval_status: 'approved',
        },
      ],
      error: null,
    }),
  })
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('ContasPagar view', () => {
  it('renders payables overview and allows switching between operations and approvals', async () => {
    const { client } = mockClient()
    render(<ContasPagar client={client} organizationId="org-1" />)

    await screen.findByText('Conta de Energia')
    expect(screen.getByText('1 obrigação')).toBeInTheDocument()

    // Switch to approvals tab
    const approvalTab = screen.getByRole('button', { name: 'Fila de Aprovação' })
    fireEvent.click(approvalTab)

    expect(screen.getByRole('button', { name: 'Fila de Aprovação' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('applies expense classification and status filters to backend query', async () => {
    const { client } = mockClient()
    render(<ContasPagar client={client} organizationId="org-1" />)

    await screen.findByText('Conta de Energia')

    // Change type filter
    const typeSelect = screen.getByLabelText('Tipo de obrigação')
    fireEvent.change(typeSelect, { target: { value: 'Fixa' } })

    await waitFor(() => {
      expect(client.from).toHaveBeenCalledWith('v_institutional_payable_effective')
    })

    // Change status filter
    const statusSelect = screen.getByLabelText('Situação')
    fireEvent.change(statusSelect, { target: { value: 'Pendente' } })

    await waitFor(() => {
      expect(client.from).toHaveBeenCalledWith('v_institutional_payable_effective')
    })
  })
})
