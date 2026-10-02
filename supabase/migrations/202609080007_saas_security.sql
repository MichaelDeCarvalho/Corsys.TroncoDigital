-- Corsys Tronco Digital
-- Migration 007: SaaS security boundaries, tenant status enforcement and RLS
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

create or replace function private.is_platform_staff(p_role text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff s
    where s.user_id = (select auth.uid())
      and s.active
      and (p_role is null or s.role = p_role)
  );
$$;

create or replace function private.has_active_support_session(
  p_organization_id uuid,
  p_required_scope text default 'read_only'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.saas_support_sessions s
    join public.platform_staff ps on ps.user_id = s.staff_user_id
    where s.organization_id = p_organization_id
      and s.staff_user_id = (select auth.uid())
      and ps.active
      and ps.role in ('MASTER', 'SUPPORT')
      and s.ended_at is null
      and s.started_at <= now()
      and s.expires_at > now()
      and (
        p_required_scope = 'read_only'
        or s.scope = p_required_scope
      )
  );
$$;

create or replace function private.tenant_write_allowed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when a.commercial_status in ('trialing', 'active') then true
      when a.commercial_status = 'past_due'
        then a.grace_until is not null and a.grace_until > now()
      else false
    end
    from public.saas_tenant_accounts a
    where a.organization_id = p_organization_id
  ), false);
$$;

-- A Master/support session may read an explicitly opened tenant, but does not gain write permissions.
create or replace function private.belongs_to_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      where ur.organization_id = p_organization_id
        and ur.user_id = (select auth.uid())
    )
    or private.has_active_support_session(p_organization_id, 'read_only');
$$;

create or replace function private.has_permission(
  p_organization_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.organization_id = p_organization_id
        and ur.user_id = (select auth.uid())
        and rp.permission_code = p_permission
    )
    or (
      p_permission in ('members.read', 'finance.read', 'reports.read')
      and private.has_active_support_session(p_organization_id, 'read_only')
    );
$$;

-- Current financial command functions call require_permission; this replacement adds the SaaS write gate.
create or replace function private.require_permission(
  p_organization_id uuid,
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.has_permission(p_organization_id, p_permission) then
    raise exception 'permission denied: %', p_permission using errcode = '42501';
  end if;

  if p_permission not in ('members.read', 'finance.read', 'reports.read', 'audit.read')
     and not private.tenant_write_allowed(p_organization_id) then
    raise exception 'tenant subscription does not allow write operations'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.is_platform_staff(text) from public;
revoke all on function private.has_active_support_session(uuid, text) from public;
revoke all on function private.tenant_write_allowed(uuid) from public;
revoke all on function private.belongs_to_org(uuid) from public;
revoke all on function private.has_permission(uuid, text) from public;
revoke all on function private.require_permission(uuid, text) from public;

grant usage on schema private to authenticated;
grant execute on function private.is_platform_staff(text) to authenticated;
grant execute on function private.has_active_support_session(uuid, text) to authenticated;
grant execute on function private.tenant_write_allowed(uuid) to authenticated;
grant execute on function private.belongs_to_org(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.require_permission(uuid, text) to authenticated;

revoke all on
  public.platform_staff,
  public.saas_plans,
  public.saas_plan_entitlements,
  public.saas_tenant_accounts,
  public.saas_subscriptions,
  public.saas_subscription_events,
  public.saas_invoices,
  public.saas_invoice_voids,
  public.saas_payments,
  public.saas_payment_allocations,
  public.saas_payment_reversals,
  public.saas_webhook_events,
  public.saas_support_sessions,
  public.saas_master_audit_logs,
  public.saas_terms_versions,
  public.saas_terms_acceptances,
  public.saas_fiscal_documents
from anon, authenticated;

alter table public.platform_staff enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_plan_entitlements enable row level security;
alter table public.saas_tenant_accounts enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.saas_subscription_events enable row level security;
alter table public.saas_invoices enable row level security;
alter table public.saas_invoice_voids enable row level security;
alter table public.saas_payments enable row level security;
alter table public.saas_payment_allocations enable row level security;
alter table public.saas_payment_reversals enable row level security;
alter table public.saas_webhook_events enable row level security;
alter table public.saas_support_sessions enable row level security;
alter table public.saas_master_audit_logs enable row level security;
alter table public.saas_terms_versions enable row level security;
alter table public.saas_terms_acceptances enable row level security;
alter table public.saas_fiscal_documents enable row level security;

-- Authenticated browser gets read access only where policies allow it.
grant select on
  public.platform_staff,
  public.saas_plans,
  public.saas_plan_entitlements,
  public.saas_tenant_accounts,
  public.saas_subscriptions,
  public.saas_subscription_events,
  public.saas_invoices,
  public.saas_invoice_voids,
  public.saas_payments,
  public.saas_payment_allocations,
  public.saas_payment_reversals,
  public.saas_support_sessions,
  public.saas_terms_versions,
  public.saas_terms_acceptances,
  public.saas_fiscal_documents,
  public.v_saas_active_payment_allocations,
  public.v_saas_invoice_balances,
  public.v_saas_payment_balances
to authenticated;

-- Platform staff identity.
create policy platform_staff_select_self_or_master
on public.platform_staff for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_platform_staff('MASTER')
);

-- MASTER can inspect commercial configuration; tenant admins can inspect their contracted plan.
create policy saas_plans_select
on public.saas_plans for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or exists (
    select 1
    from public.saas_subscriptions s
    where s.plan_id = saas_plans.id
      and private.has_permission(s.organization_id, 'settings.manage')
  )
);

create policy saas_plan_entitlements_select
on public.saas_plan_entitlements for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or exists (
    select 1
    from public.saas_subscriptions s
    where s.plan_id = saas_plan_entitlements.plan_id
      and private.has_permission(s.organization_id, 'settings.manage')
  )
);

create policy saas_tenant_accounts_select
on public.saas_tenant_accounts for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_subscriptions_select
on public.saas_subscriptions for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_subscription_events_select
on public.saas_subscription_events for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_invoices_select
on public.saas_invoices for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_invoice_voids_select
on public.saas_invoice_voids for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payments_select
on public.saas_payments for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_allocations_select
on public.saas_payment_allocations for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_reversals_select
on public.saas_payment_reversals for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_support_sessions_select
on public.saas_support_sessions for select to authenticated
using (
  staff_user_id = (select auth.uid())
  or private.is_platform_staff('MASTER')
);

create policy saas_terms_versions_select
on public.saas_terms_versions for select to authenticated
using (active or private.is_platform_staff('MASTER'));

create policy saas_terms_acceptances_select
on public.saas_terms_acceptances for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or user_id = (select auth.uid())
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_fiscal_documents_select
on public.saas_fiscal_documents for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

-- No authenticated INSERT/UPDATE/DELETE policies are intentionally created for platform billing facts.
-- Master/billing mutations must use controlled server-side commands with audit and idempotency.
-- Webhook events and master audit logs are server-side only and receive no authenticated SELECT grant.
