begin;
do $$
declare t record; v_category uuid; v_other_category uuid; v_rule uuid; v_other_rule uuid; v_initial uuid; v_new uuid; v_other_version uuid; v_key text; v_from date:=(date_trunc('month',current_date)+interval '2 years')::date;
 v_charges bigint:=(select count(*) from public.charges); v_payments bigint:=(select count(*) from public.payments);
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','94b84958-4dd9-435d-9a4e-244220835d70','d5842ad6-913d-4a3e-8250-876fb2e2a215'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','7a6aa771-524d-4d5a-9d38-7006175e1cb4','23bdcd76-b7a2-47b5-9f65-267d4c1053be')
) x(uid,org,member) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true); execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_category:=public.create_tenant_financial_category(t.org::uuid,'DEV RULE CATALOG ROLLBACK',null,'member_receivable',false,true,false,'DEV category create',v_key);
 if v_category<>public.create_tenant_financial_category(t.org::uuid,'DEV RULE CATALOG ROLLBACK',null,'member_receivable',false,true,false,'DEV category create',v_key) then raise exception 'category retry'; end if;
 begin perform public.create_tenant_financial_category(t.org::uuid,'DEV CHANGED',null,'member_receivable',false,true,false,'DEV category create',v_key); raise exception 'changed retry accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.create_tenant_financial_category(t.org::uuid,'dev rule catalog rollback',null,'member_receivable',false,true,false,'DEV duplicate',gen_random_uuid()::text); raise exception 'duplicate accepted'; exception when unique_violation then null; end;
 begin perform public.create_tenant_financial_category(t.org::uuid,'DEV neutral',null,'neutral',true,false,false,'DEV unsupported neutral',gen_random_uuid()::text); raise exception 'unsupported domain accepted'; exception when invalid_parameter_value then null; end;
 v_key:=gen_random_uuid()::text;
 select id into strict v_category from public.financial_categories where organization_id=t.org::uuid and active and allow_recurrence and domain='member_receivable' order by id limit 1;
 v_rule:=public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV MONTHLY CATALOG ROLLBACK',150.25,v_from,31,'DEV monthly create',v_key);
 if v_rule<>public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV MONTHLY CATALOG ROLLBACK',150.25,v_from,31,'DEV monthly create',v_key) then raise exception 'rule retry'; end if;
 select id into v_initial from public.recurring_rule_versions where recurring_rule_id=v_rule;
 v_key:=gen_random_uuid()::text;
 v_new:=public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_initial,180.50,(v_from+interval '2 months')::date,'DEV future price',v_key);
 if v_new<>public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_initial,180.50,(v_from+interval '2 months')::date,'DEV future price',v_key) then raise exception 'price retry'; end if;
 if not exists(select 1 from public.recurring_rule_versions where id=v_initial and unit_amount=150.25 and valid_to_competence=(v_from+interval '1 month')::date) then raise exception 'original price changed or boundary wrong'; end if;
 if not exists(select 1 from public.recurring_rule_versions where id=v_new and unit_amount=180.50 and valid_to_competence is null) then raise exception 'new price missing'; end if;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_initial,200,(v_from+interval '3 months')::date,'DEV stale',gen_random_uuid()::text); raise exception 'stale accepted'; exception when sqlstate 'PT409' then null; end;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_new,200,v_from,'DEV overlap',gen_random_uuid()::text); raise exception 'overlap accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV NaN','NaN'::numeric,v_from,10,'DEV NaN',gen_random_uuid()::text); raise exception 'NaN accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_new,'Infinity'::numeric,(v_from+interval '3 months')::date,'DEV infinity',gen_random_uuid()::text); raise exception 'Infinity accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV precision',1.111,v_from,10,'DEV precision',gen_random_uuid()::text); raise exception 'precision accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV retroactive',150,date_trunc('month',current_date)::date,10,'DEV retroactive',gen_random_uuid()::text); raise exception 'retroactive accepted'; exception when invalid_parameter_value then null; end;
 perform public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,v_from,'exempt',null,'DEV eligible new rule',gen_random_uuid()::text);
 begin insert into public.recurring_rules(organization_id,category_id,name,frequency,due_day) values(t.org::uuid,v_category,'DEV direct write','monthly',10); raise exception 'direct write accepted'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 if (select count(*) from public.audit_logs where entity_id=v_rule and action in ('recurring_rule.create','recurring_rule.price_schedule'))<>2 then raise exception 'audit duplicate or missing'; end if;
