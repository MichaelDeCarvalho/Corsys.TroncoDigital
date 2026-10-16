import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Settings = {
  organization_id: string; updated_at: string
  phone: string | null; email: string | null; pix_key: string | null; address: string | null
  postal_code: string | null; city: string | null; state_code: string | null; country_code: string
}
type Operation = { name: string; args: Record<string, unknown> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function TenantIdentity({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined)
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const command = useRef<Operation | null>(null)
  const guard = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let live = true
    const abort = new AbortController()
    setSettings(undefined); setError('')
    Promise.resolve(client.from('organization_settings')
      .select('organization_id,updated_at,phone,email,pix_key,address,postal_code,city,state_code,country_code')
      .eq('organization_id', organizationId).limit(1).abortSignal(abort.signal))
      .then(({ data, error: failure }) => {
        if (!live) return
        if (failure || !data || data.length > 1 || data.some(row => row.organization_id !== organizationId)) {
          setError('Não foi possível consultar os parâmetros da Loja.')
        } else {
          setSettings((data[0] as Settings | undefined) ?? null)
        }
      }).catch(() => { if (live) setError('Não foi possível consultar os parâmetros da Loja.') })
    return () => { live = false; abort.abort() }
  }, [client, organizationId, revision])

  async function run(next: Operation) {
    if (guard.current || conflict) return
    command.current = command.current ?? next
    guard.current = true; setPending(true); setSaved(false); setError('')
    try {
      const response = await client.rpc(command.current.name, command.current.args)
      if (response.error) throw response.error
      if (typeof response.data !== 'string' || !uuid.test(response.data) || response.data !== organizationId) {
        throw new Error('Unconfirmed tenant identity save')
      }
      if (mounted.current) {
        command.current = null; setUncertain(false); setSaved(true)
        setRevision(previous => previous + 1)
      }
    } catch (cause) {
      if (!mounted.current) return
      const code = (cause as { code?: string })?.code ?? ''
      if (['22023','23503','40001','PT409','42501','28000'].includes(code)) {
        command.current = null; setUncertain(false)
        setConflict((code === '40001' || code === 'PT409'))
        setError((code === '40001' || code === 'PT409') ? 'Os dados da Loja foram alterados. Atualize antes de salvar novamente.' :
          code === '42501' || code === '28000' ? 'Seu perfil ou a assinatura da Loja não permite essa configuração.' :
          'Verifique os dados fornecidos. Não foi possível salvar a identidade da Loja.')
      } else {
        setUncertain(true)
        setError('O resultado não foi confirmado. Use Verificar envio para repetir a mesma solicitação.')
      }
    } finally { guard.current = false; if (mounted.current) setPending(false) }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guard.current || uncertain || conflict || settings === undefined) return
    const values = new FormData(event.currentTarget)
    const get = (name: string) => String(values.get(name) ?? '').trim()
    void run({ name: 'save_tenant_identity', args: {
      p_organization_id: organizationId,
      p_expected_updated_at: settings?.updated_at ?? null,
      p_phone: get('phone') || null, p_email: get('email') || null,
      p_pix_key: get('pix_key') || null, p_address: get('address') || null,
      p_postal_code: get('postal_code') || null, p_city: get('city') || null,
      p_state_code: get('state_code').toUpperCase() || null,
      p_country_code: get('country_code').toUpperCase() || 'BR',
      p_reason: get('reason'), p_idempotency_key: crypto.randomUUID(),
    } })
  }
  function refresh() {
    if (pending || uncertain) return
    setConflict(false); setSaved(false); setRevision(value => value + 1)
  }
  const disabled = pending || uncertain || conflict
  return <section className="panel" aria-label="Identidade e contatos da Loja">
    <div className="section-title"><h2>Identidade e contatos da Loja</h2>
      <button className="secondary" type="button" disabled={pending || uncertain} onClick={refresh}>Atualizar dados</button>
    </div>
    {saved && <p role="status">Dados institucionais salvos. O cadastro foi atualizado.</p>}
    {error && <p role="alert">{error}</p>}
    {uncertain && <button className="secondary" disabled={pending} type="button" onClick={() => { if (command.current) void run(command.current) }}>Verificar envio</button>}
    {settings === undefined ? (!error && <p role="status">Carregando os dados da Loja…</p>) :
      <form key={settings?.updated_at ?? 'new'} aria-label="Configurar identidade da Loja" onSubmit={submit}>
        <fieldset disabled={disabled}>
          <legend>Contato, endereço e chave PIX</legend>
          <div className="member-form-grid">
            <div><label htmlFor="identity-phone">Telefone</label><input id="identity-phone" name="phone" maxLength={40} defaultValue={settings?.phone ?? ''} /></div>
            <div><label htmlFor="identity-email">E-mail</label><input id="identity-email" name="email" type="email" maxLength={254} defaultValue={settings?.email ?? ''} /></div>
            <div><label htmlFor="identity-pix">Chave PIX institucional</label><input id="identity-pix" name="pix_key" maxLength={150} defaultValue={settings?.pix_key ?? ''} autoComplete="off" /></div>
            <div><label htmlFor="identity-address">Endereço</label><input id="identity-address" name="address" maxLength={500} defaultValue={settings?.address ?? ''} /></div>
            <div><label htmlFor="identity-postal">CEP</label><input id="identity-postal" name="postal_code" maxLength={20} defaultValue={settings?.postal_code ?? ''} /></div>
            <div><label htmlFor="identity-city">Cidade</label><input id="identity-city" name="city" maxLength={120} defaultValue={settings?.city ?? ''} /></div>
            <div><label htmlFor="identity-state">UF</label><input id="identity-state" name="state_code" maxLength={2} minLength={2} pattern="[A-Za-z]{2}" defaultValue={settings?.state_code ?? ''} /></div>
            <div><label htmlFor="identity-country">País (ISO, duas letras)</label><input id="identity-country" name="country_code" maxLength={2} minLength={2} pattern="[A-Za-z]{2}" required defaultValue={settings?.country_code ?? 'BR'} /></div>
            <div><label htmlFor="identity-reason">Motivo da atualização</label><input id="identity-reason" name="reason" maxLength={500} minLength={3} required /></div>
          </div>
          <button className="primary" type="submit">Salvar identidade da Loja</button>
        </fieldset>
      </form>}
    <p className="subtle">Informações separadas por Loja. A chave PIX é um dado de configuração, não realiza transferências. A edição exige autorização administrativa e preserva relatórios, logo e demais parâmetros existentes.</p>
  </section>
}
