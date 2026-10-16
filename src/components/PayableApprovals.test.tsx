import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { PayableApprovals } from './PayableApprovals'
const id='faaf76e4-d796-430f-929f-71df5beaf832'
const request='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const payable='559ba052-c408-4418-b806-0c0c4b8e3603'
function fixture(foreign=false){
 const rows=[{organization_id:foreign?'other':'org',payable_id:payable,approval_required:true,
  minimum_approvers:2,approval_request_id:request,approvals:1,rejections:0,approval_status:'pending'}]
 const from=vi.fn(()=>{
  const chain={select:()=>chain,eq:()=>chain,limit:()=>chain,
   abortSignal:()=>Promise.resolve({data:rows,error:null})}
  return chain
 })
 const rpc=vi.fn().mockResolvedValue({data:id,error:null})
 return {client:{from,rpc} as unknown as SupabaseClient,from,rpc}
}
async function fill(){
 await screen.findByLabelText('Solicitação pendente')
 fireEvent.change(screen.getByLabelText('Solicitação pendente'),{target:{value:request}})
 fireEvent.change(screen.getByLabelText('Motivo'),{target:{value:'Despesa conferida'}})
}
describe('Institutional approval decisions',()=>{
 it('submits a per-tenant idempotent approval with reason, without paying the expense',async()=>{
  const {client,rpc}=fixture()
  render(<PayableApprovals client={client} organizationId="org"/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Decidir aprovação de despesa'}))
  await screen.findByText('Decisão registrada. A fila foi atualizada.')
  expect(rpc).toHaveBeenCalledWith('decide_payable_approval_idempotent',expect.objectContaining({
   p_organization_id:'org',p_approval_request_id:request,p_decision:'approve',
   p_reason:'Despesa conferida',p_idempotency_key:expect.any(String),
  }))
  expect(rpc).not.toHaveBeenCalledWith('register_institutional_payable_payment',expect.anything())
 })
 it('retries an uncertain vote with the exact same request',async()=>{
  const {client,rpc}=fixture()
  rpc.mockRejectedValueOnce(new Error('transport'))
  render(<PayableApprovals client={client} organizationId="org"/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Decidir aprovação de despesa'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('fails closed if the API sends another tenant approval request',async()=>{
  const {client,rpc}=fixture(true)
  render(<PayableApprovals client={client} organizationId="org"/>)
  await screen.findByText('Não foi possível carregar a fila de aprovação íntegra.')
  expect(screen.queryByRole('form',{name:'Decidir aprovação de despesa'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('handles a role denial as a definitive error, not another vote',async()=>{
  const {client,rpc}=fixture()
  rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}})
  render(<PayableApprovals client={client} organizationId="org"/>)
  await fill()
  fireEvent.submit(screen.getByRole('form',{name:'Decidir aprovação de despesa'}))
  await screen.findByText('Seu perfil não pode decidir aprovações desta Loja.')
  expect(screen.queryByRole('button',{name:'Verificar envio'})).not.toBeInTheDocument()
 })
})
