begin;
do $$
declare staff uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';tenant_user uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 version_id uuid;key_id text;payload jsonb;id1 uuid;id2 uuid;
 before_rows bigint:=(select count(*) from public.saas_onboarding_runs);
 before_events bigint:=(select count(*) from public.saas_onboarding_step_events);
begin
select id into version_id from public.saas_plan_versions where status='published' order by valid_from desc limit 1;
payload:=jsonb_build_object('prospective_name','DEV Safe Onboarding','organization_number','TEST998',
 'admin_name','Test Admin','admin_email','test@example.test','billing_email','bill@example.test',
 'invite_email','invite@example.test','tenant_slug','dev-safe-998',
 'city',null,'state_code',null,'plan_version_id',version_id,
 'contract_price',125.00,'subscription_start','2026-11-01','trial_days',0);
perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal2')::text,true);
execute 'set local role authenticated';
key_id:='DEV-SAFE-'||gen_random_uuid()::text;
id1:=public.create_master_onboarding_draft_idempotent(key_id,payload);
id2:=public.create_master_onboarding_draft_idempotent(key_id,payload);
if id1 is null or id1<>id2 then raise exception 'Master strict replay mismatch';end if;
begin
perform public.create_master_onboarding_draft_idempotent(key_id,payload||jsonb_build_object('contract_price',135.00));
raise exception 'Changed payload accepted';
exception when invalid_parameter_value then null;end;
perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal1')::text,true);
begin perform public.create_master_onboarding_draft_idempotent('DEV-NO-MFA-'||gen_random_uuid(),payload);
raise exception 'AAL1 Master created draft';exception when insufficient_privilege then null;end;
perform set_config('request.jwt.claims',jsonb_build_object('sub',tenant_user,'role','authenticated','aal','aal2')::text,true);
begin perform public.create_master_onboarding_draft_idempotent('DEV-NO-ROLE-'||gen_random_uuid(),payload);
raise exception 'Tenant account created draft';exception when insufficient_privilege then null;end;
execute 'reset role';
if (select count(*) from public.saas_onboarding_runs)<>before_rows+1
or (select count(*) from public.saas_onboarding_step_events)<>before_events+1
then raise exception 'Master draft retry duplicated rows or events';end if;
if has_function_privilege('anon','public.create_master_onboarding_draft_idempotent(text,jsonb)','execute')
then raise exception 'Anon wrapper exposed';end if;
end $$;
rollback;
select 'DEV_MASTER_ONBOARDING_STRICT_REPLAY_ROLLBACK_PASS' as result;