-- Authorized DEV fixtures only; simulated claims, not real JWT/HTTP/MFA.
-- All facts, subscriptions, configuration and audit entries roll back.
begin;
do $$
declare
  v_org uuid; v_other uuid; v_user uuid; v_other_member uuid;
  v_member uuid; v_category uuid; v_method uuid; v_account uuid;
  v_plan uuid; v_revenue_account uuid; v_saas_plan uuid; v_version uuid; v_subscription uuid;
  v_charge uuid; v_payment uuid; v_allocation uuid; v_repeat uuid; v_key text;
  v_status text; v_count bigint;
begin
  foreach v_org in array array[
    'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,
    'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid
  ] loop
    select ur.user_id into strict v_user from public.user_roles ur
    join public.roles r on r.id=ur.role_id and r.code='ADMIN'
    join public.organizations o on o.id=ur.organization_id
    where ur.organization_id=v_org and o.name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B');
    select id into strict v_other from public.organizations
    where name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B') and id<>v_org;
    select id into v_other_member from public.members where organization_id=v_other order by id limit 1;
    if v_other_member is null
      or exists(select 1 from public.accounting_plans where organization_id=v_org)
      or exists(select 1 from public.saas_subscriptions where organization_id=v_org) then
      raise exception 'Fixture changed; inspect before running';
    end if;
    insert into public.members(organization_id,full_name)
      values(v_org,'DEV RPC transaction-only member') returning id into v_member;
    insert into public.financial_categories(organization_id,name,domain)
      values(v_org,'DEV RPC category','member_receivable') returning id into v_category;
    insert into public.payment_methods(organization_id,name)
      values(v_org,'DEV RPC PIX') returning id into v_method;
    insert into public.financial_accounts(organization_id,name,account_type)
      values(v_org,'DEV RPC bank','bank') returning id into v_account;
    insert into public.accounting_plans(organization_id,name,valid_from,valid_to)
      values(v_org,'DEV RPC accounting plan','2026-01-01','2026-12-31') returning id into v_plan;
    insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification)
      values(v_org,v_plan,'1','DEV RPC revenue','analytic','revenue','recurring') returning id into v_revenue_account;
    insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id)
      values(v_org,v_plan,v_category,v_revenue_account);
    update public.accounting_plans set status='published',published_at=now() where id=v_plan;
    insert into public.saas_plans(code,name,price)
      values('dev_rpc_'||replace(gen_random_uuid()::text,'-',''),'DEV RPC transaction-only',0) returning id into v_saas_plan;
    insert into public.saas_plan_versions(plan_id,version_number,status,price,valid_from,display_name_snapshot,internal_code_snapshot,published_by,published_at)
      values(v_saas_plan,1,'published',0,current_date,'DEV RPC','dev_rpc',v_user,now()) returning id into v_version;
    insert into public.saas_tenant_accounts(organization_id,access_override)
      values(v_org,'none') on conflict(organization_id) do update set access_override='none';
    insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status)
      values(v_org,v_saas_plan,v_version,'active') returning id into v_subscription;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated','aal','aal1')::text,true);
    execute 'set local role authenticated';
    v_key:='dev-rpc-charge-'||gen_random_uuid();
    v_charge:=public.create_manual_charge(v_org,v_member,v_category,'DEV RPC charge','2026-09-01','2026-09-01','2026-09-10','2026-09-01',100,null,v_key);
    v_repeat:=public.create_manual_charge(v_org,v_member,v_category,'DEV RPC charge','2026-09-01','2026-09-01','2026-09-10','2026-09-01',100,null,v_key);
    if v_repeat<>v_charge then raise exception 'Repeated charge returned different ID'; end if;
    begin
      perform public.create_manual_charge(v_org,v_member,v_category,'DEV RPC charge','2026-09-01','2026-09-01','2026-09-10','2026-09-01',101,null,v_key);
      raise exception 'Changed payload accepted with same idempotency key';
    exception when sqlstate '22023' then null;
    end;
    v_key:='dev-rpc-payment-'||gen_random_uuid();
    v_payment:=public.register_payment(v_org,v_member,'2026-09-05','2026-09-01',150,v_method,v_account,null,null,v_key);
    v_repeat:=public.register_payment(v_org,v_member,'2026-09-05','2026-09-01',150,v_method,v_account,null,null,v_key);
    if v_repeat<>v_payment then raise exception 'Repeated payment returned different ID'; end if;
    v_key:='dev-rpc-allocation-'||gen_random_uuid();
    v_allocation:=public.allocate_payment_to_charge(v_org,v_payment,v_charge,100,'2026-09-01',v_key);
    v_repeat:=public.allocate_payment_to_charge(v_org,v_payment,v_charge,100,'2026-09-01',v_key);
    if v_repeat<>v_allocation then raise exception 'Repeated allocation returned different ID'; end if;
    if not exists(select 1 from public.v_member_financial_position
      where organization_id=v_org and member_id=v_member
      and open_receivables=0 and available_payment_credit=50 and net_position=-50 and integrity_ok) then
      raise exception 'Own financial view missing or wrong';
    end if;
    if exists(select 1 from public.v_member_financial_position where organization_id=v_other)
      or exists(select 1 from public.v_charge_balances where organization_id=v_other) then
      raise exception 'Foreign financial rows visible';
    end if;
    select count(*) into v_count from public.audit_logs
      where organization_id=v_org and actor_user_id=v_user
        and entity_id in(v_charge,v_payment,v_allocation);
    if v_count<>3 then raise exception 'Expected exactly three command audit entries, got %',v_count; end if;
    begin
      perform public.allocate_payment_to_charge(v_org,v_payment,v_charge,1,'2026-09-01','dev-rpc-over-'||gen_random_uuid());
      raise exception 'Over-allocation accepted';
    exception when check_violation then null;
    end;
    begin
      perform public.create_manual_charge(v_other,v_other_member,v_category,'Denied foreign org','2026-09-01','2026-09-01','2026-09-10','2026-09-01',10,null,'dev-rpc-cross-'||gen_random_uuid());
      raise exception 'Foreign organization accepted';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.create_manual_charge(v_org,v_other_member,v_category,'Denied foreign member','2026-09-01','2026-09-01','2026-09-10','2026-09-01',10,null,'dev-rpc-cross-member-'||gen_random_uuid());
      raise exception 'Foreign member accepted';
    exception when foreign_key_violation then null;
    end;
    execute 'reset role';
    foreach v_status in array array['suspended','past_due','canceled'] loop
      update public.saas_subscriptions set status=v_status,grace_until=now()-interval '1 day' where id=v_subscription;
      execute 'set local role authenticated';
      begin
        perform public.register_payment(v_org,v_member,'2026-09-05','2026-09-01',10,v_method,v_account,null,null,'dev-rpc-blocked-'||gen_random_uuid());
        raise exception 'Blocked subscription accepted payment';
      exception when insufficient_privilege then null;
      end;
      if not exists(select 1 from public.v_member_financial_position where member_id=v_member and net_position=-50) then
        raise exception 'Suspension removed financial read access';
      end if;
      execute 'reset role';
    end loop;
    update public.saas_subscriptions set status='active' where id=v_subscription;
    -- Each iteration checks a different organization. All fixtures and audit
    -- entries from both iterations are discarded by the final ROLLBACK.
  end loop;
end;
$$;
rollback;
select 'DEV_FINANCIAL_RPC_PASS (two tenants; simulated claims; sequential retries only)' as result;
