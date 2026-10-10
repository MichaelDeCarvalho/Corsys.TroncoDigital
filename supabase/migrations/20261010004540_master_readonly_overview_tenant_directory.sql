-- V35 DEV: read-only Master SaaS overview and tenant directory.
-- Platform staff authorization and AAL2 are enforced inside both RPCs,
-- never by browser navigation. No tenant funds or ledgers are exposed.
create or replace function public.read_platform_master_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_active integer;v_inactive integer;
 v_active_sub integer;v_past_due_sub integer;v_open_tickets integer;v_draft_plans integer;
begin
 perform private.require_platform_staff('MASTER');
 select count(*),count(*) filter(where status='active'),
    count(*) filter(where status<>'active')
 into v_total,v_active,v_inactive from public.organizations;
 select count(*) filter(where status in ('active','trialing')),
   count(*) filter(where status='past_due')
 into v_active_sub,v_past_due_sub from public.saas_subscriptions;
 select count(*) into v_open_tickets from public.saas_support_tickets
  where status not in ('resolved','closed');
 select count(*) into v_draft_plans from public.saas_plan_versions where status='draft';
 return jsonb_build_object('as_of',current_date,'tenants_total',v_total,
   'tenants_active',v_active,'tenants_other',v_inactive,
   'subscriptions_active_or_trial',v_active_sub,'subscriptions_past_due',v_past_due_sub,
   'support_tickets_open',v_open_tickets,'plan_drafts',v_draft_plans,
   'access','MASTER','mfa_required',true);
end $$;
revoke all on function public.read_platform_master_overview() from PUBLIC,anon,authenticated;
grant execute on function public.read_platform_master_overview() to authenticated;

create or replace function public.list_platform_master_tenants(
 p_limit integer,p_offset integer
) returns table(
 organization_id uuid,organization_name text,organization_number text,
 organization_status text,subscription_status text,plan_name text,
 open_support_tickets bigint
) language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_platform_staff('MASTER');
 if p_limit is null or p_limit not between 1 and 50
  or p_offset is null or p_offset<0 or p_offset>20000
 then raise exception 'invalid master tenant pagination' using errcode='22023';end if;
 return query
 select o.id,o.name,o.number,o.status,
   coalesce(s.status,'none'),
   coalesce(v.display_name_snapshot,p.name,'Sem plano'),
   (select count(*) from public.saas_support_tickets t
    where t.organization_id=o.id and t.status not in ('resolved','closed'))
 from public.organizations o
 left join lateral (
  select x.status,x.plan_id,x.plan_version_id from public.saas_subscriptions x
   where x.organization_id=o.id order by x.started_at desc,x.id desc limit 1
 ) s on true
 left join public.saas_plans p on p.id=s.plan_id
 left join public.saas_plan_versions v on v.id=s.plan_version_id
 order by o.name,o.id
 limit p_limit offset p_offset;
end $$;
revoke all on function public.list_platform_master_tenants(integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.list_platform_master_tenants(integer,integer) to authenticated;
