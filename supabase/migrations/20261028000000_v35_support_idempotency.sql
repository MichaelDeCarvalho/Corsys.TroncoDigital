-- Migration: 20261028000000_v35_support_idempotency.sql
-- Goal: Provide strictly fail-closed transactional server-side idempotency for support ticket RPCs
--       (create_saas_support_ticket, reply_saas_support_ticket, and reply_master_tenant_support_idempotent).
-- Invariants:
--   1. No ticket creation or reply can occur without a valid idempotency key (1..200 chars).
--   2. Direct caller idempotency is tracked via private.idempotency_begin / idempotency_complete.
--   3. Master operation delegating to internal reply uses a deterministic inner key ('m-reply:' || md5(key))
--      satisfying the unique constraint on (organization_id, user_id, idempotency_key).
--   4. Preserves RLS, search_path = '', SECURITY DEFINER, tenant isolation, and audit events.

-- ============================================================================
-- 1. create_saas_support_ticket
-- ============================================================================
drop function if exists public.create_saas_support_ticket(uuid, text, text, text, text);
drop function if exists public.create_saas_support_ticket(uuid, text, text, text, text, text);

create or replace function public.create_saas_support_ticket(
  p_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ticket uuid;
  v_existing uuid;
  v_payload jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.is_tenant_user(p_organization_id) then
    raise exception 'tenant membership required' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  if length(btrim(p_subject)) = 0 or length(btrim(p_message)) = 0 then
    raise exception 'subject and message are required' using errcode = '22023';
  end if;

  if p_category is null or p_category not in ('finance','reports','access','configuration','billing','other') then
    raise exception 'invalid category' using errcode = '22023';
  end if;

  if p_priority is null or p_priority not in ('low','medium','high','urgent') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'subject', btrim(p_subject),
    'category', p_category,
    'priority', p_priority,
    'message', btrim(p_message)
  );

  v_existing := private.idempotency_begin(
    p_organization_id,
    'create_saas_support_ticket',
    btrim(p_idempotency_key),
    v_payload
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_support_tickets(
    organization_id, subject, category, priority, opened_by_user_id
  ) values (
    p_organization_id, btrim(p_subject), p_category, p_priority, v_user
  )
  returning id into v_ticket;

  insert into public.saas_support_ticket_messages(
    organization_id, ticket_id, sender_user_id, sender_kind, visibility, body
  ) values (
    p_organization_id, v_ticket, v_user, 'tenant_user', 'customer', btrim(p_message)
  );

  insert into public.saas_support_ticket_events(
    organization_id, ticket_id, from_status, to_status, actor_user_id
  ) values (
    p_organization_id, v_ticket, null, 'new', v_user
  );

  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    v_ticket
  );

  return v_ticket;
end;
$$;

revoke all on function public.create_saas_support_ticket(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_saas_support_ticket(uuid, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 2. reply_saas_support_ticket
-- ============================================================================
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text);
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text, text);
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text, text, text);
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text, text, text, text);

create or replace function public.reply_saas_support_ticket(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_message text,
  p_idempotency_key text,
  p_next_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_old_status text;
  v_staff boolean;
  v_message_id uuid;
  v_existing uuid;
  v_payload jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  v_staff := private.is_platform_staff('MASTER') or private.is_platform_staff('SUPPORT');

  if not v_staff and not private.is_tenant_user(p_organization_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  if length(btrim(p_message)) = 0 then
    raise exception 'message is required' using errcode = '22023';
  end if;

  select t.status into v_old_status
  from public.saas_support_tickets t
  where t.organization_id = p_organization_id
    and t.id = p_ticket_id
  for update;

  if v_old_status is null then
    raise exception 'ticket not found' using errcode = '23503';
  end if;

  v_payload := jsonb_build_object(
    'ticket_id', p_ticket_id,
    'message', btrim(p_message),
    'next_status', p_next_status
  );

  v_existing := private.idempotency_begin(
    p_organization_id,
    'reply_saas_support_ticket',
    btrim(p_idempotency_key),
    v_payload
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_support_ticket_messages(
    organization_id, ticket_id, sender_user_id, sender_kind, visibility, body
  ) values (
    p_organization_id, p_ticket_id, v_user,
    case when v_staff then 'platform_staff' else 'tenant_user' end,
    'customer', btrim(p_message)
  )
  returning id into v_message_id;

  if v_staff and p_next_status is not null then
    if p_next_status not in ('new','triage','working','waiting_client','resolved','closed') then
      raise exception 'invalid ticket status' using errcode = '22023';
    end if;

    update public.saas_support_tickets
    set status = p_next_status,
        resolved_at = case when p_next_status = 'resolved' then now() else resolved_at end,
        closed_at = case when p_next_status = 'closed' then now() else closed_at end
    where organization_id = p_organization_id
      and id = p_ticket_id;

    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, actor_user_id
    ) values (
      p_organization_id, p_ticket_id, v_old_status, p_next_status, v_user
    );
  elsif not v_staff and v_old_status in ('resolved','closed') then
    update public.saas_support_tickets
    set status = 'working', resolved_at = null, closed_at = null
    where organization_id = p_organization_id and id = p_ticket_id;

    insert into public.saas_support_ticket_events(
      organization_id, ticket_id, from_status, to_status, actor_user_id, reason
    ) values (
      p_organization_id, p_ticket_id, v_old_status, 'working', v_user, 'customer_reopened'
    );
  end if;

  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    v_message_id
  );

  return v_message_id;
end;
$$;

revoke all on function public.reply_saas_support_ticket(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.reply_saas_support_ticket(uuid, uuid, text, text, text) to authenticated;

-- ============================================================================
-- 3. reply_master_tenant_support_idempotent
-- ============================================================================
create or replace function public.reply_master_tenant_support_idempotent(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_message text,
  p_next_status text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result uuid;
  v_inner_key text;
begin
  perform private.require_platform_staff('MASTER');

  if p_organization_id is null or p_ticket_id is null
    or p_message is null or length(btrim(p_message)) not between 1 and 5000
    or (p_next_status is not null and p_next_status not in
      ('new','triage','working','waiting_client','resolved','closed'))
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  then
    raise exception 'invalid master support response' using errcode = '22023';
  end if;

  v_result := private.idempotency_begin(
    p_organization_id,
    'reply_master_tenant_support_idempotent',
    btrim(p_idempotency_key),
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'message', btrim(p_message),
      'next_status', p_next_status
    )
  );
  if v_result is not null then
    return v_result;
  end if;

  perform 1 from public.saas_support_tickets
  where id = p_ticket_id and organization_id = p_organization_id and ticket_scope = 'tenant'
  for update;

  if not found then
    raise exception 'tenant support ticket not found in organization'
      using errcode = '23503';
  end if;

  -- Deterministic inner idempotency key delegating to internal reply RPC
  v_inner_key := 'm-reply:' || md5(btrim(p_idempotency_key));

  v_result := public.reply_saas_support_ticket(
    p_organization_id,
    p_ticket_id,
    btrim(p_message),
    v_inner_key,
    p_next_status
  );

  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    v_result
  );

  return v_result;
end $$;

revoke all on function public.reply_master_tenant_support_idempotent(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.reply_master_tenant_support_idempotent(uuid, uuid, text, text, text) to authenticated;
