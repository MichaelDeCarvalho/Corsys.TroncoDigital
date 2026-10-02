-- Corsys Tronco Digital
-- Migration 016: V35 safe lifecycle for SaaS plans/promotions and admin history.
-- Prepared for Supabase/PostgreSQL. NOT executed in this environment.

-- ============================================================
-- 1. Version-level snapshots for plan name/code
-- ============================================================

alter table public.saas_plan_versions
  add column if not exists display_name_snapshot text,
  add column if not exists internal_code_snapshot text;

update public.saas_plan_versions v
set
  display_name_snapshot = p.name,
  internal_code_snapshot = p.code
from public.saas_plans p
where p.id = v.plan_id
  and (v.display_name_snapshot is null or v.internal_code_snapshot is null);

alter table public.saas_plan_versions
  alter column display_name_snapshot set not null,
  alter column internal_code_snapshot set not null;

alter table public.saas_plan_versions
  add constraint saas_plan_versions_display_name_nonblank
    check (length(btrim(display_name_snapshot)) > 0),
  add constraint saas_plan_versions_internal_code_nonblank
    check (length(btrim(internal_code_snapshot)) > 0);

create index if not exists saas_plan_versions_admin_history_idx
on public.saas_plan_versions(plan_id, status, valid_from desc, version_number desc);

-- Draft editing always edits the draft snapshot. The catalog row is only changed
-- immediately when the plan has never been published; otherwise the catalog
-- identity changes only when the successor version is explicitly published.
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
  v_code text := lower(btrim(p_code));
  v_name text := btrim(p_name);
