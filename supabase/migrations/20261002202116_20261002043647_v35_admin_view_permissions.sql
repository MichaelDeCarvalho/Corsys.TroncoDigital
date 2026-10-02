-- Forward fix: security_invoker admin views need EXECUTE on their private helpers.
-- Helpers independently require authorized platform staff with AAL2.
-- Prepared; not applied to a database.

create or replace function private.saas_plan_delete_block_reason(p_plan_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff(null);
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')) then
    raise exception 'catalog metadata permission denied' using errcode='42501';
  end if;
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
  perform private.require_platform_staff(null);
  if not (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')) then
    raise exception 'catalog metadata permission denied' using errcode='42501';
  end if;
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
left join current_default c on c.plan_id=p.id
where private.has_aal2()
  and (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING'));

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
  on u.promotion_series_id=l.promotion_series_id
where private.has_aal2()
  and (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING'));

revoke all on function private.saas_plan_delete_block_reason(uuid) from public, anon;

revoke all on function private.saas_promotion_delete_block_reason(uuid) from public, anon;

grant execute on function private.saas_plan_delete_block_reason(uuid) to authenticated;

grant execute on function private.saas_promotion_delete_block_reason(uuid) to authenticated;
