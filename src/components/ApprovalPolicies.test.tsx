import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {ApprovalPolicies} from './ApprovalPolicies'
const id='faaf76e4-d796-430f-929f-71df5beaf832'
function fixture(edited=false,foreign=false){
 const data=edited?[{id,organization_id:foreign?'other':'org',name:'Regra 2028',mode:'threshold',
 threshold_amount:'100.00',minimum_approvers:2,status:'draft',valid_from:'2028-01-01',valid_to:'2028-12-31'}]:[]
 const from=vi.fn(()=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data,error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
async function populate(){
 await screen.findByLabelText('Nome da política')
 fireEvent.change(screen.getByLabelText('Nome da política'),{target:{value:'Nova política teste'}})
 fireEvent.change(screen.getByLabelText('Quando exigir aprovação'),{target:{value:'threshold'}})
 fireEvent.change(screen.getByLabelText('Limite da despesa (R$)'),{target:{value:'100,00'}})
 fireEvent.change(screen.getByLabelText('Número mínimo de aprovadores'),{target:{value:'2'}})
 fireEvent.change(screen.getByLabelText('Vigência inicial'),{target:{value:'2028-01-01'}})
 fireEvent.change(screen.getByLabelText('Vigência final'),{target:{value:'2028-12-31'}})
 fireEvent.change(screen.getByLabelText('Justificativa'),{target:{value:'Alçada de aprovação'}})
}
describe('Expense approval policy lifecycle',()=>{
 it('creates a future-dated threshold draft, not a published policy',async()=>{
  const {client,rpc}=fixture()
  render(<ApprovalPolicies client={client} organizationId="org"/>)
  await populate()
  fireEvent.submit(screen.getByRole('form',{name:'Criar política de aprovação'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('create_tenant_approval_policy_draft',expect.objectContaining({
   p_organization_id:'org',p_mode:'threshold',p_threshold_amount:'100.00',
   p_minimum_approvers:2,p_valid_from:'2028-01-01',p_valid_to:'2028-12-31',
   p_idempotency_key:expect.any(String),
  })))
  expect(rpc).not.toHaveBeenCalledWith('publish_tenant_approval_policy_idempotent',expect.anything())
 })
 it('requires explicit typed publication confirmation',async()=>{
  const {client,rpc}=fixture(true)
  render(<ApprovalPolicies client={client} organizationId="org"/>)
  await screen.findByLabelText('Rascunho para publicar')
  fireEvent.change(screen.getByLabelText('Rascunho para publicar'),{target:{value:id}})
  expect(screen.getByRole('button',{name:'Publicar política'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Motivo da publicação'),{target:{value:'Publicação aprovada'}})
  fireEvent.change(screen.getByLabelText('Digite PUBLICAR'),{target:{value:'PUBLICAR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Publicar política de aprovação'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('publish_tenant_approval_policy_idempotent',{
   p_organization_id:'org',p_policy_id:id,p_reason:'Publicação aprovada',
   p_idempotency_key:expect.any(String),
  }))
 })
 it('retries identical request after a network failure',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(Error('network'))
  render(<ApprovalPolicies client={client} organizationId="org"/>)
  await populate()
  fireEvent.submit(screen.getByRole('form',{name:'Criar política de aprovação'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
 })
 it('hides all finance policy data if a row belongs to another tenant',async()=>{
  const {client,rpc}=fixture(true,true)
  render(<ApprovalPolicies client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível conferir as políticas financeiras desta Loja.')
  expect(screen.queryByRole('form',{name:'Criar política de aprovação'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
})
