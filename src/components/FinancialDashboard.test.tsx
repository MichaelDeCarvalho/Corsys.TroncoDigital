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
 it('reserves 6 structural placeholders without fake financial values during delayed load and refresh, then preserves all 6 KPI navigation destinations',async()=>{
  let resolveFirst!: (v:{data:unknown;error:null})=>void
  let resolveRefresh!: (v:{data:unknown;error:null})=>void
  let callCount = 0
  const rpc = vi.fn().mockImplementation(() => {
   callCount += 1
   if (callCount === 1) {
    return new Promise<{data:unknown;error:null}>(done => { resolveFirst = done })
   }
   return new Promise<{data:unknown;error:null}>(done => { resolveRefresh = done })
  })
  const onNavigate = vi.fn()
  const client = { rpc } as unknown as SupabaseClient

  const { container } = render(
   <FinancialDashboard client={client} organizationId="org-a" onNavigate={onNavigate} />,
  )

  // Pending state: accessible status message + 6 structural .panel.metric.metric-placeholder cards
  expect(screen.getByRole('status')).toHaveTextContent('Consultando indicadores financeiros…')
  expect(screen.getByRole('button', { name: 'Atualizar indicadores' })).toBeDisabled()

  const placeholderGrid = screen.getByTestId('financial-kpi-placeholders')
  expect(placeholderGrid).toHaveClass('metric-grid')
  expect(placeholderGrid).toHaveAttribute('aria-hidden', 'true')
  const placeholders = placeholderGrid.querySelectorAll('.panel.metric.metric-placeholder')
  expect(placeholders).toHaveLength(6)

  // No fake currency values or premature KPI buttons while pending
  expect(container.textContent).not.toMatch(/R\$\s?\d/)
  expect(screen.queryByRole('button', { name: /Total a receber/i })).not.toBeInTheDocument()

  // Resolve initial delayed RPC
  await act(async () => {
   resolveFirst({ data, error: null })
  })

  await screen.findByText(/R\$\s?200,30/)
  expect(screen.queryByTestId('financial-kpi-placeholders')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  // Verify all 6 KPI buttons and their navigation destinations
  const expectedKpis: Array<[RegExp, string]> = [
   [/Total a receber/i, 'members'],
   [/A receber vencido/i, 'inadimplencia'],
   [/Recebido no mês/i, 'fluxo-caixa'],
   [/Saldo das contas/i, 'tesouraria'],
   [/Contas a pagar\s+R\$\s?300,00/i, 'contas-pagar'],
   [/Contas a pagar vencidas/i, 'contas-pagar'],
  ]

  for (const [labelPattern, targetPage] of expectedKpis) {
   onNavigate.mockClear()
   const kpiBtn = screen.getByRole('button', { name: labelPattern })
   kpiBtn.click()
   expect(onNavigate).toHaveBeenCalledWith(targetPage)
  }

  // Trigger refresh ("Atualizar indicadores"): structural placeholders return while refresh RPC is pending
  const refreshBtn = screen.getByRole('button', { name: 'Atualizar indicadores' })
  expect(refreshBtn).not.toBeDisabled()
  await act(async () => {
   refreshBtn.click()
  })

  expect(screen.getByRole('status')).toHaveTextContent('Consultando indicadores financeiros…')
  expect(screen.getByTestId('financial-kpi-placeholders').querySelectorAll('.panel.metric.metric-placeholder')).toHaveLength(6)
  expect(container.textContent).not.toMatch(/R\$\s?\d/)

  await act(async () => {
   resolveRefresh({
    data: { ...data, receivables_open: '180.00', member_open: '129.80' },
    error: null,
   })
  })

  await waitFor(() => {
   expect(screen.getByText(/R\$\s?180,00/)).toBeInTheDocument()
  })
  expect(screen.queryByTestId('financial-kpi-placeholders')).not.toBeInTheDocument()
 })
})
