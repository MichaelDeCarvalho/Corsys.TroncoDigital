import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDate, formatMoney } from '../lib/finance-data'
import { loadPlatformCommercialCatalog, type PlatformPlanVersion } from '../lib/master-commercial'
import {
  applyScheduledSaasPlanChange,
  cancelSaasSubscription,
  cancelScheduledSaasChange,
  confirmSaasSubscriptionHiring,
  loadSubscriptionLifecycleBundle,
  markSaasSubscriptionPastDue,
  reactivateSaasSubscription,
  recordSaasCollectionEvent,
  scheduleSaasPlanChange,
  suspendSaasSubscriptionManual,
  type SubscriptionLifecycleBundle,
} from '../lib/master-subscriptions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LifecycleCommand = {
  key: string
  label: string
  run: () => Promise<string>
}

const statusLabels: Record<string, string> = {
  trialing: 'Em avaliação (Trial)',
  active: 'Ativa',
  past_due: 'Em atraso',
  suspended: 'Suspensa',
  cancel_scheduled: 'Cancelamento agendado',
  canceled: 'Cancelada',
}

export function MasterSubscriptionLifecyclePanel({
  client,
  organizationId,
  onChanged,
}: {
  client: SupabaseClient
  organizationId: string
  onChanged?: () => void
}) {
  const [bundle, setBundle] = useState<SubscriptionLifecycleBundle | null>(null)
  const [publishedPlans, setPublishedPlans] = useState<PlatformPlanVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)

  const [actionTab, setActionTab] = useState<'commercial' | 'delinquency' | 'cancel'>('commercial')
  const [hiringPlanVersionId, setHiringPlanVersionId] = useState('')
  const [hiringPriceOverride, setHiringPriceOverride] = useState('')
  const [hiringReason, setHiringReason] = useState('')

  const [targetPlanVersionId, setTargetPlanVersionId] = useState('')
  const [planChangeReason, setPlanChangeReason] = useState('')

  const [collectionEventType, setCollectionEventType] = useState<'reminder_scheduled' | 'reminder_sent' | 'payment_attempt'>('reminder_sent')
  const [collectionChannel, setCollectionChannel] = useState('email')
  const [collectionNote, setCollectionNote] = useState('')
  const [delinquencyReason, setDelinquencyReason] = useState('')

  const [cancelImmediate, setCancelImmediate] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [opError, setOpError] = useState('')
  const [opSuccess, setOpSuccess] = useState('')
  const pendingCmd = useRef<LifecycleCommand | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setLoading(true)
    setLoadError('')
    Promise.all([
      loadSubscriptionLifecycleBundle(client, organizationId, controller.signal),
      loadPlatformCommercialCatalog(client, controller.signal),
    ])
      .then(([b, cat]) => {
        if (!live) return
        setBundle(b)
        const published = cat.plans.filter((p) => p.publication_status === 'published' && p.plan_active)
        setPublishedPlans(published)
        if (!hiringPlanVersionId && published.length > 0) {
          setHiringPlanVersionId(published[0].plan_version_id)
        }
        if (!targetPlanVersionId && published.length > 0) {
          setTargetPlanVersionId(published[0].plan_version_id)
        }
      })
      .catch((err: unknown) => {
        if (!live || controller.signal.aborted) return
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os dados do ciclo contratual.')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
      controller.abort()
    }
  }, [client, organizationId, revision])

  async function executeIdempotent(cmd: LifecycleCommand) {
    if (busy.current) return
    pendingCmd.current = pendingCmd.current ?? cmd
    const current = pendingCmd.current
    busy.current = true
    setPending(true)
    setOpError('')
    setOpSuccess('')
    try {
      const resultId = await current.run()
      if (!UUID_RE.test(resultId)) {
        throw new Error('Identificador de confirmação inválido.')
      }
      if (!mounted.current) return
      pendingCmd.current = null
      setUncertain(false)
      setOpSuccess(`${current.label} confirmada (${resultId.slice(0, 8)}).`)
      setHiringReason('')
      setPlanChangeReason('')
      setCollectionNote('')
      setDelinquencyReason('')
      setCancelReason('')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (err: unknown) {
      if (!mounted.current) return
      const errObj = err as { code?: string; message?: string } | null
      const code = errObj?.code ?? ''
      const msg = err instanceof Error ? err.message : (errObj?.message || 'Falha ao executar comando comercial.')
      if (['22023', '23503', '23505', '23514', '42501', '28000', '55000'].includes(code)) {
        pendingCmd.current = null
        setUncertain(false)
        setOpError(msg)
      } else {
        setUncertain(true)
        setOpError(`Resultado não confirmado (${msg}). Use Verificar envio para reenviar com a mesma chave de idempotência.`)
      }
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  const cs = bundle?.commercialStatus
  const seats = bundle?.seatUsage
  const openScheduled = useMemo(
    () => (bundle?.scheduledChanges ?? []).filter((c) => c.status === 'scheduled'),
    [bundle?.scheduledChanges],
  )

  if (loading && !bundle) {
    return <p role="status" className="message">Carregando ciclo comercial e termos da assinatura…</p>
  }

  if (loadError && !bundle) {
    return (
      <div className="panel" role="alert">
        <p className="message error">{loadError}</p>
        <button type="button" className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!bundle || !cs || !seats) return null

  return (
    <section className="panel space-y-4" aria-label="Gestão do ciclo comercial SaaS" style={{ marginTop: '1rem' }}>
      <div className="section-title">
        <h4>Ciclo comercial, assentos e inadimplência (C01–C05)</h4>
        <button type="button" className="secondary" disabled={pending || loading} onClick={() => setRevision((v) => v + 1)}>
          Atualizar ciclo
        </button>
      </div>

      {opSuccess && <p role="status" className="message success">{opSuccess}</p>}
      {opError && <p role="alert" className="message error">{opError}</p>}
      {uncertain && pendingCmd.current && (
        <button
          type="button"
          className="secondary"
          disabled={pending}
          onClick={() => { if (pendingCmd.current) void executeIdempotent(pendingCmd.current) }}
        >
          Verificar envio
        </button>
      )}

      {/* Key KPIs */}
      <div className="metric-grid" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <article className="panel metric">
          <p>Status comercial / assinatura</p>
          <strong>{statusLabels[cs.subscription_status ?? ''] ?? cs.subscription_status ?? 'Sem assinatura'}</strong>
          <span className="subtle">Escrita da Loja: {cs.write_allowed ? 'Liberada' : 'Bloqueada (leitura e suporte ativos)'}</span>
        </article>
        <article className="panel metric">
          <p>Assentos ativos (C07)</p>
          <strong className="tabular-nums">
            {seats.active_users} / {seats.max_admin_users ?? 'Ilimitado'}
          </strong>
          <span className="subtle">
            {seats.max_admin_users === null
              ? 'Sem limite configurado'
              : seats.over_limit
                ? 'Acima do limite contratado'
                : `${seats.seats_remaining ?? 0} disponíveis (exclui MASTER/SUPPORT)`}
          </span>
        </article>
        <article className="panel metric">
          <p>Valor contratual vigente</p>
          <strong className="tabular-nums">
            {cs.contract_price !== null ? formatMoney(Number(cs.contract_price)) : '—'}
          </strong>
          <span className="subtle">Vencimento padrão dia {cs.billing_anchor_day ?? 10}</span>
        </article>
        <article className="panel metric">
          <p>Tolerância / Exportação D01</p>
          <strong className="tabular-nums">
            {cs.grace_until ? `Até ${formatDate(cs.grace_until)}` : cs.export_window_until ? `D01 ${formatDate(cs.export_window_until)}` : 'Normal'}
          </strong>
          <span className="subtle">Em atraso: {formatMoney(Number(cs.overdue_amount))}</span>
        </article>
      </div>

      {/* Scheduled Changes Table */}
      {openScheduled.length > 0 && (
        <div className="panel space-y-2">
          <h5>Alterações programadas</h5>
          <div className="finance-table" role="region" aria-label="Alterações agendadas da assinatura" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Vigência prevista</th>
                  <th>Motivo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {openScheduled.map((sc) => (
                  <tr key={sc.id}>
                    <td>{sc.change_type}</td>
                    <td className="tabular-nums">{formatDate(sc.effective_at)}</td>
                    <td>{sc.reason}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {sc.change_type === 'plan_change' && (
                          <button
                            type="button"
                            className="secondary"
                            disabled={pending || uncertain}
                            onClick={() => {
                              const key = `apply-sched:${sc.id}:${crypto.randomUUID()}`
                              void executeIdempotent({
                                key,
                                label: 'Efetivação da troca de plano agendada',
                                run: () => applyScheduledSaasPlanChange(client, {
                                  organizationId,
                                  changeId: sc.id,
                                  reason: 'Efetivação da troca agendada pelo Master',
                                  idempotencyKey: key,
                                }),
                              })
                            }}
                          >
                            Efetivar agora
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          disabled={pending || uncertain}
                          onClick={() => {
                            const key = `cancel-sched:${sc.id}:${crypto.randomUUID()}`
                            void executeIdempotent({
                              key,
                              label: 'Cancelamento do agendamento comercial',
                              run: () => cancelScheduledSaasChange(client, {
                                organizationId,
                                changeId: sc.id,
                                reason: 'Cancelamento de alteração agendada pelo Master',
                                idempotencyKey: key,
                              }),
                            })
                          }}
                        >
                          Cancelar agendamento
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Sub-tabs */}
      <div className="finance-sections" role="group" aria-label="Ações comerciais da assinatura">
        <button type="button" className={actionTab === 'commercial' ? 'primary' : 'secondary'} onClick={() => setActionTab('commercial')}>
          Contratação e planos (C02/C05)
        </button>
        <button type="button" className={actionTab === 'delinquency' ? 'primary' : 'secondary'} onClick={() => setActionTab('delinquency')}>
          Cobrança, tolerância e suspensão (C03)
        </button>
        <button type="button" className={actionTab === 'cancel' ? 'primary' : 'secondary'} onClick={() => setActionTab('cancel')}>
          Cancelamento e janela D01
        </button>
      </div>

      {actionTab === 'commercial' && (
        <div className="space-y-4">
          {cs.subscription_status === 'trialing' && (
            <form
              aria-label="Confirmar contratação expressa"
              className="panel space-y-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                if (pending || uncertain) return
                const parsedOverride = hiringPriceOverride.trim()
                  ? Number(hiringPriceOverride.trim().replace(',', '.'))
                  : null
                const key = `hire:${organizationId}:${crypto.randomUUID()}`
                void executeIdempotent({
                  key,
                  label: 'Contratação expressa confirmada (1º ciclo pago no dia 1º do próximo mês)',
                  run: () => confirmSaasSubscriptionHiring(client, {
                    organizationId,
                    planVersionId: hiringPlanVersionId,
                    contractPrice: parsedOverride,
                    reason: hiringReason,
                    idempotencyKey: key,
                  }),
                })
              }}
            >
              <h5>Confirmar contratação expressa (Trial → Ativa · C02)</h5>
              <p className="subtle">
                Encerra o período de avaliação no mês corrente e inicia o 1º ciclo pago no dia 1º do próximo mês, sem retroagir.
              </p>
              <div className="member-form-grid">
                <div>
                  <label htmlFor="m04-hire-plan">Versão publicada do plano</label>
                  <select id="m04-hire-plan" value={hiringPlanVersionId} onChange={(e) => setHiringPlanVersionId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {publishedPlans.map((p) => (
                      <option key={p.plan_version_id} value={p.plan_version_id}>
                        {p.display_name_snapshot} (v{p.version_number}) — R$ {p.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="m04-hire-price">Preço contratual (opcional, padrão do plano)</label>
                  <input id="m04-hire-price" value={hiringPriceOverride} onChange={(e) => setHiringPriceOverride(e.target.value)} placeholder="125,00" />
                </div>
                <div>
                  <label htmlFor="m04-hire-reason">Motivo / justificativa</label>
                  <input id="m04-hire-reason" value={hiringReason} onChange={(e) => setHiringReason(e.target.value)} minLength={3} required placeholder="Aceite comercial da diretoria" />
                </div>
              </div>
              <button type="submit" className="primary" disabled={pending || uncertain || !hiringPlanVersionId || hiringReason.trim().length < 3}>
                Confirmar contratação paga
              </button>
            </form>
          )}

          <form
            aria-label="Agendar troca de plano"
            className="panel space-y-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (pending || uncertain) return
              const key = `sched-plan:${organizationId}:${crypto.randomUUID()}`
              void executeIdempotent({
                key,
                label: 'Agendamento de alteração prospectiva de plano',
                run: () => scheduleSaasPlanChange(client, {
                  organizationId,
                  targetPlanVersionId,
                  reason: planChangeReason,
                  idempotencyKey: key,
                }),
              })
            }}
          >
            <h5>Agendar upgrade / downgrade prospectivo (dia 1º do próximo mês · C05)</h5>
            <p className="subtle">
              Preserva faturas e termos históricos anteriores. Se o plano destino tiver limite menor que os {seats.active_users} usuários ativos, o downgrade é bloqueado no servidor.
            </p>
            <div className="member-form-grid">
              <div>
                <label htmlFor="m04-sched-plan">Plano destino publicado</label>
                <select id="m04-sched-plan" value={targetPlanVersionId} onChange={(e) => setTargetPlanVersionId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {publishedPlans.map((p) => (
                    <option key={p.plan_version_id} value={p.plan_version_id}>
                      {p.display_name_snapshot} (v{p.version_number}) — R$ {p.price}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="m04-sched-reason">Motivo da mudança</label>
                <input id="m04-sched-reason" value={planChangeReason} onChange={(e) => setPlanChangeReason(e.target.value)} minLength={3} required placeholder="Solicitação de ampliação ou redução de assentos" />
              </div>
            </div>
            <button type="submit" className="primary" disabled={pending || uncertain || !targetPlanVersionId || planChangeReason.trim().length < 3}>
              Agendar alteração para o próximo mês
            </button>
          </form>
        </div>
      )}

      {actionTab === 'delinquency' && (
        <div className="space-y-4">
          <form
            aria-label="Registrar aviso de cobrança"
            className="panel space-y-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (pending || uncertain) return
              const key = `coll:${organizationId}:${crypto.randomUUID()}`
              void executeIdempotent({
                key,
                label: 'Registro de evento manual de cobrança',
                run: () => recordSaasCollectionEvent(client, {
                  organizationId,
                  eventType: collectionEventType,
                  channel: collectionChannel,
                  note: collectionNote,
                  idempotencyKey: key,
                }),
              })
            }}
          >
            <h5>Notificação / histórico manual de cobrança</h5>
            <div className="member-form-grid">
              <div>
                <label htmlFor="m04-coll-type">Evento</label>
                <select id="m04-coll-type" value={collectionEventType} onChange={(e) => setCollectionEventType(e.target.value as 'reminder_scheduled' | 'reminder_sent' | 'payment_attempt')}>
                  <option value="reminder_sent">Aviso enviado</option>
                  <option value="reminder_scheduled">Lembrete agendado</option>
                  <option value="payment_attempt">Contato de cobrança / tentativa</option>
                </select>
              </div>
              <div>
                <label htmlFor="m04-coll-channel">Canal</label>
                <input id="m04-coll-channel" value={collectionChannel} onChange={(e) => setCollectionChannel(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="m04-coll-note">Observação (opcional)</label>
                <input id="m04-coll-note" value={collectionNote} onChange={(e) => setCollectionNote(e.target.value)} placeholder="Aviso enviado ao financeiro da Loja" />
              </div>
            </div>
            <button type="submit" className="secondary" disabled={pending || uncertain || collectionChannel.trim().length < 2}>
              Registrar contato de cobrança
            </button>
          </form>

          <div className="panel space-y-3">
            <h5>Controle manual de inadimplência, suspensão e reativação (C03)</h5>
            <p className="subtle">
              Nunca há suspensão automática. A suspensão exige fatura vencida em aberto e prazo de tolerância de 7 dias corridos encerrado. A reativação exige quitação ou acordo ativo.
            </p>
            <label htmlFor="m04-delinquency-reason">Motivo auditável</label>
            <input id="m04-delinquency-reason" value={delinquencyReason} onChange={(e) => setDelinquencyReason(e.target.value)} minLength={3} placeholder="Ex.: Fatura em atraso após notificação formal" />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="secondary"
                disabled={pending || uncertain || delinquencyReason.trim().length < 3}
                onClick={() => {
                  const key = `pastdue:${organizationId}:${crypto.randomUUID()}`
                  void executeIdempotent({
                    key,
                    label: 'Marcação de inadimplência com janela de 7 dias',
                    run: () => markSaasSubscriptionPastDue(client, { organizationId, reason: delinquencyReason, idempotencyKey: key }),
                  })
                }}
              >
                Marcar em atraso (7 dias de tolerância)
              </button>
              <button
                type="button"
                className="secondary"
                disabled={pending || uncertain || delinquencyReason.trim().length < 3}
                onClick={() => {
                  const key = `suspend:${organizationId}:${crypto.randomUUID()}`
                  void executeIdempotent({
                    key,
                    label: 'Suspensão manual da assinatura',
                    run: () => suspendSaasSubscriptionManual(client, { organizationId, reason: delinquencyReason, idempotencyKey: key }),
                  })
                }}
              >
                Suspender manualmente (somente leitura)
              </button>
              <button
                type="button"
                className="primary"
                disabled={pending || uncertain || delinquencyReason.trim().length < 3}
                onClick={() => {
                  const key = `reactivate:${organizationId}:${crypto.randomUUID()}`
                  void executeIdempotent({
                    key,
                    label: 'Reativação da assinatura',
                    run: () => reactivateSaasSubscription(client, { organizationId, reason: delinquencyReason, idempotencyKey: key }),
                  })
                }}
              >
                Reativar assinatura
              </button>
            </div>
          </div>
        </div>
      )}

      {actionTab === 'cancel' && (
        <form
          aria-label="Cancelar assinatura SaaS"
          className="panel space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (pending || uncertain) return
            const key = `cancel:${organizationId}:${crypto.randomUUID()}`
            void executeIdempotent({
              key,
              label: cancelImmediate ? 'Cancelamento imediato (janela D01 de 90 dias aberta)' : 'Cancelamento agendado ao fim do mês',
              run: () => cancelSaasSubscription(client, {
                organizationId,
                immediate: cancelImmediate,
                reason: cancelReason,
                idempotencyKey: key,
              }),
            })
          }}
        >
          <h5>Encerramento da assinatura (C05 / D01)</h5>
          <p className="subtle">
            Ao cancelar ao fim do período, a Loja continua usando o sistema até o encerramento do mês vigente. No cancelamento imediato, as escritas cessam e inicia-se a janela de 90 dias para exportação (D01).
          </p>
          <label>
            <input type="checkbox" checked={cancelImmediate} onChange={(e) => setCancelImmediate(e.target.checked)} /> Cancelamento imediato (bloqueia escrita agora e abre janela de exportação de 90 dias)
          </label>
          <div>
            <label htmlFor="m04-cancel-reason">Justificativa obrigatória</label>
            <input id="m04-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} minLength={3} required placeholder="Solicitação formal da Loja ou encerramento contratual" />
          </div>
          <button type="submit" className="secondary" disabled={pending || uncertain || cancelReason.trim().length < 3}>
            {cancelImmediate ? 'Confirmar cancelamento imediato' : 'Agendar cancelamento ao fim do período'}
          </button>
        </form>
      )}

      {/* Historical Price Terms */}
      <div className="panel space-y-2">
        <h5>Histórico de vigências contratuais de preço</h5>
        {!bundle.priceTerms.length ? (
          <p className="subtle">Nenhum termo contratual registrado.</p>
        ) : (
          <div className="finance-table" role="region" aria-label="Termos históricos de preço" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Início</th>
                  <th>Fim</th>
                  <th className="text-right">Valor</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {bundle.priceTerms.map((t) => (
                  <tr key={t.id}>
                    <td className="tabular-nums">{formatDate(t.effective_from)}</td>
                    <td className="tabular-nums">{t.effective_to ? formatDate(t.effective_to) : 'Vigente'}</td>
                    <td className="text-right tabular-nums">{formatMoney(Number(t.unit_price))}</td>
                    <td>{t.adjustment_reason || 'Contrato'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collection Events */}
      {bundle.collectionEvents.length > 0 && (
        <div className="panel space-y-2">
          <h5>Eventos de cobrança registrados</h5>
          <div className="finance-table" role="region" aria-label="Histórico de cobrança SaaS" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Canal</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {bundle.collectionEvents.map((ev) => (
                  <tr key={String(ev.id)}>
                    <td className="tabular-nums">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>{ev.event_type}</td>
                    <td>{ev.channel || '—'}</td>
                    <td>{typeof ev.metadata?.note === 'string' ? ev.metadata.note : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
