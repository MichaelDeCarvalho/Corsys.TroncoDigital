-- Corsys Tronco Digital
-- Migration 006: SaaS platform foundation
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

-- The tenant/business boundary remains public.organizations.
-- Platform commercial data is intentionally separated from each tenant's internal treasury.

create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('MASTER', 'SUPPORT', 'BILLING')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_staff_set_updated_at
before update on public.platform_staff
for each row execute function private.set_updated_at();

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  description text,
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly', 'custom')),
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'BRL' check (length(currency) = 3),
  trial_days integer not null default 0 check (trial_days >= 0),
  grace_days integer not null default 7 check (grace_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger saas_plans_set_updated_at
before update on public.saas_plans
for each row execute function private.set_updated_at();

create table public.saas_plan_entitlements (
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  entitlement_key text not null check (length(btrim(entitlement_key)) > 0),
  entitlement_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, entitlement_key)
);

create trigger saas_plan_entitlements_set_updated_at
before update on public.saas_plan_entitlements
for each row execute function private.set_updated_at();

create table public.saas_tenant_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_name text,
  billing_email text,
  billing_phone text,
  tax_id text,
  commercial_status text not null default 'trialing'
    check (commercial_status in ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  grace_until timestamptz,
  retention_until timestamptz,
  billing_provider text not null default 'manual',
  provider_customer_id text,
  customer_since date not null default current_date,
  canceled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_provider, provider_customer_id)
);

create trigger saas_tenant_accounts_set_updated_at
before update on public.saas_tenant_accounts
for each row execute function private.set_updated_at();

-- Existing organizations are preserved as active commercial tenants during migration.
-- New tenants must be provisioned through the controlled SaaS onboarding command.
insert into public.saas_tenant_accounts (
  organization_id,
  billing_name,
  commercial_status,
  billing_provider,
  customer_since
)
select
  o.id,
  o.name,
  'active',
  'manual',
  o.created_at::date
from public.organizations o
on conflict (organization_id) do nothing;

create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  status text not null
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'cancel_scheduled', 'canceled')),
  started_at timestamptz not null default now(),
  current_period_start date,
  current_period_end date,
  billing_anchor_day smallint check (billing_anchor_day between 1 and 28),
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  billing_provider text not null default 'manual',
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (billing_provider, provider_subscription_id),
  check (current_period_end is null or current_period_start is null or current_period_end >= current_period_start)
);

create unique index saas_subscriptions_one_current_per_org_idx
on public.saas_subscriptions(organization_id)
where status in ('trialing', 'active', 'past_due', 'suspended', 'cancel_scheduled');

create trigger saas_subscriptions_set_updated_at
before update on public.saas_subscriptions
for each row execute function private.set_updated_at();

create table public.saas_subscription_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null,
  event_type text not null
    check (event_type in (
      'created', 'trial_started', 'activated', 'plan_changed',
      'past_due', 'suspended', 'resumed', 'cancel_scheduled', 'canceled'
    )),
  effective_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  external_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, subscription_id)
    references public.saas_subscriptions(organization_id, id) on delete cascade,
  unique (external_event_id)
);

create trigger saas_subscription_events_immutable
before update or delete on public.saas_subscription_events
for each row execute function private.prevent_financial_mutation();

create table public.saas_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid,
  invoice_number text not null unique check (length(btrim(invoice_number)) > 0),
  competence date not null check (extract(day from competence) = 1),
  service_period_start date not null,
  service_period_end date not null,
  issue_date date not null default current_date,
  due_date date not null,
  amount_due numeric(14,2) not null check (amount_due > 0),
  currency text not null default 'BRL' check (length(currency) = 3),
  description text,
  billing_provider text not null default 'manual',
  provider_invoice_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (billing_provider, provider_invoice_id),
  check (service_period_end >= service_period_start),
  foreign key (organization_id, subscription_id)
    references public.saas_subscriptions(organization_id, id)
);

create index saas_invoices_org_due_idx
on public.saas_invoices(organization_id, due_date);

create trigger saas_invoices_immutable
before update or delete on public.saas_invoices
for each row execute function private.prevent_financial_mutation();

create table public.saas_invoice_voids (
  invoice_id uuid primary key references public.saas_invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  voided_by uuid references auth.users(id),
  voided_at timestamptz not null default now()
);

create trigger saas_invoice_voids_immutable
before update or delete on public.saas_invoice_voids
for each row execute function private.prevent_financial_mutation();

