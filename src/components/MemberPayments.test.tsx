import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  set('Competência contábil','2030-01')
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
  set('Competência contábil', '2030-01')
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
  set('Competência contábil','2030-01')
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
  set('Competência contábil','2030-01')
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
})
