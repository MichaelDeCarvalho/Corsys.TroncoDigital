begin;
do $$
declare master uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 tenant uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 v_draft uuid;v_key text;v_publish text;v_code text;
 v_plans_before bigint:=(select count(*) from public.saas_plans);
 v_audit_before bigint:=(select count(*) from public.saas_master_audit_logs);
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin
  perform public.create_master_plan_draft_idempotent(
   'dev-blocked','DEV should deny',25,'monthly',0,5,'2027-01-01','{}'::jsonb,gen_random_uuid()::text);
  raise exception 'Master AAL1 created a plan draft';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','aal','aal2')::text,true);
 v_key:=gen_random_uuid()::text;v_code:='devmaster'||substring(replace(gen_random_uuid()::text,'-','') from 1 for 15);
 v_draft:=public.create_master_plan_draft_idempotent(v_code,'DEV draft only',155.50,
 'monthly',0,7,'2027-02-01','{"users":10}'::jsonb,v_key);
 if v_draft<>public.create_master_plan_draft_idempotent(v_code,'DEV draft only',155.50,
  'monthly',0,7,'2027-02-01','{"users":10}'::jsonb,v_key)
 then raise exception 'Master draft replay mismatch';end if;
 if not exists(select 1 from public.saas_plan_versions
  where id=v_draft and status='draft' and price=155.50)
 then raise exception 'Master draft not created';end if;
 begin
  perform public.create_master_plan_draft_idempotent(v_code,'Changed draft',155.50,
    'monthly',0,7,'2027-02-01','{"users":10}'::jsonb,v_key);
  raise exception 'Reused Master key accepted changed payload';
 exception when invalid_parameter_value then null;end;
 v_publish:=gen_random_uuid()::text;
 if public.publish_master_plan_draft_idempotent(v_draft,v_publish)<>v_draft then
  raise exception 'Master publication ID mismatch';end if;
 if public.publish_master_plan_draft_idempotent(v_draft,v_publish)<>v_draft then
  raise exception 'Master publication replay mismatch';end if;
 if not exists(select 1 from public.saas_plan_versions
   where id=v_draft and status='published' and published_at is not null)
 then raise exception 'Master draft not published';end if;
 begin
  perform public.publish_master_plan_draft_idempotent(v_draft,gen_random_uuid()::text);
  raise exception 'Duplicate publish allowed';
 exception when foreign_key_violation then null;end;
 if (select count(*) from public.saas_plans)<>v_plans_before+1
 then raise exception 'Unexpected plan count after replay';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',tenant,'role','authenticated','aal','aal2')::text,true);
 begin
  perform public.create_master_plan_draft_idempotent('dev-tenant','DEV tenant denied',10,'monthly',0,0,'2027-02-01','{}'::jsonb,gen_random_uuid()::text);
  raise exception 'Tenant AAL2 created Master draft';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select count(*) from public.saas_master_audit_logs)<>v_audit_before+2
 then raise exception 'Master draft or publication audit missing';end if;
 if has_function_privilege('anon','public.create_master_plan_draft_idempotent(text,text,numeric,text,integer,integer,date,jsonb,text)','execute')
 or has_function_privilege('anon','public.publish_master_plan_draft_idempotent(uuid,text)','execute')
 then raise exception 'Anon Master plan command privilege';end if;
end $$;
rollback;
select 'DEV_MASTER_PLAN_DRAFT_LIFECYCLE_ROLLBACK_PASS' as result;