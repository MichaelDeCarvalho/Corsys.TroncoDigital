import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Home, Users, Wallet, MessagesSquare, Settings, ShieldCheck, LogOut, Menu, X, FileText } from 'lucide-react'

export type Page =
  | 'home'
  | 'members'
  | 'cadastros'
  | 'contas-pagar'
  | 'contas-receber'
  | 'tesouraria'
  | 'fluxo-caixa'
  | 'dre'
  | 'finance'
  | 'inadimplencia'
  | 'relatorios'
  | 'structure'
  | 'dre-config'
  | 'support'
  | 'configuracoes'
  | 'master'

const pageTitles: Record<Page, string> = {
  home: 'Painel Geral',
  members: 'Integrantes',
  cadastros: 'Cadastros',
  'contas-pagar': 'Contas a Pagar',
  'contas-receber': 'Contas a Receber',
  tesouraria: 'Tesouraria',
  'fluxo-caixa': 'Fluxo de Caixa',
  dre: 'DRE Gerencial',
  finance: 'Financeiro Geral',
  inadimplencia: 'Inadimplência',
  relatorios: 'Relatórios Gerenciais',
  structure: 'Plano de Contas',
  'dre-config': 'Configurações DRE',
  support: 'Chamados',
  configuracoes: 'Configurações',
  master: 'Painel Master SaaS',
}

const navItems = [
  { id: 'home' as const, label: 'Início', Icon: Home },
  { id: 'members' as const, label: 'Integrantes', Icon: Users },
  { id: 'cadastros' as const, label: 'Cadastros', Icon: Users },
  { id: 'contas-pagar' as const, label: 'Contas a Pagar', Icon: Wallet },
  { id: 'contas-receber' as const, label: 'Contas a Receber', Icon: Wallet },
  { id: 'tesouraria' as const, label: 'Tesouraria', Icon: Wallet },
  { id: 'fluxo-caixa' as const, label: 'Fluxo de Caixa', Icon: Wallet },
  { id: 'dre' as const, label: 'DRE Gerencial', Icon: Wallet },
  { id: 'finance' as const, label: 'Financeiro', Icon: Wallet },
  { id: 'inadimplencia' as const, label: 'Inadimplência', Icon: Wallet },
  { id: 'relatorios' as const, label: 'Relatórios', Icon: FileText },
  { id: 'structure' as const, label: 'Plano de Contas', Icon: Settings },
  { id: 'dre-config' as const, label: 'Config. DRE', Icon: Settings },
  { id: 'support' as const, label: 'Chamados', Icon: MessagesSquare },
  { id: 'configuracoes' as const, label: 'Configurações', Icon: Settings },
]

function isDrawerViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(max-width: 960px)').matches
}

function isBottomNavViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(max-width: 760px)').matches
}

