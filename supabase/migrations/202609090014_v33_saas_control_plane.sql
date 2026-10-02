-- Corsys Tronco Digital
-- Migration 014: V33 SaaS control-plane hardening and operational domains.
-- Prepared for Supabase/PostgreSQL. NOT executed in this environment.

-- ============================================================
-- 1. Platform MFA/AAL2 and strict support scope
-- ============================================================

create or replace function private.has_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create or replace function private.is_platform_staff(p_role text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_aal2()
    and exists (
      select 1
      from public.platform_staff s
      where s.user_id = (select auth.uid())
        and s.active
        and (p_role is null or s.role = p_role)
    );
$$;

update public.saas_support_sessions
set scope = 'read_only'
where scope <> 'read_only';

alter table public.saas_support_sessions
  drop constraint if exists saas_support_sessions_scope_check;

alter table public.saas_support_sessions
  add constraint saas_support_sessions_scope_check
  check (scope = 'read_only');

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
  select p_required_scope = 'read_only'
    and private.has_aal2()
    and exists (
      select 1
      from public.saas_support_sessions s
      join public.platform_staff ps on ps.user_id = s.staff_user_id
      where s.organization_id = p_organization_id
        and s.staff_user_id = (select auth.uid())
        and ps.active
        and ps.role in ('MASTER', 'SUPPORT')
        and s.scope = 'read_only'
        and s.ended_at is null
        and s.started_at <= now()
        and s.expires_at > now()
    );
$$;

create or replace function private.is_tenant_user(p_organization_id uuid)
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

create or replace function private.require_platform_staff(p_role text default null)
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

  if not private.has_aal2() then
    raise exception 'AAL2/MFA required for platform operation'
      using errcode = '42501';
  end if;

  if not private.is_platform_staff(p_role) then
    raise exception 'platform permission denied'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.has_aal2() from public;
revoke all on function private.is_tenant_user(uuid) from public;
revoke all on function private.require_platform_staff(text) from public;

-- ============================================================
-- 2. SaaS plan versions: same plan name, immutable published versions
-- ============================================================

create table public.saas_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id),
  version_number integer not null check (version_number >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'BRL' check (length(currency) = 3),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly', 'custom')),
  trial_days integer not null default 0 check (trial_days >= 0),
  grace_days integer not null default 0 check (grace_days >= 0),
  valid_from date not null,
  valid_to date,
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check (
    (status = 'draft' and published_at is null)
    or
    (status = 'published' and published_at is not null)
  ),
  unique (plan_id, version_number),
  unique (plan_id, id)
);

-- Multiple published versions may coexist because existing subscriptions are pinned.
-- For new contracts, the effective default is the latest published valid_from <= reference date.
create unique index saas_plan_versions_plan_valid_from_uidx
on public.saas_plan_versions(plan_id, valid_from)
where status = 'published';

create table public.saas_plan_version_entitlements (
  plan_version_id uuid not null references public.saas_plan_versions(id) on delete cascade,
  entitlement_key text not null check (length(btrim(entitlement_key)) > 0),
  entitlement_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_version_id, entitlement_key)
);

-- Backfill v1 BEFORE immutable guards are installed.
insert into public.saas_plan_versions(
  plan_id, version_number, status, price, currency, billing_interval,
  trial_days, grace_days, valid_from, published_at
)
select
  p.id, 1, 'published', p.price, p.currency, p.billing_interval,
  p.trial_days, p.grace_days, p.created_at::date, p.created_at
from public.saas_plans p
where not exists (
  select 1 from public.saas_plan_versions v
  where v.plan_id = p.id and v.version_number = 1
);

insert into public.saas_plan_version_entitlements(
  plan_version_id, entitlement_key, entitlement_value, created_at, updated_at
)
select
  v.id, e.entitlement_key, e.entitlement_value, e.created_at, e.updated_at
from public.saas_plan_entitlements e
join public.saas_plan_versions v
  on v.plan_id = e.plan_id and v.version_number = 1
on conflict (plan_version_id, entitlement_key) do nothing;

create or replace function private.guard_published_saas_plan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_table_name = 'saas_plan_versions' then
    if old.status = 'published' then
      raise exception 'published SaaS plan version is immutable; create a new version'
        using errcode = '55000';
    end if;
  else
    select v.status into v_status
    from public.saas_plan_versions v
    where v.id = coalesce(new.plan_version_id, old.plan_version_id);

    if v_status = 'published' then
      raise exception 'entitlements of a published SaaS plan version are immutable'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger saas_plan_versions_published_guard
