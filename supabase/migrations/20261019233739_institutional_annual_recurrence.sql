-- Additive annual institutional commands. Monthly commands and applied migrations are unchanged.
-- Anniversary month is anchored in the first price version; future price changes never move it.
create function public.create_tenant_institutional_annual_rule(
 p_organization_id uuid,p_direction text,p_category_id uuid,p_name text,
 p_counterparty text,p_amount numeric,p_valid_from date,p_due_day integer,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_direction is null or p_direction not in('payable','receivable')
  or p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_counterparty is null or length(btrim(p_counterparty)) not between 1 and 120
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_valid_from is null or not isfinite(p_valid_from) or extract(day from p_valid_from)<>1
  or p_valid_from<date_trunc('month',current_date)::date
  or p_valid_from>=(date_trunc('month',current_date)+interval '13 months')::date
  or p_due_day is null or p_due_day not between 1 and 31
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional annual rule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_institutional_annual_rule',btrim(p_idempotency_key),
  jsonb_build_object('direction',p_direction,'category',p_category_id,'name',btrim(p_name),'counterparty',btrim(p_counterparty),
   'amount',p_amount,'from',p_valid_from,'due_day',p_due_day,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active
  and domain=case when p_direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category not eligible in tenant' using errcode='23503';end if;
 insert into public.institutional_recurring_rules(organization_id,direction,category_id,name,counterparty_name,frequency,due_day,created_by)
 values(p_organization_id,p_direction,p_category_id,btrim(p_name),btrim(p_counterparty),'annual',p_due_day,auth.uid()) returning id into v_id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,v_id,p_valid_from,p_amount,btrim(p_reason));
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.create','institutional_recurring_rule',v_id,
  jsonb_build_object('direction',p_direction,'category',p_category_id,'amount',p_amount,'from',p_valid_from),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_institutional_annual_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_institutional_annual_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) to authenticated;

create function public.set_tenant_institutional_annual_rule_status(
 p_organization_id uuid,p_rule_id uuid,p_expected_active boolean,p_active boolean,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_rule public.institutional_recurring_rules%rowtype;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_rule_id is null or p_expected_active is null or p_active is null or p_active=p_expected_active
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional rule status request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_tenant_institutional_annual_rule_status',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'expected',p_expected_active,'active',p_active,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found or v_rule.frequency<>'annual' then raise exception 'annual rule not found in tenant' using errcode='23503';end if;
 if v_rule.active<>p_expected_active then raise exception 'rule status changed' using errcode='PT409';end if;
 update public.institutional_recurring_rules set active=p_active where organization_id=p_organization_id and id=p_rule_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.status','institutional_recurring_rule',p_rule_id,
  jsonb_build_object('active',p_expected_active),jsonb_build_object('active',p_active),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_rule_id);return p_rule_id;
