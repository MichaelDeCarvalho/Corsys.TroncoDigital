import { render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { CashFlowMovementDetail } from './CashFlowMovementDetail'

const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
const day='2026-10-01'
const data={
 organization_id:org,page:0,total:1,opening:100,closing:91,expense_net:9,
 history:[{day,balance:91}],expenses:[{category_id:'energy',category:'Energia',amount:9}],
 rows:[{movement_type:'institutional_payable_payment',movement_date:day,source_id:'payment-id',
  signed_amount:-9,account:'Caixa A',description:'Fatura original',category:'Energia'}],
}
function mount(response:unknown,error:unknown=null){
 const rpc=vi.fn(()=>({abortSignal:async()=>({data:response,error})}))
 render(<CashFlowMovementDetail client={{rpc} as unknown as SupabaseClient} organizationId={org} from={day} to={day} historical />)
 return rpc
}

it('renders real origin, category, rank and historical totals from the RPC',async()=>{
 const rpc=mount(data)
 expect(await screen.findByText('Fatura original')).toBeInTheDocument()
 expect(screen.getByRole('heading',{name:'Maiores Despesas'})).toBeInTheDocument()
 expect(screen.getByText(/Despesa líquida do período/)).toHaveTextContent(/9,00/)
 expect(rpc).toHaveBeenCalledWith('read_tenant_cash_flow_detail',{
  p_organization_id:org,p_from_date:day,p_to_date:day,p_page:0,
 })
})

it.each([{...data,organization_id:'foreign'},{...data,rows:[]},{...data,history:[]}])(
 'fails closed on foreign or incomplete results',async response=>{
  mount(response)
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar')
  expect(screen.queryByText('Fatura original')).not.toBeInTheDocument()
 },
)

it('shows the finance permission denial without financial data',async()=>{
 mount(null,{code:'42501'})
 expect(await screen.findByRole('alert')).toHaveTextContent('Seu perfil não autoriza')
 expect(screen.queryByText('Maiores Despesas')).not.toBeInTheDocument()
})

it('renders multiple movements, categories, reversals (estornos) and ranked top_expenses accurately', async () => {
 const fullData = {
  organization_id: org,
  page: 0,
  total: 3,
  opening: 1000,
  closing: 1250,
  expense_net: 350,
  history: [{ day, balance: 1250 }],
  expenses: [
   { category_id: 'rent', category: 'Aluguel do Templo', amount: 250 },
   { category_id: 'energy', category: 'Energia Elétrica', amount: 100 },
  ],
  rows: [
   {
    movement_type: 'member_payment',
    movement_date: day,
    source_id: 'pay-1111',
    signed_amount: 600,
    account: 'Banco Principal',
    description: 'Mensalidade Outubro',
    category: 'Mensalidades',
   },
   {
    movement_type: 'institutional_payable_payment',
    movement_date: day,
    source_id: 'exp-2222',
    signed_amount: -400,
    account: 'Banco Principal',
    description: 'Locação Salão',
    category: 'Aluguel do Templo',
   },
   {
    movement_type: 'institutional_payable_payment_reversal',
    movement_date: day,
    source_id: 'rev-3333',
    signed_amount: 50,
    account: 'Banco Principal',
    description: 'Estorno parcial energia',
    category: 'Energia Elétrica',
   },
  ],
 }
 mount(fullData)

 expect(await screen.findByText('Mensalidade Outubro')).toBeInTheDocument()
 expect(screen.getByText('Locação Salão')).toBeInTheDocument()
 expect(screen.getByText('Estorno parcial energia')).toBeInTheDocument()
 expect(screen.getByText('Mensalidades')).toBeInTheDocument()
 expect(screen.getByText(/Saldo inicial:.*1\.000,00.*Saldo final:.*1\.250,00/)).toBeInTheDocument()
 expect(screen.getByText(/Despesa líquida do período:.*350,00/)).toBeInTheDocument()

 // Ranked top_expenses items
 const list = screen.getByRole('list')
 const items = list.querySelectorAll('li')
 expect(items).toHaveLength(2)
 expect(items[0]).toHaveTextContent(/Aluguel do Templo.*250,00/)
 expect(items[1]).toHaveTextContent(/Energia Elétrica.*100,00/)
})
