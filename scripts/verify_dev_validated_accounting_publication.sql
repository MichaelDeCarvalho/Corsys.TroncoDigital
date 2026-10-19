-- DEV ONLY. Financial publication safety gate; all created plans and audit rows ROLLBACK.
begin;
do $$
declare t record;c record;a record;
 v_template uuid:='10000000-0000-4000-8000-000000000001';
 v_start date:=(date_trunc('year',current_date)+interval '9 years')::date;
 v_end date:=(date_trunc('year',current_date)+interval '10 years - 1 day')::date;
 v_plan uuid; v_incomplete uuid;v_overlap uuid;v_foreign uuid;
 v_target uuid;v_id uuid;v_key text;v_result uuid;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
 v_plans bigint:=(select count(*) from public.accounting_plans);
 v_published bigint:=(select count(*) from public.accounting_plans where status='published');
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
   perform set_config('request.jwt.claims',
      jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
   execute 'set local role authenticated';

   v_incomplete:=public.create_tenant_accounting_draft(t.org::uuid,'DEV PUBLISH INCOMPLETE',
     v_start,v_end,'template',v_template,'Test reject incomplete plan',gen_random_uuid()::text);
   begin
     perform public.publish_validated_accounting_plan(t.org::uuid,v_incomplete,
       v_start,v_end,'Attempt incomplete plan',gen_random_uuid()::text);
     raise exception 'incomplete plan accepted';
   exception when check_violation then null;
   end;

   v_plan:=public.create_tenant_accounting_draft(t.org::uuid,'DEV PUBLISH READY',
     v_start,v_end,'template',v_template,'Test future valid plan',gen_random_uuid()::text);
   if (select count(*) from public.accounting_accounts
        where organization_id=t.org::uuid and accounting_plan_id=v_plan)<>91 then
      raise exception 'accounting template not copied completely';
   end if;

   for c in select id,domain from public.financial_categories
     where organization_id=t.org::uuid and active loop
     select id into v_target from public.accounting_accounts
      where organization_id=t.org::uuid and accounting_plan_id=v_plan
      and row_type='analytic' and active and (
       (c.domain in ('member_receivable','institutional_revenue') and nature='revenue')
       or (c.domain='institutional_expense' and nature in ('cost','expense','financial_result')))
      order by code limit 1;
     if v_target is null then raise exception 'no category target for %',c.domain;end if;
     perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',
       c.id,v_target,null,'DEV mapping category',gen_random_uuid()::text);
   end loop;

   for a in select id from public.financial_accounts
     where organization_id=t.org::uuid and active loop
     select id into v_target from public.accounting_accounts
      where organization_id=t.org::uuid and accounting_plan_id=v_plan
       and row_type='analytic' and active and nature='patrimonial'
      order by code limit 1;
     if v_target is null then raise exception 'no patrimonial target';end if;
     perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'financial_account',
       a.id,v_target,null,'DEV mapping financial',gen_random_uuid()::text);
   end loop;

   if public.preview_accounting_plan_publication(t.org::uuid,v_plan)->>'ready'<>'true' then
     raise exception 'complete draft must pass preview';end if;

   -- A direct authenticated call to the weaker legacy RPC must not bypass validation.
   begin
     perform public.publish_accounting_plan(t.org::uuid,v_plan);
     raise exception 'legacy direct endpoint exposed';
   exception when insufficient_privilege then null;
   end;

   begin
     perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,(v_end-interval '1 month')::date,'Invalid expected dates',gen_random_uuid()::text);
     raise exception 'stale dates accepted';
   exception when sqlstate 'PT409' then null;
   end;

   v_key:=gen_random_uuid()::text;
   v_result:=public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'DEV approved future publication',v_key);
   if v_result<>v_plan or v_result<>public.publish_validated_accounting_plan(
       t.org::uuid,v_plan,v_start,v_end,'DEV approved future publication',v_key)
   then raise exception 'publish retry mismatch';end if;
   if not exists(select 1 from public.accounting_plans
       where organization_id=t.org::uuid and id=v_plan and status='published'
         and published_at is not null and published_by=t.uid::uuid)
     then raise exception 'plan was not published with actor';end if;

   begin
     perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'Second publication rejected',gen_random_uuid()::text);
     raise exception 'published plan unexpectedly republished';
   exception when sqlstate 'PT409' then null;
   end;

   begin
     perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'Reused key with different reason',v_key);
     raise exception 'reused key payload accepted';
   exception when invalid_parameter_value then null;
   end;

   begin
     perform public.set_draft_accounting_mapping(t.org::uuid,v_plan,'category',
       (select id from public.financial_categories
        where organization_id=t.org::uuid and active limit 1),
       (select id from public.accounting_accounts
         where accounting_plan_id=v_plan and nature='revenue' and row_type='analytic' limit 1),
       null,'Try edit published plan',gen_random_uuid()::text);
     raise exception 'published mapping modified';
   exception when foreign_key_violation then null;
   end;

   v_overlap:=public.create_tenant_accounting_draft(t.org::uuid,'DEV OVERLAPPING PUBLISH',
       v_start,v_end,'duplicate',v_plan,'Duplicate published chart for rejection',
       gen_random_uuid()::text);
   if public.preview_accounting_plan_publication(t.org::uuid,v_overlap)->'issues' ? 'published_overlap' = false then
      raise exception 'overlap not recognized';end if;
   begin
     perform public.publish_validated_accounting_plan(t.org::uuid,v_overlap,
       v_start,v_end,'Disallow concurrent validity',gen_random_uuid()::text);
     raise exception 'overlap publication accepted';
   exception when check_violation then null;
   end;

   execute 'reset role';
   if (select count(*) from public.audit_logs
     where organization_id=t.org::uuid and entity_id=v_plan
       and action='accounting_plan.validated_publish')<>1 then
       raise exception 'validated audit missing or duplicate';end if;
   if (select count(*) from public.audit_logs
     where organization_id=t.org::uuid and entity_id=v_plan
       and action='accounting_plan.publish')<>1 then
       raise exception 'legacy audit duplicate';end if;
 end loop;

 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
    select id into v_plan from public.accounting_plans
      where organization_id=t.org::uuid and name='DEV PUBLISH READY';
    select id into v_foreign from public.accounting_plans
      where organization_id<>t.org::uuid and name='DEV PUBLISH READY';
    perform set_config('request.jwt.claims',
       jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
    execute 'set local role authenticated';
    begin
      perform public.publish_validated_accounting_plan(t.org::uuid,v_foreign,
        v_start,v_end,'Attempt cross tenant plan',gen_random_uuid()::text);
      raise exception 'cross tenant publication accepted';
    exception when foreign_key_violation then null;
    end;
    execute 'reset role';
    update public.user_roles set role_id=(select id from public.roles
       where organization_id=t.org::uuid and code='TREASURER')
       where user_id=t.uid::uuid;
    execute 'set local role authenticated';
    begin
      perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'Treasurer must be blocked',gen_random_uuid()::text);
      raise exception 'treasurer published plan';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    update public.user_roles set role_id=(select id from public.roles
       where organization_id=t.org::uuid and code='VIEWER')
       where user_id=t.uid::uuid;
    execute 'set local role authenticated';
    begin
      perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'Viewer must be blocked',gen_random_uuid()::text);
      raise exception 'viewer published plan';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    update public.user_roles set role_id=(select id from public.roles
       where organization_id=t.org::uuid and code='ADMIN')
       where user_id=t.uid::uuid;
    update public.saas_subscriptions set status='suspended'
      where organization_id=t.org::uuid;
    execute 'set local role authenticated';
    begin
      perform public.publish_validated_accounting_plan(t.org::uuid,v_plan,
       v_start,v_end,'Suspended must be blocked',gen_random_uuid()::text);
      raise exception 'suspended publisher accepted';
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    update public.saas_subscriptions set status='active'
      where organization_id=t.org::uuid;
 end loop;

 if has_function_privilege('anon',
   'public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text)','execute')
   or has_function_privilege('authenticated',
     'public.publish_accounting_plan(uuid,uuid)','execute') then
   raise exception 'publication privileges incorrect';
 end if;
 if v_charges<>(select count(*) from public.charges)
   or v_payments<>(select count(*) from public.payments) then
   raise exception 'financial facts changed';end if;
 if v_published+2<>(select count(*) from public.accounting_plans where status='published') then
   raise exception 'unexpected publication count';end if;
 if (select count(*) from public.accounting_plans)<v_plans+6 then
   raise exception 'expected fixture plans missing';end if;
end $$;
rollback;
select 'DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS' as result;
