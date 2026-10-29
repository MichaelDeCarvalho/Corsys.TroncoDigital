import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './lib/supabase'
import { useAuth } from './auth/useAuth'
import { Login } from './auth/Login'
import { NewPassword } from './auth/PasswordRecovery'
import { Workspace } from './components/Workspace'
import { MfaGate } from './auth/MfaGate'
import { errorMonitor } from './lib/error-monitor'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error | null, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    errorMonitor.captureException(error, {
      category: 'render_error',
      componentStack: errorInfo.componentStack,
    })
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <main className="session-screen">
          <div className="panel" role="alert">
            <h1>Erro inesperado</h1>
            <p className="message error">
              Ocorreu uma falha ao renderizar a interface. Tente recarregar a aplicação.
            </p>
            <button
              type="button"
              className="primary"
              onClick={this.handleReset}
            >
              Tentar novamente
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}

export function ConnectedApp({ client }: { client: SupabaseClient }) {
  const auth = useAuth(client)
  const lastLoggedAuth = useRef<string | null>(null)

  useEffect(() => {
    const key = `${auth.status}:${auth.error}:${auth.user?.id || ''}:${auth.recovery}`
    if (lastLoggedAuth.current === key) return
    lastLoggedAuth.current = key

    if (auth.status === 'error') {
      errorMonitor.captureAuthError(auth.error || 'Acesso indisponível', {
        status: auth.status,
        recovery: auth.recovery,
      })
    } else if (auth.status === 'authenticated' && auth.user) {
      errorMonitor.captureAuthEvent('session_authenticated', {
        userId: auth.user.id,
        recovery: auth.recovery,
      })
    } else if (auth.status === 'anonymous') {
      errorMonitor.captureAuthEvent('session_anonymous', {
        recovery: auth.recovery,
      })
    }
  }, [auth.status, auth.error, auth.user?.id, auth.recovery])

  if (auth.status === 'checking') return <main className="session-screen"><p role="status">Validando acesso…</p></main>
  if (auth.status === 'error') {
    return (
      <main className="session-screen">
        <div className="panel">
          <h1>Acesso indisponível</h1>
          <p role="alert" className="message error">{auth.error}</p>
          <button
            className="primary"
            onClick={() => {
              errorMonitor.captureAuthEvent('auth_retry_requested')
              void auth.retry()
            }}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }
  if (auth.recovery) {
    if (auth.status === 'authenticated' && auth.user) {
      return (
        <NewPassword
          client={client}
          userId={auth.user.id}
          onFinish={() => {
            errorMonitor.captureAuthEvent('recovery_finished')
            void auth.signOut()
          }}
        />
      )
    }
    return (
      <main className="session-screen">
        <div className="panel">
          <h1>Link de recuperação indisponível</h1>
          <p role="alert">O link expirou, já foi utilizado ou não pôde ser validado. Solicite um novo e-mail.</p>
          <a href={window.location.pathname}>Voltar ao acesso</a>
        </div>
      </main>
    )
  }
  if (auth.status === 'authenticated' && auth.user) {
    return (
      <>
        {auth.validating && <p role="status" className="message">Atualizando acesso…</p>}
        <div inert={auth.validating || undefined} aria-busy={auth.validating || undefined}>
          <MfaGate key={auth.user.id} client={client} onSignOut={() => { void auth.signOut() }}>
            <Workspace key={auth.user.id} client={client} user={auth.user} onSignOut={() => { void auth.signOut() }} />
          </MfaGate>
        </div>
      </>
    )
  }
  return <Login client={client} />
}

export default function App() {
  const [configuration] = useState(() => {
    try {
      return { client: getSupabaseClient(), error: false }
    } catch (err) {
      errorMonitor.captureException(err, {
        category: 'config_error',
        message: 'Falha na inicialização do cliente Supabase',
      })
      return { client: null, error: true }
    }
  })

  return (
    <ErrorBoundary>
      {!configuration.client ? (
        <main className="session-screen">
          <div className="panel">
            <h1>Tronco Digital</h1>
            <p role="alert">O ambiente ainda não está configurado. Solicite a configuração ao responsável pela aplicação.</p>
          </div>
        </main>
      ) : (
        <ConnectedApp client={configuration.client} />
      )}
    </ErrorBoundary>
  )
}


