-- DEV fixture only. Target explicitly authorized: szqkdekwhzxsoxorgvaz.
-- Safe to rerun: existing fixtures are reused; no real organizations are modified.
begin;
do $$
declare v_org uuid; v_suffix text; v_name text; v_member text;
begin
  foreach v_suffix in array array['A','B'] loop
    v_name := 'CORSYS DEV TENANT ' || v_suffix;
    v_member := 'Integrante Exclusivo Tenant ' || v_suffix;
    select id into v_org from public.organizations where name=v_name;
    if v_org is null then
      insert into public.organizations(name,number,status)
      values(v_name,'DEV-' || v_suffix,'active') returning id into v_org;
    end if;
    if not exists(select 1 from public.members where organization_id=v_org and full_name=v_member) then
      insert into public.members(organization_id,full_name,status)
      values(v_org,v_member,'active');
    end if;
  end loop;
end;
$$;
commit;
select o.name,o.number,r.code,count(distinct m.id) as member_count
from public.organizations o
join public.roles r on r.organization_id=o.id
join public.members m on m.organization_id=o.id
where o.name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B')
group by o.name,o.number,r.code order by o.name,r.code;
