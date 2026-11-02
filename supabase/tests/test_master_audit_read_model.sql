-- DEV only, after migration activation. Claims are simulated SQL, not real HTTP/MFA.
-- No fixtures or audit events are inserted; all session settings are rolled back.
begin;
set local timezone='UTC';
select set_config('qa.audit_master', (select user_id::text from public.platform_staff where active and role='MASTER' order by user_id limit 1), true);
select set_config('qa.audit_count', (select count(*)::text from public.saas_master_audit_logs), true);
select set_config('qa.audit_expected', (select least(count(*),26)::text from public.saas_master_audit_logs where created_at >= (current_date-30)::timestamp at time zone 'UTC' and created_at < (current_date+1)::timestamp at time zone 'UTC'), true);
set local role authenticated;
do $$
declare
  v_master text := current_setting('qa.audit_master');
  v_row record;
  v_previous bigint;
  v_count integer := 0;
begin
  if v_master is null or v_master='' then raise exception 'DEV MASTER fixture is required'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal2')::text,true);
  for v_row in select * from public.list_master_audit_events(current_date-30,current_date) loop
    if v_previous is not null and v_row.id::bigint>=v_previous then raise exception 'Cursor order failure'; end if;
    if to_jsonb(v_row) ? 'metadata' then raise exception 'Metadata exposed'; end if;
    v_previous:=v_row.id::bigint;
    v_count:=v_count+1;
  end loop;
  if v_count>26 then raise exception 'Page bound failure'; end if;
  if v_count<>current_setting('qa.audit_expected')::integer then raise exception 'Authorized result count mismatch'; end if;
  begin
    perform 1 from public.saas_master_audit_logs limit 1;
    raise exception 'Direct table access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_master_audit_events(current_date,current_date-1);
    raise exception 'Invalid range accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.list_master_audit_events(current_date-400,current_date);
    raise exception 'Oversize range accepted';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal1')::text,true);
  begin
    perform public.list_master_audit_events(current_date-30,current_date);
    raise exception 'AAL1 accepted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated','aal','aal2')::text,true);
  begin
    perform public.list_master_audit_events(current_date-30,current_date);
    raise exception 'Non-staff accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.list_master_audit_events(current_date-30,current_date);
    raise exception 'Anonymous execute accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.saas_master_audit_logs) <> current_setting('qa.audit_count')::bigint then
    raise exception 'Audit history changed';
  end if;
end;
$$;
select 'MASTER_AUDIT_READ_MODEL_SQL_PASS' as result;
rollback;
