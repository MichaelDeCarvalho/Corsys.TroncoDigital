import { act,render,screen,waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FinancialDashboard } from './FinancialDashboard'
import { normalizeDashboard } from '../lib/finance-dashboard'

const data={
 organization_id:'org-a',as_of:'2026-10-09',
 member_open:'150.10',institutional_open:'50.20',receivables_open:'200.30',
 receivables_overdue:'120.00',received_this_month:'85.00',
 cash_bank_balance:'1340.15',payables_open:'300.00',payables_overdue:'40.00',
 integrity_ok:true,
}
function mock(response:unknown=data,error:unknown=null){
 const rpc=vi.fn().mockResolvedValue({data:response,error})
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
describe('Financial dashboard',()=>{
 it('renders six server-computed KPIs and explains cash versus obligation',async()=>{
  const {client,rpc}=mock()
  render(<FinancialDashboard client={client} organizationId="org-a"/>)
  await screen.findByText(/R\$\s?200,30/)
  expect(screen.getByText(/R\$\s?1\.340,15/)).toBeInTheDocument()
  expect(screen.getByText(/R\$\s?300,00/)).toBeInTheDocument()
  expect(screen.getByText(/Obrigações não são recebimentos/)).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('read_tenant_financial_dashboard',{p_organization_id:'org-a'})
 })
 it('handles missing finance.read without leaking balances',async()=>{
  const {client}=mock(null,{code:'42501'})
  render(<FinancialDashboard client={client} organizationId="org-a"/>)
  await screen.findByText('Os indicadores financeiros exigem autorização específica na Loja.')
  expect(screen.queryByText(/R\$\s?200,30/)).not.toBeInTheDocument()
 })
 it('fails closed when the returned dashboard belongs to another organization',async()=>{
  const {client}=mock({...data,organization_id:'org-b'})
  render(<FinancialDashboard client={client} organizationId="org-a"/>)
  await screen.findByRole('alert')
  expect(screen.queryByText(/R\$\s?200,30/)).not.toBeInTheDocument()
 })
 it('fails closed on inconsistent obligations and nonfinite numbers',()=>{
  expect(()=>normalizeDashboard({...data,receivables_open:'300.00'},'org-a')).toThrow()
  expect(()=>normalizeDashboard({...data,payables_open:'NaN'},'org-a')).toThrow()
  expect(()=>normalizeDashboard({...data,receivables_overdue:'500.00'},'org-a')).toThrow()
 })
 it('ignores late data from a previous tenant when organization changes',async()=>{
  let resolve!: (v:{data:unknown;error:null})=>void
  const previous=new Promise<{data:unknown;error:null}>(done=>{resolve=done})
  const rpc=vi.fn().mockImplementation((_:string,args:{p_organization_id:string})=>
   args.p_organization_id==='org-a'?previous:Promise.resolve({data:{...data,organization_id:'org-b'},error:null}))
  const client={rpc} as unknown as SupabaseClient
  const view=render(<FinancialDashboard client={client} organizationId="org-a"/>)
  view.rerender(<FinancialDashboard client={client} organizationId="org-b"/>)
  await screen.findByText(/R\$\s?200,30/)
  await act(async()=>{resolve({data,error:null});await previous})
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
 })
})
