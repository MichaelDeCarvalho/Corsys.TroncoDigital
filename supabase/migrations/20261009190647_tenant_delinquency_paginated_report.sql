-- DEV V35: authoritative overdue receivables by member (unallocated credit shown separately).
create or replace function public.read_tenant_delinquency(
 p_organization_id uuid,p_limit integer,p_offset integer
) returns table (
 member_id uuid,full_name text,member_status text,
 overdue_items bigint,overdue_amount numeric,available_credit numeric,
 oldest_due date,net_position numeric
) language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null or p_limit is null or p_limit not between 1 and 100
  or p_offset is null or p_offset<0 or p_offset>10000
 then raise exception 'invalid delinquency pagination' using errcode='22023';end if;
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
 or exists(select 1 from public.v_member_financial_position pos
  where pos.organization_id=p_organization_id and pos.integrity_ok is not true)
 then raise exception 'delinquency financial integrity mismatch' using errcode='23514';end if;
 return query
 with overdue as (
  select c.member_id,
   count(*)::bigint as count_items,
   sum(c.open_amount)::numeric(14,2) as amount,
   min(c.due_date) as first_due
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and not c.is_cancelled
   and c.due_date<current_date and c.open_amount>0
  group by c.member_id
 )
 select m.id,m.full_name,m.status,
  d.count_items,d.amount,coalesce(pos.available_credit,0)::numeric(14,2),
  d.first_due,coalesce(pos.net_position,0)::numeric(14,2)
 from overdue d
 join public.members m on m.organization_id=p_organization_id and m.id=d.member_id
 left join public.v_member_financial_position pos
  on pos.organization_id=m.organization_id and pos.member_id=m.id
 order by d.amount desc,m.full_name,m.id
 limit p_limit offset p_offset;
end $$;
revoke all on function public.read_tenant_delinquency(uuid,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency(uuid,integer,integer) to authenticated;
