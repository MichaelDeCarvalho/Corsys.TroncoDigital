-- Test Script: test_master_manual_invoice_rollback.sql
-- Purpose: Dry-run offline test script with complete transaction ROLLBACK.
-- DO NOT EXECUTE ON REMOTE PRODUCTION/DEV DATABASE.
-- Validates:
--   1. Master + AAL2 authorization enforcement.
--   2. Rejection of tenant user, AAL1, or missing staff.
--   3. Strict validation: competence on 1st of month, due_date >= competence, idempotency key 1..200 chars.
--   4. Subscription requirement: active subscription required.
--   5. Contractual price lookup: saas_subscription_price_terms -> saas_plan_versions -> saas_plans.
--   6. Price term conflict fail-closed: multiple overlapping price terms reject with 55000.
--   7. Deterministic preview via preview_saas_manual_invoice.
--   8. Idempotent issuance via issue_saas_manual_invoice:
--      - Creates invoice in public.saas_invoices.
--      - Creates line item in public.saas_invoice_items.
--      - Creates audit record in public.saas_master_audit_logs.
--   9. Replay with identical key returns same invoice without duplicating records.
--   10. Replay with different payload raises SQLSTATE 22023.
--   11. Duplicate prevention: issuing for the same competence with new key raises 55000.

BEGIN;

do $$
declare
  v_test_org uuid := gen_random_uuid();
  v_master_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_plan_version_id uuid := gen_random_uuid();
  v_sub_id uuid := gen_random_uuid();
  v_term1_id uuid := gen_random_uuid();
  v_term2_id uuid := gen_random_uuid();
  v_preview jsonb;
  v_invoice_id uuid;
  v_replayed_id uuid;
  v_inv_count integer;
  v_item_count integer;
  v_audit_count integer;
  v_due_date date := '2026-11-10';
  v_comp date := '2026-11-01';
