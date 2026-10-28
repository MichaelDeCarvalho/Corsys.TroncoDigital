import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { ConnectedApp } from './App'
import { Workspace } from './components/Workspace'

const userA = { id: 'user-a', email: 'a@example.invalid' } as User
const orgA = { id: 'org-a', name: 'Loja A', number: 'A', status: 'active' }
const orgB = { id: 'org-b', name: 'Loja B', number: 'B', status: 'active' }
const member = (org: string, name: string) => ({ id: `member-${org}`, organization_id: org, full_name: name, status: 'active' })
type Result = { data: unknown; error: null | { message: string } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

function mockClient(options: { user?: User | null; orgs?: typeof orgA[]; respond?: (table: string, id: string) => Promise<Result> } = {}) {
  let listener: (event: string, session: unknown) => void = () => {}
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? userA : options.user }, error: null }),
    onAuthStateChange: vi.fn(callback => { listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }
  const from = vi.fn((table: string) => {
    let id = ''
    const chain = {
      select: (_: string) => chain,
      order: (_: string, __?: unknown) => chain,
      limit: (_: number) => chain,
      range: (_: number, __: number) => chain,
      eq: (_: string, value: string) => { id = value; return chain },
      abortSignal: (_: AbortSignal) => table === 'platform_staff' ? Promise.resolve({ data: [], error: null }) : options.respond?.(table, id) ?? Promise.resolve({ data: table === 'organizations' ? (options.orgs ?? [orgA]) : table === 'members' ? [member(id, id === orgB.id ? 'Integrante B' : 'Integrante A')] : [], error: null }),
    }
    return chain
  })
  const rpc = vi.fn().mockResolvedValue({ data: 'ticket-id', error: null })
  return { client: { auth, from, rpc } as unknown as SupabaseClient, auth, from, rpc, emit: (event: string, session: unknown = null) => act(() => listener(event, session)) }
}

