import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadFinancialStructure } from '../lib/financial-structure'
import { normalizedAmount } from '../lib/member-configuration'
import { formatMoney } from '../lib/finance-data'
import { TreasuryCatalogs } from './TreasuryCatalogs'
import { TenantIdentity } from './TenantIdentity'
import { AccountingPlans } from './AccountingPlans'

type Command = { name: string; args: Record<string, unknown> }
const domainLabels: Record<string, string> = { member_receivable: 'Cobrança de integrante', institutional_revenue: 'Receita institucional', institutional_expense: 'Despesa institucional' }
export function FinancialStructure({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFinancialStructure>> | null>(null)
  const [revision, setRevision] = useState(0), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false)
  const [priceRule, setPriceRule] = useState('')
  const command = useRef<Command | null>(null), guard = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const abort = new AbortController(); let active = true
    setData(null); setError(''); setPriceRule(''); setConflict(false)
    loadFinancialStructure(client, organizationId, abort.signal).then(rows => { if (active) setData(rows) }).catch(() => { if (active) setError('Não foi possível carregar a estrutura financeira.') })
    return () => { active = false; abort.abort() }
  }, [client, organizationId, revision])
  async function run(next: Command) {
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
      if (['22023', '23503', '23505', '40001', '42501', '28000'].includes(code ?? '')) {
        command.current = null; setUncertain(false); setConflict(code === '40001')
        setError(code === '40001' ? 'A vigência foi alterada por outra operação. Atualize os dados antes de programar outro preço.' : code === '23505' ? 'Já existe um cadastro com esse nome.' : code === '42501' || code === '28000' ? 'Seu acesso ou a situação da Loja não permite esta configuração.' : 'Confira a categoria, o valor e as datas. A configuração não foi salva.')
      } else { setUncertain(true); setError('Resultado não confirmado. Verifique o envio para repetir a mesma solicitação sem duplicá-la.') }
    } finally { guard.current = false; if (mounted.current) setPending(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>, kind: 'category' | 'rule' | 'price') {
    event.preventDefault(); if (guard.current || uncertain || conflict) return
    const form = new FormData(event.currentTarget), get = (name: string) => String(form.get(name) ?? '').trim()
    const base = { p_organization_id: organizationId, p_reason: get('reason'), p_idempotency_key: crypto.randomUUID() }
    try {
      if (kind === 'category') void run({ name: 'create_tenant_financial_category', args: { ...base, p_name: get('name'), p_description: get('description') || null, p_domain: get('domain'), p_active: get('active') === 'true', p_allow_recurrence: form.has('recurrence'), p_allow_installments: form.has('installments') } })
      else if (kind === 'rule') void run({ name: 'create_tenant_monthly_rule', args: { ...base, p_name: get('name'), p_category_id: get('category'), p_unit_amount: normalizedAmount(get('amount')), p_valid_from: `${get('from')}-01`, p_due_day: Number(get('due')) } })
      else {
        const latest = data?.prices.find(row => row.recurring_rule_id === priceRule)
        if (!latest) throw new Error('Atualize os dados para conferir a última vigência da regra.')
        void run({ name: 'schedule_tenant_monthly_price', args: { ...base, p_rule_id: priceRule, p_expected_version_id: latest.id, p_unit_amount: normalizedAmount(get('amount')), p_valid_from: `${get('from')}-01` } })
      }
    } catch (failure) { setError((failure as Error).message) }
  }
  if (!data) return <section className="panel"><h2>Categorias e regras mensais</h2>{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></> : <p role="status">Carregando estrutura financeira…</p>}</section>
  const eligible = data.categories.filter(row => row.active && row.allow_recurrence && row.domain === 'member_receivable')
  const monthly = data.rules.filter(row => row.active && row.frequency === 'monthly')
  const latest = data.prices.find(row => row.recurring_rule_id === priceRule)
  const disabled = pending || uncertain || conflict
  return <section className="panel member-editor"><h2>Categorias e regras mensais</h2>
    {saved && <p role="status">Configuração salva. Os dados foram atualizados.</p>}{error && <p role="alert" className="message error">{error}</p>}
    {uncertain && <button type="button" disabled={pending} onClick={() => { if (command.current) void run(command.current) }}>Verificar envio</button>}
    <button type="button" disabled={pending || uncertain} onClick={() => { setSaved(false); setRevision(value => value + 1) }}>Atualizar estrutura</button>
    <form key={`category-${revision}`} aria-label="Cadastrar categoria financeira" onSubmit={event => submit(event, 'category')}><fieldset disabled={disabled}><legend>Nova categoria</legend>
      <label htmlFor="category-name">Nome da categoria</label><input id="category-name" name="name" required maxLength={120} placeholder="Ex.: Mensalidade" />
      <label htmlFor="category-description">Descrição (opcional)</label><input id="category-description" name="description" maxLength={1000} />
      <label htmlFor="category-domain">Aplicação</label><select id="category-domain" name="domain">{Object.entries(domainLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      <label htmlFor="category-active">Status</label><select id="category-active" name="active"><option value="true">Ativa</option><option value="false">Inativa</option></select>
      <label><input type="checkbox" name="recurrence" />Permitir recorrência para integrantes</label><label><input type="checkbox" name="installments" />Permitir parcelamento</label>
      <label htmlFor="category-reason">Motivo da nova categoria</label><input id="category-reason" name="reason" required minLength={3} maxLength={500} /><button type="submit" className="primary">Cadastrar categoria</button>
    </fieldset></form>
    <form key={`rule-${revision}`} aria-label="Cadastrar regra mensal" onSubmit={event => submit(event, 'rule')}><fieldset disabled={disabled}><legend>Nova regra mensal</legend>
      {!eligible.length ? <p>Cadastre uma categoria ativa de integrantes com recorrência permitida para criar a regra mensal.</p> : <>
        <label htmlFor="monthly-name">Descrição da regra</label><input id="monthly-name" name="name" required maxLength={120} />
        <label htmlFor="monthly-category">Categoria da regra</label><select id="monthly-category" name="category" required>{eligible.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <label htmlFor="monthly-amount">Valor geral (R$)</label><input id="monthly-amount" name="amount" required inputMode="decimal" placeholder="150,00" />
        <label htmlFor="monthly-from">Competência inicial futura</label><input id="monthly-from" name="from" type="month" required />
        <label htmlFor="monthly-due">Dia de vencimento</label><input id="monthly-due" name="due" type="number" min={1} max={31} required defaultValue={10} />
        <label htmlFor="monthly-reason">Motivo da nova regra</label><input id="monthly-reason" name="reason" required minLength={3} maxLength={500} /><button type="submit" className="primary">Cadastrar regra mensal</button>
      </>}
    </fieldset></form>
    <form key={`price-${revision}`} aria-label="Programar novo preço" onSubmit={event => submit(event, 'price')}><fieldset disabled={disabled}><legend>Novo preço com vigência</legend>
      {!monthly.length ? <p>Nenhuma regra mensal ativa cadastrada.</p> : <>
        <label htmlFor="price-rule">Regra para novo preço</label><select id="price-rule" required value={priceRule} onChange={event => setPriceRule(event.target.value)}><option value="">Selecione uma regra</option>{monthly.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        {latest && <p>Última vigência cadastrada: {latest.valid_from_competence.slice(0, 7)} — {formatMoney(Number(latest.unit_amount))}. Pode ser uma programação futura.</p>}
        <label htmlFor="price-amount">Novo valor geral (R$)</label><input id="price-amount" name="amount" required inputMode="decimal" />
        <label htmlFor="price-from">Nova competência futura</label><input id="price-from" name="from" required type="month" />
        <label htmlFor="price-reason">Motivo do novo preço</label><input id="price-reason" name="reason" required minLength={3} maxLength={500} /><button type="submit" className="primary" disabled={!latest}>Programar preço</button>
      </>}
    </fieldset></form>
    <p className="subtle">Preços devem ser positivos. A programação preserva os valores anteriores e não gera cobranças. Valor individual e isenção são configurados na ficha do integrante.</p>
    <h3>Categorias cadastradas</h3>{!data.categories.length ? <p>Nenhuma categoria cadastrada.</p> : <ul>{data.categories.map(row => <li key={row.id}>{row.name} — {domainLabels[row.domain] ?? 'Aplicação não reconhecida'} — {row.active ? 'Ativa' : 'Inativa'}{row.allow_recurrence ? ' — recorrência permitida' : ''}</li>)}</ul>}
    <h3>Histórico de preços</h3>{!data.prices.length ? <p>Nenhuma vigência de preço cadastrada.</p> : <ul>{data.prices.map(row => <li key={row.id}>{data.rules.find(rule => rule.id === row.recurring_rule_id)?.name} — {formatMoney(Number(row.unit_amount))} — {row.valid_from_competence.slice(0, 7)} até {row.valid_to_competence?.slice(0, 7) ?? 'sem término'}</li>)}</ul>}
    <p className="subtle">Até 200 registros por lista. Neutra/repasse, vínculo contábil DRE, recorrência institucional, regras especiais e demais abas do Plano de Contas serão disponibilizados nos próximos incrementos.</p>
    <TreasuryCatalogs client={client} organizationId={organizationId} />
    <TenantIdentity client={client} organizationId={organizationId} />
    <AccountingPlans client={client} organizationId={organizationId} />
  </section>
}
