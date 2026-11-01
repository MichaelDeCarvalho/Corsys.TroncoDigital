import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantRole = {
  id: string
  organization_id: string
  code: string
  name: string
  is_system: boolean
}

export type TenantPermission = {
  code: string
  description: string
}

export type RolePermission = {
  role_id: string
  permission_code: string
}

export type UserRoleRow = {
  organization_id: string
  user_id: string
  role_id: string
}

export type MemberUserLinkRow = {
  organization_id: string
  member_id: string
  user_id: string
}

export type UserProfileRow = {
  user_id: string
  display_name: string | null
}

export type RoleSummary = TenantRole & {
  permissions: TenantPermission[]
  assignedUsersCount: number
}

export type TenantUserSummary = {
  user_id: string
  display_name: string
  member_id: string | null
  member_name: string | null
  roles: TenantRole[]
}

export type TenantRbacData = {
  roles: RoleSummary[]
  users: TenantUserSummary[]
  permissions: TenantPermission[]
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadTenantRbac(
  client: SupabaseClient,
  organizationId: string,
  signal?: AbortSignal
): Promise<TenantRbacData> {
  if (!organizationId || !UUID_REGEX.test(organizationId)) {
    throw new Error('Invalid organization ID for RBAC query')
  }

  let rolesQuery = client.from('roles').select('id, organization_id, code, name, is_system').eq('organization_id', organizationId)
  let permissionsQuery = client.from('permissions').select('code, description')
  let rolePermsQuery = client.from('role_permissions').select('role_id, permission_code')
  let userRolesQuery = client.from('user_roles').select('organization_id, user_id, role_id').eq('organization_id', organizationId)
  let memberLinksQuery = client.from('member_user_links').select('organization_id, member_id, user_id').eq('organization_id', organizationId)
  let membersQuery = client.from('members').select('id, full_name, email').eq('organization_id', organizationId)
  let profilesQuery = client.from('user_profiles').select('user_id, display_name')

  if (signal) {
    rolesQuery = rolesQuery.abortSignal(signal)
    permissionsQuery = permissionsQuery.abortSignal(signal)
    rolePermsQuery = rolePermsQuery.abortSignal(signal)
    userRolesQuery = userRolesQuery.abortSignal(signal)
    memberLinksQuery = memberLinksQuery.abortSignal(signal)
    membersQuery = membersQuery.abortSignal(signal)
    profilesQuery = profilesQuery.abortSignal(signal)
  }

  const [rolesRes, permissionsRes, rolePermsRes, userRolesRes, memberLinksRes, membersRes, profilesRes] =
    await Promise.all([
      rolesQuery,
      permissionsQuery,
      rolePermsQuery,
      userRolesQuery,
      memberLinksQuery,
      membersQuery,
      profilesQuery
    ])

  if (rolesRes.error) throw rolesRes.error
  if (permissionsRes.error) throw permissionsRes.error
  if (rolePermsRes.error) throw rolePermsRes.error
  if (userRolesRes.error) throw userRolesRes.error
  if (memberLinksRes.error) throw memberLinksRes.error
  if (membersRes.error) throw membersRes.error
  if (profilesRes.error) throw profilesRes.error

  const rawRoles: TenantRole[] = rolesRes.data ?? []
  const rawPermissions: TenantPermission[] = permissionsRes.data ?? []
  const rawRolePerms: RolePermission[] = rolePermsRes.data ?? []
  const rawUserRoles: UserRoleRow[] = userRolesRes.data ?? []
  const rawMemberLinks: MemberUserLinkRow[] = memberLinksRes.data ?? []
  const rawMembers = membersRes.data ?? []
  const rawProfiles: UserProfileRow[] = profilesRes.data ?? []

  const permissionsMap = new Map<string, TenantPermission>()
  for (const p of rawPermissions) {
    permissionsMap.set(p.code, p)
  }

  // Group permissions per role
  const rolePermsMap = new Map<string, TenantPermission[]>()
  for (const rp of rawRolePerms) {
    const list = rolePermsMap.get(rp.role_id) || []
    const perm = permissionsMap.get(rp.permission_code)
    if (perm) list.push(perm)
    rolePermsMap.set(rp.role_id, list)
  }

  // Count assigned users per role
  const roleUsersCountMap = new Map<string, Set<string>>()
  for (const ur of rawUserRoles) {
    const set = roleUsersCountMap.get(ur.role_id) || new Set()
    set.add(ur.user_id)
    roleUsersCountMap.set(ur.role_id, set)
  }

  const roleSummaries: RoleSummary[] = rawRoles.map((r) => ({
    ...r,
    permissions: rolePermsMap.get(r.id) || [],
    assignedUsersCount: roleUsersCountMap.get(r.id)?.size || 0
  }))

  // Map users linked to store
  const membersMap = new Map<string, { full_name: string; email: string | null }>()
  for (const m of rawMembers) {
    membersMap.set(m.id, { full_name: m.full_name, email: m.email ?? null })
  }

  const profilesMap = new Map<string, string | null>()
  for (const p of rawProfiles) {
    profilesMap.set(p.user_id, p.display_name ?? null)
  }

  const userIdsSet = new Set<string>()
  for (const ur of rawUserRoles) userIdsSet.add(ur.user_id)
  for (const ml of rawMemberLinks) userIdsSet.add(ml.user_id)

  const rolesByIdMap = new Map<string, TenantRole>()
  for (const r of rawRoles) rolesByIdMap.set(r.id, r)

  const memberLinkByUser = new Map<string, string>()
  for (const ml of rawMemberLinks) {
    memberLinkByUser.set(ml.user_id, ml.member_id)
  }

  const userRolesMap = new Map<string, TenantRole[]>()
  for (const ur of rawUserRoles) {
    const list = userRolesMap.get(ur.user_id) || []
    const roleObj = rolesByIdMap.get(ur.role_id)
    if (roleObj && !list.some((existing) => existing.id === roleObj.id)) {
      list.push(roleObj)
    }
    userRolesMap.set(ur.user_id, list)
  }

  const usersSummary: TenantUserSummary[] = Array.from(userIdsSet).map((uId) => {
    const memberId = memberLinkByUser.get(uId) || null
    const memberObj = memberId ? membersMap.get(memberId) : null
    const profileName = profilesMap.get(uId)
    const displayName =
      memberObj?.full_name || profileName || `Usuário (${uId.slice(0, 8)})`

    return {
      user_id: uId,
      display_name: displayName,
      member_id: memberId,
      member_name: memberObj?.full_name || null,
      roles: userRolesMap.get(uId) || []
    }
  })

  usersSummary.sort((a, b) => a.display_name.localeCompare(b.display_name))

  return {
    roles: roleSummaries,
    users: usersSummary,
    permissions: rawPermissions
  }
}

export async function assignTenantUserRole(
  client: SupabaseClient,
  organizationId: string,
  userId: string,
  roleId: string,
  reason: string,
  idempotencyKey?: string
): Promise<string> {
  if (!organizationId || !UUID_REGEX.test(organizationId)) throw new Error('Invalid organization ID')
  if (!userId || !UUID_REGEX.test(userId)) throw new Error('Invalid user ID')
  if (!roleId || !UUID_REGEX.test(roleId)) throw new Error('Invalid role ID')
  if (!reason || reason.trim().length < 3) throw new Error('Reason required (minimum 3 chars)')

  const key = idempotencyKey?.trim() || crypto.randomUUID()

  const { data, error } = await client.rpc('assign_tenant_user_role', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role_id: roleId,
    p_reason: reason.trim(),
    p_idempotency_key: key
  })

  if (error) throw error
  if (typeof data !== 'string' || !UUID_REGEX.test(data)) {
    throw new Error('Unconfirmed role assignment')
  }
  return data
}

export async function revokeTenantUserRole(
  client: SupabaseClient,
  organizationId: string,
  userId: string,
  roleId: string,
  reason: string,
  idempotencyKey?: string
): Promise<string> {
  if (!organizationId || !UUID_REGEX.test(organizationId)) throw new Error('Invalid organization ID')
  if (!userId || !UUID_REGEX.test(userId)) throw new Error('Invalid user ID')
  if (!roleId || !UUID_REGEX.test(roleId)) throw new Error('Invalid role ID')
  if (!reason || reason.trim().length < 3) throw new Error('Reason required (minimum 3 chars)')

  const key = idempotencyKey?.trim() || crypto.randomUUID()

  const { data, error } = await client.rpc('revoke_tenant_user_role', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role_id: roleId,
    p_reason: reason.trim(),
    p_idempotency_key: key
  })

  if (error) throw error
  if (typeof data !== 'string' || !UUID_REGEX.test(data)) {
    throw new Error('Unconfirmed role revocation')
  }
  return data
}
