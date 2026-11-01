import {render,screen,fireEvent,waitFor,within} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterConsole} from './MasterConsole'
import {loadMasterPlanOptions,loadMasterTenants,validateMasterOverview} from '../lib/master-console'
const summary={
 as_of:'2026-10-09',tenants_total:2,tenants_active:1,tenants_other:1,
 subscriptions_active_or_trial:1,subscriptions_past_due:1,
 support_tickets_open:2,plan_drafts:0,access:'MASTER',mfa_required:true,
}
const tenant={
 organization_id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',organization_name:'Loja Exemplo',
 organization_number:'101',organization_status:'active',subscription_status:'active',
 plan_name:'Plano Mensal',open_support_tickets:1,
}
const planRows=[
 {id:'0677479d-475b-4639-9225-2fe34be37114',code:'PLANO_MENSAL',name:'Plano Mensal',active:true},
 {id:'ad51fd98-1a89-4f4f-a9e7-a4b90124b0bb',code:'PLANO_LEGADO',name:'Plano Legado',active:false},
]
function fixture(denied=false, planError=false, totals=summary){
 const rpc=vi.fn(async(name:string)=>{
  if(denied)return {data:null,error:{code:'42501'}}
  if(name==='read_master_client_360')return {data:{
   organization_id:tenant.organization_id,name:tenant.organization_name,number:'101',status:'active',
   commercial_status:'active',customer_since:null,billing_email:null,billing_provider:null,
   subscription_id:null,subscription_status:'active',subscription_start:null,subscription_end:null,
   plan_version_id:null,invoices_total:0,invoices_open_amount:'0.00',invoices_overdue_amount:'0.00',
   tickets_total:1,tickets_open:1,as_of:'2026-11-01',integrity_ok:true,
  },error:null}
  return {data:name==='read_platform_master_overview'?totals:[tenant],error:null}
 })
 const query={
  select:vi.fn().mockReturnThis(),
  order:vi.fn().mockReturnThis(),
  limit:vi.fn().mockReturnThis(),
  abortSignal:vi.fn().mockResolvedValue(planError?{data:null,error:{code:'42501'}}:{data:planRows,error:null}),
 }
 const from=vi.fn(()=>query)
 return {client:{rpc,from} as unknown as SupabaseClient,rpc,from}
}
describe('Master read-only overview',()=>{
 it.each(['Ver cobranças desta Loja','Ver chamados desta Loja'])('keeps the selected Client 360 customer when opening %s',async(action)=>{
  const {client}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  fireEvent.click(within(screen.getByRole('row',{name:/Loja Exemplo/})).getByRole('button',{name:'Cliente 360º'}))
  fireEvent.click(await screen.findByRole('button',{name:action}))
  if(action==='Ver cobranças desta Loja')expect(screen.getByLabelText('Loja cliente')).toHaveValue(tenant.organization_id)
  else expect(await screen.findByText(tenant.organization_id)).toBeInTheDocument()
 })
 it('opens attention overdue clients with a fresh server filter, clearing previous search and plan',async()=>{
  const {client,rpc}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  fireEvent.change(screen.getByLabelText('Buscar cliente'),{target:{value:'outra loja'}})
  await screen.findByRole('option',{name:'Plano Mensal (PLANO_MENSAL)'})
  fireEvent.change(screen.getByLabelText('Plano comercial'),{target:{value:'PLANO_MENSAL'}})
  fireEvent.submit(screen.getByRole('form',{name:'Filtrar clientes SaaS'}))
  await screen.findByText('Loja Exemplo')
  fireEvent.click(screen.getByRole('button',{name:'Ver clientes em atraso'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('search_platform_master_tenants',{
   p_search:null,p_subscription_status:'past_due',p_plan_search:null,p_limit:26,p_offset:0,
  }))
  await screen.findByText('Clientes SaaS e Implantação')
  expect(screen.getByLabelText('Buscar cliente')).toHaveValue('')
  expect(screen.getByLabelText('Status comercial')).toHaveValue('past_due')
  expect(screen.getByLabelText('Plano comercial')).toHaveValue('')
 })
 it('shows a bounded empty attention state using server totals',async()=>{
  const {client}=fixture(false,false,{...summary,subscriptions_past_due:0,support_tickets_open:0,plan_drafts:0})
  render(<MasterConsole client={client}/>)
  expect(await screen.findByText('Nenhuma pendência nesses três indicadores.')).toBeInTheDocument()
 })
 it('does not expose attention controls after authorization is denied',async()=>{
  const {client}=fixture(true)
  render(<MasterConsole client={client}/>)
  await screen.findByRole('alert')
  expect(screen.queryByRole('button',{name:'Ver clientes em atraso'})).not.toBeInTheDocument()
 })
 it('renders platform totals and tenant names returned by authorized server functions',async()=>{
  const {client,rpc}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  expect(screen.getByText('Plano Mensal')).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('read_platform_master_overview')
  expect(rpc).toHaveBeenCalledWith('list_platform_master_tenants',{p_limit:26,p_offset:0})
 })
 it('does not show the directory when server denies access',async()=>{
  const {client}=fixture(true)
  render(<MasterConsole client={client}/>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Loja Exemplo')).not.toBeInTheDocument()
 })
 it('rejects inconsistent or malformed global totals',()=>{
  expect(()=>validateMasterOverview({...summary,tenants_total:3})).toThrow()
  expect(()=>validateMasterOverview({...summary,access:'TENANT'})).toThrow()
  expect(()=>validateMasterOverview({...summary,plan_drafts:-1})).toThrow()
 })
 it('filters global client directory at the server, never in a browser-only table',async()=>{
  const {client,rpc}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  fireEvent.change(screen.getByLabelText('Buscar cliente'),{target:{value:'DEV-A'}})
  fireEvent.change(screen.getByLabelText('Status comercial'),{target:{value:'active'}})
  await screen.findByRole('option',{name:'Plano Mensal (PLANO_MENSAL)'})
  fireEvent.change(screen.getByLabelText('Plano comercial'),{target:{value:'PLANO_MENSAL'}})
  fireEvent.submit(screen.getByRole('form',{name:'Filtrar clientes SaaS'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('search_platform_master_tenants',{
   p_search:'DEV-A',p_subscription_status:'active',p_plan_search:'PLANO_MENSAL',
   p_limit:26,p_offset:0,
  }))
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}))
  await waitFor(()=>expect(rpc.mock.calls.filter(call=>call[0]==='list_platform_master_tenants').length).toBeGreaterThan(1))
 })
 it('opens the selected directory client directly in Client 360',async()=>{
  const {client,rpc}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  fireEvent.click(within(screen.getByRole('row',{name:/Loja Exemplo/})).getByRole('button',{name:'Cliente 360º'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('read_master_client_360',{p_organization_id:tenant.organization_id}))
  expect(screen.getByLabelText('Loja cliente')).toHaveValue(tenant.organization_id)
 })
 it('opens support scoped to the client chosen in the Master directory',async()=>{
  const {client}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByText('Loja Exemplo')
  fireEvent.click(within(screen.getByRole('row',{name:/Loja Exemplo/})).getByRole('button',{name:'Suporte'}))
  expect(await screen.findByText(tenant.organization_id)).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Mostrar todos os chamados'})).toBeInTheDocument()
 })
 it('loads the authorized catalog, including inactive subscribed plans, instead of free text',async()=>{
  const {client,from}=fixture()
  render(<MasterConsole client={client}/>)
  await screen.findByRole('option',{name:'Plano Legado (PLANO_LEGADO) — Inativo'})
  expect(from).toHaveBeenCalledWith('saas_plans')
  expect(screen.getByLabelText('Plano comercial')).toHaveValue('')
  expect(screen.getByLabelText('Plano comercial')).not.toBeDisabled()
 })
 it('fails closed when catalog is unavailable and makes no plan search',async()=>{
  const {client,rpc}=fixture(false,true)
  render(<MasterConsole client={client}/>)
  await screen.findByText('Não foi possível carregar os planos do catálogo.')
  expect(screen.getByLabelText('Plano comercial')).toBeDisabled()
  expect(rpc.mock.calls.some(call=>call[0]==='search_platform_master_tenants')).toBe(false)
 })
 it('does not query catalog when Master access is denied',async()=>{
  const {client,from}=fixture(true)
  render(<MasterConsole client={client}/>)
  await screen.findByRole('alert')
  expect(from).not.toHaveBeenCalled()
 })
 it('rejects an incomplete or untrusted plan catalog',async()=>{
  const invalid=vi.fn().mockResolvedValue({data:[{...planRows[0],code:''}],error:null})
  const q={select:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),abortSignal:invalid}
  const client={from:vi.fn(()=>q)} as unknown as SupabaseClient
  await expect(loadMasterPlanOptions(client,new AbortController().signal)).rejects.toThrow()
 })
 it('rejects oversize and unsupported status filters before contacting platform',async()=>{
  const {client,rpc}=fixture()
  await expect(loadMasterTenants(client,0,{search:'x'.repeat(101),status:'all',plan:''})).rejects.toThrow()
  await expect(loadMasterTenants(client,0,{search:'',status:'invalid' as 'all',plan:''})).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('rejects pages outside the supported range',async()=>{
  const {client,rpc}=fixture()
  await expect(loadMasterTenants(client,801)).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
 })
})
