import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMasterTickets, loadMasterTicketMessages, loadMasterTicketEvents, type MasterTicket } from './master-support'
import { loadTenantTicketMessages, loadTenantTicketEvents } from './support'

const validTicketId = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const validInternalTicketId = 'b863eeb9-5f01-4d69-8e4c-c9fff25fd735'
const validOrgId = '559ba052-c408-4418-b806-0c0c4b8e3603'
const relatedOrgId = '999ba052-c408-4418-b806-0c0c4b8e3699'

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

const sampleInternalMasterTicket: MasterTicket = {
  id: validInternalTicketId,
  ticket_seq: 10,
  organization_id: null,
  ticket_scope: 'internal',
  related_organization_id: relatedOrgId,
  subject: 'Auditoria interna de índices',
  category: 'configuration',
  priority: 'high',
  status: 'new',
  opened_at: '2026-10-09T11:00:00Z',
  updated_at: '2026-10-09T11:05:00Z',
  opened_by_display: 'Operador Master',
  first_response_seconds: null,
  resolution_seconds: null,
}

describe('Ticket Messages (saas_support_ticket_messages)', () => {
  it('loads valid customer and internal_note messages for a tenant ticket', async () => {
    const messagesData = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        organization_id: validOrgId,
        ticket_id: validTicketId,
        sender_kind: 'tenant_user',
        visibility: 'customer',
        body: 'Mensagem visível ao cliente',
        created_at: '2026-10-09T10:00:00Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        organization_id: validOrgId,
        ticket_id: validTicketId,
        sender_kind: 'platform_staff',
        visibility: 'internal_note',
        body: 'Nota interna restrita à plataforma',
        created_at: '2026-10-09T10:03:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: messagesData, error: null }),
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient

    const result = await loadMasterTicketMessages(client, sampleMasterTicket, new AbortController().signal)
    expect(result).toHaveLength(2)
    expect(result[0].visibility).toBe('customer')
    expect(result[1].visibility).toBe('internal_note')
  })

  it('loads internal ticket conversation with null organization_id and visibility=internal_note even when related_organization_id is set', async () => {
    const messagesData = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        organization_id: null,
        ticket_id: validInternalTicketId,
        sender_kind: 'platform_staff',
        visibility: 'internal_note',
        body: 'Registro inicial de chamado interno #10',
        created_at: '2026-10-09T11:00:00Z',
      },
    ]

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: messagesData, error: null }),
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient

    const result = await loadMasterTicketMessages(client, sampleInternalMasterTicket, new AbortController().signal)
    expect(result).toHaveLength(1)
    expect(result[0].organization_id).toBeNull()
    expect(result[0].visibility).toBe('internal_note')
  })

  it('rejects messages with invalid visibility values (such as event-only "internal" or unknown strings)', async () => {
    for (const badVisibility of ['internal', 'public', '']) {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        abortSignal: vi.fn().mockResolvedValue({
          data: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              organization_id: validOrgId,
              ticket_id: validTicketId,
              sender_kind: 'platform_staff',
              visibility: badVisibility,
              body: 'Visibilidade incompatível com saas_support_ticket_messages',
              created_at: '2026-10-09T10:05:00Z',
            },
          ],
          error: null,
        }),
      }
      const client = { from: vi.fn(() => query) } as unknown as SupabaseClient
      await expect(loadMasterTicketMessages(client, sampleMasterTicket, new AbortController().signal)).rejects.toThrow(
        'Unexpected support conversation data'
      )
    }
  })

  it('rejects messages with mismatched ticket_id or incompatible organization_id (including non-null organization_id on internal tickets)', async () => {
    // 1. Mismatched ticket_id
    const wrongTicketQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            organization_id: validOrgId,
            ticket_id: validInternalTicketId,
            sender_kind: 'tenant_user',
            visibility: 'customer',
            body: 'Ticket trocado',
            created_at: '2026-10-09T10:05:00Z',
          },
        ],
        error: null,
      }),
    }
    await expect(
      loadMasterTicketMessages({ from: vi.fn(() => wrongTicketQuery) } as unknown as SupabaseClient, sampleMasterTicket, new AbortController().signal)
    ).rejects.toThrow('Unexpected support conversation data')

    // 2. Internal ticket receiving a message with non-null organization_id (even if equal to related_organization_id)
    const nonNullInternalOrgQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            organization_id: relatedOrgId,
            ticket_id: validInternalTicketId,
            sender_kind: 'platform_staff',
            visibility: 'internal_note',
            body: 'Organização indevida em chamado interno',
            created_at: '2026-10-09T11:05:00Z',
          },
        ],
        error: null,
      }),
    }
    await expect(
      loadMasterTicketMessages({ from: vi.fn(() => nonNullInternalOrgQuery) } as unknown as SupabaseClient, sampleInternalMasterTicket, new AbortController().signal)
    ).rejects.toThrow('Unexpected support conversation data')

    // 3. loadMasterTickets rejects internal ticket row if organization_id is non-null
    const badInternalTicketListQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [{ ...sampleInternalMasterTicket, organization_id: relatedOrgId }],
        error: null,
      }),
    }
    await expect(
      loadMasterTickets({ from: vi.fn(() => badInternalTicketListQuery) } as unknown as SupabaseClient, 0, new AbortController().signal)
    ).rejects.toThrow('Unexpected support ticket data')
  })

  it('prohibits exposing internal_note messages to Loja readers in loadTenantTicketMessages', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            organization_id: validOrgId,
            ticket_id: validTicketId,
            sender_kind: 'platform_staff',
            visibility: 'internal_note',
            body: 'Nota interna que jamais pode ser exibida à Loja',
            created_at: '2026-10-09T10:10:00Z',
          },
        ],
        error: null,
      }),
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient

    await expect(
      loadTenantTicketMessages(client, validOrgId, validTicketId, new AbortController().signal)
    ).rejects.toThrow('Violação de isolamento no histórico de mensagens.')
    expect(query.eq).toHaveBeenCalledWith('visibility', 'customer')
  })
})

describe('Ticket Events (saas_support_ticket_events)', () => {
  it('loads Master ticket events ordered by created_at and id and rejects event visibility=internal_note', async () => {
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

    // Distinct contract check: events only accept 'customer' | 'internal', never 'internal_note'
    const badEventQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({
        data: [{ ...eventsData[1], visibility: 'internal_note' }],
        error: null,
      }),
    }
    await expect(
      loadMasterTicketEvents({ from: vi.fn(() => badEventQuery) } as unknown as SupabaseClient, sampleMasterTicket, new AbortController().signal)
    ).rejects.toThrow('Unexpected support ticket event data')
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
