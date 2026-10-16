-- Keep tenant serialization compatible with FK KEY SHARE locks from idempotency inserts.
-- Distinct keys must not deadlock upgrading the organization row lock. No key is modified.
-- https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS
create or replace function public.create_tenant_institutional_monthly_rule(
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
 then raise exception 'invalid institutional monthly rule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_institutional_monthly_rule',btrim(p_idempotency_key),
  jsonb_build_object('direction',p_direction,'category',p_category_id,'name',btrim(p_name),'counterparty',btrim(p_counterparty),
   'amount',p_amount,'from',p_valid_from,'due_day',p_due_day,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active
  and domain=case when p_direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category not eligible in tenant' using errcode='23503';end if;
 insert into public.institutional_recurring_rules(organization_id,direction,category_id,name,counterparty_name,frequency,due_day,created_by)
 values(p_organization_id,p_direction,p_category_id,btrim(p_name),btrim(p_counterparty),'monthly',p_due_day,auth.uid()) returning id into v_id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,v_id,p_valid_from,p_amount,btrim(p_reason));
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.create','institutional_recurring_rule',v_id,
  jsonb_build_object('direction',p_direction,'category',p_category_id,'amount',p_amount,'from',p_valid_from),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_institutional_monthly_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_institutional_monthly_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) to authenticated;

create or replace function public.set_tenant_institutional_monthly_rule_status(
 p_organization_id uuid,p_rule_id uuid,p_expected_active boolean,p_active boolean,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_rule public.institutional_recurring_rules%rowtype;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_rule_id is null or p_expected_active is null or p_active is null or p_active=p_expected_active
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional rule status request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_tenant_institutional_monthly_rule_status',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'expected',p_expected_active,'active',p_active,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found or v_rule.frequency<>'monthly' then raise exception 'monthly rule not found in tenant' using errcode='23503';end if;
 if v_rule.active<>p_expected_active then raise exception 'rule status changed' using errcode='40001';end if;
 update public.institutional_recurring_rules set active=p_active where organization_id=p_organization_id and id=p_rule_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.status','institutional_recurring_rule',p_rule_id,
  jsonb_build_object('active',p_expected_active),jsonb_build_object('active',p_active),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_rule_id);return p_rule_id;
end $$;
revoke all on function public.set_tenant_institutional_monthly_rule_status(uuid,uuid,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.set_tenant_institutional_monthly_rule_status(uuid,uuid,boolean,boolean,text,text) to authenticated;

create or replace function public.generate_institutional_monthly_obligation(
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
 v_id:=private.idempotency_begin(p_organization_id,'generate_institutional_monthly_obligation',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'competence',p_competence,'fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 insert into public.financial_periods(organization_id,period) values(p_organization_id,p_competence) on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=p_competence for update;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'institutional rule not found in tenant' using errcode='23503';end if;
 v_preview:=public.preview_institutional_monthly_generation(p_organization_id,p_rule_id,p_competence);
 if v_preview->>'fingerprint'<>p_expected_fingerprint then raise exception 'institutional preview changed' using errcode='40001';end if;
 if not coalesce((v_preview->>'ready')::boolean,false) then raise exception 'institutional preview not ready' using errcode='23514';end if;
 if v_rule.direction='payable' then
  insert into public.institutional_payables(organization_id,category_id,recurring_rule_id,generation_key,description,
   counterparty_name,competence,issue_date,due_date,accounting_period,amount,posting_status,created_by,posted_by,posted_at)
  values(p_organization_id,v_rule.category_id,p_rule_id,'institutional-monthly:'||p_rule_id::text||':'||p_competence::text,
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
  values(p_organization_id,v_rule.category_id,p_rule_id,'institutional-monthly:'||p_rule_id::text||':'||p_competence::text,
   v_rule.name||' — '||to_char(p_competence,'MM/YYYY'),v_rule.counterparty_name,p_competence,p_competence,
   (v_preview->>'due_date')::date,p_competence,(v_preview->>'amount')::numeric,'posted',auth.uid(),auth.uid(),now()) returning id into v_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.generate',case when v_rule.direction='payable' then 'institutional_payable' else 'institutional_receivable' end,v_id,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,'preview',v_preview),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);return v_id;
end $$;
revoke all on function public.generate_institutional_monthly_obligation(uuid,uuid,date,text,text,text) from public,anon,authenticated;
grant execute on function public.generate_institutional_monthly_obligation(uuid,uuid,date,text,text,text) to authenticated;
