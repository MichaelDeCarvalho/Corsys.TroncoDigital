import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate, formatMoney } from '../lib/finance-data'
import { checkedSigned } from '../lib/treasury-balances'
import {
  loadFilteredDelinquencyPage,
  loadDelinquencyBucketSummary,
  DelinquencyMigrationPendingError,
  type DelinquencyRow,
  type DelinquencyBucketSummary,
  AGING_BUCKETS,
  calculateDaysOverdue,
  classifyMemberBucket,
  formatBucketLabel,
  type DelinquencyBucketId,
} from '../lib/delinquency-report'
import { createDelinquencyCsv, loadDelinquencyExport } from '../lib/delinquency-export'
import { createReportWorkbook, downloadReport, printReport, type ReportSnapshot } from '../lib/report-export'

function buildDelinquencySnapshot(
  organizationId: string,
  rows: DelinquencyRow[],
  bucket: DelinquencyBucketId | null,
  serverDate: string | null,
): ReportSnapshot {
  const bucketInfo = bucket ? AGING_BUCKETS.find(b => b.id === bucket) : null
  return {
    title: 'Relatório de Inadimplência por Integrante',
    organizationId,
    scope: 'Cobranças vencidas com saldo em aberto',
    filters: [
      bucketInfo ? `Faixa: ${bucketInfo.label} (${bucketInfo.rangeLabel})` : 'Faixa: Todas',
      serverDate ? `Data de referência (servidor): ${formatDate(serverDate)}` : 'Data de referência: legado sem migration de faixas',
    ].join(' | '),
    headers: [
      'Integrante',
      'Situação',
      'Primeiro vencimento',
      'Dias em atraso',
      'Faixa',
      'Cobranças vencidas',
      'Saldo vencido (BRL)',
      'Crédito sem alocação (BRL)',
      'Posição líquida geral (BRL)',
    ],
    rows: rows.map(row => {
      const days = serverDate ? calculateDaysOverdue(row.oldest_due, serverDate) : null
      const rowBucket = days !== null ? classifyMemberBucket(days) : null
      return [
        row.full_name,
        row.member_status,
        formatDate(row.oldest_due),
        days !== null ? (days === 1 ? '1 dia' : `${days} dias`) : 'Requer migration',
        rowBucket ? formatBucketLabel(rowBucket) : 'Requer migration',
        row.overdue_items,
        checkedSigned(row.overdue_amount),
        checkedSigned(row.available_credit),
        checkedSigned(row.net_position),
      ]
    }),
  }
}

