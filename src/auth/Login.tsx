import { useState, type FormEvent } from 'react'
import { LockKeyhole, ArrowRight } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RecoveryRequest } from './PasswordRecovery'

export function Login({ client }: { client: SupabaseClient }) {
  const [recovering, setRecovering] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const values = new FormData(form)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    setPending(true)
    setError('')
    try {
      const { error: failure } = await client.auth.signInWithPassword({ email, password })
      if (failure) throw failure
    } catch {
      setError('Não foi possível entrar. Confira seus dados e a conexão e tente novamente.')
    } finally {
      const field = form.elements.namedItem('password') as HTMLInputElement | null
      if (field) field.value = ''
      setPending(false)
    }
  }
  if (recovering) return <RecoveryRequest client={client} onBack={() => setRecovering(false)} />
  return <div className="login-layout">
    <section className="login-story" aria-label="Tronco Digital">
      <a className="brand" href="#main"><span className="brand-mark">T</span><span>CORSYS <strong>Tronco Digital</strong></span></a>
      <div><p className="eyebrow">Gestão para sua Loja</p><h1>Organização que<br />fortalece a confiança.</h1><p className="lead">Integrantes, atendimento e tesouraria em um só lugar. No computador e no celular.</p></div>
      <p className="subtle">V35 · Ambiente de desenvolvimento</p>
    </section>
    <main id="main" className="login-main">
      <div className="login-card">
        <div className="icon-tile"><LockKeyhole size={25} aria-hidden="true" /></div>
        <p className="eyebrow">Bem-vindo de volta</p><h2>Acesse sua Loja</h2><p className="subtle">Entre com seu e-mail e sua senha cadastrados.</p>
        <form onSubmit={submit} aria-label="Acesso à Loja">
          <label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" placeholder="seu@email.com" required disabled={pending} />
          <label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required disabled={pending} />
          {error && <p role="alert" className="message error">{error}</p>}
          <button className="primary wide" type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>
        <button type="button" disabled={pending} onClick={() => setRecovering(true)}>Esqueci minha senha</button>
        <p className="login-note">Precisa de acesso? Entre em contato com o administrador da sua Loja.</p>
      </div>
    </main>
  </div>
}

