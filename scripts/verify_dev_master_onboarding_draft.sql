begin;
do $$
declare master_user uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d'; tenant_user uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'; version_id uuid; draft_id uuid; repeat_id uuid; key_id text;
org_count bigint:=(select count(*) from public.organizations); job_count bigint:=(select count(*) from public.saas_jobs);
begin
select id into version_id from public.saas_plan_versions where status='published' order by valid_from desc limit 1;
perform set_config('request.jwt.claims',jsonb_build_object('sub',master_user,'role','authenticated','aal','aal2')::text,true);
execute 'set local role authenticated';
key_id:='DEV-DRAFT-'||gen_random_uuid()::text;
draft_id:=public.save_saas_onboarding_draft(null,key_id,'commercial','DEV TEMP LOJA','987',null,'Curitiba','PR','Dev Tester','dev@example.test','finance@example.test',null,version_id,0,'2026-11-01',0,'dev-987','ADMIN','blank','invite@example.test',true);
repeat_id:=public.save_saas_onboarding_draft(null,key_id,'commercial','DEV TEMP LOJA','987',null,'Curitiba','PR','Dev Tester','dev@example.test','finance@example.test',null,version_id,0,'2026-11-01',0,'dev-987','ADMIN','blank','invite@example.test',true);
if draft_id is null or repeat_id<>draft_id or (select count(*) from public.saas_onboarding_runs where id=draft_id and status='draft')<>1 then raise exception 'Duplicate draft or missing saved state';end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',master_user,'role','authenticated','aal','aal1')::text,true);
begin
 perform public.save_saas_onboarding_draft(null,gen_random_uuid()::text,'commercial','DEV should deny','111',null,null,null,'Tester','a@example.test','b@example.test',null,version_id,0,'2026-11-01',0,'dev-111','ADMIN','blank','invite@example.test',true);
 raise exception 'AAL1 unexpectedly allowed';
exception when insufficient_privilege then null;end;
perform set_config('request.jwt.claims',jsonb_build_object('sub',tenant_user,'role','authenticated','aal','aal2')::text,true);
begin
 perform public.save_saas_onboarding_draft(null,gen_random_uuid()::text,'commercial','DEV should deny','111',null,null,null,'Tester','a@example.test','b@example.test',null,version_id,0,'2026-11-01',0,'dev-111','ADMIN','blank','invite@example.test',true);
 raise exception 'Tenant unexpectedly allowed';
exception when insufficient_privilege then null;end;
execute 'reset role';
if (select count(*) from public.organizations)<>org_count or (select count(*) from public.saas_jobs)<>job_count then raise exception 'Draft created tenant or job';end if;
end $$;
rollback;
select 'DEV_MASTER_ONBOARDING_DRAFT_ROLLBACK_PASS' as result;