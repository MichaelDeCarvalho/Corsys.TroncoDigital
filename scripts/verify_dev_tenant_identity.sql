begin;
do $$
declare t record; k text; v_old timestamptz; v_new timestamptz; v_return uuid; before_count bigint := (select count(*) from public.charges);
begin
for t in select * from (values
('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')) x(uid,org) loop
perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);execute 'set local role authenticated';
k:=gen_random_uuid()::text;
v_return:=public.save_tenant_identity(t.org::uuid,null,'(41) 99999-9999','loja@example.invalid','dev-pix-private','Rua da Loja','83000-000','Curitiba','PR','BR','DEV initial setting',k);
if v_return<>t.org::uuid or public.save_tenant_identity(t.org::uuid,null,'(41) 99999-9999','loja@example.invalid','dev-pix-private','Rua da Loja','83000-000','Curitiba','PR','BR','DEV initial setting',k)<>v_return then raise exception 'retry failure';end if;
select updated_at into v_old from public.organization_settings where organization_id=t.org::uuid;
perform public.save_tenant_identity(t.org::uuid,v_old,null,'loja@example.invalid',null,'Outra rua',null,'Curitiba','PR','BR','DEV change setting',gen_random_uuid()::text);
select updated_at into v_new from public.organization_settings where organization_id=t.org::uuid;
if v_new<=v_old then raise exception 'timestamp not monotonic';end if;
begin perform public.save_tenant_identity(t.org::uuid,v_old,null,null,null,null,null,null,null,'BR','DEV stale',gen_random_uuid()::text);raise exception 'stale allowed';exception when serialization_failure then null;end;
begin perform public.save_tenant_identity(t.org::uuid,null,null,null,null,null,null,null,null,'BR','DEV exists',gen_random_uuid()::text);raise exception 'duplicate creation';exception when serialization_failure then null;end;
begin perform public.save_tenant_identity(t.org::uuid,v_new,null,'invalid-email',null,null,null,null,null,'BR','DEV invalid',gen_random_uuid()::text);raise exception 'invalid email allowed';exception when invalid_parameter_value then null;end;
if (select count(*) from public.audit_logs where action='organization.identity_save' and organization_id=t.org::uuid)<>2 then raise exception 'audit wrong';end if;
if exists(select 1 from public.audit_logs where action='organization.identity_save' and organization_id=t.org::uuid and (coalesce(before_data::text,'')||coalesce(after_data::text,'')) like '%dev-pix-private%') then raise exception 'audit secret leaked';end if;
begin update public.organization_settings set phone='unsafe' where organization_id=t.org::uuid;raise exception 'direct write';exception when insufficient_privilege then null;end;
execute 'reset role';
update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='TREASURER') where user_id=t.uid::uuid;
execute 'set local role authenticated';
begin perform public.save_tenant_identity(t.org::uuid,null,null,null,null,null,null,null,null,'BR','DEV treasurer',gen_random_uuid()::text);raise exception 'treasurer allowed';exception when insufficient_privilege then null;end;
execute 'reset role';
update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='VIEWER') where user_id=t.uid::uuid;
execute 'set local role authenticated';
begin perform public.save_tenant_identity(t.org::uuid,null,null,null,null,null,null,null,null,'BR','DEV viewer',gen_random_uuid()::text);raise exception 'viewer allowed';exception when insufficient_privilege then null;end;
execute 'reset role';
update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='ADMIN') where user_id=t.uid::uuid;
update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
execute 'set local role authenticated';
begin perform public.save_tenant_identity(t.org::uuid,null,null,null,null,null,null,null,null,'BR','DEV suspended',gen_random_uuid()::text);raise exception 'suspended allowed';exception when insufficient_privilege then null;end;
execute 'reset role';
update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
end loop;
if has_function_privilege('anon','public.save_tenant_identity(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text)','execute') then raise exception 'anon execute';end if;
if before_count<>(select count(*) from public.charges) then raise exception 'ledger changed';end if;
end $$;
rollback;
select 'DEV_TENANT_IDENTITY_ROLLBACK_PASS' as result;
