-- Corsys Tronco Digital V35
-- Migration: 20261029000001_v35_master_manual_invoice.sql
-- Goal: Deterministic, contract-derived manual issuance of internal SaaS subscription invoices by Master staff.
-- Prepared for Supabase / PostgreSQL. NOT executed in this environment.
--
-- Invariants:
--   1. Operator must be authenticated, platform staff with role MASTER, and verified with MFA (AAL2).
--   2. Target organization_id and active subscription must exist.
--   3. Pricing is strictly derived from contractual price terms (saas_subscription_price_terms) or pinned plan version (saas_plan_versions).
--      No arbitrary prices from the client browser are accepted.
--   4. Proration or price conflicts are handled fail-closed (multiple overlapping price terms for the period raise 55000).
--   5. Competence must be normalized to the first day of the month (extract(day from competence) = 1).
--   6. Duplicate billing for the same competence & subscription is blocked unless previous invoice was voided.
--   7. Sequential invoice numbering using saas_invoice_seq and platform configuration prefix.
--   8. Idempotent execution using private.idempotency_begin / idempotency_complete with payload hash verification.
--   9. Complete audit trail in public.saas_master_audit_logs.
--   10. Atomic insert of invoice, invoice items, and audit log.

-- ============================================================================
-- 1. Sequence for sequential invoice numbering
-- ============================================================================
create sequence if not exists public.saas_invoice_seq start with 1 increment by 1;

