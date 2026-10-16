begin;
do $$
declare t record;v jsonb;v_expected numeric;v_other uuid;
begin
for t in select * from (values
('a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid),
('559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid)
) a(actor,org,other) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v:=public.read_tenant_financial_dashboard(t.org);
 if v->>'organization_id'<>t.org::text or v->>'integrity_ok'<>'true' then
  raise exception 'Wrong tenant/dashboard integrity';end if;
 select coalesce(sum(c.open_amount),0) into v_expected from public.v_charge_balances c
 where c.organization_id=t.org and not c.is_cancelled;
 if (v->>'member_open')::numeric<>v_expected then raise exception 'Member receivable KPI mismatch';end if;
 select coalesce(sum(m.signed_amount),0) into v_expected from public.v_financial_account_movements m
 where m.organization_id=t.org and m.movement_date<=current_date;
 if (v->>'cash_bank_balance')::numeric<>v_expected then raise exception 'Cash movement KPI mismatch';end if;
 begin
 perform public.read_tenant_financial_dashboard(t.other);
 raise exception 'Cross-tenant dashboard access accepted';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
end loop;
if has_function_privilege('anon','public.read_tenant_financial_dashboard(uuid)','execute')
then raise exception 'Anon dashboard grant';end if;
end $$;
rollback;
select 'DEV_FINANCIAL_DASHBOARD_ROLLBACK_PASS' as result;