end loop;
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','94b84958-4dd9-435d-9a4e-244220835d70'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','7a6aa771-524d-4d5a-9d38-7006175e1cb4')
) x(uid,org) loop
 select id into v_category from public.financial_categories where organization_id=t.org::uuid and name='DEV RULE CATALOG ROLLBACK';
 select id into v_other_category from public.financial_categories where organization_id<>t.org::uuid and name='DEV RULE CATALOG ROLLBACK';
 select id into v_rule from public.recurring_rules where organization_id=t.org::uuid and name='DEV MONTHLY CATALOG ROLLBACK';
 select id into v_other_rule from public.recurring_rules where organization_id<>t.org::uuid and name='DEV MONTHLY CATALOG ROLLBACK';
 select id into v_new from public.recurring_rule_versions where recurring_rule_id=v_rule and valid_to_competence is null;
 select id into v_other_version from public.recurring_rule_versions where recurring_rule_id=v_other_rule and valid_to_competence is null;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true); execute 'set local role authenticated';
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_other_category,'DEV foreign category',150,v_from,10,'DEV foreign',gen_random_uuid()::text); raise exception 'foreign category accepted'; exception when foreign_key_violation then null; end;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_other_rule,v_other_version,150,(v_from+interval '3 months')::date,'DEV foreign rule',gen_random_uuid()::text); raise exception 'foreign rule accepted'; exception when foreign_key_violation then null; end;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_other_version,150,(v_from+interval '3 months')::date,'DEV foreign version',gen_random_uuid()::text); raise exception 'foreign version accepted'; exception when foreign_key_violation then null; end;
 if exists(select 1 from public.recurring_rules where id=v_other_rule) or exists(select 1 from public.recurring_rule_versions where id=v_other_version) or exists(select 1 from public.financial_categories where id=v_other_category) then raise exception 'foreign read exposed'; end if;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='TREASURER') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.create_tenant_financial_category(t.org::uuid,'DEV Treasurer',null,'member_receivable',true,true,false,'DEV denied',gen_random_uuid()::text); raise exception 'treasurer accepted'; exception when insufficient_privilege then null; end;
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV Treasurer',150,v_from,10,'DEV denied',gen_random_uuid()::text); raise exception 'treasurer rule accepted'; exception when insufficient_privilege then null; end;
 begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_new,150,(v_from+interval '3 months')::date,'DEV denied',gen_random_uuid()::text); raise exception 'treasurer price accepted'; exception when insufficient_privilege then null; end;
 execute 'reset role'; update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid; execute 'set local role authenticated';
 begin perform public.create_tenant_monthly_rule(t.org::uuid,v_category,'DEV Suspended',150,v_from,10,'DEV denied',gen_random_uuid()::text); raise exception 'suspended accepted'; exception when insufficient_privilege then null; end;
 begin perform public.create_tenant_financial_category(t.org::uuid,'DEV Suspended',null,'member_receivable',true,true,false,'DEV denied',gen_random_uuid()::text); raise exception 'suspended category accepted'; exception when insufficient_privilege then null; end;
begin perform public.schedule_tenant_monthly_price(t.org::uuid,v_rule,v_new,150,(v_from+interval '3 months')::date,'DEV denied',gen_random_uuid()::text); raise exception 'suspended price accepted'; exception when insufficient_privilege then null; end;
execute 'reset role'; update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
end loop;
if has_function_privilege('anon','public.create_tenant_financial_category(uuid,text,text,text,boolean,boolean,boolean,text,text)','execute') or has_function_privilege('anon','public.create_tenant_monthly_rule(uuid,uuid,text,numeric,date,integer,text,text)','execute') or has_function_privilege('anon','public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text)','execute') then raise exception 'anonymous execute'; end if;
if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments) then raise exception 'catalog generated financial facts'; end if;
end $$;
rollback;
select 'DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS' as result;
