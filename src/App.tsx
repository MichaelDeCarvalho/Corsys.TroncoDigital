import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './lib/supabase'
import { useAuth } from './auth/useAuth'
import { Login } from './auth/Login'
import { NewPassword } from './auth/PasswordRecovery'
import { MasterMfaGate } from './auth/MasterMfaGate'
import { Workspace } from './components/Workspace'

export function ConnectedApp({ client }: { client: SupabaseClient }) {
  const auth = useAuth(client)
  if (auth.status === 'checking') return <main className="session-screen"><p role="status">Validando acesso…</p></main>
  if (auth.status === 'error') return <main className="session-screen"><div className="panel"><h1>Acesso indisponível</h1><p role="alert" className="message error">{auth.error}</p><button className="primary" onClick={() => { void auth.retry() }}>Tentar novamente</button></div></main>
  if (auth.recovery) {
    if (auth.status === 'authenticated' && auth.user) return <NewPassword client={client} userId={auth.user.id} onFinish={() => { void auth.signOut() }} />
    return <main className="session-screen"><div className="panel"><h1>Link de recuperação indisponível</h1><p role="alert">O link expirou, já foi utilizado ou não pôde ser validado. Solicite um novo e-mail.</p><a href={window.location.pathname}>Voltar ao acesso</a></div></main>
  }
  if (auth.status === 'authenticated' && auth.user) return <>
    {auth.validating && <p role="status" className="message">Atualizando acesso…</p>}
    <div inert={auth.validating || undefined} aria-busy={auth.validating || undefined}>
      <MasterMfaGate key={auth.user.id} client={client} userId={auth.user.id} onSignOut={() => { void auth.signOut() }}>
        <Workspace client={client} user={auth.user} onSignOut={() => { void auth.signOut() }} />
      </MasterMfaGate>
    </div>
  </>
  return <Login client={client} />
}

export default function App() {
  const [configuration] = useState(() => {
    try { return { client: getSupabaseClient(), error: false } } catch { return { client: null, error: true } }
  })
  if (!configuration.client) return <main className="session-screen"><div className="panel"><h1>Tronco Digital</h1><p role="alert">O ambiente ainda não está configurado. Solicite a configuração ao responsável pela aplicação.</p></div></main>
  return <ConnectedApp client={configuration.client} />
}

