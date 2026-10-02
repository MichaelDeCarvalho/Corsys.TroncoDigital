-- Corsys Tronco Digital
-- Migration 015: V34 onboarding, plan/promotion publishing, support SLA and billing presentation.
-- Prepared for Supabase/PostgreSQL. NOT executed in this environment.

-- ============================================================
-- 1. Onboarding run with resumable steps
-- ============================================================

create table public.saas_onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft','provisioning','awaiting_invite','completed','failed','canceled')),
  current_step text not null default 'commercial'
    check (current_step in ('commercial','plan','tenant','accounting','invite','completed')),
  organization_id uuid references public.organizations(id) on delete set null,
  prospective_name text,
  organization_number text,
  tax_id text,
  city text,
  state_code text,
  admin_name text,
  admin_email text,
  billing_email text,
  phone text,
  plan_version_id uuid references public.saas_plan_versions(id),
  contract_price numeric(14,2) check (contract_price is null or contract_price >= 0),
  subscription_start date,
  trial_days integer check (trial_days is null or trial_days >= 0),
  tenant_slug text,
  initial_role text check (initial_role is null or initial_role in ('ADMIN','TREASURER')),
  initial_accounting_plan_mode text
    check (initial_accounting_plan_mode is null or initial_accounting_plan_mode in ('corsys_default','blank')),
  invite_email text,
  terms_acceptance_required boolean not null default true,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error_code text,
  unique (idempotency_key)
);

create trigger saas_onboarding_runs_set_updated_at
before update on public.saas_onboarding_runs
for each row execute function private.set_updated_at();

create table public.saas_onboarding_step_events (
  id bigint generated always as identity primary key,
  onboarding_run_id uuid not null references public.saas_onboarding_runs(id) on delete cascade,
  step text not null check (step in ('commercial','plan','tenant','accounting','invite','completed')),
  event_type text not null check (event_type in ('saved','started','completed','failed','resumed','canceled')),
  sanitized_summary jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create trigger saas_onboarding_step_events_immutable
before update or delete on public.saas_onboarding_step_events
for each row execute function private.prevent_financial_mutation();

-- invite_user becomes a supported async job. Auth invite is server-side, not a browser secret.
alter table public.saas_jobs
  drop constraint if exists saas_jobs_job_type_check;

alter table public.saas_jobs
  add constraint saas_jobs_job_type_check
  check (job_type in (
    'generate_invoice','send_collection','apply_late_charges',
    'evaluate_dunning','apply_subscription_change',
    'tenant_export','fiscal_document','webhook_retry',
    'onboarding_invite'
  ));


create or replace function public.save_saas_onboarding_draft(
  p_run_id uuid,
  p_idempotency_key text,
  p_current_step text,
  p_prospective_name text,
  p_organization_number text,
  p_tax_id text,
  p_city text,
  p_state_code text,
  p_admin_name text,
  p_admin_email text,
  p_billing_email text,
  p_phone text,
  p_plan_version_id uuid,
  p_contract_price numeric,
  p_subscription_start date,
  p_trial_days integer,
  p_tenant_slug text,
  p_initial_role text,
  p_initial_accounting_plan_mode text,
  p_invite_email text,
  p_terms_acceptance_required boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_plan_valid_from date;
  v_plan_status text;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_idempotency_key))=0 then
    raise exception 'idempotency key required' using errcode='22023';
  end if;

  if p_plan_version_id is not null then
    select v.valid_from,v.status into v_plan_valid_from,v_plan_status
    from public.saas_plan_versions v where v.id=p_plan_version_id;
    if v_plan_status is distinct from 'published' then
      raise exception 'onboarding requires a published plan version' using errcode='23514';
    end if;
    if p_subscription_start is not null and p_subscription_start<v_plan_valid_from then
      raise exception 'subscription cannot start before plan version validity' using errcode='23514';
    end if;
  end if;

  if p_run_id is null then
    insert into public.saas_onboarding_runs(
      status,current_step,prospective_name,organization_number,tax_id,city,state_code,
      admin_name,admin_email,billing_email,phone,plan_version_id,contract_price,
      subscription_start,trial_days,tenant_slug,initial_role,initial_accounting_plan_mode,
      invite_email,terms_acceptance_required,idempotency_key,created_by
    ) values (
      'draft',p_current_step,p_prospective_name,p_organization_number,p_tax_id,p_city,p_state_code,
      p_admin_name,p_admin_email,p_billing_email,p_phone,p_plan_version_id,p_contract_price,
      p_subscription_start,p_trial_days,p_tenant_slug,p_initial_role,p_initial_accounting_plan_mode,
      p_invite_email,coalesce(p_terms_acceptance_required,true),p_idempotency_key,(select auth.uid())
    )
    on conflict (idempotency_key) do update
      set updated_at=now()
    returning id into v_id;
  else
    update public.saas_onboarding_runs
    set current_step=p_current_step,
        prospective_name=p_prospective_name,
        organization_number=p_organization_number,
        tax_id=p_tax_id,
        city=p_city,
        state_code=p_state_code,
        admin_name=p_admin_name,
        admin_email=p_admin_email,
        billing_email=p_billing_email,
        phone=p_phone,
        plan_version_id=p_plan_version_id,
        contract_price=p_contract_price,
        subscription_start=p_subscription_start,
        trial_days=p_trial_days,
        tenant_slug=p_tenant_slug,
        initial_role=p_initial_role,
        initial_accounting_plan_mode=p_initial_accounting_plan_mode,
        invite_email=p_invite_email,
        terms_acceptance_required=coalesce(p_terms_acceptance_required,true)
    where id=p_run_id and status='draft'
    returning id into v_id;

    if v_id is null then
      raise exception 'editable onboarding draft not found' using errcode='23503';
    end if;
  end if;

  insert into public.saas_onboarding_step_events(
    onboarding_run_id,step,event_type,sanitized_summary,actor_user_id
  ) values (
    v_id,p_current_step,'saved',
    jsonb_build_object(
      'has_name',p_prospective_name is not null,
      'has_plan',p_plan_version_id is not null,
      'has_invite',p_invite_email is not null
    ),
    (select auth.uid())
  );

  return v_id;
