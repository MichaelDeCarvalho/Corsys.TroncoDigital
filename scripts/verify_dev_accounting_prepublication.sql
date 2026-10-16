-- DEV ONLY: pre-publication diagnostics, two tenants, rollback all fixture changes.
begin;
do $$
declare t record; c record; a record;
 v_template uuid:='10000000-0000-4000-8000-000000000001'::uuid;
 v_plan uuid;v_empty uuid;v_overlap uuid;v_foreign uuid;v_target uuid;
 v_source uuid;v_preview jsonb;v_result jsonb;
 v_from date:=(date_trunc('year',current_date)+interval '8 years')::date;
 v_to date:=(date_trunc('year',current_date)+interval '9 years - 1 day')::date;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
 v_plan_count bigint:=(select count(*) from public.accounting_plans);
 v_accounts bigint:=(select count(*) from public.accounting_accounts);
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_plan:=public.create_tenant_accounting_draft(t.org::uuid,'DEV PREVIEW COMPLETE',v_from,v_to,'template',v_template,
    'DEV preview test',gen_random_uuid()::text);
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_plan);
 if v_result->>'ready'<>'false'
   or not (v_result->'issues' ? 'categories_unmapped')
   or not (v_result->'issues' ? 'cash_accounts_unmapped')
   or (v_result->>'account_count')::integer<>91
 then raise exception 'incomplete plan incorrectly ready or missing 91 accounts: %',v_result;end if;
 for c in select id,domain from public.financial_categories
   where organization_id=t.org::uuid and active order by id loop
  select id into v_target from public.accounting_accounts
   where organization_id=t.org::uuid and accounting_plan_id=v_plan and row_type='analytic' and active
     and ( (c.domain in ('member_receivable','institutional_revenue') and nature='revenue')
       or (c.domain='institutional_expense' and nature in ('cost','expense','financial_result')) )
   order by code limit 1;
  if v_target is null then raise exception 'fixture category nature unavailable';end if;
  perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',c.id,v_target,null,
   'DEV complete category',gen_random_uuid()::text);
 end loop;
 for a in select id from public.financial_accounts
   where organization_id=t.org::uuid and active order by id loop
  select id into v_target from public.accounting_accounts
   where organization_id=t.org::uuid and accounting_plan_id=v_plan and row_type='analytic' and active
    and nature='patrimonial' order by code limit 1;
  if v_target is null then raise exception 'fixture patrimonial account unavailable';end if;
  perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'financial_account',a.id,v_target,null,
   'DEV complete financial',gen_random_uuid()::text);
 end loop;
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_plan);
 if v_result->>'ready'<>'true' or jsonb_array_length(v_result->'issues')<>0
   or (v_result->>'missing_category_count')::integer<>0
   or (v_result->>'missing_financial_account_count')::integer<>0
 then raise exception 'complete draft flagged not ready: %',v_result;end if;
 -- Deliberately invalidate an active analytic mapping without changing posted facts.
 execute 'reset role';
 select accounting_account_id into v_target from public.financial_category_account_mappings
  where organization_id=t.org::uuid and accounting_plan_id=v_plan order by id limit 1;
 update public.accounting_accounts set active=false where id=v_target;
 execute 'set local role authenticated';
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_plan);
 if not (v_result->'issues' ? 'invalid_category_mappings') or v_result->>'ready'<>'false'
 then raise exception 'inactive mapping target not caught: %',v_result;end if;
 execute 'reset role';
 update public.accounting_accounts set active=true where id=v_target;
 -- Make an analytic account self-parented: should detect both cycle and invalid parent kind.
 select id into v_source from public.accounting_accounts
 where organization_id=t.org::uuid and accounting_plan_id=v_plan and row_type='analytic'
 order by code limit 1;
 update public.accounting_accounts set parent_account_id=id where id=v_source;
 execute 'set local role authenticated';
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_plan);
 if not (v_result->'issues' ? 'hierarchy_cycle') or not (v_result->'issues' ? 'invalid_hierarchy')
 then raise exception 'hierarchy cycle undetected: %',v_result;end if;
 execute 'reset role';
 update public.accounting_accounts set parent_account_id=null where id=v_source;
 execute 'set local role authenticated';
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_plan);
 if v_result->>'ready'<>'true' then raise exception 'repaired plan still blocked: %',v_result;end if;
 v_empty:=public.create_tenant_accounting_draft(t.org::uuid,'DEV EMPTY PREVIEW',v_from,v_to,
   'blank',null,'DEV empty plan',gen_random_uuid()::text);
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_empty);
 if not (v_result->'issues' ? 'empty_chart') or not (v_result->'issues' ? 'no_active_analytic')
 then raise exception 'empty chart not blocked: %',v_result;end if;
 v_overlap:=public.create_tenant_accounting_draft(t.org::uuid,'DEV OVERLAP PREVIEW',
   '2027-01-01'::date,'2027-12-31'::date,'template',v_template,
   'DEV overlap',gen_random_uuid()::text);
 v_result:=public.preview_accounting_plan_publication(t.org::uuid,v_overlap);
 if not (v_result->'issues' ? 'published_overlap') then raise exception 'published overlap not detected: %',v_result;end if;
 begin perform public.preview_accounting_plan_publication(t.org::uuid,gen_random_uuid());raise exception 'unknown plan allowed';
 exception when foreign_key_violation then null;end;
 if has_function_privilege('anon','public.preview_accounting_plan_publication(uuid,uuid)','execute') then raise exception 'anon privilege';end if;
 execute 'reset role';
 end loop;
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
 select id into v_plan from public.accounting_plans where organization_id=t.org::uuid and name='DEV PREVIEW COMPLETE';
 select id into v_foreign from public.accounting_plans where organization_id<>t.org::uuid and name='DEV PREVIEW COMPLETE';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin perform public.preview_accounting_plan_publication(t.org::uuid,v_foreign);raise exception 'cross tenant plan allowed';
 exception when foreign_key_violation then null;end;
 if exists(select 1 from public.accounting_plans where id=v_foreign) then raise exception 'RLS foreign plan exposed';end if;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='TREASURER') where user_id=t.uid::uuid;
 execute 'set local role authenticated';
 begin perform public.preview_accounting_plan_publication(t.org::uuid,v_plan);raise exception 'TREASURER preview allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='VIEWER') where user_id=t.uid::uuid;
 execute 'set local role authenticated';
 begin perform public.preview_accounting_plan_publication(t.org::uuid,v_plan);raise exception 'VIEWER preview allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.preview_accounting_plan_publication(t.org::uuid,v_plan);raise exception 'suspended preview allowed';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
 end loop;
 if v_charges<>(select count(*) from public.charges)
   or v_payments<>(select count(*) from public.payments)
 then raise exception 'financial ledger changed by preview';end if;
 if v_plan_count>(select count(*) from public.accounting_plans)
   or v_accounts>(select count(*) from public.accounting_accounts)
 then raise exception 'unexpected draft removal';end if;
end $$;
rollback;
select 'DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS' as result;