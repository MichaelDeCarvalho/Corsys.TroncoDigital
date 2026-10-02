-- Corsys Tronco Digital
-- Migration 011: SaaS commercial history refinements
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

create table public.saas_tenant_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_type text not null
    check (contact_type in ('administrative', 'billing', 'support', 'legal')),
  name text not null check (length(btrim(name)) > 0),
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contact_type, email),
  unique (organization_id, id)
);

create trigger saas_tenant_contacts_set_updated_at
before update on public.saas_tenant_contacts
for each row execute function private.set_updated_at();

create table public.saas_subscription_price_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null,
  effective_from date not null,
  effective_to date,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  currency text not null default 'BRL' check (length(currency) = 3),
  adjustment_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (subscription_id, effective_from),
  unique (organization_id, id),
  foreign key (organization_id, subscription_id)
    references public.saas_subscriptions(organization_id, id) on delete cascade
);

alter table public.saas_subscription_price_terms
  add constraint saas_subscription_price_terms_no_overlap
  exclude using gist (
    subscription_id with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  );

create table public.saas_invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  item_type text not null
    check (item_type in ('subscription', 'proration', 'discount', 'credit', 'adjustment')),
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_amount numeric(14,2) not null,
  line_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id) on delete cascade
);

create trigger saas_invoice_items_immutable
before update or delete on public.saas_invoice_items
for each row execute function private.prevent_financial_mutation();

create table public.saas_billing_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_provider text not null default 'manual',
  provider_payment_method_reference text,
  display_label text,
  card_last4 text check (card_last4 is null or length(card_last4) = 4),
  updated_at timestamptz not null default now()
);

create trigger saas_billing_profiles_set_updated_at
before update on public.saas_billing_profiles
for each row execute function private.set_updated_at();

create table public.saas_collection_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid,
  event_type text not null
    check (event_type in (
      'reminder_scheduled','reminder_sent','payment_attempt',
      'grace_started','suspended','reactivated'
    )),
  channel text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id)
    references public.saas_invoices(organization_id, id)
);

create trigger saas_collection_events_immutable
before update or delete on public.saas_collection_events
for each row execute function private.prevent_financial_mutation();

-- Harden cross-organization references already introduced in migration 006.
alter table public.saas_invoice_voids
  drop constraint if exists saas_invoice_voids_invoice_id_fkey;

alter table public.saas_invoice_voids
  add constraint saas_invoice_voids_invoice_org_fk
  foreign key (organization_id, invoice_id)
  references public.saas_invoices(organization_id, id);

alter table public.saas_payment_reversals
  drop constraint if exists saas_payment_reversals_payment_id_fkey;

alter table public.saas_payment_reversals
  add constraint saas_payment_reversals_payment_org_fk
  foreign key (organization_id, payment_id)
  references public.saas_payments(organization_id, id);

alter table public.saas_fiscal_documents
  add constraint saas_fiscal_documents_invoice_org_fk
  foreign key (organization_id, invoice_id)
  references public.saas_invoices(organization_id, id);

-- Allow reallocating a valid SaaS payment without reversing the payment itself.
alter table public.saas_payment_allocations
  add constraint saas_payment_allocations_org_id_unique
  unique (organization_id, id);

create table public.saas_payment_allocation_reversals (
  allocation_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz not null default now(),
  foreign key (organization_id, allocation_id)
    references public.saas_payment_allocations(organization_id, id)
);

create trigger saas_payment_allocation_reversals_immutable
before update or delete on public.saas_payment_allocation_reversals
for each row execute function private.prevent_financial_mutation();

create or replace view public.v_saas_active_payment_allocations
with (security_invoker = true)
as
select a.*
from public.saas_payment_allocations a
left join public.saas_payment_reversals pr on pr.payment_id = a.payment_id
left join public.saas_payment_allocation_reversals ar on ar.allocation_id = a.id
where pr.payment_id is null
  and ar.allocation_id is null;

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
    select 1 from public.saas_payment_reversals r
    where r.organization_id = new.organization_id
      and r.payment_id = new.payment_id
  ) then
    raise exception 'cannot allocate reversed SaaS payment' using errcode = '55000';
  end if;

  select i.amount_due
  into v_invoice_amount
  from public.saas_invoices i
  where i.organization_id = new.organization_id
    and i.id = new.invoice_id
  for update;

  if v_invoice_amount is null then
    raise exception 'SaaS invoice not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_invoice_voids v
    where v.organization_id = new.organization_id
      and v.invoice_id = new.invoice_id
  ) then
    raise exception 'cannot allocate payment to void SaaS invoice' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0)
  into v_payment_allocated
  from public.v_saas_active_payment_allocations a
  where a.payment_id = new.payment_id;

  if v_payment_allocated + new.amount > v_payment_amount then
    raise exception 'SaaS allocation exceeds payment available amount'
      using errcode = '23514';
  end if;

  select coalesce(sum(a.amount), 0)
  into v_invoice_allocated
  from public.v_saas_active_payment_allocations a
  where a.invoice_id = new.invoice_id;

  if v_invoice_allocated + new.amount > v_invoice_amount then
    raise exception 'SaaS allocation exceeds invoice open amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger saas_payment_allocations_validate
before insert on public.saas_payment_allocations
for each row execute function private.validate_saas_payment_allocation();

create or replace function private.validate_saas_invoice_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.saas_invoices i
  where i.organization_id = new.organization_id
    and i.id = new.invoice_id
  for update;

  if not found then
    raise exception 'SaaS invoice not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.v_saas_active_payment_allocations a
    where a.organization_id = new.organization_id
      and a.invoice_id = new.invoice_id
  ) then
    raise exception 'reverse SaaS invoice allocations before voiding invoice'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger saas_invoice_voids_validate
before insert on public.saas_invoice_voids
for each row execute function private.validate_saas_invoice_void();

