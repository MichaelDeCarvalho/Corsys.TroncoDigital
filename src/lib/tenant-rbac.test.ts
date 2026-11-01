import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  assignTenantUserRole,
  loadTenantRbac,
  revokeTenantUserRole
} from './tenant-rbac'

const ORG_ID = '94b84958-4dd9-435d-9a4e-244220835d70'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ROLE_ID = '22222222-2222-4222-8222-222222222222'

function createMockSupabaseClient(options?: {
  rpcError?: { code: string; message: string } | null
  lastAdminError?: boolean
}): SupabaseClient {
  const rpcCalls: { name: string; args: unknown }[] = []

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args })

    if (name === 'assign_tenant_user_role' || name === 'revoke_tenant_user_role') {
      if (options?.lastAdminError && name === 'revoke_tenant_user_role') {
        return {
          data: null,
          error: {
            code: '55000',
            message: 'cannot remove last administrator from store'
          }
        }
      }
      if (options?.rpcError) {
        return { data: null, error: options.rpcError }
      }
      return { data: USER_ID, error: null }
    }

    throw new Error(`Unexpected RPC call: ${name}`)
  })

  const from = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      abortSignal: () => builder,
      then: (resolve: (r: unknown) => void) => {
        let data: unknown[] = []
        if (table === 'roles') {
          data = [
            {
              id: ROLE_ID,
              organization_id: ORG_ID,
              code: 'ADMIN',
              name: 'Administrador',
              is_system: true
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              organization_id: ORG_ID,
              code: 'TREASURER',
              name: 'Tesoureiro',
              is_system: true
            }
          ]
        } else if (table === 'permissions') {
          data = [
            { code: 'members.read', description: 'Consultar integrantes' },
            { code: 'users.manage', description: 'Gerenciar usuários e perfis' }
          ]
        } else if (table === 'role_permissions') {
          data = [
            { role_id: ROLE_ID, permission_code: 'users.manage' },
            { role_id: ROLE_ID, permission_code: 'members.read' }
          ]
        } else if (table === 'user_roles') {
          data = [
            { organization_id: ORG_ID, user_id: USER_ID, role_id: ROLE_ID }
          ]
        } else if (table === 'member_user_links') {
          data = [
            {
              organization_id: ORG_ID,
              member_id: '44444444-4444-4444-8444-444444444444',
              user_id: USER_ID
            }
          ]
        } else if (table === 'members') {
          data = [
            {
              id: '44444444-4444-4444-8444-444444444444',
              full_name: 'João Silva',
              email: 'joao@example.com'
            }
          ]
        } else if (table === 'user_profiles') {
          data = [{ user_id: USER_ID, display_name: 'João Silva' }]
        }

        resolve({ data, error: null })
      }
    }
    return builder
  })

  return { rpc, from } as unknown as SupabaseClient
}

describe('Tenant RBAC Library (tenant-rbac.ts)', () => {
  it('loads and maps tenant RBAC data correctly', async () => {
    const client = createMockSupabaseClient()
    const rbac = await loadTenantRbac(client, ORG_ID)

    expect(rbac.roles.length).toBe(2)
    expect(rbac.roles[0].code).toBe('ADMIN')
    expect(rbac.roles[0].permissions.length).toBe(2)
    expect(rbac.roles[0].assignedUsersCount).toBe(1)

    expect(rbac.users.length).toBe(1)
    expect(rbac.users[0].user_id).toBe(USER_ID)
    expect(rbac.users[0].display_name).toBe('João Silva')
    expect(rbac.users[0].roles.length).toBe(1)
    expect(rbac.users[0].roles[0].code).toBe('ADMIN')
  })

  it('calls assign_tenant_user_role RPC successfully with valid inputs', async () => {
    const client = createMockSupabaseClient()
    const result = await assignTenantUserRole(
      client,
      ORG_ID,
      USER_ID,
      ROLE_ID,
      'Atribuição de papel para teste de tesouraria'
    )

    expect(result).toBe(USER_ID)
  })

  it('calls revoke_tenant_user_role RPC successfully with valid inputs', async () => {
    const client = createMockSupabaseClient()
    const result = await revokeTenantUserRole(
      client,
      ORG_ID,
      USER_ID,
      ROLE_ID,
      'Revogação de papel para teste'
    )

    expect(result).toBe(USER_ID)
  })

  it('handles last administrator revocation error cleanly', async () => {
    const client = createMockSupabaseClient({ lastAdminError: true })

    await expect(
      revokeTenantUserRole(client, ORG_ID, USER_ID, ROLE_ID, 'Revogar admin')
    ).rejects.toThrow(/cannot remove last administrator/)
  })
})