before update or delete on public.saas_plan_versions
for each row execute function private.guard_published_saas_plan_version();

create trigger saas_plan_version_entitlements_published_guard
before insert or update or delete on public.saas_plan_version_entitlements
for each row execute function private.guard_published_saas_plan_version();

create trigger saas_plan_versions_set_updated_at
before update on public.saas_plan_versions
for each row execute function private.set_updated_at();

create trigger saas_plan_version_entitlements_set_updated_at
before update on public.saas_plan_version_entitlements
for each row execute function private.set_updated_at();


create or replace function private.default_saas_plan_version(
  p_plan_id uuid,
  p_reference_date date
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id
  from public.saas_plan_versions v
  where v.plan_id = p_plan_id
    and v.status = 'published'
    and v.valid_from <= p_reference_date
    and (v.valid_to is null or v.valid_to >= p_reference_date)
  order by v.valid_from desc, v.version_number desc
  limit 1;
$$;

revoke all on function private.default_saas_plan_version(uuid,date) from public;

alter table public.saas_subscriptions
  add column if not exists plan_version_id uuid,
  add column if not exists past_due_since timestamptz,
  add column if not exists grace_until timestamptz;

update public.saas_subscriptions s
set plan_version_id = v.id
from public.saas_plan_versions v
where v.plan_id = s.plan_id
  and v.version_number = 1
  and s.plan_version_id is null;

update public.saas_subscriptions s
set grace_until = a.grace_until
from public.saas_tenant_accounts a
where a.organization_id = s.organization_id
  and s.grace_until is null;

alter table public.saas_subscriptions
  alter column plan_version_id set not null;

alter table public.saas_subscriptions
  add constraint saas_subscriptions_plan_version_fk
  foreign key (plan_id, plan_version_id)
  references public.saas_plan_versions(plan_id, id);

create unique index saas_subscriptions_one_current_uidx
on public.saas_subscriptions(organization_id)
where status <> 'canceled';

-- ============================================================
-- 3. Subscription is the commercial source of truth
-- ============================================================

alter table public.saas_tenant_accounts
  add column if not exists access_override text not null default 'none'
    check (access_override in ('none', 'blocked_by_admin', 'security_hold', 'legal_hold')),
  add column if not exists access_override_reason text,
  add column if not exists access_override_at timestamptz,
  add column if not exists access_override_by uuid references auth.users(id);

comment on column public.saas_tenant_accounts.commercial_status is
  'Legacy compatibility field. saas_subscriptions.status is the contractual source of truth after migration 014.';

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
        when s.status in ('trialing', 'active') then true
        when s.status = 'past_due'
          then s.grace_until is not null and s.grace_until > now()
        else false
      end
    from public.saas_tenant_accounts a
    join public.saas_subscriptions s
      on s.organization_id = a.organization_id
     and s.status <> 'canceled'
    where a.organization_id = p_organization_id
    order by s.created_at desc
    limit 1
  ), false);
$$;

-- ============================================================
-- 4. Billing policy: late fee, interest, grace, suspension, agreements
-- ============================================================

create table public.saas_billing_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  valid_from date not null,
  valid_to date,
  late_fee_percent numeric(7,4) not null default 0 check (late_fee_percent >= 0),
  monthly_interest_percent numeric(7,4) not null default 0 check (monthly_interest_percent >= 0),
  interest_method text not null default 'simple'
    check (interest_method = 'simple'),
  grace_days integer not null default 0 check (grace_days >= 0),
  auto_suspend boolean not null default false,
  suspend_after_overdue_days integer check (suspend_after_overdue_days is null or suspend_after_overdue_days >= 0),
  suspend_mode text not null default 'block_writes'
    check (suspend_mode in ('block_writes', 'full_exceptional')),
  allow_payment_agreements boolean not null default true,
  contract_reference text,
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check (
    (status = 'draft' and published_at is null)
    or
    (status = 'published' and published_at is not null)
  ),
  check (not auto_suspend or suspend_after_overdue_days is not null)
);

create unique index saas_billing_policy_default_key
on public.saas_billing_policies(name, valid_from)
where organization_id is null;

