import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PrepublicationReport = {
  plan_id: string
  status: 'draft'
  ready: boolean
  issues: string[]
  account_count: number
  analytic_account_count: number
  active_category_count: number
  missing_category_count: number
  active_financial_account_count: number
  missing_financial_account_count: number
  invalid_category_mapping_count: number
  invalid_financial_mapping_count: number
  invalid_hierarchy_count: number
  hierarchy_cycle_count: number
  overlapping_published_plan_count: number
}

const issues: Record<string, string> = {
  not_draft: 'O plano não é mais um rascunho.',
  nonfuture_start: 'A vigência precisa começar em uma competência futura.',
  published_overlap: 'A vigência se sobrepõe à de um plano já publicado.',
  empty_chart: 'O plano ainda não possui contas contábeis.',
  no_active_analytic: 'Não há conta analítica ativa para classificação.',
  invalid_hierarchy: 'A hierarquia contém contas-filhas sob uma conta analítica ou de natureza diferente.',
  hierarchy_cycle: 'A hierarquia contábil contém referência circular.',
  categories_unmapped: 'Existem categorias financeiras ativas sem vínculo contábil.',
  cash_accounts_unmapped: 'Existem contas financeiras ativas sem vínculo patrimonial.',
  invalid_category_mappings: 'Há categorias vinculadas a contas contábeis inválidas ou inativas.',
  invalid_cash_mappings: 'Há contas financeiras vinculadas a contas contábeis inválidas ou inativas.',
}

const countKeys: (keyof PrepublicationReport)[] = [
  'account_count', 'analytic_account_count', 'active_category_count',
  'missing_category_count', 'active_financial_account_count',
  'missing_financial_account_count', 'invalid_category_mapping_count',
  'invalid_financial_mapping_count', 'invalid_hierarchy_count',
  'hierarchy_cycle_count', 'overlapping_published_plan_count',
]

export function parsePrepublicationReport(value: unknown, planId: string): PrepublicationReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Resposta de verificação inválida.')
  }
  const report = value as Record<string, unknown>
  if (report.plan_id !== planId || report.status !== 'draft' ||
    typeof report.ready !== 'boolean' || !Array.isArray(report.issues) ||
    !report.issues.every(issue => typeof issue === 'string' && Object.hasOwn(issues, issue)) ||
    countKeys.some(key => !Number.isSafeInteger(report[key]) || (report[key] as number) < 0) ||
    report.ready !== (report.issues.length === 0)
  ) {
    throw new Error('A verificação retornou um resultado inconsistente. Nenhum plano foi publicado.')
  }
  return report as PrepublicationReport
}

