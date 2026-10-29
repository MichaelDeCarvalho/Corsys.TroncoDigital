-- Migration: 20261028000000_v35_support_idempotency.sql
-- Goal: Provide transactional server-side idempotency for tenant support ticket RPCs
--       (create_saas_support_ticket and reply_saas_support_ticket) using private.idempotency_begin / complete.
-- Compatibility: Supports both direct frontend calls with p_idempotency_key and internal RPC callers
--                like reply_master_tenant_support_idempotent.

drop function if exists public.create_saas_support_ticket(uuid, text, text, text, text);
drop function if exists public.create_saas_support_ticket(uuid, text, text, text, text, text);

create or replace function public.create_saas_support_ticket(
  p_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text,
  p_idempotency_key text default null
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

  if length(btrim(p_subject)) = 0 or length(btrim(p_message)) = 0 then
    raise exception 'subject and message are required' using errcode = '22023';
  end if;

  if p_category is null or p_category not in ('finance','reports','access','configuration','billing','other') then
    raise exception 'invalid category' using errcode = '22023';
  end if;

  if p_priority is null or p_priority not in ('low','medium','high','urgent') then
    raise exception 'invalid priority' using errcode = '22023';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
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

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform private.idempotency_complete(
      p_organization_id,
      btrim(p_idempotency_key),
      v_ticket
    );
  end if;

  return v_ticket;
end;
$$;

revoke all on function public.create_saas_support_ticket(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_saas_support_ticket(uuid, text, text, text, text, text) to authenticated;


drop function if exists public.reply_saas_support_ticket(uuid, uuid, text);
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text, text);
drop function if exists public.reply_saas_support_ticket(uuid, uuid, text, text, text);

create or replace function public.reply_saas_support_ticket(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_message text,
  p_next_status text default null,
  p_idempotency_key text default null
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

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
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

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform private.idempotency_complete(
      p_organization_id,
      btrim(p_idempotency_key),
      v_message_id
    );
  end if;

  return v_message_id;
end;
$$;

revoke all on function public.reply_saas_support_ticket(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.reply_saas_support_ticket(uuid, uuid, text, text, text) to authenticated;
