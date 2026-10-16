-- DEV V35: idempotent wrappers over immutable ledger cancellation and period-event commands.
create or replace function public.cancel_member_charge_idempotent(
 p_organization_id uuid,p_charge_id uuid,p_accounting_period date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'charges.cancel');
 if p_charge_id is null or p_accounting_period is null or extract(day from p_accounting_period)<>1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid member charge cancellation' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'cancel_member_charge_idempotent',
  p_idempotency_key,jsonb_build_object('charge_id',p_charge_id,'period',p_accounting_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_id:=public.cancel_charge(p_organization_id,p_charge_id,p_accounting_period,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.cancel_member_charge_idempotent(uuid,uuid,date,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.cancel_member_charge_idempotent(uuid,uuid,date,text,text) to authenticated;

create or replace function public.close_financial_period_idempotent(
 p_organization_id uuid,p_period date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'periods.close');
 if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',current_date)::date
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid period closing' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'close_financial_period_idempotent',
  p_idempotency_key,jsonb_build_object('period',p_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_id:=public.close_financial_period(p_organization_id,p_period,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.close_financial_period_idempotent(uuid,date,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.close_financial_period_idempotent(uuid,date,text,text) to authenticated;

create or replace function public.reopen_financial_period_idempotent(
 p_organization_id uuid,p_period date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'periods.reopen');
 if p_period is null or extract(day from p_period)<>1 or p_period>date_trunc('month',current_date)::date
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid period reopening' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'reopen_financial_period_idempotent',
  p_idempotency_key,jsonb_build_object('period',p_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_id:=public.reopen_financial_period(p_organization_id,p_period,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.reopen_financial_period_idempotent(uuid,date,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.reopen_financial_period_idempotent(uuid,date,text,text) to authenticated;
