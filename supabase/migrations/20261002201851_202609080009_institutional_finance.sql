-- Corsys Tronco Digital
-- Migration 009: institutional treasury, AP/AR, approvals and corrections
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

create table public.expense_approval_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  mode text not null check (mode in ('off', 'all', 'threshold')),
  threshold_amount numeric(14,2),
  minimum_approvers smallint not null default 1 check (minimum_approvers between 1 and 10),
  status text not null default 'draft' check (status in ('draft', 'published')),
  valid_from date not null,
  valid_to date not null,
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (
    (mode = 'threshold' and threshold_amount is not null and threshold_amount >= 0)
    or (mode in ('off', 'all') and threshold_amount is null)
  ),
  check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  ),
  unique (organization_id, id)
);

alter table public.expense_approval_policies
  add constraint expense_approval_policies_published_no_overlap
  exclude using gist (
    organization_id with =,
    daterange(valid_from, valid_to + 1, '[)') with &&
  )
  where (status = 'published');

create trigger expense_approval_policies_set_updated_at
before update on public.expense_approval_policies
for each row execute function private.set_updated_at();

create or replace function private.prevent_published_approval_policy_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'published approval policy is immutable; create a successor policy'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger expense_approval_policies_published_guard
before update or delete on public.expense_approval_policies
for each row execute function private.prevent_published_approval_policy_mutation();

create table public.institutional_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction text not null check (direction in ('payable', 'receivable')),
  category_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  counterparty_name text,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'annual')),
  due_day smallint not null check (due_day between 1 and 31),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id)
);

create trigger institutional_recurring_rules_set_updated_at
before update on public.institutional_recurring_rules
for each row execute function private.set_updated_at();

create or replace function private.validate_institutional_recurring_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
begin
  select c.domain into v_domain
  from public.financial_categories c
  where c.organization_id = new.organization_id
    and c.id = new.category_id;

  if new.direction = 'payable' and v_domain is distinct from 'institutional_expense' then
    raise exception 'payable recurring rule requires institutional_expense category'
      using errcode = '23514';
  end if;

  if new.direction = 'receivable' and v_domain is distinct from 'institutional_revenue' then
    raise exception 'receivable recurring rule requires institutional_revenue category'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger institutional_recurring_rules_validate
before insert or update on public.institutional_recurring_rules
for each row execute function private.validate_institutional_recurring_rule();

create table public.institutional_recurring_rule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recurring_rule_id uuid not null,
  valid_from_competence date not null check (extract(day from valid_from_competence) = 1),
  valid_to_competence date check (valid_to_competence is null or extract(day from valid_to_competence) = 1),
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  check (valid_to_competence is null or valid_to_competence >= valid_from_competence),
  unique (recurring_rule_id, valid_from_competence),
  foreign key (organization_id, recurring_rule_id)
    references public.institutional_recurring_rules(organization_id, id) on delete cascade
);

alter table public.institutional_recurring_rule_versions
  add constraint institutional_recurring_rule_versions_no_overlap
  exclude using gist (
    recurring_rule_id with =,
    daterange(
      valid_from_competence,
      coalesce((valid_to_competence + interval '1 month')::date, 'infinity'::date),
      '[)'
    ) with &&
  );

create or replace function private.current_expense_approval_policy(
  p_organization_id uuid,
  p_reference_date date
)
returns table (
  policy_id uuid,
  mode text,
  threshold_amount numeric,
  minimum_approvers smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.mode, p.threshold_amount, p.minimum_approvers
  from public.expense_approval_policies p
  where p.organization_id = p_organization_id
    and p.status = 'published'
    and p.valid_from <= p_reference_date
    and p.valid_to >= p_reference_date
  order by p.valid_from desc
  limit 1;
$$;

revoke all on function private.current_expense_approval_policy(uuid, date) from public;

create table public.institutional_payables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  accounting_plan_id uuid,
  accounting_account_id uuid,
  fund_id uuid,
  recurring_rule_id uuid,
  generation_key text,
  description text not null check (length(btrim(description)) > 0),
  counterparty_name text,
  competence date not null check (extract(day from competence) = 1),
  issue_date date not null,
  due_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  expense_classification text check (expense_classification in ('fixed', 'variable')),
  installment_number integer,
  installment_count integer,
  posting_status text not null default 'draft' check (posting_status in ('draft', 'posted')),
  approval_policy_id uuid,
  approval_required boolean not null default false,
  approval_threshold_snapshot numeric(14,2),
  approval_min_approvers smallint not null default 0 check (approval_min_approvers between 0 and 10),
  created_by uuid references auth.users(id),
  posted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (organization_id, id),
  check (
    (installment_number is null and installment_count is null)
    or (installment_number between 1 and installment_count and installment_count >= 1)
  ),
  check (
    (posting_status = 'draft' and posted_at is null)
    or (posting_status = 'posted' and posted_at is not null)
  ),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, recurring_rule_id)
    references public.institutional_recurring_rules(organization_id, id),
  foreign key (organization_id, approval_policy_id)
    references public.expense_approval_policies(organization_id, id)
);

