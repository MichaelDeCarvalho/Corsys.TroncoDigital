import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { ContasReceber } from './ContasReceber'

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
          receivable_id: 'r1',
          organization_id: 'org-1',
          description: 'Doação Institucional',
          due_date: '2026-10-20',
          competence: '2026-10-01',
          effective_amount: '500.00',
          open_amount: '500.00',
          integrity_ok: true,
          is_canceled: false,
        },
      ],
      error: null,
    }),
  })
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('ContasReceber view', () => {
  it('renders receivables overview and allows navigation across sub-tabs', async () => {
    const { client } = mockClient()
    render(<ContasReceber client={client} organizationId="org-1" />)

    await screen.findByText('Doação Institucional')
    expect(screen.getByText('Sem misturar com caixa')).toBeInTheDocument()

    // Switch to member payments
    const paymentsTab = screen.getByRole('button', { name: 'Pagamentos de Integrantes' })
    fireEvent.click(paymentsTab)

    expect(paymentsTab).toHaveAttribute('aria-pressed', 'true')
  })
})
