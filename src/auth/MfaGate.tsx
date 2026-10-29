import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// Presentation only: Master RPCs remain responsible for role and AAL2 enforcement.
export function MfaGate({ client, children, onSignOut }: {
  client: SupabaseClient; children: ReactNode; onSignOut: () => void
}) {
  const [state, setState] = useState<'checking' | 'ready' | 'challenge' | 'error'>('checking')
  const [factors, setFactors] = useState<{ id: string; label: string }[]>([])
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [retry, setRetry] = useState(0)
  const locked = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    let active = true
    setState('checking')
    async function check() {
      try {
        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assurance.error || !assurance.data) throw Error('Assurance unavailable')
        if (!active) return
        if (assurance.data.currentLevel === 'aal2' || assurance.data.nextLevel !== 'aal2') {
          setState('ready')
          return
        }
        const result = await client.auth.mfa.listFactors()
        if (result.error) throw result.error
        const available = result.data.totp.filter(f => f.status === 'verified')
          .map((f, index) => ({ id: f.id, label: f.friendly_name || `Autenticador ${index + 1}` }))
        if (!available.length) throw Error('Verified TOTP unavailable')
        if (active) { setFactors(available); setFactorId(available[0].id); setState('challenge') }
      } catch {
        if (active) setState('error')
      }
    }
    void check()
    return () => { active = false; mounted.current = false }
  }, [client, retry])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current || !/^\d{6}$/.test(code) || !factors.some(f => f.id === factorId)) return
    locked.current = true; setPending(true); setError('')
    const verificationCode = code
    setCode('')
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code: verificationCode })
      if (result.error) throw result.error
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw Error('MFA not confirmed')
      if (mounted.current) setState('ready')
    } catch {
      if (mounted.current) setError('Não foi possível confirmar o código. Use o código atual do seu autenticador e tente novamente.')
    } finally {
      locked.current = false
      if (mounted.current) setPending(false)
    }
  }
  if (state === 'ready') return children
  return <main className="session-screen"><section className="panel" aria-label="Verificação em duas etapas">
    <h1>Verificação em duas etapas</h1>
    {state === 'checking' ? <p role="status">Verificando autenticação…</p> : state === 'error' ? <>
      <p role="alert">Não foi possível verificar sua autenticação em duas etapas.</p>
      <button onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>
    </> : <>
      <p>Digite o código de seis números do autenticador já cadastrado na sua conta.</p>
      <form onSubmit={submit} aria-label="Confirmar MFA">
        {factors.length > 1 && <><label htmlFor="mfa-factor">Autenticador</label><select id="mfa-factor" value={factorId} disabled={pending} onChange={e => setFactorId(e.target.value)}>{factors.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></>}
        <label htmlFor="mfa-code">Código do autenticador</label>
        <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={pending} required />
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={pending || code.length !== 6}>{pending ? 'Confirmando…' : 'Confirmar código'}</button>
      </form>
    </>}
    <button className="secondary" disabled={pending} onClick={onSignOut}>Sair</button>
  </section></main>
}
