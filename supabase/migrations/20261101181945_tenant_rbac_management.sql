-- Corsys Tronco Digital V35
-- Migration: 20261101181945_tenant_rbac_management.sql
-- Goal: Secure tenant-level RBAC role assignment and revocation with users.manage permission enforcement.
-- Applied to Supabase DEV using the migration API; production remains untouched.

-- ============================================================================
-- 1. RLS Policy for user_profiles under organization user management
-- ============================================================================
drop policy if exists user_profiles_select_org on public.user_profiles;
create policy user_profiles_select_org
on public.user_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = user_profiles.user_id
      and private.has_permission(ur.organization_id, 'users.manage')
  )
  or exists (
    select 1 from public.member_user_links mul
    where mul.user_id = user_profiles.user_id
      and private.has_permission(mul.organization_id, 'users.manage')
  )
);

-- ============================================================================
-- 2. RPC: assign_tenant_user_role
-- ============================================================================
create or replace function public.assign_tenant_user_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_role_code text;
  v_role_name text;
  v_is_caller_admin boolean;
  v_res uuid;
begin
  -- 1. Enforce RBAC permission
  perform private.require_permission(p_organization_id, 'users.manage');

  -- 2. Input validations
  if p_organization_id is null or p_user_id is null or p_role_id is null then
    raise exception 'organization_id, user_id and role_id are required' using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'reason required (3..500 chars)' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency_key required (1..200 chars)' using errcode = '22023';
  end if;

  -- Serialize role changes before inspecting membership/admin count (last-admin race protection).
  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- 3. Verify target role exists in organization
  select code, name into v_role_code, v_role_name
  from public.roles
  where organization_id = p_organization_id and id = p_role_id;

  if v_role_code is null then
    raise exception 'role not found in organization' using errcode = '23503';
  end if;

  -- 4. Verify target user is linked to store
  perform 1 from public.member_user_links
  where organization_id = p_organization_id and user_id = p_user_id;

  if not found then
    perform 1 from public.user_roles
    where organization_id = p_organization_id and user_id = p_user_id;

    if not found then
      raise exception 'target user is not linked to store' using errcode = '23503';
    end if;
  end if;

  -- 5. Managing ADMIN requires an existing ADMIN role in this organization.
  -- A users.manage custom role must not be able to elevate an accomplice or itself.
  if v_role_code = 'ADMIN' then
    select exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.organization_id = ur.organization_id
      where ur.organization_id = p_organization_id
        and ur.user_id = v_user
        and r.code = 'ADMIN'
    ) into v_is_caller_admin;

    if not v_is_caller_admin then
      raise exception 'ADMIN role management requires an existing ADMIN'
        using errcode = '42501';
    end if;
  end if;

  -- 6. Idempotency Check
  v_res := private.idempotency_begin(
    p_organization_id,
    'assign_tenant_user_role',
    p_idempotency_key,
    jsonb_build_object(
      'user_id', p_user_id,
      'role_id', p_role_id,
      'role_code', v_role_code,
      'reason', btrim(p_reason)
    )
  );
  if v_res is not null then
    return v_res;
  end if;

  -- 7. Assign role under the organization lock already held
  insert into public.user_roles (organization_id, user_id, role_id)
  values (p_organization_id, p_user_id, p_role_id)
  on conflict (organization_id, user_id, role_id) do nothing;

  -- 8. Audit log
  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  ) values (
    p_organization_id,
    v_user,
    'user_role.assign',
    'user_roles',
    p_user_id,
    jsonb_build_object('role_id', p_role_id, 'role_code', v_role_code, 'role_name', v_role_name),
    btrim(p_reason)
  );

  perform private.idempotency_complete(p_organization_id, p_idempotency_key, p_user_id);
  return p_user_id;
end;
$$;

-- ============================================================================
-- 3. RPC: revoke_tenant_user_role
-- ============================================================================
create or replace function public.revoke_tenant_user_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_role_code text;
  v_role_name text;
  v_admin_count integer;
  v_is_caller_admin boolean;
  v_res uuid;
begin
  -- 1. Enforce RBAC permission
  perform private.require_permission(p_organization_id, 'users.manage');

  -- 2. Input validations
  if p_organization_id is null or p_user_id is null or p_role_id is null then
    raise exception 'organization_id, user_id and role_id are required' using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'reason required (3..500 chars)' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency_key required (1..200 chars)' using errcode = '22023';
  end if;

  -- Serialize role changes before inspecting membership/admin count (last-admin race protection).
  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- 3. Verify role exists in organization
  select code, name into v_role_code, v_role_name
  from public.roles
  where organization_id = p_organization_id and id = p_role_id;

  if v_role_code is null then
    raise exception 'role not found in organization' using errcode = '23503';
  end if;

  -- 4. Only an existing ADMIN can change ADMIN grants, even when the
  -- caller has users.manage through a delegated custom role.
  if v_role_code = 'ADMIN' then
    select exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.organization_id = ur.organization_id
      where ur.organization_id = p_organization_id
        and ur.user_id = v_user
        and r.code = 'ADMIN'
    ) into v_is_caller_admin;
    if not v_is_caller_admin then
      raise exception 'ADMIN role management requires an existing ADMIN'
        using errcode = '42501';
    end if;
  end if;

  -- 5. Protection against removing the LAST Administrator
  if v_role_code = 'ADMIN' then
    select count(distinct ur.user_id) into v_admin_count
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.organization_id = p_organization_id
      and r.code = 'ADMIN';

    if v_admin_count <= 1 and exists (
      select 1 from public.user_roles
      where organization_id = p_organization_id and user_id = p_user_id and role_id = p_role_id
    ) then
      raise exception 'cannot remove last administrator from store' using errcode = '55000';
    end if;
  end if;

  -- 5. Idempotency Check
  v_res := private.idempotency_begin(
    p_organization_id,
    'revoke_tenant_user_role',
    p_idempotency_key,
    jsonb_build_object(
      'user_id', p_user_id,
      'role_id', p_role_id,
      'role_code', v_role_code,
      'reason', btrim(p_reason)
    )
  );
  if v_res is not null then
    return v_res;
  end if;

  -- 6. Revoke role under the organization lock already held
  delete from public.user_roles
  where organization_id = p_organization_id
    and user_id = p_user_id
    and role_id = p_role_id;

  -- 7. Audit log
  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  ) values (
    p_organization_id,
    v_user,
    'user_role.revoke',
    'user_roles',
    p_user_id,
    jsonb_build_object('role_id', p_role_id, 'role_code', v_role_code, 'role_name', v_role_name),
    btrim(p_reason)
  );

  perform private.idempotency_complete(p_organization_id, p_idempotency_key, p_user_id);
  return p_user_id;
end;
$$;

-- Grants
revoke all on function public.assign_tenant_user_role(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.assign_tenant_user_role(uuid, uuid, uuid, text, text) to authenticated;

revoke all on function public.revoke_tenant_user_role(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.revoke_tenant_user_role(uuid, uuid, uuid, text, text) to authenticated;