create table public.saas_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  paid_at timestamptz not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'BRL' check (length(currency) = 3),
  payment_method text not null
    check (payment_method in ('pix', 'boleto', 'card', 'transfer', 'cash', 'other')),
  source_kind text not null default 'provider'
    check (source_kind in ('provider', 'manual', 'migration')),
  billing_provider text not null default 'manual',
  provider_payment_id text,
  reference text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (billing_provider, provider_payment_id)
);

create index saas_payments_org_paid_idx
on public.saas_payments(organization_id, paid_at);

create trigger saas_payments_immutable
before update or delete on public.saas_payments
for each row execute function private.prevent_financial_mutation();

create table public.saas_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (organization_id, payment_id)
    references public.saas_payments(organization_id, id) on delete cascade,
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id) on delete cascade
);

create index saas_payment_allocations_invoice_idx
on public.saas_payment_allocations(invoice_id);

create trigger saas_payment_allocations_immutable
before update or delete on public.saas_payment_allocations
for each row execute function private.prevent_financial_mutation();

create table public.saas_payment_reversals (
  payment_id uuid primary key references public.saas_payments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz not null default now()
);

create trigger saas_payment_reversals_immutable
before update or delete on public.saas_payment_reversals
for each row execute function private.prevent_financial_mutation();

create table public.saas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  billing_provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text,
  sanitized_metadata jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (billing_provider, external_event_id)
);

create table public.saas_support_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) >= 5),
  scope text not null default 'read_only'
    check (scope in ('read_only', 'configuration_read')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check (ended_at is null or ended_at >= started_at)
);

create index saas_support_sessions_active_idx
on public.saas_support_sessions(staff_user_id, organization_id, expires_at)
where ended_at is null;

create table public.saas_master_audit_logs (
  id bigint generated always as identity primary key,
  staff_user_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger saas_master_audit_logs_immutable
before update or delete on public.saas_master_audit_logs
for each row execute function private.prevent_financial_mutation();

create table public.saas_terms_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy', 'dpa')),
  version text not null,
  document_hash text not null,
  effective_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

create table public.saas_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version_id uuid not null references public.saas_terms_versions(id),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, terms_version_id)
);

create trigger saas_terms_acceptances_immutable
before update or delete on public.saas_terms_acceptances
for each row execute function private.prevent_financial_mutation();

create table public.saas_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.saas_invoices(id) on delete set null,
  document_type text not null default 'nfse'
    check (document_type in ('nfse', 'receipt', 'other')),
  status text not null
    check (status in ('pending', 'issued', 'canceled', 'error')),
  document_number text,
  external_reference text,
  issued_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger saas_fiscal_documents_set_updated_at
before update on public.saas_fiscal_documents
for each row execute function private.set_updated_at();

-- Derived SaaS billing views. Amounts never rely on a mutable "balance" column.
create or replace view public.v_saas_active_payment_allocations
with (security_invoker = true)
as
select a.*
from public.saas_payment_allocations a
left join public.saas_payment_reversals r on r.payment_id = a.payment_id
where r.payment_id is null;

create or replace view public.v_saas_invoice_balances
with (security_invoker = true)
as
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
  i.amount_due,
  coalesce(sum(a.amount), 0)::numeric(14,2) as amount_paid,
  (i.amount_due - coalesce(sum(a.amount), 0))::numeric(14,2) as amount_open,
  case
    when v.invoice_id is not null then 'void'
    when coalesce(sum(a.amount), 0) >= i.amount_due then 'paid'
    when coalesce(sum(a.amount), 0) > 0 then 'partial'
    when i.due_date < current_date then 'overdue'
    else 'open'
  end as derived_status
from public.saas_invoices i
left join public.v_saas_active_payment_allocations a on a.invoice_id = i.id
left join public.saas_invoice_voids v on v.invoice_id = i.id
group by i.id, v.invoice_id;

create or replace view public.v_saas_payment_balances
with (security_invoker = true)
as
select
  p.id,
  p.organization_id,
  p.paid_at,
  p.amount,
  coalesce(sum(a.amount), 0)::numeric(14,2) as allocated_amount,
  (p.amount - coalesce(sum(a.amount), 0))::numeric(14,2) as unallocated_amount,
  (r.payment_id is null) as active
from public.saas_payments p
left join public.saas_payment_allocations a on a.payment_id = p.id
left join public.saas_payment_reversals r on r.payment_id = p.id
group by p.id, r.payment_id;
