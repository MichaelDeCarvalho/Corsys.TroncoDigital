-- Corsys Tronco Digital
-- Additive V35 migration: transactional Master audit logging and strict validation
-- for update_saas_plan_version_draft, create_saas_plan_successor_draft and update_saas_promotion_draft.
-- Prepared for review/controlled DEV rollout. Preserves all 66 baseline migrations intact.

-- ============================================================
-- 1. update_saas_plan_version_draft
--    - Lock order preserved: saas_plan_versions FOR UPDATE first,
--      then conditional update on saas_plans (matches publish_saas_plan_version).
--    - Rejects NULL or non-object p_entitlements with SQLSTATE 22023
--      before acquiring locks or modifying entitlements.
--    - Records transactional audit event 'saas_plan_version.draft_updated'.
-- ============================================================

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
  v_version_number integer;
  v_has_published boolean;
  v_name text;
  v_code text;
begin
  perform private.require_platform_staff('MASTER');

  if p_plan_version_id is null
     or p_name is null
     or p_code is null
     or p_price is null
     or p_billing_interval is null
     or p_trial_days is null
     or p_grace_days is null
     or p_valid_from is null
     or p_entitlements is null then
    raise exception 'invalid plan draft update fields' using errcode = '22023';
  end if;

  if p_price::text in ('NaN', 'Infinity', '-Infinity')
     or not isfinite(p_valid_from) then
    raise exception 'non-finite plan numeric or date value' using errcode = '22023';
  end if;

  v_name := btrim(p_name);
  v_code := btrim(lower(p_code));

  if v_code !~ '^[a-z0-9][a-z0-9_-]{1,40}$'
     or length(v_name) not between 2 and 120
     or p_price < 0
     or p_price > 999999999999.99
     or p_price <> round(p_price, 2)
     or p_billing_interval not in ('monthly', 'yearly', 'custom')
     or p_trial_days not between 0 and 365
     or p_grace_days not between 0 and 365
     or extract(day from p_valid_from) <> 1
     or jsonb_typeof(p_entitlements) <> 'object'
     or pg_column_size(p_entitlements) > 16000 then
    raise exception 'invalid plan draft update parameters' using errcode = '22023';
  end if;

  -- Preserve lock order compatible with publish_saas_plan_version:
  -- lock saas_plan_versions first, then conditionally update saas_plans.
  select v.plan_id, v.version_number
  into v_plan_id, v_version_number
  from public.saas_plan_versions v
  where v.id = p_plan_version_id
    and v.status = 'draft'
  for update;

  if v_plan_id is null then
    raise exception 'draft plan version not found' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.saas_plans p
    where p.code = v_code and p.id <> v_plan_id
  ) or exists (
    select 1
    from public.saas_plan_versions v
    where v.status = 'draft'
      and v.plan_id <> v_plan_id
      and v.internal_code_snapshot = v_code
  ) then
    raise exception 'plan internal code already in use' using errcode = '23505';
  end if;

  select exists(
    select 1 from public.saas_plan_versions x
    where x.plan_id = v_plan_id and x.status = 'published'
  ) into v_has_published;

  update public.saas_plan_versions
  set
    display_name_snapshot = v_name,
    internal_code_snapshot = v_code,
    price = p_price,
    billing_interval = p_billing_interval,
    trial_days = p_trial_days,
    grace_days = p_grace_days,
    valid_from = p_valid_from
  where id = p_plan_version_id;

  if not v_has_published then
    update public.saas_plans
    set
      name = v_name,
      code = v_code,
      billing_interval = p_billing_interval,
      price = p_price,
      trial_days = p_trial_days,
      grace_days = p_grace_days
    where id = v_plan_id;
  end if;

  perform private.replace_plan_version_entitlements(p_plan_version_id, p_entitlements);

  insert into public.saas_master_audit_logs(
    staff_user_id, action, resource_type, resource_id, metadata
  ) values (
    (select auth.uid()),
    'saas_plan_version.draft_updated',
    'saas_plan_version',
    p_plan_version_id::text,
    jsonb_build_object(
      'plan_id', v_plan_id,
      'version_number', v_version_number,
      'code', v_code,
      'billing_interval', p_billing_interval,
      'valid_from', p_valid_from,
      'catalog_synced', not v_has_published
    )
  );

  return p_plan_version_id;
end;
$$;

