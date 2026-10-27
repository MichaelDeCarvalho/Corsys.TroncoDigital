import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FileText, Download, Info, Calendar, AlertTriangle, ShieldAlert } from 'lucide-react'
import { loadFinancialDashboard, type DashboardValues } from '../lib/finance-dashboard'
import { loadPeriodState, type PeriodState } from '../lib/periods'
import { loadDreReport, summarizeDre, safeDreValue, type DreEntry } from '../lib/dre-report'
import { loadAccountingCatalog, loadAccountingDetail, type Catalog, type Detail } from '../lib/accounting-plans'
import { formatDate, formatMoney, formatCompetence, statusLabels } from '../lib/finance-data'

type ReportTab = 'posicao' | 'recebimentos' | 'inadimplencia' | 'fechamento' | 'contabil'

/**
 * Escapes values for safe CSV download to prevent Formula Injection (CSV Injection).
 * Prefixes strings starting with =, +, -, @, \t, \r with a single quote (').
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let str = String(value)
  // Check for formula injection triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  return `"${str.replace(/"/g, '""')}"`
}

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

  // 1. Dashboard Consolidated KPI Values (Server-calculated)
  const [kpis, setKpis] = useState<DashboardValues | null>(null)
  const [kpisLoading, setKpisLoading] = useState(false)
  const [kpisError, setKpisError] = useState('')

  // 1. Posição Geral Paginated Sample
  const [posicaoPage, setPosicaoPage] = useState(0)
  const [posicaoLoading, setPosicaoLoading] = useState(false)
  const [posicaoError, setPosicaoError] = useState('')
  const [posicaoItems, setPosicaoItems] = useState<Array<{
    id: string
    type: 'Pagar' | 'Receber' | 'Integrante'
    description: string
    dueDate: string
    competence: string | null
    amount: number
    openAmount: number
    status: string
  }> | null>(null)

  // 2. Recebimentos Paginated List (Actual Payment Events from v_payment_balances)
  const [recebimentosPage, setRecebimentosPage] = useState(0)
  const [recebimentosLoading, setRecebimentosLoading] = useState(false)
  const [recebimentosError, setRecebimentosError] = useState('')
  const [recebimentosData, setRecebimentosData] = useState<{
    items: Array<{
      paymentId: string
      memberId: string
      paymentDate: string
      amount: number
      allocatedAmount: number
      availableAmount: number
      isReversed: boolean
    }>
    hasNext: boolean
  } | null>(null)

  // 3. Fechamento & DRE State
  const [periodState, setPeriodState] = useState<PeriodState | null>(null)
  const [dreEntries, setDreEntries] = useState<DreEntry[] | null>(null)
  const [fechamentoLoading, setFechamentoLoading] = useState(false)
  const [fechamentoError, setFechamentoError] = useState('')

  // 4. Exportação Contábil State (accounting_plans / accounting_accounts)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [planDetail, setPlanDetail] = useState<Detail | null>(null)
  const [contabilLoading, setContabilLoading] = useState(false)
  const [contabilError, setContabilError] = useState('')

  // Load Financial Dashboard KPIs on mount or organizationId change
  useEffect(() => {
    let live = true
    setKpisLoading(true)
    setKpisError('')
    setKpis(null)

    loadFinancialDashboard(client, organizationId)
      .then(data => { if (live) setKpis(data) })
      .catch(cause => {
        if (!live) return
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setKpisError('Acesso negado aos indicadores financeiros da Loja.')
        } else {
          setKpisError('Não foi possível verificar as posições consolidadas.')
        }
      })
      .finally(() => { if (live) setKpisLoading(false) })

    return () => { live = false }
  }, [client, organizationId])

  // TAB 1: Load Posição Geral Paginated Sample
  useEffect(() => {
    if (activeTab !== 'posicao') return
    const controller = new AbortController()
    let live = true
    setPosicaoLoading(true)
    setPosicaoError('')
    setPosicaoItems(null)

    async function loadPosicao() {
      try {
        let pQuery = client.from('v_institutional_payable_effective').select('payable_id, organization_id, description, due_date, competence, effective_amount, open_amount, integrity_ok, is_canceled, approval_status').eq('organization_id', organizationId)
        let rQuery = client.from('v_institutional_receivable_effective').select('receivable_id, organization_id, description, due_date, competence, effective_amount, open_amount, integrity_ok, is_canceled').eq('organization_id', organizationId)
        let cQuery = client.from('v_charge_balances').select('charge_id, organization_id, description, due_date, competence, effective_amount, open_amount, integrity_ok, is_cancelled, settlement_status').eq('organization_id', organizationId)

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

        const pageSize = 25
        const offset = posicaoPage * pageSize

        const [pRes, rRes, cRes] = await Promise.all([
          pQuery.order('due_date', { ascending: false }).range(offset, offset + pageSize - 1).abortSignal(controller.signal),
          rQuery.order('due_date', { ascending: false }).range(offset, offset + pageSize - 1).abortSignal(controller.signal),
          cQuery.order('due_date', { ascending: false }).range(offset, offset + pageSize - 1).abortSignal(controller.signal),
        ])

        if (pRes.error) throw pRes.error
        if (rRes.error) throw rRes.error
        if (cRes.error) throw cRes.error

        if (!live) return

        const payables = pRes.data ?? []
        const receivables = rRes.data ?? []
        const charges = cRes.data ?? []

        // Verify integrity
        for (const row of [...payables, ...receivables, ...charges]) {
          if (row.organization_id !== organizationId || row.integrity_ok !== true) {
            throw new Error('Falha de integridade nos registros financeiros.')
          }
        }

        const items: Array<{
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

        setPosicaoItems(items)
      } catch (cause) {
        if (!live) return
        const msg = (cause as Error)?.message
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setPosicaoError('Acesso negado para consultar a posição financeira da Loja.')
        } else if (msg && msg.includes('integridade')) {
          setPosicaoError(msg)
        } else {
          setPosicaoError('Não foi possível carregar a listagem de lançamentos.')
        }
      } finally {
        if (live) setPosicaoLoading(false)
      }
    }

    void loadPosicao()
    return () => { live = false; controller.abort() }
  }, [client, organizationId, activeTab, reportStart, reportEnd, posicaoPage])

  // TAB 2: Load Recebimentos Paginated (v_payment_balances)
  useEffect(() => {
    if (activeTab !== 'recebimentos') return
    const controller = new AbortController()
    let live = true
    setRecebimentosLoading(true)
    setRecebimentosError('')
    setRecebimentosData(null)

    async function loadRecebimentos() {
      try {
        const pageSize = 25
        const offset = recebimentosPage * pageSize

        let query = client.from('v_payment_balances')
          .select('payment_id, organization_id, member_id, payment_date, amount, allocated_amount, available_amount, is_reversed, integrity_ok')
          .eq('organization_id', organizationId)
          .eq('is_reversed', false)

        if (reportStart) {
          query = query.gte('payment_date', reportStart)
        }
        if (reportEnd) {
          query = query.lte('payment_date', reportEnd)
        }

        const { data, error } = await query
          .order('payment_date', { ascending: false })
          .range(offset, offset + pageSize)
          .abortSignal(controller.signal)

        if (error) throw error
        if (!live) return

        const rows = data ?? []
        for (const row of rows) {
          if (row.organization_id !== organizationId || row.integrity_ok !== true) {
            throw new Error('Falha de integridade nos registros de pagamento.')
          }
        }
        const activeRows = rows.filter(r => !r.is_reversed)

        const hasNext = activeRows.length > pageSize
        const items = activeRows.slice(0, pageSize).map(row => ({
          paymentId: String(row.payment_id),
          memberId: String(row.member_id),
          paymentDate: String(row.payment_date),
          amount: Number(row.amount || 0),
          allocatedAmount: Number(row.allocated_amount || 0),
          availableAmount: Number(row.available_amount || 0),
          isReversed: Boolean(row.is_reversed),
        }))

        setRecebimentosData({ items, hasNext })
      } catch (cause) {
        if (!live) return
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setRecebimentosError('Acesso negado para consultar o histórico de recebimentos.')
        } else {
          setRecebimentosError('Não foi possível carregar os registros de recebimentos.')
        }
      } finally {
        if (live) setRecebimentosLoading(false)
      }
    }

    void loadRecebimentos()
    return () => { live = false; controller.abort() }
  }, [client, organizationId, activeTab, reportStart, reportEnd, recebimentosPage])

  // TAB 4: Load Fechamento & DRE (Connected to reportCompetence)
  useEffect(() => {
    if (activeTab !== 'fechamento') return
    const controller = new AbortController()
    let live = true
    setFechamentoLoading(true)
    setFechamentoError('')
    setPeriodState(null)
    setDreEntries(null)

    async function loadFechamento() {
      try {
        const [pState, dreData] = await Promise.all([
          loadPeriodState(client, organizationId, reportCompetence, controller.signal),
          loadDreReport(client, organizationId, reportCompetence, reportCompetence),
        ])

        if (!live) return
        setPeriodState(pState)
        setDreEntries(dreData)
      } catch (cause) {
        if (!live) return
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setFechamentoError('Acesso negado para consultar a DRE e fechamento desta competência.')
        } else {
          setFechamentoError('Não foi possível verificar a DRE para a competência solicitada.')
        }
      } finally {
        if (live) setFechamentoLoading(false)
      }
    }

    void loadFechamento()
    return () => { live = false; controller.abort() }
  }, [client, organizationId, activeTab, reportCompetence])

  // TAB 5: Load Plano de Contas (accounting_plans & accounting_accounts)
  useEffect(() => {
    if (activeTab !== 'contabil') return
    const controller = new AbortController()
    let live = true
    setContabilLoading(true)
    setContabilError('')
    setCatalog(null)
    setPlanDetail(null)

    async function loadContabil() {
      try {
        const cat = await loadAccountingCatalog(client, organizationId, controller.signal)
        if (!live) return
        setCatalog(cat)
        const initialPlanId = cat.plans.find(p => p.status === 'published')?.id ?? cat.plans[0]?.id ?? ''
        setSelectedPlanId(initialPlanId)

        if (initialPlanId) {
          const detail = await loadAccountingDetail(client, organizationId, initialPlanId, controller.signal)
          if (live) setPlanDetail(detail)
        }
      } catch (cause) {
        if (!live) return
        const code = (cause as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setContabilError('Acesso negado para consultar o plano de contas contábil.')
        } else {
          setContabilError('Não foi possível carregar os planos e contas contábeis.')
        }
      } finally {
        if (live) setContabilLoading(false)
      }
    }

    void loadContabil()
    return () => { live = false; controller.abort() }
  }, [client, organizationId, activeTab])

  // Change selected accounting plan
  async function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId)
    if (!planId) { setPlanDetail(null); return }
    const controller = new AbortController()
    try {
      setContabilLoading(true)
      const detail = await loadAccountingDetail(client, organizationId, planId, controller.signal)
      setPlanDetail(detail)
    } catch {
      setContabilError('Não foi possível carregar as contas deste plano.')
    } finally {
      setContabilLoading(false)
    }
  }

  // Helper function to trigger browser CSV download safely
  function triggerCsvDownload(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  // Export CSV for Posição Geral Page Sample
  function exportPosicaoPageCsv() {
    if (!posicaoItems || posicaoError) return
    let csv = `Loja;${sanitizeCsvCell(organizationId)}\n`
    csv += `Data de Exportacao;${sanitizeCsvCell(new Date().toISOString())}\n`
    csv += `Filtro Inicio;${sanitizeCsvCell(reportStart || 'Sem limite')}\n`
    csv += `Filtro Fim;${sanitizeCsvCell(reportEnd || 'Sem limite')}\n`
    csv += `Abrangencia;${sanitizeCsvCell('Amostra da pagina ' + (posicaoPage + 1) + ' (Ate 25 por origem)')}\n\n`

    csv += 'Tipo;ID;Descricao;Vencimento;Competencia;Valor Previsto;Saldo Aberto;Situacao\n'
    posicaoItems.forEach(item => {
      csv += `${sanitizeCsvCell(item.type)};${sanitizeCsvCell(item.id)};${sanitizeCsvCell(item.description)};${sanitizeCsvCell(formatDate(item.dueDate))};${sanitizeCsvCell(formatCompetence(item.competence))};${sanitizeCsvCell(item.amount.toFixed(2))};${sanitizeCsvCell(item.openAmount.toFixed(2))};${sanitizeCsvCell(statusLabels[item.status] ?? item.status)}\n`
    })

    triggerCsvDownload(`posicao-financeira-pagina-${posicaoPage + 1}-${organizationId.slice(0, 8)}.csv`, csv)
  }

  // Export CSV for Recebimentos Paginated Sample
  function exportRecebimentosPageCsv() {
    if (!recebimentosData || recebimentosError) return
    let csv = `Loja;${sanitizeCsvCell(organizationId)}\n`
    csv += `Data de Exportacao;${sanitizeCsvCell(new Date().toISOString())}\n`
    csv += `Filtro Inicio;${sanitizeCsvCell(reportStart || 'Sem limite')}\n`
    csv += `Filtro Fim;${sanitizeCsvCell(reportEnd || 'Sem limite')}\n`
    csv += `Abrangencia;${sanitizeCsvCell('Registros de pagamento da pagina ' + (recebimentosPage + 1))}\n\n`

    csv += 'ID Pagamento;ID Integrante;Data Pagamento;Valor Recebido;Valor Alocado;Credito Disponivel\n'
    recebimentosData.items.forEach(item => {
      csv += `${sanitizeCsvCell(item.paymentId)};${sanitizeCsvCell(item.memberId)};${sanitizeCsvCell(formatDate(item.paymentDate))};${sanitizeCsvCell(item.amount.toFixed(2))};${sanitizeCsvCell(item.allocatedAmount.toFixed(2))};${sanitizeCsvCell(item.availableAmount.toFixed(2))}\n`
    })

    triggerCsvDownload(`recebimentos-pagina-${recebimentosPage + 1}-${organizationId.slice(0, 8)}.csv`, csv)
  }

  // Export CSV for Chart of Accounts Structure (Plano de Contas)
  function exportChartOfAccountsCsv() {
    if (!planDetail || contabilError) return
    const plan = catalog?.plans.find(p => p.id === selectedPlanId)
    let csv = `Loja;${sanitizeCsvCell(organizationId)}\n`
    csv += `Data de Exportacao;${sanitizeCsvCell(new Date().toISOString())}\n`
    csv += `Plano Contabil;${sanitizeCsvCell(plan?.name ?? selectedPlanId)}\n`
    csv += `Vigencia;${sanitizeCsvCell((plan?.valid_from ?? '') + ' a ' + (plan?.valid_to ?? ''))}\n`
    csv += `Status Plano;${sanitizeCsvCell(plan?.status ?? '')}\n`
    csv += `Tipo de Exportacao;${sanitizeCsvCell('Cadastro da Estrutura do Plano de Contas (Nao inclui lancamentos contabeis)')}\n\n`

    csv += 'Codigo;Descricao;Natureza;Tipo Registro;Ativa\n'
    planDetail.accounts.forEach(acc => {
      csv += `${sanitizeCsvCell(acc.code)};${sanitizeCsvCell(acc.description)};${sanitizeCsvCell(acc.nature)};${sanitizeCsvCell(acc.row_type)};${sanitizeCsvCell(acc.active ? 'Sim' : 'Nao')}\n`
    })

    triggerCsvDownload(`plano-contas-${selectedPlanId.slice(0, 8)}.csv`, csv)
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
          Relatórios financeiros e contábeis consolidados da Loja. Todas as posições são sustentadas estritamente pelos contratos e dados reais do servidor.
        </p>

        {/* Global Filter Bar */}
        <div className="finance-filters" role="search" aria-label="Filtros de relatórios" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', margin: '1rem 0' }}>
          <div className="filter-group">
            <label htmlFor="reportStart" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Período de (Vencimento/Pagamento)</label>
            <input
              id="reportStart"
              type="date"
              value={reportStart}
              onChange={e => {
                setReportStart(e.target.value)
                setPosicaoPage(0)
                setRecebimentosPage(0)
              }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="reportEnd" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Período até</label>
            <input
              id="reportEnd"
              type="date"
              value={reportEnd}
              onChange={e => {
                setReportEnd(e.target.value)
                setPosicaoPage(0)
                setRecebimentosPage(0)
              }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="reportCompetence" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Competência Contábil (AAAA-MM)</label>
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
            onClick={() => {
              setReportStart('')
              setReportEnd('')
              setReportCompetence(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
              setPosicaoPage(0)
              setRecebimentosPage(0)
            }}
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
            onClick={() => { setActiveTab('posicao'); setPosicaoPage(0) }}
          >
            Posição Geral
          </button>
          <button
            type="button"
            className={activeTab === 'recebimentos' ? 'primary' : 'secondary'}
            aria-pressed={activeTab === 'recebimentos'}
            onClick={() => { setActiveTab('recebimentos'); setRecebimentosPage(0) }}
          >
            Recebimentos
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
                <button type="button" className="secondary" disabled={!posicaoItems || posicaoLoading || !!posicaoError} onClick={exportPosicaoPageCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar Página (CSV)
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('PDF', 'Posição Financeira Geral')}>
                  PDF
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Posição Financeira Geral')}>
                  XLSX
                </button>
              </div>
            </div>

            {/* Server-Calculated Consolidated Global KPIs (read_tenant_financial_dashboard) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Posições Globais Consolidadas no Banco</p>
              {kpisLoading ? (
                <p role="status">Consultando indicadores globais…</p>
              ) : kpisError ? (
                <p role="alert" className="message error">{kpisError}</p>
              ) : kpis ? (
                <>
                  <p className="subtle" style={{ marginBottom: '0.75rem' }}>
                    Calculado pelo servidor em <strong>{formatDate(kpis.as_of)}</strong>. Não recalculado somando amostras paginadas.
                  </p>
                  <div className="metric-grid">
                    <article className="panel metric">
                      <p className="eyebrow">A Receber Global</p>
                      <strong>{formatMoney(Number(kpis.receivables_open))}</strong>
                      <span className="subtle">Vencidos: {formatMoney(Number(kpis.receivables_overdue))}</span>
                    </article>
                    <article className="panel metric">
                      <p className="eyebrow">A Pagar Global</p>
                      <strong>{formatMoney(Number(kpis.payables_open))}</strong>
                      <span className="subtle">Vencidos: {formatMoney(Number(kpis.payables_overdue))}</span>
                    </article>
                    <article className="panel metric">
                      <p className="eyebrow">Recebido no Mês</p>
                      <strong>{formatMoney(Number(kpis.received_this_month))}</strong>
                      <span className="subtle">Saldo caixas/bancos: {formatMoney(Number(kpis.cash_bank_balance))}</span>
                    </article>
                  </div>
                </>
              ) : null}
            </div>

            {/* Paginated Listing */}
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
              Listagem de Lançamentos — Amostra Paginada (Página {posicaoPage + 1})
            </h4>

            {posicaoLoading ? (
              <p role="status">Carregando listagem paginada…</p>
            ) : posicaoError ? (
              <p role="alert" className="message error">{posicaoError}</p>
            ) : !posicaoItems || !posicaoItems.length ? (
              <p className="empty">Nenhum lançamento encontrado para a página consultada.</p>
            ) : (
              <>
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
                      {posicaoItems.map(item => (
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

                <div className="pagination" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="secondary"
                    disabled={posicaoPage === 0 || posicaoLoading}
                    onClick={() => setPosicaoPage(p => Math.max(0, p - 1))}
                  >
                    Página anterior
                  </button>
                  <span className="subtle">Página {posicaoPage + 1} (até 25 registros por origem)</span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={posicaoItems.length < 25 || posicaoLoading}
                    onClick={() => setPosicaoPage(p => p + 1)}
                  >
                    Próxima página
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: Recebimentos */}
        {activeTab === 'recebimentos' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>B. Relatório de Recebimentos Efetivados</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" disabled={!recebimentosData || recebimentosLoading || !!recebimentosError} onClick={exportRecebimentosPageCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar Página (CSV)
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('PDF', 'Relatório de Recebimentos')}>
                  PDF
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Relatório de Recebimentos')}>
                  XLSX
                </button>
              </div>
            </div>

            <p className="subtle" style={{ marginBottom: '1rem' }}>
              Histórico de fatos reais de recebimento registrados em caixa/banco (visão <code>v_payment_balances</code>), cobrindo pagamentos de integrantes (e não faturamento institucional completo), ordenado por data de pagamento. Exclui estornos e não deduz valores a partir do vencimento ou saldo aberto de cobranças. Para receitas institucionais diretas, consulte a conciliação bancária ou DRE da competência.
            </p>

            {recebimentosLoading ? (
              <p role="status">Carregando recebimentos efetivados…</p>
            ) : recebimentosError ? (
              <p role="alert" className="message error">{recebimentosError}</p>
            ) : !recebimentosData || !recebimentosData.items.length ? (
              <p className="empty">Nenhum registro de pagamento recebido para os filtros selecionados.</p>
            ) : (
              <>
                <div className="finance-table" role="region" aria-label="Fatos reais de recebimentos" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>ID Pagamento</th>
                        <th>Data do Pagamento</th>
                        <th>Valor Recebido</th>
                        <th>Valor Alocado</th>
                        <th>Crédito Disponível</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recebimentosData.items.map(item => (
                        <tr key={item.paymentId}>
                          <td><code>{item.paymentId.slice(0, 8)}</code></td>
                          <td>{formatDate(item.paymentDate)}</td>
                          <td><strong>{formatMoney(item.amount)}</strong></td>
                          <td>{formatMoney(item.allocatedAmount)}</td>
                          <td>{formatMoney(item.availableAmount)}</td>
                          <td><span className="pill success">Registrado</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="secondary"
                    disabled={recebimentosPage === 0 || recebimentosLoading}
                    onClick={() => setRecebimentosPage(p => Math.max(0, p - 1))}
                  >
                    Página anterior
                  </button>
                  <span className="subtle">Página {recebimentosPage + 1}</span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!recebimentosData.hasNext || recebimentosLoading}
                    onClick={() => setRecebimentosPage(p => p + 1)}
                  >
                    Próxima página
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Fechamento & DRE */}
        {activeTab === 'fechamento' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>C. Fechamento Mensal e DRE por Competência</h3>
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
              Competência consultada: <strong>{formatCompetence(reportCompetence + '-01')}</strong>.
            </p>

            {fechamentoLoading ? (
              <p role="status">Verificando fechamento e DRE da competência…</p>
            ) : fechamentoError ? (
              <p role="alert" className="message error">{fechamentoError}</p>
            ) : (
              <>
                {/* Period Closing State */}
                {periodState && (
                  <div className="panel metric" style={{ marginBottom: '1.5rem', borderLeft: periodState.closed ? '4px solid var(--success-color, #16a34a)' : '4px solid var(--warning-color, #d97706)' }}>
                    <p className="eyebrow">Estado do Período Contábil ({reportCompetence})</p>
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginTop: '0.25rem' }}>
                      {periodState.closed ? 'Fechado' : 'Aberto / Em Andamento'}
                    </strong>
                    <span className="subtle">
                      {periodState.exists ? `Último evento registrado: ${periodState.lastEvent ?? 'Abertura'}` : 'Período contábil sem encerramento formal registrado.'}
                    </span>
                  </div>
                )}

                {/* DRE Summary */}
                {!dreEntries || !dreEntries.length ? (
                  <p className="empty">Nenhum lançamento contabilizado na DRE para a competência {reportCompetence}.</p>
                ) : (
                  <>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Resumo da DRE — Competência {reportCompetence}
                    </h4>
                    <div className="finance-table" role="region" aria-label="Resultado DRE" tabIndex={0}>
                      <table>
                        <thead>
                          <tr>
                            <th>Competência</th>
                            <th>Receitas</th>
                            <th>Custos / Despesas</th>
                            <th>Resultado Contábil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summarizeDre(dreEntries).map(m => (
                            <tr key={m.month}>
                              <td>{formatCompetence(m.month)}</td>
                              <td>{formatMoney(m.revenue)}</td>
                              <td>{formatMoney(m.expenses)}</td>
                              <td><strong>{formatMoney(m.result)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                      Detalhamento por Conta Contábil
                    </h4>
                    <div className="finance-table" role="region" aria-label="Contas na DRE" tabIndex={0}>
                      <table>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Conta Contábil</th>
                            <th>Natureza</th>
                            <th>Valor Assinado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dreEntries.map((r, i) => (
                            <tr key={`${r.accounting_period}:${r.accounting_account_id}:${i}`}>
                              <td><code>{r.account_code}</code></td>
                              <td>{r.account_description}</td>
                              <td><span className="pill">{r.nature}</span></td>
                              <td>{formatMoney(safeDreValue(r.signed_amount))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 4: Exportação Contábil */}
        {activeTab === 'contabil' && (
          <div className="report-subview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>D. Plano de Contas & Exportação Contábil</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" disabled={!planDetail || contabilLoading || !!contabilError} onClick={exportChartOfAccountsCsv}>
                  <Download size={16} aria-hidden="true" style={{ marginRight: '0.25rem' }} /> Exportar Plano de Contas (CSV)
                </button>
                <button type="button" className="quiet" onClick={() => handleExtendedExportRequest('XLSX', 'Lançamentos Contábeis Classificados')}>
                  Exportar Lançamentos (XLSX)
                </button>
              </div>
            </div>

            <p className="subtle" style={{ marginBottom: '1rem' }}>
              Exportação do cadastro da estrutura contábil (tabelas <code>accounting_plans</code> e <code>accounting_accounts</code>).
            </p>

            {contabilLoading ? (
              <p role="status">Carregando catálogo e estrutura contábil…</p>
            ) : contabilError ? (
              <p role="alert" className="message error">{contabilError}</p>
            ) : !catalog || !catalog.plans.length ? (
              <p className="empty">Nenhum plano de contas cadastrado para esta Loja.</p>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="plan-selector" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    Selecione o Plano Contábil
                  </label>
                  <select
                    id="plan-selector"
                    value={selectedPlanId}
                    onChange={e => void handlePlanSelect(e.target.value)}
                  >
                    {catalog.plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.status === 'published' ? 'Publicado' : 'Rascunho'} ({p.valid_from.slice(0, 7)} a {p.valid_to.slice(0, 7)})
                      </option>
                    ))}
                  </select>
                </div>

                {!planDetail || !planDetail.accounts.length ? (
                  <p className="empty">Nenhuma conta contábil cadastrada neste plano.</p>
                ) : (
                  <div className="finance-table" role="region" aria-label="Plano de contas contábil" tabIndex={0}>
                    <table>
                      <thead>
                        <tr>
                          <th>Código da Conta</th>
                          <th>Descrição da Conta</th>
                          <th>Natureza</th>
                          <th>Tipo de Registro</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planDetail.accounts.map(acc => (
                          <tr key={acc.id}>
                            <td><code>{acc.code}</code></td>
                            <td>{acc.description}</td>
                            <td><span className="pill">{acc.nature}</span></td>
                            <td>{acc.row_type}</td>
                            <td>{acc.active ? 'Ativa' : 'Inativa'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Important Distinction Notice */}
                <div className="panel info-card" style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Info size={18} aria-hidden="true" />
                    <strong>Diferenciação Modalidades de Exportação Contábil</strong>
                  </div>
                  <p className="subtle" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                    O arquivo CSV acima exporta o <strong>Plano de Contas (Estrutura do Cadastro)</strong>. A exportação do <strong>Diário e Razão com Lançamentos Contábeis Classificados</strong> necessita do microserviço estendido de integração contábil no servidor.
                  </p>
                </div>
              </>
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
                Para garantir a integridade dos dados, você pode exportar a página consultada em formato CSV.
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
                    if (activeTab === 'posicao') exportPosicaoPageCsv()
                    else if (activeTab === 'recebimentos') exportRecebimentosPageCsv()
                    else if (activeTab === 'contabil') exportChartOfAccountsCsv()
                  }}
                >
                  Baixar CSV da página
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
