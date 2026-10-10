begin;
do $$
declare t record;v_id uuid;v_key text;v_pub text;
 v_count bigint:=(select count(*) from public.expense_approval_policies);
begin
for t in select * from (values
('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid),
('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid)
) v(actor,org) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_id:=public.create_tenant_approval_policy_draft(t.org,'DEV Policy '||gen_random_uuid()::text,
 'threshold',100.00,2,'2028-01-01','2028-12-31','DEV temporary policy',v_key);
 if v_id is null or not exists(select 1 from public.expense_approval_policies
  where id=v_id and status='draft' and mode='threshold' and minimum_approvers=2)then
  raise exception 'Draft policy creation failed';end if;
 v_pub:=gen_random_uuid()::text;
 if v_id<>public.publish_tenant_approval_policy_idempotent(t.org,v_id,'DEV publish policy',v_pub)
 or v_id<>public.publish_tenant_approval_policy_idempotent(t.org,v_id,'DEV publish policy',v_pub)
 then raise exception 'Policy idempotent publish failed';end if;
 if not exists(select 1 from public.expense_approval_policies
  where id=v_id and status='published')then raise exception 'Policy not published';end if;
 begin
 perform public.create_tenant_approval_policy_draft(t.org,'DEV overlapping','all',null,1,
  '2028-06-01','2028-06-30','DEV overlap attempt',gen_random_uuid()::text);
 raise exception 'Overlapping published policy allowed';
 exception when check_violation then null;end;
 execute 'reset role';
end loop;
if (select count(*) from public.expense_approval_policies)<>v_count+2 then
 raise exception 'Unexpected policy rows';end if;
if has_function_privilege('anon','public.publish_tenant_approval_policy_idempotent(uuid,uuid,text,text)','execute')
then raise exception 'Anon publish permission';end if;
end $$;
rollback;
select 'DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS' as result;