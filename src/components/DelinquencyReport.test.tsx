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
function fixture(rows:unknown[]=[base],error:unknown=null){
 const rpc=vi.fn().mockResolvedValue({data:rows,error})
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
describe('Member overdue report',()=>{
 it('keeps overdue balance and unallocated credits separate without global page totals',async()=>{
  const {client,rpc}=fixture()
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')
  expect(screen.getByText(/R\$\s?150,00/)).toBeInTheDocument()
  expect(screen.getByText(/R\$\s?20,00/)).toBeInTheDocument()
  expect(screen.getByText(/Créditos de pagamentos ainda não alocados/)).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('read_tenant_delinquency',{
   p_organization_id:'org-a',p_limit:26,p_offset:0,
  })
 })
 it('uses server pagination and never totals only page one',async()=>{
  const one=Array.from({length:26},(_,i)=>({...base,member_id:`member-${i}`,full_name:`Integrante ${i}`}))
  const {client,rpc}=fixture(one)
  rpc.mockResolvedValueOnce({data:one,error:null}).mockResolvedValueOnce({data:[{...base,full_name:'Última página'}],error:null})
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Página 1 — 25 integrantes')
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}))
  await screen.findByText('Última página')
  expect(rpc).toHaveBeenLastCalledWith('read_tenant_delinquency',{
   p_organization_id:'org-a',p_limit:26,p_offset:25,
  })
 })
 it('exports only on explicit user action and prevents partial downloads on authorization errors',async()=>{
  const {client,rpc}=fixture()
  rpc.mockResolvedValueOnce({data:[base],error:null})
   .mockResolvedValueOnce({data:null,error:{code:'42501'}})
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')
  expect(rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:'Exportar CSV completo'}))
  await screen.findByText(/A exportação não pôde ser concluída/)
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(rpc).toHaveBeenLastCalledWith('read_tenant_delinquency',{
   p_organization_id:'org-a',p_limit:26,p_offset:0,
  })
 })
 it('handles denied access by hiding all balances',async()=>{
  const {client}=fixture([],{code:'42501'})
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
  const {client}=fixture(null as unknown as unknown[],{code:'500'})
  render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Nenhum integrante com cobrança vencida nesta página.')).not.toBeInTheDocument()
 })

 it('renders 4 aging bucket cards with V35 attributes without inventing fake global sums',async()=>{
  const {client}=fixture()
  const {container}=render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')

  expect(container.querySelector('[data-delinquency-bucket="up30"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="31-60"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="61-90"]')).toBeInTheDocument()
  expect(container.querySelector('[data-delinquency-bucket="over90"]')).toBeInTheDocument()

  const unavailableNotices=screen.getAllByText('Indisponível (depende de RPC de agregação global no backend)')
  expect(unavailableNotices).toHaveLength(4)
 })

 it('calculates days overdue and bucket per member and shows notice on bucket selection',async()=>{
  const {client}=fixture()
  const {container}=render(<DelinquencyReport client={client} organizationId="org-a"/>)
  await screen.findByText('Integrante DEV')

  // Set reference date to 2026-09-20 (oldest_due is 2026-09-10 => 10 days overdue => up30)
  const dateInput=screen.getByLabelText('Data de referência para cálculo dos dias em atraso:')
  fireEvent.change(dateInput,{target:{value:'2026-09-20'}})

  await screen.findByText('10 dias')
  expect(container.querySelector('tbody .pill')?.textContent).toBe('Até 30 dias')

  // Click a bucket card
  const up30Card=container.querySelector('[data-delinquency-bucket="up30"]')!
  fireEvent.click(up30Card)

  await screen.findByText(/O filtro por faixa no servidor depende de extensão na RPC/)
 })
})
