import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function RecoveryRequest({ client, onBack }: { client: SupabaseClient; onBack: () => void }) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    try {
      const { error: failure } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/',
      })
      if (failure) throw failure
      setSent(true)
    } catch {
      setError('Não foi possível solicitar a recuperação. Aguarde e tente novamente.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return <main className="session-screen"><div className="panel login-card">
    <h1>Recuperar senha</h1>
    {sent ? <p role="status">Se houver uma conta com esse e-mail, você receberá um link para definir uma nova senha. Confira também o spam.</p> :
      <form aria-label="Recuperação de senha" onSubmit={submit}>
        <label htmlFor="recovery-email">E-mail</label>
        <input id="recovery-email" name="email" type="email" autoComplete="username" required disabled={pending} />
        {error && <p role="alert" className="message error">{error}</p>}
        <button className="primary wide" disabled={pending}>{pending ? 'Enviando…' : 'Enviar link de recuperação'}</button>
      </form>}
    <button type="button" disabled={pending} onClick={onBack}>Voltar ao acesso</button>
  </div></main>
}

export function NewPassword({ client, userId, onFinish }: { client: SupabaseClient; userId: string; onFinish: () => void }) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    const password = String(values.get('password') ?? '')
    if (password.length < 12 || password !== String(values.get('confirmation') ?? '')) {
      setError('Use pelo menos 12 caracteres e confirme a mesma senha nos dois campos.')
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    try {
      const identity = await client.auth.getUser()
      if (identity.error || identity.data.user?.id !== userId) throw new Error('Recovery identity unavailable')
      const { error: failure } = await client.auth.updateUser({ password })
      if (failure) throw failure
      window.history.replaceState(null, '', window.location.pathname)
      setSaved(true)
    } catch {
      setError('Não foi possível alterar a senha. Verifique a conexão; se o link expirou, solicite outro.')
    } finally {
      for (const name of ['password', 'confirmation']) {
        const field = form.elements.namedItem(name) as HTMLInputElement | null
        if (field) field.value = ''
      }
      busy.current = false
      setPending(false)
    }
  }
  return <main className="session-screen"><div className="panel login-card">
    <h1>Definir nova senha</h1>
    {saved ? <><p role="status">Senha alterada. Volte ao acesso e entre com a nova senha.</p><button className="primary" onClick={onFinish}>Voltar ao acesso</button></> :
      <form aria-label="Nova senha" onSubmit={submit}>
        <label htmlFor="new-password">Nova senha</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required disabled={pending} />
        <label htmlFor="confirm-password">Confirmar nova senha</label>
        <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} required disabled={pending} />
        <p className="subtle">Use pelo menos 12 caracteres.</p>
        {error && <p role="alert" className="message error">{error}</p>}
        <button className="primary wide" disabled={pending}>{pending ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>}
  </div></main>
}
