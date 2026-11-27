begin;

create or replace function public.register_tenant_privacy_request_idempotent(
  p_organization_id uuid,
  p_member_id uuid,
  p_request_type text,
  p_data_category text,
  p_verification_method text,
  p_requester_verified boolean,
  p_legal_basis text,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_is_controller boolean := false;
  v_is_self_member boolean := false;
  v_existing jsonb;
  v_req_id uuid;
  v_now timestamptz := clock_timestamp();
  v_due timestamptz;
  v_verified boolean := coalesce(p_requester_verified, false);
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null or not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;
  if p_member_id is not null and not exists (
    select 1 from public.members where organization_id = p_organization_id and id = p_member_id
  ) then
    raise exception 'member not found in organization' using errcode = '23503';
  end if;

  v_is_controller := private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'members.write');
  v_is_self_member := p_member_id is not null
    and private.is_self_member(p_organization_id, p_member_id);

  if not (v_is_controller or v_is_self_member) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  if p_request_type not in ('access', 'correction', 'portability', 'anonymization', 'deletion') then
    raise exception 'invalid privacy request type' using errcode = '22023';
  end if;
  if p_data_category not in ('cadastral', 'financial_ledger', 'sensitive_philosophical', 'access_logs', 'operational_logs', 'attachments') then
    raise exception 'invalid data category' using errcode = '22023';
  end if;
  if p_verification_method not in ('authenticated_member_link', 'signed_document_verified', 'in_person_controller_check') then
    raise exception 'invalid verification method' using errcode = '22023';
  end if;
  if p_legal_basis not in ('legal_obligation_accounting', 'contract_execution', 'legitimate_interest', 'consent', 'exercise_of_rights') then
    raise exception 'invalid legal basis' using errcode = '22023';
  end if;
  if v_notes is not null and length(v_notes) > 1000 then
    raise exception 'notes cannot exceed 1000 characters' using errcode = '22023';
  end if;
  if p_notes is not null and private.m05_has_secret_pattern(p_notes) then
    raise exception 'notes cannot contain secrets or credentials' using errcode = '22023';
  end if;

  if p_verification_method in ('signed_document_verified', 'in_person_controller_check')
     and not v_is_controller then
    raise exception 'controller permission required for controller verification method' using errcode = '42501';
  end if;

  if p_verification_method = 'authenticated_member_link' then
    if p_member_id is null then
      raise exception 'authenticated_member_link requires member_id' using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.member_user_links l
      where l.organization_id = p_organization_id
        and l.member_id = p_member_id
    ) then
      raise exception 'member does not have an authenticated user link' using errcode = '22023';
    end if;
    if v_verified and not v_is_self_member then
      raise exception 'authenticated_member_link verification can only be confirmed by the linked member session' using errcode = '42501';
    end if;
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'register_tenant_privacy_request',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'member_id', p_member_id,
      'request_type', p_request_type,
      'data_category', p_data_category,
      'verification_method', p_verification_method,
      'requester_verified', v_verified,
      'legal_basis', p_legal_basis,
      'notes', coalesce(v_notes, '')
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  v_due := private.add_business_days(v_now, 2);

  insert into public.tenant_privacy_requests (
    organization_id, member_id, requested_by_user_id, request_type,
    requester_verification_method, requester_verified, data_category,
    legal_basis, decision_outcome, triage_due_at, controller_justification
  ) values (
    p_organization_id, p_member_id, v_user, p_request_type,
    p_verification_method, v_verified, p_data_category,
    p_legal_basis, 'pending_triage', v_due, v_notes
  )
  returning id into v_req_id;

  insert into public.tenant_privacy_request_events (
    organization_id, request_id, actor_user_id, event_type, from_outcome, to_outcome, notes
  ) values (
    p_organization_id, v_req_id, v_user, 'registered', null, 'pending_triage', v_notes
  );

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.subject_request_registered',
    'tenant_privacy_requests',
    v_req_id,
    jsonb_build_object(
      'request_type', p_request_type,
      'data_category', p_data_category,
      'verification_method', p_verification_method,
      'requester_verified', v_verified,
      'triage_due_at', v_due
    ),
    'Registro de direito de titular LGPD D02/D03'
  );

  v_result := jsonb_build_object(
    'request_id', v_req_id,
    'organization_id', p_organization_id,
    'decision_outcome', 'pending_triage',
    'triage_due_at', v_due,
    'ledger_preserved', true,
    'requester_verified', v_verified,
    'requester_verification_method', p_verification_method
  );
  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.register_tenant_privacy_request_idempotent(uuid, uuid, text, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.register_tenant_privacy_request_idempotent(uuid, uuid, text, text, text, boolean, text, text, text) to authenticated;

commit;