describe('Login and session boundary', () => {
  it.each(['TOKEN_REFRESHED','SIGNED_IN'])('preserves the current screen and form while revalidating the same identity on %s', async event => {
    const mock=mockClient({orgs:[orgA,orgB]});render(<ConnectedApp client={mock.client}/>);await screen.findByText('Integrante A')
    fireEvent.change(screen.getByLabelText('Loja'),{target:{value:orgB.id}});await screen.findByText('Integrante B')
    fireEvent.click(within(screen.getByRole('navigation',{name:'Navegação principal'})).getByRole('button',{name:'Integrantes'}))
    fireEvent.change(screen.getByLabelText('Buscar integrante'),{target:{value:'Preenchimento preservado'}})
    const pending=deferred<{data:{user:User};error:null}>();mock.auth.getUser.mockReturnValueOnce(pending.promise)
    mock.emit(event,{user:userA})
    expect(screen.getByLabelText('Buscar integrante')).toHaveValue('Preenchimento preservado')
    expect(screen.getByLabelText('Buscar integrante').closest('[inert]')).not.toBeNull()
    await waitFor(()=>expect(mock.auth.getUser).toHaveBeenCalledTimes(2))
    await act(async()=>{pending.resolve({data:{user:{...userA}},error:null});await pending.promise})
    expect(screen.getByLabelText('Buscar integrante')).toHaveValue('Preenchimento preservado')
    expect(screen.getByLabelText('Buscar integrante').closest('[inert]')).toBeNull()
    expect(screen.getByLabelText('Loja')).toHaveValue(orgB.id)
    await waitFor(()=>expect(mock.from.mock.calls.filter(([table])=>table==='organizations')).toHaveLength(2))
  })
  it('rechecks organization scope on refresh and removes a revoked selected tenant',async()=>{
    let orgReads=0
    const mock=mockClient({respond:async(table,id)=>({data:table==='organizations'?(++orgReads===1?[orgA,orgB]:[orgA]):table==='members'?[member(id,id===orgB.id?'Integrante B':'Integrante A')]:[],error:null})})
    render(<ConnectedApp client={mock.client}/>);await screen.findByText('Integrante A')
    fireEvent.change(screen.getByLabelText('Loja'),{target:{value:orgB.id}});await screen.findByText('Integrante B')
    mock.auth.getUser.mockResolvedValueOnce({data:{user:{...userA}},error:null});mock.emit('TOKEN_REFRESHED',{user:userA})
    await waitFor(()=>expect(screen.getByLabelText('Loja')).toHaveValue(orgA.id));await screen.findByText('Integrante A')
    expect(screen.queryByText('Integrante B')).not.toBeInTheDocument()
  })
  it('hides the preserved workspace if background identity validation fails', async()=>{
    const mock=mockClient();render(<ConnectedApp client={mock.client}/>);await screen.findByText('Integrante A')
    mock.auth.getUser.mockRejectedValueOnce(new Error('verification unavailable'))
    mock.emit('TOKEN_REFRESHED',{user:userA})
    expect(screen.getByText('Integrante A').closest('[inert]')).not.toBeNull()
    await screen.findByText('Não foi possível validar sua sessão. Verifique a conexão e tente novamente.')
    expect(screen.queryByText('Integrante A')).not.toBeInTheDocument()
  })
  it('hides old tenant data immediately when the auth event identifies a different user',async()=>{
    const mock=mockClient();render(<ConnectedApp client={mock.client}/>);await screen.findByText('Integrante A')
    mock.auth.getUser.mockRejectedValueOnce(new Error('new user not verified'))
    mock.emit('SIGNED_IN',{user:{...userA,id:'user-b'}})
    expect(screen.queryByText('Integrante A')).not.toBeInTheDocument()
    await screen.findByRole('alert')
  })
  it('keeps tenant data hidden before login and reports a failed login without retaining the password', async () => {
    const mock = mockClient({ user: null })
    mock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'invalid credentials' } })
    render(<ConnectedApp client={mock.client} />)
    await screen.findByRole('heading', { name: 'Acesse sua Loja' })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@example.invalid' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-only-value' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Acesso à Loja' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('does not let a delayed identity response reopen the workspace after SIGNED_OUT', async () => {
    const mock = mockClient()
    const pending = deferred<{ data: { user: User }; error: null }>()
    mock.auth.getUser.mockReturnValue(pending.promise)
    render(<ConnectedApp client={mock.client} />)
    mock.emit('SIGNED_OUT')
    await screen.findByRole('heading', { name: 'Acesse sua Loja' })
    await act(async () => { pending.resolve({ data: { user: userA }, error: null }); await pending.promise })
    expect(mock.from).not.toHaveBeenCalled()
    expect(screen.queryByText('Integrante A')).not.toBeInTheDocument()
  })

  it('hides all workspace data immediately on logout and uses local session scope', async () => {
    const mock = mockClient()
    const pending = deferred<{ error: null }>()
    mock.auth.signOut.mockReturnValue(pending.promise)
    render(<ConnectedApp client={mock.client} />)
    await screen.findByText('Integrante A')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.queryByText('Integrante A')).not.toBeInTheDocument()
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    await act(async () => { pending.resolve({ error: null }); await pending.promise })
    await screen.findByRole('heading', { name: 'Acesse sua Loja' })
  })

  it('fails closed when identity validation is unavailable and supports retry', async () => {
    const mock = mockClient()
    mock.auth.getUser.mockRejectedValueOnce(new Error('offline'))
    render(<ConnectedApp client={mock.client} />)
    await screen.findByRole('alert')
    expect(mock.from).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Integrante A')
  })
})