begin
  perform private.require_platform_staff('MASTER');

  if length(v_code)=0 or length(v_name)=0 then
    raise exception 'plan code/name required' using errcode='22023';
  end if;

  if p_price<0 or p_trial_days<0 or p_grace_days<0 or p_valid_from is null then
    raise exception 'invalid plan version fields' using errcode='22023';
  end if;

  insert into public.saas_plans(
    code,name,billing_interval,price,currency,trial_days,grace_days,active
  ) values (
    v_code,v_name,p_billing_interval,p_price,'BRL',p_trial_days,p_grace_days,true
  )
  returning id into v_plan;

  insert into public.saas_plan_versions(
    plan_id,version_number,status,display_name_snapshot,internal_code_snapshot,
    price,currency,billing_interval,trial_days,grace_days,valid_from,created_by
  ) values (
    v_plan,1,'draft',v_name,v_code,
    p_price,'BRL',p_billing_interval,p_trial_days,p_grace_days,p_valid_from,(select auth.uid())
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
  v_name text := btrim(p_name);
  v_code text := lower(btrim(p_code));
begin
  perform private.require_platform_staff('MASTER');

  select v.plan_id into v_plan_id
  from public.saas_plan_versions v
  where v.id=p_plan_version_id and v.status='draft'
  for update;

  if v_plan_id is null then
    raise exception 'draft plan version not found' using errcode='23503';
  end if;

  if length(v_name)=0 or length(v_code)=0 then
    raise exception 'plan code/name required' using errcode='22023';
  end if;

  if p_price<0 or p_trial_days<0 or p_grace_days<0 or p_valid_from is null then
    raise exception 'invalid plan version fields' using errcode='22023';
  end if;

  if exists (
    select 1 from public.saas_plans p
    where p.code=v_code and p.id<>v_plan_id
  ) or exists (
    select 1
    from public.saas_plan_versions v
    where v.status='draft'
      and v.plan_id<>v_plan_id
      and v.internal_code_snapshot=v_code
  ) then
    raise exception 'plan internal code already in use' using errcode='23505';
  end if;

  select exists(
    select 1 from public.saas_plan_versions x
    where x.plan_id=v_plan_id and x.status='published'
  ) into v_has_published;

  update public.saas_plan_versions
  set
    display_name_snapshot=v_name,
    internal_code_snapshot=v_code,
    price=p_price,
    billing_interval=p_billing_interval,
    trial_days=p_trial_days,
    grace_days=p_grace_days,
    valid_from=p_valid_from
  where id=p_plan_version_id;

  if not v_has_published then
    update public.saas_plans
    set
      name=v_name,
      code=v_code,
      billing_interval=p_billing_interval,
      price=p_price,
      trial_days=p_trial_days,
      grace_days=p_grace_days
    where id=v_plan_id;
  end if;

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
  v_name text;
  v_code text;
begin
  perform private.require_platform_staff('MASTER');

  select p.name,p.code into v_name,v_code
  from public.saas_plans p
  where p.id=p_plan_id
  for update;

  if v_name is null then
    raise exception 'plan not found' using errcode='23503';
  end if;

  select coalesce(max(version_number),0)+1 into v_next
  from public.saas_plan_versions
  where plan_id=p_plan_id;

  insert into public.saas_plan_versions(
    plan_id,version_number,status,display_name_snapshot,internal_code_snapshot,
    price,currency,billing_interval,trial_days,grace_days,valid_from,created_by
  ) values (
    p_plan_id,v_next,'draft',v_name,v_code,
    p_price,'BRL',p_billing_interval,p_trial_days,p_grace_days,p_valid_from,(select auth.uid())
  )
  returning id into v_version;

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
  v_name text;
  v_code text;
begin
  perform private.require_platform_staff('MASTER');

  select plan_id,display_name_snapshot,internal_code_snapshot
  into v_plan,v_name,v_code
  from public.saas_plan_versions
  where id=p_plan_version_id and status='draft'
  for update;

  if v_plan is null then
    raise exception 'draft plan version not found' using errcode='23503';
  end if;

  if exists (
    select 1 from public.saas_plans p
    where p.code=v_code and p.id<>v_plan
  ) then
    raise exception 'plan internal code already in use' using errcode='23505';
  end if;

  update public.saas_plan_versions
  set status='published',published_by=(select auth.uid()),published_at=now()
  where id=p_plan_version_id;

  -- Current catalog identity follows the explicitly published successor.
  -- Historical views must use the version snapshots.
  update public.saas_plans
  set name=v_name,code=v_code
  where id=v_plan;

  insert into public.saas_master_audit_logs(
    staff_user_id,action,resource_type,resource_id,metadata
  ) values (
    (select auth.uid()),
    'saas_plan_version.publish',
    'saas_plan_version',
    p_plan_version_id::text,
    jsonb_build_object('plan_id',v_plan,'name',v_name,'code',v_code)
  );

  return p_plan_version_id;
end;
$$;

-- ============================================================
-- 2. Safe activation/deactivation/deletion of plans
-- ============================================================

create or replace function private.saas_plan_delete_block_reason(p_plan_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.saas_plan_versions v
    where v.plan_id=p_plan_id and v.status='published'
  ) then
    return 'published_version_exists';
  end if;

  if exists (
    select 1 from public.saas_subscriptions s
    where s.plan_id=p_plan_id
  ) then
    return 'subscription_exists';
  end if;

  if exists (
    select 1
    from public.saas_onboarding_runs o
    join public.saas_plan_versions v on v.id=o.plan_version_id
    where v.plan_id=p_plan_id
  ) then
    return 'onboarding_link_exists';
  end if;

  if exists (
    select 1
    from public.saas_promotion_plan_versions pp
    join public.saas_plan_versions v on v.id=pp.plan_version_id
    where v.plan_id=p_plan_id
  ) then
    return 'promotion_link_exists';
  end if;

  if exists (
    select 1
    from public.saas_scheduled_subscription_changes c
    join public.saas_plan_versions v on v.id=c.target_plan_version_id
    where v.plan_id=p_plan_id
  ) then
    return 'scheduled_change_exists';
  end if;

  return null;
end;
$$;

revoke all on function private.saas_plan_delete_block_reason(uuid) from public;

create or replace function public.set_saas_plan_active(
  p_plan_id uuid,
  p_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old boolean;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_reason))=0 then
    raise exception 'reason is required' using errcode='22023';
  end if;

  select active into v_old
  from public.saas_plans
  where id=p_plan_id
  for update;

  if v_old is null then
    raise exception 'plan not found' using errcode='23503';
  end if;

  update public.saas_plans
  set active=p_active
  where id=p_plan_id;

  insert into public.saas_master_audit_logs(
    staff_user_id,action,resource_type,resource_id,metadata
  ) values (
    (select auth.uid()),
    case when p_active then 'saas_plan.reactivate' else 'saas_plan.deactivate' end,
    'saas_plan',
    p_plan_id::text,
    jsonb_build_object('previous_active',v_old,'new_active',p_active,'reason',p_reason)
  );

  return p_plan_id;
