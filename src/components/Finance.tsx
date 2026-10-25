import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RefreshCw } from 'lucide-react'
import { MemberPayments } from './MemberPayments'
import { DreReport } from './DreReport'
import { InstitutionalOperations } from './InstitutionalOperations'
import { InstitutionalMonthly } from './InstitutionalMonthly'
import { PayableApprovals } from './PayableApprovals'
import { ApprovalPolicies } from './ApprovalPolicies'
import { MonthlyChargeGeneration } from './MonthlyChargeGeneration'
import { ManualCharges } from './ManualCharges'
import { MemberAgreements } from './MemberAgreements'
import { AgapeEvents } from './AgapeEvents'
import { MutualBatches } from './MutualBatches'
import { FinancialPeriods } from './FinancialPeriods'
import { TreasuryBalances } from './TreasuryBalances'
import { AccountTransfers } from './AccountTransfers'
import { DailyCashFlow } from './DailyCashFlow'
import { BudgetReport } from './BudgetReport'
import { BudgetManagement } from './BudgetManagement'
import { BankReconciliation } from './BankReconciliation'
import { DelinquencyReport } from './DelinquencyReport'
import { ContasPagar } from './ContasPagar'
import { ContasReceber } from './ContasReceber'
import { Tesouraria } from './Tesouraria'
import { FluxoCaixa } from './FluxoCaixa'
import { DreView } from './DreView'
import { FinanceIntegrityError, financeSources, formatCompetence, formatDate, formatMoney, loadFinancePage, type FinanceKind, type FinanceRow, type FinanceFilters } from '../lib/finance-data'

const statusLabels: Record<string, string> = { open: 'Em aberto', paid: 'Liquidada', partially_paid: 'Parcialmente liquidada', cancelled: 'Cancelada', posted: 'Contabilizada', approved: 'Aprovada', pending: 'Pendente', missing_request: 'Aprovação não solicitada', not_required: 'Dispensada', rejected: 'Rejeitada' }

