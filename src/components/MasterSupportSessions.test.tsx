import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MasterOperations } from './MasterOperations'
import {
  getActiveMasterSupportSession,
  startMasterSupportSession,
  endMasterSupportSession,
} from '../lib/master-support-sessions'

describe('Master Support Sessions Client Library', () => {
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      rpc: vi.fn(),
    }
  })

  it('rejects invalid organization ID on startMasterSupportSession', async () => {
    await expect(
      startMasterSupportSession(mockClient, {
        organizationId: 'invalid-uuid',
        reason: 'Justificativa válida com mais de 5 caracteres',
      })
    ).rejects.toThrow('ID de organização inválido.')
  })

  it('rejects short reason (< 5 chars) on startMasterSupportSession', async () => {
    await expect(
      startMasterSupportSession(mockClient, {
        organizationId: '11111111-1111-1111-1111-111111111111',
        reason: '1234',
      })
    ).rejects.toThrow('O motivo do acesso deve conter entre 5 e 500 caracteres.')
  })

  it('successfully starts a session with fixed 15min duration via RPC', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111'
    const sessId = '22222222-2222-2222-2222-222222222222'
    mockClient.rpc.mockResolvedValue({ data: sessId, error: null })

    const res = await startMasterSupportSession(mockClient, {
      organizationId: orgId,
      reason: 'Diagnóstico técnico da Loja sob autorização MASTER',
      idempotencyKey: 'test-key-1',
    })

    expect(res).toBe(sessId)
    expect(mockClient.rpc).toHaveBeenCalledWith('start_master_support_session', {
      p_organization_id: orgId,
      p_reason: 'Diagnóstico técnico da Loja sob autorização MASTER',
      p_idempotency_key: 'test-key-1',
    })
  })

  it('propagates server error fail-closed on startMasterSupportSession', async () => {
    mockClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'AAL2/MFA required for platform operation' },
    })

    await expect(
      startMasterSupportSession(mockClient, {
        organizationId: '11111111-1111-1111-1111-111111111111',
        reason: 'Diagnóstico técnico da Loja sob autorização MASTER',
      })
    ).rejects.toThrow('AAL2/MFA required for platform operation')
  })

  it('queries active session via getActiveMasterSupportSession', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111'
    const mockSession = {
      id: '22222222-2222-2222-2222-222222222222',
      staff_user_id: '33333333-3333-3333-3333-333333333333',
      organization_id: orgId,
      reason: 'Auditoria de conciliação bancária',
      scope: 'read_only',
      started_at: '2026-10-28T18:00:00Z',
      expires_at: '2026-10-28T18:15:00Z',
      created_at: '2026-10-28T18:00:00Z',
      is_active: true,
      seconds_remaining: 840,
    }

    mockClient.rpc.mockResolvedValue({ data: mockSession, error: null })

    const session = await getActiveMasterSupportSession(mockClient, orgId)
    expect(session).not.toBeNull()
    expect(session?.id).toBe(mockSession.id)
    expect(session?.scope).toBe('read_only')
    expect(session?.seconds_remaining).toBe(840)
  })

  it('returns null when no session is active', async () => {
    mockClient.rpc.mockResolvedValue({ data: null, error: null })
    const session = await getActiveMasterSupportSession(
      mockClient,
      '11111111-1111-1111-1111-111111111111'
    )
    expect(session).toBeNull()
  })

  it('successfully terminates session via endMasterSupportSession', async () => {
    const orgId = '11111111-1111-1111-1111-111111111111'
    const sessId = '22222222-2222-2222-2222-222222222222'
    mockClient.rpc.mockResolvedValue({ data: sessId, error: null })

    const res = await endMasterSupportSession(mockClient, {
      organizationId: orgId,
      sessionId: sessId,
      idempotencyKey: 'test-end-key',
    })

    expect(res).toBe(sessId)
    expect(mockClient.rpc).toHaveBeenCalledWith('end_master_support_session', {
      p_organization_id: orgId,
      p_session_id: sessId,
      p_idempotency_key: 'test-end-key',
    })
  })
})

