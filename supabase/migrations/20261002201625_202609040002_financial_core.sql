-- Corsys Tesouraria
-- Migration 002: financial core

create or replace function private.prevent_financial_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'confirmed financial records are immutable; use reversal/cancellation/correction events'
    using errcode = '55000';
end;
$$;

create or replace function private.reject_closed_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_period_closed(new.organization_id, new.accounting_period) then
    raise exception 'financial period % is closed', new.accounting_period
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create table public.charge_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_type text not null
    check (batch_type in ('recurring', 'event', 'mutual', 'manual', 'import')),
  description text not null check (length(btrim(description)) > 0),
  competence date check (competence is null or extract(day from competence) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.charge_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  category_id uuid not null,
  description text not null check (length(btrim(description)) > 0),
  installment_count integer not null check (installment_count > 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, member_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id)
);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  category_id uuid not null,
  batch_id uuid,
  recurring_rule_id uuid,
  charge_plan_id uuid,
  supersedes_charge_id uuid,

  source_kind text not null
    check (source_kind in ('manual', 'recurring', 'event', 'mutual', 'migration_opening', 'migration_reconciled', 'replacement')),
  generation_key text,

  description text not null check (length(btrim(description)) > 0),
  reference text,

  competence date not null check (extract(day from competence) = 1),
  issue_date date not null,
  due_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),

  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_amount numeric(14,2) not null check (unit_amount >= 0),
  original_amount numeric(14,2) not null check (original_amount > 0),

  installment_number integer,
  installment_count integer,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  unique (organization_id, id),
  unique (organization_id, member_id, id),

  check (
    (installment_number is null and installment_count is null)
    or
    (installment_number is not null and installment_count is not null
      and installment_number >= 1
      and installment_count >= 1
      and installment_number <= installment_count)
  ),

  foreign key (organization_id, member_id)
    references public.members(organization_id, id),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, batch_id)
    references public.charge_batches(organization_id, id),
  foreign key (organization_id, recurring_rule_id)
    references public.recurring_rules(organization_id, id),
  foreign key (organization_id, member_id, charge_plan_id)
    references public.charge_plans(organization_id, member_id, id),
  foreign key (organization_id, supersedes_charge_id)
    references public.charges(organization_id, id)
);

create unique index charges_generation_key_uidx
  on public.charges(organization_id, generation_key)
  where generation_key is not null;

create unique index charges_recurring_base_uidx
  on public.charges(organization_id, member_id, recurring_rule_id, competence)
  where recurring_rule_id is not null and supersedes_charge_id is null;

create unique index charges_supersedes_uidx
  on public.charges(supersedes_charge_id)
  where supersedes_charge_id is not null;

create index charges_member_due_idx
  on public.charges(organization_id, member_id, due_date, id);

create index charges_category_competence_idx
  on public.charges(organization_id, category_id, competence);


create or replace function private.validate_charge_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
  v_rule_category uuid;
begin
  select domain into v_domain
  from public.financial_categories
  where organization_id = new.organization_id
    and id = new.category_id;

  if v_domain is distinct from 'member_receivable' then
    raise exception 'charge category must belong to member_receivable domain'
      using errcode = '23514';
  end if;

  if new.source_kind = 'recurring' and new.recurring_rule_id is null then
    raise exception 'recurring charge requires recurring_rule_id'
      using errcode = '23514';
  end if;

  if new.source_kind = 'recurring' and new.generation_key is null then
    raise exception 'recurring charge requires generation_key'
      using errcode = '23514';
  end if;

  if new.recurring_rule_id is not null then
    select category_id into v_rule_category
    from public.recurring_rules
    where organization_id = new.organization_id
      and id = new.recurring_rule_id;

    if v_rule_category is distinct from new.category_id then
      raise exception 'charge category does not match recurring rule category'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger charges_validate_business
before insert on public.charges
for each row execute function private.validate_charge_insert();

create trigger charges_reject_closed_period
before insert on public.charges
for each row execute function private.reject_closed_period();

create trigger charges_immutable
before update or delete on public.charges
for each row execute function private.prevent_financial_mutation();

create table public.charge_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  charge_id uuid not null,
  direction text not null check (direction in ('increase', 'decrease')),
  adjustment_kind text not null
    check (adjustment_kind in ('discount', 'waiver', 'credit_correction', 'debit_correction')),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id, charge_id)
    references public.charges(organization_id, member_id, id)
);

