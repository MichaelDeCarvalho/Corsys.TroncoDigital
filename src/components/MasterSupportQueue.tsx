import {useEffect,useRef,useState,useMemo,Fragment,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {
 loadMasterTickets,loadMasterTicketMessages,loadMasterTicketEvents,
 loadPlatformSupportStaff,addMasterSupportInternalNote,assignMasterSupportTicket,createMasterInternalTicket,
 type MasterTicket,type MasterTicketMessage,type MasterTicketEvent,type PlatformSupportStaff
} from '../lib/master-support'
import {evaluateTicketBusinessSla} from '../lib/support-sla'

const DETERMINISTIC_CODES=new Set(['22023','23503','23505','42501','28000','55000'])

export function MasterSupportQueue({client,initialOrganizationId=''}:{client:SupabaseClient;initialOrganizationId?:string}){
 const masterStorageKey = 'v35_master_ticket_search'
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0)
 const [organizationFilter,setOrganizationFilter]=useState(initialOrganizationId)
 const [tickets,setTickets]=useState<{rows:MasterTicket[];hasNext:boolean}|null>(null)
 const [ticketError,setTicketError]=useState('')
 const [search,setSearch]=useState(()=>{
  if(initialOrganizationId)return ''
  try{
   return sessionStorage.getItem('v35_master_ticket_search')||''
  }catch{
   return ''
  }
 })
 const [scopeFilter,setScopeFilter]=useState<'all'|'tenant'|'internal'>('all')
 const [statusFilter,setStatusFilter]=useState('all')
 const [priorityFilter,setPriorityFilter]=useState('all')

 const [selected,setSelected]=useState<MasterTicket|null>(null)
 const [expandedId,setExpandedId]=useState<string|null>(null)
 const [messages,setMessages]=useState<MasterTicketMessage[]|null>(null)
 const [events,setEvents]=useState<MasterTicketEvent[]|null>(null)
 const [threadError,setThreadError]=useState('')
 const [eventsError,setEventsError]=useState('')
 const [threadRevision,setThreadRevision]=useState(0)
 const [replyText,setReplyText]=useState(''),[nextStatus,setNextStatus]=useState('')
 const [replyError,setReplyError]=useState(''),[replySuccess,setReplySuccess]=useState(false)
 const [pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false)
 const command=useRef<{args:Record<string,unknown>}|null>(null),guard=useRef(false),mounted=useRef(false)
 const detailButtonRefs=useRef<Record<string,HTMLButtonElement|null>>({})

 // M04 internal notes, triage/assignment & internal ticket states
 const [noteText,setNoteText]=useState('')
 const [noteNextStatus,setNoteNextStatus]=useState('')
 const [notePending,setNotePending]=useState(false)
 const [noteUncertain,setNoteUncertain]=useState(false)
 const [noteError,setNoteError]=useState('')
 const [noteSuccess,setNoteSuccess]=useState(false)
 const noteCmdRef=useRef<{ticketId:string;note:string;nextStatus:string|null;key:string}|null>(null)

 const [showTriage,setShowTriage]=useState(false)
 const [staffList,setStaffList]=useState<PlatformSupportStaff[]|null>(null)
 const [staffError,setStaffError]=useState('')
 const [triageStaffId,setTriageStaffId]=useState('')
 const [triagePriority,setTriagePriority]=useState<'low'|'normal'|'high'|'urgent'>('normal')
 const [triagePending,setTriagePending]=useState(false)
 const [triageUncertain,setTriageUncertain]=useState(false)
 const [triageError,setTriageError]=useState('')
 const [triageSuccess,setTriageSuccess]=useState(false)
 const triageCmdRef=useRef<{ticketId:string;staffId:string|null;priority:'low'|'normal'|'high'|'urgent'|null;key:string}|null>(null)

 const [showInternalForm,setShowInternalForm]=useState(false)
 const [intOrgId,setIntOrgId]=useState('')
 const [intSubject,setIntSubject]=useState('')
 const [intCategory,setIntCategory]=useState('operations')
 const [intPriority,setIntPriority]=useState<'low'|'normal'|'high'|'urgent'>('normal')
 const [intMessage,setIntMessage]=useState('')
 const [intPending,setIntPending]=useState(false)
 const [intUncertain,setIntUncertain]=useState(false)
 const [intError,setIntError]=useState('')
 const [intSuccess,setIntSuccess]=useState('')
 const intCmdRef=useRef<{relatedOrg:string|null;subject:string;category:string;priority:'low'|'normal'|'high'|'urgent';message:string;key:string}|null>(null)

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
  const cleanNum=term.replace(/^#/,'')
  const isNum=/^\d+$/.test(cleanNum)
  return tickets.rows.filter(ticket=>{
   if(scopeFilter!=='all'&&ticket.ticket_scope!==scopeFilter)return false
   if(statusFilter!=='all'&&ticket.status!==statusFilter)return false
   if(priorityFilter!=='all'&&ticket.priority.toLowerCase()!==priorityFilter)return false
   if(!term)return true
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
 },[tickets?.rows,search,scopeFilter,statusFilter,priorityFilter])

 useEffect(()=>{
  if(expandedId&&tickets?.rows&&!filteredRows.some(ticket=>ticket.id===expandedId)){
   setExpandedId(null)
  }
 },[expandedId,tickets?.rows,filteredRows])

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setTickets(null);setTicketError('');setSelected(null);setExpandedId(null);setMessages(null);setEvents(null)
  setShowTriage(false);setStaffList(null);setStaffError('')
  loadMasterTickets(client,page,controller.signal,organizationFilter)
   .then(t=>{if(live)setTickets(t)})
   .catch(()=>{if(live)setTicketError('Fila de suporte indisponível ou incompleta para esta autenticação.')})
  return()=>{live=false;controller.abort()}
 },[client,page,revision,organizationFilter])
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  setMessages(null);setEvents(null);setThreadError('');setEventsError('')
  if(selected){
   loadMasterTicketMessages(client,selected,controller.signal)
    .then(rows=>{if(live)setMessages(rows)})
    .catch(()=>{if(live)setThreadError('Não foi possível validar o histórico desta conversa.')})
   loadMasterTicketEvents(client,selected,controller.signal)
    .then(rows=>{if(live)setEvents(rows)})
    .catch(()=>{if(live)setEventsError('Não foi possível carregar a trilha de eventos deste chamado.')})
  }
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

 async function runInternalNote(retry=false){
  if(!selected||notePending)return
  if(!retry){
   const clean=noteText.trim()
   if(!clean)return
   noteCmdRef.current={ticketId:selected.id,note:clean,nextStatus:noteNextStatus||null,key:crypto.randomUUID()}
  }
  const cmd=noteCmdRef.current
  if(!cmd)return
  setNotePending(true);setNoteError('');setNoteSuccess(false)
  try{
   await addMasterSupportInternalNote(client,{
    ticket_id:cmd.ticketId,
    note:cmd.note,
    next_status:cmd.nextStatus,
    idempotency_key:cmd.key,
   })
   if(mounted.current){
    noteCmdRef.current=null
    setNoteUncertain(false)
    setNoteSuccess(true)
    setNoteText('')
    setNoteNextStatus('')
    setThreadRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code
   if(code&&DETERMINISTIC_CODES.has(code)){
    noteCmdRef.current=null;setNoteUncertain(false)
    setNoteError('Nota interna rejeitada pelo servidor. Revise os dados e permissões.')
   }else{
    setNoteUncertain(true)
    setNoteError('Nota interna não confirmada. Use Verificar envio para reenviar com a mesma chave.')
   }
  }finally{if(mounted.current)setNotePending(false)}
 }

 async function openTriage(){
  if(!selected)return
  const next=!showTriage
  setShowTriage(next)
  setTriageError('');setTriageSuccess(false)
  setTriagePriority((['low','normal','high','urgent'].includes(selected.priority)?selected.priority:'normal') as 'low'|'normal'|'high'|'urgent')
  if(next&&!staffList){
   setStaffError('')
   try{
    const list=await loadPlatformSupportStaff(client)
    if(mounted.current)setStaffList(list)
   }catch{
    if(mounted.current)setStaffError('Não foi possível listar operadores autorizados da plataforma.')
   }
  }
 }

 async function runTriageSave(retry=false){
  if(!selected||triagePending)return
  if(!retry){
   triageCmdRef.current={
    ticketId:selected.id,
    staffId:triageStaffId||null,
    priority:triagePriority,
    key:crypto.randomUUID(),
   }
  }
  const cmd=triageCmdRef.current
  if(!cmd)return
  setTriagePending(true);setTriageError('');setTriageSuccess(false)
  try{
   await assignMasterSupportTicket(client,{
    ticket_id:cmd.ticketId,
    assigned_staff_user_id:cmd.staffId,
    priority:cmd.priority,
    idempotency_key:cmd.key,
   })
   if(mounted.current){
    triageCmdRef.current=null
    setTriageUncertain(false)
    setTriageSuccess(true)
    setRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code
   if(code&&DETERMINISTIC_CODES.has(code)){
    triageCmdRef.current=null;setTriageUncertain(false)
    setTriageError('Não foi possível salvar a triagem/atribuição.')
   }else{
    setTriageUncertain(true)
    setTriageError('Triagem não confirmada. Use Verificar envio.')
   }
  }finally{if(mounted.current)setTriagePending(false)}
 }

 async function runCreateInternal(retry=false){
  if(intPending)return
  if(!retry){
   const cleanSub=intSubject.trim()
   const cleanMsg=intMessage.trim()
   if(cleanSub.length<3||cleanMsg.length<3){
    setIntError('Assunto e descrição com mínimo de 3 caracteres.')
    return
   }
   intCmdRef.current={
    relatedOrg:intOrgId.trim()||null,
    subject:cleanSub,
    category:intCategory,
    priority:intPriority,
    message:cleanMsg,
    key:crypto.randomUUID(),
   }
  }
  const cmd=intCmdRef.current
  if(!cmd)return
  setIntPending(true);setIntError('');setIntSuccess('')
  try{
   const id=await createMasterInternalTicket(client,{
    related_organization_id:cmd.relatedOrg,
    subject:cmd.subject,
    category:cmd.category,
    priority:cmd.priority,
    message:cmd.message,
    idempotency_key:cmd.key,
   })
   if(mounted.current){
    intCmdRef.current=null
    setIntUncertain(false)
    setIntSuccess(`Chamado interno criado (${id.slice(0,8)}).`)
    setIntOrgId('');setIntSubject('');setIntMessage('')
    setRevision(v=>v+1)
   }
  }catch(e){
   if(!mounted.current)return
   const code=(e as {code?:string}|null)?.code
   if(code&&DETERMINISTIC_CODES.has(code)){
    intCmdRef.current=null;setIntUncertain(false)
    setIntError('Chamado interno rejeitado pelo servidor.')
   }else{
    setIntUncertain(true)
    setIntError('Criação do chamado interno não confirmada. Use Verificar envio.')
   }
  }finally{if(mounted.current)setIntPending(false)}
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
   <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
    <button className="secondary" type="button"
     onClick={()=>{setPage(0);setRevision(v=>v+1)}}>Atualizar chamados</button>
    <button className="secondary" type="button" aria-expanded={showInternalForm}
     onClick={()=>{setShowInternalForm(v=>!v);setIntError('');setIntSuccess('');setIntUncertain(false)}}>
     {showInternalForm?'Fechar chamado interno':'+ Novo chamado interno'}
    </button>
   </div>
  </div>
  <p className="subtle">Chamados de clientes e internos são tratados separadamente. Notas internas são invisíveis às Lojas. SLA comercial: 1 dia útil (09h–18h Seg–Sex America/Sao_Paulo = 540 min úteis).</p>

  {showInternalForm&&<form aria-label="Criar chamado interno" onSubmit={e=>{e.preventDefault();void runCreateInternal(false)}} className="panel" style={{marginBottom:'1rem'}}>
   <h3>Novo chamado interno da plataforma</h3>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',gap:'0.75rem'}}>
    <div><label htmlFor="master-int-subject">Assunto interno</label><input id="master-int-subject" required minLength={3} maxLength={180} value={intSubject} onChange={e=>setIntSubject(e.target.value)}/></div>
    <div><label htmlFor="master-int-category">Categoria</label>
     <select id="master-int-category" value={intCategory} onChange={e=>setIntCategory(e.target.value)}>
      <option value="operations">Operações</option><option value="billing">Cobrança SaaS</option>
      <option value="technical">Técnico</option><option value="access">Acesso / MFA</option>
     </select>
    </div>
    <div><label htmlFor="master-int-priority">Prioridade inicial</label>
     <select id="master-int-priority" value={intPriority} onChange={e=>setIntPriority(e.target.value as typeof intPriority)}>
      <option value="low">Baixa</option><option value="normal">Média</option>
      <option value="high">Alta</option><option value="urgent">Urgente</option>
     </select>
    </div>
    <div><label htmlFor="master-int-org">Loja relacionada (UUID opcional)</label><input id="master-int-org" placeholder="Opcional" maxLength={36} value={intOrgId} onChange={e=>setIntOrgId(e.target.value)}/></div>
   </div>
   <div style={{marginTop:'0.75rem'}}>
    <label htmlFor="master-int-msg">Descrição / nota inicial restrita</label>
    <textarea id="master-int-msg" required minLength={3} maxLength={4000} rows={3} value={intMessage} onChange={e=>setIntMessage(e.target.value)}/>
   </div>
   {intError&&<p role="alert" className="message error" style={{marginTop:'0.5rem'}}>{intError}</p>}
   {intSuccess&&<p role="status" className="message success" style={{marginTop:'0.5rem'}}>{intSuccess}</p>}
   <div style={{marginTop:'0.75rem',display:'flex',gap:'0.5rem'}}>
    <button type="submit" className="primary" disabled={intPending||intUncertain}>{intPending?'Registrando…':'Registrar chamado interno'}</button>
    {intUncertain&&<button type="button" className="secondary" disabled={intPending} onClick={()=>void runCreateInternal(true)}>Verificar envio</button>}
   </div>
  </form>}

  {organizationFilter && (
   <div role="status" className="panel" style={{padding:'0.65rem',marginBottom:'0.75rem',display:'flex',flexWrap:'wrap',alignItems:'center',gap:'0.5rem'}}>
    <span>Chamados da Loja selecionada: <code>{organizationFilter}</code></span>
    <button type="button" className="secondary" onClick={()=>{setOrganizationFilter('');setPage(0)}}>Mostrar todos os chamados</button>
   </div>
  )}
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
    <select aria-label="Filtrar escopo do chamado" value={scopeFilter} onChange={e=>setScopeFilter(e.target.value as typeof scopeFilter)} className="px-2 py-1.5 text-sm border rounded-md">
     <option value="all">Todos escopos</option>
     <option value="tenant">Lojas clientes</option>
     <option value="internal">Internos</option>
    </select>
    <select aria-label="Filtrar status do chamado" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md">
     <option value="all">Todos status</option>
     <option value="new">Novo</option>
     <option value="triage">Triagem</option>
     <option value="working">Em atendimento</option>
     <option value="waiting_client">Aguardando cliente</option>
     <option value="resolved">Resolvido</option>
     <option value="closed">Fechado</option>
    </select>
    <select aria-label="Filtrar prioridade do chamado" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md">
     <option value="all">Todas prioridades</option>
     <option value="urgent">Urgente</option>
     <option value="high">Alta</option>
     <option value="normal">Média</option>
     <option value="low">Baixa</option>
    </select>
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
     <table><thead><tr><th>Chamado</th><th>Origem</th><th>Prioridade</th><th>Status</th><th>Primeira resposta</th><th>SLA (comercial)</th><th>Detalhes</th></tr></thead>
      <tbody>{filteredRows.map(ticket=>{
       const isHighlighted = Boolean(search.trim())
       const isExpanded = expandedId === ticket.id
       const detailsPanelId = `master-ticket-details-${ticket.id}`
       const sla = evaluateTicketBusinessSla(ticket)
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
          <td style={{fontVariantNumeric:'tabular-nums'}}>{sla.label}</td>
          <td>
           <div className="flex items-center gap-1">
            <button
             ref={el=>{detailButtonRefs.current[ticket.id]=el}}
             className="secondary text-xs px-2 py-1"
             type="button"
             aria-label={`Detalhes do chamado #${ticket.ticket_seq}`}
             aria-expanded={isExpanded}
             aria-controls={detailsPanelId}
             onClick={()=>setExpandedId(v=>v===ticket.id?null:ticket.id)}
            >
             {isExpanded ? 'Ocultar' : 'Detalhes'}
            </button>
            <button className="secondary text-xs px-2 py-1" disabled={pending||uncertain} onClick={()=>{
              if(selected!==ticket){setEvents(null);setEventsError('');setShowTriage(false)}
              setSelected(ticket);setReplyText('');setNextStatus('');setReplyError('');setReplySuccess(false)
              setNoteText('');setNoteError('');setNoteSuccess(false);setNoteUncertain(false)
              setTriageError('');setTriageSuccess(false);setTriageUncertain(false)
             }} type="button">
             Ver conversa
            </button>
           </div>
          </td>
         </tr>
         <tr
          id={detailsPanelId}
          key={`${ticket.id}-drawer`}
          hidden={!isExpanded}
          aria-hidden={!isExpanded}
          className={isExpanded ? 'bg-slate-50 border-b' : undefined}
         >
          {isExpanded && (
           <td colSpan={7} className="p-3 whitespace-normal" style={{whiteSpace:'normal',overflowWrap:'anywhere'}}>
            <div
             role="region"
             aria-label={`Histórico e detalhes do chamado #${ticket.ticket_seq}`}
             className="p-3 bg-white border rounded shadow-2xs space-y-3 text-xs text-slate-700"
            >
             <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-2">
              <strong className="text-slate-900">Histórico & Detalhes — Chamado #{ticket.ticket_seq}</strong>
              <span className="text-slate-500 font-mono text-[11px] break-all">{ticket.organization_id || 'Uso interno da plataforma'}</span>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
               <p className="font-semibold text-slate-800 uppercase text-[11px] mb-1">Métricas & Histórico</p>
               <ul className="space-y-1 text-slate-600">
                <li>• Abertura: {new Date(ticket.opened_at).toLocaleString('pt-BR')}</li>
                <li>• Última Atualização: {new Date(ticket.updated_at).toLocaleString('pt-BR')}</li>
                <li>• Primeira Resposta: {elapsed(ticket.first_response_seconds)}</li>
                <li>• Tempo de Resolução: {elapsed(ticket.resolution_seconds)}</li>
                <li>• Prazo SLA (1 dia útil · 09h–18h BRT): {new Date(sla.dueAtIso).toLocaleString('pt-BR')} ({sla.label})</li>
               </ul>
              </div>
              <div>
               <p className="font-semibold text-slate-800 uppercase text-[11px] mb-1">Anexos & Documentos</p>
               <p className="text-slate-500 bg-slate-50 p-2 rounded border text-[11px]">Nenhum anexo extra registrado. Comprovantes e arquivos podem ser anexados na mensagem da conversa.</p>
              </div>
             </div>
             <div className="flex flex-wrap justify-end gap-2 pt-1 border-t">
              <button
               type="button"
               className="secondary text-xs px-2.5 py-1"
               onClick={()=>{
                setExpandedId(null)
                detailButtonRefs.current[ticket.id]?.focus()
               }}
              >
               Recolher
              </button>
              <button type="button" className="primary text-xs px-2.5 py-1" onClick={()=>{
                if(selected!==ticket){setEvents(null);setEventsError('');setShowTriage(false)}
                setSelected(ticket);setReplyText('');setNextStatus('');setReplyError('');setReplySuccess(false)
                setNoteText('');setNoteError('');setNoteSuccess(false);setNoteUncertain(false)
                setTriageError('');setTriageSuccess(false);setTriageUncertain(false)
               }}>Abrir conversa completa</button>
             </div>
            </div>
           </td>
          )}
         </tr>
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
     <div className="section-title">
      <h3>{selected.subject} — {selected.ticket_scope==='internal'?'Chamado interno':'Chamado da Loja'}</h3>
      <button type="button" className="secondary" aria-expanded={showTriage} onClick={()=>void openTriage()}>
       {showTriage?'Fechar triagem':'Triagem e atribuição'}
      </button>
     </div>
     <p className="subtle">Status: {selected.status}. Resolução: {elapsed(selected.resolution_seconds)}. SLA: {evaluateTicketBusinessSla(selected).label}.</p>

     {showTriage&&<form aria-label="Triagem e atribuição do chamado" onSubmit={e=>{e.preventDefault();void runTriageSave(false)}} className="panel" style={{marginBottom:'1rem'}}>
      <h4>Triagem e atribuição de operador</h4>
      {staffError&&<p role="alert" className="message error">{staffError}</p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',gap:'0.75rem'}}>
       <div>
        <label htmlFor="master-triage-staff">Operador responsável</label>
        <select id="master-triage-staff" value={triageStaffId} onChange={e=>setTriageStaffId(e.target.value)}>
         <option value="">Sem atribuição</option>
         {(staffList??[]).map(s=><option key={s.user_id} value={s.user_id}>{s.role} · {s.user_id.slice(0,8)}</option>)}
        </select>
       </div>
       <div>
        <label htmlFor="master-triage-priority">Prioridade</label>
        <select id="master-triage-priority" value={triagePriority} onChange={e=>setTriagePriority(e.target.value as typeof triagePriority)}>
         <option value="low">Baixa</option><option value="normal">Média</option>
         <option value="high">Alta</option><option value="urgent">Urgente</option>
        </select>
       </div>
      </div>
      {triageError&&<p role="alert" className="message error" style={{marginTop:'0.5rem'}}>{triageError}</p>}
      {triageSuccess&&<p role="status" className="message success" style={{marginTop:'0.5rem'}}>Triagem salva com auditoria.</p>}
      <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem'}}>
       <button type="submit" className="primary" disabled={triagePending||triageUncertain}>{triagePending?'Salvando…':'Salvar triagem'}</button>
       {triageUncertain&&<button type="button" className="secondary" disabled={triagePending} onClick={()=>void runTriageSave(true)}>Verificar envio</button>}
      </div>
     </form>}

     {threadError&&<p role="alert" className="message error">{threadError}</p>}
     {!messages&&!threadError&&<p role="status">Consultando mensagens…</p>}
     {messages&&(messages.length? <ol className="support-messages">
      {messages.map(message=><li key={message.id} className="panel">
       <p><strong>{message.sender_kind}</strong> · {message.visibility==='internal_note'?'Nota interna':'Visível ao cliente'} · {new Date(message.created_at).toLocaleString('pt-BR')}</p>
       <p>{message.body}</p>
      </li>)}
     </ol>:<p>Sem mensagens registradas neste chamado.</p>)}

     {/* Trilha do chamado (saas_support_ticket_events) */}
     <div style={{marginTop:'1.25rem',paddingTop:'1rem',borderTop:'1px solid var(--border-soft, rgba(148,163,184,.12))'}}>
      <h4 style={{fontSize:'0.95rem',fontWeight:600,marginBottom:'0.5rem'}}>Trilha do chamado (eventos de estado)</h4>
      {eventsError&&<p role="alert" className="message error">{eventsError}</p>}
      {!events&&!eventsError&&<p role="status">Consultando eventos do chamado…</p>}
      {events&&(events.length? (
       <ol className="support-events" style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:'0.5rem'}}>
        {events.map(ev=>(
         <li key={String(ev.id)} className="panel" style={{padding:'0.65rem 0.85rem',background:'var(--surface-2,#1C2028)',fontSize:'0.82rem'}}>
          <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:'0.35rem'}}>
           <span>
            <strong>{ev.from_status ? `${ev.from_status} → ${ev.to_status}` : `Criado (${ev.to_status})`}</strong>
            {' · '}
            <span className="pill" style={{fontSize:'0.7rem',padding:'2px 6px'}}>{ev.visibility==='internal'?'Evento interno':'Visível ao cliente'}</span>
           </span>
           <span className="subtle" style={{fontSize:'0.75rem'}}>{new Date(ev.created_at).toLocaleString('pt-BR')}</span>
          </div>
        </li>
        ))}
       </ol>
      ) : <p className="subtle">Nenhum evento registrado nesta trilha.</p>)}
    </div>

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

     <form aria-label="Registrar nota interna restrita" onSubmit={e=>{e.preventDefault();void runInternalNote(false)}} style={{marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--border-soft, rgba(148,163,184,.12))'}}>
      <fieldset disabled={notePending||noteUncertain}>
       <legend>Nota interna restrita (nunca visível à Loja)</legend>
       <label htmlFor="master-internal-note">Nota interna</label>
       <textarea id="master-internal-note" required maxLength={5000} rows={3} value={noteText} onChange={e=>setNoteText(e.target.value)}/>
       <label htmlFor="master-note-status">Atualizar status (opcional)</label>
       <select id="master-note-status" value={noteNextStatus} onChange={e=>setNoteNextStatus(e.target.value)}>
        <option value="">Manter situação atual</option>
        <option value="new">Novo</option><option value="triage">Triagem</option>
        <option value="working">Em atendimento</option>
        <option value="waiting_client">Aguardando cliente</option>
        <option value="resolved">Resolvido</option><option value="closed">Fechado</option>
       </select>
       <button className="secondary" type="submit" disabled={!noteText.trim()||notePending||noteUncertain}>
        {notePending?'Salvando nota…':'Registrar nota interna'}
       </button>
      </fieldset>
      {noteSuccess&&<p role="status" className="message success">Nota interna restrita registrada com auditoria.</p>}
      {noteError&&<p role="alert" className="message error">{noteError}</p>}
      {noteUncertain&&<button type="button" className="secondary" disabled={notePending} onClick={()=>void runInternalNote(true)}>Verificar envio</button>}
     </form>
    </section>}
    <p className="subtle">A fila mostra 25 chamados por página. Respostas, notas internas, triagem e criação de chamados internos são idempotentes e auditadas; sessões de suporte somente leitura ficam na aba Sessões.</p>
  </>}
 </section>
}
