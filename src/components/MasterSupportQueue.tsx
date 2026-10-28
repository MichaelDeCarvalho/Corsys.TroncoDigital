import {useEffect,useRef,useState,useMemo,Fragment,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadMasterTickets,loadMasterTicketMessages,type MasterTicket,
 type MasterTicketMessage} from '../lib/master-support'

export function MasterSupportQueue({client}:{client:SupabaseClient}){
 const masterStorageKey = 'v35_master_ticket_search'
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [tickets,setTickets]=useState<{rows:MasterTicket[];hasNext:boolean}|null>(null)
 const [ticketError,setTicketError]=useState('')
 const [search,setSearch]=useState(()=>{
  try{
   return sessionStorage.getItem('v35_master_ticket_search')||''
  }catch{
   return ''
  }
 })
 const [selected,setSelected]=useState<MasterTicket|null>(null)
 const [expandedId,setExpandedId]=useState<string|null>(null)
 const [messages,setMessages]=useState<MasterTicketMessage[]|null>(null)
 const [threadError,setThreadError]=useState('')
 const [threadRevision,setThreadRevision]=useState(0)
 const [replyText,setReplyText]=useState(''),[nextStatus,setNextStatus]=useState('')
 const [replyError,setReplyError]=useState(''),[replySuccess,setReplySuccess]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const command=useRef<{args:Record<string,unknown>}|null>(null),guard=useRef(false),mounted=useRef(false)

 useEffect(()=>{
  try{
   if(search){
    sessionStorage.setItem(masterStorageKey,search)
   }else{
    sessionStorage.removeItem(masterStorageKey)
   }
  }catch{}
 },[search])

 const filteredRows=useMemo(()=>{
  if(!tickets?.rows)return []
  const term=search.trim().toLowerCase()
  if(!term)return tickets.rows
  const cleanNum=term.replace(/^#/,'')
  const isNum=/^\d+$/.test(cleanNum)
  return tickets.rows.filter(ticket=>{
   if(isNum&&String(ticket.ticket_seq)===cleanNum)return true
   if(ticket.id.toLowerCase().includes(term))return true
   if(`#${ticket.ticket_seq}`.toLowerCase().includes(term))return true
   if(ticket.subject.toLowerCase().includes(term))return true
   if(ticket.opened_by_display&&ticket.opened_by_display.toLowerCase().includes(term))return true
   if(ticket.organization_id&&ticket.organization_id.toLowerCase().includes(term))return true
   if(ticket.related_organization_id&&ticket.related_organization_id.toLowerCase().includes(term))return true
   if(ticket.category&&ticket.category.toLowerCase().includes(term))return true
   if(ticket.ticket_scope&&ticket.ticket_scope.toLowerCase().includes(term))return true
   return false
  })
 },[tickets?.rows,search])

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setTickets(null);setTicketError('');setSelected(null);setMessages(null)
  loadMasterTickets(client,page,controller.signal)
   .then(t=>{if(live)setTickets(t)})
   .catch(()=>{if(live)setTicketError('Fila de suporte indisponível ou incompleta para esta autenticação.')})
  return()=>{live=false;controller.abort()}
 },[client,page,revision])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setMessages(null);setThreadError('')
  if(selected)loadMasterTicketMessages(client,selected,controller.signal)
   .then(rows=>{if(live)setMessages(rows)})
   .catch(()=>{if(live)setThreadError('Não foi possível validar o histórico desta conversa.')})
  return()=>{live=false;controller.abort()}
 },[client,selected,threadRevision])
 async function run(next:{args:Record<string,unknown>}){
  if(guard.current)return
  command.current=command.current??next
  guard.current=true;setPending(true);setReplyError('');setReplySuccess(false)
  try{
   const response=await client.rpc('reply_master_tenant_support_idempotent',command.current.args)
   if(response.error)throw response.error
   if(typeof response.data!=='string'||!uuid.test(response.data))
    throw Error('Unconfirmed Master support response')
   if(mounted.current){
    command.current=null;setUncertain(false);setReplySuccess(true)
    setReplyText('');setNextStatus('');setThreadRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code
   if(['22023','23503','23505','42501','28000','55000'].includes(code??'')){
    command.current=null;setUncertain(false)
    setReplyError(code==='42501'||code==='28000'
     ?'Esta sessão não tem autorização Master com MFA ativo.'
     :'Resposta rejeitada pelo banco. Atualize o chamado e revise os dados.')
   }else{
    setUncertain(true)
    setReplyError('Envio não confirmado. Use Verificar envio para repetir a mesma mensagem com a mesma chave, sem duplicar.')
   }
  }finally{guard.current=false;if(mounted.current)setPending(false)}
 }
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!selected||selected.ticket_scope!=='tenant'||!uuid.test(selected.organization_id??'')
   ||pending||uncertain||replyText.trim().length<1||replyText.trim().length>5000)return
  void run({args:{
   p_organization_id:selected.organization_id,p_ticket_id:selected.id,
   p_message:replyText.trim(),p_next_status:nextStatus||null,
   p_idempotency_key:crypto.randomUUID(),
  }})
 }
 const priorityLabelsMap: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  normal: 'Média',
  low: 'Baixa',
 }

 function renderPriorityBadge(priorityKey: string) {
  const key = (priorityKey || '').toLowerCase()
  const label = priorityLabelsMap[key] || priorityKey
  let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-medium'

  if (key === 'urgent') {
   badgeStyle = 'bg-red-100 text-red-800 border-red-200/80 font-semibold'
  } else if (key === 'high') {
   badgeStyle = 'bg-amber-100 text-amber-900 border-amber-200/80 font-semibold'
  } else if (key === 'medium' || key === 'normal') {
   badgeStyle = 'bg-blue-100 text-blue-800 border-blue-200/80 font-medium'
  }

  return (
   <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full border ${badgeStyle}`}>
    {label}
   </span>
  )
 }

 const elapsed=(value:number|string|null)=>value===null?'Não registrado':
  `${Math.floor(Number(value)/60)} min`
 return <section className="panel" aria-label="Operação Master de suporte">
  <div className="section-title"><h2>Operação — chamados</h2>
   <button className="secondary" type="button"
    onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar chamados</button>
  </div>
  <p className="subtle">Chamados de clientes e internos são tratados separadamente. O histórico interno é restrito à plataforma. Tempo até primeira resposta e resolução são métricas de eventos reais, não contadores do navegador. Consulta somente leitura.</p>
  {ticketError&&<p role="alert" className="message error">{ticketError}</p>}
  {!tickets&&!ticketError&&<p role="status">Consultando chamados Master…</p>}
  {tickets&&<>
   <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
    <input
     id="masterTicketSearchInput"
     type="text"
     placeholder="Buscar por cliente, título ou ID (#seq / UUID)..."
     aria-label="Buscar por cliente, título ou ID"
     value={search}
     onChange={e=>setSearch(e.target.value)}
     className="w-full sm:w-80 px-3 py-1.5 text-sm border rounded-md"
    />
    {search&&<button className="secondary text-xs px-2.5 py-1.5" type="button" onClick={()=>setSearch('')}>Limpar busca</button>}
   </div>
   {search.trim() && filteredRows.length > 0 && (
    <div className="mb-3">
     <p className="text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-md border border-amber-200 inline-flex items-center gap-2 font-medium transition-all duration-300">
      <span className="relative flex h-2 w-2">
       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
       <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
      Realce ativo: {filteredRows.length} chamado(s) localizado(s) para "{search.trim()}".
     </p>
    </div>
   )}
   {!tickets.rows.length?<p>Nenhum chamado nesta página.</p>:
    !filteredRows.length?<p>Nenhum chamado encontrado para a busca "{search}".</p>:
    <div className="finance-table" role="region" aria-label="Fila de chamados da plataforma" tabIndex={0}>
     <table><thead><tr><th>Chamado</th><th>Origem</th><th>Prioridade</th><th>Status</th><th>Primeira resposta</th><th>Detalhes</th></tr></thead>
      <tbody>{filteredRows.map(ticket=>{
       const isHighlighted = Boolean(search.trim())
       const isExpanded = expandedId === ticket.id
       return (
        <Fragment key={ticket.id}>
         <tr
          className={
           isHighlighted
            ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500 transition-all duration-300 shadow-2xs'
            : ''
          }
          data-search-highlight={isHighlighted ? 'true' : 'false'}
         >
          <th scope="row">{ticket.subject}</th>
          <td>{ticket.ticket_scope==='internal'?'Interno':(ticket.opened_by_display||'Loja cliente')}</td>
          <td>{renderPriorityBadge(ticket.priority)}</td><td>{ticket.status}</td>
          <td>{elapsed(ticket.first_response_seconds)}</td>
          <td>
           <div className="flex items-center gap-1">
            <button
             className="secondary text-xs px-2 py-1"
             type="button"
             aria-label={`Detalhes do chamado #${ticket.ticket_seq}`}
             onClick={()=>setExpandedId(v=>v===ticket.id?null:ticket.id)}
            >
             {isExpanded ? 'Ocultar' : 'Detalhes'}
            </button>
            <button className="secondary text-xs px-2 py-1" disabled={pending||uncertain} onClick={()=>{
              setSelected(ticket);setReplyText('');setNextStatus('');setReplyError('');setReplySuccess(false)
             }} type="button">
             Ver conversa
            </button>
           </div>
          </td>
         </tr>
         {isExpanded && (
          <tr key={`${ticket.id}-drawer`} className="bg-slate-50 border-b">
           <td colSpan={6} className="p-3">
            <div className="p-3 bg-white border rounded shadow-2xs space-y-3 text-xs text-slate-700">
             <div className="flex justify-between items-center border-b pb-2">
              <strong className="text-slate-900">Histórico & Detalhes — Chamado #{ticket.ticket_seq}</strong>
              <span className="text-slate-500 font-mono text-[11px]">{ticket.organization_id || 'Uso interno da plataforma'}</span>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
               <p className="font-semibold text-slate-800 uppercase text-[11px] mb-1">Métricas & Histórico</p>
               <ul className="space-y-1 text-slate-600">
                <li>• Abertura: {new Date(ticket.opened_at).toLocaleString('pt-BR')}</li>
                <li>• Última Atualização: {new Date(ticket.updated_at).toLocaleString('pt-BR')}</li>
                <li>• Primeira Resposta: {elapsed(ticket.first_response_seconds)}</li>
                <li>• Tempo de Resolução: {elapsed(ticket.resolution_seconds)}</li>
               </ul>
              </div>
              <div>
               <p className="font-semibold text-slate-800 uppercase text-[11px] mb-1">Anexos & Documentos</p>
               <p className="text-slate-500 bg-slate-50 p-2 rounded border text-[11px]">Nenhum anexo extra registrado. Comprovantes e arquivos podem ser anexados na mensagem da conversa.</p>
              </div>
             </div>
             <div className="flex justify-end gap-2 pt-1 border-t">
              <button type="button" className="secondary text-xs px-2.5 py-1" onClick={()=>setExpandedId(null)}>Recolher</button>
              <button type="button" className="primary text-xs px-2.5 py-1" onClick={()=>{
                setSelected(ticket);setReplyText('');setNextStatus('');setReplyError('');setReplySuccess(false)
               }}>Abrir conversa completa</button>
             </div>
            </div>
           </td>
          </tr>
         )}
        </Fragment>
       )
      })}</tbody>
     </table>
    </div>}
    <div className="finance-pagination">
     <button className="secondary" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button>
     <span role="status">Página {page+1} — {tickets.rows.length} chamados</span>
     <button className="secondary" disabled={!tickets.hasNext} onClick={()=>setPage(v=>v+1)}>Próxima</button>
    </div>
    {selected&&<section className="panel" aria-label="Conversa de suporte selecionada">
     <h3>{selected.subject} — {selected.ticket_scope==='internal'?'Chamado interno':'Chamado da Loja'}</h3>
     <p className="subtle">Status: {selected.status}. Resolução:
      {elapsed(selected.resolution_seconds)}.</p>
     {threadError&&<p role="alert" className="message error">{threadError}</p>}
     {!messages&&!threadError&&<p role="status">Consultando mensagens…</p>}
     {messages&&(messages.length? <ol className="support-messages">
      {messages.map(message=><li key={message.id} className="panel">
       <p><strong>{message.sender_kind}</strong> · {message.visibility==='internal'?'Nota interna':'Visível ao cliente'} · {new Date(message.created_at).toLocaleString('pt-BR')}</p>
       <p>{message.body}</p>
      </li>)}
     </ol>:<p>Sem mensagens registradas neste chamado.</p>)}
     {selected.ticket_scope==='tenant'&&<form aria-label="Responder chamado Master" onSubmit={submit}>
      <fieldset disabled={pending||uncertain}>
       <legend>Responder chamado de Loja</legend>
       <label htmlFor="master-reply-message">Mensagem ao cliente</label>
       <textarea id="master-reply-message" required maxLength={5000} rows={4}
        value={replyText} onChange={e=>setReplyText(e.target.value)}/>
       <label htmlFor="master-reply-status">Status após resposta</label>
       <select id="master-reply-status" value={nextStatus} onChange={e=>setNextStatus(e.target.value)}>
        <option value="">Manter situação atual</option>
        <option value="new">Novo</option><option value="triage">Triagem</option>
        <option value="working">Em atendimento</option>
        <option value="waiting_client">Aguardando cliente</option>
        <option value="resolved">Resolvido</option><option value="closed">Fechado</option>
       </select>
       <button className="primary" type="submit" disabled={!replyText.trim()||pending||uncertain}>
        {pending?'Registrando…':'Enviar resposta'}
       </button>
      </fieldset>
      {replySuccess&&<p role="status">Resposta registrada com auditoria. Histórico atualizado.</p>}
      {replyError&&<p role="alert" className="message error">{replyError}</p>}
      {uncertain&&<button type="button" className="secondary" disabled={pending}
       onClick={()=>{if(command.current)void run(command.current)}}>Verificar envio</button>}
     </form>}
     {selected.ticket_scope==='internal'&&<p className="subtle">Chamado interno: resposta por este fluxo de clientes não é permitida.</p>}
    </section>}
    <p className="subtle">A fila mostra 25 chamados por página. Respostas de clientes e mudança de status nesta tela são autorizadas e idempotentes; atribuição de operador, notas internas e sessões de suporte precisam de fluxos próprios.</p>
  </>}
 </section>
}
