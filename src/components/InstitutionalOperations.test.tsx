import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { InstitutionalOperations } from './InstitutionalOperations'
import { loadInstitutionalObligations } from '../lib/institutional-operations'
const uuid='faaf76e4-d796-430f-929f-71df5beaf832'
const payable='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const receivable='559ba052-c408-4418-b806-0c0c4b8e3603'
const catPay='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
const catRecv='bc5c9f36-88c3-48a2-b3aa-778ad8fe69dd'
const method='86dfe2ea-01a2-4961-b106-91e8abf9ba5a'
const account='d15a5af6-b90c-4a25-8e61-2a44434405ab'
function fixture(opts:{foreign?:boolean;approved?:boolean;invalid?:boolean}={}){
 const rows:Record<string,unknown[]>={
  financial_categories:[
   {id:catPay,organization_id:'org',name:'Despesas institucionais',domain:'institutional_expense',active:true},
   {id:catRecv,organization_id:'org',name:'Receita institucional',domain:'institutional_revenue',active:true},
  ],
  funds:[],payment_methods:[{id:method,organization_id:'org',name:'PIX',active:true}],
  financial_accounts:[{id:account,organization_id:'org',name:'Conta institucional',active:true}],
  v_institutional_payable_effective:[
   {payable_id:payable,organization_id:opts.foreign?'other':'org',description:'Energia do templo',
    category_id:catPay,fund_id:null,competence:'2030-01-01',
    effective_amount:'150.00',allocated_amount:'0.00',
    counterparty_name:'Concessionária',due_date:'2030-01-15',open_amount:'150.00',
    is_canceled:false,integrity_ok:!opts.invalid,approval_status:opts.approved===false?'pending':'approved'},
  ],
  v_institutional_receivable_effective:[
   {receivable_id:receivable,organization_id:'org',description:'Doação institucional',
    category_id:catRecv,fund_id:null,competence:'2030-01-01',
    effective_amount:'220.00',allocated_amount:'0.00',
    counterparty_name:'Doador',due_date:'2030-01-15',open_amount:'220.00',
    is_canceled:false,integrity_ok:true},
  ],
 }
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,abortSignal:()=>Promise.resolve({data:rows[table],error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:uuid,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,rows}
}
async function loaded(){await screen.findByLabelText('Descrição')}
function fill(label:string,value:string){fireEvent.change(screen.getByLabelText(label),{target:{value}})}
function fillCreation(category:string){
 fill('Descrição','Obrigações do mês')
 fill('Fornecedor / origem','Fornecedor TESTE')
 fill('Categoria institucional',category)
 fill('Competência da obrigação','2030-01')
 fill('Data de emissão','2030-01-02')
 fill('Data de vencimento','2030-01-10')
 fill('Competência de registro','2030-01')
 fill('Valor da obrigação (R$)','200,50')
}
async function setKind(kind:'Contas a pagar'|'Contas a receber'){
 fireEvent.click(within(screen.getByRole('group',{name:'Tipo de obrigação institucional'})).getByRole('button',{name:kind}))
 await loaded()
}
describe('Institutional treasury operations',()=>{
 it('creates payable with an expense category and an idempotency key',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fillCreation(catPay)
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('create_institutional_payable',expect.objectContaining({
   p_organization_id:'org',p_category_id:catPay,p_amount:'200.50',p_competence:'2030-01-01',
   p_accounting_period:'2030-01-01',p_idempotency_key:expect.any(String),
  }))
 })
 it('creates a distinct institutional receivable, not a member charge',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await setKind('Contas a receber')
  fillCreation(catRecv)
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('create_institutional_receivable',expect.objectContaining({
   p_category_id:catRecv,p_organization_id:'org',p_amount:'200.50',
  }))
  expect(rpc).not.toHaveBeenCalledWith('create_manual_charge',expect.anything())
 })
 it('registers only approved payable settlement with allocation limited by open amount',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação disponível',payable)
  fill('Data da liquidação','2030-01-10')
  fill('Competência da liquidação','2030-01')
  fill('Valor a liquidar (R$)','125,00')
  fill('Forma de pagamento',method)
  fill('Conta financeira ativa',account)
  fireEvent.submit(screen.getByRole('form',{name:'Liquidar obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('register_institutional_payable_payment',expect.objectContaining({
   p_organization_id:'org',p_payable_id:payable,p_amount:'125.00',
   p_allocate_amount:'125.00',p_payment_method_id:method,p_financial_account_id:account,
  }))
 })
 it('does not offer liquidation of payable requiring approval',async()=>{
  const {client,rpc}=fixture({approved:false})
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  expect(screen.getByRole('button',{name:'Registrar pagamento'})).toBeDisabled()
  expect(screen.getByText('pending')).toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('stops overpayments before RPC and refreshes against authoritative saldo',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação disponível',payable)
  fill('Data da liquidação','2030-01-10')
  fill('Competência da liquidação','2030-01')
  fill('Valor a liquidar (R$)','250,00')
  fill('Forma de pagamento',method)
  fill('Conta financeira ativa',account)
  fireEvent.submit(screen.getByRole('form',{name:'Liquidar obrigação institucional'}))
  await screen.findByText('Valor acima do saldo em aberto.')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('retries an uncertain institutional operation with unchanged key/payload',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('network'))
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fillCreation(catPay)
  fireEvent.submit(screen.getByRole('form',{name:'Cadastrar obrigação institucional'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('cancels only an eligible open payable with a reason and idempotency key',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação para cancelamento',payable)
  fill('Competência do cancelamento','2030-01')
  fill('Justificativa','Obrigação cadastrada em duplicidade')
  fireEvent.submit(screen.getByRole('form',{name:'Cancelar obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('cancel_tenant_institutional_obligation_idempotent',{
   p_organization_id:'org',p_obligation_id:payable,p_kind:'payable',
   p_accounting_period:'2030-01-01',p_reason:'Obrigação cadastrada em duplicidade',
   p_idempotency_key:expect.any(String),
  })
 })
 it('cancels a receivable as a distinct kind without cancelling an expense',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await setKind('Contas a receber')
  fill('Obrigação para cancelamento',receivable)
  fill('Competência do cancelamento','2030-01')
  fill('Justificativa','Receita institucional lançada incorretamente')
  fireEvent.submit(screen.getByRole('form',{name:'Cancelar obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('cancel_tenant_institutional_obligation_idempotent',
   expect.objectContaining({p_kind:'receivable',p_obligation_id:receivable}))
 })
 it('retries a lost cancellation response with the same payload and key',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('connection reset'))
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação para cancelamento',payable)
  fill('Competência do cancelamento','2030-01')
  fill('Justificativa','Despesa duplicada')
  fireEvent.submit(screen.getByRole('form',{name:'Cancelar obrigação institucional'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('corrects a payable after checking the effective snapshot, preserving historical amount',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação para correção',payable)
  fill('Descrição corrigida','Energia elétrica reclassificada')
  fill('Vencimento corrigido','2030-01-20')
  fill('Valor corrigido (R$)','180,50')
  fill('Competência contábil da correção','2030-01')
  fill('Justificativa da correção','Correção de nota fiscal')
  fireEvent.submit(screen.getByRole('form',{name:'Corrigir obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('correct_tenant_institutional_obligation_idempotent',expect.objectContaining({
   p_organization_id:'org',p_obligation_id:payable,p_kind:'payable',
   p_expected_state:{
    category_id:catPay,fund_id:null,description:'Energia do templo',
    competence:'2030-01-01',due_date:'2030-01-15',
    effective_amount:150,allocated_amount:0,
   },
   p_new_category_id:catPay,p_new_amount:'180.50',p_new_due_date:'2030-01-20',
   p_idempotency_key:expect.any(String),
  }))
 })
 it('corrects a receivable through its distinct posted-transaction contract',async()=>{
  const {client,rpc}=fixture()
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await setKind('Contas a receber')
  fill('Obrigação para correção',receivable)
  fill('Competência contábil da correção','2030-01')
  fill('Justificativa da correção','Correção da receita lançada')
  fireEvent.submit(screen.getByRole('form',{name:'Corrigir obrigação institucional'}))
  await screen.findByText('Operação institucional confirmada. A consulta foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('correct_tenant_institutional_obligation_idempotent',
   expect.objectContaining({p_kind:'receivable',p_obligation_id:receivable,p_new_amount:'220.00'}))
 })
 it('maintains the identical correction payload and key after an uncertain response',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('network'))
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await loaded()
  fill('Obrigação para correção',payable)
  fill('Competência contábil da correção','2030-01')
  fill('Justificativa da correção','Corrigir vencimento errado')
  fireEvent.submit(screen.getByRole('form',{name:'Corrigir obrigação institucional'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('fails closed if institutional effective data originates from another tenant',async()=>{
  const {client,rpc}=fixture({foreign:true})
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível consultar o financeiro institucional de forma íntegra.')
  expect(screen.queryByRole('form',{name:'Cadastrar obrigação institucional'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('rejects inconsistent effective records in the shared loader',async()=>{
  const {client}=fixture({invalid:true})
  await expect(loadInstitutionalObligations(client,'org','payable',new AbortController().signal)).rejects.toThrow()
 })
 it.each(['duplicate','open-total','canceled-open','approval-status'])('blocks operations on an invalid %s response',async defect=>{
  const {client,rows,rpc}=fixture()
  const row=rows.v_institutional_payable_effective[0] as Record<string,unknown>
  if(defect==='duplicate')rows.v_institutional_payable_effective.push({...row})
  if(defect==='open-total')row.open_amount='149.99'
  if(defect==='canceled-open')row.is_canceled=true
  if(defect==='approval-status')row.approval_status='unknown'
  render(<InstitutionalOperations client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível consultar o financeiro institucional de forma íntegra.')
  expect(screen.queryByRole('form',{name:'Liquidar obrigação institucional'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it.each(['duplicate','open-total','canceled-open'])('also rejects an invalid receivable %s',async defect=>{
  const {client,rows}=fixture()
  const row=rows.v_institutional_receivable_effective[0] as Record<string,unknown>
  if(defect==='duplicate')rows.v_institutional_receivable_effective.push({...row})
  if(defect==='open-total')row.open_amount='219.99'
  if(defect==='canceled-open')row.is_canceled=true
  await expect(loadInstitutionalObligations(client,'org','receivable',new AbortController().signal)).rejects.toThrow()
 })
 it.each([false,true])('accepts consistent partially allocated obligations (canceled=%s)',async canceled=>{
  const {client,rows}=fixture()
  const row=rows.v_institutional_payable_effective[0] as Record<string,unknown>
  row.allocated_amount='49.99';row.open_amount=canceled?'0.00':'100.01';row.is_canceled=canceled
  row.approval_status='missing_request'
  const result=await loadInstitutionalObligations(client,'org','payable',new AbortController().signal)
  expect(result).toHaveLength(1)
 })
})