export function AppShell({
  children,
  page,
  showMaster = false,
  onNavigate,
  onSignOut,
  email,
}: {
  children: ReactNode
  page: Page
  showMaster?: boolean
  onNavigate: (page: Page) => void
  onSignOut: () => void
  email: string
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDrawerMode, setIsDrawerMode] = useState<boolean>(() => isDrawerViewport())
  const isDrawerModeRef = useRef<boolean>(isDrawerMode)
  const isBottomNavModeRef = useRef<boolean>(isBottomNavViewport())
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const topMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const bottomMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const firstNavButtonRef = useRef<HTMLButtonElement | null>(null)
  const focusRafRef = useRef<number | null>(null)
  const userMovedFocusInsideRef = useRef<boolean>(false)
  const openedByKeyRef = useRef<boolean>(false)

  function cancelPendingFocus() {
    if (focusRafRef.current !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(focusRafRef.current)
    }
    focusRafRef.current = null
  }

  function restoreTriggerFocus() {
    if (!isDrawerModeRef.current) return
    const candidate = menuTriggerRef.current
    if (candidate && candidate === bottomMenuTriggerRef.current && !isBottomNavModeRef.current) {
      topMenuTriggerRef.current?.focus()
      return
    }
    if (candidate) {
      candidate.focus()
      return
    }
    topMenuTriggerRef.current?.focus()
  }

  function closeMobileMenu() {
    cancelPendingFocus()
    userMovedFocusInsideRef.current = false
    openedByKeyRef.current = false
    setMobileMenuOpen(false)
    restoreTriggerFocus()
  }

  function activateMobileMenuTrigger(trigger: HTMLButtonElement) {
    if (!isDrawerModeRef.current) {
      setMobileMenuOpen(false)
      return
    }
    if (!mobileMenuOpen) {
      menuTriggerRef.current = trigger
      userMovedFocusInsideRef.current = false
      setMobileMenuOpen(true)
    } else {
      closeMobileMenu()
    }
  }

  function toggleMobileMenu(event: MouseEvent<HTMLButtonElement>) {
    if (openedByKeyRef.current && mobileMenuOpen) {
      openedByKeyRef.current = false
      return
    }
    openedByKeyRef.current = false
    activateMobileMenuTrigger(event.currentTarget)
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!mobileMenuOpen) {
        openedByKeyRef.current = true
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(() => {
            openedByKeyRef.current = false
          })
        }
      }
      activateMobileMenuTrigger(event.currentTarget)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mqlDrawer = window.matchMedia('(max-width: 960px)')
    const mqlBottom = window.matchMedia('(max-width: 760px)')

    isDrawerModeRef.current = mqlDrawer.matches
    isBottomNavModeRef.current = mqlBottom.matches
    setIsDrawerMode(mqlDrawer.matches)

    function handleDrawerBreakpointChange(event: MediaQueryListEvent) {
      const matches = event.matches
      isDrawerModeRef.current = matches
      setIsDrawerMode(matches)
      if (!matches) {
        cancelPendingFocus()
        userMovedFocusInsideRef.current = false
        setMobileMenuOpen(false)
        const sidebar = document.getElementById('sidebar')
        const active = document.activeElement
        if (
          active === topMenuTriggerRef.current ||
          active === bottomMenuTriggerRef.current ||
          (sidebar && !sidebar.contains(active) && active === document.body)
        ) {
          const currentActiveNav = sidebar?.querySelector<HTMLButtonElement>('.side-nav button[aria-current="page"]')
          ;(currentActiveNav ?? firstNavButtonRef.current)?.focus()
        }
      }
    }

    function handleBottomBreakpointChange(event: MediaQueryListEvent) {
      isBottomNavModeRef.current = event.matches
      if (!event.matches && menuTriggerRef.current === bottomMenuTriggerRef.current) {
        menuTriggerRef.current = topMenuTriggerRef.current
      }
    }

    if (typeof mqlDrawer.addEventListener === 'function') {
      mqlDrawer.addEventListener('change', handleDrawerBreakpointChange)
      mqlBottom.addEventListener('change', handleBottomBreakpointChange)
      return () => {
        mqlDrawer.removeEventListener('change', handleDrawerBreakpointChange)
        mqlBottom.removeEventListener('change', handleBottomBreakpointChange)
      }
    }

    mqlDrawer.addListener(handleDrawerBreakpointChange)
    mqlBottom.addListener(handleBottomBreakpointChange)
    return () => {
      mqlDrawer.removeListener(handleDrawerBreakpointChange)
      mqlBottom.removeListener(handleBottomBreakpointChange)
    }
  }, [])

  const drawerActive = mobileMenuOpen && isDrawerMode

  useLayoutEffect(() => {
    if (!drawerActive) {
      cancelPendingFocus()
      userMovedFocusInsideRef.current = false
      return
    }

    userMovedFocusInsideRef.current = false

    function focusFirstNavIfNeeded(): boolean {
      if (!isDrawerModeRef.current || userMovedFocusInsideRef.current) return false
      const sidebar = document.getElementById('sidebar')
      if (!sidebar || !sidebar.classList.contains('open')) return false
      if (sidebar.contains(document.activeElement)) return true
      void sidebar.offsetHeight
      const target = firstNavButtonRef.current ?? sidebar.querySelector<HTMLButtonElement>('.side-nav button:not(:disabled)')
      if (!target) return false
      void target.offsetHeight
      target.focus()
      return sidebar.contains(document.activeElement)
    }

    focusFirstNavIfNeeded()

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      cancelPendingFocus()
      focusRafRef.current = window.requestAnimationFrame(() => {
        focusRafRef.current = null
        if (!isDrawerModeRef.current || userMovedFocusInsideRef.current) return
        const sidebar = document.getElementById('sidebar')
        if (!sidebar || !sidebar.classList.contains('open')) return
        focusFirstNavIfNeeded()
        focusRafRef.current = window.requestAnimationFrame(() => {
          focusRafRef.current = null
          focusFirstNavIfNeeded()
        })
      })
    }

    const sidebarElement = document.getElementById('sidebar')

    function handleSidebarFocusIn(event: FocusEvent) {
      if (!sidebarElement) return
      const target = event.target as Node | null
      if (target && sidebarElement.contains(target) && target !== firstNavButtonRef.current) {
        userMovedFocusInsideRef.current = true
        cancelPendingFocus()
      }
    }

    function handleSidebarTransitionEnd(event: TransitionEvent) {
      if (event.target === sidebarElement) {
        focusFirstNavIfNeeded()
      }
    }

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (!isDrawerModeRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileMenu()
        return
      }
      if (event.key !== 'Tab') return

      const sidebar = document.getElementById('sidebar')
      const focusable = sidebar?.querySelectorAll<HTMLButtonElement>('.side-nav button:not(:disabled)')
      if (!sidebar || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focusedInside = sidebar.contains(document.activeElement)

      if (event.shiftKey && (document.activeElement === first || !focusedInside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !focusedInside)) {
        event.preventDefault()
        first.focus()
      }
    }

    sidebarElement?.addEventListener('focusin', handleSidebarFocusIn)
    sidebarElement?.addEventListener('transitionend', handleSidebarTransitionEnd)
    document.addEventListener('keydown', handleDrawerKeyDown)
    return () => {
      cancelPendingFocus()
      userMovedFocusInsideRef.current = false
      sidebarElement?.removeEventListener('focusin', handleSidebarFocusIn)
      sidebarElement?.removeEventListener('transitionend', handleSidebarTransitionEnd)
      document.removeEventListener('keydown', handleDrawerKeyDown)
    }
  }, [drawerActive])

  function handleNavigate(target: Page) {
    cancelPendingFocus()
    userMovedFocusInsideRef.current = false
    onNavigate(target)
    if (drawerActive) restoreTriggerFocus()
    setMobileMenuOpen(false)
  }

  function userInitials(value: string) {
    const namePart = value.split('@')[0]
    const parts = namePart.split(/[._-]/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return value.slice(0, 2).toUpperCase()
  }

  const allItems = [
    ...navItems,
    ...(showMaster ? [{ id: 'master' as const, label: 'Master SaaS', Icon: ShieldCheck }] : []),
  ]

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">Pular para conteúdo</a>
      <div
        className={`sidebar-backdrop ${drawerActive ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      <aside className={`sidebar ${drawerActive ? 'open' : ''}`} id="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">CT</div>
          {page === 'master' ? (
            <div className="brand-master-copy">
              <h1>Corsys</h1>
              <small>Tronco Digital · Gestão SaaS</small>
            </div>
          ) : (
            <div className="brand-tenant-copy">
              <h1>Corsys Tesouraria</h1>
              <small>Loja Maçônica</small>
            </div>
          )}
        </div>

        <nav className="side-nav" aria-label="Navegação principal">
          {allItems.map(({ id, label, Icon }, index) => (
            <button
              key={id}
              ref={index === 0 ? firstNavButtonRef : undefined}
              type="button"
              aria-current={page === id ? 'page' : undefined}
              onClick={() => handleNavigate(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>Ambiente DEV</span>
          <span className="version">V35</span>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="top-left">
            <button
              ref={topMenuTriggerRef}
              type="button"
              className="ghost mobile-menu"
              id="mobileMenu"
              aria-expanded={drawerActive}
              aria-controls="sidebar"
              aria-label={drawerActive ? 'Fechar menu' : 'Abrir menu'}
              onClick={toggleMobileMenu}
              onKeyDown={handleTriggerKeyDown}
            >
              {drawerActive ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <div className="topbar-title-block">
              <span className="eyebrow">{page === 'master' ? 'Gestão SaaS' : 'Loja Maçônica'}</span>
              <h2 className="topbar-page-title">{pageTitles[page] ?? 'Área da Loja'}</h2>
            </div>
          </div>
          <div className="top-actions">
            <div className="top-user" title="Usuário conectado">
              <div className="avatar" aria-hidden="true">{userInitials(email)}</div>
              <div className="top-user-meta">
                <b className="account-email">{email}</b>
                <span className="subtle">{page === 'master' ? 'Gestão global da plataforma' : 'Administração da Loja'}</span>
              </div>
            </div>
            <button type="button" className="quiet logout-btn" onClick={onSignOut} aria-label="Sair">
              <LogOut size={16} aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        <main id="main">{children}</main>
      </div>

      <nav className={showMaster ? 'mobile-nav has-master' : 'mobile-nav'} aria-label="Navegação móvel">
        {allItems
          .filter(item =>
            showMaster
              ? item.id === 'home' || item.id === 'members' || item.id === 'finance' || item.id === 'master'
              : item.id === 'home' || item.id === 'members' || item.id === 'finance' || item.id === 'inadimplencia',
          )
          .map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? 'page' : undefined}
              onClick={() => handleNavigate(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{id === 'master' ? 'Master' : label}</span>
            </button>
          ))}
        <button
          ref={bottomMenuTriggerRef}
          type="button"
          aria-expanded={drawerActive}
          aria-controls="sidebar"
          onClick={toggleMobileMenu}
          onKeyDown={handleTriggerKeyDown}
        >
          {drawerActive ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          <span>Menu</span>
        </button>
      </nav>
    </div>
  )
}

