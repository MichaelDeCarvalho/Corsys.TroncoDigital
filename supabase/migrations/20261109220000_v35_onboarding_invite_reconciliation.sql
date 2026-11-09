begin;

-- M01.02: never turn an uncertain Auth response into an automatic re-send.
-- All operations are under authenticated Master/AAL2; no service-role
-- maintenance endpoint, no recipient email and no privileged Auth API here.

create function public.list_onboarding_invite_reconciliation(p_limit integer default 25)
returns table (
  job_id uuid,
  onboarding_run_id uuid,
  organization_id uuid,
  job_status text,
  attempts integer,
  locked_at timestamptz,
  last_error_code text,
  stale boolean,
  auth_user_present boolean,
  last_reviewed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'invalid reconciliation page size' using errcode = '22023';
  end if;

  return query
  select
    j.id,
    r.id,
    j.organization_id,
    j.status,
    j.attempts,
    j.locked_at,
    j.last_error_code,
    (j.status = 'running'
      and j.attempts = 1
      and j.locked_at <= pg_catalog.now() - interval '15 minutes'),
    exists (
      select 1 from auth.users u
      where pg_catalog.lower(pg_catalog.btrim(u.email)) =
        pg_catalog.lower(pg_catalog.btrim(r.invite_email))
    ),
    (
      select pg_catalog.max(e.created_at)
      from public.saas_onboarding_step_events e
      where e.onboarding_run_id = r.id
        and e.step = 'invite'
        and e.sanitized_summary->>'outcome' = 'reconciliation_observation'
        and e.sanitized_summary->>'job_id' = j.id::text
    )
  from public.saas_jobs j
  join public.saas_onboarding_runs r
    on j.correlation_id = r.id::text
    and j.organization_id = r.organization_id
    and j.idempotency_key = 'onboarding-invite:' || r.id::text
  where j.job_type = 'onboarding_invite'
    and j.attempts > 0
    and (
      j.status = 'running'
      or (j.status = 'failed' and j.last_error_code = 'invite_outcome_unknown')
    )
  order by j.locked_at nulls last, j.id
  limit p_limit;
end;
$$;

create function public.expire_onboarding_invite_claims(p_limit integer default 25)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_job record;
  v_count integer := 0;
begin
  perform private.require_platform_staff('MASTER');
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'invalid reconciliation batch size' using errcode = '22023';
  end if;

  -- Row locks serialize this transition against finish_onboarding_invite.
  -- Expiring never clears attempts or releases the per-email reservation.
  for v_job in
    select j.id, r.id as run_id
    from public.saas_jobs j
    join public.saas_onboarding_runs r
      on j.correlation_id = r.id::text
      and j.organization_id = r.organization_id
      and j.idempotency_key = 'onboarding-invite:' || r.id::text
    where j.job_type = 'onboarding_invite'
      and j.status = 'running'
      and j.attempts = 1
      and j.locked_at <= pg_catalog.now() - interval '15 minutes'
    order by j.locked_at, j.id
    limit p_limit
    for update of j skip locked
  loop
    update public.saas_jobs j
    set status = 'failed',
        completed_at = pg_catalog.now(),
        last_error_code = 'invite_outcome_unknown'
    where j.id = v_job.id
      and j.status = 'running' and j.attempts = 1;

    if found then
      insert into public.saas_onboarding_step_events
        (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
      values (
        v_job.run_id, 'invite', 'failed',
        pg_catalog.jsonb_build_object(
          'job_id', v_job.id,
          'outcome', 'reconciliation_required',
          'reason', 'stale_claim'
        ),
        (select auth.uid())
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create function public.observe_onboarding_invite_reconciliation(
  p_job_id uuid, p_request_id uuid, p_note_code text
)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_run_id uuid;
  v_auth_exists boolean;
begin
  perform private.require_platform_staff('MASTER');
  if p_job_id is null or p_request_id is null
    or p_note_code is null
    or p_note_code not in ('review_pending', 'auth_checked', 'provider_checked')
  then
    raise exception 'invalid reconciliation observation' using errcode = '22023';
  end if;

  -- Observations are immutable audit facts, NOT permission to retry.
  select r.id,
    exists (
      select 1 from auth.users u
      where pg_catalog.lower(pg_catalog.btrim(u.email)) =
        pg_catalog.lower(pg_catalog.btrim(r.invite_email))
    )
  into v_run_id, v_auth_exists
  from public.saas_jobs j
  join public.saas_onboarding_runs r
    on j.correlation_id = r.id::text
    and j.organization_id = r.organization_id
    and j.idempotency_key = 'onboarding-invite:' || r.id::text
  where j.id = p_job_id
    and j.job_type = 'onboarding_invite'
    and j.status = 'failed'
    and j.attempts = 1
    and j.last_error_code = 'invite_outcome_unknown'
  for update of j;

  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.saas_onboarding_step_events e
    where e.onboarding_run_id = v_run_id and e.step = 'invite'
      and e.sanitized_summary->>'job_id' = p_job_id::text
      and e.sanitized_summary->>'request_id' = p_request_id::text
      and e.sanitized_summary->>'outcome' = 'reconciliation_observation'
  ) then
    return true;
  end if;

  insert into public.saas_onboarding_step_events
    (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
  values (
    v_run_id, 'invite', 'saved',
    pg_catalog.jsonb_build_object(
      'job_id', p_job_id,
      'request_id', p_request_id,
      'outcome', 'reconciliation_observation',
      'note_code', p_note_code,
      'auth_user_present', v_auth_exists
    ),
    (select auth.uid())
  );
  return true;
end;
$$;

revoke all on function public.list_onboarding_invite_reconciliation(integer)
  from public, anon, authenticated;
revoke all on function public.expire_onboarding_invite_claims(integer)
  from public, anon, authenticated;
revoke all on function public.observe_onboarding_invite_reconciliation(uuid,uuid,text)
  from public, anon, authenticated;

grant execute on function public.list_onboarding_invite_reconciliation(integer)
  to authenticated;
grant execute on function public.expire_onboarding_invite_claims(integer)
  to authenticated;
grant execute on function public.observe_onboarding_invite_reconciliation(uuid,uuid,text)
  to authenticated;

commit;
