-- Corsys Tronco Digital V35 — M04 Operação Master SaaS
-- Additive migration for:
--   Entrega A: Plan seat limits (max_admin_users), express hiring (day 1 of next month),
--              prospective upgrade/downgrade scheduling & application with historical price preservation
--   Entrega B: Manual SaaS payments, allocations, compensatory reversals/voids/adjustments,
--              external fiscal document references, and segregated SaaS financial KPIs
--   Entrega C: Delinquency (7-day tolerance), manual suspension, write-block preserving read/export/support,
--              reactivation after settlement or payment agreement, and scheduled/immediate cancellation (D01 90-day export window)
--   Entrega D: Master support internal notes, assignment/priority triage, idempotent internal ticket creation,
--              and tenant-safe active read_only support session banner check

begin;

-- ============================================================================
-- 0. Sequence for SaaS payment agreements
-- ============================================================================
create sequence if not exists public.saas_agreement_seq start with 1 increment by 1;

-- ============================================================================
-- 1. Commercial seat limit helpers & tenant_write_allowed lifecycle coverage
-- ============================================================================

create or replace function private.tenant_write_allowed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      a.access_override = 'none'
      and case
        when s.status in ('trialing', 'active', 'past_due') then true
        when s.status = 'cancel_scheduled'
          then (s.current_period_end is null or s.current_period_end >= current_date)
        else false
      end
    from public.saas_tenant_accounts a
    join public.saas_subscriptions s
      on s.organization_id = a.organization_id
    where a.organization_id = p_organization_id
      and s.status <> 'canceled'
    order by s.started_at desc
    limit 1
  ), false);
$$;

revoke all on function private.tenant_write_allowed(uuid) from public;
grant execute on function private.tenant_write_allowed(uuid) to authenticated;

