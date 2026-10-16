-- V35 DEV: six tenant financial KPIs computed by the backend; no paginated subtotals.
create or replace function public.read_tenant_financial_dashboard(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_member_open numeric(14,2);v_inst_open numeric(14,2);
 v_member_overdue numeric(14,2);v_inst_overdue numeric(14,2);
 v_payables numeric(14,2);v_payables_overdue numeric(14,2);
 v_received numeric(14,2);v_balance numeric(14,2);
 v_bad integer;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null then raise exception 'organization required' using errcode='22023';end if;
 select count(*) into v_bad from public.v_charge_balances c where c.organization_id=p_organization_id and c.integrity_ok is not true;
 if v_bad>0 then raise exception 'member balance integrity mismatch' using errcode='23514';end if;
 select count(*) into v_bad from public.v_institutional_receivable_effective r
 where r.organization_id=p_organization_id and r.integrity_ok is not true;
 if v_bad>0 then raise exception 'receivable integrity mismatch' using errcode='23514';end if;
 select count(*) into v_bad from public.v_institutional_payable_effective p
 where p.organization_id=p_organization_id and p.integrity_ok is not true;
 if v_bad>0 then raise exception 'payable integrity mismatch' using errcode='23514';end if;
 select coalesce(sum(c.open_amount),0)::numeric(14,2),
   coalesce(sum(c.open_amount) filter(where c.due_date<current_date),0)::numeric(14,2)
 into v_member_open,v_member_overdue from public.v_charge_balances c
 where c.organization_id=p_organization_id and not c.is_cancelled;
 select coalesce(sum(r.open_amount),0)::numeric(14,2),
   coalesce(sum(r.open_amount) filter(where r.due_date<current_date),0)::numeric(14,2)
 into v_inst_open,v_inst_overdue from public.v_institutional_receivable_effective r
 where r.organization_id=p_organization_id and not r.is_canceled;
 select coalesce(sum(p.open_amount),0)::numeric(14,2),
   coalesce(sum(p.open_amount) filter(where p.due_date<current_date),0)::numeric(14,2)
 into v_payables,v_payables_overdue from public.v_institutional_payable_effective p
 where p.organization_id=p_organization_id and not p.is_canceled;
 select coalesce(sum(m.signed_amount) filter(
   where m.movement_date>=date_trunc('month',current_date)::date
   and m.movement_date<=current_date
   and m.movement_type in ('member_payment','member_payment_reversal',
     'institutional_receipt','institutional_receipt_reversal')),0)::numeric(14,2),
   coalesce(sum(m.signed_amount) filter(where m.movement_date<=current_date),0)::numeric(14,2)
 into v_received,v_balance from public.v_financial_account_movements m
 where m.organization_id=p_organization_id;
 return jsonb_build_object(
 'organization_id',p_organization_id,'as_of',current_date,
 'member_open',v_member_open,'institutional_open',v_inst_open,
 'receivables_open',(v_member_open+v_inst_open)::numeric(14,2),
 'receivables_overdue',(v_member_overdue+v_inst_overdue)::numeric(14,2),
 'received_this_month',v_received,'cash_bank_balance',v_balance,
 'payables_open',v_payables,'payables_overdue',v_payables_overdue,
 'integrity_ok',true);
end $$;
revoke all on function public.read_tenant_financial_dashboard(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_financial_dashboard(uuid) to authenticated;
