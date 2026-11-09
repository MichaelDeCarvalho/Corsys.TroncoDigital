begin;

create function public.authorize_onboarding_invite_dispatch()
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');
  return auth.uid();
end;
$$;

create function public.claim_onboarding_invite(p_run_id uuid, p_actor uuid)
returns table (job_id uuid, recipient text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.saas_onboarding_runs%rowtype;
  v_email text;
  v_job uuid;
  v_block text;
begin
  if not exists (
    select 1 from public.platform_staff
    where user_id = p_actor and role = 'MASTER' and active
  ) then
    raise exception 'active Master required' using errcode = '42501';
  end if;

  select * into v_run from public.saas_onboarding_runs
  where id = p_run_id for update;

  if not found or v_run.status <> 'awaiting_invite'
     or v_run.current_step <> 'invite' or v_run.organization_id is null then
    return;
  end if;

  v_email := lower(btrim(v_run.invite_email));
  if v_email is null or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('onboarding-invite-email:' || v_email, 0));

  if exists (select 1 from auth.users where lower(btrim(email)) = v_email) then
    v_block := 'invite_existing_account';
  elsif exists (
    select 1 from public.saas_jobs j
    join public.saas_onboarding_runs r on j.correlation_id = r.id::text
      and j.organization_id = r.organization_id
      and j.idempotency_key = 'onboarding-invite:' || r.id::text
    where j.job_type = 'onboarding_invite'
      and j.attempts > 0
      and lower(btrim(r.invite_email)) = v_email
  ) then
    v_block := 'invite_recipient_reserved';
  end if;

  update public.saas_jobs j
  set status = case when v_block is null then 'running' else 'failed' end,
      attempts = case when v_block is null then 1 else 0 end,
      locked_at = case when v_block is null then now() end,
      completed_at = case when v_block is not null then now() end,
      last_error_code = coalesce(v_block, 'invite_outcome_unknown')
  where j.job_type = 'onboarding_invite'
    and j.organization_id = v_run.organization_id
    and j.idempotency_key = 'onboarding-invite:' || p_run_id::text
    and j.correlation_id = p_run_id::text
    and j.sanitized_payload->>'onboarding_run_id' = p_run_id::text
    and j.status = 'queued' and j.attempts = 0 and j.run_at <= now()
  returning j.id into v_job;

  if v_job is not null then
    insert into public.saas_onboarding_step_events
      (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
    values (p_run_id, 'invite', case when v_block is null then 'started' else 'failed' end,
      jsonb_build_object('job_id', v_job, 'outcome', coalesce(v_block, 'reserved')), p_actor);
  end if;

  if v_job is not null and v_block is null then
    return query select v_job, v_email;
  end if;
end;
$$;

create function public.finish_onboarding_invite(p_job_id uuid, p_actor uuid, p_accepted boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  update public.saas_jobs j
  set status = case when p_accepted then 'succeeded' else 'failed' end,
      completed_at = now(),
      last_error_code = case when p_accepted then null else 'invite_outcome_unknown' end
  where j.id = p_job_id and j.job_type = 'onboarding_invite'
    and j.status = 'running' and j.attempts = 1
    and exists (
      select 1 from public.saas_onboarding_step_events e
      where e.onboarding_run_id::text = j.correlation_id
        and e.step = 'invite' and e.event_type = 'started'
        and e.actor_user_id = p_actor
        and e.sanitized_summary->>'job_id' = j.id::text
    )
  returning j.correlation_id::uuid into v_run_id;

  if not found then
    return false;
  end if;

  insert into public.saas_onboarding_step_events
    (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
  values (v_run_id, 'invite', case when p_accepted then 'completed' else 'failed' end,
    jsonb_build_object('job_id', p_job_id, 'outcome',
      case when p_accepted then 'auth_accepted' else 'unknown' end), p_actor);
  return true;
end;
$$;

revoke all on function public.authorize_onboarding_invite_dispatch() from public, anon, authenticated;
revoke all on function public.claim_onboarding_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_onboarding_invite(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.authorize_onboarding_invite_dispatch() to authenticated;
grant execute on function public.claim_onboarding_invite(uuid, uuid) to service_role;
grant execute on function public.finish_onboarding_invite(uuid, uuid, boolean) to service_role;

commit;
