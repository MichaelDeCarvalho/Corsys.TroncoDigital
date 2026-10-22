import type { SupabaseClient } from '@supabase/supabase-js'
import { TenantIdentity } from './TenantIdentity'

export function Configuracoes({ client, organizationId }: { client: SupabaseClient; organizationId: string }) {
  return (
    <div className="view active" id="view-configuracoes">
      <div className="hero">
        <div>
          <h2>Configurações da Loja</h2>
          <p>Identidade institucional, contatos, assinatura, governança e auditoria da Loja.</p>
        </div>
      </div>

      <TenantIdentity client={client} organizationId={organizationId} />

      <div className="metric-grid" style={{ marginTop: '24px' }}>
        <section className="panel">
          <div className="section-title">
            <h3>Assinatura e Plano SaaS</h3>
            <span className="subtle">Plano ativo</span>
          </div>
          <p><strong>Plano V35 Enterprise</strong> · Ativo com suporte a multi-inquilino.</p>
          <p className="subtle">Faturamento gerenciado pela plataforma Master SaaS.</p>
        </section>

        <section className="panel">
          <div className="section-title">
            <h3>Governança e Auditoria</h3>
            <span className="subtle">Trilha imutável</span>
          </div>
          <p>Todas as movimentações financeiras, alterações cadastrais e aprovações possuem identificador de idempotência e trilha de auditoria.</p>
          <span className="pill">Compliance V35</span>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="section-title">
          <h3>Privacidade, LGPD e Continuidade</h3>
          <span className="subtle">Conformidade e backups</span>
        </div>
        <p className="subtle">
          O sistema opera com isolamento de dados por Loja (Row Level Security). Backups, restauração e exportações LGPD são executados de forma segura sob governança da plataforma.
        </p>
      </section>
    </div>
  )
}
