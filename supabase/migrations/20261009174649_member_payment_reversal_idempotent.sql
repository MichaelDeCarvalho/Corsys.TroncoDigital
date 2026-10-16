-- V35 DEV: idempotent wrapper for member payment reversals; preserves the audited original event command.
create function public.reverse_member_payment_idempotent(
 p_organization_id uuid, p_payment_id uuid, p_accounting_period date,
 p_reason text, p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_id uuid;
begin
 perform private.require_permission(p_organization_id,'payments.reverse');
 if p_payment_id is null or p_accounting_period is null
    or extract(day from p_accounting_period)<>1
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid member payment reversal request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'reverse_member_payment_idempotent',
   p_idempotency_key,jsonb_build_object('payment_id',p_payment_id,
     'period',p_accounting_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_id:=public.reverse_payment(p_organization_id,p_payment_id,p_accounting_period,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.reverse_member_payment_idempotent(uuid,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.reverse_member_payment_idempotent(uuid,uuid,date,text,text) to authenticated;