create unique index saas_billing_policy_tenant_key
on public.saas_billing_policies(organization_id, name, valid_from)
where organization_id is not null;

create trigger saas_billing_policies_set_updated_at
before update on public.saas_billing_policies
for each row execute function private.set_updated_at();

alter table public.saas_invoices
  add column if not exists billing_policy_id uuid references public.saas_billing_policies(id),
  add column if not exists late_fee_percent_snapshot numeric(7,4),
  add column if not exists monthly_interest_percent_snapshot numeric(7,4),
  add column if not exists grace_days_snapshot integer,
  add column if not exists suspend_after_overdue_days_snapshot integer;

create table public.saas_invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  adjustment_type text not null
    check (adjustment_type in (
      'late_fee','interest','promotion_discount','agreement_discount',
      'credit','manual_increase','manual_decrease'
    )),
  signed_amount numeric(14,2) not null check (signed_amount <> 0),
  effective_at timestamptz not null default now(),
  calculation_metadata jsonb not null default '{}'::jsonb,
  reason text not null check (length(btrim(reason)) > 0),
  idempotency_key text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id)
);

create trigger saas_invoice_adjustments_immutable
before update or delete on public.saas_invoice_adjustments
for each row execute function private.prevent_financial_mutation();


create or replace function private.validate_saas_invoice_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original numeric;
  v_existing_adjustments numeric;
  v_paid numeric;
  v_new_total numeric;
begin
  if new.adjustment_type in ('late_fee','interest','manual_increase')
     and new.signed_amount <= 0 then
    raise exception 'positive adjustment type requires positive signed_amount'
      using errcode = '23514';
  end if;

  if new.adjustment_type in (
      'promotion_discount','agreement_discount','credit','manual_decrease'
     )
     and new.signed_amount >= 0 then
    raise exception 'discount/credit adjustment requires negative signed_amount'
      using errcode = '23514';
  end if;

  select i.amount_due
  into v_original
  from public.saas_invoices i
  where i.organization_id = new.organization_id
    and i.id = new.invoice_id
  for update;

  if v_original is null then
    raise exception 'SaaS invoice not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.saas_invoice_voids v
    where v.organization_id = new.organization_id
      and v.invoice_id = new.invoice_id
  ) then
    raise exception 'cannot adjust void SaaS invoice' using errcode = '55000';
  end if;

  select coalesce(sum(a.signed_amount),0)
  into v_existing_adjustments
  from public.saas_invoice_adjustments a
  where a.organization_id = new.organization_id
    and a.invoice_id = new.invoice_id;

  select coalesce(sum(a.amount),0)
  into v_paid
  from public.v_saas_active_payment_allocations a
  where a.organization_id = new.organization_id
    and a.invoice_id = new.invoice_id;

  v_new_total := v_original + v_existing_adjustments + new.signed_amount;

  if v_new_total < 0 then
    raise exception 'invoice adjustments cannot make total negative'
      using errcode = '23514';
  end if;

  if v_new_total < v_paid then
    raise exception 'invoice adjustments cannot reduce total below active allocated amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger saas_invoice_adjustments_validate
before insert on public.saas_invoice_adjustments
for each row execute function private.validate_saas_invoice_adjustment();

-- ============================================================
-- 5. Promotions/offers
-- ============================================================

create table public.saas_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  public_code text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  benefit_type text not null
    check (benefit_type in ('percent', 'fixed_amount', 'trial_price')),
  benefit_value numeric(14,4) not null check (benefit_value > 0),
  duration_type text not null
    check (duration_type in ('once', 'cycles', 'date_range')),
  duration_cycles integer check (duration_cycles is null or duration_cycles >= 1),
  valid_from timestamptz not null,
  valid_to timestamptz,
  eligibility_scope text not null default 'new_customers'
    check (eligibility_scope in ('new_customers', 'selected_customers', 'all_eligible')),
  max_redemptions integer check (max_redemptions is null or max_redemptions >= 1),
  stackable boolean not null default false,
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from),
  check (
    (duration_type = 'cycles' and duration_cycles is not null)
    or (duration_type <> 'cycles')
  ),
  check (
    benefit_type <> 'percent'
    or benefit_value <= 100
  )
);

create unique index saas_promotions_public_code_uidx
on public.saas_promotions(lower(public_code))
where public_code is not null;

create trigger saas_promotions_set_updated_at
before update on public.saas_promotions
for each row execute function private.set_updated_at();

