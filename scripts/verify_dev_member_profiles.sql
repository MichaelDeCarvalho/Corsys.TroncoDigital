-- DEV only; all fixtures and permission/status changes roll back.
begin;
do $$
declare t record; v_id uuid; v_again uuid; v_time timestamptz; v_new_time timestamptz; v_profile jsonb; v_key text;
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539','20ec239c-36b4-46b3-af72-0f583a02cd93'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','85cd325b-a667-481d-92e9-dc4776857962')
) as x(uid,org,other_org,other_member) loop
 v_profile := jsonb_build_object('full_name','DEV MEMBER PROFILE ROLLBACK','preferred_name','Teste','email','fiction@example.invalid','notes','private notes never in audit','status','active','admission_date','2026-10-08');
 v_key := gen_random_uuid()::text;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_id := public.save_member_profile(t.org::uuid,null,null,v_profile,'DEV member test',v_key);
 v_again := public.save_member_profile(t.org::uuid,null,null,v_profile,'DEV member test',v_key);
 if v_id<>v_again then raise exception 'idempotency failed'; end if;
 select updated_at into v_time from public.members where id=v_id and organization_id=t.org::uuid;
 if v_time is null then raise exception 'own positive missing'; end if;
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile||'{"full_name":"Changed"}','DEV member test',v_key); raise exception 'different payload accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_member_profile(t.other_org::uuid,null,null,v_profile,'DEV member test',gen_random_uuid()::text); raise exception 'cross organization accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_member_profile(t.org::uuid,t.other_member::uuid,v_time,v_profile,'DEV member test',gen_random_uuid()::text); raise exception 'foreign member accepted'; exception when foreign_key_violation then null; end;
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile||'{"organization_id":"other"}','DEV member test',gen_random_uuid()::text); raise exception 'mass assignment accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile||'{"admission_date":"2026-02-30"}','DEV member test',gen_random_uuid()::text); raise exception 'invalid date accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile||'{"full_name":" "}','DEV member test',gen_random_uuid()::text); raise exception 'empty name accepted'; exception when invalid_parameter_value then null; end;
 begin update public.members set full_name='DIRECT UPDATE' where id=v_id; raise exception 'direct write accepted'; exception when insufficient_privilege then null; end;
 v_again := public.save_member_profile(t.org::uuid,v_id,v_time,v_profile||'{"status":"away"}','DEV edit test',gen_random_uuid()::text);
 select updated_at into v_new_time from public.members where id=v_id;
 if v_again<>v_id or v_new_time<=v_time or not exists(select 1 from public.members where id=v_id and status='away') then raise exception 'edit/version failed'; end if;
 begin perform public.save_member_profile(t.org::uuid,v_id,v_time,v_profile,'DEV stale edit',gen_random_uuid()::text); raise exception 'stale edit accepted'; exception when sqlstate 'PT409' then null; end;
 execute 'reset role';
 if (select count(*) from public.audit_logs where entity_id=v_id and action in ('member.create','member.update'))<>2 then raise exception 'audit count failed'; end if;
 if exists(select 1 from public.audit_logs where entity_id=v_id and (before_data::text like '%private notes%' or after_data::text like '%fiction@%' or technical_context::text like '%private notes%')) then raise exception 'audit contains contact/notes'; end if;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile,'DEV suspended test',gen_random_uuid()::text); raise exception 'suspension accepted'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='VIEWER') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.save_member_profile(t.org::uuid,null,null,v_profile,'DEV viewer test',gen_random_uuid()::text); raise exception 'viewer accepted'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid and organization_id=t.org::uuid;
end loop;
perform set_config('request.jwt.claims','{"sub":"71e27b4c-f0ba-46f7-832f-4faf29e8603d","role":"authenticated","aal":"aal2"}',true);
execute 'set local role authenticated';
begin perform public.save_member_profile('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b',null,null,v_profile,'DEV Master denial',gen_random_uuid()::text); raise exception 'Master tenant write accepted'; exception when insufficient_privilege then null; end;
execute 'reset role';
if has_function_privilege('anon','public.save_member_profile(uuid,uuid,timestamptz,jsonb,text,text)','EXECUTE')
 or has_function_privilege('authenticated','private.normalize_member_profile(jsonb)','EXECUTE') then raise exception 'grants too broad'; end if;
end $$;
rollback;
select 'DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS' as result;
