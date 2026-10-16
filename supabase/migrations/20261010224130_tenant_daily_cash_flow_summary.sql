-- DEV V35: daily cash-flow summary from complete tenant ledger and open obligations.
-- Revenue/expense recognition is NOT inferred from cash movements; account transfers
-- and opening balances are excluded from operational inflow/outflow.
create or replace function public.read_tenant_daily_cash_flow(
 p_organization_id uuid,p_from_date date,p_to_date date
) returns table(
 movement_day date,received numeric,paid numeric,realized_net numeric,
 member_receivables_due numeric,institutional_receivables_due numeric,
 institution_payables_due numeric,projected_net numeric
) language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_from_date is null or p_to_date is null or p_to_date<p_from_date
  or p_to_date-p_from_date>92
 then raise exception 'cash flow range must contain 1 to 93 days' using errcode='22023';end if;
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
  or exists(select 1 from public.v_institutional_receivable_effective r
   where r.organization_id=p_organization_id and r.integrity_ok is not true)
  or exists(select 1 from public.v_institutional_payable_effective p
   where p.organization_id=p_organization_id and p.integrity_ok is not true)
 then raise exception 'financial integrity mismatch prevents daily cash flow'
 using errcode='23514';end if;
 return query
 with days as(
  select generate_series(p_from_date::timestamp,p_to_date::timestamp,interval '1 day')::date d
 ),
 actual as(
  select m.movement_date d,
   coalesce(sum(m.signed_amount) filter(where m.movement_type in(
    'member_payment','member_payment_reversal',
    'institutional_receipt','institutional_receipt_reversal')),0)::numeric(14,2) inflow,
   coalesce(sum(-m.signed_amount) filter(where m.movement_type in(
    'institutional_payable_payment','institutional_payable_payment_reversal')),0)::numeric(14,2) outflow
  from public.v_financial_account_movements m
  where m.organization_id=p_organization_id
   and m.movement_date between p_from_date and p_to_date
  group by m.movement_date
 ),
 member_open as(
  select c.due_date d,sum(c.open_amount)::numeric(14,2) amt
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.due_date between p_from_date and p_to_date
   and not c.is_cancelled and c.open_amount>0
  group by c.due_date
 ),
 institution_open as(
  select r.due_date d,sum(r.open_amount)::numeric(14,2) amt
  from public.v_institutional_receivable_effective r
  where r.organization_id=p_organization_id and r.due_date between p_from_date and p_to_date
   and not r.is_canceled and r.open_amount>0
  group by r.due_date
 ),
 payable_open as(
  select p.due_date d,sum(p.open_amount)::numeric(14,2) amt
  from public.v_institutional_payable_effective p
  where p.organization_id=p_organization_id and p.due_date between p_from_date and p_to_date
   and not p.is_canceled and p.open_amount>0
  group by p.due_date
 )
 select days.d,
  coalesce(actual.inflow,0)::numeric(14,2),
  coalesce(actual.outflow,0)::numeric(14,2),
  (coalesce(actual.inflow,0)-coalesce(actual.outflow,0))::numeric(14,2),
  coalesce(member_open.amt,0)::numeric(14,2),
  coalesce(institution_open.amt,0)::numeric(14,2),
  coalesce(payable_open.amt,0)::numeric(14,2),
  (coalesce(member_open.amt,0)+coalesce(institution_open.amt,0)-coalesce(payable_open.amt,0))::numeric(14,2)
 from days
 left join actual on actual.d=days.d
 left join member_open on member_open.d=days.d
 left join institution_open on institution_open.d=days.d
 left join payable_open on payable_open.d=days.d
 order by days.d;
end $$;
revoke all on function public.read_tenant_daily_cash_flow(uuid,date,date) from public,anon,authenticated;
grant execute on function public.read_tenant_daily_cash_flow(uuid,date,date) to authenticated;
