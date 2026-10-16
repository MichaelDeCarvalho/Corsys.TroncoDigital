begin;
do $$
declare v_master uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 v_tenant uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 v_count integer;v_first uuid;v_second uuid;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 select count(*) into v_count from public.search_platform_master_tenants('DEV-A','all',null,26,0);
 if v_count<>1 then raise exception 'Search by number should find one DEV-A, got %',v_count;end if;
 select count(*) into v_count from public.search_platform_master_tenants('dev-b','all',null,26,0);
 if v_count<>1 then raise exception 'Case-insensitive DEV-B search mismatch';end if;
 select count(*) into v_count from public.search_platform_master_tenants(null,'active',null,26,0);
 if v_count<>2 then raise exception 'Two active subscriptions expected';end if;
 select count(*) into v_count from public.search_platform_master_tenants(null,'past_due',null,26,0);
 if v_count<>0 then raise exception 'Past_due filtering incorrect';end if;
 select count(*) into v_count from public.search_platform_master_tenants(null,'all','unknown-plan-name',26,0);
 if v_count<>0 then raise exception 'Plan filter should exclude unmatched names';end if;
 select organization_id into v_first from public.search_platform_master_tenants(null,'all',null,1,0);
 select organization_id into v_second from public.search_platform_master_tenants(null,'all',null,1,1);
 if v_first=v_second or v_first is null or v_second is null then raise exception 'Search pagination repeats tenant';end if;
 begin
  perform 1 from public.search_platform_master_tenants(null,'invalid',null,26,0);
  raise exception 'Invalid status search accepted';
 exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal1')::text,true);
 begin
  perform 1 from public.search_platform_master_tenants('DEV-A','all',null,26,0);
  raise exception 'AAL1 searched Master directory';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_tenant,'role','authenticated','aal','aal2')::text,true);
 begin
  perform 1 from public.search_platform_master_tenants('DEV-A','all',null,26,0);
  raise exception 'Tenant searched Master directory';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if has_function_privilege('anon','public.search_platform_master_tenants(text,text,text,integer,integer)','execute')
 then raise exception 'Anonymous searched platform directory';end if;
end $$;
rollback;
select 'DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS' as result;