describe('Tenant workspace', () => {
  it('opens the connected financial structure from the application navigation', async () => {
    const mock = mockClient()
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByText('Integrante A')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('button', { name: 'Plano de Contas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Categorias e Regras' }))
    await screen.findByRole('form', { name: 'Cadastrar categoria financeira' })
    expect(mock.from).toHaveBeenCalledWith('financial_categories')
    expect(mock.from).toHaveBeenCalledWith('recurring_rules')
  })
  it('opens the financial consultation through the application navigation', async () => {
    const mock = mockClient()
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByText('Integrante A')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('button', { name: 'Financeiro' }))
    await screen.findByText('Nenhum registro nesta página.')
    expect(mock.from).toHaveBeenCalledWith('v_charge_balances')
  })
  it('navigates to members and searches the loaded data', async () => {
    const mock = mockClient()
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByText('Integrante A')
    const nav = within(screen.getByRole('navigation', { name: 'Navegação principal' }))
    fireEvent.click(nav.getByRole('button', { name: 'Integrantes' }))
    fireEvent.change(screen.getByLabelText('Buscar integrante'), { target: { value: 'inexistente' } })
    expect(screen.getByText('Nenhum integrante encontrado.')).toBeInTheDocument()
    expect(screen.queryByText('Integrante A')).not.toBeInTheDocument()
  })

  it('rejects an unexpected organization in a data response', async () => {
    const mock = mockClient({ respond: async table => ({ data: table === 'organizations' ? [orgA] : table === 'members' ? [member('other-org', 'Não deve aparecer')] : [], error: null }) })
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Não deve aparecer')).not.toBeInTheDocument()
  })

  it('discards late responses from a previously selected organization', async () => {
    const old = deferred<Result>()
    const mock = mockClient({ respond: (table, id) => table === 'organizations' ? Promise.resolve({ data: [orgA, orgB], error: null }) : table === 'members' && id === orgA.id ? old.promise : Promise.resolve({ data: table === 'members' ? [member(orgB.id, 'Integrante B')] : [], error: null }) })
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByLabelText('Loja')
    fireEvent.change(screen.getByLabelText('Loja'), { target: { value: orgB.id } })
    await screen.findByText('Integrante B')
    await act(async () => { old.resolve({ data: [member(orgA.id, 'Resposta antiga A')], error: null }); await old.promise })
    expect(screen.queryByText('Resposta antiga A')).not.toBeInTheDocument()
    expect(screen.getByText('Integrante B')).toBeInTheDocument()
  })

  it('creates a support ticket only in the selected organization and guards duplicate submission', async () => {
    const mock = mockClient()
    const pending = deferred<{ data: string; error: null }>()
    mock.rpc.mockReturnValue(pending.promise)
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByText('Integrante A')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('button', { name: 'Chamados' }))
    fireEvent.change(screen.getByLabelText('Assunto'), { target: { value: 'Ajuda com cadastro' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Solicitação de teste' } })
    const form = screen.getByRole('form', { name: 'Novo chamado' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(mock.rpc.mock.calls.filter(call => call[0] === 'create_saas_support_ticket')).toHaveLength(1)
    expect(mock.rpc).toHaveBeenCalledWith('create_saas_support_ticket', expect.objectContaining({ p_organization_id: orgA.id, p_subject: 'Ajuda com cadastro' }))
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    await act(async () => { pending.resolve({ data: 'ticket-id', error: null }); await pending.promise })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar chamado' })).toBeEnabled())
  })

  it('shows a clear message for users without any organization', async () => {
    const mock = mockClient({ orgs: [] })
    render(<Workspace client={mock.client} user={userA} onSignOut={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Nenhuma Loja vinculada' })
    expect(mock.rpc.mock.calls.filter(call => call[0] === 'create_saas_support_ticket')).toHaveLength(0)
  })
})


describe('Recovery session boundary', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))
  it('handles PASSWORD_RECOVERY without opening tenant queries', async () => {
    const mock = mockClient()
    render(<ConnectedApp client={mock.client} />)
    mock.emit('PASSWORD_RECOVERY', { user: userA })
    await screen.findByRole('heading', { name: 'Definir nova senha' })
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('does not accept a recovery URL as proof of identity', async () => {
    window.history.replaceState(null, '', '/?auth=recovery')
    const mock = mockClient({ user: null })
    render(<ConnectedApp client={mock.client} />)
    await screen.findByRole('heading', { name: 'Link de recuperação indisponível' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(screen.queryByRole('form', { name: 'Nova senha' })).not.toBeInTheDocument()
  })
})

