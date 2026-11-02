-- Additive, read-only API; does not grant SELECT on the backend audit table.
create function public.list_master_audit_events(
  p_from date,
  p_to date,
  p_action text default null,
  p_organization_id uuid default null,
  p_before_id bigint default null,
  p_limit integer default 26
)
returns table (
  id text,
  created_at timestamptz,
  staff_user_id uuid,
  organization_id uuid,
  action text,
  resource_type text,
  resource_id text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366
     or p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_id is not null and p_before_id <= 0)
     or (p_action is not null and (length(btrim(p_action)) < 1 or length(p_action) > 100)) then
    raise exception 'Invalid audit filters' using errcode = '22023';
  end if;

  return query
  select a.id::text, a.created_at, a.staff_user_id, a.organization_id,
         a.action, a.resource_type, a.resource_id
  from public.saas_master_audit_logs a
  where a.created_at >= (p_from::timestamp at time zone 'UTC')
    and a.created_at < ((p_to + 1)::timestamp at time zone 'UTC')
    and (p_action is null or a.action = btrim(p_action))
    and (p_organization_id is null or a.organization_id = p_organization_id)
    and (p_before_id is null or a.id < p_before_id)
  order by a.id desc
  limit p_limit;
end;
$$;

revoke all on function public.list_master_audit_events(date,date,text,uuid,bigint,integer) from public, anon;
grant execute on function public.list_master_audit_events(date,date,text,uuid,bigint,integer) to authenticated;
comment on function public.list_master_audit_events(date,date,text,uuid,bigint,integer)
  is 'MASTER + AAL2 only; UTC inclusive dates; descending ID cursor; metadata intentionally omitted.';
