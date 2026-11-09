begin;

create table private.onboarding_invite_identity (
  run_id uuid primary key references public.saas_onboarding_runs(id),
  user_id uuid not null references auth.users(id),
  terms_version_id uuid references public.saas_terms_versions(id),
  terms_hash text,
  activated_at timestamptz
);
revoke all on private.onboarding_invite_identity from public, anon, authenticated, service_role;

create function public.finish_onboarding_invite_with_identity(
  p_job_id uuid, p_actor uuid, p_invited_user_id uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.finish_onboarding_invite(p_job_id, p_actor, p_invited_user_id is not null) then
    return false;
  end if;

  if p_invited_user_id is not null then
    insert into private.onboarding_invite_identity(run_id, user_id)
    select r.id, u.id
    from public.saas_jobs j
    join public.saas_onboarding_runs r on r.id::text = j.correlation_id
      and r.organization_id = j.organization_id
      and j.idempotency_key = 'onboarding-invite:' || r.id::text
    join auth.users u on u.id = p_invited_user_id
    where j.id = p_job_id and u.invited_at is not null
      and lower(btrim(u.email)) = lower(btrim(r.invite_email));

    if not found then
      raise exception 'invalid invited identity' using errcode = '22023';
    end if;
  end if;
  return true;
end;
$$;

-- Official UTF-8 plain text is provisioned separately by the document owner.
create table private.onboarding_terms_documents (
  version_id uuid primary key references public.saas_terms_versions(id),
  document_text text not null check (length(btrim(document_text)) > 0)
);
revoke all on private.onboarding_terms_documents from public, anon, authenticated, service_role;
create trigger onboarding_terms_documents_immutable
before update or delete on private.onboarding_terms_documents
for each row execute function private.prevent_financial_mutation();

create function public.read_onboarding_invite_terms(p_run_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_status text;
  v_document jsonb;
begin
  select r.status into v_status
  from public.saas_onboarding_runs r
  join private.onboarding_invite_identity i on i.run_id = r.id
  join auth.users u on u.id = i.user_id
  where r.id = p_run_id and u.id = auth.uid() and u.email_confirmed_at is not null
    and u.invited_at is not null and lower(btrim(u.email)) = lower(btrim(r.invite_email))
    and ((r.status = 'awaiting_invite' and r.current_step = 'invite' and i.activated_at is null)
      or (r.status = 'completed' and i.activated_at is not null));
  if not found then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;
  if v_status = 'completed' then
    return jsonb_build_object('status', 'completed');
  end if;
  select jsonb_build_object('status', 'ready', 'version_id', t.id, 'version', t.version,
    'document_hash', t.document_hash, 'document_text', d.document_text)
  into v_document
  from public.saas_terms_versions t
  join private.onboarding_terms_documents d on d.version_id = t.id
  where t.document_type = 'terms' and t.active and t.status = 'published'
    and t.effective_at <= statement_timestamp()
    and (t.valid_to is null or t.valid_to > statement_timestamp())
    and t.document_hash = encode(sha256(convert_to(d.document_text, 'UTF8')), 'hex');
  return coalesce(v_document, jsonb_build_object('status', 'blocked'));
end;
$$;

revoke all on function public.read_onboarding_invite_terms(uuid) from public, anon, authenticated;
grant execute on function public.read_onboarding_invite_terms(uuid) to authenticated;

create function public.accept_onboarding_invite(
  p_run_id uuid, p_terms_version_id uuid, p_document_hash text, p_accept_terms boolean
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_run public.saas_onboarding_runs%rowtype;
  v_invite private.onboarding_invite_identity%rowtype;
  v_role uuid;
  v_now timestamptz := statement_timestamp();
begin
  select r.* into v_run
  from public.saas_onboarding_runs r
  join private.onboarding_invite_identity i on i.run_id = r.id
  where r.id = p_run_id and i.user_id = v_user
  for update of r;

  if not found or not exists (
    select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null
      and u.invited_at is not null and lower(btrim(u.email)) = lower(btrim(v_run.invite_email))
  ) then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;

  select * into strict v_invite from private.onboarding_invite_identity where run_id = p_run_id;
  if v_invite.activated_at is not null then
    if v_invite.terms_version_id is distinct from p_terms_version_id
       or v_invite.terms_hash is distinct from p_document_hash
       or p_accept_terms is distinct from (v_invite.terms_version_id is not null) then
      raise exception 'acceptance differs from recorded receipt' using errcode = '22023';
    end if;
    return v_run.organization_id;
  end if;

  if v_run.status <> 'awaiting_invite' or v_run.current_step <> 'invite'
     or v_run.organization_id is null or v_run.initial_role is null
     or v_run.initial_role not in ('ADMIN', 'TREASURER') then
    raise exception 'invite unavailable' using errcode = '42501';
  end if;

  if p_accept_terms is not true then
    raise exception 'explicit terms acceptance required' using errcode = '22023';
  end if;
  perform 1 from public.saas_terms_versions t
  join private.onboarding_terms_documents d on d.version_id = t.id
  where t.id = p_terms_version_id and t.document_hash = p_document_hash
    and t.document_type = 'terms' and t.active and t.status = 'published'
    and t.effective_at <= v_now and (t.valid_to is null or t.valid_to > v_now)
    and t.document_hash = encode(sha256(convert_to(d.document_text, 'UTF8')), 'hex')
  for share of t;
  if not found then
    raise exception 'current official terms version and hash required' using errcode = '22023';
  end if;

  -- Match the lock used by tenant RBAC assignment and revocation.
  perform 1 from public.organizations where id = v_run.organization_id for update;
  if exists (
    select 1 from public.user_roles
    where organization_id = v_run.organization_id and user_id = v_user
  ) then
    raise exception 'existing tenant membership requires review' using errcode = '42501';
  end if;

  select id into v_role from public.roles
  where organization_id = v_run.organization_id and code = v_run.initial_role and is_system
  for share;
  if not found then
    raise exception 'initial role unavailable' using errcode = '42501';
  end if;

  insert into public.user_roles(organization_id, user_id, role_id)
  values (v_run.organization_id, v_user, v_role);

  insert into public.saas_terms_acceptances(organization_id, user_id, terms_version_id)
  values (v_run.organization_id, v_user, p_terms_version_id);

  update private.onboarding_invite_identity set activated_at = v_now,
    terms_version_id = p_terms_version_id, terms_hash = p_document_hash where run_id = p_run_id;
  update public.saas_onboarding_runs set status = 'completed', current_step = 'completed',
    completed_at = v_now where id = p_run_id;
  insert into public.saas_onboarding_step_events
    (onboarding_run_id, step, event_type, sanitized_summary, actor_user_id)
  values (p_run_id, 'completed', 'completed',
    jsonb_build_object('organization_id', v_run.organization_id, 'role_id', v_role,
      'terms_version_id', p_terms_version_id), v_user);
  return v_run.organization_id;
end;
$$;

revoke all on function public.finish_onboarding_invite_with_identity(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_onboarding_invite_with_identity(uuid, uuid, uuid) to service_role;
revoke all on function public.accept_onboarding_invite(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.accept_onboarding_invite(uuid, uuid, text, boolean) to authenticated;

commit;
