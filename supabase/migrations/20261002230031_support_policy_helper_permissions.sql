-- Private predicates used directly by tenant RLS and security_invoker views.
-- Each predicate evaluates auth.uid()/auth.jwt(); no tenant impersonation is allowed.
revoke all on function private.is_tenant_user(uuid) from public, anon;
revoke all on function private.has_aal2() from public, anon;
grant execute on function private.is_tenant_user(uuid) to authenticated;
grant execute on function private.has_aal2() to authenticated;
