import { render, screen, fireEvent } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { Tesouraria } from './Tesouraria'

function mockClient() {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({
      data: [
        {
          account_id: 'acc-1',
          organization_id: 'org-1',
          name: 'Conta Corrente Principal',
          account_type: 'bank',
          balance: '12500.00',
          integrity_ok: true,
        },
      ],
      error: null,
    }),
  })
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
  return { client: { from, rpc } as unknown as SupabaseClient }
}

describe('Tesouraria view', () => {
  it('renders treasury sections and allows switching to reconciliation', async () => {
    const { client } = mockClient()
    render(<Tesouraria client={client} organizationId="org-1" />)

    expect(screen.getByText('Tesouraria — Caixa, Bancos e Conciliação')).toBeInTheDocument()

    // Switch to reconciliation
    const reconTab = screen.getByRole('button', { name: 'Conciliação OFX/CSV' })
    fireEvent.click(reconTab)

    expect(reconTab).toHaveAttribute('aria-pressed', 'true')
  })
})
