import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DreReport } from './DreReport'
import { BudgetReport } from './BudgetReport'

export function DreView({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<'demonstrative' | 'budget'>('demonstrative')

  return (
    <div className="dre-view">
      <section className="panel">
        <div className="section-title">
          <h2>DRE — Demonstração do Resultado do Exercício</h2>
        </div>
        <p className="subtle">
          Visão econômica por competência contábil. A DRE reflete os fatos geradores no período, diferindo do fluxo de caixa operacional.
        </p>

        {/* Sub-Tabs */}
        <div className="finance-sections" role="group" aria-label="Abas da DRE" style={{ margin: '1rem 0' }}>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'demonstrative'}
            onClick={() => setActiveTab('demonstrative')}
          >
            Demonstrativo por Competência
          </button>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'budget'}
            onClick={() => setActiveTab('budget')}
          >
            Orçado × Realizado
          </button>
        </div>
      </section>

      {activeTab === 'demonstrative' && <DreReport key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'budget' && <BudgetReport key={organizationId} client={client} organizationId={organizationId} />}
    </div>
  )
}
