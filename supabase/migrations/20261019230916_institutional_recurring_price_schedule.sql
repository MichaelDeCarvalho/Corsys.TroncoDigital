-- Additive DEV increment: future institutional prices, preserving posted facts and prior migrations.
create function public.schedule_institutional_recurring_price(
 p_organization_id uuid,p_rule_id uuid,p_expected_version_id uuid,p_amount numeric,
 p_valid_from date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_rule public.institutional_recurring_rules%rowtype;
 v_previous public.institutional_recurring_rule_versions%rowtype;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_rule_id is null or p_expected_version_id is null
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_valid_from is null or not isfinite(p_valid_from) or extract(day from p_valid_from)<>1
  or p_valid_from<=date_trunc('month',current_date)::date
  or p_valid_from>=(date_trunc('month',current_date)+interval '13 months')::date
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional price schedule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_institutional_recurring_price',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'expected',p_expected_version_id,'amount',p_amount,'from',p_valid_from,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 -- Compatible with FK KEY SHARE locks taken by idempotency records.
 perform id from public.organizations where id=p_organization_id for no key update;
 select * into v_rule from public.institutional_recurring_rules
  where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'institutional rule outside tenant' using errcode='23503';end if;
 if not v_rule.active then raise exception 'institutional rule inactive' using errcode='23514';end if;
 perform id from public.financial_categories where organization_id=p_organization_id and id=v_rule.category_id
  and active and domain=case when v_rule.direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category ineligible' using errcode='23514';end if;
 if not exists(select 1 from public.institutional_recurring_rule_versions
  where organization_id=p_organization_id and recurring_rule_id=p_rule_id and id=p_expected_version_id)
 then raise exception 'price version outside rule' using errcode='23503';end if;
 select * into v_previous from public.institutional_recurring_rule_versions
  where organization_id=p_organization_id and recurring_rule_id=p_rule_id
  order by valid_from_competence desc limit 1 for update;
 if not found or v_previous.id<>p_expected_version_id or v_previous.valid_to_competence is not null
 then raise exception 'institutional price version changed' using errcode='PT409';end if;
 if p_valid_from<=v_previous.valid_from_competence
 then raise exception 'price must follow latest competence' using errcode='22023';end if;
 if exists(select 1 from public.institutional_payables where organization_id=p_organization_id
    and recurring_rule_id=p_rule_id and competence>=p_valid_from)
  or exists(select 1 from public.institutional_receivables where organization_id=p_organization_id
    and recurring_rule_id=p_rule_id and competence>=p_valid_from)
 then raise exception 'obligations already issued from proposed price date' using errcode='23514';end if;
 update public.institutional_recurring_rule_versions
  set valid_to_competence=(p_valid_from-interval '1 month')::date
  where organization_id=p_organization_id and id=v_previous.id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,p_rule_id,p_valid_from,p_amount,btrim(p_reason)) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.price_schedule','institutional_recurring_rule',p_rule_id,
  jsonb_build_object('version_id',v_previous.id,'amount',v_previous.amount,'to',v_previous.valid_to_competence),
  jsonb_build_object('version_id',v_id,'amount',p_amount,'from',p_valid_from,'previous_to',(p_valid_from-interval '1 month')::date),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text) to authenticated;
