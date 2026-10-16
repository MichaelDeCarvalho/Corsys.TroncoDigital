import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { TreasuryCatalogs } from './TreasuryCatalogs'

const id = 'faaf76e4-d796-430f-929f-71df5beaf832'
function fixture(foreign = false, accountActive = true) {
  const rows: Record<string, unknown[]> = {
    financial_accounts: [{ id, organization_id: foreign ? 'foreign' : 'org', name: 'Caixa', account_type: 'cash', institution: null, identification: null, active: accountActive }],
    funds: [],
    payment_methods: [],
  }
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      abortSignal: () => Promise.resolve({ data: rows[table], error: null }),
    }
    return chain
  })
  const rpc = vi.fn().mockResolvedValue({ data: id, error: null })
  return { client: { from, rpc } as unknown as SupabaseClient, rpc, from }
}

describe('Treasury catalogs', () => {
  it('loads and scopes all catalogs with existing RLS reads', async () => {
    const { client, from } = fixture()
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByRole('button', { name: 'Desativar' })
    expect(from).toHaveBeenCalledWith('financial_accounts')
    expect(from).toHaveBeenCalledWith('funds')
    expect(from).toHaveBeenCalledWith('payment_methods')
    expect(screen.getAllByText('Nenhum registro encontrado nesta Loja.')).toHaveLength(2)
  })
  it('creates a fund through the authorized, audited and idempotent RPC', async () => {
    const { client, rpc } = fixture()
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByLabelText('Tipo de cadastro')
    fireEvent.change(screen.getByLabelText('Tipo de cadastro'), { target: { value: 'fund' } })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Fundo social' } })
    fireEvent.change(screen.getByLabelText('Finalidade do fundo (opcional)'), { target: { value: 'Apoio a membros' } })
    fireEvent.change(screen.getByLabelText('Motivo do cadastro'), { target: { value: 'Aprovado em reunião' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar item de tesouraria' }))
    await screen.findByText('Alteração confirmada. Os cadastros foram atualizados.')
    expect(rpc).toHaveBeenCalledWith('create_treasury_catalog_item', expect.objectContaining({
      p_organization_id: 'org', p_kind: 'fund', p_name: 'Fundo social',
      p_description: 'Apoio a membros', p_account_type: null, p_institution: null,
      p_identification: null, p_reason: 'Aprovado em reunião',
    }))
  })
  it('denies activation of an inactive financial account without chart coverage', async () => {
    const { client, rpc } = fixture(false, false)
    rpc.mockResolvedValueOnce({data:null,error:{code:'23514'}})
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByRole('button',{name:'Ativar'})
    fireEvent.change(screen.getByLabelText('Motivo para ativar ou desativar um cadastro'),{
      target:{value:'Solicitar ativação da conta'},
    })
    fireEvent.click(screen.getByRole('button',{name:'Ativar'}))
    await screen.findByText(/A conta financeira só pode ser ativada/)
    expect(rpc).toHaveBeenCalledWith('set_treasury_catalog_status',expect.objectContaining({
      p_kind:'account',p_expected_active:false,p_new_active:true,
    }))
    expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
  })
  it('resubmits the exact same status command after ambiguous network failure', async () => {
    const { client, rpc } = fixture()
    rpc.mockRejectedValueOnce(new Error('network'))
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByRole('button', { name: 'Desativar' })
    fireEvent.change(screen.getByLabelText('Motivo para ativar ou desativar um cadastro'), { target: { value: 'Conta encerrada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await screen.findByRole('button', { name: 'Verificar envio' })
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar envio' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
    expect(rpc.mock.calls[0]).toEqual(['set_treasury_catalog_status', expect.objectContaining({
      p_organization_id: 'org', p_kind: 'account', p_item_id: id,
      p_expected_active: true, p_new_active: false, p_reason: 'Conta encerrada',
    })])
  })
  it('requires a reason for a status change before contacting the database', async () => {
    const { client, rpc } = fixture()
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByRole('button', { name: 'Desativar' })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o motivo')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires refresh after an optimistic status version conflict', async () => {
    const { client, rpc } = fixture()
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } })
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByRole('button', { name: 'Desativar' })
    fireEvent.change(screen.getByLabelText('Motivo para ativar ou desativar um cadastro'), { target: { value: 'Fim de uso da conta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }))
    await screen.findByText('A situação do cadastro mudou. Atualize os dados antes de alterar novamente.')
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar cadastros' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desativar' })).not.toBeDisabled())
  })
  it('fails closed when the data API returns an item outside the current tenant', async () => {
    const { client, rpc } = fixture(true)
    render(<TreasuryCatalogs client={client} organizationId="org" />)
    await screen.findByText('Não foi possível carregar contas, fundos e formas de pagamento.')
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
})
