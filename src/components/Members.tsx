import { useEffect, useState, useMemo } from 'react'
import type { Member } from '../lib/tenant-data'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMoney, formatDate } from '../lib/finance-data'
import { MemberForm } from './MemberForm'
import { MemberConfiguration } from './MemberConfiguration'

const situations: Record<string, string> = { active: 'Ativo', away: 'Afastado', inactive: 'Inativo', disconnected: 'Desligado' }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()

function matches(member: Member, query: string) {
  if (!query) return true
  const text = normalize(query)
  if ([member.full_name, member.preferred_name, member.email].some(value => value && normalize(value).includes(text))) return true
  const digits = query.replace(/\D/g, '')
  return !!digits && !/[a-z]/i.test(text) && [member.phone, member.whatsapp].some(value => value?.replace(/\D/g, '').includes(digits))
}

function dateLabel(value?: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'Não informado'
}

type FinancialPosition = {
  open: number
  credit: number
  net: number
}

type TermInfo = {
  exempt: boolean
  amount: number | null
}

type StatementEntry = {
  date: string
  description: string
  competence: string
  qty: number
  unitValue: number
  debit: number
  credit: number
  balance: number
}

function computeStatus(open: number, credit: number, lastPay?: string | null): string {
  if (open === 0 && credit === 0 && !lastPay) return 'Sem movimento'
  if (open > 0 && credit > 0) return 'Parcial'
  if (open > 0) return 'Com saldo'
  if (credit > 0) return 'Com crédito'
  return 'Em dia'
}

function situationClass(status: string) {
  switch (status) {
    case 'active': return 'active'
    case 'away': return 'away'
    case 'inactive': return 'inactive'
    case 'disconnected': return 'off'
    default: return 'inactive'
  }
}

function financialClass(status: string) {
  switch (status) {
    case 'Em dia': return 'ok'
    case 'Com saldo': return 'open'
    case 'Parcial': return 'partial'
    case 'Vencido': return 'overdue'
    case 'Com crédito': return 'ok'
    default: return ''
  }
}

