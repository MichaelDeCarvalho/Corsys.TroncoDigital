-- Corsys Tronco Digital
-- Migration 013: controlled commands for post-V31 domain
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.


create or replace function public.create_accounting_plan(
  p_organization_id uuid,
  p_name text,
  p_valid_from date,
  p_valid_to date,
  p_source_kind text,
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_plan uuid;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');

  if length(btrim(coalesce(p_name,'')))=0 then
    raise exception 'plan name is required' using errcode='22023';
  end if;

  if p_valid_from is null or p_valid_to is null or p_valid_to<p_valid_from then
    raise exception 'invalid accounting plan validity' using errcode='22023';
  end if;

  if extract(day from p_valid_from)<>1
     or p_valid_to<>(date_trunc('month',p_valid_to)+interval '1 month - 1 day')::date then
    raise exception 'accounting plan validity must start on first day and end on last day of a month'
      using errcode='22023';
  end if;

  if p_source_kind not in ('blank','template','duplicate') then
    raise exception 'invalid accounting plan source kind' using errcode='22023';
  end if;

  if p_source_kind in ('template','duplicate') and p_source_id is null then
    raise exception 'source id is required' using errcode='22023';
  end if;

  if p_source_kind='template' then
    perform 1
    from public.accounting_plan_templates t
    where t.id=p_source_id and t.active;
    if not found then
      raise exception 'active accounting plan template not found' using errcode='23503';
    end if;
  elsif p_source_kind='duplicate' then
    perform 1
    from public.accounting_plans p
    where p.organization_id=p_organization_id and p.id=p_source_id;
    if not found then
      raise exception 'source accounting plan not found in organization' using errcode='23503';
    end if;
  end if;

  insert into public.accounting_plans(
    organization_id,name,status,valid_from,valid_to,copied_from_plan_id,created_by
  ) values (
    p_organization_id,p_name,'draft',p_valid_from,p_valid_to,
    case when p_source_kind='duplicate' then p_source_id else null end,
    v_user
  )
  returning id into v_plan;

  if p_source_kind='template' then
    insert into public.accounting_accounts(
      organization_id,accounting_plan_id,parent_account_id,
      code,description,row_type,nature,operational_classification,active
    )
    select
      p_organization_id,v_plan,null,
      t.code,t.description,t.row_type,t.nature,t.operational_classification,t.active
    from public.accounting_account_templates t
    where t.accounting_plan_template_id=p_source_id
    order by t.display_order,t.code;

    update public.accounting_accounts child
    set parent_account_id=parent.id
    from public.accounting_account_templates template_child
    join public.accounting_accounts parent
      on parent.organization_id=p_organization_id
     and parent.accounting_plan_id=v_plan
     and parent.code=template_child.parent_code
    where child.organization_id=p_organization_id
      and child.accounting_plan_id=v_plan
      and template_child.accounting_plan_template_id=p_source_id
      and template_child.code=child.code
      and template_child.parent_code is not null;

  elsif p_source_kind='duplicate' then
    insert into public.accounting_accounts(
      organization_id,accounting_plan_id,parent_account_id,
      code,description,row_type,nature,operational_classification,active
    )
    select
      p_organization_id,v_plan,null,
      a.code,a.description,a.row_type,a.nature,a.operational_classification,a.active
    from public.accounting_accounts a
    where a.organization_id=p_organization_id
      and a.accounting_plan_id=p_source_id
    order by a.code;

    update public.accounting_accounts dest_child
    set parent_account_id=dest_parent.id
    from public.accounting_accounts src_child
    join public.accounting_accounts src_parent
      on src_parent.organization_id=src_child.organization_id
     and src_parent.accounting_plan_id=src_child.accounting_plan_id
     and src_parent.id=src_child.parent_account_id
    join public.accounting_accounts dest_parent
      on dest_parent.organization_id=p_organization_id
     and dest_parent.accounting_plan_id=v_plan
     and dest_parent.code=src_parent.code
    where src_child.organization_id=p_organization_id
      and src_child.accounting_plan_id=p_source_id
      and dest_child.organization_id=p_organization_id
      and dest_child.accounting_plan_id=v_plan
      and dest_child.code=src_child.code;

    insert into public.financial_category_account_mappings(
      organization_id,accounting_plan_id,category_id,accounting_account_id
    )
    select
      p_organization_id,v_plan,m.category_id,dest.id
    from public.financial_category_account_mappings m
    join public.accounting_accounts src
      on src.organization_id=m.organization_id
     and src.accounting_plan_id=m.accounting_plan_id
     and src.id=m.accounting_account_id
    join public.accounting_accounts dest
      on dest.organization_id=p_organization_id
     and dest.accounting_plan_id=v_plan
     and dest.code=src.code
    where m.organization_id=p_organization_id
      and m.accounting_plan_id=p_source_id;

    insert into public.financial_account_accounting_mappings(
      organization_id,accounting_plan_id,financial_account_id,accounting_account_id
    )
    select
      p_organization_id,v_plan,m.financial_account_id,dest.id
    from public.financial_account_accounting_mappings m
    join public.accounting_accounts src
      on src.organization_id=m.organization_id
     and src.accounting_plan_id=m.accounting_plan_id
     and src.id=m.accounting_account_id
    join public.accounting_accounts dest
      on dest.organization_id=p_organization_id
     and dest.accounting_plan_id=v_plan
     and dest.code=src.code
    where m.organization_id=p_organization_id
      and m.accounting_plan_id=p_source_id;
  end if;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'accounting_plan.create','accounting_plan',v_plan,
    jsonb_build_object(
      'name',p_name,'valid_from',p_valid_from,'valid_to',p_valid_to,
      'source_kind',p_source_kind,'source_id',p_source_id
    )
  );

  return v_plan;