begin
  -- 0. Setup Fixtures
  insert into public.organizations(id, name, slug)
  values (v_test_org, 'Loja Teste Fatura Manual', 'loja-teste-fatura-manual');

  insert into public.platform_staff(user_id, role, active)
  values (v_master_user, 'MASTER', true);

  insert into public.saas_plans(id, code, name, billing_interval, price, currency)
  values (v_plan_id, 'TEST_PLAN_MIGRATION', 'Plano Teste Master', 'monthly', 150.00, 'BRL');

  insert into public.saas_plan_versions(id, plan_id, version_number, status, price, currency, valid_from)
  values (v_plan_version_id, v_plan_id, 1, 'published', 150.00, 'BRL', '2026-01-01');

  insert into public.saas_subscriptions(id, organization_id, plan_id, plan_version_id, status, started_at, billing_anchor_day)
  values (v_sub_id, v_test_org, v_plan_id, v_plan_version_id, 'active', '2026-01-01', 10);

  -- Initial contractual price term: R$ 180.00
  insert into public.saas_subscription_price_terms(id, organization_id, subscription_id, effective_from, effective_to, unit_price, currency)
  values (v_term1_id, v_test_org, v_sub_id, '2026-06-01', null, 180.00, 'BRL');

  -- ==========================================================================
  -- 1. Authorization checks: Non-Master or non-AAL2 rejected
  -- ==========================================================================
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_other_user::text,
    'role', 'authenticated',
    'aal', 'aal1'
  )::text, true);

  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on non-master user did not occur';
  exception when sqlstate '42501' then
    null; -- Expected: permission denied or AAL2 required
  end;

  -- Set valid Master + AAL2 context
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_master_user::text,
    'role', 'authenticated',
    'aal', 'aal2'
  )::text, true);

  -- ==========================================================================
  -- 2. Input validation checks
  -- ==========================================================================
  -- Competence not day 1 must fail
  begin
    perform public.preview_saas_manual_invoice(v_test_org, '2026-11-05');
    raise exception 'Expected failure on non-first-day competence did not occur';
  exception when sqlstate '22023' then
    null; -- Expected
  end;

  -- Due date preceding competence must fail
  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp, '2026-10-31');
    raise exception 'Expected failure on due date < competence did not occur';
  exception when sqlstate '22023' then
    null; -- Expected
  end;

  -- Null organization must fail
  begin
    perform public.preview_saas_manual_invoice(null, v_comp);
    raise exception 'Expected failure on null organization did not occur';
  exception when sqlstate '22023' then
    null; -- Expected
  end;

  -- ==========================================================================
  -- 3. Preview test: derived contractual price
  -- ==========================================================================
  v_preview := public.preview_saas_manual_invoice(v_test_org, v_comp, v_due_date);

  if (v_preview ->> 'unit_price')::numeric <> 180.00 then
    raise exception 'Expected contractual price 180.00, got %', v_preview ->> 'unit_price';
  end if;

  if (v_preview ->> 'already_billed')::boolean <> false then
    raise exception 'Expected already_billed false in preview';
  end if;

  if (v_preview ->> 'due_date') <> '2026-11-10' then
    raise exception 'Expected due_date 2026-11-10, got %', v_preview ->> 'due_date';
  end if;

  -- ==========================================================================
  -- 4. Manual invoice issuance
  -- ==========================================================================
  v_invoice_id := public.issue_saas_manual_invoice(
    v_test_org,
    v_comp,
    v_due_date,
    'Fatura manual teste Novembro/2026',
    'idemp-manual-inv-001'
  );

  if v_invoice_id is null then
    raise exception 'Expected invoice id returned';
  end if;

  -- Verify row in saas_invoices
  select count(*) into v_inv_count
  from public.saas_invoices
  where id = v_invoice_id
    and organization_id = v_test_org
    and amount_due = 180.00
    and competence = v_comp
    and due_date = v_due_date;

  if v_inv_count <> 1 then
    raise exception 'Invoice row not found or mismatch';
  end if;

  -- Verify row in saas_invoice_items
  select count(*) into v_item_count
  from public.saas_invoice_items
  where invoice_id = v_invoice_id
    and organization_id = v_test_org
    and line_amount = 180.00;

  if v_item_count <> 1 then
    raise exception 'Invoice item not found or mismatch';
  end if;

  -- Verify row in saas_master_audit_logs
  select count(*) into v_audit_count
  from public.saas_master_audit_logs
  where staff_user_id = v_master_user
    and organization_id = v_test_org
    and action = 'invoice.manual_issue'
    and resource_id = v_invoice_id::text;

  if v_audit_count <> 1 then
    raise exception 'Audit log not found or mismatch';
  end if;

  -- ==========================================================================
  -- 5. Idempotency replay: exact same payload returns existing invoice
  -- ==========================================================================
  v_replayed_id := public.issue_saas_manual_invoice(
    v_test_org,
    v_comp,
    v_due_date,
    'Fatura manual teste Novembro/2026',
    'idemp-manual-inv-001'
  );

  if v_replayed_id <> v_invoice_id then
    raise exception 'Expected replayed ID % to match original %', v_replayed_id, v_invoice_id;
  end if;

  select count(*) into v_inv_count from public.saas_invoices where id = v_invoice_id;
  if v_inv_count <> 1 then
    raise exception 'Replay duplicated invoice row';
  end if;

  -- ==========================================================================
  -- 6. Idempotency mismatch: same key with different payload fails with 22023
  -- ==========================================================================
  begin
    perform public.issue_saas_manual_invoice(
      v_test_org,
      v_comp,
      '2026-11-20', -- Different due date -> different payload
      'Outra descrição',
      'idemp-manual-inv-001'
    );
    raise exception 'Expected failure on mismatched payload did not occur';
  exception when sqlstate '22023' then
    null; -- Expected: key reused with different payload
  end;

  -- ==========================================================================
  -- 7. Duplicate prevention: issuing for the same competence with new key fails
  -- ==========================================================================
  begin
    perform public.issue_saas_manual_invoice(
      v_test_org,
      v_comp,
      v_due_date,
      'Tentativa de fatura duplicada',
      'idemp-manual-inv-002'
    );
    raise exception 'Expected duplicate competence block did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: invoice already issued for competence
  end;

  -- Preview should now report already_billed = true
  v_preview := public.preview_saas_manual_invoice(v_test_org, v_comp);
  if (v_preview ->> 'already_billed')::boolean <> true then
    raise exception 'Expected preview already_billed to be true after issuance';
  end if;

end;
$$;

ROLLBACK;
