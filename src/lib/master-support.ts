import type {SupabaseClient} from '@supabase/supabase-js'
export type MasterTicket={
 id:string;ticket_seq:number|string;organization_id:string|null;
 ticket_scope:string;related_organization_id:string|null;
 subject:string;category:string;priority:string;status:string;
 opened_at:string;updated_at:string;opened_by_display:string|null;
 first_response_seconds:number|string|null;resolution_seconds:number|string|null
}
export type MasterTicketMessage={
 id:string;ticket_id:string;organization_id:string|null;
 sender_kind:string;visibility:string;body:string;created_at:string
}
export const MASTER_SUPPORT_PAGE=25
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
function seconds(value:unknown){
 if(value===null)return
 const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value
 if(!Number.isSafeInteger(n)||Number(n)<0)throw Error('Untrusted ticket service metrics')
}
export async function loadMasterTickets(client:SupabaseClient,page:number,signal:AbortSignal){
 if(!Number.isSafeInteger(page)||page<0||page>800)throw Error('Invalid ticket offset')
 const {data,error}=await client.from('v_saas_support_ticket_metrics')
  .select('id,ticket_seq,organization_id,ticket_scope,related_organization_id,subject,category,priority,status,opened_at,updated_at,opened_by_display,first_response_seconds,resolution_seconds')
  .order('opened_at',{ascending:false}).order('id')
  .range(page*MASTER_SUPPORT_PAGE,(page+1)*MASTER_SUPPORT_PAGE).abortSignal(signal)
 if(error)throw error
 if(!Array.isArray(data)||data.length>MASTER_SUPPORT_PAGE+1)
  throw Error('Master support list truncated')
 const ids=new Set<string>()
 for(const row of data as MasterTicket[]){
  if(!row||!uuid.test(row.id)||ids.has(row.id)||
   !['tenant','internal'].includes(row.ticket_scope)||
   (row.ticket_scope==='tenant'&&!uuid.test(row.organization_id??''))||
   typeof row.subject!=='string'||typeof row.priority!=='string'||
   typeof row.status!=='string'||typeof row.opened_at!=='string'||
   typeof row.updated_at!=='string')throw Error('Unexpected support ticket data')
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
   typeof row.sender_kind!=='string'||!['customer','internal'].includes(row.visibility)||
   typeof row.created_at!=='string'||
   (ticket.ticket_scope==='tenant'&&row.organization_id!==ticket.organization_id))
   throw Error('Unexpected support conversation data')
  ids.add(row.id)
 }
 return data as MasterTicketMessage[]
}
