import {fireEvent,render,screen} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {InstitutionalReversals} from './InstitutionalReversals'
import {loadInstitutionalMovements} from '../lib/institutional-reversals'
const org='94b84958-4dd9-435d-9a4e-244220835d70',other='7a6aa771-524d-4d5a-9d38-7006175e1cb4'
const id='b6116441-5a43-4661-8d5b-1a844c48f6b5'
const payment={id,organization_id:org,payment_date:'2026-10-15',amount:'1.00',reference:'DEV expense'}
const receipt={...payment,payment_date:undefined,receipt_date:'2026-10-15',reference:'DEV income'}
function fixture(overrides:Record<string,unknown>={}){
 const tables:Record<string,unknown>={institutional_payable_payments:[payment],institutional_receipts:[receipt],
  institutional_payable_payment_reversals:[],institutional_receipt_reversals:[],...overrides}
 const from=vi.fn((name:string)=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,in:()=>q,limit:()=>q,abortSignal:()=>Promise.resolve({data:tables[name],error:null})};return q
 })
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,rpc,from,tables}
}
async function choose(){fireEvent.click(await screen.findByRole('button',{name:`Selecionar estorno ${id.slice(0,8)}`}))}
function confirm(){
 fireEvent.change(screen.getByLabelText('Justificativa do estorno institucional'),{target:{value:'DEV correção autorizada'}})
 fireEvent.change(screen.getByLabelText('Digite ESTORNAR para o movimento institucional'),{target:{value:'ESTORNAR'}})
 fireEvent.submit(screen.getByRole('form',{name:'Confirmar estorno institucional'}))
}
describe('institutional reversal UI',()=>{
 it.each(['payable_payment','institutional_receipt'] as const)('confirms %s with exact identity and refreshes its status',async kind=>{
  const f=fixture();render(<InstitutionalReversals client={f.client} organizationId={org}/>)
  if(kind==='institutional_receipt'){
   await screen.findByText('DEV expense');fireEvent.change(screen.getByLabelText('Tipo de movimento'),{target:{value:kind}})
   await screen.findByText('DEV income')
  }
  await choose();expect(screen.getByRole('button',{name:'Confirmar estorno institucional'})).toBeDisabled()
  f.rpc.mockImplementation(async()=>{
   f.tables[kind==='payable_payment'?'institutional_payable_payment_reversals':'institutional_receipt_reversals']=[{
    [kind==='payable_payment'?'payment_id':'receipt_id']:id,organization_id:org,reversal_date:'2026-10-15',reason:'DEV estorno'}]
   return {data:id,error:null}
  })
  confirm();await screen.findByText('Estornado')
  expect(f.rpc).toHaveBeenCalledWith('reverse_tenant_institutional_movement',{
   p_organization_id:org,p_kind:kind,p_movement_id:id,p_reversal_date:'2026-10-15',p_reason:'DEV correção autorizada',p_idempotency_key:expect.any(String)})
  expect(screen.queryByRole('button',{name:/Selecionar estorno/})).not.toBeInTheDocument()
 })
 it('retains the identical request after timeout and refuses another form submission',async()=>{
  const f=fixture();f.rpc.mockRejectedValueOnce(Error('timeout')).mockResolvedValueOnce({data:id,error:null})
  render(<InstitutionalReversals client={f.client} organizationId={org}/>);await choose();confirm()
  await screen.findByRole('button',{name:'Verificar estorno com a mesma chave'})
  expect(screen.getByLabelText('Tipo de movimento')).toBeDisabled()
  fireEvent.submit(screen.getByRole('form',{name:'Confirmar estorno institucional'}));expect(f.rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button',{name:'Verificar estorno com a mesma chave'}))
  await screen.findByText(/Estorno institucional confirmado/)
  expect(f.rpc.mock.calls[1]).toEqual(f.rpc.mock.calls[0])
 })
 it('treats a different response ID as unconfirmed, without claiming success',async()=>{
  const f=fixture();f.rpc.mockResolvedValue({data:other,error:null})
  render(<InstitutionalReversals client={f.client} organizationId={org}/>);await choose();confirm()
  await screen.findByRole('button',{name:'Verificar estorno com a mesma chave'})
  expect(screen.queryByText(/Estorno institucional confirmado/)).not.toBeInTheDocument()
 })
 it('explains a server business rejection and refreshes without retry',async()=>{
  const f=fixture();f.rpc.mockResolvedValue({data:null,error:{code:'55000'}})
  render(<InstitutionalReversals client={f.client} organizationId={org}/>);await choose();confirm()
  expect(await screen.findByRole('alert')).toHaveTextContent('conciliação desfeita')
  expect(f.rpc).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:'Verificar estorno com a mesma chave'})).not.toBeInTheDocument()
 })
 it('ignores a late success after switching organization',async()=>{
  const f=fixture();let resolve!:(v:{data:string;error:null})=>void
  f.rpc.mockReturnValue(new Promise(r=>{resolve=r}))
  const view=render(<InstitutionalReversals client={f.client} organizationId={org}/>);await choose();confirm()
  view.rerender(<InstitutionalReversals client={f.client} organizationId={other}/>);resolve({data:id,error:null})
  await screen.findByRole('alert');expect(screen.queryByText('DEV expense')).not.toBeInTheDocument()
  expect(screen.queryByText(/Estorno institucional confirmado/)).not.toBeInTheDocument()
 })
 it('rejects a reversal date before the movement without an RPC',async()=>{
  const f=fixture();render(<InstitutionalReversals client={f.client} organizationId={org}/>);await choose()
  fireEvent.change(screen.getByLabelText('Data do estorno institucional'),{target:{value:'2026-10-14'}})
  confirm();await screen.findByRole('alert');expect(f.rpc).not.toHaveBeenCalled()
 })
})
describe('institutional movement history integrity',()=>{
 it.each([
  ['foreign fact',{institutional_payable_payments:[{...payment,organization_id:other}]}],
  ['duplicate fact',{institutional_payable_payments:[payment,payment]}],
  ['invalid amount',{institutional_payable_payments:[{...payment,amount:'NaN'}]}],
  ['impossible date',{institutional_payable_payments:[{...payment,payment_date:'2026-02-30'}]}],
  ['incomplete history',{institutional_payable_payments:Array.from({length:151},()=>payment)}],
  ['foreign reversal',{institutional_payable_payment_reversals:[{payment_id:id,organization_id:other,reversal_date:'2026-10-15',reason:'DEV'}]}],
  ['unknown reversed ID',{institutional_payable_payment_reversals:[{payment_id:other,organization_id:org,reversal_date:'2026-10-15',reason:'DEV'}]}],
  ['duplicate reversal',{institutional_payable_payment_reversals:Array.from({length:2},()=>({payment_id:id,organization_id:org,reversal_date:'2026-10-15',reason:'DEV'}))}],
  ['earlier reversal',{institutional_payable_payment_reversals:[{payment_id:id,organization_id:org,reversal_date:'2026-10-14',reason:'DEV'}]}],
 ] as const)('rejects %s',async(_name,overrides)=>{
  const f=fixture(overrides);await expect(loadInstitutionalMovements(f.client,org,'payable_payment',new AbortController().signal)).rejects.toThrow()
 })
 it('does not query reversal history for an empty scoped list',async()=>{
  const f=fixture({institutional_payable_payments:[]})
  await expect(loadInstitutionalMovements(f.client,org,'payable_payment',new AbortController().signal)).resolves.toEqual([])
  expect(f.from).toHaveBeenCalledTimes(1)
 })
})