create unique index institutional_payables_generation_uidx
on public.institutional_payables(organization_id, generation_key)
where generation_key is not null;

create index institutional_payables_due_idx
on public.institutional_payables(organization_id, due_date, posting_status);

create table public.institutional_receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  accounting_plan_id uuid,
  accounting_account_id uuid,
  fund_id uuid,
  recurring_rule_id uuid,
  generation_key text,
  description text not null check (length(btrim(description)) > 0),
  counterparty_name text,
  competence date not null check (extract(day from competence) = 1),
  issue_date date not null,
  due_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  revenue_classification text check (revenue_classification in ('recurring', 'ad_hoc')),
  installment_number integer,
  installment_count integer,
  posting_status text not null default 'draft' check (posting_status in ('draft', 'posted')),
  created_by uuid references auth.users(id),
  posted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (organization_id, id),
  check (
    (installment_number is null and installment_count is null)
    or (installment_number between 1 and installment_count and installment_count >= 1)
  ),
  check (
    (posting_status = 'draft' and posted_at is null)
    or (posting_status = 'posted' and posted_at is not null)
  ),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, recurring_rule_id)
    references public.institutional_recurring_rules(organization_id, id)
);

create unique index institutional_receivables_generation_uidx
on public.institutional_receivables(organization_id, generation_key)
where generation_key is not null;

create index institutional_receivables_due_idx
on public.institutional_receivables(organization_id, due_date, posting_status);

create or replace function private.populate_institutional_payable_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
  v_plan uuid;
  v_account uuid;
  v_class text;
  v_policy uuid;
  v_mode text;
  v_threshold numeric;
  v_min smallint;
begin
  select c.domain into v_domain
  from public.financial_categories c
  where c.organization_id = new.organization_id
    and c.id = new.category_id;

  if v_domain is distinct from 'institutional_expense' then
    raise exception 'payable category must be institutional_expense' using errcode = '23514';
  end if;

  if new.posting_status = 'posted' then
    select r.accounting_plan_id, r.accounting_account_id, r.operational_classification
      into v_plan, v_account, v_class
    from private.resolve_category_account(new.organization_id, new.category_id, new.competence) r;

    if v_plan is null or v_account is null or v_class not in ('fixed', 'variable') then
      raise exception 'posted payable requires mapped fixed/variable accounting account'
        using errcode = '23514';
    end if;

    new.accounting_plan_id := v_plan;
    new.accounting_account_id := v_account;
    new.expense_classification := v_class;

    select p.policy_id, p.mode, p.threshold_amount, p.minimum_approvers
      into v_policy, v_mode, v_threshold, v_min
    from private.current_expense_approval_policy(new.organization_id, new.issue_date) p;

    new.approval_policy_id := v_policy;
    new.approval_threshold_snapshot := v_threshold;
    new.approval_required := case
      when v_policy is null or v_mode = 'off' then false
      when v_mode = 'all' then true
      when v_mode = 'threshold' then new.amount >= v_threshold
      else false
    end;
    new.approval_min_approvers := case
      when new.approval_required then coalesce(v_min, 1)
      else 0
    end;
  end if;

  return new;
end;
$$;

create trigger institutional_payables_snapshot
before insert or update on public.institutional_payables
for each row execute function private.populate_institutional_payable_snapshot();

create or replace function private.populate_institutional_receivable_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
  v_plan uuid;
  v_account uuid;
  v_class text;