end;
$$;

create or replace function public.publish_accounting_plan(
  p_organization_id uuid,
  p_plan_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_missing_categories integer;
  v_missing_accounts integer;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');

  perform 1
  from public.accounting_plans p
  where p.organization_id=p_organization_id
    and p.id=p_plan_id
    and p.status='draft'
  for update;

  if not found then
    raise exception 'draft accounting plan not found' using errcode='23503';
  end if;

  select count(*) into v_missing_categories
  from public.financial_categories c
  where c.organization_id=p_organization_id
    and c.active
    and not exists (
      select 1 from public.financial_category_account_mappings m
      where m.organization_id=c.organization_id
        and m.accounting_plan_id=p_plan_id
        and m.category_id=c.id
    );

  if v_missing_categories>0 then
    raise exception 'cannot publish plan: % active categories are not mapped',
      v_missing_categories using errcode='23514';
  end if;

  select count(*) into v_missing_accounts
  from public.financial_accounts a
  where a.organization_id=p_organization_id
    and a.active
    and not exists (
      select 1 from public.financial_account_accounting_mappings m
      where m.organization_id=a.organization_id
        and m.accounting_plan_id=p_plan_id
        and m.financial_account_id=a.id
    );

  if v_missing_accounts>0 then
    raise exception 'cannot publish plan: % active financial accounts are not mapped',
      v_missing_accounts using errcode='23514';
  end if;

  update public.accounting_plans
  set status='published',published_by=v_user,published_at=now()
  where organization_id=p_organization_id and id=p_plan_id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'accounting_plan.publish','accounting_plan',p_plan_id,
    jsonb_build_object('status','published')
  );

  return p_plan_id;
end;
$$;

