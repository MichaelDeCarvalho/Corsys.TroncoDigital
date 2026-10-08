import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MemberConfiguration } from './MemberConfiguration'

const member = { id: 'member', organization_id: 'org', full_name: 'Integrante', status: 'active' }
const id = '125c4935-a21e-4a1a-9b70-883e0f9457de'
function mock(loaded = true, withTerm = false) {
  const from = vi.fn((table: string) => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      abortSignal: () => Promise.resolve({ data: !loaded ? [] : table === 'office_types' ? [{ id: 'office', organization_id: 'org', name: 'Tesoureiro', active: true }] : table === 'recurring_rules' ? [{ id: 'rule', organization_id: 'org', name: 'Mensalidade', active: true, frequency: 'monthly' }] : table === 'recurring_member_terms' && withTerm ? [{ id: 'term', organization_id: 'org', member_id: 'member', recurring_rule_id: 'rule', effective_from: '2030-01-01', effective_to: null, term_type: 'exempt', override_amount: null }] : [], error: null }),
    }
    return chain
  })
  const rpc = vi.fn().mockResolvedValue({ data: id, error: null })
  return { client: { from, rpc } as unknown as SupabaseClient, rpc }
}
describe('Member configuration', () => {
  it('replaces an open exemption with a future individual value without touching the ledger', async () => {
    const { client, rpc } = mock(true, true)
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByLabelText('Condição atual sem término')
    fireEvent.change(screen.getByLabelText('Condição atual sem término'), { target: { value: 'term' } })
    fireEvent.change(screen.getByLabelText('Competência futura para a mudança'), { target: { value: '2031-02' } })
    fireEvent.change(screen.getByLabelText('Nova condição'), { target: { value: 'override_amount' } })
    fireEvent.change(screen.getByLabelText('Novo valor individual (R$)'), { target: { value: '180,45' } })
    fireEvent.change(screen.getByLabelText('Motivo da alteração'), { target: { value: 'Nova contribuição aprovada' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Substituir ou encerrar mensalidade individual' }))
    await screen.findByText('Configuração salva. O histórico foi atualizado.')
    expect(rpc).toHaveBeenCalledWith('transition_member_term', expect.objectContaining({
      p_organization_id: 'org', p_member_id: 'member', p_current_term_id: 'term',
      p_next_from: '2031-02-01', p_next_type: 'override_amount', p_next_amount: '180.45',
    }))
  })
  it('closes a term without successor to revert to the default monthly rule', async () => {
    const { client, rpc } = mock(true, true)
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByLabelText('Condição atual sem término')
    fireEvent.change(screen.getByLabelText('Condição atual sem término'), { target: { value: 'term' } })
    fireEvent.change(screen.getByLabelText('Competência futura para a mudança'), { target: { value: '2031-03' } })
    fireEvent.change(screen.getByLabelText('Motivo da alteração'), { target: { value: 'Fim do benefício' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Substituir ou encerrar mensalidade individual' }))
    await screen.findByText('Configuração salva. O histórico foi atualizado.')
    expect(rpc).toHaveBeenCalledWith('transition_member_term', expect.objectContaining({
      p_next_from: '2031-03-01', p_next_type: null, p_next_amount: null,
    }))
  })
  it('does not offer a transition when no open terms exist', async () => {
    const { client, rpc } = mock()
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByText('Nenhuma condição mensal sem término para substituir.')
    expect(screen.queryByRole('button', { name: 'Confirmar mudança futura' })).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('submits a precise individual amount with future competence and then displays confirmation', async () => {
    const { client, rpc } = mock()
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByLabelText('Configuração')
    fireEvent.change(screen.getByLabelText('Configuração'), { target: { value: 'term' } })
    fireEvent.change(screen.getByLabelText('Condição de mensalidade'), { target: { value: 'override_amount' } })
    fireEvent.change(screen.getByLabelText('Mensalidade individual (R$)'), { target: { value: '125,50' } })
    fireEvent.change(screen.getByLabelText('Competência inicial futura'), { target: { value: '2030-01' } })
    fireEvent.change(screen.getByLabelText('Motivo da configuração'), { target: { value: 'Nova vigência' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Programar configuração do integrante' }))
    await screen.findByText('Configuração salva. O histórico foi atualizado.')
    expect(rpc).toHaveBeenCalledWith('schedule_member_configuration', expect.objectContaining({ p_organization_id: 'org', p_member_id: 'member', p_reference_id: 'rule', p_effective_from: '2030-01-01', p_override_amount: '125.50', p_term_type: 'override_amount' }))
  })
  it('does not pretend that empty catalogs contain a configured rule', async () => {
    const { client, rpc } = mock(false)
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByText('Não há cargos ativos disponíveis nesta Loja.')
    fireEvent.change(screen.getByLabelText('Configuração'), { target: { value: 'term' } })
    expect(screen.getByText('Não há regras mensais ativas disponíveis nesta Loja.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Programar vigência' })).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('reports overlap rejection and retries ambiguous saves using identical parameters', async () => {
    const { client, rpc } = mock()
    rpc.mockResolvedValueOnce({ data: null, error: { code: '23P01' } }).mockRejectedValueOnce(new Error('network'))
    render(<MemberConfiguration client={client} organizationId="org" member={member} onClose={vi.fn()} />)
    await screen.findByLabelText('Início')
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2030-01-01' } })
    fireEvent.change(screen.getByLabelText('Motivo da configuração'), { target: { value: 'Nova vigência' } })
    const form = screen.getByRole('form', { name: 'Programar configuração do integrante' })
    fireEvent.submit(form)
    await screen.findByText('A vigência se sobrepõe a um registro existente. Confira o histórico.')
    fireEvent.submit(form)
    await screen.findByRole('button', { name: 'Verificar envio' })
    expect(screen.getByLabelText('Início')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar envio' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3))
    expect(rpc.mock.calls[2]).toEqual(rpc.mock.calls[1])
  })
})
