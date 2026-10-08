import { useState } from 'react'
import type { Member } from '../lib/tenant-data'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MemberForm } from './MemberForm'

const situations: Record<string, string> = { active: 'Ativo', away: 'Afastado', inactive: 'Inativo', disconnected: 'Desligado' }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
function matches(member: Member, query: string) {
  if (!query) return true
  const text = normalize(query)
  if ([member.full_name, member.preferred_name, member.email].some(value => value && normalize(value).includes(text))) return true
  const digits = query.replace(/\D/g, '')
  return !!digits && !/[a-z]/i.test(text) && [member.phone, member.whatsapp].some(value => value?.replace(/\D/g, '').includes(digits))
}
function dateLabel(value?: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'Não informado'
}

export function Members({ members, client, organizationId, onSaved, onReload }: { members: Member[]; client?: SupabaseClient; organizationId?: string; onSaved?: () => void; onReload?: () => void }) {
  const [query, setQuery] = useState('')
  const [situation, setSituation] = useState('all')
  const [editing, setEditing] = useState<Member | null | undefined>(undefined)
  const filtered = members.filter(member => (situation === 'all' || member.status === situation) && matches(member, query))
  return <>
    {editing !== undefined && client && organizationId && <MemberForm key={editing?.id ?? 'new'} client={client} organizationId={organizationId} member={editing} onCancel={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); onSaved?.() }} onReload={() => { setEditing(undefined); onReload?.() }} />}
    <section className="panel">
    <div className="section-title"><h2>Cadastro de integrantes</h2><span className="pill">{members.length} carregados</span></div>
    {client && organizationId && <button className="primary" type="button" disabled={editing !== undefined} onClick={() => setEditing(null)}>Cadastrar integrante</button>}
    <div className="member-filters">
      <div><label htmlFor="member-search">Buscar integrante</label><input id="member-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, telefone, WhatsApp ou e-mail" type="search" /></div>
      <div><label htmlFor="member-situation">Situação cadastral</label><select id="member-situation" value={situation} onChange={event => setSituation(event.target.value)}><option value="all">Todas as situações</option>{Object.entries(situations).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <button className="secondary" type="button" onClick={() => { setQuery(''); setSituation('all') }}>Limpar filtros</button>
    </div>
    <p role="status" className="subtle">{filtered.length} de {members.length} integrantes carregados</p>
    {!filtered.length ? <p className="empty">Nenhum integrante encontrado.</p> : <div className="finance-table member-table"><table>
      <caption>Integrantes da Loja. Abra o nome para consultar a ficha cadastral.</caption>
      <thead><tr><th scope="col">Integrante / ficha</th><th scope="col">Situação cadastral</th><th scope="col">Grau / cargo registrado</th><th scope="col">Contato</th></tr></thead>
      <tbody>{filtered.map(member => <tr key={member.id}>
        <th scope="row"><details><summary>{member.full_name}</summary><dl className="member-details">
          <dt>Nome preferencial</dt><dd>{member.preferred_name || 'Não informado'}</dd>
          <dt>Data de iniciação</dt><dd>{dateLabel(member.initiation_date)}</dd>
          <dt>Data de admissão</dt><dd>{dateLabel(member.admission_date)}</dd>
          <dt>Telefone</dt><dd>{member.phone || 'Não informado'}</dd>
          <dt>WhatsApp</dt><dd>{member.whatsapp || 'Não informado'}</dd>
          <dt>E-mail</dt><dd>{member.email || 'Não informado'}</dd>
          <dt>Observações</dt><dd>{member.notes || 'Não informado'}</dd>
        </dl>{client && organizationId && member.updated_at && <button type="button" className="secondary" disabled={editing !== undefined} onClick={() => setEditing(member)}>Editar {member.full_name}</button>}</details></th>
        <td><span className="pill">{situations[member.status] ?? 'Situação não reconhecida'}</span></td>
        <td>{member.degree_or_office || 'Não informado'}</td>
        <td>{member.email || member.whatsapp || member.phone || 'Não informado'}</td>
      </tr>)}</tbody>
    </table></div>}
    <p className="subtle list-note">Consulta de até 200 integrantes. A situação cadastral não representa o saldo financeiro. Parâmetros de mensalidade e isenção serão tratados separadamente.</p>
  </section></>
}