create or replace function private.plan_version_seat_limit(p_plan_version_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_raw jsonb;
  v_text text;
begin
  if p_plan_version_id is null then
    return null;
  end if;

  select e.entitlement_value
    into v_raw
  from public.saas_plan_version_entitlements e
  where e.plan_version_id = p_plan_version_id
    and e.entitlement_key = 'max_admin_users';

  if v_raw is null then
    return null;
  end if;

  if jsonb_typeof(v_raw) = 'number' then
    v_text := v_raw::text;
    if v_text ~ '^[1-9][0-9]{0,5}$' then
      return v_text::integer;
    end if;
  elsif jsonb_typeof(v_raw) = 'string' then
    v_text := btrim(v_raw #>> '{}');
    if v_text ~ '^[1-9][0-9]{0,5}$' then
      return v_text::integer;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.plan_version_seat_limit(uuid) from public, anon, authenticated;

create or replace function private.tenant_active_seat_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct ur.user_id)::integer
  from public.user_roles ur
  where ur.organization_id = p_organization_id
    and not exists (
      select 1
      from public.platform_staff ps
      where ps.user_id = ur.user_id
        and ps.active
        and ps.role in ('MASTER', 'SUPPORT')
    );
$$;

revoke all on function private.tenant_active_seat_count(uuid) from public, anon, authenticated;

create or replace function private.tenant_seat_limit(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.plan_version_seat_limit(s.plan_version_id)
  from public.saas_subscriptions s
  where s.organization_id = p_organization_id
    and s.status <> 'canceled'
  order by s.started_at desc, s.created_at desc
  limit 1;
$$;

revoke all on function private.tenant_seat_limit(uuid) from public, anon, authenticated;

create or replace function public.read_tenant_seat_usage(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub record;
  v_active integer;
  v_max integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_organization_id is null then
    raise exception 'organization_id required' using errcode = '22023';
  end if;

  if not (
    private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT')
    or private.has_permission(p_organization_id, 'users.manage')
    or private.has_permission(p_organization_id, 'settings.manage')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  select s.id, s.status, s.plan_id, s.plan_version_id, p.name as plan_name, p.code as plan_code
    into v_sub
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.organization_id = p_organization_id
    and s.status <> 'canceled'
  order by s.started_at desc, s.created_at desc
  limit 1;

  v_active := private.tenant_active_seat_count(p_organization_id);
  v_max := case when v_sub.plan_version_id is not null then private.plan_version_seat_limit(v_sub.plan_version_id) else null end;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'active_users', v_active,
    'max_admin_users', v_max,
    'seats_remaining', case when v_max is null then null else greatest(0, v_max - v_active) end,
    'over_limit', case when v_max is null then false else v_active > v_max end,
    'plan_id', v_sub.plan_id,
    'plan_version_id', v_sub.plan_version_id,
    'plan_name', v_sub.plan_name,
    'plan_code', v_sub.plan_code,
    'subscription_status', v_sub.status
  );
end;
$$;

revoke all on function public.read_tenant_seat_usage(uuid) from public, anon;
grant execute on function public.read_tenant_seat_usage(uuid) to authenticated;

-- Enforce seat limit on new user role assignment (without blocking role additions for already seated users)
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
  v_already_seated boolean;
  v_is_platform_exempt boolean;
  v_max_seats integer;
  v_current_seats integer;
  v_res uuid;
begin
  -- 1. Enforce RBAC permission (also enforces tenant_write_allowed)
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

  -- Serialize role changes before inspecting membership/seat count (last-admin & seat-limit race protection)
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

  -- 6. Idempotency Check BEFORE seat mutation check so replay returns original id cleanly
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

  -- 7. Enforce commercial active seat limit (C01) for net-new active human users in this store
  select exists (
    select 1 from public.user_roles ur
    where ur.organization_id = p_organization_id and ur.user_id = p_user_id
  ) into v_already_seated;

  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = p_user_id and ps.active and ps.role in ('MASTER', 'SUPPORT')
  ) into v_is_platform_exempt;

  if not v_already_seated and not v_is_platform_exempt then
    v_max_seats := private.tenant_seat_limit(p_organization_id);
    if v_max_seats is not null then
      v_current_seats := private.tenant_active_seat_count(p_organization_id);
      if v_current_seats + 1 > v_max_seats then
        raise exception 'tenant active user limit reached for contracted plan (%/% seats)', v_current_seats, v_max_seats
          using errcode = '55000';
      end if;
    end if;
  end if;

  -- 8. Assign role under the organization lock already held
  insert into public.user_roles (organization_id, user_id, role_id)
  values (p_organization_id, p_user_id, p_role_id)
  on conflict (organization_id, user_id, role_id) do nothing;

  -- 9. Audit log
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

revoke all on function public.assign_tenant_user_role(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.assign_tenant_user_role(uuid, uuid, uuid, text, text) to authenticated;

-- Enforce seat limit on onboarding invite acceptance as well
create or replace function public.accept_onboarding_invite(
  p_run_id uuid, p_terms_version_id uuid, p_document_hash text, p_accept_terms boolean
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_run public.saas_onboarding_runs%rowtype;
  v_invite private.onboarding_invite_identity%rowtype;
  v_role uuid;
  v_max_seats integer;
  v_current_seats integer;
  v_is_platform_exempt boolean;
  v_now timestamptz := statement_timestamp();
begin
  select r.* into v_run
  from public.saas_onboarding_runs r
  join private.onboarding_invite_identity i on i.run_id = r.id
  where r.id = p_run_id and i.user_id = v_user
  for update of r;
  if not found or not exists (
    select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null
      and u.invited_at is not null and lower(btrim(u.email)) = lower(btrim(v_run.invite_email))
  ) then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;
  select * into strict v_invite from private.onboarding_invite_identity where run_id = p_run_id;
  if v_invite.activated_at is not null then
    if v_invite.terms_version_id is distinct from p_terms_version_id
       or v_invite.terms_hash is distinct from p_document_hash
       or p_accept_terms is distinct from (v_invite.terms_version_id is not null) then
      raise exception 'acceptance differs from recorded receipt' using errcode = '22023';
    end if;
    return v_run.organization_id;
  end if;
  if v_run.status <> 'awaiting_invite' or v_run.current_step <> 'invite'
     or v_run.organization_id is null or v_run.initial_role is null
     or v_run.initial_role not in ('ADMIN', 'TREASURER') then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;
  if p_accept_terms is not true then
    raise exception 'explicit terms acceptance required' using errcode = '22023';
  end if;
  perform 1 from public.saas_terms_versions t
  join private.onboarding_terms_documents d on d.version_id = t.id
  where t.id = p_terms_version_id and t.document_hash = p_document_hash
    and t.document_type = 'terms' and t.active and t.status = 'published'
    and t.effective_at <= v_now and (t.valid_to is null or t.valid_to > v_now)
    and t.document_hash = encode(sha256(convert_to(d.document_text, 'UTF8')), 'hex')
  for share of t;
  if not found then
    raise exception 'current official terms version and hash required' using errcode = '22023';
  end if;
  -- Match the lock used by tenant RBAC assignment and revocation.
  perform 1 from public.organizations where id = v_run.organization_id for update;
  if exists (
    select 1 from public.user_roles
    where organization_id = v_run.organization_id and user_id = v_user
  ) then
    raise exception 'existing tenant membership requires review' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = v_user and ps.active and ps.role in ('MASTER', 'SUPPORT')
  ) into v_is_platform_exempt;

  if not v_is_platform_exempt then
    v_max_seats := private.tenant_seat_limit(v_run.organization_id);
    if v_max_seats is not null then
      v_current_seats := private.tenant_active_seat_count(v_run.organization_id);
      if v_current_seats + 1 > v_max_seats then
        raise exception 'tenant active user limit reached for contracted plan (%/% seats)', v_current_seats, v_max_seats
          using errcode = '55000';
      end if;
    end if;
  end if;

  select id into v_role from public.roles
  where organization_id = v_run.organization_id and code = v_run.initial_role and is_system
  for share;
  if not found then
    raise exception 'initial role unavailable' using errcode = '42501';
  end if;
  insert into public.user_roles(organization_id, user_id, role_id)
  values (v_run.organization_id, v_user, v_role);
  insert into public.saas_terms_acceptances(organization_id, user_id, terms_version_id)
  values (v_run.organization_id, v_user, p_terms_version_id);
  update private.onboarding_invite_identity set activated_at = v_now,
    terms_version_id = p_terms_version_id, terms_hash = p_document_hash where run_id = p_run_id;
  update public.saas_onboarding_runs set status = 'completed', current_step = 'completed',
    completed_at = v_now where id = p_run_id;
  insert into public.saas_onboarding_step_events
    (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
  values (p_run_id, 'completed', 'completed',
    jsonb_build_object('organization_id', v_run.organization_id, 'role_id', v_role,
      'terms_version_id', p_terms_version_id), v_user);
  return v_run.organization_id;
end;
$$;

revoke all on function public.accept_onboarding_invite(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.accept_onboarding_invite(uuid, uuid, text, boolean) to authenticated;

-- ============================================================================
-- 2. Tenant commercial status & active read_only support session readers
-- ============================================================================

create or replace function public.read_tenant_commercial_status(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account public.saas_tenant_accounts%rowtype;
  v_sub public.saas_subscriptions%rowtype;
  v_plan public.saas_plans%rowtype;
  v_ver public.saas_plan_versions%rowtype;
  v_active_users integer;
  v_max_users integer;
  v_overdue numeric(14,2);
  v_open numeric(14,2);
  v_current_price numeric(14,2);
  v_scheduled jsonb := null;
  v_change record;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization_id required' using errcode = '22023';
  end if;
  if not (
    private.belongs_to_org(p_organization_id)
    or private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  select * into v_account
  from public.saas_tenant_accounts
  where organization_id = p_organization_id;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
  order by started_at desc, created_at desc
  limit 1;

  if v_sub.id is not null then
    select * into v_plan from public.saas_plans where id = v_sub.plan_id;
    select * into v_ver from public.saas_plan_versions where id = v_sub.plan_version_id;
    select pt.unit_price into v_current_price
    from public.saas_subscription_price_terms pt
    where pt.organization_id = p_organization_id
      and pt.subscription_id = v_sub.id
      and pt.effective_from <= current_date
      and (pt.effective_to is null or pt.effective_to >= current_date)
    order by pt.effective_from desc
    limit 1;

    select sc.id, sc.change_type, sc.target_plan_version_id, sc.effective_at,
           pv.price as target_price, p.name as target_plan_name
      into v_change
    from public.saas_scheduled_subscription_changes sc
    left join public.saas_plan_versions pv on pv.id = sc.target_plan_version_id
    left join public.saas_plans p on p.id = pv.plan_id
    where sc.organization_id = p_organization_id
      and sc.subscription_id = v_sub.id
      and sc.status = 'scheduled'
    order by sc.effective_at asc
    limit 1;

    if v_change.id is not null then
      v_scheduled := jsonb_build_object(
        'id', v_change.id,
        'change_type', v_change.change_type,
        'target_plan_version_id', v_change.target_plan_version_id,
        'target_plan_name', v_change.target_plan_name,
        'target_price', v_change.target_price,
        'target_max_admin_users', private.plan_version_seat_limit(v_change.target_plan_version_id),
        'effective_at', v_change.effective_at
      );
    end if;
  end if;

  v_active_users := private.tenant_active_seat_count(p_organization_id);
  v_max_users := case when v_sub.plan_version_id is not null then private.plan_version_seat_limit(v_sub.plan_version_id) else null end;

  select coalesce(sum(b.amount_open), 0)::numeric(14,2),
         coalesce(sum(b.amount_open) filter (where b.due_date < current_date), 0)::numeric(14,2)
    into v_open, v_overdue
  from public.v_saas_invoice_balances b
  where b.organization_id = p_organization_id
    and b.derived_status <> 'void';

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'subscription_id', v_sub.id,
    'subscription_status', v_sub.status,
    'commercial_status', v_account.commercial_status,
    'access_override', coalesce(v_account.access_override, 'none'),
    'write_allowed', private.tenant_write_allowed(p_organization_id),
    'plan_id', v_plan.id,
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'plan_version_id', v_ver.id,
    'contract_price', coalesce(v_current_price, v_ver.price),
    'active_users', v_active_users,
    'max_admin_users', v_max_users,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'billing_anchor_day', v_sub.billing_anchor_day,
    'past_due_since', v_sub.past_due_since,
    'grace_until', v_sub.grace_until,
    'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
    'canceled_at', v_sub.canceled_at,
    'export_window_until', case when v_sub.canceled_at is not null then (v_sub.canceled_at::date + 90) when v_sub.status = 'cancel_scheduled' and v_sub.current_period_end is not null then (v_sub.current_period_end + 90) else null end,
    'open_amount', v_open,
    'overdue_amount', v_overdue,
    'scheduled_change', v_scheduled
  );
end;
$$;

revoke all on function public.read_tenant_commercial_status(uuid) from public, anon;
grant execute on function public.read_tenant_commercial_status(uuid) to authenticated;

create or replace function public.read_tenant_active_support_session(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expires_at timestamptz;
  v_scope text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization_id required' using errcode = '22023';
  end if;
  if not (
    private.belongs_to_org(p_organization_id)
    or private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  select s.scope, s.expires_at
    into v_scope, v_expires_at
  from public.saas_support_sessions s
  where s.organization_id = p_organization_id
    and s.ended_at is null
    and s.started_at <= clock_timestamp()
    and s.expires_at > clock_timestamp()
  order by s.expires_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'organization_id', p_organization_id,
      'active', false,
      'scope', null,
      'expires_at', null
    );
  end if;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'active', true,
    'scope', v_scope,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.read_tenant_active_support_session(uuid) from public, anon;
grant execute on function public.read_tenant_active_support_session(uuid) to authenticated;

-- ============================================================================
-- 3. Entrega A & C: Subscription lifecycle commands (MASTER + AAL2)
-- ============================================================================

-- 3.1 Confirm express paid hiring (trialing -> active, first paid cycle starts day 1 of next month per C02)
create or replace function public.confirm_saas_subscription_hiring_idempotent(
  p_organization_id uuid,
  p_plan_version_id uuid default null,
  p_contract_price numeric default null,
  p_reason text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_sub public.saas_subscriptions%rowtype;
  v_target_version public.saas_plan_versions%rowtype;
  v_first_cycle date;
  v_period_end date;
  v_price numeric(14,2);
  v_max_seats integer;
  v_current_seats integer;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'organization_id and idempotency_key required' using errcode = '22023';
  end if;
  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Contratação expressa confirmada');
  if length(v_reason) not between 3 and 500 then
    raise exception 'reason must be between 3 and 500 characters' using errcode = '22023';
  end if;
  if p_contract_price is not null and (
    p_contract_price::text in ('NaN','Infinity','-Infinity')
    or p_contract_price <= 0
    or p_contract_price > 999999999999.99
    or p_contract_price <> round(p_contract_price, 2)
  ) then
    raise exception 'invalid contract_price' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_existing := private.idempotency_begin(
    p_organization_id,
    'confirm_saas_subscription_hiring_idempotent',
    v_key,
    jsonb_build_object(
      'plan_version_id', p_plan_version_id,
      'contract_price', p_contract_price,
      'reason', v_reason
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and status <> 'canceled'
  order by started_at desc, created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'no open subscription found for organization' using errcode = '55000';
  end if;

  if v_sub.status not in ('trialing', 'active') then
    raise exception 'cannot confirm express paid hiring for subscription status %', v_sub.status
      using errcode = '55000';
  end if;

  select * into v_target_version
  from public.saas_plan_versions
  where id = coalesce(p_plan_version_id, v_sub.plan_version_id)
    and status = 'published';

  if v_target_version.id is null then
    raise exception 'published target plan version not found' using errcode = '23503';
  end if;

  v_max_seats := private.plan_version_seat_limit(v_target_version.id);
  if v_max_seats is not null then
    v_current_seats := private.tenant_active_seat_count(p_organization_id);
    if v_current_seats > v_max_seats then
      raise exception 'active tenant users (%) exceed contracted plan seat limit (%)', v_current_seats, v_max_seats
        using errcode = '55000';
    end if;
  end if;

  -- C02 rule: first paid cycle always begins on the 1st day of the next calendar month (never retroactive)
  v_first_cycle := (date_trunc('month', current_date) + interval '1 month')::date;
  v_period_end := (v_first_cycle + interval '1 month - 1 day')::date;
  v_price := coalesce(p_contract_price, v_target_version.price);

  if v_price <= 0 then
    raise exception 'paid subscription requires positive contractual price' using errcode = '22023';
  end if;

  update public.saas_subscriptions
  set plan_id = v_target_version.plan_id,
      plan_version_id = v_target_version.id,
      status = 'active',
      billing_anchor_day = 10,
      current_period_start = v_first_cycle,
      current_period_end = v_period_end,
      cancel_at_period_end = false
  where id = v_sub.id;

  update public.saas_tenant_accounts
  set commercial_status = 'active'
  where organization_id = p_organization_id;

  -- Preserve historical/trial price terms before v_first_cycle and never alter already-invoiced future cycles
  if exists (
    select 1
    from public.saas_invoices i
    left join public.saas_invoice_voids iv on iv.invoice_id = i.id
    where i.organization_id = p_organization_id
      and iv.invoice_id is null
      and i.competence >= v_first_cycle
  ) then
    raise exception 'existing invoiced competence overlaps express paid cycle' using errcode = '55000';
  end if;

  delete from public.saas_subscription_price_terms
  where organization_id = p_organization_id
    and subscription_id = v_sub.id
    and effective_from >= v_first_cycle;

  update public.saas_subscription_price_terms
  set effective_to = (v_first_cycle - 1)::date
  where organization_id = p_organization_id
    and subscription_id = v_sub.id
    and effective_from < v_first_cycle
    and (effective_to is null or effective_to >= v_first_cycle);

  insert into public.saas_subscription_price_terms(
    organization_id, subscription_id, effective_from, effective_to, unit_price, currency, adjustment_reason, created_by
  ) values (
    p_organization_id, v_sub.id, v_first_cycle, null, v_price, v_target_version.currency, 'express_paid_hiring', v_user
  );

  insert into public.saas_subscription_events(
    organization_id, subscription_id, event_type, actor_user_id, metadata
  ) values (
    p_organization_id,
    v_sub.id,
    'activated',
    v_user,
    jsonb_build_object(
      'first_paid_cycle', v_first_cycle,
      'plan_version_id', v_target_version.id,
      'unit_price', v_price,
      'reason', v_reason
    )
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user,
    p_organization_id,
    'saas_subscription.express_hiring_confirmed',
    'saas_subscriptions',
    v_sub.id::text,
    jsonb_build_object(
      'plan_version_id', v_target_version.id,
      'first_paid_cycle', v_first_cycle,
      'unit_price', v_price,
      'reason', v_reason,
      'idempotency_key', v_key
    )
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.confirm_saas_subscription_hiring_idempotent(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.confirm_saas_subscription_hiring_idempotent(uuid, uuid, numeric, text, text) to authenticated;

-- 3.2 Schedule prospective plan change (upgrade/downgrade effective 1st day of next calendar month per C05)
create or replace function public.schedule_saas_plan_change_idempotent(
  p_organization_id uuid,
  p_target_plan_version_id uuid,
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
  v_existing uuid;
  v_sub public.saas_subscriptions%rowtype;
  v_target public.saas_plan_versions%rowtype;
  v_effective_date date;
  v_target_max_seats integer;
  v_current_seats integer;
  v_change_id uuid;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_target_plan_version_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid scheduled plan change arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'schedule_saas_plan_change_idempotent',
    v_key,
    jsonb_build_object(
      'target_plan_version_id', p_target_plan_version_id,
      'reason', v_reason
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and status in ('trialing', 'active', 'past_due')
  order by started_at desc, created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'eligible subscription not found for prospective plan change' using errcode = '55000';
  end if;

  if v_sub.plan_version_id = p_target_plan_version_id then
    raise exception 'target plan version matches current subscription version' using errcode = '22023';
  end if;

  select * into v_target
  from public.saas_plan_versions
  where id = p_target_plan_version_id
    and status = 'published';

  if v_target.id is null then
    raise exception 'published target plan version not found' using errcode = '23503';
  end if;

  -- Reject downgrade if active store seats exceed target plan seat limit (C01 / C05)
  v_target_max_seats := private.plan_version_seat_limit(v_target.id);
  if v_target_max_seats is not null then
    v_current_seats := private.tenant_active_seat_count(p_organization_id);
    if v_current_seats > v_target_max_seats then
      raise exception 'downgrade blocked: active tenant users (%) exceed target plan limit (%)', v_current_seats, v_target_max_seats
        using errcode = '55000';
    end if;
  end if;

  if exists (
    select 1 from public.saas_scheduled_subscription_changes sc
    where sc.organization_id = p_organization_id
      and sc.subscription_id = v_sub.id
      and sc.status = 'scheduled'
  ) then
    raise exception 'another scheduled change already exists for this subscription' using errcode = '55000';
  end if;

  v_effective_date := (date_trunc('month', current_date) + interval '1 month')::date;

  insert into public.saas_scheduled_subscription_changes(
    organization_id, subscription_id, change_type, target_plan_version_id,
    effective_at, status, reason, idempotency_key, created_by
  ) values (
    p_organization_id, v_sub.id, 'plan_change', v_target.id,
    v_effective_date::timestamptz, 'scheduled', v_reason, v_key, v_user
  ) returning id into v_change_id;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user,
    p_organization_id,
    'saas_subscription.plan_change_scheduled',
    'saas_scheduled_subscription_changes',
    v_change_id::text,
    jsonb_build_object(
      'subscription_id', v_sub.id,
      'from_plan_version_id', v_sub.plan_version_id,
      'target_plan_version_id', v_target.id,
      'effective_date', v_effective_date,
      'target_price', v_target.price,
      'reason', v_reason
    )
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_change_id);
  return v_change_id;
end;
$$;

revoke all on function public.schedule_saas_plan_change_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.schedule_saas_plan_change_idempotent(uuid, uuid, text, text) to authenticated;

-- 3.3 Cancel scheduled subscription change
create or replace function public.cancel_scheduled_saas_change_idempotent(
  p_organization_id uuid,
  p_change_id uuid,
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
  v_existing uuid;
  v_change public.saas_scheduled_subscription_changes%rowtype;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_change_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid cancel scheduled change parameters' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'cancel_scheduled_saas_change_idempotent',
    v_key,
    jsonb_build_object('change_id', p_change_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_change
  from public.saas_scheduled_subscription_changes
  where id = p_change_id and organization_id = p_organization_id
  for update;

  if v_change.id is null then
    raise exception 'scheduled change not found' using errcode = '23503';
  end if;
  if v_change.status <> 'scheduled' then
    raise exception 'scheduled change is already %', v_change.status using errcode = '55000';
  end if;

  update public.saas_scheduled_subscription_changes
  set status = 'canceled'
  where id = p_change_id;

  if v_change.change_type = 'cancel' then
    update public.saas_subscriptions
    set status = 'active',
        cancel_at_period_end = false
    where id = v_change.subscription_id
      and status = 'cancel_scheduled';
  end if;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user,
    p_organization_id,
    'saas_subscription.scheduled_change_canceled',
    'saas_scheduled_subscription_changes',
    p_change_id::text,
    jsonb_build_object('change_type', v_change.change_type, 'reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, p_change_id);
  return p_change_id;
end;
$$;

revoke all on function public.cancel_scheduled_saas_change_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.cancel_scheduled_saas_change_idempotent(uuid, uuid, text, text) to authenticated;

-- 3.4 Apply due scheduled plan change, preserving historical price terms (C05)
create or replace function public.apply_scheduled_saas_plan_change_idempotent(
  p_organization_id uuid,
  p_change_id uuid,
  p_reason text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_change public.saas_scheduled_subscription_changes%rowtype;
  v_sub public.saas_subscriptions%rowtype;
  v_target public.saas_plan_versions%rowtype;
  v_effective_date date;
  v_target_max_seats integer;
  v_current_seats integer;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_change_id is null
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid apply scheduled change parameters' using errcode = '22023';
  end if;
  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Aplicação de mudança de plano agendada');
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'apply_scheduled_saas_plan_change_idempotent',
    v_key,
    jsonb_build_object('change_id', p_change_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_change
  from public.saas_scheduled_subscription_changes
  where id = p_change_id and organization_id = p_organization_id
  for update;

  if v_change.id is null then
    raise exception 'scheduled change not found' using errcode = '23503';
  end if;
  if v_change.status <> 'scheduled' or v_change.change_type <> 'plan_change' then
    raise exception 'scheduled plan change not in executable state (% / %)', v_change.change_type, v_change.status
      using errcode = '55000';
  end if;

  v_effective_date := v_change.effective_at::date;
  if v_effective_date > current_date then
    raise exception 'prospective plan change cannot be applied before effective date %', v_effective_date
      using errcode = '55000';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where id = v_change.subscription_id and organization_id = p_organization_id
  for update;

  select * into v_target
  from public.saas_plan_versions
  where id = v_change.target_plan_version_id and status = 'published';

  if v_target.id is null then
    raise exception 'target plan version unavailable' using errcode = '23503';
  end if;

  -- Re-check active seats fail-closed on execution date
  v_target_max_seats := private.plan_version_seat_limit(v_target.id);
  if v_target_max_seats is not null then
    v_current_seats := private.tenant_active_seat_count(p_organization_id);
    if v_current_seats > v_target_max_seats then
      raise exception 'downgrade blocked: active tenant users (%) exceed target plan limit (%)', v_current_seats, v_target_max_seats
        using errcode = '55000';
    end if;
  end if;

  -- Close previous price term cleanly BEFORE effective_date without mutating historical periods
  update public.saas_subscription_price_terms
  set effective_to = (v_effective_date - 1)::date
  where organization_id = p_organization_id
    and subscription_id = v_sub.id
    and effective_from < v_effective_date
    and (effective_to is null or effective_to >= v_effective_date);

  if exists (
    select 1 from public.saas_subscription_price_terms
    where organization_id = p_organization_id
      and subscription_id = v_sub.id
      and effective_from >= v_effective_date
  ) then
    raise exception 'existing future price term overlaps prospective plan change' using errcode = '55000';
  end if;

  insert into public.saas_subscription_price_terms(
    organization_id, subscription_id, effective_from, effective_to, unit_price, currency, adjustment_reason, created_by
  ) values (
    p_organization_id, v_sub.id, v_effective_date, null, v_target.price, v_target.currency, 'scheduled_plan_change', v_user
  );

  update public.saas_subscriptions
  set plan_id = v_target.plan_id,
      plan_version_id = v_target.id,
      current_period_start = v_effective_date,
      current_period_end = (v_effective_date + interval '1 month - 1 day')::date
  where id = v_sub.id;

  update public.saas_scheduled_subscription_changes
  set status = 'applied',
      applied_at = now()
  where id = p_change_id;

  insert into public.saas_subscription_events(
    organization_id, subscription_id, event_type, actor_user_id, metadata
  ) values (
    p_organization_id,
    v_sub.id,
    'plan_changed',
    v_user,
    jsonb_build_object(
      'change_id', p_change_id,
      'from_plan_version_id', v_sub.plan_version_id,
      'to_plan_version_id', v_target.id,
      'effective_date', v_effective_date,
      'new_price', v_target.price,
      'reason', v_reason
    )
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user,
    p_organization_id,
    'saas_subscription.plan_change_applied',
    'saas_subscriptions',
    v_sub.id::text,
    jsonb_build_object(
      'change_id', p_change_id,
      'to_plan_version_id', v_target.id,
      'effective_date', v_effective_date,
      'new_price', v_target.price,
      'reason', v_reason,
      'idempotency_key', v_key
    )
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.apply_scheduled_saas_plan_change_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.apply_scheduled_saas_plan_change_idempotent(uuid, uuid, text, text) to authenticated;

-- 3.5 Mark subscription past_due with 7-day calendar tolerance (no auto-suspend per C03)
create or replace function public.mark_saas_subscription_past_due_idempotent(
  p_organization_id uuid,
  p_invoice_id uuid,
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
  v_existing uuid;
  v_inv record;
  v_sub public.saas_subscriptions%rowtype;
  v_grace_days integer;
  v_grace_until timestamptz;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_invoice_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid past_due transition arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'mark_saas_subscription_past_due_idempotent',
    v_key,
    jsonb_build_object('invoice_id', p_invoice_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_inv
  from public.v_saas_invoice_balances
  where organization_id = p_organization_id
    and id = p_invoice_id;

  if v_inv.id is null then
    raise exception 'SaaS invoice not found' using errcode = '23503';
  end if;
  if v_inv.derived_status = 'void' or v_inv.amount_open <= 0 then
    raise exception 'invoice has no open balance' using errcode = '55000';
  end if;
  if v_inv.due_date >= current_date then
    raise exception 'cannot mark past_due before effective due date %', v_inv.due_date using errcode = '55000';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and id = v_inv.subscription_id
  for update;

  if v_sub.id is null or v_sub.status in ('suspended', 'canceled') then
    raise exception 'subscription cannot enter past_due from status %', coalesce(v_sub.status, 'none')
      using errcode = '55000';
  end if;

  select coalesce(default_grace_days, 7) into v_grace_days
  from public.saas_platform_configuration
  where singleton
  limit 1;
  v_grace_days := greatest(coalesce(v_grace_days, 7), 7);
  v_grace_until := ((v_inv.due_date + make_interval(days := v_grace_days))::date + time '23:59:59')::timestamptz;

  update public.saas_subscriptions
  set status = 'past_due',
      past_due_since = coalesce(past_due_since, now()),
      grace_until = v_grace_until
  where id = v_sub.id;

  update public.saas_tenant_accounts
  set commercial_status = 'past_due',
      grace_until = v_grace_until
  where organization_id = p_organization_id;

  insert into public.saas_subscription_events(
    organization_id, subscription_id, event_type, actor_user_id, metadata
  ) values (
    p_organization_id, v_sub.id, 'past_due', v_user,
    jsonb_build_object('invoice_id', p_invoice_id, 'due_date', v_inv.due_date, 'grace_until', v_grace_until, 'reason', v_reason)
  );

  insert into public.saas_collection_events(
    organization_id, invoice_id, event_type, channel, metadata, actor_user_id
  ) values (
    p_organization_id, p_invoice_id, 'grace_started', 'manual',
    jsonb_build_object('grace_days', v_grace_days, 'grace_until', v_grace_until, 'reason', v_reason),
    v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_subscription.marked_past_due', 'saas_subscriptions', v_sub.id::text,
    jsonb_build_object('invoice_id', p_invoice_id, 'grace_until', v_grace_until, 'reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.mark_saas_subscription_past_due_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.mark_saas_subscription_past_due_idempotent(uuid, uuid, text, text) to authenticated;

-- 3.6 Record manual collection notice (reminder_scheduled / reminder_sent / payment_attempt)
create or replace function public.record_saas_collection_event_idempotent(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_event_type text,
  p_channel text,
  p_external_reference text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_event_id bigint;
  v_ret uuid;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_event_type not in ('reminder_scheduled', 'reminder_sent', 'payment_attempt')
     or p_channel is null or length(btrim(p_channel)) not between 2 and 40
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid collection event parameters' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_existing := private.idempotency_begin(
    p_organization_id,
    'record_saas_collection_event_idempotent',
    v_key,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'event_type', p_event_type,
      'channel', btrim(p_channel),
      'external_reference', nullif(btrim(p_external_reference), ''),
      'note', nullif(btrim(p_note), '')
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  if p_invoice_id is not null and not exists (
    select 1 from public.saas_invoices where id = p_invoice_id and organization_id = p_organization_id
  ) then
    raise exception 'SaaS invoice not found in organization' using errcode = '23503';
  end if;

  insert into public.saas_collection_events(
    organization_id, invoice_id, event_type, channel, external_reference, metadata, actor_user_id
  ) values (
    p_organization_id, p_invoice_id, p_event_type, btrim(p_channel),
    nullif(btrim(p_external_reference), ''),
    jsonb_build_object('note', nullif(btrim(p_note), '')),
    v_user
  ) returning id into v_event_id;

  v_ret := coalesce(p_invoice_id, p_organization_id);

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_collection.event_recorded', 'saas_collection_events', v_event_id::text,
    jsonb_build_object('event_type', p_event_type, 'channel', btrim(p_channel), 'invoice_id', p_invoice_id, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_ret);
  return v_ret;
end;
$$;

revoke all on function public.record_saas_collection_event_idempotent(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.record_saas_collection_event_idempotent(uuid, uuid, text, text, text, text, text) to authenticated;

-- 3.7 Manual suspension (C03: ONLY after overdue balance confirmed AND 7-day calendar tolerance expired)
create or replace function public.suspend_saas_subscription_manual_idempotent(
  p_organization_id uuid,
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
  v_existing uuid;
  v_sub public.saas_subscriptions%rowtype;
  v_oldest_overdue date;
  v_overdue_open numeric(14,2);
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_reason is null or length(btrim(p_reason)) not between 5 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid manual suspension arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'suspend_saas_subscription_manual_idempotent',
    v_key,
    jsonb_build_object('reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and status <> 'canceled'
  order by started_at desc, created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'no active subscription found for suspension' using errcode = '55000';
  end if;
  if v_sub.status = 'suspended' then
    perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
    return v_sub.id;
  end if;

  select min(b.due_date), coalesce(sum(b.amount_open), 0)::numeric(14,2)
    into v_oldest_overdue, v_overdue_open
  from public.v_saas_invoice_balances b
  where b.organization_id = p_organization_id
    and b.derived_status <> 'void'
    and b.amount_open > 0
    and b.due_date < current_date;

  if coalesce(v_overdue_open, 0) <= 0 or v_oldest_overdue is null then
    raise exception 'manual suspension requires verified overdue open invoice balance' using errcode = '55000';
  end if;

  -- Enforce C03 7-day calendar tolerance after effective due date before suspension
  if current_date <= (v_oldest_overdue + 7)
     and (v_sub.grace_until is null or v_sub.grace_until > now()) then
    raise exception 'manual suspension blocked while 7-day tolerance window is active (due %)', v_oldest_overdue
      using errcode = '55000';
  end if;

  update public.saas_subscriptions
  set status = 'suspended'
  where id = v_sub.id;

  update public.saas_tenant_accounts
  set commercial_status = 'suspended'
  where organization_id = p_organization_id;

  insert into public.saas_subscription_events(
    organization_id, subscription_id, event_type, actor_user_id, metadata
  ) values (
    p_organization_id, v_sub.id, 'suspended', v_user,
    jsonb_build_object('oldest_overdue_due_date', v_oldest_overdue, 'overdue_amount', v_overdue_open, 'reason', v_reason)
  );

  insert into public.saas_collection_events(
    organization_id, invoice_id, event_type, channel, metadata, actor_user_id
  ) values (
    p_organization_id, null, 'suspended', 'manual',
    jsonb_build_object('overdue_amount', v_overdue_open, 'reason', v_reason),
    v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_subscription.suspended_manual', 'saas_subscriptions', v_sub.id::text,
    jsonb_build_object('oldest_overdue_due_date', v_oldest_overdue, 'overdue_amount', v_overdue_open, 'reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.suspend_saas_subscription_manual_idempotent(uuid, text, text) from public, anon;
grant execute on function public.suspend_saas_subscription_manual_idempotent(uuid, text, text) to authenticated;

-- 3.8 Reactivate subscription after full overdue payment OR active payment agreement (C03)
create or replace function public.reactivate_saas_subscription_idempotent(
  p_organization_id uuid,
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
  v_existing uuid;
  v_sub public.saas_subscriptions%rowtype;
  v_overdue_open numeric(14,2);
  v_has_agreement boolean;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_reason is null or length(btrim(p_reason)) not between 5 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid reactivation arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'reactivate_saas_subscription_idempotent',
    v_key,
    jsonb_build_object('reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and status in ('past_due', 'suspended')
  order by started_at desc, created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'subscription is not in past_due or suspended state' using errcode = '55000';
  end if;

  select coalesce(sum(b.amount_open), 0)::numeric(14,2)
    into v_overdue_open
  from public.v_saas_invoice_balances b
  where b.organization_id = p_organization_id
    and b.derived_status <> 'void'
    and b.amount_open > 0
    and b.due_date < current_date;

  select exists (
    select 1 from public.v_saas_payment_agreement_status a
    where a.organization_id = p_organization_id
      and a.derived_status = 'active'
  ) into v_has_agreement;

  if coalesce(v_overdue_open, 0) > 0 and not v_has_agreement then
    raise exception 'reactivation requires full settlement of overdue invoices (%) or active payment agreement', v_overdue_open
      using errcode = '55000';
  end if;

  update public.saas_subscriptions
  set status = 'active',
      past_due_since = null,
      grace_until = null
  where id = v_sub.id;

  update public.saas_tenant_accounts
  set commercial_status = 'active',
      grace_until = null
  where organization_id = p_organization_id;

  insert into public.saas_subscription_events(
    organization_id, subscription_id, event_type, actor_user_id, metadata
  ) values (
    p_organization_id, v_sub.id, 'resumed', v_user,
    jsonb_build_object('remaining_overdue', v_overdue_open, 'active_agreement', v_has_agreement, 'reason', v_reason)
  );

  insert into public.saas_collection_events(
    organization_id, invoice_id, event_type, channel, metadata, actor_user_id
  ) values (
    p_organization_id, null, 'reactivated', 'manual',
    jsonb_build_object('remaining_overdue', v_overdue_open, 'active_agreement', v_has_agreement, 'reason', v_reason),
    v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_subscription.reactivated', 'saas_subscriptions', v_sub.id::text,
    jsonb_build_object('remaining_overdue', v_overdue_open, 'active_agreement', v_has_agreement, 'reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.reactivate_saas_subscription_idempotent(uuid, text, text) from public, anon;
grant execute on function public.reactivate_saas_subscription_idempotent(uuid, text, text) to authenticated;

-- 3.9 Cancel subscription (scheduled at period end or justified immediate cancellation per C05 / D01)
create or replace function public.cancel_saas_subscription_idempotent(
  p_organization_id uuid,
  p_immediate boolean,
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
  v_existing uuid;
  v_sub public.saas_subscriptions%rowtype;
  v_effective_end date;
  v_export_until date;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_immediate is null
     or p_reason is null or length(btrim(p_reason)) not between 5 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid cancellation arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'cancel_saas_subscription_idempotent',
    v_key,
    jsonb_build_object('immediate', p_immediate, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  select * into v_sub
  from public.saas_subscriptions
  where organization_id = p_organization_id
    and status <> 'canceled'
  order by started_at desc, created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'no non-canceled subscription found' using errcode = '55000';
  end if;

  if p_immediate then
    v_export_until := (current_date + 90);
    update public.saas_subscriptions
    set status = 'canceled',
        cancel_at_period_end = false,
        canceled_at = now()
    where id = v_sub.id;

    update public.saas_tenant_accounts
    set commercial_status = 'canceled'
    where organization_id = p_organization_id;

    -- Cancel any pending scheduled changes so they cannot apply post-cancellation
    update public.saas_scheduled_subscription_changes
    set status = 'canceled'
    where organization_id = p_organization_id
      and subscription_id = v_sub.id
      and status = 'scheduled';

    insert into public.saas_subscription_events(
      organization_id, subscription_id, event_type, actor_user_id, metadata
    ) values (
      p_organization_id, v_sub.id, 'canceled', v_user,
      jsonb_build_object('immediate', true, 'export_window_until', v_export_until, 'reason', v_reason)
    );

    insert into public.saas_master_audit_logs(
      staff_user_id, organization_id, action, resource_type, resource_id, metadata
    ) values (
      v_user, p_organization_id, 'saas_subscription.canceled_immediate', 'saas_subscriptions', v_sub.id::text,
      jsonb_build_object('export_window_until', v_export_until, 'reason', v_reason, 'idempotency_key', v_key)
    );
  else
    v_effective_end := coalesce(v_sub.current_period_end, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
    v_export_until := (v_effective_end + 90);

    update public.saas_subscriptions
    set status = 'cancel_scheduled',
        cancel_at_period_end = true,
        current_period_end = coalesce(current_period_end, v_effective_end)
    where id = v_sub.id;

    update public.saas_tenant_accounts
    set commercial_status = 'cancel_scheduled'
    where organization_id = p_organization_id;

    if not exists (
      select 1 from public.saas_scheduled_subscription_changes
      where organization_id = p_organization_id and subscription_id = v_sub.id and status = 'scheduled'
    ) then
      insert into public.saas_scheduled_subscription_changes(
        organization_id, subscription_id, change_type, target_plan_version_id,
        effective_at, status, reason, idempotency_key, created_by
      ) values (
        p_organization_id, v_sub.id, 'cancel', null,
        (v_effective_end + 1)::timestamptz, 'scheduled', v_reason, v_key, v_user
      );
    end if;

    insert into public.saas_subscription_events(
      organization_id, subscription_id, event_type, actor_user_id, metadata
    ) values (
      p_organization_id, v_sub.id, 'cancel_scheduled', v_user,
      jsonb_build_object('period_end', v_effective_end, 'export_window_until', v_export_until, 'reason', v_reason)
    );

    insert into public.saas_master_audit_logs(
      staff_user_id, organization_id, action, resource_type, resource_id, metadata
    ) values (
      v_user, p_organization_id, 'saas_subscription.cancel_scheduled', 'saas_subscriptions', v_sub.id::text,
      jsonb_build_object('period_end', v_effective_end, 'export_window_until', v_export_until, 'reason', v_reason, 'idempotency_key', v_key)
    );
  end if;

  perform private.idempotency_complete(p_organization_id, v_key, v_sub.id);
  return v_sub.id;
end;
$$;

revoke all on function public.cancel_saas_subscription_idempotent(uuid, boolean, text, text) from public, anon;
grant execute on function public.cancel_saas_subscription_idempotent(uuid, boolean, text, text) to authenticated;

-- ============================================================================
-- 4. Entrega B: Manual SaaS payments, allocations, compensatory events,
--               agreements, external fiscal references, and SaaS KPIs
-- ============================================================================

create or replace function public.register_saas_payment_idempotent(
  p_organization_id uuid,
  p_paid_at timestamptz,
  p_amount numeric,
  p_payment_method text,
  p_reference text default null,
  p_allocations jsonb default '[]'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_payment_id uuid;
  v_elem jsonb;
  v_inv_id uuid;
  v_alloc_amt numeric(14,2);
  v_alloc_sum numeric(14,2) := 0;
  v_ref text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_paid_at is null or p_amount is null
     or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount <= 0 or p_amount > 999999999999.99 or p_amount <> round(p_amount, 2)
     or p_payment_method not in ('pix', 'boleto', 'card', 'transfer', 'cash', 'other')
     or p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid SaaS payment arguments' using errcode = '22023';
  end if;

  v_ref := nullif(btrim(p_reference), '');
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'register_saas_payment_idempotent',
    v_key,
    jsonb_build_object(
      'paid_at', p_paid_at,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'reference', v_ref,
      'allocations', p_allocations
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  insert into public.saas_payments(
    organization_id, paid_at, amount, currency, payment_method, source_kind, billing_provider, reference, recorded_by
  ) values (
    p_organization_id, p_paid_at, p_amount, 'BRL', p_payment_method, 'manual', 'manual', v_ref, v_user
  ) returning id into v_payment_id;

  for v_elem in select * from jsonb_array_elements(p_allocations) loop
    if jsonb_typeof(v_elem) <> 'object'
       or (v_elem ->> 'invoice_id') is null
       or (v_elem ->> 'amount') is null then
      raise exception 'invalid allocation item format' using errcode = '22023';
    end if;

    v_inv_id := (v_elem ->> 'invoice_id')::uuid;
    v_alloc_amt := (v_elem ->> 'amount')::numeric;

    if v_alloc_amt <= 0 or v_alloc_amt <> round(v_alloc_amt, 2) then
      raise exception 'allocation amount must be positive with 2 decimal places' using errcode = '22023';
    end if;

    v_alloc_sum := v_alloc_sum + v_alloc_amt;
    if v_alloc_sum > p_amount then
      raise exception 'sum of allocations exceeds payment amount' using errcode = '23514';
    end if;

    -- Trigger validate_saas_payment_allocation enforces invoice existence, non-void, and open cap
    insert into public.saas_payment_allocations(
      organization_id, payment_id, invoice_id, amount
    ) values (
      p_organization_id, v_payment_id, v_inv_id, v_alloc_amt
    );
  end loop;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_payment.registered_manual', 'saas_payments', v_payment_id::text,
    jsonb_build_object(
      'amount', p_amount,
      'payment_method', p_payment_method,
      'allocated_total', v_alloc_sum,
      'has_reference', v_ref is not null,
      'idempotency_key', v_key
    )
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_payment_id);
  return v_payment_id;
end;
$$;

revoke all on function public.register_saas_payment_idempotent(uuid, timestamptz, numeric, text, text, jsonb, text) from public, anon;
grant execute on function public.register_saas_payment_idempotent(uuid, timestamptz, numeric, text, text, jsonb, text) to authenticated;

create or replace function public.allocate_saas_payment_idempotent(
  p_organization_id uuid,
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_alloc_id uuid;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_payment_id is null or p_invoice_id is null
     or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid SaaS allocation arguments' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_existing := private.idempotency_begin(
    p_organization_id,
    'allocate_saas_payment_idempotent',
    v_key,
    jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'amount', p_amount)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  insert into public.saas_payment_allocations(
    organization_id, payment_id, invoice_id, amount
  ) values (
    p_organization_id, p_payment_id, p_invoice_id, p_amount
  ) returning id into v_alloc_id;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_payment.allocated', 'saas_payment_allocations', v_alloc_id::text,
    jsonb_build_object('payment_id', p_payment_id, 'invoice_id', p_invoice_id, 'amount', p_amount, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_alloc_id);
  return v_alloc_id;
end;
$$;

revoke all on function public.allocate_saas_payment_idempotent(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.allocate_saas_payment_idempotent(uuid, uuid, uuid, numeric, text) to authenticated;

create or replace function public.reverse_saas_payment_allocation_idempotent(
  p_organization_id uuid,
  p_allocation_id uuid,
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
  v_existing uuid;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_allocation_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid allocation reversal arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'reverse_saas_payment_allocation_idempotent',
    v_key,
    jsonb_build_object('allocation_id', p_allocation_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.saas_payment_allocations
    where id = p_allocation_id and organization_id = p_organization_id
  ) then
    raise exception 'SaaS payment allocation not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_payment_allocation_reversals
    where allocation_id = p_allocation_id
  ) then
    raise exception 'SaaS payment allocation already reversed' using errcode = '55000';
  end if;

  insert into public.saas_payment_allocation_reversals(
    allocation_id, organization_id, reason, reversed_by
  ) values (
    p_allocation_id, p_organization_id, v_reason, v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_payment_allocation.reversed', 'saas_payment_allocation_reversals', p_allocation_id::text,
    jsonb_build_object('reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, p_allocation_id);
  return p_allocation_id;
end;
$$;

revoke all on function public.reverse_saas_payment_allocation_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.reverse_saas_payment_allocation_idempotent(uuid, uuid, text, text) to authenticated;

create or replace function public.reverse_saas_payment_idempotent(
  p_organization_id uuid,
  p_payment_id uuid,
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
  v_existing uuid;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_payment_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid payment reversal arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'reverse_saas_payment_idempotent',
    v_key,
    jsonb_build_object('payment_id', p_payment_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.saas_payments
    where id = p_payment_id and organization_id = p_organization_id
  ) then
    raise exception 'SaaS payment not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_payment_reversals
    where payment_id = p_payment_id
  ) then
    raise exception 'SaaS payment already reversed' using errcode = '55000';
  end if;

  insert into public.saas_payment_reversals(
    payment_id, organization_id, reason, reversed_by
  ) values (
    p_payment_id, p_organization_id, v_reason, v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_payment.reversed', 'saas_payment_reversals', p_payment_id::text,
    jsonb_build_object('reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, p_payment_id);
  return p_payment_id;
end;
$$;

revoke all on function public.reverse_saas_payment_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.reverse_saas_payment_idempotent(uuid, uuid, text, text) to authenticated;

create or replace function public.void_saas_invoice_idempotent(
  p_organization_id uuid,
  p_invoice_id uuid,
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
  v_existing uuid;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_invoice_id is null
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid invoice void arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'void_saas_invoice_idempotent',
    v_key,
    jsonb_build_object('invoice_id', p_invoice_id, 'reason', v_reason)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_invoice_voids
    where invoice_id = p_invoice_id
  ) then
    raise exception 'SaaS invoice already voided' using errcode = '55000';
  end if;

  -- Trigger saas_invoice_voids_validate enforces invoice exists and zero active allocations
  insert into public.saas_invoice_voids(
    invoice_id, organization_id, reason, voided_by
  ) values (
    p_invoice_id, p_organization_id, v_reason, v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_invoice.voided', 'saas_invoice_voids', p_invoice_id::text,
    jsonb_build_object('reason', v_reason, 'idempotency_key', v_key)
  );

  perform private.idempotency_complete(p_organization_id, v_key, p_invoice_id);
  return p_invoice_id;
end;
$$;

revoke all on function public.void_saas_invoice_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.void_saas_invoice_idempotent(uuid, uuid, text, text) to authenticated;

create or replace function public.apply_saas_invoice_adjustment_idempotent(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_adjustment_type text,
  p_signed_amount numeric,
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
  v_existing uuid;
  v_adj_id uuid;
  v_reason text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  -- C03: no automatic late_fee or interest in commercial policy; explicit authorized credits/discounts/adjustments only
  if p_organization_id is null or p_invoice_id is null
     or p_adjustment_type not in ('promotion_discount','agreement_discount','credit','manual_increase','manual_decrease')
     or p_signed_amount is null or p_signed_amount::text in ('NaN','Infinity','-Infinity')
     or p_signed_amount = 0 or p_signed_amount <> round(p_signed_amount, 2)
     or p_reason is null or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid SaaS invoice adjustment arguments' using errcode = '22023';
  end if;

  v_reason := btrim(p_reason);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'apply_saas_invoice_adjustment_idempotent',
    v_key,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'adjustment_type', p_adjustment_type,
      'signed_amount', p_signed_amount,
      'reason', v_reason
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  insert into public.saas_invoice_adjustments(
    organization_id, invoice_id, adjustment_type, signed_amount, reason, idempotency_key, created_by
  ) values (
    p_organization_id, p_invoice_id, p_adjustment_type, p_signed_amount, v_reason, v_key, v_user
  ) returning id into v_adj_id;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_invoice.adjustment_applied', 'saas_invoice_adjustments', v_adj_id::text,
    jsonb_build_object('invoice_id', p_invoice_id, 'adjustment_type', p_adjustment_type, 'signed_amount', p_signed_amount, 'reason', v_reason)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_adj_id);
  return v_adj_id;
end;
$$;

revoke all on function public.apply_saas_invoice_adjustment_idempotent(uuid, uuid, text, numeric, text, text) from public, anon;
grant execute on function public.apply_saas_invoice_adjustment_idempotent(uuid, uuid, text, numeric, text, text) to authenticated;

create or replace function public.record_saas_payment_agreement_idempotent(
  p_organization_id uuid,
  p_invoice_ids uuid[],
  p_installments jsonb,
  p_terms text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_agreement_id uuid;
  v_number text;
  v_original_open numeric(14,2) := 0;
  v_negotiated numeric(14,2) := 0;
  v_inv_id uuid;
  v_inv_open numeric(14,2);
  v_inst jsonb;
  v_inst_idx integer := 0;
  v_inst_amt numeric(14,2);
  v_inst_due date;
  v_discount numeric(14,2);
  v_terms text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_invoice_ids is null or cardinality(p_invoice_ids) < 1
     or p_installments is null or jsonb_typeof(p_installments) <> 'array' or jsonb_array_length(p_installments) < 1
     or p_terms is null or length(btrim(p_terms)) not between 5 and 1000
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid SaaS payment agreement arguments' using errcode = '22023';
  end if;

  v_terms := btrim(p_terms);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'record_saas_payment_agreement_idempotent',
    v_key,
    jsonb_build_object('invoice_ids', p_invoice_ids, 'installments', p_installments, 'terms', v_terms)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- Sum original open balances across selected non-void invoices
  foreach v_inv_id in array p_invoice_ids loop
    select b.amount_open into v_inv_open
    from public.v_saas_invoice_balances b
    where b.organization_id = p_organization_id
      and b.id = v_inv_id
      and b.derived_status <> 'void';

    if v_inv_open is null or v_inv_open <= 0 then
      raise exception 'agreement invoice % not found or has zero open balance', v_inv_id using errcode = '55000';
    end if;
    v_original_open := v_original_open + v_inv_open;
  end loop;

  for v_inst in select * from jsonb_array_elements(p_installments) loop
    v_inst_amt := (v_inst ->> 'amount')::numeric;
    v_inst_due := (v_inst ->> 'due_date')::date;
    if v_inst_amt is null or v_inst_amt <= 0 or v_inst_amt <> round(v_inst_amt, 2) or v_inst_due is null then
      raise exception 'invalid agreement installment entry' using errcode = '22023';
    end if;
    v_negotiated := v_negotiated + v_inst_amt;
  end loop;

  if v_negotiated > v_original_open then
    raise exception 'C03: agreement cannot add interest or increase principal beyond open balance' using errcode = '23514';
  end if;

  v_number := 'AGR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.saas_agreement_seq')::text, 5, '0');
  v_discount := v_original_open - v_negotiated;

  insert into public.saas_payment_agreements(
    organization_id, agreement_number, agreement_date, original_open_amount, negotiated_amount,
    down_payment, installment_count, charges_treatment, terms, created_by
  ) values (
    p_organization_id, v_number, current_date, v_original_open, v_negotiated,
    0, jsonb_array_length(p_installments),
    case when v_discount > 0 then 'explicit_discount' else 'preserve' end,
    v_terms, v_user
  ) returning id into v_agreement_id;

  foreach v_inv_id in array p_invoice_ids loop
    select b.amount_open into v_inv_open
    from public.v_saas_invoice_balances b
    where b.organization_id = p_organization_id and b.id = v_inv_id;

    insert into public.saas_payment_agreement_invoices(
      organization_id, agreement_id, invoice_id, included_amount
    ) values (
      p_organization_id, v_agreement_id, v_inv_id, v_inv_open
    ) on conflict (agreement_id, invoice_id) do nothing;
  end loop;

  for v_inst in select * from jsonb_array_elements(p_installments) loop
    v_inst_idx := v_inst_idx + 1;
    insert into public.saas_payment_agreement_installments(
      organization_id, agreement_id, installment_number, due_date, amount
    ) values (
      p_organization_id, v_agreement_id, v_inst_idx,
      (v_inst ->> 'due_date')::date, (v_inst ->> 'amount')::numeric(14,2)
    );
  end loop;

  insert into public.saas_payment_agreement_events(
    organization_id, agreement_id, event_type, reason, actor_user_id
  ) values (
    p_organization_id, v_agreement_id, 'created', v_terms, v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_payment_agreement.created', 'saas_payment_agreements', v_agreement_id::text,
    jsonb_build_object('agreement_number', v_number, 'original_open', v_original_open, 'negotiated', v_negotiated, 'installments', v_inst_idx)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_agreement_id);
  return v_agreement_id;
end;
$$;

revoke all on function public.record_saas_payment_agreement_idempotent(uuid, uuid[], jsonb, text, text) from public, anon;
grant execute on function public.record_saas_payment_agreement_idempotent(uuid, uuid[], jsonb, text, text) to authenticated;

create or replace function public.register_saas_fiscal_document_idempotent(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_document_type text,
  p_status text,
  p_document_number text,
  p_external_reference text,
  p_issued_at timestamptz default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_doc_id uuid;
  v_doc_num text;
  v_ext_ref text;
  v_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null
     or p_document_type not in ('nfse', 'receipt', 'other')
     or p_status not in ('pending', 'issued', 'canceled', 'error')
     or p_document_number is null or length(btrim(p_document_number)) not between 1 and 80
     or p_external_reference is null or length(btrim(p_external_reference)) not between 1 and 160
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid SaaS fiscal document arguments' using errcode = '22023';
  end if;

  v_doc_num := btrim(p_document_number);
  v_ext_ref := btrim(p_external_reference);
  v_key := btrim(p_idempotency_key);

  v_existing := private.idempotency_begin(
    p_organization_id,
    'register_saas_fiscal_document_idempotent',
    v_key,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'document_type', p_document_type,
      'status', p_status,
      'document_number', v_doc_num,
      'external_reference', v_ext_ref
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  if p_invoice_id is not null and not exists (
    select 1 from public.saas_invoices where id = p_invoice_id and organization_id = p_organization_id
  ) then
    raise exception 'SaaS invoice not found in organization' using errcode = '23503';
  end if;

  insert into public.saas_fiscal_documents(
    organization_id, invoice_id, document_type, status, document_number, external_reference, issued_at, metadata
  ) values (
    p_organization_id, p_invoice_id, p_document_type, p_status, v_doc_num, v_ext_ref,
    coalesce(p_issued_at, case when p_status = 'issued' then now() else null end),
    jsonb_build_object('recorded_by', v_user, 'source', 'manual_external_reference')
  ) returning id into v_doc_id;

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'saas_fiscal_document.recorded', 'saas_fiscal_documents', v_doc_id::text,
    jsonb_build_object('invoice_id', p_invoice_id, 'document_type', p_document_type, 'status', p_status, 'document_number', v_doc_num)
  );

  perform private.idempotency_complete(p_organization_id, v_key, v_doc_id);
  return v_doc_id;
end;
$$;

revoke all on function public.register_saas_fiscal_document_idempotent(uuid, uuid, text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.register_saas_fiscal_document_idempotent(uuid, uuid, text, text, text, text, timestamptz, text) to authenticated;

create or replace function public.read_master_saas_financial_summary(p_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv record;
  v_pay record;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  select
    count(*) filter (where b.derived_status <> 'void')::integer as active_invoices_count,
    coalesce(sum(b.amount_due) filter (where b.derived_status <> 'void'), 0)::numeric(14,2) as total_billed,
    coalesce(sum(b.amount_paid) filter (where b.derived_status <> 'void'), 0)::numeric(14,2) as total_paid_allocated,
    coalesce(sum(b.amount_open) filter (where b.derived_status <> 'void'), 0)::numeric(14,2) as total_open,
    coalesce(sum(b.amount_open) filter (where b.derived_status <> 'void' and b.due_date < current_date), 0)::numeric(14,2) as total_overdue,
    count(*) filter (where b.derived_status = 'void')::integer as voided_count,
    coalesce(sum(b.original_amount) filter (where b.derived_status = 'void'), 0)::numeric(14,2) as voided_amount
  into v_inv
  from public.v_saas_invoice_balances b
  where p_organization_id is null or b.organization_id = p_organization_id;

  select
    count(*) filter (where p.active)::integer as active_payments_count,
    coalesce(sum(p.amount) filter (where p.active), 0)::numeric(14,2) as total_received,
    coalesce(sum(p.unallocated_amount) filter (where p.active), 0)::numeric(14,2) as total_unallocated_credit
  into v_pay
  from public.v_saas_payment_balances p
  where p_organization_id is null or p.organization_id = p_organization_id;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'active_invoices_count', v_inv.active_invoices_count,
    'total_billed', v_inv.total_billed,
    'total_paid_allocated', v_inv.total_paid_allocated,
    'total_open', v_inv.total_open,
    'total_overdue', v_inv.total_overdue,
    'voided_count', v_inv.voided_count,
    'voided_amount', v_inv.voided_amount,
    'active_payments_count', v_pay.active_payments_count,
    'total_received', v_pay.total_received,
    'total_unallocated_credit', v_pay.total_unallocated_credit,
    'as_of', current_date
  );
end;
$$;

revoke all on function public.read_master_saas_financial_summary(uuid) from public, anon;
grant execute on function public.read_master_saas_financial_summary(uuid) to authenticated;

-- ============================================================================
-- 5. Entrega D: Master/Support internal notes, ticket assignment & internal ticket idempotency
-- ============================================================================

create or replace function public.add_master_support_internal_note_idempotent(
  p_ticket_id uuid,
  p_note text,
  p_next_status text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_key text;
  v_hash text;
  v_current private.master_idempotency_keys%rowtype;
  v_ticket public.saas_support_tickets%rowtype;
  v_msg_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('SUPPORT')) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  if p_ticket_id is null
     or p_note is null or length(btrim(p_note)) not between 1 and 5000
     or (p_next_status is not null and p_next_status not in ('new','triage','working','waiting_client','resolved','closed'))
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid internal support note parameters' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_hash := encode(extensions.digest(jsonb_build_object(
    'ticket_id', p_ticket_id,
    'note', btrim(p_note),
    'next_status', p_next_status
  )::text, 'sha256'), 'hex');

  insert into private.master_idempotency_keys(staff_user_id, idempotency_key, operation, payload_hash)
  values (v_user, v_key, 'add_master_support_internal_note_idempotent', v_hash)
  on conflict (staff_user_id, idempotency_key) do nothing;

  select * into v_current
  from private.master_idempotency_keys
  where staff_user_id = v_user and idempotency_key = v_key
  for update;

  if v_current.payload_hash is distinct from v_hash or v_current.operation <> 'add_master_support_internal_note_idempotent' then
    raise exception 'Master idempotency key reused with different payload' using errcode = '22023';
  end if;
  if v_current.result_reference is not null then
    return v_current.result_reference;
  end if;

  select * into v_ticket
  from public.saas_support_tickets
  where id = p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception 'support ticket not found' using errcode = '23503';
  end if;

  insert into public.saas_support_ticket_messages(
    organization_id, ticket_id, sender_user_id, sender_kind, visibility, body
  ) values (
    v_ticket.organization_id, v_ticket.id, v_user, 'platform_staff', 'internal_note', btrim(p_note)
  ) returning id into v_msg_id;

  if p_next_status is not null and p_next_status <> v_ticket.status then
    update public.saas_support_tickets
    set status = p_next_status,
        resolved_at = case when p_next_status = 'resolved' then now() else resolved_at end,
        closed_at = case when p_next_status = 'closed' then now() else closed_at end
    where id = v_ticket.id;

    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, visibility, reason, actor_user_id
    ) values (
      v_ticket.organization_id, v_ticket.id, v_ticket.status, p_next_status, 'internal', 'internal_note_status_update', v_user
    );
  else
    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, visibility, reason, actor_user_id
    ) values (
      v_ticket.organization_id, v_ticket.id, v_ticket.status, v_ticket.status, 'internal', 'internal_note_added', v_user
    );
  end if;

  update private.master_idempotency_keys
  set result_reference = v_msg_id, completed_at = now()
  where staff_user_id = v_user and idempotency_key = v_key;

  return v_msg_id;
end;
$$;

revoke all on function public.add_master_support_internal_note_idempotent(uuid, text, text, text) from public, anon;
grant execute on function public.add_master_support_internal_note_idempotent(uuid, text, text, text) to authenticated;

create or replace function public.assign_master_support_ticket_idempotent(
  p_ticket_id uuid,
  p_assigned_staff_user_id uuid default null,
  p_priority text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_key text;
  v_hash text;
  v_current private.master_idempotency_keys%rowtype;
  v_ticket public.saas_support_tickets%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('SUPPORT')) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  if p_ticket_id is null
     or (p_priority is not null and p_priority not in ('low','medium','high','urgent'))
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid support ticket assignment arguments' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_hash := encode(extensions.digest(jsonb_build_object(
    'ticket_id', p_ticket_id,
    'assigned_staff_user_id', p_assigned_staff_user_id,
    'priority', p_priority
  )::text, 'sha256'), 'hex');

  insert into private.master_idempotency_keys(staff_user_id, idempotency_key, operation, payload_hash)
  values (v_user, v_key, 'assign_master_support_ticket_idempotent', v_hash)
  on conflict (staff_user_id, idempotency_key) do nothing;

  select * into v_current
  from private.master_idempotency_keys
  where staff_user_id = v_user and idempotency_key = v_key
  for update;

  if v_current.payload_hash is distinct from v_hash or v_current.operation <> 'assign_master_support_ticket_idempotent' then
    raise exception 'Master idempotency key reused with different payload' using errcode = '22023';
  end if;
  if v_current.result_reference is not null then
    return v_current.result_reference;
  end if;

  select * into v_ticket
  from public.saas_support_tickets
  where id = p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception 'support ticket not found' using errcode = '23503';
  end if;

  if p_assigned_staff_user_id is not null and not exists (
    select 1 from public.platform_staff ps
    where ps.user_id = p_assigned_staff_user_id and ps.active and ps.role in ('MASTER', 'SUPPORT')
  ) then
    raise exception 'assigned operator must be active MASTER or SUPPORT staff' using errcode = '23503';
  end if;

  update public.saas_support_tickets
  set assigned_staff_user_id = p_assigned_staff_user_id,
      priority = coalesce(p_priority, priority)
  where id = v_ticket.id;

  insert into public.saas_support_ticket_events(
    organization_id, ticket_id, from_status, to_status, visibility, reason, actor_user_id
  ) values (
    v_ticket.organization_id, v_ticket.id, v_ticket.status, v_ticket.status, 'internal', 'ticket_triage_assignment', v_user
  );

  insert into public.saas_master_audit_logs(
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, v_ticket.organization_id, 'saas_support.ticket_assigned', 'saas_support_tickets', v_ticket.id::text,
    jsonb_build_object('assigned_staff_user_id', p_assigned_staff_user_id, 'priority', coalesce(p_priority, v_ticket.priority))
  );

  update private.master_idempotency_keys
  set result_reference = v_ticket.id, completed_at = now()
  where staff_user_id = v_user and idempotency_key = v_key;

  return v_ticket.id;
end;
$$;

revoke all on function public.assign_master_support_ticket_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.assign_master_support_ticket_idempotent(uuid, uuid, text, text) to authenticated;

create or replace function public.create_saas_internal_ticket_idempotent(
  p_related_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_key text;
  v_hash text;
  v_current private.master_idempotency_keys%rowtype;
  v_ticket_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('SUPPORT')) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  v_key := btrim(p_idempotency_key);
  v_hash := encode(extensions.digest(jsonb_build_object(
    'related_organization_id', p_related_organization_id,
    'subject', btrim(coalesce(p_subject, '')),
    'category', p_category,
    'priority', p_priority,
    'message', btrim(coalesce(p_message, ''))
  )::text, 'sha256'), 'hex');

  insert into private.master_idempotency_keys(staff_user_id, idempotency_key, operation, payload_hash)
  values (v_user, v_key, 'create_saas_internal_ticket_idempotent', v_hash)
  on conflict (staff_user_id, idempotency_key) do nothing;

  select * into v_current
  from private.master_idempotency_keys
  where staff_user_id = v_user and idempotency_key = v_key
  for update;

  if v_current.payload_hash is distinct from v_hash or v_current.operation <> 'create_saas_internal_ticket_idempotent' then
    raise exception 'Master idempotency key reused with different payload' using errcode = '22023';
  end if;
  if v_current.result_reference is not null then
    return v_current.result_reference;
  end if;

  v_ticket_id := public.create_saas_internal_ticket(
    p_related_organization_id,
    btrim(p_subject),
    p_category,
    p_priority,
    btrim(p_message),
    null
  );

  update private.master_idempotency_keys
  set result_reference = v_ticket_id, completed_at = now()
  where staff_user_id = v_user and idempotency_key = v_key;

  return v_ticket_id;
end;
$$;

revoke all on function public.create_saas_internal_ticket_idempotent(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_saas_internal_ticket_idempotent(uuid, text, text, text, text, text) to authenticated;

create or replace function public.list_platform_support_staff()
returns table (user_id uuid, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('SUPPORT')) then
    raise exception 'platform permission denied' using errcode = '42501';
  end if;

  return query
  select ps.user_id, ps.role
  from public.platform_staff ps
  where ps.active
    and ps.role in ('MASTER', 'SUPPORT')
  order by ps.role, ps.user_id;
end;
$$;

revoke all on function public.list_platform_support_staff() from public, anon;
grant execute on function public.list_platform_support_staff() to authenticated;


-- Expand search_platform_master_tenants status allowlist for full M04 lifecycle filtering
create or replace function public.search_platform_master_tenants(
  p_search text,
  p_subscription_status text,
  p_plan_search text,
  p_limit integer,
  p_offset integer
) returns table(
  organization_id uuid,
  organization_name text,
  organization_number text,
  organization_status text,
  subscription_status text,
  plan_name text,
  open_support_tickets bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_plan text;
  v_status text;
begin
  perform private.require_platform_staff('MASTER');
  if p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset < 0 or p_offset > 20000
     or p_search is not null and length(btrim(p_search)) > 100
     or p_plan_search is not null and length(btrim(p_plan_search)) > 100
  then
    raise exception 'invalid Master tenant search' using errcode = '22023';
  end if;
  v_search := nullif(lower(btrim(p_search)), '');
  v_plan := nullif(lower(btrim(p_plan_search)), '');
  v_status := coalesce(nullif(btrim(p_subscription_status), ''), 'all');
  if v_status not in ('all', 'trialing', 'active', 'past_due', 'suspended', 'cancel_scheduled', 'canceled') then
    raise exception 'invalid Master tenant status filter' using errcode = '22023';
  end if;
  return query
  select o.id, o.name, o.number, o.status,
         coalesce(s.status, 'none'),
         coalesce(pv.display_name_snapshot, p.name, 'Sem plano'),
         (select count(*) from public.saas_support_tickets t
           where t.organization_id = o.id and t.ticket_scope = 'tenant'
             and t.status not in ('resolved', 'closed'))
  from public.organizations o
  left join public.organization_settings settings on settings.organization_id = o.id
  left join public.saas_tenant_accounts account on account.organization_id = o.id
  left join lateral (
    select x.status, x.plan_id, x.plan_version_id from public.saas_subscriptions x
    where x.organization_id = o.id order by x.started_at desc, x.id desc limit 1
  ) s on true
  left join public.saas_plans p on p.id = s.plan_id
  left join public.saas_plan_versions pv on pv.id = s.plan_version_id
  where (v_search is null or position(v_search in lower(concat_ws(' ', o.name, o.number,
        settings.city, settings.email, account.billing_email, account.billing_phone))) > 0)
    and (v_status = 'all' or coalesce(s.status, 'none') = v_status)
    and (v_plan is null or position(v_plan in lower(concat_ws(' ', pv.display_name_snapshot, p.name, p.code))) > 0)
  order by o.name, o.id
  limit p_limit offset p_offset;
end $$;

revoke all on function public.search_platform_master_tenants(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_platform_master_tenants(text, text, text, integer, integer) to authenticated;

commit;