begin
  select c.domain into v_domain
  from public.financial_categories c
  where c.organization_id = new.organization_id
    and c.id = new.category_id;

  if v_domain is distinct from 'institutional_revenue' then
    raise exception 'institutional receivable category must be institutional_revenue'
      using errcode = '23514';
  end if;

  if new.posting_status = 'posted' then
    select r.accounting_plan_id, r.accounting_account_id, r.operational_classification
      into v_plan, v_account, v_class
    from private.resolve_category_account(new.organization_id, new.category_id, new.competence) r;

    if v_plan is null or v_account is null or v_class not in ('recurring', 'ad_hoc') then
      raise exception 'posted institutional receivable requires mapped recurring/ad-hoc revenue account'
        using errcode = '23514';
    end if;

    new.accounting_plan_id := v_plan;
    new.accounting_account_id := v_account;
    new.revenue_classification := v_class;
  end if;

  return new;
end;
$$;

create trigger institutional_receivables_snapshot
before insert or update on public.institutional_receivables
for each row execute function private.populate_institutional_receivable_snapshot();

create or replace function private.guard_posted_institutional_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.posting_status = 'posted' then
    raise exception 'posted institutional record is immutable; use correction/cancellation'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger institutional_payables_posted_guard
before update or delete on public.institutional_payables
for each row execute function private.guard_posted_institutional_mutation();

create trigger institutional_receivables_posted_guard
before update or delete on public.institutional_receivables
for each row execute function private.guard_posted_institutional_mutation();

create trigger institutional_payables_closed_period
before insert or update on public.institutional_payables
for each row when (new.posting_status = 'posted')
execute function private.reject_closed_period();

create trigger institutional_receivables_closed_period
before insert or update on public.institutional_receivables
for each row when (new.posting_status = 'posted')
execute function private.reject_closed_period();

create table public.institutional_payable_corrections (
  id uuid primary key default gen_random_uuid(),
  correction_seq bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payable_id uuid not null,
  previous_category_id uuid not null,
  new_category_id uuid not null,
  previous_accounting_plan_id uuid not null,
  previous_accounting_account_id uuid not null,
  new_accounting_plan_id uuid not null,
  new_accounting_account_id uuid not null,
  previous_fund_id uuid,
  new_fund_id uuid,
  previous_expense_classification text not null check (previous_expense_classification in ('fixed', 'variable')),
  new_expense_classification text not null check (new_expense_classification in ('fixed', 'variable')),
  previous_description text not null,
  new_description text not null,
  previous_competence date not null,
  new_competence date not null,
  previous_due_date date not null,
  new_due_date date not null,
  previous_amount numeric(14,2) not null check (previous_amount > 0),
  new_amount numeric(14,2) not null check (new_amount > 0),
  approval_policy_id uuid,
  approval_required boolean not null default false,
  approval_threshold_snapshot numeric(14,2),
  approval_min_approvers smallint not null default 0 check (approval_min_approvers between 0 and 10),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payable_id)
    references public.institutional_payables(organization_id, id),
  foreign key (organization_id, previous_category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, new_category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, previous_accounting_plan_id, previous_accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, new_accounting_plan_id, new_accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, previous_fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, new_fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, approval_policy_id)
    references public.expense_approval_policies(organization_id, id)
);

create index institutional_payable_corrections_latest_idx
on public.institutional_payable_corrections(payable_id, correction_seq desc);

create trigger institutional_payable_corrections_closed_period
before insert on public.institutional_payable_corrections
for each row execute function private.reject_closed_period();

create trigger institutional_payable_corrections_immutable
before update or delete on public.institutional_payable_corrections
for each row execute function private.prevent_financial_mutation();

create table public.institutional_receivable_corrections (
  id uuid primary key default gen_random_uuid(),
  correction_seq bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receivable_id uuid not null,
  previous_category_id uuid not null,
  new_category_id uuid not null,
  previous_accounting_plan_id uuid not null,
  previous_accounting_account_id uuid not null,
  new_accounting_plan_id uuid not null,
  new_accounting_account_id uuid not null,
  previous_fund_id uuid,
  new_fund_id uuid,
  previous_revenue_classification text not null check (previous_revenue_classification in ('recurring', 'ad_hoc')),
  new_revenue_classification text not null check (new_revenue_classification in ('recurring', 'ad_hoc')),
  previous_description text not null,
  new_description text not null,
  previous_competence date not null,
  new_competence date not null,
  previous_due_date date not null,
  new_due_date date not null,
  previous_amount numeric(14,2) not null check (previous_amount > 0),
  new_amount numeric(14,2) not null check (new_amount > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, receivable_id)
    references public.institutional_receivables(organization_id, id),
  foreign key (organization_id, previous_category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, new_category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, previous_accounting_plan_id, previous_accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, new_accounting_plan_id, new_accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, previous_fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, new_fund_id)
    references public.funds(organization_id, id)
);

