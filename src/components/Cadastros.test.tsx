import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { Cadastros } from './Cadastros'
import type { Member } from '../lib/tenant-data'

const ORG_ID = '94b84958-4dd9-435d-9a4e-244220835d70'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ROLE_ID = '22222222-2222-4222-8222-222222222222'
const TREASURER_ROLE_ID = '33333333-3333-4333-8333-333333333333'

const sampleMembers: Member[] = [
  {
    id: 'mem-1',
    organization_id: ORG_ID,
    full_name: 'Carlos Alberto',
    status: 'active',
    degree_or_office: 'Mestre'
  }
]

function createMockSupabaseClient(options?: {
  lastAdminError?: boolean
}): SupabaseClient {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'revoke_tenant_user_role' && options?.lastAdminError) {
      return {
        data: null,
        error: {
          code: '55000',
          message: 'cannot remove last administrator from store'
        }
      }
    }
    if (name === 'assign_tenant_user_role' || name === 'revoke_tenant_user_role') {
      return { data: USER_ID, error: null }
    }
    throw new Error(`Unexpected RPC call: ${name}`)
  })

  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      abortSignal: () => builder,
      then: (resolve: (r: unknown) => void) => {
        let data: unknown[] = []
        if (table === 'roles') {
          data = [
            {
              id: ADMIN_ROLE_ID,
              organization_id: ORG_ID,
              code: 'ADMIN',
              name: 'Administrador',
              is_system: true
            },
            {
              id: TREASURER_ROLE_ID,
              organization_id: ORG_ID,
              code: 'TREASURER',
              name: 'Tesoureiro',
              is_system: true
            }
          ]
        } else if (table === 'permissions') {
          data = [
            { code: 'users.manage', description: 'Gerenciar usuários e perfis' },
            { code: 'members.read', description: 'Consultar integrantes' }
          ]
        } else if (table === 'role_permissions') {
          data = [
            { role_id: ADMIN_ROLE_ID, permission_code: 'users.manage' },
            { role_id: TREASURER_ROLE_ID, permission_code: 'members.read' }
          ]
        } else if (table === 'user_roles') {
          data = [
            { organization_id: ORG_ID, user_id: USER_ID, role_id: ADMIN_ROLE_ID }
          ]
        } else if (table === 'member_user_links') {
          data = [
            { organization_id: ORG_ID, member_id: 'mem-1', user_id: USER_ID }
          ]
        } else if (table === 'members') {
          data = [
            { id: 'mem-1', full_name: 'Carlos Alberto', email: 'carlos@example.com' }
          ]
        } else if (table === 'user_profiles') {
          data = [{ user_id: USER_ID, display_name: 'Carlos Alberto' }]
        }

        resolve({ data, error: null })
      }
    }
    return builder
  })

  return { rpc, from } as unknown as SupabaseClient
}

describe('Cadastros Component (Cadastros.tsx)', () => {
  it('renders Integrantes tab by default and switches between tabs', () => {
    const client = createMockSupabaseClient()
    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    expect(screen.getByText('Cadastros Administrativos')).toBeInTheDocument()
    expect(screen.getByText('Carlos Alberto')).toBeInTheDocument()

    // Switch to Cargos e Vínculos
    fireEvent.click(screen.getByRole('button', { name: 'Cargos e Vínculos' }))
    expect(screen.getByText('Cargos e Tipos de Vínculo')).toBeInTheDocument()
    expect(screen.getByText('Mestre')).toBeInTheDocument()
  })

  it('loads and renders RBAC roles and users in Perfis e Permissões tab', async () => {
    const client = createMockSupabaseClient()
    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))

    await screen.findByText('Perfis e Permissões da Conta (RBAC)')
    await screen.findByText(/Administrador \(ADMIN\)/)
    await screen.findByRole('option', { name: /\+ Tesoureiro/ })
    await screen.findByText(/Gerenciar usuários e perfis/)

    // Verifies user row
    expect(screen.getAllByText('Carlos Alberto').length).toBeGreaterThan(0)
  })

  it('triggers role assignment modal and executes assignment', async () => {
    const client = createMockSupabaseClient()
    const onReload = vi.fn()

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
        onReload={onReload}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    // Select available role Tesoureiro
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: TREASURER_ROLE_ID } })

    const assignButton = screen.getByRole('button', { name: 'Atribuir' })
    fireEvent.click(assignButton)

    // Modal appears
    await screen.findByText('Atribuir Perfil de Acesso')

    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    fireEvent.change(reasonInput, { target: { value: 'Atribuição aprovada na reunião de diretoria' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Alteração' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/Perfil Tesoureiro atribuído com sucesso/)).toBeInTheDocument()
    })

    expect(onReload).toHaveBeenCalled()
  })

  it('displays error when attempting to remove the last administrator', async () => {
    const client = createMockSupabaseClient({ lastAdminError: true })

    render(
      <Cadastros
        members={sampleMembers}
        client={client}
        organizationId={ORG_ID}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Perfis e Permissões' }))
    await screen.findByText('Perfis e Permissões da Conta (RBAC)')

    // Click revoke on Admin role badge button
    const revokeButton = screen.getByTitle('Revogar perfil Administrador')
    fireEvent.click(revokeButton)

    await screen.findByText('Revogar Perfil de Acesso')

    const reasonInput = screen.getByLabelText(/Justificativa da alteração/)
    fireEvent.change(reasonInput, { target: { value: 'Tentativa de revogação de admin' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirmar Alteração' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('Não é possível remover o único administrador da Loja.')).toBeInTheDocument()
    })
  })
})
