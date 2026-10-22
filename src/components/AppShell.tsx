import { useState, type ReactNode } from 'react'
import { Home, Users, Wallet, MessagesSquare, Settings, ShieldCheck, LogOut, Menu, X } from 'lucide-react'

export type Page = 'home' | 'members' | 'cadastros' | 'finance' | 'structure' | 'dre-config' | 'support' | 'configuracoes' | 'master'

const pageTitles: Record<Page, string> = {
  home: 'Painel Geral',
  members: 'Integrantes',
  cadastros: 'Cadastros',
  finance: 'Financeiro',
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
  { id: 'finance' as const, label: 'Financeiro', Icon: Wallet },
  { id: 'structure' as const, label: 'Plano de Contas', Icon: Settings },
  { id: 'dre-config' as const, label: 'Config. DRE', Icon: Settings },
  { id: 'support' as const, label: 'Chamados', Icon: MessagesSquare },
  { id: 'configuracoes' as const, label: 'Configurações', Icon: Settings },
]

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

  function handleNavigate(target: Page) {
    onNavigate(target)
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
        className={`sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} id="sidebar">
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
          {allItems.map(({ id, label, Icon }) => (
            <button
              key={id}
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
              type="button"
              className="ghost mobile-menu"
              id="mobileMenu"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
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
        {allItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            onClick={() => handleNavigate(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