create or replace function public.create_institutional_payable(
  p_organization_id uuid,
  p_category_id uuid,
  p_fund_id uuid,
  p_description text,
  p_counterparty_name text,
  p_competence date,
  p_issue_date date,
  p_due_date date,
  p_accounting_period date,
  p_amount numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_existing uuid;
  v_payload jsonb;
  v_min smallint;
  v_threshold numeric;
  v_required boolean;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_competence)<>1 or extract(day from p_accounting_period)<>1 then
    raise exception 'competence/accounting_period must be first day of month'
      using errcode='22023';
  end if;
  if p_amount<=0 or p_amount<>round(p_amount,2) then
    raise exception 'amount must be positive with at most 2 decimals'
      using errcode='22023';
  end if;

  v_payload:=jsonb_build_object(
    'category_id',p_category_id,'fund_id',p_fund_id,'description',p_description,
    'counterparty_name',p_counterparty_name,'competence',p_competence,
    'issue_date',p_issue_date,'due_date',p_due_date,
    'accounting_period',p_accounting_period,'amount',p_amount
  );

  v_existing:=private.idempotency_begin(
    p_organization_id,'create_institutional_payable',p_idempotency_key,v_payload
  );
  if v_existing is not null then return v_existing; end if;

  insert into public.institutional_payables(
    organization_id,category_id,fund_id,description,counterparty_name,
    competence,issue_date,due_date,accounting_period,amount,
    posting_status,created_by,posted_by,posted_at
  ) values (
    p_organization_id,p_category_id,p_fund_id,p_description,p_counterparty_name,
    p_competence,p_issue_date,p_due_date,p_accounting_period,p_amount,
    'posted',v_user,v_user,now()
  )
  returning id,approval_required,approval_min_approvers,approval_threshold_snapshot
  into v_id,v_required,v_min,v_threshold;

  if v_required then
    insert into public.payable_approval_requests(
      organization_id,payable_id,minimum_approvers,
      threshold_snapshot,amount_snapshot,requested_by
    ) values (
      p_organization_id,v_id,v_min,v_threshold,p_amount,v_user
    );
  end if;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'institutional_payable.create',
    'institutional_payable',v_id,
    jsonb_build_object('amount',p_amount,'category_id',p_category_id)
  );

  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
  return v_id;
end;
$$;

