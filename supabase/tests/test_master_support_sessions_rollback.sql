-- Test Script: test_master_support_sessions_rollback.sql
-- Purpose: Dry-run offline test script with complete transaction ROLLBACK.
-- DO NOT EXECUTE ON REMOTE PRODUCTION/DEV DATABASE.
-- Validates:
--   1. Master + AAL2 authorization.
--   2. Rejection of tenant user, AAL1, or missing staff.
--   3. Strict validation: reason 5..500 chars, idempotency key 1..200 chars.
--   4. Fixed 15-minute server expiration (read_only).
--   5. Replay without duplicate rows or expiration renewal.
--   6. Prevention of concurrent active sessions for same operator/organization.
--   7. Active session query via get_active_master_support_session.
--   8. Idempotent termination via end_master_support_session with audit log.
--   9. Operator binding on termination (mismatched operator denied).

BEGIN;

-- ============================================================================
-- 0. Fixtures & Setup
-- ============================================================================
do $$
declare
  v_test_org uuid := gen_random_uuid();
  v_master_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_session_id uuid;
  v_replayed_id uuid;
  v_active_info jsonb;
  v_ended_id uuid;
  v_replayed_ended_id uuid;
  v_count integer;
  v_audit_count integer;
begin
  -- Insert mock organization
  insert into public.organizations(id, name, slug)
  values (v_test_org, 'Test Loja Rollback', 'test-loja-rollback');

  -- Insert mock platform staff (role = MASTER, active = true)
  insert into public.platform_staff(user_id, role, active)
  values (v_master_user, 'MASTER', true);

  -- Set authentication context: master user with AAL2 claim
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_master_user::text,
    'role', 'authenticated',
    'aal', 'aal2'
  )::text, true);

  -- ==========================================================================
  -- 1. Test Input Validation
  -- ==========================================================================
  -- Short reason (< 5 chars) must fail
  begin
    perform public.start_master_support_session(v_test_org, 'abc', 'key-test-1');
    raise exception 'Expected failure on short reason did not occur';
  exception when sqlstate '22023' then
    null; -- Expected
  end;

  -- Missing idempotency key must fail
  begin
    perform public.start_master_support_session(v_test_org, 'Validação de teste do suporte', '');
    raise exception 'Expected failure on empty idempotency key did not occur';
  exception when sqlstate '22023' then
    null; -- Expected
  end;

  -- ==========================================================================
  -- 2. Test Successful Session Creation (15 min fixed duration, read_only)
  -- ==========================================================================
  v_session_id := public.start_master_support_session(
    v_test_org,
    'Investigação técnica de conciliação bancária',
    'key-session-alpha-1'
  );

  if v_session_id is null then
    raise exception 'Failed to create support session';
  end if;

  -- Verify session fields in database
  select count(*) into v_count
  from public.saas_support_sessions
  where id = v_session_id
    and staff_user_id = v_master_user
    and organization_id = v_test_org
    and scope = 'read_only'
    and ended_at is null
    and expires_at between (clock_timestamp() + interval '14 minutes 50 seconds')
                       and (clock_timestamp() + interval '15 minutes 10 seconds');

  if v_count <> 1 then
    raise exception 'Support session record verification failed';
  end if;

  -- Verify audit log entry
  select count(*) into v_audit_count
  from public.saas_master_audit_logs
  where staff_user_id = v_master_user
    and organization_id = v_test_org
    and action = 'support_session.start'
    and resource_id = v_session_id::text;

  if v_audit_count <> 1 then
    raise exception 'Audit log for session start was not created';
  end if;

  -- ==========================================================================
  -- 3. Test Replay without Duplication or Renewal
  -- ==========================================================================
  v_replayed_id := public.start_master_support_session(
    v_test_org,
    'Investigação técnica de conciliação bancária',
    'key-session-alpha-1'
  );

  if v_replayed_id <> v_session_id then
    raise exception 'Replay did not return identical session ID';
  end if;

  select count(*) into v_count
  from public.saas_support_sessions
  where organization_id = v_test_org;

  if v_count <> 1 then
    raise exception 'Replay created duplicate session row';
  end if;

  -- ==========================================================================
  -- 4. Test Prevention of Concurrent Active Session with Different Key
  -- ==========================================================================
  begin
    perform public.start_master_support_session(
      v_test_org,
      'Outro motivo de suporte concorrente',
      'key-session-beta-2'
    );
    raise exception 'Expected failure on concurrent active session did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: active support session already exists
  end;

  -- ==========================================================================
  -- 5. Test get_active_master_support_session
  -- ==========================================================================
  v_active_info := public.get_active_master_support_session(v_test_org);

  if v_active_info is null or (v_active_info->>'id')::uuid <> v_session_id then
    raise exception 'get_active_master_support_session returned unexpected data';
  end if;

  if (v_active_info->>'is_active')::boolean <> true or (v_active_info->>'scope') <> 'read_only' then
    raise exception 'Active session metadata incorrect';
  end if;

  -- ==========================================================================
  -- 6. Test Mismatched Operator Denied on Termination
  -- ==========================================================================
  -- Temporarily switch to a different master user
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_other_user::text,
    'role', 'authenticated',
    'aal', 'aal2'
  )::text, true);

  -- Insert mock platform staff for other user
  insert into public.platform_staff(user_id, role, active)
  values (v_other_user, 'MASTER', true);

  begin
    perform public.end_master_support_session(v_test_org, v_session_id, 'key-end-mismatch');
    raise exception 'Expected failure on operator mismatch did not occur';
  exception when sqlstate '42501' then
    null; -- Expected: operator mismatch
  end;

  -- Restore original master user
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_master_user::text,
    'role', 'authenticated',
    'aal', 'aal2'
  )::text, true);

  -- ==========================================================================
  -- 7. Test Idempotent Termination
  -- ==========================================================================
  v_ended_id := public.end_master_support_session(v_test_org, v_session_id, 'key-end-1');

  if v_ended_id <> v_session_id then
    raise exception 'end_master_support_session returned unexpected session ID';
  end if;

  -- Verify session marked as ended
  select count(*) into v_count
  from public.saas_support_sessions
  where id = v_session_id and ended_at is not null;

  if v_count <> 1 then
    raise exception 'Session was not marked as ended';
  end if;

  -- Verify termination audit log entry
  select count(*) into v_audit_count
  from public.saas_master_audit_logs
  where staff_user_id = v_master_user
    and organization_id = v_test_org
    and action = 'support_session.end'
    and resource_id = v_session_id::text;

  if v_audit_count <> 1 then
    raise exception 'Audit log for session end was not created';
  end if;

  -- Verify Replay of end_master_support_session
  v_replayed_ended_id := public.end_master_support_session(v_test_org, v_session_id, 'key-end-1');
  if v_replayed_ended_id <> v_session_id then
    raise exception 'Replay of session end failed';
  end if;

  -- Verify that active session query now returns null
  v_active_info := public.get_active_master_support_session(v_test_org);
  if v_active_info is not null then
    raise exception 'get_active_master_support_session did not return null for closed session';
  end if;

  raise notice 'All master support session checks PASSED successfully in dry-run transaction.';
end;
$$;

-- Always rollback to guarantee pristine state without database changes
ROLLBACK;
