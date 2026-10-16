-- DEV claims/RLS integration. All fixtures, role changes, commands and DDL preflight roll back.
begin;
do $$
declare t record;v_cycle uuid;v_account uuid;v_fund uuid;v_detail jsonb;
 v_rev text;v_old text;v_key text;v_id uuid;v_other uuid;v_bad numeric;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
begin
for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
) x(org,actor) loop
 select a.id into strict v_account from public.accounting_accounts a
 join public.accounting_plans p on p.organization_id=a.organization_id and p.id=a.accounting_plan_id
 where a.organization_id=t.org and a.active and a.row_type='analytic'
 and a.nature in('revenue','cost','expense','financial_result') and p.status='published'
 and date '2026-09-01' between p.valid_from and p.valid_to order by a.id limit 1;
 insert into public.funds(organization_id,name) values(t.org,'DEV BUDGET GATE '||gen_random_uuid()) returning id into v_fund;
 select id into v_other from public.accounting_accounts where organization_id<>t.org order by id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_cycle:=public.create_tenant_budget_draft(t.org,'DEV BUDGET LIFECYCLE '||t.org,'2026-09-01','2026-12-01','DEV rollback gate',v_key);
 v_id:=public.create_tenant_budget_draft(t.org,'DEV BUDGET LIFECYCLE '||t.org,'2026-09-01','2026-12-01','DEV rollback gate',v_key);
 if v_id<>v_cycle then raise exception 'create replay failed';end if;
 v_detail:=public.read_tenant_budget_detail(t.org,v_cycle);v_rev:=v_detail->>'revision';
 begin perform public.publish_tenant_budget(t.org,v_cycle,v_rev,'DEV empty denied',gen_random_uuid()::text);
 raise exception 'empty budget published';exception when invalid_parameter_value then null;end;
 v_key:=gen_random_uuid()::text;v_old:=v_rev;
 perform public.set_tenant_budget_line(t.org,v_cycle,'account',v_account,'2026-09-01',250,v_rev,'DEV rollback gate',v_key);
 perform public.set_tenant_budget_line(t.org,v_cycle,'account',v_account,'2026-09-01',250,v_rev,'DEV rollback gate',v_key);
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'account',v_account,'2026-09-01',251,v_rev,'DEV rollback gate',v_key);
 raise exception 'key payload conflict accepted';exception when invalid_parameter_value then null;end;
 v_detail:=public.read_tenant_budget_detail(t.org,v_cycle);v_rev:=v_detail->>'revision';
 if jsonb_array_length(v_detail->'lines')<>1 or v_rev=v_old then raise exception 'line/revision mismatch';end if;
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'fund',v_fund,'2026-09-01',300,v_old,'DEV stale gate',gen_random_uuid()::text);
 raise exception 'stale edit accepted';exception when serialization_failure then null;end;
 foreach v_bad in array array[-1::numeric,0.001::numeric,'NaN'::numeric,'Infinity'::numeric,1000000000000::numeric] loop
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'fund',v_fund,'2026-09-01',v_bad,v_rev,'DEV invalid money',gen_random_uuid()::text);
 raise exception 'invalid money accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'account',v_other,'2026-09-01',10,v_rev,'DEV foreign gate',gen_random_uuid()::text);
 raise exception 'foreign account accepted';exception when foreign_key_violation then null;end;
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'fund',v_fund,'2027-01-01',10,v_rev,'DEV period gate',gen_random_uuid()::text);
 raise exception 'outside period accepted';exception when invalid_parameter_value then null;end;
 perform public.set_tenant_budget_line(t.org,v_cycle,'fund',v_fund,'2026-09-01',300,v_rev,'DEV rollback gate',gen_random_uuid()::text);
 v_detail:=public.read_tenant_budget_detail(t.org,v_cycle);v_rev:=v_detail->>'revision';
 if jsonb_array_length(v_detail->'lines')<>2 then raise exception 'fund line not saved';end if;
 perform public.set_tenant_budget_line(t.org,v_cycle,'fund',v_fund,'2026-09-01',null,v_rev,'DEV remove gate',gen_random_uuid()::text);
 v_detail:=public.read_tenant_budget_detail(t.org,v_cycle);v_rev:=v_detail->>'revision';
 if jsonb_array_length(v_detail->'lines')<>1 then raise exception 'fund line not removed';end if;
 begin perform public.publish_tenant_budget(t.org,v_cycle,v_old,'DEV stale publish',gen_random_uuid()::text);
 raise exception 'stale publish accepted';exception when serialization_failure then null;end;
 v_key:=gen_random_uuid()::text;
 perform public.publish_tenant_budget(t.org,v_cycle,v_rev,'DEV rollback publish',v_key);
 perform public.publish_tenant_budget(t.org,v_cycle,v_rev,'DEV rollback publish',v_key);
 v_detail:=public.read_tenant_budget_detail(t.org,v_cycle);
 if v_detail->'cycle'->>'status'<>'published' then raise exception 'not published';end if;
 begin perform public.set_tenant_budget_line(t.org,v_cycle,'account',v_account,'2026-09-01',500,v_detail->>'revision','DEV immutable',gen_random_uuid()::text);
 raise exception 'published budget changed';exception when object_not_in_prerequisite_state then null;end;
 begin insert into public.budget_cycles(organization_id,name,period_start,period_end)
 values(t.org,'DEV DIRECT DENIED','2026-09-01','2026-12-01');
 raise exception 'direct write allowed';exception when insufficient_privilege then null;end;
 begin perform public.read_tenant_budget_detail(t.org,gen_random_uuid());
 raise exception 'unknown budget accepted';exception when foreign_key_violation then null;end;
 execute 'reset role';
 if (select count(*) from public.audit_logs where entity_id=v_cycle and action='budget.publish')<>1
 or (select count(*) from public.audit_logs where entity_id=v_cycle and action='budget.draft')<>1
 then raise exception 'audit replay mismatch';end if;
 -- A user in the other tenant must not read this real positive fixture by either scope.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',case when t.actor='a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid then '559ba052-c408-4418-b806-0c0c4b8e3603' else 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624' end,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin perform public.read_tenant_budget_detail(t.org,v_cycle);
 raise exception 'foreign user read allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org and code='VIEWER') where user_id=t.actor;
 execute 'set local role authenticated';
 begin perform public.create_tenant_budget_draft(t.org,'DEV VIEWER DENIED','2026-09-01','2026-12-01','DEV negative',gen_random_uuid()::text);
 raise exception 'viewer write allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org and code='ADMIN') where user_id=t.actor;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org;
 execute 'set local role authenticated';
 begin perform public.create_tenant_budget_draft(t.org,'DEV SUSPENDED DENIED','2026-09-01','2026-12-01','DEV negative',gen_random_uuid()::text);
 raise exception 'suspended write allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.saas_subscriptions set status='active' where organization_id=t.org;
end loop;
if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in('read_tenant_budget_detail','create_tenant_budget_draft','set_tenant_budget_line','publish_tenant_budget')
 and has_function_privilege('anon',p.oid,'execute')) then raise exception 'anon execute allowed';end if;
if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments)
then raise exception 'ledger changed';end if;
end $$;
rollback;
select 'DEV_BUDGET_LIFECYCLE_ROLLBACK_PASS' as result;
