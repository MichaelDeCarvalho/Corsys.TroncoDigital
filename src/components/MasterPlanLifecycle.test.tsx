import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterPlanLifecycle} from './MasterPlanLifecycle'
const draft='faaf76e4-d796-430f-929f-71df5beaf832'
const plan='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const row={
 plan_id:plan,plan_active:true,plan_version_id:draft,version_number:1,
 display_name_snapshot:'DEV Nova Loja',internal_code_snapshot:'dev-basic',
 price:'125.00',currency:'BRL',billing_interval:'monthly',
 trial_days:0,grace_days:7,valid_from:'2027-01-01',valid_to:null,
 publication_status:'draft',admin_status:'draft',can_delete_plan:true,delete_block_reason:null,
}
function fixture(){
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:table==='v_saas_plan_version_admin'?[row]:[],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:draft,error:null})
 return {client:{rpc,from} as unknown as SupabaseClient,rpc}
}
function fillNew(){
 fireEvent.change(screen.getByLabelText('Código interno'),{target:{value:'devplan2027'}})
 fireEvent.change(screen.getByLabelText('Nome comercial'),{target:{value:'Plano DEV 2027'}})
 fireEvent.change(screen.getByLabelText('Preço (R$)'),{target:{value:'125,50'}})
 fireEvent.change(screen.getByLabelText('Competência inicial'),{target:{value:'2027-02'}})
}
describe('Master plan version lifecycle',()=>{
 it('creates a draft with exact price, separate idempotency key, without publishing',async()=>{
  const {client,rpc}=fixture()
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Código interno')
  fillNew()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho SaaS'}))
  await screen.findByText('Rascunho comercial confirmado. Ainda não está publicado.')
  expect(rpc).toHaveBeenCalledWith('create_master_plan_draft_idempotent',
   expect.objectContaining({
    p_code:'devplan2027',p_name:'Plano DEV 2027',p_price:'125.50',
    p_billing_interval:'monthly',p_valid_from:'2027-02-01',
    p_entitlements:{},p_idempotency_key:expect.any(String),
   }))
  expect(rpc).not.toHaveBeenCalledWith('publish_master_plan_draft_idempotent',expect.anything())
 })
 it('requires explicit typed publication confirmation before invoking Master publication',async()=>{
  const {client,rpc}=fixture()
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Versão em rascunho')
  fireEvent.change(screen.getByLabelText('Versão em rascunho'),{target:{value:draft}})
  expect(screen.getByRole('button',{name:'Publicar versão comercial'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Para confirmar, digite PUBLICAR'),{target:{value:'PUBLICAR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Publicar plano SaaS'}))
  await screen.findByText('Versão comercial publicada com confirmação no banco. Consulte o histórico.')
  expect(rpc).toHaveBeenCalledWith('publish_master_plan_draft_idempotent',{
   p_plan_version_id:draft,p_idempotency_key:expect.any(String),
  })
 })
 it('does not create duplicate plan drafts after an uncertain network result',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('lost response'))
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Código interno')
  fillNew()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho SaaS'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('fails closed for invalid JSON entitlements',async()=>{
  const {client,rpc}=fixture()
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Código interno')
  fillNew()
  fireEvent.change(screen.getByLabelText('Recursos do plano (JSON)'),{target:{value:'INVALID'}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho SaaS'}))
  await screen.findByRole('alert')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('reports denied MASTER/AAL2 credentials without retrying a deterministic authorization error',async()=>{
  const {client,rpc}=fixture()
  rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}})
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Código interno')
  fillNew()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho SaaS'}))
  await screen.findByText('A operação exige perfil MASTER da plataforma e MFA ativo.')
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
})
