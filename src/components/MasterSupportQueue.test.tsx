import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {vi} from 'vitest'
import {MasterSupportQueue} from './MasterSupportQueue'
import {loadMasterTickets,loadMasterTicketMessages} from '../lib/master-support'
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
 it('filters support on the server before pagination when opened from a client',async()=>{
  const query={
   select:vi.fn().mockReturnThis(),
   order:vi.fn().mockReturnThis(),
   eq:vi.fn().mockReturnThis(),
   range:vi.fn().mockReturnThis(),
   abortSignal:vi.fn().mockResolvedValue({data:[ticket],error:null}),
  }
  const client={from:vi.fn(()=>query)} as unknown as SupabaseClient
  const result=await loadMasterTickets(client,0,new AbortController().signal,org)
  expect(query.eq).toHaveBeenCalledWith('organization_id',org)
  expect(result.rows).toHaveLength(1)
  expect(query.range).toHaveBeenCalledWith(0,25)
 })
 it('shows which client was selected and permits returning to the global support queue',async()=>{
  const {client}=mock()
  render(<MasterSupportQueue client={client} initialOrganizationId={org}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  expect(screen.getByText(org)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Mostrar todos os chamados'}))
  await screen.findByText('Dúvida sobre tesouraria')
  expect(screen.queryByText(org)).not.toBeInTheDocument()
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

 it('manages accessible disclosure state (aria-expanded, unique valid aria-controls), switches between two tickets, restores focus on Recolher, and makes no write RPC calls',async()=>{
  const tid2='c412dda8-4ef0-4c58-9d3b-b8fee14ec699'
  const internalTicket={
   ...ticket,
   id:tid2,
   ticket_seq:1002,
   organization_id:null,
   ticket_scope:'internal',
   subject:'Manutenção interna de índices',
   opened_by_display:'Operador Master',
  }
  const rpc=vi.fn().mockResolvedValue({data:'faaf76e4-d796-430f-929f-71df5beaf832',error:null})
  const from=vi.fn((table:string)=>{
   const chain={
    select:()=>chain,order:()=>chain,eq:()=>chain,limit:()=>chain,range:()=>chain,
    abortSignal:()=>Promise.resolve({
     data:table==='v_saas_support_ticket_metrics'?[ticket,internalTicket]:[message],
     error:null,
    }),
   }
   return chain
  })
  const client={from,rpc} as unknown as SupabaseClient

  render(<MasterSupportQueue client={client}/>)
  await screen.findByText('Dúvida sobre tesouraria')
  await screen.findByText('Manutenção interna de índices')

  const btn1=screen.getByRole('button',{name:'Detalhes do chamado #1001'})
  const btn2=screen.getByRole('button',{name:'Detalhes do chamado #1002'})

  // 1 & 3. Initial collapsed state + unique, valid aria-controls pointing to existing DOM elements even when collapsed
  expect(btn1).toHaveAttribute('aria-expanded','false')
  expect(btn2).toHaveAttribute('aria-expanded','false')
  expect(btn1).toHaveTextContent('Detalhes')
  expect(btn2).toHaveTextContent('Detalhes')

  const controlsId1=btn1.getAttribute('aria-controls')
  const controlsId2=btn2.getAttribute('aria-controls')
  expect(controlsId1).toBe(`master-ticket-details-${tid}`)
  expect(controlsId2).toBe(`master-ticket-details-${tid2}`)
  expect(controlsId1).not.toBe(controlsId2)

  const panelRow1=document.getElementById(controlsId1!)!
  const panelRow2=document.getElementById(controlsId2!)!
  expect(panelRow1).not.toBeNull()
  expect(panelRow2).not.toBeNull()
  expect(panelRow1).toHaveAttribute('hidden')
  expect(panelRow1).toHaveAttribute('aria-hidden','true')
  expect(panelRow2).toHaveAttribute('hidden')
  expect(panelRow2).toHaveAttribute('aria-hidden','true')
  expect(screen.queryByRole('button',{name:'Recolher'})).not.toBeInTheDocument()

  // 2 & 4. Expand ticket #1001
  btn1.focus()
  fireEvent.click(btn1)
  expect(btn1).toHaveAttribute('aria-expanded','true')
  expect(btn1).toHaveTextContent('Ocultar')
  expect(panelRow1).not.toHaveAttribute('hidden')
  expect(panelRow1).toHaveAttribute('aria-hidden','false')
  expect(screen.getByText('Histórico & Detalhes — Chamado #1001')).toBeInTheDocument()
  expect(screen.getByText(org)).toBeInTheDocument()

  // 6 & 9. Switch directly to ticket #1002 (internal ticket): #1001 collapses and #1002 expands
  btn2.focus()
  fireEvent.click(btn2)
  expect(btn1).toHaveAttribute('aria-expanded','false')
  expect(btn1).toHaveTextContent('Detalhes')
  expect(panelRow1).toHaveAttribute('hidden')
  expect(screen.queryByText('Histórico & Detalhes — Chamado #1001')).not.toBeInTheDocument()

  expect(btn2).toHaveAttribute('aria-expanded','true')
  expect(btn2).toHaveTextContent('Ocultar')
  expect(panelRow2).not.toHaveAttribute('hidden')
  expect(screen.getByText('Histórico & Detalhes — Chamado #1002')).toBeInTheDocument()
  expect(screen.getByText('Uso interno da plataforma')).toBeInTheDocument()

  // 5. Clicking Recolher inside #1002 collapses the panel and restores focus to btn2
  const collapseBtn=screen.getByRole('button',{name:'Recolher'})
  fireEvent.click(collapseBtn)
  expect(btn2).toHaveAttribute('aria-expanded','false')
  expect(panelRow2).toHaveAttribute('hidden')
  expect(screen.queryByRole('button',{name:'Recolher'})).not.toBeInTheDocument()
  expect(btn2).toHaveFocus()

  // Expand #1001 and collapse via toggle button itself
  fireEvent.click(btn1)
  expect(btn1).toHaveAttribute('aria-expanded','true')
  fireEvent.click(btn1)
  expect(btn1).toHaveAttribute('aria-expanded','false')
  expect(panelRow1).toHaveAttribute('hidden')

  // 10. Zero write RPC calls or conversation queries triggered during expand/switch/collapse
  expect(rpc).not.toHaveBeenCalled()
  expect(from).toHaveBeenCalledTimes(1)
  expect(from).toHaveBeenCalledWith('v_saas_support_ticket_metrics')
 })

 it('clears obsolete expanded panel on search filter, refresh, organization filter reset, and pagination, and covers loading/empty states',async()=>{
  const page1Tickets=Array.from({length:26},(_,i)=>({
   ...ticket,
   id:i===0?tid:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
   ticket_seq:1001+i,
   subject:i===0?'Dúvida sobre tesouraria':`Chamado extra ${i+1}`,
  }))
  let currentPageData=page1Tickets
  const rpc=vi.fn()
  const from=vi.fn(()=>{
   const chain={
    select:()=>chain,order:()=>chain,eq:()=>chain,limit:()=>chain,range:()=>chain,
    abortSignal:()=>Promise.resolve({data:currentPageData,error:null}),
   }
   return chain
  })
  const client={from,rpc} as unknown as SupabaseClient

  render(<MasterSupportQueue client={client} initialOrganizationId={org}/>)
  // 8. Loading state shown initially
  expect(screen.getByText('Consultando chamados Master…')).toHaveAttribute('role','status')

  await screen.findByText('Dúvida sobre tesouraria')

  // Expand #1001, then filter out #1001 via search input -> clears expanded state so clearing search does not reopen stale panel
  fireEvent.click(screen.getByRole('button',{name:'Detalhes do chamado #1001'}))
  expect(screen.getByText('Histórico & Detalhes — Chamado #1001')).toBeInTheDocument()

  const searchInput=screen.getByPlaceholderText(/Buscar por cliente, título ou ID/i)
  fireEvent.change(searchInput,{target:{value:'Chamado extra 2'}})
  expect(screen.queryByText('Histórico & Detalhes — Chamado #1001')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button',{name:'Limpar busca'}))
  expect(screen.getByRole('button',{name:'Detalhes do chamado #1001'})).toHaveAttribute('aria-expanded','false')
  expect(screen.queryByText('Histórico & Detalhes — Chamado #1001')).not.toBeInTheDocument()

  // Expand #1001, then click "Mostrar todos os chamados" (organization filter reset) -> resets expanded panel
  fireEvent.click(screen.getByRole('button',{name:'Detalhes do chamado #1001'}))
  expect(screen.getByText('Histórico & Detalhes — Chamado #1001')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Mostrar todos os chamados'}))
  await screen.findByText('Dúvida sobre tesouraria')
  expect(screen.getByRole('button',{name:'Detalhes do chamado #1001'})).toHaveAttribute('aria-expanded','false')

  // Expand #1001, then click "Atualizar chamados" -> resets expanded panel
  fireEvent.click(screen.getByRole('button',{name:'Detalhes do chamado #1001'}))
  expect(screen.getByText('Histórico & Detalhes — Chamado #1001')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Atualizar chamados'}))
  await screen.findByText('Dúvida sobre tesouraria')
  expect(screen.getByRole('button',{name:'Detalhes do chamado #1001'})).toHaveAttribute('aria-expanded','false')

  // Expand #1001, then click "Próxima" (pagination) to an empty second page -> resets expanded panel and shows empty page state
  fireEvent.click(screen.getByRole('button',{name:'Detalhes do chamado #1001'}))
  expect(screen.getByText('Histórico & Detalhes — Chamado #1001')).toBeInTheDocument()
  currentPageData=[]
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}))
  await screen.findByText('Nenhum chamado nesta página.')
  expect(screen.queryByText('Histórico & Detalhes — Chamado #1001')).not.toBeInTheDocument()
 })
})
