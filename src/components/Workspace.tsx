import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Users, MessagesSquare, Building2, ArrowUpRight, RefreshCw } from 'lucide-react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { AppShell, type Page } from './AppShell'
import { Finance } from './Finance'
import { FinancialDashboard } from './FinancialDashboard'
import { MasterConsole } from './MasterConsole'
import { loadMasterOverview } from '../lib/master-console'
import { PlanoContas } from './PlanoContas'
import { DreConfig } from './DreConfig'
import { Members } from './Members'
import { Cadastros } from './Cadastros'
import { Configuracoes } from './Configuracoes'
import { loadOrganizations, loadTenantData, openTicket, type Organization, type TenantData } from '../lib/tenant-data'

const statuses: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', new: 'Novo', triage: 'Em triagem', working: 'Em atendimento', waiting_client: 'Aguardando retorno', resolved: 'Resolvido', closed: 'Fechado' }

export function Workspace({ client, user, onSignOut }: { client: SupabaseClient; user: User; onSignOut: () => void }) {
  const [page, setPage] = useState<Page>('home')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [masterAvailable, setMasterAvailable] = useState(false)
  const [scopeChecking,setScopeChecking] = useState(false)
  const organizationsReady = useRef(false)
  useEffect(() => {
    let active = true
    loadMasterOverview(client).then(() => {
      if (active) setMasterAvailable(true)
    }).catch(() => {
      if (active) setMasterAvailable(false)
    })
    return () => { active = false }
  }, [client, user])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setScopeChecking(true);setError('')
    if(!organizationsReady.current){setLoading(true);setOrganizations([]);setSelected('')}
    loadOrganizations(client, controller.signal).then(rows => {
      if (active) { organizationsReady.current=true;setOrganizations(rows);setSelected(previous=>rows.some(row=>row.id===previous)?previous:rows[0]?.id??'') }
    }).catch(() => { if (active) setError('Não foi possível carregar suas Lojas.') }).finally(() => { if (active) {setLoading(false);setScopeChecking(false)} })
    return () => { active = false; controller.abort() }
  }, [client, user, retry])
  const organization = organizations.find(row => row.id === selected)
  return <div inert={scopeChecking||undefined} aria-busy={scopeChecking||undefined}><AppShell page={page} showMaster={masterAvailable} onNavigate={setPage} onSignOut={onSignOut} email={user.email ?? 'Minha conta'}>
    <section className="workspace-heading"><div><p className="eyebrow">Área da Loja</p><h1>{page === 'home' ? 'Visão geral' : page === 'members' ? 'Integrantes' : page === 'cadastros' ? 'Cadastros' : page === 'finance' ? 'Financeiro' : page === 'structure' ? 'Plano de Contas' : page === 'dre-config' ? 'Configurações DRE' : page === 'configuracoes' ? 'Configurações' : page === 'master' ? 'Master SaaS' : 'Atendimento'}</h1><p className="subtle">Acompanhe as informações da sua organização.</p></div>
      {page !== 'master' && !!organizations.length && <div className="org-selector"><label htmlFor="organization">Loja</label><select id="organization" value={selected} onChange={e => setSelected(e.target.value)}>{organizations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>}
    </section>
    {page === 'master' ? (
      masterAvailable ? <MasterConsole key={user.id} client={client} />
      : <p role="alert" className="message error">O acesso ao Master SaaS requer perfil da plataforma e MFA ativo.</p>
    ) : loading ? <p role="status" className="message">Carregando suas Lojas…</p> : error ? <div className="panel"><p role="alert" className="message error">{error}</p><button className="secondary" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div> : !organization ? <div className="empty panel"><Building2 size={32} aria-hidden="true" /><h2>Nenhuma Loja vinculada</h2><p>Solicite ao administrador o vínculo da sua conta a uma Loja.</p></div> : <TenantPanel key={organization.id} client={client} organization={organization} page={page} onNavigate={setPage} />}
  </AppShell></div>
}

