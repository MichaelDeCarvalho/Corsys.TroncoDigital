import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DreReport } from './DreReport'
import { BudgetReport } from './BudgetReport'
import { DreGerencialPanel } from './DreGerencialPanel'

export function DreView({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<'demonstrative' | 'structured' | 'budget'>('demonstrative')

  return (
    <div className="dre-view">
      <section className="panel">
        <div className="section-title">
          <h2>DRE Gerencial</h2>
        </div>
        <p className="subtle">
          Visão gerencial do resultado por competência para apoiar as decisões da Loja. A DRE contábil oficial é elaborada pelo contador. O resultado gerencial considera os fatos do período e difere do fluxo de caixa.
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
            aria-pressed={activeTab === 'structured'}
            onClick={() => setActiveTab('structured')}
          >
            DRE Estruturada (B01)
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
      {activeTab === 'structured' && <DreGerencialPanel key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'budget' && <BudgetReport key={organizationId} client={client} organizationId={organizationId} />}
    </div>
  )
}
