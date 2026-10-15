import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {BankReconciliation} from './BankReconciliation'
import {loadBankDetail} from '../lib/bank-reconciliation'
const org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',id='73d7be4f-bfc2-474c-a7ea-26320fb5b3a5',account='a7618966-ad8e-466b-b11d-2ca52ce6372d',line='ce7f052b-2f0b-4db0-9ff7-e29d44f0b195',payment='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
function fixture(status='validated'){
 const statement={id,organization_id:org,financial_account_id:account,file_name:'teste.csv',period_start:'2026-09-01',period_end:'2026-09-01',status}
 const data:Record<string,unknown[]>={
  bank_statement_imports:[statement],financial_accounts:[{id:account,organization_id:org,name:'Banco DEV',account_type:'bank',active:true}],v_financial_account_balances:[],
  v_bank_reconciliation_lines:[{organization_id:org,statement_line_id:line,statement_import_id:id,transaction_date:'2026-09-01',description:'PIX DEV',amount:'250.00',matched_amount:'0',reconciliation_status:'unmatched',integrity_ok:true}],
  bank_reconciliation_matches:[],bank_reconciliation_match_reversals:[],v_financial_account_movements:[{organization_id:org,financial_account_id:account,source_id:payment,movement_type:'member_payment',movement_date:'2026-09-01',signed_amount:'250.00'}],
 }
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
 const from=vi.fn((name:string)=>{const q={select:()=>q,eq:()=>q,in:()=>q,gte:()=>q,lte:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>Promise.resolve({data:data[name],error:null})};return q})
 return {client:{rpc,from} as unknown as SupabaseClient,rpc,data,statement}
}
async function choose(){
 await screen.findByRole('option',{name:/teste.csv/})
 fireEvent.change(screen.getByLabelText('Extrato para revisar'),{target:{value:id}})
 await screen.findByText('PIX DEV',{selector:'td'})
 fireEvent.change(screen.getByLabelText('Motivo da conciliação'),{target:{value:'Revisão manual DEV'}})
}
describe('bank reconciliation journey',()=>{
 it('requires explicit validation of staged imports',async()=>{
  const {client,rpc}=fixture('staged');render(<BankReconciliation client={client} organizationId={org}/>);await choose()
  expect(screen.queryByLabelText('Movimento do sistema')).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Validar extrato revisado'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Digite VALIDAR'),{target:{value:'VALIDAR'}})
  fireEvent.click(screen.getByRole('button',{name:'Validar extrato revisado'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('validate_tenant_bank_statement',expect.objectContaining({p_organization_id:org,p_import_id:id,p_reason:'Revisão manual DEV'})))
 })
 it('sends only the selected tenant, line, target and amount after confirmation',async()=>{
  const {client,rpc}=fixture();render(<BankReconciliation client={client} organizationId={org}/>);await choose()
  fireEvent.change(screen.getByLabelText('Linha do extrato'),{target:{value:line}})
  fireEvent.change(screen.getByLabelText('Movimento do sistema'),{target:{value:'member_payment:'+payment}})
  fireEvent.change(screen.getByLabelText('Valor para conciliar (R$)'),{target:{value:'250.00'}})
  expect(screen.getByRole('button',{name:'Confirmar correspondência'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Digite CONCILIAR'),{target:{value:'CONCILIAR'}})
  fireEvent.click(screen.getByRole('button',{name:'Confirmar correspondência'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('match_tenant_bank_statement',{p_organization_id:org,p_line_id:line,p_kind:'member_payment',p_target_id:payment,p_amount:'250.00',p_reason:'Revisão manual DEV',p_idempotency_key:expect.any(String)}))
 })
 it('retries an uncertain response with the identical key and payload',async()=>{
  const {client,rpc}=fixture('staged');rpc.mockRejectedValueOnce(Error('network'));render(<BankReconciliation client={client} organizationId={org}/>);await choose()
  fireEvent.change(screen.getByLabelText('Digite VALIDAR'),{target:{value:'VALIDAR'}})
  fireEvent.click(screen.getByRole('button',{name:'Validar extrato revisado'}))
  await screen.findByRole('button',{name:'Repetir mesma operação'})
  expect(screen.getByLabelText('Motivo da conciliação')).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Repetir mesma operação'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2));expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('rejects foreign scope and truncated detail without exposing match actions',async()=>{
  const {client,data,statement}=fixture();data.v_bank_reconciliation_lines=Array(501).fill(data.v_bank_reconciliation_lines[0])
  await expect(loadBankDetail(client,org,statement,new AbortController().signal)).rejects.toThrow()
  data.v_bank_reconciliation_lines=[{...(data.v_bank_reconciliation_lines[0] as object),organization_id:'foreign'}]
  await expect(loadBankDetail(client,org,statement,new AbortController().signal)).rejects.toThrow()
 })
})