function TenantPanel({ client, organization, page, onNavigate }: { client: SupabaseClient; organization: Organization; page: Page; onNavigate: (page: Page) => void }) {
  const [data, setData] = useState<TenantData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [sent, setSent] = useState(false)
  const [memberSaved, setMemberSaved] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true); setData(null); setError('')
    loadTenantData(client, organization.id, controller.signal).then(result => { if (active) setData(result) }).catch(() => { if (active) setError('Não foi possível carregar os dados desta Loja. Tente novamente ou solicite a revisão do seu acesso.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [client, organization.id, revision])
  if (loading) return <p role="status" className="message">Carregando dados da Loja…</p>
  if (error || !data) return <div className="panel"><p role="alert" className="message error">{error}</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>
  const open = data.tickets.filter(ticket => !['resolved', 'closed'].includes(ticket.status))
  return <>
    {page === 'structure' && <PlanoContas key={organization.id} client={client} organizationId={organization.id} />}
    {page === 'dre-config' && <DreConfig key={organization.id} client={client} organizationId={organization.id} />}
    {page === 'finance' && <Finance key={organization.id} client={client} organizationId={organization.id} />}
    {page === 'cadastros' && <Cadastros members={data.members} client={client} organizationId={organization.id} onSaved={() => setRevision(v => v + 1)} onReload={() => setRevision(v => v + 1)} />}
    {page === 'configuracoes' && <Configuracoes client={client} organizationId={organization.id} />}
    {sent && page === 'support' && <p role="status" className="message">Chamado enviado. A lista foi atualizada.</p>}
    {page === 'home' && <>
      <section className="hero-card"><div><span className="pill">{organization.status === 'active' ? 'Loja ativa' : 'Loja inativa'}</span><h2>{organization.name}</h2><p>Um espaço para cuidar da sua Loja, dos seus integrantes e do seu atendimento.</p></div><Building2 size={58} strokeWidth={1.2} aria-hidden="true" /></section>
      <FinancialDashboard client={client} organizationId={organization.id} />
      <div className="metric-grid"><article className="panel metric"><Users size={23} aria-hidden="true" /><p>Integrantes carregados</p><strong>{data.members.length}</strong><button className="text-button" onClick={() => onNavigate('members')}>Ver integrantes <ArrowUpRight size={16} aria-hidden="true" /></button></article><article className="panel metric"><MessagesSquare size={23} aria-hidden="true" /><p>Chamados abertos carregados</p><strong>{open.length}</strong><button className="text-button" onClick={() => onNavigate('support')}>Acompanhar chamados <ArrowUpRight size={16} aria-hidden="true" /></button></article><article className="panel info-card"><p className="eyebrow">Atendimento</p><h3>Precisa de ajuda?</h3><p>Abra um chamado para acompanhar sua solicitação junto ao suporte.</p><button className="secondary" onClick={() => onNavigate('support')}>Ir para atendimento</button></article></div>
      <section className="panel"><div className="section-title"><h2>Integrantes da Loja</h2><button className="text-button" onClick={() => onNavigate('members')}>Ver lista</button></div><MemberList members={data.members.slice(0, 5)} /></section>
    </>}
    {page === 'members' && <>{memberSaved && <p role="status" className="message">Cadastro salvo. A lista foi atualizada.</p>}<Members members={data.members} client={client} organizationId={organization.id} onSaved={() => { setMemberSaved(true); setRevision(value => value + 1) }} onReload={() => { setMemberSaved(false); setRevision(value => value + 1) }} /></>}
    {page === 'support' && <div className="support-grid"><section className="panel"><div className="section-title"><h2>Meus chamados</h2><button className="quiet" onClick={() => setRevision(value => value + 1)} aria-label="Atualizar chamados"><RefreshCw size={18} aria-hidden="true" /></button></div>{!data.tickets.length ? <div className="empty"><MessagesSquare size={30} aria-hidden="true" /><h3>Nenhum chamado por aqui</h3><p>Suas solicitações aparecerão nesta lista.</p></div> : <ul className="ticket-list">{data.tickets.map(ticket => <li key={ticket.id}><div><span className="subtle">#{ticket.ticket_seq} · {new Date(ticket.opened_at).toLocaleDateString('pt-BR')}</span><h3>{ticket.subject}</h3></div><span className="pill">{statuses[ticket.status] ?? ticket.status}</span></li>)}</ul>}<p className="subtle list-note">Até 100 chamados mais recentes desta Loja.</p></section><section className="panel"><h2>Novo chamado</h2><p className="subtle">Conte como podemos ajudar.</p><TicketForm client={client} organizationId={organization.id} onCreated={() => { setSent(true); setRevision(value => value + 1) }} /></section></div>}
  </>
}

function MemberList({ members }: { members: TenantData['members'] }) {
  return !members.length ? <p className="empty">Nenhum integrante encontrado.</p> : <ul className="member-list">{members.map(member => <li key={member.id}><span className="avatar" aria-hidden="true">{member.full_name.slice(0, 1).toUpperCase()}</span><span className="member-name">{member.full_name}</span><span className="pill">{statuses[member.status] ?? member.status}</span></li>)}</ul>
}

function TicketForm({ client, organizationId, onCreated }: { client: SupabaseClient; organizationId: string; onCreated: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const guard = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guard.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    const subject = String(values.get('subject') ?? '').trim()
    const message = String(values.get('message') ?? '').trim()
    if (!subject || !message) { setError('Informe o assunto e a descrição.'); return }
    guard.current = true; setPending(true); setError('')
    try {
      await openTicket(client, organizationId, subject, message)
      if (mounted.current) { form.reset(); onCreated() }
    } catch {
      if (mounted.current) setError('Não foi possível confirmar o envio. Atualize a lista antes de tentar novamente para evitar duplicidade.')
    } finally {
      guard.current = false
      if (mounted.current) setPending(false)
    }
  }
  return <form onSubmit={submit} aria-label="Novo chamado"><label htmlFor="subject">Assunto</label><input id="subject" name="subject" maxLength={180} required disabled={pending} /><label htmlFor="message">Descrição</label><textarea id="message" name="message" rows={5} maxLength={4000} required disabled={pending} />{error && <p role="alert" className="message error">{error}</p>}<button className="primary wide" type="submit" disabled={pending}>{pending ? 'Enviando…' : 'Enviar chamado'}</button></form>
}