-- ============================================================================
-- 2. preview_saas_manual_invoice
-- ============================================================================
create or replace function public.preview_saas_manual_invoice(
  p_organization_id uuid,
  p_competence date,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_name text;
  v_sub_id uuid;
  v_plan_id uuid;
  v_plan_version_id uuid;
  v_plan_name text;
  v_anchor_day smallint;
  v_price_term_count integer;
  v_unit_price numeric(14,2);
  v_currency text := 'BRL';
  v_due_date date;
  v_due_day smallint;
  v_service_period_start date;
  v_service_period_end date;
  v_existing_id uuid;
  v_existing_number text;
  v_existing_amount numeric(14,2);
begin
  -- 1. Authorization: Platform staff MASTER + AAL2
  perform private.require_platform_staff('MASTER');

  -- 2. Validation: Input invariants
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  if p_competence is null or extract(day from p_competence) <> 1 then
    raise exception 'competence must be the first day of the month' using errcode = '22023';
  end if;

  -- Verify target organization exists
  select name into v_org_name
  from public.organizations
  where id = p_organization_id;

  if v_org_name is null then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- 3. Lookup current active / billable subscription
  select s.id, s.plan_id, s.plan_version_id, s.billing_anchor_day, p.name
    into v_sub_id, v_plan_id, v_plan_version_id, v_anchor_day, v_plan_name
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.organization_id = p_organization_id
    and s.status in ('active', 'trialing', 'past_due', 'cancel_scheduled')
  order by s.started_at desc
  limit 1;

  if v_sub_id is null then
    raise exception 'active subscription required for manual invoice' using errcode = '55000';
  end if;

  -- 4. Contractual price determination: fail-closed
  select count(*) into v_price_term_count
  from public.saas_subscription_price_terms pt
  where pt.organization_id = p_organization_id
    and pt.subscription_id = v_sub_id
    and pt.effective_from <= p_competence
    and (pt.effective_to is null or pt.effective_to >= p_competence);

  if v_price_term_count > 1 then
    raise exception 'conflicting price terms detected for competence' using errcode = '55000';
  elsif v_price_term_count = 1 then
    select pt.unit_price, pt.currency into v_unit_price, v_currency
    from public.saas_subscription_price_terms pt
    where pt.organization_id = p_organization_id
      and pt.subscription_id = v_sub_id
      and pt.effective_from <= p_competence
      and (pt.effective_to is null or pt.effective_to >= p_competence);
  else
    -- Fallback: check pinned plan version
    if v_plan_version_id is not null then
      select pv.price, pv.currency into v_unit_price, v_currency
      from public.saas_plan_versions pv
      where pv.id = v_plan_version_id;
    end if;

    -- Secondary fallback: base plan
    if v_unit_price is null then
      select p.price, p.currency into v_unit_price, v_currency
      from public.saas_plans p
      where p.id = v_plan_id;
    end if;
  end if;

  if v_unit_price is null or v_unit_price <= 0 then
    raise exception 'contractual price must be greater than zero' using errcode = '55000';
  end if;

  -- 5. Due date resolution
  if p_due_date is not null then
    if p_due_date < p_competence then
      raise exception 'due date cannot precede competence' using errcode = '22023';
    end if;
    v_due_date := p_due_date;
  else
    v_due_day := coalesce(
      v_anchor_day,
      (select default_due_day from public.saas_platform_configuration where singleton limit 1),
      10
    );
    v_due_date := (p_competence + make_interval(days := v_due_day - 1))::date;
  end if;

  -- 6. Service period
  v_service_period_start := p_competence;
  v_service_period_end := (p_competence + interval '1 month - 1 day')::date;

  -- 7. Check if active (unvoided) invoice already exists for this competence
  select i.id, i.invoice_number, i.amount_due
    into v_existing_id, v_existing_number, v_existing_amount
  from public.saas_invoices i
  where i.organization_id = p_organization_id
    and i.subscription_id = v_sub_id
    and i.competence = p_competence
    and not exists (
      select 1 from public.saas_invoice_voids v
      where v.organization_id = p_organization_id and v.invoice_id = i.id
    )
  limit 1;

  -- 8. Return deterministic preview payload
  return jsonb_build_object(
    'organization_id', p_organization_id,
    'organization_name', v_org_name,
    'subscription_id', v_sub_id,
    'plan_id', v_plan_id,
    'plan_name', v_plan_name,
    'competence', p_competence,
    'service_period_start', v_service_period_start,
    'service_period_end', v_service_period_end,
    'due_date', v_due_date,
    'unit_price', v_unit_price,
    'currency', v_currency,
    'line_items', jsonb_build_array(
      jsonb_build_object(
        'item_type', 'subscription',
        'description', 'Assinatura SaaS — Plano ' || v_plan_name || ' (' || to_char(p_competence, 'MM/YYYY') || ')',
        'quantity', 1,
        'unit_amount', v_unit_price,
        'line_amount', v_unit_price
      )
    ),
    'total_amount', v_unit_price,
    'already_billed', (v_existing_id is not null),
    'existing_invoice_id', v_existing_id,
    'existing_invoice_number', v_existing_number,
    'existing_amount', v_existing_amount
  );
end;
$$;

-- ============================================================================
-- 3. issue_saas_manual_invoice
-- ============================================================================
create or replace function public.issue_saas_manual_invoice(
  p_organization_id uuid,
  p_competence date,
  p_due_date date,
  p_description text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_sub_id uuid;
  v_plan_id uuid;
  v_plan_version_id uuid;
  v_plan_name text;
  v_anchor_day smallint;
  v_price_term_count integer;
  v_unit_price numeric(14,2);
  v_currency text := 'BRL';
  v_service_period_start date;
  v_service_period_end date;
  v_prefix text;
  v_invoice_number text;
  v_invoice_id uuid;
  v_existing uuid;
  v_payload jsonb;
  v_item_desc text;
begin
  -- 1. Authorization: Platform staff MASTER + AAL2
  perform private.require_platform_staff('MASTER');

  -- 2. Input validation
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  if p_competence is null or extract(day from p_competence) <> 1 then
    raise exception 'competence must be the first day of the month' using errcode = '22023';
  end if;

  if p_due_date is null or p_due_date < p_competence then
    raise exception 'valid due date is required and must not precede competence' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  -- Verify target organization exists
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  -- 3. Subscription lookup
  select s.id, s.plan_id, s.plan_version_id, s.billing_anchor_day, p.name
    into v_sub_id, v_plan_id, v_plan_version_id, v_anchor_day, v_plan_name
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.organization_id = p_organization_id
    and s.status in ('active', 'trialing', 'past_due', 'cancel_scheduled')
  order by s.started_at desc
  limit 1;

  if v_sub_id is null then
    raise exception 'active subscription required for manual invoice' using errcode = '55000';
  end if;

  -- 4. Contractual price determination: fail-closed
  select count(*) into v_price_term_count
  from public.saas_subscription_price_terms pt
  where pt.organization_id = p_organization_id
    and pt.subscription_id = v_sub_id
    and pt.effective_from <= p_competence
    and (pt.effective_to is null or pt.effective_to >= p_competence);

  if v_price_term_count > 1 then
    raise exception 'conflicting price terms detected for competence' using errcode = '55000';
  elsif v_price_term_count = 1 then
    select pt.unit_price, pt.currency into v_unit_price, v_currency
    from public.saas_subscription_price_terms pt
    where pt.organization_id = p_organization_id
      and pt.subscription_id = v_sub_id
      and pt.effective_from <= p_competence
      and (pt.effective_to is null or pt.effective_to >= p_competence);
  else
    if v_plan_version_id is not null then
      select pv.price, pv.currency into v_unit_price, v_currency
      from public.saas_plan_versions pv
      where pv.id = v_plan_version_id;
    end if;

    if v_unit_price is null then
      select p.price, p.currency into v_unit_price, v_currency
      from public.saas_plans p
      where p.id = v_plan_id;
    end if;
  end if;

  if v_unit_price is null or v_unit_price <= 0 then
    raise exception 'contractual price must be greater than zero' using errcode = '55000';
  end if;

  -- 5. Idempotency begin: register hash of intent
  v_payload := jsonb_build_object(
    'organization_id', p_organization_id,
    'subscription_id', v_sub_id,
    'competence', p_competence,
    'due_date', p_due_date,
    'amount', v_unit_price
  );

  v_existing := private.idempotency_begin(
    p_organization_id,
    'issue_saas_manual_invoice',
    btrim(p_idempotency_key),
    v_payload
  );
  if v_existing is not null then
    return v_existing;
  end if;

  -- 6. Lock organization row to serialize billing operations
  perform 1 from public.organizations
  where id = p_organization_id
  for update;

  -- 7. Block duplicate active invoice for this competence & subscription
  if exists (
    select 1 from public.saas_invoices i
    where i.organization_id = p_organization_id
      and i.subscription_id = v_sub_id
      and i.competence = p_competence
      and not exists (
        select 1 from public.saas_invoice_voids v
        where v.organization_id = p_organization_id and v.invoice_id = i.id
      )
  ) then
    raise exception 'invoice already issued for competence' using errcode = '55000';
  end if;

  -- 8. Compute service period and generate sequential invoice number
  v_service_period_start := p_competence;
  v_service_period_end := (p_competence + interval '1 month - 1 day')::date;

  v_prefix := coalesce(
    (select invoice_prefix from public.saas_platform_configuration where singleton limit 1),
    'CORSYS'
  );
  v_invoice_number := v_prefix || '-' || to_char(p_competence, 'YYYYMM') || '-' || lpad(nextval('public.saas_invoice_seq')::text, 5, '0');

  v_item_desc := coalesce(
    nullif(btrim(p_description), ''),
    'Assinatura SaaS — Plano ' || v_plan_name || ' (' || to_char(p_competence, 'MM/YYYY') || ')'
  );

  -- 9. Insert invoice
  insert into public.saas_invoices(
    organization_id,
    subscription_id,
    invoice_number,
    competence,
    service_period_start,
    service_period_end,
    issue_date,
    due_date,
    amount_due,
    currency,
    description,
    billing_provider,
    created_by
  ) values (
    p_organization_id,
    v_sub_id,
    v_invoice_number,
    p_competence,
    v_service_period_start,
    v_service_period_end,
    current_date,
    p_due_date,
    v_unit_price,
    v_currency,
    v_item_desc,
    'manual',
    v_user
  )
  returning id into v_invoice_id;

  -- 10. Insert invoice item
  insert into public.saas_invoice_items(
    organization_id,
    invoice_id,
    item_type,
    description,
    quantity,
    unit_amount,
    line_amount
  ) values (
    p_organization_id,
    v_invoice_id,
    'subscription',
    v_item_desc,
    1,
    v_unit_price,
    v_unit_price
  );

  -- 11. Audit log
  insert into public.saas_master_audit_logs(
    staff_user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_user,
    p_organization_id,
    'invoice.manual_issue',
    'saas_invoices',
    v_invoice_id::text,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'subscription_id', v_sub_id,
      'plan_id', v_plan_id,
      'plan_name', v_plan_name,
      'competence', p_competence,
      'service_period_start', v_service_period_start,
      'service_period_end', v_service_period_end,
      'due_date', p_due_date,
      'amount_due', v_unit_price,
      'currency', v_currency,
      'idempotency_key', btrim(p_idempotency_key)
    )
  );

  -- 12. Complete idempotency
  perform private.idempotency_complete(
    p_organization_id,
    btrim(p_idempotency_key),
    v_invoice_id
  );

  return v_invoice_id;
end;
$$;

-- ============================================================================
-- 4. Revoke public access and grant to authenticated
-- ============================================================================
revoke all on function public.preview_saas_manual_invoice(uuid, date, date) from public;
grant execute on function public.preview_saas_manual_invoice(uuid, date, date) to authenticated;

revoke all on function public.issue_saas_manual_invoice(uuid, date, date, text, text) from public;
grant execute on function public.issue_saas_manual_invoice(uuid, date, date, text, text) to authenticated;
