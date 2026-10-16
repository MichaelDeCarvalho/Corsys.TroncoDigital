-- Supabase default explicit anon grants survive REVOKE FROM PUBLIC.
-- Keep authenticated RPC grants; remove anonymous execution of definer functions.
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.prokind='f'
  loop
    execute format('revoke execute on function %s from public, anon',v_function);
  end loop;
end;
$$;

-- Event trigger installation is owned by the platform, not an application RPC.
revoke execute on function public.rls_auto_enable() from authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
