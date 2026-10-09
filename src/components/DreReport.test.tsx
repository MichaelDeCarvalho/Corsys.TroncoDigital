import { fireEvent, render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { DreReport } from './DreReport'
import { loadDreReport, summarizeDre } from '../lib/dre-report'

const entry=(nature:'revenue'|'expense',amount:string)=>({
 accounting_period:'2026-09-01',
 accounting_plan_id:'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',
 accounting_account_id:nature==='revenue'?'559ba052-c408-4418-b806-0c0c4b8e3603':'b112d600-bf1a-4bfd-bc1c-e9e9b749b539',
 account_code:nature==='revenue'?'1.1':'2.1',
 account_description:nature==='revenue'?'Mensalidades':'Energia',
 nature,operational_classification:nature==='revenue'?'recurring':'fixed',
 signed_amount:amount,
})
const good=[entry('revenue','150.50'),entry('expense','-40.25')]
function fixture(data:unknown=good,error:unknown=null){
 const rpc=vi.fn().mockResolvedValue({data,error})
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
function fill(){
 fireEvent.change(screen.getByLabelText('Competência inicial'),{target:{value:'2026-09'}})
 fireEvent.change(screen.getByLabelText('Competência final'),{target:{value:'2026-09'}})
 fireEvent.submit(screen.getByRole('form',{name:'Consultar DRE'}))
}
describe('DRE by competence',()=>{
 it('shows signed income/expenses by month, preserving negative expense and no cash claims',async()=>{
  const {client,rpc}=fixture()
  render(<DreReport client={client} organizationId="org"/>)
  fill()
  await screen.findByText('Mensalidades')
  expect(screen.getAllByText(/R\$\s?110,25/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/R\$\s?150,50/).length).toBeGreaterThan(0)
  expect(rpc).toHaveBeenCalledWith('read_tenant_dre',{
   p_organization_id:'org',p_from_period:'2026-09-01',p_to_period:'2026-09-01',
  })
  expect(screen.getByText(/não é extrato de caixa/)).toBeInTheDocument()
 })
 it('refuses periods over 12 months before making any RPC',async()=>{
  const {client,rpc}=fixture()
  render(<DreReport client={client} organizationId="org"/>)
  fireEvent.change(screen.getByLabelText('Competência inicial'),{target:{value:'2026-01'}})
  fireEvent.change(screen.getByLabelText('Competência final'),{target:{value:'2027-02'}})
  fireEvent.submit(screen.getByRole('form',{name:'Consultar DRE'}))
  await screen.findByText('Não foi possível verificar os lançamentos contábeis neste período. Revise o intervalo e tente novamente.')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('does not report permission failures as empty or zero statements',async()=>{
  const {client}=fixture(null,{code:'42501'})
  render(<DreReport client={client} organizationId="org"/>)
  fill()
  await screen.findByText('Seu perfil não possui permissão para consultar a DRE desta Loja.')
  expect(screen.queryByText('Nenhum lançamento contabilizado de resultado para este período.')).not.toBeInTheDocument()
 })
 it('fails closed for malformed account totals and incomplete result sets',async()=>{
  const {client}=fixture([entry('revenue','NaN')])
  await expect(loadDreReport(client,'org','2026-09','2026-09')).rejects.toThrow()
  const over=fixture(Array.from({length:1501},()=>entry('revenue','1.00')))
  await expect(loadDreReport(over.client,'org','2026-09','2026-09')).rejects.toThrow()
 })
 it('does not merge unlike account natures and computes net only from backend signed facts',()=>{
  const summarized=summarizeDre(good)
  expect(summarized).toEqual([{month:'2026-09-01',revenue:150.5,expenses:-40.25,result:110.25}])
 })
})
