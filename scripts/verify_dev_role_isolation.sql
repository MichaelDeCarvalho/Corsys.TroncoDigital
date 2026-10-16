-- DEV only: database RLS/RPC tests with simulated request claims.
-- Does NOT test Auth login, JWT signature verification, HTTP or real MFA.
-- Existing fixture requires exactly one ADMIN in each test organization.
begin;
do $$
begin
  if (select count(distinct user_id) from public.user_roles ur
      join public.organizations o on o.id=ur.organization_id
      join public.roles r on r.id=ur.role_id and r.code='ADMIN'
      where o.name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B'))<>2
    or (select count(*) from public.user_roles ur
      join public.organizations o on o.id=ur.organization_id
      join public.roles r on r.id=ur.role_id and r.code='ADMIN'
      where o.name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B'))<>2 then
    raise exception 'Exactly two distinct fixture admins required';
  end if;
end;
$$;

reset role;
select set_config('corsys_test.own_org',o.id::text,true),
       set_config('corsys_test.other_org',(select id::text from public.organizations where name='CORSYS DEV TENANT B'),true),
       set_config('request.jwt.claims',jsonb_build_object('sub',ur.user_id,'role','authenticated','aal','aal1')::text,true)
from public.organizations o join public.user_roles ur on ur.organization_id=o.id
join public.roles r on r.id=ur.role_id and r.code='ADMIN'
where o.name='CORSYS DEV TENANT A';
set local role authenticated;
do $$
declare v_own uuid:=current_setting('corsys_test.own_org')::uuid;
v_other uuid:=current_setting('corsys_test.other_org')::uuid; v_ticket uuid;
begin
  if auth.uid() is null or v_own=v_other then raise exception 'Invalid DEV identity fixture'; end if;
  if not exists(select 1 from public.organizations where id=v_own) then raise exception 'Own org hidden'; end if;
  if exists(select 1 from public.organizations where id=v_other) then raise exception 'Other org visible'; end if;
  if not exists(select 1 from public.members where organization_id=v_own) then raise exception 'Own member hidden'; end if;
  if exists(select 1 from public.members where organization_id=v_other) then raise exception 'Other member visible'; end if;
  if exists(select 1 from public.platform_staff) then raise exception 'Staff visible to tenant'; end if;
  if exists(select 1 from public.saas_platform_configuration) then raise exception 'Master config visible to tenant'; end if;
  if exists(select 1 from public.v_saas_plan_version_admin)
     or exists(select 1 from public.v_saas_promotion_series_admin) then
    raise exception 'Administrative catalog visible to tenant AAL1';
  end if;
  begin
    perform private.saas_plan_delete_block_reason(gen_random_uuid());
    raise exception 'Administrative helper accepted tenant AAL1';
  exception when insufficient_privilege then null;
  end;
  v_ticket:=public.create_saas_support_ticket(v_own,'SQL ROLE DEV TEST','other','low','Fixture reverted at rollback');
  if not exists(select 1 from public.saas_support_tickets where id=v_ticket) then raise exception 'Own ticket hidden'; end if;
  begin
    perform public.create_saas_support_ticket(v_other,'CROSS TENANT MUST FAIL','other','low','Must be denied');
    raise exception 'Cross tenant RPC accepted';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.saas_support_tickets where organization_id=v_other) then raise exception 'Cross tenant ticket visible'; end if;
end;
$$;


reset role;
select set_config('corsys_test.own_org',o.id::text,true),
       set_config('corsys_test.other_org',(select id::text from public.organizations where name='CORSYS DEV TENANT A'),true),
       set_config('request.jwt.claims',jsonb_build_object('sub',ur.user_id,'role','authenticated','aal','aal1')::text,true)
from public.organizations o join public.user_roles ur on ur.organization_id=o.id
join public.roles r on r.id=ur.role_id and r.code='ADMIN'
where o.name='CORSYS DEV TENANT B';
set local role authenticated;
do $$
declare v_own uuid:=current_setting('corsys_test.own_org')::uuid;
v_other uuid:=current_setting('corsys_test.other_org')::uuid; v_ticket uuid;
begin
  if auth.uid() is null or v_own=v_other then raise exception 'Invalid DEV identity fixture'; end if;
  if not exists(select 1 from public.organizations where id=v_own) then raise exception 'Own org hidden'; end if;
  if exists(select 1 from public.organizations where id=v_other) then raise exception 'Other org visible'; end if;
  if not exists(select 1 from public.members where organization_id=v_own) then raise exception 'Own member hidden'; end if;
  if exists(select 1 from public.members where organization_id=v_other) then raise exception 'Other member visible'; end if;
  if exists(select 1 from public.platform_staff) then raise exception 'Staff visible to tenant'; end if;
  if exists(select 1 from public.saas_platform_configuration) then raise exception 'Master config visible to tenant'; end if;
  if exists(select 1 from public.v_saas_plan_version_admin)
     or exists(select 1 from public.v_saas_promotion_series_admin) then
    raise exception 'Administrative catalog visible to tenant AAL1';
  end if;
  begin
    perform private.saas_plan_delete_block_reason(gen_random_uuid());
    raise exception 'Administrative helper accepted tenant AAL1';
  exception when insufficient_privilege then null;
  end;
  v_ticket:=public.create_saas_support_ticket(v_own,'SQL ROLE DEV TEST','other','low','Fixture reverted at rollback');
  if not exists(select 1 from public.saas_support_tickets where id=v_ticket) then raise exception 'Own ticket hidden'; end if;
  begin
    perform public.create_saas_support_ticket(v_other,'CROSS TENANT MUST FAIL','other','low','Must be denied');
    raise exception 'Cross tenant RPC accepted';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.saas_support_tickets where organization_id=v_other) then raise exception 'Cross tenant ticket visible'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$
declare v_table text; v_count bigint;
begin
  foreach v_table in array array['organizations','members','platform_staff','saas_platform_configuration'] loop
    begin
      execute format('select count(*) from public.%I',v_table) into v_count;
      if v_count<>0 then raise exception 'Anonymous rows visible in %',v_table; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
reset role;
rollback;
select 'SQL_ROLE_ISOLATION_PASS (simulated claims; real JWT/login pending)' as result;
