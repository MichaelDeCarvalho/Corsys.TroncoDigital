import type { SupabaseClient } from '@supabase/supabase-js'

export type Organization = { id: string; name: string; number: string | null; status: string }
export type Member = {
  id: string; organization_id: string; full_name: string; status: string
  preferred_name?: string | null; degree_or_office?: string | null
  phone?: string | null; whatsapp?: string | null; email?: string | null
  initiation_date?: string | null; admission_date?: string | null; notes?: string | null
  updated_at?: string
}
export type Ticket = { id: string; organization_id: string; ticket_seq: number; subject: string; status: string; priority: string; opened_at: string }
export type TenantData = { members: Member[]; tickets: Ticket[] }

export async function loadOrganizations(client: SupabaseClient, signal: AbortSignal): Promise<Organization[]> {
  const { data, error } = await client.from('organizations').select('id,name,number,status').order('name').abortSignal(signal)
  if (error) throw error
  return data ?? []
}

export async function loadTenantData(client: SupabaseClient, organizationId: string, signal: AbortSignal): Promise<TenantData> {
  const [members, tickets] = await Promise.all([
    client.from('members').select('id,organization_id,full_name,status,preferred_name,degree_or_office,phone,whatsapp,email,initiation_date,admission_date,notes,updated_at').eq('organization_id', organizationId).order('full_name').limit(200).abortSignal(signal),
    client.from('saas_support_tickets').select('id,organization_id,ticket_seq,subject,status,priority,opened_at').eq('organization_id', organizationId).order('opened_at', { ascending: false }).limit(100).abortSignal(signal),
  ])
  if (members.error) throw members.error
  if (tickets.error) throw tickets.error
  // Defense in depth; RLS remains the authorization boundary.
  if (members.data?.some(row => row.organization_id !== organizationId) || tickets.data?.some(row => row.organization_id !== organizationId)) {
    throw new Error('Unexpected organization in response')
  }
  return { members: members.data ?? [], tickets: tickets.data ?? [] }
}

export type MemberProfile = Pick<Member, 'full_name' | 'status' | 'preferred_name' | 'degree_or_office' | 'phone' | 'whatsapp' | 'email' | 'initiation_date' | 'admission_date' | 'notes'>
export async function saveMemberProfile(client: SupabaseClient, organizationId: string, member: Member | null, profile: MemberProfile, reason: string, key: string) {
  if (member && (member.organization_id !== organizationId || !member.updated_at)) throw new Error('Invalid member version')
  const { data, error } = await client.rpc('save_member_profile', {
    p_organization_id: organizationId, p_member_id: member?.id ?? null,
    p_expected_updated_at: member?.updated_at ?? null, p_profile: profile,
    p_reason: reason, p_idempotency_key: key,
  })
  if (error) throw error
  if (typeof data !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) throw new Error('Unconfirmed member save')
  return data
}

export async function openTicket(client: SupabaseClient, organizationId: string, subject: string, message: string, key?: string) {
  const { data, error } = await client.rpc('create_saas_support_ticket', {
    p_organization_id: organizationId,
    p_subject: subject.trim(),
    p_category: 'other',
    p_priority: 'medium',
    p_message: message.trim(),
    p_idempotency_key: key ?? crypto.randomUUID(),
  })
  if (error || typeof data !== 'string') throw error ?? new Error('Ticket not created')
  return data
}
