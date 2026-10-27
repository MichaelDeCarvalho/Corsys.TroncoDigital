import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MasterPlatformConfig } from './MasterPlatformConfig'

describe('MasterPlatformConfig (view-master-config)', () => {
  let mockClient: any

  const mockConfig = {
    singleton: true,
    trade_name: 'Corsys Tronco Digital',
    legal_name: 'Corsys Soluções Digitais Ltda',
    tax_id: '12.345.678/0001-90',
    postal_code: '80000-000',
    address_line: 'Av. República Argentina, 1000',
    city: 'Curitiba',
    state_code: 'PR',
    billing_email: 'financeiro@corsys.com.br',
    support_email: 'suporte@corsys.com.br',
    support_phone: '(41) 3000-0000',
    default_trial_days: 14,
    default_grace_days: 7,
    default_retention_days: 90,
    default_due_day: 10,
    invoice_prefix: 'CORSYS',
    primary_collection_channel: 'email',
    billing_provider_status: 'not_configured',
    email_provider_status: 'configured',
    fiscal_provider_status: 'not_configured',
    updated_at: '2026-09-01T12:00:00Z',
  }

  const mockTerms = [
    {
      id: 'term-1',
      document_type: 'terms_of_service',
      version_number: '2.1',
      title: 'Termos de Serviço da Plataforma',
      status: 'published',
      effective_at: '2026-01-01T00:00:00Z',
      valid_to: null,
    },
    {
      id: 'term-2',
      document_type: 'privacy_policy',
      version_number: '1.0',
      title: 'Política de Privacidade e LGPD',
      status: 'published',
      effective_at: '2025-06-01T00:00:00Z',
      valid_to: null,
    },
  ]

  beforeEach(() => {
    mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'saas_platform_configuration') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                abortSignal: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
                })),
              })),
            })),
          }
        }
        if (table === 'saas_terms_versions') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                abortSignal: vi.fn().mockResolvedValue({ data: mockTerms, error: null }),
              })),
            })),
          }
        }
        return {}
      }),
    }
  })

  it('renders platform configuration and navigation tabs under master access', async () => {
    render(<MasterPlatformConfig client={mockClient} />)

    expect(screen.getByText('Configurações da Plataforma')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Identidade e Cadastro Fiscal')).toBeInTheDocument()
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
      expect(screen.getByText('Corsys Soluções Digitais Ltda')).toBeInTheDocument()
      expect(screen.getByText('12.345.678/0001-90')).toBeInTheDocument()
    })
  })

  it('switches between configuration sections (commercial, billing, terms, integrations)', async () => {
    render(<MasterPlatformConfig client={mockClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    // Commercial rules tab
    fireEvent.click(screen.getByRole('tab', { name: 'Regras Comerciais' }))
    expect(screen.getByText('Regras Comerciais Padrão')).toBeInTheDocument()
    expect(screen.getByText('14 dias')).toBeInTheDocument()
    expect(screen.getByText('Dia 10')).toBeInTheDocument()

    // Terms tab
    fireEvent.click(screen.getByRole('tab', { name: 'Termos e Privacidade' }))
    expect(screen.getByText('Termos de Serviço da Plataforma')).toBeInTheDocument()
    expect(screen.getByText('Política de Privacidade e LGPD')).toBeInTheDocument()
    expect(screen.getByText('2.1')).toBeInTheDocument()

    // Integrations tab
    fireEvent.click(screen.getByRole('tab', { name: 'Integrações' }))
    expect(screen.getByText('Status das Integrações Externas')).toBeInTheDocument()
    expect(screen.getByText('Pendente de homologação')).toBeInTheDocument()
  })

  it('fails closed when master authorization is denied', async () => {
    const deniedClient = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            abortSignal: vi.fn(() => ({
              single: vi.fn().mockRejectedValue({ code: '42501', message: 'access denied' }),
            })),
          })),
          order: vi.fn(() => ({
            abortSignal: vi.fn().mockRejectedValue({ code: '42501', message: 'access denied' }),
          })),
        })),
      })),
    } as unknown as any

    render(<MasterPlatformConfig client={deniedClient} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText(/Acesso restrito: sua autenticação requer papel MASTER e validação em dois fatores/i)
      ).toBeInTheDocument()
    })
  })
})
