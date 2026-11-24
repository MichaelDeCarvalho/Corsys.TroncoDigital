import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterPlanLifecycle} from './MasterPlanLifecycle'
import type {PlatformPlanVersion} from '../lib/master-commercial'
const draft='faaf76e4-d796-430f-929f-71df5beaf832'
const plan='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const publishedVersion='11111111-1111-4111-8111-111111111111'
const row:PlatformPlanVersion={
 plan_id:plan,plan_active:true,plan_version_id:draft,version_number:1,
 display_name_snapshot:'DEV Nova Loja',internal_code_snapshot:'dev-basic',
 price:'125.00',currency:'BRL',billing_interval:'monthly',
 trial_days:0,grace_days:7,valid_from:'2027-01-01',valid_to:null,
 publication_status:'draft',admin_status:'draft',can_delete_plan:true,delete_block_reason:null,
}
const publishedRow:PlatformPlanVersion={
 ...row,
 plan_version_id:publishedVersion,
 version_number:1,
 publication_status:'published',
 admin_status:'current',
 can_delete_plan:false,
 delete_block_reason:'published_version_exists',
}
function fixture(opts:{
 plans?:typeof row[]
 entitlements?:Array<{plan_version_id:string;entitlement_key:string;entitlement_value:unknown}>
 entitlementError?:unknown
 rpcResult?:unknown
}={}) {
 const from=vi.fn((table:string)=>{
  const chain={
   select:()=>chain,
   eq:()=>chain,
   order:()=>chain,
   limit:()=>chain,
   abortSignal:()=>Promise.resolve(
    table==='saas_plan_version_entitlements'
     ?{data:opts.entitlementError?null:(opts.entitlements??[]),error:opts.entitlementError??null}
     :{data:table==='v_saas_plan_version_admin'?(opts.plans??[row]):[],error:null},
   ),
  }
  return chain
 })
 const rpc=vi.fn().mockResolvedValue(opts.rpcResult??{data:draft,error:null})
 return {client:{rpc,from} as unknown as SupabaseClient,rpc,from}
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
 it('creates a successor draft version on an existing plan and never offers blind retry after uncertain transport',async()=>{
  const onCatalogChange=vi.fn()
  const {client,rpc}=fixture({
   plans:[publishedRow],
   entitlements:[{plan_version_id:publishedVersion,entitlement_key:'members_max',entitlement_value:200}],
  })
  render(<MasterPlanLifecycle client={client} onCatalogChange={onCatalogChange}/>)
  await screen.findByLabelText('Plano base para nova versão')
  fireEvent.change(screen.getByLabelText('Plano base para nova versão'),{target:{value:plan}})
  await waitFor(()=>expect(screen.getByLabelText('Novos recursos do plano (JSON)')).toHaveValue('{\n  "members_max": 200\n}'))
  fireEvent.change(screen.getByLabelText('Novo preço (R$)'),{target:{value:'199,90'}})
  fireEvent.change(screen.getByLabelText('Nova periodicidade'),{target:{value:'yearly'}})
  fireEvent.change(screen.getByLabelText('Novos dias de teste'),{target:{value:'14'}})
  fireEvent.change(screen.getByLabelText('Novos dias de tolerância'),{target:{value:'5'}})
  fireEvent.change(screen.getByLabelText('Nova competência inicial'),{target:{value:'2027-06'}})
  fireEvent.change(screen.getByLabelText('Novos recursos do plano (JSON)'),{target:{value:'{"members_max":300}'}})
  fireEvent.submit(screen.getByRole('form',{name:'Criar versão sucessora de plano'}))
  await screen.findByText('Nova versão sucessora salva em rascunho. Ainda não está publicada.')
  expect(rpc).toHaveBeenCalledWith('create_saas_plan_successor_draft',{
   p_plan_id:plan,p_price:'199.90',p_billing_interval:'yearly',
   p_trial_days:14,p_grace_days:5,p_valid_from:'2027-06-01',
   p_entitlements:{members_max:300},
  })
  expect(onCatalogChange).toHaveBeenCalledTimes(1)

  rpc.mockRejectedValueOnce(new Error('network drop'))
  await screen.findByLabelText('Plano base para nova versão')
  fireEvent.change(screen.getByLabelText('Plano base para nova versão'),{target:{value:plan}})
  await waitFor(()=>expect(screen.getByLabelText('Novos recursos do plano (JSON)')).toHaveValue('{\n  "members_max": 200\n}'))
  fireEvent.submit(screen.getByRole('form',{name:'Criar versão sucessora de plano'}))
  await screen.findByText(/Atualize os rascunhos antes de tentar novamente para evitar duplicidade/)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
 it('loads entitlements and updates an existing draft version, failing closed when entitlements fail to load',async()=>{
  const failFixture=fixture({entitlementError:{code:'50000'}})
  const {unmount}=render(<MasterPlanLifecycle client={failFixture.client}/>)
  await screen.findByLabelText('Rascunho de plano para editar')
  fireEvent.change(screen.getByLabelText('Rascunho de plano para editar'),{target:{value:draft}})
  await screen.findByText('Não foi possível carregar os recursos do rascunho selecionado.')
  expect(screen.getByRole('button',{name:'Salvar alterações do rascunho'})).toBeDisabled()
  unmount()

  const onCatalogChange=vi.fn()
  const okFixture=fixture({
   entitlements:[{plan_version_id:draft,entitlement_key:'members_max',entitlement_value:150}],
  })
  render(<MasterPlanLifecycle client={okFixture.client} onCatalogChange={onCatalogChange}/>)
  await screen.findByLabelText('Rascunho de plano para editar')
  fireEvent.change(screen.getByLabelText('Rascunho de plano para editar'),{target:{value:draft}})
  await waitFor(()=>expect(screen.getByLabelText('Recursos do rascunho (JSON)')).toHaveValue('{\n  "members_max": 150\n}'))
  fireEvent.change(screen.getByLabelText('Nome comercial do rascunho'),{target:{value:'DEV Atualizado'}})
  fireEvent.change(screen.getByLabelText('Código interno do rascunho'),{target:{value:'dev-updated'}})
  fireEvent.change(screen.getByLabelText('Preço do rascunho (R$)'),{target:{value:'140,00'}})
  fireEvent.change(screen.getByLabelText('Competência inicial do rascunho'),{target:{value:'2027-04'}})
  fireEvent.change(screen.getByLabelText('Recursos do rascunho (JSON)'),{target:{value:'{"members_max":250}'}})
  fireEvent.submit(screen.getByRole('form',{name:'Editar rascunho de plano'}))
  await screen.findByText('Alterações no rascunho de plano confirmadas. Ainda não está publicado.')
  expect(okFixture.rpc).toHaveBeenCalledWith('update_saas_plan_version_draft',{
   p_plan_version_id:draft,p_name:'DEV Atualizado',p_code:'dev-updated',p_price:'140.00',
   p_billing_interval:'monthly',p_trial_days:0,p_grace_days:7,p_valid_from:'2027-04-01',
   p_entitlements:{members_max:250},
  })
  expect(onCatalogChange).toHaveBeenCalledTimes(1)
 })
 it('requires reason to deactivate/reactivate a plan and enforces link guard + EXCLUIR to delete unused plan',async()=>{
  const blocked=fixture({plans:[publishedRow]})
  const {unmount}=render(<MasterPlanLifecycle client={blocked.client}/>)
  await screen.findByLabelText('Plano para ativação ou exclusão')
  fireEvent.change(screen.getByLabelText('Plano para ativação ou exclusão'),{target:{value:plan}})
  expect(screen.getByText('Exclusão bloqueada: possui versão publicada')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Desativar plano'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Motivo da alteração do plano'),{target:{value:'Plano descontinuado'}})
  fireEvent.change(screen.getByLabelText('Para excluir plano sem vínculos, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  expect(screen.getByRole('button',{name:'Excluir plano sem vínculos'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Desativar plano'}))
  await screen.findByText('Plano desativado com confirmação. Assinaturas e histórico publicados foram preservados.')
  expect(blocked.rpc).toHaveBeenCalledWith('set_saas_plan_active',{
   p_plan_id:plan,p_active:false,p_reason:'Plano descontinuado',
  })
  unmount()

  const unused=fixture({plans:[row],rpcResult:{data:true,error:null}})
  render(<MasterPlanLifecycle client={unused.client}/>)
  await screen.findByLabelText('Plano para ativação ou exclusão')
  fireEvent.change(screen.getByLabelText('Plano para ativação ou exclusão'),{target:{value:plan}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração do plano'),{target:{value:'Rascunho criado por engano'}})
  fireEvent.change(screen.getByLabelText('Para excluir plano sem vínculos, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  expect(screen.getByRole('button',{name:'Excluir plano sem vínculos'})).not.toBeDisabled()
  fireEvent.submit(screen.getByRole('form',{name:'Gerenciar ciclo do plano'}))
  await screen.findByText('Plano sem vínculos excluído com registro de auditoria.')
  expect(unused.rpc).toHaveBeenCalledWith('delete_saas_plan_if_unused',{
   p_plan_id:plan,p_reason:'Rascunho criado por engano',
  })
 })
 it('handles SQLSTATE 55000 delete rejection deterministically without retry',async()=>{
  const {client,rpc}=fixture({plans:[row],rpcResult:{data:null,error:{code:'55000'}}})
  render(<MasterPlanLifecycle client={client}/>)
  await screen.findByLabelText('Plano para ativação ou exclusão')
  fireEvent.change(screen.getByLabelText('Plano para ativação ou exclusão'),{target:{value:plan}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração do plano'),{target:{value:'Teste exclusão concorrente'}})
  fireEvent.change(screen.getByLabelText('Para excluir plano sem vínculos, digite EXCLUIR'),{target:{value:'EXCLUIR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Gerenciar ciclo do plano'}))
  await screen.findByText('O banco bloqueou a exclusão porque o plano possui vínculos publicados ou ativos; desative o plano em vez de excluir.')
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
})
