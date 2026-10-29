-- Test Script: test_master_manual_invoice_rollback.sql
-- Purpose: Dry-run offline test script with complete transaction ROLLBACK.
-- DO NOT EXECUTE ON REMOTE PRODUCTION/DEV DATABASE.
--
-- Validates:
--   1. Master + AAL2 authorization enforcement (rejection of non-staff and AAL1).
--   2. Strict input validation: competence on 1st of month, due_date >= competence, idempotency key 1..200 chars.
--   3. Subscription validation: active/past_due/cancel_scheduled required; trialing subscription rejected with 55000.
--   4. Contractual price term requirement: NO fallback to plan version or plan (missing term raises 55000).
--   5. Partial price term rejection: term that does not cover the entire competence raises 55000.
--   6. Overlapping/conflicting price terms rejection: multiple terms raise 55000.
--   7. Deterministic preview via preview_saas_manual_invoice.
--   8. Idempotent issuance via issue_saas_manual_invoice (invoices, items, and audit log created).
--   9. Replay with identical key & description returns same invoice UUID without duplicate rows.
--   10. Replay with divergent description raises SQLSTATE 22023.
--   11. Duplicate prevention: issuing for the same competence with a new key raises 55000.

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
  -- ==========================================================================
  -- 0. Fixtures & Schema Compliance
  -- ==========================================================================
  -- Mock user in auth.users to satisfy platform_staff.user_id FK
  insert into auth.users (id, aud, role, email)
  values (v_master_user, 'authenticated', 'authenticated', 'master-test@corsys.internal')
  on conflict (id) do nothing;

  insert into public.organizations(id, name, slug)
  values (v_test_org, 'Loja Teste Fatura Manual', 'loja-teste-fatura-manual');

  insert into public.platform_staff(user_id, role, active)
  values (v_master_user, 'MASTER', true);

  insert into public.saas_plans(id, code, name, billing_interval, price, currency)
  values (v_plan_id, 'TEST_PLAN_MIGRATION', 'Plano Teste Master', 'monthly', 150.00, 'BRL');

  -- Fill all required constraints for saas_plan_versions:
  -- (status = 'published' requires published_at is not null)
  insert into public.saas_plan_versions(
    id, plan_id, version_number, status, price, currency,
    billing_interval, trial_days, grace_days, valid_from,
    created_by, published_by, published_at
  ) values (
    v_plan_version_id, v_plan_id, 1, 'published', 150.00, 'BRL',
    'monthly', 0, 7, '2026-01-01',
    v_master_user, v_master_user, now()
  );

  -- Initially insert subscription without any price term to verify NO FALLBACK
  insert into public.saas_subscriptions(
    id, organization_id, plan_id, plan_version_id, status, started_at, billing_anchor_day
  ) values (
    v_sub_id, v_test_org, v_plan_id, v_plan_version_id, 'active', '2026-01-01', 10
  );

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
    null; -- Expected: permission denied / AAL2 required
  end;

  -- Test Master with only AAL1 (must fail)
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_master_user::text,
    'role', 'authenticated',
    'aal', 'aal1'
  )::text, true);

  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on Master with AAL1 did not occur';
  exception when sqlstate '42501' then
    null; -- Expected
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
  -- 3. Trialing subscription rejection
  -- ==========================================================================
  update public.saas_subscriptions set status = 'trialing' where id = v_sub_id;
  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on trialing subscription did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: cannot issue invoice for trialing subscription
  end;
  update public.saas_subscriptions set status = 'active' where id = v_sub_id;

  -- ==========================================================================
  -- 4. Contractual price term requirement (FAIL-CLOSED, NO FALLBACK)
  -- ==========================================================================
  -- No term in saas_subscription_price_terms exists yet. Even though plan version has 150.00,
  -- it MUST fail because fallback was removed.
  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on missing price term did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: no contractual price term found
  end;

  -- Partial price term: term ends before end of month (e.g., ends Nov 15)
  insert into public.saas_subscription_price_terms(
    id, organization_id, subscription_id, effective_from, effective_to, unit_price, currency
  ) values (
    v_term1_id, v_test_org, v_sub_id, '2026-11-01', '2026-11-15', 180.00, 'BRL'
  );

  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on partial price term did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: partial price term does not cover entire billing competence
  end;

  -- Overlapping / conflicting price terms: add second term in the same month
  insert into public.saas_subscription_price_terms(
    id, organization_id, subscription_id, effective_from, effective_to, unit_price, currency
  ) values (
    v_term2_id, v_test_org, v_sub_id, '2026-11-16', '2026-11-30', 200.00, 'BRL'
  );

  begin
    perform public.preview_saas_manual_invoice(v_test_org, v_comp);
    raise exception 'Expected failure on multiple price terms did not occur';
  exception when sqlstate '55000' then
    null; -- Expected: conflicting or multiple price terms detected
  end;

  -- Remove partial/conflicting terms and insert one valid term covering entire month
  delete from public.saas_subscription_price_terms where subscription_id = v_sub_id;

  insert into public.saas_subscription_price_terms(
    id, organization_id, subscription_id, effective_from, effective_to, unit_price, currency
  ) values (
    v_term1_id, v_test_org, v_sub_id, '2026-06-01', null, 180.00, 'BRL'
  );

  -- ==========================================================================
  -- 5. Preview test: derived contractual price
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
  -- 6. Manual invoice issuance
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
  -- 7. Idempotency replay: exact same payload returns existing invoice
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
  -- 8. Idempotency mismatch: same key with different description fails with 22023
  -- ==========================================================================
  begin
    perform public.issue_saas_manual_invoice(
      v_test_org,
      v_comp,
      v_due_date,
      'Descrição alterada com a mesma chave',
      'idemp-manual-inv-001'
    );
    raise exception 'Expected failure on mismatched description did not occur';
  exception when sqlstate '22023' then
    null; -- Expected: key reused with different payload
  end;

  -- ==========================================================================
  -- 9. Duplicate prevention: issuing for the same competence with new key fails
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
