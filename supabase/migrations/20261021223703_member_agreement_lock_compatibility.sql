-- Keep member FK key-share locks compatible and match existing FIFO charge lock order.
create or replace function public.create_member_debt_agreement(
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
 perform id from public.members where organization_id=p_organization_id and id=p_member_id for no key update;
 perform id from public.charges where organization_id=p_organization_id and member_id=p_member_id and id=any(p_charge_ids) order by due_date,issue_date,id for update;
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
