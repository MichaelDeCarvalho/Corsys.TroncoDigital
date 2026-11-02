import { useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMasterAudit, type AuditFilters, type MasterAuditEvent } from '../lib/master-audit'

function initialFilters(): AuditFilters {
  const end = new Date()
  const start = new Date(end.getTime() - 29 * 86400000)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), action: '', organization: '' }
}

export function MasterAudit({ client }: { client: SupabaseClient }) {
  const [draft, setDraft] = useState(initialFilters)
  const [filters, setFilters] = useState(draft)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<{ rows: MasterAuditEvent[]; next: string | null } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    loadMasterAudit(client, filters, cursors[page], controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        setError(cause?.code === '42501' || cause?.code === '28000'
          ? 'A auditoria exige MASTER com MFA ativo.'
          : 'Não foi possível validar a consulta. Revise os filtros (até 366 dias) e a disponibilidade da auditoria.')
      })
    return () => controller.abort()
  }, [client, filters, cursors, page, revision])
  function apply(event: FormEvent) {
    event.preventDefault()
    setCursors([null]); setPage(0); setFilters({ ...draft })
  }
  return <section className="panel" aria-label="Auditoria Master">
    <div className="section-title"><h3>Trilha de Auditoria do Control Plane</h3>
      <button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Atualizar auditoria</button>
    </div>
    <p className="subtle">Consulta exclusiva MASTER com MFA. Datas em UTC, até 366 dias por consulta. Metadados e conteúdo técnico dos eventos são omitidos.</p>
    <form onSubmit={apply} aria-label="Filtrar auditoria Master">
      <div className="member-form-grid">
        <div><label htmlFor="audit-from">Data inicial (UTC)</label><input id="audit-from" type="date" required value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></div>
        <div><label htmlFor="audit-to">Data final (UTC)</label><input id="audit-to" type="date" required value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></div>
        <div><label htmlFor="audit-action">Ação exata</label><input id="audit-action" maxLength={100} value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value })} placeholder="Ex.: support_session.start" /></div>
        <div><label htmlFor="audit-org">ID da Loja (opcional)</label><input id="audit-org" value={draft.organization} onChange={e => setDraft({ ...draft, organization: e.target.value.trim() })} /></div>
      </div>
      <button type="submit" className="secondary">Aplicar filtros de auditoria</button>
    </form>
    {error && <p role="alert" className="message error">{error}</p>}
    {!data && !error && <p role="status">Consultando eventos de auditoria…</p>}
    {data && <>
      {!data.rows.length ? <p>Nenhum evento nesta consulta.</p> : <div className="finance-table" role="region" aria-label="Eventos de auditoria" tabIndex={0}><table>
        <thead><tr><th>Evento</th><th>Data (UTC)</th><th>Ação</th><th>Responsável (ID)</th><th>Loja (ID)</th><th>Tipo de recurso</th><th>Recurso (ID)</th></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.id}><th scope="row">{row.id}</th><td>{new Date(row.created_at).toISOString()}</td><td>{row.action}</td><td>{row.staff_user_id ?? '—'}</td><td>{row.organization_id ?? 'Plataforma'}</td><td>{row.resource_type}</td><td>{row.resource_id ?? '—'}</td></tr>)}</tbody>
      </table></div>}
      <div className="finance-pagination">
        <button type="button" className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Eventos anteriores da navegação</button>
        <span role="status">Página {page + 1} — {data.rows.length} eventos</span>
        <button type="button" className="secondary" disabled={!data.next} onClick={() => { setCursors([...cursors.slice(0, page + 1), data.next]); setPage(page + 1) }}>Eventos mais antigos</button>
      </div>
    </>}
  </section>
}
