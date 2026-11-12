import { describe, it, expect, vi } from 'vitest'
import {
  loadTenantTickets,
  sanitizeDurationSeconds,
  formatDurationMinutes,
  SUPPORT_PAGE_SIZE,
} from './support'

describe('support.ts — loadTenantTickets read-model and SLA validations', () => {
  const orgA = '11111111-1111-1111-1111-111111111111'
  const orgB = '22222222-2222-2222-2222-222222222222'

  function createMockClient(data: any[] | null, error: any = null) {
    const builder: any = {
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      abortSignal: vi.fn().mockResolvedValue({ data, error }),
    }
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => builder),
      })),
    }
    return {
      client,
      builder,
    }
  }

  // 1. Chamado com métricas
  it('1. loads ticket with complete SLA metrics correctly', async () => {
    const rawTicket = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ticket_seq: 42,
      organization_id: orgA,
      ticket_scope: 'tenant',
      subject: 'Problema na conciliação',
      category: 'finance',
      priority: 'high',
      status: 'resolved',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T11:00:00Z',
      resolved_at: '2026-09-01T11:00:00Z',
      closed_at: null,
      first_response_seconds: 1800, // 30 min
      resolution_seconds: 3600,     // 60 min
    }

    const { client, builder } = createMockClient([rawTicket])
    const res = await loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)

    expect(client.from).toHaveBeenCalledWith('v_saas_support_ticket_metrics')
    expect(builder.eq).toHaveBeenCalledWith('organization_id', orgA)
    expect(builder.eq).toHaveBeenCalledWith('ticket_scope', 'tenant')
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].first_response_seconds).toBe(1800)
    expect(res.rows[0].resolution_seconds).toBe(3600)
    expect(formatDurationMinutes(res.rows[0].first_response_seconds)).toBe('30 min')
    expect(formatDurationMinutes(res.rows[0].resolution_seconds)).toBe('60 min')
  })

  // 2. Chamado sem primeira resposta
  it('2. handles ticket without first staff response (null first_response_seconds)', async () => {
    const rawTicket = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ticket_seq: 43,
      organization_id: orgA,
      ticket_scope: 'tenant',
      subject: 'Novo chamado aberto',
      category: 'access',
      priority: 'medium',
      status: 'new',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: null,
      resolution_seconds: null,
    }

    const { client } = createMockClient([rawTicket])
    const res = await loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)

    expect(res.rows[0].first_response_seconds).toBeNull()
    expect(formatDurationMinutes(res.rows[0].first_response_seconds)).toBeNull()
  })

  // 3. Chamado ainda não resolvido
  it('3. handles ticket with first response but not yet resolved (null resolution_seconds)', async () => {
    const rawTicket = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ticket_seq: 44,
      organization_id: orgA,
      ticket_scope: 'tenant',
      subject: 'Em atendimento pela equipe',
      category: 'billing',
      priority: 'urgent',
      status: 'working',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:15:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: 900,
      resolution_seconds: null,
    }

    const { client } = createMockClient([rawTicket])
    const res = await loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)

    expect(res.rows[0].first_response_seconds).toBe(900)
    expect(res.rows[0].resolution_seconds).toBeNull()
    expect(formatDurationMinutes(res.rows[0].first_response_seconds)).toBe('15 min')
    expect(formatDurationMinutes(res.rows[0].resolution_seconds)).toBeNull()
  })

  // 4. Valor inválido de duração
  it('4. sanitizes invalid duration values without returning NaN', async () => {
    expect(sanitizeDurationSeconds(null)).toBeNull()
    expect(sanitizeDurationSeconds(undefined)).toBeNull()
    expect(sanitizeDurationSeconds('')).toBeNull()
    expect(sanitizeDurationSeconds('invalid')).toBeNull()
    expect(sanitizeDurationSeconds(-100)).toBeNull()
    expect(sanitizeDurationSeconds(NaN)).toBeNull()
    expect(sanitizeDurationSeconds(Infinity)).toBeNull()
    expect(sanitizeDurationSeconds('120')).toBe(120)
    expect(sanitizeDurationSeconds(3600)).toBe(3600)

    expect(formatDurationMinutes(NaN)).toBeNull()
    expect(formatDurationMinutes(-50)).toBeNull()
    expect(formatDurationMinutes('invalid')).toBeNull()
    expect(formatDurationMinutes(120)).toBe('2 min')

    const rawTicket = {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      ticket_seq: 45,
      organization_id: orgA,
      ticket_scope: 'tenant',
      subject: 'Valores corrompidos',
      category: 'other',
      priority: 'low',
      status: 'working',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:15:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: 'not-a-number',
      resolution_seconds: -999,
    }

    const { client } = createMockClient([rawTicket])
    const res = await loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)

    expect(res.rows[0].first_response_seconds).toBeNull()
    expect(res.rows[0].resolution_seconds).toBeNull()
    expect(formatDurationMinutes(res.rows[0].first_response_seconds)).toBeNull()
    expect(formatDurationMinutes(res.rows[0].resolution_seconds)).toBeNull()
  })

  // 5. Loja A sem acesso aos chamados da Loja B
  it('5. enforces tenant isolation fail-closed if server returns ticket of another org', async () => {
    const foreignTicket = {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      ticket_seq: 46,
      organization_id: orgB, // Loja B
      ticket_scope: 'tenant',
      subject: 'Chamado da Loja B',
      category: 'finance',
      priority: 'high',
      status: 'new',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: null,
      resolution_seconds: null,
    }

    const { client } = createMockClient([foreignTicket])

    await expect(
      loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)
    ).rejects.toThrow('Violação de isolamento de Loja nos chamados.')
  })

  // 6. Chamado interno indisponível à Loja
  it('6. rejects internal tickets with fail-closed error if returned to tenant', async () => {
    const internalTicket = {
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ticket_seq: 47,
      organization_id: orgA,
      ticket_scope: 'internal', // Scope interno!
      subject: 'Nota interna confidencial',
      category: 'other',
      priority: 'high',
      status: 'new',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: null,
      resolution_seconds: null,
    }

    const { client } = createMockClient([internalTicket])

    await expect(
      loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)
    ).rejects.toThrow('Violação de escopo: chamados internos não permitidos para a Loja.')
  })

  // 7. Erro de leitura apresentado sem dados incorretos
  it('7. propagates server query error fail-closed without fabricating data', async () => {
    const { client } = createMockClient(null, { message: 'Database query timeout or permission denied' })

    await expect(
      loadTenantTickets(client as any, orgA, 0, {}, new AbortController().signal)
    ).rejects.toThrow('Database query timeout or permission denied')
  })

  // 8. Paginação e filtros preservados
  it('8. preserves pagination, status filters and search parameters', async () => {
    const items = Array.from({ length: SUPPORT_PAGE_SIZE + 1 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      ticket_seq: 100 + i,
      organization_id: orgA,
      ticket_scope: 'tenant',
      subject: `Ticket #${100 + i}`,
      category: 'finance',
      priority: 'medium',
      status: 'working',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
      resolved_at: null,
      closed_at: null,
      first_response_seconds: 600,
      resolution_seconds: null,
    }))

    const { client, builder } = createMockClient(items)

    const res = await loadTenantTickets(
      client as any,
      orgA,
      1, // page 1
      { search: 'Ticket', statusFilter: 'open' },
      new AbortController().signal
    )

    // Check query builder calls
    expect(builder.in).toHaveBeenCalledWith('status', ['new', 'triage', 'working', 'waiting_client'])
    expect(builder.ilike).toHaveBeenCalledWith('subject', '%Ticket%')
    expect(builder.order).toHaveBeenCalledWith('opened_at', { ascending: false })
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(builder.range).toHaveBeenCalledWith(15, 30)

    // Result should slice to page size and flag hasNext
    expect(res.rows).toHaveLength(SUPPORT_PAGE_SIZE)
    expect(res.hasNext).toBe(true)
  })
})
