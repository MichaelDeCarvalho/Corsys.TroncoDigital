-- DEV idempotent approval regression; temporary financial facts are rolled back.
begin;
do $$
declare t record; v_payable uuid; v_category uuid; v_request uuid; v_decision uuid; v_key text;
begin
 for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
 ) v(uid,org) loop
  select c.id into v_category from public.financial_categories c
   where c.organization_id=t.org::uuid and c.domain='institutional_expense' and c.active limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  v_payable:=public.create_institutional_payable(t.org::uuid,v_category,null,
   'DEV temporary approval','DEV supplier','2027-01-01','2027-01-02','2027-01-10',
   '2027-01-01',10,gen_random_uuid()::text);
  execute 'reset role';
  select r.id into v_request from public.payable_approval_requests r
   where r.organization_id=t.org::uuid and r.payable_id=v_payable;
  if v_request is null then
   insert into public.payable_approval_requests(organization_id,payable_id,minimum_approvers,amount_snapshot)
    values(t.org::uuid,v_payable,1,10) returning id into v_request;
  end if;
  execute 'set local role authenticated';
  v_key:=gen_random_uuid()::text;
  v_decision:=public.decide_payable_approval_idempotent(t.org::uuid,v_request,
   'approve','DEV temporary approval vote',v_key);
  if v_decision<>public.decide_payable_approval_idempotent(t.org::uuid,v_request,
   'approve','DEV temporary approval vote',v_key) then raise exception 'Replay mismatch';end if;
  if (select count(*) from public.payable_approval_decisions where approval_request_id=v_request)<>1
   then raise exception 'Decision count invalid';end if;
  execute 'reset role';
 end loop;
 if has_function_privilege('anon',
  'public.decide_payable_approval_idempotent(uuid,uuid,text,text,text)','execute')
 then raise exception 'Anonymous approval allowed';end if;
end $$;
rollback;
select 'DEV_APPROVAL_IDEMPOTENCY_ROLLBACK_PASS' as result;
