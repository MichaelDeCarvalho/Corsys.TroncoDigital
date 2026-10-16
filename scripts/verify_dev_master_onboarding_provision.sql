begin;
do $$
declare staff uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';v uuid;run_id uuid;org_id uuid;replay uuid;
before_org bigint:=(select count(*) from public.organizations);before_jobs bigint:=(select count(*) from public.saas_jobs);
begin
 select id into v from public.saas_plan_versions where status='published' order by valid_from desc limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 run_id:=public.save_saas_onboarding_draft(null,'DEV-ROLLBACK-PROVISION-'||gen_random_uuid()::text,'commercial',
  'DEV PROVISION TEMP','TEST99',null,'Curitiba','PR','Tester','dev-test@example.test',
  'billing@example.test',null,v,0.00,'2026-11-01',0,'dev-provision-99','ADMIN','blank',
  'invite@example.test',true);
 org_id:=public.provision_saas_onboarding_database(run_id);
 replay:=public.provision_saas_onboarding_database(run_id);
 if org_id<>replay then raise exception 'Onboarding provision idempotency mismatch';end if;
 execute 'reset role';
 if (select count(*) from public.organizations)<>before_org+1 then raise exception 'Expected exactly one created organization';end if;
 if (select count(*) from public.saas_jobs)<>before_jobs+1 then raise exception 'Expected one queued invite job';end if;
 if not exists(select 1 from public.saas_onboarding_runs where id=run_id and organization_id=org_id and status='awaiting_invite')
 then raise exception 'New tenant not pending invitation';end if;
 if not exists(select 1 from public.saas_subscriptions where organization_id=org_id)then raise exception 'Subscription missing';end if;
end $$;
rollback;
select 'DEV_MASTER_ONBOARDING_PROVISION_ROLLBACK_PASS' as result;