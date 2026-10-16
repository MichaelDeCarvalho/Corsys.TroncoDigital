-- Additive DEV budget commands. Existing published budgets and ledger stay immutable.
create function private.tenant_budget_snapshot(p_org uuid,p_cycle uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('cycle',jsonb_build_object(
  'id',c.id,'organization_id',c.organization_id,'name',c.name,'status',c.status,
  'period_start',c.period_start,'period_end',c.period_end,'currency',c.currency),
  'lines',coalesce((select jsonb_agg(x.line order by x.kind,x.item,x.period) from (
   select 'account' as kind,b.accounting_account_id as item,b.period,
    jsonb_build_object('kind','account','item_id',b.accounting_account_id,'period',b.period,
      'amount',b.amount::text,'label',a.code||' — '||a.description) as line
   from public.accounting_budget_lines b join public.accounting_accounts a
    on a.organization_id=b.organization_id and a.id=b.accounting_account_id
   where b.organization_id=p_org and b.budget_cycle_id=c.id
   union all
   select 'fund',b.fund_id,b.period,jsonb_build_object('kind','fund','item_id',b.fund_id,
    'period',b.period,'amount',b.amount::text,'label',f.name)
   from public.fund_budget_lines b join public.funds f
    on f.organization_id=b.organization_id and f.id=b.fund_id
   where b.organization_id=p_org and b.budget_cycle_id=c.id
  ) x),'[]'::jsonb))
 from public.budget_cycles c where c.organization_id=p_org and c.id=p_cycle;
$$;
revoke all on function private.tenant_budget_snapshot(uuid,uuid) from public,anon,authenticated;

create function public.read_tenant_budget_detail(p_organization_id uuid,p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 v_snapshot:=private.tenant_budget_snapshot(p_organization_id,p_cycle_id);
 if v_snapshot is null then raise exception 'budget not found in tenant' using errcode='23503';end if;
 if jsonb_array_length(v_snapshot->'lines')>400 then
  raise exception 'budget exceeds supported line count' using errcode='22023';end if;
 return v_snapshot||jsonb_build_object('revision',md5(v_snapshot::text));
end $$;
revoke all on function public.read_tenant_budget_detail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_tenant_budget_detail(uuid,uuid) to authenticated;

create function public.create_tenant_budget_draft(p_organization_id uuid,p_name text,
 p_period_start date,p_period_end date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'budgets.manage');
 if p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_period_start is null or p_period_end is null
  or p_period_start<date '2020-01-01' or p_period_end<p_period_start
  or extract(day from p_period_start)<>1 or extract(day from p_period_end)<>1
  or p_period_end>p_period_start+interval '10 years'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid budget draft' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_budget_draft',p_idempotency_key,
  jsonb_build_object('name',btrim(p_name),'start',p_period_start,'end',p_period_end,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 insert into public.budget_cycles(organization_id,name,period_start,period_end,created_by)
 values(p_organization_id,btrim(p_name),p_period_start,p_period_end,auth.uid()) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'budget.draft','budget_cycle',v_id,
  jsonb_build_object('period_start',p_period_start,'period_end',p_period_end),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_budget_draft(uuid,text,date,date,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_budget_draft(uuid,text,date,date,text,text) to authenticated;

create function public.set_tenant_budget_line(p_organization_id uuid,p_cycle_id uuid,
 p_kind text,p_item_id uuid,p_period date,p_amount numeric,p_expected_revision text,
 p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_cycle public.budget_cycles%rowtype;v_snapshot jsonb;
 v_plan uuid;v_before numeric;v_count integer;
begin
 perform private.require_permission(p_organization_id,'budgets.manage');
 if p_cycle_id is null or p_item_id is null or p_kind is null or p_kind not in('account','fund')
  or p_period is null or extract(day from p_period)<>1
  or p_amount is not null and (p_amount::text in('NaN','Infinity','-Infinity')
   or p_amount<0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2))
  or p_expected_revision is null or p_expected_revision!~'^[0-9a-f]{32}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid budget line request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_tenant_budget_line',p_idempotency_key,
  jsonb_build_object('cycle',p_cycle_id,'kind',p_kind,'item',p_item_id,'period',p_period,
   'amount',p_amount,'revision',p_expected_revision,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_cycle from public.budget_cycles where organization_id=p_organization_id
  and id=p_cycle_id for update;
 if not found then raise exception 'budget not found in tenant' using errcode='23503';end if;
 if v_cycle.status<>'draft' then raise exception 'budget is immutable' using errcode='55000';end if;
 v_snapshot:=private.tenant_budget_snapshot(p_organization_id,p_cycle_id);
 if md5(v_snapshot::text)<>p_expected_revision then
  raise exception 'budget changed; reload' using errcode='40001';end if;
 if p_period<v_cycle.period_start or p_period>v_cycle.period_end then
  raise exception 'period outside budget cycle' using errcode='22023';end if;
 if p_kind='account' then
  select amount into v_before from public.accounting_budget_lines where organization_id=p_organization_id
   and budget_cycle_id=p_cycle_id and accounting_account_id=p_item_id and period=p_period;
  if p_amount is null then
   if v_before is null then raise exception 'budget line not found' using errcode='23503';end if;
   delete from public.accounting_budget_lines where organization_id=p_organization_id
    and budget_cycle_id=p_cycle_id and accounting_account_id=p_item_id and period=p_period;
  else
   select a.accounting_plan_id into v_plan from public.accounting_accounts a
    join public.accounting_plans p on p.organization_id=a.organization_id and p.id=a.accounting_plan_id
    where a.organization_id=p_organization_id and a.id=p_item_id and a.active and a.row_type='analytic'
     and a.nature in('revenue','cost','expense','financial_result') and p.status='published'
     and p_period between p.valid_from and p.valid_to for share of a,p;
   if not found then raise exception 'active budget account not covered by published plan' using errcode='23503';end if;
   insert into public.accounting_budget_lines(organization_id,budget_cycle_id,accounting_plan_id,accounting_account_id,period,amount)
   values(p_organization_id,p_cycle_id,v_plan,p_item_id,p_period,p_amount)
   on conflict(budget_cycle_id,accounting_account_id,period) do update set amount=excluded.amount;
  end if;
 else
  select amount into v_before from public.fund_budget_lines where organization_id=p_organization_id
   and budget_cycle_id=p_cycle_id and fund_id=p_item_id and period=p_period;
  if p_amount is null then
   if v_before is null then raise exception 'budget line not found' using errcode='23503';end if;
   delete from public.fund_budget_lines where organization_id=p_organization_id
    and budget_cycle_id=p_cycle_id and fund_id=p_item_id and period=p_period;
  else
   perform 1 from public.funds where organization_id=p_organization_id and id=p_item_id and active for share;
   if not found then raise exception 'active fund not found in tenant' using errcode='23503';end if;
   insert into public.fund_budget_lines(organization_id,budget_cycle_id,fund_id,period,amount)
   values(p_organization_id,p_cycle_id,p_item_id,p_period,p_amount)
   on conflict(budget_cycle_id,fund_id,period) do update set amount=excluded.amount;
  end if;
 end if;
 select jsonb_array_length(private.tenant_budget_snapshot(p_organization_id,p_cycle_id)->'lines') into v_count;
 if v_count>400 then raise exception 'budget line limit exceeded' using errcode='22023';end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'budget.line','budget_cycle',p_cycle_id,
  jsonb_build_object('amount',v_before),jsonb_build_object('kind',p_kind,'item',p_item_id,
  'period',p_period,'amount',p_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_cycle_id);
 return p_cycle_id;
end $$;
revoke all on function public.set_tenant_budget_line(uuid,uuid,text,uuid,date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.set_tenant_budget_line(uuid,uuid,text,uuid,date,numeric,text,text,text) to authenticated;

create function public.publish_tenant_budget(p_organization_id uuid,p_cycle_id uuid,
 p_expected_revision text,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_cycle public.budget_cycles%rowtype;v_snapshot jsonb;v_line jsonb;
begin
 perform private.require_permission(p_organization_id,'budgets.manage');
 if p_cycle_id is null or p_expected_revision is null or p_expected_revision!~'^[0-9a-f]{32}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid budget publication' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'publish_tenant_budget',p_idempotency_key,
  jsonb_build_object('cycle',p_cycle_id,'revision',p_expected_revision,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_cycle from public.budget_cycles where organization_id=p_organization_id
  and id=p_cycle_id for update;
 if not found then raise exception 'budget not found in tenant' using errcode='23503';end if;
 if v_cycle.status<>'draft' then raise exception 'budget already immutable' using errcode='55000';end if;
 v_snapshot:=private.tenant_budget_snapshot(p_organization_id,p_cycle_id);
 if md5(v_snapshot::text)<>p_expected_revision then raise exception 'budget changed; reload' using errcode='40001';end if;
 if v_cycle.currency<>'BRL' or jsonb_array_length(v_snapshot->'lines') not between 1 and 400 then
  raise exception 'invalid budget contents' using errcode='22023';end if;
 for v_line in select value from jsonb_array_elements(v_snapshot->'lines') loop
  if (v_line->>'period')::date not between v_cycle.period_start and v_cycle.period_end
   or (v_line->>'amount')::numeric::text in('NaN','Infinity','-Infinity') then
   raise exception 'invalid budget line' using errcode='22023';end if;
  if v_line->>'kind'='account' then
   perform 1 from public.accounting_accounts a join public.accounting_plans p
    on p.organization_id=a.organization_id and p.id=a.accounting_plan_id
    where a.organization_id=p_organization_id and a.id=(v_line->>'item_id')::uuid
    and a.active and a.row_type='analytic' and a.nature in('revenue','cost','expense','financial_result')
    and p.status='published' and (v_line->>'period')::date between p.valid_from and p.valid_to for share of a,p;
  else
   perform 1 from public.funds where organization_id=p_organization_id
    and id=(v_line->>'item_id')::uuid and active for share;
  end if;
  if not found then raise exception 'budget source no longer eligible' using errcode='23503';end if;
 end loop;
 update public.budget_cycles set status='published',published_by=auth.uid(),published_at=clock_timestamp()
 where organization_id=p_organization_id and id=p_cycle_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'budget.publish','budget_cycle',p_cycle_id,
  jsonb_build_object('revision',p_expected_revision,'lines',jsonb_array_length(v_snapshot->'lines')),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_cycle_id);
 return p_cycle_id;
end $$;
revoke all on function public.publish_tenant_budget(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.publish_tenant_budget(uuid,uuid,text,text,text) to authenticated;
