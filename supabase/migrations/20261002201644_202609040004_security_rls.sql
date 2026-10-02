-- Corsys Tesouraria
-- Migration 004: RBAC helpers, grants and RLS

create or replace function private.belongs_to_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.organization_id = p_organization_id
      and ur.user_id = (select auth.uid())
  );
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
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.organization_id = p_organization_id
      and ur.user_id = (select auth.uid())
      and rp.permission_code = p_permission
  );
$$;

create or replace function private.is_self_member(
  p_organization_id uuid,
  p_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_user_links l
    where l.organization_id = p_organization_id
      and l.member_id = p_member_id
      and l.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_financial_member(
  p_organization_id uuid,
  p_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_permission(p_organization_id, 'finance.read')
    or private.is_self_member(p_organization_id, p_member_id);
$$;

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
end;
$$;

revoke all on function private.belongs_to_org(uuid) from public;
revoke all on function private.has_permission(uuid, text) from public;
revoke all on function private.is_self_member(uuid, uuid) from public;
revoke all on function private.can_read_financial_member(uuid, uuid) from public;
revoke all on function private.require_permission(uuid, text) from public;
-- Secure defaults for current and future application objects created by the migration owner.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- Deny broad table access first; grant back only the required reads below.
revoke all on all tables in schema public from anon, authenticated;

-- Private helpers are not generally callable.
revoke execute on all functions in schema private from public, anon, authenticated;


grant usage on schema private to authenticated;
grant execute on function private.belongs_to_org(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.is_self_member(uuid, uuid) to authenticated;
grant execute on function private.can_read_financial_member(uuid, uuid) to authenticated;
grant execute on function private.require_permission(uuid, text) to authenticated;


-- Reference/operational reads.
grant select on
  public.organizations,
  public.organization_settings,
  public.user_profiles,
  public.permissions,
  public.roles,
  public.role_permissions,
  public.user_roles,
  public.members,
  public.member_user_links,
  public.financial_categories,
  public.payment_methods,
  public.financial_accounts,
  public.account_opening_entries,
  public.funds,
  public.recurring_rules,
  public.recurring_rule_versions,
  public.recurring_rule_members,
  public.recurring_rule_exceptions,
  public.events,
  public.financial_periods,
  public.period_events,
  public.charge_batches,
  public.charge_plans,
  public.charges,
  public.charge_adjustments,
  public.charge_cancellations,
  public.payments,
  public.payment_reversals,
  public.member_credits,
  public.member_credit_reversals,
  public.receivable_allocations,
  public.allocation_reversals,
  public.mutual_batches,
  public.mutual_assignments,
  public.event_participants,
  public.legacy_financial_records,
  public.audit_logs,
  public.v_active_allocations,
  public.v_charge_balances,
  public.v_payment_balances,
  public.v_member_credit_balances,
  public.v_member_financial_position,
  public.v_member_statement,
  public.v_member_financial_reconciliation
to authenticated;

-- RLS
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.user_profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.members enable row level security;
alter table public.member_user_links enable row level security;
alter table public.financial_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.account_opening_entries enable row level security;
alter table public.funds enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.recurring_rule_versions enable row level security;
alter table public.recurring_rule_members enable row level security;
alter table public.recurring_rule_exceptions enable row level security;
alter table public.events enable row level security;
alter table public.financial_periods enable row level security;
alter table public.period_events enable row level security;
alter table public.charge_batches enable row level security;
alter table public.charge_plans enable row level security;
alter table public.charges enable row level security;
alter table public.charge_adjustments enable row level security;
alter table public.charge_cancellations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_reversals enable row level security;
alter table public.member_credits enable row level security;
alter table public.member_credit_reversals enable row level security;
alter table public.receivable_allocations enable row level security;
alter table public.allocation_reversals enable row level security;
alter table public.mutual_batches enable row level security;
alter table public.mutual_assignments enable row level security;
alter table public.event_participants enable row level security;
alter table public.legacy_financial_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_keys enable row level security;

create policy organizations_select
on public.organizations for select to authenticated
using (private.belongs_to_org(id));

create policy organization_settings_select
on public.organization_settings for select to authenticated
using (private.belongs_to_org(organization_id));

create policy permissions_select
on public.permissions for select to authenticated
using (true);

create policy user_profiles_select_self
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()));

create policy roles_select
on public.roles for select to authenticated
using (
  private.has_permission(organization_id, 'users.manage')
  or exists (
    select 1
    from public.user_roles ur
    where ur.organization_id = roles.organization_id
      and ur.role_id = roles.id
      and ur.user_id = (select auth.uid())
  )
);

create policy role_permissions_select
on public.role_permissions for select to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (
        private.has_permission(r.organization_id, 'users.manage')
        or exists (
          select 1
          from public.user_roles ur
          where ur.organization_id = r.organization_id
            and ur.role_id = r.id
            and ur.user_id = (select auth.uid())
        )
      )
  )
);

