import {useEffect,useRef,useState,type FormEvent} from 'react'
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
 const [threadRevision,setThreadRevision]=useState(0)
 const [replyText,setReplyText]=useState(''),[nextStatus,setNextStatus]=useState('')
 const [replyError,setReplyError]=useState(''),[replySuccess,setReplySuccess]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const command=useRef<{args:Record<string,unknown>}|null>(null),guard=useRef(false),mounted=useRef(false)
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
       <td><button className="secondary" disabled={pending||uncertain} onClick={()=>{
         setSelected(ticket);setReplyText('');setNextStatus('');setReplyError('');setReplySuccess(false)
        }} type="button">
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
