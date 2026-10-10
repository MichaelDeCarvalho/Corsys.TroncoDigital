import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterOnboarding} from './MasterOnboarding'
import {validateOnboardingDraft} from '../lib/master-onboarding'
const plan='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const created='faaf76e4-d796-430f-929f-71df5beaf832'
const published={id:plan,plan_id:created,status:'published',price:'125.00',currency:'BRL',billing_interval:'monthly',valid_from:'2026-09-01',valid_to:null,display_name_snapshot:'Essencial',version_number:1}
function fixture(foreign=false){
 const rows:Record<string,unknown[]>={
  saas_onboarding_runs:foreign?[{id:'invalid',organization_id:null,status:'draft',current_step:'commercial'}]:[],
  saas_plan_versions:[published],
 }
 const from=vi.fn((name:string)=>{
  const chain={select:()=>chain,order:()=>chain,eq:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:rows[name],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:created,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
function fill(){
 fireEvent.change(screen.getByLabelText('Nome da Loja'),{target:{value:'Loja Aurora do Sul'}})
 fireEvent.change(screen.getByLabelText('Número da Loja'),{target:{value:'101'}})
 fireEvent.change(screen.getByLabelText('Responsável inicial'),{target:{value:'Administrador Teste'}})
 fireEvent.change(screen.getByLabelText('E-mail do administrador'),{target:{value:'admin@example.test'}})
 fireEvent.change(screen.getByLabelText('E-mail financeiro'),{target:{value:'financeiro@example.test'}})
 fireEvent.change(screen.getByLabelText('E-mail previsto para convite'),{target:{value:'convite@example.test'}})
 fireEvent.change(screen.getByLabelText('Identificador público sugerido'),{target:{value:'loja-aurora-101'}})
 fireEvent.change(screen.getByLabelText('Versão comercial publicada'),{target:{value:plan}})
 fireEvent.change(screen.getByLabelText('Valor contratado (R$)'),{target:{value:'125.00'}})
 fireEvent.change(screen.getByLabelText('Início da assinatura'),{target:{value:'2026-11-01'}})
 fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo que os dados são de proposta/}))
}
describe('Master onboarding draft only',()=>{
 it('does not call tenant provisioner, invitation service or billing provider',async()=>{
  const {client,rpc}=fixture()
  render(<MasterOnboarding client={client}/>)
  await screen.findByLabelText('Nome da Loja')
  fill()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de implantação'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('save_saas_onboarding_draft',expect.objectContaining({
   p_run_id:null,p_prospective_name:'Loja Aurora do Sul',p_organization_number:'101',
   p_plan_version_id:plan,p_contract_price:'125.00',p_tenant_slug:'loja-aurora-101',
   p_idempotency_key:expect.any(String),p_terms_acceptance_required:true,
  })))
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc.mock.calls[0][0]).not.toBe('provision_saas_onboarding_database')
 })
 it('keeps a network retry identical and idempotent',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(Error('network'))
  render(<MasterOnboarding client={client}/>)
  await screen.findByLabelText('Nome da Loja')
  fill()
  fireEvent.submit(screen.getByRole('form',{name:'Criar rascunho de implantação'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
 })
 it('rejects malformed onboarding list before showing form',async()=>{
  const {client,rpc}=fixture(true)
  render(<MasterOnboarding client={client}/>)
  await screen.findByText('Não foi possível consultar os rascunhos Master ou os planos publicados.')
  expect(screen.queryByRole('form',{name:'Criar rascunho de implantação'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('rejects draft starting before published version or missing tenant identification',()=>{
  const source={
   name:'Aurora do Sul',number:'101',adminName:'Administrador Teste',
   adminEmail:'admin@example.test',billingEmail:'billing@example.test',
   planId:plan,price:'125.00',start:'2026-08-01',trialDays:0,
   city:'Curitiba',state:'PR',tenantSlug:'aurora-101',inviteEmail:'invite@example.test',
  }
  expect(()=>validateOnboardingDraft(source,[published])).toThrow()
  expect(()=>validateOnboardingDraft({...source,start:'2026-11-01',tenantSlug:'INVALID SLUG'},[published])).toThrow()
 })
})
