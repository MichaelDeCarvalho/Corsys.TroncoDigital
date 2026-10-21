-- DEV gate: both real tenant IDs, simulated SQL claims, all fixtures rolled back.
begin;
do $$
declare t record;
 v_template uuid;v_plan uuid;v_duplicate uuid;v_rule_cat uuid;v_income uuid;v_income2 uuid;
 v_cash_account uuid;v_cash_target uuid;v_cat_mapping uuid;v_cash_mapping uuid;
 v_key text;v_from date:=(date_trunc('year',current_date)+interval '6 years')::date;
 v_to date:=(date_trunc('year',current_date)+interval '7 years -1 day')::date;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
begin
 select id into v_template from public.accounting_plan_templates where code='corsys_complete_br' and active;
 if v_template is null then raise exception 'template not available';end if;
 for t in select * from (values
  ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
  ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  v_key:=gen_random_uuid()::text;
  v_plan:=public.create_tenant_accounting_draft(t.org::uuid,'DEV V35 91 template',v_from,v_to,'template',v_template,'DEV template draft gate',v_key);
  if v_plan<>public.create_tenant_accounting_draft(t.org::uuid,'DEV V35 91 template',v_from,v_to,'template',v_template,'DEV template draft gate',v_key) then raise exception 'draft retry mismatch';end if;
  if (select count(*) from public.accounting_accounts where organization_id=t.org::uuid and accounting_plan_id=v_plan)<>91 then raise exception 'template 91 accounts incomplete';end if;
  if (select count(*) from public.accounting_accounts where organization_id=t.org::uuid and accounting_plan_id=v_plan and parent_account_id is not null)<>86 then raise exception 'template parent hierarchy lost';end if;
  if not exists(select 1 from public.accounting_plans where id=v_plan and organization_id=t.org::uuid and status='draft') then raise exception 'plan not draft';end if;
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV changed',v_from,v_to,'template',v_template,'DEV template changed',v_key);raise exception 'payload changed accepted';exception when invalid_parameter_value then null;end;
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV bad date',date_trunc('year',current_date)::date,v_to,'template',v_template,'DEV retroactive',gen_random_uuid()::text);raise exception 'retroactive draft accepted';exception when invalid_parameter_value then null;end;
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV bad source',v_from,v_to,'blank',v_template,'DEV malformed',gen_random_uuid()::text);raise exception 'invalid blank source accepted';exception when invalid_parameter_value then null;end;
  select c.id into v_rule_cat from public.financial_categories c where c.organization_id=t.org::uuid and c.domain='member_receivable' order by c.id limit 1;
  select a.id into v_cash_account from public.financial_accounts a where a.organization_id=t.org::uuid order by a.id limit 1;
  select a.id into v_income from public.accounting_accounts a where a.organization_id=t.org::uuid and a.accounting_plan_id=v_plan and a.nature='revenue' and a.row_type='analytic' and a.active order by a.code limit 1;
  select a.id into v_income2 from public.accounting_accounts a where a.organization_id=t.org::uuid and a.accounting_plan_id=v_plan and a.nature='revenue' and a.row_type='analytic' and a.active and a.id<>v_income order by a.code limit 1;
  select a.id into v_cash_target from public.accounting_accounts a where a.organization_id=t.org::uuid and a.accounting_plan_id=v_plan and a.nature='patrimonial' and a.row_type='analytic' and a.active order by a.code limit 1;
  if v_rule_cat is null or v_cash_account is null or v_income is null or v_income2 is null or v_cash_target is null then raise exception 'fixtures required for mappings missing';end if;
  v_key:=gen_random_uuid()::text;
  v_cat_mapping:=public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income,null,'DEV category mapping',v_key);
  if v_cat_mapping<>public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income,null,'DEV category mapping',v_key) then raise exception 'mapping retry mismatched';end if;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income2,null,'DEV changed mapping',v_key);raise exception 'changed mapping key accepted';exception when invalid_parameter_value then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income2,null,'DEV stale',gen_random_uuid()::text);raise exception 'stale mapping accepted';exception when sqlstate 'PT409' then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_cash_target,v_income,'DEV invalid nature',gen_random_uuid()::text);raise exception 'nature mismatch accepted';exception when check_violation then null;end;
  if public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income2,v_income,'DEV valid successor',gen_random_uuid()::text)<>v_cat_mapping then raise exception 'mapping update changed ID';end if;
  v_cash_mapping:=public.set_draft_accounting_mapping(t.org::uuid,v_plan,'financial_account',v_cash_account,v_cash_target,null,'DEV cash mapping',gen_random_uuid()::text);
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'financial_account',v_cash_account,v_income,v_cash_target,'DEV invalid cash nature',gen_random_uuid()::text);raise exception 'cash mapped to income';exception when check_violation then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'financial_account',gen_random_uuid(),v_cash_target,null,'DEV foreign account',gen_random_uuid()::text);raise exception 'unknown source accepted';exception when foreign_key_violation then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,gen_random_uuid(),v_income2,'DEV foreign target',gen_random_uuid()::text);raise exception 'unknown target accepted';exception when foreign_key_violation then null;end;
  v_duplicate:=public.create_tenant_accounting_draft(t.org::uuid,'DEV duplicated from template draft',v_from,v_to,'duplicate',v_plan,'DEV duplicate gate',gen_random_uuid()::text);
  if (select count(*) from public.accounting_accounts where organization_id=t.org::uuid and accounting_plan_id=v_duplicate)<>91 then raise exception 'duplicate did not copy full hierarchy';end if;
  if (select count(*) from public.financial_category_account_mappings where organization_id=t.org::uuid and accounting_plan_id=v_duplicate)<>1 then raise exception 'duplicate category mapping not copied';end if;
  if (select count(*) from public.financial_account_accounting_mappings where organization_id=t.org::uuid and accounting_plan_id=v_duplicate)<>1 then raise exception 'duplicate financial mapping not copied';end if;
  begin insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification) values(t.org::uuid,v_plan,'FORBIDDEN','No direct writes','analytic','revenue','ad_hoc');raise exception 'direct accounting insert accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  if (select count(*) from public.audit_logs where organization_id=t.org::uuid and action='accounting_plan.mapping_set' and entity_id in (v_cat_mapping,v_cash_mapping))<>3 then raise exception 'mapping audit count incorrect';end if;
  if (select count(*) from public.audit_logs where organization_id=t.org::uuid and action='accounting_plan.draft_request' and entity_id in (v_plan,v_duplicate))<>2 then raise exception 'draft audit count incorrect';end if;
 end loop;
 for t in select * from (values
  ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
  ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
  select p.id into v_plan from public.accounting_plans p where p.organization_id=t.org::uuid and p.name='DEV V35 91 template';
  select p.id into v_duplicate from public.accounting_plans p where p.organization_id<>t.org::uuid and p.name='DEV V35 91 template';
  select a.id into v_income from public.accounting_accounts a where a.accounting_plan_id=v_duplicate and a.row_type='analytic' limit 1;
  select c.id into v_rule_cat from public.financial_categories c where c.organization_id=t.org::uuid and c.domain='member_receivable' limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV foreign source',v_from,v_to,'duplicate',v_duplicate,'DEV cross tenant',gen_random_uuid()::text);raise exception 'foreign plan copy accepted';exception when foreign_key_violation then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_duplicate,'category',v_rule_cat,v_income,null,'DEV foreign plan',gen_random_uuid()::text);raise exception 'foreign plan mapping accepted';exception when foreign_key_violation then null;end;
  if exists(select 1 from public.accounting_plans where id=v_duplicate) then raise exception 'RLS leaked foreign plan';end if;
  select p.id into v_duplicate from public.accounting_plans p where p.organization_id=t.org::uuid and p.status='published' order by valid_from limit 1;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_duplicate,'category',v_rule_cat,v_income,null,'DEV published mutation',gen_random_uuid()::text);raise exception 'published mutation accepted';exception when foreign_key_violation then null;end;
  execute 'reset role';
  update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='TREASURER') where user_id=t.uid::uuid;
  execute 'set local role authenticated';
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV treasurer',v_from,v_to,'blank',null,'DEV denied',gen_random_uuid()::text);raise exception 'treasurer draft accepted';exception when insufficient_privilege then null;end;
  begin perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',v_rule_cat,v_income,null,'DEV denied',gen_random_uuid()::text);raise exception 'treasurer mapping accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='VIEWER') where user_id=t.uid::uuid;
  execute 'set local role authenticated';
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV viewer',v_from,v_to,'blank',null,'DEV denied',gen_random_uuid()::text);raise exception 'viewer draft accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  update public.user_roles set role_id=(select r.id from public.roles r where r.organization_id=t.org::uuid and r.code='ADMIN') where user_id=t.uid::uuid;
  update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
  execute 'set local role authenticated';
  begin perform public.create_tenant_accounting_draft(t.org::uuid,'DEV suspended',v_from,v_to,'blank',null,'DEV denied',gen_random_uuid()::text);raise exception 'suspended draft accepted';exception when insufficient_privilege then null;end;
  execute 'reset role';
  update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
 end loop;
 if has_function_privilege('anon','public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text)','execute')
 or has_function_privilege('anon','public.set_draft_accounting_mapping(uuid,uuid,text,uuid,uuid,uuid,text,text)','execute')
 then raise exception 'anonymous execute granted';end if;
 if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments) then raise exception 'financial facts changed';end if;
end $$;
rollback;
select 'DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS' as result;
