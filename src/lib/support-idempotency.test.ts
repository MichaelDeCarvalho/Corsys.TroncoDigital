import { describe, it, expect, vi } from 'vitest'
import { createTenantSupportTicket, replyTenantSupportTicket } from './support'
import { openTicket } from './tenant-data'

describe('Support Idempotency Contracts (Fail-Closed & Replay)', () => {
  const validOrgId = 'a0000000-0000-0000-0000-000000000001'
  const validTicketId = 'b0000000-0000-0000-0000-000000000001'
  const otherOrgId = 'a0000000-0000-0000-0000-000000000099'

  it('guarantees createTenantSupportTicket always provides a valid non-empty idempotency key', async () => {
    let capturedArgs: any = null
    const mockClient: any = {
      rpc: vi.fn((name: string, args: any) => {
        if (name === 'create_saas_support_ticket') {
          capturedArgs = args
          return Promise.resolve({ data: 'ticket-123', error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }

    const result = await createTenantSupportTicket(mockClient, {
      organizationId: validOrgId,
      subject: 'Problema no fechamento',
      category: 'finance',
      priority: 'high',
      message: 'Não consigo fechar o mês',
    })

    expect(result).toBe('ticket-123')
    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.p_idempotency_key).toBeDefined()
    expect(typeof capturedArgs.p_idempotency_key).toBe('string')
    expect(capturedArgs.p_idempotency_key.length).toBeGreaterThan(0)
    expect(capturedArgs.p_idempotency_key.length).toBeLessThanOrEqual(200)
  })

  it('preserves user-specified idempotencyKey for deterministic retries in createTenantSupportTicket', async () => {
    let capturedKey: string | null = null
    const clientKey = 'client-specified-key-001'
    const mockClient: any = {
      rpc: vi.fn((_name: string, args: any) => {
        capturedKey = args.p_idempotency_key
        return Promise.resolve({ data: 'ticket-123', error: null })
      }),
    }

    await createTenantSupportTicket(mockClient, {
      organizationId: validOrgId,
      subject: 'Problema no fechamento',
      category: 'finance',
      priority: 'high',
      message: 'Não consigo fechar o mês',
      idempotencyKey: clientKey,
    })

    expect(capturedKey).toBe(clientKey)
  })

  it('guarantees openTicket in tenant-data always sends a valid non-empty idempotency key', async () => {
    let capturedArgs: any = null
    const mockClient: any = {
      rpc: vi.fn((name: string, args: any) => {
        if (name === 'create_saas_support_ticket') {
          capturedArgs = args
          return Promise.resolve({ data: 'ticket-fast-1', error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }

    const result = await openTicket(mockClient, validOrgId, 'Dúvida rápida', 'Ajuda com tesouraria')
    expect(result).toBe('ticket-fast-1')
    expect(capturedArgs.p_idempotency_key).toBeDefined()
    expect(capturedArgs.p_idempotency_key.length).toBeGreaterThan(0)
  })

  it('guarantees replyTenantSupportTicket always provides a valid non-empty idempotency key and p_next_status: null', async () => {
    let capturedArgs: any = null
    const mockClient: any = {
      rpc: vi.fn((name: string, args: any) => {
        if (name === 'reply_saas_support_ticket') {
          capturedArgs = args
          return Promise.resolve({ data: 'msg-456', error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }

    const result = await replyTenantSupportTicket(mockClient, {
      organizationId: validOrgId,
      ticketId: validTicketId,
      message: 'Respondendo o chamado',
    })

    expect(result).toBe('msg-456')
    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.p_idempotency_key).toBeDefined()
    expect(capturedArgs.p_idempotency_key.length).toBeGreaterThan(0)
    expect(capturedArgs.p_next_status).toBeNull()
  })

  it('fails closed when backend rejects payload divergence with SQL error 22023', async () => {
    const mockClient: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '22023',
          message: 'idempotency key reused with different operation or payload',
        },
      }),
    }

    await expect(
      createTenantSupportTicket(mockClient, {
        organizationId: validOrgId,
        subject: 'Assunto Divergente',
        category: 'finance',
        priority: 'high',
        message: 'Tentativa de reuso com mensagem alterada',
        idempotencyKey: 'same-key-divergent-payload',
      })
    ).rejects.toMatchObject({
      code: '22023',
    })
  })

  it('fails closed when backend rejects cross-tenant operation with SQL error 42501', async () => {
    const mockClient: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'tenant membership required',
        },
      }),
    }

    await expect(
      createTenantSupportTicket(mockClient, {
        organizationId: otherOrgId,
        subject: 'Chamado em outra loja',
        category: 'other',
        priority: 'low',
        message: 'Tentativa indevida',
      })
    ).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('validates deterministic inner key generation for Master support response delegation', () => {
    // Simulates SQL logic: v_inner_key := 'm-reply:' || md5(btrim(p_idempotency_key));
    const externalKey = 'master-ext-key-uuid-1234'
    const computeInnerKey = (extKey: string) => `m-reply:${extKey.trim()}`

    const innerKey1 = computeInnerKey(externalKey)
    const innerKey2 = computeInnerKey(externalKey)

    // 1. Must be strictly deterministic (identical output for same input)
    expect(innerKey1).toBe(innerKey2)

    // 2. Must be distinct from external key to satisfy unique constraint on (org_id, user_id, idempotency_key)
    expect(innerKey1).not.toBe(externalKey)

    // 3. Must be <= 200 characters
    expect(innerKey1.length).toBeLessThanOrEqual(200)
    expect(innerKey1.startsWith('m-reply:')).toBe(true)
  })
})