create or replace function public.correct_institutional_payable(
  p_organization_id uuid,
  p_payable_id uuid,
  p_new_category_id uuid,
  p_new_fund_id uuid,
  p_new_description text,
  p_new_competence date,
  p_new_due_date date,
  p_new_amount numeric,
  p_correction_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current public.v_institutional_payable_effective%rowtype;
  v_plan uuid;
  v_account uuid;
  v_class text;
  v_policy uuid;
  v_mode text;
  v_threshold numeric;
  v_min smallint;
  v_required boolean;
  v_correction uuid;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_new_competence)<>1
     or extract(day from p_correction_accounting_period)<>1 then
    raise exception 'competence/accounting_period must be first day of month'
      using errcode='22023';
  end if;

  if p_new_amount<=0 or p_new_amount<>round(p_new_amount,2) then
    raise exception 'new amount must be positive with at most 2 decimals'
      using errcode='22023';
  end if;

  perform 1
  from public.institutional_payables p
  where p.organization_id=p_organization_id
    and p.id=p_payable_id
    and p.posting_status='posted'
  for update;

  if not found then
    raise exception 'posted payable not found' using errcode='23503';
  end if;

  select * into v_current
  from public.v_institutional_payable_effective v
  where v.organization_id=p_organization_id and v.payable_id=p_payable_id;

  if v_current.is_canceled then
    raise exception 'cannot correct canceled payable' using errcode='55000';
  end if;

  if p_new_amount<v_current.allocated_amount then
    raise exception 'correction cannot reduce payable below active allocated amount'
      using errcode='23514';
  end if;

  if private.is_period_closed(p_organization_id,p_correction_accounting_period) then
    raise exception 'correction accounting period is closed' using errcode='55000';
  end if;

  select r.accounting_plan_id,r.accounting_account_id,r.operational_classification
  into v_plan,v_account,v_class
  from private.resolve_category_account(
    p_organization_id,p_new_category_id,p_new_competence
  ) r;

  if v_plan is null or v_account is null or v_class not in ('fixed','variable') then
    raise exception 'new payable classification/account mapping is invalid'
      using errcode='23514';
  end if;

  select p.policy_id,p.mode,p.threshold_amount,p.minimum_approvers
  into v_policy,v_mode,v_threshold,v_min
  from private.current_expense_approval_policy(p_organization_id,current_date) p;

  v_required:=case
    when v_policy is null or v_mode='off' then false
    when v_mode='all' then true
    when v_mode='threshold' then p_new_amount>=v_threshold
    else false
  end;

  insert into public.institutional_payable_corrections(
    organization_id,payable_id,
    previous_category_id,new_category_id,
    previous_accounting_plan_id,previous_accounting_account_id,
    new_accounting_plan_id,new_accounting_account_id,
    previous_fund_id,new_fund_id,
    previous_expense_classification,new_expense_classification,
    previous_description,new_description,
    previous_competence,new_competence,
    previous_due_date,new_due_date,
    previous_amount,new_amount,
    approval_policy_id,approval_required,
    approval_threshold_snapshot,approval_min_approvers,
    accounting_period,reason,created_by
  ) values (
    p_organization_id,p_payable_id,
    v_current.category_id,p_new_category_id,
    v_current.accounting_plan_id,v_current.accounting_account_id,
    v_plan,v_account,
    v_current.fund_id,p_new_fund_id,
    v_current.expense_classification,v_class,
    v_current.description,p_new_description,
    v_current.competence,p_new_competence,
    v_current.due_date,p_new_due_date,
    v_current.effective_amount,p_new_amount,
    v_policy,v_required,v_threshold,
    case when v_required then coalesce(v_min,1) else 0 end,
    p_correction_accounting_period,p_reason,v_user
  )
  returning id into v_correction;

  if v_required then
    insert into public.payable_approval_requests(
      organization_id,payable_id,correction_id,minimum_approvers,
      threshold_snapshot,amount_snapshot,requested_by
    ) values (
      p_organization_id,p_payable_id,v_correction,coalesce(v_min,1),
      v_threshold,p_new_amount,v_user
    );
  end if;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,
    before_data,after_data,reason
  ) values (
    p_organization_id,v_user,'institutional_payable.correct',
    'institutional_payable',p_payable_id,
    jsonb_build_object('amount',v_current.effective_amount,'due_date',v_current.due_date),
    jsonb_build_object('amount',p_new_amount,'due_date',p_new_due_date),
    p_reason
  );

  return v_correction;
end;
$$;

create or replace function public.register_institutional_payable_payment(
  p_organization_id uuid,
  p_payable_id uuid,
  p_payment_date date,
  p_accounting_period date,
  p_amount numeric,
  p_allocate_amount numeric,
  p_payment_method_id uuid,
  p_financial_account_id uuid,
  p_reference text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_payment uuid;
  v_existing uuid;
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_accounting_period)<>1 then
    raise exception 'accounting_period must be first day of month' using errcode='22023';
  end if;
  if p_amount<=0 or p_allocate_amount<=0 or p_allocate_amount>p_amount then
    raise exception 'invalid payment/allocation amounts' using errcode='22023';
  end if;

  v_payload:=jsonb_build_object(
    'payable_id',p_payable_id,'payment_date',p_payment_date,
    'accounting_period',p_accounting_period,'amount',p_amount,
    'allocate_amount',p_allocate_amount,'payment_method_id',p_payment_method_id,
    'financial_account_id',p_financial_account_id,'reference',p_reference
  );

  v_existing:=private.idempotency_begin(
    p_organization_id,'register_institutional_payable_payment',
    p_idempotency_key,v_payload
  );
  if v_existing is not null then return v_existing; end if;

  insert into public.institutional_payable_payments(
    organization_id,payment_date,accounting_period,amount,
    payment_method_id,financial_account_id,reference,created_by
  ) values (
    p_organization_id,p_payment_date,p_accounting_period,p_amount,
    p_payment_method_id,p_financial_account_id,p_reference,v_user
  )
  returning id into v_payment;

  insert into public.institutional_payable_payment_allocations(
    organization_id,payable_payment_id,payable_id,amount,accounting_period,created_by
  ) values (
    p_organization_id,v_payment,p_payable_id,p_allocate_amount,p_accounting_period,v_user
  );

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'institutional_payable.payment',
    'institutional_payable_payment',v_payment,
    jsonb_build_object('amount',p_amount,'payable_id',p_payable_id)
  );

  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_payment);
  return v_payment;
