import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TreasuryBalances } from './TreasuryBalances'
import { AccountTransfers } from './AccountTransfers'
import { BankReconciliation } from './BankReconciliation'
import { BudgetReport } from './BudgetReport'
import { BudgetManagement } from './BudgetManagement'

export function Tesouraria({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [activeTab, setActiveTab] = useState<'balances' | 'transfers' | 'reconciliation' | 'budget'>('balances')

  return (
    <div className="tesouraria-view">
      <section className="panel">
        <div className="section-title">
          <h2>Tesouraria — Caixa, Bancos e Conciliação</h2>
        </div>
        <p className="subtle">
          Onde o dinheiro da Loja está armazenado. Saldos bancários e em caixa são estritamente separados das obrigações a receber.
        </p>

        {/* Navigation Sub-Tabs */}
        <div className="finance-sections" role="group" aria-label="Navegação da tesouraria" style={{ margin: '1rem 0' }}>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'balances'}
            onClick={() => setActiveTab('balances')}
          >
            Saldos e Contas
          </button>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'transfers'}
            onClick={() => setActiveTab('transfers')}
          >
            Transferências Internas
          </button>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'reconciliation'}
            onClick={() => setActiveTab('reconciliation')}
          >
            Conciliação OFX/CSV
          </button>
          <button
            className="secondary"
            type="button"
            aria-pressed={activeTab === 'budget'}
            onClick={() => setActiveTab('budget')}
          >
            Fundos e Orçamento
          </button>
        </div>
      </section>

      {activeTab === 'balances' && <TreasuryBalances key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'transfers' && <AccountTransfers key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'reconciliation' && <BankReconciliation key={organizationId} client={client} organizationId={organizationId} />}
      {activeTab === 'budget' && (
        <>
          <BudgetReport key={`${organizationId}:report`} client={client} organizationId={organizationId} />
          <BudgetManagement key={`${organizationId}:mgmt`} client={client} organizationId={organizationId} />
        </>
      )}
    </div>
  )
}