create index institutional_receivable_corrections_latest_idx
on public.institutional_receivable_corrections(receivable_id, correction_seq desc);

create trigger institutional_receivable_corrections_closed_period
before insert on public.institutional_receivable_corrections
for each row execute function private.reject_closed_period();

create trigger institutional_receivable_corrections_immutable
before update or delete on public.institutional_receivable_corrections
for each row execute function private.prevent_financial_mutation();

create table public.institutional_payable_cancellations (
  payable_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canceled_amount numeric(14,2) not null check (canceled_amount > 0),
  accounting_plan_id uuid not null,
  accounting_account_id uuid not null,
  fund_id uuid,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, payable_id),
  foreign key (organization_id, payable_id)
    references public.institutional_payables(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, fund_id)
    references public.funds(organization_id, id)
);

create table public.institutional_receivable_cancellations (
  receivable_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canceled_amount numeric(14,2) not null check (canceled_amount > 0),
  accounting_plan_id uuid not null,
  accounting_account_id uuid not null,
  fund_id uuid,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, receivable_id),
  foreign key (organization_id, receivable_id)
    references public.institutional_receivables(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id),
  foreign key (organization_id, fund_id)
    references public.funds(organization_id, id)
);

create trigger institutional_payable_cancellations_closed_period
before insert on public.institutional_payable_cancellations
for each row execute function private.reject_closed_period();

create trigger institutional_receivable_cancellations_closed_period
before insert on public.institutional_receivable_cancellations
for each row execute function private.reject_closed_period();

create trigger institutional_payable_cancellations_immutable
before update or delete on public.institutional_payable_cancellations
for each row execute function private.prevent_financial_mutation();

create trigger institutional_receivable_cancellations_immutable
before update or delete on public.institutional_receivable_cancellations
for each row execute function private.prevent_financial_mutation();

create table public.payable_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payable_id uuid not null,
  correction_id uuid,
  minimum_approvers smallint not null check (minimum_approvers between 1 and 10),
  threshold_snapshot numeric(14,2),
  amount_snapshot numeric(14,2) not null check (amount_snapshot > 0),
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payable_id)
    references public.institutional_payables(organization_id, id),
  foreign key (organization_id, correction_id)
    references public.institutional_payable_corrections(organization_id, id)
);

create unique index payable_approval_requests_base_uidx
on public.payable_approval_requests(payable_id)
where correction_id is null;

create unique index payable_approval_requests_correction_uidx
on public.payable_approval_requests(correction_id)
where correction_id is not null;

create table public.payable_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approve', 'reject')),
  reason text,
  created_at timestamptz not null default now(),
  unique (approval_request_id, actor_user_id),
  foreign key (organization_id, approval_request_id)
    references public.payable_approval_requests(organization_id, id) on delete cascade
);

create trigger payable_approval_requests_immutable
before update or delete on public.payable_approval_requests
for each row execute function private.prevent_financial_mutation();

create trigger payable_approval_decisions_immutable
before update or delete on public.payable_approval_decisions
for each row execute function private.prevent_financial_mutation();

create table public.institutional_payable_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  payment_method_id uuid not null,
  financial_account_id uuid not null,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payment_method_id)
    references public.payment_methods(organization_id, id),
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id)
);

create table public.institutional_payable_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payable_payment_id uuid not null,
  payable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payable_payment_id)
    references public.institutional_payable_payments(organization_id, id),
  foreign key (organization_id, payable_id)
    references public.institutional_payables(organization_id, id)
);

create table public.institutional_payable_allocation_reversals (
  allocation_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, allocation_id)
    references public.institutional_payable_payment_allocations(organization_id, id)
);

create table public.institutional_payable_payment_reversals (
  payment_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reversal_date date not null default current_date,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, payment_id)
    references public.institutional_payable_payments(organization_id, id)
);

create table public.institutional_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  payment_method_id uuid not null,
  financial_account_id uuid not null,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payment_method_id)
    references public.payment_methods(organization_id, id),
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id)
);

