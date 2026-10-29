-- Migration: 20261029000000_v35_master_readonly_support_sessions.sql
-- Goal: Provide strictly controlled, read-only temporary support sessions for Master platform staff.
-- Invariants:
--   1. Operator must be authenticated, platform staff with role MASTER, and verified with MFA (AAL2).
--   2. Target organization_id and operator auth.uid() are strictly bound.
--   3. Reason is mandatory (5..500 characters).
--   4. Scope is strictly 'read_only'. No write permissions or tokens/impersonation are granted.
--   5. Expiration duration is fixed server-side to exactly 15 minutes (clock_timestamp() + interval '15 minutes').
--   6. Replay with identical idempotency key returns the existing session without duplication or expiration renewal.
--   7. Cannot open a new session if an unexpired, active session already exists for the same operator & organization.
--   8. Session termination is idempotent, audits the end event, and restricts closure to the session owner.
--   9. All operations are audited in public.saas_master_audit_logs.

-- ============================================================================
-- 1. start_master_support_session
-- ============================================================================
create or replace function public.start_master_support_session(
  p_organization_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_session_id uuid;
  v_current_active uuid;
  v_started_at timestamptz;
  v_expires_at timestamptz;
  v_payload jsonb;
begin
  -- 1. Authorization: Platform staff MASTER + AAL2
  perform private.require_platform_staff('MASTER');

  -- 2. Validation: Input invariants
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 5 or length(btrim(p_reason)) > 500 then
    raise exception 'reason must be between 5 and 500 characters' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  -- Verify target organization exists
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- 3. Idempotency replay check
  v_payload := jsonb_build_object(
    'reason', btrim(p_reason),
    'scope', 'read_only'
  );

  v_existing := private.idempotency_begin(
    p_organization_id,
    'start_master_support_session',
    btrim(p_idempotency_key),
    v_payload
  );
  if v_existing is not null then
    -- Replay without duplication: returns existing session ID directly.
    -- Does NOT renew or modify expires_at!
    return v_existing;
  end if;

  -- 4. Check if an active, unexpired session already exists for this operator and organization
  select id into v_current_active
  from public.saas_support_sessions
  where staff_user_id = v_user
    and organization_id = p_organization_id
    and ended_at is null
    and expires_at > clock_timestamp();

  if v_current_active is not null then
    raise exception 'active support session already exists for this organization'
      using errcode = '55000';
  end if;

  -- 5. Calculate fixed server-enforced 15-minute window
  v_started_at := clock_timestamp();
  v_expires_at := v_started_at + interval '15 minutes';

  -- 6. Insert support session with read_only scope
  insert into public.saas_support_sessions(
    staff_user_id,
    organization_id,
    reason,
    scope,
    started_at,
    expires_at
  ) values (
    v_user,
    p_organization_id,
    btrim(p_reason),
    'read_only',
    v_started_at,
    v_expires_at
  )
  returning id into v_session_id;

  -- 7. Audit log in saas_master_audit_logs
  insert into public.saas_master_audit_logs(
    staff_user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_user,
    p_organization_id,
    'support_session.start',
    'saas_support_sessions',
    v_session_id::text,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'scope', 'read_only',
      'started_at', v_started_at,
      'expires_at', v_expires_at,
      'duration_minutes', 15,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  -- 8. Complete idempotency
  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    v_session_id
  );

  return v_session_id;
end;
$$;

revoke all on function public.start_master_support_session(uuid, text, text) from public, anon;
grant execute on function public.start_master_support_session(uuid, text, text) to authenticated;

-- ============================================================================
-- 2. get_active_master_support_session
-- ============================================================================
create or replace function public.get_active_master_support_session(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.saas_support_sessions%rowtype;
  v_user uuid := (select auth.uid());
begin
  -- 1. Authorization: Platform staff MASTER + AAL2
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  -- Query active, unexpired, unclosed session for this operator and organization
  select * into v_session
  from public.saas_support_sessions
  where organization_id = p_organization_id
    and staff_user_id = v_user
    and ended_at is null
    and expires_at > clock_timestamp()
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'staff_user_id', v_session.staff_user_id,
    'organization_id', v_session.organization_id,
    'reason', v_session.reason,
    'scope', v_session.scope,
    'started_at', v_session.started_at,
    'expires_at', v_session.expires_at,
    'created_at', v_session.created_at,
    'is_active', true,
    'seconds_remaining', greatest(0, extract(epoch from (v_session.expires_at - clock_timestamp())))::integer
  );
end;
$$;

revoke all on function public.get_active_master_support_session(uuid) from public, anon;
grant execute on function public.get_active_master_support_session(uuid) to authenticated;

-- ============================================================================
-- 3. end_master_support_session
-- ============================================================================
create or replace function public.end_master_support_session(
  p_organization_id uuid,
  p_session_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.saas_support_sessions%rowtype;
  v_existing uuid;
  v_ended_at timestamptz;
begin
  -- 1. Authorization: Platform staff MASTER + AAL2
  perform private.require_platform_staff('MASTER');

  -- 2. Validation
  if p_organization_id is null or p_session_id is null then
    raise exception 'organization id and session id are required' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  -- 3. Idempotency check
  v_existing := private.idempotency_begin(
    p_organization_id,
    'end_master_support_session',
    btrim(p_idempotency_key),
    jsonb_build_object('session_id', p_session_id)
  );
  if v_existing is not null then
    return v_existing;
  end if;

  -- 4. Locate session and lock row
  select * into v_session
  from public.saas_support_sessions
  where id = p_session_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'support session not found' using errcode = '23503';
  end if;

  -- Operator binding: fail-closed if caller is not the session owner
  if v_session.staff_user_id <> v_user then
    raise exception 'operator mismatch on support session' using errcode = '42501';
  end if;

  -- 5. Close session if not already closed
  if v_session.ended_at is null then
    v_ended_at := clock_timestamp();

    update public.saas_support_sessions
    set ended_at = v_ended_at
    where id = p_session_id;

    -- Audit log
    insert into public.saas_master_audit_logs(
      staff_user_id,
      organization_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) values (
      v_user,
      p_organization_id,
      'support_session.end',
      'saas_support_sessions',
      p_session_id::text,
      jsonb_build_object(
        'ended_at', v_ended_at,
        'started_at', v_session.started_at,
        'expires_at', v_session.expires_at,
        'idempotency_key', btrim(p_idempotency_key)
      )
    );
  end if;

  -- 6. Complete idempotency
  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    p_session_id
  );

  return p_session_id;
end;
$$;

revoke all on function public.end_master_support_session(uuid, uuid, text) from public, anon;
grant execute on function public.end_master_support_session(uuid, uuid, text) to authenticated;
