import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MasterPlatformConfig } from './MasterPlatformConfig'
import {
  PLATFORM_CONFIGURATION_SELECT,
  PLATFORM_TERMS_SELECT,
  validatePlatformConfiguration,
  validatePlatformTerms,
} from '../lib/master-config'

describe('MasterPlatformConfig (view-master-config)', () => {
  let mockClient: SupabaseClient
  let configSelectSpy: ReturnType<typeof vi.fn>
  let termsSelectSpy: ReturnType<typeof vi.fn>

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

  function buildClient(
    configHandler: (signal?: AbortSignal) => Promise<{ data: any; error: any }>,
    termsHandler: (signal?: AbortSignal) => Promise<{ data: any; error: any }>
  ): SupabaseClient {
    configSelectSpy = vi.fn(() => ({
      eq: vi.fn(() => ({
        abortSignal: vi.fn((signal?: AbortSignal) => ({
          single: vi.fn(() => configHandler(signal)),
        })),
      })),
    }))
    termsSelectSpy = vi.fn(() => ({
      order: vi.fn(() => ({
        abortSignal: vi.fn((signal?: AbortSignal) => termsHandler(signal)),
      })),
    }))
    return {
      from: vi.fn((table: string) => {
        if (table === 'saas_platform_configuration') {
          return { select: configSelectSpy }
        }
        if (table === 'saas_terms_versions') {
          return { select: termsSelectSpy }
        }
        return {}
      }),
    } as unknown as SupabaseClient
  }

  beforeEach(() => {
    mockClient = buildClient(
      () => Promise.resolve({ data: mockConfig, error: null }),
      () => Promise.resolve({ data: mockTerms, error: null })
    )
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
      from: vi.fn(() => ({
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

  it('enforces explicit column projection without select("*") and supports real PostgreSQL terms schema rows', async () => {
    const pgTerms = [
      {
        id: '33333333-3333-4333-8333-333333333331',
        document_type: 'terms',
        version: '3.0',
        status: 'published',
        effective_at: '2026-03-01T00:00:00Z',
        valid_to: null,
      },
      {
        id: '33333333-3333-4333-8333-333333333332',
        document_type: 'dpa',
        version: '1.2',
        status: 'retired',
        effective_at: '2025-01-01T00:00:00Z',
        valid_to: '2026-01-01T00:00:00Z',
      },
    ]
    const pgClient = buildClient(
      () => Promise.resolve({ data: mockConfig, error: null }),
      () => Promise.resolve({ data: pgTerms, error: null })
    )

    render(<MasterPlatformConfig client={pgClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    expect(configSelectSpy).toHaveBeenCalledWith(PLATFORM_CONFIGURATION_SELECT)
    expect(configSelectSpy).not.toHaveBeenCalledWith('*')
    expect(PLATFORM_CONFIGURATION_SELECT).not.toContain('updated_by')
    expect(termsSelectSpy).toHaveBeenCalledWith(PLATFORM_TERMS_SELECT)

    fireEvent.click(screen.getByRole('tab', { name: 'Termos e Privacidade' }))
    expect(screen.getByText('Termos de Serviço da Plataforma')).toBeInTheDocument()
    expect(screen.getByText('3.0')).toBeInTheDocument()
    expect(screen.getByText('Acordo de Processamento de Dados (DPA)')).toBeInTheDocument()
    expect(screen.getByText('1.2')).toBeInTheDocument()
    expect(screen.getByText('Revogado')).toBeInTheDocument()
  })

  it('preserves the active section tab across a successful refresh (Atualizar)', async () => {
    let callCount = 0
    const refreshClient = buildClient(
      () => {
        callCount++
        return Promise.resolve({
          data: {
            ...mockConfig,
            invoice_prefix: callCount === 1 ? 'CORSYS' : 'CORSYS-V2',
          },
          error: null,
        })
      },
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={refreshClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Cobrança / Encargos' }))
    expect(screen.getByText('Cobrança e Encargos da Plataforma')).toBeInTheDocument()
    expect(screen.getByText('CORSYS')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByText('CORSYS-V2')).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: 'Cobrança / Encargos' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('Cobrança e Encargos da Plataforma')).toBeInTheDocument()
  })

  it('clears stale configuration and terms when a refresh fails with 42501, 28000, or generic error, and recovers via Atualizar', async () => {
    let mode: 'ok' | '42501' | '28000' | 'generic' = 'ok'
    const statefulClient = buildClient(
      () => {
        if (mode === '42501') {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'rls denied' } })
        }
        if (mode === '28000') {
          return Promise.resolve({ data: null, error: { code: '28000', message: 'unauthenticated' } })
        }
        if (mode === 'generic') {
          return Promise.resolve({
            data: null,
            error: { code: 'XX000', message: 'INTERNAL_SECRET_CONNECTION_STRING_LEAK' },
          })
        }
        return Promise.resolve({ data: mockConfig, error: null })
      },
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={statefulClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    // 1. Refresh fails with 42501 -> must hide stale data and show denied alert
    mode = '42501'
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Acesso restrito/i)
    })
    expect(screen.queryByText('Corsys Tronco Digital')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

    // 2. Refresh fails with 28000 -> must remain fail-closed without stale data
    mode = '28000'
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Acesso restrito/i)
    })
    expect(screen.queryByText('Corsys Tronco Digital')).not.toBeInTheDocument()

    // 3. Refresh fails with generic error -> sanitized message, no internal leak, no stale data
    mode = 'generic'
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Não foi possível consultar as configurações da plataforma/i
      )
    })
    expect(screen.queryByText(/INTERNAL_SECRET_CONNECTION_STRING_LEAK/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Corsys Tronco Digital')).not.toBeInTheDocument()

    // 4. Recovery via Atualizar when both queries succeed again
    mode = 'ok'
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('fails closed when only one of the two queries fails (no partial rendering)', async () => {
    // Case A: configuration succeeds, terms fails
    const termsFailClient = buildClient(
      () => Promise.resolve({ data: mockConfig, error: null }),
      () => Promise.resolve({ data: null, error: { code: 'PGRST301', message: 'terms failed' } })
    )

    const { unmount } = render(<MasterPlatformConfig client={termsFailClient} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.queryByText('Corsys Tronco Digital')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    unmount()

    // Case B: configuration fails, terms succeeds
    const configFailClient = buildClient(
      () => Promise.resolve({ data: null, error: { code: 'PGRST301', message: 'config failed' } }),
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={configFailClient} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.queryByText('Termos de Serviço da Plataforma')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('discards obsolete responses when a newer request or client change supersedes an in-flight request', async () => {
    let resolveFirstConfig!: (val: any) => void
    let firstSignal: AbortSignal | undefined
    let reqCounter = 0

    const raceClient = buildClient(
      (signal?: AbortSignal) => {
        reqCounter++
        if (reqCounter === 1) {
          firstSignal = signal
          return new Promise(resolve => {
            resolveFirstConfig = resolve
          })
        }
        return Promise.resolve({
          data: { ...mockConfig, trade_name: 'Corsys Atualizado Recente' },
          error: null,
        })
      },
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={raceClient} />)

    // Trigger a second request before the first resolves
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar configurações da plataforma' }))

    await waitFor(() => {
      expect(screen.getByText('Corsys Atualizado Recente')).toBeInTheDocument()
    })
    expect(firstSignal?.aborted).toBe(true)

    // Now resolve the obsolete first request with stale data
    await act(async () => {
      resolveFirstConfig({
        data: { ...mockConfig, trade_name: 'Corsys Obsoleto Antigo' },
        error: null,
      })
    })

    expect(screen.getByText('Corsys Atualizado Recente')).toBeInTheDocument()
    expect(screen.queryByText('Corsys Obsoleto Antigo')).not.toBeInTheDocument()
  })

  it('renders empty state cleanly when terms list is empty', async () => {
    const emptyTermsClient = buildClient(
      () => Promise.resolve({ data: mockConfig, error: null }),
      () => Promise.resolve({ data: [], error: null })
    )

    render(<MasterPlatformConfig client={emptyTermsClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Termos e Privacidade' }))
    expect(screen.getByText('Nenhum termo versionado cadastrado.')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Tabela de termos e políticas versionadas' })
    ).not.toBeInTheDocument()
  })

  it('rejects invalid configuration and terms payloads according to schema invariants', async () => {
    expect(() => validatePlatformConfiguration({ ...mockConfig, singleton: false })).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, default_trial_days: -1 })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, default_grace_days: -2 })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, default_retention_days: -1 })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, default_due_day: 0 })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, default_due_day: 29 })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({
        ...mockConfig,
        primary_collection_channel: 'sms' as any,
      })
    ).toThrow()
    expect(() =>
      validatePlatformConfiguration({ ...mockConfig, updated_at: 'not-a-date' })
    ).toThrow()

    expect(() =>
      validatePlatformTerms([
        {
          ...mockTerms[0],
          status: 'unknown_status',
        },
      ])
    ).toThrow()
    expect(() =>
      validatePlatformTerms([
        {
          ...mockTerms[0],
          effective_at: '2026-05-01T00:00:00Z',
          valid_to: '2026-01-01T00:00:00Z',
        },
      ])
    ).toThrow()
    expect(() =>
      validatePlatformTerms([mockTerms[0], { ...mockTerms[1], id: mockTerms[0].id }])
    ).toThrow()

    // Component fails closed if backend returns invalid schema data
    const invalidDataClient = buildClient(
      () => Promise.resolve({ data: { ...mockConfig, default_due_day: 31 }, error: null }),
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={invalidDataClient} />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.queryByText('Corsys Tronco Digital')).not.toBeInTheDocument()
  })

  it('implements full WAI-ARIA tab pattern and keyboard navigation (ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End)', async () => {
    render(<MasterPlatformConfig client={mockClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    const tablist = screen.getByRole('tablist', { name: 'Seções de configuração' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(6)

    // Initial state: first tab active (tabIndex 0), others inactive (tabIndex -1)
    expect(tabs[0]).toHaveAttribute('id', 'master-config-tab-identity')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-controls', 'master-config-panel-identity')
    expect(tabs[0]).toHaveAttribute('tabIndex', '0')
    for (let i = 1; i < tabs.length; i++) {
      expect(tabs[i]).toHaveAttribute('aria-selected', 'false')
      expect(tabs[i]).toHaveAttribute('tabIndex', '-1')
    }

    // Only one tabpanel is rendered in the DOM (no hidden inactive panel controls)
    const activePanel = screen.getByRole('tabpanel')
    expect(activePanel).toHaveAttribute('id', 'master-config-panel-identity')
    expect(activePanel).toHaveAttribute('aria-labelledby', 'master-config-tab-identity')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)

    // ArrowRight moves focus and selection to Regras Comerciais (index 1)
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('tabIndex', '0')
    expect(tabs[0]).toHaveAttribute('tabIndex', '-1')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'master-config-panel-commercial')

    // ArrowDown moves focus and selection to Cobrança / Encargos (index 2)
    fireEvent.keyDown(tabs[1], { key: 'ArrowDown' })
    expect(tabs[2]).toHaveFocus()
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'master-config-panel-billing')
    expect(screen.getByText('CORSYS')).toBeInTheDocument()

    // ArrowRight moves to Comunicação (index 3)
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' })
    expect(tabs[3]).toHaveFocus()
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'master-config-panel-communications')
    expect(screen.getByText('financeiro@corsys.com.br')).toBeInTheDocument()

    // End jumps to Integrações (index 5)
    fireEvent.keyDown(tabs[3], { key: 'End' })
    expect(tabs[5]).toHaveFocus()
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'master-config-panel-integrations')

    // ArrowRight from End wraps around to Identidade / Fiscal (index 0)
    fireEvent.keyDown(tabs[5], { key: 'ArrowRight' })
    expect(tabs[0]).toHaveFocus()
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    // ArrowLeft from index 0 wraps around to Integrações (index 5)
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    expect(tabs[5]).toHaveFocus()
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true')

    // ArrowUp moves to Termos e Privacidade (index 4)
    fireEvent.keyDown(tabs[5], { key: 'ArrowUp' })
    expect(tabs[4]).toHaveFocus()
    expect(tabs[4]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'master-config-panel-legal')

    // Home jumps back to Identidade / Fiscal (index 0)
    fireEvent.keyDown(tabs[4], { key: 'Home' })
    expect(tabs[0]).toHaveFocus()
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('distinguishes integration states without false operational confirmation (configured, not_configured, unrecognized)', async () => {
    const integrationClient = buildClient(
      () =>
        Promise.resolve({
          data: {
            ...mockConfig,
            billing_provider_status: 'not_configured',
            email_provider_status: 'configured',
            fiscal_provider_status: 'custom_unrecognized_token',
          },
          error: null,
        }),
      () => Promise.resolve({ data: mockTerms, error: null })
    )

    render(<MasterPlatformConfig client={integrationClient} />)

    await waitFor(() => {
      expect(screen.getByText('Corsys Tronco Digital')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Integrações' }))

    expect(screen.getByText('Configurado')).toBeInTheDocument()
    expect(screen.getByText('Não configurado')).toBeInTheDocument()
    expect(screen.getByText('Estado não reconhecido')).toBeInTheDocument()
    expect(
      screen.getAllByText('Disponibilidade operacional não verificada')
    ).toHaveLength(3)

    // Must never display false operational confirmation or echo raw unrecognized status string
    expect(screen.queryByText('Conectado')).not.toBeInTheDocument()
    expect(screen.queryByText('Operacional')).not.toBeInTheDocument()
    expect(screen.queryByText('Homologado')).not.toBeInTheDocument()
    expect(screen.queryByText('custom_unrecognized_token')).not.toBeInTheDocument()
  })
})