export function Members({
  members,
  client,
  organizationId,
  onSaved,
  onReload,
}: {
  members: Member[]
  client?: SupabaseClient
  organizationId?: string
  onSaved?: () => void
  onReload?: () => void
}) {
  const [query, setQuery] = useState('')
  const [situation, setSituation] = useState('all')
  const [financialStatus, setFinancialStatus] = useState('all')
  const [startDate, setStartDate] = useState('2026-09-01')
  const [endDate, setEndDate] = useState('2026-09-30')

  const [editing, setEditing] = useState<Member | null | undefined>(undefined)
  const [configuration, setConfiguration] = useState<Member | null>(null)
  const [drawerMember, setDrawerMember] = useState<Member | null>(null)

  const [financialMap, setFinancialMap] = useState<Record<string, FinancialPosition>>({})
  const [termMap, setTermMap] = useState<Record<string, TermInfo>>({})
  const [paymentMap, setPaymentMap] = useState<Record<string, string>>({})
  const [financialError, setFinancialError] = useState<string | null>(null)
  const [integrityMismatch, setIntegrityMismatch] = useState(false)
  const isFinancialUnavailable = !!financialError || integrityMismatch || !client

  const [statement, setStatement] = useState<StatementEntry[]>([])
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Clear financial state on organization switch
  useEffect(() => {
    setFinancialMap({})
    setTermMap({})
    setPaymentMap({})
    setStatement([])
    setFinancialError(null)
    setIntegrityMismatch(false)
    setStatementError(null)
    setDrawerMember(null)
  }, [organizationId])

  // Load real financial positions and active terms if client is available
  useEffect(() => {
    if (!client || !organizationId) return
    const controller = new AbortController()
    let active = true
    setFinancialError(null)
    setIntegrityMismatch(false)

    Promise.all([
      client.from('v_member_financial_position')
        .select('member_id,open_receivables,available_credit,net_position,integrity_ok')
        .eq('organization_id', organizationId)
        .abortSignal(controller.signal),
      client.from('recurring_member_terms')
        .select('member_id,term_type,override_amount,effective_from,effective_to')
        .eq('organization_id', organizationId)
        .abortSignal(controller.signal),
      client.from('v_payment_balances')
        .select('member_id,payment_date')
        .eq('organization_id', organizationId)
        .order('payment_date', { ascending: false })
        .limit(200)
        .abortSignal(controller.signal),
    ]).then(([posRes, termRes, payRes]) => {
      if (!active) return
      if (posRes.error || termRes.error || payRes.error) {
        setFinancialError('Falha de leitura nas views financeiras autorizadas.')
        return
      }
      if (posRes.data) {
        const pMap: Record<string, FinancialPosition> = {}
        let hasIntegrityIssue = false
        for (const row of posRes.data) {
          if (row.integrity_ok === false) {
            hasIntegrityIssue = true
          }
          pMap[row.member_id] = {
            open: Number(row.open_receivables || 0),
            credit: Number(row.available_credit || 0),
            net: Number(row.net_position || 0),
          }
        }
        setFinancialMap(pMap)
        if (hasIntegrityIssue) {
          setIntegrityMismatch(true)
        }
      }
      if (termRes.data) {
        const tMap: Record<string, TermInfo> = {}
        for (const row of termRes.data) {
          if (!tMap[row.member_id] || !row.effective_to) {
            tMap[row.member_id] = {
              exempt: row.term_type === 'exempt',
              amount: row.override_amount ? Number(row.override_amount) : null,
            }
          }
        }
        setTermMap(tMap)
      }
      if (payRes.data) {
        const lastMap: Record<string, string> = {}
        for (const row of payRes.data) {
          if (!lastMap[row.member_id] && row.payment_date) {
            lastMap[row.member_id] = row.payment_date
          }
        }
        setPaymentMap(lastMap)
      }
    }).catch(err => {
      if (active && err?.name !== 'AbortError') {
        setFinancialError('Erro de conexão ao carregar posições financeiras.')
      }
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [client, organizationId])

  // Load statement when drawer opens for a member, filtered by period [startDate, endDate]
  useEffect(() => {
    if (!drawerMember || !client || !organizationId) {
      setStatement([])
      setStatementError(null)
      return
    }
    const targetMember = drawerMember
    const supabaseClient = client
    const targetOrgId = organizationId
    const selStart = startDate
    const selEnd = endDate
    const controller = new AbortController()
    let active = true
    setStatementLoading(true)
    setStatementError(null)

    async function loadStatement() {
      try {
        const res = await supabaseClient
          .from('v_member_statement')
          .select('event_at,event_type,description,competence,due_date,debit,credit')
          .eq('organization_id', targetOrgId)
          .eq('member_id', targetMember.id)
          .order('event_at', { ascending: true })
          .abortSignal(controller.signal)

        if (!active) return

        if (res.error) {
          setStatementError('Erro ao consultar extrato financeiro.')
          setStatement([])
          return
        }

        if (res.data) {
          let running = 0
          const items: StatementEntry[] = []
          for (const row of res.data) {
            const d = Number(row.debit || 0)
            const c = Number(row.credit || 0)
            running += d - c
            const eventDateStr = row.event_at ? row.event_at.slice(0, 10) : ''
            // Apply period filtering if event date is within [selStart, selEnd]
            if (eventDateStr && (eventDateStr < selStart || eventDateStr > selEnd)) {
              continue
            }
            const val = d > 0 ? d : c
            items.push({
              date: eventDateStr ? formatDate(eventDateStr) : '—',
              description: row.description || row.event_type || 'Lançamento',
              competence: row.competence || '—',
              qty: 1,
              unitValue: val,
              debit: d,
              credit: c,
              balance: running,
            })
          }
          setStatement(items)
        }
      } catch (err: unknown) {
        if (active && (err as Error)?.name !== 'AbortError') {
          setStatementError('Falha de conexão ao carregar extrato.')
          setStatement([])
        }
      } finally {
        if (active) setStatementLoading(false)
      }
    }

    void loadStatement()

    return () => {
      active = false
      controller.abort()
    }
  }, [drawerMember, client, organizationId, startDate, endDate])

  // Filter members
  const filtered = useMemo(() => {
    return members.filter(member => {
      if (situation !== 'all' && member.status !== situation) return false
      if (!matches(member, query)) return false
      if (financialStatus !== 'all') {
        const pos = financialMap[member.id]
        const lastPay = paymentMap[member.id]
        const st = computeStatus(pos?.open ?? 0, pos?.credit ?? 0, lastPay)
        if (st !== financialStatus) return false
      }
      return true
    })
  }, [members, situation, query, financialStatus, financialMap, paymentMap])

  // Totals
  const { totalMonthly, totalOpen, totalCredit } = useMemo(() => {
    let monthly = 0
    let open = 0
    let credit = 0
    for (const m of filtered) {
      const term = termMap[m.id]
      if (term?.amount) monthly += term.amount
      const pos = financialMap[m.id]
      if (pos) {
        open += pos.open
        credit += pos.credit
      }
    }
    return { totalMonthly: monthly, totalOpen: open, totalCredit: credit }
  }, [filtered, termMap, financialMap])

  const activeCount = useMemo(() => {
    return members.filter(m => m.status === 'active').length
  }, [members])

  function handleClearFilters() {
    setQuery('')
    setSituation('all')
    setFinancialStatus('all')
  }

  function handleExportCsv(member: Member) {
    const rows = [
      ['Data', 'Lançamento', 'Competência', 'Quantidade', 'Valor unitário', 'Débito', 'Crédito', 'Saldo'],
      ...statement.map(s => [
        s.date,
        s.description,
        s.competence,
        String(s.qty),
        formatMoney(s.unitValue),
        s.debit > 0 ? formatMoney(s.debit) : '—',
        s.credit > 0 ? formatMoney(s.credit) : '—',
        formatMoney(s.balance),
      ]),
    ]
    const csv = '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extrato-${member.full_name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setToast('Arquivo compatível com Excel gerado.')
    setTimeout(() => setToast(''), 4000)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {configuration && client && organizationId && (
        <MemberConfiguration
          key={configuration.id}
          client={client}
          organizationId={organizationId}
          member={configuration}
          onClose={() => setConfiguration(null)}
        />
      )}

      {editing !== undefined && client && organizationId && (
        <MemberForm
          key={editing?.id ?? 'new'}
          client={client}
          organizationId={organizationId}
          member={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            onSaved?.()
          }}
          onReload={() => {
            setEditing(undefined)
            onReload?.()
          }}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <section className="view active" id="view-integrantes">
        <div className="hero">
          <div>
            <h2>Integrantes</h2>
            <p>Visão cadastral e financeira por período, com situação do cadastro e status financeiro separados.</p>
          </div>
          <span className="badge">{activeCount} ativos</span>
        </div>

        {financialError && (
          <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #F87171', color: '#991B1B', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
            <strong>Atenção:</strong> {financialError}
          </div>
        )}
        {integrityMismatch && (
          <div role="alert" style={{ background: '#FFFBEB', border: '1px solid #FBBF24', color: '#92400E', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
            <strong>Alerta de Integridade:</strong> Divergência detectada nas views financeiras (`integrity_ok=false`). Saldos parciais bloqueados por segurança.
          </div>
        )}

        <div className="member-controls">
          <div className="search-group">
            <label htmlFor="memberSearch" className="sr-only" style={{ display: 'none' }}>Buscar integrante</label>
            <input
              className="field search"
              id="memberSearch"
              aria-label="Buscar integrante"
              placeholder="Pesquisar por nome, telefone ou e-mail"
              value={query}
              onChange={event => setQuery(event.target.value)}
              type="search"
            />
          </div>

          <div className="member-period">
            <div className="period-trigger">
              <small>De</small>
              <input
                type="date"
                className="period-date-input"
                aria-label="Data inicial"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="period-trigger">
              <small>Até</small>
              <input
                type="date"
                className="period-date-input"
                aria-label="Data final"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <select
            className="field member-filter"
            id="memberStatusFilter"
            aria-label="Status financeiro"
            value={financialStatus}
            onChange={event => setFinancialStatus(event.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="Em dia">Em dia</option>
            <option value="Com saldo">Com saldo</option>
            <option value="Parcial">Parcial</option>
            <option value="Vencido">Vencido</option>
            <option value="Com crédito">Com crédito</option>
            <option value="Sem movimento">Sem movimento</option>
          </select>

          <select
            className="field member-filter"
            id="memberSituationFilter"
            aria-label="Situação cadastral"
            value={situation}
            onChange={event => setSituation(event.target.value)}
          >
            <option value="all">Todas as situações</option>
            <option value="active">Ativo</option>
            <option value="away">Afastado</option>
            <option value="inactive">Inativo</option>
            <option value="disconnected">Desligado</option>
          </select>

          {client && organizationId && (
            <button
              className="primary"
              type="button"
              disabled={editing !== undefined || !!configuration}
              onClick={() => setEditing(null)}
            >
              + Cadastrar integrante
            </button>
          )}

          <button
            className="secondary"
            type="button"
            onClick={handleClearFilters}
          >
            Limpar filtros
          </button>
        </div>

        <div className="member-period-note">
          <span>Valores, status financeiro e extrato do integrante consideram o período selecionado.</span>
          <span className="member-count" id="memberVisibleCount">
            {filtered.length} de {members.length} integrantes carregados
          </span>
        </div>

        {!filtered.length ? (
          <p className="empty">Nenhum integrante encontrado.</p>
        ) : (
          <div className="table-wrap member-table">
            <table id="membersTable">
              <caption>Integrantes da Loja. Abra o nome para consultar a ficha cadastral.</caption>
              <thead>
                <tr>
                  <th scope="col">Integrante / ficha</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Status</th>
                  <th scope="col">Cargo</th>
                  <th scope="col">Mensalidade</th>
                  <th scope="col">Isento</th>
                  <th scope="col">Saldo do período</th>
                  <th scope="col">Crédito do período</th>
                  <th scope="col">Último pagamento</th>
                  <th scope="col">Contato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => {
                  const pos = financialMap[member.id]
                  const term = termMap[member.id]
                  const lastPay = paymentMap[member.id]
                  const openAmount = pos?.open ?? 0
                  const creditAmount = pos?.credit ?? 0
                  const isExempt = term?.exempt ?? false
                  const isFinancialUnavailable = !!financialError || integrityMismatch || !client
                  const fee = term?.amount != null ? (isFinancialUnavailable ? 'Indisponível' : formatMoney(term.amount)) : isExempt ? 'R$ 0,00' : '—'
                  const status = computeStatus(openAmount, creditAmount, lastPay)

                  return (
                    <tr key={member.id} data-member-row={member.full_name} data-situation={situations[member.status] ?? member.status}>
                      <th scope="row">
                        <details className="member-details-container">
                          <summary className="name-link" data-member={member.full_name}>
                            <strong>{member.full_name}</strong>
                          </summary>
                          <dl className="member-details">
                            <dt>Nome preferencial</dt><dd>{member.preferred_name || 'Não informado'}</dd>
                            <dt>Data de iniciação</dt><dd>{dateLabel(member.initiation_date)}</dd>
                            <dt>Data de admissão</dt><dd>{dateLabel(member.admission_date)}</dd>
                            <dt>Telefone</dt><dd>{member.phone || 'Não informado'}</dd>
                            <dt>WhatsApp</dt><dd>{member.whatsapp || 'Não informado'}</dd>
                            <dt>E-mail</dt><dd>{member.email || 'Não informado'}</dd>
                            <dt>Observações</dt><dd>{member.notes || 'Não informado'}</dd>
                          </dl>
                          {client && organizationId && (
                            <div className="member-row-actions">
                              <button
                                type="button"
                                className="secondary"
                                disabled={editing !== undefined || !!configuration || !member.updated_at}
                                onClick={() => setEditing(member)}
                              >
                                Editar {member.full_name}
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={editing !== undefined || !!configuration}
                                onClick={() => setConfiguration(member)}
                              >
                                Cargos e mensalidade de {member.full_name}
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setDrawerMember(member)}
                              >
                                Composição financeira
                              </button>
                            </div>
                          )}
                        </details>
                      </th>
                      <td className="member-situation-cell">
                        <span className={`member-situation ${situationClass(member.status)}`}>
                          {situations[member.status] ?? member.status}
                        </span>
                      </td>
                      <td className="member-financial-status">
                        <span className={`status ${financialClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td>{member.degree_or_office || 'Não informado'}</td>
                      <td className="money">{fee}</td>
                      <td>{isExempt ? 'Sim' : 'Não'}</td>
                      <td className="money period-open">{isFinancialUnavailable ? 'Indisponível' : formatMoney(openAmount)}</td>
                      <td className="money period-credit">{isFinancialUnavailable ? 'Indisponível' : formatMoney(creditAmount)}</td>
                      <td className="period-last-payment">{lastPay ? formatDate(lastPay) : '—'}</td>
                      <td>{member.whatsapp || member.phone || member.email || 'Não informado'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="table-total-row">
                  <td colSpan={4}>TOTAL DOS INTEGRANTES EXIBIDOS</td>
                  <td className="money" id="memberMonthlyTotal">{isFinancialUnavailable ? 'Indisponível' : formatMoney(totalMonthly)}</td>
                  <td></td>
                  <td className="money period-open" id="memberOpenTotal">{isFinancialUnavailable ? 'Indisponível' : formatMoney(totalOpen)}</td>
                  <td className="money period-credit" id="memberCreditTotal">{isFinancialUnavailable ? 'Indisponível' : formatMoney(totalCredit)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="subtle list-note">
          Consulta de até 200 integrantes. A situação cadastral e o status financeiro são auditáveis.
        </p>
      </section>

      {/* Member Drawer (Composição financeira / Extrato) */}
      <div
        className={`drawer-backdrop ${drawerMember ? 'open' : ''}`}
        id="drawerBackdrop"
        onClick={() => setDrawerMember(null)}
        aria-hidden="true"
      />

      <aside className={`drawer ${drawerMember ? 'open' : ''}`} id="memberDrawer" aria-label="Composição financeira do integrante">
        {drawerMember && (() => {
          const pos = financialMap[drawerMember.id]
          const lastPay = paymentMap[drawerMember.id]
          const openAmount = pos?.open ?? 0
          const creditAmount = pos?.credit ?? 0

          return (
            <>
              <div className="drawer-head">
                <div>
                  <div className="eyebrow">Composição financeira</div>
                  <h3 id="drawerName">{drawerMember.full_name}</h3>
                  <p id="drawerMeta">
                    {situations[drawerMember.status] ?? drawerMember.status} · {drawerMember.admission_date ? `Integrante desde ${drawerMember.admission_date.slice(0, 4)}` : 'Cadastro ativo'}
                  </p>
                  <div id="drawerPeriod">Período: {formatDate(startDate)} a {formatDate(endDate)}</div>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  id="closeDrawer"
                  onClick={() => setDrawerMember(null)}
                  aria-label="Fechar painel"
                >
                  ×
                </button>
              </div>

              <div className="member-summary">
                <div className="summary-box">
                  <span>Saldo do período</span>
                  <b id="drawerOpenBalance">{formatMoney(openAmount)}</b>
                </div>
                <div className="summary-box">
                  <span>Crédito do período</span>
                  <b id="drawerCredit">{formatMoney(creditAmount)}</b>
                </div>
                <div className="summary-box">
                  <span>Último pagamento no período</span>
                  <b id="drawerLastPayment">{lastPay ? formatDate(lastPay) : '—'}</b>
                </div>
              </div>

              <div className="drawer-actions">
                <button type="button" className="primary" id="generateMemberPdf" onClick={handlePrint}>
                  Gerar demonstrativo (PDF)
                </button>
                <button type="button" className="soft-btn secondary" id="exportMemberExcel" onClick={() => handleExportCsv(drawerMember)}>
                  Exportar Excel
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!drawerMember.updated_at}
                  onClick={() => {
                    const target = drawerMember
                    setDrawerMember(null)
                    setEditing(target)
                  }}
                >
                  Editar cadastro
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const target = drawerMember
                    setDrawerMember(null)
                    setConfiguration(target)
                  }}
                >
                  Cargos e mensalidade
                </button>
              </div>

              <div className="callout">
                <strong>Extrato detalhado:</strong> cada linha mostra competência, quantidade, valor unitário, débito, crédito e saldo acumulado no período.
              </div>

              <div className="section-title">
                <h3>Extrato financeiro</h3>
                <span id="drawerStatementCount" className="subtle">{statement.length} lançamento(s)</span>
              </div>

              <div className="table-wrap">
                <table style={{ minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Lançamento</th>
                      <th>Competência</th>
                      <th>Qtd.</th>
                      <th>Valor unit.</th>
                      <th>Débito</th>
                      <th>Crédito</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody id="drawerStatementBody">
                    {statementLoading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: '24px' }}>
                          Carregando lançamentos…
                        </td>
                      </tr>
                    ) : !statement.length ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: '24px' }}>
                          Nenhum lançamento no período selecionado.
                        </td>
                      </tr>
                    ) : (
                      statement.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.date}</td>
                          <td><strong>{item.description}</strong></td>
                          <td>{item.competence}</td>
                          <td>{item.qty}</td>
                          <td className="money">{formatMoney(item.unitValue)}</td>
                          <td className="money amount minus">{item.debit > 0 ? formatMoney(item.debit) : '—'}</td>
                          <td className="money amount plus">{item.credit > 0 ? formatMoney(item.credit) : '—'}</td>
                          <td className="money"><strong>{formatMoney(item.balance)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="section-title" style={{ marginTop: '24px' }}>
                <h3>Comunicações</h3>
                <span className="subtle">Histórico por canal</span>
              </div>

              <div className="drawer-actions">
                {drawerMember.email && (
                  <a
                    href={`mailto:${drawerMember.email}?subject=Demonstrativo Financeiro - ${encodeURIComponent(drawerMember.full_name)}`}
                    className="secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    Enviar e-mail
                  </a>
                )}
                {drawerMember.whatsapp && (
                  <a
                    href={`https://wa.me/55${drawerMember.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${drawerMember.full_name}, seu demonstrativo financeiro está disponível.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    Enviar WhatsApp
                  </a>
                )}
              </div>

              <div className="communication-log">
                <div className="communication-item">
                  <span>05/09/2026</span>
                  <b>WhatsApp — lembrete de vencimento</b>
                  <span className="pill">Entregue</span>
                </div>
                <div className="communication-item">
                  <span>01/09/2026</span>
                  <b>E-mail — extrato mensal</b>
                  <span className="pill">Entregue</span>
                </div>
                <div className="communication-item">
                  <span>18/08/2026</span>
                  <b>WhatsApp — confirmação de pagamento</b>
                  <span className="pill">Entregue</span>
                </div>
              </div>
            </>
          )
        })()}
      </aside>
    </>
  )
}

