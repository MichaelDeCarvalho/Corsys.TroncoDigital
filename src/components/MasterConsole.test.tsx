import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterConsole} from './MasterConsole'
import {loadMasterTenants,validateMasterOverview} from '../lib/master-console'
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
function fixture(denied=false){
 const rpc=vi.fn(async(name:string)=>{
  if(denied)return {data:null,error:{code:'42501'}}
  return {data:name==='read_platform_master_overview'?summary:[tenant],error:null}
 })
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
describe('Master read-only overview',()=>{
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
  fireEvent.change(screen.getByLabelText('Plano comercial'),{target:{value:'Mensal'}})
  fireEvent.submit(screen.getByRole('form',{name:'Filtrar clientes SaaS'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('search_platform_master_tenants',{
   p_search:'DEV-A',p_subscription_status:'active',p_plan_search:'Mensal',
   p_limit:26,p_offset:0,
  }))
  fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}))
  await waitFor(()=>expect(rpc.mock.calls.filter(call=>call[0]==='list_platform_master_tenants').length).toBeGreaterThan(1))
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
