import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type AuthState = { status: 'checking' | 'anonymous' | 'authenticated' | 'error'; user: User | null; error: string }
const anonymous: AuthState = { status: 'anonymous', user: null, error: '' }

export function useAuth(client: SupabaseClient) {
  const [state, setState] = useState<AuthState>({ status: 'checking', user: null, error: '' })
  const revision = useRef(0)
  const mounted = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const verify = useCallback(async () => {
    const current = ++revision.current
    setState({ status: 'checking', user: null, error: '' })
    try {
      const { data, error } = await client.auth.getUser()
      if (!mounted.current || current !== revision.current) return
      if (error && error.name !== 'AuthSessionMissingError') throw error
      setState(data.user && !error ? { status: 'authenticated', user: data.user, error: '' } : anonymous)
    } catch {
      if (mounted.current && current === revision.current) {
        setState({ status: 'error', user: null, error: 'Não foi possível validar sua sessão. Verifique a conexão e tente novamente.' })
      }
    }
  }, [client])

  useEffect(() => {
    mounted.current = true
    void verify()
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      // Supabase calls stay outside this callback to avoid the Auth lock deadlock.
      clearTimeout(timer.current)
      ++revision.current
      if (event === 'SIGNED_OUT' || !session) {
        setState(anonymous)
      } else {
        setState({ status: 'checking', user: null, error: '' })
        timer.current = setTimeout(() => { void verify() }, 0)
      }
    })
    return () => {
      mounted.current = false
      ++revision.current
      clearTimeout(timer.current)
      subscription.unsubscribe()
    }
  }, [client, verify])

  const signOut = useCallback(async () => {
    ++revision.current
    clearTimeout(timer.current)
    setState({ status: 'checking', user: null, error: '' })
    setLogoutFailed(false)
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
      if (mounted.current) setState(anonymous)
    } catch {
      if (mounted.current) {
        setLogoutFailed(true)
        setState({ status: 'error', user: null, error: 'Não foi possível encerrar a sessão. Tente sair novamente.' })
      }
    }
  }, [client])

  return { ...state, retry: logoutFailed ? signOut : verify, signOut }
}
