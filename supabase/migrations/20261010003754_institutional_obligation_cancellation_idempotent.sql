-- DEV V35: idempotent cancellation of open institutional obligations.
-- Preserve original posted facts, allocations and existing audited cancellation RPCs.
create or replace function public.cancel_tenant_institutional_obligation_idempotent(
 p_organization_id uuid, p_obligation_id uuid, p_kind text,
 p_accounting_period date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_obligation_id is null or p_kind is null or p_kind not in ('payable','receivable')
  or p_accounting_period is null or extract(day from p_accounting_period)<>1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional cancellation' using errcode='22023';end if;
 v_id:=private.idempotency_begin(
  p_organization_id,'cancel_tenant_institutional_obligation_idempotent',p_idempotency_key,
  jsonb_build_object('kind',p_kind,'obligation_id',p_obligation_id,
    'accounting_period',p_accounting_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 if p_kind='payable' then
  v_id:=public.cancel_institutional_payable(
   p_organization_id,p_obligation_id,p_accounting_period,btrim(p_reason));
 else
  v_id:=public.cancel_institutional_receivable(
   p_organization_id,p_obligation_id,p_accounting_period,btrim(p_reason));
 end if;
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.cancel_tenant_institutional_obligation_idempotent(
 uuid,uuid,text,date,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.cancel_tenant_institutional_obligation_idempotent(
 uuid,uuid,text,date,text,text) to authenticated;
