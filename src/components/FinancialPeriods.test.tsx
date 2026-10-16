import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { FinancialPeriods } from './FinancialPeriods'
import { loadPeriodState } from '../lib/periods'

const pid='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const event='faaf76e4-d796-430f-929f-71df5beaf832'
function fixture(closed=false,foreign=false){
 const rows:Record<string,unknown[]>={
  financial_periods:[{id:pid,organization_id:foreign?'org-b':'org-a',period:'2026-08-01'}],
  period_events:[{id:event,financial_period_id:pid,organization_id:'org-a',event_type:closed?'close':'reopen',event_seq:2}],
 }
 const from=vi.fn((name:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:rows[name],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:event,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
async function choose(month='2026-08'){
 fireEvent.change(screen.getByLabelText('Competência'),{target:{value:month}})
 await screen.findByText(/Estado atual:/)
}
async function confirm(){
 fireEvent.change(screen.getByLabelText('Justificativa'),{target:{value:'Conferência e fechamento autorizado'}})
 fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo que conferi lançamentos/}))
}
describe('Financial period close and reopen',()=>{
 it('blocks closure until reason and explicit acknowledgment then posts an idempotent close',async()=>{
  const {client,rpc}=fixture()
  render(<FinancialPeriods client={client} organizationId="org-a"/>)
  await choose()
  expect(screen.getByRole('button',{name:'Fechar competência'})).toBeDisabled()
  await confirm()
  fireEvent.submit(screen.getByRole('form',{name:'Alterar estado da competência'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('close_financial_period_idempotent',{
   p_organization_id:'org-a',p_period:'2026-08-01',
   p_reason:'Conferência e fechamento autorizado',p_idempotency_key:expect.any(String),
  }))
 })
 it('reopens an already closed period through distinct audited RPC',async()=>{
  const {client,rpc}=fixture(true)
  render(<FinancialPeriods client={client} organizationId="org-a"/>)
  await choose()
  await confirm()
  fireEvent.submit(screen.getByRole('form',{name:'Alterar estado da competência'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('reopen_financial_period_idempotent',expect.objectContaining({
   p_organization_id:'org-a',p_period:'2026-08-01',
  })))
 })
 it('retries the same period command without changing idempotency key',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(Error('disconnected'))
  render(<FinancialPeriods client={client} organizationId="org-a"/>)
  await choose()
  await confirm()
  fireEvent.submit(screen.getByRole('form',{name:'Alterar estado da competência'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('fails closed when another tenant period is returned',async()=>{
  const {client,rpc}=fixture(false,true)
  render(<FinancialPeriods client={client} organizationId="org-a"/>)
  fireEvent.change(screen.getByLabelText('Competência'),{target:{value:'2026-08'}})
  await screen.findByText('Não foi possível conferir o estado da competência. Nenhuma alteração está liberada.')
  expect(screen.queryByRole('form',{name:'Alterar estado da competência'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('fails on unexpected latest period event scope',async()=>{
  const {client}=fixture(true)
  await expect(loadPeriodState(client,'org-b','2026-08',new AbortController().signal)).rejects.toThrow()
 })
})
