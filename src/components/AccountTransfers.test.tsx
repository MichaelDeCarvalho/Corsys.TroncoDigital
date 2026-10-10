import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {AccountTransfers} from './AccountTransfers'
import {loadAccountTransferPage} from '../lib/account-transfers'
const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'
const fromId='cf48c695-c424-4fd2-abbf-46ec5192a6c2'
const toId='a7618966-ad8e-466b-b11d-2ca52ce6372d'
const transferId='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const accounts=[
 {id:fromId,organization_id:org,name:'Banco DEV',account_type:'bank',active:true},
 {id:toId,organization_id:org,name:'Caixa DEV',account_type:'cash',active:true},
]
const balance=[
 {organization_id:org,financial_account_id:fromId,balance:'300.00'},
 {organization_id:org,financial_account_id:toId,balance:'10.00'},
]
const transfer={id:transferId,organization_id:org,from_account_id:fromId,to_account_id:toId,
 transfer_date:'2026-10-10',accounting_period:'2026-10-01',amount:'50.00',
 reference:'DEV-50',reason:'Teste de transferência',
}
function fixture(hasTransfer=false,hasReversal=false,override?:Record<string,unknown[]>){
 const data:Record<string,unknown[]>={
  financial_accounts:accounts,v_financial_account_balances:balance,
  financial_account_transfers:hasTransfer?[transfer]:[],
  financial_account_transfer_reversals:hasReversal?[{
   transfer_id:transferId,organization_id:org,reversal_date:'2026-10-10',reason:'DEV reverse',
  }]:[],
  ...override,
 }
 const from=vi.fn((table:string)=>{
  const query={select:()=>query,eq:()=>query,order:()=>query,
   limit:()=>query,range:()=>query,in:()=>query,
   abortSignal:()=>Promise.resolve({data:data[table],error:null})}
  return query
 })
 const rpc=vi.fn().mockResolvedValue({data:transferId,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc}
}
async function fill(){
 await screen.findByText('Não existem transferências nesta página.')
 await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar transferência'})).toBeEnabled())
 await screen.findByLabelText('Conta de origem')
 fireEvent.change(screen.getByLabelText('Conta de origem'),{target:{value:fromId}})
 fireEvent.change(screen.getByLabelText('Conta de destino'),{target:{value:toId}})
 fireEvent.change(screen.getByLabelText('Data da transferência'),{target:{value:'2026-10-10'}})
 fireEvent.change(screen.getByLabelText('Valor transferido (R$)'),{target:{value:'50,00'}})
 fireEvent.change(screen.getByLabelText('Motivo da transferência'),{target:{value:'Redistribuição interna'}})
}
describe('Account transfer and reversal',()=>{
 it('registers a tenant-scoped transfer without creating DRE transactions',async()=>{
  const {client,rpc}=fixture()
  render(<AccountTransfers client={client} organizationId={org}/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Registrar transferência bancária'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('register_tenant_account_transfer_idempotent',{
   p_organization_id:org,p_from_account_id:fromId,p_to_account_id:toId,
   p_transfer_date:'2026-10-10',p_amount:'50.00',p_reference:null,
   p_reason:'Redistribuição interna',p_idempotency_key:expect.any(String),
  }))
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/sem gerar receita ou despesa na DRE/)).toBeInTheDocument()
 })
 it('blocks an insufficient source balance in the browser and never invokes RPC',async()=>{
  const {client,rpc}=fixture()
  render(<AccountTransfers client={client} organizationId={org}/>)
  await fill()
  fireEvent.change(screen.getByLabelText('Valor transferido (R$)'),{target:{value:'500,00'}})
  fireEvent.submit(screen.getByRole('form',{name:'Registrar transferência bancária'}))
  await screen.findByRole('alert')
  expect(rpc).not.toHaveBeenCalled()
 })
 it('requires typed ESTORNAR confirmation before immutable reversal',async()=>{
  const {client,rpc}=fixture(true)
  render(<AccountTransfers client={client} organizationId={org}/>)
  await screen.findByRole('button',{name:'Selecionar para estorno'})
  fireEvent.click(screen.getByRole('button',{name:'Selecionar para estorno'}))
  expect(screen.getByRole('button',{name:'Confirmar estorno'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Data do estorno'),{target:{value:'2026-10-10'}})
  fireEvent.change(screen.getByLabelText('Justificativa do estorno'),{target:{value:'Correção autorizada'}})
  fireEvent.change(screen.getByLabelText('Digite ESTORNAR'),{target:{value:'ESTORNAR'}})
  fireEvent.submit(screen.getByRole('form',{name:'Confirmar estorno de transferência'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('reverse_tenant_account_transfer_idempotent',{
   p_organization_id:org,p_transfer_id:transferId,p_reversal_date:'2026-10-10',
   p_reason:'Correção autorizada',p_idempotency_key:expect.any(String),
  }))
 })
 it('does not offer reversal of an already reversed transfer',async()=>{
  const {client,rpc}=fixture(true,true)
  render(<AccountTransfers client={client} organizationId={org}/>)
  await screen.findByText('Estornada')
  expect(screen.queryByRole('button',{name:'Selecionar para estorno'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('keeps the idempotency key and payload during transport retry',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('connection dropped'))
  render(<AccountTransfers client={client} organizationId={org}/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Registrar transferência bancária'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
 })
 it('rejects foreign tenant transfers, duplicate transfers and malformed balances',async()=>{
  const controller=new AbortController()
  const foreign=fixture(true,false,{financial_account_transfers:[{...transfer,organization_id:'other'}]})
  await expect(loadAccountTransferPage(foreign.client,org,0,controller.signal)).rejects.toThrow()
  const duplicate=fixture(true,false,{financial_account_transfers:[transfer,transfer]})
  await expect(loadAccountTransferPage(duplicate.client,org,0,controller.signal)).rejects.toThrow()
  const invalid=fixture(true,false,{financial_account_transfers:[{...transfer,amount:'NaN'}]})
  await expect(loadAccountTransferPage(invalid.client,org,0,controller.signal)).rejects.toThrow()
 })
 it('hides transfer actions if fewer than two active mapped accounts exist',async()=>{
  const {client,rpc}=fixture(false,false,{financial_accounts:[accounts[0]],v_financial_account_balances:[balance[0]]})
  render(<AccountTransfers client={client} organizationId={org}/>)
  await screen.findByText(/precisa de pelo menos duas contas financeiras ativas/)
  expect(screen.getByRole('button',{name:'Registrar transferência'})).toBeDisabled()
  expect(rpc).not.toHaveBeenCalled()
 })
})