describe('MasterOperations UI — Tab 3: Sessões de Suporte', () => {
  let mockClient: any
  const testOrgId = '11111111-1111-1111-1111-111111111111'

  beforeEach(() => {
    mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn().mockResolvedValue({ data: [], error: null }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
      rpc: vi.fn((rpcName: string, args: any) => {
        if (rpcName === 'list_platform_master_tenants') {
          return Promise.resolve({
            data: [
              {
                organization_id: testOrgId,
                organization_name: 'Loja Exemplo Matriz',
                organization_number: '001',
                organization_status: 'active',
                subscription_status: 'active',
                plan_name: 'Enterprise',
                open_support_tickets: 0,
              },
            ],
            error: null,
          })
        }
        if (rpcName === 'get_active_master_support_session') {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
  })

  it('renders security boundary notice on support tab', async () => {
    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Sessões de Suporte/i }))

    expect(
      screen.getByText(/Boundary de Segurança e Imutabilidade Financeira/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/somente leitura \(read_only\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/A escrita financeira em contas de Lojas permanece tecnicamente proibida/i)
    ).toBeInTheDocument()
  })

  it('renders start session form and creates session with 15min notice', async () => {
    const newSessionId = '99999999-9999-9999-9999-999999999999'

    mockClient.rpc.mockImplementation((rpcName: string, args: any) => {
      if (rpcName === 'list_platform_master_tenants') {
        return Promise.resolve({
          data: [
            {
              organization_id: testOrgId,
              organization_name: 'Loja Exemplo Matriz',
              organization_number: '001',
              organization_status: 'active',
              subscription_status: 'active',
              plan_name: 'Enterprise',
              open_support_tickets: 0,
            },
          ],
          error: null,
        })
      }
      if (rpcName === 'get_active_master_support_session') {
        return Promise.resolve({ data: null, error: null })
      }
      if (rpcName === 'start_master_support_session') {
        return Promise.resolve({ data: newSessionId, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Sessões de Suporte/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Motivo do Acesso de Suporte/i)).toBeInTheDocument()
    })

    const reasonInput = screen.getByLabelText(/Motivo do Acesso de Suporte/i)
    fireEvent.change(reasonInput, {
      target: { value: 'Investigação técnica do chamado #42 de homologação' },
    })

    const submitBtn = screen.getByRole('button', {
      name: /Iniciar Sessão Temporária \(15 min\)/i,
    })
    expect(submitBtn).toBeEnabled()

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'start_master_support_session',
        expect.objectContaining({
          p_organization_id: testOrgId,
          p_reason: 'Investigação técnica do chamado #42 de homologação',
        })
      )
    })
  })

  it('displays real server error message if RPC fails (fail-closed)', async () => {
    mockClient.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'list_platform_master_tenants') {
        return Promise.resolve({
          data: [
            {
              organization_id: testOrgId,
              organization_name: 'Loja Exemplo Matriz',
              organization_number: '001',
              organization_status: 'active',
              subscription_status: 'active',
              plan_name: 'Enterprise',
              open_support_tickets: 0,
            },
          ],
          error: null,
        })
      }
      if (rpcName === 'start_master_support_session') {
        return Promise.resolve({
          data: null,
          error: { message: 'platform permission denied: MASTER with AAL2 required' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Sessões de Suporte/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Motivo do Acesso de Suporte/i)).toBeInTheDocument()
    })

    const reasonInput = screen.getByLabelText(/Motivo do Acesso de Suporte/i)
    fireEvent.change(reasonInput, {
      target: { value: 'Tentativa de abertura de sessão de suporte' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: /Iniciar Sessão Temporária \(15 min\)/i })
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'platform permission denied: MASTER with AAL2 required'
      )
    })
  })

  it('displays active session details and enables session termination', async () => {
    const activeSessionData = {
      id: '44444444-4444-4444-4444-444444444444',
      staff_user_id: '33333333-3333-3333-3333-333333333333',
      organization_id: testOrgId,
      reason: 'Auditoria de transações de conciliação',
      scope: 'read_only',
      started_at: '2026-10-28T18:00:00Z',
      expires_at: '2026-10-28T18:15:00Z',
      created_at: '2026-10-28T18:00:00Z',
      is_active: true,
      seconds_remaining: 850,
    }

    mockClient.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'list_platform_master_tenants') {
        return Promise.resolve({
          data: [
            {
              organization_id: testOrgId,
              organization_name: 'Loja Exemplo Matriz',
              organization_number: '001',
              organization_status: 'active',
              subscription_status: 'active',
              plan_name: 'Enterprise',
              open_support_tickets: 0,
            },
          ],
          error: null,
        })
      }
      if (rpcName === 'get_active_master_support_session') {
        return Promise.resolve({ data: activeSessionData, error: null })
      }
      if (rpcName === 'end_master_support_session') {
        return Promise.resolve({ data: activeSessionData.id, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Sessões de Suporte/i }))

    await waitFor(() => {
      expect(screen.getByText(/Sessão Ativa \(Somente Leitura\)/i)).toBeInTheDocument()
      expect(screen.getByText('44444444-4444-4444-4444-444444444444')).toBeInTheDocument()
      expect(screen.getByText(/Auditoria de transações de conciliação/i)).toBeInTheDocument()
    })

    const endBtn = screen.getByRole('button', { name: /Encerrar Sessão de Suporte/i })
    expect(endBtn).toBeInTheDocument()

    fireEvent.click(endBtn)

    await waitFor(() => {
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'end_master_support_session',
        expect.objectContaining({
          p_organization_id: testOrgId,
          p_session_id: '44444444-4444-4444-4444-444444444444',
        })
      )
    })
  })
})
