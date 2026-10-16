-- DEV only; tests existing 2027 fixtures, simulated claims, ROLLBACK.
begin;
do $$
declare t record; m uuid; mc uuid; rc uuid; ec uuid; pm uuid; fa uuid;
 c1 uuid;c2 uuid;p uuid;payable uuid;receivable uuid;pp uuid;receipt uuid;v uuid;tag text;
begin
 for t in select o.id org,ur.user_id from public.organizations o join public.user_roles ur on ur.organization_id=o.id join public.roles r on r.id=ur.role_id and r.code='ADMIN' where o.id in ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539') loop
  select id into strict m from public.members where organization_id=t.org and full_name='DEV STAGE1 ISOLATED FIFO';
  select id into strict mc from public.financial_categories where organization_id=t.org and name='DEV STAGE1 member_receivable';
  select id into strict rc from public.financial_categories where organization_id=t.org and name='DEV STAGE1 institutional_revenue';
  select id into strict ec from public.financial_categories where organization_id=t.org and name='DEV STAGE1 institutional_expense';
  select id into strict pm from public.payment_methods where organization_id=t.org and name='DEV HTTP TEST PIX';
  select id into strict fa from public.financial_accounts where organization_id=t.org and name='DEV HTTP TEST bank';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.user_id,'role','authenticated','aal','aal1')::text,true);
  tag:='DEV REMAINING SQL '||gen_random_uuid()::text;
  c1:=public.create_manual_charge(t.org,m,mc,tag,'2027-01-01','2027-01-02','2027-01-05','2027-01-01',100,tag,tag||' c1');
  c2:=public.create_manual_charge(t.org,m,mc,tag,'2027-01-01','2027-01-02','2027-01-10','2027-01-01',100,tag,tag||' c2');
  p:=public.register_payment(t.org,m,'2027-01-03','2027-01-01',150,pm,fa,tag,null,tag||' p');
  if public.allocate_payment_fifo(t.org,p,'2027-01-01')<>0 then raise exception 'FIFO credit mismatch'; end if;
  if not exists(select 1 from public.v_charge_balances where charge_id=c1 and open_amount=0 and allocated_amount=100 and integrity_ok)
    or not exists(select 1 from public.v_charge_balances where charge_id=c2 and open_amount=50 and allocated_amount=50 and integrity_ok) then raise exception 'FIFO order/saldo mismatch'; end if;
  payable:=public.create_institutional_payable(t.org,ec,null,tag,'DEV fictitious counterparty','2027-01-01','2027-01-02','2027-01-10','2027-01-01',100,tag||' payable');
  receivable:=public.create_institutional_receivable(t.org,rc,null,tag,'DEV fictitious counterparty','2027-01-01','2027-01-02','2027-01-10','2027-01-01',100,tag||' receivable');
  pp:=public.register_institutional_payable_payment(t.org,payable,'2027-01-03','2027-01-01',60,50,pm,fa,tag,tag||' pp');
  receipt:=public.register_institutional_receipt(t.org,receivable,'2027-01-03','2027-01-01',60,50,pm,fa,tag,tag||' receipt');
  if not exists(select 1 from public.v_institutional_payable_effective where payable_id=payable and open_amount=50 and allocated_amount=50 and integrity_ok)
    or not exists(select 1 from public.v_institutional_receivable_effective where receivable_id=receivable and open_amount=50 and allocated_amount=50 and integrity_ok) then raise exception 'Institutional saldo mismatch'; end if;
  v:=public.close_financial_period(t.org,'2027-01-01',tag);
  begin
   perform public.register_payment(t.org,m,'2027-01-03','2027-01-01',1,pm,fa,tag,null,tag||' blocked');
   raise exception 'Closed period allowed posting';
  exception when sqlstate '55000' then null; end;
  v:=public.reopen_financial_period(t.org,'2027-01-01',tag);
  v:=public.register_payment(t.org,m,'2027-01-03','2027-01-01',1,pm,fa,tag,null,tag||' resumed');
 end loop;
end; $$;
rollback;
select 'DEV_REMAINING_COMMANDS_ROLLBACK_PASS (FIFO/institutional/period; simulated claims)' result;
