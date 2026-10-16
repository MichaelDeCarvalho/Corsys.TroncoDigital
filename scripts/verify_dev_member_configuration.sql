begin;
do $$
declare t record; v_office uuid; v_other_office uuid; v_rule uuid; v_other_rule uuid; v_result uuid; v_key text; v_from date := (date_trunc('month',current_date)+interval '2 years')::date;
begin
-- Only temporary test eligibility; rollback preserves existing financial settings.
update public.financial_categories set allow_recurrence=true where id in ('dc24feaf-e897-483b-9c47-3b242289a40f','3f463a31-852f-4639-a80a-55498f4a41ec');
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','85cd325b-a667-481d-92e9-dc4776857962','dc24feaf-e897-483b-9c47-3b242289a40f'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539','20ec239c-36b4-46b3-af72-0f583a02cd93','3f463a31-852f-4639-a80a-55498f4a41ec')
) as x(uid,org,member,category) loop
insert into public.recurring_rules(organization_id,category_id,name,frequency,due_day) values(t.org::uuid,t.category::uuid,'DEV CONFIG ROLLBACK RULE','monthly',10);
insert into public.office_types(organization_id,name) values(t.org::uuid,'DEV CONFIG FOREIGN OFFICE');
end loop;
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','85cd325b-a667-481d-92e9-dc4776857962','20ec239c-36b4-46b3-af72-0f583a02cd93'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539','20ec239c-36b4-46b3-af72-0f583a02cd93','85cd325b-a667-481d-92e9-dc4776857962')
) as x(uid,org,member,foreign_member) loop
select id into v_rule from public.recurring_rules where organization_id=t.org::uuid and name='DEV CONFIG ROLLBACK RULE';
select id into v_other_rule from public.recurring_rules where organization_id<>t.org::uuid and name='DEV CONFIG ROLLBACK RULE';
select id into v_other_office from public.office_types where organization_id<>t.org::uuid and name='DEV CONFIG FOREIGN OFFICE';
perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true); execute 'set local role authenticated';
v_key:=gen_random_uuid()::text;
v_office:=public.create_member_office_type(t.org::uuid,'DEV CONFIG OWN OFFICE',v_key);
if v_office<>public.create_member_office_type(t.org::uuid,'DEV CONFIG OWN OFFICE',v_key) then raise exception 'office retry failed'; end if;
v_key:=gen_random_uuid()::text;
v_result:=public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,v_from,v_from,null,null,'DEV config test',v_key);
if v_result<>public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,v_from,v_from,null,null,'DEV config test',v_key) then raise exception 'schedule retry failed'; end if;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,v_from,v_from,null,null,'DEV duplicate',gen_random_uuid()::text); raise exception 'overlap accepted'; exception when exclusion_violation then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.foreign_member::uuid,'office',v_office,v_from,v_from,null,null,'DEV foreign member',gen_random_uuid()::text); raise exception 'foreign member accepted'; exception when foreign_key_violation then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_other_office,v_from,v_from,null,null,'DEV foreign office',gen_random_uuid()::text); raise exception 'foreign office accepted'; exception when foreign_key_violation then null; end;
v_result:=public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'override_amount',125.50,'DEV individual amount',gen_random_uuid()::text);
if not exists(select 1 from public.recurring_member_terms where id=v_result and override_amount=125.50) then raise exception 'positive amount missing'; end if;
perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,(v_from+interval '1 month')::date,(v_from+interval '1 month')::date,'exempt',null,'DEV exemption',gen_random_uuid()::text);
perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,(v_from+interval '2 months')::date,null,'standard',null,'DEV standard',gen_random_uuid()::text);
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'exempt',null,'DEV overlap term',gen_random_uuid()::text); raise exception 'term overlap accepted'; exception when exclusion_violation then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_other_rule,v_from,v_from,'exempt',null,'DEV foreign rule',gen_random_uuid()::text); raise exception 'foreign rule accepted'; exception when foreign_key_violation then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'override_amount',1.111,'DEV precision',gen_random_uuid()::text); raise exception 'precision accepted'; exception when invalid_parameter_value then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'override_amount','NaN'::numeric,'DEV nonfinite NaN',gen_random_uuid()::text); raise exception 'NaN accepted'; exception when invalid_parameter_value then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'override_amount','Infinity'::numeric,'DEV nonfinite infinity',gen_random_uuid()::text); raise exception 'Infinity accepted'; exception when invalid_parameter_value then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'override_amount',1000000000000,'DEV amount above precision',gen_random_uuid()::text); raise exception 'oversized amount accepted'; exception when invalid_parameter_value then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,date_trunc('month',current_date)::date,null,'exempt',null,'DEV retroactive',gen_random_uuid()::text); raise exception 'retroactive accepted'; exception when invalid_parameter_value then null; end;
execute 'reset role';
if (select count(*) from public.audit_logs where action='member_configuration.schedule' and after_data->>'member_id'=t.member)<>4 then raise exception 'audit events invalid'; end if;
update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='TREASURER') where user_id=t.uid::uuid;
execute 'set local role authenticated';
perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,(v_from+interval '1 day')::date,(v_from+interval '1 day')::date,null,null,'DEV treasurer own office',gen_random_uuid()::text);
begin perform public.create_member_office_type(t.org::uuid,'DEV treasurer denied',gen_random_uuid()::text); raise exception 'treasurer catalog accepted'; exception when insufficient_privilege then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,(v_from+interval '3 years')::date,null,'exempt',null,'DEV treasurer financial denied',gen_random_uuid()::text); raise exception 'treasurer terms accepted'; exception when insufficient_privilege then null; end;
execute 'reset role';
update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='VIEWER') where user_id=t.uid::uuid;
execute 'set local role authenticated';
begin perform public.create_member_office_type(t.org::uuid,'DEV viewer',gen_random_uuid()::text); raise exception 'viewer accepted'; exception when insufficient_privilege then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,v_from,null,null,null,'DEV viewer',gen_random_uuid()::text); raise exception 'viewer schedule accepted'; exception when insufficient_privilege then null; end;
execute 'reset role';
update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid;
update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
execute 'set local role authenticated';
begin perform public.create_member_office_type(t.org::uuid,'DEV suspended denied',gen_random_uuid()::text); raise exception 'suspended catalog accepted'; exception when insufficient_privilege then null; end;
begin perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'office',v_office,(v_from+interval '2 days')::date,null,null,null,'DEV suspended office',gen_random_uuid()::text); raise exception 'suspended schedule accepted'; exception when insufficient_privilege then null; end;
execute 'reset role';
update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
end loop;
if has_function_privilege('anon','public.create_member_office_type(uuid,text,text)','EXECUTE') or has_function_privilege('anon','public.schedule_member_configuration(uuid,uuid,text,uuid,date,date,text,numeric,text,text)','EXECUTE') then raise exception 'anon grants'; end if;
end $$;
rollback;
select 'DEV_MEMBER_CONFIGURATION_ROLLBACK_PASS' as result;
