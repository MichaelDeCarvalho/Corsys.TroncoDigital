-- Corsys Tronco Digital
-- Migration 010: reconciliation, budgets, imports, privacy and operational support
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  original_filename text not null check (length(btrim(original_filename)) > 0),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text,
  classification text not null default 'confidential'
    check (classification in ('internal', 'confidential', 'sensitive')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path),
  unique (organization_id, id)
);

create table public.payable_documents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payable_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (payable_id, document_id),
  foreign key (organization_id, payable_id)
    references public.institutional_payables(organization_id, id) on delete cascade,
  foreign key (organization_id, document_id)
    references public.documents(organization_id, id) on delete cascade
);

create table public.receivable_documents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receivable_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (receivable_id, document_id),
  foreign key (organization_id, receivable_id)
    references public.institutional_receivables(organization_id, id) on delete cascade,
  foreign key (organization_id, document_id)
    references public.documents(organization_id, id) on delete cascade
);

create table public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  opening_balance numeric(14,2),
  closing_balance numeric(14,2),
  file_name text not null,
  file_sha256 text not null,
  status text not null default 'staged'
    check (status in ('staged', 'validated', 'reconciled', 'canceled')),
  imported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, financial_account_id, file_sha256),
  unique (organization_id, id),
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id)
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  statement_import_id uuid not null,
  line_number integer not null check (line_number > 0),
  transaction_date date not null,
  description text not null,
  amount numeric(14,2) not null check (amount <> 0),
  external_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (statement_import_id, line_number),
  unique (organization_id, id),
  foreign key (organization_id, statement_import_id)
    references public.bank_statement_imports(organization_id, id) on delete cascade
);

create unique index bank_statement_lines_external_uidx
on public.bank_statement_lines(statement_import_id, external_id)
where external_id is not null;

create trigger bank_statement_lines_immutable
before update or delete on public.bank_statement_lines
for each row execute function private.prevent_financial_mutation();

create table public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  statement_line_id uuid not null,
  member_payment_id uuid,
  institutional_receipt_id uuid,
  payable_payment_id uuid,
  account_transfer_id uuid,
  matched_amount numeric(14,2) not null check (matched_amount > 0),
  matched_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (
    (member_payment_id is not null)::integer
    + (institutional_receipt_id is not null)::integer
    + (payable_payment_id is not null)::integer
    + (account_transfer_id is not null)::integer = 1
  ),
  foreign key (organization_id, statement_line_id)
    references public.bank_statement_lines(organization_id, id),
  foreign key (organization_id, member_payment_id)
    references public.payments(organization_id, id),
  foreign key (organization_id, institutional_receipt_id)
    references public.institutional_receipts(organization_id, id),
  foreign key (organization_id, payable_payment_id)
    references public.institutional_payable_payments(organization_id, id),
  foreign key (organization_id, account_transfer_id)
    references public.financial_account_transfers(organization_id, id)
);

create trigger bank_reconciliation_matches_immutable
before update or delete on public.bank_reconciliation_matches
for each row execute function private.prevent_financial_mutation();

create table public.bank_reconciliation_match_reversals (
  match_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  reversed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, match_id)
    references public.bank_reconciliation_matches(organization_id, id)
);

create trigger bank_reconciliation_match_reversals_immutable
before update or delete on public.bank_reconciliation_match_reversals
for each row execute function private.prevent_financial_mutation();

create or replace function private.validate_bank_reconciliation_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line_amount numeric;
  v_line_signed numeric;
  v_statement_account uuid;
  v_existing_line numeric;
  v_existing_target numeric;
  v_target_amount numeric;
  v_target_account uuid;
  v_transfer_from uuid;
  v_transfer_to uuid;
