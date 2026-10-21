import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type AuthState = { status: 'checking' | 'anonymous' | 'authenticated' | 'error'; user: User | null; error: string; validating?: boolean }
const anonymous: AuthState = { status: 'anonymous', user: null, error: '' }

export function useAuth(client: SupabaseClient) {
  // This flag controls presentation only. getUser still validates identity.
  const recovery = useRef(typeof window !== 'undefined' && (
    new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
    || new URLSearchParams(window.location.search).get('auth') === 'recovery'
  ))
  const [state, setState] = useState<AuthState>({ status: 'checking', user: null, error: '' })
  const revision = useRef(0)
  const mounted = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const verifiedUser = useRef<User | null>(null)

  const verify = useCallback(async (preserveSameUser = false) => {
    const current = ++revision.current
    setState(preserveSameUser && verifiedUser.current
      ? { status: 'authenticated', user: verifiedUser.current, error: '', validating: true }
      : { status: 'checking', user: null, error: '' })
    try {
      const { data, error } = await client.auth.getUser()
      if (!mounted.current || current !== revision.current) return
      if (error && error.name !== 'AuthSessionMissingError') throw error
      verifiedUser.current = data.user && !error ? data.user : null
      setState(data.user && !error ? { status: 'authenticated', user: data.user, error: '' } : anonymous)
    } catch {
      if (mounted.current && current === revision.current) {
        verifiedUser.current = null
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
      if (event === 'PASSWORD_RECOVERY') recovery.current = true
      if (event === 'SIGNED_OUT') recovery.current = false
      if (event === 'SIGNED_OUT' || !session) {
        verifiedUser.current = null
        setState(anonymous)
      } else {
        const preserveSameUser = !recovery.current && event !== 'PASSWORD_RECOVERY' && !!verifiedUser.current
          && session.user.id === verifiedUser.current.id
        if (!preserveSameUser) verifiedUser.current = null
        setState(preserveSameUser
          ? { status: 'authenticated', user: verifiedUser.current, error: '', validating: true }
          : { status: 'checking', user: null, error: '' })
        timer.current = setTimeout(() => { void verify(preserveSameUser) }, 0)
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
    verifiedUser.current = null
    setState({ status: 'checking', user: null, error: '' })
    setLogoutFailed(false)
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
      recovery.current = false
      if (mounted.current) setState(anonymous)
    } catch {
      if (mounted.current) {
        setLogoutFailed(true)
        setState({ status: 'error', user: null, error: 'Não foi possível encerrar a sessão. Tente sair novamente.' })
      }
    }
  }, [client])

  return { ...state, recovery: recovery.current, retry: logoutFailed ? signOut : verify, signOut }
}

