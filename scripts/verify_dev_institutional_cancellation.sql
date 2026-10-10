begin;
do $$
declare t record;cp uuid;cr uuid;v_pay uuid;v_rec uuid;v_key text;v_returned uuid;
 v_count_before bigint:=(select count(*) from public.institutional_payable_cancellations)
 +(select count(*) from public.institutional_receivable_cancellations);
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,
 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid),
 ('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,
 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid)
 ) d(actor,org,other) loop
 select id into cp from public.financial_categories
  where organization_id=t.org and active and domain='institutional_expense' limit 1;
 select id into cr from public.financial_categories
  where organization_id=t.org and active and domain='institutional_revenue' limit 1;
 if cp is null or cr is null then raise exception 'Missing categories';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_pay:=public.create_institutional_payable(t.org,cp,null,'DEV cancel payable','DEV supplier',
  '2027-02-01','2027-02-02','2027-02-15','2027-02-01',90,gen_random_uuid()::text);
 v_rec:=public.create_institutional_receivable(t.org,cr,null,'DEV cancel receivable','DEV source',
  '2027-02-01','2027-02-02','2027-02-15','2027-02-01',80,gen_random_uuid()::text);
 v_key:=gen_random_uuid()::text;
 v_returned:=public.cancel_tenant_institutional_obligation_idempotent(
  t.org,v_pay,'payable','2027-02-01','DEV cancellation reason payable',v_key);
 if v_returned<>v_pay or v_returned<>public.cancel_tenant_institutional_obligation_idempotent(
  t.org,v_pay,'payable','2027-02-01','DEV cancellation reason payable',v_key)
 then raise exception 'Payable replay failed';end if;
 if not exists(select 1 from public.v_institutional_payable_effective
  where organization_id=t.org and payable_id=v_pay and is_canceled and open_amount=0 and integrity_ok)
 then raise exception 'Payable cancellation not effective';end if;
 v_key:=gen_random_uuid()::text;
 v_returned:=public.cancel_tenant_institutional_obligation_idempotent(
  t.org,v_rec,'receivable','2027-02-01','DEV cancellation reason receivable',v_key);
 if v_returned<>v_rec or v_returned<>public.cancel_tenant_institutional_obligation_idempotent(
  t.org,v_rec,'receivable','2027-02-01','DEV cancellation reason receivable',v_key)
 then raise exception 'Receivable replay failed';end if;
 if not exists(select 1 from public.v_institutional_receivable_effective
  where organization_id=t.org and receivable_id=v_rec and is_canceled and open_amount=0 and integrity_ok)
 then raise exception 'Receivable cancellation not effective';end if;
 begin
  perform public.cancel_tenant_institutional_obligation_idempotent(
   t.other,v_pay,'payable','2027-02-01','DEV forbidden cross tenant',gen_random_uuid()::text);
  raise exception 'Cross tenant cancellation unexpectedly accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.cancel_tenant_institutional_obligation_idempotent(
   t.org,v_rec,'receivable','2027-02-01','DEV duplicate with new key',gen_random_uuid()::text);
  raise exception 'Duplicate cancellation unexpectedly accepted';
 exception when object_not_in_prerequisite_state then null;end;
 execute 'reset role';
 end loop;
 if has_function_privilege('anon',
   'public.cancel_tenant_institutional_obligation_idempotent(uuid,uuid,text,date,text,text)','execute')
 then raise exception 'Anonymous function execute allowed';end if;
 if v_count_before+4<>(select count(*) from public.institutional_payable_cancellations)
  +(select count(*) from public.institutional_receivable_cancellations)
 then raise exception 'Wrong cancellations count';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS' as result;
