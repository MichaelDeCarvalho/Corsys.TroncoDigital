-- Agreements preserve original facts and allocations. Only their unpaid balance is
-- transferred through auditable adjustments to linked replacement installments.
create or replace function public.preview_member_debt_agreement(
 p_organization_id uuid,p_member_id uuid,p_charge_ids uuid[],p_amount numeric,
 p_installment_count integer,p_agreement_date date,p_first_due date
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_schedule jsonb;v_snapshot jsonb;v_total numeric;v_count integer;
 v_categories integer;v_category uuid;v_mapping record;v_allow boolean;v_cents bigint;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'charges.adjust');
 if p_member_id is null or p_charge_ids is null or cardinality(p_charge_ids) not between 1 and 50
  or array_position(p_charge_ids,null) is not null
  or (select count(distinct x) from unnest(p_charge_ids)x)<>cardinality(p_charge_ids)
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_installment_count is null or p_installment_count not between 1 and 24
  or p_amount*100<p_installment_count
  or p_agreement_date is null or not isfinite(p_agreement_date) or p_agreement_date>current_date
  or p_agreement_date<(date_trunc('month',current_date)-interval '12 months')::date
  or p_first_due is null or not isfinite(p_first_due) or p_first_due<p_agreement_date
  or p_first_due>(p_agreement_date+interval '12 months')::date
 then raise exception 'invalid debt agreement parameters' using errcode='22023';end if;
 perform id from public.members where organization_id=p_organization_id and id=p_member_id;
 if not found then raise exception 'member not found in tenant' using errcode='23503';end if;
 select count(*),count(distinct c.category_id),sum(b.open_amount),
  jsonb_agg(jsonb_build_object('charge_id',c.id,'category_id',c.category_id,
   'account',c.accounting_account_id,'plan',c.accounting_plan_id,
   'effective',b.effective_amount,'allocated',b.allocated_amount,'open',b.open_amount) order by c.id)
 into v_count,v_categories,v_total,v_items
 from public.charges c join public.v_charge_balances b on b.charge_id=c.id and b.organization_id=c.organization_id
 where c.organization_id=p_organization_id and c.member_id=p_member_id and c.id=any(p_charge_ids)
  and not b.is_cancelled and b.integrity_ok and b.open_amount>0 and c.issue_date<=p_agreement_date;
 if v_count<>cardinality(p_charge_ids) then raise exception 'charge absent or no longer open in tenant/member' using errcode='23503';end if;
 if v_categories<>1 or p_amount>v_total or v_total>999999999999.99 then raise exception 'agreement requires one category and cannot increase debt' using errcode='23514';end if;
 select category_id into v_category from public.charges where organization_id=p_organization_id and id=p_charge_ids[1];
 select allow_installments into v_allow from public.financial_categories where organization_id=p_organization_id
  and id=v_category and active and domain='member_receivable';
 if not found or (p_installment_count>1 and not v_allow) then raise exception 'category not eligible for installments' using errcode='23514';end if;
 if private.is_period_closed(p_organization_id,date_trunc('month',p_agreement_date)::date)
 then raise exception 'agreement accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,v_category,p_agreement_date);
 if not found or exists(select 1 from public.charges where organization_id=p_organization_id and id=any(p_charge_ids)
  and (accounting_plan_id is distinct from v_mapping.accounting_plan_id or accounting_account_id is distinct from v_mapping.accounting_account_id))
 then raise exception 'agreement accounting classification unavailable or changed' using errcode='23514';end if;
 v_cents:=(p_amount*100)::bigint;
 select jsonb_agg(jsonb_build_object('number',n,'due_date',(p_first_due+make_interval(months=>n-1))::date,
  'amount',((v_cents/p_installment_count)+case when n<=v_cents%p_installment_count then 1 else 0 end)/100.0) order by n)
 into v_schedule from generate_series(1,p_installment_count)n;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'member_id',p_member_id,'category_id',v_category,
  'original_amount',v_total,'negotiated_amount',p_amount,'installment_count',p_installment_count,
  'agreement_date',p_agreement_date,'first_due',p_first_due,'items',v_items,'installments',v_schedule,
  'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date) from public,anon,authenticated;
grant execute on function public.preview_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date) to authenticated;

