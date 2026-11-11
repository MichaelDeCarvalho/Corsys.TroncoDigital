begin;

alter policy saas_jobs_platform_select on public.saas_jobs
  using ((select auth.jwt() ->> 'aal') = 'aal2'
         and (select private.is_platform_staff('MASTER')));

revoke select on public.saas_jobs from public, anon, authenticated;
grant select (
  id, organization_id, job_type, status, attempts, max_attempts,
  last_error_code, created_at, locked_at, completed_at
) on public.saas_jobs to authenticated;

commit;
