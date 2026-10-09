begin;
do $$
declare t record;v_total numeric;v_baseline numeric;v_rows int;
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
) x(uid,org) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 select coalesce(sum(signed_amount),0),count(*) into v_total,v_rows
 from public.read_tenant_dre(t.org::uuid,'2026-09-01','2027-01-01');
 execute 'reset role';
 select coalesce(sum(e.signed_amount),0) into v_baseline
 from public.v_dre_entries e
 join public.accounting_accounts a on a.id=e.accounting_account_id and a.organization_id=e.organization_id
 where e.organization_id=t.org::uuid and e.period>='2026-09-01' and e.period<='2027-01-01'
   and a.nature in ('revenue','cost','expense','financial_result');
 if v_total<>v_baseline or v_rows<1 then raise exception 'DRE mismatch %, %',v_total,v_baseline;end if;
 execute 'set local role authenticated';
 begin perform 1 from public.read_tenant_dre(t.org::uuid,'2026-09-02','2027-01-01');
 raise exception 'invalid start accepted';exception when invalid_parameter_value then null;end;
 begin perform 1 from public.read_tenant_dre(t.org::uuid,'2025-01-01','2027-01-01');
 raise exception 'long DRE period accepted';exception when invalid_parameter_value then null;end;
 execute 'reset role';
end loop;
if has_function_privilege('anon','public.read_tenant_dre(uuid,date,date)','execute') then raise exception 'anonymous reports allowed';end if;
end $$;
rollback;
select 'DEV_DRE_REPORT_ROLLBACK_PASS' as result;
