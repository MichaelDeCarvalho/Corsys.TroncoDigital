-- Authorized DEV szqkdekwhzxsoxorgvaz only. Claims simulated, all facts rollback.
begin;
do $$
declare
 t record; v_charge uuid; v_payment uuid; v_allocation uuid; v_id uuid; v_tag text;
 v_phase text; v_count integer;
begin
 for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'85cd325b-a667-481d-92e9-dc4776857962'::uuid,'dc24feaf-e897-483b-9c47-3b242289a40f'::uuid,'ffae09a8-4073-4305-9436-803daae5e5b9'::uuid,'a7618966-ad8e-466b-b11d-2ca52ce6372d'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'20ec239c-36b4-46b3-af72-0f583a02cd93'::uuid,'3f463a31-852f-4639-a80a-55498f4a41ec'::uuid,'85285a18-9f45-47f5-9565-a16e4faaabd6'::uuid,'cf48c695-c424-4fd2-abbf-46ec5192a6c2'::uuid)
 ) as fixture(org_id,user_id,member_id,category_id,method_id,account_id) loop
  if not exists(select 1 from public.members where id=t.member_id and organization_id=t.org_id and full_name='DEV HTTP FINANCIAL TEST')
    or not exists(select 1 from public.saas_subscriptions s join public.saas_plans p on p.id=s.plan_id where s.organization_id=t.org_id and s.status='active' and p.code='dev_http_financial_20261007' and p.price=0) then
   raise exception 'DEV fixture mismatch';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.user_id,'role','authenticated','aal','aal1')::text,true);
  foreach v_phase in array array['reverse-first','cancel-first'] loop
   v_tag:='DEV SQL LIFECYCLE '||gen_random_uuid()::text;
   v_charge:=public.create_manual_charge(t.org_id,t.member_id,t.category_id,v_tag,'2026-09-01','2026-09-05','2026-09-10','2026-09-01',100,v_tag,v_tag||' charge');
   v_payment:=public.register_payment(t.org_id,t.member_id,'2026-09-05','2026-09-01',100,t.method_id,t.account_id,v_tag,'Fictitious rollback',v_tag||' payment');
   v_allocation:=public.allocate_payment_to_charge(t.org_id,v_payment,v_charge,40,'2026-09-01',v_tag||' allocation');
   if not exists(select 1 from public.v_charge_balances where charge_id=v_charge and open_amount=60 and allocated_amount=40 and integrity_ok)
     or not exists(select 1 from public.v_payment_balances where payment_id=v_payment and available_amount=60 and allocated_amount=40 and integrity_ok) then raise exception 'Initial allocation balances failed'; end if;
   if v_phase='reverse-first' then
    v_id:=public.reverse_payment(t.org_id,v_payment,'2026-09-01',v_tag);
    if not exists(select 1 from public.v_charge_balances where charge_id=v_charge and open_amount=100 and allocated_amount=0 and integrity_ok)
      or not exists(select 1 from public.v_payment_balances where payment_id=v_payment and available_amount=0 and allocated_amount=0 and is_reversed and integrity_ok) then raise exception 'Reversal balances failed'; end if;
    begin
     perform public.reverse_payment(t.org_id,v_payment,'2026-09-01',v_tag);
     raise exception 'Duplicate reversal accepted';
    exception when unique_violation then null; end;
    begin
     perform public.allocate_payment_fifo(t.org_id,v_payment,'2026-09-01');
     raise exception 'Reversed payment FIFO accepted';
    exception when sqlstate '55000' then null; end;
    v_id:=public.cancel_charge(t.org_id,v_charge,'2026-09-01',v_tag);
   else
    v_id:=public.cancel_charge(t.org_id,v_charge,'2026-09-01',v_tag);
    if not exists(select 1 from public.v_payment_balances where payment_id=v_payment and available_amount=100 and allocated_amount=0 and not is_reversed and integrity_ok) then raise exception 'Cancel did not free payment credit'; end if;
    begin
     perform public.cancel_charge(t.org_id,v_charge,'2026-09-01',v_tag);
     raise exception 'Duplicate cancellation accepted';
    exception when unique_violation then null; end;
    v_id:=public.reverse_payment(t.org_id,v_payment,'2026-09-01',v_tag);
   end if;
   if not exists(select 1 from public.v_charge_balances where charge_id=v_charge and open_amount=0 and allocated_amount=0 and is_cancelled and integrity_ok)
     or not exists(select 1 from public.v_payment_balances where payment_id=v_payment and available_amount=0 and allocated_amount=0 and is_reversed and integrity_ok) then raise exception 'Final correction balances failed'; end if;
   select count(*) into v_count from public.allocation_reversals where allocation_id=v_allocation;
   if v_count<>1 then raise exception 'Duplicate/missing allocation reversal'; end if;
   select count(*) into v_count from public.audit_logs where entity_id=v_payment and action='payment.reverse';
   if v_count<>1 then raise exception 'Payment audit count mismatch'; end if;
   select count(*) into v_count from public.audit_logs where entity_id=v_charge and action='charge.cancel';
   if v_count<>1 then raise exception 'Charge audit count mismatch'; end if;
   if not exists(select 1 from public.charges where id=v_charge and original_amount=100)
     or not exists(select 1 from public.payments where id=v_payment and amount=100)
     or not exists(select 1 from public.receivable_allocations where id=v_allocation and amount=40) then raise exception 'Original ledger changed'; end if;
  end loop;
 end loop;
end;
$$;
rollback;
select 'DEV_LIFECYCLE_BALANCES_ROLLBACK_PASS (simulated claims; not HTTP/concurrency)' result;
