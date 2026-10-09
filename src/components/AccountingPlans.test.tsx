import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { AccountingPlans } from './AccountingPlans'
import { endOfMonth } from '../lib/accounting-plans'
const uuid='faaf76e4-d796-430f-929f-71df5beaf832'
const plan='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const cat='dc24feaf-e897-483b-9c47-3b242289a40f'
const revenue='24162417-2416-4416-8416-241624162416'
function mock(mode:'draft'|'published'|'none'|'foreign'='draft'){
 const rows:Record<string,unknown[]>={
  accounting_plans:mode==='none'?[]:[{id:plan,organization_id:mode==='foreign'?'foreign':'org',name:'Plano 2032',status:mode==='published'?'published':'draft',valid_from:'2032-01-01',valid_to:'2032-12-31'}],
  accounting_plan_templates:[{id:uuid,name:'Plano padrão Corsys',version:1,active:true}],
  financial_categories:[{id:cat,organization_id:'org',name:'Mensalidade',domain:'member_receivable',active:true}],
  financial_accounts:[{id:uuid,organization_id:'org',name:'Banco',active:true}],
  accounting_accounts:[{id:revenue,organization_id:'org',accounting_plan_id:plan,code:'1.1',description:'Receita mensalidade',row_type:'analytic',nature:'revenue',active:true,parent_account_id:null}],
  financial_category_account_mappings:[],financial_account_accounting_mappings:[],
 }
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,abortSignal:()=>Promise.resolve({data:rows[table],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:uuid,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,from}
}
describe('Accounting plan draft UI',()=>{
 it('calculates February end in leap and ordinary years',()=>{
  expect(endOfMonth('2032-02')).toBe('2032-02-29')
  expect(endOfMonth('2031-02')).toBe('2031-02-28')
  expect(()=>endOfMonth('2032-13')).toThrow()
 })
 it('creates only a draft from the 91-account template with first/last dates',async()=>{
  const {client,rpc}=mock()
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByLabelText('Nome do plano')
  fireEvent.change(screen.getByLabelText('Nome do plano'),{target:{value:'Plano 2033'}})
  fireEvent.change(screen.getByLabelText('Mês inicial futuro'),{target:{value:'2033-01'}})
  fireEvent.change(screen.getByLabelText('Mês final'),{target:{value:'2033-12'}})
  fireEvent.change(screen.getByLabelText('Modelo contábil'),{target:{value:uuid}})
  fireEvent.change(screen.getByLabelText('Motivo do rascunho'),{target:{value:'Novo plano anual'}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho contábil'}))
  await screen.findByText('Plano ou vínculo salvo. Histórico atualizado.')
  expect(rpc).toHaveBeenCalledWith('create_tenant_accounting_draft',expect.objectContaining({
   p_organization_id:'org',p_source_kind:'template',p_source_id:uuid,
   p_valid_from:'2033-01-01',p_valid_to:'2033-12-31',
  }))
  expect(rpc).not.toHaveBeenCalledWith('publish_accounting_plan',expect.anything())
 })
 it('creates a category mapping with no existing account expected',async()=>{
  const {client,rpc}=mock()
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByLabelText('Cadastro da Loja')
  fireEvent.change(screen.getByLabelText('Cadastro da Loja'),{target:{value:cat}})
  fireEvent.change(screen.getByLabelText('Conta contábil analítica compatível'),{target:{value:revenue}})
  fireEvent.change(screen.getByLabelText('Motivo do vínculo'),{target:{value:'Classificar mensalidade'}})
  fireEvent.submit(screen.getByRole('form',{name:'Configurar vínculo contábil'}))
  await screen.findByText('Plano ou vínculo salvo. Histórico atualizado.')
  expect(rpc).toHaveBeenCalledWith('set_draft_accounting_mapping',expect.objectContaining({
   p_organization_id:'org',p_accounting_plan_id:plan,p_kind:'category',
   p_source_id:cat,p_accounting_account_id:revenue,p_expected_account_id:null,
  }))
 })
 it('keeps published plans strictly read only',async()=>{
  const {client,rpc}=mock('published')
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByText(/Plano publicado — somente leitura/)
  expect(screen.queryByRole('form',{name:'Configurar vínculo contábil'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('rejects a foreign plan even if the API returns it',async()=>{
  const {client,rpc}=mock('foreign')
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível carregar planos e catálogos contábeis.')
  expect(screen.queryByLabelText('Cadastro da Loja')).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('resends uncertain draft creation using the same key and payload',async()=>{
  const {client,rpc}=mock('none')
  rpc.mockRejectedValueOnce(new Error('network'))
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByLabelText('Nome do plano')
  fireEvent.change(screen.getByLabelText('Nome do plano'),{target:{value:'Plano 2033'}})
  fireEvent.change(screen.getByLabelText('Mês inicial futuro'),{target:{value:'2033-01'}})
  fireEvent.change(screen.getByLabelText('Mês final'),{target:{value:'2033-12'}})
  fireEvent.change(screen.getByLabelText('Modelo contábil'),{target:{value:uuid}})
  fireEvent.change(screen.getByLabelText('Motivo do rascunho'),{target:{value:'Plano anual'}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho contábil'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  expect(screen.getByRole('button',{name:'Criar rascunho'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('blocks stale mapping and requires refresh before further edits',async()=>{
  const {client,rpc}=mock()
  rpc.mockResolvedValueOnce({data:null,error:{code:'40001'}})
  render(<AccountingPlans client={client} organizationId="org"/>)
  await screen.findByLabelText('Cadastro da Loja')
  fireEvent.change(screen.getByLabelText('Cadastro da Loja'),{target:{value:cat}})
  fireEvent.change(screen.getByLabelText('Conta contábil analítica compatível'),{target:{value:revenue}})
  fireEvent.change(screen.getByLabelText('Motivo do vínculo'),{target:{value:'Mudança contábil'}})
  fireEvent.submit(screen.getByRole('form',{name:'Configurar vínculo contábil'}))
  await screen.findByText('O vínculo mudou. Atualize os planos antes de tentar novamente.')
  expect(screen.getByRole('button',{name:'Salvar vínculo'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Atualizar planos'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Criar rascunho'})).not.toBeDisabled())
 })
})
