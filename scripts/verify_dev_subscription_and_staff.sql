-- Authorized Corsys DEV fixtures only. Simulated claims, not signed JWT/MFA proof.
-- Run with the DEV SQL connector. All setup/status/staff changes roll back.
begin;
do $$
declare
  v_org uuid; v_a uuid; v_b uuid; v_plan uuid; v_version uuid; v_subscription uuid;
  v_permission text; v_status text; v_role text;
begin
  select o.id,ur.user_id into strict v_org,v_a
  from public.organizations o join public.user_roles ur on ur.organization_id=o.id
  join public.roles r on r.id=ur.role_id and r.code='ADMIN'
  where o.name='CORSYS DEV TENANT A';
  select ur.user_id into strict v_b
  from public.organizations o join public.user_roles ur on ur.organization_id=o.id
  join public.roles r on r.id=ur.role_id and r.code='ADMIN'
  where o.name='CORSYS DEV TENANT B';
  if v_a=v_b or exists(select 1 from public.platform_staff where user_id in(v_a,v_b))
    or exists(select 1 from public.saas_subscriptions where organization_id=v_org) then
    raise exception 'Expected unchanged DEV fixtures without staff/subscription; inspect before running';
  end if;
  select rp.permission_code into strict v_permission
  from public.role_permissions rp join public.roles r on r.id=rp.role_id
  where r.organization_id=v_org and r.code='ADMIN'
    and rp.permission_code not in ('members.read','finance.read','reports.read','audit.read')
  order by rp.permission_code limit 1;
  insert into public.saas_plans(code,name,price)
  values('dev_gate_'||replace(gen_random_uuid()::text,'-',''),'DEV transaction-only gate',0)
  returning id into v_plan;
  insert into public.saas_plan_versions(plan_id,version_number,status,price,valid_from,display_name_snapshot,internal_code_snapshot,published_by,published_at)
  values(v_plan,1,'published',0,current_date,'DEV transaction-only gate','dev_gate',v_a,now()) returning id into v_version;
  insert into public.saas_tenant_accounts(organization_id,access_override)
  values(v_org,'none') on conflict(organization_id) do update set access_override='none';
  insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status)
  values(v_org,v_plan,v_version,'active') returning id into v_subscription;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated','aal','aal1')::text,true);
  foreach v_status in array array['active','trialing','past_due'] loop
    update public.saas_subscriptions set status=v_status,grace_until=now()+interval '1 day' where id=v_subscription;
    if not private.tenant_write_allowed(v_org) then raise exception 'Allowed status blocked: %',v_status; end if;
    perform private.require_permission(v_org,v_permission);
  end loop;
  foreach v_status in array array['past_due','suspended','canceled'] loop
    update public.saas_subscriptions set status=v_status,grace_until=now()-interval '1 day' where id=v_subscription;
    if private.tenant_write_allowed(v_org) then raise exception 'Blocked status permits writes: %',v_status; end if;
    begin
      perform private.require_permission(v_org,v_permission);
      raise exception 'Write permission accepted blocked subscription';
    exception when insufficient_privilege then null;
    end;
    perform private.require_permission(v_org,'members.read');
    perform private.require_permission(v_org,'finance.read');
  end loop;
  update public.saas_subscriptions set status='active' where id=v_subscription;
  update public.saas_tenant_accounts set access_override='security_hold' where organization_id=v_org;
  if private.tenant_write_allowed(v_org) then raise exception 'Administrative override permits writes'; end if;
  begin
    perform private.require_platform_staff('MASTER');
    raise exception 'Tenant AAL1 accepted as Master';
  exception when insufficient_privilege then null;
  end;
  insert into public.platform_staff(user_id,role) values(v_a,'MASTER'),(v_b,'MASTER');
  begin
    perform private.require_platform_staff('MASTER');
    raise exception 'Staff AAL1 accepted without MFA claim';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated','aal','aal2')::text,true);
  perform private.require_platform_staff('MASTER');
  foreach v_role in array array['SUPPORT','BILLING'] loop
    update public.platform_staff set role=v_role where user_id=v_a;
    perform private.require_platform_staff(v_role);
    begin
      perform private.require_platform_staff('MASTER');
      raise exception 'Non-Master staff accepted as Master';
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    update public.platform_staff set active=false where user_id=v_b;
    raise exception 'Last active Master was disabled';
  exception when sqlstate '55000' then null;
  end;
end;
$$;
rollback;
select 'DEV_SUBSCRIPTION_STAFF_PASS (helpers/triggers; simulated claims; real JWT/MFA pending)' as result;
