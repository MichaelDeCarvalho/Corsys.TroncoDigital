-- V35 DEV: idempotent correction of posted institutional obligations with optimistic state guard.
-- This RPC delegates accounting classification, approval-policy snapshots and immutable
-- correction ledger events to the two existing institutional correction commands.
create or replace function public.correct_tenant_institutional_obligation_idempotent(
 p_organization_id uuid,p_obligation_id uuid,p_kind text,p_expected_state jsonb,
 p_new_category_id uuid,p_new_fund_id uuid,p_new_description text,
 p_new_competence date,p_new_due_date date,p_new_amount numeric,
 p_accounting_period date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_current record;v_state jsonb;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_obligation_id is null or p_kind not in ('payable','receivable')
  or p_expected_state is null or jsonb_typeof(p_expected_state)<>'object'
  or p_new_category_id is null or p_new_description is null
  or length(btrim(p_new_description)) not between 3 and 300
  or p_new_competence is null or extract(day from p_new_competence)<>1
  or p_new_due_date is null or p_accounting_period is null
  or extract(day from p_accounting_period)<>1
  or p_new_amount is null or p_new_amount::text in ('NaN','Infinity','-Infinity')
  or p_new_amount<=0 or p_new_amount>999999999999.99 or p_new_amount<>round(p_new_amount,2)
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional correction request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,
  'correct_tenant_institutional_obligation_idempotent',p_idempotency_key,
  jsonb_build_object('kind',p_kind,'id',p_obligation_id,'expected',p_expected_state,
   'category',p_new_category_id,'fund',p_new_fund_id,'description',btrim(p_new_description),
   'competence',p_new_competence,'due_date',p_new_due_date,'amount',p_new_amount,
   'period',p_accounting_period,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 -- Lock the base record before reading its derived effective state.
 if p_kind='payable' then
  perform 1 from public.institutional_payables p
    where p.id=p_obligation_id and p.organization_id=p_organization_id and p.posting_status='posted'
    for update;
  if not found then raise exception 'payable not posted in this tenant' using errcode='23503';end if;
  select v.category_id,v.fund_id,v.description,v.competence,v.due_date,
    v.effective_amount,v.allocated_amount,v.is_canceled,v.integrity_ok
  into v_current from public.v_institutional_payable_effective v
   where v.organization_id=p_organization_id and v.payable_id=p_obligation_id;
 else
  perform 1 from public.institutional_receivables r
    where r.id=p_obligation_id and r.organization_id=p_organization_id and r.posting_status='posted'
    for update;
  if not found then raise exception 'receivable not posted in this tenant' using errcode='23503';end if;
  select v.category_id,v.fund_id,v.description,v.competence,v.due_date,
    v.effective_amount,v.allocated_amount,v.is_canceled,v.integrity_ok
  into v_current from public.v_institutional_receivable_effective v
   where v.organization_id=p_organization_id and v.receivable_id=p_obligation_id;
 end if;
 if v_current.integrity_ok is distinct from true or v_current.is_canceled is distinct from false
 then raise exception 'institutional obligation is inconsistent or cancelled' using errcode='23514';end if;
 v_state:=jsonb_build_object('category_id',v_current.category_id,'fund_id',v_current.fund_id,
  'description',v_current.description,'competence',v_current.competence,
  'due_date',v_current.due_date,'effective_amount',v_current.effective_amount,
  'allocated_amount',v_current.allocated_amount);
 if p_expected_state<>v_state
 then raise exception 'institutional obligation changed since preview' using errcode='40001';end if;
 if p_kind='payable' then
  v_id:=public.correct_institutional_payable(p_organization_id,p_obligation_id,
   p_new_category_id,p_new_fund_id,btrim(p_new_description),p_new_competence,
   p_new_due_date,p_new_amount,p_accounting_period,btrim(p_reason));
 else
  v_id:=public.correct_institutional_receivable(p_organization_id,p_obligation_id,
   p_new_category_id,p_new_fund_id,btrim(p_new_description),p_new_competence,
   p_new_due_date,p_new_amount,p_accounting_period,btrim(p_reason));
 end if;
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.correct_tenant_institutional_obligation_idempotent(
 uuid,uuid,text,jsonb,uuid,uuid,text,date,date,numeric,date,text,text
) from PUBLIC,anon,authenticated;
grant execute on function public.correct_tenant_institutional_obligation_idempotent(
 uuid,uuid,text,jsonb,uuid,uuid,text,date,date,numeric,date,text,text
) to authenticated;