create table public.saas_promotion_plan_versions (
  promotion_id uuid not null references public.saas_promotions(id) on delete cascade,
  plan_version_id uuid not null references public.saas_plan_versions(id),
  primary key (promotion_id, plan_version_id)
);

create table public.saas_promotion_customers (
  promotion_id uuid not null references public.saas_promotions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (promotion_id, organization_id)
);

create table public.saas_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.saas_promotions(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null,
  invoice_id uuid,
  amount_applied numeric(14,2) not null check (amount_applied >= 0),
  redemption_cycle integer not null default 1 check (redemption_cycle >= 1),
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (promotion_id, subscription_id, redemption_cycle),
  foreign key (organization_id, subscription_id)
    references public.saas_subscriptions(organization_id, id),
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id)
);

create trigger saas_promotion_redemptions_immutable
before update or delete on public.saas_promotion_redemptions
for each row execute function private.prevent_financial_mutation();

-- ============================================================
-- 6. Payment agreements
-- ============================================================

create table public.saas_payment_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agreement_number text not null,
  agreement_date date not null,
  original_open_amount numeric(14,2) not null check (original_open_amount > 0),
  negotiated_amount numeric(14,2) not null check (negotiated_amount > 0),
  down_payment numeric(14,2) not null default 0 check (down_payment >= 0),
  installment_count integer not null check (installment_count >= 1),
  charges_treatment text not null default 'preserve'
    check (charges_treatment in ('preserve', 'explicit_discount', 'authorized_waiver')),
  terms text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, agreement_number),
  unique (organization_id, id)
);

create trigger saas_payment_agreements_immutable
before update or delete on public.saas_payment_agreements
for each row execute function private.prevent_financial_mutation();

create table public.saas_payment_agreement_invoices (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agreement_id uuid not null,
  invoice_id uuid not null,
  included_amount numeric(14,2) not null check (included_amount > 0),
  primary key (agreement_id, invoice_id),
  foreign key (organization_id, agreement_id)
    references public.saas_payment_agreements(organization_id, id),
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id)
);

create table public.saas_payment_agreement_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agreement_id uuid not null,
  installment_number integer not null check (installment_number >= 1),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (agreement_id, installment_number),
  foreign key (organization_id, agreement_id)
    references public.saas_payment_agreements(organization_id, id)
);

create table public.saas_payment_agreement_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agreement_id uuid not null,
  event_type text not null
    check (event_type in ('created', 'installment_paid', 'completed', 'defaulted', 'canceled')),
  reason text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, agreement_id)
    references public.saas_payment_agreements(organization_id, id)
);

create trigger saas_payment_agreement_events_immutable
before update or delete on public.saas_payment_agreement_events
for each row execute function private.prevent_financial_mutation();


create or replace view public.v_saas_payment_agreement_status
with (security_invoker = true)
as
select
  a.*,
  coalesce(
    case e.event_type
      when 'completed' then 'completed'
      when 'defaulted' then 'defaulted'
      when 'canceled' then 'canceled'
      else 'active'
    end,
    'active'
  ) as derived_status,
  e.created_at as latest_event_at
from public.saas_payment_agreements a
left join lateral (
  select ev.event_type, ev.created_at
  from public.saas_payment_agreement_events ev
  where ev.organization_id = a.organization_id
    and ev.agreement_id = a.id
  order by ev.id desc
  limit 1
) e on true;

-- ============================================================
-- 7. Scheduled lifecycle/plan changes and jobs
-- ============================================================

create table public.saas_scheduled_subscription_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null,
  change_type text not null
    check (change_type in ('plan_change', 'suspend', 'reactivate', 'cancel')),
  target_plan_version_id uuid references public.saas_plan_versions(id),
  effective_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'applied', 'canceled', 'failed')),
  reason text not null check (length(btrim(reason)) > 0),
  idempotency_key text not null,
  created_by uuid references auth.users(id),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, subscription_id)
    references public.saas_subscriptions(organization_id, id),
  check (
    (change_type = 'plan_change' and target_plan_version_id is not null)
    or
    (change_type <> 'plan_change' and target_plan_version_id is null)
  )
);