create table public.institutional_receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_id uuid not null,
  receivable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  accounting_period date not null check (extract(day from accounting_period) = 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, receipt_id)
    references public.institutional_receipts(organization_id, id),
  foreign key (organization_id, receivable_id)
    references public.institutional_receivables(organization_id, id)
);

create table public.institutional_receipt_allocation_reversals (
  allocation_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, allocation_id)
    references public.institutional_receipt_allocations(organization_id, id)
);

create table public.institutional_receipt_reversals (
  receipt_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reversal_date date not null default current_date,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, receipt_id)
    references public.institutional_receipts(organization_id, id)
);

-- Closed-period + immutability on institutional cash facts.
create trigger institutional_payable_payments_closed_period
before insert on public.institutional_payable_payments
for each row execute function private.reject_closed_period();

create trigger institutional_payable_allocations_closed_period
before insert on public.institutional_payable_payment_allocations
for each row execute function private.reject_closed_period();

create trigger institutional_receipts_closed_period
before insert on public.institutional_receipts
for each row execute function private.reject_closed_period();

create trigger institutional_receipt_allocations_closed_period
before insert on public.institutional_receipt_allocations
for each row execute function private.reject_closed_period();

create trigger institutional_payable_payments_immutable
before update or delete on public.institutional_payable_payments
for each row execute function private.prevent_financial_mutation();

create trigger institutional_payable_allocations_immutable
before update or delete on public.institutional_payable_payment_allocations
for each row execute function private.prevent_financial_mutation();

create trigger institutional_receipts_immutable
before update or delete on public.institutional_receipts
for each row execute function private.prevent_financial_mutation();

create trigger institutional_receipt_allocations_immutable
before update or delete on public.institutional_receipt_allocations
for each row execute function private.prevent_financial_mutation();

create trigger institutional_payable_allocation_reversals_closed_period
before insert on public.institutional_payable_allocation_reversals
for each row execute function private.reject_closed_period();

create trigger institutional_payable_payment_reversals_closed_period
before insert on public.institutional_payable_payment_reversals
for each row execute function private.reject_closed_period();

create trigger institutional_receipt_allocation_reversals_closed_period
before insert on public.institutional_receipt_allocation_reversals
for each row execute function private.reject_closed_period();

create trigger institutional_receipt_reversals_closed_period
before insert on public.institutional_receipt_reversals
for each row execute function private.reject_closed_period();

create trigger institutional_payable_allocation_reversals_immutable
before update or delete on public.institutional_payable_allocation_reversals
for each row execute function private.prevent_financial_mutation();

create trigger institutional_payable_payment_reversals_immutable
before update or delete on public.institutional_payable_payment_reversals
for each row execute function private.prevent_financial_mutation();

create trigger institutional_receipt_allocation_reversals_immutable
before update or delete on public.institutional_receipt_allocation_reversals
for each row execute function private.prevent_financial_mutation();

create trigger institutional_receipt_reversals_immutable
before update or delete on public.institutional_receipt_reversals
for each row execute function private.prevent_financial_mutation();

create table public.financial_account_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  transfer_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  reference text,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (from_account_id <> to_account_id),
  foreign key (organization_id, from_account_id)
    references public.financial_accounts(organization_id, id),
  foreign key (organization_id, to_account_id)
    references public.financial_accounts(organization_id, id)
);

create table public.financial_account_transfer_reversals (
  transfer_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reversal_date date not null default current_date,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, transfer_id)
    references public.financial_account_transfers(organization_id, id)
);

create table public.fund_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_fund_id uuid not null,
  to_fund_id uuid not null,
  transfer_date date not null,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (from_fund_id <> to_fund_id),
  foreign key (organization_id, from_fund_id)
    references public.funds(organization_id, id),
  foreign key (organization_id, to_fund_id)
    references public.funds(organization_id, id)
);

create table public.fund_transfer_reversals (
  transfer_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_period date not null check (extract(day from accounting_period) = 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, transfer_id)
    references public.fund_transfers(organization_id, id)
);

create trigger financial_account_transfers_closed_period
before insert on public.financial_account_transfers
for each row execute function private.reject_closed_period();

create trigger financial_account_transfers_immutable
before update or delete on public.financial_account_transfers
for each row execute function private.prevent_financial_mutation();

