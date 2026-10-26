import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FileText, Download, Info, Calendar } from 'lucide-react'
import { DelinquencyReport } from './DelinquencyReport'
import { DreView } from './DreView'
import { formatDate, formatMoney, formatCompetence, statusLabels } from '../lib/finance-data'

type ReportTab = 'posicao' | 'recebimentos' | 'inadimplencia' | 'fechamento' | 'contabil'

export function Relatorios({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<ReportTab>('posicao')

  // Common filters
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [reportCompetence, setReportCompetence] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Export Modal state for PDF / XLSX dependencies
  const [exportNotice, setExportNotice] = useState<{ format: 'PDF' | 'XLSX'; reportName: string } | null>(null)

  // Posição Geral state
  const [posicaoLoading, setPosicaoLoading] = useState(false)
  const [posicaoError, setPosicaoError] = useState('')
  const [posicaoData, setPosicaoData] = useState<{
    totalPayables: number
    totalPayablesOpen: number
    totalReceivables: number
    totalReceivablesOpen: number
    items: Array<{
      id: string
      type: 'Pagar' | 'Receber' | 'Integrante'
      description: string
      dueDate: string
      competence: string | null
      amount: number
      openAmount: number
      status: string
    }>
  } | null>(null)

  // Recebimentos state
  const [recebimentosLoading, setRecebimentosLoading] = useState(false)
  const [recebimentosError, setRecebimentosError] = useState('')
  const [recebimentosData, setRecebimentosData] = useState<{
    totalReceived: number
    items: Array<{
      id: string
      origin: string
      description: string
      dueDate: string
      competence: string | null
      amount: number
      openAmount: number
      status: string
    }>
  } | null>(null)

  // Plano de contas state
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState('')
  const [chartAccounts, setChartAccounts] = useState<Array<{
    account_code: string
    account_name: string
    account_type: string
    is_active: boolean
  }>>([])

  // Load Posição Geral
  useEffect(() => {
    if (activeTab !== 'posicao') return
    let live = true
    setPosicaoLoading(true)
    setPosicaoError('')

    async function loadPosicao() {
      try {
        let pQuery = client.from('v_institutional_payable_effective').select('*').eq('organization_id', organizationId)
        let rQuery = client.from('v_institutional_receivable_effective').select('*').eq('organization_id', organizationId)
        let cQuery = client.from('v_charge_balances').select('*').eq('organization_id', organizationId)

        if (reportStart) {
          pQuery = pQuery.gte('due_date', reportStart)
          rQuery = rQuery.gte('due_date', reportStart)
          cQuery = cQuery.gte('due_date', reportStart)
        }
        if (reportEnd) {
          pQuery = pQuery.lte('due_date', reportEnd)
          rQuery = rQuery.lte('due_date', reportEnd)
          cQuery = cQuery.lte('due_date', reportEnd)
        }

        const [pRes, rRes, cRes] = await Promise.all([
          pQuery.limit(50),
          rQuery.limit(50),
          cQuery.limit(50),
        ])

        if (pRes.error) throw pRes.error
        if (rRes.error) throw rRes.error
        if (cRes.error) throw cRes.error

        if (!live) return

        const payables = pRes.data ?? []
        const receivables = rRes.data ?? []
        const charges = cRes.data ?? []

        let totP = 0; let totPOpen = 0
        payables.forEach(p => {
          totP += Number(p.effective_amount || 0)
          totPOpen += Number(p.open_amount || 0)
        })

        let totR = 0; let totROpen = 0
        receivables.forEach(r => {
          totR += Number(r.effective_amount || 0)
          totROpen += Number(r.open_amount || 0)
        })
        charges.forEach(c => {
          totR += Number(c.effective_amount || 0)
          totROpen += Number(c.open_amount || 0)
        })

        const combinedItems: Array<{
          id: string
          type: 'Pagar' | 'Receber' | 'Integrante'
          description: string
          dueDate: string
          competence: string | null
          amount: number
          openAmount: number
          status: string
        }> = [
          ...payables.map(p => ({
            id: String(p.payable_id),
            type: 'Pagar' as const,
            description: String(p.description || 'Contas a pagar'),
            dueDate: String(p.due_date || ''),
            competence: p.competence ? String(p.competence) : null,
            amount: Number(p.effective_amount || 0),
            openAmount: Number(p.open_amount || 0),
            status: p.is_canceled ? 'cancelled' : String(p.approval_status || 'open'),
          })),
          ...receivables.map(r => ({
            id: String(r.receivable_id),
            type: 'Receber' as const,
            description: String(r.description || 'Receita institucional'),
            dueDate: String(r.due_date || ''),
            competence: r.competence ? String(r.competence) : null,
            amount: Number(r.effective_amount || 0),
            openAmount: Number(r.open_amount || 0),
            status: r.is_canceled ? 'cancelled' : 'posted',
          })),
          ...charges.map(c => ({
            id: String(c.charge_id),
            type: 'Integrante' as const,
            description: String(c.description || 'Cobrança de integrante'),
            dueDate: String(c.due_date || ''),
            competence: c.competence ? String(c.competence) : null,
            amount: Number(c.effective_amount || 0),
            openAmount: Number(c.open_amount || 0),
            status: c.is_cancelled ? 'cancelled' : String(c.settlement_status || 'open'),
          })),
        ].sort((a, b) => b.dueDate.localeCompare(a.dueDate))

        setPosicaoData({
          totalPayables: totP,
          totalPayablesOpen: totPOpen,
          totalReceivables: totR,
          totalReceivablesOpen: totROpen,
          items: combinedItems,
        })
      } catch {
        if (live) setPosicaoError('Não foi possível carregar a posição financeira.')
      } finally {
        if (live) setPosicaoLoading(false)
      }
    }

    void loadPosicao()
    return () => { live = false }
  }, [client, organizationId, activeTab, reportStart, reportEnd])

  // Load Recebimentos
  useEffect(() => {
    if (activeTab !== 'recebimentos') return
    let live = true
    setRecebimentosLoading(true)
    setRecebimentosError('')

    async function loadRecebimentos() {
      try {
        let cQuery = client.from('v_charge_balances').select('*').eq('organization_id', organizationId)
        let rQuery = client.from('v_institutional_receivable_effective').select('*').eq('organization_id', organizationId)

        if (reportStart) {
          cQuery = cQuery.gte('due_date', reportStart)
          rQuery = rQuery.gte('due_date', reportStart)
        }
        if (reportEnd) {
          cQuery = cQuery.lte('due_date', reportEnd)
          rQuery = rQuery.lte('due_date', reportEnd)
        }

        const [cRes, rRes] = await Promise.all([
          cQuery.limit(50),
          rQuery.limit(50),
        ])

        if (cRes.error) throw cRes.error
        if (rRes.error) throw rRes.error

        if (!live) return

        const charges = cRes.data ?? []
        const receivables = rRes.data ?? []

        let totalReceived = 0
        const items: Array<{
          id: string
          origin: string
          description: string
          dueDate: string
          competence: string | null
          amount: number
          openAmount: number
          status: string
        }> = []

        charges.forEach(c => {
          const effective = Number(c.effective_amount || 0)
          const open = Number(c.open_amount || 0)
          const received = Math.max(0, effective - open)
          if (received > 0 || c.settlement_status === 'paid' || c.settlement_status === 'settled') {
            totalReceived += received
            items.push({
              id: String(c.charge_id),
              origin: 'Integrante',
              description: String(c.description || 'Cobrança'),
              dueDate: String(c.due_date || ''),
              competence: c.competence ? String(c.competence) : null,
              amount: effective,
              openAmount: open,
              status: String(c.settlement_status || 'paid'),
            })
          }
        })

        receivables.forEach(r => {
          const effective = Number(r.effective_amount || 0)
          const open = Number(r.open_amount || 0)
          const received = Math.max(0, effective - open)
          if (received > 0 || open === 0) {
            totalReceived += received > 0 ? received : effective
            items.push({
              id: String(r.receivable_id),
              origin: 'Institucional',
              description: String(r.description || 'Receita'),
              dueDate: String(r.due_date || ''),
              competence: r.competence ? String(r.competence) : null,
              amount: effective,
              openAmount: open,
              status: 'posted',
            })
          }
        })

        setRecebimentosData({
          totalReceived,
          items: items.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
        })
      } catch {
        if (live) setRecebimentosError('Não foi possível carregar o relatório de recebimentos.')
      } finally {
        if (live) setRecebimentosLoading(false)
      }
    }

    void loadRecebimentos()
    return () => { live = false }
  }, [client, organizationId, activeTab, reportStart, reportEnd])

  // Load Plano de Contas / Contábil
  useEffect(() => {
    if (activeTab !== 'contabil') return
    let live = true
    setChartLoading(true)
    setChartError('')

    async function loadChart() {
      try {
        const { data, error } = await client
          .from('v_chart_of_accounts')
          .select('account_code, account_name, account_type, is_active')
          .eq('organization_id', organizationId)
          .order('account_code')

        if (error) throw error
        if (!live) return
        setChartAccounts(data ?? [])
      } catch {
        if (live) setChartError('Não foi possível carregar o plano de contas contábil.')
      } finally {
        if (live) setChartLoading(false)
      }
    }

    void loadChart()
    return () => { live = false }
  }, [client, organizationId, activeTab])

  // CSV Generator Helpers
  function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportPosicaoCsv() {
    if (!posicaoData) return
    let csv = 'ID;Tipo;Descrição;Vencimento;Competência;Valor Total;Saldo Aberto;Situação\n'
    posicaoData.items.forEach(item => {
      csv += `"${item.id}";"${item.type}";"${item.description.replace(/"/g, '""')}";"${formatDate(item.dueDate)}";"${formatCompetence(item.competence)}";"${item.amount.toFixed(2)}";"${item.openAmount.toFixed(2)}";"${statusLabels[item.status] ?? item.status}"\n`
    })
    downloadCsv(`posicao-financeira-${organizationId.slice(0, 8)}.csv`, csv)
  }

  function exportRecebimentosCsv() {
    if (!recebimentosData) return
    let csv = 'ID;Origem;Descrição;Vencimento;Competência;Valor Total;Saldo Aberto;Situação\n'
    recebimentosData.items.forEach(item => {
      csv += `"${item.id}";"${item.origin}";"${item.description.replace(/"/g, '""')}";"${formatDate(item.dueDate)}";"${formatCompetence(item.competence)}";"${item.amount.toFixed(2)}";"${item.openAmount.toFixed(2)}";"${statusLabels[item.status] ?? item.status}"\n`
    })
    downloadCsv(`recebimentos-${organizationId.slice(0, 8)}.csv`, csv)
  }

  function exportContabilCsv() {
    if (!chartAccounts.length) return
    let csv = 'Código da Conta;Nome da Conta;Tipo;Ativa\n'
    chartAccounts.forEach(acc => {
      csv += `"${acc.account_code}";"${acc.account_name.replace(/"/g, '""')}";"${acc.account_type}";"${acc.is_active ? 'Sim' : 'Não'}"\n`
    })
    downloadCsv(`plano-contas-${organizationId.slice(0, 8)}.csv`, csv)
  }

  function handleExtendedExportRequest(format: 'PDF' | 'XLSX', reportName: string) {
    setExportNotice({ format, reportName })
  }

  return (
    <div className="relatorios-view">
      <section className="panel">
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={24} aria-hidden="true" />
            <h2>Relatórios Gerenciais</h2>
          </div>
        </div>

        <p className="subtle">
          Relatórios financeiros consolidados e auditáveis da Loja. Todas as posições são sustentadas por dados reais do servidor.
        </p>

        {/* Global Filter Bar */}
        <div className="finance-filters" role="search" aria-label="Filtros de relatórios" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', margin: '1rem 0' }}>
          <div className="filter-group">
            <label htmlFor="reportStart" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Período de</label>
            <input
              id="reportStart"
              type="date"
              value={reportStart}
              onChange={e => setReportStart(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="reportEnd" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Período até</label>
            <input
              id="reportEnd"
              type="date"
              value={reportEnd}
              onChange={e => setReportEnd(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="reportCompetence" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Competência (AAAA-MM)</label>
            <input
              id="reportCompetence"
              type="month"
              value={reportCompetence}
              onChange={e => setReportCompetence(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() => { setReportStart(''); setReportEnd(''); setReportCompetence(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }) }}
          >
            Limpar filtros
          </button>
        </div>

        {/* Report Sub-Tabs Navigation */}
        <div className="tab-nav" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color, #ccc)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={activeTab === 'posicao' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'posicao'}
            onClick={() => setActiveTab('posicao')}
          >
            Posição Geral
          </button>
          <button
            type="button"
            className={activeTab === 'recebimentos' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'recebimentos'}
            onClick={() => setActiveTab('recebimentos')}
          >
            Recebimentos
          </button>
          <button
            type="button"
            className={activeTab === 'inadimplencia' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'inadimplencia'}
            onClick={() => setActiveTab('inadimplencia')}
          >
            Inadimplência
          </button>
          <button
            type="button"
            className={activeTab === 'fechamento' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'fechamento'}
            onClick={() => setActiveTab('fechamento')}
          >
            Fechamento & DRE
          </button>
          <button
            type="button"
            className={activeTab === 'contabil' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'contabil'}
            onClick={() => setActiveTab('contabil')}
          >
            Exportação Contábil
          </button>
        </div>

        {/* TAB 1: Posição Geral */}
        {activeTab === 'posicao' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>A. Posição Financeira Geral</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" disabled={!posicaoData} onClick={exportPosicaoCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar CSV
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('PDF', 'Posição Financeira Geral')}>
                  PDF
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Posição Financeira Geral')}>
                  XLSX
                </button>
              </div>
            </div>

            {posicaoLoading ? (
              <p role="status">Carregando posição financeira…</p>
            ) : posicaoError ? (
              <p role="alert" className="message error">{posicaoError}</p>
            ) : posicaoData ? (
              <>
                <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
                  <article className="panel metric">
                    <p className="eyebrow">Obrigações a Pagar</p>
                    <strong>{formatMoney(posicaoData.totalPayables)}</strong>
                    <span className="subtle">Aberto: {formatMoney(posicaoData.totalPayablesOpen)}</span>
                  </article>
                  <article className="panel metric">
                    <p className="eyebrow">Recebíveis & Cobranças</p>
                    <strong>{formatMoney(posicaoData.totalReceivables)}</strong>
                    <span className="subtle">Aberto: {formatMoney(posicaoData.totalReceivablesOpen)}</span>
                  </article>
                  <article className="panel metric">
                    <p className="eyebrow">Posição Líquida Prevista</p>
                    <strong>{formatMoney(posicaoData.totalReceivables - posicaoData.totalPayables)}</strong>
                    <span className="subtle">Diferença entre créditos e débitos previstos</span>
                  </article>
                </div>

                {!posicaoData.items.length ? (
                  <p className="empty">Nenhum lançamento encontrado para o período selecionado.</p>
                ) : (
                  <div className="finance-table" role="region" aria-label="Lançamentos da Posição Geral" tabIndex={0}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Descrição</th>
                          <th>Vencimento</th>
                          <th>Competência</th>
                          <th>Valor Previsto</th>
                          <th>Saldo Aberto</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posicaoData.items.map(item => (
                          <tr key={`${item.type}-${item.id}`}>
                            <td>
                              <span className={`pill ${item.type === 'Pagar' ? 'warning' : 'success'}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>{item.description}</td>
                            <td>{formatDate(item.dueDate)}</td>
                            <td>{formatCompetence(item.competence)}</td>
                            <td>{formatMoney(item.amount)}</td>
                            <td>{formatMoney(item.openAmount)}</td>
                            <td>{statusLabels[item.status] ?? item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* TAB 2: Recebimentos */}
        {activeTab === 'recebimentos' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>B. Relatório de Recebimentos</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" disabled={!recebimentosData} onClick={exportRecebimentosCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar CSV
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('PDF', 'Relatório de Recebimentos')}>
                  PDF
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Relatório de Recebimentos')}>
                  XLSX
                </button>
              </div>
            </div>

            {recebimentosLoading ? (
              <p role="status">Carregando recebimentos…</p>
            ) : recebimentosError ? (
              <p role="alert" className="message error">{recebimentosError}</p>
            ) : recebimentosData ? (
              <>
                <div className="metric-grid" style={{ marginBottom: '1.5rem' }}>
                  <article className="panel metric">
                    <p className="eyebrow">Total Recebido</p>
                    <strong>{formatMoney(recebimentosData.totalReceived)}</strong>
                    <span className="subtle">Recebimentos liquidados e apurados no período</span>
                  </article>
                  <article className="panel metric">
                    <p className="eyebrow">Lançamentos Processados</p>
                    <strong>{recebimentosData.items.length}</strong>
                    <span className="subtle">Registros de integrantes e receitas institucionais</span>
                  </article>
                </div>

                {!recebimentosData.items.length ? (
                  <p className="empty">Nenhum recebimento encontrado para os critérios selecionados.</p>
                ) : (
                  <div className="finance-table" role="region" aria-label="Lançamentos de Recebimentos" tabIndex={0}>
                    <table>
                      <thead>
                        <tr>
                          <th>Origem</th>
                          <th>Descrição</th>
                          <th>Vencimento</th>
                          <th>Competência</th>
                          <th>Valor Efetivo</th>
                          <th>Saldo Aberto</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recebimentosData.items.map(item => (
                          <tr key={`${item.origin}-${item.id}`}>
                            <td><span className="pill">{item.origin}</span></td>
                            <td>{item.description}</td>
                            <td>{formatDate(item.dueDate)}</td>
                            <td>{formatCompetence(item.competence)}</td>
                            <td>{formatMoney(item.amount)}</td>
                            <td>{formatMoney(item.openAmount)}</td>
                            <td>{statusLabels[item.status] ?? item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* TAB 3: Inadimplência */}
        {activeTab === 'inadimplencia' && (
          <div className="report-subview">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>C. Relatório de Inadimplência</h3>
            <DelinquencyReport client={client} organizationId={organizationId} />
          </div>
        )}

        {/* TAB 4: Fechamento & DRE */}
        {activeTab === 'fechamento' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>D. Fechamento Mensal e DRE Contábil</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('PDF', 'DRE Contábil')}>
                  PDF
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'DRE Contábil')}>
                  XLSX
                </button>
              </div>
            </div>
            <p className="subtle" style={{ marginBottom: '1rem' }}>
              Competência selecionada: <strong>{formatCompetence(reportCompetence + '-01')}</strong>. O resultado contábil é apurado com base no Plano de Contas e regras DRE da Loja.
            </p>
            <DreView client={client} organizationId={organizationId} />
          </div>
        )}

        {/* TAB 5: Exportação Contábil */}
        {activeTab === 'contabil' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>E. Plano de Contas & Exportação Contábil</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" disabled={!chartAccounts.length} onClick={exportContabilCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar CSV Contábil
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Plano de Contas')}>
                  Exportar XLSX Contábil
                </button>
              </div>
            </div>

            {chartLoading ? (
              <p role="status">Carregando plano de contas…</p>
            ) : chartError ? (
              <p role="alert" className="message error">{chartError}</p>
            ) : !chartAccounts.length ? (
              <p className="empty">Nenhuma conta contábil cadastrada na Loja.</p>
            ) : (
              <div className="finance-table" role="region" aria-label="Plano de contas contábil" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Código da Conta</th>
                      <th>Nome da Conta</th>
                      <th>Tipo</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartAccounts.map(acc => (
                      <tr key={acc.account_code}>
                        <td><code>{acc.account_code}</code></td>
                        <td>{acc.account_name}</td>
                        <td><span className="pill">{acc.account_type}</span></td>
                        <td>{acc.is_active ? 'Ativa' : 'Inativa'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Export Service Dependency Modal / Notice */}
        {exportNotice && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={() => setExportNotice(null)}
          >
            <div
              className="panel"
              style={{ maxWidth: '500px', width: '90%', padding: '1.5rem' }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-notice-title"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--primary-color, #1e3a8a)' }}>
                <Info size={22} aria-hidden="true" />
                <h3 id="export-notice-title" style={{ fontSize: '1.1rem', margin: 0 }}>Serviço de Exportação {exportNotice.format}</h3>
              </div>
              <p style={{ fontSize: '0.95rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                A geração do relatório <strong>{exportNotice.reportName}</strong> no formato <strong>{exportNotice.format}</strong> necessita do serviço estendido de relatórios no servidor.
              </p>
              <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Para evitar arquivos corrompidos ou incompletos, você pode baixar o arquivo <strong>CSV completo e auditável</strong> imediatamente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="secondary" onClick={() => setExportNotice(null)}>
                  Entendido
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setExportNotice(null)
                    if (activeTab === 'posicao') exportPosicaoCsv()
                    else if (activeTab === 'recebimentos') exportRecebimentosCsv()
                    else if (activeTab === 'contabil') exportContabilCsv()
                  }}
                >
                  Baixar CSV agora
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
