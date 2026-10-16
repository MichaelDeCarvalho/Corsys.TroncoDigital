-- DEV member payment lifecycle, all facts and fixtures rolled back.
begin;
do $$
declare t record; v_member uuid;v_charge uuid;v_amount numeric(14,2);
 v_method uuid;v_account uuid;v_payment uuid;v_allocation uuid;
 v_reverse uuid;v_key text;v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
 v_allocations bigint:=(select count(*) from public.receivable_allocations);
 v_reversals bigint:=(select count(*) from public.payment_reversals);
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) x(uid,org) loop
  select member_id,charge_id,least(open_amount,10) into v_member,v_charge,v_amount
  from public.v_charge_balances where organization_id=t.org::uuid and open_amount>0 and not is_cancelled
  order by due_date,charge_id limit 1;
  select id into v_method from public.payment_methods where organization_id=t.org::uuid and active order by id limit 1;
  select id into v_account from public.financial_accounts where organization_id=t.org::uuid and active order by id limit 1;
  if v_member is null or v_charge is null or v_amount is null or v_method is null or v_account is null then raise exception 'missing payment fixture';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  v_key:=gen_random_uuid()::text;
  v_payment:=public.register_payment(t.org::uuid,v_member,current_date,date_trunc('month',current_date)::date,v_amount,
   v_method,v_account,'DEV test ref','DEV temporary payment',v_key);
  if v_payment<>public.register_payment(t.org::uuid,v_member,current_date,date_trunc('month',current_date)::date,v_amount,
   v_method,v_account,'DEV test ref','DEV temporary payment',v_key) then raise exception 'payment retry mismatch';end if;
  v_allocation:=public.allocate_payment_to_charge(t.org::uuid,v_payment,v_charge,v_amount,
   date_trunc('month',current_date)::date,gen_random_uuid()::text);
  if not exists(select 1 from public.receivable_allocations where id=v_allocation and charge_id=v_charge and payment_id=v_payment)
  then raise exception 'missing allocation';end if;
  v_key:=gen_random_uuid()::text;
  v_reverse:=public.reverse_member_payment_idempotent(t.org::uuid,v_payment,date_trunc('month',current_date)::date,
   'DEV audit reversal of temporary payment',v_key);
  if v_reverse<>public.reverse_member_payment_idempotent(t.org::uuid,v_payment,date_trunc('month',current_date)::date,
   'DEV audit reversal of temporary payment',v_key) then raise exception 'reversal retry mismatch';end if;
  if (select count(*) from public.payment_reversals where payment_id=v_payment)<>1 then raise exception 'duplicate reversal';end if;
  if (select count(*) from public.allocation_reversals where allocation_id=v_allocation)<>1 then raise exception 'missing allocation reversal';end if;
  begin perform public.reverse_member_payment_idempotent(t.org::uuid,v_payment,date_trunc('month',current_date)::date,
    'DEV changed key payload',v_key);
  raise exception 'changed payload accepted';exception when invalid_parameter_value then null;end;
  begin perform public.reverse_member_payment_idempotent(t.org::uuid,v_payment,date_trunc('month',current_date)::date,
    'DEV second reversal denied',gen_random_uuid()::text);
  raise exception 'second reversal accepted';exception when unique_violation then null;end;
  execute 'reset role';
 end loop;
 if has_function_privilege('anon','public.reverse_member_payment_idempotent(uuid,uuid,date,text,text)','execute')
 then raise exception 'anon reversal privilege';end if;
 if (select count(*) from public.charges)<>v_charges then raise exception 'charge counts modified';end if;
end $$;
rollback;
select 'DEV_MEMBER_PAYMENT_OPERATIONS_ROLLBACK_PASS' as result;
