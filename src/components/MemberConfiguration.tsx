import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Member } from '../lib/tenant-data'
import { formatMoney } from '../lib/finance-data'
import { loadMemberConfiguration, normalizedAmount, type MemberConfigurationData } from '../lib/member-configuration'

const dateLabel = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Sem término'
const labels: Record<string, string> = { standard: 'Valor geral da regra', exempt: 'Isento', override_amount: 'Valor individual' }
type PendingCommand = { name: string; args: Record<string, unknown> }
export function MemberConfiguration({ client, organizationId, member, onClose }: { client: SupabaseClient; organizationId: string; member: Member; onClose: () => void }) {
  const [data, setData] = useState<MemberConfigurationData | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [kind, setKind] = useState('office')
  const [term, setTerm] = useState('standard')
  const [transitionKind, setTransitionKind] = useState('close')
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [saved, setSaved] = useState(false)
  const mounted = useRef(false), guard = useRef(false)
  const command = useRef<PendingCommand | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    setData(null); setError('')
    loadMemberConfiguration(client, organizationId, member.id, controller.signal).then(rows => { if (active) setData(rows) }).catch(() => { if (active) setError('Não foi possível carregar os cargos e termos deste integrante.') })
    return () => { active = false; controller.abort() }
  }, [client, organizationId, member.id, revision])
  async function run(next: PendingCommand) {
    if (guard.current) return
    command.current = command.current ?? next
    guard.current = true; setPending(true); setError(''); setSaved(false)
    try {
      const { data: result, error: failure } = await client.rpc(command.current.name, command.current.args)
      if (failure) throw failure
      if (typeof result !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) throw new Error('Unconfirmed command')
      if (mounted.current) { command.current = null; setUncertain(false); setSaved(true); setRevision(value => value + 1) }
    } catch (failure) {
      if (!mounted.current) return
      const code = (failure as { code?: string } | null)?.code
      if (['22023', '23503', '23505', '23P01', '40001','PT409', '42501', '28000'].includes(code ?? '')) {
        command.current = null; setUncertain(false)
        setError((code === '40001' || code === 'PT409') ? 'A condição mensal já foi alterada. Atualize os dados antes de uma nova tentativa.' : code === '23P01' ? 'A vigência se sobrepõe a um registro existente. Confira o histórico.' : code === '42501' || code === '28000' ? 'Seu acesso ou a situação da Loja não permite esta configuração.' : code === '23505' ? 'Já existe um cargo com esse nome.' : 'Confira o cadastro selecionado, os valores e as datas. A configuração não foi salva.')
      } else { setUncertain(true); setError('Resultado não confirmado. Use Verificar envio para repetir a mesma solicitação sem duplicá-la.') }
    } finally { guard.current = false; if (mounted.current) setPending(false) }
  }
  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (guard.current) return
    const values = new FormData(event.currentTarget)
    const get = (name: string) => String(values.get(name) ?? '').trim()
    try {
      const from = get('from'), to = get('to')
      void run({ name: 'schedule_member_configuration', args: {
        p_organization_id: organizationId, p_member_id: member.id, p_kind: kind, p_reference_id: get('reference'),
        p_effective_from: kind === 'term' ? `${from}-01` : from,
        p_effective_to: to ? kind === 'term' ? `${to}-01` : to : null,
        p_term_type: kind === 'term' ? term : null,
        p_override_amount: kind === 'term' && term === 'override_amount' ? normalizedAmount(get('amount')) : null,
        p_reason: get('reason'), p_idempotency_key: crypto.randomUUID(),
      } })
    } catch (failure) { setError((failure as Error).message) }
  }
  function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guard.current || uncertain) return
    const values = new FormData(event.currentTarget)
    const get = (name: string) => String(values.get(name) ?? '').trim()
    try {
      void run({ name: 'transition_member_term', args: {
        p_organization_id: organizationId, p_member_id: member.id, p_current_term_id: get('current_term'),
        p_next_from: `${get('next_from')}-01`,
        p_next_type: transitionKind === 'close' ? null : transitionKind,
        p_next_amount: transitionKind === 'override_amount' ? normalizedAmount(get('next_amount')) : null,
        p_reason: get('reason'), p_idempotency_key: crypto.randomUUID(),
      } })
    } catch (failure) { setError((failure as Error).message) }
  }
  if (!data) return <section className="panel"><h2>Cargos e mensalidade — {member.full_name}</h2>{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></> : <p role="status">Carregando configurações…</p>}<button type="button" onClick={onClose}>Fechar</button></section>
  const choices = kind === 'office' ? data.offices.filter(row => row.active) : data.rules.filter(row => row.active && row.frequency === 'monthly')
  const openTerms = data.terms.filter(row => row.effective_to === null)
  return <section className="panel member-editor"><h2>Cargos e mensalidade — {member.full_name}</h2>
    {saved && <p role="status">Configuração salva. O histórico foi atualizado.</p>}{error && <p role="alert" className="message error">{error}</p>}
    {uncertain && <button type="button" disabled={pending} onClick={() => { if (command.current) void run(command.current) }}>Verificar envio</button>}
    <form aria-label="Criar cargo" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void run({ name: 'create_member_office_type', args: { p_organization_id: organizationId, p_name: String(values.get('office_name') ?? '').trim(), p_idempotency_key: crypto.randomUUID() } }) }}>
      <fieldset disabled={pending || uncertain}><legend>Catálogo de cargos da Loja</legend><label htmlFor="new-office">Nome do novo cargo</label><input id="new-office" name="office_name" required maxLength={120} /><button type="submit" className="secondary">Criar cargo</button></fieldset>
    </form>
    <form aria-label="Programar configuração do integrante" onSubmit={schedule}>
      <fieldset disabled={pending || uncertain}><legend>Nova vigência</legend>
        <label htmlFor="configuration-kind">Configuração</label><select id="configuration-kind" value={kind} onChange={event => setKind(event.target.value)}><option value="office">Cargo</option><option value="term">Mensalidade / isenção</option></select>
        {!choices.length ? <p>Não há {kind === 'office' ? 'cargos ativos' : 'regras mensais ativas'} disponíveis nesta Loja.</p> : <>
          <label htmlFor="configuration-reference">{kind === 'office' ? 'Cargo' : 'Regra mensal'}</label><select id="configuration-reference" name="reference" key={kind} required>{choices.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          {kind === 'term' && <><label htmlFor="configuration-term">Condição de mensalidade</label><select id="configuration-term" value={term} onChange={event => setTerm(event.target.value)}><option value="standard">Usar valor geral</option><option value="override_amount">Valor individual</option><option value="exempt">Isento</option></select>{term === 'override_amount' && <><label htmlFor="configuration-amount">Mensalidade individual (R$)</label><input id="configuration-amount" name="amount" inputMode="decimal" required placeholder="125,50" /></>}</>}
          <label htmlFor="configuration-from">{kind === 'office' ? 'Início' : 'Competência inicial futura'}</label><input key={`${kind}-from`} id="configuration-from" name="from" type={kind === 'office' ? 'date' : 'month'} required />
          <label htmlFor="configuration-to">{kind === 'office' ? 'Término (opcional)' : 'Última competência (opcional)'}</label><input key={`${kind}-to`} id="configuration-to" name="to" type={kind === 'office' ? 'date' : 'month'} />
          <label htmlFor="configuration-reason">Motivo da configuração</label><input id="configuration-reason" name="reason" required minLength={3} maxLength={500} />
          <button type="submit" className="primary">Programar vigência</button>
        </>}
      </fieldset>
    </form>
    <form aria-label="Substituir ou encerrar mensalidade individual" onSubmit={transition}>
      <fieldset disabled={pending || uncertain}><legend>Substituir ou encerrar condição mensal</legend>
        {!openTerms.length ? <p>Nenhuma condição mensal sem término para substituir.</p> : <>
          <label htmlFor="transition-current">Condição atual sem término</label>
          <select id="transition-current" name="current_term" required defaultValue="">
            <option value="">Selecione a condição</option>
            {openTerms.map(row => <option key={row.id} value={row.id}>{data.rules.find(rule => rule.id === row.recurring_rule_id)?.name ?? 'Regra cadastrada'} — {labels[row.term_type] ?? row.term_type} desde {dateLabel(row.effective_from)}</option>)}
          </select>
          <label htmlFor="transition-next-from">Competência futura para a mudança</label><input id="transition-next-from" name="next_from" type="month" required />
          <label htmlFor="transition-kind">Nova condição</label><select id="transition-kind" value={transitionKind} onChange={event => setTransitionKind(event.target.value)}>
            <option value="close">Encerrar condição e retornar ao valor geral</option>
            <option value="standard">Registrar condição geral explícita</option>
            <option value="exempt">Isento</option>
            <option value="override_amount">Novo valor individual</option>
          </select>
          {transitionKind === 'override_amount' && <><label htmlFor="transition-next-amount">Novo valor individual (R$)</label><input id="transition-next-amount" name="next_amount" inputMode="decimal" required placeholder="125,50" /></>}
          <label htmlFor="transition-reason">Motivo da alteração</label><input id="transition-reason" name="reason" minLength={3} maxLength={500} required />
          <button type="submit" className="primary">Confirmar mudança futura</button>
        </>}
      </fieldset>
    </form>
    <button type="button" className="secondary" disabled={pending || uncertain} onClick={() => setRevision(value => value + 1)}>Atualizar configurações</button>
    <p className="subtle">Valor individual e isenção valem para a regra e as competências escolhidas. Registros anteriores e cobranças existentes são preservados. Esta programação não gera cobranças.</p>
    <h3>Histórico de cargos</h3>{!data.history.length ? <p>Nenhum cargo com vigência registrado.</p> : <ul>{data.history.map(row => <li key={row.id}>{data.offices.find(office => office.id === row.office_type_id)?.name ?? 'Cargo cadastrado'} — {dateLabel(row.effective_from)} até {dateLabel(row.effective_to)}</li>)}</ul>}
    <h3>Histórico de mensalidade e isenção</h3>{!data.terms.length ? <p>Nenhum termo individual registrado.</p> : <ul>{data.terms.map(row => <li key={row.id}>{data.rules.find(rule => rule.id === row.recurring_rule_id)?.name ?? 'Regra cadastrada'} — {labels[row.term_type] ?? 'Condição não reconhecida'}{row.term_type === 'override_amount' ? `: ${formatMoney(Number(row.override_amount))}` : ''} — {dateLabel(row.effective_from)} até {dateLabel(row.effective_to)}</li>)}</ul>}
    <p className="subtle">Até 200 registros por lista.</p><button type="button" className="secondary" onClick={onClose} disabled={pending || uncertain}>Fechar configurações</button>
  </section>
}
