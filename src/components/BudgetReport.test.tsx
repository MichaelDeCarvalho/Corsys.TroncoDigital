import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { BudgetReport } from './BudgetReport'
import { loadBudgetCatalog,loadBudgetLines } from '../lib/budget-report'
const cycle='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const account='559ba052-c408-4418-b806-0c0c4b8e3603'
const fund='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
function fixture(options:{foreign?:boolean;none?:boolean;invalid?:boolean}={}){
 const data:Record<string,unknown[]>={
  budget_cycles:options.none?[]:[{id:cycle,organization_id:'org',name:'Orçamento 2026',status:'published',
   period_start:'2026-01-01',period_end:'2026-12-01',currency:'BRL'}],
  accounting_accounts:[{id:account,organization_id:'org',code:'5.1',description:'Energia',nature:'expense'}],
  funds:[{id:fund,organization_id:'org',name:'Fundo de obras'}],
  v_accounting_budget_vs_actual:[{organization_id:options.foreign?'other':'org',
   budget_cycle_id:cycle,period:'2026-09-01',accounting_account_id:account,
   budget_amount:'200.00',actual_amount:options.invalid?'NaN':'125.00',remaining_amount:'75.00'}],
  v_fund_budget_vs_actual:[{organization_id:'org',budget_cycle_id:cycle,period:'2026-09-01',
   fund_id:fund,budget_amount:'300.00',actual_amount:'180.00',available_amount:'120.00'}],
 }
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:data[table],error:null})}
  return chain
 })
 return {client:{from} as unknown as SupabaseClient,from}
}
async function choose(){
 await screen.findByLabelText('Ciclo orçamentário')
 fireEvent.change(screen.getByLabelText('Ciclo orçamentário'),{target:{value:cycle}})
 fireEvent.change(screen.getByLabelText('Competência'),{target:{value:'2026-09'}})
}
describe('Budget versus actual report',()=>{
 it('shows only budgeted rows and their realized amounts without claiming cash availability',async()=>{
  const {client,from}=fixture()
  render(<BudgetReport client={client} organizationId="org"/>)
  await choose()
  fireEvent.submit(screen.getByRole('form',{name:'Consultar orçamento versus realizado'}))
  await screen.findByText('5.1 — Energia')
  expect(screen.getAllByText(/R\$\s?200,00/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/R\$\s?125,00/).length).toBeGreaterThan(0)
  expect(screen.getByText(/não implica disponibilidade financeira/i)).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith('v_accounting_budget_vs_actual')
 })
 it('also compares fund allocation vs realized fund expenses',async()=>{
  const {client,from}=fixture()
  render(<BudgetReport client={client} organizationId="org"/>)
  await choose()
  fireEvent.change(screen.getByLabelText('Agrupamento'),{target:{value:'fund'}})
  fireEvent.submit(screen.getByRole('form',{name:'Consultar orçamento versus realizado'}))
  await screen.findByText('Fundo de obras')
  expect(from).toHaveBeenCalledWith('v_fund_budget_vs_actual')
  expect(screen.getByText(/R\$\s?120,00/)).toBeInTheDocument()
 })
 it('does not invent a budget or totals when the organization has none',async()=>{
  const {client}=fixture({none:true})
  render(<BudgetReport client={client} organizationId="org"/>)
  await screen.findByText(/Não há ciclo de orçamento cadastrado/)
  expect(screen.getByRole('button',{name:'Comparar orçamento'})).toBeDisabled()
 })
 it('rejects foreign tenant or non-finite amounts before rendering',async()=>{
  const first=fixture({foreign:true})
  const catalog=await loadBudgetCatalog(first.client,'org',new AbortController().signal)
  await expect(loadBudgetLines(first.client,'org',cycle,'2026-09','account',catalog,new AbortController().signal)).rejects.toThrow()
  const second=fixture({invalid:true})
  const cat=await loadBudgetCatalog(second.client,'org',new AbortController().signal)
  await expect(loadBudgetLines(second.client,'org',cycle,'2026-09','account',cat,new AbortController().signal)).rejects.toThrow()
 })
 it('never treats a partial or failed query as a zero budget',async()=>{
  const {client}=fixture({foreign:true})
  render(<BudgetReport client={client} organizationId="org"/>)
  await choose()
  fireEvent.submit(screen.getByRole('form',{name:'Consultar orçamento versus realizado'}))
  await screen.findByRole('alert')
  expect(screen.queryByText('5.1 — Energia')).not.toBeInTheDocument()
 })
})
