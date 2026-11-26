import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAccountingCatalog, loadAccountingDetail, type Catalog, type Detail } from '../lib/accounting-plans'
import {
  ACCOUNTING_ROLE_LABELS,
  loadAccountingPlanRoleMappings,
  saveAccountingPlanRoleMapping,
  type AccountingPlanRoleMapping,
  type AccountingRoleCode,
} from '../lib/accounting-books'

const ALL_ROLES = Object.keys(ACCOUNTING_ROLE_LABELS) as AccountingRoleCode[]

function isAccountEligibleForRole(role: AccountingRoleCode, nature: string, rowType: string, active: boolean): boolean {
  if (!active || rowType !== 'analytic') return false
  if (role === 'revenue_deduction') return nature === 'revenue'
  if (role === 'financial_fee_expense') return nature === 'expense' || nature === 'financial_result'
  return nature === 'patrimonial'
}

export function AccountingRoleMappings({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [roleMappings, setRoleMappings] = useState<AccountingPlanRoleMapping[]>([])
  const [selectedRole, setSelectedRole] = useState<AccountingRoleCode>('member_receivable_control')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [reason, setReason] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const pendingCmd = useRef<Parameters<typeof saveAccountingPlanRoleMapping>[1] | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    let live = true
    setCatalog(null)
    setDetail(null)
    setRoleMappings([])
    setError('')
    setLoading(true)

    loadAccountingCatalog(client, organizationId, abort.signal)
      .then(data => {
        if (!live) return
        setCatalog(data)
        setSelectedPlanId(prev =>
          data.plans.some(p => p.id === prev)
            ? prev
            : data.plans.find(p => p.status === 'draft')?.id ?? data.plans[0]?.id ?? '',
        )
      })
      .catch(() => {
        if (live) setError('Não foi possível carregar os planos contábeis da Loja.')
      })
      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
      abort.abort()
    }
  }, [client, organizationId, revision])

  useEffect(() => {
    if (!selectedPlanId || !catalog?.plans.some(p => p.id === selectedPlanId)) return
    const abort = new AbortController()
    let live = true
    setDetail(null)
    setRoleMappings([])
    setSelectedAccountId('')
    setError('')

    Promise.all([
      loadAccountingDetail(client, organizationId, selectedPlanId, abort.signal),
      loadAccountingPlanRoleMappings(client, organizationId, selectedPlanId, abort.signal),
    ])
      .then(([d, roles]) => {
        if (!live) return
        setDetail(d)
        setRoleMappings(roles)
      })
      .catch(() => {
        if (live) setError('Não foi possível carregar os papéis contábeis do plano selecionado.')
      })

    return () => {
      live = false
      abort.abort()
    }
  }, [client, organizationId, selectedPlanId, catalog])

  const selectedPlan = catalog?.plans.find(p => p.id === selectedPlanId)
  const existingRole = roleMappings.find(m => m.role_code === selectedRole)
  const eligibleAccounts = (detail?.accounts ?? []).filter(a =>
    isAccountEligibleForRole(selectedRole, a.nature, a.row_type, a.active),
  )

  async function executeSave(cmd: Parameters<typeof saveAccountingPlanRoleMapping>[1]) {
    if (saving || conflict) return
    pendingCmd.current = pendingCmd.current ?? cmd
    setSaving(true)
    setError('')
    setSavedMessage('')

    try {
      await saveAccountingPlanRoleMapping(client, pendingCmd.current)
      if (!mounted.current) return
      pendingCmd.current = null
      setUncertain(false)
      setReason('')
      setSavedMessage('Papel contábil salvo com trilha de auditoria.')
      setRevision(v => v + 1)
    } catch (cause) {
      if (!mounted.current) return
      const code = (cause as { code?: string } | null)?.code ?? ''
      if (['22023', '23503', '23514', '40001', 'PT409', '42501', '28000', '55000'].includes(code)) {
        pendingCmd.current = null
        setUncertain(false)
        setConflict(code === '40001' || code === 'PT409')
        setError(
          code === '40001' || code === 'PT409'
            ? 'O papel contábil foi alterado em outra sessão. Atualize o plano antes de tentar novamente.'
            : code === '55000'
              ? 'Plano publicado é imutável. Crie um sucessor em rascunho para alterar papéis contábeis.'
              : code === '42501' || code === '28000'
                ? 'Acesso negado para alterar papéis contábeis.'
                : 'Conta incompatível com a natureza exigida para o papel contábil.',
        )
      } else {
        setUncertain(true)
        setError('Resultado não confirmado. Use Verificar envio para reenviar com segurança sem duplicar.')
      }
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || uncertain || conflict || selectedPlan?.status !== 'draft' || !selectedAccountId) return
    void executeSave({
      organizationId,
      planId: selectedPlanId,
      roleCode: selectedRole,
      accountingAccountId: selectedAccountId,
      expectedAccountId: existingRole?.accounting_account_id ?? null,
      reason: reason.trim(),
      idempotencyKey: crypto.randomUUID(),
    })
  }

  return (
    <section className="panel" aria-label="Papéis contábeis do Anexo III">
      <div className="section-title">
        <h3>Papéis Contábeis Estruturais (Anexo III)</h3>
        <button
          type="button"
          className="secondary"
          disabled={loading || saving || uncertain}
          onClick={() => {
            setConflict(false)
            setSavedMessage('')
            setRevision(v => v + 1)
          }}
        >
          Atualizar
        </button>
      </div>

      <p className="subtle">
        Vínculo explícito entre contas analíticas do plano e os papéis de contrapartida do Diário, Razão e Deduções de Receita.
        Planos sem estes vínculos permanecem bloqueados para emissão do selo Integral; nenhuma contrapartida é inventada automaticamente.
      </p>

      {error && <p role="alert" className="message error">{error}</p>}
      {savedMessage && <p role="status" className="message success">{savedMessage}</p>}
      {uncertain && (
        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={() => {
            if (pendingCmd.current) void executeSave(pendingCmd.current)
          }}
        >
          Verificar envio
        </button>
      )}

      {catalog && catalog.plans.length > 0 && (
        <>
          <div style={{ margin: '1rem 0' }}>
            <label htmlFor="role-plan-select">Plano contábil</label>
            <select
              id="role-plan-select"
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
            >
              {catalog.plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.status === 'published' ? 'Publicado (somente leitura)' : 'Rascunho'} ({p.valid_from.slice(0, 7)} a {p.valid_to.slice(0, 7)})
                </option>
              ))}
            </select>
          </div>

          <div className="finance-table" role="region" aria-label="Mapa de papéis contábeis" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Papel Contábil</th>
                  <th>Conta Analítica Vinculada</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ROLES.map(role => {
                  const mapped = roleMappings.find(m => m.role_code === role)
                  const acc = detail?.accounts.find(a => a.id === mapped?.accounting_account_id)
                  return (
                    <tr key={role}>
                      <td>{ACCOUNTING_ROLE_LABELS[role]}</td>
                      <td>{acc ? `${acc.code} — ${acc.description}` : 'Não mapeado'}</td>
                      <td>
                        <span className={`pill ${acc ? 'success' : 'warning'}`}>
                          {acc ? 'Mapeado' : 'Pendente validação contábil'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selectedPlan?.status === 'draft' && (
            <form aria-label="Configurar papel contábil" onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
              <fieldset disabled={saving || uncertain || conflict}>
                <legend>Configurar vínculo de papel contábil (rascunho)</legend>
                <div className="member-form-grid">
                  <div>
                    <label htmlFor="role-code-select">Papel estrutural</label>
                    <select
                      id="role-code-select"
                      value={selectedRole}
                      onChange={e => {
                        setSelectedRole(e.target.value as AccountingRoleCode)
                        setSelectedAccountId('')
                      }}
                    >
                      {ALL_ROLES.map(role => (
                        <option key={role} value={role}>
                          {ACCOUNTING_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="role-account-select">Conta contábil analítica compatível</label>
                    <select
                      id="role-account-select"
                      value={selectedAccountId}
                      onChange={e => setSelectedAccountId(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {eligibleAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} — {acc.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="role-reason-input">Justificativa / Parecer</label>
                    <input
                      id="role-reason-input"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder="Ex.: Validação contábil conforme Anexo III"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="primary"
                  disabled={saving || uncertain || conflict || !selectedAccountId}
                >
                  {saving ? 'Salvando…' : 'Salvar papel contábil'}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  )
}
