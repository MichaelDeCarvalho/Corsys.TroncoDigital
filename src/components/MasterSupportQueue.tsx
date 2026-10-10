import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadMasterTickets,loadMasterTicketMessages,type MasterTicket,
 type MasterTicketMessage} from '../lib/master-support'

export function MasterSupportQueue({client}:{client:SupabaseClient}){
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [tickets,setTickets]=useState<{rows:MasterTicket[];hasNext:boolean}|null>(null)
 const [ticketError,setTicketError]=useState('')
 const [selected,setSelected]=useState<MasterTicket|null>(null)
 const [messages,setMessages]=useState<MasterTicketMessage[]|null>(null)
 const [threadError,setThreadError]=useState('')
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
 },[client,selected])
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
   {!tickets.rows.length?<p>Nenhum chamado nesta página.</p>:
    <div className="finance-table" role="region" aria-label="Fila de chamados da plataforma" tabIndex={0}>
     <table><thead><tr><th>Chamado</th><th>Origem</th><th>Prioridade</th><th>Status</th><th>Primeira resposta</th><th>Detalhes</th></tr></thead>
      <tbody>{tickets.rows.map(ticket=><tr key={ticket.id}>
       <th scope="row">{ticket.subject}</th>
       <td>{ticket.ticket_scope==='internal'?'Interno':'Loja cliente'}</td>
       <td>{ticket.priority}</td><td>{ticket.status}</td>
       <td>{elapsed(ticket.first_response_seconds)}</td>
       <td><button className="secondary" onClick={()=>setSelected(ticket)} type="button">
        Ver conversa
       </button></td>
      </tr>)}</tbody>
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
    </section>}
    <p className="subtle">A fila mostra 25 chamados por página. Atualização de status, envio de resposta, atribuição de operador e sessão de suporte serão implementados em comandos próprios, com auditoria e autorização.</p>
  </>}
 </section>
}
