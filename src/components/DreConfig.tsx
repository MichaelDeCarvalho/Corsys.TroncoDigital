import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  FileText,
} from 'lucide-react'
import type { Page } from './AppShell'
import {
  loadAccountingCatalog,
  loadAccountingDetail,
  type Catalog,
  type Detail,
  type Plan,
  type Source,
} from '../lib/accounting-plans'
import {
  loadDreReport,
  summarizeDre,
  type DreEntry,
} from '../lib/dre-report'
import { formatCompetence, formatDate, formatMoney } from '../lib/finance-data'

export type DreConfigProps = {
  client: SupabaseClient
  organizationId: string
  onNavigate?: (page: Page) => void
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const toStr = `${y}-${String(m).padStart(2, '0')}`
  const fromDate = new Date(Date.UTC(y, m - 3, 1))
  const fromStr = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, '0')}`
  return { from: fromStr, to: toStr }
}

export function DreConfig({ client, organizationId, onNavigate }: DreConfigProps) {
  // 1. Accounting Catalog & Plan State
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [activePlan, setActivePlan] = useState<Plan | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')

  // 2. Persisted Regime State
  const [persistedRegime, setPersistedRegime] = useState<string | null>(null)
  const [regimeLoaded, setRegimeLoaded] = useState(false)

  // 3. DRE Report & Comparison State
  const defaultRange = getDefaultDateRange()
  const [fromMonth, setFromMonth] = useState(defaultRange.from)
  const [toMonth, setToMonth] = useState(defaultRange.to)
  const [dreRows, setDreRows] = useState<DreEntry[] | null>(null)
  const [dreLoading, setDreLoading] = useState(false)
  const [dreError, setDreError] = useState('')

  const [refreshSeq, setRefreshSeq] = useState(0)
  const dreRequestSeq = useRef(0)

  // Load Catalog, Plan & Persisted Regime
  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setCatalogLoading(true)
    setCatalogError('')
    setCatalog(null)
    setDetail(null)
    setActivePlan(null)
    setPersistedRegime(null)
    setRegimeLoaded(false)

    async function loadData() {
      try {
        // Query catalog and organization_settings concurrently
        const [catData, settingsRes] = await Promise.all([
          loadAccountingCatalog(client, organizationId, controller.signal),
          client
            .from('organization_settings')
            .select('organization_id, report_texts')
            .eq('organization_id', organizationId)
            .limit(1)
            .abortSignal(controller.signal),
        ])

        if (!active) return

        // 1. Extract persisted regime if present in report_texts; never invent values
        const reportTexts = settingsRes.data?.[0]?.report_texts as Record<string, unknown> | null | undefined
        const rawRegime =
          typeof reportTexts?.accounting_regime === 'string' && reportTexts.accounting_regime.trim()
            ? reportTexts.accounting_regime.trim()
            : typeof reportTexts?.regime === 'string' && reportTexts.regime.trim()
              ? reportTexts.regime.trim()
              : typeof reportTexts?.regime_contabil === 'string' && reportTexts.regime_contabil.trim()
                ? reportTexts.regime_contabil.trim()
                : null
        setPersistedRegime(rawRegime)
        setRegimeLoaded(true)

        // 2. Identify Active / Published Plan
        setCatalog(catData)
        const today = new Date().toISOString().slice(0, 10)
        const publishedPlans = catData.plans.filter((p) => p.status === 'published')
        // Prefer published plan covering today, or most recently started published plan, or first draft
        const currentPublished =
          publishedPlans.find((p) => p.valid_from <= today && p.valid_to >= today) ||
          publishedPlans[0] ||
          null
        const targetPlan = currentPublished || catData.plans[0] || null
        setActivePlan(targetPlan)

        // 3. Load mapping details for diagnostic if a plan exists
        if (targetPlan) {
          const detailData = await loadAccountingDetail(client, organizationId, targetPlan.id, controller.signal)
          if (active) setDetail(detailData)
        }
      } catch (err) {
        if (!active) return
        const code = (err as { code?: string } | null)?.code
        if (code === '42501' || code === '28000') {
          setCatalogError('Seu perfil não possui permissão para consultar a estrutura contábil desta Loja (permissão: finance.read).')
        } else if (code === '23503') {
          setCatalogError('Loja não encontrada ou registros contábeis fora do escopo institucional.')
        } else {
          setCatalogError('Não foi possível carregar os parâmetros contábeis e de mapeamento da Loja.')
        }
      } finally {
        if (active) setCatalogLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
      controller.abort()
    }
  }, [client, organizationId, refreshSeq])

  // Load DRE Comparative Data
  useEffect(() => {
    let active = true
    const currentReq = ++dreRequestSeq.current

    setDreLoading(true)
    setDreError('')

    async function fetchDre() {
      try {
        const rows = await loadDreReport(client, organizationId, fromMonth, toMonth)
        if (active && currentReq === dreRequestSeq.current) {
          setDreRows(rows)
        }
      } catch (err) {
        if (active && currentReq === dreRequestSeq.current) {
          const code = (err as { code?: string } | null)?.code
          if (code === '42501' || code === '28000') {
            setDreError('Seu perfil não possui permissão para consultar os demonstrativos da DRE (permissão: reports.read).')
          } else {
            setDreError('Não foi possível consultar os lançamentos contábeis para o período solicitado.')
          }
          setDreRows(null)
        }
      } finally {
        if (active && currentReq === dreRequestSeq.current) {
          setDreLoading(false)
        }
      }
    }

    void fetchDre()

    return () => {
      active = false
    }
  }, [client, organizationId, fromMonth, toMonth, refreshSeq])

  function handleFilterDre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const newFrom = String(form.get('from') || '').trim()
    const newTo = String(form.get('to') || '').trim()
    if (!newFrom || !newTo) return
    setFromMonth(newFrom)
    setToMonth(newTo)
  }

  // Calculate Coverage Diagnostics
  const activeCategories = catalog?.categories.filter((c) => c.active) ?? []
  const mappedCategoryIds = new Set(detail?.categoryMappings.map((m) => m.category_id) ?? [])
  const unmappedCategories: Source[] = activeCategories.filter((c) => !mappedCategoryIds.has(c.id))
  const categoryCoveragePercent = activeCategories.length
    ? Math.round(((activeCategories.length - unmappedCategories.length) / activeCategories.length) * 100)
    : 100

  const activeCash = catalog?.cash.filter((c) => c.active) ?? []
  const mappedCashIds = new Set(detail?.cashMappings.map((m) => m.financial_account_id) ?? [])
  const unmappedCash: Source[] = activeCash.filter((c) => !mappedCashIds.has(c.id))
  const cashCoveragePercent = activeCash.length
    ? Math.round(((activeCash.length - unmappedCash.length) / activeCash.length) * 100)
    : 100

  const analyticAccountsCount = detail?.accounts.filter((a) => a.active && a.row_type === 'analytic').length ?? 0
  const totalAccountsCount = detail?.accounts.length ?? 0

  // Summarize DRE by Month with Comparative Analysis
  const monthlySummary = dreRows ? summarizeDre(dreRows) : []
  const totalRevenue = monthlySummary.reduce((acc, m) => acc + m.revenue, 0)
  const totalExpenses = monthlySummary.reduce((acc, m) => acc + m.expenses, 0)
  const consolidatedResult = monthlySummary.reduce((acc, m) => acc + m.result, 0)

  return (
    <div className="view active" id="view-config-dre">
      <div className="hero">
        <div>
          <h2>Configurações da DRE</h2>
          <p>Diagnóstico contábil, cobertura de mapeamentos e parâmetros da Demonstração do Resultado.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary"
            onClick={() => setRefreshSeq((v) => v + 1)}
            disabled={catalogLoading || dreLoading}
            title="Recarregar dados contábeis"
          >
            <RefreshCw size={16} aria-hidden="true" style={{ marginRight: '6px' }} />
            Atualizar
          </button>
          {onNavigate && (
            <button
              type="button"
              className="primary"
              onClick={() => onNavigate('structure')}
              title="Acessar o Plano de Contas completo"
            >
              <BookOpen size={16} aria-hidden="true" style={{ marginRight: '6px' }} />
              Plano de Contas
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {catalogError && (
        <div className="panel" role="alert" style={{ borderLeft: '4px solid var(--danger-color, #dc2626)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertTriangle size={24} style={{ color: 'var(--danger-color, #dc2626)', flexShrink: 0 }} aria-hidden="true" />
            <div>
              <strong>Falha de autorização ou leitura contábil</strong>
              <p className="subtle" style={{ marginTop: '4px' }}>{catalogError}</p>
            </div>
          </div>
          <button
            type="button"
            className="secondary"
            style={{ marginTop: '12px' }}
            onClick={() => setRefreshSeq((v) => v + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {catalogLoading ? (
        <section className="panel" aria-busy="true">
          <p role="status" className="message">Carregando plano contábil e diagnóstico da Loja…</p>
        </section>
      ) : (
        <>
          {/* Section 1: Plano Contábil Vigente e Regime */}
          <section className="panel" aria-label="Plano contábil vigente e regime" style={{ marginBottom: '1.5rem' }}>
            <div className="section-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} style={{ color: 'var(--primary-color, #1e3a8a)' }} aria-hidden="true" />
                <h3>Plano Contábil Vigente</h3>
              </div>
              <span className="subtle">Estrutura de classificação para apuração</span>
            </div>

            {activePlan ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start', marginTop: '1rem' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.15rem' }}>{activePlan.name}</h4>
                    <span
                      className="pill"
                      style={{
                        backgroundColor: activePlan.status === 'published' ? '#dcfce7' : '#fef9c3',
                        color: activePlan.status === 'published' ? '#15803d' : '#854d0e',
                      }}
                    >
                      {activePlan.status === 'published' ? 'Publicado (Vigente)' : 'Rascunho'}
                    </span>
                  </div>
                  <p className="subtle">
                    Vigência: <strong>{formatDate(activePlan.valid_from)}</strong> a <strong>{formatDate(activePlan.valid_to)}</strong>
                  </p>
                  <p className="subtle" style={{ fontSize: '0.85rem' }}>
                    Identificador: <code>{activePlan.id}</code>
                  </p>
                  {activePlan.status === 'draft' && (
                    <p className="subtle" style={{ color: '#b45309', marginTop: '6px' }}>
                      <em>Atenção: Este plano está em modo rascunho. Para que tenha validade fiscal e contábil, é necessário publicá-lo no Plano de Contas.</em>
                    </p>
                  )}
                </div>

                <div style={{ flex: '1 1 240px', background: 'var(--bg-subtle, #f8fafc)', padding: '1rem', borderRadius: '8px' }}>
                  <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                    Regime Contábil de Apuração
                  </strong>
                  {regimeLoaded && persistedRegime ? (
                    <div>
                      <span className="pill" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                        {persistedRegime}
                      </span>
                      <p className="subtle" style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                        Regime configurado e persistido institucionalmente nos parâmetros da Loja.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="subtle" style={{ fontStyle: 'italic', display: 'block', marginBottom: '4px' }}>
                        Nenhum regime contábil persistido nos parâmetros da Loja.
                      </span>
                      <p className="subtle" style={{ fontSize: '0.8rem' }}>
                        A DRE opera estritamente pelo <strong>regime de competência</strong> com base nos fatos contábeis registrados (<code>v_dre_entries</code>), e a tesouraria acompanha as liquidações efetivas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="callout warning" style={{ marginTop: '1rem' }}>
                <p>
                  <strong>Nenhum plano contábil cadastrado para esta Loja.</strong>
                </p>
                <p className="subtle">
                  Para gerar a DRE e classificar receitas e despesas, crie e publique um plano contábil.
                </p>
                {onNavigate && (
                  <button
                    type="button"
                    className="secondary"
                    style={{ marginTop: '8px' }}
                    onClick={() => onNavigate('structure')}
                  >
                    Criar Plano de Contas
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Section 2: Diagnóstico de Cobertura dos Mapeamentos */}
          <section className="panel" aria-label="Diagnóstico de cobertura dos mapeamentos contábeis" style={{ marginBottom: '1.5rem' }}>
            <div className="section-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--primary-color, #1e3a8a)' }} aria-hidden="true" />
                <h3>Diagnóstico de Cobertura Contábil</h3>
              </div>
              <span className="subtle">Vínculo entre operação e contas contábeis</span>
            </div>

            <p className="subtle" style={{ marginBottom: '1rem' }}>
              Para garantir que todos os lançamentos financeiros gerem impacto correto na DRE, categorias e contas financeiras ativas devem estar associadas a contas contábeis analíticas.
            </p>

            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="panel metric" style={{ margin: 0 }}>
                <p>Cobertura de Categorias</p>
                <strong style={{ color: categoryCoveragePercent === 100 ? '#15803d' : '#b45309' }}>
                  {categoryCoveragePercent}%
                </strong>
                <span className="subtle">
                  {activeCategories.length - unmappedCategories.length} de {activeCategories.length} ativas vinculadas
                </span>
              </div>

              <div className="panel metric" style={{ margin: 0 }}>
                <p>Cobertura de Contas Financeiras</p>
                <strong style={{ color: cashCoveragePercent === 100 ? '#15803d' : '#b45309' }}>
                  {cashCoveragePercent}%
                </strong>
                <span className="subtle">
                  {activeCash.length - unmappedCash.length} de {activeCash.length} ativas vinculadas
                </span>
              </div>

              <div className="panel metric" style={{ margin: 0 }}>
                <p>Contas Analíticas Ativas</p>
                <strong>{analyticAccountsCount}</strong>
                <span className="subtle">de {totalAccountsCount} contas no plano</span>
              </div>
            </div>

            {/* Pendências Reais */}
            <div style={{ marginTop: '1.25rem' }}>
              {unmappedCategories.length === 0 && unmappedCash.length === 0 ? (
                <div
                  className="callout"
                  style={{
                    backgroundColor: '#f0fdf4',
                    borderColor: '#86efac',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <strong>Cobertura Integral (100%)</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      Todas as categorias e contas financeiras ativas possuem mapeamento correspondente no plano contábil.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {unmappedCategories.length > 0 && (
                    <div
                      className="callout"
                      style={{
                        backgroundColor: '#fffbeb',
                        borderColor: '#fde68a',
                        color: '#92400e',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} aria-hidden="true" />
                        <strong>
                          {unmappedCategories.length} categoria(s) ativa(s) sem vínculo com o plano contábil:
                        </strong>
                      </div>
                      <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                        Lançamentos nestas categorias não serão classificados nas rubricas de receitas ou despesas da DRE:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {unmappedCategories.map((c) => (
                          <span
                            key={c.id}
                            className="pill"
                            style={{ background: '#fef3c7', color: '#78350f', border: '1px solid #fcd34d' }}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {unmappedCash.length > 0 && (
                    <div
                      className="callout"
                      style={{
                        backgroundColor: '#fffbeb',
                        borderColor: '#fde68a',
                        color: '#92400e',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} aria-hidden="true" />
                        <strong>
                          {unmappedCash.length} conta(s) financeira(s) ativa(s) sem vínculo patrimonial:
                        </strong>
                      </div>
                      <p className="subtle" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                        Contas bancárias ou de caixa sem contrapartida contábil cadastrada:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {unmappedCash.map((acc) => (
                          <span
                            key={acc.id}
                            className="pill"
                            style={{ background: '#fef3c7', color: '#78350f', border: '1px solid #fcd34d' }}
                          >
                            {acc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {onNavigate && (
                    <div style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onNavigate('structure')}
                      >
                        Acessar Plano de Contas para Mapear Pendências
                        <ArrowRight size={14} style={{ marginLeft: '6px' }} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Resumo da DRE e Comparativo por Competência */}
          <section className="panel" aria-label="Resumo da DRE e comparativo por competência">
            <div className="section-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={20} style={{ color: 'var(--primary-color, #1e3a8a)' }} aria-hidden="true" />
                <h3>Resumo da DRE e Comparativo por Competência</h3>
              </div>
              <span className="subtle">Apuração consolidada a partir de fatos contábeis reais</span>
            </div>

            <p className="subtle" style={{ marginBottom: '1rem' }}>
              Valores apurados pela função <code>read_tenant_dre</code>, considerando lançamentos, ajustes e reversões contábeis no período consultado.
            </p>

            {/* Filter Form */}
            <form onSubmit={handleFilterDre} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div>
                  <label htmlFor="dre-cfg-from" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    Competência Inicial
                  </label>
                  <input
                    id="dre-cfg-from"
                    name="from"
                    type="month"
                    defaultValue={fromMonth}
                    required
                    disabled={dreLoading}
                  />
                </div>
                <div>
                  <label htmlFor="dre-cfg-to" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                    Competência Final
                  </label>
                  <input
                    id="dre-cfg-to"
                    name="to"
                    type="month"
                    defaultValue={toMonth}
                    required
                    disabled={dreLoading}
                  />
                </div>
                <button type="submit" className="primary" disabled={dreLoading}>
                  {dreLoading ? 'Consultando…' : 'Consultar Comparativo'}
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onNavigate('dre')}
                    title="Abrir demonstrativo detalhado da DRE"
                  >
                    <FileText size={16} aria-hidden="true" style={{ marginRight: '6px' }} />
                    DRE Detalhada
                  </button>
                )}
              </div>
            </form>

            {dreError && (
              <p role="alert" className="message error" style={{ marginBottom: '1rem' }}>
                {dreError}
              </p>
            )}

            {dreLoading && <p role="status" className="message">Calculando comparativo contábil…</p>}

            {!dreLoading && dreRows && (
              <>
                {monthlySummary.length === 0 ? (
                  <p className="empty">Nenhum lançamento contábil registrado no período selecionado ({fromMonth} a {toMonth}).</p>
                ) : (
                  <>
                    {/* Consolidate KPI Cards */}
                    <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div className="panel metric" style={{ margin: 0 }}>
                        <p>Total de Receitas</p>
                        <strong style={{ color: '#15803d' }}>{formatMoney(totalRevenue)}</strong>
                        <span className="subtle">no período de {monthlySummary.length} competência(s)</span>
                      </div>

                      <div className="panel metric" style={{ margin: 0 }}>
                        <p>Custos e Despesas</p>
                        <strong style={{ color: '#b91c1c' }}>{formatMoney(totalExpenses)}</strong>
                        <span className="subtle">valores debitados</span>
                      </div>

                      <div className="panel metric" style={{ margin: 0 }}>
                        <p>Resultado Consolidado</p>
                        <strong style={{ color: consolidatedResult >= 0 ? '#15803d' : '#b91c1c' }}>
                          {formatMoney(consolidatedResult)}
                        </strong>
                        <span className="subtle">
                          {consolidatedResult >= 0 ? 'Superávit acumulado' : 'Déficit acumulado'}
                        </span>
                      </div>
                    </div>

                    {/* Comparative Table by Competence */}
                    <div className="finance-table" role="region" aria-label="Tabela comparativa por competência" tabIndex={0}>
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Competência</th>
                            <th scope="col" style={{ textAlign: 'right' }}>Receitas</th>
                            <th scope="col" style={{ textAlign: 'right' }}>Custos/Despesas</th>
                            <th scope="col" style={{ textAlign: 'right' }}>Resultado Líquido</th>
                            <th scope="col" style={{ textAlign: 'center' }}>Situação</th>
                            <th scope="col" style={{ textAlign: 'right' }}>Variação vs Mês Anterior</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlySummary.map((m, idx) => {
                            const prev = idx > 0 ? monthlySummary[idx - 1] : null
                            const diff = prev !== null ? m.result - prev.result : null

                            return (
                              <tr key={m.month}>
                                <th scope="row">
                                  <strong>{formatCompetence(m.month)}</strong>
                                </th>
                                <td style={{ textAlign: 'right', color: '#15803d' }}>
                                  {formatMoney(m.revenue)}
                                </td>
                                <td style={{ textAlign: 'right', color: '#b91c1c' }}>
                                  {formatMoney(m.expenses)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: m.result >= 0 ? '#15803d' : '#b91c1c' }}>
                                  {formatMoney(m.result)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span
                                    className="pill"
                                    style={{
                                      backgroundColor: m.result > 0 ? '#dcfce7' : m.result < 0 ? '#fee2e2' : '#f3f4f6',
                                      color: m.result > 0 ? '#15803d' : m.result < 0 ? '#b91c1c' : '#4b5563',
                                    }}
                                  >
                                    {m.result > 0 ? 'Superávit' : m.result < 0 ? 'Déficit' : 'Equilíbrio'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                  {diff === null ? (
                                    <span className="subtle">—</span>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: diff > 0 ? '#15803d' : diff < 0 ? '#b91c1c' : '#4b5563',
                                      }}
                                    >
                                      {diff > 0 ? (
                                        <TrendingUp size={14} aria-hidden="true" />
                                      ) : diff < 0 ? (
                                        <TrendingDown size={14} aria-hidden="true" />
                                      ) : (
                                        <Minus size={14} aria-hidden="true" />
                                      )}
                                      {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
