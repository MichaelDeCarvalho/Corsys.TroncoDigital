import {fireEvent,render,screen,within} from '@testing-library/react'
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
function mock(options:{denied?:boolean;foreign?:boolean;badMetric?:boolean}={}){
 const from=vi.fn((table:string)=>{
  const chain={select:()=>chain,order:()=>chain,eq:()=>chain,limit:()=>chain,range:()=>chain,
   abortSignal:()=>Promise.resolve({data:table==='v_saas_support_ticket_metrics'?
    [{...ticket,first_response_seconds:options.badMetric?'-1':'300'}]:
    [{...message,organization_id:options.foreign?'other':org}],
    error:options.denied?{code:'42501'}:null})}
  return chain
 })
 return {client:{from} as unknown as SupabaseClient,from}
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
