import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './lib/supabase'
import { useAuth } from './auth/useAuth'
import { Login } from './auth/Login'
import { Workspace } from './components/Workspace'

export function ConnectedApp({ client }: { client: SupabaseClient }) {
  const auth = useAuth(client)
  if (auth.status === 'checking') return <main className="session-screen"><p role="status">Validando acesso…</p></main>
  if (auth.status === 'error') return <main className="session-screen"><div className="panel"><h1>Acesso indisponível</h1><p role="alert" className="message error">{auth.error}</p><button className="primary" onClick={() => { void auth.retry() }}>Tentar novamente</button></div></main>
  if (auth.status === 'authenticated' && auth.user) return <Workspace key={auth.user.id} client={client} user={auth.user} onSignOut={() => { void auth.signOut() }} />
  return <Login client={client} />
}

export default function App() {
  const [configuration] = useState(() => {
    try { return { client: getSupabaseClient(), error: false } } catch { return { client: null, error: true } }
  })
  if (!configuration.client) return <main className="session-screen"><div className="panel"><h1>Tronco Digital</h1><p role="alert">O ambiente ainda não está configurado. Solicite a configuração ao responsável pela aplicação.</p></div></main>
  return <ConnectedApp client={configuration.client} />
}