end;
$$;

create or replace function public.provision_saas_onboarding_database(
  p_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.saas_onboarding_runs%rowtype;
  v_org uuid;
  v_plan uuid;
  v_version public.saas_plan_versions%rowtype;
  v_subscription uuid;
  v_status text;
  v_price numeric;
  v_period_end date;
begin
  perform private.require_platform_staff('MASTER');

  select * into v_run
  from public.saas_onboarding_runs
  where id=p_run_id
  for update;

  if v_run.id is null then
    raise exception 'onboarding run not found' using errcode='23503';
  end if;

  if v_run.organization_id is not null then
    return v_run.organization_id;
  end if;

  if v_run.prospective_name is null
     or v_run.organization_number is null
     or v_run.admin_email is null
     or v_run.plan_version_id is null
     or v_run.subscription_start is null
     or v_run.tenant_slug is null
     or v_run.invite_email is null then
    raise exception 'onboarding is incomplete' using errcode='23514';
  end if;

  select * into v_version
  from public.saas_plan_versions
  where id=v_run.plan_version_id and status='published';

  if v_version.id is null then
    raise exception 'published plan version not found' using errcode='23503';
  end if;

  v_plan:=v_version.plan_id;
  v_status:=case when coalesce(v_run.trial_days,0)>0 then 'trialing' else 'active' end;
  v_price:=coalesce(v_run.contract_price,v_version.price);

  insert into public.organizations(name,number,cnpj,status)
  values (v_run.prospective_name,v_run.organization_number,v_run.tax_id,'active')
  returning id into v_org;

  insert into public.organization_settings(
    organization_id,phone,email,city,state_code
  ) values (
    v_org,v_run.phone,v_run.admin_email,v_run.city,v_run.state_code
  );

  insert into public.saas_tenant_accounts(
    organization_id,billing_name,billing_email,billing_phone,tax_id,
    commercial_status,billing_provider,customer_since
  ) values (
    v_org,v_run.prospective_name,v_run.billing_email,v_run.phone,v_run.tax_id,
    v_status,'manual',v_run.subscription_start
  );

  v_period_end:=case
    when v_version.billing_interval='yearly'
      then (v_run.subscription_start + interval '1 year - 1 day')::date
    else (v_run.subscription_start + interval '1 month - 1 day')::date
  end;

  insert into public.saas_subscriptions(
    organization_id,plan_id,plan_version_id,status,started_at,
    current_period_start,current_period_end,billing_anchor_day,
    billing_provider
  ) values (
    v_org,v_plan,v_run.plan_version_id,v_status,v_run.subscription_start::timestamptz,
    v_run.subscription_start,v_period_end,
    least(extract(day from v_run.subscription_start)::integer,28),
    'manual'
  ) returning id into v_subscription;

  insert into public.saas_subscription_price_terms(
    organization_id,subscription_id,effective_from,unit_price,currency,
    adjustment_reason,created_by
  ) values (
    v_org,v_subscription,v_run.subscription_start,v_price,'BRL',
    'initial_contract',(select auth.uid())
  );

  update public.saas_onboarding_runs
  set status='awaiting_invite',
      current_step='invite',
      organization_id=v_org
  where id=p_run_id;

  insert into public.saas_onboarding_step_events(
    onboarding_run_id,step,event_type,sanitized_summary,actor_user_id
  ) values (
    p_run_id,'tenant','completed',
    jsonb_build_object('organization_id',v_org,'subscription_id',v_subscription),
    (select auth.uid())
  );

  insert into public.saas_jobs(
    organization_id,job_type,status,run_at,idempotency_key,correlation_id,
    sanitized_payload
  ) values (
    v_org,'onboarding_invite','queued',now(),
    'onboarding-invite:'||p_run_id::text,p_run_id::text,
    jsonb_build_object('onboarding_run_id',p_run_id)
  )
  on conflict (job_type,idempotency_key) do nothing;

  return v_org;
end;
$$;

-- ============================================================
-- 2. Plan publishing commands
-- ============================================================

create or replace function private.replace_plan_version_entitlements(
  p_plan_version_id uuid,
  p_entitlements jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if jsonb_typeof(coalesce(p_entitlements,'{}'::jsonb)) <> 'object' then
    raise exception 'entitlements must be a JSON object' using errcode='22023';
  end if;

  delete from public.saas_plan_version_entitlements
  where plan_version_id=p_plan_version_id;

  for v_key,v_value in
    select key,value from jsonb_each(coalesce(p_entitlements,'{}'::jsonb))
  loop
    insert into public.saas_plan_version_entitlements(
      plan_version_id,entitlement_key,entitlement_value
    ) values (p_plan_version_id,v_key,v_value);
  end loop;
end;
$$;

revoke all on function private.replace_plan_version_entitlements(uuid,jsonb) from public;

create or replace function public.create_saas_plan_draft(
  p_code text,
  p_name text,
  p_price numeric,
  p_billing_interval text,
  p_trial_days integer,
  p_grace_days integer,
  p_valid_from date,
  p_entitlements jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
  v_version uuid;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_code))=0 or length(btrim(p_name))=0 then
    raise exception 'plan code/name required' using errcode='22023';
  end if;
  if p_price<0 or p_trial_days<0 or p_grace_days<0 or p_valid_from is null then
    raise exception 'invalid plan version fields' using errcode='22023';
  end if;

  insert into public.saas_plans(
    code,name,billing_interval,price,currency,trial_days,grace_days,active
  ) values (
    lower(btrim(p_code)),btrim(p_name),p_billing_interval,p_price,'BRL',p_trial_days,p_grace_days,true
  )
  returning id into v_plan;

  insert into public.saas_plan_versions(
    plan_id,version_number,status,price,currency,billing_interval,
    trial_days,grace_days,valid_from,created_by
  ) values (
    v_plan,1,'draft',p_price,'BRL',p_billing_interval,
    p_trial_days,p_grace_days,p_valid_from,(select auth.uid())
  )
  returning id into v_version;

  perform private.replace_plan_version_entitlements(v_version,p_entitlements);

  return v_version;
end;
$$;

create or replace function public.update_saas_plan_version_draft(
  p_plan_version_id uuid,
  p_name text,
  p_code text,
  p_price numeric,
  p_billing_interval text,
  p_trial_days integer,
  p_grace_days integer,
  p_valid_from date,
  p_entitlements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_has_published boolean;
begin
  perform private.require_platform_staff('MASTER');

  select v.plan_id into v_plan_id
  from public.saas_plan_versions v
  where v.id=p_plan_version_id and v.status='draft'
  for update;

  if v_plan_id is null then
    raise exception 'draft plan version not found' using errcode='23503';
  end if;

  select exists(
    select 1 from public.saas_plan_versions x
    where x.plan_id=v_plan_id and x.status='published'
  ) into v_has_published;

  if not v_has_published then
    update public.saas_plans
    set name=btrim(p_name), code=lower(btrim(p_code))
    where id=v_plan_id;
  end if;

  update public.saas_plan_versions
  set price=p_price,billing_interval=p_billing_interval,
      trial_days=p_trial_days,grace_days=p_grace_days,valid_from=p_valid_from
  where id=p_plan_version_id;

  perform private.replace_plan_version_entitlements(p_plan_version_id,p_entitlements);
  return p_plan_version_id;
end;
$$;

create or replace function public.create_saas_plan_successor_draft(
  p_plan_id uuid,
  p_price numeric,
  p_billing_interval text,
  p_trial_days integer,
  p_grace_days integer,
  p_valid_from date,
  p_entitlements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_version uuid;
begin
  perform private.require_platform_staff('MASTER');
  perform 1 from public.saas_plans p where p.id=p_plan_id for update;
  if not found then raise exception 'plan not found' using errcode='23503'; end if;

  select coalesce(max(version_number),0)+1 into v_next
  from public.saas_plan_versions where plan_id=p_plan_id;

  insert into public.saas_plan_versions(
    plan_id,version_number,status,price,currency,billing_interval,
    trial_days,grace_days,valid_from,created_by
  ) values (
    p_plan_id,v_next,'draft',p_price,'BRL',p_billing_interval,
    p_trial_days,p_grace_days,p_valid_from,(select auth.uid())
  ) returning id into v_version;

  perform private.replace_plan_version_entitlements(v_version,p_entitlements);
  return v_version;
end;
$$;

create or replace function public.publish_saas_plan_version(
  p_plan_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  perform private.require_platform_staff('MASTER');

  select plan_id into v_plan
  from public.saas_plan_versions
  where id=p_plan_version_id and status='draft'
  for update;

  if v_plan is null then
    raise exception 'draft plan version not found' using errcode='23503';
  end if;

  update public.saas_plan_versions
  set status='published',published_by=(select auth.uid()),published_at=now()
  where id=p_plan_version_id;

  return p_plan_version_id;
end;
$$;

-- ============================================================
-- 3. Promotion version identity and controlled successor model
-- ============================================================

alter table public.saas_promotions
  add column if not exists promotion_series_id uuid,
  add column if not exists version_number integer not null default 1 check (version_number>=1);

update public.saas_promotions
set promotion_series_id=gen_random_uuid()
where promotion_series_id is null;

alter table public.saas_promotions
  alter column promotion_series_id set not null;

drop index if exists public.saas_promotions_public_code_uidx;

create unique index saas_promotions_series_version_uidx
on public.saas_promotions(promotion_series_id,version_number);

create unique index saas_promotions_code_start_uidx
on public.saas_promotions(lower(public_code),valid_from)
where public_code is not null;

alter table public.saas_promotions
  add constraint saas_promotions_published_code_no_overlap
  exclude using gist (
    (lower(public_code)) with =,
    tstzrange(valid_from,coalesce(valid_to,'infinity'::timestamptz),'[)') with &&
  )
  where (status='published' and public_code is not null);

create or replace function private.guard_published_saas_promotion_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status='published' then
    if new.name is distinct from old.name
       or new.public_code is distinct from old.public_code
       or new.benefit_type is distinct from old.benefit_type
       or new.benefit_value is distinct from old.benefit_value
       or new.duration_type is distinct from old.duration_type
       or new.duration_cycles is distinct from old.duration_cycles
       or new.eligibility_scope is distinct from old.eligibility_scope
       or new.max_redemptions is distinct from old.max_redemptions
       or new.stackable is distinct from old.stackable
       or new.valid_from is distinct from old.valid_from
    then
      raise exception 'published promotion economic terms are immutable; create successor'
        using errcode='55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger saas_promotions_published_terms_guard
before update on public.saas_promotions
for each row execute function private.guard_published_saas_promotion_terms();

create or replace function public.create_saas_promotion_successor_draft(
  p_promotion_id uuid,
  p_name text,
  p_public_code text,
  p_benefit_type text,
  p_benefit_value numeric,
  p_duration_type text,
  p_duration_cycles integer,
  p_valid_from timestamptz,
  p_valid_to timestamptz,
  p_eligibility_scope text,
  p_max_redemptions integer,
  p_stackable boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series uuid;
  v_next integer;
  v_new uuid;
begin
  perform private.require_platform_staff('MASTER');

  select promotion_series_id into v_series
  from public.saas_promotions where id=p_promotion_id
  for update;

  if v_series is null then raise exception 'promotion not found' using errcode='23503'; end if;

  select coalesce(max(version_number),0)+1 into v_next
  from public.saas_promotions where promotion_series_id=v_series;

  insert into public.saas_promotions(
    promotion_series_id,version_number,name,public_code,status,
    benefit_type,benefit_value,duration_type,duration_cycles,
    valid_from,valid_to,eligibility_scope,max_redemptions,stackable,created_by
  ) values (
    v_series,v_next,p_name,p_public_code,'draft',
    p_benefit_type,p_benefit_value,p_duration_type,p_duration_cycles,
    p_valid_from,p_valid_to,p_eligibility_scope,p_max_redemptions,p_stackable,(select auth.uid())
  ) returning id into v_new;

  return v_new;
end;
$$;

create or replace function public.publish_saas_promotion_version(
  p_promotion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series uuid;
  v_start timestamptz;
begin
  perform private.require_platform_staff('MASTER');

  select promotion_series_id,valid_from into v_series,v_start
  from public.saas_promotions
  where id=p_promotion_id and status='draft'
  for update;

  if v_series is null then
    raise exception 'draft promotion not found' using errcode='23503';
  end if;

  -- Close the previous effective version at the successor boundary.
  update public.saas_promotions
  set valid_to=v_start
  where promotion_series_id=v_series
    and status='published'
    and valid_from<v_start
    and (valid_to is null or valid_to>v_start);

  update public.saas_promotions
  set status='published',published_by=(select auth.uid()),published_at=now()
  where id=p_promotion_id;

  return p_promotion_id;
end;
$$;

-- ============================================================
-- 4. Support timing, internal tickets and tenant-safe visibility
-- ============================================================

alter table public.saas_support_tickets
  add column if not exists ticket_scope text not null default 'tenant'
    check (ticket_scope in ('tenant','internal')),
  add column if not exists related_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists opened_by_display text;

-- Internal Corsys tickets have no tenant ownership. related_organization_id is optional context only.
alter table public.saas_support_tickets alter column organization_id drop not null;
alter table public.saas_support_ticket_messages alter column organization_id drop not null;
alter table public.saas_support_ticket_events alter column organization_id drop not null;

alter table public.saas_support_ticket_messages
  add constraint saas_support_ticket_messages_ticket_fk
  foreign key (ticket_id) references public.saas_support_tickets(id) on delete cascade;

alter table public.saas_support_ticket_events
  add constraint saas_support_ticket_events_ticket_fk
  foreign key (ticket_id) references public.saas_support_tickets(id) on delete cascade;

create or replace function private.populate_support_ticket_opened_by_display()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opened_by_display is null then
    select coalesce(p.display_name,'Usuário')
      into new.opened_by_display
    from public.user_profiles p
    where p.user_id=new.opened_by_user_id;
    new.opened_by_display := coalesce(new.opened_by_display,'Usuário');
  end if;
  return new;
end;
$$;

create trigger saas_support_tickets_opened_by_display
before insert or update on public.saas_support_tickets
for each row execute function private.populate_support_ticket_opened_by_display();

update public.saas_support_tickets t
set opened_by_display=coalesce(
  (select p.display_name from public.user_profiles p where p.user_id=t.opened_by_user_id),
  'Usuário'
)
where opened_by_display is null;

-- Existing rows are tenant tickets.
update public.saas_support_tickets set ticket_scope='tenant' where ticket_scope is null;

create or replace view public.v_saas_support_ticket_metrics
with (security_invoker = true)
as
with first_staff_response as (
  select distinct on (m.ticket_id)
    m.ticket_id,m.created_at as first_response_at,m.sender_user_id as first_response_by
  from public.saas_support_ticket_messages m
  where m.sender_kind='platform_staff' and m.visibility='customer'
  order by m.ticket_id,m.created_at
)
select
  t.id,t.ticket_seq,t.organization_id,t.ticket_scope,t.related_organization_id,
  t.subject,t.category,t.priority,t.status,t.opened_by_user_id,t.assigned_staff_user_id,
  t.opened_at,t.updated_at,t.resolved_at,t.closed_at,
  coalesce(t.opened_by_display,'Usuário') as opened_by_display,
  fs.first_response_at,
  extract(epoch from (coalesce(t.resolved_at,t.closed_at,now())-t.opened_at))::bigint as elapsed_seconds,
  case when fs.first_response_at is null then null
       else extract(epoch from (fs.first_response_at-t.opened_at))::bigint end as first_response_seconds,
  case when t.resolved_at is null then null
       else extract(epoch from (t.resolved_at-t.opened_at))::bigint end as resolution_seconds
from public.saas_support_tickets t
left join first_staff_response fs on fs.ticket_id=t.id;

drop policy if exists saas_support_tickets_select on public.saas_support_tickets;
create policy saas_support_tickets_select
on public.saas_support_tickets for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or (
    ticket_scope='tenant'
    and organization_id is not null
    and private.is_tenant_user(organization_id)
  )
);

drop policy if exists saas_support_ticket_messages_select on public.saas_support_ticket_messages;
create policy saas_support_ticket_messages_select
on public.saas_support_ticket_messages for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or (
    visibility='customer'
    and exists (
      select 1 from public.saas_support_tickets t
      where t.id=saas_support_ticket_messages.ticket_id
        and t.ticket_scope='tenant'
        and t.organization_id=saas_support_ticket_messages.organization_id
        and private.is_tenant_user(t.organization_id)
    )
  )
);

drop policy if exists saas_support_ticket_events_select on public.saas_support_ticket_events;
create policy saas_support_ticket_events_select
on public.saas_support_ticket_events for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('SUPPORT')
  or (
    visibility='customer'
    and exists (
      select 1 from public.saas_support_tickets t
      where t.id=saas_support_ticket_events.ticket_id
        and t.ticket_scope='tenant'
        and t.organization_id=saas_support_ticket_events.organization_id
        and private.is_tenant_user(t.organization_id)
    )
  )
);

grant select on public.v_saas_support_ticket_metrics to authenticated;

create or replace function public.create_saas_internal_ticket(
  p_related_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text,
  p_assigned_staff_user_id uuid default null
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
  perform private.require_platform_staff(null);

  if length(btrim(p_subject))=0 or length(btrim(p_message))=0 then
    raise exception 'subject/message required' using errcode='22023';
  end if;

  if p_related_organization_id is not null
     and not exists (select 1 from public.organizations o where o.id=p_related_organization_id) then
    raise exception 'related organization not found' using errcode='23503';
  end if;

  insert into public.saas_support_tickets(
    organization_id,ticket_scope,related_organization_id,subject,category,priority,
    status,opened_by_user_id,assigned_staff_user_id
  ) values (
    null,'internal',p_related_organization_id,p_subject,
    case when p_category in ('finance','reports','access','configuration','billing','other') then p_category else 'other' end,
    p_priority,'new',v_user,p_assigned_staff_user_id
  ) returning id into v_ticket;

  insert into public.saas_support_ticket_messages(
    organization_id,ticket_id,sender_user_id,sender_kind,visibility,body
  ) values (
    null,v_ticket,v_user,'platform_staff','internal_note',p_message
  );

  insert into public.saas_support_ticket_events(
    organization_id,ticket_id,from_status,to_status,visibility,reason,actor_user_id
  ) values (
    null,v_ticket,null,'new','internal','internal_ticket_created',v_user
  );

  return v_ticket;
end;
$$;

-- ============================================================
-- 5. Billing breakdown for UI/reporting
-- ============================================================

create or replace view public.v_saas_invoice_charge_breakdown
with (security_invoker = true)
as
select
  i.organization_id,
  i.id as invoice_id,
  i.invoice_number,
  i.amount_due::numeric(14,2) as base_amount,
  coalesce(sum(a.signed_amount) filter (where a.adjustment_type='late_fee'),0)::numeric(14,2) as late_fee_amount,
  coalesce(sum(a.signed_amount) filter (where a.adjustment_type='interest'),0)::numeric(14,2) as interest_amount,
  coalesce(sum(a.signed_amount) filter (where a.adjustment_type in ('promotion_discount','agreement_discount','credit','manual_decrease')),0)::numeric(14,2) as discount_credit_amount,
  coalesce(sum(a.signed_amount) filter (where a.adjustment_type='manual_increase'),0)::numeric(14,2) as other_increase_amount,
  coalesce(sum(a.signed_amount),0)::numeric(14,2) as net_adjustments,
  (i.amount_due+coalesce(sum(a.signed_amount),0))::numeric(14,2) as updated_total
from public.saas_invoices i
left join public.saas_invoice_adjustments a
  on a.organization_id=i.organization_id and a.invoice_id=i.id
group by i.organization_id,i.id,i.invoice_number,i.amount_due;

grant select on public.v_saas_invoice_charge_breakdown to authenticated;

-- ============================================================
-- 6. RLS/grants for onboarding (Master/Billing read only)
-- ============================================================

revoke all on public.saas_onboarding_runs,public.saas_onboarding_step_events
from anon,authenticated;

alter table public.saas_onboarding_runs enable row level security;
alter table public.saas_onboarding_step_events enable row level security;

grant select on public.saas_onboarding_runs,public.saas_onboarding_step_events
to authenticated;

create policy saas_onboarding_runs_platform_select
on public.saas_onboarding_runs for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create policy saas_onboarding_step_events_platform_select
on public.saas_onboarding_step_events for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

-- Controlled command execution.
revoke all on function public.save_saas_onboarding_draft(uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,numeric,date,integer,text,text,text,text,boolean) from public;
revoke all on function public.provision_saas_onboarding_database(uuid) from public;
grant execute on function public.save_saas_onboarding_draft(uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,numeric,date,integer,text,text,text,text,boolean) to authenticated;
grant execute on function public.provision_saas_onboarding_database(uuid) to authenticated;
revoke all on function public.create_saas_plan_draft(text,text,numeric,text,integer,integer,date,jsonb) from public;
revoke all on function public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb) from public;
revoke all on function public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb) from public;
revoke all on function public.publish_saas_plan_version(uuid) from public;
revoke all on function public.create_saas_promotion_successor_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) from public;
revoke all on function public.publish_saas_promotion_version(uuid) from public;
revoke all on function public.create_saas_internal_ticket(uuid,text,text,text,text,uuid) from public;

grant execute on function public.create_saas_plan_draft(text,text,numeric,text,integer,integer,date,jsonb) to authenticated;
grant execute on function public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb) to authenticated;
grant execute on function public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb) to authenticated;
grant execute on function public.publish_saas_plan_version(uuid) to authenticated;
grant execute on function public.create_saas_promotion_successor_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) to authenticated;
grant execute on function public.publish_saas_promotion_version(uuid) to authenticated;
grant execute on function public.create_saas_internal_ticket(uuid,text,text,text,text,uuid) to authenticated;
