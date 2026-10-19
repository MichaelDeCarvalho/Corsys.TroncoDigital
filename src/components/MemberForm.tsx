import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveMemberProfile, type Member, type MemberProfile } from '../lib/tenant-data'

type Submission = { profile: MemberProfile; reason: string; key: string }
export function MemberForm({ client, organizationId, member, onSaved, onCancel, onReload }: {
  client: SupabaseClient; organizationId: string; member: Member | null
  onSaved: () => void; onCancel: () => void; onReload: () => void
}) {
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const guard = useRef(false)
  const mounted = useRef(false)
  const submission = useRef<Submission | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (guard.current || conflict) return
    if (!submission.current) {
      const values = new FormData(event.currentTarget)
      const value = (name: string) => String(values.get(name) ?? '').trim()
      const optional = (name: string) => value(name) || null
      const profile: MemberProfile = {
        full_name: value('full_name'), status: value('status'), preferred_name: optional('preferred_name'),
        degree_or_office: optional('degree_or_office'), phone: optional('phone'), whatsapp: optional('whatsapp'),
        email: optional('email'), initiation_date: optional('initiation_date'), admission_date: optional('admission_date'), notes: optional('notes'),
      }
      if (!profile.full_name || value('reason').length < 3) { setError('Informe o nome e um motivo com pelo menos três caracteres.'); return }
      submission.current = { profile, reason: value('reason'), key: crypto.randomUUID() }
    }
    const current = submission.current
    guard.current = true; setPending(true); setError('')
    try {
      await saveMemberProfile(client, organizationId, member, current.profile, current.reason, current.key)
      if (mounted.current) onSaved()
    } catch (failure) {
      if (!mounted.current) return
      const code = (failure as { code?: string } | null)?.code
      if ((code === '40001' || code === 'PT409')) {
        submission.current = null; setUncertain(false); setConflict(true)
        setError('Este cadastro foi alterado por outra operação. Sua edição não foi salva. Atualize o cadastro antes de editar novamente.')
      } else if (['22023', '42501', '23503', '28000'].includes(code ?? '')) {
        submission.current = null; setUncertain(false)
        setError(code === '42501' || code === '28000' ? 'Seu acesso ou a situação da Loja não permite salvar este cadastro.' : code === '23503' ? 'O integrante não está disponível nesta Loja. Atualize a consulta.' : 'Confira os campos, as datas e o motivo. O cadastro não foi salvo.')
      } else {
        setUncertain(true)
        setError('Não foi possível confirmar o resultado. Verifique novamente com o botão abaixo; o mesmo envio será usado para evitar duplicidade.')
      }
    } finally {
      guard.current = false
      if (mounted.current) setPending(false)
    }
  }
  function field(name: keyof MemberProfile, label: string, maxLength: number, type = 'text') {
    return <div><label htmlFor={`member-${name}`}>{label}</label><input id={`member-${name}`} name={name} type={type} maxLength={maxLength} defaultValue={member?.[name] ?? ''} required={name === 'full_name'} /></div>
  }
  return <section className="panel member-editor"><h2>{member ? 'Editar integrante' : 'Cadastrar integrante'}</h2>
    <form aria-label="Cadastro de integrante" onSubmit={submit}>
      <fieldset disabled={pending || uncertain || conflict}><legend>Dados cadastrais</legend><div className="member-form-grid">
        {field('full_name', 'Nome completo', 180)}{field('preferred_name', 'Nome preferencial', 120)}
        <div><label htmlFor="member-status">Situação</label><select id="member-status" name="status" defaultValue={member?.status ?? 'active'}><option value="active">Ativo</option><option value="away">Afastado</option><option value="inactive">Inativo</option><option value="disconnected">Desligado</option></select></div>
        {field('degree_or_office', 'Grau / cargo registrado', 120)}{field('phone', 'Telefone', 40, 'tel')}{field('whatsapp', 'WhatsApp', 40, 'tel')}
        {field('email', 'E-mail do integrante', 254, 'email')}{field('initiation_date', 'Data de iniciação', 10, 'date')}{field('admission_date', 'Data de admissão', 10, 'date')}
      </div><label htmlFor="member-notes">Observações</label><textarea id="member-notes" name="notes" rows={3} maxLength={4000} defaultValue={member?.notes ?? ''} />
      <label htmlFor="member-reason">Motivo do registro</label><input id="member-reason" name="reason" required minLength={3} maxLength={500} defaultValue={member ? '' : 'Cadastro de integrante'} /></fieldset>
      <p className="subtle">Este cadastro não cria um login nem altera mensalidades, isenções ou lançamentos financeiros.</p>
      {error && <p role="alert" className="message error">{error}</p>}
      <div className="member-form-actions"><button className="primary" type="submit" disabled={pending || conflict}>{pending ? 'Salvando…' : uncertain ? 'Verificar e confirmar envio' : 'Salvar integrante'}</button>
        {conflict && <button className="secondary" type="button" onClick={onReload}>Atualizar cadastro</button>}
        <button className="secondary" type="button" onClick={onCancel} disabled={pending || uncertain}>Cancelar</button>
      </div>
    </form>
  </section>
}