create table public.saas_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null
    check (job_type in (
      'generate_invoice','send_collection','apply_late_charges',
      'evaluate_dunning','apply_subscription_change',
      'tenant_export','fiscal_document','webhook_retry'
    )),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  run_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts >= 1),
  idempotency_key text not null,
  correlation_id text,
  sanitized_payload jsonb not null default '{}'::jsonb,
  last_error_code text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_type, idempotency_key)
);

create trigger saas_jobs_set_updated_at
before update on public.saas_jobs
for each row execute function private.set_updated_at();

-- ============================================================
-- 8. Support ticket Kanban and replies
-- ============================================================

create table public.saas_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_seq bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null check (length(btrim(subject)) > 0),
  category text not null default 'other'
    check (category in ('finance', 'reports', 'access', 'configuration', 'billing', 'other')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'triage', 'working', 'waiting_client', 'resolved', 'closed')),
  opened_by_user_id uuid not null references auth.users(id),
  assigned_staff_user_id uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create trigger saas_support_tickets_set_updated_at
before update on public.saas_support_tickets
for each row execute function private.set_updated_at();

create table public.saas_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null,
  sender_user_id uuid references auth.users(id),
  sender_kind text not null
    check (sender_kind in ('tenant_user', 'platform_staff', 'system')),
  visibility text not null default 'customer'
    check (visibility in ('customer', 'internal_note')),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, ticket_id)
    references public.saas_support_tickets(organization_id, id) on delete cascade
);

create trigger saas_support_ticket_messages_immutable
before update or delete on public.saas_support_ticket_messages
for each row execute function private.prevent_financial_mutation();

create table public.saas_support_ticket_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null,
  from_status text,
  to_status text not null,
  visibility text not null default 'customer'
    check (visibility in ('customer', 'internal')),
  reason text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, ticket_id)
    references public.saas_support_tickets(organization_id, id) on delete cascade
);

create trigger saas_support_ticket_events_immutable
before update or delete on public.saas_support_ticket_events
for each row execute function private.prevent_financial_mutation();

-- ============================================================
-- 9. Platform settings - typed, Master only, no secrets
-- ============================================================

create table public.saas_platform_configuration (
  singleton boolean primary key default true check (singleton),
  trade_name text not null default 'Corsys Tronco Digital',
  legal_name text,
  tax_id text,
  postal_code text,
  address_line text,
  city text,
  state_code text,
  billing_email text,
  support_email text,
  support_phone text,
  default_trial_days integer not null default 14 check (default_trial_days >= 0),
  default_grace_days integer not null default 7 check (default_grace_days >= 0),
  default_retention_days integer not null default 90 check (default_retention_days >= 0),
  default_due_day smallint not null default 10 check (default_due_day between 1 and 28),
  invoice_prefix text not null default 'CORSYS',
  primary_collection_channel text not null default 'email'
    check (primary_collection_channel in ('email', 'whatsapp', 'email_whatsapp')),
  billing_provider_status text not null default 'not_configured',
  email_provider_status text not null default 'not_configured',
  fiscal_provider_status text not null default 'not_configured',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.saas_platform_configuration(singleton)
values (true)
on conflict (singleton) do nothing;

create trigger saas_platform_configuration_set_updated_at
before update on public.saas_platform_configuration
for each row execute function private.set_updated_at();

-- ============================================================
-- 10. Terms: deterministic published applicability
-- ============================================================

alter table public.saas_terms_versions
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'retired')),
  add column if not exists valid_to timestamptz;

update public.saas_terms_versions
set status = case when active then 'published' else 'retired' end
where status = 'published';

alter table public.saas_terms_versions
  add constraint saas_terms_versions_validity_check
  check (valid_to is null or valid_to > effective_at);

alter table public.saas_terms_versions
  add constraint saas_terms_versions_published_no_overlap
  exclude using gist (
    document_type with =,
    tstzrange(effective_at, coalesce(valid_to, 'infinity'::timestamptz), '[)') with &&
  )
  where (status = 'published');

-- ============================================================
-- 11. Invoice balance includes immutable adjustments
-- ============================================================