create policy user_roles_select
on public.user_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_permission(organization_id, 'users.manage')
);

create policy members_select
on public.members for select to authenticated
using (
  private.has_permission(organization_id, 'members.read')
  or private.can_read_financial_member(organization_id, id)
);

create policy member_user_links_select
on public.member_user_links for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_permission(organization_id, 'users.manage')
);

create policy categories_select
on public.financial_categories for select to authenticated
using (private.belongs_to_org(organization_id));

create policy payment_methods_select
on public.payment_methods for select to authenticated
using (private.belongs_to_org(organization_id));

create policy financial_accounts_select
on public.financial_accounts for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy account_opening_entries_select
on public.account_opening_entries for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy funds_select
on public.funds for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy recurring_rules_select
on public.recurring_rules for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy recurring_rule_versions_select
on public.recurring_rule_versions for select to authenticated
using (
  exists (
    select 1 from public.recurring_rules r
    where r.id = recurring_rule_versions.recurring_rule_id
      and private.has_permission(r.organization_id, 'finance.read')
  )
);

create policy recurring_rule_members_select
on public.recurring_rule_members for select to authenticated
using (
  private.has_permission(organization_id, 'finance.read')
  or private.is_self_member(organization_id, member_id)
);

create policy recurring_rule_exceptions_select
on public.recurring_rule_exceptions for select to authenticated
using (
  private.has_permission(organization_id, 'finance.read')
  or private.is_self_member(organization_id, member_id)
);

create policy events_select
on public.events for select to authenticated
using (
  private.has_permission(organization_id, 'finance.read')
  or exists (
    select 1
    from public.event_participants ep
    where ep.organization_id = events.organization_id
      and ep.event_id = events.id
      and private.is_self_member(ep.organization_id, ep.member_id)
  )
);

create policy financial_periods_select
on public.financial_periods for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy period_events_select
on public.period_events for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy charge_batches_select
on public.charge_batches for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy charge_plans_select
on public.charge_plans for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy charges_select
on public.charges for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy charge_adjustments_select
on public.charge_adjustments for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy charge_cancellations_select
on public.charge_cancellations for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy payments_select
on public.payments for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy payment_reversals_select
on public.payment_reversals for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy member_credits_select
on public.member_credits for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy member_credit_reversals_select
on public.member_credit_reversals for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy allocations_select
on public.receivable_allocations for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy allocation_reversals_select
on public.allocation_reversals for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy mutual_batches_select
on public.mutual_batches for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create policy mutual_assignments_select
on public.mutual_assignments for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy event_participants_select
on public.event_participants for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));


create policy legacy_financial_records_select
on public.legacy_financial_records for select to authenticated
using (
  private.has_permission(organization_id, 'finance.read')
  or (member_id is not null and private.is_self_member(organization_id, member_id))
);

create policy audit_logs_select
on public.audit_logs for select to authenticated
using (private.has_permission(organization_id, 'audit.read'));
