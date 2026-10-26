import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DailyCashFlow } from './DailyCashFlow'

export function FluxoCaixa({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  const [mode, setMode] = useState<'consolidado' | 'projetado' | 'movimentos' | 'saldo'>('consolidado')

  return (
    <div className="fluxo-caixa-view">
      <section className="panel">
        <div className="section-title">
          <h2>Fluxo de Caixa — Entradas e Saídas Efetivas</h2>
        </div>
        <p className="subtle">
          Movimentação real de caixa e bancos, separada das receitas apenas previstas ou a receber.
        </p>

        {/* View Mode Actions */}
        <div className="finance-sections" role="group" aria-label="Modo de visualização do fluxo de caixa" style={{ margin: '1rem 0' }}>
          <button
            className="secondary"
            type="button"
            data-mode="consolidado"
            aria-pressed={mode === 'consolidado'}
            onClick={() => setMode('consolidado')}
          >
            Consolidado
          </button>
          <button
            className="secondary"
            type="button"
            data-mode="projetado"
            aria-pressed={mode === 'projetado'}
            onClick={() => setMode('projetado')}
          >
            Projetado
          </button>
          <button
            className="secondary"
            type="button"
            data-mode="movimentos"
            aria-pressed={mode === 'movimentos'}
            onClick={() => setMode('movimentos')}
          >
            Receitas × Desp.
          </button>
          <button
            className="secondary"
            type="button"
            data-mode="saldo"
            aria-pressed={mode === 'saldo'}
            onClick={() => setMode('saldo')}
          >
            Saldo
          </button>
        </div>

        {mode === 'projetado' && (
          <p className="subtle" style={{ padding: '0.5rem', background: 'var(--highlight, #f3f4f6)', borderRadius: '4px' }}>
            A visão projetada considera exclusivamente obrigações efetivas confirmadas com vencimento no período selecionado, sem projeções probabilísticas fictícias.
          </p>
        )}
      </section>

      {/* Embed DailyCashFlow */}
      <DailyCashFlow key={`${organizationId}:${mode}`} client={client} organizationId={organizationId} viewMode={mode} />
    </div>
  )
}
