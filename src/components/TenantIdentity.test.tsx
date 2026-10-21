import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { TenantIdentity } from './TenantIdentity'

const org = 'faaf76e4-d796-430f-929f-71df5beaf832'
const original = { organization_id: org, updated_at: '2026-10-08T18:00:00.000000+00:00',
  phone: '4122223333', email: 'loja@example.invalid', pix_key: null, address: null,
  postal_code: null, city: 'Curitiba', state_code: 'PR', country_code: 'BR' }
function mock(data: typeof original | null = original) {
  const chain = {
    select: () => chain, eq: () => chain, limit: () => chain,
    abortSignal: () => Promise.resolve({ data: data ? [data] : [], error: null }),
  }
  const from = vi.fn(() => chain)
  const rpc = vi.fn().mockResolvedValue({ data: org, error: null })
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc }
}
describe('Tenant identity', () => {
  it('reads the authorized tenant record and submits the optimistic expected timestamp', async () => {
    const { client, rpc } = mock()
    render(<TenantIdentity client={client} organizationId={org} />)
    await screen.findByDisplayValue('Curitiba')
    fireEvent.change(screen.getByLabelText('Chave PIX institucional'), { target: { value: 'nova-chave-pix' } })
    fireEvent.change(screen.getByLabelText('Motivo da atualização'), { target: { value: 'Atualização institucional' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configurar identidade da Loja' }))
    await screen.findByText('Dados institucionais salvos. O cadastro foi atualizado.')
    expect(rpc).toHaveBeenCalledWith('save_tenant_identity', expect.objectContaining({
      p_organization_id: org, p_expected_updated_at: original.updated_at,
      p_pix_key: 'nova-chave-pix', p_city: 'Curitiba', p_state_code: 'PR',
    }))
  })
  it('creates settings when the organization has no existing row', async () => {
    const { client, rpc } = mock(null)
    render(<TenantIdentity client={client} organizationId={org} />)
    await screen.findByLabelText('Telefone')
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(41) 99999-9999' } })
    fireEvent.change(screen.getByLabelText('Motivo da atualização'), { target: { value: 'Primeiro cadastro institucional' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configurar identidade da Loja' }))
    await screen.findByText('Dados institucionais salvos. O cadastro foi atualizado.')
    expect(rpc).toHaveBeenCalledWith('save_tenant_identity', expect.objectContaining({ p_expected_updated_at: null, p_phone: '(41) 99999-9999' }))
  })
  it('retries an ambiguous transport failure using the same idempotency key and payload', async () => {
    const { client, rpc } = mock()
    rpc.mockRejectedValueOnce(new Error('network'))
    render(<TenantIdentity client={client} organizationId={org} />)
    await screen.findByLabelText('Telefone')
    fireEvent.change(screen.getByLabelText('Motivo da atualização'), { target: { value: 'Atualização institucional' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configurar identidade da Loja' }))
    await screen.findByRole('button', { name: 'Verificar envio' })
    expect(screen.getByLabelText('Telefone')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar envio' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
  })
  it.each(['40001', 'PT409'])('blocks stale submissions (%s) until the user refreshes the record', async (code) => {
    const { client, rpc } = mock()
    rpc.mockResolvedValueOnce({ data: null, error: { code } })
    render(<TenantIdentity client={client} organizationId={org} />)
    await screen.findByLabelText('Telefone')
    fireEvent.change(screen.getByLabelText('Motivo da atualização'), { target: { value: 'Atualização institucional' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Configurar identidade da Loja' }))
    await screen.findByText('Os dados da Loja foram alterados. Atualize antes de salvar novamente.')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Verificar envio' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar identidade da Loja' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar dados' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar identidade da Loja' })).not.toBeDisabled())
  })
  it('fails closed if the settings row is scoped to another organization', async () => {
    const { client, rpc } = mock({ ...original, organization_id: 'other' })
    render(<TenantIdentity client={client} organizationId={org} />)
    await screen.findByText('Não foi possível consultar os parâmetros da Loja.')
    expect(screen.queryByLabelText('Telefone')).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
})
