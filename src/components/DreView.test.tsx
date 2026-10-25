import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { DreView } from './DreView'

function mockClient() {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({
      data: [
        {
          organization_id: 'org-1',
          competence: '2026-10-01',
          group_code: '1',
          account_code: '1.01',
          account_name: 'Receitas de Anuidade',
          amount: '12000.00',
          integrity_ok: true,
        },
      ],
      error: null,
    }),
  })
  return { client: { from } as unknown as SupabaseClient }
}

describe('DreView', () => {
  it('renders DRE demonstrative and allows switching to budget execution', async () => {
    const { client } = mockClient()
    render(<DreView client={client} organizationId="org-1" />)

    expect(screen.getByText('DRE — Demonstração do Resultado do Exercício')).toBeInTheDocument()

    // Switch tab
    const budgetTab = screen.getByRole('button', { name: 'Orçado × Realizado' })
    fireEvent.click(budgetTab)

    expect(budgetTab).toHaveAttribute('aria-pressed', 'true')
  })
})
