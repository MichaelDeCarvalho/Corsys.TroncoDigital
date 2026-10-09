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
  client, organizationId, planId, disabled = false,
}: {
  client: SupabaseClient
  organizationId: string
  planId: string
  disabled?: boolean
}) {
  const [report, setReport] = useState<PrepublicationReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
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
    setChecking(false)
  }, [organizationId, planId])

  async function verify() {
    if (checking || disabled) return
    const request = ++requestSeq.current
    setReport(null)
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

  return <section aria-label="Validação pré-publicação contábil" className="accounting-prepublication">
    <h3>Validação pré-publicação</h3>
    <p className="subtle">Verificação atual das regras contábeis e dos vínculos deste rascunho, realizada no banco com autorização por Loja.</p>
    <button type="button" className="secondary" disabled={disabled || checking} onClick={() => void verify()}>
      {checking ? 'Verificando…' : 'Verificar condições de publicação'}
    </button>
    {error && <p role="alert">{error}</p>}
    {report && <div role="status" className="accounting-prepublication-result">
      <p><strong>{report.ready ? 'Sem impedimentos técnicos nesta verificação.' :
        'Publicação bloqueada: existem pendências no plano.'}</strong></p>
      <p>Contas contábeis: {report.account_count} ({report.analytic_account_count} analíticas ativas).
        Categorias ativas: {report.active_category_count} ({report.missing_category_count} sem vínculo).
        Contas financeiras ativas: {report.active_financial_account_count} ({report.missing_financial_account_count} sem vínculo).</p>
      {report.issues.length > 0 && <ul>
        {report.issues.map(issue => <li key={issue}>{issues[issue]}</li>)}
      </ul>}
      <p className="subtle">Isto é um diagnóstico instantâneo, não uma aprovação definitiva.
        A publicação permanece desabilitada e exigirá nova conferência transacional e autorização.</p>
    </div>}
  </section>
}
