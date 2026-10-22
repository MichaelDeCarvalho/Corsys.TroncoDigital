import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTreasuryCatalogs, type TreasuryCatalogsData, type TreasuryItem, type TreasuryKind } from '../lib/treasury-catalogs'

type PendingCommand = { name: string; args: Record<string, unknown> }
const kindNames: Record<TreasuryKind, string> = { account: 'Conta financeira', fund: 'Fundo', method: 'Forma de pagamento' }
const types: Record<string, string> = { bank: 'Conta bancária', pix: 'Conta PIX', cash: 'Caixa', other: 'Outra conta' }

export function TreasuryCatalogs({ client, organizationId, kindFilter }: { client: SupabaseClient; organizationId: string; kindFilter?: TreasuryKind[] }) {
  const [data, setData] = useState<TreasuryCatalogsData | null>(null)
  const [revision, setRevision] = useState(0)
  const [kind, setKind] = useState<TreasuryKind>(kindFilter?.[0] ?? 'account')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const command = useRef<PendingCommand | null>(null)
  const guard = useRef(false)
  const mounted = useRef(false)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setData(null)
    setError('')
    loadTreasuryCatalogs(client, organizationId, controller.signal).then(result => {
      if (active) setData(result)
    }).catch(() => {
      if (active) setError('Não foi possível carregar contas, fundos e formas de pagamento.')
    })
    return () => { active = false; controller.abort() }
  }, [client, organizationId, revision])

  async function run(next: PendingCommand) {
    if (guard.current || conflict) return
    command.current = command.current ?? next
    guard.current = true
    setPending(true)
    setSaved(false)
    setError('')
    try {
      const { data: result, error: failure } = await client.rpc(command.current.name, command.current.args)
      if (failure) throw failure
      if (typeof result !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) {
        throw new Error('Unconfirmed treasury catalog command')
      }
      if (mounted.current) {
        command.current = null
        setUncertain(false)
        setSaved(true)
        setRevision(value => value + 1)
      }
    } catch (cause) {
      if (!mounted.current) return
      const code = (cause as { code?: string } | null)?.code
      if (['22023', '23503', '23505', '23514', '40001','PT409', '42501', '28000'].includes(code ?? '')) {
        command.current = null
        setUncertain(false)
        setConflict((code === '40001' || code === 'PT409'))
        setError(
          (code === '40001' || code === 'PT409') ? 'A situação do cadastro mudou. Atualize os dados antes de alterar novamente.' :
          code === '23505' ? 'Já existe um cadastro com esse nome nesta Loja.' :
          code === '23514' ? 'A conta financeira só pode ser ativada quando existir mapeamento contábil em todos os planos publicados aplicáveis. Prepare um sucessor.' :
          code === '42501' || code === '28000' ? 'Seu acesso ou a assinatura da Loja não permite esta alteração.' :
          code === '23503' ? 'Cadastro não encontrado nesta Loja.' :
          'Verifique os dados e o motivo. Nenhuma alteração foi confirmada.',
        )
      } else {
        setUncertain(true)
        setError('Resultado não confirmado. Use Verificar envio para repetir a solicitação sem duplicá-la.')
      }
    } finally {
      guard.current = false
      if (mounted.current) setPending(false)
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guard.current || uncertain || conflict) return
    const values = new FormData(event.currentTarget)
    const get = (name: string) => String(values.get(name) ?? '').trim()
    const nullable = (name: string) => get(name) || null
    void run({ name: 'create_treasury_catalog_item', args: {
      p_organization_id: organizationId, p_kind: kind, p_name: get('name'),
      p_account_type: kind === 'account' ? get('account_type') : null,
      p_institution: kind === 'account' ? nullable('institution') : null,
      p_identification: kind === 'account' ? nullable('identification') : null,
      p_description: kind === 'fund' ? nullable('description') : null,
      p_reason: get('reason'), p_idempotency_key: crypto.randomUUID(),
    } })
  }

  function changeStatus(targetKind: TreasuryKind, item: TreasuryItem) {
    if (guard.current || uncertain || conflict) return
    const reason = (document.getElementById('treasury-status-reason') as HTMLInputElement | null)?.value.trim() ?? ''
    if (reason.length < 3 || reason.length > 500) {
      setError('Informe o motivo da ativação ou desativação (3 a 500 caracteres).')
      return
    }
    void run({ name: 'set_treasury_catalog_status', args: {
      p_organization_id: organizationId, p_kind: targetKind, p_item_id: item.id,
      p_expected_active: item.active, p_new_active: !item.active,
      p_reason: reason, p_idempotency_key: crypto.randomUUID(),
    } })
  }

  function refresh() {
    if (pending || uncertain) return
    setConflict(false)
    setSaved(false)
    setRevision(value => value + 1)
  }

  const disabled = pending || uncertain || conflict
  const lists: { kind: TreasuryKind; title: string; items: TreasuryItem[] }[] = data
    ? [
      { kind: 'account' as TreasuryKind, title: 'Contas financeiras', items: data.accounts },
      { kind: 'fund' as TreasuryKind, title: 'Fundos', items: data.funds },
      { kind: 'method' as TreasuryKind, title: 'Formas de pagamento', items: data.methods },
    ].filter(g => !kindFilter || kindFilter.includes(g.kind)) : []
  return <section className="treasury-catalogs" aria-label="Contas, fundos e formas de pagamento">
    <div className="section-title"><h2>Contas, fundos e formas de pagamento</h2>
      <button type="button" className="secondary" disabled={pending || uncertain} onClick={refresh}>Atualizar cadastros</button>
    </div>
    {saved && <p role="status">Alteração confirmada. Os cadastros foram atualizados.</p>}
    {error && <p role="alert" className="message error">{error}</p>}
    {uncertain && <button type="button" className="secondary" disabled={pending} onClick={() => { if (command.current) void run(command.current) }}>Verificar envio</button>}
    {!data ? (!error ? <p role="status">Carregando cadastros…</p> : null) : <>
      <form aria-label="Cadastrar item de tesouraria" onSubmit={create}>
        <fieldset disabled={disabled}><legend>Novo cadastro</legend>
          <div className="member-form-grid">
            <div><label htmlFor="treasury-kind">Tipo de cadastro</label>
              <select id="treasury-kind" value={kind} onChange={e => setKind(e.target.value as TreasuryKind)}>
                {(!kindFilter || kindFilter.includes('account')) && <option value="account">Conta financeira</option>}
                {(!kindFilter || kindFilter.includes('fund')) && <option value="fund">Fundo</option>}
                {(!kindFilter || kindFilter.includes('method')) && <option value="method">Forma de pagamento</option>}
              </select></div>
            <div><label htmlFor="treasury-name">Nome</label><input id="treasury-name" name="name" required maxLength={120} /></div>
            {kind === 'account' && <>
              <div><label htmlFor="treasury-account-type">Tipo de conta</label><select id="treasury-account-type" name="account_type">
                {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></div>
              <div><label htmlFor="treasury-institution">Instituição (opcional)</label><input id="treasury-institution" name="institution" maxLength={120} /></div>
              <div><label htmlFor="treasury-identification">Identificação (opcional)</label><input id="treasury-identification" name="identification" maxLength={120} /></div>
            </>}
            {kind === 'fund' && <div><label htmlFor="treasury-description">Finalidade do fundo (opcional)</label><input id="treasury-description" name="description" maxLength={1000} /></div>}
            <div><label htmlFor="treasury-create-reason">Motivo do cadastro</label><input id="treasury-create-reason" name="reason" minLength={3} maxLength={500} required /></div>
          </div>
          {kind === 'account' && <p className="subtle">Novas contas financeiras são cadastradas inativas. Para ativar, precisam de classificação patrimonial compatível nos planos publicados aplicáveis.</p>}
          <button type="submit" className="primary">Cadastrar {kindNames[kind].toLowerCase()}</button>
        </fieldset>
      </form>
      <div className="treasury-status-controls">
        <label htmlFor="treasury-status-reason">Motivo para ativar ou desativar um cadastro</label>
        <input id="treasury-status-reason" minLength={3} maxLength={500} disabled={disabled} placeholder="Explique a alteração de status" />
      </div>
      <div className="treasury-catalog-grid">{lists.map(group =>
        <section className="panel" key={group.kind} aria-label={group.title}>
          <h3>{group.title}</h3>
          {!group.items.length ? <p className="subtle">Nenhum registro encontrado nesta Loja.</p> :
            <ul className="treasury-catalog-list">{group.items.map(item =>
              <li key={item.id}>
                <div><strong>{item.name}</strong>
                  <span className="subtle">{item.active ? 'Ativo' : 'Inativo'}
                    {group.kind === 'account' ? ' · ' + (types[item.account_type ?? ''] ?? 'Conta') : ''}
                    {group.kind === 'account' && item.institution ? ' · ' + item.institution : ''}
                    {group.kind === 'fund' && item.description ? ' · ' + item.description : ''}
                  </span>
                </div>
                <button type="button" className="secondary" disabled={disabled} onClick={() => changeStatus(group.kind, item)}>
                  {item.active ? 'Desativar' : 'Ativar'}
                </button>
              </li>,
            )}</ul>
          }
        </section>,
      )}</div>
      <p className="subtle">Exibe até 200 registros por catálogo. Desativar preserva referências e fatos históricos, sem excluir contas, fundos ou pagamentos. A vinculação patrimonial e a movimentação financeira serão implementadas separadamente.</p>
    </>}
  </section>
}
