import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Member } from '../lib/tenant-data'
import { Members } from './Members'
import { MemberConfiguration } from './MemberConfiguration'

export function Cadastros({
  members,
  client,
  organizationId,
  onSaved,
  onReload,
}: {
  members: Member[]
  client?: SupabaseClient
  organizationId?: string
  onSaved?: () => void
  onReload?: () => void
}) {
  const [tab, setTab] = useState<'integrantes' | 'cargos' | 'permissoes'>('integrantes')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  return (
    <div className="view active" id="view-cadastros">
      <div className="hero">
        <div>
          <h2>Cadastros Administrativos</h2>
          <p>Gestão centralizada de integrantes, cargos e permissões da Loja.</p>
        </div>
        <div className="tab-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className={tab === 'integrantes' ? 'primary' : 'secondary'} onClick={() => setTab('integrantes')}>
            Integrantes
          </button>
          <button type="button" className={tab === 'cargos' ? 'primary' : 'secondary'} onClick={() => setTab('cargos')}>
            Cargos e Vínculos
          </button>
          <button type="button" className={tab === 'permissoes' ? 'primary' : 'secondary'} onClick={() => setTab('permissoes')}>
            Perfis e Permissões
          </button>
        </div>
      </div>

      {tab === 'integrantes' && (
        <Members
          members={members}
          client={client}
          organizationId={organizationId}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}

      {tab === 'cargos' && (
        <section className="panel">
          <div className="section-title">
            <h3>Cargos e Tipos de Vínculo</h3>
            <span className="subtle">Configuração de cargos da Loja</span>
          </div>
          <p className="subtle" style={{ marginBottom: '16px' }}>
            Utilize a ficha individual de cada integrante na aba Integrantes para definir ou alterar cargos e valores de mensalidade específicos.
          </p>
          {!members.length ? (
            <p className="empty">Nenhum integrante cadastrado.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Integrante</th>
                    <th>Cargo / Grau atual</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.full_name}</strong></td>
                      <td>{m.degree_or_office || 'Não informado'}</td>
                      <td>
                        {client && organizationId && (
                          <button type="button" className="secondary" onClick={() => setSelectedMember(m)}>
                            Gerenciar cargo e mensalidade
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'permissoes' && (
        <section className="panel" aria-label="Perfis e permissões">
          <div className="section-title">
            <h3>Perfis e Permissões da Conta</h3>
            <span className="subtle">Controle de acesso baseado em papéis (RBAC) via Supabase</span>
          </div>
          <p className="subtle" style={{ marginBottom: '16px' }}>
            As permissões de acesso (financeiro, secretaria, tesouraria, master) são gerenciadas de forma determinística no servidor através de políticas RLS e funções RPC.
          </p>
          <div className="callout">
            <strong>Segurança ativa:</strong> Operações privilegiadas exigem autenticação ativa e permissão conferida pelo backend. Nenhuma permissão é decidida apenas pela interface.
          </div>
        </section>
      )}

      {selectedMember && client && organizationId && (
        <MemberConfiguration
          client={client}
          organizationId={organizationId}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}