create trigger financial_account_transfer_reversals_closed_period
before insert on public.financial_account_transfer_reversals
for each row execute function private.reject_closed_period();

create trigger financial_account_transfer_reversals_immutable
before update or delete on public.financial_account_transfer_reversals
for each row execute function private.prevent_financial_mutation();

create trigger fund_transfers_closed_period
before insert on public.fund_transfers
for each row execute function private.reject_closed_period();

create trigger fund_transfers_immutable
before update or delete on public.fund_transfers
for each row execute function private.prevent_financial_mutation();

create trigger fund_transfer_reversals_closed_period
before insert on public.fund_transfer_reversals
for each row execute function private.reject_closed_period();

create trigger fund_transfer_reversals_immutable
before update or delete on public.fund_transfer_reversals
for each row execute function private.prevent_financial_mutation();

create or replace function private.current_payable_amount(p_payable_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce(
      (select c.new_amount from public.institutional_payable_corrections c
       where c.payable_id = p_payable_id order by c.correction_seq desc limit 1),
      (select p.amount from public.institutional_payables p where p.id = p_payable_id),
      0::numeric
    )
    - coalesce(
      (select x.canceled_amount from public.institutional_payable_cancellations x
       where x.payable_id = p_payable_id),
      0::numeric
    ),
    0::numeric
  );
$$;

create or replace function private.current_receivable_amount(p_receivable_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce(
      (select c.new_amount from public.institutional_receivable_corrections c
       where c.receivable_id = p_receivable_id order by c.correction_seq desc limit 1),
      (select r.amount from public.institutional_receivables r where r.id = p_receivable_id),
      0::numeric
    )
    - coalesce(
      (select x.canceled_amount from public.institutional_receivable_cancellations x
       where x.receivable_id = p_receivable_id),
      0::numeric
    ),
    0::numeric
  );
$$;

create or replace function private.validate_payable_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective numeric;
  v_allocated numeric;
  v_plan uuid;
  v_account uuid;
  v_fund uuid;
begin
  perform 1
  from public.institutional_payables p
  where p.organization_id = new.organization_id
    and p.id = new.payable_id
    and p.posting_status = 'posted'
  for update;

  if not found then
    raise exception 'posted payable not found' using errcode = '23503';
  end if;

  select
    coalesce(
      (select c.new_amount from public.institutional_payable_corrections c
       where c.payable_id = new.payable_id order by c.correction_seq desc limit 1),
      p.amount
    ),
    coalesce(
      (select c.new_accounting_plan_id from public.institutional_payable_corrections c
       where c.payable_id = new.payable_id order by c.correction_seq desc limit 1),
      p.accounting_plan_id
    ),
    coalesce(
      (select c.new_accounting_account_id from public.institutional_payable_corrections c
       where c.payable_id = new.payable_id order by c.correction_seq desc limit 1),
      p.accounting_account_id
    ),
    coalesce(
      (select c.new_fund_id from public.institutional_payable_corrections c
       where c.payable_id = new.payable_id order by c.correction_seq desc limit 1),
      p.fund_id
    )
  into v_effective, v_plan, v_account, v_fund
  from public.institutional_payables p
  where p.id = new.payable_id;

  select coalesce(sum(a.amount), 0)
  into v_allocated
  from public.institutional_payable_payment_allocations a
  left join public.institutional_payable_allocation_reversals ar on ar.allocation_id = a.id
  left join public.institutional_payable_payment_reversals pr on pr.payment_id = a.payable_payment_id
  where a.payable_id = new.payable_id
    and ar.allocation_id is null
    and pr.payment_id is null;

  if new.canceled_amount <> v_effective - v_allocated then
    raise exception 'cancellation must equal the current unpaid balance'
      using errcode = '23514';
  end if;

  if new.accounting_plan_id is distinct from v_plan
     or new.accounting_account_id is distinct from v_account
     or new.fund_id is distinct from v_fund then
    raise exception 'cancellation snapshots do not match current payable classification'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger institutional_payable_cancellations_validate
before insert on public.institutional_payable_cancellations
for each row execute function private.validate_payable_cancellation();

create or replace function private.validate_receivable_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective numeric;
  v_allocated numeric;
  v_plan uuid;
  v_account uuid;
  v_fund uuid;
