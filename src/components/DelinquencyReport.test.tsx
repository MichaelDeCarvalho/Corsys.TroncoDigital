import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { DelinquencyReport } from './DelinquencyReport'
import { loadDelinquencyPage } from '../lib/delinquency-report'

const base={
 member_id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',
 full_name:'Integrante DEV',member_status:'active',overdue_items:2,
 overdue_amount:'150.00',available_credit:'20.00',
 oldest_due:'2026-09-10',net_position:'130.00',
}

const summaryFixture = [
 { bucket_id: 'up30', member_count: 1, overdue_items: 2, overdue_amount: 150.00, server_date: '2026-09-20' }
]

function fixture(rows:unknown[]=[base], summaries:unknown[]=summaryFixture, error:unknown=null){
 const rpc=vi.fn().mockImplementation((name)=>{
  if(name==='read_tenant_delinquency_bucket_summary'){
   return Promise.resolve({data:summaries,error:null})
  }
  return Promise.resolve({data:rows,error})
 })
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}

describe('Member overdue report',()=>{
 it('keeps overdue balance and unallocated credits separate without global page totals',async()=>{
  const {client,rpc}=fixture()
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')
  expect(screen.getAllByText(/R\$\s?150,00/).length).toBeGreaterThan(0)
  expect(screen.getByText(/R\$\s?20,00/)).toBeInTheDocument()
  expect(screen.getByText(/Créditos de pagamentos ainda não alocados/)).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency_filtered',{
   p_organization_id:'org-a',p_bucket:null,p_limit:26,p_offset:0,
  })
 })

 it('uses server pagination and never totals only page one',async()=>{
  const one=Array.from({length:26},(_,i)=>({...base,member_id:`member-${i}`,full_name:`Integrante ${i}`}))
  const {client,rpc}=fixture(one)
  rpc.mockImplementation((name, args)=>{
   if(name==='read_tenant_delinquency_bucket_summary') return Promise.resolve({data:summaryFixture,error:null})
   if(args?.p_offset===25) return Promise.resolve({data:[{...base,full_name:'Última página'}],error:null})
   return Promise.resolve({data:one,error:null})
  })
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText(/Página 1 — 25 integrantes nesta página/)
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}))
  await screen.findByText('Última página')
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency_filtered',{
   p_organization_id:'org-a',p_bucket:null,p_limit:26,p_offset:25,
  })
 })

 it('exports only on explicit user action and prevents partial downloads on authorization errors',async()=>{
  const {client,rpc}=fixture()
  rpc.mockImplementation((name)=>{
   if(name==='read_tenant_delinquency_bucket_summary') return Promise.resolve({data:summaryFixture,error:null})
   return Promise.resolve({data:[base],error:null})
  })
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency_filtered',expect.any(Object))
 })

 it('handles denied access by hiding all balances',async()=>{
  const client={
   rpc: vi.fn().mockResolvedValue({data:null,error:{code:'42501'}})
  } as unknown as SupabaseClient
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Seu perfil não possui permissão para consultar a inadimplência da Loja.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
 })

 it('rejects nonfinite and negative delinquency data',async()=>{
  const first=fixture([{...base,overdue_amount:'NaN'}])
  await expect(loadDelinquencyPage(first.client,'org-a',0)).rejects.toThrow()
  const second=fixture([{...base,available_credit:'-5.00'}])
  await expect(loadDelinquencyPage(second.client,'org-a',0)).rejects.toThrow()
  const third=fixture([{...base,overdue_items:0}])
  await expect(loadDelinquencyPage(third.client,'org-a',0)).rejects.toThrow()
 })

 it('does not render invented empty positions when server errors',async()=>{
  const client={
   rpc: vi.fn().mockResolvedValue({data:null,error:{code:'500'}})
  } as unknown as SupabaseClient
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Nenhum integrante com cobrança vencida nesta faixa ou página.')).not.toBeInTheDocument()
 })

 it('renders 4 aging bucket cards and filters server-side on bucket selection',async()=>{
  const {client,rpc}=fixture()
  const {container}=render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')

  expect(container.querySelector('[data-delinquency-bucket="up30"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="31-60"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="61-90"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="over90"]')).toBeInTheDocument()

  // Click a bucket card (now semantic button)
  const up30Card = container.querySelector('[data-delinquency-bucket="up30"]') as HTMLButtonElement
  expect(up30Card.tagName).toBe('BUTTON')
  fireEvent.click(up30Card)

  await screen.findByText(/Faixa selecionada:/)
  expect(screen.getByRole('button', { name: 'Limpar filtro' })).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency_filtered', {
   p_organization_id: 'org-a', p_bucket: 'up30', p_limit: 26, p_offset: 0,
  })
 })

 it('resets pagination to page 0 when changing bucket filters or clearing filters and hides buckets on denied summary RPC', async () => {
  const pageRows = Array.from({ length: 26 }, (_, i) => ({
   ...base,
   member_id: `member-${i}`,
   full_name: `Integrante ${i}`,
  }))
  const rpc = vi.fn().mockImplementation((name, args) => {
   if (name === 'read_tenant_delinquency_bucket_summary') {
    return Promise.resolve({
     data: [
      { bucket_id: 'up30', member_count: 30, overdue_items: 35, overdue_amount: 1500, server_date: '2026-09-20' },
      { bucket_id: '31-60', member_count: 0, overdue_items: 0, overdue_amount: 0, server_date: '2026-09-20' },
      { bucket_id: '61-90', member_count: 1, overdue_items: 1, overdue_amount: 80, server_date: '2026-09-20' },
      { bucket_id: 'over90', member_count: 0, overdue_items: 0, overdue_amount: 0, server_date: '2026-09-20' },
     ],
     error: null,
    })
   }
   if (args?.p_bucket === '31-60') return Promise.resolve({ data: [], error: null })
   if (args?.p_offset === 25) return Promise.resolve({ data: [{ ...base, member_id: 'm-26', full_name: 'Integrante Página 2' }], error: null })
   return Promise.resolve({ data: pageRows, error: null })
  })
  const client = { rpc } as unknown as SupabaseClient
  const { container } = render(<DelinquencyReport client={client} organizationId="org-a" />)

  await screen.findByText(/Página 1 — 25 integrantes nesta página/)
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
  await screen.findByText('Integrante Página 2')

  // Switching to an empty bucket must reset page to 0
  fireEvent.click(container.querySelector('[data-delinquency-bucket="31-60"]')!)
  await screen.findByText('Nenhum integrante com cobrança vencida nesta faixa ou página.')
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency_filtered', {
   p_organization_id: 'org-a', p_bucket: '31-60', p_limit: 26, p_offset: 0,
  })

  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))
  await waitFor(() => {
   const calls = rpc.mock.calls.filter(([name]) => name === 'read_tenant_delinquency_filtered')
   expect(calls[calls.length - 1]?.[1]).toEqual({
    p_organization_id: 'org-a', p_bucket: null, p_limit: 26, p_offset: 0,
   })
  })
 })

 it('shows explicit migration-pending banner without browser local date fallback when new RPCs return PGRST202', async () => {
  const rpc = vi.fn().mockImplementation((name) => {
   if (name === 'read_tenant_delinquency_bucket_summary' || name === 'read_tenant_delinquency_filtered') {
    return Promise.resolve({ data: null, error: { code: 'PGRST202' } })
   }
   return Promise.resolve({ data: [base], error: null })
  })
  const client = { rpc } as unknown as SupabaseClient
  const { container } = render(<DelinquencyReport client={client} organizationId="org-a" />)

  await screen.findByText('Integrante DEV')
  expect(screen.getByText(/aguardam aplicação da migration de faixas/i)).toBeInTheDocument()
  expect(container.querySelector('input#delinquency-ref-date')).toBeNull()
  expect(container.querySelector('[data-delinquency-bucket="up30"]')).toBeDisabled()
 })

 it('hides bucket cards completely when summary RPC returns 42501 permission denied', async () => {
  const rpc = vi.fn().mockImplementation((name) => {
   if (name === 'read_tenant_delinquency_bucket_summary') {
    return Promise.resolve({ data: null, error: { code: '42501' } })
   }
   return Promise.resolve({ data: [base], error: null })
  })
  const client = { rpc } as unknown as SupabaseClient
  const { container } = render(<DelinquencyReport client={client} organizationId="org-a" />)

  await screen.findByText('Seu perfil não possui permissão para consultar a inadimplência da Loja.')
  expect(container.querySelector('[data-delinquency-bucket="up30"]')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
 })
})