end;
$$;

create or replace function public.create_institutional_receivable(
  p_organization_id uuid,
  p_category_id uuid,
  p_fund_id uuid,
  p_description text,
  p_counterparty_name text,
  p_competence date,
  p_issue_date date,
  p_due_date date,
  p_accounting_period date,
  p_amount numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_existing uuid;
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_competence)<>1 or extract(day from p_accounting_period)<>1 then
    raise exception 'competence/accounting_period must be first day of month'
      using errcode='22023';
  end if;
  if p_amount<=0 or p_amount<>round(p_amount,2) then
    raise exception 'amount must be positive with at most 2 decimals'
      using errcode='22023';
  end if;

  v_payload:=jsonb_build_object(
    'category_id',p_category_id,'fund_id',p_fund_id,'description',p_description,
    'counterparty_name',p_counterparty_name,'competence',p_competence,
    'issue_date',p_issue_date,'due_date',p_due_date,
    'accounting_period',p_accounting_period,'amount',p_amount
  );

  v_existing:=private.idempotency_begin(
    p_organization_id,'create_institutional_receivable',p_idempotency_key,v_payload
  );
  if v_existing is not null then return v_existing; end if;

  insert into public.institutional_receivables(
    organization_id,category_id,fund_id,description,counterparty_name,
    competence,issue_date,due_date,accounting_period,amount,
    posting_status,created_by,posted_by,posted_at
  ) values (
    p_organization_id,p_category_id,p_fund_id,p_description,p_counterparty_name,
    p_competence,p_issue_date,p_due_date,p_accounting_period,p_amount,
    'posted',v_user,v_user,now()
  )
  returning id into v_id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'institutional_receivable.create',
    'institutional_receivable',v_id,
    jsonb_build_object('amount',p_amount,'category_id',p_category_id)
  );

  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
  return v_id;
end;
$$;

create or replace function public.register_institutional_receipt(
  p_organization_id uuid,
  p_receivable_id uuid,
  p_receipt_date date,
  p_accounting_period date,
  p_amount numeric,
  p_allocate_amount numeric,
  p_payment_method_id uuid,
  p_financial_account_id uuid,
  p_reference text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_receipt uuid;
  v_existing uuid;
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_accounting_period)<>1 then
    raise exception 'accounting_period must be first day of month' using errcode='22023';
  end if;
  if p_amount<=0 or p_allocate_amount<=0 or p_allocate_amount>p_amount then
    raise exception 'invalid receipt/allocation amounts' using errcode='22023';
  end if;

  v_payload:=jsonb_build_object(
    'receivable_id',p_receivable_id,'receipt_date',p_receipt_date,
    'accounting_period',p_accounting_period,'amount',p_amount,
    'allocate_amount',p_allocate_amount,'payment_method_id',p_payment_method_id,
    'financial_account_id',p_financial_account_id,'reference',p_reference
  );

  v_existing:=private.idempotency_begin(
    p_organization_id,'register_institutional_receipt',p_idempotency_key,v_payload
  );
  if v_existing is not null then return v_existing; end if;

  insert into public.institutional_receipts(
    organization_id,receipt_date,accounting_period,amount,
    payment_method_id,financial_account_id,reference,created_by
  ) values (
    p_organization_id,p_receipt_date,p_accounting_period,p_amount,
    p_payment_method_id,p_financial_account_id,p_reference,v_user
  )
  returning id into v_receipt;

  insert into public.institutional_receipt_allocations(
    organization_id,receipt_id,receivable_id,amount,accounting_period,created_by
  ) values (
    p_organization_id,v_receipt,p_receivable_id,p_allocate_amount,p_accounting_period,v_user
  );

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'institutional_receivable.receipt',
    'institutional_receipt',v_receipt,
    jsonb_build_object('amount',p_amount,'receivable_id',p_receivable_id)
  );

  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_receipt);
  return v_receipt;
