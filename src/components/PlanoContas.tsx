import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountingPlans } from './AccountingPlans'
import { AccountingPrepublication } from './AccountingPrepublication'
import { FinancialStructure } from './FinancialStructure'
import { TreasuryCatalogs } from './TreasuryCatalogs'

export function PlanoContas({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [tab, setTab] = useState<'plano' | 'categorias' | 'contas' | 'pagamentos'>('plano')

  return (
    <div className="view active" id="view-plano-contas">
      <div className="hero">
        <div>
          <h2>Plano de Contas e Estrutura Financeira</h2>
          <p>Gestão contábil, categorias de receitas/despesas, fundos e formas de pagamento da Loja.</p>
        </div>
      </div>

      <div className="tab-buttons" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button type="button" className={tab === 'plano' ? 'primary' : 'secondary'} onClick={() => setTab('plano')}>Plano de Contas</button>
        <button type="button" className={tab === 'categorias' ? 'primary' : 'secondary'} onClick={() => setTab('categorias')}>Categorias e Regras</button>
        <button type="button" className={tab === 'contas' ? 'primary' : 'secondary'} onClick={() => setTab('contas')}>Contas e Fundos</button>
        <button type="button" className={tab === 'pagamentos' ? 'primary' : 'secondary'} onClick={() => setTab('pagamentos')}>Formas de Pagamento</button>
      </div>

      {tab === 'plano' && (
        <section className="panel">
          <AccountingPlans client={client} organizationId={organizationId} />
        </section>
      )}

      {tab === 'categorias' && (
        <FinancialStructure client={client} organizationId={organizationId} />
      )}

      {tab === 'contas' && (
        <TreasuryCatalogs client={client} organizationId={organizationId} kindFilter={['account', 'fund']} />
      )}

      {tab === 'pagamentos' && (
        <TreasuryCatalogs client={client} organizationId={organizationId} kindFilter={['method']} />
      )}
    </div>
  )
}
