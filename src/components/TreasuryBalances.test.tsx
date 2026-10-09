import { fireEvent,render,screen,within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { TreasuryBalances } from './TreasuryBalances'
import { checkedSigned,loadTreasuryAccounts } from '../lib/treasury-balances'

const account='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const source='faaf76e4-d796-430f-929f-71df5beaf832'
function fixture(options:{foreign?:boolean;balance?:string;many?:boolean}={}){
 const rows:Record<string,unknown[]>={
  financial_accounts:[{id:account,organization_id:'org',name:'Banco TESTE',account_type:'bank',active:true}],
  v_financial_account_balances:[{organization_id:options.foreign?'other':'org',
   financial_account_id:account,balance:options.balance??'125.10'}],
  v_financial_account_movements:[{organization_id:'org',financial_account_id:account,
   movement_date:'2026-09-10',signed_amount:'-42.10',movement_type:'payment',source_id:source}],
 }
 const from=vi.fn((table:string)=>{
  let page=0
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   range:(a:number)=>{page=a;return chain},
   abortSignal:()=>Promise.resolve({data:table==='v_financial_account_movements'&&options.many?
    (page===0?Array.from({length:26},(_,i)=>({...rows[table][0],source_id:`${source.slice(0,35)}${i%10}`}))
      :[rows[table][0]]):rows[table],error:null})}
  return chain
 })
 return {client:{from} as unknown as SupabaseClient,from}
}
describe('Treasury financial balances',()=>{
 it('shows backend-accounted balance separate from bank reconciliation and signed movements',async()=>{
  const {client}=fixture()
  render(<TreasuryBalances client={client} organizationId="org"/>)
  await screen.findByText('Banco TESTE')
  expect(screen.getByText(/R\$\s?125,10/)).toBeInTheDocument()
  const table=await screen.findByRole('region',{name:'Movimentações financeiras'})
  expect(within(table).getByText(/-R\$\s?42,10|R\$\s?-42,10/)).toBeInTheDocument()
  expect(screen.getByText(/não equivale a saldo bancário conciliado/)).toBeInTheDocument()
 })
 it('rejects unexpected balance tenant instead of showing private account values',async()=>{
  const {client}=fixture({foreign:true})
  render(<TreasuryBalances client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível consultar os saldos de caixa e banco com segurança.')
  expect(screen.queryByText('Banco TESTE')).not.toBeInTheDocument()
 })
 it('rejects NaN or arbitrarily precise financial balance',async()=>{
  expect(()=>checkedSigned('NaN')).toThrow()
  expect(()=>checkedSigned('-40.123')).toThrow()
  const {client}=fixture({balance:'Infinity'})
  await expect(loadTreasuryAccounts(client,'org',new AbortController().signal)).rejects.toThrow()
 })
 it('paginates transactions without mistaking a page total for the cash balance',async()=>{
  const {client}=fixture({many:true})
  render(<TreasuryBalances client={client} organizationId="org"/>)
  await screen.findByText('Página 1 — 25 movimentos')
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}))
  await screen.findByText('Página 2 — 1 movimentos')
  expect(screen.getByRole('button',{name:'Próxima'})).toBeDisabled()
 })
})
