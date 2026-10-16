-- DEV Etapa 2: authorized, idempotent decision on an existing payable approval request.
create function public.decide_payable_approval_idempotent(
 p_organization_id uuid, p_approval_request_id uuid, p_decision text,
 p_reason text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'approvals.review');
 if p_approval_request_id is null or p_decision not in ('approve','reject')
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid approval decision request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'decide_payable_approval_idempotent',
  p_idempotency_key,jsonb_build_object('request_id',p_approval_request_id,'decision',p_decision,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 -- The original RPC enforces reviewer role, locks the request, inserts immutable
 -- approval decision and audit. Unique(request,actor) prevents a second vote.
 v_id:=public.decide_payable_approval(p_organization_id,p_approval_request_id,p_decision,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.decide_payable_approval_idempotent(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.decide_payable_approval_idempotent(uuid,uuid,text,text,text) to authenticated;