create or replace view public.v_saas_invoice_balances
with (security_invoker = true)
as
with adjustments as (
  select organization_id, invoice_id, sum(signed_amount)::numeric(14,2) as adjustment_amount
  from public.saas_invoice_adjustments
  group by organization_id, invoice_id
),
allocations as (
  select organization_id, invoice_id, sum(amount)::numeric(14,2) as amount_paid
  from public.v_saas_active_payment_allocations
  group by organization_id, invoice_id
)
select
  i.id,
  i.organization_id,
  i.subscription_id,
  i.invoice_number,
  i.competence,
  i.service_period_start,
  i.service_period_end,
  i.issue_date,
  i.due_date,
  i.amount_due as original_amount,
  coalesce(ad.adjustment_amount, 0)::numeric(14,2) as adjustment_amount,
  (i.amount_due + coalesce(ad.adjustment_amount, 0))::numeric(14,2) as amount_due,
  coalesce(al.amount_paid, 0)::numeric(14,2) as amount_paid,
  case
    when v.invoice_id is not null then 0::numeric(14,2)
    else (
      i.amount_due + coalesce(ad.adjustment_amount, 0) - coalesce(al.amount_paid, 0)
    )::numeric(14,2)
  end as amount_open,
  case
    when v.invoice_id is not null then 'void'
    when coalesce(al.amount_paid, 0) >= i.amount_due + coalesce(ad.adjustment_amount, 0) then 'paid'
    when coalesce(al.amount_paid, 0) > 0 then 'partial'
    when i.due_date < current_date then 'overdue'
    else 'open'
  end as derived_status,
  (
    coalesce(al.amount_paid, 0)
    <= i.amount_due + coalesce(ad.adjustment_amount, 0)
  ) as integrity_ok
from public.saas_invoices i
left join adjustments ad
  on ad.organization_id = i.organization_id and ad.invoice_id = i.id
left join allocations al
  on al.organization_id = i.organization_id and al.invoice_id = i.id
left join public.saas_invoice_voids v
  on v.organization_id = i.organization_id and v.invoice_id = i.id;

-- Payment allocation validation must use adjusted invoice amount.
create or replace function private.validate_saas_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_amount numeric;
  v_payment_allocated numeric;
  v_invoice_amount numeric;
  v_invoice_allocated numeric;
begin
  select p.amount
  into v_payment_amount
  from public.saas_payments p
  where p.organization_id = new.organization_id
    and p.id = new.payment_id
  for update;

  if v_payment_amount is null then
    raise exception 'SaaS payment not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.saas_payment_reversals r
    where r.organization_id = new.organization_id
      and r.payment_id = new.payment_id
  ) then
    raise exception 'cannot allocate reversed SaaS payment'
      using errcode = '55000';
  end if;

  perform 1
  from public.saas_invoices i
  where i.organization_id = new.organization_id
    and i.id = new.invoice_id
  for update;

  if not found then
    raise exception 'SaaS invoice not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_invoice_voids v
    where v.organization_id = new.organization_id
      and v.invoice_id = new.invoice_id
  ) then
    raise exception 'cannot allocate payment to void SaaS invoice'
      using errcode = '55000';
  end if;

  select b.amount_due
  into v_invoice_amount
  from public.v_saas_invoice_balances b
  where b.organization_id = new.organization_id
    and b.id = new.invoice_id;

  select coalesce(sum(a.amount),0)
  into v_payment_allocated
  from public.v_saas_active_payment_allocations a
  where a.organization_id = new.organization_id
    and a.payment_id = new.payment_id;

  if v_payment_allocated + new.amount > v_payment_amount then
    raise exception 'SaaS allocation exceeds payment available amount'
      using errcode = '23514';
  end if;

  select coalesce(sum(a.amount),0)
  into v_invoice_allocated
  from public.v_saas_active_payment_allocations a
  where a.organization_id = new.organization_id
    and a.invoice_id = new.invoice_id;

  if v_invoice_allocated + new.amount > v_invoice_amount then
    raise exception 'SaaS allocation exceeds adjusted invoice open amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 12. Prevent removing the final active Master
-- ============================================================

create or replace function private.guard_last_active_master()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_masters integer;
begin
  if old.role = 'MASTER'
     and old.active
     and (
       tg_op = 'DELETE'
       or new.role <> 'MASTER'
       or not new.active
     ) then

    select count(*)
    into v_active_masters
    from public.platform_staff p
    where p.role = 'MASTER'
      and p.active
      and p.user_id <> old.user_id;

    if v_active_masters < 1 then
      raise exception 'cannot remove or deactivate the final active MASTER'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger platform_staff_last_master_guard
before update or delete on public.platform_staff
for each row execute function private.guard_last_active_master();

-- ============================================================
-- 13. RLS/grants: control plane not visible cross-tenant
-- ============================================================

