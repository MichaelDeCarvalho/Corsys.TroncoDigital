import { useEffect, useState } from 'react'
import { Shield, ShieldAlert, ShieldCheck, UserCheck, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Member } from '../lib/tenant-data'
import { Members } from './Members'
import { MemberConfiguration } from './MemberConfiguration'
import {
  assignTenantUserRole,
  loadTenantRbac,
  revokeTenantUserRole,
  type RoleSummary,
  type TenantRbacData,
  type TenantRole,
  type TenantUserSummary
} from '../lib/tenant-rbac'

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

  // RBAC State
  const [rbacData, setRbacData] = useState<TenantRbacData | null>(null)
  const [loadingRbac, setLoadingRbac] = useState(false)
  const [rbacError, setRbacError] = useState('')
  const [rbacReloadTrigger, setRbacReloadTrigger] = useState(0)

  // Modal / Action State
  const [actionModal, setActionModal] = useState<{
    type: 'assign' | 'revoke'
    user: TenantUserSummary
    role: TenantRole
    idempotencyKey: string
    attempted: boolean
  } | null>(null)
  const [selectedAssignRoleId, setSelectedAssignRoleId] = useState('')
  const [reason, setReason] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    if (tab !== 'permissoes' || !client || !organizationId) return

    let active = true
    const controller = new AbortController()
    setLoadingRbac(true)
    setRbacError('')

    loadTenantRbac(client, organizationId, controller.signal)
      .then((data) => {
        if (active) setRbacData(data)
      })
      .catch((err) => {
        if (active) {
          setRbacError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os perfis e permissões da Loja.'
          )
        }
      })
      .finally(() => {
        if (active) setLoadingRbac(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [tab, client, organizationId, rbacReloadTrigger])

  const handleExecuteRoleAction = async () => {
    if (!actionModal || !client || !organizationId) return
    if (!reason.trim() || reason.trim().length < 3) {
      setActionError('Forneça uma justificativa válida com pelo menos 3 caracteres.')
      return
    }

    setActionModal((current) => current ? { ...current, attempted: true } : current)
    setSubmittingAction(true)
    setActionError('')
    setActionSuccess('')

    try {
      if (actionModal.type === 'assign') {
        await assignTenantUserRole(
          client,
          organizationId,
          actionModal.user.user_id,
          actionModal.role.id,
          reason,
          actionModal.idempotencyKey
        )
        setActionSuccess(`Perfil ${actionModal.role.name} atribuído com sucesso.`)
      } else {
        await revokeTenantUserRole(
          client,
          organizationId,
          actionModal.user.user_id,
          actionModal.role.id,
          reason,
          actionModal.idempotencyKey
        )
        setActionSuccess(`Perfil ${actionModal.role.name} revogado com sucesso.`)
      }

      setActionModal(null)
      setReason('')
      setSelectedAssignRoleId('')
      setRbacReloadTrigger((v) => v + 1)
      if (onReload) onReload()
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Falha ao alterar perfil do usuário.'

      if (msg.includes('last administrator') || msg.includes('último administrador')) {
        setActionError('Não é possível remover o único administrador da Loja.')
      } else if (msg.includes('self-elevation')) {
        setActionError('Autoelevação de privilégios não permitida.')
      } else if (msg.includes('permission denied') || msg.includes('42501')) {
        setActionError('Você não possui permissão para gerenciar usuários e perfis.')
      } else {
        setActionError(msg)
      }
    } finally {
      setSubmittingAction(false)
    }
  }

  const getRoleBadgeStyle = (code: string) => {
    switch (code) {
      case 'ADMIN':
        return { background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' }
      case 'TREASURER':
        return { background: '#eff6ff', color: '#1e40af', borderColor: '#93c5fd' }
      case 'VIEWER':
        return { background: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }
      case 'MEMBER':
        return { background: '#f0fdf4', color: '#166534', borderColor: '#86efac' }
      default:
        return { background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }
    }
  }

  return (
    <div className="view active" id="view-cadastros">
      <div className="hero">
        <div>
          <h2>Cadastros Administrativos</h2>
          <p>Gestão centralizada de integrantes, cargos e permissões da Loja.</p>
        </div>
        <div className="tab-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={tab === 'integrantes' ? 'primary' : 'secondary'}
            onClick={() => setTab('integrantes')}
          >
            Integrantes
          </button>
          <button
            type="button"
            className={tab === 'cargos' ? 'primary' : 'secondary'}
            onClick={() => setTab('cargos')}
          >
            Cargos e Vínculos
          </button>
          <button
            type="button"
            className={tab === 'permissoes' ? 'primary' : 'secondary'}
            onClick={() => setTab('permissoes')}
          >
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
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.full_name}</strong>
                      </td>
                      <td>{m.degree_or_office || 'Não informado'}</td>
                      <td>
                        {client && organizationId && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedMember(m)}
                          >
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="panel" aria-label="Perfis e permissões">
            <div className="section-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} style={{ color: 'var(--primary-color, #1e3a8a)' }} />
                <h3>Perfis e Permissões da Conta (RBAC)</h3>
              </div>
              <span className="subtle">Controle determinístico de acesso baseado em papéis no Supabase</span>
            </div>
            <p className="subtle" style={{ marginBottom: '1rem' }}>
              As permissões de acesso (administração, tesouraria, consulta, integrante) são gerenciadas no servidor através de políticas RLS e funções RPC controladas.
            </p>

            {actionSuccess && (
              <p role="status" className="message success" style={{ marginBottom: '1rem' }}>
                {actionSuccess}
              </p>
            )}

            {!actionModal && actionError && (
              <p role="alert" className="message error" style={{ marginBottom: '1rem' }}>
                {actionError}
              </p>
            )}

            {loadingRbac ? (
              <p role="status" className="message">Carregando perfis e permissões da Loja...</p>
            ) : rbacError ? (
              <div className="panel" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                <p role="alert" className="message error">{rbacError}</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRbacReloadTrigger((v) => v + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : !rbacData ? (
              <p className="empty">Nenhum dado de perfil encontrado.</p>
            ) : (
              <>
                {/* 1. Definições dos 4 Perfis do Sistema */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Perfis do Sistema e Permissões Concedidas
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    {rbacData.roles.map((role: RoleSummary) => {
                      const badgeStyle = getRoleBadgeStyle(role.code)
                      return (
                        <div
                          key={role.id}
                          className="panel"
                          style={{
                            padding: '1rem',
                            border: `1px solid ${badgeStyle.borderColor}`,
                            background: '#ffffff'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <span
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                background: badgeStyle.background,
                                color: badgeStyle.color,
                                border: `1px solid ${badgeStyle.borderColor}`
                              }}
                            >
                              {role.name} ({role.code})
                            </span>
                            {role.is_system && (
                              <span
                                className="subtle"
                                style={{ fontSize: '0.75rem', fontStyle: 'italic' }}
                              >
                                Perfil de Sistema
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                            Usuários com este perfil na Loja: <strong>{role.assignedUsersCount}</strong>
                          </p>
                          <div style={{ fontSize: '0.8rem' }}>
                            <strong>Permissões:</strong>
                            {!role.permissions.length ? (
                              <p className="subtle" style={{ marginTop: '0.25rem' }}>
                                Acesso restrito via vínculo de integrante e RLS de propriedade.
                              </p>
                            ) : (
                              <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem', margin: 0 }}>
                                {role.permissions.map((p) => (
                                  <li key={p.code} style={{ color: '#334155', marginBottom: '0.15rem' }}>
                                    <code>{p.code}</code> — {p.description}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Usuários Vinculados à Loja e seus Perfis */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Usuários Vinculados à Loja e Atribuição de Perfis
                  </h4>
                  {!rbacData.users.length ? (
                    <p className="empty">Nenhum usuário vinculado a esta Loja.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Usuário / Integrante</th>
                            <th>Perfis Atribuídos</th>
                            <th>Ações de Gerenciamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rbacData.users.map((u) => {
                            const userRoleIds = new Set(u.roles.map((r) => r.id))
                            const availableRoles = rbacData.roles.filter((r) => !userRoleIds.has(r.id))

                            return (
                              <tr key={u.user_id}>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <strong>{u.display_name}</strong>
                                    <span className="subtle" style={{ fontSize: '0.75rem' }}>
                                      ID: {u.user_id.slice(0, 8)}...
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {!u.roles.length ? (
                                      <span className="subtle">Sem perfil atribuído</span>
                                    ) : (
                                      u.roles.map((role) => {
                                        const badgeStyle = getRoleBadgeStyle(role.code)
                                        return (
                                          <span
                                            key={role.id}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.3rem',
                                              padding: '0.15rem 0.5rem',
                                              borderRadius: '4px',
                                              fontSize: '0.8rem',
                                              fontWeight: 600,
                                              background: badgeStyle.background,
                                              color: badgeStyle.color,
                                              border: `1px solid ${badgeStyle.borderColor}`
                                            }}
                                          >
                                            {role.name}
                                            <button
                                              type="button"
                                              title={`Revogar perfil ${role.name}`}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 0,
                                                color: badgeStyle.color,
                                                display: 'inline-flex'
                                              }}
                                              onClick={() => {
                                                setActionError('')
                                                setActionSuccess('')
                                                setActionModal({
                                                  type: 'revoke',
                                                  user: u,
                                                  role,
                                                   idempotencyKey: crypto.randomUUID(),
                                                   attempted: false
                                                })
                                              }}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </span>
                                        )
                                      })
                                    )}
                                  </div>
                                </td>
                                <td>
                                  {availableRoles.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <select
                                        style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                        value={
                                          selectedAssignRoleId &&
                                          availableRoles.some((r) => r.id === selectedAssignRoleId)
                                            ? selectedAssignRoleId
                                            : ''
                                        }
                                        onChange={(e) => setSelectedAssignRoleId(e.target.value)}
                                      >
                                        <option value="">Selecionar perfil...</option>
                                        {availableRoles.map((r) => (
                                          <option key={r.id} value={r.id}>
                                            + {r.name} ({r.code})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        className="secondary"
                                        disabled={!selectedAssignRoleId || !availableRoles.some(r => r.id === selectedAssignRoleId)}
                                        onClick={() => {
                                          const roleToAssign = availableRoles.find(
                                            (r) => r.id === selectedAssignRoleId
                                          )
                                          if (!roleToAssign) return
                                          setActionError('')
                                          setActionSuccess('')
                                          setActionModal({
                                            type: 'assign',
                                            user: u,
                                            role: roleToAssign,
                                             idempotencyKey: crypto.randomUUID(),
                                             attempted: false
                                          })
                                        }}
                                      >
                                        Atribuir
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}
            >
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {actionModal.type === 'assign' ? 'Atribuir Perfil de Acesso' : 'Revogar Perfil de Acesso'}
              </h4>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setActionModal(null)}
                disabled={submittingAction}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#334155' }}>
              Você está prestes a{' '}
              <strong>
                {actionModal.type === 'assign' ? 'ATRIBUIR' : 'REVOGAR'}
              </strong>{' '}
              o perfil <strong>{actionModal.role.name} ({actionModal.role.code})</strong> para o usuário{' '}
              <strong>{actionModal.user.display_name}</strong>.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="rbacReason"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                Justificativa da alteração (obrigatória para auditoria):
              </label>
              <input
                id="rbacReason"
                type="text"
                placeholder="Ex: Definido em reunião de diretoria da Loja"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                 disabled={actionModal.attempted || submittingAction}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>

            {actionError && (
              <p role="alert" className="message error" style={{ marginBottom: '1rem' }}>
                {actionError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary"
                disabled={submittingAction}
                onClick={() => setActionModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={submittingAction || reason.trim().length < 3}
                onClick={handleExecuteRoleAction}
              >
                {submittingAction ? 'Processando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
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
