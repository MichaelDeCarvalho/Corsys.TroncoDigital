begin;
do $$
declare t record;cp uuid;cr uuid;v_pay uuid;v_rec uuid;v_key text;v_state jsonb;
 v_correction uuid;v_before int:=(select count(*) from public.institutional_payable_corrections)+(select count(*) from public.institutional_receivable_corrections);
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid),
 ('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid)
 ) d(actor,org,other) loop
 select id into cp from public.financial_categories
  where organization_id=t.org and active and domain='institutional_expense' limit 1;
 select id into cr from public.financial_categories
  where organization_id=t.org and active and domain='institutional_revenue' limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_pay:=public.create_institutional_payable(t.org,cp,null,'DEV correction payable','DEV supplier',
   '2027-02-01','2027-02-02','2027-02-15','2027-02-01',90,gen_random_uuid()::text);
 v_rec:=public.create_institutional_receivable(t.org,cr,null,'DEV correction receivable','DEV donor',
   '2027-02-01','2027-02-02','2027-02-15','2027-02-01',80,gen_random_uuid()::text);
 select jsonb_build_object('category_id',v.category_id,'fund_id',v.fund_id,
  'description',v.description,'competence',v.competence,'due_date',v.due_date,
  'effective_amount',v.effective_amount,'allocated_amount',v.allocated_amount)
 into v_state from public.v_institutional_payable_effective v where v.payable_id=v_pay and v.organization_id=t.org;
 v_key:=gen_random_uuid()::text;
 v_correction:=public.correct_tenant_institutional_obligation_idempotent(
  t.org,v_pay,'payable',v_state,cp,null,'DEV corrected payable',
  '2027-02-01','2027-02-20',110,'2027-02-01','DEV amount and due correction',v_key);
 if v_correction<>public.correct_tenant_institutional_obligation_idempotent(
  t.org,v_pay,'payable',v_state,cp,null,'DEV corrected payable',
  '2027-02-01','2027-02-20',110,'2027-02-01','DEV amount and due correction',v_key)
 then raise exception 'Payable correction idempotency failure';end if;
 if not exists(select 1 from public.v_institutional_payable_effective
  where organization_id=t.org and payable_id=v_pay and effective_amount=110
  and due_date='2027-02-20' and integrity_ok)then raise exception 'Payable corrected state invalid';end if;
 begin
  perform public.correct_tenant_institutional_obligation_idempotent(
   t.org,v_pay,'payable',v_state,cp,null,'DEV stale payable',
   '2027-02-01','2027-02-20',120,'2027-02-01','DEV stale revision reject',gen_random_uuid()::text);
  raise exception 'Stale correction unexpectedly accepted';
 exception when sqlstate 'PT409' then null;end;
 select jsonb_build_object('category_id',v.category_id,'fund_id',v.fund_id,
  'description',v.description,'competence',v.competence,'due_date',v.due_date,
  'effective_amount',v.effective_amount,'allocated_amount',v.allocated_amount)
 into v_state from public.v_institutional_receivable_effective v where v.receivable_id=v_rec and v.organization_id=t.org;
 v_key:=gen_random_uuid()::text;
 v_correction:=public.correct_tenant_institutional_obligation_idempotent(
  t.org,v_rec,'receivable',v_state,cr,null,'DEV corrected receivable',
  '2027-02-01','2027-02-20',75,'2027-02-01','DEV receivable updated amount',v_key);
 if v_correction<>public.correct_tenant_institutional_obligation_idempotent(
  t.org,v_rec,'receivable',v_state,cr,null,'DEV corrected receivable',
  '2027-02-01','2027-02-20',75,'2027-02-01','DEV receivable updated amount',v_key)
 then raise exception 'Receivable correction idempotency failure';end if;
 if not exists(select 1 from public.v_institutional_receivable_effective
  where organization_id=t.org and receivable_id=v_rec and effective_amount=75
  and due_date='2027-02-20' and integrity_ok)then raise exception 'Receivable corrected state invalid';end if;
 begin
  perform public.correct_tenant_institutional_obligation_idempotent(
   t.other,v_pay,'payable',v_state,cp,null,'DEV cross tenant',
   '2027-02-01','2027-02-20',70,'2027-02-01','DEV deny cross tenant',gen_random_uuid()::text);
  raise exception 'Cross-tenant correction accepted';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 end loop;
 if has_function_privilege('anon','public.correct_tenant_institutional_obligation_idempotent(uuid,uuid,text,jsonb,uuid,uuid,text,date,date,numeric,date,text,text)','execute')
 then raise exception 'Anonymous correction privilege';end if;
 if (select count(*) from public.institutional_payable_corrections)+(select count(*) from public.institutional_receivable_corrections)<>v_before+4
 then raise exception 'Unexpected correction count';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS' as result;