-- Agreements preserve original facts and allocations. Only their unpaid balance is
-- transferred through auditable adjustments to linked replacement installments.
create function public.preview_member_debt_agreement(
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
  and not b.is_cancelled and b.integrity_ok and b.open_amount>0;
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

create function public.create_member_debt_agreement(
 p_organization_id uuid,p_member_id uuid,p_charge_ids uuid[],p_amount numeric,
 p_installment_count integer,p_agreement_date date,p_first_due date,
 p_expected_fingerprint text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preview jsonb;v_item jsonb;v_plan uuid;v_charge uuid;v_period date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'charges.adjust');
 if p_expected_fingerprint is null or p_expected_fingerprint!~'^[a-f0-9]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or p_agreement_date is null or not isfinite(p_agreement_date)
 then raise exception 'invalid agreement confirmation' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_member_debt_agreement',btrim(p_idempotency_key),
  jsonb_build_object('member',p_member_id,'charges',p_charge_ids,'amount',p_amount,'count',p_installment_count,
   'date',p_agreement_date,'due',p_first_due,'fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 v_period:=date_trunc('month',p_agreement_date)::date;
 insert into public.financial_periods(organization_id,period) values(p_organization_id,v_period) on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=v_period for update;
 perform id from public.members where organization_id=p_organization_id and id=p_member_id for update;
 perform id from public.charges where organization_id=p_organization_id and member_id=p_member_id and id=any(p_charge_ids) order by id for update;
 perform c.id from public.financial_categories c where c.organization_id=p_organization_id and c.id in
  (select category_id from public.charges where organization_id=p_organization_id and id=any(p_charge_ids)) order by c.id for share;
 -- The volatile command sees balances after locks, including a payment committed while waiting.
 v_preview:=public.preview_member_debt_agreement(p_organization_id,p_member_id,p_charge_ids,p_amount,p_installment_count,p_agreement_date,p_first_due);
 if v_preview->>'fingerprint'<>p_expected_fingerprint then raise exception 'agreement preview changed' using errcode='PT409';end if;
 insert into public.member_debt_agreements(organization_id,member_id,agreement_date,original_amount,negotiated_amount,installment_count,reason,created_by)
 values(p_organization_id,p_member_id,p_agreement_date,(v_preview->>'original_amount')::numeric,p_amount,p_installment_count,btrim(p_reason),auth.uid()) returning id into v_id;
 for v_item in select value from jsonb_array_elements(v_preview->'items') loop
  insert into public.member_debt_agreement_items(organization_id,agreement_id,original_charge_id,included_amount)
  values(p_organization_id,v_id,(v_item->>'charge_id')::uuid,(v_item->>'open')::numeric);
  insert into public.charge_adjustments(organization_id,member_id,charge_id,direction,adjustment_kind,amount,reason,accounting_period,created_by)
  values(p_organization_id,p_member_id,(v_item->>'charge_id')::uuid,'decrease','credit_correction',
   (v_item->>'open')::numeric,'Acordo '||v_id::text||': '||btrim(p_reason),v_period,auth.uid());
 end loop;
 if p_installment_count>1 then
  insert into public.charge_plans(organization_id,member_id,category_id,description,installment_count,created_by)
  values(p_organization_id,p_member_id,(v_preview->>'category_id')::uuid,'Acordo '||v_id::text,p_installment_count,auth.uid()) returning id into v_plan;
 end if;
 for v_item in select value from jsonb_array_elements(v_preview->'installments') loop
  insert into public.charges(organization_id,member_id,category_id,charge_plan_id,source_kind,generation_key,
   description,reference,competence,issue_date,due_date,accounting_period,unit_amount,original_amount,installment_number,installment_count,created_by)
  values(p_organization_id,p_member_id,(v_preview->>'category_id')::uuid,v_plan,'replacement',
   'agreement:'||v_id::text||':'||(v_item->>'number'),'Acordo — parcela '||(v_item->>'number')||'/'||p_installment_count,
   v_id::text,v_period,p_agreement_date,(v_item->>'due_date')::date,v_period,(v_item->>'amount')::numeric,
   (v_item->>'amount')::numeric,(v_item->>'number')::integer,p_installment_count,auth.uid()) returning id into v_charge;
  insert into public.member_debt_agreement_installments(agreement_id,organization_id,installment_number,charge_id,due_date,amount)
  values(v_id,p_organization_id,(v_item->>'number')::integer,v_charge,(v_item->>'due_date')::date,(v_item->>'amount')::numeric);
 end loop;
 insert into public.member_debt_agreement_events(organization_id,agreement_id,event_type,reason,actor_user_id)
 values(p_organization_id,v_id,'created',btrim(p_reason),auth.uid()),(p_organization_id,v_id,'activated',btrim(p_reason),auth.uid());
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'member_agreement.create','member_debt_agreement',v_id,v_preview,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date,text,text,text) from public,anon,authenticated;
grant execute on function public.create_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date,text,text,text) to authenticated;