end;
$$;

create or replace function public.delete_saas_plan_if_unused(
  p_plan_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_name text;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_reason))=0 then
    raise exception 'reason is required' using errcode='22023';
  end if;

  select name into v_name
  from public.saas_plans
  where id=p_plan_id
  for update;

  if v_name is null then
    raise exception 'plan not found' using errcode='23503';
  end if;

  v_reason := private.saas_plan_delete_block_reason(p_plan_id);
  if v_reason is not null then
    raise exception 'plan cannot be deleted: %; deactivate it instead',v_reason
      using errcode='55000';
  end if;

  delete from public.saas_plan_versions
  where plan_id=p_plan_id;

  delete from public.saas_plans
  where id=p_plan_id;

  insert into public.saas_master_audit_logs(
    staff_user_id,action,resource_type,resource_id,metadata
  ) values (
    (select auth.uid()),
    'saas_plan.delete_unused',
    'saas_plan',
    p_plan_id::text,
    jsonb_build_object('name',v_name,'reason',p_reason)
  );

  return true;
end;
$$;

-- ============================================================
-- 3. Promotion series lifecycle and draft CRUD
-- ============================================================

create table public.saas_promotion_series_state (
  promotion_series_id uuid primary key,
  active boolean not null default true,
  state_reason text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

insert into public.saas_promotion_series_state(promotion_series_id,active)
select distinct p.promotion_series_id,true
from public.saas_promotions p
on conflict (promotion_series_id) do nothing;

alter table public.saas_promotion_series_state enable row level security;

revoke all on public.saas_promotion_series_state from anon,authenticated;
grant select on public.saas_promotion_series_state to authenticated;

create policy saas_promotion_series_state_platform_select
on public.saas_promotion_series_state for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
);

create or replace function public.create_saas_promotion_draft(
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
  v_series uuid := gen_random_uuid();
  v_promotion uuid;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_name))=0 then
    raise exception 'promotion name required' using errcode='22023';
  end if;

  insert into public.saas_promotions(
    promotion_series_id,version_number,name,public_code,status,
    benefit_type,benefit_value,duration_type,duration_cycles,
    valid_from,valid_to,eligibility_scope,max_redemptions,stackable,created_by
  ) values (
    v_series,1,btrim(p_name),nullif(upper(btrim(p_public_code)),''),
    'draft',p_benefit_type,p_benefit_value,p_duration_type,p_duration_cycles,
    p_valid_from,p_valid_to,p_eligibility_scope,p_max_redemptions,p_stackable,(select auth.uid())
  )
  returning id into v_promotion;

  insert into public.saas_promotion_series_state(
    promotion_series_id,active,changed_by,state_reason
  ) values (
    v_series,true,(select auth.uid()),'promotion_created'
  );

  return v_promotion;
end;
$$;

