import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterSupportQueue} from './MasterSupportQueue'
import {loadMasterTicketMessages} from '../lib/master-support'
const tid='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const org='559ba052-c408-4418-b806-0c0c4b8e3603'
const ticket={
 id:tid,ticket_seq:1001,organization_id:org,ticket_scope:'tenant',
 related_organization_id:null,subject:'Dúvida sobre tesouraria',category:'finance',
 priority:'normal',status:'new',opened_at:'2026-10-09T10:00:00Z',
 updated_at:'2026-10-09T10:05:00Z',opened_by_display:'Usuário DEV',
 first_response_seconds:'300',resolution_seconds:null,
}
const message={id:'b112d600-bf1a-4bfd-bc1c-e9e9b749b539',
 ticket_id:tid,organization_id:org,sender_kind:'platform_staff',
 visibility:'customer',body:'Resposta registrada de suporte',created_at:'2026-10-09T10:05:00Z'}
function mock(options:{denied?:boolean;foreign?:boolean;badMetric?:boolean;internal?:boolean}={}){
 const rpc=vi.fn().mockResolvedValue({data:'faaf76e4-d796-430f-929f-71df5beaf832',error:null})
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,eq:()=>chain,limit:()=>chain,range:()=>chain,
   abortSignal:()=>Promise.resolve({data:table==='v_saas_support_ticket_metrics'?
    [{...ticket,organization_id:options.internal?null:org,ticket_scope:options.internal?'internal':'tenant',first_response_seconds:options.badMetric?'-1':'300'}]:
    [{...message,organization_id:options.foreign?'other':org}],
    error:options.denied?{code:'42501'}:null})}
  return chain
 })
 return {client:{from,rpc} as unknown as SupabaseClient,from,rpc}
}
describe('Master operational support queue',()=>{
 it('shows real response metrics, ticket scope and authorized message history',async()=>{
  const {client,from}=mock()
  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  expect(screen.getByText('5 min')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Ver conversa'}))
  await screen.findByText('Resposta registrada de suporte')
  expect(from).toHaveBeenCalledWith('v_saas_support_ticket_metrics')
  expect(from).toHaveBeenCalledWith('saas_support_ticket_messages')
 })
 it('filters Master support tickets instantly by client, title or ID without page reload',async()=>{
  const {client}=mock()
  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  const input=screen.getByPlaceholderText(/Buscar por cliente, título ou ID/i)
  fireEvent.change(input,{target:{value:'DEV'}})
  expect(screen.getByText('Dúvida sobre tesouraria')).toBeInTheDocument()
  fireEvent.change(input,{target:{value:'inexistente'}})
  expect(screen.queryByText('Dúvida sobre tesouraria')).not.toBeInTheDocument()
  expect(screen.getByText(/Nenhum chamado encontrado/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Limpar busca'}))
  expect(screen.getByText('Dúvida sobre tesouraria')).toBeInTheDocument()
 })
 it('replies to a tenant ticket using idempotent Master command and a real status transition',async()=>{
  const {client,rpc}=mock()
  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  fireEvent.click(screen.getByRole('button',{name:'Ver conversa'}))
  await screen.findByText('Resposta registrada de suporte')
  fireEvent.change(screen.getByLabelText('Mensagem ao cliente'),{
   target:{value:'Resposta autorizada da plataforma'},
  })
  fireEvent.change(screen.getByLabelText('Status após resposta'),{target:{value:'working'}})
  fireEvent.submit(screen.getByRole('form',{name:'Responder chamado Master'}))
  await screen.findByText('Resposta registrada com auditoria. Histórico atualizado.')
  expect(rpc).toHaveBeenCalledWith('reply_master_tenant_support_idempotent',
   expect.objectContaining({
    p_organization_id:org,p_ticket_id:tid,
    p_message:'Resposta autorizada da plataforma',p_next_status:'working',
    p_idempotency_key:expect.any(String),
   }))
 })
 it('does not duplicate a Master response after a network interruption',async()=>{
  const {client,rpc}=mock()
  rpc.mockRejectedValueOnce(new Error('network'))
  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  fireEvent.click(screen.getByRole('button',{name:'Ver conversa'}))
  await screen.findByText('Resposta registrada de suporte')
  fireEvent.change(screen.getByLabelText('Mensagem ao cliente'),{
   target:{value:'Solicitação revisada'},
  })
  fireEvent.submit(screen.getByRole('form',{name:'Responder chamado Master'}))
  await screen.findByRole('button',{name:'Verificar envio'})
  fireEvent.click(screen.getByRole('button',{name:'Verificar envio'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(2))
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0])
 })
 it('does not offer customer replies on internal platform tickets',async()=>{
  const {client,rpc}=mock({internal:true})
  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  fireEvent.click(screen.getByRole('button',{name:'Ver conversa'}))
  await screen.findByText(/resposta por este fluxo de clientes não é permitida/)
  expect(screen.queryByRole('form',{name:'Responder chamado Master'})).not.toBeInTheDocument()
  expect(rpc).not.toHaveBeenCalled()
 })
 it('does not show tickets or messages if the backend denies access',async()=>{
  const {client}=mock({denied:true})
  render(<MasterSupportQueue client={client}/>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Dúvida sobre tesouraria')).not.toBeInTheDocument()
 })
 it('fails closed when metric values are invalid',async()=>{
  const {client}=mock({badMetric:true})
  render(<MasterSupportQueue client={client}/>)
  await screen.findByRole('alert')
  expect(screen.queryByText('Dúvida sobre tesouraria')).not.toBeInTheDocument()
 })
 it('does not accept conversation messages from another organization',async()=>{
  const {client}=mock({foreign:true})
  await expect(loadMasterTicketMessages(client,ticket,new AbortController().signal)).rejects.toThrow()
 })
})
