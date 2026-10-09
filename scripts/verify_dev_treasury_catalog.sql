-- DEV regression: authorized catalog RPCs in both isolated organizations. Entire fixture ROLLBACK.
begin;
do $$
declare t record; v_account uuid; v_fund uuid; v_method uuid; v_foreign uuid; v_key text;
v_charges bigint:=(select count(*) from public.charges);
v_payments bigint:=(select count(*) from public.payments);
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
) x(uid,org) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_account:=public.create_treasury_catalog_item(t.org::uuid,'account','DEV GATE ACCOUNT','bank','DEV institution','test-001',null,'DEV temporary test',v_key);
 if v_account<>public.create_treasury_catalog_item(t.org::uuid,'account','DEV GATE ACCOUNT','bank','DEV institution','test-001',null,'DEV temporary test',v_key) then raise exception 'account retry mismatch'; end if;
 begin perform public.create_treasury_catalog_item(t.org::uuid,'account','DEV GATE ACCOUNT','bank','DEV institution','test-002',null,'DEV changed key payload',v_key);raise exception 'changed retry accepted';exception when invalid_parameter_value then null;end;
 begin perform public.create_treasury_catalog_item(t.org::uuid,'account','dev gate account','cash',null,null,null,'DEV duplicate',gen_random_uuid()::text);raise exception 'duplicate accepted';exception when unique_violation then null;end;
 begin perform public.create_treasury_catalog_item(t.org::uuid,'account','DEV wrong','forbidden',null,null,null,'DEV invalid type',gen_random_uuid()::text);raise exception 'account type accepted';exception when invalid_parameter_value then null;end;
 begin perform public.create_treasury_catalog_item(t.org::uuid,'method','DEV wrong','bank',null,null,null,'DEV cross-kind',gen_random_uuid()::text);raise exception 'cross-kind field accepted';exception when invalid_parameter_value then null;end;
 v_fund:=public.create_treasury_catalog_item(t.org::uuid,'fund','DEV GATE FUND',null,null,null,'Objetivo DEV','DEV temporary test',gen_random_uuid()::text);
 v_method:=public.create_treasury_catalog_item(t.org::uuid,'method','DEV GATE METHOD',null,null,null,null,'DEV temporary test',gen_random_uuid()::text);
 if not exists(select 1 from public.financial_accounts where id=v_account and organization_id=t.org::uuid and not active and account_type='bank')
 or not exists(select 1 from public.funds where id=v_fund and organization_id=t.org::uuid and active)
 or not exists(select 1 from public.payment_methods where id=v_method and organization_id=t.org::uuid and active) then raise exception 'catalog insert missing';end if;
 -- New financial accounts are intentionally inactive until published-plan coverage exists.
 begin perform public.set_treasury_catalog_status(t.org::uuid,'account',v_account,false,true,'DEV account activation must be denied',gen_random_uuid()::text);
 raise exception 'unmapped account activation accepted';exception when check_violation then null;end;
 v_key:=gen_random_uuid()::text;
 if public.set_treasury_catalog_status(t.org::uuid,'fund',v_fund,true,false,'DEV fund deactivation',v_key)<>v_fund then raise exception 'fund status return invalid';end if;
 if public.set_treasury_catalog_status(t.org::uuid,'fund',v_fund,true,false,'DEV fund deactivation',v_key)<>v_fund then raise exception 'status retry invalid';end if;
 begin perform public.set_treasury_catalog_status(t.org::uuid,'fund',v_fund,true,false,'DEV stale',gen_random_uuid()::text);raise exception 'stale status accepted';exception when serialization_failure then null;end;
 perform public.set_treasury_catalog_status(t.org::uuid,'fund',v_fund,false,true,'DEV reactivate fund',gen_random_uuid()::text);
 perform public.set_treasury_catalog_status(t.org::uuid,'method',v_method,true,false,'DEV method status',gen_random_uuid()::text);
 perform public.set_treasury_catalog_status(t.org::uuid,'method',v_method,false,true,'DEV reactivate method',gen_random_uuid()::text);
 begin insert into public.funds(organization_id,name) values(t.org::uuid,'DEV direct insert');raise exception 'direct table write allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select count(*) from public.audit_logs where organization_id=t.org::uuid and action='treasury_catalog.create' and entity_id in(v_account,v_fund,v_method))<>3 then raise exception 'catalog audit count invalid';end if;
 if exists(select 1 from public.audit_logs where organization_id=t.org::uuid and action='treasury_catalog.create' and entity_id=v_account and after_data->>'active'<>'false') then raise exception 'incorrect inactive account audit';end if;
 if (select count(*) from public.audit_logs where organization_id=t.org::uuid and action='treasury_catalog.status' and entity_id in(v_account,v_fund,v_method))<>4 then raise exception 'status audit count invalid';end if;
end loop;
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
) x(uid,org) loop
 select id into v_foreign from public.funds where organization_id<>t.org::uuid and name='DEV GATE FUND';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin perform public.set_treasury_catalog_status(t.org::uuid,'fund',v_foreign,false,true,'DEV foreign test',gen_random_uuid()::text);raise exception 'foreign fund allowed';exception when foreign_key_violation then null;end;
 if exists(select 1 from public.funds where id=v_foreign) then raise exception 'foreign fund SELECT exposed';end if;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='TREASURER') where user_id=t.uid::uuid;
 execute 'set local role authenticated';
 begin perform public.create_treasury_catalog_item(t.org::uuid,'fund','DEV treasurer',null,null,null,null,'DEV denied',gen_random_uuid()::text);raise exception 'treasurer create allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_treasury_catalog_status(t.org::uuid,'fund',v_foreign,false,true,'DEV denied',gen_random_uuid()::text);raise exception 'treasurer status allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='VIEWER') where user_id=t.uid::uuid;
 execute 'set local role authenticated';
 begin perform public.create_treasury_catalog_item(t.org::uuid,'method','DEV viewer',null,null,null,null,'DEV denied',gen_random_uuid()::text);raise exception 'viewer create allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.create_treasury_catalog_item(t.org::uuid,'fund','DEV suspended',null,null,null,null,'DEV denied',gen_random_uuid()::text);raise exception 'suspended create allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_treasury_catalog_status(t.org::uuid,'fund',v_foreign,false,true,'DEV denied',gen_random_uuid()::text);raise exception 'suspended status allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
end loop;
if has_function_privilege('anon','public.create_treasury_catalog_item(uuid,text,text,text,text,text,text,text,text)','execute')
or has_function_privilege('anon','public.set_treasury_catalog_status(uuid,text,uuid,boolean,boolean,text,text)','execute')
then raise exception 'anon RPC enabled';end if;
if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments) then raise exception 'ledger changed';end if;
end $$;
rollback;
select 'DEV_TREASURY_CATALOG_ROLLBACK_PASS' as result;
