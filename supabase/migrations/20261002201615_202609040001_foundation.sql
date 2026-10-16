-- Corsys Tesouraria
-- Migration 001: foundation
-- PostgreSQL / Supabase

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  number text,
  orient text,
  obedience text,
  cnpj text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create table public.organization_settings (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  pix_key text,
  phone text,
  email text,
  address text,
  report_texts jsonb not null default '{}'::jsonb,
  logo_path text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_settings_set_updated_at
before update on public.organization_settings
for each row execute function private.set_updated_at();

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function private.set_updated_at();

create table public.permissions (
  code text primary key check (length(btrim(code)) > 0),
  description text not null
);

insert into public.permissions (code, description) values
  ('members.read', 'Consultar integrantes'),
  ('members.write', 'Criar e alterar cadastro de integrantes'),
  ('finance.read', 'Consultar dados financeiros'),
  ('charges.create', 'Criar cobranças'),
  ('charges.adjust', 'Criar ajustes de cobrança'),
  ('charges.cancel', 'Cancelar cobranças'),
  ('payments.create', 'Registrar pagamentos'),
  ('payments.reverse', 'Estornar pagamentos'),
  ('credits.manage', 'Gerenciar créditos transferíveis'),
  ('allocations.manage', 'Gerenciar alocações'),
  ('periods.close', 'Fechar competência'),
  ('periods.reopen', 'Reabrir competência'),
  ('reports.read', 'Consultar relatórios'),
  ('reports.export', 'Exportar relatórios'),
  ('audit.read', 'Consultar auditoria'),
  ('settings.manage', 'Gerenciar configurações'),
  ('users.manage', 'Gerenciar usuários e perfis')
on conflict (code) do nothing;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table public.user_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, role_id),
  foreign key (organization_id, role_id)
    references public.roles(organization_id, id) on delete cascade
);

create index user_roles_user_id_idx on public.user_roles(user_id);


create or replace function private.seed_default_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_treasurer uuid;
  v_viewer uuid;
  v_member uuid;
begin
  insert into public.roles(organization_id, code, name, is_system)
  values
    (new.id, 'ADMIN', 'Administrador', true),
    (new.id, 'TREASURER', 'Tesoureiro', true),
    (new.id, 'VIEWER', 'Consulta', true),
    (new.id, 'MEMBER', 'Integrante', true);

  select id into v_admin from public.roles
    where organization_id = new.id and code = 'ADMIN';
  select id into v_treasurer from public.roles
    where organization_id = new.id and code = 'TREASURER';
  select id into v_viewer from public.roles
    where organization_id = new.id and code = 'VIEWER';
  select id into v_member from public.roles
    where organization_id = new.id and code = 'MEMBER';

  insert into public.role_permissions(role_id, permission_code)
  select v_admin, p.code from public.permissions p;

  insert into public.role_permissions(role_id, permission_code)
  select v_treasurer, p.code
  from public.permissions p
  where p.code in (
    'members.read', 'members.write', 'finance.read',
    'charges.create', 'charges.adjust', 'charges.cancel',
    'payments.create', 'payments.reverse',
    'credits.manage', 'allocations.manage',
    'periods.close',
    'reports.read', 'reports.export', 'audit.read'
  );

  insert into public.role_permissions(role_id, permission_code)
  select v_viewer, p.code
  from public.permissions p
  where p.code in ('members.read', 'finance.read', 'reports.read');

  -- MEMBER intentionally receives no broad permissions.
  -- Its future portal access is ownership-scoped by member_user_links + RLS.
  return new;
end;
$$;

create trigger organizations_seed_default_roles
after insert on public.organizations
for each row execute function private.seed_default_roles();


create table public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  preferred_name text,
  degree_or_office text,
  initiation_date date,
  admission_date date,
  cpf text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'away', 'disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index members_org_name_idx on public.members(organization_id, full_name);

create trigger members_set_updated_at
before update on public.members
for each row execute function private.set_updated_at();

create table public.member_user_links (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, member_id),
  unique (organization_id, user_id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id) on delete cascade
);