begin
  select abs(l.amount), l.amount, i.financial_account_id
  into v_line_amount, v_line_signed, v_statement_account
  from public.bank_statement_lines l
  join public.bank_statement_imports i
    on i.organization_id = l.organization_id
   and i.id = l.statement_import_id
  where l.organization_id = new.organization_id
    and l.id = new.statement_line_id
  for update of l;

  if v_line_amount is null then
    raise exception 'statement line not found' using errcode = '23503';
  end if;

  select coalesce(sum(m.matched_amount), 0)
  into v_existing_line
  from public.bank_reconciliation_matches m
  left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
  where m.statement_line_id = new.statement_line_id
    and r.match_id is null;

  if v_existing_line + new.matched_amount > v_line_amount then
    raise exception 'reconciliation matches exceed statement line amount'
      using errcode = '23514';
  end if;

  if new.member_payment_id is not null then
    select p.amount, p.financial_account_id
      into v_target_amount, v_target_account
    from public.payments p
    where p.organization_id = new.organization_id
      and p.id = new.member_payment_id
      and p.source_kind = 'operational'
    for update;

    if v_target_amount is null
       or v_line_signed <= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'member payment does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.member_payment_id = new.member_payment_id
      and r.match_id is null;

  elsif new.institutional_receipt_id is not null then
    select r.amount, r.financial_account_id
      into v_target_amount, v_target_account
    from public.institutional_receipts r
    where r.organization_id = new.organization_id
      and r.id = new.institutional_receipt_id
    for update;

    if v_target_amount is null
       or v_line_signed <= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'institutional receipt does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals rr on rr.match_id = m.id
    where m.institutional_receipt_id = new.institutional_receipt_id
      and rr.match_id is null;

  elsif new.payable_payment_id is not null then
    select p.amount, p.financial_account_id
      into v_target_amount, v_target_account
    from public.institutional_payable_payments p
    where p.organization_id = new.organization_id
      and p.id = new.payable_payment_id
    for update;

    if v_target_amount is null
       or v_line_signed >= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'payable payment does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.payable_payment_id = new.payable_payment_id
      and r.match_id is null;

  else
    select t.amount, t.from_account_id, t.to_account_id
      into v_target_amount, v_transfer_from, v_transfer_to
    from public.financial_account_transfers t
    where t.organization_id = new.organization_id
      and t.id = new.account_transfer_id
    for update;

    if v_target_amount is null
       or (v_line_signed > 0 and v_transfer_to is distinct from v_statement_account)
       or (v_line_signed < 0 and v_transfer_from is distinct from v_statement_account) then
      raise exception 'account transfer does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.account_transfer_id = new.account_transfer_id
      and r.match_id is null;
  end if;

  if coalesce(v_existing_target, 0) + new.matched_amount > v_target_amount then
    raise exception 'reconciliation matches exceed financial fact amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger bank_reconciliation_matches_validate
before insert on public.bank_reconciliation_matches
for each row execute function private.validate_bank_reconciliation_match();

create table public.budget_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed')),
  currency text not null default 'BRL' check (length(currency) = 3),
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (
    (status = 'draft' and published_at is null)
    or (status in ('published', 'closed') and published_at is not null)
  ),
  unique (organization_id, name),
  unique (organization_id, id)
);

create trigger budget_cycles_set_updated_at
before update on public.budget_cycles
for each row execute function private.set_updated_at();

create or replace function private.prevent_non_draft_budget_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_cycle_id := old.budget_cycle_id;
  else
    v_cycle_id := new.budget_cycle_id;
  end if;

  select c.status into v_status
  from public.budget_cycles c
  where c.id = v_cycle_id;

  if v_status is distinct from 'draft' then
    raise exception 'published/closed budget is immutable; create a successor budget'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.prevent_published_budget_cycle_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('published', 'closed') then
    raise exception 'published/closed budget cycle is immutable'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger budget_cycles_published_guard
before update or delete on public.budget_cycles
for each row execute function private.prevent_published_budget_cycle_mutation();

create table public.accounting_budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_cycle_id uuid not null,
  accounting_plan_id uuid not null,
  accounting_account_id uuid not null,
  period date not null check (extract(day from period) = 1),
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (budget_cycle_id, accounting_account_id, period),
  foreign key (organization_id, budget_cycle_id)
    references public.budget_cycles(organization_id, id) on delete cascade,
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id)
);

create table public.fund_budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_cycle_id uuid not null,
  fund_id uuid not null,
  period date not null check (extract(day from period) = 1),
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (budget_cycle_id, fund_id, period),
  foreign key (organization_id, budget_cycle_id)
    references public.budget_cycles(organization_id, id) on delete cascade,
  foreign key (organization_id, fund_id)
    references public.funds(organization_id, id)
);

create trigger accounting_budget_lines_draft_guard
before insert or update or delete on public.accounting_budget_lines
for each row execute function private.prevent_non_draft_budget_mutation();

