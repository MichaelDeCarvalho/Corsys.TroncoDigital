begin;

-- Report classification uses source facts, not accounting competence.
create function public.read_tenant_cash_flow_detail(
 p_organization_id uuid,p_from_date date,p_to_date date,p_page integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_invalid boolean;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_from_date is null or p_to_date is null or not isfinite(p_from_date) or not isfinite(p_to_date)
  or p_to_date<p_from_date or p_to_date-p_from_date>92 or p_page is null or p_page not between 0 and 10000 then
  raise exception 'invalid cash flow period or page' using errcode='22023';
 end if;

 with ledger as materialized (
  select * from public.v_financial_account_movements
  where organization_id=p_organization_id and movement_date<=p_to_date
 ), operational as materialized (
  select l.*,a.name account,
   row_number() over(order by l.movement_date desc,l.movement_type,l.source_id,l.financial_account_id) n
  from ledger l join public.financial_accounts a on a.organization_id=l.organization_id and a.id=l.financial_account_id
  where l.movement_date>=p_from_date and l.movement_type in (
   'member_payment','member_payment_reversal','institutional_receipt','institutional_receipt_reversal',
   'institutional_payable_payment','institutional_payable_payment_reversal')
 ), page as (
  select * from operational where n>p_page*25 and n<=p_page*25+25
 ), payables as materialized (
  select p.id,p.organization_id,p.created_at,p.reference,p.notes,
   abs(o.signed_amount) amount,o.movement_type,o.n
  from operational o join public.institutional_payable_payments p
    on p.organization_id=o.organization_id and p.id=o.source_id
  where o.movement_type in ('institutional_payable_payment','institutional_payable_payment_reversal')
 ), payable_parts as materialized (
  select p.n,a.amount,coalesce(c.new_category_id,b.category_id) category_id,
   coalesce(c.new_description,b.description) description
  from payables p
  join public.institutional_payable_payment_allocations a on a.organization_id=p.organization_id
    and a.payable_payment_id=p.id and a.created_at<=p.created_at
  join public.institutional_payables b on b.organization_id=a.organization_id and b.id=a.payable_id
  left join lateral (
   select c.new_category_id,c.new_description from public.institutional_payable_corrections c
   where c.organization_id=b.organization_id and c.payable_id=b.id and c.created_at<=p.created_at
   order by c.correction_seq desc limit 1
  ) c on true
  where not exists (
   select 1 from public.institutional_payable_allocation_reversals r
   where r.organization_id=a.organization_id and r.allocation_id=a.id and r.created_at<p.created_at
  )
 ), split as (
  select n,category_id,amount from payable_parts
  union all
  select p.n,null,p.amount-coalesce((select sum(a.amount) from payable_parts a where a.n=p.n),0)
  from payables p
 ), ranked as (
  select s.category_id,c.name category,
    sum(case when p.movement_type='institutional_payable_payment' then s.amount else -s.amount end) amount
  from split s join payables p using(n)
  left join public.financial_categories c on c.organization_id=p_organization_id and c.id=s.category_id
  group by s.category_id,c.name
 ), top_expenses as (
  select * from ranked where amount>0 order by amount desc,category_id nulls last limit 10
 ), origins as (
  select n,category_id,description from payable_parts
  where n>p_page*25 and n<=p_page*25+25
  union all
  select o.n,b.category_id,b.description
  from page o
  join public.payments p on p.organization_id=o.organization_id and p.id=o.source_id
  join public.receivable_allocations a on a.organization_id=p.organization_id and a.member_id=p.member_id and a.payment_id=p.id
  join public.charges b on b.organization_id=a.organization_id and b.member_id=a.member_id and b.id=a.charge_id
  left join public.payment_reversals pr on pr.organization_id=p.organization_id and pr.payment_id=p.id
  where o.movement_type in ('member_payment','member_payment_reversal') and (
   (o.movement_type='member_payment' and exists(select 1 from public.v_active_allocations v
     where v.organization_id=a.organization_id and v.id=a.id))
   or (pr.payment_id is not null and a.created_at<=pr.created_at and not exists(
     select 1 from public.allocation_reversals ar where ar.organization_id=a.organization_id
       and ar.allocation_id=a.id and ar.created_at<pr.created_at))
  )
  union all
  select o.n,coalesce(c.new_category_id,b.category_id),coalesce(c.new_description,b.description)
  from page o
  join public.institutional_receipts p on p.organization_id=o.organization_id and p.id=o.source_id
  join public.institutional_receipt_allocations a on a.organization_id=p.organization_id
   and a.receipt_id=p.id and a.created_at<=p.created_at
  join public.institutional_receivables b on b.organization_id=a.organization_id and b.id=a.receivable_id
  left join lateral (
   select c.new_category_id,c.new_description from public.institutional_receivable_corrections c
   where c.organization_id=b.organization_id and c.receivable_id=b.id and c.created_at<=p.created_at
   order by c.correction_seq desc limit 1
  ) c on true
  where o.movement_type in ('institutional_receipt','institutional_receipt_reversal') and not exists(
   select 1 from public.institutional_receipt_allocation_reversals r
   where r.organization_id=a.organization_id and r.allocation_id=a.id and r.created_at<p.created_at
  )
 ), detail as (
  select o.n,o.movement_date,o.movement_type,o.source_id,o.account,o.signed_amount,
   coalesce(nullif(btrim(coalesce(p.notes,p.reference,r.notes,r.reference,b.notes,b.reference)), ''),
     (select string_agg(distinct x.description,' • ' order by x.description) from origins x where x.n=o.n)) description,
   (select string_agg(distinct c.name,' • ' order by c.name) from origins x
     join public.financial_categories c on c.organization_id=p_organization_id and c.id=x.category_id
     where x.n=o.n) category
  from page o
  left join public.payments p on p.organization_id=o.organization_id and p.id=o.source_id
   and o.movement_type in ('member_payment','member_payment_reversal')
  left join public.institutional_receipts r on r.organization_id=o.organization_id and r.id=o.source_id
   and o.movement_type in ('institutional_receipt','institutional_receipt_reversal')
  left join payables b on b.n=o.n
 ), daily as (
  select movement_date,sum(signed_amount) amount from ledger group by movement_date
 ), opening as (
  select coalesce(sum(amount),0) amount from daily where movement_date<p_from_date
 ), closing as (
  select d::date as day,opening.amount+sum(coalesce(daily.amount,0)) over(order by d) balance
  from generate_series(p_from_date::timestamp,p_to_date::timestamp,interval '1 day') d
  cross join opening left join daily on daily.movement_date=d::date
 )
 select jsonb_build_object('organization_id',p_organization_id,'page',p_page,
   'total',(select count(*) from operational),
   'rows',coalesce((select jsonb_agg(to_jsonb(d)-'n' order by n) from detail d),'[]'::jsonb),
   'opening',(select amount from opening),
   'closing',(select balance from closing where day=p_to_date),
   'history',(select jsonb_agg(closing order by day) from closing),
   'expenses',coalesce((select jsonb_agg(top_expenses order by amount desc,category_id nulls last) from top_expenses),'[]'::jsonb),
   'expense_net',(select coalesce(sum(amount),0) from ranked)),
   exists(select 1 from split where amount<0)
 into v_result,v_invalid;

 if v_invalid then raise exception 'expense allocations exceed payment' using errcode='23514'; end if;
 return v_result;
end;
$$;

revoke all on function public.read_tenant_cash_flow_detail(uuid,date,date,integer) from public,anon,authenticated;
grant execute on function public.read_tenant_cash_flow_detail(uuid,date,date,integer) to authenticated;

commit;