create index member_user_links_user_id_idx on public.member_user_links(user_id);

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  domain text not null
    check (domain in ('member_receivable', 'institutional_revenue', 'institutional_expense')),
  active boolean not null default true,
  display_order integer not null default 0,
  allow_recurrence boolean not null default false,
  allow_installments boolean not null default false,
  default_behavior jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, domain, name),
  unique (organization_id, id)
);

create trigger financial_categories_set_updated_at
before update on public.financial_categories
for each row execute function private.set_updated_at();

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  institution text,
  account_type text not null
    check (account_type in ('bank', 'pix', 'cash', 'other')),
  identification text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row execute function private.set_updated_at();

create table public.account_opening_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  effective_date date not null,
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id)
);

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create trigger funds_set_updated_at
before update on public.funds
for each row execute function private.set_updated_at();

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  frequency text not null default 'monthly'
    check (frequency in ('monthly', 'annual')),
  due_day smallint not null check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id),
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id)
);

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row execute function private.set_updated_at();

create table public.recurring_rule_versions (
  id uuid primary key default gen_random_uuid(),
  recurring_rule_id uuid not null references public.recurring_rules(id) on delete cascade,
  valid_from_competence date not null
    check (extract(day from valid_from_competence) = 1),
  valid_to_competence date
    check (valid_to_competence is null or extract(day from valid_to_competence) = 1),
  unit_amount numeric(14,2) not null check (unit_amount > 0),
  created_at timestamptz not null default now(),
  check (valid_to_competence is null or valid_to_competence >= valid_from_competence),
  unique (recurring_rule_id, valid_from_competence)
);

alter table public.recurring_rule_versions
  add constraint recurring_rule_versions_no_overlap
  exclude using gist (
    recurring_rule_id with =,
    daterange(
      valid_from_competence,
      coalesce((valid_to_competence + interval '1 month')::date, 'infinity'::date),
      '[)'
    ) with &&
  );

create table public.recurring_rule_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recurring_rule_id uuid not null,
  member_id uuid not null,
  effective_from date not null check (extract(day from effective_from) = 1),
  effective_to date check (effective_to is null or extract(day from effective_to) = 1),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (recurring_rule_id, member_id, effective_from),
  foreign key (organization_id, recurring_rule_id)
    references public.recurring_rules(organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);


alter table public.recurring_rule_members
  add constraint recurring_rule_members_no_overlap
  exclude using gist (
    recurring_rule_id with =,
    member_id with =,
    daterange(
      effective_from,
      coalesce((effective_to + interval '1 month')::date, 'infinity'::date),
      '[)'
    ) with &&
  );

create table public.recurring_rule_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recurring_rule_id uuid not null,
  member_id uuid not null,
  competence date not null check (extract(day from competence) = 1),
  exception_type text not null
    check (exception_type in ('exempt', 'override_amount', 'discount_amount')),
  amount numeric(14,2),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (recurring_rule_id, member_id, competence),
  check (
    (exception_type = 'exempt' and amount is null)
    or
    (exception_type in ('override_amount', 'discount_amount') and amount is not null and amount >= 0)
  ),
  foreign key (organization_id, recurring_rule_id)
    references public.recurring_rules(organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  event_type text not null check (length(btrim(event_type)) > 0),
  event_date date not null,
  default_amount numeric(14,2) check (default_amount is null or default_amount >= 0),
  description text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  created_at timestamptz not null default now(),
  unique (organization_id, period),
  unique (organization_id, id)
);

create table public.period_events (
  id uuid primary key default gen_random_uuid(),
  event_seq bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_period_id uuid not null,
  event_type text not null check (event_type in ('close', 'reopen')),
  reason text not null check (length(btrim(reason)) > 0),
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, financial_period_id)
    references public.financial_periods(organization_id, id)
);

create index period_events_period_seq_idx
  on public.period_events(financial_period_id, event_seq desc);

create or replace function private.is_period_closed(
  p_organization_id uuid,
  p_period date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pe.event_type = 'close'
    from public.financial_periods fp
    join public.period_events pe on pe.financial_period_id = fp.id
    where fp.organization_id = p_organization_id
      and fp.period = p_period
    order by pe.event_seq desc
    limit 1
  ), false);
$$;

revoke all on function private.is_period_closed(uuid, date) from public;
