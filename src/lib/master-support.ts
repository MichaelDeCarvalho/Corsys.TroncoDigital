import type {SupabaseClient} from '@supabase/supabase-js'
export type SupportMessageVisibility='customer'|'internal_note'
export type SupportEventVisibility='customer'|'internal'
export type MasterTicket={
 id:string;ticket_seq:number|string;organization_id:string|null;
 ticket_scope:string;related_organization_id:string|null;
 subject:string;category:string;priority:string;status:string;
 opened_at:string;updated_at:string;opened_by_display:string|null;
 first_response_seconds:number|string|null;resolution_seconds:number|string|null
}
export type MasterTicketMessage={
 id:string;ticket_id:string;organization_id:string|null;
 sender_kind:string;visibility:SupportMessageVisibility;body:string;created_at:string
}
export type MasterTicketEvent={
 id:number|string;organization_id:string|null;ticket_id:string;
 from_status:string|null;to_status:string;visibility:SupportEventVisibility;
 created_at:string
}
export const MASTER_SUPPORT_PAGE=25
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
function seconds(value:unknown){
 if(value===null)return
 const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value
 if(!Number.isSafeInteger(n)||Number(n)<0)throw Error('Untrusted ticket service metrics')
}
export async function loadMasterTickets(client:SupabaseClient,page:number,signal:AbortSignal,organizationId?:string){
 if(!Number.isSafeInteger(page)||page<0||page>800)throw Error('Invalid ticket offset')
 const org=organizationId?.trim()||''
 if(org&&!uuid.test(org))throw Error('Invalid Master support organization')
 const query=client.from('v_saas_support_ticket_metrics')
  .select('id,ticket_seq,organization_id,ticket_scope,related_organization_id,subject,category,priority,status,opened_at,updated_at,opened_by_display,first_response_seconds,resolution_seconds')
  .order('opened_at',{ascending:false}).order('id')
 const {data,error}=await (org?query.eq('organization_id',org):query)
  .range(page*MASTER_SUPPORT_PAGE,(page+1)*MASTER_SUPPORT_PAGE).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>MASTER_SUPPORT_PAGE+1)
  throw Error('Master support list truncated')
 const ids=new Set<string>()
 for(const row of data as MasterTicket[]){
  if(!row||!uuid.test(row.id)||ids.has(row.id)||
   !['tenant','internal'].includes(row.ticket_scope)||
   (row.ticket_scope==='tenant'&&!uuid.test(row.organization_id??''))||
   (row.ticket_scope==='internal'&&row.organization_id!==null)||
   typeof row.subject!=='string'||typeof row.priority!=='string'||
   typeof row.status!=='string'||typeof row.opened_at!=='string'||
   typeof row.updated_at!=='string')throw Error('Unexpected support ticket data')
  if(org&&row.organization_id!==org)throw Error('Unexpected tenant in Master support filter')
  seconds(row.first_response_seconds);seconds(row.resolution_seconds)
  ids.add(row.id)
 }
 return {rows:data.slice(0,MASTER_SUPPORT_PAGE) as MasterTicket[],
   hasNext:data.length>MASTER_SUPPORT_PAGE}
}
export async function loadMasterTicketMessages(
 client:SupabaseClient,ticket:MasterTicket,signal:AbortSignal
){
 const {data,error}=await client.from('saas_support_ticket_messages')
  .select('id,organization_id,ticket_id,sender_kind,visibility,body,created_at')
  .eq('ticket_id',ticket.id).order('created_at').limit(201).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>200)throw Error('Support thread exceeds verified limit')
 const ids=new Set<string>()
 for(const row of data as MasterTicketMessage[]){
  if(!row||!uuid.test(row.id)||row.ticket_id!==ticket.id||
   ids.has(row.id)||typeof row.body!=='string'||
   typeof row.sender_kind!=='string'||!['customer','internal_note'].includes(row.visibility)||
   typeof row.created_at!=='string'||
   (ticket.ticket_scope==='tenant'&&row.organization_id!==ticket.organization_id)||
   (ticket.ticket_scope==='internal'&&(ticket.organization_id!==null||row.organization_id!==null)))
   throw Error('Unexpected support conversation data')
  ids.add(row.id)
 }
 return data as MasterTicketMessage[]
}
export async function loadMasterTicketEvents(
 client:SupabaseClient,ticket:MasterTicket,signal:AbortSignal
){
 const {data,error}=await client.from('saas_support_ticket_events')
  .select('id,organization_id,ticket_id,from_status,to_status,visibility,created_at')
  .eq('ticket_id',ticket.id).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(201).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>200)throw Error('Support events list exceeds verified limit')
 for(const row of data as MasterTicketEvent[]){
  if(!row||row.ticket_id!==ticket.id||
   typeof row.to_status!=='string'||
   !['customer','internal'].includes(row.visibility)||
   !Number.isFinite(Date.parse(row.created_at))||
   row.organization_id!==ticket.organization_id)
   throw Error('Unexpected support ticket event data')
 }
 return data as MasterTicketEvent[]
}

