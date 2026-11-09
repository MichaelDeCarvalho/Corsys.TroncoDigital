import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function readOnboardingCallback(url: URL) {
  if (url.pathname !== '/onboarding/accept') return null
  const runId = url.searchParams.get('run_id') ?? ''
  const fragment = new URLSearchParams(url.hash.slice(1))
  const invalid = !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(runId)
    || url.searchParams.has('error') || url.searchParams.has('error_code')
    || fragment.has('error') || fragment.has('error_code') || fragment.get('type') === 'recovery'
  return { runId, invalid }
}

type Terms = { version_id: string; version: string; document_hash: string; document_text: string }
type State = { kind: 'loading' | 'blocked' | 'error' | 'done' } | { kind: 'ready'; terms: Terms }

async function matchesDocument(terms: Terms) {
  if (typeof terms.document_text !== 'string' || !terms.document_text.trim()
    || typeof terms.version !== 'string' || !terms.version.trim()
    || !/^[0-9a-f-]{36}$/i.test(terms.version_id)
    || !/^[0-9a-f]{64}$/.test(terms.document_hash)) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(terms.document_text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') === terms.document_hash
}

export function OnboardingAcceptance({ client, runId }: { client: SupabaseClient; runId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    let current = true
    async function load() {
      try {
        const { data, error } = await client.rpc('read_onboarding_invite_terms', { p_run_id: runId })
        if (error) throw error
        const next: State = data?.status === 'completed' ? { kind: 'done' }
          : data?.status === 'ready' && await matchesDocument(data)
            ? { kind: 'ready', terms: data } : { kind: 'blocked' }
        if (current) setState(next)
      } catch {
        if (current) setState({ kind: 'error' })
      }
    }
    void load()
    return () => { current = false }
  }, [client, runId, attempt])

  function reload() {
    setChecked(false)
    setState({ kind: 'loading' })
    setAttempt(value => value + 1)
  }

  async function accept() {
    if (state.kind !== 'ready' || !checked || submitting.current) return
    submitting.current = true
    setSaving(true)
    try {
      const { terms } = state
      const { data, error } = await client.rpc('accept_onboarding_invite', {
        p_run_id: runId, p_terms_version_id: terms.version_id,
        p_document_hash: terms.document_hash, p_accept_terms: true,
      })
      if (error || typeof data !== 'string' || !data) throw error
      setState({ kind: 'done' })
    } catch {
      setChecked(false)
      setState({ kind: 'error' })
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return <main className="session-screen onboarding-acceptance">
    <section className="panel">
      <h1>Termos de Uso</h1>
      {state.kind === 'loading' && <p role="status">Carregando documento…</p>}
      {state.kind === 'blocked' && <p role="alert">Documento oficial indisponível ou divergente. O aceite está bloqueado.</p>}
      {state.kind === 'error' && <p role="alert">Não foi possível validar o convite ou concluir o aceite. Consulte o estado novamente antes de tentar.</p>}
      {(state.kind === 'blocked' || state.kind === 'error') && <button type="button" onClick={reload}>Consultar novamente</button>}
      {state.kind === 'done' && <><p role="status">Aceite registrado. Seu vínculo com a Loja foi concluído.</p><a href="/">Continuar para o acesso</a></>}
      {state.kind === 'ready' && <>
        <p>Versão {state.terms.version}</p>
        <p className="onboarding-hash">SHA-256 <code>{state.terms.document_hash}</code></p>
        <article className="onboarding-document" aria-label="Documento oficial">{state.terms.document_text}</article>
        <form onSubmit={event => { event.preventDefault(); void accept() }}>
          <label><input type="checkbox" checked={checked} disabled={saving}
            onChange={event => setChecked(event.currentTarget.checked)} /> Li e aceito esta versão dos Termos de Uso.</label>
          <button className="primary" type="submit" disabled={!checked || saving}>{saving ? 'Registrando…' : 'Aceitar e vincular à Loja'}</button>
        </form>
      </>}
    </section>
  </main>
}
