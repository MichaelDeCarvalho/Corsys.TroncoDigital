-- Run after all migrations in disposable DEV; validates catalog, not row behavior.
begin;
do $$
declare
  v_names text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_names
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if v_names is not null then
    raise exception 'RLS missing on public tables: %', v_names;
  end if;
  select string_agg(c.relname, ', ' order by c.relname) into v_names
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')
    and not coalesce(c.reloptions @> array['security_invoker=true'],false);
  if v_names is not null then
    raise exception 'Exposed views lack security_invoker: %', v_names;
  end if;
  if not pg_catalog.has_function_privilege('authenticated','private.saas_plan_delete_block_reason(uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated','private.saas_promotion_delete_block_reason(uuid)','EXECUTE') then
    raise exception 'Administrative view helpers missing EXECUTE privilege';
  end if;
  if pg_catalog.has_function_privilege('anon','private.saas_plan_delete_block_reason(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('anon','private.saas_promotion_delete_block_reason(uuid)','EXECUTE') then
    raise exception 'Anonymous catalog helper execution must be denied';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.prokind='f'
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) then
    raise exception 'Anonymous public SECURITY DEFINER execution must be denied';
  end if;
  if not has_function_privilege('authenticated','private.is_tenant_user(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','private.has_aal2()','EXECUTE')
    or has_function_privilege('anon','private.is_tenant_user(uuid)','EXECUTE')
    or has_function_privilege('anon','private.has_aal2()','EXECUTE') then
    raise exception 'Private policy predicate grants do not match least privilege';
  end if;
  raise notice 'PASS: security catalog checks; JWT/RLS behavior still requires integration tests';
end;
$$;
rollback;
