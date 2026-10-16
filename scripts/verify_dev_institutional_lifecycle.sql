begin;
do $$
declare t record;cp uuid;cr uuid;pm uuid;fa uuid;pay uuid;rec uuid;out_id uuid;v_key text;v_status text;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
 v_payables bigint:=(select count(*) from public.institutional_payables);
 v_receivables bigint:=(select count(*) from public.institutional_receivables);
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
) x(uid,org) loop
 select id into cp from public.financial_categories where organization_id=t.org::uuid and active and domain='institutional_expense' limit 1;
 select id into cr from public.financial_categories where organization_id=t.org::uuid and active and domain='institutional_revenue' limit 1;
 select id into pm from public.payment_methods where organization_id=t.org::uuid and active limit 1;
 select id into fa from public.financial_accounts where organization_id=t.org::uuid and active limit 1;
 if cp is null or cr is null or pm is null or fa is null then raise exception 'catalog fixture missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 pay:=public.create_institutional_payable(t.org::uuid,cp,null,'DEV electricity','DEV vendor',
 '2027-01-01','2027-01-02','2027-01-15','2027-01-01',10,v_key);
 if pay<>public.create_institutional_payable(t.org::uuid,cp,null,'DEV electricity','DEV vendor',
 '2027-01-01','2027-01-02','2027-01-15','2027-01-01',10,v_key) then raise exception 'payable replay mismatch';end if;
 v_key:=gen_random_uuid()::text;
 rec:=public.create_institutional_receivable(t.org::uuid,cr,null,'DEV donation','DEV customer',
 '2027-01-01','2027-01-02','2027-01-15','2027-01-01',10,v_key);
 if rec<>public.create_institutional_receivable(t.org::uuid,cr,null,'DEV donation','DEV customer',
 '2027-01-01','2027-01-02','2027-01-15','2027-01-01',10,v_key) then raise exception 'receivable replay mismatch';end if;
 select approval_status into v_status from public.v_institutional_payable_effective where payable_id=pay and organization_id=t.org::uuid;
 if v_status in ('approved','not_required') then
  out_id:=public.register_institutional_payable_payment(t.org::uuid,pay,'2027-01-08','2027-01-01',5,5,pm,fa,'DEV payable settle',gen_random_uuid()::text);
  if not exists(select 1 from public.v_institutional_payable_effective where payable_id=pay and open_amount=5 and integrity_ok) then raise exception 'payable settlement not balanced';end if;
 else
  begin perform public.register_institutional_payable_payment(t.org::uuid,pay,'2027-01-08','2027-01-01',5,5,pm,fa,'DEV forbidden before approval',gen_random_uuid()::text);
   raise exception 'unapproved payable paid';
  exception when check_violation then null;end;
 end if;
 out_id:=public.register_institutional_receipt(t.org::uuid,rec,'2027-01-08','2027-01-01',5,5,pm,fa,'DEV receipt',gen_random_uuid()::text);
 if not exists(select 1 from public.v_institutional_receivable_effective where receivable_id=rec and open_amount=5 and integrity_ok) then raise exception 'receivable settlement not balanced';end if;
 execute 'reset role';
end loop;
if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments) then raise exception 'member ledger affected';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_LIFECYCLE_ROLLBACK_PASS' as result;