end $$;
revoke all on function public.set_tenant_institutional_annual_rule_status(uuid,uuid,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.set_tenant_institutional_annual_rule_status(uuid,uuid,boolean,boolean,text,text) to authenticated;

create function public.preview_institutional_annual_generation(p_organization_id uuid,p_rule_id uuid,p_competence date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rule public.institutional_recurring_rules%rowtype;v_version public.institutional_recurring_rule_versions%rowtype;
 v_category public.financial_categories%rowtype;v_mapping record;v_policy record;
 v_existing uuid;v_due date;v_snapshot jsonb;v_ready boolean;v_anchor integer;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_rule_id is null or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_competence<(date_trunc('month',current_date)-interval '12 months')::date
  or p_competence>=(date_trunc('month',current_date)+interval '13 months')::date
 then raise exception 'institutional competence out of range' using errcode='22023';end if;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id;
 if not found then raise exception 'institutional rule not found in tenant' using errcode='23503';end if;
 select extract(month from min(valid_from_competence))::integer into v_anchor from public.institutional_recurring_rule_versions where organization_id=p_organization_id and recurring_rule_id=p_rule_id;
 select * into v_version from public.institutional_recurring_rule_versions where organization_id=p_organization_id
  and recurring_rule_id=p_rule_id and valid_from_competence<=p_competence
  and (valid_to_competence is null or valid_to_competence>=p_competence);
 select * into v_category from public.financial_categories where organization_id=p_organization_id and id=v_rule.category_id;
 select * into v_mapping from private.resolve_category_account(p_organization_id,v_rule.category_id,p_competence);
 select * into v_policy from private.current_expense_approval_policy(p_organization_id,p_competence);
 v_due:=make_date(extract(year from p_competence)::integer,extract(month from p_competence)::integer,
  least(v_rule.due_day,extract(day from(p_competence+interval '1 month - 1 day'))::integer));
 if v_rule.direction='payable' then
  select id into v_existing from public.institutional_payables where organization_id=p_organization_id
   and generation_key='institutional-annual:'||p_rule_id::text||':'||p_competence::text;
 else
  select id into v_existing from public.institutional_receivables where organization_id=p_organization_id
   and generation_key='institutional-annual:'||p_rule_id::text||':'||p_competence::text;
 end if;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'rule_id',p_rule_id,'competence',p_competence,
  'name',v_rule.name,'direction',v_rule.direction,'active',v_rule.active,'frequency',v_rule.frequency,'annual_month',v_anchor,
  'counterparty',v_rule.counterparty_name,'category_id',v_rule.category_id,'category_active',v_category.active,
  'category_domain',v_category.domain,'version_id',v_version.id,'amount',v_version.amount,'due_date',v_due,
  'accounting_plan_id',v_mapping.accounting_plan_id,'accounting_account_id',v_mapping.accounting_account_id,
  'approval_policy_id',case when v_rule.direction='payable' then v_policy.policy_id end,
  'period_closed',private.is_period_closed(p_organization_id,p_competence),'existing_id',v_existing);
 v_ready:=v_rule.active and v_rule.frequency='annual' and extract(month from p_competence)::integer=v_anchor and coalesce(v_category.active,false)
  and v_category.domain=case when v_rule.direction='payable' then 'institutional_expense' else 'institutional_revenue' end
  and v_version.id is not null and v_version.amount::text not in('NaN','Infinity','-Infinity')
  and v_version.amount>0 and v_version.amount<=999999999999.99 and v_mapping.accounting_account_id is not null
  and not private.is_period_closed(p_organization_id,p_competence) and v_existing is null;
 return v_snapshot||jsonb_build_object('ready',coalesce(v_ready,false),
  'fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_institutional_annual_generation(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.preview_institutional_annual_generation(uuid,uuid,date) to authenticated;

create function public.generate_institutional_annual_obligation(
 p_organization_id uuid,p_rule_id uuid,p_competence date,p_expected_fingerprint text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preview jsonb;v_rule public.institutional_recurring_rules%rowtype;
 v_required boolean;v_min smallint;v_threshold numeric;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 if p_rule_id is null or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_expected_fingerprint is null or p_expected_fingerprint!~'^[a-f0-9]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional generation request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'generate_institutional_annual_obligation',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'competence',p_competence,'fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 insert into public.financial_periods(organization_id,period) values(p_organization_id,p_competence) on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=p_competence for update;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'institutional rule not found in tenant' using errcode='23503';end if;
 v_preview:=public.preview_institutional_annual_generation(p_organization_id,p_rule_id,p_competence);
 if v_preview->>'fingerprint'<>p_expected_fingerprint then raise exception 'institutional preview changed' using errcode='PT409';end if;
 if not coalesce((v_preview->>'ready')::boolean,false) then raise exception 'institutional preview not ready' using errcode='23514';end if;
 if v_rule.direction='payable' then
  insert into public.institutional_payables(organization_id,category_id,recurring_rule_id,generation_key,description,
   counterparty_name,competence,issue_date,due_date,accounting_period,amount,posting_status,created_by,posted_by,posted_at)
  values(p_organization_id,v_rule.category_id,p_rule_id,'institutional-annual:'||p_rule_id::text||':'||p_competence::text,
   v_rule.name||' — '||to_char(p_competence,'MM/YYYY'),v_rule.counterparty_name,p_competence,p_competence,
   (v_preview->>'due_date')::date,p_competence,(v_preview->>'amount')::numeric,'posted',auth.uid(),auth.uid(),now())
  returning id,approval_required,approval_min_approvers,approval_threshold_snapshot into v_id,v_required,v_min,v_threshold;
  if v_required then
   insert into public.payable_approval_requests(organization_id,payable_id,minimum_approvers,threshold_snapshot,amount_snapshot,requested_by)
   values(p_organization_id,v_id,v_min,v_threshold,(v_preview->>'amount')::numeric,auth.uid());
  end if;
 else
  insert into public.institutional_receivables(organization_id,category_id,recurring_rule_id,generation_key,description,
   counterparty_name,competence,issue_date,due_date,accounting_period,amount,posting_status,created_by,posted_by,posted_at)
  values(p_organization_id,v_rule.category_id,p_rule_id,'institutional-annual:'||p_rule_id::text||':'||p_competence::text,
   v_rule.name||' — '||to_char(p_competence,'MM/YYYY'),v_rule.counterparty_name,p_competence,p_competence,
   (v_preview->>'due_date')::date,p_competence,(v_preview->>'amount')::numeric,'posted',auth.uid(),auth.uid(),now()) returning id into v_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.generate',case when v_rule.direction='payable' then 'institutional_payable' else 'institutional_receivable' end,v_id,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,'preview',v_preview),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);return v_id;
end $$;
revoke all on function public.generate_institutional_annual_obligation(uuid,uuid,date,text,text,text) from public,anon,authenticated;
grant execute on function public.generate_institutional_annual_obligation(uuid,uuid,date,text,text,text) to authenticated;