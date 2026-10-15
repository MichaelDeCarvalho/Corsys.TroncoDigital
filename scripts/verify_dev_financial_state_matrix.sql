-- DEV szqkdekwhzxsoxorgvaz only. Simulated claims; NOT signed HTTP/MFA.
-- No persistent profile/subscription/ledger changes: all work rolls back.
begin;
do $$
declare
 t record; m uuid;mc uuid;future_mc uuid;ec uuid;rc uuid;pm uuid;fa uuid;
 charge uuid;payment uuid;payable uuid;receivable uuid;rule uuid;preview jsonb;
 commands text[];q text;phase text;
 admin_role uuid;viewer_role uuid;checks integer:=0;tag text;
begin
 for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
 ) f(org,actor) loop
  select id into strict m from public.members where organization_id=t.org and full_name='DEV STAGE1 ISOLATED FIFO';
  select id into strict mc from public.financial_categories where organization_id=t.org and name='DEV HTTP TEST category';
  select id into strict future_mc from public.financial_categories where organization_id=t.org and name='DEV STAGE1 member_receivable';
  select id into strict ec from public.financial_categories where organization_id=t.org and name='DEV STAGE1 institutional_expense';
  select id into strict rc from public.financial_categories where organization_id=t.org and name='DEV STAGE1 institutional_revenue';
  select id into strict pm from public.payment_methods where organization_id=t.org and name='DEV HTTP TEST PIX' and active;
  select id into strict fa from public.financial_accounts where organization_id=t.org and name='DEV HTTP TEST bank' and active;
  select id into strict admin_role from public.roles where organization_id=t.org and code='ADMIN';
  select id into strict viewer_role from public.roles where organization_id=t.org and code='VIEWER';
  if (select count(*) from public.user_roles where organization_id=t.org and user_id=t.actor)<>1
   or not exists(select 1 from public.user_roles where organization_id=t.org and user_id=t.actor and role_id=admin_role)
   or (select count(*) from public.saas_subscriptions where organization_id=t.org and status='active')<>1
   or exists(select 1 from public.saas_subscriptions s join public.saas_plans p on p.id=s.plan_id where s.organization_id=t.org and p.price<>0)
   or private.is_period_closed(t.org,'2026-09-01')
  then raise exception 'DEV state matrix fixture mismatch';end if;
  update public.financial_categories set allow_recurrence=true where organization_id=t.org and id=future_mc;
  tag:='DEV STATE MATRIX '||gen_random_uuid()::text;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  charge:=public.create_manual_charge(t.org,m,mc,tag,'2026-09-01','2026-09-01','2026-09-10','2026-09-01',10,tag,tag||' charge');
  payment:=public.register_payment(t.org,m,'2026-09-02','2026-09-01',10,pm,fa,tag,null,tag||' payment');
  payable:=public.create_institutional_payable(t.org,ec,null,tag,'DEV fictitious supplier','2027-03-01','2027-03-01','2027-03-10','2027-03-01',10,tag||' payable');
  receivable:=public.create_institutional_receivable(t.org,rc,null,tag,'DEV fictitious source','2027-03-01','2027-03-01','2027-03-10','2027-03-01',10,tag||' receivable');
  rule:=public.create_tenant_monthly_rule(t.org,future_mc,tag,10,'2027-03-01',10,'DEV rollback monthly rule',tag||' rule');
  preview:=public.preview_monthly_charge_generation(t.org,rule,'2027-03-01');
  if preview->>'ready'<>'true' then raise exception 'Positive monthly preview unavailable';end if;
  if not exists(select 1 from public.v_charge_balances where charge_id=charge and open_amount=10 and integrity_ok)
   or not exists(select 1 from public.v_payment_balances where payment_id=payment and available_amount=10 and integrity_ok)
  then raise exception 'Positive ledger setup failed';end if;
  commands:=array[
   format('select public.create_manual_charge(%L,%L,%L,%L,''2026-09-01'',''2026-09-01'',''2026-09-10'',''2026-09-01'',1,null,gen_random_uuid()::text)',t.org,m,mc,tag),
   format('select public.register_payment(%L,%L,''2026-09-02'',''2026-09-01'',1,%L,%L,null,null,gen_random_uuid()::text)',t.org,m,pm,fa),
   format('select public.allocate_payment_to_charge(%L,%L,%L,1,''2026-09-01'',gen_random_uuid()::text)',t.org,payment,charge),
   format('select public.cancel_member_charge_idempotent(%L,%L,''2026-09-01'',%L,gen_random_uuid()::text)',t.org,charge,tag),
   format('select public.reverse_member_payment_idempotent(%L,%L,''2026-09-01'',%L,gen_random_uuid()::text)',t.org,payment,tag),
   format('select public.create_institutional_payable(%L,%L,null,%L,''DEV fictitious supplier'',''2027-03-01'',''2027-03-01'',''2027-03-10'',''2027-03-01'',1,gen_random_uuid()::text)',t.org,ec,tag),
   format('select public.create_institutional_receivable(%L,%L,null,%L,''DEV fictitious source'',''2027-03-01'',''2027-03-01'',''2027-03-10'',''2027-03-01'',1,gen_random_uuid()::text)',t.org,rc,tag),
   format('select public.register_institutional_payable_payment(%L,%L,''2027-03-02'',''2027-03-01'',1,1,%L,%L,%L,gen_random_uuid()::text)',t.org,payable,pm,fa,tag),
   format('select public.register_institutional_receipt(%L,%L,''2027-03-02'',''2027-03-01'',1,1,%L,%L,%L,gen_random_uuid()::text)',t.org,receivable,pm,fa,tag),
   format('select public.cancel_tenant_institutional_obligation_idempotent(%L,%L,''payable'',''2027-03-01'',%L,gen_random_uuid()::text)',t.org,payable,tag),
   format('select public.cancel_tenant_institutional_obligation_idempotent(%L,%L,''receivable'',''2027-03-01'',%L,gen_random_uuid()::text)',t.org,receivable,tag)
  ];
  begin
   perform public.close_financial_period_idempotent(t.org,'2027-03-01',tag,gen_random_uuid()::text);
   raise exception 'Future period close accepted';
  exception when invalid_parameter_value then checks:=checks+1;end;
  perform public.close_financial_period_idempotent(t.org,'2026-09-01',tag,gen_random_uuid()::text);
  foreach q in array commands[1:5] loop
   begin execute q;raise exception 'Closed period unexpectedly accepted command';
   exception when sqlstate '55000' then checks:=checks+1;end;
  end loop;
  perform public.reopen_financial_period_idempotent(t.org,'2026-09-01',tag,gen_random_uuid()::text);
  commands:=commands||format('select public.generate_monthly_member_charges(%L,%L,''2027-03-01'',%L,%L,gen_random_uuid()::text)',t.org,rule,preview->>'fingerprint',tag);
  execute 'reset role';
  foreach phase in array array['viewer','suspended'] loop
   if phase='viewer' then
    update public.user_roles set role_id=viewer_role where organization_id=t.org and user_id=t.actor;
   else
    update public.user_roles set role_id=admin_role where organization_id=t.org and user_id=t.actor;
    update public.saas_subscriptions set status='suspended' where organization_id=t.org;
   end if;
   execute 'set local role authenticated';
   if not exists(select 1 from public.v_charge_balances where charge_id=charge and organization_id=t.org)
    then raise exception 'Read access unexpectedly removed for %',phase;end if;
   foreach q in array commands loop
    begin execute q;raise exception '% unexpectedly accepted command',phase;
    exception when insufficient_privilege then checks:=checks+1;end;
   end loop;
   execute 'reset role';
  end loop;
  update public.user_roles set role_id=admin_role where organization_id=t.org and user_id=t.actor;
  update public.saas_subscriptions set status='active' where organization_id=t.org;
  execute 'set local role authenticated';
  perform public.allocate_payment_to_charge(t.org,payment,charge,1,'2026-09-01',tag||' resumed');
  if not exists(select 1 from public.v_charge_balances where charge_id=charge and open_amount=9 and integrity_ok)
   then raise exception 'Recovery after reopen/status restoration failed';end if;
  execute 'reset role';
 end loop;
 if checks<>60 then raise exception 'Incomplete state matrix: %/60',checks;end if;
end $$;
rollback;
select 'DEV_FINANCIAL_STATE_MATRIX_60_ROLLBACK_PASS (simulated claims; not HTTP)' as result;
