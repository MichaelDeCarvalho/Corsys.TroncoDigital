-- V35 HTTP conflict hardening. 17 semantic conflicts in 13 existing RPCs; do not misuse serialization_failure.
-- Generated from DEV pg_get_functiondef; exact source hashes gated. No grants, RLS or financial rule changes.
-- Rollout: DEV only. https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
do $v35_preflight$
declare v_name text; v_expected text; v_actual text;
begin
 for v_name,v_expected in select key,value from jsonb_each_text('{"correct_tenant_institutional_obligation_idempotent":"d4b9d8c2f9775145411eb22f533f476c","create_master_promotion_successor_idempotent":"af40363c2a525916f5c62b89f27ee5bd","generate_monthly_member_charges":"70fe6e150457ee62424dfa3b6fb84180","publish_tenant_budget":"8cf6df080cf89717781f95070089199b","publish_validated_accounting_plan":"a86cb4d435328a60f605033e5dcf4ea2","reverse_tenant_institutional_movement":"e24422792b5cc3fab31ea7c8f3cd29da","save_member_profile":"fb682d7123643abf9819cba072959bb1","save_tenant_identity":"a2fc87d6343e324315644e5bda3f1cb4","schedule_tenant_monthly_price":"8b7eccbde694588781397b1127e3d706","set_draft_accounting_mapping":"31f146b27bda69309b9b02758685cc2b","set_tenant_budget_line":"907657ecd2265c9ec2daf5d047c3ec10","set_treasury_catalog_status":"9adf846bdcd9de31975553a3e4d7120d","transition_member_term":"7746196448050ceccd2d50d8108e4d14"}'::jsonb) loop
  select md5(pg_get_functiondef(p.oid)) into v_actual from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname=v_name;
  if v_actual is distinct from v_expected then raise exception 'V35 HTTP preflight mismatch for %', v_name; end if;
 end loop;
end $v35_preflight$;