create table public.charge_cancellations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  charge_id uuid not null,
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (charge_id),
  foreign key (organization_id, member_id, charge_id)
    references public.charges(organization_id, member_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  payment_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  payment_method_id uuid not null,
  financial_account_id uuid,
  source_kind text not null default 'operational'
    check (source_kind in ('operational', 'migration_reconciled')),
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, member_id, id),
  check (source_kind <> 'operational' or financial_account_id is not null),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id),
  foreign key (organization_id, payment_method_id)
    references public.payment_methods(organization_id, id),
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id)
);

create index payments_member_date_idx
  on public.payments(organization_id, member_id, payment_date, id);

create index payments_account_date_idx
  on public.payments(organization_id, financial_account_id, payment_date)
  where source_kind = 'operational';

create trigger payments_reject_closed_period
before insert on public.payments
for each row execute function private.reject_closed_period();

create trigger payments_immutable
before update or delete on public.payments
for each row execute function private.prevent_financial_mutation();

create table public.member_credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  credit_kind text not null
    check (credit_kind in ('opening_credit', 'migration_credit', 'transferable_credit')),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, member_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create trigger member_credits_reject_closed_period
before insert on public.member_credits
for each row execute function private.reject_closed_period();

create trigger member_credits_immutable
before update or delete on public.member_credits
for each row execute function private.prevent_financial_mutation();

create table public.receivable_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  charge_id uuid not null,
  payment_id uuid,
  member_credit_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, member_id, id),
  check ((payment_id is not null)::integer + (member_credit_id is not null)::integer = 1),
  foreign key (organization_id, member_id, charge_id)
    references public.charges(organization_id, member_id, id),
  foreign key (organization_id, member_id, payment_id)
    references public.payments(organization_id, member_id, id),
  foreign key (organization_id, member_id, member_credit_id)
    references public.member_credits(organization_id, member_id, id)
);

create index receivable_allocations_payment_charge_idx
  on public.receivable_allocations(charge_id, payment_id)
  where payment_id is not null;

create index receivable_allocations_credit_charge_idx
  on public.receivable_allocations(charge_id, member_credit_id)
  where member_credit_id is not null;

create index receivable_allocations_payment_idx
  on public.receivable_allocations(payment_id)
  where payment_id is not null;

create index receivable_allocations_credit_idx
  on public.receivable_allocations(member_credit_id)
  where member_credit_id is not null;

create index receivable_allocations_charge_idx
  on public.receivable_allocations(charge_id);

create trigger receivable_allocations_reject_closed_period
before insert on public.receivable_allocations
for each row execute function private.reject_closed_period();

create trigger receivable_allocations_immutable
before update or delete on public.receivable_allocations
for each row execute function private.prevent_financial_mutation();

create table public.allocation_reversals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  allocation_id uuid not null unique,
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, member_id, allocation_id)
    references public.receivable_allocations(organization_id, member_id, id)
);

create trigger allocation_reversals_reject_closed_period
before insert on public.allocation_reversals
for each row execute function private.reject_closed_period();

create trigger allocation_reversals_immutable
before update or delete on public.allocation_reversals
for each row execute function private.prevent_financial_mutation();

create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  payment_id uuid not null unique,
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, member_id, payment_id)
    references public.payments(organization_id, member_id, id)
);

create trigger payment_reversals_reject_closed_period
before insert on public.payment_reversals
for each row execute function private.reject_closed_period();

create trigger payment_reversals_immutable
before update or delete on public.payment_reversals
for each row execute function private.prevent_financial_mutation();

create table public.member_credit_reversals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid not null,
  member_credit_id uuid not null unique,
  reason text not null check (length(btrim(reason)) > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, member_id, member_credit_id)
    references public.member_credits(organization_id, member_id, id)
);

create trigger member_credit_reversals_reject_closed_period
before insert on public.member_credit_reversals
for each row execute function private.reject_closed_period();

create trigger member_credit_reversals_immutable
before update or delete on public.member_credit_reversals
for each row execute function private.prevent_financial_mutation();

create table public.mutual_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number_start integer not null,
  number_end integer not null,
  unit_amount numeric(14,2) not null check (unit_amount > 0),
  competence date not null check (extract(day from competence) = 1),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (number_end >= number_start)
);

