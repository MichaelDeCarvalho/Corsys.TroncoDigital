begin;
do $$
declare v_master uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 v_tenant uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 v_overview jsonb;v_tenants int;
begin
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',v_master,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin
  perform public.read_platform_master_overview();
  raise exception 'MFA AAL1 unexpectedly allowed';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',v_master,'role','authenticated','aal','aal2')::text,true);
 v_overview:=public.read_platform_master_overview();
 if v_overview->>'access'<>'MASTER' or
  (v_overview->>'tenants_total')::int<>2 or
  v_overview->>'mfa_required'<>'true'
 then raise exception 'Master dashboard invalid %',v_overview;end if;
 select count(*) into v_tenants from public.list_platform_master_tenants(50,0);
 if v_tenants<>2 then raise exception 'Master tenant list count incorrect %',v_tenants;end if;
 begin
  perform * from public.list_platform_master_tenants(100,0);
  raise exception 'Unbounded master directory accepted';
 exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object(
  'sub',v_tenant,'role','authenticated','aal','aal2')::text,true);
 begin
  perform public.read_platform_master_overview();
  raise exception 'Tenant AAL2 gained Master';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.list_platform_master_tenants(50,0);
  raise exception 'Tenant AAL2 gained Master directory';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if has_function_privilege('anon','public.read_platform_master_overview()','execute')
 or has_function_privilege('anon','public.list_platform_master_tenants(integer,integer)','execute')
 then raise exception 'Anonymous Master access granted';end if;
end $$;
rollback;
select 'DEV_MASTER_READONLY_AAL2_ROLLBACK_PASS' as result;
