import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { DreConfig } from './DreConfig'

const ORG_ID = '94b84958-4dd9-435d-9a4e-244220835d70'
const PLAN_ID = '11111111-1111-4111-8111-111111111111'

type MockOptions = {
  hasPublishedPlan?: boolean
  persistedRegime?: string | null
  unmappedItems?: boolean
  permissionError?: boolean
  dreError?: boolean
  dreEmpty?: boolean
  expiredPublishedPlan?: boolean
  noPlans?: boolean
  settingsError?: boolean
}

function createMockClient(options: MockOptions = {}) {
  const rpc = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
    if (name === 'read_tenant_dre') {
      if (options.dreError) {
        return Promise.reject({ code: '42501', message: 'permission denied: reports.read' })
      }
      if (options.dreEmpty) {
        return Promise.resolve({ data: [], error: null })
      }
      return Promise.resolve({
        data: [
          {
            accounting_period: '2026-09-01',
            accounting_plan_id: PLAN_ID,
            accounting_account_id: 'acc-1',
            account_code: '3.1.01',
            account_description: 'Mensalidades Ordinárias',
            nature: 'revenue',
            operational_classification: 'recurring',
            signed_amount: 15000.0,
          },
          {
            accounting_period: '2026-09-01',
            accounting_plan_id: PLAN_ID,
            accounting_account_id: 'acc-2',
            account_code: '4.1.01',
            account_description: 'Despesas com Energia',
            nature: 'expense',
            operational_classification: 'fixed',
            signed_amount: -5000.0,
          },
          {
            accounting_period: '2026-10-01',
            accounting_plan_id: PLAN_ID,
            accounting_account_id: 'acc-1',
            account_code: '3.1.01',
            account_description: 'Mensalidades Ordinárias',
            nature: 'revenue',
            operational_classification: 'recurring',
            signed_amount: 18000.0,
          },
          {
            accounting_period: '2026-10-01',
            accounting_plan_id: PLAN_ID,
            accounting_account_id: 'acc-2',
            account_code: '4.1.01',
            account_description: 'Despesas com Energia',
            nature: 'expense',
            operational_classification: 'fixed',
            signed_amount: -6000.0,
          },
        ],
        error: null,
      })
    }
    throw new Error(`Unexpected RPC call: ${name}`)
  })

  const from = vi.fn().mockImplementation((table: string) => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockImplementation(() => {
        if (options.permissionError) {
          return Promise.reject({ code: '42501', message: 'permission denied: finance.read' })
        }
        if (options.settingsError && table === 'organization_settings') {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied: settings' } })
        }

        let data: unknown[] = []

        if (table === 'accounting_plans') {
          if (options.noPlans) {
            data = []
          } else if (options.hasPublishedPlan !== false) {
            data = [
              {
                id: PLAN_ID,
                organization_id: ORG_ID,
                name: 'Plano Contábil Geral 2026',
                status: 'published',
                valid_from: '2026-01-01',
                valid_to: options.expiredPublishedPlan ? '2025-12-31' : '2026-12-31',
              },
            ]
          } else {
            data = [
              {
                id: 'draft-plan-id',
                organization_id: ORG_ID,
                name: 'Rascunho Plano 2027',
                status: 'draft',
                valid_from: '2027-01-01',
                valid_to: '2027-12-31',
              },
            ]
          }
        } else if (table === 'accounting_plan_templates') {
          data = [{ id: 'tmpl-1', name: 'Modelo Padrão', version: 1, active: true }]
        } else if (table === 'financial_categories') {
          data = [
            { id: 'cat-1', organization_id: ORG_ID, name: 'Mensalidades', domain: 'member_receivable', active: true },
            { id: 'cat-2', organization_id: ORG_ID, name: 'Serviços de Manutenção', domain: 'institutional_expense', active: true },
          ]
        } else if (table === 'financial_accounts') {
          data = [
            { id: 'cash-1', organization_id: ORG_ID, name: 'Banco Santander', active: true },
            { id: 'cash-2', organization_id: ORG_ID, name: 'Caixa Pequeno', active: true },
          ]
        } else if (table === 'accounting_accounts') {
          data = [
            { id: 'acc-1', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, code: '3.1.01', description: 'Receitas', nature: 'revenue', row_type: 'analytic', active: true, parent_account_id: null },
            { id: 'acc-2', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, code: '4.1.01', description: 'Despesas', nature: 'expense', row_type: 'analytic', active: true, parent_account_id: null },
          ]
        } else if (table === 'financial_category_account_mappings') {
          data = options.unmappedItems
            ? [{ id: 'map-1', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, category_id: 'cat-1', accounting_account_id: 'acc-1' }]
            : [
                { id: 'map-1', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, category_id: 'cat-1', accounting_account_id: 'acc-1' },
                { id: 'map-2', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, category_id: 'cat-2', accounting_account_id: 'acc-2' },
              ]
        } else if (table === 'financial_account_accounting_mappings') {
          data = options.unmappedItems
            ? [{ id: 'cmap-1', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, financial_account_id: 'cash-1', accounting_account_id: 'acc-1' }]
            : [
                { id: 'cmap-1', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, financial_account_id: 'cash-1', accounting_account_id: 'acc-1' },
                { id: 'cmap-2', organization_id: ORG_ID, accounting_plan_id: PLAN_ID, financial_account_id: 'cash-2', accounting_account_id: 'acc-1' },
              ]
        } else if (table === 'organization_settings') {
          data = [
            {
              organization_id: ORG_ID,
              report_texts: options.persistedRegime ? { accounting_regime: options.persistedRegime } : {},
            },
          ]
        }

        return Promise.resolve({ data, error: null })
      }),
    }
    return builder
  })

  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc }
}

