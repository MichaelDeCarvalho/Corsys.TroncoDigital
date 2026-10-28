import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMasterOverview } from '../lib/master-console'

type Factor = { id: string; friendly_name?: string }
type Setup = { id: string; qr: string }
type Stage = 'checking' | 'tenant' | 'ready' | 'setup' | 'verify' | 'error'

// Render as an image, never as inline SVG/HTML; never persist or log enrollment material.
export function mfaQrImage(qr: string) {
  if (qr.startsWith('data:image/svg+xml;') || qr.startsWith('data:image/svg+xml,')) return qr
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(qr)) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr)
  }
  throw new Error('Unsupported MFA image')
}

export function MasterMfaGate({ client, userId, onSignOut, children }: {
  client: SupabaseClient; userId: string; onSignOut: () => void; children: ReactNode
}) {
  const [stage, setStage] = useState<Stage>('checking')
  const [factors, setFactors] = useState<Factor[]>([])
  const [pendingFactors, setPendingFactors] = useState<string[]>([])
  const [factorId, setFactorId] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const action = useRef(false)

  async function identity() {
    const result = await client.auth.getUser()
    if (result.error || result.data.user?.id !== userId) throw new Error('Identity changed')
  }

  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    setBusy(false); setStage('checking'); setSetup(null); setError(''); setFactors([]); setPendingFactors([])
    async function check() {
      try {
        await identity()
        const result = await client.from('platform_staff').select('user_id,role,active')
          .eq('user_id', userId).abortSignal(controller.signal)
        if (result.error || !Array.isArray(result.data) || result.data.length > 1 ||
          result.data.some(row => row.user_id !== userId || typeof row.role !== 'string' || typeof row.active !== 'boolean')) {
          throw new Error('Invalid staff lookup')
        }
        const master = result.data.some(row => row.role === 'MASTER' && row.active)
        if (!master) {
          if (generation.current === current) setStage('tenant')
          return
        }
        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assurance.error) throw assurance.error
        if (assurance.data.currentLevel === 'aal2') {
          await loadMasterOverview(client)
          if (generation.current === current) setStage('ready')
          return
        }
        const listed = await client.auth.mfa.listFactors()
        if (listed.error) throw listed.error
        if (generation.current !== current) return
        const verified = listed.data.totp.filter(factor => factor.status === 'verified')
        const pending = listed.data.all.filter(factor => factor.factor_type === 'totp' &&
          factor.status === 'unverified' && factor.friendly_name === 'CorSys Master')
        setFactors(verified); setPendingFactors(pending.map(factor => factor.id))
        setFactorId(verified[0]?.id ?? '')
        setStage(verified.length ? 'verify' : 'setup')
      } catch {
        if (generation.current === current) {
          setError('Não foi possível verificar seu acesso. Tente novamente ou saia da sessão.')
          setStage('error')
        }
      }
    }
    void check()
    return () => { ++generation.current; controller.abort() }
  // Identity is keyed by userId; Auth revalidation of the same user must preserve the form.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, userId, revision])

  async function enroll() {
    if (action.current) return
    action.current = true; setBusy(true); setError('')
    const current = generation.current
    try {
      await identity()
      const listed = await client.auth.mfa.listFactors()
      if (listed.error) throw listed.error
      if (listed.data.totp.some(factor => factor.status === 'verified')) {
        if (generation.current === current) setRevision(value => value + 1)
        return
      }
      // Only replace this application's unfinished enrollment, after an explicit click.
      for (const factor of listed.data.all.filter(factor => factor.factor_type === 'totp' &&
        factor.status === 'unverified' && factor.friendly_name === 'CorSys Master')) {
        if (generation.current !== current) return
        const removed = await client.auth.mfa.unenroll({ factorId: factor.id })
        if (removed.error) throw removed.error
      }
      if (generation.current !== current) return
      await identity()
      const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CorSys Master' })
      if (enrolled.error || enrolled.data?.type !== 'totp') throw new Error('Enrollment unavailable')
      const qr = mfaQrImage(enrolled.data.totp.qr_code)
      if (generation.current === current) {
        setSetup({ id: enrolled.data.id, qr }); setFactorId(enrolled.data.id); setPendingFactors([])
        setStage('verify')
      }
    } catch {
      if (generation.current === current) setError('Não foi possível configurar o autenticador. Tente novamente. Fatores já confirmados são preservados.')
    } finally {
      if (generation.current === current) setBusy(false)
      action.current = false
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (action.current) return
    const form = event.currentTarget
    let code = String(new FormData(form).get('code') ?? '').trim()
    if (!/^\d{6}$/.test(code) || !factorId) {
      setError('Digite os seis números exibidos no autenticador.')
      return
    }
    action.current = true; setBusy(true); setError('')
    const current = generation.current
    try {
      await identity()
      if (generation.current !== current) return
      const verified = await client.auth.mfa.challengeAndVerify({ factorId, code })
      if (verified.error) throw verified.error
      await identity()
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error || assurance.data.currentLevel !== 'aal2') throw new Error('MFA required')
      // The role lookup and the UI are not authorization. Require the existing server boundary.
      await loadMasterOverview(client)
      if (generation.current === current) {
        setSetup(null); setStage('ready')
      }
    } catch {
      if (generation.current === current) setError('Não foi possível confirmar o acesso. Confira o código atual e tente novamente. Se o problema continuar, saia e entre novamente.')
    } finally {
      code = ''
      const field = form.elements.namedItem('code') as HTMLInputElement | null
      if (field) field.value = ''
      if (generation.current === current) setBusy(false)
      action.current = false
    }
  }

  if (stage === 'tenant' || stage === 'ready') return <>{children}</>
  return <main className="session-screen"><section className="panel login-card" aria-labelledby="master-mfa-title">
    <h1 id="master-mfa-title">Acesso Master</h1>
    {stage === 'checking' ? <p role="status">Verificando acesso e autenticação em duas etapas…</p> : <>
      <p>O console exige autenticação em duas etapas. Use um aplicativo autenticador no seu celular.</p>
      {stage === 'setup' && <>
        <h2>Configurar autenticação em duas etapas</h2>
        {pendingFactors.length > 0 && <p>Uma configuração anterior incompleta será substituída. Autenticadores já confirmados serão preservados.</p>}
        <button className="primary wide" disabled={busy} onClick={() => { void enroll() }}>
          {busy ? 'Configurando…' : 'Configurar MFA'}
        </button>
      </>}
      {stage === 'verify' && <>
        {setup && <div>
          <p>Escaneie o QR no seu autenticador e digite o código abaixo. Não compartilhe o QR ou o código.</p>
          <img src={setup.qr} alt="QR para configurar seu autenticador" width="220" height="220"
            style={{ display: 'block', maxWidth: '100%', height: 'auto', background: 'white', padding: 8, margin: '1rem auto' }} />
        </div>}
        {!setup && factors.length > 1 && <><label htmlFor="master-factor">Autenticador</label>
          <select id="master-factor" value={factorId} disabled={busy} onChange={event => setFactorId(event.target.value)}>
            {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Autenticador ' + (index + 1)}</option>)}
          </select></>}
        <form aria-label="Verificar MFA Master" onSubmit={event => { void verify(event) }}>
          <label htmlFor="master-code">Código do autenticador</label>
          <input id="master-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required disabled={busy} />
          <button className="primary wide" disabled={busy}>{busy ? 'Verificando…' : 'Verificar e continuar'}</button>
        </form>
      </>}
      {stage === 'error' && <button className="secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>}
      {error && <p role="alert" className="message error">{error}</p>}
      <button className="text-button" disabled={busy} onClick={onSignOut}>Sair da sessão</button>
    </>}
  </section></main>
}
