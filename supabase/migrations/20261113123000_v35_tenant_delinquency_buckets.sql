-- V35 M06.01: Global delinquency summary and filtered paginated delinquency report
create or replace function public.read_tenant_delinquency_bucket_summary(
 p_organization_id uuid
) returns table (
 bucket_id text,
 member_count bigint,
 overdue_items bigint,
 overdue_amount numeric,
 server_date date
) language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null then
  raise exception 'invalid organization' using errcode='22023';
 end if;
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
 or exists(select 1 from public.v_member_financial_position pos
  where pos.organization_id=p_organization_id and pos.integrity_ok is not true)
 then raise exception 'delinquency financial integrity mismatch' using errcode='23514';end if;

 return query
 with canonical_buckets(bucket_id, sort_order) as (
  values
   ('up30'::text, 1),
   ('31-60'::text, 2),
   ('61-90'::text, 3),
   ('over90'::text, 4)
 ),
 overdue as (
  select c.member_id,
   count(*)::bigint as count_items,
   sum(c.open_amount)::numeric(14,2) as amount,
   min(c.due_date) as first_due
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and not c.is_cancelled
   and c.due_date<current_date and c.open_amount>0
  group by c.member_id
 ),
 member_buckets as (
  select d.*,
   (current_date - d.first_due) as days_overdue,
   case
    when (current_date - d.first_due) <= 30 then 'up30'
    when (current_date - d.first_due) <= 60 then '31-60'
    when (current_date - d.first_due) <= 90 then '61-90'
    else 'over90'
   end as b_id
  from overdue d
 ),
 grouped as (
  select
   b.b_id::text as bucket_id,
   count(*)::bigint as member_count,
   sum(b.count_items)::bigint as overdue_items,
   sum(b.amount)::numeric(14,2) as overdue_amount
  from member_buckets b
  group by b.b_id
 )
 select
  cb.bucket_id,
  coalesce(g.member_count, 0)::bigint,
  coalesce(g.overdue_items, 0)::bigint,
  coalesce(g.overdue_amount, 0)::numeric(14,2),
  current_date
 from canonical_buckets cb
 left join grouped g on g.bucket_id = cb.bucket_id
 order by cb.sort_order;
end $$;

create or replace function public.read_tenant_delinquency_filtered(
 p_organization_id uuid,
 p_bucket text,
 p_limit integer,
 p_offset integer
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
 if p_bucket is not null and p_bucket not in ('up30','31-60','61-90','over90') then
  raise exception 'invalid delinquency bucket' using errcode='22023';
 end if;
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
 ),
 member_buckets as (
  select d.*,
   (current_date - d.first_due) as days_overdue,
   case
    when (current_date - d.first_due) <= 30 then 'up30'
    when (current_date - d.first_due) <= 60 then '31-60'
    when (current_date - d.first_due) <= 90 then '61-90'
    else 'over90'
   end as b_id
  from overdue d
 )
 select m.id,m.full_name,m.status,
  b.count_items,b.amount,coalesce(pos.available_credit,0)::numeric(14,2),
  b.first_due,coalesce(pos.net_position,0)::numeric(14,2)
 from member_buckets b
 join public.members m on m.organization_id=p_organization_id and m.id=b.member_id
 left join public.v_member_financial_position pos
  on pos.organization_id=m.organization_id and pos.member_id=m.id
 where (p_bucket is null or b.b_id = p_bucket)
 order by b.amount desc,m.full_name,m.id
 limit p_limit offset p_offset;
end $$;

revoke all on function public.read_tenant_delinquency_bucket_summary(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency_bucket_summary(uuid) to authenticated;

revoke all on function public.read_tenant_delinquency_filtered(uuid,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency_filtered(uuid,text,integer,integer) to authenticated;
