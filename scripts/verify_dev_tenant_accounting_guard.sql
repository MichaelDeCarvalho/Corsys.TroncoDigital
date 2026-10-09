-- DEV: Tenant-scoped accounting guard, catalog activation and invariant regression.
-- Claims are simulated by SQL; this is not an HTTP/JWT signature test.
begin;
do $$
declare t record; c uuid; a uuid; audit_ok boolean;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
 v_pub bigint:=(select count(*) from public.accounting_plans where status='published');
 v_current date:=date_trunc('month',current_date)::date;
begin
if (select count(*) from pg_trigger where tgname='accounting_tenant_change_guard' and not tgisinternal)<>6 then
 raise exception 'six accounting tenant triggers not installed';end if;
if position('lock table' in lower(pg_get_functiondef('public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text)'::regprocedure)))<>0 then
 raise exception 'global table lock remains in publication RPC';end if;
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
) x(uid,org) loop
 if not exists(select 1 from public.accounting_plans where organization_id=t.org::uuid and status='published' and valid_to>=v_current) then
  raise exception 'test requires current/future published plan'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';

 c:=public.create_tenant_financial_category(t.org::uuid,'DEV GUARD CATEGORY',null,'member_receivable',false,false,false,'DEV inactive until mapped',gen_random_uuid()::text);
 if not exists(select 1 from public.financial_categories where id=c and organization_id=t.org::uuid and not active) then
  raise exception 'inactive category create failed';end if;

 begin
  perform public.create_tenant_financial_category(t.org::uuid,'DEV FORBIDDEN ACTIVE',null,'institutional_revenue',true,false,false,'DEV should be blocked',gen_random_uuid()::text);
  raise exception 'new active unmapped category allowed';
 exception when check_violation then null;
 end;

 a:=public.create_treasury_catalog_item(t.org::uuid,'account','DEV GUARD BANK','bank',null,null,null,'DEV needs future classification',gen_random_uuid()::text);
 if not exists(select 1 from public.financial_accounts where id=a and organization_id=t.org::uuid and not active) then
  raise exception 'new bank account did not start inactive';end if;
 begin
  perform public.set_treasury_catalog_status(t.org::uuid,'account',a,false,true,'DEV cannot activate unmapped',gen_random_uuid()::text);
  raise exception 'unmapped bank activation permitted';
 exception when check_violation then null;end;

 begin insert into public.financial_accounts(organization_id,name,account_type) values (t.org::uuid,'DEV DIRECT','cash');
  raise exception 'authenticated direct insert allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';

 begin
  update public.financial_categories set active=true where id=c;
  raise exception 'privileged SQL bypassed published-plan coverage';
 exception when check_violation then null;end;
 begin
  update public.financial_accounts set active=true where id=a;
  raise exception 'privileged SQL bypassed published-plan coverage for bank';
 exception when check_violation then null;end;
 select exists(select 1 from public.audit_logs where organization_id=t.org::uuid
    and action='treasury_catalog.create' and entity_id=a and after_data->>'active'='false') into audit_ok;
 if not audit_ok then raise exception 'inactive account audit inaccurate';end if;
end loop;
if has_function_privilege('authenticated','public.publish_accounting_plan(uuid,uuid)','execute')
   or has_function_privilege('anon','public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text)','execute') then
 raise exception 'publication ACL regression';end if;
if (select count(*) from public.charges)<>v_charges or
   (select count(*) from public.payments)<>v_payments or
   (select count(*) from public.accounting_plans where status='published')<>v_pub then
 raise exception 'financial or published plan fact changed';end if;
end $$;
rollback;
select 'DEV_TENANT_ACCOUNTING_GUARD_ROLLBACK_PASS' as result;
