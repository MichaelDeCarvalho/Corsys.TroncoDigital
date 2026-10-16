-- V35 DEV: Master replies to tenant support tickets with stable idempotent command IDs.
-- Internal platform tickets are intentionally excluded; their lifecycle is distinct.
create or replace function public.reply_master_tenant_support_idempotent(
 p_organization_id uuid,p_ticket_id uuid,p_message text,p_next_status text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_result uuid;
begin
 perform private.require_platform_staff('MASTER');
 if p_organization_id is null or p_ticket_id is null
  or p_message is null or length(btrim(p_message)) not between 1 and 5000
  or (p_next_status is not null and p_next_status not in
    ('new','triage','working','waiting_client','resolved','closed'))
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid master support response' using errcode='22023';end if;
 v_result:=private.idempotency_begin(p_organization_id,'reply_master_tenant_support_idempotent',
  p_idempotency_key,jsonb_build_object('ticket_id',p_ticket_id,
    'message',btrim(p_message),'next_status',p_next_status));
 if v_result is not null then return v_result;end if;
 perform 1 from public.saas_support_tickets
  where id=p_ticket_id and organization_id=p_organization_id and ticket_scope='tenant'
  for update;
 if not found then raise exception 'tenant support ticket not found in organization'
  using errcode='23503';end if;
 v_result:=public.reply_saas_support_ticket(
   p_organization_id,p_ticket_id,btrim(p_message),p_next_status);
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $$;
revoke all on function public.reply_master_tenant_support_idempotent(
 uuid,uuid,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.reply_master_tenant_support_idempotent(
 uuid,uuid,text,text,text) to authenticated;