end;
$$;


create or replace function public.publish_expense_approval_policy(
  p_organization_id uuid,
  p_policy_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  perform private.require_permission(p_organization_id,'approvals.manage');

  perform 1
  from public.expense_approval_policies p
  where p.organization_id=p_organization_id
    and p.id=p_policy_id
    and p.status='draft'
  for update;

  if not found then
    raise exception 'draft approval policy not found' using errcode='23503';
  end if;

  update public.expense_approval_policies
  set status='published',published_by=v_user,published_at=now()
  where organization_id=p_organization_id and id=p_policy_id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data
  ) values (
    p_organization_id,v_user,'approval_policy.publish',
    'expense_approval_policy',p_policy_id,jsonb_build_object('status','published')
  );

  return p_policy_id;
end;
$$;

create or replace function public.decide_payable_approval(
  p_organization_id uuid,
  p_approval_request_id uuid,
  p_decision text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  perform private.require_permission(p_organization_id,'approvals.review');

  if p_decision not in ('approve','reject') then
    raise exception 'invalid approval decision' using errcode='22023';
  end if;

  perform 1
  from public.payable_approval_requests r
  where r.organization_id=p_organization_id
    and r.id=p_approval_request_id
  for update;

  if not found then
    raise exception 'approval request not found' using errcode='23503';
  end if;

  insert into public.payable_approval_decisions(
    organization_id,approval_request_id,actor_user_id,decision,reason
  ) values (
    p_organization_id,p_approval_request_id,v_user,p_decision,p_reason
  )
  returning id into v_id;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason
  ) values (
    p_organization_id,v_user,'payable_approval.'||p_decision,
    'payable_approval_request',p_approval_request_id,
    jsonb_build_object('decision',p_decision),p_reason
  );

  return v_id;
end;
$$;