create table public.mutual_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mutual_batch_id uuid not null,
  mutual_number integer not null,
  member_id uuid not null,
  charge_id uuid not null unique,
  created_at timestamptz not null default now(),
  unique (mutual_batch_id, mutual_number),
  foreign key (organization_id, mutual_batch_id)
    references public.mutual_batches(organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id),
  foreign key (organization_id, member_id, charge_id)
    references public.charges(organization_id, member_id, id)
);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  member_id uuid not null,
  charged_amount numeric(14,2) not null check (charged_amount >= 0),
  charge_id uuid,
  created_at timestamptz not null default now(),
  unique (event_id, member_id),
  unique (charge_id),
  foreign key (organization_id, event_id)
    references public.events(organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id),
  foreign key (organization_id, member_id, charge_id)
    references public.charges(organization_id, member_id, id)
);


-- Legacy records that are useful for consultation but must not post to current balances.
-- Example: an old payment preserved for history when its matching historical charges
-- cannot be reconstructed with sufficient confidence.
create table public.legacy_financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid,
  record_type text not null
    check (record_type in ('charge', 'payment', 'credit', 'note')),
  event_date date,
  competence date check (competence is null or extract(day from competence) = 1),
  amount numeric(14,2) check (amount is null or amount >= 0),
  description text not null check (length(btrim(description)) > 0),
  source_reference text,
  raw_data jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create index legacy_financial_records_member_date_idx
  on public.legacy_financial_records(organization_id, member_id, event_date);

create trigger legacy_financial_records_immutable
before update or delete on public.legacy_financial_records
for each row execute function private.prevent_financial_mutation();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id uuid,
  technical_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_entity_idx
  on public.audit_logs(organization_id, entity_type, entity_id, created_at desc);

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function private.prevent_financial_mutation();

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (length(btrim(operation)) > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  payload_hash text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  result_reference uuid,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, user_id, idempotency_key)
);

-- Validate adjustments: no adjustment after cancellation and no negative effective amount.
create or replace function private.validate_charge_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original numeric(14,2);
  v_existing_delta numeric(14,2);
  v_new_delta numeric(14,2);
  v_active_allocated numeric(14,2);
begin
  perform 1
    from public.charges
    where id = new.charge_id
    for update;

  if exists (
    select 1 from public.charge_cancellations cc where cc.charge_id = new.charge_id
  ) then
    raise exception 'cannot adjust a cancelled charge' using errcode = '55000';
  end if;

  select c.original_amount
    into v_original
  from public.charges c
  where c.id = new.charge_id;

  select coalesce(sum(case when a.direction = 'increase' then a.amount else -a.amount end), 0)
    into v_existing_delta
  from public.charge_adjustments a
  where a.charge_id = new.charge_id;

  v_new_delta := case when new.direction = 'increase' then new.amount else -new.amount end;

  select coalesce(sum(a.amount), 0)
    into v_active_allocated
  from public.receivable_allocations a
  left join public.allocation_reversals ar on ar.allocation_id = a.id
  left join public.payment_reversals pr on pr.payment_id = a.payment_id
  left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
  where a.charge_id = new.charge_id
    and ar.id is null
    and pr.id is null
    and cr.id is null;

  if v_original + v_existing_delta + v_new_delta < 0 then
    raise exception 'adjustment would make charge effective amount negative'
      using errcode = '23514';
  end if;

  if v_original + v_existing_delta + v_new_delta < v_active_allocated then
    raise exception 'adjustment would reduce charge below already allocated amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger charge_adjustments_validate
before insert on public.charge_adjustments
for each row execute function private.validate_charge_adjustment();

create trigger charge_adjustments_reject_closed_period
before insert on public.charge_adjustments
for each row execute function private.reject_closed_period();

create trigger charge_adjustments_immutable
before update or delete on public.charge_adjustments
for each row execute function private.prevent_financial_mutation();

-- Allocation invariant: locks charge and source to serialize concurrent allocations.
create or replace function private.validate_receivable_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge_original numeric(14,2);
  v_charge_delta numeric(14,2);
  v_charge_allocated numeric(14,2);
  v_source_amount numeric(14,2);
  v_source_allocated numeric(14,2);