begin
  perform 1
  from public.institutional_receivables r
  where r.organization_id = new.organization_id
    and r.id = new.receivable_id
    and r.posting_status = 'posted'
  for update;

  if not found then
    raise exception 'posted institutional receivable not found' using errcode = '23503';
  end if;

  select
    coalesce(
      (select c.new_amount from public.institutional_receivable_corrections c
       where c.receivable_id = new.receivable_id order by c.correction_seq desc limit 1),
      r.amount
    ),
    coalesce(
      (select c.new_accounting_plan_id from public.institutional_receivable_corrections c
       where c.receivable_id = new.receivable_id order by c.correction_seq desc limit 1),
      r.accounting_plan_id
    ),
    coalesce(
      (select c.new_accounting_account_id from public.institutional_receivable_corrections c
       where c.receivable_id = new.receivable_id order by c.correction_seq desc limit 1),
      r.accounting_account_id
    ),
    coalesce(
      (select c.new_fund_id from public.institutional_receivable_corrections c
       where c.receivable_id = new.receivable_id order by c.correction_seq desc limit 1),
      r.fund_id
    )
  into v_effective, v_plan, v_account, v_fund
  from public.institutional_receivables r
  where r.id = new.receivable_id;

  select coalesce(sum(a.amount), 0)
  into v_allocated
  from public.institutional_receipt_allocations a
  left join public.institutional_receipt_allocation_reversals ar on ar.allocation_id = a.id
  left join public.institutional_receipt_reversals rr on rr.receipt_id = a.receipt_id
  where a.receivable_id = new.receivable_id
    and ar.allocation_id is null
    and rr.receipt_id is null;

  if new.canceled_amount <> v_effective - v_allocated then
    raise exception 'cancellation must equal the current unreceived balance'
      using errcode = '23514';
  end if;

  if new.accounting_plan_id is distinct from v_plan
     or new.accounting_account_id is distinct from v_account
     or new.fund_id is distinct from v_fund then
    raise exception 'cancellation snapshots do not match current receivable classification'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger institutional_receivable_cancellations_validate
before insert on public.institutional_receivable_cancellations
for each row execute function private.validate_receivable_cancellation();

create or replace function private.payable_approval_satisfied(p_payable_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with latest_correction as (
    select c.*
    from public.institutional_payable_corrections c
    where c.payable_id = p_payable_id
    order by c.correction_seq desc
    limit 1
  ),
  requirement as (
    select
      coalesce((select c.approval_required from latest_correction c), p.approval_required) as required,
      coalesce((select c.approval_min_approvers from latest_correction c), p.approval_min_approvers) as min_approvers,
      (select c.id from latest_correction c) as correction_id
    from public.institutional_payables p
    where p.id = p_payable_id
  ),
  request as (
    select ar.*
    from public.payable_approval_requests ar
    cross join requirement r
    where ar.payable_id = p_payable_id
      and ((r.correction_id is null and ar.correction_id is null) or ar.correction_id = r.correction_id)
    order by ar.created_at desc
    limit 1
  ),
  decision_counts as (
    select
      count(*) filter (where d.decision = 'approve') as approvals,
      count(*) filter (where d.decision = 'reject') as rejections
    from public.payable_approval_decisions d
    where d.approval_request_id = (select id from request)
  )
  select case
    when not coalesce((select required from requirement), false) then true
    when (select id from request) is null then false
    when coalesce((select rejections from decision_counts), 0) > 0 then false
    else coalesce((select approvals from decision_counts), 0)
      >= coalesce((select min_approvers from requirement), 1)
  end;
$$;

revoke all on function private.current_payable_amount(uuid) from public;
revoke all on function private.current_receivable_amount(uuid) from public;
revoke all on function private.payable_approval_satisfied(uuid) from public;

create or replace function private.validate_payable_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payable_amount numeric;
  v_payable_allocated numeric;
  v_payment_amount numeric;
  v_payment_allocated numeric;
begin
  perform 1 from public.institutional_payables p
  where p.id = new.payable_id and p.posting_status = 'posted'
  for update;
  if not found then
    raise exception 'posted payable not found' using errcode = '23503';
  end if;

  if not private.payable_approval_satisfied(new.payable_id) then
    raise exception 'payable approval requirements are not satisfied' using errcode = '42501';
  end if;

  v_payable_amount := private.current_payable_amount(new.payable_id);
  if v_payable_amount <= 0 then
    raise exception 'cannot allocate payment to canceled payable' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0) into v_payable_allocated
  from public.institutional_payable_payment_allocations a
  left join public.institutional_payable_allocation_reversals r on r.allocation_id = a.id
  left join public.institutional_payable_payment_reversals pr on pr.payment_id = a.payable_payment_id
  where a.payable_id = new.payable_id and r.allocation_id is null and pr.payment_id is null;

  if v_payable_allocated + new.amount > v_payable_amount then
    raise exception 'allocation exceeds payable open amount' using errcode = '23514';
  end if;

  select p.amount into v_payment_amount
  from public.institutional_payable_payments p
  where p.id = new.payable_payment_id for update;

  if exists (
    select 1 from public.institutional_payable_payment_reversals r
    where r.payment_id = new.payable_payment_id
  ) then
    raise exception 'cannot allocate reversed payable payment' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0) into v_payment_allocated
  from public.institutional_payable_payment_allocations a
  left join public.institutional_payable_allocation_reversals r on r.allocation_id = a.id
  where a.payable_payment_id = new.payable_payment_id and r.allocation_id is null;

  if v_payment_allocated + new.amount > v_payment_amount then
    raise exception 'allocation exceeds payable payment available amount' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger institutional_payable_allocations_validate
