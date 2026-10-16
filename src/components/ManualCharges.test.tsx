import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { ManualCharges } from './ManualCharges'
import { loadMemberCharges } from '../lib/manual-charges'

const member='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const category='559ba052-c408-4418-b806-0c0c4b8e3603'
const charge='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
const resultId='faaf76e4-d796-430f-929f-71df5beaf832'
function mock(foreign=false){
 const data:Record<string,unknown[]>={
  members:[{id:member,organization_id:'org',full_name:'Irmão TESTE',status:'active'}],
  financial_categories:[{id:category,organization_id:'org',name:'Ágape',active:true,domain:'member_receivable'}],
  v_charge_balances:[{charge_id:charge,organization_id:foreign?'other':'org',member_id:member,
   description:'Ágape abril',competence:'2026-04-01',due_date:'2026-04-10',
   open_amount:'125.00',is_cancelled:false,integrity_ok:true}],
 }
 const from=vi.fn((name:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:data[name],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:resultId,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
async function choose(){
 await screen.findByLabelText('Integrante')
 fireEvent.change(screen.getByLabelText('Integrante'),{target:{value:member}})
 await screen.findByLabelText('Descrição')
}
function set(label:string,value:string){
 fireEvent.change(screen.getByLabelText(label),{target:{value}})
}
describe('Manual member charges',()=>{
 it('creates an auditable manual obligation using exact decimal amount and own member/category',async()=>{
  const {client,rpc}=mock()
  render(<ManualCharges client={client} organizationId="org"/>)
  await choose()
  set('Descrição','Ágape de confraternização')
  set('Categoria',category)
  set('Competência da cobrança','2026-04')
  set('Emissão','2026-04-01')
  set('Vencimento','2026-04-10')
  set('Competência contábil','2026-04')
  set('Valor (R$)','40,50')
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar cobrança avulsa'}))
  await screen.findByText('Lançamento confirmado. As cobranças foram atualizadas.')
  expect(rpc).toHaveBeenCalledWith('create_manual_charge',expect.objectContaining({
   p_organization_id:'org',p_member_id:member,p_category_id:category,
   p_amount:'40.50',p_competence:'2026-04-01',p_accounting_period:'2026-04-01',
   p_idempotency_key:expect.any(String),
  }))
 })
 it('records charge cancellation with reason and a stable idempotency key',async()=>{
  const {client,rpc}=mock()
  render(<ManualCharges client={client} organizationId="org"/>)
  await choose()
  set('Cobrança',charge)
  set('Competência do cancelamento','2026-04')
  set('Motivo','Duplicidade confirmada')
  fireEvent.submit(screen.getByRole('form',{name:'Cancelar cobrança'}))
  await screen.findByText('Lançamento confirmado. As cobranças foram atualizadas.')
  expect(rpc).toHaveBeenCalledWith('cancel_member_charge_idempotent',expect.objectContaining({
   p_organization_id:'org',p_charge_id:charge,
   p_accounting_period:'2026-04-01',p_reason:'Duplicidade confirmada',
   p_idempotency_key:expect.any(String),
  }))
 })
 it('never posts an over-precise monetary value',async()=>{
  const {client,rpc}=mock()
  render(<ManualCharges client={client} organizationId="org"/>)
  await choose()
  set('Descrição','Ágape da Loja')
  set('Categoria',category)
  set('Competência da cobrança','2026-04')
  set('Emissão','2026-04-01')
  set('Vencimento','2026-04-10')
  set('Competência contábil','2026-04')
  set('Valor (R$)','40,123')
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar cobrança avulsa'}))
  await screen.findByRole('alert')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('replays the same charge request after a transport failure',async()=>{
  const {client,rpc}=mock()
  rpc.mockRejectedValueOnce(Error('transport'))
  render(<ManualCharges client={client} organizationId="org"/>)
  await choose()
  set('Cobrança',charge)
  set('Competência do cancelamento','2026-04')
  set('Motivo','Dado incorreto')
  fireEvent.submit(screen.getByRole('form',{name:'Cancelar cobrança'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
 })
 it('blocks both forms if the returned charge belongs to another organization',async()=>{
  const {client,rpc}=mock(true)
  render(<ManualCharges client={client} organizationId="org"/>)
  await screen.findByLabelText('Integrante')
  fireEvent.change(screen.getByLabelText('Integrante'),{target:{value:member}})
  await screen.findByText('Consulta de cobranças incompleta ou inconsistente. Bloqueadas novas operações.')
  expect(screen.queryByRole('form',{name:'Cadastrar cobrança avulsa'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('rejects cross-member response in loader',async()=>{
  const {client}=mock()
  await expect(loadMemberCharges(client,'org','different-member',new AbortController().signal)).rejects.toThrow()
 })
})
