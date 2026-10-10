import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {DailyCashFlow} from '../components/DailyCashFlow'
import {loadDailyCashFlow,summarizeCashFlow,validateCashFlowRows,type DailyCashFlowRow} from './daily-cash-flow'
const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
const one=(date:string):DailyCashFlowRow=>({
 movement_day:date,received:'15.00',paid:'5.00',realized_net:'10.00',
 member_receivables_due:'10.00',institutional_receivables_due:'2.00',
 institution_payables_due:'4.00',projected_net:'8.00',
})
function days(from:string,to:string){
 const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z')
 const rows:DailyCashFlowRow[]=[]
 for(let t=start;t<=end;t+=86400000)rows.push(one(new Date(t).toISOString().slice(0,10)))
 return rows
}
function fakeClient(error:unknown=null){
 const rpc=vi.fn().mockImplementation((_:string,args:{p_from_date:string;p_to_date:string})=>
  Promise.resolve({data:days(args.p_from_date,args.p_to_date),error}))
 return {client:{rpc} as unknown as SupabaseClient,rpc}
}
describe('Daily tenant cash-flow read model',()=>{
 it('reconciles a complete daily interval and totals, without pagination sums',()=>{
  const rows=days('2026-09-01','2026-09-03')
  expect(validateCashFlowRows(rows,'2026-09-01','2026-09-03')).toHaveLength(3)
  expect(summarizeCashFlow(rows)).toMatchObject({
   received:45,paid:15,realized:30,receivables:36,payables:12,projected:24,
  })
 })
 it('rejects missing/duplicate dates and broken cash and obligation accounting',()=>{
  const rows=days('2026-09-01','2026-09-03')
  expect(()=>validateCashFlowRows(rows.slice(1),'2026-09-01','2026-09-03')).toThrow()
  expect(()=>validateCashFlowRows([...rows.slice(0,2),rows[1]],'2026-09-01','2026-09-03')).toThrow()
  expect(()=>validateCashFlowRows([{...one('2026-09-01'),realized_net:'99.00'}],'2026-09-01','2026-09-01')).toThrow()
  expect(()=>validateCashFlowRows([{...one('2026-09-01'),institution_payables_due:'-4.00'}],'2026-09-01','2026-09-01')).toThrow()
 })
 it('fails closed when the user requests over 93 days',async()=>{
  const {client,rpc}=fakeClient()
  await expect(loadDailyCashFlow(client,org,'2026-09-01','2027-02-01')).rejects.toThrow()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('calls the authenticated tenant RPC and renders separated actual and forecast values',async()=>{
  const {client,rpc}=fakeClient()
  render(<DailyCashFlow client={client} organizationId={org}/>)
  await screen.findByText(/Período de/)
  expect(rpc).toHaveBeenCalledWith('read_tenant_daily_cash_flow',expect.objectContaining({p_organization_id:org}))
  expect(screen.getByText(/não é saldo bancário/)).toBeInTheDocument()
  expect(screen.getByText(/não caixa efetivo/)).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
 })
 it('updates the consulted date range without inventing amounts for out-of-range records',async()=>{
  const {client,rpc}=fakeClient()
  render(<DailyCashFlow client={client} organizationId={org}/>)
  await screen.findByText(/Período de/)
  fireEvent.change(screen.getByLabelText('Data inicial'),{target:{value:'2026-09-01'}})
  fireEvent.change(screen.getByLabelText('Data final'),{target:{value:'2026-09-03'}})
  fireEvent.submit(screen.getByRole('form',{name:'Filtrar fluxo de caixa'}))
  await waitFor(()=>expect(rpc).toHaveBeenLastCalledWith('read_tenant_daily_cash_flow',{
   p_organization_id:org,p_from_date:'2026-09-01',p_to_date:'2026-09-03',
  }))
  await screen.findByText(/\(3 dias completos\)/)
 })
 it('does not render reports for unauthorized financial-reader sessions',async()=>{
  const {client}=fakeClient({code:'42501'})
  render(<DailyCashFlow client={client} organizationId={org}/>)
  await screen.findByText('Seu perfil ou assinatura não autoriza esta consulta financeira.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
 })
})