create trigger fund_budget_lines_draft_guard
before insert or update or delete on public.fund_budget_lines
for each row execute function private.prevent_non_draft_budget_mutation();

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_type text not null
    check (import_type in ('members', 'member_finance', 'institutional_finance', 'bank_statement')),
  file_name text not null,
  file_sha256 text not null,
  status text not null default 'staging'
    check (status in ('staging', 'validated', 'confirmed', 'failed', 'canceled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  confirmed_at timestamptz,
  error_code text,
  unique (organization_id, import_type, file_sha256),
  unique (organization_id, id)
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_job_id uuid not null,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null,
  normalized_data jsonb,
  dedupe_key text,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'invalid', 'duplicate')),
  validation_errors text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (import_job_id, row_number),
  foreign key (organization_id, import_job_id)
    references public.import_jobs(organization_id, id) on delete cascade
);

create table public.import_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_job_id uuid not null,
  confirmed_by uuid not null references auth.users(id),
  confirmation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, import_job_id),
  foreign key (organization_id, import_job_id)
    references public.import_jobs(organization_id, id)
);

create trigger import_confirmations_immutable
before update or delete on public.import_confirmations
for each row execute function private.prevent_financial_mutation();

create table public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_class text not null,
  valid_from date not null,
  valid_to date,
  retention_days integer check (retention_days is null or retention_days >= 0),
  legal_or_business_basis text not null check (length(btrim(legal_or_business_basis)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (organization_id, data_class, valid_from)
);

alter table public.data_retention_policies
  add constraint data_retention_policies_no_overlap
  exclude using gist (
    organization_id with =,
    data_class with =,
    daterange(valid_from, coalesce(valid_to + 1, 'infinity'::date), '[)') with &&
  );

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid,
  requester_user_id uuid references auth.users(id),
  request_type text not null
    check (request_type in ('access', 'export', 'correction', 'deletion', 'portability', 'other')),
  description text,
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create table public.privacy_request_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  privacy_request_id uuid not null,
  event_type text not null
    check (event_type in ('received', 'in_review', 'fulfilled', 'rejected', 'canceled')),
  reason text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, privacy_request_id)
    references public.privacy_requests(organization_id, id) on delete cascade
);

create trigger privacy_request_events_immutable
before update or delete on public.privacy_request_events
for each row execute function private.prevent_financial_mutation();

create table public.member_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  channel text not null check (channel in ('email', 'whatsapp', 'system')),
  purpose text not null,
  template_key text,
  provider_message_id text,
  visible_to_member boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create table public.member_communication_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  communication_id uuid not null,
  event_type text not null
    check (event_type in ('queued', 'sent', 'delivered', 'failed', 'bounced', 'read')),
  provider_event_id text,
  error_code text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, communication_id)
    references public.member_communications(organization_id, id) on delete cascade
);

create trigger member_communication_events_immutable
before update or delete on public.member_communication_events
for each row execute function private.prevent_financial_mutation();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create table public.member_debt_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  agreement_date date not null,
  original_amount numeric(14,2) not null check (original_amount > 0),
  negotiated_amount numeric(14,2) not null check (negotiated_amount > 0),
  installment_count integer not null check (installment_count >= 1),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create trigger member_debt_agreements_immutable
before update or delete on public.member_debt_agreements
for each row execute function private.prevent_financial_mutation();

create table public.member_debt_agreement_items (
  agreement_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  original_charge_id uuid not null,
  included_amount numeric(14,2) not null check (included_amount > 0),
  created_at timestamptz not null default now(),
  primary key (agreement_id, original_charge_id),
  foreign key (organization_id, agreement_id)
    references public.member_debt_agreements(organization_id, id) on delete cascade,
  foreign key (organization_id, original_charge_id)
    references public.charges(organization_id, id)
);

create table public.member_debt_agreement_installments (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  installment_number integer not null check (installment_number >= 1),
  charge_id uuid not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (agreement_id, installment_number),
  unique (organization_id, charge_id),
  foreign key (organization_id, agreement_id)
    references public.member_debt_agreements(organization_id, id) on delete cascade,
  foreign key (organization_id, charge_id)
    references public.charges(organization_id, id)
);

create table public.member_debt_agreement_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agreement_id uuid not null,
  event_type text not null check (event_type in ('created', 'activated', 'completed', 'canceled')),
  reason text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, agreement_id)
    references public.member_debt_agreements(organization_id, id) on delete cascade
);

create trigger member_debt_agreement_events_immutable
before update or delete on public.member_debt_agreement_events
for each row execute function private.prevent_financial_mutation();