create or replace function public.update_saas_promotion_draft(
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
begin
  perform private.require_platform_staff('MASTER');

  perform 1 from public.saas_promotions
  where id=p_promotion_id and status='draft'
  for update;

  if not found then
    raise exception 'draft promotion not found' using errcode='23503';
  end if;

  update public.saas_promotions
  set
    name=btrim(p_name),
    public_code=nullif(upper(btrim(p_public_code)),''),
    benefit_type=p_benefit_type,
    benefit_value=p_benefit_value,
    duration_type=p_duration_type,
    duration_cycles=p_duration_cycles,
    valid_from=p_valid_from,
    valid_to=p_valid_to,
    eligibility_scope=p_eligibility_scope,
    max_redemptions=p_max_redemptions,
    stackable=p_stackable
  where id=p_promotion_id;

  return p_promotion_id;
end;
$$;

create or replace function public.set_saas_promotion_series_active(
  p_promotion_series_id uuid,
  p_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_reason))=0 then
    raise exception 'reason is required' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.saas_promotions p
    where p.promotion_series_id=p_promotion_series_id
  ) then
    raise exception 'promotion series not found' using errcode='23503';
  end if;

  insert into public.saas_promotion_series_state(
    promotion_series_id,active,state_reason,changed_by,changed_at
  ) values (
    p_promotion_series_id,p_active,p_reason,(select auth.uid()),now()
  )
  on conflict (promotion_series_id)
  do update set
    active=excluded.active,
    state_reason=excluded.state_reason,
    changed_by=excluded.changed_by,
    changed_at=excluded.changed_at;

  insert into public.saas_master_audit_logs(
    staff_user_id,action,resource_type,resource_id,metadata
  ) values (
    (select auth.uid()),
    case when p_active then 'saas_promotion.reactivate' else 'saas_promotion.deactivate' end,
    'saas_promotion_series',
    p_promotion_series_id::text,
    jsonb_build_object('active',p_active,'reason',p_reason)
  );

  return p_promotion_series_id;
end;
$$;

create or replace function private.saas_promotion_delete_block_reason(
  p_promotion_series_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.saas_promotions p
    where p.promotion_series_id=p_promotion_series_id
      and p.status in ('published','retired')
  ) then
    return 'published_history_exists';
  end if;

  if exists (
    select 1
    from public.saas_promotion_redemptions r
    join public.saas_promotions p on p.id=r.promotion_id
    where p.promotion_series_id=p_promotion_series_id
  ) then
    return 'redemption_exists';
  end if;

  if exists (
    select 1
    from public.saas_promotion_customers c
    join public.saas_promotions p on p.id=c.promotion_id
    where p.promotion_series_id=p_promotion_series_id
  ) then
    return 'customer_link_exists';
  end if;

  if exists (
    select 1
    from public.saas_invoice_adjustments a
    where (a.calculation_metadata ->> 'promotion_series_id') = p_promotion_series_id::text
       or exists (
         select 1
         from public.saas_promotions p
         where p.promotion_series_id=p_promotion_series_id
           and (a.calculation_metadata ->> 'promotion_id') = p.id::text
       )
  ) then
    return 'invoice_adjustment_exists';
  end if;

  return null;
end;
$$;

revoke all on function private.saas_promotion_delete_block_reason(uuid) from public;

