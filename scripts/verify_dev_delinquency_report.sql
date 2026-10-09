begin;
do $$
declare t record;v_count integer;v_total numeric;v_manual numeric;
begin
for t in select * from (values
('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid),
('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid)
) x(actor,org,other) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 select count(*),coalesce(sum(overdue_amount),0) into v_count,v_total
  from public.read_tenant_delinquency(t.org,26,0);
 if v_count<1 then raise exception 'Expected DEV overdue members';end if;
 select coalesce(sum(open_amount),0) into v_manual
  from public.v_charge_balances where organization_id=t.org and due_date<current_date and open_amount>0 and not is_cancelled;
 if v_total<>v_manual then raise exception 'Overdue report mismatch % %',v_total,v_manual;end if;
 if exists(select 1 from public.read_tenant_delinquency(t.org,26,0) where available_credit<0 or overdue_amount<=0) then
  raise exception 'Invalid delinquency amounts';end if;
 begin perform 1 from public.read_tenant_delinquency(t.other,26,0);
 raise exception 'Cross-tenant report allowed';
 exception when insufficient_privilege then null;end;
 begin perform 1 from public.read_tenant_delinquency(t.org,101,0);
 raise exception 'Oversized report accepted';
 exception when invalid_parameter_value then null;end;
 execute 'reset role';
end loop;
if has_function_privilege('anon','public.read_tenant_delinquency(uuid,integer,integer)','execute') then raise exception 'Anon report allowed';end if;
end $$;
rollback;
select 'DEV_DELINQUENCY_REPORT_ROLLBACK_PASS' as result;