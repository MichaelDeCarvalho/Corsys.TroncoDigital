-- Additive DEV command: immutable institutional movement + allocation reversals.
-- The caller must undo active bank reconciliation first. No historical fact updates.
create function public.reverse_tenant_institutional_movement(
 p_organization_id uuid,p_kind text,p_movement_id uuid,p_reversal_date date,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_id uuid;v_date date;v_period date;v_obligation uuid;v_locked uuid[]:='{}';
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_kind is null or p_kind not in('payable_payment','institutional_receipt')
  or p_movement_id is null or p_reversal_date is null or not isfinite(p_reversal_date)
  or p_reversal_date<date '2020-01-01' or p_reversal_date>date '9999-12-31'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional reversal request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'reverse_tenant_institutional_movement',btrim(p_idempotency_key),
  jsonb_build_object('kind',p_kind,'movement',p_movement_id,'date',p_reversal_date,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_period:=date_trunc('month',p_reversal_date)::date;
 -- Closing and reversal serialize on the same financial_periods row.
 insert into public.financial_periods(organization_id,period) values(p_organization_id,v_period)
  on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=v_period for update;
 if private.is_period_closed(p_organization_id,v_period)
 then raise exception 'reversal period is closed' using errcode='55000';end if;
 if p_kind='payable_payment' then
  -- Allocation triggers lock obligation before fact. Keep that order.
  for v_obligation in select o.id from public.institutional_payables o
   where o.organization_id=p_organization_id and exists(
    select 1 from public.institutional_payable_payment_allocations a left join public.institutional_payable_allocation_reversals r on r.allocation_id=a.id
    where a.organization_id=p_organization_id and a.payable_payment_id=p_movement_id
     and a.payable_id=o.id and r.allocation_id is null)
   order by o.id for update of o loop
   v_locked:=array_append(v_locked,v_obligation);
  end loop;
  select f.payment_date into v_date from public.institutional_payable_payments f
   where f.organization_id=p_organization_id and f.id=p_movement_id for update;
  if not found then raise exception 'movement not found in tenant' using errcode='23503';end if;
  if p_reversal_date<v_date then raise exception 'reversal precedes movement' using errcode='22023';end if;
  if exists(select 1 from public.institutional_payable_payment_reversals where organization_id=p_organization_id and payment_id=p_movement_id)
  then raise exception 'movement already reversed' using errcode='23505';end if;
  -- If a new allocation committed while obtaining locks, retry without acquiring
  -- further obligation locks under the fact lock (which would invert lock order).
  if exists(select 1 from public.institutional_payable_payment_allocations a left join public.institutional_payable_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.payable_payment_id=p_movement_id
    and r.allocation_id is null and not(a.payable_id=any(v_locked)))
  then raise exception 'allocations changed; reload and retry' using errcode='40001';end if;
  if exists(select 1 from public.institutional_payable_payment_allocations a join public.institutional_payable_cancellations c
   on c.organization_id=a.organization_id and c.payable_id=a.payable_id
   left join public.institutional_payable_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.payable_payment_id=p_movement_id and r.allocation_id is null)
  then raise exception 'cannot reverse allocation on canceled obligation' using errcode='55000';end if;
  if exists(select 1 from public.bank_reconciliation_matches m left join public.bank_reconciliation_match_reversals r on r.match_id=m.id
   where m.organization_id=p_organization_id and m.payable_payment_id=p_movement_id and r.match_id is null)
  then raise exception 'undo active bank match before reversal' using errcode='55000';end if;
  insert into public.institutional_payable_allocation_reversals(allocation_id,organization_id,accounting_period,reason,created_by)
   select a.id,p_organization_id,v_period,btrim(p_reason),auth.uid() from public.institutional_payable_payment_allocations a
   left join public.institutional_payable_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.payable_payment_id=p_movement_id and r.allocation_id is null;
  insert into public.institutional_payable_payment_reversals(payment_id,organization_id,reversal_date,accounting_period,reason,created_by)
   values(p_movement_id,p_organization_id,p_reversal_date,v_period,btrim(p_reason),auth.uid());
 elsif p_kind='institutional_receipt' then
  -- Allocation triggers lock obligation before fact. Keep that order.
  for v_obligation in select o.id from public.institutional_receivables o
   where o.organization_id=p_organization_id and exists(
    select 1 from public.institutional_receipt_allocations a left join public.institutional_receipt_allocation_reversals r on r.allocation_id=a.id
    where a.organization_id=p_organization_id and a.receipt_id=p_movement_id
     and a.receivable_id=o.id and r.allocation_id is null)
   order by o.id for update of o loop
   v_locked:=array_append(v_locked,v_obligation);
  end loop;
  select f.receipt_date into v_date from public.institutional_receipts f
   where f.organization_id=p_organization_id and f.id=p_movement_id for update;
  if not found then raise exception 'movement not found in tenant' using errcode='23503';end if;
  if p_reversal_date<v_date then raise exception 'reversal precedes movement' using errcode='22023';end if;
  if exists(select 1 from public.institutional_receipt_reversals where organization_id=p_organization_id and receipt_id=p_movement_id)
  then raise exception 'movement already reversed' using errcode='23505';end if;
  -- If a new allocation committed while obtaining locks, retry without acquiring
  -- further obligation locks under the fact lock (which would invert lock order).
  if exists(select 1 from public.institutional_receipt_allocations a left join public.institutional_receipt_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.receipt_id=p_movement_id
    and r.allocation_id is null and not(a.receivable_id=any(v_locked)))
  then raise exception 'allocations changed; reload and retry' using errcode='40001';end if;
  if exists(select 1 from public.institutional_receipt_allocations a join public.institutional_receivable_cancellations c
   on c.organization_id=a.organization_id and c.receivable_id=a.receivable_id
   left join public.institutional_receipt_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.receipt_id=p_movement_id and r.allocation_id is null)
  then raise exception 'cannot reverse allocation on canceled obligation' using errcode='55000';end if;
  if exists(select 1 from public.bank_reconciliation_matches m left join public.bank_reconciliation_match_reversals r on r.match_id=m.id
   where m.organization_id=p_organization_id and m.institutional_receipt_id=p_movement_id and r.match_id is null)
  then raise exception 'undo active bank match before reversal' using errcode='55000';end if;
  insert into public.institutional_receipt_allocation_reversals(allocation_id,organization_id,accounting_period,reason,created_by)
   select a.id,p_organization_id,v_period,btrim(p_reason),auth.uid() from public.institutional_receipt_allocations a
   left join public.institutional_receipt_allocation_reversals r on r.allocation_id=a.id
   where a.organization_id=p_organization_id and a.receipt_id=p_movement_id and r.allocation_id is null;
  insert into public.institutional_receipt_reversals(receipt_id,organization_id,reversal_date,accounting_period,reason,created_by)
   values(p_movement_id,p_organization_id,p_reversal_date,v_period,btrim(p_reason),auth.uid());
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_movement.reverse',p_kind,p_movement_id,
  jsonb_build_object('reversal_date',p_reversal_date,'period',v_period),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_movement_id);
 return p_movement_id;
end $$;
revoke all on function public.reverse_tenant_institutional_movement(uuid,text,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.reverse_tenant_institutional_movement(uuid,text,uuid,date,text,text) to authenticated;

-- Existing validator locks the fact, then this guard checks its reversal status.
-- Both paths therefore serialize with reversal; no match can commit afterward.
create function private.reject_reversed_institutional_bank_match()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.payable_payment_id is not null then
  perform id from public.institutional_payable_payments where organization_id=new.organization_id and id=new.payable_payment_id for update;
  if exists(select 1 from public.institutional_payable_payment_reversals where organization_id=new.organization_id and payment_id=new.payable_payment_id)
  then raise exception 'cannot reconcile reversed institutional payment' using errcode='55000';end if;
 elsif new.institutional_receipt_id is not null then
  perform id from public.institutional_receipts where organization_id=new.organization_id and id=new.institutional_receipt_id for update;
  if exists(select 1 from public.institutional_receipt_reversals where organization_id=new.organization_id and receipt_id=new.institutional_receipt_id)
  then raise exception 'cannot reconcile reversed institutional receipt' using errcode='55000';end if;
 end if;
 return new;
end $$;
revoke all on function private.reject_reversed_institutional_bank_match() from public,anon,authenticated;
create trigger bank_reconciliation_zz_institutional_unreversed
 before insert on public.bank_reconciliation_matches
 for each row execute function private.reject_reversed_institutional_bank_match();