before insert on public.institutional_payable_payment_allocations
for each row execute function private.validate_payable_allocation();

create or replace function private.validate_receipt_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receivable_amount numeric;
  v_receivable_allocated numeric;
  v_receipt_amount numeric;
  v_receipt_allocated numeric;
begin
  perform 1 from public.institutional_receivables r
  where r.id = new.receivable_id and r.posting_status = 'posted'
  for update;
  if not found then
    raise exception 'posted institutional receivable not found' using errcode = '23503';
  end if;

  v_receivable_amount := private.current_receivable_amount(new.receivable_id);
  if v_receivable_amount <= 0 then
    raise exception 'cannot allocate receipt to canceled receivable' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0) into v_receivable_allocated
  from public.institutional_receipt_allocations a
  left join public.institutional_receipt_allocation_reversals r on r.allocation_id = a.id
  left join public.institutional_receipt_reversals rr on rr.receipt_id = a.receipt_id
  where a.receivable_id = new.receivable_id and r.allocation_id is null and rr.receipt_id is null;

  if v_receivable_allocated + new.amount > v_receivable_amount then
    raise exception 'allocation exceeds institutional receivable open amount' using errcode = '23514';
  end if;

  select r.amount into v_receipt_amount
  from public.institutional_receipts r
  where r.id = new.receipt_id for update;

  if exists (
    select 1 from public.institutional_receipt_reversals rr
    where rr.receipt_id = new.receipt_id
  ) then
    raise exception 'cannot allocate reversed receipt' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0) into v_receipt_allocated
  from public.institutional_receipt_allocations a
  left join public.institutional_receipt_allocation_reversals r on r.allocation_id = a.id
  where a.receipt_id = new.receipt_id and r.allocation_id is null;

  if v_receipt_allocated + new.amount > v_receipt_amount then
    raise exception 'allocation exceeds receipt available amount' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger institutional_receipt_allocations_validate
before insert on public.institutional_receipt_allocations
for each row execute function private.validate_receipt_allocation();

create or replace function private.validate_payable_payment_reversal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.institutional_payable_payments p where p.id = new.payment_id for update;
  if exists (
    select 1 from public.institutional_payable_payment_allocations a
    left join public.institutional_payable_allocation_reversals r on r.allocation_id = a.id
    where a.payable_payment_id = new.payment_id and r.allocation_id is null
  ) then
    raise exception 'reverse active allocations before reversing payable payment' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger institutional_payable_payment_reversals_validate
before insert on public.institutional_payable_payment_reversals
for each row execute function private.validate_payable_payment_reversal();

create or replace function private.validate_receipt_reversal()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.institutional_receipts r where r.id = new.receipt_id for update;
  if exists (
    select 1 from public.institutional_receipt_allocations a
    left join public.institutional_receipt_allocation_reversals ar on ar.allocation_id = a.id
    where a.receipt_id = new.receipt_id and ar.allocation_id is null
  ) then
    raise exception 'reverse active allocations before reversing receipt' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger institutional_receipt_reversals_validate
before insert on public.institutional_receipt_reversals
for each row execute function private.validate_receipt_reversal();