export function AccountingPrepublication({
  client, organizationId, planId, validFrom, validTo, onPublished, disabled = false,
}: {
  client: SupabaseClient
  organizationId: string
  planId: string
  validFrom: string
  validTo: string
  onPublished?: () => void
  disabled?: boolean
}) {
  const [report, setReport] = useState<PrepublicationReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [publishError, setPublishError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishUncertain, setPublishUncertain] = useState(false)
  const [published, setPublished] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const publication = useRef<{ name: string; args: Record<string, unknown> } | null>(null)
  const publicationBusy = useRef(false)
  const active = useRef(true)
  const requestSeq = useRef(0)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      requestSeq.current += 1
    }
  }, [])

  useEffect(() => {
    requestSeq.current += 1
    setReport(null)
    setError('')
    setPublishError('')
    setChecking(false)
    setPublishing(false)
    setPublished(false)
    setPublishUncertain(false)
    setAcknowledged(false)
    publication.current = null
  }, [organizationId, planId, validFrom, validTo])

  async function verify() {
    if (checking || disabled || publishing || publishUncertain || published) return
    const request = ++requestSeq.current
    setReport(null)
    setAcknowledged(false)
    setPublishError('')
    setChecking(true)
    setError('')
    try {
      const { data, error: failure } = await client.rpc('preview_accounting_plan_publication', {
        p_organization_id: organizationId,
        p_plan_id: planId,
      })
      if (failure) throw failure
      const validated = parsePrepublicationReport(data, planId)
      if (active.current && request === requestSeq.current) setReport(validated)
    } catch (cause) {
      if (active.current && request === requestSeq.current) {
        const code = (cause as { code?: string } | null)?.code
        setError(code === '42501' || code === '28000'
          ? 'Seu perfil ou a assinatura da Loja não autoriza esta verificação.'
          : code === '23503'
            ? 'O plano não pertence a esta Loja ou deixou de existir.'
            : 'Não foi possível confirmar a pré-validação contábil. Atualize e tente novamente.')
      }
    } finally {
      if (active.current && request === requestSeq.current) setChecking(false)
    }
  }


  async function publish(next?: { name: string; args: Record<string, unknown> }) {
    if (publicationBusy.current || disabled || publishing || published) return
    if (!next && (!report?.ready || !acknowledged || publishUncertain)) return
    publication.current = publication.current ?? next ?? null
    if (!publication.current) return
    publicationBusy.current = true
    setPublishing(true)
    setPublishError('')
    try {
      const { data, error: failure } = await client.rpc(publication.current.name, publication.current.args)
      if (failure) throw failure
      if (data !== planId) throw new Error('Publication response did not match the requested plan')
      if (!active.current) return
      publication.current = null
      setPublishUncertain(false)
      setPublished(true)
      setReport(null)
      onPublished?.()
    } catch (cause) {
      if (!active.current) return
      const code = (cause as { code?: string } | null)?.code ?? ''
      if (['22023','23503','23514','23P01','40001','PT409','42501','28000','55000'].includes(code)) {
        publication.current = null
        setPublishUncertain(false)
        setReport(null)
        setAcknowledged(false)
        setPublishError(
          code === '23514' || code === '23P01'
            ? 'O plano perdeu as condições de publicação. Atualize os dados e execute outra verificação.'
            : (code === '40001' || code === 'PT409')
              ? 'A situação ou vigência do plano mudou. Atualize antes de tentar publicar novamente.'
              : code === '42501' || code === '28000'
                ? 'Seu acesso ou a assinatura da Loja não permite publicar planos contábeis.'
                : 'O plano não pôde ser publicado. Confira os dados e execute uma nova verificação.',
        )
      } else {
        setPublishUncertain(true)
        setPublishError('Publicação não confirmada. Reenvie a mesma solicitação para verificar sem duplicá-la.')
      }
    } finally {
      publicationBusy.current = false
      if (active.current) setPublishing(false)
    }
  }

  function submitPublication(event: import('react').FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!report?.ready || !acknowledged || published || publishing || publishUncertain) return
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
    if (reason.length < 3 || reason.length > 500) {
      setPublishError('Informe um motivo de 3 a 500 caracteres.')
      return
    }
    void publish({
      name: 'publish_validated_accounting_plan',
      args: {
        p_organization_id: organizationId,
        p_plan_id: planId,
        p_expected_valid_from: validFrom,
        p_expected_valid_to: validTo,
        p_reason: reason,
        p_idempotency_key: crypto.randomUUID(),
      },
    })
  }

  return <section aria-label="Validação pré-publicação contábil" className="accounting-prepublication">
    <h3>Validação pré-publicação</h3>
    <p className="subtle">Verificação atual das regras contábeis e dos vínculos deste rascunho, realizada no banco com autorização por Loja.</p>
    <button type="button" className="secondary" disabled={disabled || checking || publishing || publishUncertain || published} onClick={() => void verify()}>
      {checking ? 'Verificando…' : 'Verificar condições de publicação'}
    </button>
    {error && <p role="alert">{error}</p>}
    {publishError && <p role="alert">{publishError}</p>}
    {publishUncertain && <button type="button" className="secondary"
      disabled={publishing} onClick={() => { if (publication.current) void publish(publication.current) }}>
      Verificar envio da publicação
    </button>}
    {published && <p role="status">Plano contábil publicado e registrado na auditoria.</p>}
    {report && <div role="status" className="accounting-prepublication-result">
      <p><strong>{report.ready ? 'Sem impedimentos técnicos nesta verificação.' :
        'Publicação bloqueada: existem pendências no plano.'}</strong></p>
      <p>Contas contábeis: {report.account_count} ({report.analytic_account_count} analíticas ativas).
        Categorias ativas: {report.active_category_count} ({report.missing_category_count} sem vínculo).
        Contas financeiras ativas: {report.active_financial_account_count} ({report.missing_financial_account_count} sem vínculo).</p>
      {report.issues.length > 0 && <ul>
        {report.issues.map(issue => <li key={issue}>{issues[issue]}</li>)}
      </ul>}
      <p className="subtle">Diagnóstico instantâneo. O banco fará outra verificação sob bloqueio transacional na publicação; um resultado positivo nesta tela não garante aprovação posterior.</p>
      {report.ready && !published && <form aria-label="Publicar plano contábil" onSubmit={submitPublication}>
        <fieldset disabled={disabled || publishing || publishUncertain}>
          <legend>Confirmação de publicação</legend>
          <p>A publicação de {validFrom} a {validTo} é definitiva: contas e vínculos publicados não podem ser alterados.</p>
          <label htmlFor="accounting-publish-reason">Motivo da publicação</label>
          <input id="accounting-publish-reason" name="reason" required minLength={3} maxLength={500} />
          <label className="accounting-publish-confirm">
            <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
            Confirmo a vigência e compreendo que o plano publicado será imutável.
          </label>
          <button className="primary" type="submit" disabled={!acknowledged || disabled || publishing || publishUncertain}>
            {publishing ? 'Publicando plano…' : 'Publicar plano contábil'}
          </button>
        </fieldset>
      </form>}
    </div>}
  </section>
}
