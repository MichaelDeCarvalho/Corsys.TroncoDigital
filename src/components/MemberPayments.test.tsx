import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { MemberPayments } from './MemberPayments'
import { loadMemberLedger, exactPaymentAmount } from '../lib/member-payments'

const id='faaf76e4-d796-430f-929f-71df5beaf832'
const member='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const payment='559ba052-c408-4418-b806-0c0c4b8e3603'
const charge='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
const method='86dfe2ea-01a2-4961-b106-91e8abf9ba5a'
const account='bc5c9f36-88c3-48a2-b3aa-778ad8fe69dd'

function fixture(options:{foreign?:boolean;available?:string;open?:string;methods?:boolean;invalid?:boolean}={}) {
 const records:Record<string,unknown[]> = {
  members:[{id:member,organization_id:'org',full_name:'Integrante TESTE',status:'active'}],
  payment_methods:options.methods===false?[]:[{id:method,organization_id:'org',name:'PIX',active:true}],
  financial_accounts:[{id:account,organization_id:'org',name:'Conta Teste',account_type:'bank',active:true}],
  v_charge_balances:[{charge_id:charge,organization_id:options.foreign?'other':'org',member_id:member,
   description:'Mensalidade Teste',due_date:'2030-01-10',open_amount:options.open??'120.00',
   is_cancelled:false,integrity_ok:options.invalid?false:true}],
  v_payment_balances:[{payment_id:payment,organization_id:'org',member_id:member,payment_date:'2030-01-09',
   amount:'90.00',allocated_amount:'40.00',available_amount:options.available??'50.00',
   is_reversed:false,integrity_ok:true}],
 }
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:records[table],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,from,records}
}
async function selectMember() {
 await screen.findByLabelText('Integrante')
 fireEvent.change(screen.getByLabelText('Integrante'),{target:{value:member}})
 await screen.findByLabelText('Valor recebido (R$)')
}
function set(label:string,value:string) {
 fireEvent.change(screen.getByLabelText(label),{target:{value}})
}
describe('Member payment lifecycle',()=>{
 it('normalizes exact payment cents and rejects invalid financial values',()=>{
  expect(exactPaymentAmount('150.10')).toBe('150.10')
  expect(()=>exactPaymentAmount('NaN')).toThrow()
  expect(()=>exactPaymentAmount('-5.00')).toThrow()
  expect(()=>exactPaymentAmount('1.999')).toThrow()
 })
 it('registers a member payment with exact dates, accounts and idempotency key',async()=>{
  const {client,rpc}=fixture()
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  set('Data do pagamento','2030-01-09')
  fireEvent.change(within(screen.getByRole('form',{name:'Registrar pagamento de integrante'})).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  set('Valor recebido (R$)','125,50')
  set('Forma de pagamento',method)
  set('Conta de caixa/banco ativa',account)
  fireEvent.submit(screen.getByRole('form',{name:'Registrar pagamento de integrante'}))
  await screen.findByText('Operação confirmada. O extrato foi atualizado.')
  expect(rpc).toHaveBeenCalledWith('register_payment',expect.objectContaining({
   p_organization_id:'org',p_member_id:member,p_payment_date:'2030-01-09',
   p_accounting_period:'2030-01-01',p_amount:'125.50',
   p_payment_method_id:method,p_financial_account_id:account,
   p_idempotency_key:expect.any(String),
  }))
 })
 it('records an explicit allocation only within available credit and open charge',async()=>{
  const {client,rpc}=fixture()
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  set('Pagamento com crédito disponível',payment)
  set('Cobrança em aberto',charge)
  set('Valor a alocar (R$)','45,50')
  fireEvent.change(within(screen.getByRole('form',{name:'Alocar pagamento à cobrança'})).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.submit(screen.getByRole('form',{name:'Alocar pagamento à cobrança'}))
  await screen.findByText('Operação confirmada. O extrato foi atualizado.')
  expect(rpc).toHaveBeenCalledWith('allocate_payment_to_charge',expect.objectContaining({
   p_organization_id:'org',p_payment_id:payment,p_charge_id:charge,
   p_amount:'45.50',p_accounting_period:'2030-01-01',
  }))
 })
 it('prevents an over-allocation before any RPC and never infers global balances',async()=>{
  const {client,rpc}=fixture({available:'5.00'})
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  set('Pagamento com crédito disponível',payment)
  set('Cobrança em aberto',charge)
  set('Valor a alocar (R$)','7,00')
  fireEvent.change(within(screen.getByRole('form',{name:'Alocar pagamento à cobrança'})).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.submit(screen.getByRole('form',{name:'Alocar pagamento à cobrança'}))
  await screen.findByText('Valor maior que o crédito ou o saldo em aberto. Atualize antes de alocar.')
  expect(rpc).not.toHaveBeenCalled()
  expect(screen.getByText(/não use os valores desta página como saldo global/i)).toBeInTheDocument()
 })
 it('reverses a payment via idempotent RPC with mandatory reason',async()=>{
  const {client,rpc}=fixture()
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  set('Pagamento',payment)
  set('Competência do estorno','2030-02')
  set('Motivo do estorno','Pagamento registrado em duplicidade')
  fireEvent.submit(screen.getByRole('form',{name:'Estornar pagamento de integrante'}))
  await screen.findByText('Operação confirmada. O extrato foi atualizado.')
  expect(rpc).toHaveBeenCalledWith('reverse_member_payment_idempotent',expect.objectContaining({
   p_organization_id:'org',p_payment_id:payment,p_accounting_period:'2030-02-01',
   p_reason:'Pagamento registrado em duplicidade',
  }))
 })
 it('resubmits an uncertain payment operation with the identical key and payload',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('transport'))
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  set('Data do pagamento','2030-01-09')
  fireEvent.change(within(screen.getByRole('form',{name:'Registrar pagamento de integrante'})).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  set('Valor recebido (R$)','25,00')
  set('Forma de pagamento',method)
  set('Conta de caixa/banco ativa',account)
  fireEvent.submit(screen.getByRole('form',{name:'Registrar pagamento de integrante'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  expect(screen.getByRole('button',{name:'Registrar pagamento'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('does not allow mutation when a charge belongs to another organization',async()=>{
  const {client,rpc}=fixture({foreign:true})
  render(<MemberPayments client={client} organizationId="org"/>)
  await screen.findByLabelText('Integrante')
  fireEvent.change(screen.getByLabelText('Integrante'),{target:{value:member}})
  await screen.findByText('Não foi possível verificar o extrato. Nenhuma operação deve ser realizada sem consulta íntegra.')
  expect(screen.queryByRole('form',{name:'Registrar pagamento de integrante'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('refuses to display inconsistent payment/charge integrity as valid',async()=>{
  const {client,rpc}=fixture({invalid:true})
  render(<MemberPayments client={client} organizationId="org"/>)
  await screen.findByLabelText('Integrante')
  fireEvent.change(screen.getByLabelText('Integrante'),{target:{value:member}})
  await screen.findByText('Não foi possível verificar o extrato. Nenhuma operação deve ser realizada sem consulta íntegra.')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('requires active payment methods before allowing a new payment',async()=>{
  const {client,rpc}=fixture({methods:false})
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  expect(screen.getByRole('button',{name:'Registrar pagamento'})).toBeDisabled()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('guards the ledger from stale member responses in the loader',async()=>{
  const {client,records}=fixture()
  records.v_payment_balances=[{...records.v_payment_balances[0] as Record<string,unknown>,member_id:'other'}]
  await expect(loadMemberLedger(client,'org',member,new AbortController().signal)).rejects.toThrow()
 })
 it('hides FIFO allocation when no payment has available credit and keeps manual allocation',async()=>{
  const {client}=fixture({available:'0.00'})
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  expect(screen.getByRole('form',{name:'Alocar pagamento à cobrança'})).toBeInTheDocument()
  expect(screen.queryByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})).not.toBeInTheDocument()
 })
 it('requires explicit confirmation, calls allocate_payment_fifo and updates credit, charges and allocations on success',async()=>{
  const {client,rpc,records}=fixture()
  rpc.mockImplementation(async()=>{
   records.v_payment_balances=[{
    payment_id:payment,organization_id:'org',member_id:member,payment_date:'2030-01-09',
    amount:'90.00',allocated_amount:'90.00',available_amount:'0.00',
    is_reversed:false,integrity_ok:true,
   }]
   records.v_charge_balances=[{
    charge_id:charge,organization_id:'org',member_id:member,
    description:'Mensalidade Teste',due_date:'2030-01-10',open_amount:'70.00',
    is_cancelled:false,integrity_ok:true,
   }]
   return {data:0,error:null}
  })
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  expect(screen.getByRole('form',{name:'Alocar pagamento à cobrança'})).toBeInTheDocument()
  const fifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  const submitButton=within(fifoForm).getByRole('button',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  expect(submitButton).toBeDisabled()
  fireEvent.submit(fifoForm)
  expect(rpc).not.toHaveBeenCalled()
  fireEvent.change(within(fifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(fifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  expect(submitButton).toBeDisabled()
  fireEvent.click(within(fifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)'))
  expect(submitButton).toBeEnabled()
  fireEvent.click(submitButton)
  await screen.findByText(/Baixa FIFO confirmada\./)
  await screen.findByText(/O extrato foi atualizado\./)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('allocate_payment_fifo',{
   p_organization_id:'org',
   p_payment_id:payment,
   p_accounting_period:'2030-01-01',
  })
  await waitFor(()=>{
   expect(screen.getByText(/Mensalidade Teste — vence .* — em aberto R\$\s*70,00/)).toBeInTheDocument()
   expect(screen.queryByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})).not.toBeInTheDocument()
  })
  const paymentsTable=screen.getByRole('region',{name:'Pagamentos consultados'})
  expect(within(paymentsTable).getAllByText(/R\$\s*90,00/).length).toBeGreaterThanOrEqual(2)
  expect(within(paymentsTable).getByText(/R\$\s*0,00/)).toBeInTheDocument()
 })
 it('keeps financial actions blocked while post-FIFO ledger read is pending or fails and recovers without repeating RPC',async()=>{
  const {client,rpc,records}=fixture()
  let ledgerLoads=0
  let resolveSecondRead!:((value:{data:unknown;error:unknown})=>void)
  const baseFrom=client.from
  ;(client as unknown as {from:ReturnType<typeof vi.fn>}).from=vi.fn((table:string)=>{
   if(table==='v_charge_balances'){
    ledgerLoads++
    if(ledgerLoads===2){
     const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
      abortSignal:()=>new Promise(resolve=>{resolveSecondRead=resolve})}
     return chain
    }
   }
   return baseFrom(table)
  })
  rpc.mockImplementationOnce(async()=>{
   records.v_payment_balances=[{
    payment_id:payment,organization_id:'org',member_id:member,payment_date:'2030-01-09',
    amount:'90.00',allocated_amount:'90.00',available_amount:'0.00',
    is_reversed:false,integrity_ok:true,
   }]
   records.v_charge_balances=[{
    charge_id:charge,organization_id:'org',member_id:member,
    description:'Mensalidade Teste',due_date:'2030-01-10',open_amount:'70.00',
    is_cancelled:false,integrity_ok:true,
   }]
   return {data:0,error:null}
  })
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  const fifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  fireEvent.change(within(fifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(fifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.click(within(fifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)'))
  fireEvent.submit(fifoForm)
  await screen.findByText(/Baixa FIFO confirmada\..*O extrato está sendo atualizado\./)
  await waitFor(()=>expect(ledgerLoads).toBe(2))
  expect(screen.getByLabelText('Integrante')).toBeDisabled()
  expect(screen.queryByRole('form',{name:'Registrar pagamento de integrante'})).not.toBeInTheDocument()
  resolveSecondRead({data:null,error:new Error('ledger read failed')})
  await screen.findByText('O extrato está indisponível. Faça uma nova consulta para conferir os saldos, sem repetir a operação.')
  expect(screen.getByText(/Baixa FIFO confirmada\./)).toBeInTheDocument()
  expect(screen.getByLabelText('Integrante')).toBeDisabled()
  expect(screen.queryByRole('form',{name:'Registrar pagamento de integrante'})).not.toBeInTheDocument()
  expect(rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:'Nova consulta'}))
  await screen.findByText(/Baixa FIFO confirmada\. Crédito restante: R\$\s*0,00\. O extrato foi atualizado\./)
  expect(screen.getByLabelText('Integrante')).toBeEnabled()
  expect(screen.getByRole('form',{name:'Registrar pagamento de integrante'})).toBeInTheDocument()
  expect(screen.getByText(/Mensalidade Teste — vence .* — em aberto R\$\s*70,00/)).toBeInTheDocument()
  expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('blocks duplicate FIFO submissions while the RPC call is in flight',async()=>{
  const {client,rpc}=fixture()
  let resolveRpc!:((value:{data:number;error:null})=>void)
  rpc.mockImplementation(()=>new Promise(resolve=>{resolveRpc=resolve}))
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  const fifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  const submitButton=within(fifoForm).getByRole('button',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  fireEvent.change(within(fifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(fifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.click(within(fifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)'))
  fireEvent.click(submitButton)
  expect(submitButton).toBeDisabled()
  fireEvent.click(submitButton)
  fireEvent.submit(fifoForm)
  expect(rpc).toHaveBeenCalledTimes(1)
  resolveRpc({data:10,error:null})
  await screen.findByText(/Baixa FIFO confirmada\..*O extrato foi atualizado\./)
 })
 it('handles FIFO permission and concurrency errors without retrying',async()=>{
  const {client,rpc}=fixture()
  rpc.mockResolvedValueOnce({data:null,error:{code:'55P03',message:'lock timeout'}})
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  const fifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  fireEvent.change(within(fifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(fifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.click(within(fifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)'))
  fireEvent.submit(fifoForm)
  await screen.findByText('O registro foi alterado. Atualize antes de realizar nova operação.')
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
  expect(within(screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'}))
   .getByRole('button',{name:'Baixar pelos débitos mais antigos (FIFO)'})).toBeDisabled()
 })
 it('reloads ledger state after an uncertain FIFO response before allowing another attempt',async()=>{
  const {client,rpc,records}=fixture()
  let ledgerLoads=0
  const baseFrom=client.from
  ;(client as unknown as {from:ReturnType<typeof vi.fn>}).from=vi.fn((table:string)=>{
   if(table==='v_charge_balances'){
    ledgerLoads++
    if(ledgerLoads===2){
     const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,
      abortSignal:()=>Promise.resolve({data:null,error:new Error('reload failed')})}
     return chain
    }
   }
   return baseFrom(table)
  })
  rpc.mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce({data:0,error:null})
  render(<MemberPayments client={client} organizationId="org"/>)
  await selectMember()
  const fifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  fireEvent.change(within(fifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(fifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.click(within(fifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)'))
  fireEvent.submit(fifoForm)
  await screen.findByText('Não foi possível recarregar o extrato após resposta incerta. Recarregue os dados antes de tentar novamente.')
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
  expect(screen.queryByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})).not.toBeInTheDocument()
  records.v_payment_balances=[{
   payment_id:payment,organization_id:'org',member_id:member,payment_date:'2030-01-09',
   amount:'90.00',allocated_amount:'60.00',available_amount:'30.00',
   is_reversed:false,integrity_ok:true,
  }]
  fireEvent.click(screen.getByRole('button',{name:'Recarregar dados'}))
  await screen.findByText('Resposta anterior da baixa FIFO foi incerta; os dados foram recarregados. Confira crédito, títulos e alocações antes de uma nova tentativa.')
  const reloadedFifoForm=screen.getByRole('form',{name:'Baixar pelos débitos mais antigos (FIFO)'})
  const confirmBox=within(reloadedFifoForm).getByLabelText('Confirmar baixa automática pelos débitos mais antigos (FIFO)') as HTMLInputElement
  expect(confirmBox.checked).toBe(false)
  fireEvent.change(within(reloadedFifoForm).getByLabelText('Pagamento elegível para FIFO'),{target:{value:payment}})
  fireEvent.change(within(reloadedFifoForm).getByLabelText('Competência contábil'),{target:{value:'2030-01'}})
  fireEvent.click(confirmBox)
  fireEvent.submit(reloadedFifoForm)
  await screen.findByText(/Baixa FIFO confirmada\..*O extrato foi atualizado\./)
  expect(rpc).toHaveBeenCalledTimes(2)
 })
})