-- ============================================================
-- 2. create_saas_plan_successor_draft
--    - Preserves saas_plans FOR UPDATE lock followed by new version INSERT.
--    - Rejects NULL or non-object p_entitlements with SQLSTATE 22023.
--    - Records transactional audit event 'saas_plan_version.successor_draft'.
-- ============================================================

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

  if p_plan_id is null
     or p_price is null
     or p_billing_interval is null
     or p_trial_days is null
     or p_grace_days is null
     or p_valid_from is null
     or p_entitlements is null then
    raise exception 'invalid plan successor draft fields' using errcode = '22023';
  end if;

  if p_price::text in ('NaN', 'Infinity', '-Infinity')
     or not isfinite(p_valid_from) then
    raise exception 'non-finite plan successor numeric or date value' using errcode = '22023';
  end if;

  if p_price < 0
     or p_price > 999999999999.99
     or p_price <> round(p_price, 2)
     or p_billing_interval not in ('monthly', 'yearly', 'custom')
     or p_trial_days not between 0 and 365
     or p_grace_days not between 0 and 365
     or extract(day from p_valid_from) <> 1
     or jsonb_typeof(p_entitlements) <> 'object'
     or pg_column_size(p_entitlements) > 16000 then
    raise exception 'invalid plan successor draft parameters' using errcode = '22023';
  end if;

  select p.name, p.code
  into v_name, v_code
  from public.saas_plans p
  where p.id = p_plan_id
  for update;

  if v_name is null then
    raise exception 'plan not found' using errcode = '23503';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next
  from public.saas_plan_versions
  where plan_id = p_plan_id;

  insert into public.saas_plan_versions(
    plan_id, version_number, status, display_name_snapshot, internal_code_snapshot,
    price, currency, billing_interval, trial_days, grace_days, valid_from, created_by
  ) values (
    p_plan_id, v_next, 'draft', v_name, v_code,
    p_price, 'BRL', p_billing_interval, p_trial_days, p_grace_days, p_valid_from, (select auth.uid())
  )
  returning id into v_version;

  perform private.replace_plan_version_entitlements(v_version, p_entitlements);

  insert into public.saas_master_audit_logs(
    staff_user_id, action, resource_type, resource_id, metadata
  ) values (
    (select auth.uid()),
    'saas_plan_version.successor_draft',
    'saas_plan_version',
    v_version::text,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'version_number', v_next,
      'code', v_code,
      'billing_interval', p_billing_interval,
      'valid_from', p_valid_from
    )
  );

  return v_version;
end;
$$;

-- ============================================================
-- 3. update_saas_promotion_draft
--    - Aligns validation rules with idempotent promotion draft/successor RPCs
--      and MasterPromotions.tsx without adding p_valid_from > now().
--    - Records transactional audit event 'saas_promotion.draft_updated'.
-- ============================================================

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
declare
  v_series_id uuid;
  v_version_number integer;
  v_name text;
  v_code text;
begin
  perform private.require_platform_staff('MASTER');

  if p_promotion_id is null
     or p_name is null
     or p_public_code is null
     or p_benefit_type is null
     or p_benefit_value is null
     or p_duration_type is null
     or p_valid_from is null
     or p_eligibility_scope is null
     or p_stackable is null then
    raise exception 'invalid promotion draft update fields' using errcode = '22023';
  end if;

  if p_benefit_value::text in ('NaN', 'Infinity', '-Infinity')
     or not isfinite(p_valid_from)
     or (p_valid_to is not null and not isfinite(p_valid_to)) then
    raise exception 'non-finite promotion numeric or timestamp value' using errcode = '22023';
  end if;

  v_name := btrim(p_name);
  v_code := upper(btrim(p_public_code));

  if length(v_name) not between 3 and 120
     or v_code !~ '^[A-Z0-9_-]{3,40}$'
     or p_benefit_type not in ('percent', 'fixed_amount', 'trial_price')
     or p_benefit_value <= 0
     or p_benefit_value > 999999999999.99
     or p_benefit_value <> round(p_benefit_value, 2)
     or (p_benefit_type = 'percent' and p_benefit_value > 100)
     or p_duration_type not in ('once', 'cycles', 'date_range')
     or (p_duration_type = 'cycles' and (p_duration_cycles is null or p_duration_cycles not between 1 and 36))
     or (p_duration_type <> 'cycles' and p_duration_cycles is not null)
     or (p_valid_to is not null and p_valid_to <= p_valid_from)
     or p_eligibility_scope not in ('new_customers', 'selected_customers', 'all_eligible')
     or (p_max_redemptions is not null and p_max_redemptions not between 1 and 1000000) then
    raise exception 'invalid promotion draft update parameters' using errcode = '22023';
  end if;

  select p.promotion_series_id, p.version_number
  into v_series_id, v_version_number
  from public.saas_promotions p
  where p.id = p_promotion_id
    and p.status = 'draft'
  for update;

  if not found then
    raise exception 'draft promotion not found' using errcode = '23503';
  end if;

  update public.saas_promotions
  set
    name = v_name,
    public_code = v_code,
    benefit_type = p_benefit_type,
    benefit_value = p_benefit_value,
    duration_type = p_duration_type,
    duration_cycles = p_duration_cycles,
    valid_from = p_valid_from,
    valid_to = p_valid_to,
    eligibility_scope = p_eligibility_scope,
    max_redemptions = p_max_redemptions,
    stackable = p_stackable
  where id = p_promotion_id;

  insert into public.saas_master_audit_logs(
    staff_user_id, action, resource_type, resource_id, metadata
  ) values (
    (select auth.uid()),
    'saas_promotion.draft_updated',
    'saas_promotion',
    p_promotion_id::text,
    jsonb_build_object(
      'promotion_series_id', v_series_id,
      'version_number', v_version_number,
      'code', v_code,
      'benefit_type', p_benefit_type,
      'valid_from', p_valid_from
    )
  );

  return p_promotion_id;
end;
$$;

-- ============================================================
-- 4. Least-privilege EXECUTE grants
-- ============================================================

revoke all on function public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb) from public, anon, authenticated;
revoke all on function public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb) from public, anon, authenticated;
revoke all on function public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) from public, anon, authenticated;

grant execute on function public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb) to authenticated;
grant execute on function public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb) to authenticated;
grant execute on function public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean) to authenticated;
