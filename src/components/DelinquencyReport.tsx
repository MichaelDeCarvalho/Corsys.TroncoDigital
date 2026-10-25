import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate, formatMoney } from '../lib/finance-data'
import {
  loadDelinquencyPage,
  type DelinquencyRow,
  AGING_BUCKETS,
  calculateDaysOverdue,
  classifyMemberBucket,
  formatBucketLabel,
  formatBucketRangeLabel,
  type DelinquencyBucketId,
} from '../lib/delinquency-report'
import { createDelinquencyCsv, loadDelinquencyExport } from '../lib/delinquency-export'

function getTodayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DelinquencyReport({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [referenceDate, setReferenceDate] = useState(getTodayIsoDate)
  const [selectedBucket, setSelectedBucket] = useState<DelinquencyBucketId | null>(null)
  const [result, setResult] = useState<{ rows: DelinquencyRow[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [exporting, setExporting] = useState(false)
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
    setExporting(false)
    setExportError('')
    return () => { exportEpoch.current += 1 }
  }, [organizationId])

  useEffect(() => {
    let live = true
    setResult(null)
    setError('')
    setDenied(false)
    loadDelinquencyPage(client, organizationId, page).then(data => {
      if (live) setResult(data)
    }).catch(cause => {
      if (!live) return
      const code = (cause as { code?: string } | null)?.code
      if (code === '42501' || code === '28000') setDenied(true)
      else setError('O relatório de inadimplência não pôde ser validado; nenhum valor parcial é apresentado.')
    })
    return () => { live = false }
  }, [client, organizationId, page, revision])

  async function exportCsv() {
    if (exportGuard.current || !result || denied || error) return
    exportGuard.current = true
    setExporting(true)
    setExportError('')
    const org = organizationId
    const epoch = exportEpoch.current
    const safe = () => stillMounted.current && currentTenant.current === org && exportEpoch.current === epoch

    try {
      const rows = await loadDelinquencyExport(client, org, safe)
      if (!safe()) return
      const contents = createDelinquencyCsv(rows)
      if (!safe()) return
      const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'inadimplencia-' + org.slice(0, 8) + '.csv'
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      if (safe()) {
        setExportError('A exportação não pôde ser concluída ou excedeu 1.000 registros; nenhum arquivo parcial foi disponibilizado.')
      }
    } finally {
      if (safe()) {
        exportGuard.current = false
        setExporting(false)
      }
    }
  }

  const pageBucketStats = AGING_BUCKETS.map(b => {
    if (!result?.rows) return { count: 0, items: 0, amount: 0, valid: false }
    let itemsSum = 0
    let amountSum = 0
    let rowCount = 0
    let valid = true

    for (const m of result.rows) {
      const days = calculateDaysOverdue(m.oldest_due, referenceDate)
      const bucketId = classifyMemberBucket(days)
      if (bucketId === b.id) {
        rowCount++
        const items = Number(m.overdue_items)
        const amt = Number(m.overdue_amount)
        if (!Number.isInteger(items) || items < 1 || isNaN(amt) || amt <= 0) {
          valid = false
        } else {
          itemsSum += items
          amountSum += amt
        }
      }
    }

    return { count: rowCount, items: itemsSum, amount: amountSum, valid }
  })

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
            disabled={!result || denied || exporting}
            onClick={() => { void exportCsv() }}
          >
            {exporting ? 'Preparando CSV…' : 'Exportar CSV completo'}
          </button>
        </div>
      </div>

      <p className="subtle">
        Somente cobranças vencidas com saldo positivo, segundo a data do banco. Créditos de pagamentos ainda não alocados aparecem separadamente e não quitam automaticamente cobranças. A posição líquida considera também obrigações a vencer.
      </p>

      {/* Aging buckets / Faixas de atraso */}
      <div
        className="aging-buckets-grid"
        role="region"
        aria-label="Faixas de atraso"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}
      >
        {AGING_BUCKETS.map((b, idx) => {
          const stats = pageBucketStats[idx]
          return (
            <div
              key={b.id}
              className="panel stat-card"
              data-delinquency-bucket={b.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedBucket === b.id}
              onClick={() => setSelectedBucket(curr => curr === b.id ? null : b.id)}
              style={{
                padding: '0.75rem',
                border: selectedBucket === b.id ? '2px solid var(--primary, #0284c7)' : '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '6px',
                cursor: 'pointer',
                background: 'var(--card-bg, inherit)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{b.label}</span>
                <span className="pill" style={{ fontSize: '0.72rem', padding: '0.1rem 0.35rem' }}>{b.rangeLabel}</span>
              </div>
              
              {result?.rows && stats.valid && stats.count > 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted, #4b5563)', margin: '0.2rem 0' }}>
                  Página: {stats.count} integrante(s) • {stats.items} cobr.
                </div>
              ) : result?.rows && !stats.valid ? (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', margin: '0.2rem 0' }}>
                  Página: Indisponível
                </div>
              ) : null}

              <div style={{ fontSize: '0.78rem', color: 'var(--muted, #666)' }}>Total da faixa:</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#dc2626', marginTop: '0.15rem' }}>
                Indisponível (depende de RPC de agregação global no backend)
              </div>
            </div>
          )
        })}
      </div>

      {selectedBucket && (
        <p className="subtle" style={{ margin: '0.5rem 0 1rem', padding: '0.5rem', background: 'var(--highlight, #f3f4f6)', borderRadius: '4px' }}>
          Faixa selecionada: <strong>{AGING_BUCKETS.find(b => b.id === selectedBucket)?.label} ({AGING_BUCKETS.find(b => b.id === selectedBucket)?.rangeLabel})</strong>. O filtro por faixa no servidor depende de extensão na RPC <code>read_tenant_delinquency</code>; para evitar distorção estatística na página de 25 registros, a listagem geral ordenada por saldo devedor é exibida.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap' }}>
        <label htmlFor="delinquency-ref-date" style={{ fontSize: '0.85rem' }}>Data de referência para cálculo dos dias em atraso:</label>
        <input
          id="delinquency-ref-date"
          type="date"
          value={referenceDate}
          onChange={e => setReferenceDate(e.target.value || getTodayIsoDate())}
          style={{ padding: '0.25rem 0.5rem' }}
        />
        <span className="subtle" style={{ fontSize: '0.85rem' }}>({formatDate(referenceDate)})</span>
      </div>

      <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        A tendência histórica e os totais consolidados por faixa dependem de agregação global no servidor e não são derivados de páginas parciais.
      </p>

      {denied && <p className="subtle">Seu perfil não possui permissão para consultar a inadimplência da Loja.</p>}
      {error && <p role="alert" className="message error">{error}</p>}
      {exportError && <p role="alert" className="message error">{exportError}</p>}
      {!result && !error && !denied && <p role="status">Consultando posições vencidas…</p>}

      {result && (
        <>
          {!result.rows.length ? (
            <p>Nenhum integrante com cobrança vencida nesta página.</p>
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
                    const days = calculateDaysOverdue(m.oldest_due, referenceDate)
                    const bucket = classifyMemberBucket(days)
                    return (
                      <tr key={m.member_id}>
                        <th scope="row">{m.full_name}</th>
                        <td>{formatDate(m.oldest_due)}</td>
                        <td>{days === 1 ? '1 dia' : `${days} dias`}</td>
                        <td><span className="pill">{formatBucketLabel(bucket)}</span></td>
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
            <span role="status">Página {page + 1} — {result.rows.length} integrantes</span>
            <button className="secondary" disabled={!result.hasNext} onClick={() => setPage(v => v + 1)}>Próxima</button>
          </div>

          <p className="subtle">
            Dados paginados por integrante. Não some esta página como inadimplência total da Loja; o Painel financeiro fornece o consolidado. A exportação consulta todas as páginas até 1.000 integrantes, sem salvar informações no servidor; se a lista mudar durante a consulta, o CSV pode não representar uma fotografia transacional. CSV compatível com Excel não é arquivo XLSX nem PDF.
          </p>
        </>
      )}
    </section>
  )
}