describe('DreConfig Component (DreConfig.tsx)', () => {
  it('renders active published plan details, validity range and status', async () => {
    const { client } = createMockClient({ hasPublishedPlan: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText('Plano Contábil Geral 2026')
    expect(screen.getByText('Publicado (Vigente)')).toBeInTheDocument()
    expect(screen.getByText(/01\/01\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/31\/12\/2026/)).toBeInTheDocument()
  })

  it('never labels an expired published plan as vigente', async () => {
    const { client } = createMockClient({ expiredPublishedPlan: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)
    await screen.findByText('Plano Contábil Geral 2026')
    expect(screen.getByText('Publicado (Fora da Vigência)')).toBeInTheDocument()
    expect(screen.queryByText('Publicado (Vigente)')).not.toBeInTheDocument()
  })

  it('does not report integral coverage without an accounting plan', async () => {
    const { client } = createMockClient({ noPlans: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)
    await screen.findByText(/Nenhum plano contábil cadastrado para esta Loja/)
    expect(screen.queryByText('Cobertura Integral (100%)')).not.toBeInTheDocument()
    expect(screen.getByText(/Cobertura não aferida/)).toBeInTheDocument()
  })

  it('does not silently treat settings access errors as missing regime', async () => {
    const { client } = createMockClient({ settingsError: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)
    await screen.findByText(/Seu perfil não possui permissão para consultar a estrutura contábil/)
    expect(screen.queryByText('Plano Contábil Geral 2026')).not.toBeInTheDocument()
  })

  it('renders full coverage (100%) when all categories and cash accounts are mapped', async () => {
    const { client } = createMockClient({ unmappedItems: false })
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText('Plano Contábil Geral 2026')
    expect(screen.getByText('Cobertura Integral (100%)')).toBeInTheDocument()
    expect(screen.getAllByText('2 de 2 ativas vinculadas')).toHaveLength(2)
  })

  it('identifies unmapped categories and cash accounts as real pending issues', async () => {
    const { client } = createMockClient({ unmappedItems: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText(/1 categoria\(s\) ativa\(s\) sem vínculo com o plano contábil:/)
    expect(screen.getByText('Serviços de Manutenção')).toBeInTheDocument()

    await screen.findByText(/1 conta\(s\) financeira\(s\) ativa\(s\) sem vínculo patrimonial:/)
    expect(screen.getByText('Caixa Pequeno')).toBeInTheDocument()

    expect(screen.getAllByText(/50%/)).toHaveLength(2)
  })

  it('displays persisted accounting regime ONLY when stored in database; never invents values', async () => {
    // 1. When regime is configured in database
    const { client: configuredClient } = createMockClient({ persistedRegime: 'Competência Pura' })
    const { unmount } = render(<DreConfig client={configuredClient} organizationId={ORG_ID} />)

    await screen.findByText('Competência Pura')
    expect(screen.getByText('Regime configurado e persistido institucionalmente nos parâmetros da Loja.')).toBeInTheDocument()
    unmount()

    // 2. When NO regime is configured in database
    const { client: emptyClient } = createMockClient({ persistedRegime: null })
    render(<DreConfig client={emptyClient} organizationId={ORG_ID} />)

    await screen.findByText('Nenhum regime contábil persistido nos parâmetros da Loja.')
    expect(screen.queryByText('Competência Pura')).not.toBeInTheDocument()
  })

  it('summarizes DRE and renders comparative analysis across competencies', async () => {
    const { client, rpc } = createMockClient()
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText('Resumo da DRE e Comparativo por Competência')
    await screen.findByText('Resultado Consolidado')

    // Expect summarized values
    // September: revenue 15000, expenses -5000, result 10000
    // October: revenue 18000, expenses -6000, result 12000
    // Consolidated: revenue 33000, expenses -11000, result 22000
    await waitFor(() => {
      expect(screen.getAllByText(/33\.000,00/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/22\.000,00/).length).toBeGreaterThan(0)
    })

    // Expect rows in table
    expect(screen.getByText('09/2026')).toBeInTheDocument()
    expect(screen.getByText('10/2026')).toBeInTheDocument()

    // Expect variation vs previous month (+2000 in October vs September)
    expect(screen.getByText(/\+R\$\s?2\.000,00/)).toBeInTheDocument()
  })

  it('allows navigating to Plano de Contas via onNavigate', async () => {
    const { client } = createMockClient()
    const onNavigate = vi.fn()
    render(<DreConfig client={client} organizationId={ORG_ID} onNavigate={onNavigate} />)

    await screen.findByText('Plano Contábil Geral 2026')

    const button = screen.getByRole('button', { name: /Plano de Contas/ })
    fireEvent.click(button)

    expect(onNavigate).toHaveBeenCalledWith('structure')
  })

  it('handles permission denied errors (42501) cleanly', async () => {
    const { client } = createMockClient({ permissionError: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText(/Seu perfil não possui permissão para consultar a estrutura contábil desta Loja/)
    expect(screen.queryByText('Plano Contábil Geral 2026')).not.toBeInTheDocument()
  })

  it('renders clear empty state when no DRE records exist for the selected period', async () => {
    const { client } = createMockClient({ dreEmpty: true })
    render(<DreConfig client={client} organizationId={ORG_ID} />)

    await screen.findByText(/Nenhum lançamento contábil registrado no período selecionado/)
  })
})