create or replace function public.correct_institutional_receivable(
  p_organization_id uuid,
  p_receivable_id uuid,
  p_new_category_id uuid,
  p_new_fund_id uuid,
  p_new_description text,
  p_new_competence date,
  p_new_due_date date,
  p_new_amount numeric,
  p_correction_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current public.v_institutional_receivable_effective%rowtype;
  v_plan uuid;
  v_account uuid;
  v_class text;
  v_correction uuid;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_new_competence)<>1
     or extract(day from p_correction_accounting_period)<>1 then
    raise exception 'competence/accounting_period must be first day of month'
      using errcode='22023';
  end if;

  if p_new_amount<=0 or p_new_amount<>round(p_new_amount,2) then
    raise exception 'new amount must be positive with at most 2 decimals'
      using errcode='22023';
  end if;

  perform 1
  from public.institutional_receivables r
  where r.organization_id=p_organization_id
    and r.id=p_receivable_id
    and r.posting_status='posted'
  for update;

  if not found then
    raise exception 'posted institutional receivable not found' using errcode='23503';
  end if;

  select * into v_current
  from public.v_institutional_receivable_effective v
  where v.organization_id=p_organization_id
    and v.receivable_id=p_receivable_id;

  if v_current.is_canceled then
    raise exception 'cannot correct canceled receivable' using errcode='55000';
  end if;

  if p_new_amount<v_current.allocated_amount then
    raise exception 'correction cannot reduce receivable below active received amount'
      using errcode='23514';
  end if;

  if private.is_period_closed(p_organization_id,p_correction_accounting_period) then
    raise exception 'correction accounting period is closed' using errcode='55000';
  end if;

  select r.accounting_plan_id,r.accounting_account_id,r.operational_classification
  into v_plan,v_account,v_class
  from private.resolve_category_account(
    p_organization_id,p_new_category_id,p_new_competence
  ) r;

  if v_plan is null or v_account is null or v_class not in ('recurring','ad_hoc') then
    raise exception 'new receivable classification/account mapping is invalid'
      using errcode='23514';
  end if;

  insert into public.institutional_receivable_corrections(
    organization_id,receivable_id,
    previous_category_id,new_category_id,
    previous_accounting_plan_id,previous_accounting_account_id,
    new_accounting_plan_id,new_accounting_account_id,
    previous_fund_id,new_fund_id,
    previous_revenue_classification,new_revenue_classification,
    previous_description,new_description,
    previous_competence,new_competence,
    previous_due_date,new_due_date,
    previous_amount,new_amount,
    accounting_period,reason,created_by
  ) values (
    p_organization_id,p_receivable_id,
    v_current.category_id,p_new_category_id,
    v_current.accounting_plan_id,v_current.accounting_account_id,
    v_plan,v_account,
    v_current.fund_id,p_new_fund_id,
    v_current.revenue_classification,v_class,
    v_current.description,p_new_description,
    v_current.competence,p_new_competence,
    v_current.due_date,p_new_due_date,
    v_current.effective_amount,p_new_amount,
    p_correction_accounting_period,p_reason,v_user
  )
  returning id into v_correction;

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,
    before_data,after_data,reason
  ) values (
    p_organization_id,v_user,'institutional_receivable.correct',
    'institutional_receivable',p_receivable_id,
    jsonb_build_object('amount',v_current.effective_amount,'due_date',v_current.due_date),
    jsonb_build_object('amount',p_new_amount,'due_date',p_new_due_date),
    p_reason
  );

  return v_correction;
end;
$$;

create or replace function public.cancel_institutional_payable(
  p_organization_id uuid,
  p_payable_id uuid,
  p_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current public.v_institutional_payable_effective%rowtype;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_accounting_period)<>1 then
    raise exception 'accounting_period must be first day of month' using errcode='22023';
  end if;

  perform 1
  from public.institutional_payables p
  where p.organization_id=p_organization_id
    and p.id=p_payable_id
    and p.posting_status='posted'
  for update;

  if not found then
    raise exception 'posted payable not found' using errcode='23503';
  end if;

  select * into v_current
  from public.v_institutional_payable_effective v
  where v.organization_id=p_organization_id
    and v.payable_id=p_payable_id;

  if v_current.is_canceled or v_current.open_amount<=0 then
    raise exception 'payable has no open amount to cancel' using errcode='55000';
  end if;

  insert into public.institutional_payable_cancellations(
    payable_id,organization_id,canceled_amount,
    accounting_plan_id,accounting_account_id,fund_id,
    accounting_period,reason,created_by
  ) values (
    p_payable_id,p_organization_id,v_current.open_amount,
    v_current.accounting_plan_id,v_current.accounting_account_id,v_current.fund_id,
    p_accounting_period,p_reason,v_user
  );

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,before_data,reason
  ) values (
    p_organization_id,v_user,'institutional_payable.cancel',
    'institutional_payable',p_payable_id,
    jsonb_build_object('open_amount',v_current.open_amount),p_reason
  );

  return p_payable_id;
end;
$$;

