import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

    // Must never blindly hide horizontal overflow on html/body, nor force min-width: 320px on html/body (PR #59 parity)
    expect(stylesCss).not.toMatch(/html,\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/i)
    expect(stylesCss).not.toMatch(/html,\s*body\s*\{[^}]*min-width\s*:\s*320px/i)

    // Global fieldset, code, and modal containers must shrink safely on narrow viewports (320px / 390px)
    expect(stylesCss).toMatch(/fieldset\s*\{[^}]*min-width:\s*0;\s*max-width:\s*100%/s)
    expect(stylesCss).toMatch(/\.modal-card\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*32px\);\s*overflow-y:\s*auto/s)

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
    expect(stylesCss).toMatch(/\.table-wrap\s+table\s*\{[^}]*width:\s*100%;\s*border-collapse:\s*collapse/s)
    expect(stylesCss).toMatch(/\.finance-table\s*\{[^}]*overflow-x:\s*auto;\s*max-width:\s*100%;\s*min-width:\s*0/s)

    // Controls must not lock rigid min-widths wider than narrow mobile tracks
    expect(stylesCss).not.toMatch(/\.member-filter\s*\{[^}]*min-width:\s*148px/s)
    expect(stylesCss).toMatch(/\.period-date-input\s*\{[^}]*width:\s*100%;\s*min-width:\s*0/s)

    // KPI structural placeholders must remain non-interactive while reserving space
    expect(stylesCss).toMatch(/\.metric-placeholder\s*\{[^}]*pointer-events:\s*none;/s)

    // Mobile <= 760px must reserve scroll clearance above fixed .mobile-nav and include safe-area-inset-bottom
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*--mobile-nav-clearance:\s*calc\(88px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/s,
    )
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*html\s*\{\s*scroll-padding-bottom:\s*var\(--mobile-nav-clearance\);/s,
    )
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.app-body\s+main\s+button,\s*\.metric-grid\s+\.metric\s*\{\s*scroll-margin-bottom:\s*var\(--mobile-nav-clearance\);/s,
    )

    // F2: .sidebar-backdrop.open must only display inside @media (max-width: 960px) and never at top-level on desktop
    expect(stylesCss).not.toMatch(/^\.sidebar-backdrop\.open\s*\{\s*display:\s*block;\s*\}/m)
    expect(stylesCss).toMatch(
      /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*^\s+\.sidebar-backdrop\.open\s*\{\s*display:\s*block;\s*\}/m,
    )

    // F3: Active route in .side-nav must have a distinct :focus-visible outline higher contrast than its resting 1px border/outline
    expect(stylesCss).toMatch(
      /\.side-nav\s+button\[aria-current\]:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--gold\)/s,
    )
  })

  it('closes drawer modal state on resize from mobile (<=960px) to desktop (>960px), removes backdrop and Tab/Escape trap, does not reopen on return to mobile, and handles 760/761px bottom trigger transition', () => {
    const listeners: Record<string, Set<(e: MediaQueryListEvent) => void>> = {
      '(max-width: 960px)': new Set(),
      '(max-width: 760px)': new Set(),
    }
    const matchesState: Record<string, boolean> = {
      '(max-width: 960px)': true,
      '(max-width: 760px)': true,
    }

    const originalMatchMedia = window.matchMedia
    const matchMediaMock = vi.fn((query: string): MediaQueryList => {
      const set = (listeners[query] ??= new Set())
      return {
        get matches() {
          return matchesState[query] ?? false
        },
        media: query,
        onchange: null,
        addEventListener: vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
          if (typeof cb === 'function') set.add(cb as (e: MediaQueryListEvent) => void)
        }),
        removeEventListener: vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
          if (typeof cb === 'function') set.delete(cb as (e: MediaQueryListEvent) => void)
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    })
    window.matchMedia = matchMediaMock

    function setViewport(width: number) {
      const next960 = width <= 960
      const next760 = width <= 760
      const changed960 = matchesState['(max-width: 960px)'] !== next960
      const changed760 = matchesState['(max-width: 760px)'] !== next760
      matchesState['(max-width: 960px)'] = next960
      matchesState['(max-width: 760px)'] = next760
      act(() => {
        if (changed960) {
          for (const cb of Array.from(listeners['(max-width: 960px)'])) {
            cb({ matches: next960, media: '(max-width: 960px)' } as MediaQueryListEvent)
          }
        }
        if (changed760) {
          for (const cb of Array.from(listeners['(max-width: 760px)'])) {
            cb({ matches: next760, media: '(max-width: 760px)' } as MediaQueryListEvent)
          }
        }
      })
    }

    try {
      const onNavigate = vi.fn()
      const { container, unmount } = render(
        <AppShell page="master" showMaster={true} onNavigate={onNavigate} onSignOut={vi.fn()} email="master@corsys.test">
          <div>
            <button type="button">Atualizar plataforma</button>
          </div>
        </AppShell>,
      )

      const topTrigger = document.getElementById('mobileMenu') as HTMLButtonElement
      const bottomNav = screen.getByRole('navigation', { name: 'Navegação móvel' })
      const bottomTrigger = within(bottomNav).getByRole('button', { name: 'Menu' })
      const drawer = document.getElementById('sidebar')!
      const backdrop = container.querySelector('.sidebar-backdrop')!
      const sideNav = within(drawer).getByRole('navigation', { name: 'Navegação principal' })
      const navButtons = within(sideNav).getAllByRole('button')
      const outsideButton = screen.getByRole('button', { name: 'Atualizar plataforma' })

      // 1 & 2. Open and close from top trigger, then open from bottom trigger at 390px
      setViewport(390)
      fireEvent.click(topTrigger)
      expect(drawer).toHaveClass('open')
      expect(backdrop).toHaveClass('open')
      expect(navButtons[0]).toHaveFocus()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(drawer).not.toHaveClass('open')
      expect(topTrigger).toHaveFocus()

      // Open via bottom trigger at 390px
      fireEvent.click(bottomTrigger)
      expect(drawer).toHaveClass('open')
      expect(backdrop).toHaveClass('open')
      expect(navButtons[0]).toHaveFocus()

      // 3, 4 & 5. Resize from 390px to 1024px (desktop > 960px) while drawer is open
      setViewport(1024)
      expect(drawer).not.toHaveClass('open')
      expect(backdrop).not.toHaveClass('open')
      expect(topTrigger).toHaveAttribute('aria-expanded', 'false')
      expect(bottomTrigger).toHaveAttribute('aria-expanded', 'false')
      // Focus must NOT be returned to hidden mobile triggers on desktop; stays on visible sidebar navigation
      expect(topTrigger).not.toHaveFocus()
      expect(bottomTrigger).not.toHaveFocus()
      expect(drawer.contains(document.activeElement)).toBe(true)

      // Tab and Escape on desktop must NOT be intercepted by drawer modal listener
      outsideButton.focus()
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      document.dispatchEvent(tabEvent)
      expect(tabEvent.defaultPrevented).toBe(false)
      expect(outsideButton).toHaveFocus()

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      document.dispatchEvent(escEvent)
      expect(escEvent.defaultPrevented).toBe(false)

      // 6. Returning to mobile (390px) must NOT reopen stale drawer
      setViewport(390)
      expect(drawer).not.toHaveClass('open')
      expect(backdrop).not.toHaveClass('open')
      expect(topTrigger).toHaveAttribute('aria-expanded', 'false')
      expect(bottomTrigger).toHaveAttribute('aria-expanded', 'false')

      // 7. Boundary 760px -> 761px (tablet <=960px where bottom .mobile-nav hides at >760px, but top #mobileMenu stays visible)
      fireEvent.click(bottomTrigger)
      expect(drawer).toHaveClass('open')
      expect(navButtons[0]).toHaveFocus()

      // Resize to 768px (>760px and <=960px): drawer remains valid in tablet mode, but closing must restore focus to visible #mobileMenu, NOT hidden bottomTrigger
      setViewport(768)
      expect(drawer).toHaveClass('open')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(drawer).not.toHaveClass('open')
      expect(topTrigger).toHaveFocus()
      expect(bottomTrigger).not.toHaveFocus()

      // 8 & 9. Consecutive opens/closes, post-visibility RAF focus when initial focus is rejected by visibility:hidden, and clean cancellation on close/unmount
      const rafCallbacks: FrameRequestCallback[] = []
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      })
      const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

      try {
        setViewport(390)
        // Simulate browser ignoring synchronous focus() before visibility:visible takes effect, keeping focus on trigger
        topTrigger.focus()
        const origFocus = navButtons[0].focus.bind(navButtons[0])
        let blockedInitialSyncFocus = false
        vi.spyOn(navButtons[0], 'focus').mockImplementation(() => {
          if (!blockedInitialSyncFocus) {
            blockedInitialSyncFocus = true
            return
          }
          origFocus()
        })

        fireEvent.click(topTrigger)
        expect(drawer).toHaveClass('open')
        // Before RAF fires, focus remained on topTrigger due to simulated visibility:hidden timing
        expect(topTrigger).toHaveFocus()
        expect(rafCallbacks.length).toBeGreaterThan(0)

        // When next animation frame runs after .sidebar.open is committed, focus moves effectively to Início
        const latestRaf = rafCallbacks[rafCallbacks.length - 1]
        latestRaf(performance.now())
        expect(navButtons[0]).toHaveFocus()

        // Closing before RAF fires cancels the pending frame and does not steal focus back into the closed drawer
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(drawer).not.toHaveClass('open')
        expect(topTrigger).toHaveFocus()

        blockedInitialSyncFocus = false
        fireEvent.click(bottomTrigger)
        expect(drawer).toHaveClass('open')
        const pendingRafWhileClosing = rafCallbacks[rafCallbacks.length - 1]
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(cafSpy).toHaveBeenCalled()
        pendingRafWhileClosing(performance.now())
        expect(bottomTrigger).toHaveFocus()
      } finally {
        rafSpy.mockRestore()
        cafSpy.mockRestore()
      }

      fireEvent.click(topTrigger)
      expect(drawer).toHaveClass('open')
      unmount()
      expect(listeners['(max-width: 960px)'].size).toBe(0)
      expect(listeners['(max-width: 760px)'].size).toBe(0)
    } finally {
      window.matchMedia = originalMatchMedia
    }
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
