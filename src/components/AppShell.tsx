import { Home, Users, MessagesSquare, LogOut, Wallet, Settings, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

export type Page = 'home' | 'members' | 'finance' | 'support' | 'structure' | 'master'
const navigation = [{ id: 'home' as const, label: 'Início', Icon: Home }, { id: 'members' as const, label: 'Integrantes', Icon: Users }, { id: 'finance' as const, label: 'Financeiro', Icon: Wallet }, { id: 'support' as const, label: 'Chamados', Icon: MessagesSquare }, { id: 'structure' as const, label: 'Plano de Contas', Icon: Settings }]

export function AppShell({ children, page, showMaster = false, onNavigate, onSignOut, email }: { children: ReactNode; page: Page; showMaster?: boolean; onNavigate: (page: Page) => void; onSignOut: () => void; email: string }) {
  function links() {
    return [...navigation, ...(showMaster ? [{ id: 'master' as const, label: 'Master SaaS', Icon: ShieldCheck }] : [])].map(({ id, label, Icon }) => <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)
  }
  return <div className="app-layout">
    <a className="skip-link" href="#main">Pular para conteúdo</a>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">T</span><span>CORSYS<strong>Tronco Digital</strong></span></div>
      <p className="nav-caption">Sua Loja</p><nav className="side-nav" aria-label="Navegação principal">{links()}</nav>
      <div className="sidebar-footer"><span className="status-dot" />Ambiente DEV<span className="version">V35</span></div>
    </aside>
    <div className="app-body">
      <header className="topbar"><span className="mobile-brand">Tronco Digital</span><p className="subtle account-email">{email}</p><button type="button" className="quiet" onClick={onSignOut}><LogOut size={17} aria-hidden="true" />Sair</button></header>
      <main id="main">{children}</main>
    </div>
    <nav className={showMaster ? 'mobile-nav has-master' : 'mobile-nav'} aria-label="Navegação móvel">{links()}</nav>
  </div>
}