-- correct_tenant_institutional_obligation_idempotent; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.correct_tenant_institutional_obligation_idempotent(p_organization_id uuid, p_obligation_id uuid, p_kind text, p_expected_state jsonb, p_new_category_id uuid, p_new_fund_id uuid, p_new_description text, p_new_competence date, p_new_due_date date, p_new_amount numeric, p_accounting_period date, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 then raise exception 'institutional obligation changed since preview' using errcode='PT409';end if;
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
end $function$;

-- create_master_promotion_successor_idempotent; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.create_master_promotion_successor_idempotent(p_current_promotion_id uuid, p_name text, p_public_code text, p_benefit_type text, p_benefit_value numeric, p_duration_type text, p_duration_cycles integer, p_valid_from timestamp with time zone, p_valid_to timestamp with time zone, p_eligibility_scope text, p_max_redemptions integer, p_stackable boolean, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_series uuid;v_latest public.saas_promotions%rowtype;v_id uuid;
 v_key text;v_hash text;v_existing private.master_idempotency_keys%rowtype;
begin
 perform private.require_platform_staff('MASTER');
 if p_current_promotion_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
 or p_public_code is null or upper(btrim(p_public_code)) !~ '^[A-Z0-9_-]{3,40}$'
 or p_benefit_type not in ('percent','fixed_amount','trial_price')
 or p_benefit_value is null or p_benefit_value::text in ('NaN','Infinity','-Infinity')
 or p_benefit_value<=0 or p_benefit_value>999999999999.99 or p_benefit_value<>round(p_benefit_value,2)
 or (p_benefit_type='percent' and p_benefit_value>100)
 or p_duration_type not in ('once','cycles','date_range')
 or (p_duration_type='cycles' and (p_duration_cycles is null or p_duration_cycles not between 1 and 36))
 or (p_duration_type<>'cycles' and p_duration_cycles is not null)
 or p_valid_from is null or p_valid_from<=now()
 or (p_valid_to is not null and p_valid_to<=p_valid_from)
 or p_eligibility_scope not in ('new_customers','selected_customers','all_eligible')
 or (p_max_redemptions is not null and p_max_redemptions not between 1 and 1000000)
 or p_stackable is null or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid Master successor promotion' using errcode='22023';end if;
 v_key:=btrim(p_idempotency_key);
 v_hash:=encode(extensions.digest(jsonb_build_object(
  'current_id',p_current_promotion_id,'name',btrim(p_name),'code',upper(btrim(p_public_code)),
  'benefit_type',p_benefit_type,'value',p_benefit_value,
  'duration_type',p_duration_type,'cycles',p_duration_cycles,
  'from',p_valid_from,'to',p_valid_to,'scope',p_eligibility_scope,
  'max',p_max_redemptions,'stackable',p_stackable)::text,'sha256'),'hex');
 insert into private.master_idempotency_keys(staff_user_id,idempotency_key,operation,payload_hash)
 values(auth.uid(),v_key,'create_master_promotion_successor_idempotent',v_hash)
 on conflict(staff_user_id,idempotency_key)do nothing;
 select * into v_existing from private.master_idempotency_keys
 where staff_user_id=auth.uid() and idempotency_key=v_key for update;
 if v_existing.operation<>'create_master_promotion_successor_idempotent' or
 v_existing.payload_hash is distinct from v_hash
 then raise exception 'Master successor idempotency payload conflict' using errcode='22023';end if;
 if v_existing.result_reference is not null then return v_existing.result_reference;end if;
 if v_existing.created_at<now()-interval '5 minutes' then
 raise exception 'Master successor operation needs review' using errcode='55000';end if;
 select promotion_series_id into v_series from public.saas_promotions
 where id=p_current_promotion_id and status='published';
 if v_series is null then raise exception 'published promotion not found' using errcode='23503';end if;
 perform pg_advisory_xact_lock(hashtextextended('promo-successor:'||v_series::text,0));
 select * into v_latest from public.saas_promotions
 where promotion_series_id=v_series order by version_number desc,id desc limit 1 for update;
 if v_latest.id<>p_current_promotion_id or v_latest.status<>'published'
  then raise exception 'promotion source is not latest published version' using errcode='PT409';end if;
 if p_valid_from<=v_latest.valid_from or
   (v_latest.valid_to is not null and p_valid_from<v_latest.valid_to)
 then raise exception 'successor validity must follow current published period' using errcode='23514';end if;
 v_id:=public.create_saas_promotion_successor_draft(
  p_current_promotion_id,btrim(p_name),upper(btrim(p_public_code)),p_benefit_type,p_benefit_value,
  p_duration_type,p_duration_cycles,p_valid_from,p_valid_to,p_eligibility_scope,p_max_redemptions,p_stackable);
 insert into public.saas_master_audit_logs(staff_user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'saas_promotion.successor_draft','saas_promotion',v_id::text,
 jsonb_build_object('previous_id',p_current_promotion_id,'promotion_series_id',v_series,'valid_from',p_valid_from));
 update private.master_idempotency_keys set result_reference=v_id,completed_at=now()
 where staff_user_id=auth.uid() and idempotency_key=v_key;
 return v_id;
end $function$;

-- generate_monthly_member_charges; 2 business conflict(s)
CREATE OR REPLACE FUNCTION public.generate_monthly_member_charges(p_organization_id uuid, p_rule_id uuid, p_competence date, p_expected_fingerprint text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_existing uuid;v_batch uuid;v_preview jsonb;v_rule public.recurring_rules%rowtype;
 v_row record;v_created integer:=0;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 if p_rule_id is null or p_competence is null or extract(day from p_competence)<>1
  or p_expected_fingerprint is null or p_expected_fingerprint !~ '^[0-9a-f]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid monthly generation request' using errcode='22023';end if;
 v_existing:=private.idempotency_begin(
  p_organization_id,'generate_monthly_member_charges',p_idempotency_key,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,
    'expected_fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_existing is not null then return v_existing;end if;
 -- Serialize with published-accounting changes, price scheduling and member-term updates.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503';end if;
 select * into v_rule from public.recurring_rules
  where id=p_rule_id and organization_id=p_organization_id for update;
 if not found then raise exception 'recurring rule not found' using errcode='23503';end if;
 -- Member-configuration commands lock member rows; use identical lock order.
 perform 1 from public.members where organization_id=p_organization_id and status='active'
  order by id for update;
 v_preview:=public.preview_monthly_charge_generation(p_organization_id,p_rule_id,p_competence);
 if not coalesce((v_preview->>'ready')::boolean,false) then
  raise exception 'monthly generation preview not ready' using errcode='23514';end if;
 if v_preview->>'fingerprint'<>p_expected_fingerprint then
  raise exception 'monthly generation preview changed' using errcode='PT409';end if;
 insert into public.charge_batches(organization_id,batch_type,description,competence,created_by)
 values(p_organization_id,'recurring',
   'Regra mensal '||v_rule.name||' / '||to_char(p_competence,'YYYY-MM'),p_competence,auth.uid())
 returning id into v_batch;
 for v_row in select * from private.monthly_charge_candidates(p_organization_id,p_rule_id,p_competence)
  where decision='create' order by member_id loop
  insert into public.charges(
   organization_id,member_id,category_id,batch_id,recurring_rule_id,
   source_kind,generation_key,description,reference,competence,issue_date,due_date,
   accounting_period,quantity,unit_amount,original_amount,created_by
  ) values (
   p_organization_id,v_row.member_id,v_rule.category_id,v_batch,p_rule_id,
   'recurring',
   'monthly:'||p_rule_id::text||':'||v_row.member_id::text||':'||to_char(p_competence,'YYYY-MM'),
   v_rule.name||' — '||to_char(p_competence,'MM/YYYY'),
   to_char(p_competence,'YYYY-MM'),
   p_competence,p_competence,v_row.due_date,p_competence,
   1,v_row.amount,v_row.amount,auth.uid()
  );
  v_created:=v_created+1;
 end loop;
 if v_created<>(v_preview->>'to_create')::integer then
  raise exception 'monthly generation count changed' using errcode='PT409';end if;
 insert into public.audit_logs(
  organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason
 ) values (
  p_organization_id,auth.uid(),'monthly_charges.generate','charge_batch',v_batch,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,
   'created',v_created,'skipped_exempt',v_preview->'exempt',
   'already_generated',v_preview->'already_generated','fingerprint',p_expected_fingerprint),
  btrim(p_reason)
 );
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_batch);
 return v_batch;
end $function$;

-- publish_tenant_budget; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.publish_tenant_budget(p_organization_id uuid, p_cycle_id uuid, p_expected_revision text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_cycle public.budget_cycles%rowtype;v_snapshot jsonb;v_line jsonb;
begin
 perform private.require_permission(p_organization_id,'budgets.manage');
 if p_cycle_id is null or p_expected_revision is null or p_expected_revision!~'^[0-9a-f]{32}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid budget publication' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'publish_tenant_budget',p_idempotency_key,
  jsonb_build_object('cycle',p_cycle_id,'revision',p_expected_revision,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_cycle from public.budget_cycles where organization_id=p_organization_id
  and id=p_cycle_id for update;
 if not found then raise exception 'budget not found in tenant' using errcode='23503';end if;
 if v_cycle.status<>'draft' then raise exception 'budget already immutable' using errcode='55000';end if;
 v_snapshot:=private.tenant_budget_snapshot(p_organization_id,p_cycle_id);
 if md5(v_snapshot::text)<>p_expected_revision then raise exception 'budget changed; reload' using errcode='PT409';end if;
 if v_cycle.currency<>'BRL' or jsonb_array_length(v_snapshot->'lines') not between 1 and 400 then
  raise exception 'invalid budget contents' using errcode='22023';end if;
 for v_line in select value from jsonb_array_elements(v_snapshot->'lines') loop
  if (v_line->>'period')::date not between v_cycle.period_start and v_cycle.period_end
   or (v_line->>'amount')::numeric::text in('NaN','Infinity','-Infinity') then
   raise exception 'invalid budget line' using errcode='22023';end if;
  if v_line->>'kind'='account' then
   perform 1 from public.accounting_accounts a join public.accounting_plans p
    on p.organization_id=a.organization_id and p.id=a.accounting_plan_id
    where a.organization_id=p_organization_id and a.id=(v_line->>'item_id')::uuid
    and a.active and a.row_type='analytic' and a.nature in('revenue','cost','expense','financial_result')
    and p.status='published' and (v_line->>'period')::date between p.valid_from and p.valid_to for share of a,p;
  else
   perform 1 from public.funds where organization_id=p_organization_id
    and id=(v_line->>'item_id')::uuid and active for share;
  end if;
  if not found then raise exception 'budget source no longer eligible' using errcode='23503';end if;
 end loop;
 update public.budget_cycles set status='published',published_by=auth.uid(),published_at=clock_timestamp()
 where organization_id=p_organization_id and id=p_cycle_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'budget.publish','budget_cycle',p_cycle_id,
  jsonb_build_object('revision',p_expected_revision,'lines',jsonb_array_length(v_snapshot->'lines')),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_cycle_id);
 return p_cycle_id;
end $function$;

-- publish_validated_accounting_plan; 2 business conflict(s)
CREATE OR REPLACE FUNCTION public.publish_validated_accounting_plan(p_organization_id uuid, p_plan_id uuid, p_expected_valid_from date, p_expected_valid_to date, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_plan public.accounting_plans%rowtype;
  v_id uuid;
  v_check jsonb;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');
  if p_plan_id is null or p_expected_valid_from is null or p_expected_valid_to is null
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  then raise exception 'invalid accounting publication request' using errcode='22023'; end if;
  v_id := private.idempotency_begin(p_organization_id,'publish_validated_accounting_plan',
     p_idempotency_key,jsonb_build_object('plan',p_plan_id,'from',p_expected_valid_from,
      'to',p_expected_valid_to,'reason',btrim(p_reason)));
  if v_id is not null then return v_id; end if;
  perform 1 from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'organization not found' using errcode='23503'; end if;
  select * into v_plan from public.accounting_plans
   where organization_id=p_organization_id and id=p_plan_id for update;
  if not found then raise exception 'accounting plan outside organization' using errcode='23503'; end if;
  if v_plan.status<>'draft' then
    raise exception 'accounting plan is no longer a draft' using errcode='PT409';
  end if;
  if v_plan.valid_from is distinct from p_expected_valid_from
    or v_plan.valid_to is distinct from p_expected_valid_to
  then raise exception 'accounting plan dates changed; reload before publishing' using errcode='PT409'; end if;
  -- Every relevant configuration mutation acquires this tenant's organizations row.
  -- No global table locks; independent tenants continue writing concurrently.
  v_check:=public.preview_accounting_plan_publication(p_organization_id,p_plan_id);
  if v_check is null or v_check->>'ready' is distinct from 'true' then
    raise exception 'accounting plan is not ready for publication: %',
      coalesce(v_check->'issues','[]'::jsonb)
      using errcode='23514';
  end if;
  v_id:=public.publish_accounting_plan(p_organization_id,p_plan_id);
  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,
    after_data,reason
  ) values (
    p_organization_id,auth.uid(),'accounting_plan.validated_publish',
    'accounting_plan',v_id,
    jsonb_build_object('status','published','validated_from',v_plan.valid_from,
     'validated_to',v_plan.valid_to,
     'active_categories',v_check->'active_category_count',
     'active_financial_accounts',v_check->'active_financial_account_count'),
    btrim(p_reason)
  );
  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
  return v_id;
end $function$;

-- reverse_tenant_institutional_movement; 2 business conflict(s)
CREATE OR REPLACE FUNCTION public.reverse_tenant_institutional_movement(p_organization_id uuid, p_kind text, p_movement_id uuid, p_reversal_date date, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  then raise exception 'allocations changed; reload and retry' using errcode='PT409';end if;
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
  then raise exception 'allocations changed; reload and retry' using errcode='PT409';end if;
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
end $function$;

-- save_member_profile; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.save_member_profile(p_organization_id uuid, p_member_id uuid, p_expected_updated_at timestamp with time zone, p_profile jsonb, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_profile jsonb; v_before public.members%rowtype; v_after public.members%rowtype;
 v_result uuid; v_changed jsonb;
begin
 perform private.require_permission(p_organization_id,'members.write');
 if p_organization_id is null or (p_member_id is null) <> (p_expected_updated_at is null) then
  raise exception 'create requires no member/version; edit requires both' using errcode='22023';
 end if;
 if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key required' using errcode='22023'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception 'reason required' using errcode='22023'; end if;
 v_profile := private.normalize_member_profile(p_profile);
 v_result := private.idempotency_begin(p_organization_id,'save_member_profile',p_idempotency_key,
  jsonb_build_object('member_id',p_member_id,'expected_updated_at',p_expected_updated_at,'profile',v_profile,'reason',btrim(p_reason)));
 if v_result is not null then return v_result; end if;
 if p_member_id is null then
  insert into public.members(organization_id,full_name,preferred_name,degree_or_office,phone,whatsapp,email,initiation_date,admission_date,notes,status)
  values(p_organization_id,v_profile->>'full_name',v_profile->>'preferred_name',v_profile->>'degree_or_office',v_profile->>'phone',v_profile->>'whatsapp',v_profile->>'email',(v_profile->>'initiation_date')::date,(v_profile->>'admission_date')::date,v_profile->>'notes',v_profile->>'status')
  returning * into v_after;
 else
  select * into v_before from public.members where organization_id=p_organization_id and id=p_member_id for update;
  if not found then raise exception 'member not in organization' using errcode='23503'; end if;
  if v_before.updated_at<>p_expected_updated_at then raise exception 'member changed; reload before editing' using errcode='PT409'; end if;
  update public.members set
   full_name=v_profile->>'full_name',preferred_name=v_profile->>'preferred_name',degree_or_office=v_profile->>'degree_or_office',
   phone=v_profile->>'phone',whatsapp=v_profile->>'whatsapp',email=v_profile->>'email',
   initiation_date=(v_profile->>'initiation_date')::date,admission_date=(v_profile->>'admission_date')::date,
   notes=v_profile->>'notes',status=v_profile->>'status'
  where organization_id=p_organization_id and id=p_member_id returning * into v_after;
 end if;
 select coalesce(jsonb_agg(k),'[]'::jsonb) into v_changed
 from jsonb_object_keys(v_profile) as keys(k)
 where p_member_id is null or to_jsonb(v_before)->k is distinct from v_profile->k;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason,technical_context)
 values(p_organization_id,auth.uid(),case when p_member_id is null then 'member.create' else 'member.update' end,'member',v_after.id,
  case when p_member_id is null then null else jsonb_build_object('status',v_before.status) end,
  jsonb_build_object('status',v_after.status),btrim(p_reason),jsonb_build_object('changed_fields',v_changed));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_after.id);
 return v_after.id;
end $function$;

-- save_tenant_identity; 2 business conflict(s)
CREATE OR REPLACE FUNCTION public.save_tenant_identity(p_organization_id uuid, p_expected_updated_at timestamp with time zone, p_phone text, p_email text, p_pix_key text, p_address text, p_postal_code text, p_city text, p_state_code text, p_country_code text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_id uuid;
 v_current public.organization_settings%rowtype;
 v_exists boolean;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or length(coalesce(p_phone,''))>40 or length(coalesce(p_email,''))>254
  or length(coalesce(p_pix_key,''))>150 or length(coalesce(p_address,''))>500
  or length(coalesce(p_postal_code,''))>20 or length(coalesce(p_city,''))>120
  or (p_state_code is not null and (p_state_code !~ '^[A-Z]{2}$'))
  or p_country_code is null or p_country_code !~ '^[A-Z]{2}$'
  or (p_email is not null and p_email<>'' and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
 then raise exception 'invalid tenant identity input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'save_tenant_identity',p_idempotency_key,
  jsonb_build_object('expected',p_expected_updated_at,'phone',p_phone,'email',p_email,
  'pix',p_pix_key,'address',p_address,'postal',p_postal_code,'city',p_city,
  'state',p_state_code,'country',p_country_code,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 -- Lock the tenant to serialize first creation as well as edits.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503'; end if;
 select * into v_current from public.organization_settings
  where organization_id=p_organization_id for update;
 v_exists:=found;
 if v_exists then
  if p_expected_updated_at is null or v_current.updated_at is distinct from p_expected_updated_at then
   raise exception 'tenant identity revision conflict' using errcode='PT409'; end if;
  update public.organization_settings set
    phone=nullif(btrim(p_phone),''),email=nullif(btrim(p_email),''),
    pix_key=nullif(btrim(p_pix_key),''),address=nullif(btrim(p_address),''),
    postal_code=nullif(btrim(p_postal_code),''),city=nullif(btrim(p_city),''),
    state_code=p_state_code,country_code=p_country_code,
    updated_at=greatest(clock_timestamp(),v_current.updated_at+interval '1 microsecond')
  where organization_id=p_organization_id;
 else
  if p_expected_updated_at is not null then raise exception 'tenant identity created concurrently' using errcode='PT409';end if;
  insert into public.organization_settings(organization_id,phone,email,pix_key,address,postal_code,city,state_code,country_code)
  values(p_organization_id,nullif(btrim(p_phone),''),nullif(btrim(p_email),''),
    nullif(btrim(p_pix_key),''),nullif(btrim(p_address),''),
    nullif(btrim(p_postal_code),''),nullif(btrim(p_city),''),p_state_code,p_country_code);
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,
  before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'organization.identity_save','organization_settings',p_organization_id,
  jsonb_build_object('existed',v_exists,'expected_updated_at',p_expected_updated_at),
  jsonb_build_object('fields',jsonb_build_array('phone','email','pix_key','address','postal_code','city','state_code','country_code')),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_organization_id);
 return p_organization_id;
end $function$;

-- schedule_tenant_monthly_price; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.schedule_tenant_monthly_price(p_organization_id uuid, p_rule_id uuid, p_expected_version_id uuid, p_unit_amount numeric, p_valid_from date, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_rule public.recurring_rules%rowtype; v_previous public.recurring_rule_versions%rowtype;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_rule_id is null or p_expected_version_id is null or p_unit_amount is null or p_unit_amount::text in ('NaN','Infinity','-Infinity') or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_valid_from is null or p_valid_from<=date_trunc('month',current_date)::date or extract(day from p_valid_from)<>1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid monthly price input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_tenant_monthly_price',p_idempotency_key,jsonb_build_object('rule',p_rule_id,'expected',p_expected_version_id,'amount',p_unit_amount,'from',p_valid_from,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 select * into v_rule from public.recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'rule outside organization' using errcode='23503'; end if;
 if not v_rule.active or v_rule.frequency<>'monthly' or not exists(select 1 from public.financial_categories where id=v_rule.category_id and organization_id=p_organization_id and active and allow_recurrence and domain='member_receivable') then raise exception 'rule or category ineligible' using errcode='22023'; end if;
 if not exists(select 1 from public.recurring_rule_versions where id=p_expected_version_id and recurring_rule_id=p_rule_id) then raise exception 'price version outside rule' using errcode='23503'; end if;
 select * into v_previous from public.recurring_rule_versions where recurring_rule_id=p_rule_id order by valid_from_competence desc limit 1 for update;
 if not found or v_previous.id<>p_expected_version_id or v_previous.valid_to_competence is not null then raise exception 'monthly price version conflict' using errcode='PT409'; end if;
 if p_valid_from<=v_previous.valid_from_competence then raise exception 'price must follow latest competence' using errcode='22023'; end if;
 update public.recurring_rule_versions set valid_to_competence=(p_valid_from-interval '1 month')::date where id=v_previous.id;
 insert into public.recurring_rule_versions(recurring_rule_id,valid_from_competence,unit_amount) values(p_rule_id,p_valid_from,p_unit_amount) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'recurring_rule.price_schedule','recurring_rule',p_rule_id,jsonb_build_object('version_id',v_previous.id,'unit_amount',v_previous.unit_amount,'to',v_previous.valid_to_competence),jsonb_build_object('version_id',v_id,'from',p_valid_from,'unit_amount',p_unit_amount,'previous_to',(p_valid_from-interval '1 month')::date),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id); return v_id;
end $function$;

-- set_draft_accounting_mapping; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.set_draft_accounting_mapping(p_organization_id uuid, p_accounting_plan_id uuid, p_kind text, p_source_id uuid, p_accounting_account_id uuid, p_expected_account_id uuid, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result uuid;v_mapping_id uuid;v_old_target uuid;v_kind text;v_source_domain text;v_target_nature text;v_target_type text;v_target_active boolean;
begin
 perform private.require_permission(p_organization_id,'accounting.manage');
 if p_accounting_plan_id is null or p_source_id is null or p_accounting_account_id is null
   or p_kind is null or p_kind not in ('category','financial_account')
   or p_reason is null or length(btrim(p_reason)) not between 3 and 500
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid accounting mapping request' using errcode='22023';end if;
 v_result:=private.idempotency_begin(p_organization_id,'set_draft_accounting_mapping',p_idempotency_key,
  jsonb_build_object('plan',p_accounting_plan_id,'kind',p_kind,'source',p_source_id,
  'account',p_accounting_account_id,'expected',p_expected_account_id,'reason',btrim(p_reason)));
 if v_result is not null then return v_result;end if;
 -- Coordinate with publication before locking a specific plan, avoiding inverse lock order.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503';end if;
 perform 1 from public.accounting_plans p
 where p.organization_id=p_organization_id and p.id=p_accounting_plan_id and p.status='draft' for update;
 if not found then raise exception 'draft plan not found in organization' using errcode='23503';end if;
 select a.nature,a.row_type,a.active into v_target_nature,v_target_type,v_target_active
 from public.accounting_accounts a
 where a.organization_id=p_organization_id and a.accounting_plan_id=p_accounting_plan_id
  and a.id=p_accounting_account_id;
 if not found then raise exception 'target account outside draft' using errcode='23503';end if;
 if v_target_type<>'analytic' or not v_target_active then
  raise exception 'target accounting account must be active analytic' using errcode='23514';end if;
 if p_kind='category' then
  select c.domain into v_source_domain from public.financial_categories c
   where c.organization_id=p_organization_id and c.id=p_source_id;
  if not found then raise exception 'category outside organization' using errcode='23503';end if;
  if (v_source_domain in ('member_receivable','institutional_revenue') and v_target_nature<>'revenue')
    or (v_source_domain='institutional_expense' and v_target_nature not in('cost','expense','financial_result')) then
   raise exception 'account nature incompatible with category domain' using errcode='23514';end if;
  select id,accounting_account_id into v_mapping_id,v_old_target from public.financial_category_account_mappings
   where organization_id=p_organization_id and accounting_plan_id=p_accounting_plan_id
     and category_id=p_source_id for update;
 else
  perform 1 from public.financial_accounts
   where organization_id=p_organization_id and id=p_source_id;
  if not found then raise exception 'financial account outside organization' using errcode='23503';end if;
  if v_target_nature<>'patrimonial' then
   raise exception 'financial account must map to patrimonial account' using errcode='23514';end if;
  select id,accounting_account_id into v_mapping_id,v_old_target from public.financial_account_accounting_mappings
   where organization_id=p_organization_id and accounting_plan_id=p_accounting_plan_id
     and financial_account_id=p_source_id for update;
 end if;
 if v_old_target is distinct from p_expected_account_id then
  raise exception 'mapping changed; reload before editing' using errcode='PT409';end if;
 if v_mapping_id is null then
  if p_kind='category' then
   insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id)
    values(p_organization_id,p_accounting_plan_id,p_source_id,p_accounting_account_id) returning id into v_result;
  else
   insert into public.financial_account_accounting_mappings(organization_id,accounting_plan_id,financial_account_id,accounting_account_id)
    values(p_organization_id,p_accounting_plan_id,p_source_id,p_accounting_account_id) returning id into v_result;
  end if;
 else
  v_result:=v_mapping_id;
  if v_old_target<>p_accounting_account_id then
   if p_kind='category' then
    update public.financial_category_account_mappings set accounting_account_id=p_accounting_account_id where id=v_mapping_id;
   else
    update public.financial_account_accounting_mappings set accounting_account_id=p_accounting_account_id where id=v_mapping_id;
   end if;
  end if;
 end if;
 if v_old_target is distinct from p_accounting_account_id then
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
   values(p_organization_id,auth.uid(),'accounting_plan.mapping_set','accounting_mapping',v_result,
     jsonb_build_object('kind',p_kind,'plan',p_accounting_plan_id,'source',p_source_id,'account',v_old_target),
     jsonb_build_object('kind',p_kind,'plan',p_accounting_plan_id,'source',p_source_id,'account',p_accounting_account_id),btrim(p_reason));
 end if;
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$;

-- set_tenant_budget_line; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.set_tenant_budget_line(p_organization_id uuid, p_cycle_id uuid, p_kind text, p_item_id uuid, p_period date, p_amount numeric, p_expected_revision text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_cycle public.budget_cycles%rowtype;v_snapshot jsonb;
 v_plan uuid;v_before numeric;v_count integer;
begin
 perform private.require_permission(p_organization_id,'budgets.manage');
 if p_cycle_id is null or p_item_id is null or p_kind is null or p_kind not in('account','fund')
  or p_period is null or extract(day from p_period)<>1
  or p_amount is not null and (p_amount::text in('NaN','Infinity','-Infinity')
   or p_amount<0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2))
  or p_expected_revision is null or p_expected_revision!~'^[0-9a-f]{32}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid budget line request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_tenant_budget_line',p_idempotency_key,
  jsonb_build_object('cycle',p_cycle_id,'kind',p_kind,'item',p_item_id,'period',p_period,
   'amount',p_amount,'revision',p_expected_revision,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_cycle from public.budget_cycles where organization_id=p_organization_id
  and id=p_cycle_id for update;
 if not found then raise exception 'budget not found in tenant' using errcode='23503';end if;
 if v_cycle.status<>'draft' then raise exception 'budget is immutable' using errcode='55000';end if;
 v_snapshot:=private.tenant_budget_snapshot(p_organization_id,p_cycle_id);
 if md5(v_snapshot::text)<>p_expected_revision then
  raise exception 'budget changed; reload' using errcode='PT409';end if;
 if p_period<v_cycle.period_start or p_period>v_cycle.period_end then
  raise exception 'period outside budget cycle' using errcode='22023';end if;
 if p_kind='account' then
  select amount into v_before from public.accounting_budget_lines where organization_id=p_organization_id
   and budget_cycle_id=p_cycle_id and accounting_account_id=p_item_id and period=p_period;
  if p_amount is null then
   if v_before is null then raise exception 'budget line not found' using errcode='23503';end if;
   delete from public.accounting_budget_lines where organization_id=p_organization_id
    and budget_cycle_id=p_cycle_id and accounting_account_id=p_item_id and period=p_period;
  else
   select a.accounting_plan_id into v_plan from public.accounting_accounts a
    join public.accounting_plans p on p.organization_id=a.organization_id and p.id=a.accounting_plan_id
    where a.organization_id=p_organization_id and a.id=p_item_id and a.active and a.row_type='analytic'
     and a.nature in('revenue','cost','expense','financial_result') and p.status='published'
     and p_period between p.valid_from and p.valid_to for share of a,p;
   if not found then raise exception 'active budget account not covered by published plan' using errcode='23503';end if;
   insert into public.accounting_budget_lines(organization_id,budget_cycle_id,accounting_plan_id,accounting_account_id,period,amount)
   values(p_organization_id,p_cycle_id,v_plan,p_item_id,p_period,p_amount)
   on conflict(budget_cycle_id,accounting_account_id,period) do update set amount=excluded.amount;
  end if;
 else
  select amount into v_before from public.fund_budget_lines where organization_id=p_organization_id
   and budget_cycle_id=p_cycle_id and fund_id=p_item_id and period=p_period;
  if p_amount is null then
   if v_before is null then raise exception 'budget line not found' using errcode='23503';end if;
   delete from public.fund_budget_lines where organization_id=p_organization_id
    and budget_cycle_id=p_cycle_id and fund_id=p_item_id and period=p_period;
  else
   perform 1 from public.funds where organization_id=p_organization_id and id=p_item_id and active for share;
   if not found then raise exception 'active fund not found in tenant' using errcode='23503';end if;
   insert into public.fund_budget_lines(organization_id,budget_cycle_id,fund_id,period,amount)
   values(p_organization_id,p_cycle_id,p_item_id,p_period,p_amount)
   on conflict(budget_cycle_id,fund_id,period) do update set amount=excluded.amount;
  end if;
 end if;
 select jsonb_array_length(private.tenant_budget_snapshot(p_organization_id,p_cycle_id)->'lines') into v_count;
 if v_count>400 then raise exception 'budget line limit exceeded' using errcode='22023';end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'budget.line','budget_cycle',p_cycle_id,
  jsonb_build_object('amount',v_before),jsonb_build_object('kind',p_kind,'item',p_item_id,
  'period',p_period,'amount',p_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_cycle_id);
 return p_cycle_id;
end $function$;

-- set_treasury_catalog_status; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.set_treasury_catalog_status(p_organization_id uuid, p_kind text, p_item_id uuid, p_expected_active boolean, p_new_active boolean, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_old boolean; v_table text;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_kind is null or p_kind not in ('account','fund','method')
  or p_item_id is null or p_expected_active is null or p_new_active is null
  or p_expected_active=p_new_active
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid treasury status change' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_treasury_catalog_status',p_idempotency_key,
  jsonb_build_object('kind',p_kind,'item',p_item_id,'expected',p_expected_active,'new',p_new_active,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 v_table:=case p_kind when 'account' then 'financial_accounts' when 'fund' then 'funds' else 'payment_methods' end;
 execute format('select active from public.%I where organization_id=$1 and id=$2 for update',v_table)
  into v_old using p_organization_id,p_item_id;
 if v_old is null then raise exception 'treasury item outside organization' using errcode='23503'; end if;
 if v_old is distinct from p_expected_active then
  raise exception 'treasury status changed concurrently' using errcode='PT409'; end if;
 execute format('update public.%I set active=$1 where organization_id=$2 and id=$3',v_table)
  using p_new_active,p_organization_id,p_item_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(p_organization_id,auth.uid(),'treasury_catalog.status',p_kind,p_item_id,
   jsonb_build_object('active',v_old),jsonb_build_object('active',p_new_active),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_item_id);
 return p_item_id;
end $function$;

-- transition_member_term; 1 business conflict(s)
CREATE OR REPLACE FUNCTION public.transition_member_term(p_organization_id uuid, p_member_id uuid, p_current_term_id uuid, p_next_from date, p_next_type text, p_next_amount numeric, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_current public.recurring_member_terms%rowtype;
 v_result uuid;
 v_last date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_member_id is null or p_current_term_id is null or p_next_from is null
   or extract(day from p_next_from)<>1 or p_next_from<=date_trunc('month',current_date)::date
   or (p_next_type is not null and p_next_type not in ('standard','exempt','override_amount'))
   or (p_next_type='override_amount' and (p_next_amount is null or p_next_amount::text in ('NaN','Infinity','-Infinity')
      or p_next_amount<0 or p_next_amount>999999999999.99 or p_next_amount<>round(p_next_amount,2)))
   or (p_next_type is distinct from 'override_amount' and p_next_amount is not null)
   or p_reason is null or length(btrim(p_reason)) not between 3 and 500
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid member term transition' using errcode='22023'; end if;
 v_result:=private.idempotency_begin(p_organization_id,'transition_member_term',p_idempotency_key,
   jsonb_build_object('member',p_member_id,'current_term',p_current_term_id,'next_from',p_next_from,
    'next_type',p_next_type,'next_amount',p_next_amount,'reason',btrim(p_reason)));
 if v_result is not null then return v_result; end if;
 -- Serialize all transitions for the member; a second writer must re-check the old term.
 perform 1 from public.members
  where organization_id=p_organization_id and id=p_member_id for update;
 if not found then raise exception 'member outside organization' using errcode='23503'; end if;
 select * into v_current from public.recurring_member_terms
  where organization_id=p_organization_id and member_id=p_member_id and id=p_current_term_id for update;
 if not found then raise exception 'member term outside organization' using errcode='23503'; end if;
 if v_current.effective_to is not null then
   raise exception 'member term already transitioned' using errcode='PT409';
 end if;
 if p_next_from<=v_current.effective_from then
   raise exception 'successor must follow existing term' using errcode='22023';
 end if;
 v_last:=(p_next_from-interval '1 month')::date;
 if v_last<v_current.effective_from then
   raise exception 'invalid term closing boundary' using errcode='22023';
 end if;
 update public.recurring_member_terms
    set effective_to=v_last where id=v_current.id and organization_id=p_organization_id;
 if p_next_type is null then
   v_result:=v_current.id; -- close only: general rule applies from the next competence.
 else
   insert into public.recurring_member_terms(
      organization_id,member_id,recurring_rule_id,effective_from,effective_to,
      term_type,override_amount,reason,created_by)
   values (p_organization_id,p_member_id,v_current.recurring_rule_id,p_next_from,null,
      p_next_type,p_next_amount,btrim(p_reason),auth.uid())
   returning id into v_result;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,
    before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'member_configuration.transition','recurring_member_term',v_current.id,
  jsonb_build_object('term_id',v_current.id,'member_id',p_member_id,'rule_id',v_current.recurring_rule_id,
   'from',v_current.effective_from,'to',v_current.effective_to,'term_type',v_current.term_type),
  jsonb_build_object('closed_through',v_last,'next_term_id',case when p_next_type is null then null else v_result end,
   'next_from',p_next_from,'next_type',p_next_type,'next_amount',p_next_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$;

do $v35_postflight$
declare v_count integer; v_bad integer;
begin
 with functions as materialized(select p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname=any(array['correct_tenant_institutional_obligation_idempotent','create_master_promotion_successor_idempotent','generate_monthly_member_charges','publish_tenant_budget','publish_validated_accounting_plan','reverse_tenant_institutional_movement','save_member_profile','save_tenant_identity','schedule_tenant_monthly_price','set_draft_accounting_mapping','set_tenant_budget_line','set_treasury_catalog_status','transition_member_term']))
 select count(*),count(*) filter(where not prosecdef or not('search_path=""'=any(proconfig)) or def like '%40001%' or def not like '%PT409%') into v_count,v_bad from functions;
 if v_count<>13 or v_bad<>0 then raise exception 'V35 HTTP postflight mismatch count=% bad=%',v_count,v_bad;end if;
end $v35_postflight$;
