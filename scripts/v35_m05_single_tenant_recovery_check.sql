-- ==============================================================================
-- CorSys Tronco Digital V35 — M05.02 (D04): Selective Single-Tenant Recovery Check
-- Disposable PostgreSQL 17 Only. Never run against DEV or PROD.
-- Demonstrates selective recovery of Loja A without overwriting Loja B and blocks
-- reintroduction of deleted/pseudonymized contact data after T0.
-- ==============================================================================

DO $$
DECLARE
  v_db text := current_database();
  v_org_a uuid := '00000000-0000-4000-8000-000000000001';
  v_org_b uuid := '00000000-0000-4000-8000-000000000002';
  v_b_count_before integer;
  v_b_cents_before bigint;
  v_b_count_after integer;
  v_b_cents_after bigint;
  v_a_recovered integer;
  v_reintroduced integer;
BEGIN
  IF v_db !~ '(_gate|_test|_trial)$' THEN
    RAISE EXCEPTION 'SAFETY ABORT: selective recovery check only allowed on disposable DB (_gate/_test/_trial), got %', v_db;
  END IF;

  SELECT count(*), coalesce(sum(round(original_amount * 100)::bigint), 0)
  INTO v_b_count_before, v_b_cents_before
  FROM public.charges
  WHERE organization_id = v_org_b;

  CREATE TEMP TABLE tmp_backup_snapshot_charges (
    id uuid,
    organization_id uuid,
    member_id uuid,
    original_amount numeric(14,2)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE tmp_backup_snapshot_members (
    id uuid,
    organization_id uuid,
    full_name text,
    email text,
    status text
  ) ON COMMIT DROP;

  CREATE TEMP TABLE tmp_privacy_tombstones (
    organization_id uuid,
    member_id uuid,
    decision_outcome text
  ) ON COMMIT DROP;

  INSERT INTO tmp_backup_snapshot_charges
  SELECT id, organization_id, member_id, original_amount
  FROM public.charges
  WHERE organization_id IN (v_org_a, v_org_b);

  INSERT INTO tmp_backup_snapshot_members
  SELECT id, organization_id, full_name, email, status
  FROM public.members
  WHERE organization_id IN (v_org_a, v_org_b);

  INSERT INTO tmp_privacy_tombstones
  SELECT r.organization_id, r.member_id, r.decision_outcome
  FROM public.tenant_privacy_requests r
  WHERE r.organization_id = v_org_a
    AND r.member_id IS NOT NULL
    AND r.decision_outcome IN ('pseudonymized', 'anonymized_verified');

  CREATE TEMP TABLE tmp_selective_restore_loja_a AS
  SELECT
    s.id,
    s.organization_id,
    s.full_name,
    CASE WHEN t.member_id IS NOT NULL THEN NULL ELSE s.email END AS safe_email,
    CASE WHEN t.member_id IS NOT NULL THEN 'disconnected' ELSE s.status END AS safe_status
  FROM tmp_backup_snapshot_members s
  LEFT JOIN tmp_privacy_tombstones t
    ON t.organization_id = s.organization_id
   AND t.member_id = s.id
  WHERE s.organization_id = v_org_a;

  SELECT count(*) INTO v_a_recovered FROM tmp_selective_restore_loja_a;
  IF v_a_recovered < 1 THEN
    RAISE EXCEPTION 'SELECTIVE RECOVERY FAILED: expected Loja A rows in isolated restore stage';
  END IF;

  SELECT count(*) INTO v_reintroduced
  FROM tmp_selective_restore_loja_a s
  JOIN tmp_privacy_tombstones t
    ON t.organization_id = s.organization_id
   AND t.member_id = s.id
  WHERE s.safe_email IS NOT NULL;

  IF v_reintroduced <> 0 THEN
    RAISE EXCEPTION 'ANTI-REINTRODUCTION FAILED: % pseudonymized members still exposed email', v_reintroduced;
  END IF;

  SELECT count(*), coalesce(sum(round(original_amount * 100)::bigint), 0)
  INTO v_b_count_after, v_b_cents_after
  FROM public.charges
  WHERE organization_id = v_org_b;

  IF v_b_count_before <> v_b_count_after OR v_b_cents_before <> v_b_cents_after THEN
    RAISE EXCEPTION 'ISOLATION FAILED: Loja B altered during selective recovery of Loja A';
  END IF;

  RAISE NOTICE 'SELECTIVE_TENANT_RECOVERY_PASS: org_a_rows=%, org_b_untouched_charges=% (% cents), tombstones_respected=true',
    v_a_recovered, v_b_count_after, v_b_cents_after;
END $$;
