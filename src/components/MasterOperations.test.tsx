import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MasterOperations } from './MasterOperations'

describe('MasterOperations (view-master-operacao)', () => {
  let mockClient: any

  const mockJobs = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      organization_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      job_type: 'generate_invoice',
      status: 'succeeded',
      attempts: 1,
      max_attempts: 3,
      idempotency_key: 'job-key-2026-09',
      correlation_id: 'corr-1',
      last_error_code: null,
      created_at: '2026-09-01T00:00:00Z',
      locked_at: null,
      completed_at: '2026-09-01T00:02:00Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      organization_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      job_type: 'evaluate_dunning',
      status: 'failed',
      attempts: 3,
      max_attempts: 3,
      idempotency_key: 'dunning-2026-09-05',
      correlation_id: 'corr-2',
      last_error_code: 'EMAIL_PROVIDER_UNAVAILABLE',
      created_at: '2026-09-05T08:00:00Z',
      locked_at: null,
      completed_at: null,
    },
  ]

  beforeEach(() => {
    mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'v_saas_support_ticket_metrics') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn(() => ({
                    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'saas_jobs') {
          const query: any = {
            select: vi.fn(() => query),
            eq: vi.fn(() => query),
            or: vi.fn(() => query),
            order: vi.fn(() => query),
            limit: vi.fn(() => query),
            abortSignal: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
          return query
        }
        return {}
      }),
    }
  })

  it('renders operational tabs with tickets as default', async () => {
    render(<MasterOperations client={mockClient} />)

    expect(screen.getByText('Operação e Suporte Master')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chamados/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Saúde \/ Jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sessões de Suporte/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Equipe e Segurança/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Auditoria Master/i })).toBeInTheDocument()
  })

  it('navigates to health/jobs tab and renders async jobs from server', async () => {
    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Saúde \/ Jobs/i }))

    await waitFor(() => {
      expect(screen.getByText(/Fila de Tarefas Assíncronas/i)).toBeInTheDocument()
      expect(screen.getByText('generate_invoice')).toBeInTheDocument()
      expect(screen.getByText('evaluate_dunning')).toBeInTheDocument()
      expect(screen.getByText('EMAIL_PROVIDER_UNAVAILABLE')).toBeInTheDocument()
    })
  })

  it('applies status, type and organization filters without exposing payloads or mutation controls', async () => {
    render(<MasterOperations client={mockClient} />)
    fireEvent.click(screen.getByRole('tab', { name: /Saúde.*Jobs/i }))
    await screen.findByText('generate_invoice')
    fireEvent.change(screen.getByLabelText('Filtrar status'), {target:{value:'failed'}})
    fireEvent.change(screen.getByLabelText('Filtrar tipo de job'), {target:{value:'evaluate_dunning'}})
    fireEvent.change(screen.getByLabelText('Filtrar Loja por UUID'), {target:{value:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})
    fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}))
    await waitFor(() => {
      expect(screen.getByText('evaluate_dunning')).toBeInTheDocument()
    })
    expect(screen.queryByText('job-key-2026-09')).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/reprocessar|retry/i})).not.toBeInTheDocument()
  })

  it('displays security boundary notice on support sessions tab', () => {
    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: /Sessões de Suporte/i }))

    expect(screen.getByText(/Boundary de Segurança e Imutabilidade Financeira/i)).toBeInTheDocument()
    expect(screen.getByText(/somente leitura \(read_only\)/i)).toBeInTheDocument()
  })
})
