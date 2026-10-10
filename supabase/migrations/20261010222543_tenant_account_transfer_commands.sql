-- V35 DEV: transfers only reallocate cash/bank balances. They never create DRE revenue or expense.
-- Reversals are append-only events; posted original transfer stays immutable.
create or replace function public.register_tenant_account_transfer_idempotent(
 p_organization_id uuid,p_from_account_id uuid,p_to_account_id uuid,
 p_transfer_date date,p_amount numeric,p_reference text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_open numeric;v_accounts integer;v_period date;v_ref text;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_from_account_id is null or p_to_account_id is null or p_from_account_id=p_to_account_id
  or p_transfer_date is null or p_transfer_date>current_date or p_transfer_date<date '2020-01-01'
  or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_reference is not null and length(btrim(p_reference))>120
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid financial account transfer' using errcode='22023';end if;
 v_ref:=nullif(btrim(p_reference),'');
 v_period:=date_trunc('month',p_transfer_date)::date;
 v_id:=private.idempotency_begin(p_organization_id,'register_tenant_account_transfer_idempotent',
  btrim(p_idempotency_key),jsonb_build_object('from',p_from_account_id,'to',p_to_account_id,
  'date',p_transfer_date,'amount',p_amount,'reference',v_ref,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 -- Lock both rows in deterministic order to serialize transfer-to-transfer movements.
 perform id from public.financial_accounts
  where organization_id=p_organization_id and id in (p_from_account_id,p_to_account_id)
   and active=true order by id for update;
 get diagnostics v_accounts=row_count;
 if v_accounts<>2 then raise exception 'active source/destination accounts not found in tenant'
   using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,v_period) then
  raise exception 'transfer posting period closed' using errcode='55000';end if;
 select coalesce(sum(m.signed_amount),0)::numeric(14,2) into v_open
 from public.v_financial_account_movements m
 where m.organization_id=p_organization_id and m.financial_account_id=p_from_account_id
 and m.movement_date<=p_transfer_date;
 if v_open<p_amount then raise exception 'insufficient available ledger balance in source account'
  using errcode='23514';end if;
 insert into public.financial_account_transfers(
  organization_id,from_account_id,to_account_id,transfer_date,accounting_period,
  amount,reference,reason,created_by
 )values(
  p_organization_id,p_from_account_id,p_to_account_id,p_transfer_date,v_period,
  p_amount,v_ref,btrim(p_reason),auth.uid()
 ) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'financial_account_transfer.post','financial_account_transfer',v_id,
  jsonb_build_object('from',p_from_account_id,'to',p_to_account_id,'amount',p_amount,
   'transfer_date',p_transfer_date,'accounting_period',v_period,'reference',v_ref),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text) to authenticated;

create or replace function public.reverse_tenant_account_transfer_idempotent(
 p_organization_id uuid,p_transfer_id uuid,p_reversal_date date,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_transfer public.financial_account_transfers%rowtype;
 v_period date;v_dest_balance numeric;v_account_count integer;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_transfer_id is null or p_reversal_date is null or p_reversal_date>current_date
  or p_reversal_date<date '2020-01-01'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid account transfer reversal' using errcode='22023';end if;
 v_period:=date_trunc('month',p_reversal_date)::date;
 v_id:=private.idempotency_begin(p_organization_id,'reverse_tenant_account_transfer_idempotent',
  btrim(p_idempotency_key),jsonb_build_object('transfer',p_transfer_id,
  'date',p_reversal_date,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_transfer from public.financial_account_transfers
 where organization_id=p_organization_id and id=p_transfer_id for update;
 if not found then raise exception 'transfer not found in tenant' using errcode='23503';end if;
 if p_reversal_date<v_transfer.transfer_date
 then raise exception 'reversal cannot predate original transfer' using errcode='22023';end if;
 if exists(select 1 from public.financial_account_transfer_reversals
   where transfer_id=p_transfer_id and organization_id=p_organization_id)
 then raise exception 'transfer already reversed' using errcode='23514';end if;
 -- Do not require accounts to remain active for reversal of an already-posted fact.
 perform id from public.financial_accounts
 where organization_id=p_organization_id and id in(v_transfer.from_account_id,v_transfer.to_account_id)
 order by id for update;
 get diagnostics v_account_count=row_count;
 if v_account_count<>2 then raise exception 'account not found for transfer reversal'
  using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,v_period) then
  raise exception 'reversal period closed' using errcode='55000';end if;
 select coalesce(sum(m.signed_amount),0)::numeric(14,2) into v_dest_balance
 from public.v_financial_account_movements m
 where m.organization_id=p_organization_id and m.financial_account_id=v_transfer.to_account_id
 and m.movement_date<=p_reversal_date;
 if v_dest_balance<v_transfer.amount then
   raise exception 'insufficient destination ledger balance for reversal' using errcode='23514';end if;
 insert into public.financial_account_transfer_reversals(
  transfer_id,organization_id,reversal_date,accounting_period,reason,created_by
 )values(p_transfer_id,p_organization_id,p_reversal_date,v_period,btrim(p_reason),auth.uid());
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'financial_account_transfer.reverse','financial_account_transfer',
 p_transfer_id,jsonb_build_object('reversal_date',p_reversal_date,'original_date',v_transfer.transfer_date,
  'amount',v_transfer.amount,'from',v_transfer.from_account_id,'to',v_transfer.to_account_id),
 btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_transfer_id);
 return p_transfer_id;
end $$;
revoke all on function public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text) to authenticated;