create or replace function public.cancel_institutional_receivable(
  p_organization_id uuid,
  p_receivable_id uuid,
  p_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current public.v_institutional_receivable_effective%rowtype;
begin
  perform private.require_permission(p_organization_id,'institutional.manage');

  if extract(day from p_accounting_period)<>1 then
    raise exception 'accounting_period must be first day of month' using errcode='22023';
  end if;

  perform 1
  from public.institutional_receivables r
  where r.organization_id=p_organization_id
    and r.id=p_receivable_id
    and r.posting_status='posted'
  for update;

  if not found then
    raise exception 'posted institutional receivable not found' using errcode='23503';
  end if;

  select * into v_current
  from public.v_institutional_receivable_effective v
  where v.organization_id=p_organization_id
    and v.receivable_id=p_receivable_id;

  if v_current.is_canceled or v_current.open_amount<=0 then
    raise exception 'receivable has no open amount to cancel' using errcode='55000';
  end if;

  insert into public.institutional_receivable_cancellations(
    receivable_id,organization_id,canceled_amount,
    accounting_plan_id,accounting_account_id,fund_id,
    accounting_period,reason,created_by
  ) values (
    p_receivable_id,p_organization_id,v_current.open_amount,
    v_current.accounting_plan_id,v_current.accounting_account_id,v_current.fund_id,
    p_accounting_period,p_reason,v_user
  );

  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,before_data,reason
  ) values (
    p_organization_id,v_user,'institutional_receivable.cancel',
    'institutional_receivable',p_receivable_id,
    jsonb_build_object('open_amount',v_current.open_amount),p_reason
  );

  return p_receivable_id;
end;
$$;

revoke all on function public.publish_accounting_plan(uuid,uuid) from public;
revoke all on function public.create_institutional_payable(uuid,uuid,uuid,text,text,date,date,date,date,numeric,text) from public;
revoke all on function public.correct_institutional_payable(uuid,uuid,uuid,uuid,text,date,date,numeric,date,text) from public;
revoke all on function public.register_institutional_payable_payment(uuid,uuid,date,date,numeric,numeric,uuid,uuid,text,text) from public;
revoke all on function public.create_institutional_receivable(uuid,uuid,uuid,text,text,date,date,date,date,numeric,text) from public;
revoke all on function public.register_institutional_receipt(uuid,uuid,date,date,numeric,numeric,uuid,uuid,text,text) from public;

grant execute on function public.publish_accounting_plan(uuid,uuid) to authenticated;
grant execute on function public.create_institutional_payable(uuid,uuid,uuid,text,text,date,date,date,date,numeric,text) to authenticated;
grant execute on function public.correct_institutional_payable(uuid,uuid,uuid,uuid,text,date,date,numeric,date,text) to authenticated;
grant execute on function public.register_institutional_payable_payment(uuid,uuid,date,date,numeric,numeric,uuid,uuid,text,text) to authenticated;
grant execute on function public.create_institutional_receivable(uuid,uuid,uuid,text,text,date,date,date,date,numeric,text) to authenticated;
grant execute on function public.register_institutional_receipt(uuid,uuid,date,date,numeric,numeric,uuid,uuid,text,text) to authenticated;

revoke all on function public.publish_expense_approval_policy(uuid,uuid) from public;
revoke all on function public.decide_payable_approval(uuid,uuid,text,text) from public;
revoke all on function public.correct_institutional_receivable(uuid,uuid,uuid,uuid,text,date,date,numeric,date,text) from public;
revoke all on function public.cancel_institutional_payable(uuid,uuid,date,text) from public;
revoke all on function public.cancel_institutional_receivable(uuid,uuid,date,text) from public;

grant execute on function public.publish_expense_approval_policy(uuid,uuid) to authenticated;
grant execute on function public.decide_payable_approval(uuid,uuid,text,text) to authenticated;
grant execute on function public.correct_institutional_receivable(uuid,uuid,uuid,uuid,text,date,date,numeric,date,text) to authenticated;
grant execute on function public.cancel_institutional_payable(uuid,uuid,date,text) to authenticated;
grant execute on function public.cancel_institutional_receivable(uuid,uuid,date,text) to authenticated;

revoke all on function public.create_accounting_plan(uuid,text,date,date,text,uuid) from public;
grant execute on function public.create_accounting_plan(uuid,text,date,date,text,uuid) to authenticated;
