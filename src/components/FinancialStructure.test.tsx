import { fireEvent, render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FinancialStructure } from './FinancialStructure'

const uuid = 'faaf76e4-d796-430f-929f-71df5beaf832'
function mock(eligible = true, foreignPrice = false) {
  const records: Record<string, unknown[]> = {
    financial_categories: [{ id: 'category', organization_id: 'org', name: 'Mensalidade', domain: 'member_receivable', active: true, allow_recurrence: eligible, allow_installments: false }],
    recurring_rules: eligible ? [{ id: 'rule', organization_id: 'org', category_id: 'category', name: 'Mensalidade padrão', frequency: 'monthly', due_day: 10, active: true }] : [],
    recurring_rule_versions: [{ id: 'version', recurring_rule_id: foreignPrice ? 'other-rule' : 'rule', unit_amount: '150.25', valid_from_competence: '2030-01-01', valid_to_competence: null }],
  }
  const from = vi.fn((table: string) => {
    const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, abortSignal: () => Promise.resolve({ data: records[table], error: null }) }
    return chain
  })
  const rpc = vi.fn().mockResolvedValue({ data: uuid, error: null })
  return { client: { from, rpc } as unknown as SupabaseClient, rpc, from }
}
function fill(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
describe('Financial structure', () => {
  it('creates an eligible category through the authorized RPC and confirms after response', async () => {
    const { client, rpc } = mock(false)
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByLabelText('Nome da categoria')
    fill('Nome da categoria', 'GLP'); fill('Motivo da nova categoria', 'Nova categoria')
    fireEvent.click(screen.getByLabelText('Permitir recorrência para integrantes'))
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar categoria financeira' }))
    await screen.findByText('Configuração salva. Os dados foram atualizados.')
    expect(rpc).toHaveBeenCalledWith('create_tenant_financial_category', expect.objectContaining({ p_organization_id: 'org', p_name: 'GLP', p_domain: 'member_receivable', p_active: false, p_allow_recurrence: true }))
  })
  it('treats published-plan coverage failure as a definitive rejection, not an ambiguous retry', async () => {
    const { client, rpc } = mock()
    rpc.mockResolvedValueOnce({data:null,error:{code:'23514'}})
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByLabelText('Nome da categoria')
    fill('Nome da categoria','Receita extraordinária')
    fill('Status','true')
    fill('Motivo da nova categoria','Precisa de plano sucessor')
    fireEvent.submit(screen.getByRole('form', { name:'Cadastrar categoria financeira' }))
    await screen.findByText(/Uma categoria ativa precisa estar mapeada/)
    expect(screen.queryByRole('button', { name:'Verificar envio' })).not.toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('create_tenant_financial_category',expect.objectContaining({p_active:true}))
  })
  it('sends a decimal string and first-of-month competence when creating a monthly rule', async () => {
    const { client, rpc } = mock()
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByLabelText('Descrição da regra')
    fill('Descrição da regra', 'Mensalidade 2030'); fill('Valor geral (R$)', '125,50'); fill('Competência inicial futura', '2030-01'); fill('Motivo da nova regra', 'Nova regra')
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar regra mensal' }))
    await screen.findByText('Configuração salva. Os dados foram atualizados.')
    expect(rpc).toHaveBeenCalledWith('create_tenant_monthly_rule', expect.objectContaining({ p_category_id: 'category', p_unit_amount: '125.50', p_valid_from: '2030-01-01', p_due_day: 10 }))
  })
  it('retries a price with the same key/payload after ambiguous failure and requires reload after a stale version', async () => {
    const { client, rpc } = mock()
    rpc.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: null, error: { code: '40001' } })
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByLabelText('Regra para novo preço')
    fill('Regra para novo preço', 'rule'); fill('Novo valor geral (R$)', '180,50'); fill('Nova competência futura', '2030-03'); fill('Motivo do novo preço', 'Atualizar preço')
    fireEvent.submit(screen.getByRole('form', { name: 'Programar novo preço' }))
    await screen.findByRole('button', { name: 'Verificar envio' })
    expect(screen.getByLabelText('Novo valor geral (R$)')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar envio' }))
    await screen.findByText('A vigência foi alterada por outra operação. Atualize os dados antes de programar outro preço.')
    expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
    expect(rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ p_expected_version_id: 'version', p_unit_amount: '180.50', p_valid_from: '2030-03-01' }))
    expect(screen.getByRole('button', { name: 'Programar preço' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar estrutura' }))
    await screen.findByLabelText('Novo valor geral (R$)')
    expect(screen.getByLabelText('Novo valor geral (R$)')).not.toBeDisabled()
  })
  it('does not offer a rule before an eligible category exists', async () => {
    const { client, rpc, from } = mock(false)
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByText('Cadastre uma categoria ativa de integrantes com recorrência permitida para criar a regra mensal.')
    expect(screen.queryByRole('button', { name: 'Cadastrar regra mensal' })).not.toBeInTheDocument()
    expect(from).not.toHaveBeenCalledWith('recurring_rule_versions')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects a price returned outside the selected tenant rules', async () => {
    const { client } = mock(true, true)
    render(<FinancialStructure client={client} organizationId="org" />)
    await screen.findByText('Não foi possível carregar a estrutura financeira.')
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument()
  })
})
