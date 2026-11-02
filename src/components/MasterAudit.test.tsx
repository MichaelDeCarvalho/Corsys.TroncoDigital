import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MasterAudit } from './MasterAudit'

function fixture(error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ data: [], error }) }))
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}
it('applies filters on the server and shows an explicit empty result', async () => {
  const { client, rpc } = fixture()
  render(<MasterAudit client={client} />)
  await screen.findByText('Nenhum evento nesta consulta.')
  fireEvent.change(screen.getByLabelText('Ação exata'), { target: { value: 'plan.publish' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Filtrar auditoria Master' }))
  await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('list_master_audit_events', expect.objectContaining({ p_action: 'plan.publish', p_before_id: null })))
})
it('shows authorization denial without exposing event data', async () => {
  const { client } = fixture({ code: '42501' })
  render(<MasterAudit client={client} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('MASTER com MFA')
  expect(screen.queryByRole('region', { name: 'Eventos de auditoria' })).not.toBeInTheDocument()
})