begin
  select c.original_amount
    into v_charge_original
  from public.charges c
  where c.id = new.charge_id
  for update;

  if v_charge_original is null then
    raise exception 'charge not found' using errcode = '23503';
  end if;

  if exists (select 1 from public.charge_cancellations cc where cc.charge_id = new.charge_id) then
    raise exception 'cannot allocate to cancelled charge' using errcode = '55000';
  end if;

  select coalesce(sum(case when ca.direction = 'increase' then ca.amount else -ca.amount end), 0)
    into v_charge_delta
  from public.charge_adjustments ca
  where ca.charge_id = new.charge_id;

  select coalesce(sum(a.amount), 0)
    into v_charge_allocated
  from public.receivable_allocations a
  left join public.allocation_reversals ar on ar.allocation_id = a.id
  left join public.payment_reversals pr on pr.payment_id = a.payment_id
  left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
  where a.charge_id = new.charge_id
    and ar.id is null
    and pr.id is null
    and cr.id is null;

  if v_charge_allocated + new.amount > v_charge_original + v_charge_delta then
    raise exception 'allocation exceeds charge open amount' using errcode = '23514';
  end if;

  if new.payment_id is not null then
    select p.amount
      into v_source_amount
    from public.payments p
    where p.id = new.payment_id
    for update;

    if exists (select 1 from public.payment_reversals pr where pr.payment_id = new.payment_id) then
      raise exception 'cannot allocate reversed payment' using errcode = '55000';
    end if;

    select coalesce(sum(a.amount), 0)
      into v_source_allocated
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    where a.payment_id = new.payment_id
      and ar.id is null;

  else
    select c.amount
      into v_source_amount
    from public.member_credits c
    where c.id = new.member_credit_id
    for update;

    if exists (
      select 1 from public.member_credit_reversals cr
      where cr.member_credit_id = new.member_credit_id
    ) then
      raise exception 'cannot allocate reversed member credit' using errcode = '55000';
    end if;

    select coalesce(sum(a.amount), 0)
      into v_source_allocated
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    where a.member_credit_id = new.member_credit_id
      and ar.id is null;
  end if;

  if v_source_allocated + new.amount > v_source_amount then
    raise exception 'allocation exceeds source available amount' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger receivable_allocations_validate
before insert on public.receivable_allocations
for each row execute function private.validate_receivable_allocation();

-- A payment/credit reversal must not hide active allocations.
create or replace function private.validate_payment_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.payments where id = new.payment_id for update;

  if exists (
    select 1
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    where a.payment_id = new.payment_id
      and ar.id is null
  ) then
    raise exception 'reverse active allocations before reversing payment'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger payment_reversals_validate
before insert on public.payment_reversals
for each row execute function private.validate_payment_reversal();

create or replace function private.validate_member_credit_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.member_credits where id = new.member_credit_id for update;

  if exists (
    select 1
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    where a.member_credit_id = new.member_credit_id
      and ar.id is null
  ) then
    raise exception 'reverse active allocations before reversing member credit'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger member_credit_reversals_validate
before insert on public.member_credit_reversals
for each row execute function private.validate_member_credit_reversal();

create or replace function private.validate_charge_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.charges where id = new.charge_id for update;

  if exists (
    select 1
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    left join public.payment_reversals pr on pr.payment_id = a.payment_id
    left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
    where a.charge_id = new.charge_id
      and ar.id is null
      and pr.id is null
      and cr.id is null
  ) then
    raise exception 'reverse active allocations before cancelling charge'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger charge_cancellations_validate
before insert on public.charge_cancellations
for each row execute function private.validate_charge_cancellation();

create trigger charge_cancellations_reject_closed_period
before insert on public.charge_cancellations
for each row execute function private.reject_closed_period();

create trigger charge_cancellations_immutable
before update or delete on public.charge_cancellations
for each row execute function private.prevent_financial_mutation();

create trigger financial_periods_immutable
before update or delete on public.financial_periods
for each row execute function private.prevent_financial_mutation();

create trigger period_events_immutable
before update or delete on public.period_events
for each row execute function private.prevent_financial_mutation();

create trigger account_opening_entries_immutable
before update or delete on public.account_opening_entries
for each row execute function private.prevent_financial_mutation();
