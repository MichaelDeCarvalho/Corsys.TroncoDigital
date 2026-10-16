-- DEV V35: Master directory search is evaluated at the database authorization boundary.
-- Never fetch the global tenant list and filter it in an unauthorized browser.
create or replace function public.search_platform_master_tenants(
 p_search text,p_subscription_status text,p_plan_search text,
 p_limit integer,p_offset integer
) returns table(
 organization_id uuid,organization_name text,organization_number text,
 organization_status text,subscription_status text,plan_name text,
 open_support_tickets bigint
) language plpgsql stable security definer set search_path='' as $$
declare v_search text;v_plan text;v_status text;
begin
 perform private.require_platform_staff('MASTER');
 if p_limit is null or p_limit not between 1 and 50
  or p_offset is null or p_offset<0 or p_offset>20000
  or p_search is not null and length(btrim(p_search))>100
  or p_plan_search is not null and length(btrim(p_plan_search))>100
 then raise exception 'invalid Master tenant search' using errcode='22023';end if;
 v_search:=nullif(lower(btrim(p_search)),'');
 v_plan:=nullif(lower(btrim(p_plan_search)),'');
 v_status:=coalesce(nullif(btrim(p_subscription_status),''),'all');
 if v_status not in ('all','active','past_due') then
  raise exception 'invalid Master tenant status filter' using errcode='22023';end if;
 return query
 select o.id,o.name,o.number,o.status,
   coalesce(s.status,'none'),
   coalesce(pv.display_name_snapshot,p.name,'Sem plano'),
   (select count(*) from public.saas_support_tickets t
     where t.organization_id=o.id and t.ticket_scope='tenant'
      and t.status not in ('resolved','closed'))
 from public.organizations o
 left join public.organization_settings settings on settings.organization_id=o.id
 left join public.saas_tenant_accounts account on account.organization_id=o.id
 left join lateral(
  select x.status,x.plan_id,x.plan_version_id from public.saas_subscriptions x
  where x.organization_id=o.id order by x.started_at desc,x.id desc limit 1
 ) s on true
 left join public.saas_plans p on p.id=s.plan_id
 left join public.saas_plan_versions pv on pv.id=s.plan_version_id
 where (v_search is null or position(v_search in lower(concat_ws(' ',o.name,o.number,
      settings.city,settings.email,account.billing_email,account.billing_phone)))>0)
   and (v_status='all' or coalesce(s.status,'none')=v_status)
   and (v_plan is null or position(v_plan in lower(concat_ws(' ',pv.display_name_snapshot,p.name,p.code)))>0)
 order by o.name,o.id
 limit p_limit offset p_offset;
end $$;
revoke all on function public.search_platform_master_tenants(text,text,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.search_platform_master_tenants(text,text,text,integer,integer) to authenticated;