revoke all on
  public.saas_plan_versions,
  public.saas_plan_version_entitlements,
  public.saas_billing_policies,
  public.saas_invoice_adjustments,
  public.saas_promotions,
  public.saas_promotion_plan_versions,
  public.saas_promotion_customers,
  public.saas_promotion_redemptions,
  public.saas_payment_agreements,
  public.saas_payment_agreement_invoices,
  public.saas_payment_agreement_installments,
  public.saas_payment_agreement_events,
  public.saas_scheduled_subscription_changes,
  public.saas_jobs,
  public.saas_support_tickets,
  public.saas_support_ticket_messages,
  public.saas_support_ticket_events,
  public.saas_platform_configuration
from anon, authenticated;

alter table public.saas_plan_versions enable row level security;
alter table public.saas_plan_version_entitlements enable row level security;
alter table public.saas_billing_policies enable row level security;
alter table public.saas_invoice_adjustments enable row level security;
alter table public.saas_promotions enable row level security;
alter table public.saas_promotion_plan_versions enable row level security;
alter table public.saas_promotion_customers enable row level security;
alter table public.saas_promotion_redemptions enable row level security;
alter table public.saas_payment_agreements enable row level security;
alter table public.saas_payment_agreement_invoices enable row level security;
alter table public.saas_payment_agreement_installments enable row level security;
alter table public.saas_payment_agreement_events enable row level security;
alter table public.saas_scheduled_subscription_changes enable row level security;
alter table public.saas_jobs enable row level security;
alter table public.saas_support_tickets enable row level security;
alter table public.saas_support_ticket_messages enable row level security;
alter table public.saas_support_ticket_events enable row level security;
alter table public.saas_platform_configuration enable row level security;

grant select on
  public.saas_plan_versions,
  public.saas_plan_version_entitlements,
  public.saas_invoice_adjustments,
  public.saas_promotion_redemptions,
  public.saas_payment_agreements,
  public.saas_payment_agreement_invoices,
  public.saas_payment_agreement_installments,
  public.saas_payment_agreement_events,
  public.saas_support_tickets,
  public.saas_support_ticket_messages,
  public.saas_support_ticket_events,
  public.v_saas_invoice_balances,
  public.v_saas_payment_agreement_status
to authenticated;

grant select on
  public.saas_billing_policies,
  public.saas_promotions,
  public.saas_promotion_plan_versions,
  public.saas_promotion_customers,
  public.saas_scheduled_subscription_changes,
  public.saas_jobs,
  public.saas_platform_configuration
to authenticated;

create policy saas_plan_versions_select
on public.saas_plan_versions for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or exists (
    select 1
    from public.saas_subscriptions s
    where s.plan_version_id = saas_plan_versions.id
      and private.has_permission(s.organization_id, 'settings.manage')
  )
);

create policy saas_plan_version_entitlements_select
on public.saas_plan_version_entitlements for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or exists (
    select 1
    from public.saas_subscriptions s
    where s.plan_version_id = saas_plan_version_entitlements.plan_version_id
      and private.has_permission(s.organization_id, 'settings.manage')
  )
);

create policy saas_billing_policies_select
on public.saas_billing_policies for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or (
    organization_id is not null
    and private.has_permission(organization_id, 'settings.manage')
  )
);

create policy saas_invoice_adjustments_select
on public.saas_invoice_adjustments for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_promotions_platform_select
on public.saas_promotions for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create policy saas_promotion_plan_versions_platform_select
on public.saas_promotion_plan_versions for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create policy saas_promotion_customers_platform_select
on public.saas_promotion_customers for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create policy saas_promotion_redemptions_select
on public.saas_promotion_redemptions for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_agreements_select
on public.saas_payment_agreements for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_agreement_invoices_select
on public.saas_payment_agreement_invoices for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_agreement_installments_select
on public.saas_payment_agreement_installments for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_payment_agreement_events_select
on public.saas_payment_agreement_events for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id, 'settings.manage')
);

create policy saas_scheduled_subscription_changes_platform_select
on public.saas_scheduled_subscription_changes for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create policy saas_jobs_platform_select
on public.saas_jobs for select to authenticated
using (
  private.is_platform_staff('MASTER')
);

create policy saas_support_tickets_select
on public.saas_support_tickets for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or private.is_tenant_user(organization_id)
);