const COMPETENCE_OPTIONS = [
  { value: '2026-12', label: '12/2026 (Dezembro)' },
  { value: '2026-11', label: '11/2026 (Novembro)' },
  { value: '2026-10', label: '10/2026 (Outubro)' },
  { value: '2026-09', label: '09/2026 (Setembro)' },
  { value: '2026-08', label: '08/2026 (Agosto)' },
  { value: '2026-07', label: '07/2026 (Julho)' },
  { value: '2026-06', label: '06/2026 (Junho)' },
  { value: '2026-05', label: '05/2026 (Maio)' },
  { value: '2026-04', label: '04/2026 (Abril)' },
  { value: '2026-03', label: '03/2026 (Março)' },
  { value: '2026-02', label: '02/2026 (Fevereiro)' },
  { value: '2026-01', label: '01/2026 (Janeiro)' },
]

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Finance({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [kind, setKind] = useState<FinanceKind | 'mutuals' | 'agapes' | 'agreements' | 'memberPayments' | 'dre' | 'institutional' | 'institutionalMonthly' | 'approvals' | 'monthly' | 'manual' | 'periods' | 'treasury' | 'budget' | 'budgetManagement' | 'delinquency' | 'approvalPolicies' | 'transfers' | 'cashflow' | 'reconciliation'>('charges')
  return <>
    <div className="finance-sections" role="group" aria-label="Consultas financeiras">
      {(Object.keys(financeSources) as FinanceKind[]).map(id => <button className="secondary" key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{financeSources[id].label}</button>)}
      <button className="secondary" aria-pressed={kind === 'memberPayments'} onClick={() => setKind('memberPayments')}>Pagamentos de integrantes</button>
      <button className="secondary" aria-pressed={kind === 'dre'} onClick={() => setKind('dre')}>DRE contábil</button>
      <button className="secondary" aria-pressed={kind === 'institutional'} onClick={() => setKind('institutional')}>Operações institucionais</button>
      <button className="secondary" aria-pressed={kind === 'institutionalMonthly'} onClick={() => setKind('institutionalMonthly')}>Recorrências institucionais</button>
      <button className="secondary" aria-pressed={kind === 'approvals'} onClick={() => setKind('approvals')}>Aprovação de despesas</button>
      <button className="secondary" aria-pressed={kind === 'approvalPolicies'} onClick={() => setKind('approvalPolicies')}>Políticas de aprovação</button>
      <button className="secondary" aria-pressed={kind === 'monthly'} onClick={() => setKind('monthly')}>Gerar mensalidades</button>
      <button className="secondary" aria-pressed={kind === 'manual'} onClick={() => setKind('manual')}>Cobranças avulsas</button>
      <button className="secondary" aria-pressed={kind === 'agreements'} onClick={() => setKind('agreements')}>Negociar dívida</button>
      <button className="secondary" aria-pressed={kind === 'agapes'} onClick={() => setKind('agapes')}>Ágapes e participantes</button>
      <button className="secondary" aria-pressed={kind === 'mutuals'} onClick={() => setKind('mutuals')}>Mútuas por faixa</button>
      <button className="secondary" aria-pressed={kind === 'periods'} onClick={() => setKind('periods')}>Fechamento mensal</button>
      <button className="secondary" aria-pressed={kind === 'treasury'} onClick={() => setKind('treasury')}>Caixa e bancos</button>
      <button className="secondary" aria-pressed={kind === 'transfers'} onClick={() => setKind('transfers')}>Transferências</button>
      <button className="secondary" aria-pressed={kind === 'reconciliation'} onClick={() => setKind('reconciliation')}>Conciliação bancária</button>
      <button className="secondary" aria-pressed={kind === 'cashflow'} onClick={() => setKind('cashflow')}>Fluxo de caixa</button>
      <button className="secondary" aria-pressed={kind === 'budget'} onClick={() => setKind('budget')}>Orçado × realizado</button>
      <button className="secondary" aria-pressed={kind === 'budgetManagement'} onClick={() => setKind('budgetManagement')}>Planejar orçamento</button>
      <button className="secondary" aria-pressed={kind === 'delinquency'} onClick={() => setKind('delinquency')}>Inadimplência</button>
    </div>
    <p className="subtle">Cobranças e obrigações são separadas dos pagamentos. Os valores em aberto não representam saldo de caixa.</p>
    {kind === 'memberPayments'
      ? <MemberPayments key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'payables'
      ? <ContasPagar key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'receivables'
      ? <ContasReceber key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'dre'
      ? <DreView key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'institutional'
      ? <InstitutionalOperations key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'institutionalMonthly'
      ? <InstitutionalMonthly key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'approvals'
      ? <PayableApprovals key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'approvalPolicies'
      ? <ApprovalPolicies key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'monthly'
      ? <MonthlyChargeGeneration key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'manual'
      ? <ManualCharges key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'agreements'
      ? <MemberAgreements key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'agapes'
      ? <AgapeEvents key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'mutuals'
      ? <MutualBatches key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'periods'
      ? <FinancialPeriods key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'treasury'
      ? <Tesouraria key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'transfers'
      ? <AccountTransfers key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'reconciliation'
      ? <BankReconciliation key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'cashflow'
      ? <FluxoCaixa key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'budget'
      ? <BudgetReport key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'budgetManagement'
      ? <BudgetManagement key={organizationId} client={client} organizationId={organizationId} />
      : kind === 'delinquency'
      ? <DelinquencyReport key={organizationId} client={client} organizationId={organizationId} />
      : <FinanceList key={`${organizationId}:${kind}`} client={client} organizationId={organizationId} kind={kind} />}
  </>
}

function FinanceList({ client, organizationId, kind }: { client: SupabaseClient; organizationId: string; kind: FinanceKind }) {
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [competence, setCompetence] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [result, setResult] = useState<{ rows: FinanceRow[]; hasNext: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setResult(null); setError('')
    const filters: FinanceFilters = {
      competence: competence || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }
    loadFinancePage(client, organizationId, kind, page, controller.signal, filters).then(data => { if (active) setResult(data) }).catch(reason => {
      if (active) setError(reason instanceof FinanceIntegrityError ? 'Há uma inconsistência nos registros financeiros. Solicite a revisão antes de utilizar os valores.' : 'Não foi possível consultar o financeiro. Tente novamente ou solicite a revisão do seu acesso.')
    })
    return () => { active = false; controller.abort() }
  }, [client, organizationId, kind, page, revision, competence, startDate, endDate])

  return <section className="panel">
    <div className="section-title">
      <h2>{financeSources[kind].label}</h2>
      <button className="quiet" aria-label="Atualizar financeiro" onClick={() => setRevision(value => value + 1)}>
        <RefreshCw size={18} aria-hidden="true" />
      </button>
    </div>

    <div className="finance-filters" role="search" aria-label="Filtros financeiros" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <div className="filter-group">
        <label htmlFor="financeCompetence" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Competência contábil</label>
        <select
          id="financeCompetence"
          aria-label="Filtrar por competência"
          value={competence}
          onChange={e => { setCompetence(e.target.value); setPage(0) }}
        >
          <option value="">Todas as competências</option>
          {COMPETENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="finance-start" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento de</label>
        <input
          id="finance-start"
          type="date"
          data-date-target="finance-start"
          aria-label="Data inicial de vencimento"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(0) }}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="finance-end" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Vencimento até</label>
        <input
          id="finance-end"
          type="date"
          data-date-target="finance-end"
          aria-label="Data final de vencimento"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(0) }}
        />
      </div>

      <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const now = new Date()
            setStartDate(toIsoDate(now))
            const next = new Date(now)
            next.setDate(now.getDate() + 7)
            setEndDate(toIsoDate(next))
            setPage(0)
          }}
        >
          1 sem.
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const now = new Date()
            setStartDate(toIsoDate(now))
            const next = new Date(now)
            next.setDate(now.getDate() + 15)
            setEndDate(toIsoDate(next))
            setPage(0)
          }}
        >
          15 dias
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setCompetence('')
            setStartDate('')
            setEndDate('')
            setPage(0)
          }}
        >
          Limpar filtros
        </button>
      </div>
    </div>

    <p className="subtle" style={{ margin: '0.5rem 0 1rem' }}>
      Filtros aplicados diretamente nas consultas do banco. Competência contábil (mês de referência) é distinta da Data de Vencimento e da Liquidação. A posição em aberto reflete obrigações pendentes de liquidação e não equivale a saldo de caixa disponível.
    </p>

    {error ? (
      <>
        <p role="alert" className="message error">{error}</p>
        <button className="secondary" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
      </>
    ) : !result ? (
      <p role="status" className="message">Consultando financeiro…</p>
    ) : (
      <>
        {!result.rows.length ? (
          <p className="empty">Nenhum registro nesta página.</p>
        ) : (
          <div className="finance-table" role="region" aria-label={financeSources[kind].label} tabIndex={0}>
            <table>
              <caption className="subtle">Valores calculados pelo sistema para a Loja selecionada.</caption>
              <thead>
                <tr>
                  <th scope="col">Descrição</th>
                  <th scope="col">Competência</th>
                  <th scope="col">Vencimento</th>
                  <th scope="col">Valor efetivo</th>
                  <th scope="col">Em aberto</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map(row => (
                  <tr key={row.id}>
                    <th scope="row">{row.description}</th>
                    <td>{formatCompetence(row.competence)}</td>
                    <td>{formatDate(row.dueDate)}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>{formatMoney(row.openAmount)}</td>
                    <td><span className="pill">{statusLabels[row.status] ?? row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="finance-pagination">
          <button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
          <span role="status">Página {page + 1} · {result.rows.length} registros</span>
          <button className="secondary" disabled={!result.hasNext} onClick={() => setPage(value => value + 1)}>Próxima</button>
        </div>
      </>
    )}
  </section>
}
