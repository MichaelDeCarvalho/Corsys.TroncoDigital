import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MonthlyChargeGeneration } from './MonthlyChargeGeneration'
import { validateMonthlyPreview } from '../lib/monthly-generation'

const rule='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const batch='faaf76e4-d796-430f-929f-71df5beaf832'
const preview={
 organization_id:'org-a',rule_id:rule,competence:'2027-02-01',rule_name:'Mensalidade',
 ready:true,eligible_members:3,to_create:2,exempt:1,already_generated:0,missing_price:0,
 accounting_mapping_ready:true,period_closed:false,fingerprint:'a'.repeat(64),
}
function fixture(overrides:Record<string,unknown>={}){
 const catalog=[{id:rule,organization_id:'org-a',name:'Mensalidade',active:true,frequency:'monthly'}]
 const from=vi.fn(()=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:catalog,error:null})}
  return chain
 })
 const rpc=vi.fn().mockImplementation(async(name:string)=>
  ({data:name==='preview_monthly_charge_generation'?{...preview,...overrides}:batch,error:null}))
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,from}
}
async function choose(){
 await screen.findByLabelText('Regra mensal')
 await screen.findByRole('option',{name:'Mensalidade'})
 fireEvent.change(screen.getByLabelText('Regra mensal'),{target:{value:rule}})
 fireEvent.change(screen.getByLabelText('Competência para emissão'),{target:{value:'2027-02'}})
 fireEvent.click(screen.getByRole('button',{name:'Verificar prévia'}))
}
describe('Monthly member billing',()=>{
 it('can refresh during a delayed preview and ignores its obsolete response without locking the form',async()=>{
  const {client,rpc}=fixture()
  let resolvePreview!:(value:unknown)=>void
  rpc.mockImplementationOnce(()=>new Promise(resolve=>{resolvePreview=resolve}))
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  expect(screen.getByLabelText('Competência para emissão')).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Atualizar regras'}))
  await screen.findByRole('option',{name:'Mensalidade'})
  await act(async()=>{resolvePreview({data:preview,error:null})})
  expect(screen.queryByRole('region',{name:'Prévia mensal'})).not.toBeInTheDocument()
  expect(screen.getByLabelText('Competência para emissão')).toBeEnabled()
  fireEvent.click(screen.getByRole('button',{name:'Verificar prévia'}))
  await screen.findByRole('region',{name:'Prévia mensal'})
  expect(rpc.mock.calls.filter(x=>x[0]==='generate_monthly_member_charges')).toHaveLength(0)
 })
 it('shows authoritative eligible, exempt and future period quantities without immediately posting',async()=>{
  const {client,rpc}=fixture()
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  await screen.findByText(/Novas cobranças:/)
  expect(screen.getByText(/Isentos: 1/)).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledWith('preview_monthly_charge_generation',{
   p_organization_id:'org-a',p_rule_id:rule,p_competence:'2027-02-01',
  })
  expect(rpc).not.toHaveBeenCalledWith('generate_monthly_member_charges',expect.anything())
 })
 it('generates only after confirmation and passes fingerprint and idempotency key unchanged',async()=>{
  const {client,rpc}=fixture()
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  await screen.findByLabelText('Motivo da geração')
  fireEvent.change(screen.getByLabelText('Motivo da geração'),{target:{value:'Cobrança mensal autorizada'}})
  fireEvent.click(screen.getByRole('button',{name:'Confirmar geração de 2 cobranças'}))
  await screen.findByText(/Lote de cobranças confirmado/)
  expect(rpc).toHaveBeenCalledWith('generate_monthly_member_charges',expect.objectContaining({
   p_organization_id:'org-a',p_rule_id:rule,p_competence:'2027-02-01',
   p_expected_fingerprint:'a'.repeat(64),p_reason:'Cobrança mensal autorizada',
   p_idempotency_key:expect.any(String),
  }))
 })
 it('refuses to generate if the server says preview not ready or accounting mapping absent',async()=>{
  const {client,rpc}=fixture({ready:false,accounting_mapping_ready:false})
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  await screen.findByText(/A geração não está liberada/)
  expect(screen.queryByRole('button',{name:/Confirmar geração/})).not.toBeInTheDocument()
  expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('does not accept a preview from another organization or manipulated totals',()=>{
  expect(()=>validateMonthlyPreview({...preview,organization_id:'org-b'},'org-a',rule,'2027-02-01')).toThrow()
  expect(()=>validateMonthlyPreview({...preview,to_create:3},'org-a',rule,'2027-02-01')).toThrow()
  expect(()=>validateMonthlyPreview({...preview,fingerprint:'invalid'},'org-a',rule,'2027-02-01')).toThrow()
 })
 it('after a temporary network failure, retries identical request and key',async()=>{
  const {client,rpc}=fixture()
  rpc.mockImplementation(async(name:string)=>{
   if(name==='preview_monthly_charge_generation')return{data:preview,error:null}
   if(rpc.mock.calls.filter(x=>x[0]==='generate_monthly_member_charges').length===1)
    throw Error('transport')
   return {data:batch,error:null}
  })
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  await screen.findByLabelText('Motivo da geração')
  fireEvent.change(screen.getByLabelText('Motivo da geração'),{target:{value:'Cobrança conferida'}})
  fireEvent.click(screen.getByRole('button',{name:'Confirmar geração de 2 cobranças'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc.mock.calls.filter(x=>x[0]==='generate_monthly_member_charges')).toHaveLength(2))
  const commands=rpc.mock.calls.filter(x=>x[0]==='generate_monthly_member_charges')
  expect(commands[1]).toEqual(commands[0])
 })
 it('invalidates a previous preview when the competence changes',async()=>{
  const {client}=fixture()
  render(<MonthlyChargeGeneration client={client} organizationId="org-a"/>)
  await choose()
  await screen.findByLabelText('Motivo da geração')
  fireEvent.change(screen.getByLabelText('Competência para emissão'),{target:{value:'2027-03'}})
  expect(screen.queryByRole('button',{name:/Confirmar geração/})).not.toBeInTheDocument()
 })
})
