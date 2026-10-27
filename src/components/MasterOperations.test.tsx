import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MasterOperations } from './MasterOperations'

describe('MasterOperations (view-master-operacao)', () => {
  let mockClient: any

  const mockJobs = [
    {
      id: 'job-1',
      job_type: 'generate_monthly_invoices',
      status: 'completed',
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
      id: 'job-2',
      job_type: 'process_dunning_reminders',
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
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  abortSignal: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    }
  })

  it('renders operational tabs with tickets as default', async () => {
    render(<MasterOperations client={mockClient} />)

    expect(screen.getByText('Operação e Suporte Master')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Chamados' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Saúde / Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sessões de Suporte' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Equipe e Segurança' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Auditoria Master' })).toBeInTheDocument()
  })

  it('navigates to health/jobs tab and renders async jobs from server', async () => {
    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Saúde / Jobs' }))

    await waitFor(() => {
      expect(screen.getByText('Saúde da Plataforma e Fila de Jobs')).toBeInTheDocument()
      expect(screen.getByText('generate_monthly_invoices')).toBeInTheDocument()
      expect(screen.getByText('process_dunning_reminders')).toBeInTheDocument()
      expect(screen.getByText('EMAIL_PROVIDER_UNAVAILABLE')).toBeInTheDocument()
    })
  })

  it('displays security boundary notice on support sessions tab', () => {
    render(<MasterOperations client={mockClient} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Sessões de Suporte' }))

    expect(screen.getByText(/Escopo Estrito e Boundary de Segurança/i)).toBeInTheDocument()
    expect(screen.getByText(/somente leitura \(read_only\)/i)).toBeInTheDocument()
  })
})
