import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Chamados } from './Chamados'

const validOrgId = 'a0000000-0000-0000-0000-000000000001'
const validTicketId = 'b0000000-0000-0000-0000-000000000001'

describe('Chamados (view-chamados)', () => {
  let mockClient: any

  const mockTickets = [
    {
      id: validTicketId,
      ticket_seq: 101,
      organization_id: validOrgId,
      subject: 'Dúvida sobre fechamento contábil',
      category: 'finance',
      priority: 'high',
      status: 'working',
      opened_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-02T14:30:00Z',
      resolved_at: null,
      closed_at: null,
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      ticket_seq: 102,
      organization_id: validOrgId,
      subject: 'Ajuste de permissão de tesoureiro',
      category: 'access',
      priority: 'urgent',
      status: 'waiting_client',
      opened_at: '2026-09-03T11:00:00Z',
      updated_at: '2026-09-03T11:30:00Z',
      resolved_at: null,
      closed_at: null,
    },
    {
      id: 'b0000000-0000-0000-0000-000000000003',
      ticket_seq: 103,
      organization_id: validOrgId,
      subject: 'Solicitação de novo plano contábil',
      category: 'configuration',
      priority: 'low',
      status: 'resolved',
      opened_at: '2026-08-15T09:00:00Z',
      updated_at: '2026-08-20T16:00:00Z',
      resolved_at: '2026-08-20T16:00:00Z',
      closed_at: '2026-08-20T16:00:00Z',
    },
  ]

  const mockMessages = [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      organization_id: validOrgId,
      ticket_id: validTicketId,
      sender_kind: 'tenant_user',
      visibility: 'customer',
      body: 'Não estou conseguindo fechar a competência de agosto.',
      created_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      organization_id: validOrgId,
      ticket_id: validTicketId,
      sender_kind: 'platform_staff',
      visibility: 'customer',
      body: 'Olá! Verifique se todos os lançamentos estão conciliados antes de fechar.',
      created_at: '2026-09-01T11:30:00Z',
    },
  ]

  beforeEach(() => {
    sessionStorage.clear()
    mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'saas_support_tickets') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                abortSignal: vi.fn().mockResolvedValue({ data: mockTickets, error: null }),
              })),
            })),
          }
        }
        if (table === 'saas_support_ticket_messages') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(function () {
                    return {
                      order: vi.fn().mockReturnThis(),
                      limit: vi.fn(() => ({
                        abortSignal: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
                      })),
                    }
                  }),
                })),
              })),
            })),
          }
        }
        return {}
      }),
      rpc: vi.fn((rpcName: string, args: any) => {
        if (rpcName === 'create_saas_support_ticket') {
          return Promise.resolve({ data: 'b0000000-0000-0000-0000-000000000099', error: null })
        }
        if (rpcName === 'reply_saas_support_ticket') {
          return Promise.resolve({ data: 'c0000000-0000-0000-0000-000000000099', error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
  })

  it('renders tickets list with KPIs and columns', async () => {
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    expect(screen.getByText('Atendimento da Loja')).toBeInTheDocument()

    // Wait for tickets to load
    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    expect(screen.getByText('Ajuste de permissão de tesoureiro')).toBeInTheDocument()
    expect(screen.getByText('Solicitação de novo plano contábil')).toBeInTheDocument()

    // Check sequences
    expect(screen.getByText('#101')).toBeInTheDocument()
    expect(screen.getByText('#102')).toBeInTheDocument()
    expect(screen.getByText('#103')).toBeInTheDocument()

    // Check KPIs
    expect(screen.getAllByText('Abertos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aguardando cliente').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Resolvidos').length).toBeGreaterThan(0)
  })

  it('filters tickets instantly in memory by title, ID (#seq), or category without page reload', async () => {
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
      expect(screen.getByText('Ajuste de permissão de tesoureiro')).toBeInTheDocument()
      expect(screen.getByText('Solicitação de novo plano contábil')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente, título ou ID/i)

    // 1. Instant live filter by ID (#102)
    fireEvent.change(searchInput, { target: { value: '102' } })
    expect(screen.getByText('Ajuste de permissão de tesoureiro')).toBeInTheDocument()
    expect(screen.queryByText('Dúvida sobre fechamento contábil')).not.toBeInTheDocument()
    expect(screen.queryByText('Solicitação de novo plano contábil')).not.toBeInTheDocument()

    // 2. Instant live filter by Title ("fechamento") with highlight animation
    fireEvent.change(searchInput, { target: { value: 'fechamento' } })
    expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    expect(screen.getByText(/Realce ativo/i)).toBeInTheDocument()
    expect(screen.getByText('Dúvida sobre fechamento contábil').closest('tr')).toHaveAttribute('data-search-highlight', 'true')
    expect(screen.queryByText('Ajuste de permissão de tesoureiro')).not.toBeInTheDocument()

    // 3. Clear search restores full loaded list
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    expect(screen.getByText('Ajuste de permissão de tesoureiro')).toBeInTheDocument()
    expect(screen.getByText('Solicitação de novo plano contábil')).toBeInTheDocument()
  })

  it('persists search filter in sessionStorage across screen switches', async () => {
    const { unmount } = render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente, título ou ID/i)
    fireEvent.change(searchInput, { target: { value: 'fechamento' } })

    // Verify saved in sessionStorage
    expect(sessionStorage.getItem(`v35_tenant_ticket_search_${validOrgId}`)).toBe('fechamento')

    // Simulate switching screen (unmount and remount)
    unmount()
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      const remountedInput = screen.getByPlaceholderText(/Buscar por cliente, título ou ID/i)
      expect(remountedInput).toHaveValue('fechamento')
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
      expect(screen.queryByText('Ajuste de permissão de tesoureiro')).not.toBeInTheDocument()
    })
  })

  it('expands and collapses inline row drawer displaying update history and attachments info', async () => {
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const detailButtons = screen.getAllByRole('button', { name: /Detalhes do chamado #101/i })
    expect(detailButtons.length).toBeGreaterThan(0)

    // Expand
    fireEvent.click(detailButtons[0])

    expect(screen.getByText(/Detalhes e Histórico de Atualizações · Chamado #101/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Histórico de Atualizações/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Anexos e Documentos de Suporte/i)).toBeInTheDocument()

    // Collapse
    const collapseBtn = screen.getByRole('button', { name: 'Recolher painel' })
    fireEvent.click(collapseBtn)

    expect(screen.queryByText(/Detalhes e Histórico de Atualizações · Chamado #101/i)).not.toBeInTheDocument()
  })

  it('submits new ticket via integrated form', async () => {
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const subjectInput = screen.getByLabelText(/Assunto/i)
    const descInput = screen.getByLabelText(/Descrição/i)

    fireEvent.change(subjectInput, { target: { value: 'Problema na conciliação' } })
    fireEvent.change(descInput, { target: { value: 'Divergência de 10 reais no extrato' } })

    const confirmBtn = screen.getByRole('button', { name: 'Enviar chamado' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockClient.rpc).toHaveBeenCalledWith('create_saas_support_ticket', {
        p_organization_id: validOrgId,
        p_subject: 'Problema na conciliação',
        p_category: 'other',
        p_priority: 'medium',
        p_message: 'Divergência de 10 reais no extrato',
      })
    })
  })

  it('opens ticket conversation detail and sends reply', async () => {
    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByRole('button', { name: 'Ver conversa' })
    fireEvent.click(viewButtons[0])

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.getByText('Histórico da conversa')).toBeInTheDocument()
      expect(
        screen.getByText('Não estou conseguindo fechar a competência de agosto.')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Olá! Verifique se todos os lançamentos estão conciliados antes de fechar.')
      ).toBeInTheDocument()
    })

    // Reply
    const replyInput = screen.getByPlaceholderText('Digite sua resposta ou esclarecimento…')
    fireEvent.change(replyInput, { target: { value: 'Entendido, verifiquei e deu certo agora.' } })

    const sendBtn = screen.getByRole('button', { name: 'Enviar resposta' })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(mockClient.rpc).toHaveBeenCalledWith('reply_saas_support_ticket', {
        p_organization_id: validOrgId,
        p_ticket_id: validTicketId,
        p_message: 'Entendido, verifiquei e deu certo agora.',
      })
    })
  })

  it('blocks re-submission when ticket creation result is uncertain and preserves text', async () => {
    mockClient.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'create_saas_support_ticket') {
        return Promise.reject(new Error('Timeout de rede ao conectar ao servidor'))
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const subjectInput = screen.getByLabelText(/Assunto/i)
    const descInput = screen.getByLabelText(/Descrição/i)

    fireEvent.change(subjectInput, { target: { value: 'Falha transiente testada' } })
    fireEvent.change(descInput, { target: { value: 'Descrição importante preservada' } })

    const confirmBtn = screen.getByRole('button', { name: 'Enviar chamado' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/Envio não confirmado com resposta autoritativa/i)).toBeInTheDocument()
    })

    // Button should now be disabled to prevent duplicate submit
    const blockedBtn = screen.getByRole('button', { name: /Envio bloqueado/i })
    expect(blockedBtn).toBeDisabled()

    // Preserved fields
    expect(subjectInput).toHaveValue('Falha transiente testada')
    expect(descInput).toHaveValue('Descrição importante preservada')

    // Explicit recovery button unblocks
    const unblockBtn = screen.getByRole('button', { name: /Confirmar que não foi criado e liberar novo envio/i })
    fireEvent.click(unblockBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enviar chamado' })).not.toBeDisabled()
    })
  })

  it('blocks re-submission when reply result is uncertain and preserves text', async () => {
    mockClient.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'reply_saas_support_ticket') {
        return Promise.reject(new Error('Erro de conexão durante envio da resposta'))
      }
      return Promise.resolve({ data: null, error: null })
    })

    render(<Chamados client={mockClient} organizationId={validOrgId} />)

    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre fechamento contábil')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByRole('button', { name: 'Ver conversa' })
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Histórico da conversa')).toBeInTheDocument()
    })

    const replyInput = screen.getByPlaceholderText('Digite sua resposta ou esclarecimento…')
    fireEvent.change(replyInput, { target: { value: 'Minha resposta que não deve duplicar' } })

    const sendBtn = screen.getByRole('button', { name: 'Enviar resposta' })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText(/Envio de resposta não confirmado pelo servidor/i)).toBeInTheDocument()
    })

    // Reply button should be disabled
    const blockedReplyBtn = screen.getByRole('button', { name: /Envio bloqueado/i })
    expect(blockedReplyBtn).toBeDisabled()
    expect(replyInput).toHaveValue('Minha resposta que não deve duplicar')

    // Explicit unblock button
    const unblockReplyBtn = screen.getByRole('button', { name: /Confirmar que não foi enviada e liberar novo envio/i })
    fireEvent.click(unblockReplyBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enviar resposta' })).not.toBeDisabled()
    })
  })
})
