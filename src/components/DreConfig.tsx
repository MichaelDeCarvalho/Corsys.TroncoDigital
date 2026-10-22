import type { SupabaseClient } from '@supabase/supabase-js'

export function DreConfig({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  // NOTE: This view is primarily informational based on current backend constraints.
  // Persisted DRE configurations depend on specific RPCs not yet fully integrated for editing.
  return (
    <div className="view active" id="view-config-dre">
      <div className="hero">
        <div>
          <h2>Configurações da DRE</h2>
          <p>Plano contábil vigente e regime de apresentação.</p>
        </div>
      </div>

      <section className="panel">
        <div className="section-title">
          <h3>Diagnóstico contábil</h3>
          <span className="subtle">Regime e cobertura</span>
        </div>
        <p>A DRE reflete os fatos contábeis classificados conforme o plano contábil vigente para esta Loja.</p>
        <div className="callout">
          <strong>Regime atual:</strong> Competência.
        </div>
      </section>

      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <h3>Preferências de Apresentação</h3>
          <span className="subtle">Configuração de visualização</span>
        </div>
        <p className="subtle">
          A configuração dos períodos comparativos e o tratamento de contas patrimoniais seguem os padrões definidos na estrutura contábil da plataforma.
        </p>
        <p className="subtle">
          <em>Nota: A persistência de preferências de apresentação do DRE depende da ativação de recursos de configuração institucional.</em>
        </p>
      </section>
    </div>
  )
}
