begin;
do $$
declare t record;v_count integer;v_received numeric;v_expected numeric;v_member numeric;v_expected_member numeric;
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid),
 ('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid)
 ) x(actor,org,other_org) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  select count(*),coalesce(sum(received),0),coalesce(sum(member_receivables_due),0)
  into v_count,v_received,v_member
  from public.read_tenant_daily_cash_flow(t.org,'2026-09-01','2026-09-30');
  if v_count<>30 then raise exception 'Daily cashflow should return 30 days, got %',v_count;end if;
  select coalesce(sum(signed_amount),0) into v_expected from public.v_financial_account_movements
  where organization_id=t.org and movement_date between '2026-09-01' and '2026-09-30'
   and movement_type in ('member_payment','member_payment_reversal','institutional_receipt','institutional_receipt_reversal');
  if v_expected<>v_received or v_received<=0 then raise exception 'Cash inflow mismatch % vs %',v_received,v_expected;end if;
  select coalesce(sum(open_amount),0) into v_expected_member
  from public.v_charge_balances where organization_id=t.org
   and due_date between '2026-09-01' and '2026-09-30'
   and not is_cancelled and open_amount>0;
  if v_member<>v_expected_member then raise exception 'Member projected mismatch % vs %',v_member,v_expected_member;end if;
  begin
   perform 1 from public.read_tenant_daily_cash_flow(t.other_org,'2026-09-01','2026-09-30');
   raise exception 'Cross-tenant cashflow allowed';
  exception when insufficient_privilege then null;end;
  begin
   perform 1 from public.read_tenant_daily_cash_flow(t.org,'2026-09-01','2027-01-01');
   raise exception 'Long daily cashflow window accepted';
  exception when invalid_parameter_value then null;end;
  execute 'reset role';
 end loop;
 if has_function_privilege('anon','public.read_tenant_daily_cash_flow(uuid,date,date)','execute')
 then raise exception 'Anonymous cash flow access';end if;
end $$;
rollback;
select 'DEV_DAILY_CASH_FLOW_ROLLBACK_PASS' as result;