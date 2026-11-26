import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, Printer, ShieldAlert } from 'lucide-react'
import { formatDate, formatMoney, formatCompetence } from '../lib/finance-data'
import { loadAccountingCatalog, loadAccountingDetail, type Account, type Plan } from '../lib/accounting-plans'
import {
  DIARY_EVENT_LABELS,
  INCOMPLETE_REASON_LABELS,
  loadAccountingLedgerPage,
  loadAllAccountingLedgerPages,
  toCentsStrict,
  type DiaryDateBasis,
  type LedgerReport,
} from '../lib/accounting-books'
import {
  createIntegralBookWorkbook,
  downloadReport,
  printIntegralBookReport,
} from '../lib/report-export'

const UI_PAGE_SIZE = 100
const NON_FISCAL_LEDGER_NOTICE =
  'Razão Gerencial auxiliar por conta contábil. Não substitui livro razão fiscal autenticado nem escrituração oficial assinada pelo contador.'

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

export function AccountingLedger({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const defaults = defaultDateRange()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [dateBasis, setDateBasis] = useState<DiaryDateBasis>('event_date')
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)

  const [ledger, setLedger] = useState<LedgerReport | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')

  const requestSeq = useRef(0)
  const exportAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    let live = true
    setPlans([])
    setSelectedPlanId('')
    setAccounts([])
    setSelectedAccountId('')
    setLedger(null)
    setError('')
    setExportError('')
    requestSeq.current += 1
    exportAbort.current?.abort()

    loadAccountingCatalog(client, organizationId, abort.signal)
      .then(cat => {
        if (!live) return
        setPlans(cat.plans)
        const preferred = cat.plans.find(p => p.status === 'published') ?? cat.plans[0]
        setSelectedPlanId(preferred?.id ?? '')
      })
      .catch(() => {
        if (live) setError('Não foi possível carregar os planos contábeis desta Loja.')
      })

    return () => {
      live = false
      abort.abort()
    }
  }, [client, organizationId])

  useEffect(() => {
    if (!selectedPlanId) return
    const abort = new AbortController()
    let live = true
    setAccounts([])
    setSelectedAccountId('')
    setLedger(null)

    loadAccountingDetail(client, organizationId, selectedPlanId, abort.signal)
      .then(detail => {
        if (!live) return
        const analytic = detail.accounts.filter(a => a.row_type === 'analytic')
        setAccounts(analytic)
        setSelectedAccountId(analytic[0]?.id ?? '')
      })
      .catch(() => {
        if (live) setError('Não foi possível carregar as contas analíticas do plano.')
      })

    return () => {
      live = false
      abort.abort()
    }
  }, [client, organizationId, selectedPlanId])

  useEffect(() => {
    return () => {
      exportAbort.current?.abort()
    }
  }, [organizationId])

  async function runQuery(targetPage: number) {
    if (!selectedAccountId) {
      setError('Selecione uma conta contábil analítica para consultar o Razão.')
      return
    }
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    setExportError('')
    try {
      const res = await loadAccountingLedgerPage(
        client,
        organizationId,
        selectedAccountId,
        fromDate,
        toDate,
        dateBasis,
        targetPage,
        UI_PAGE_SIZE,
      )
      if (seq !== requestSeq.current) return
      setLedger(res)
      setPage(targetPage)
    } catch (cause) {
      if (seq !== requestSeq.current) return
      const code = (cause as { code?: string } | null)?.code
      setLedger(null)
      setError(
        code === '42501' || code === '28000'
          ? 'Seu perfil não possui permissão para consultar o Razão Contábil desta Loja.'
          : (cause as Error)?.message || 'Não foi possível consultar o Razão Contábil.',
      )
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    void runQuery(0)
  }

  async function handleIntegralExport(format: 'XLSX' | 'PDF') {
    if (!ledger || exporting) return
    exportAbort.current?.abort()
    const controller = new AbortController()
    exportAbort.current = controller
    const seq = requestSeq.current
    setExporting(true)
    setExportError('')
    try {
      const full = await loadAllAccountingLedgerPages(
        client,
        organizationId,
        ledger.account.id,
        fromDate,
        toDate,
        dateBasis,
        controller.signal,
      )
      if (seq !== requestSeq.current) return

      const openingVal = Number(toCentsStrict(full.opening_balance)) / 100
      const debitVal = Number(toCentsStrict(full.period_debit_total)) / 100
      const creditVal = Number(toCentsStrict(full.period_credit_total)) / 100
      const closingVal = Number(toCentsStrict(full.closing_balance)) / 100

      const book = {
        title: `Razão Contábil — ${full.account.code} ${full.account.description}`,
        bookType: 'RAZAO' as const,
        organizationId,
        periodLabel: `${formatDate(full.from_date)} a ${formatDate(full.to_date)}`,
        planMetadata: `${full.plan.name} (${full.plan.status === 'published' ? 'Publicado' : 'Rascunho'} — ${full.plan.valid_from.slice(0, 7)} a ${full.plan.valid_to.slice(0, 7)})`,
        filters: `Conta: ${full.account.code} — ${full.account.description} | Base: ${dateBasis === 'event_date' ? 'Data do evento' : 'Competência'}`,
        expectedTotalCount: full.total_count,
        integralOk: full.integral_ok,
        incompleteReasons: full.incomplete_reasons,
        reconciledTotals: [
          {
            label: `Saldo Inicial (${full.opening_balance_source === 'prior_entries' ? 'partidas anteriores' : 'sem movimento anterior'})`,
            value: `${formatMoney(Math.abs(openingVal))} ${full.opening_balance_dc}`,
          },
          { label: 'Total a Débito no Período', value: debitVal },
          { label: 'Total a Crédito no Período', value: creditVal },
          { label: 'Saldo Final Conciliado', value: `${formatMoney(Math.abs(closingVal))} ${full.closing_balance_dc}` },
          { label: 'Conciliação Diário ↔ Razão', value: full.reconciles_with_diary ? 'SIM (Centavo exato)' : 'DIVERGENTE' },
        ],
        nonFiscalNotice: NON_FISCAL_LEDGER_NOTICE,
        headers: [
          'Seq',
          'Data Fato',
          'Competência',
          'Evento',
          'Contrapartida',
          'Origem / Vínculo',
          'Histórico / Motivo',
          'Débito (R$)',
          'Crédito (R$)',
          'Saldo Acumulado',
        ],
        rows: full.entries.map(row => {
          const runAbs = Math.abs(Number(toCentsStrict(row.running_balance)) / 100)
          return [
            row.entry_seq,
            formatDate(row.event_date),
            formatCompetence(row.accounting_period),
            DIARY_EVENT_LABELS[row.event_type] ?? row.event_type,
            row.counterpart_code ? `${row.counterpart_code} — ${row.counterpart_description}` : 'Contrapartida pendente',
            row.reference_event_id
              ? `${row.source_table}:${row.source_id.slice(0, 8)} (Ref ${row.reference_event_id.slice(0, 8)})`
              : `${row.source_table}:${row.source_id.slice(0, 8)}`,
            row.reason ? `${row.description} — ${row.reason}` : row.description,
            Number(toCentsStrict(row.debit_amount)) / 100,
            Number(toCentsStrict(row.credit_amount)) / 100,
            `${formatMoney(runAbs)} ${row.balance_dc}`,
          ]
        }),
      }

      if (format === 'XLSX') {
        const blob = await createIntegralBookWorkbook(book)
        if (seq !== requestSeq.current) return
        downloadReport(blob, `razao-${full.account.code}-${full.from_date}-a-${full.to_date}.xlsx`)
      } else {
        printIntegralBookReport(book)
      }
    } catch (cause) {
      if (seq !== requestSeq.current) return
      setExportError((cause as Error)?.message || 'Não foi possível gerar a exportação integral do Razão.')
    } finally {
      if (seq === requestSeq.current) setExporting(false)
    }
  }

  const totalPages = ledger ? Math.max(1, Math.ceil(ledger.total_count / UI_PAGE_SIZE)) : 1

  return (
    <section className="panel" aria-label="Razão Contábil por Conta">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3>Razão Contábil Analítico por Conta</h3>
          <p className="subtle">{NON_FISCAL_LEDGER_NOTICE}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            disabled={!ledger || !ledger.integral_ok || exporting || loading}
            onClick={() => void handleIntegralExport('XLSX')}
          >
            <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Exportar Razão Integral (XLSX)
          </button>
          <button
            type="button"
            className="quiet"
            disabled={!ledger || !ledger.integral_ok || exporting || loading}
            onClick={() => void handleIntegralExport('PDF')}
          >
            <Printer size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Imprimir / PDF Integral
          </button>
        </div>
      </div>

      <form aria-label="Filtros do Razão Contábil" onSubmit={handleSubmit} style={{ margin: '1rem 0' }}>
        <fieldset disabled={loading}>
          <div className="member-form-grid">
            <div>
              <label htmlFor="ledger-plan">Plano contábil</label>
              <select id="ledger-plan" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}>
                {!plans.length && <option value="">Nenhum plano cadastrado</option>}
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.status === 'published' ? 'Publicado' : 'Rascunho'} ({p.valid_from.slice(0, 7)} a {p.valid_to.slice(0, 7)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ledger-account">Conta contábil analítica</label>
              <select
                id="ledger-account"
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                required
              >
                {!accounts.length && <option value="">Nenhuma conta analítica</option>}
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ledger-basis">Critério de período</label>
              <select id="ledger-basis" value={dateBasis} onChange={e => setDateBasis(e.target.value as DiaryDateBasis)}>
                <option value="event_date">Data do evento</option>
                <option value="competence">Competência contábil</option>
              </select>
            </div>
            <div>
              <label htmlFor="ledger-from">Data inicial</label>
              <input id="ledger-from" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="ledger-to">Data final</label>
              <input id="ledger-to" type="date" value={toDate} onChange={e => setToDate(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="primary" disabled={!selectedAccountId}>
            {loading ? 'Consultando Razão…' : 'Consultar Razão'}
          </button>
        </fieldset>
      </form>

      {error && <p role="alert" className="message error">{error}</p>}
      {exportError && <p role="alert" className="message error">{exportError}</p>}
      {exporting && <p role="status">Carregando movimentos completos para exportação integral do Razão…</p>}

      {ledger && !loading && (
        <>
          {!ledger.integral_ok && (
            <div role="alert" className="message warning" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <ShieldAlert size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Selo Integral bloqueado neste período:</strong>
                <ul style={{ margin: '0.25rem 0 0 1.25rem' }}>
                  {ledger.incomplete_reasons.map(reasonCode => (
                    <li key={reasonCode}>{INCOMPLETE_REASON_LABELS[reasonCode] ?? reasonCode}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="panel metric">
              <p className="eyebrow">Saldo de Abertura</p>
              <strong>
                {formatMoney(Math.abs(Number(toCentsStrict(ledger.opening_balance)) / 100))} {ledger.opening_balance_dc}
              </strong>
              <span className="subtle">
                {ledger.opening_balance_source === 'prior_entries'
                  ? 'Derivado de partidas anteriores registradas'
                  : 'Sem partidas anteriores no histórico (zero)'}
              </span>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Total Débitos</p>
              <strong>{formatMoney(Number(toCentsStrict(ledger.period_debit_total)) / 100)}</strong>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Total Créditos</p>
              <strong>{formatMoney(Number(toCentsStrict(ledger.period_credit_total)) / 100)}</strong>
            </div>
            <div className="panel metric">
              <p className="eyebrow">Saldo Final</p>
              <strong>
                {formatMoney(Math.abs(Number(toCentsStrict(ledger.closing_balance)) / 100))} {ledger.closing_balance_dc}
              </strong>
              <span className="subtle">
                {ledger.reconciles_with_diary ? 'Conciliado com o Diário' : 'Divergência com Diário'}
              </span>
            </div>
          </div>

          {!ledger.entries.length ? (
            <p className="empty">Nenhum movimento nesta conta contábil para o intervalo selecionado.</p>
          ) : (
            <>
              <div className="finance-table" role="region" aria-label="Movimentos do Razão Contábil" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Seq</th>
                      <th>Data</th>
                      <th>Competência</th>
                      <th>Evento</th>
                      <th>Contrapartida</th>
                      <th>Histórico / Motivo</th>
                      <th>Débito</th>
                      <th>Crédito</th>
                      <th>Saldo Corrente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.map(row => {
                      const d = Number(toCentsStrict(row.debit_amount)) / 100
                      const c = Number(toCentsStrict(row.credit_amount)) / 100
                      const runAbs = Math.abs(Number(toCentsStrict(row.running_balance)) / 100)
                      return (
                        <tr key={row.entry_id}>
                          <td>{row.entry_seq}</td>
                          <td>{formatDate(row.event_date)}</td>
                          <td>{formatCompetence(row.accounting_period)}</td>
                          <td>
                            {DIARY_EVENT_LABELS[row.event_type] ?? row.event_type}
                            {row.is_reversal_or_correction && (
                              <span className="pill warning" style={{ marginLeft: '0.35rem' }}>Estorno/Retificação</span>
                            )}
                          </td>
                          <td>
                            {row.counterpart_code
                              ? `${row.counterpart_code} — ${row.counterpart_description}`
                              : 'Contrapartida pendente'}
                          </td>
                          <td>
                            {row.description}
                            {row.reason && <div className="subtle">Motivo: {row.reason}</div>}
                            <div className="subtle"><code>{row.source_table}:{row.source_id.slice(0, 8)}</code></div>
                          </td>
                          <td>{d > 0 ? formatMoney(d) : '-'}</td>
                          <td>{c > 0 ? formatMoney(c) : '-'}</td>
                          <td><strong>{formatMoney(runAbs)} {row.balance_dc}</strong></td>
                        </tr>
                      )
                    })}
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
          )}
        </>
      )}
    </section>
  )
}
