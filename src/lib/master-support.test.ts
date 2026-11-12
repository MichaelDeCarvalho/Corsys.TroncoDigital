import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMasterTicketEvents, type MasterTicket } from './master-support'
import { loadTenantTicketEvents } from './support'

const validTicketId = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const validOrgId = '559ba052-c408-4418-b806-0c0c4b8e3603'

const sampleMasterTicket: MasterTicket = {
  id: validTicketId,
  ticket_seq: 1001,
  organization_id: validOrgId,
  ticket_scope: 'tenant',
  related_organization_id: null,
  subject: 'Dúvida de conciliação',
  category: 'finance',
  priority: 'medium',
  status: 'working',
  opened_at: '2026-10-09T10:00:00Z',
  updated_at: '2026-10-09T10:05:00Z',
  opened_by_display: 'Usuário Loja',
  first_response_seconds: 300,
  resolution_seconds: null,
}

describe('Ticket Events (saas_support_ticket_events)', () => {
  it('loads Master ticket events ordered by created_at and id', async () => {
    const eventsData = [
      {
        id: 1,
        organization_id: validOrgId,
        ticket_id: validTicketId,
        from_status: null,
        to_status: 'new',
        visibility: 'customer',
        reason: 'Chamado aberto pelo cliente',
        actor_user_id: 'user-1',
        created_at: '2026-10-09T10:00:00Z',
      },
      {
        id: 2,
        organization_id: validOrgId,
        ticket_id: validTicketId,
        from_status: 'new',
        to_status: 'working',
        visibility: 'internal',
        reason: 'Triagem inicial pela equipe Master',
        actor_user_id: 'staff-1',
        created_at: '2026-10-09T10:05:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: eventsData, error: null }),
    }

    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    const result = await loadMasterTicketEvents(client, sampleMasterTicket, new AbortController().signal)

    expect(client.from).toHaveBeenCalledWith('saas_support_ticket_events')
    expect(query.eq).toHaveBeenCalledWith('ticket_id', validTicketId)
    expect(query.order.mock.calls).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(query.select).toHaveBeenCalledWith('id,organization_id,ticket_id,from_status,to_status,visibility,created_at')
    expect(result).toHaveLength(2)
    expect(result[0].to_status).toBe('new')
    expect(result[1].to_status).toBe('working')
  })

  it('rejects Master events from a foreign organization', async () => {
    const invalidEvents = [
      {
        id: 1,
        organization_id: 'foreign-org-id-123456789012345',
        ticket_id: validTicketId,
        from_status: null,
        to_status: 'new',
        visibility: 'customer',
        reason: null,
        actor_user_id: null,
        created_at: '2026-10-09T10:00:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: invalidEvents, error: null }),
    }

    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    await expect(loadMasterTicketEvents(client, sampleMasterTicket, new AbortController().signal)).rejects.toThrow(
      'Unexpected support ticket event data'
    )
  })

  it('loads Tenant ticket events scoped to organization and ticket', async () => {
    const eventsData = [
      {
        id: 1,
        organization_id: validOrgId,
        ticket_id: validTicketId,
        from_status: null,
        to_status: 'new',
        visibility: 'customer',
        reason: 'Abertura',
        created_at: '2026-10-09T10:00:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: eventsData, error: null }),
    }

    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    const result = await loadTenantTicketEvents(client, validOrgId, validTicketId, new AbortController().signal)

    expect(client.from).toHaveBeenCalledWith('saas_support_ticket_events')
    expect(query.eq).toHaveBeenCalledWith('organization_id', validOrgId)
    expect(query.eq).toHaveBeenCalledWith('ticket_id', validTicketId)
    expect(query.eq).toHaveBeenCalledWith('visibility', 'customer')
    expect(query.select).toHaveBeenCalledWith('id,organization_id,ticket_id,from_status,to_status,visibility,created_at')
    expect(result).toHaveLength(1)
  })

  it('rejects internal events returned to a Loja reader even in the correct scope', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [{
          id: 1, organization_id: validOrgId, ticket_id: validTicketId,
          from_status: 'new', to_status: 'working', visibility: 'internal',
          created_at: '2026-10-09T10:05:00Z',
        }],
        error: null,
      }),
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient

    await expect(loadTenantTicketEvents(client, validOrgId, validTicketId, new AbortController().signal))
      .rejects.toThrow('Violação de isolamento na trilha de eventos do chamado.')
  })

  it('rejects Tenant ticket events if backend returns mismatched tenant data', async () => {
    const leakedData = [
      {
        id: 1,
        organization_id: 'other-org',
        ticket_id: validTicketId,
        from_status: null,
        to_status: 'new',
        visibility: 'customer',
        reason: null,
        created_at: '2026-10-09T10:00:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: leakedData, error: null }),
    }

    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
    await expect(loadTenantTicketEvents(client, validOrgId, validTicketId, new AbortController().signal)).rejects.toThrow(
      'Violação de isolamento na trilha de eventos do chamado.'
    )
  })
})
