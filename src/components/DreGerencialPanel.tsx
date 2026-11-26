import { useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download, Printer, ShieldAlert } from 'lucide-react'
import { formatCompetence, formatMoney } from '../lib/finance-data'
import { INCOMPLETE_REASON_LABELS } from '../lib/accounting-books'
import {
  formatVariationPercent,
  loadDreGerencialReport,
  safeDreValue,
  type DreGerencialAccount,
  type DreGerencialReport,
  type DreSection,
} from '../lib/dre-report'
import {
  createIntegralBookWorkbook,
  downloadReport,
  printIntegralBookReport,
} from '../lib/report-export'

const SECTION_ORDER: Array<{ key: DreSection; title: string }> = [
  { key: 'gross_revenue', title: '1. Receitas Brutas' },
  { key: 'deductions', title: '2. (-) Deduções da Receita' },
  { key: 'cost', title: '3. (-) Custos' },
  { key: 'operational_expense', title: '4. (-) Despesas Operacionais' },
  { key: 'financial_result', title: '5. (+/-) Resultado Financeiro' },
]

function currentMonthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function DreGerencialPanel({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const defaultMonth = currentMonthIso()
  const [fromMonth, setFromMonth] = useState(defaultMonth)
  const [toMonth, setToMonth] = useState(defaultMonth)
  const [showZeroAccounts, setShowZeroAccounts] = useState(true)
  const [report, setReport] = useState<DreGerencialReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const requestSeq = useRef(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    setExportError('')
    setReport(null)
    try {
      const data = await loadDreGerencialReport(client, organizationId, fromMonth, toMonth)
      if (seq !== requestSeq.current) return
      setReport(data)
    } catch (cause) {
      if (seq !== requestSeq.current) return
      const code = (cause as { code?: string } | null)?.code
      setError(
        code === '42501' || code === '28000'
          ? 'Seu perfil não possui permissão para consultar a DRE Gerencial desta Loja.'
          : (cause as Error)?.message || 'Não foi possível carregar a DRE Gerencial neste período.',
      )
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }

  async function handleExport(format: 'XLSX' | 'PDF') {
    if (!report || exporting) return
    const seq = requestSeq.current
    setExporting(true)
    setExportError('')
    try {
      const visibleAccounts = showZeroAccounts
        ? report.accounts
        : report.accounts.filter(a => safeDreValue(a.amount) !== 0)

      const planLabel = report.plans.length
        ? report.plans.map(p => `${p.name} (${p.valid_from.slice(0, 7)} a ${p.valid_to.slice(0, 7)})`).join('; ')
        : 'Nenhum plano publicado no período'

      const book = {
        title: 'DRE Gerencial Estruturada por Competência',
        bookType: 'DRE_GERENCIAL' as const,
        organizationId,
        periodLabel: `${formatCompetence(report.from_period)} a ${formatCompetence(report.to_period)}`,
        planMetadata: planLabel,
        filters: `Contas zeradas: ${showZeroAccounts ? 'Exibidas' : 'Ocultas'}`,
        expectedTotalCount: visibleAccounts.length,
        integralOk: report.integral_ok,
        incompleteReasons: report.incomplete_reasons,
        reconciledTotals: [
          { label: 'Receitas Brutas', value: safeDreValue(report.waterfall.gross_revenue) },
          { label: '(-) Deduções da Receita', value: safeDreValue(report.waterfall.deductions) },
          { label: 'Receitas Líquidas', value: safeDreValue(report.waterfall.net_revenue) },
          { label: '(-) Custos', value: safeDreValue(report.waterfall.costs) },
          { label: 'Resultado Bruto', value: safeDreValue(report.waterfall.gross_result) },
          { label: '(-) Despesas Operacionais', value: safeDreValue(report.waterfall.operational_expenses) },
          { label: 'Resultado Operacional', value: safeDreValue(report.waterfall.operating_result) },
          { label: '(+/-) Resultado Financeiro', value: safeDreValue(report.waterfall.financial_result) },
          { label: 'Superávit / Déficit Gerencial', value: safeDreValue(report.waterfall.net_result) },
        ],
        nonFiscalNotice: report.official_disclaimer,
        headers: [
          'Seção DRE',
          'Código',
          'Conta Contábil',
          'Classificação',
          'Período Atual (R$)',
          'Período Anterior (R$)',
          'Mesmo Período Ano Ant. (R$)',
        ],
        rows: visibleAccounts.map((acc: DreGerencialAccount) => [
          SECTION_ORDER.find(s => s.key === acc.dre_section)?.title ?? acc.dre_section,
          acc.account_code,
          acc.account_description,
          acc.operational_classification ?? '-',
          safeDreValue(acc.amount),
          safeDreValue(acc.prior_period_amount),
          safeDreValue(acc.prior_year_amount),
        ]),
      }

      if (format === 'XLSX') {
        const blob = await createIntegralBookWorkbook(book)
        if (seq !== requestSeq.current) return
        downloadReport(blob, `dre-gerencial-${fromMonth}-a-${toMonth}.xlsx`)
      } else {
        printIntegralBookReport(book)
      }
    } catch (cause) {
      if (seq !== requestSeq.current) return
      setExportError((cause as Error)?.message || 'Não foi possível exportar a DRE Gerencial.')
    } finally {
      if (seq === requestSeq.current) setExporting(false)
    }
  }

  const waterfallRows = report
    ? [
        { label: 'Receitas Brutas', key: 'gross_revenue' as const, highlight: false },
        { label: '(-) Deduções da Receita', key: 'deductions' as const, highlight: false },
        { label: '(=) Receitas Líquidas', key: 'net_revenue' as const, highlight: true },
        { label: '(-) Custos', key: 'costs' as const, highlight: false },
        { label: '(=) Resultado Bruto', key: 'gross_result' as const, highlight: true },
        { label: '(-) Despesas Operacionais', key: 'operational_expenses' as const, highlight: false },
        { label: '(=) Resultado Operacional', key: 'operating_result' as const, highlight: true },
        { label: '(+/-) Resultado Financeiro', key: 'financial_result' as const, highlight: false },
        { label: '(=) Superávit / Déficit Gerencial', key: 'net_result' as const, highlight: true },
      ]
    : []

  return (
    <section className="panel" aria-label="DRE Gerencial Estruturada">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3>DRE Gerencial Estruturada (Competência)</h3>
          <p className="subtle">
            DRE Gerencial — visão gerencial por competência para apoio à Loja. Não substitui a DRE contábil oficial elaborada pelo contador.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            disabled={!report || !report.integral_ok || exporting || loading}
            onClick={() => void handleExport('XLSX')}
          >
            <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Exportar DRE Integral (XLSX)
          </button>
          <button
            type="button"
            className="quiet"
            disabled={!report || !report.integral_ok || exporting || loading}
            onClick={() => void handleExport('PDF')}
          >
            <Printer size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} />
            Imprimir / PDF Integral
          </button>
        </div>
      </div>

      <form aria-label="Consultar DRE Gerencial Estruturada" onSubmit={handleSubmit} style={{ margin: '1rem 0' }}>
        <fieldset disabled={loading}>
          <div className="member-form-grid">
            <div>
              <label htmlFor="dre-struct-from">Competência inicial</label>
              <input id="dre-struct-from" type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="dre-struct-to">Competência final</label>
              <input id="dre-struct-to" type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.25rem' }}>
              <input
                id="dre-show-zero"
                type="checkbox"
                checked={showZeroAccounts}
                onChange={e => setShowZeroAccounts(e.target.checked)}
              />
              <label htmlFor="dre-show-zero">Exibir contas analíticas zeradas do plano vigente</label>
            </div>
          </div>
          <button type="submit" className="primary">
            {loading ? 'Consultando DRE Gerencial…' : 'Gerar DRE Gerencial'}
          </button>
        </fieldset>
      </form>

      {error && <p role="alert" className="message error">{error}</p>}
      {exportError && <p role="alert" className="message error">{exportError}</p>}

      {report && !loading && (
        <>
          <div className="subtle" style={{ marginBottom: '0.75rem' }}>
            <strong>Planos publicados vigentes:</strong>{' '}
            {report.plans.length
              ? report.plans.map(p => `${p.name} (${p.valid_from.slice(0, 7)} a ${p.valid_to.slice(0, 7)})`).join(', ')
              : 'Nenhum plano publicado no período'}
          </div>

          {!report.integral_ok && (
            <div role="alert" className="message warning" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <ShieldAlert size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Selo Integral da DRE bloqueado:</strong>
                <ul style={{ margin: '0.25rem 0 0 1.25rem' }}>
                  {report.incomplete_reasons.map(reasonCode => (
                    <li key={reasonCode}>{INCOMPLETE_REASON_LABELS[reasonCode] ?? reasonCode}</li>
                  ))}
                  {report.unmapped_count > 0 && (
                    <li>{report.unmapped_count} lançamento(s) no período sem mapeamento contábil completo.</li>
                  )}
                  {report.legacy_non_posting_count > 0 && (
                    <li>{report.legacy_non_posting_count} registro(s) legado(s) destacado(s) como non-posting.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <h4>Resumo em Cascata Gerencial</h4>
          <div className="finance-table" role="region" aria-label="Cascata da DRE Gerencial" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Rubrica</th>
                  <th>Período Atual</th>
                  <th>% Receita Líquida</th>
                  <th>Período Anterior</th>
                  <th>Var. Mensal</th>
                  <th>Mesmo Período Ano Ant.</th>
                  <th>Var. Anual</th>
                </tr>
              </thead>
              <tbody>
                {waterfallRows.map(row => {
                  const val = safeDreValue(report.waterfall[row.key])
                  const netRev = safeDreValue(report.waterfall.net_revenue)
                  const pctNet = netRev === 0 ? 'N/A' : `${((val / Math.abs(netRev)) * 100).toFixed(1).replace('.', ',')}%`
                  const prevVal = report.prior_period_waterfall ? safeDreValue(report.prior_period_waterfall[row.key]) : null
                  const yoyVal = report.prior_year_waterfall ? safeDreValue(report.prior_year_waterfall[row.key]) : null
                  return (
                    <tr key={row.key}>
                      <td>{row.highlight ? <strong>{row.label}</strong> : row.label}</td>
                      <td>{row.highlight ? <strong>{formatMoney(val)}</strong> : formatMoney(val)}</td>
                      <td>{pctNet}</td>
                      <td>{prevVal === null ? 'Sem dados no servidor' : formatMoney(prevVal)}</td>
                      <td>{prevVal === null ? '-' : formatVariationPercent(val, prevVal)}</td>
                      <td>{yoyVal === null ? 'Sem dados no servidor' : formatMoney(yoyVal)}</td>
                      <td>{yoyVal === null ? '-' : formatVariationPercent(val, yoyVal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginTop: '1.5rem' }}>Detalhamento Analítico por Seção</h4>
          <div className="finance-table" role="region" aria-label="Contas analíticas da DRE Gerencial" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Seção</th>
                  <th>Código</th>
                  <th>Conta Contábil</th>
                  <th>Atual</th>
                  <th>Período Ant.</th>
                  <th>Ano Ant.</th>
                </tr>
              </thead>
              <tbody>
                {report.accounts
                  .filter(acc => showZeroAccounts || safeDreValue(acc.amount) !== 0)
                  .map(acc => (
                    <tr key={`${acc.accounting_plan_id}:${acc.accounting_account_id}`}>
                      <td>{SECTION_ORDER.find(s => s.key === acc.dre_section)?.title ?? acc.dre_section}</td>
                      <td><code>{acc.account_code}</code></td>
                      <td>{acc.account_description}</td>
                      <td>{formatMoney(safeDreValue(acc.amount))}</td>
                      <td>{report.has_prior_period_data ? formatMoney(safeDreValue(acc.prior_period_amount)) : 'Sem dados'}</td>
                      <td>{report.has_prior_year_data ? formatMoney(safeDreValue(acc.prior_year_amount)) : 'Sem dados'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
