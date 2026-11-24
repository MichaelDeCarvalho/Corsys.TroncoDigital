import {fireEvent,render,screen,within} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterCommercialCatalog} from './MasterCommercialCatalog'
import {loadPlatformCommercialCatalog,type PlatformPlanVersion} from '../lib/master-commercial'
const plan:PlatformPlanVersion={
 plan_id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',
 plan_active:true,
 plan_version_id:'559ba052-c408-4418-b806-0c0c4b8e3603',
 version_number:1,display_name_snapshot:'Plano ESSENCIAL',
 internal_code_snapshot:'ESSENCIAL',price:'125.00',currency:'BRL',
 billing_interval:'monthly',trial_days:0,grace_days:7,valid_from:'2026-10-01',
 valid_to:null,publication_status:'published',admin_status:'current',
 can_delete_plan:false,delete_block_reason:'published',
}
const promo={
 promotion_series_id:'b112d600-bf1a-4bfd-bc1c-e9e9b749b539',
 latest_promotion_id:'faaf76e4-d796-430f-929f-71df5beaf832',
 version_number:1,name:'Oferta TESTE',public_code:'DEV',
 active:true,latest_version_status:'published',valid_from:null,valid_to:null,
 redemption_count:0,can_delete:false,delete_block_reason:'used',
}
function fixture(opts:{deny?:boolean;brokenPrice?:boolean;duplicate?:boolean;planRows?:PlatformPlanVersion[]}={}){
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:table==='v_saas_plan_version_admin'?
     (opts.planRows??(opts.duplicate?[plan,plan]:[{...plan,price:opts.brokenPrice?'NaN':'125.00'}])):
     [promo],error:opts.deny?{code:'42501'}:null})}
  return chain
 })
 return {client:{from} as unknown as SupabaseClient,from}
}
describe('Master commercial version history',()=>{
 it('shows historical SaaS prices and promotion series without altering subscriptions',async()=>{
  const {client,from}=fixture()
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano ESSENCIAL')
  expect(screen.getByText('Oferta TESTE')).toBeInTheDocument()
  expect(screen.getByText(/R\$\s?125,00/)).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith('v_saas_plan_version_admin')
  expect(from).toHaveBeenCalledWith('v_saas_promotion_series_admin')
 })

 it('matches the V35 pilot history filters for starting date, status, count and reset',async()=>{
  const planRows=[
   {...plan,plan_version_id:'11111111-1111-4111-8111-111111111111',display_name_snapshot:'Plano Histórico',valid_from:'2026-08-01',admin_status:'historical'},
   {...plan,plan_version_id:'22222222-2222-4222-8222-222222222222',display_name_snapshot:'Plano Futuro',valid_from:'2026-12-01',admin_status:'future'},
   {...plan,plan_version_id:'33333333-3333-4333-8333-333333333333',display_name_snapshot:'Plano Desativado',valid_from:'2026-09-01',admin_status:'historical',plan_active:false},
  ]
  const {client}=fixture({planRows})
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano Futuro')
  expect(screen.getByText('Exibindo 3 de 3 versão(ões).')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Vigência a partir de'),{target:{value:'2026-12-01'}})
  fireEvent.change(screen.getByLabelText('Vigência até'),{target:{value:'2026-12-01'}})
  fireEvent.change(screen.getByLabelText('Status do plano'),{target:{value:'future'}})
  expect(screen.getByText('Exibindo 1 de 3 versão(ões).')).toBeInTheDocument()
  expect(screen.getByText('Plano Futuro')).toBeInTheDocument()
  expect(screen.queryByText('Plano Histórico')).not.toBeInTheDocument()
  expect(screen.queryByText('Plano Desativado')).not.toBeInTheDocument()
  expect(screen.getByText('Oferta TESTE')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Status do plano'),{target:{value:'inactive'}})
  expect(screen.getByText('Nenhuma versão corresponde aos filtros selecionados.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}))
  expect(screen.getByLabelText('Vigência a partir de')).toHaveValue('')
  expect(screen.getByLabelText('Vigência até')).toHaveValue('')
  expect(screen.getByLabelText('Status do plano')).toHaveValue('all')
  expect(screen.getByText('Exibindo 3 de 3 versão(ões).')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Status do plano'),{target:{value:'inactive'}})
  expect(screen.getByText('Plano Desativado')).toBeInTheDocument()
  expect(screen.queryByText('Plano Futuro')).not.toBeInTheDocument()
 })
 it('does not publish plans or access other domains when filtering the read-only catalog',async()=>{
  const {client,from}=fixture()
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano ESSENCIAL')
  fireEvent.change(screen.getByLabelText('Status do plano'),{target:{value:'draft'}})
  expect(screen.getByText('Exibindo 0 de 1 versão(ões).')).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith('v_saas_plan_version_admin')
  expect(from).toHaveBeenCalledWith('v_saas_promotion_series_admin')
  expect((client as unknown as {rpc?:unknown}).rpc).toBeUndefined()
 })
 it('shows no Master commercial data if the server denies access',async()=>{
  const {client}=fixture({deny:true})
  render(<MasterCommercialCatalog client={client}/>)
  expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
  expect(screen.queryByText('Plano ESSENCIAL')).not.toBeInTheDocument()
 })
 it('rejects invalid prices rather than displaying a commercial offer',async()=>{
  const {client}=fixture({brokenPrice:true})
  await expect(loadPlatformCommercialCatalog(client,new AbortController().signal)).rejects.toThrow()
 })
 it('rejects duplicate plan versions rather than silently selecting a row',async()=>{
  const {client}=fixture({duplicate:true})
  await expect(loadPlatformCommercialCatalog(client,new AbortController().signal)).rejects.toThrow()
 })
 it('renders human-readable commercial terminology, reading cards for plans/offers, and safe fallbacks for unknown states without inventing data',async()=>{
  const planRows=[
   {...plan,plan_version_id:'11111111-1111-4111-8111-111111111111',display_name_snapshot:'Plano Mensal',internal_code_snapshot:'MENSAL',version_number:1,price:'125.00',billing_interval:'monthly',admin_status:'current',publication_status:'published',valid_from:'2026-10-01',valid_to:null,plan_active:true,can_delete_plan:false,delete_block_reason:'subscription_exists'},
   {...plan,plan_version_id:'22222222-2222-4222-8222-222222222222',display_name_snapshot:'Plano Anual',internal_code_snapshot:'ANUAL',version_number:2,price:'1200.00',billing_interval:'yearly',admin_status:'future',publication_status:'published',valid_from:'2027-01-01',valid_to:'2027-12-31',plan_active:true,can_delete_plan:false,delete_block_reason:'published_version_exists'},
   {...plan,plan_version_id:'33333333-3333-4333-8333-333333333333',display_name_snapshot:'Plano Custom',internal_code_snapshot:'CUSTOM',version_number:3,price:'450.00',billing_interval:'custom',admin_status:'historical',publication_status:'published',valid_from:'2025-01-01',valid_to:'2025-12-31',plan_active:true,can_delete_plan:false,delete_block_reason:'onboarding_link_exists'},
   {...plan,plan_version_id:'44444444-4444-4444-8444-444444444444',display_name_snapshot:'Plano Rascunho',internal_code_snapshot:'DRAFT1',version_number:1,price:'99.00',billing_interval:'monthly',admin_status:'draft',publication_status:'draft',valid_from:'2027-03-01',valid_to:null,plan_active:true,can_delete_plan:true,delete_block_reason:null},
   {...plan,plan_version_id:'55555555-5555-4555-8555-555555555555',display_name_snapshot:'Plano Inativo',internal_code_snapshot:'INAT',version_number:1,price:'80.00',billing_interval:'weekly_unknown',admin_status:'unexpected_admin_state',publication_status:'unexpected_pub_state',valid_from:'2024-01-01',valid_to:null,plan_active:false,can_delete_plan:false,delete_block_reason:null},
   {...plan,plan_version_id:'66666666-6666-4666-8666-666666666666',display_name_snapshot:'Plano Estado Desconhecido',internal_code_snapshot:'UNK',version_number:1,price:'85.00',billing_interval:'weird_interval',admin_status:'unexpected_admin_state',publication_status:'unexpected_pub_state',valid_from:'2026-06-01',valid_to:null,plan_active:true,can_delete_plan:false,delete_block_reason:'unknown_reason'},
  ]
  const {client}=fixture({planRows})
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano Mensal')

  const planCards=screen.getByRole('region',{name:'Cards de versões comerciais de planos'})
  expect(within(planCards).getByText('Plano Mensal (MENSAL)')).toBeInTheDocument()
  expect(within(planCards).getByText('BRL 125,00')).toBeInTheDocument()
  expect(within(planCards).getByText('v1 · Publicada')).toBeInTheDocument()
  expect(within(planCards).getByText('Vigente para novas contratações')).toBeInTheDocument()
  expect(within(planCards).getByText('Publicada futura')).toBeInTheDocument()
  expect(within(planCards).getByText('Histórica / contratos existentes')).toBeInTheDocument()
  expect(within(planCards).getByText('v1 · Rascunho')).toBeInTheDocument()
  expect(within(planCards).getByText('Plano desativado')).toBeInTheDocument()
  expect(within(planCards).getByText('Situação não reconhecida')).toBeInTheDocument()
  expect(within(planCards).getByText('Periodicidade: Anual')).toBeInTheDocument()
  expect(within(planCards).getByText('Periodicidade: Personalizada')).toBeInTheDocument()
  expect(within(planCards).getAllByText('Periodicidade: Periodicidade não reconhecida')).toHaveLength(2)
  expect(within(planCards).getByText('Exclusão bloqueada: possui assinatura vinculada')).toBeInTheDocument()
  expect(within(planCards).getByText('Exclusão permitida (sem vínculos)')).toBeInTheDocument()

  const promoCards=screen.getByRole('region',{name:'Cards de ofertas Master'})
  expect(within(promoCards).getByText('Oferta TESTE (DEV)')).toBeInTheDocument()
  expect(within(promoCards).getByText('Publicada')).toBeInTheDocument()
  expect(within(promoCards).getByText('Resgates confirmados: 0')).toBeInTheDocument()

  // Preserves table without unbacked Usuários/Ações columns or raw technical strings
  const planTable=screen.getByRole('region',{name:'Versões comerciais de planos'})
  expect(within(planTable).queryByRole('columnheader',{name:'Usuários'})).not.toBeInTheDocument()
  expect(within(planTable).queryByRole('columnheader',{name:'Ações'})).not.toBeInTheDocument()
  expect(within(planTable).queryByText('weekly_unknown')).not.toBeInTheDocument()
  expect(within(planTable).queryByText('unexpected_admin_state')).not.toBeInTheDocument()
 })
 it('reloads the commercial catalog when a lifecycle governance mutation succeeds',async()=>{
  const baseFrom=fixture().from
  const rpc=vi.fn().mockResolvedValue({data:plan.plan_id,error:null})
  const client={from:baseFrom,rpc} as unknown as SupabaseClient
  render(<MasterCommercialCatalog client={client}/>)
  await screen.findByText('Plano ESSENCIAL')
  const initialCalls=baseFrom.mock.calls.length
  fireEvent.change(screen.getByLabelText('Plano para ativação ou exclusão'),{target:{value:plan.plan_id}})
  fireEvent.change(screen.getByLabelText('Motivo da alteração do plano'),{target:{value:'Revisão de portfólio'}})
  fireEvent.click(screen.getByRole('button',{name:'Desativar plano'}))
  await screen.findByText('Plano desativado com confirmação. Assinaturas e histórico publicados foram preservados.')
  expect(rpc).toHaveBeenCalledWith('set_saas_plan_active',{
   p_plan_id:plan.plan_id,p_active:false,p_reason:'Revisão de portfólio',
  })
  expect(baseFrom.mock.calls.length).toBeGreaterThan(initialCalls)
 })
})