create policy saas_support_ticket_messages_select
on public.saas_support_ticket_messages for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or (
    visibility = 'customer'
    and private.is_tenant_user(organization_id)
  )
);

create policy saas_support_ticket_events_select
on public.saas_support_ticket_events for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or (
    visibility = 'customer'
    and private.is_tenant_user(organization_id)
  )
);

create policy saas_platform_configuration_master_select
on public.saas_platform_configuration for select to authenticated
using (
  private.is_platform_staff('MASTER')
);

-- ============================================================
-- 14. Controlled support commands (no direct browser writes)
-- ============================================================

create or replace function public.create_saas_support_ticket(
  p_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ticket uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.is_tenant_user(p_organization_id) then
    raise exception 'tenant membership required' using errcode = '42501';
  end if;

  if length(btrim(p_subject)) = 0 or length(btrim(p_message)) = 0 then
    raise exception 'subject and message are required' using errcode = '22023';
  end if;

  insert into public.saas_support_tickets(
    organization_id, subject, category, priority, opened_by_user_id
  ) values (
    p_organization_id, p_subject, p_category, p_priority, v_user
  )
  returning id into v_ticket;

  insert into public.saas_support_ticket_messages(
    organization_id, ticket_id, sender_user_id, sender_kind, visibility, body
  ) values (
    p_organization_id, v_ticket, v_user, 'tenant_user', 'customer', p_message
  );

  insert into public.saas_support_ticket_events(
    organization_id, ticket_id, from_status, to_status, actor_user_id
  ) values (
    p_organization_id, v_ticket, null, 'new', v_user
  );

  return v_ticket;
end;
$$;

create or replace function public.reply_saas_support_ticket(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_message text,
  p_next_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_old_status text;
  v_staff boolean;
  v_message_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  v_staff := private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT');

  if not v_staff and not private.is_tenant_user(p_organization_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  select t.status into v_old_status
  from public.saas_support_tickets t
  where t.organization_id = p_organization_id
    and t.id = p_ticket_id
  for update;

  if v_old_status is null then
    raise exception 'ticket not found' using errcode = '23503';
  end if;

  insert into public.saas_support_ticket_messages(
    organization_id, ticket_id, sender_user_id, sender_kind, visibility, body
  ) values (
    p_organization_id, p_ticket_id, v_user,
    case when v_staff then 'platform_staff' else 'tenant_user' end,
    'customer', p_message
  )
  returning id into v_message_id;

  if v_staff and p_next_status is not null then
    if p_next_status not in ('new','triage','working','waiting_client','resolved','closed') then
      raise exception 'invalid ticket status' using errcode = '22023';
    end if;

    update public.saas_support_tickets
    set status = p_next_status,
        resolved_at = case when p_next_status = 'resolved' then now() else resolved_at end,
        closed_at = case when p_next_status = 'closed' then now() else closed_at end
    where organization_id = p_organization_id
      and id = p_ticket_id;

    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, actor_user_id
    ) values (
      p_organization_id, p_ticket_id, v_old_status, p_next_status, v_user
    );
  elsif not v_staff and v_old_status in ('resolved','closed') then
    update public.saas_support_tickets
    set status = 'working', resolved_at = null, closed_at = null
    where organization_id = p_organization_id and id = p_ticket_id;

    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, actor_user_id, reason
    ) values (
      p_organization_id, p_ticket_id, v_old_status, 'working', v_user, 'customer_reopened'
    );
  end if;

  return v_message_id;
end;
$$;

revoke all on function public.create_saas_support_ticket(uuid,text,text,text,text) from public;
revoke all on function public.reply_saas_support_ticket(uuid,uuid,text,text) from public;
grant execute on function public.create_saas_support_ticket(uuid,text,text,text,text) to authenticated;
grant execute on function public.reply_saas_support_ticket(uuid,uuid,text,text) to authenticated;

-- Internal helpers do not need direct authenticated execution.
revoke execute on function private.accounting_plan_for_date(uuid,date) from authenticated;
revoke execute on function private.resolve_category_account(uuid,uuid,date) from authenticated;
revoke execute on function private.current_expense_approval_policy(uuid,date) from authenticated;
revoke execute on function private.current_payable_amount(uuid) from authenticated;
revoke execute on function private.current_receivable_amount(uuid) from authenticated;
revoke execute on function private.payable_approval_satisfied(uuid) from authenticated;
