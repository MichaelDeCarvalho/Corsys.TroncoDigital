import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, Printer, ShieldAlert } from 'lucide-react'
import { formatDate, formatMoney, formatCompetence } from '../lib/finance-data'
import { loadAccountingCatalog, loadAccountingDetail, type Account, type Plan } from '../lib/accounting-plans'
import {
  classifyDiaryReadError,
  DIARY_EVENT_LABELS,
  INCOMPLETE_REASON_LABELS,
  loadAccountingDiaryWithDiagnostics,
  loadAllAccountingDiaryPages,
  serializeDiaryFilter,
  toCentsStrict,
  type DiaryDateBasis,
  type DiaryEntry,
  type DiaryFailureCategory,
  type DiaryFilter,
  type DiaryRpcDiagnostic,
  type DiaryRpcName,
  type DiarySummary,
} from '../lib/accounting-books'
import {
  createIntegralBookWorkbook,
  downloadReport,
  printIntegralBookReport,
} from '../lib/report-export'

const UI_PAGE_SIZE = 50
const NON_FISCAL_DIARY_NOTICE =
  'Diário Gerencial auxiliar por partidas dobradas. Não substitui livro diário fiscal autenticado nem escrituração oficial assinada pelo contador.'

const DIARY_RPC_LABELS: Record<DiaryRpcName, string> = {
  read_tenant_accounting_diary_summary: 'Resumo do Diário (read_tenant_accounting_diary_summary)',
  read_tenant_accounting_diary: 'Página do Diário (read_tenant_accounting_diary)',
}

const DIARY_CATEGORY_LABELS: Record<DiaryFailureCategory, string> = {
  ok: 'OK',
  timeout: 'Tempo limite (timeout)',
  network: 'Falha transitória de rede',
  server_transient: 'Indisponibilidade transitória do servidor',
  aborted: 'Consulta cancelada',
  auth: 'Autorização / sessão',
  validation: 'Validação de parâmetros',
  inconsistent_response: 'Resposta inconsistente',
  unexpected: 'Erro inesperado',
}

interface LoadedDiarySnapshot {
  organizationId: string
  filterKey: string
  page: number
}

function defaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(Date.UTC(y, now.getMonth() + 1, 0)).getUTCDate()
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function AccountingDiary({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const defaults = defaultDateRange()
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [dateBasis, setDateBasis] = useState<DiaryDateBasis>('event_date')
  const [eventType, setEventType] = useState('')
  const [accountId, setAccountId] = useState('')
  const [onlyReversals, setOnlyReversals] = useState(false)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [summary, setSummary] = useState<DiarySummary | null>(null)
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null)
  const [loadedSnapshot, setLoadedSnapshot] = useState<LoadedDiarySnapshot | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiaryRpcDiagnostic[]>([])
  const [retryNotice, setRetryNotice] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')

  const requestSeq = useRef(0)
  const activeOrgRef = useRef(organizationId)
  const queryAbort = useRef<AbortController | null>(null)
  const exportAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    activeOrgRef.current = organizationId
    const abort = new AbortController()
    let live = true
    setAccounts([])
    setAccountId('')
    setSummary(null)
    setEntries(null)
    setLoadedSnapshot(null)
    setDiagnostics([])
    setRetryNotice('')
    setPage(0)
    setLoading(false)
    setExporting(false)
    setError('')
    setExportError('')
    requestSeq.current += 1
    queryAbort.current?.abort()
    queryAbort.current = null
    exportAbort.current?.abort()
    exportAbort.current = null

    loadAccountingCatalog(client, organizationId, abort.signal)
      .then(async cat => {
        if (!live || activeOrgRef.current !== organizationId) return
        const published = cat.plans.find((p: Plan) => p.status === 'published') ?? cat.plans[0]
        if (!published) return
        const detail = await loadAccountingDetail(client, organizationId, published.id, abort.signal)
        if (!live || activeOrgRef.current !== organizationId) return
        setAccounts(detail.accounts.filter(a => a.row_type === 'analytic'))
      })
      .catch(() => {
        // Optional account filter list; diary consultation works independently
      })

    return () => {
      live = false
      abort.abort()
      queryAbort.current?.abort()
      exportAbort.current?.abort()
    }
  }, [client, organizationId])

  function currentFilter(): DiaryFilter {
    return {
      fromDate,
      toDate,
      dateBasis,
      eventType: eventType || null,
      accountId: accountId || null,
      onlyReversals,
    }
  }

  async function runQuery(targetPage: number) {
    queryAbort.current?.abort()
    const controller = new AbortController()
    queryAbort.current = controller
    const targetOrg = organizationId
    const seq = ++requestSeq.current
    const filter = currentFilter()
    const filterKey = serializeDiaryFilter(filter)

    setLoading(true)
    setError('')
    setExportError('')
    setRetryNotice('')
    setDiagnostics([])

    try {
      const result = await loadAccountingDiaryWithDiagnostics(
        client,
        targetOrg,
        filter,
        targetPage,
        UI_PAGE_SIZE,
        { signal: controller.signal },
      )
      if (seq !== requestSeq.current || activeOrgRef.current !== targetOrg || controller.signal.aborted) {
        return
      }
      const diagList = [result.diagnostics.summary, result.diagnostics.page]
      setSummary(result.summary)
      setEntries(result.entries)
      setLoadedSnapshot({ organizationId: targetOrg, filterKey, page: targetPage })
      setDiagnostics(diagList)
      setPage(targetPage)
      if (diagList.some(d => d.retried)) {
        setRetryNotice(
          'Falha transitória detectada na primeira tentativa; a consulta de leitura foi recuperada automaticamente após 1 nova tentativa.',
        )
      }
    } catch (cause) {
      const classified = classifyDiaryReadError(cause, controller.signal)
      if (
        seq !== requestSeq.current ||
        activeOrgRef.current !== targetOrg ||
        controller.signal.aborted ||
        classified.category === 'aborted'
      ) {
        return
      }
      const causeExtra = cause as {
        diagnostics?: DiaryRpcDiagnostic[]
        diagnostic?: DiaryRpcDiagnostic
      } | null
      const capturedDiagnostics = Array.isArray(causeExtra?.diagnostics)
        ? causeExtra.diagnostics
        : causeExtra?.diagnostic
          ? [causeExtra.diagnostic]
          : []
      setSummary(null)
      setEntries(null)
      setLoadedSnapshot(null)
      setDiagnostics(capturedDiagnostics)
      setError(classified.userMessage)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    void runQuery(0)
  }

  const activeFilterKey = serializeDiaryFilter(currentFilter())
  const isFilterDirty = Boolean(
    summary &&
      loadedSnapshot &&
      (loadedSnapshot.organizationId !== organizationId || loadedSnapshot.filterKey !== activeFilterKey),
  )
  const canExport = Boolean(
    summary &&
      entries &&
      loadedSnapshot &&
      loadedSnapshot.organizationId === organizationId &&
      loadedSnapshot.filterKey === activeFilterKey &&
      summary.integral_ok &&
      !error &&
      !loading &&
      !exporting,
  )

  async function handleIntegralExport(format: 'XLSX' | 'PDF') {
    if (!canExport || !summary) return
    exportAbort.current?.abort()
    const controller = new AbortController()
    exportAbort.current = controller
    const targetOrg = organizationId
    const seq = requestSeq.current
    setExporting(true)
    setExportError('')
    try {
      const filter = currentFilter()
      const full = await loadAllAccountingDiaryPages(client, targetOrg, filter, controller.signal)
      if (seq !== requestSeq.current || activeOrgRef.current !== targetOrg || controller.signal.aborted) {
        return
      }

      const planLabel = full.summary.plans.length
        ? full.summary.plans.map(p => `${p.name} (${p.valid_from.slice(0, 7)} a ${p.valid_to.slice(0, 7)})`).join('; ')
        : 'Sem plano publicado vigente'

      const totalDebit = Number(toCentsStrict(full.summary.total_debit)) / 100
      const totalCredit = Number(toCentsStrict(full.summary.total_credit)) / 100
      const filterText = [
        `Base: ${filter.dateBasis === 'event_date' ? 'Data do evento' : 'Competência'}`,
        filter.eventType ? `Evento: ${DIARY_EVENT_LABELS[filter.eventType] ?? filter.eventType}` : null,
        filter.accountId ? `Conta ID: ${filter.accountId}` : null,
        filter.onlyReversals ? 'Somente estornos/retificações' : null,
      ]
        .filter(Boolean)
        .join(' | ')

      const book = {
        title: 'Diário Contábil Auxiliar (Partidas Dobradas)',
        bookType: 'DIARIO' as const,
        organizationId: targetOrg,
        periodLabel: `${formatDate(filter.fromDate)} a ${formatDate(filter.toDate)}`,
        planMetadata: planLabel,
        filters: filterText,
        expectedTotalCount: full.summary.total_count,
        integralOk: full.summary.integral_ok,
        incompleteReasons: full.summary.incomplete_reasons,
        reconciledTotals: [
          { label: 'Total de Partidas', value: full.summary.total_count },
          { label: 'Total a Débito', value: totalDebit },
          { label: 'Total a Crédito', value: totalCredit },
          { label: 'Registros Legados (non-posting)', value: full.summary.legacy_non_posting_count },
        ],
        nonFiscalNotice: NON_FISCAL_DIARY_NOTICE,
        headers: [
          'Seq',
          'Data Fato',
          'Competência',
          'Evento',
          'Conta Débito',
          'Conta Crédito',
          'Valor (R$)',
          'Origem / Fato',
          'Ref. Estorno/Correção',
          'Histórico / Motivo',
        ],
        rows: full.entries.map(row => [
          row.entry_seq,
          formatDate(row.event_date),
          formatCompetence(row.accounting_period),
          DIARY_EVENT_LABELS[row.event_type] ?? row.event_type,
          row.debit_account_code ? `${row.debit_account_code} — ${row.debit_account_description}` : `Pendente (${row.debit_role})`,
          row.credit_account_code ? `${row.credit_account_code} — ${row.credit_account_description}` : `Pendente (${row.credit_role})`,
          Number(toCentsStrict(row.amount)) / 100,
          `${row.source_table}:${row.source_id.slice(0, 8)}`,
          row.reference_event_id ? row.reference_event_id.slice(0, 8) : '-',
          row.reason ? `${row.description} — ${row.reason}` : row.description,
        ]),
      }

      if (format === 'XLSX') {
        const blob = await createIntegralBookWorkbook(book)
        if (seq !== requestSeq.current || activeOrgRef.current !== targetOrg || controller.signal.aborted) return
        downloadReport(blob, `diario-contabil-${targetOrg.slice(0, 8)}-${filter.fromDate}-a-${filter.toDate}.xlsx`)
      } else {
        printIntegralBookReport(book)
      }
    } catch (cause) {
      if (seq !== requestSeq.current || activeOrgRef.current !== targetOrg || controller.signal.aborted) return
      const classified = classifyDiaryReadError(cause, controller.signal)
      setExportError(classified.userMessage || 'Não foi possível gerar a exportação integral do Diário.')
    } finally {
      if (seq === requestSeq.current) setExporting(false)
    }
  }

  const totalPages = summary ? Math.max(1, Math.ceil(summary.total_count / UI_PAGE_SIZE)) : 1
  const showDiagnostics = diagnostics.length > 0 && (Boolean(error) || diagnostics.some(d => d.retried))

  return (
    <section className="panel" aria-label="Diário Contábil por Partidas Dobradas">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3>Diário Contábil (Partidas Dobradas)</h3>
          <p className="subtle">{NON_FISCAL_DIARY_NOTICE}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            disabled={!canExport}
            onClick={() => void handleIntegralExport('XLSX')}
          >
            <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Exportar Diário Integral (XLSX)
          </button>
          <button
            type="button"
            className="quiet"
            disabled={!canExport}
            onClick={() => void handleIntegralExport('PDF')}
          >
            <Printer size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Imprimir / PDF Integral
          </button>
        </div>
      </div>

      <form aria-label="Filtros do Diário Contábil" onSubmit={handleSubmit} style={{ margin: '1rem 0' }}>
        <fieldset disabled={loading}>
          <div className="member-form-grid">
            <div>
              <label htmlFor="diary-basis">Critério de período</label>
              <select id="diary-basis" value={dateBasis} onChange={e => setDateBasis(e.target.value as DiaryDateBasis)}>
                <option value="event_date">Data do evento</option>
                <option value="competence">Competência contábil</option>
              </select>
            </div>
            <div>
              <label htmlFor="diary-from">Data inicial</label>
              <input id="diary-from" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="diary-to">Data final</label>
              <input id="diary-to" type="date" value={toDate} onChange={e => setToDate(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="diary-event-type">Tipo de evento</label>
              <select id="diary-event-type" value={eventType} onChange={e => setEventType(e.target.value)}>
                <option value="">Todos os eventos</option>
                {Object.entries(DIARY_EVENT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="diary-account">Conta contábil</label>
              <select id="diary-account" value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">Todas as contas</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.description}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.25rem' }}>
              <input
                id="diary-reversals"
                type="checkbox"
                checked={onlyReversals}
                onChange={e => setOnlyReversals(e.target.checked)}
              />
              <label htmlFor="diary-reversals">Somente estornos e retificações</label>
            </div>
          </div>
          <button type="submit" className="primary">
            {loading ? 'Consultando Diário…' : 'Consultar Diário'}
          </button>
        </fieldset>
      </form>

      {error && <p role="alert" className="message error">{error}</p>}
      {retryNotice && <p role="status" className="message">{retryNotice}</p>}
      {isFilterDirty && (
        <p role="status" className="message warning">
          Os filtros foram alterados após a última consulta. Clique em &ldquo;Consultar Diário&rdquo; para atualizar os dados antes de exportar.
        </p>
      )}
      {showDiagnostics && (
        <div
          data-testid="diary-rpc-diagnostics"
          className="panel"
          style={{ marginTop: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}
        >
          <strong>Diagnóstico sanitizado das consultas RPC:</strong>
          <ul style={{ margin: '0.35rem 0 0 1.25rem' }}>
            {diagnostics.map(diag => (
              <li key={diag.rpc}>
                <code>{DIARY_RPC_LABELS[diag.rpc]}</code> — {DIARY_CATEGORY_LABELS[diag.category]} · {diag.durationMs} ms ·{' '}
                {diag.attempts} tentativa(s){diag.retried ? ' (recuperação automática em 1 retry)' : ''}
                {diag.httpStatus ? ` · HTTP ${diag.httpStatus}` : ''}
                {diag.requestId ? ` · req_id=${diag.requestId}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {exportError && <p role="alert" className="message error">{exportError}</p>}
      {exporting && <p role="status">Carregando universo completo para exportação integral do Diário…</p>}

      {summary && (
        <div style={{ marginTop: '1rem' }}>
          {!summary.integral_ok && (
            <div role="alert" className="message warning" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <ShieldAlert size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Selo Integral bloqueado neste período:</strong>
                <ul style={{ margin: '0.25rem 0 0 1.25rem' }}>
                  {summary.incomplete_reasons.map(reasonCode => (
                    <li key={reasonCode}>{INCOMPLETE_REASON_LABELS[reasonCode] ?? reasonCode}</li>
                  ))}
                  {summary.unmapped_count > 0 && (
                    <li>{summary.unmapped_count} lançamento(s) aguardando mapeamento contábil explícito.</li>
                  )}
                  {summary.legacy_non_posting_count > 0 && (
                    <li>{summary.legacy_non_posting_count} registro(s) legado(s) destacado(s) como non-posting.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="panel metric">
              <p className="eyebrow">Partidas no universo</p>
              <strong>{summary.total_count}</strong>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Total a Débito</p>
              <strong>{formatMoney(Number(toCentsStrict(summary.total_debit)) / 100)}</strong>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Total a Crédito</p>
              <strong>{formatMoney(Number(toCentsStrict(summary.total_credit)) / 100)}</strong>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Conferência / Selo</p>
              <strong>{summary.integral_ok ? 'Equilibrado e Integral' : 'Pendência contábil'}</strong>
            </div>
          </div>
        </div>
      )}

      {entries && !loading && (
        !entries.length ? (
          <p className="empty">Nenhuma partida registrada para os filtros consultados.</p>
        ) : (
          <>
            <div className="finance-table" role="region" aria-label="Lançamentos do Diário Contábil" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Seq</th>
                    <th>Data</th>
                    <th>Competência</th>
                    <th>Evento</th>
                    <th>Conta Débito</th>
                    <th>Conta Crédito</th>
                    <th>Valor</th>
                    <th>Fato de Origem / Vínculo</th>
                    <th>Histórico / Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(row => (
                    <tr key={row.entry_id}>
                      <td>{row.entry_seq}</td>
                      <td>{formatDate(row.event_date)}</td>
                      <td>{formatCompetence(row.accounting_period)}</td>
                      <td>
                        <span>{DIARY_EVENT_LABELS[row.event_type] ?? row.event_type}</span>
                        {row.is_reversal_or_correction && (
                          <span className="pill warning" style={{ marginLeft: '0.35rem' }}>Estorno/Retificação</span>
                        )}
                      </td>
                      <td>
                        {row.debit_account_code ? (
                          `${row.debit_account_code} — ${row.debit_account_description}`
                        ) : (
                          <span className="pill error">Sem conta ({row.debit_role})</span>
                        )}
                      </td>
                      <td>
                        {row.credit_account_code ? (
                          `${row.credit_account_code} — ${row.credit_account_description}`
                        ) : (
                          <span className="pill error">Sem conta ({row.credit_role})</span>
                        )}
                      </td>
                      <td><strong>{formatMoney(Number(toCentsStrict(row.amount)) / 100)}</strong></td>
                      <td>
                        <code>{row.source_table}:{row.source_id.slice(0, 8)}</code>
                        {row.reference_event_id && (
                          <div className="subtle">Ref.: <code>{row.reference_event_id.slice(0, 8)}</code></div>
                        )}
                      </td>
                      <td>
                        {row.description}
                        {row.reason && <div className="subtle">Motivo: {row.reason}</div>}
                        {row.mapping_gap_reason && <div className="message error">{row.mapping_gap_reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary"
                disabled={page === 0 || loading}
                onClick={() => void runQuery(Math.max(0, page - 1))}
              >
                Página anterior
              </button>
              <span className="subtle">Página {page + 1} de {totalPages}</span>
              <button
                type="button"
                className="secondary"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => void runQuery(page + 1)}
              >
                Próxima página
              </button>
            </div>
          </>
        )
      )}
    </section>
  )
}