export function DelinquencyReport({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [serverDate, setServerDate] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<DelinquencyBucketId | null>(null)
  const [result, setResult] = useState<{ rows: DelinquencyRow[]; hasNext: boolean } | null>(null)
  const [bucketSummaries, setBucketSummaries] = useState<DelinquencyBucketSummary[]>([])
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState('')
  const stillMounted = useRef(true)
  const currentTenant = useRef(organizationId)
  const exportGuard = useRef(false)
  const exportEpoch = useRef(0)

  currentTenant.current = organizationId

  useEffect(() => {
    stillMounted.current = true
    return () => { stillMounted.current = false }
  }, [])

  useEffect(() => {
    exportEpoch.current += 1
    exportGuard.current = false
    setExportingFormat(null)
    setExportError('')
    setPage(0)
    return () => { exportEpoch.current += 1 }
  }, [organizationId, selectedBucket])

  useEffect(() => {
    setSelectedBucket(null)
  }, [organizationId])

  useEffect(() => {
    let live = true
    setResult(null)
    setError('')
    setDenied(false)

    Promise.all([
      loadFilteredDelinquencyPage(client, organizationId, selectedBucket, page),
      loadDelinquencyBucketSummary(client, organizationId),
    ]).then(([pageData, summaryData]) => {
      if (!live) return
      setResult({ rows: pageData.rows, hasNext: pageData.hasNext })
      setBucketSummaries(summaryData.summaries)
      setServerDate(summaryData.serverDate)
      setMigrationPending(Boolean(pageData.migrationPending || summaryData.migrationPending))
    }).catch(cause => {
      if (!live) return
      setBucketSummaries([])
      setServerDate(null)
      if (cause instanceof DelinquencyMigrationPendingError) {
        setMigrationPending(true)
        setError(cause.message)
        return
      }
      const code = (cause as { code?: string } | null)?.code
      if (code === '42501' || code === '28000') setDenied(true)
      else setError('O relatório de inadimplência não pôde ser validado; nenhum valor parcial é apresentado.')
    })
    return () => { live = false }
  }, [client, organizationId, selectedBucket, page, revision])

  async function runExport(format: 'csv' | 'xlsx' | 'pdf') {
    if (exportGuard.current || !result || denied || error) return
    exportGuard.current = true
    setExportingFormat(format)
    setExportError('')
    const org = organizationId
    const epoch = exportEpoch.current
    const activeBucket = selectedBucket
    const activeServerDate = serverDate
    const safe = () => stillMounted.current && currentTenant.current === org && exportEpoch.current === epoch

    try {
      const rows = await loadDelinquencyExport(client, org, safe, activeBucket)
      if (!safe()) return

      if (format === 'csv') {
        const contents = createDelinquencyCsv(rows)
        if (!safe()) return
        const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
        downloadReport(blob, 'inadimplencia-' + org.slice(0, 8) + '.csv')
      } else {
        const snapshot = buildDelinquencySnapshot(org, rows, activeBucket, activeServerDate)
        if (!safe()) return
        if (format === 'xlsx') {
          const workbook = await createReportWorkbook(snapshot)
          if (!safe()) return
          downloadReport(workbook, 'inadimplencia-' + org.slice(0, 8) + '.xlsx')
        } else {
          printReport(snapshot)
        }
      }
    } catch (cause) {
      if (safe()) {
        const message = cause instanceof Error && cause.message.includes('Permita a abertura')
          ? cause.message
          : 'A exportação não pôde ser concluída ou excedeu 1.000 registros; nenhum arquivo parcial foi disponibilizado.'
        setExportError(message)
      }
    } finally {
      if (safe()) {
        exportGuard.current = false
        setExportingFormat(null)
      }
    }
  }

  return (
    <section className="panel" aria-label="Relatório de inadimplência" id="delinquency-report-container">
      <div className="section-title">
        <h2>Inadimplência por integrante</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="secondary" type="button" onClick={() => { setPage(0); setRevision(v => v + 1) }}>
            Atualizar posições
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!result || denied || Boolean(error) || exportingFormat !== null}
            onClick={() => { void runExport('csv') }}
          >
            {exportingFormat === 'csv' ? 'Preparando CSV…' : 'Exportar CSV completo'}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!result || denied || Boolean(error) || exportingFormat !== null}
            onClick={() => { void runExport('xlsx') }}
          >
            {exportingFormat === 'xlsx' ? 'Preparando XLSX…' : 'Exportar XLSX'}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!result || denied || Boolean(error) || exportingFormat !== null}
            onClick={() => { void runExport('pdf') }}
          >
            {exportingFormat === 'pdf' ? 'Preparando PDF…' : 'Imprimir / PDF'}
          </button>
        </div>
      </div>

      <p className="subtle">
        Somente cobranças vencidas com saldo positivo, segundo a data do banco. Créditos de pagamentos ainda não alocados aparecem separadamente e não quitam automaticamente cobranças. A posição líquida considera também obrigações a vencer.
      </p>

      {denied && <p className="subtle">Seu perfil não possui permissão para consultar a inadimplência da Loja.</p>}
      {error && <p role="alert" className="message error">{error}</p>}
      {exportError && <p role="alert" className="message error">{exportError}</p>}

      {!denied && !error && (
        <>
          {migrationPending && (
            <p role="status" className="subtle">
              Totalização global por faixas e data de referência do servidor aguardam aplicação da migration de faixas no banco de dados. A listagem paginada segue operando via consulta legada.
            </p>
          )}

          <div
            className="aging-buckets-grid"
            role="group"
            aria-label="Faixas de atraso"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}
          >
            {AGING_BUCKETS.map(b => {
              const summary = bucketSummaries.find(s => s.bucket_id === b.id)
              const active = selectedBucket === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  className="panel stat-card"
                  data-delinquency-bucket={b.id}
                  aria-pressed={active}
                  disabled={migrationPending}
                  onClick={() => {
                    setSelectedBucket(curr => curr === b.id ? null : b.id)
                    setPage(0)
                  }}
                  style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    border: active ? '2px solid var(--primary, #0284c7)' : '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '6px',
                    cursor: migrationPending ? 'not-allowed' : 'pointer',
                    background: 'var(--card-bg, inherit)',
                    opacity: migrationPending ? 0.72 : 1,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{b.label}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>{b.rangeLabel}</span>
                  </span>

                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted, #4b5563)', margin: '0.2rem 0' }}>
                    {summary
                      ? `${summary.member_count} integrante(s) • ${summary.overdue_items} cobr.`
                      : migrationPending
                        ? 'Indisponível (migration pendente)'
                        : 'Consultando faixa…'}
                  </span>

                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', marginTop: '0.2rem' }}>
                    {summary ? formatMoney(summary.overdue_amount) : migrationPending ? '—' : '…'}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedBucket && (
            <div style={{ margin: '0.5rem 0 1rem', padding: '0.75rem', background: 'var(--highlight, #f3f4f6)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p className="subtle" style={{ margin: 0 }}>
                Faixa selecionada: <strong>{AGING_BUCKETS.find(b => b.id === selectedBucket)?.label} ({AGING_BUCKETS.find(b => b.id === selectedBucket)?.rangeLabel})</strong>. Exibindo integrantes filtrados no servidor.
              </p>
              <button className="secondary" type="button" onClick={() => { setSelectedBucket(null); setPage(0) }}>
                Limpar filtro
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap' }}>
            <label htmlFor="delinquency-ref-date" style={{ fontSize: '0.85rem' }}>Data de referência (banco):</label>
            {serverDate ? (
              <>
                <input
                  id="delinquency-ref-date"
                  type="date"
                  value={serverDate}
                  disabled
                  style={{ padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.04)' }}
                />
                <span className="subtle" style={{ fontSize: '0.85rem' }}>(Fotografia determinística calculada no servidor)</span>
              </>
            ) : (
              <span id="delinquency-ref-date" className="subtle" style={{ fontSize: '0.85rem' }}>
                {migrationPending ? 'Indisponível até aplicação da migration no banco.' : 'Consultando data do servidor…'}
              </span>
            )}
          </div>
        </>
      )}

      {!result && !error && !denied && <p role="status">Consultando posições vencidas…</p>}

      {result && !denied && !error && (
        <>
          {!result.rows.length ? (
            <p>Nenhum integrante com cobrança vencida nesta faixa ou página.</p>
          ) : (
            <div className="finance-table" role="region" tabIndex={0} aria-label="Inadimplência consultada">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Integrante</th>
                    <th scope="col">Primeiro vencimento</th>
                    <th scope="col">Dias em atraso</th>
                    <th scope="col">Faixa</th>
                    <th scope="col">Cobranças vencidas</th>
                    <th scope="col">Saldo vencido</th>
                    <th scope="col">Crédito sem alocação</th>
                    <th scope="col">Posição líquida geral</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(m => {
                    const days = serverDate ? calculateDaysOverdue(m.oldest_due, serverDate) : null
                    const bucket = days !== null ? classifyMemberBucket(days) : null
                    return (
                      <tr key={m.member_id}>
                        <th scope="row">{m.full_name}</th>
                        <td>{formatDate(m.oldest_due)}</td>
                        <td>{days !== null ? (days === 1 ? '1 dia' : `${days} dias`) : 'Requer migration'}</td>
                        <td>{bucket ? formatBucketLabel(bucket) : 'Requer migration'}</td>
                        <td>{m.overdue_items}</td>
                        <td>{formatMoney(Number(m.overdue_amount))}</td>
                        <td>{formatMoney(Number(m.available_credit))}</td>
                        <td>{formatMoney(Number(m.net_position))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="finance-pagination">
            <button className="secondary" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Anterior</button>
            <span role="status">Página {page + 1} — {result.rows.length} integrantes nesta página</span>
            <button className="secondary" disabled={!result.hasNext} onClick={() => setPage(v => v + 1)}>Próxima</button>
          </div>

          <p className="subtle">
            Dados paginados por integrante. O painel financeiro fornece o consolidado global. A exportação consulta todas as páginas até 1.000 integrantes.
          </p>
        </>
      )}
    </section>
  )
}
