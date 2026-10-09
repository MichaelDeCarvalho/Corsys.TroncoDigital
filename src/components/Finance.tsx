import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RefreshCw } from 'lucide-react'
import { MemberPayments } from './MemberPayments'
import { DreReport } from './DreReport'
import { InstitutionalOperations } from './InstitutionalOperations'
import { PayableApprovals } from './PayableApprovals'
import { FinanceIntegrityError, financeSources, formatDate, formatMoney, loadFinancePage, type FinanceKind, type FinanceRow } from '../lib/finance-data'

const statusLabels: Record<string, string> = { open: 'Em aberto', paid: 'Liquidada', partially_paid: 'Parcialmente liquidada', cancelled: 'Cancelada', posted: 'Contabilizada', approved: 'Aprovada', pending: 'Pendente', missing_request: 'Aprovação não solicitada', not_required: 'Dispensada', rejected: 'Rejeitada' }

export function Finance({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [kind, setKind] = useState<FinanceKind | 'memberPayments' | 'dre' | 'institutional' | 'approvals'>('charges')
  return <>
    <div className="finance-sections" role="group" aria-label="Consultas financeiras">
      {(Object.keys(financeSources) as FinanceKind[]).map(id => <button className="secondary" key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{financeSources[id].label}</button>)}
      <button className="secondary" aria-pressed={kind === 'memberPayments'} onClick={() => setKind('memberPayments')}>Pagamentos de integrantes</button>
      <button className="secondary" aria-pressed={kind === 'dre'} onClick={() => setKind('dre')}>DRE contábil</button>
      <button className="secondary" aria-pressed={kind === 'institutional'} onClick={() => setKind('institutional')}>Operações institucionais</button>
      <button className="secondary" aria-pressed={kind === 'approvals'} onClick={() => setKind('approvals')}>Aprovação de despesas</button>
    </div>
    <p className="subtle">Cobranças e obrigações são separadas dos pagamentos. Os valores em aberto não representam saldo de caixa.</p>
    {kind === 'memberPayments'
      ? <MemberPayments key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'dre'
      ? <DreReport key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'institutional'
      ? <InstitutionalOperations key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'approvals'
      ? <PayableApprovals key={organizationId} client={client} organizationId={organizationId} />
      : <FinanceList key={`${organizationId}:${kind}`} client={client} organizationId={organizationId} kind={kind} />}
  </>
}

function FinanceList({ client, organizationId, kind }: { client: SupabaseClient; organizationId: string; kind: FinanceKind }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ rows: FinanceRow[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setResult(null); setError('')
    loadFinancePage(client, organizationId, kind, page, controller.signal).then(data => { if (active) setResult(data) }).catch(reason => {
      if (active) setError(reason instanceof FinanceIntegrityError ? 'Há uma inconsistência nos registros financeiros. Solicite a revisão antes de utilizar os valores.' : 'Não foi possível consultar o financeiro. Tente novamente ou solicite a revisão do seu acesso.')
    })
    return () => { active = false; controller.abort() }
  }, [client, organizationId, kind, page, revision])
  return <section className="panel">
    <div className="section-title"><h2>{financeSources[kind].label}</h2><button className="quiet" aria-label="Atualizar financeiro" onClick={() => setRevision(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></button></div>
    {error ? <><p role="alert" className="message error">{error}</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></> : !result ? <p role="status" className="message">Consultando financeiro…</p> : <>
      {!result.rows.length ? <p className="empty">Nenhum registro nesta página.</p> : <div className="finance-table" role="region" aria-label={financeSources[kind].label} tabIndex={0}><table><caption className="subtle">Valores calculados pelo sistema para a Loja selecionada.</caption><thead><tr><th scope="col">Descrição</th><th scope="col">Vencimento</th><th scope="col">Valor efetivo</th><th scope="col">Em aberto</th><th scope="col">Situação</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.id}><th scope="row">{row.description}</th><td>{formatDate(row.dueDate)}</td><td>{formatMoney(row.amount)}</td><td>{formatMoney(row.openAmount)}</td><td><span className="pill">{statusLabels[row.status] ?? row.status}</span></td></tr>)}</tbody></table></div>}
      <div className="finance-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span role="status">Página {page + 1} · {result.rows.length} registros</span><button className="secondary" disabled={!result.hasNext} onClick={() => setPage(value => value + 1)}>Próxima</button></div>
    </>}
  </section>
}
