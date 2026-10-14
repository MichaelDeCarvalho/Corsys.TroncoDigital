-- DEV only. Synthetic budget rows are transaction-local and always rolled back.
-- SQL claims test RLS/views, not signed JWTs or browser authentication.
begin;
do $$
declare t record; cycle_id uuid; account_id uuid; plan_id uuid; v_fund_id uuid;
 expected_actual numeric; row_actual numeric; row_budget numeric; row_remaining numeric;
begin
for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
) x(org,actor) loop
 select a.id,a.accounting_plan_id into strict account_id,plan_id
 from public.accounting_accounts a where a.organization_id=t.org
 order by a.id limit 1;
 insert into public.funds(organization_id,name)
 values(t.org,'DEV BUDGET FUND '||gen_random_uuid()) returning id into v_fund_id;
 insert into public.budget_cycles(organization_id,name,period_start,period_end,created_by)
 values(t.org,'DEV BUDGET READ '||gen_random_uuid(),'2026-01-01','2026-12-01',t.actor)
 returning id into cycle_id;
 insert into public.accounting_budget_lines(organization_id,budget_cycle_id,accounting_plan_id,
 accounting_account_id,period,amount) values(t.org,cycle_id,plan_id,account_id,'2026-09-01',200);
 insert into public.fund_budget_lines(organization_id,budget_cycle_id,fund_id,period,amount)
 values(t.org,cycle_id,v_fund_id,'2026-09-01',300);
 select coalesce(abs(sum(signed_amount)),0) into expected_actual from public.v_dre_entries
 where organization_id=t.org and accounting_account_id=account_id and period='2026-09-01';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 select actual_amount,budget_amount,remaining_amount into strict row_actual,row_budget,row_remaining
 from public.v_accounting_budget_vs_actual where organization_id=t.org and budget_cycle_id=cycle_id;
 if row_actual<>expected_actual or row_budget<>200 or row_remaining<>200-expected_actual then
  raise exception 'account budget/actual reconciliation failed';end if;
 if exists(select 1 from public.v_accounting_budget_vs_actual where organization_id<>t.org)
 or exists(select 1 from public.v_fund_budget_vs_actual where organization_id<>t.org)
 or exists(select 1 from public.budget_cycles where organization_id<>t.org)
 then raise exception 'cross-tenant budget visible';end if;
 begin
 insert into public.fund_budget_lines(organization_id,budget_cycle_id,fund_id,period,amount)
 values(t.org,cycle_id,v_fund_id,'2026-10-01',10);
 raise exception 'direct budget write accepted';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 select coalesce(sum(case when signed_amount<0 then -signed_amount else 0 end),0)
 into expected_actual from public.v_dre_entries
 where organization_id=t.org and fund_id=v_fund_id and period='2026-09-01';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 select actual_amount,budget_amount,available_amount into strict row_actual,row_budget,row_remaining
 from public.v_fund_budget_vs_actual where organization_id=t.org and budget_cycle_id=cycle_id;
 if row_actual<>expected_actual or row_budget<>300 or row_remaining<>300-expected_actual then
  raise exception 'fund budget/actual reconciliation failed';end if;
 execute 'reset role';
end loop;
-- Both tenants now have positive budget rows: check isolation in both directions.
for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
) x(org,actor) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.v_accounting_budget_vs_actual where organization_id=t.org)
 or not exists(select 1 from public.v_fund_budget_vs_actual where organization_id=t.org)
 or exists(select 1 from public.v_accounting_budget_vs_actual where organization_id<>t.org)
 or exists(select 1 from public.v_fund_budget_vs_actual where organization_id<>t.org)
 then raise exception 'two-way budget RLS failed';end if;
 execute 'reset role';
end loop;
end $$;
rollback;
select 'DEV_BUDGET_READ_ROLLBACK_PASS' as result;