create or replace function public.delete_saas_promotion_series_if_unused(
  p_promotion_series_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_name text;
begin
  perform private.require_platform_staff('MASTER');

  if length(btrim(p_reason))=0 then
    raise exception 'reason is required' using errcode='22023';
  end if;

  select p.name into v_name
  from public.saas_promotions p
  where p.promotion_series_id=p_promotion_series_id
  order by p.version_number desc
  limit 1;

  if v_name is null then
    raise exception 'promotion series not found' using errcode='23503';
  end if;

  v_reason:=private.saas_promotion_delete_block_reason(p_promotion_series_id);
  if v_reason is not null then
    raise exception 'promotion cannot be deleted: %; deactivate it instead',v_reason
      using errcode='55000';
  end if;

  delete from public.saas_promotion_plan_versions pp
  using public.saas_promotions p
  where pp.promotion_id=p.id
    and p.promotion_series_id=p_promotion_series_id;

  delete from public.saas_promotions
  where promotion_series_id=p_promotion_series_id;

  delete from public.saas_promotion_series_state
  where promotion_series_id=p_promotion_series_id;

  insert into public.saas_master_audit_logs(
    staff_user_id,action,resource_type,resource_id,metadata
  ) values (
    (select auth.uid()),
    'saas_promotion.delete_unused',
    'saas_promotion_series',
    p_promotion_series_id::text,
    jsonb_build_object('name',v_name,'reason',p_reason)
  );

  return true;
end;
$$;

-- ============================================================
-- 4. Admin views for scalable history/filtering
-- ============================================================

create or replace view public.v_saas_plan_version_admin
with (security_invoker = true)
as
with current_default as (
  select distinct on (v.plan_id)
    v.plan_id,v.id as current_version_id
  from public.saas_plan_versions v
  join public.saas_plans p on p.id=v.plan_id
  where v.status='published'
    and v.valid_from<=current_date
    and p.active
  order by v.plan_id,v.valid_from desc,v.version_number desc
)
select
  p.id as plan_id,
  p.active as plan_active,
  v.id as plan_version_id,
  v.version_number,
  v.display_name_snapshot,
  v.internal_code_snapshot,
  v.price,
  v.currency,
  v.billing_interval,
  v.trial_days,
  v.grace_days,
  v.valid_from,
  v.valid_to,
  v.status as publication_status,
  case
    when not p.active then 'inactive'
    when v.status='draft' then 'draft'
    when v.valid_from>current_date then 'future'
    when c.current_version_id=v.id then 'current'
    else 'historical'
  end as admin_status,
  private.saas_plan_delete_block_reason(p.id) is null as can_delete_plan,
  private.saas_plan_delete_block_reason(p.id) as delete_block_reason
from public.saas_plans p
join public.saas_plan_versions v on v.plan_id=p.id
left join current_default c on c.plan_id=p.id;

create or replace view public.v_saas_promotion_series_admin
with (security_invoker = true)
as
with latest as (
  select distinct on (p.promotion_series_id)
    p.*
  from public.saas_promotions p
  order by p.promotion_series_id,p.version_number desc
),
usage_counts as (
  select p.promotion_series_id,count(r.id)::bigint as redemption_count
  from public.saas_promotions p
  left join public.saas_promotion_redemptions r on r.promotion_id=p.id
  group by p.promotion_series_id
)
select
  l.promotion_series_id,
  l.id as latest_promotion_id,
  l.version_number,
  l.name,
  l.public_code,
  coalesce(s.active,true) as active,
  l.status as latest_version_status,
  l.valid_from,
  l.valid_to,
  coalesce(u.redemption_count,0) as redemption_count,
  private.saas_promotion_delete_block_reason(l.promotion_series_id) is null as can_delete,
  private.saas_promotion_delete_block_reason(l.promotion_series_id) as delete_block_reason
from latest l
left join public.saas_promotion_series_state s
  on s.promotion_series_id=l.promotion_series_id
left join usage_counts u
  on u.promotion_series_id=l.promotion_series_id;

grant select on
  public.v_saas_plan_version_admin,
  public.v_saas_promotion_series_admin
to authenticated;

-- Existing platform policies on source tables still gate the security_invoker views.

-- ============================================================
-- 5. Function execution
-- ============================================================

revoke all on function public.set_saas_plan_active(uuid,boolean,text) from public;
revoke all on function public.delete_saas_plan_if_unused(uuid,text) from public;
revoke all on function public.create_saas_promotion_draft(text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) from public;
revoke all on function public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) from public;
revoke all on function public.set_saas_promotion_series_active(uuid,boolean,text) from public;
revoke all on function public.delete_saas_promotion_series_if_unused(uuid,text) from public;

grant execute on function public.set_saas_plan_active(uuid,boolean,text) to authenticated;
grant execute on function public.delete_saas_plan_if_unused(uuid,text) to authenticated;
grant execute on function public.create_saas_promotion_draft(text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) to authenticated;
grant execute on function public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) to authenticated;
grant execute on function public.set_saas_promotion_series_active(uuid,boolean,text) to authenticated;
grant execute on function public.delete_saas_promotion_series_if_unused(uuid,text) to authenticated;
