import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { MasterBilling } from './MasterBilling'
import { MasterConsole } from './MasterConsole'

const ORG_ID = 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'
const INV_ID = '559ba052-c408-4418-b806-0c0c4b8e3603'
const SUB_ID = 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
const PLAN_ID = '44577f80-0a25-45d4-8395-5cb95ad78901'

describe('Responsive layout & mobile navigation invariants (320px / 390px / 768px / 1440px)', () => {
  it('limits fixed bottom .mobile-nav to <= 5 shortcuts while keeping all routes accessible via drawer', () => {
    const onNavigate = vi.fn()
    const { rerender } = render(
      <AppShell page="home" showMaster={false} onNavigate={onNavigate} onSignOut={vi.fn()} email="tesoureiro@loja.test">
        <div>Conteúdo</div>
      </AppShell>,
    )

    const mobileNav = screen.getByRole('navigation', { name: 'Navegação móvel' })
    const mobileButtons = within(mobileNav).getAllByRole('button')
    expect(mobileButtons).toHaveLength(5)
    expect(mobileButtons.map(btn => btn.textContent?.trim())).toEqual([
      'Início',
      'Integrantes',
      'Financeiro',
      'Inadimplência',
      'Menu',
    ])

    const mainNav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(mainNav).getAllByRole('button')).toHaveLength(15)

    const menuButton = within(mobileNav).getByRole('button', { name: 'Menu' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('sidebar')).toHaveClass('open')

    // Re-render with showMaster=true: mobile-nav still capped at 5 buttons total
    rerender(
      <AppShell page="home" showMaster={true} onNavigate={onNavigate} onSignOut={vi.fn()} email="master@corsys.test">
        <div>Conteúdo</div>
      </AppShell>,
    )
    expect(within(screen.getByRole('navigation', { name: 'Navegação móvel' })).getAllByRole('button')).toHaveLength(5)
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getAllByRole('button')).toHaveLength(16)
  })

  it('makes the mobile drawer keyboard-operable, restores focus and closes on backdrop', () => {
    const onNavigate = vi.fn()
    const { container } = render(
      <AppShell page="home" showMaster={false} onNavigate={onNavigate} onSignOut={vi.fn()} email="tesoureiro@loja.test">
        <div>Conteúdo</div>
      </AppShell>,
    )
    const bottom = screen.getByRole('navigation', { name: 'Navegação móvel' })
    const trigger = within(bottom).getByRole('button', { name: 'Menu' })

    fireEvent.click(trigger)
    const drawer = document.getElementById('sidebar')!
    const sideNav = within(drawer).getByRole('navigation', { name: 'Navegação principal' })
    const navButtons = within(sideNav).getAllByRole('button')
    expect(navButtons[0]).toHaveFocus()
    expect(drawer).toHaveClass('open')

    navButtons[navButtons.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(navButtons[0]).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(navButtons[navButtons.length - 1]).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(drawer).not.toHaveClass('open')
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    fireEvent.click(container.querySelector('.sidebar-backdrop')!)
    expect(drawer).not.toHaveClass('open')
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.click(within(sideNav).getByRole('button', { name: 'Relatórios' }))
    expect(onNavigate).toHaveBeenCalledWith('relatorios')
    expect(drawer).not.toHaveClass('open')
    expect(trigger).toHaveFocus()
  })

  it('enforces safe CSS breakpoints without blanket html/body overflow-x: hidden', async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: string) => string }>('node:fs')
    const stylesCss = readFileSync('src/styles.css', 'utf8')

    // Must never blindly hide horizontal overflow on html/body
    expect(stylesCss).not.toMatch(/html,\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/i)

    // Tablet/mobile <= 960px must collapse fixed 260px sidebar into drawer and disable pointer events when closed
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.sidebar\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;/s,
    )
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.sidebar\.open\s*\{[^}]*transform:\s*translateX\(0\);[^}]*pointer-events:\s*auto;/s,
    )

    // Off-canvas navigation must not remain keyboard-focusable when closed on mobile.
    expect(stylesCss).toMatch(/@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.sidebar\s*\{[^}]*visibility:\s*hidden;/s)
    expect(stylesCss).toMatch(/@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.sidebar\.open\s*\{[^}]*visibility:\s*visible;/s)

    // Smartphone <= 640px must collapse .metric-grid to 1 column
    expect(stylesCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.metric-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)

    // Scroll wrappers must stay constrained and scrollable
    expect(stylesCss).toMatch(/\.table-wrap\s*\{[^}]*overflow-x:\s*auto;\s*max-width:\s*100%;\s*min-width:\s*0/s)
    expect(stylesCss).toMatch(/\.finance-table\s*\{[^}]*overflow-x:\s*auto;\s*max-width:\s*100%;\s*min-width:\s*0/s)

    // Controls must not lock rigid min-widths wider than narrow mobile tracks
    expect(stylesCss).not.toMatch(/\.member-filter\s*\{[^}]*min-width:\s*148px/s)
    expect(stylesCss).toMatch(/\.period-date-input\s*\{[^}]*width:\s*100%;\s*min-width:\s*0/s)
  })

  it('wraps MasterBilling preview and breakdown tables in .finance-table horizontal scroll containers', async () => {
    const rows: Record<string, unknown[]> = {
      v_saas_invoice_balances: [
        {
          id: INV_ID,
          organization_id: ORG_ID,
          subscription_id: SUB_ID,
          invoice_number: 'FAT-2026-001',
          competence: '2026-10-01',
          due_date: '2026-10-10',
          original_amount: '250.00',
          adjustment_amount: '0.00',
          amount_due: '250.00',
          amount_paid: '0.00',
          amount_open: '250.00',
          derived_status: 'open',
          integrity_ok: true,
        },
      ],
      v_saas_invoice_charge_breakdown: [
        {
          organization_id: ORG_ID,
          invoice_id: INV_ID,
          invoice_number: 'FAT-2026-001',
          base_amount: '250.00',
          late_fee_amount: '0.00',
          interest_amount: '0.00',
          discount_credit_amount: '0.00',
          other_increase_amount: '0.00',
          net_adjustments: '0.00',
          updated_total: '250.00',
        },
      ],
    }
    const from = vi.fn((name: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        range: () => chain,
        limit: () => chain,
        abortSignal: () => Promise.resolve({ data: rows[name] ?? [], error: null }),
      }
      return chain
    })

    const rpc = vi.fn((name: string) => {
      if (name === 'preview_saas_manual_invoice') {
        const p = Promise.resolve({
          data: {
            organization_id: ORG_ID,
            organization_name: 'Loja Alpha',
            subscription_id: SUB_ID,
            plan_id: PLAN_ID,
            plan_name: 'Plano Essencial',
            competence: '2026-11-01',
            service_period_start: '2026-11-01',
            service_period_end: '2026-11-30',
            due_date: '2026-11-10',
            unit_price: 250.0,
            currency: 'BRL',
            line_items: [
              {
                item_type: 'subscription',
                description: 'Assinatura SaaS — Plano Essencial (11/2026)',
                quantity: 1,
                unit_amount: 250.0,
                line_amount: 250.0,
              },
            ],
            total_amount: 250.0,
            already_billed: false,
            existing_invoice_id: null,
            existing_invoice_number: null,
          },
          error: null,
        })
        return Object.assign(p, { abortSignal: () => p })
      }
      const p = Promise.resolve({ data: null, error: null })
      return Object.assign(p, { abortSignal: () => p })
    })

    const { container } = render(
      <MasterBilling
        client={{ from, rpc } as unknown as SupabaseClient}
        tenants={[{ organization_id: ORG_ID, organization_name: 'Loja Alpha' }]}
        initialOrganizationId={ORG_ID}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ver composição' }))
    await screen.findByText('Base contratual')

    fireEvent.click(screen.getByRole('button', { name: 'Emitir fatura manual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Consultar contrato e prévia' }))
    await screen.findByText('Plano Essencial')

    const tables = Array.from(container.querySelectorAll('table'))
    expect(tables.length).toBeGreaterThanOrEqual(3)
    for (const table of tables) {
      expect(table.closest('.finance-table, .table-wrap')).not.toBeNull()
    }
  })

  it('activates #view-master-operacao on clicking "Operação e suporte" without triggering sidebar DRE navigation', async () => {
    const onNavigate = vi.fn()
    const rpc = vi.fn(async (name: string) => {
      if (name === 'read_platform_master_overview') {
        return {
          data: {
            as_of: '2026-11-13',
            tenants_total: 1,
            tenants_active: 1,
            tenants_other: 0,
            subscriptions_active_or_trial: 1,
            subscriptions_past_due: 0,
            support_tickets_open: 1,
            plan_drafts: 0,
            access: 'MASTER',
            mfa_required: true,
          },
          error: null,
        }
      }
      return {
        data: [
          {
            organization_id: ORG_ID,
            organization_name: 'Loja Alpha',
            organization_number: '101',
            organization_status: 'active',
            subscription_status: 'active',
            plan_name: 'Plano Essencial',
            open_support_tickets: 1,
          },
        ],
        error: null,
      }
    })
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const from = vi.fn(() => query)

    const { container } = render(
      <AppShell page="master" showMaster={true} onNavigate={onNavigate} onSignOut={vi.fn()} email="master@corsys.test">
        <MasterConsole client={{ rpc, from } as unknown as SupabaseClient} />
      </AppShell>,
    )

    await screen.findByText('Loja Alpha')
    const masterSections = screen.getByRole('group', { name: 'Áreas do Master SaaS' })
    const supportBtn = within(masterSections).getByRole('button', { name: 'Operação e suporte' })
    expect(supportBtn).toHaveAttribute('type', 'button')
    expect(supportBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(supportBtn)

    await waitFor(() => {
      expect(supportBtn).toHaveAttribute('aria-pressed', 'true')
      expect(container.querySelector('#view-master-operacao')).not.toBeNull()
      expect(from).toHaveBeenCalled()
    })
    expect(onNavigate).not.toHaveBeenCalledWith('dre')
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