export type PlatformSupportStaff = {
 user_id: string
 role: 'MASTER' | 'SUPPORT'
}

export async function loadPlatformSupportStaff(client: SupabaseClient): Promise<PlatformSupportStaff[]> {
 const { data, error } = await client.rpc('list_platform_support_staff')
 if (error) throw error
 if (!Array.isArray(data)) throw Error('Invalid platform staff list')
 return data.filter(
  (row): row is PlatformSupportStaff =>
   Boolean(row && typeof row.user_id === 'string' && uuid.test(row.user_id) && ['MASTER', 'SUPPORT'].includes(String(row.role)))
 )
}

export async function addMasterSupportInternalNote(
 client: SupabaseClient,
 input: { ticket_id: string; note: string; next_status?: string | null; idempotency_key: string }
): Promise<string> {
 if (!uuid.test(input.ticket_id)) throw Error('Chamado inválido')
 const note = input.note.trim()
 if (note.length < 1 || note.length > 5000) throw Error('Informe o texto da nota interna')
 const { data, error } = await client.rpc('add_master_support_internal_note_idempotent', {
  p_ticket_id: input.ticket_id,
  p_note: note,
  p_next_status: input.next_status || null,
  p_idempotency_key: input.idempotency_key.trim(),
 })
 if (error) throw error
 if (typeof data !== 'string' || !uuid.test(data)) throw Error('Unconfirmed internal note response')
 return data
}

export async function assignMasterSupportTicket(
 client: SupabaseClient,
 input: {
  ticket_id: string
  assigned_staff_user_id?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  idempotency_key: string
 }
): Promise<string> {
 if (!uuid.test(input.ticket_id)) throw Error('Chamado inválido')
 if (input.assigned_staff_user_id && !uuid.test(input.assigned_staff_user_id)) throw Error('Operador inválido')
 const { data, error } = await client.rpc('assign_master_support_ticket_idempotent', {
  p_ticket_id: input.ticket_id,
  p_assigned_staff_user_id: input.assigned_staff_user_id || null,
  p_priority: input.priority || null,
  p_idempotency_key: input.idempotency_key.trim(),
 })
 if (error) throw error
 if (typeof data !== 'string' || !uuid.test(data)) throw Error('Unconfirmed ticket assignment response')
 return data
}

export async function createMasterInternalTicket(
 client: SupabaseClient,
 input: {
  related_organization_id?: string | null
  subject: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  message: string
  idempotency_key: string
 }
): Promise<string> {
 if (input.related_organization_id && !uuid.test(input.related_organization_id)) throw Error('Loja relacionada inválida')
 if (input.subject.trim().length < 3 || input.message.trim().length < 3) {
  throw Error('Assunto e descrição do chamado interno obrigatórios')
 }
 const { data, error } = await client.rpc('create_saas_internal_ticket_idempotent', {
  p_related_organization_id: input.related_organization_id || null,
  p_subject: input.subject.trim(),
  p_category: input.category,
  p_priority: input.priority,
  p_message: input.message.trim(),
  p_idempotency_key: input.idempotency_key.trim(),
 })
 if (error) throw error
 if (typeof data !== 'string' || !uuid.test(data)) throw Error('Unconfirmed internal ticket response')
 return data
}
