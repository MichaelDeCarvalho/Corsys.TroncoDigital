"""Disposable PostgreSQL M04 Master SaaS lifecycle, billing & support gate.

Exercises:
- DDL rollback safety + production migration execution (`20261126120000_v35_m04_master_saas_operations.sql`)
- Authorization matrix (`MASTER/AAL2`, `MASTER/AAL1`, `SUPPORT/AAL2`, tenant A/B, `anon`)
- Entrega A (C01, C02, C05, C07): seat limit enforcement (`assign_tenant_user_role`, `accept_onboarding_invite`) excluding active MASTER/SUPPORT staff, express paid hiring starting day 1 next month, prospective upgrade/downgrade with seat compatibility guard, and `saas_subscription_price_terms` historical price preservation
- Entrega B (C04): manual invoice preview/issuance (day 10), SaaS payment registration/allocation, void block while allocated, compensatory reversal unblocking void, adjustment, commercial agreement (`zero_charges`), external fiscal doc, and `read_master_saas_financial_summary`
- Entrega C (C03, D01): manual `past_due` + 7-day grace enforcement, manual suspension guard (`overdue > 0` and grace elapsed), write-block via `private.tenant_write_allowed` keeping reads/support open, reactivation after active agreement/settlement, and `cancel_saas_subscription_idempotent` (`D01` 90-day export window)
- Entrega D (C06): `internal_note` visibility RLS hidden from tenant, support triage/assignment/internal ticket idempotency, and tenant active `read_only` support session notice (`read_tenant_active_support_session`).

Never connects to Supabase DEV or PROD. Requires local disposable PostgreSQL 17.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys

from check_privacy_recovery_pg import bootstrap_product_history

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = os.environ.get("PGPORT", "55432")
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "onboarding-ci")
PGDATABASE = os.environ.get("PGDATABASE", "master_saas_m04_gate")

FORBIDDEN_TARGETS = ("supabase.co", "supabase.com", "szqkdekwhzxsoxorgvaz", "pooler")
ALLOWED_DB_SUFFIXES = ("_gate", "_test", "_trial")

SQLSTATE_RE = re.compile(r"ERROR:\s+([0-9A-Z]{5}):")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def assert_disposable_target() -> None:
    target = f"{PGHOST}:{PGPORT}/{PGDATABASE}".lower()
    for token in FORBIDDEN_TARGETS:
        if token in target:
            raise SystemExit(f"REFUSING to run against non-disposable target containing '{token}': {target}")
    if PGHOST not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit(f"REFUSING to run against non-local host: {PGHOST}")
    if not PGDATABASE.endswith(ALLOWED_DB_SUFFIXES):
        raise SystemExit(f"REFUSING to run against database '{PGDATABASE}'; expected suffix in {ALLOWED_DB_SUFFIXES}")


def source(fragment: str) -> str:
    matches = sorted(MIGRATIONS.glob(f"*{fragment}*.sql"))
    if len(matches) != 1:
        raise AssertionError(f"Expected 1 migration matching '{fragment}', found {matches}")
    return matches[0].read_text(encoding="utf-8")


def extract(source_text: str, start: str, end: str) -> str:
    matches = re.findall(start + r".*?" + end, source_text, re.S)
    if len(matches) != 1:
        raise AssertionError(f"Expected 1 match for {start!r} ... {end!r}, got {len(matches)}")
    return matches[0]


def table(src: str, name: str) -> str:
    return extract(src, rf"create table public\.{name}\s*\(", r"\n\);")


def view(src: str, name: str) -> str:
    return extract(src, rf"create or replace view public\.{name}\b", r";")


def function(src: str, schema: str, name: str) -> str:
    return extract(src, rf"create (?:or replace )?function {schema}\.{name}\(", r"\$\$;")


def trigger(src: str, name: str) -> str:
    return extract(src, rf"create trigger {name}\b", r";")


def sql(query: str, succeeds: bool = True, error_code: str | None = None, app: str = "m04-gate") -> str:
    proc = subprocess.run(
        [
            "psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
            "-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", PGDATABASE,
        ],
        input=query,
        text=True,
        capture_output=True,
        timeout=30,
        env={
            **os.environ,
            "PGHOST": PGHOST,
            "PGPORT": PGPORT,
            "PGUSER": PGUSER,
            "PGPASSWORD": PGPASSWORD,
            "PGDATABASE": PGDATABASE,
            "PGAPPNAME": app,
        },
    )
    match = SQLSTATE_RE.search(proc.stderr)
    sqlstate = match.group(1) if match else None
    if succeeds:
        assert proc.returncode == 0, f"[{app}] SQL failed unexpectedly ({sqlstate}): {proc.stderr}"
        return proc.stdout.strip()
    assert proc.returncode != 0, f"[{app}] Expected SQL failure ({error_code}), got success: {proc.stdout}"
    if error_code is not None:
        assert sqlstate == error_code or error_code in proc.stderr, (
            f"[{app}] Expected SQLSTATE {error_code}, got {sqlstate}: {proc.stderr}"
        )
    return proc.stderr


def build_schema_sql() -> tuple[str, str]:
    foundation = source("202609040001_foundation")
    core = source("202609040002_financial_core")
    commands = source("202609040005_financial_commands")
    saas_platform = source("202609080006_saas_platform")
    saas_security = source("202609080007_saas_security")
    accounting = source("202609080008_post_v31_accounting_domain")
    refinements = source("202609080011_saas_commercial_refinements")
    v33 = source("202609090014_v33_saas_control_plane")
    v34 = source("202609100015_v34_master_operations")
    v35_plan = source("202609100016_v35_plan_promotion_lifecycle")
    idemp_plan = source("master_plan_draft_publication_idempotent")
    tenant_search = source("master_tenant_search_filters")
    support_sessions = source("v35_master_readonly_support_sessions")
    manual_inv = source("v35_master_manual_invoice")
    rbac = source("20261101181945_tenant_rbac_management")
    accept = source("20261109233000_v35_onboarding_acceptance")
    harden_anon = source("20261002202518_harden_anonymous_rpc_permissions")
    m04 = source("20261126120000_v35_m04_master_saas_operations")

    m04_lines = m04.strip().splitlines()
    assert any(l.strip().lower() == "begin;" for l in m04_lines[:20])
    assert m04_lines[-1].strip().lower() == "commit;"
    begin_idx = next(i for i, l in enumerate(m04_lines) if l.strip().lower() == "begin;")
    commit_idx = len(m04_lines) - 1
    m04_body = "\n".join(m04_lines[begin_idx + 1 : commit_idx])

    statements = [
        """
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
          if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
        end $$;
        create schema if not exists extensions;
        create extension if not exists pgcrypto with schema extensions;
        create extension if not exists btree_gist with schema extensions;
        create schema if not exists private;
        revoke all on schema private from public;
        grant usage on schema public to anon, authenticated;
        grant usage on schema private to authenticated;
        create schema if not exists auth;
        create table auth.users (
          id uuid primary key,
          aud text,
          role text,
          email text,
          invited_at timestamptz,
          email_confirmed_at timestamptz
        );
        create function auth.jwt() returns jsonb language sql stable as
          $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
        create function auth.uid() returns uuid language sql stable as
          $$ select (auth.jwt()->>'sub')::uuid $$;
        """,
        function(foundation, "private", "set_updated_at"),
        table(foundation, "organizations"),
        trigger(foundation, "organizations_set_updated_at"),
        table(foundation, "organization_settings"),
        trigger(foundation, "organization_settings_set_updated_at"),
        extract(accounting, r"alter table public\.organization_settings\s+add column if not exists postal_code", r";"),
        table(foundation, "permissions"),
        extract(foundation, r"insert into public\.permissions \(code, description\) values", r";"),
        table(foundation, "roles"),
        table(foundation, "role_permissions"),
        table(foundation, "user_roles"),
        table(foundation, "user_profiles"),
        function(foundation, "private", "seed_default_roles"),
        trigger(foundation, "organizations_seed_default_roles"),
        table(foundation, "members"),
        table(foundation, "member_user_links"),
        function(core, "private", "prevent_financial_mutation"),
        table(core, "audit_logs"),
        trigger(core, "audit_logs_immutable"),
        table(core, "idempotency_keys"),
        function(commands, "private", "idempotency_begin"),
        function(commands, "private", "idempotency_complete"),
        table(saas_platform, "platform_staff"),
        trigger(saas_platform, "platform_staff_set_updated_at"),
        table(saas_platform, "saas_plans"),
        trigger(saas_platform, "saas_plans_set_updated_at"),
        table(saas_platform, "saas_plan_entitlements"),
        table(saas_platform, "saas_tenant_accounts"),
        table(saas_platform, "saas_subscriptions"),
        trigger(saas_platform, "saas_subscriptions_set_updated_at"),
        table(saas_platform, "saas_subscription_events"),
        trigger(saas_platform, "saas_subscription_events_immutable"),
        table(saas_platform, "saas_invoices"),
        trigger(saas_platform, "saas_invoices_immutable"),
        table(saas_platform, "saas_invoice_voids"),
        trigger(saas_platform, "saas_invoice_voids_immutable"),
        table(saas_platform, "saas_payments"),
        trigger(saas_platform, "saas_payments_immutable"),
        table(saas_platform, "saas_payment_allocations"),
        trigger(saas_platform, "saas_payment_allocations_immutable"),
        table(saas_platform, "saas_payment_reversals"),
        trigger(saas_platform, "saas_payment_reversals_immutable"),
        table(saas_platform, "saas_support_sessions"),
        table(saas_platform, "saas_master_audit_logs"),
        trigger(saas_platform, "saas_master_audit_logs_immutable"),
        table(saas_platform, "saas_terms_versions"),
        table(saas_platform, "saas_terms_acceptances"),
        trigger(saas_platform, "saas_terms_acceptances_immutable"),
        table(saas_platform, "saas_fiscal_documents"),
        trigger(saas_platform, "saas_fiscal_documents_set_updated_at"),
        view(saas_platform, "v_saas_active_payment_allocations"),
        view(saas_platform, "v_saas_invoice_balances"),
        view(saas_platform, "v_saas_payment_balances"),
        function(saas_security, "private", "is_platform_staff"),
        function(saas_security, "private", "has_active_support_session"),
        function(saas_security, "private", "tenant_write_allowed"),
        function(saas_security, "private", "belongs_to_org"),
        function(saas_security, "private", "has_permission"),
        function(saas_security, "private", "require_permission"),
        table(refinements, "saas_subscription_price_terms"),
        extract(refinements, r"alter table public\.saas_subscription_price_terms\s+add constraint", r";"),
        table(refinements, "saas_invoice_items"),
        trigger(refinements, "saas_invoice_items_immutable"),
        table(refinements, "saas_collection_events"),
        trigger(refinements, "saas_collection_events_immutable"),
        extract(refinements, r"alter table public\.saas_payment_allocations\s+add constraint saas_payment_allocations_org_id_unique", r";"),
        table(refinements, "saas_payment_allocation_reversals"),
        trigger(refinements, "saas_payment_allocation_reversals_immutable"),
        view(refinements, "v_saas_active_payment_allocations"),
        function(refinements, "private", "validate_saas_payment_allocation"),
        trigger(refinements, "saas_payment_allocations_validate"),
        function(refinements, "private", "validate_saas_invoice_void"),
        trigger(refinements, "saas_invoice_voids_validate"),
        function(v33, "private", "has_aal2"),
        function(v33, "private", "is_platform_staff"),
        extract(v33, r"alter table public\.saas_support_sessions\s+drop constraint if exists saas_support_sessions_scope_check", r";"),
        extract(v33, r"alter table public\.saas_support_sessions\s+add constraint saas_support_sessions_scope_check", r";"),
        function(v33, "private", "has_active_support_session"),
        function(v33, "private", "is_tenant_user"),
        function(v33, "private", "require_platform_staff"),
        table(v33, "saas_plan_versions"),
        table(v33, "saas_plan_version_entitlements"),
        function(v33, "private", "guard_published_saas_plan_version"),
        trigger(v33, "saas_plan_versions_published_guard"),
        trigger(v33, "saas_plan_version_entitlements_published_guard"),
        trigger(v33, "saas_plan_versions_set_updated_at"),
        trigger(v33, "saas_plan_version_entitlements_set_updated_at"),
        function(v33, "private", "default_saas_plan_version"),
        extract(v33, r"alter table public\.saas_subscriptions\s+add column if not exists plan_version_id", r";"),
        extract(v33, r"alter table public\.saas_subscriptions\s+add constraint saas_subscriptions_plan_version_fk", r";"),
        extract(v33, r"alter table public\.saas_tenant_accounts\s+add column if not exists access_override", r";"),
        function(v33, "private", "tenant_write_allowed"),
        table(v33, "saas_billing_policies"),
        extract(v33, r"alter table public\.saas_invoices\s+add column if not exists billing_policy_id", r";"),
        table(v33, "saas_invoice_adjustments"),
        trigger(v33, "saas_invoice_adjustments_immutable"),
        function(v33, "private", "validate_saas_invoice_adjustment"),
        trigger(v33, "saas_invoice_adjustments_validate"),
        table(v33, "saas_promotions"),
        table(v33, "saas_promotion_plan_versions"),
        table(v33, "saas_payment_agreements"),
        trigger(v33, "saas_payment_agreements_immutable"),
        table(v33, "saas_payment_agreement_invoices"),
        table(v33, "saas_payment_agreement_installments"),
        table(v33, "saas_payment_agreement_events"),
        trigger(v33, "saas_payment_agreement_events_immutable"),
        view(v33, "v_saas_payment_agreement_status"),
        table(v33, "saas_scheduled_subscription_changes"),
        table(v33, "saas_jobs"),
        table(v33, "saas_support_tickets"),
        trigger(v33, "saas_support_tickets_set_updated_at"),
        table(v33, "saas_support_ticket_messages"),
        trigger(v33, "saas_support_ticket_messages_immutable"),
        table(v33, "saas_support_ticket_events"),
        trigger(v33, "saas_support_ticket_events_immutable"),
        table(v33, "saas_platform_configuration"),
        extract(v33, r"alter table public\.saas_terms_versions\s+add column if not exists status", r";"),
        view(v33, "v_saas_invoice_balances"),
        function(v33, "private", "validate_saas_payment_allocation"),
        extract(v33, r"alter table public\.saas_support_tickets enable row level security", r";"),
        extract(v33, r"alter table public\.saas_support_ticket_messages enable row level security", r";"),
        extract(v33, r"create policy saas_support_tickets_select", r";"),
        extract(v33, r"create policy saas_support_ticket_messages_select", r";"),
        function(v33, "public", "create_saas_support_ticket"),
        function(v33, "public", "reply_saas_support_ticket"),
        table(v34, "saas_onboarding_runs"),
        table(v34, "saas_onboarding_step_events"),
        function(v34, "private", "replace_plan_version_entitlements"),
        function(v34, "public", "create_saas_plan_draft"),
        function(v34, "public", "publish_saas_plan_version"),
        extract(v34, r"alter table public\.saas_support_tickets\s+add column if not exists ticket_scope", r";"),
        extract(v34, r"alter table public\.saas_support_tickets\s+alter column organization_id drop not null;", r"alter table public\.saas_support_ticket_events alter column organization_id drop not null;"),
        extract(v34, r"drop policy if exists saas_support_tickets_select", r";"),
        extract(v34, r"drop policy if exists saas_support_ticket_messages_select", r";"),
        extract(v34, r"create policy saas_support_tickets_select", r";"),
        extract(v34, r"create policy saas_support_ticket_messages_select", r";"),
        function(v34, "public", "create_saas_internal_ticket"),
        extract(v35_plan, r"alter table public\.saas_plan_versions\s+add column if not exists display_name_snapshot", r";"),
        function(v35_plan, "public", "create_saas_plan_draft"),
        function(v35_plan, "public", "publish_saas_plan_version"),
        extract(idemp_plan, r"create table(?: if not exists)? private\.master_idempotency_keys", r"\);" ),
        function(idemp_plan, "public", "create_master_plan_draft_idempotent"),
        tenant_search,
        support_sessions,
        manual_inv,
        function(rbac, "public", "assign_tenant_user_role"),
        extract(accept, r"create table(?: if not exists)? private\.onboarding_invite_identity", r"\);"),
        extract(accept, r"create table(?: if not exists)? private\.onboarding_terms_documents", r"\);"),
        function(accept, "public", "accept_onboarding_invite"),
        "revoke all on all tables in schema public from anon, authenticated;",
        "revoke execute on all functions in schema private from public, anon, authenticated;",
        "grant usage on schema private to authenticated;",
        "grant execute on function private.require_permission(uuid, text) to authenticated;",
        "grant select on public.saas_support_ticket_messages, public.saas_support_tickets to authenticated;",
        extract(harden_anon, r"do \$\$\s*declare v_function regprocedure;", r"end;\s*\$\$;"),
    ]
    return "\n\n".join(statements), m04_body


def uid(n: int) -> str:
    return f"00000000-0000-4000-8000-{n:012d}"


def caller(user_id: str, aal: str = "aal2") -> str:
    claims = json.dumps({"sub": user_id, "role": "authenticated", "aal": aal})
    return f"set local role authenticated; set local request.jwt.claims = '{claims}';"


def main() -> None:
    if "--self-test-extract" in sys.argv:
        bootstrap_sql, m04_body = build_schema_sql()
        assert len(bootstrap_sql) > 10000
        assert len(m04_body) > 10000
        for sym in (
            "public.read_tenant_seat_usage",
            "public.confirm_saas_subscription_hiring_idempotent",
            "public.schedule_saas_plan_change_idempotent",
            "public.apply_scheduled_saas_plan_change_idempotent",
            "public.suspend_saas_subscription_manual_idempotent",
            "public.reactivate_saas_subscription_idempotent",
            "public.cancel_saas_subscription_idempotent",
            "public.register_saas_payment_idempotent",
            "public.allocate_saas_payment_idempotent",
            "public.reverse_saas_payment_allocation_idempotent",
            "public.void_saas_invoice_idempotent",
            "public.apply_saas_invoice_adjustment_idempotent",
            "public.record_saas_payment_agreement_idempotent",
            "public.register_saas_fiscal_document_idempotent",
            "public.read_master_saas_financial_summary",
            "public.add_master_support_internal_note_idempotent",
            "public.assign_master_support_ticket_idempotent",
            "public.create_saas_internal_ticket_idempotent",
            "public.read_tenant_active_support_session",
        ):
            assert sym in m04_body, f"Missing expected symbol in M04 migration: {sym}"
        assert "rls_auto_enable" not in bootstrap_sql
        assert not re.search(r"(?im)^\s*(begin|commit|rollback|start\s+transaction)\s*;", m04_body)
        print(f"PASS M04 SQL extraction self-test (bootstrap={len(bootstrap_sql)} chars, m04={len(m04_body)} chars)")
        return

    assert_disposable_target()
    assert sql("select current_database() || ':' || current_user;") == f"{PGDATABASE}:{PGUSER}"

    _, m04_body = build_schema_sql()
    bootstrap_product_history(next(MIGRATIONS.glob("20261126120000_*.sql")), sql)

    m04_sigs = (
        "public.read_tenant_seat_usage(uuid)",
        "public.confirm_saas_subscription_hiring_idempotent(uuid,uuid,numeric,text,text)",
        "public.schedule_saas_plan_change_idempotent(uuid,uuid,text,text)",
        "public.suspend_saas_subscription_manual_idempotent(uuid,text,text)",
        "public.register_saas_payment_idempotent(uuid,timestamptz,numeric,text,text,jsonb,text)",
        "public.void_saas_invoice_idempotent(uuid,uuid,text,text)",
        "public.add_master_support_internal_note_idempotent(uuid,text,text,text)",
    )
    probe = " and ".join(f"to_regprocedure('{s}') is not null" for s in m04_sigs)
    rb = sql(f"select ({probe})::text;\nbegin;\n{m04_body}\nselect ({probe})::text;\nrollback;\nselect ({probe})::text;", app="m04-ddl-rb")
    assert rb == "false\ntrue\nfalse", f"M04 DDL rollback mismatch: {rb!r}"
    sql(f"begin;\n{m04_body}\ncommit;", app="m04-ddl-apply")
    print("PASS M04 schema bootstrap & DDL rollback/apply")

    master, support, org_a_admin, org_a_u2, org_a_u3, org_a_u4, org_b_admin = map(uid, range(1, 8))
    org_a, org_b = uid(101), uid(102)
    sql(f"""
    insert into auth.users(id, aud, role, email, invited_at, email_confirmed_at) values
      ('{master}', 'authenticated', 'authenticated', 'master@corsys.test', now(), now()),
      ('{support}', 'authenticated', 'authenticated', 'support@corsys.test', now(), now()),
      ('{org_a_admin}', 'authenticated', 'authenticated', 'a1@loja.test', now(), now()),
      ('{org_a_u2}', 'authenticated', 'authenticated', 'a2@loja.test', now(), now()),
      ('{org_a_u3}', 'authenticated', 'authenticated', 'a3@loja.test', now(), now()),
      ('{org_a_u4}', 'authenticated', 'authenticated', 'a4@loja.test', now(), now()),
      ('{org_b_admin}', 'authenticated', 'authenticated', 'b1@loja.test', now(), now());
    insert into public.platform_staff(user_id, role, active) values
      ('{master}', 'MASTER', true),
      ('{support}', 'SUPPORT', true);
    insert into public.organizations(id, name, number, status) values
      ('{org_a}', 'Loja Alpha M04', '101', 'active'),
      ('{org_b}', 'Loja Beta M04', '102', 'active');
    insert into public.organization_settings(organization_id, city, email) values
      ('{org_a}', 'Sao Paulo', 'alpha@loja.test'),
      ('{org_b}', 'Campinas', 'beta@loja.test');
    insert into public.saas_tenant_accounts(organization_id, billing_name, commercial_status) values
      ('{org_a}', 'Loja Alpha M04', 'trialing'),
      ('{org_b}', 'Loja Beta M04', 'active');
    insert into public.members(id, organization_id, full_name) values
      ('{uid(510)}', '{org_a}', 'QA seat 2'), ('{uid(511)}', '{org_a}', 'QA seat 3'), ('{uid(512)}', '{org_a}', 'QA seat 4');
    insert into public.member_user_links(organization_id, member_id, user_id) values
      ('{org_a}', '{uid(510)}', '{org_a_u2}'), ('{org_a}', '{uid(511)}', '{org_a_u3}'), ('{org_a}', '{uid(512)}', '{org_a_u4}');
    insert into public.user_roles(organization_id, user_id, role_id)
    select '{org_a}'::uuid, '{org_a_admin}'::uuid, id from public.roles where organization_id = '{org_a}' and code = 'ADMIN'
    union all
    select '{org_a}'::uuid, '{master}'::uuid, id from public.roles where organization_id = '{org_a}' and code = 'VIEWER'
    union all
    select '{org_b}'::uuid, '{org_b_admin}'::uuid, id from public.roles where organization_id = '{org_b}' and code = 'ADMIN';
    """)

    v_ess = sql(f"begin; {caller(master, 'aal2')} select public.create_master_plan_draft_idempotent('corsys_essencial_125', 'Corsys Essencial', 125.00, 'monthly', 14, 7, '2026-01-01', '{{\"max_admin_users\": 3}}'::jsonb, 'k-ess'); commit;")
    v_pro = sql(f"begin; {caller(master, 'aal2')} select public.create_master_plan_draft_idempotent('corsys_profissional_180', 'Corsys Profissional', 180.00, 'monthly', 14, 7, '2026-01-01', '{{\"max_admin_users\": 10}}'::jsonb, 'k-pro'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.publish_master_plan_draft_idempotent('{v_ess}','pub-ess'); select public.publish_master_plan_draft_idempotent('{v_pro}','pub-pro'); commit;")
    p_ess = sql(f"select plan_id from public.saas_plan_versions where id = '{v_ess}';")

    sub_a = uid(201)
    sql(f"""
    insert into public.saas_subscriptions(id, organization_id, plan_id, plan_version_id, status, started_at, current_period_start, current_period_end, billing_anchor_day)
    values ('{sub_a}', '{org_a}', '{p_ess}', '{v_ess}', 'trialing', '2026-10-01', '2026-11-01', '2026-11-30', 10);
    insert into public.saas_subscription_price_terms(organization_id, subscription_id, effective_from, unit_price, adjustment_reason)
    values ('{org_a}', '{sub_a}', '2026-10-01', 125.00, 'Condicao inicial');
    """)

    sql(f"begin; set local role anon; select public.read_tenant_seat_usage('{org_a}'); commit;", succeeds=False, error_code="42501")
    sql(f"begin; {caller(master, 'aal1')} select public.confirm_saas_subscription_hiring_idempotent('{org_a}', '{v_ess}', 125.00, 'AAL1 block', 'k-aal1'); commit;", succeeds=False, error_code="42501")
    sql(f"begin; {caller(support, 'aal2')} select public.suspend_saas_subscription_manual_idempotent('{org_a}', 'Support block', 'k-supp-blk'); commit;", succeeds=False, error_code="42501")
    sql(f"begin; {caller(org_b_admin, 'aal1')} select public.read_tenant_commercial_status('{org_a}'); commit;", succeeds=False, error_code="42501")
    print("PASS authorization & cross-tenant isolation denials")

    seat_json = json.loads(sql(f"begin; {caller(org_a_admin, 'aal1')} select public.read_tenant_seat_usage('{org_a}'); commit;"))
    assert seat_json["active_users"] == 1 and seat_json["max_admin_users"] == 3, seat_json
    role_treasurer = sql(f"select id from public.roles where organization_id = '{org_a}' and code = 'TREASURER';")
    sql(f"begin; {caller(org_a_admin, 'aal1')} select public.assign_tenant_user_role('{org_a}', '{org_a_u2}', '{role_treasurer}', 'Seat 2', 'k-s2'); select public.assign_tenant_user_role('{org_a}', '{org_a_u3}', '{role_treasurer}', 'Seat 3', 'k-s3'); commit;")
    sql(f"begin; {caller(org_a_admin, 'aal1')} select public.assign_tenant_user_role('{org_a}', '{org_a_u4}', '{role_treasurer}', 'Seat 4 over limit', 'k-s4'); commit;", succeeds=False, error_code="55000")
    print("PASS Entrega A seat enforcement (excluding platform staff, blocking 4th seat)")

    hire_id_1 = sql(f"begin; {caller(master, 'aal2')} select public.confirm_saas_subscription_hiring_idempotent('{org_a}', '{v_ess}', 125.00, 'Contratacao expressa', 'k-hire-1'); commit;")
    hire_id_2 = sql(f"begin; {caller(master, 'aal2')} select public.confirm_saas_subscription_hiring_idempotent('{org_a}', '{v_ess}', 125.00, 'Contratacao expressa', 'k-hire-1'); commit;")
    assert UUID_RE.match(hire_id_1) and hire_id_1 == hire_id_2
    assert sql(f"select status from public.saas_subscriptions where id = '{sub_a}';") == "active"

    sched_id = sql(f"begin; {caller(master, 'aal2')} select public.schedule_saas_plan_change_idempotent('{org_a}', '{v_pro}', 'Upgrade para 10 usuarios', 'k-sched-up'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.apply_scheduled_saas_plan_change_idempotent('{org_a}', '{sched_id}', 'Antes da vigencia', 'k-apply-early'); commit;", succeeds=False, error_code="55000")
    # Advance only the disposable fixture to the due date; assert execution through the real RPC.
    sql(f"delete from public.saas_subscription_price_terms where subscription_id='{sub_a}' and effective_from >= date_trunc('month',current_date)::date; update public.saas_scheduled_subscription_changes set effective_at=date_trunc('month',current_date) where id='{sched_id}';")
    sql(f"begin; {caller(master, 'aal2')} select public.apply_scheduled_saas_plan_change_idempotent('{org_a}', '{sched_id}', 'Efetivar upgrade', 'k-apply-up'); commit;")
    assert sql(f"select count(*) from public.saas_subscription_price_terms where subscription_id = '{sub_a}';") == "2"
    assert sql(f"select plan_version_id from public.saas_subscriptions where id = '{sub_a}';") == v_pro
    print("PASS Entrega A express hiring, prospective plan transition & historical price terms")

    inv1 = sql(f"begin; {caller(master, 'aal2')} select public.issue_saas_manual_invoice('{org_a}', '2026-11-01'::date, '2026-11-10'::date, 'Mensalidade Novembro', 'k-inv-1'); commit;")
    pay1 = sql(f"begin; {caller(master, 'aal2')} select public.register_saas_payment_idempotent('{org_a}', '2026-11-12T12:00:00Z'::timestamptz, 100.00, 'pix', 'PIX-001', '[]'::jsonb, 'k-pay-1'); commit;")
    alloc1 = sql(f"begin; {caller(master, 'aal2')} select public.allocate_saas_payment_idempotent('{org_a}', '{pay1}', '{inv1}', 100.00, 'k-alloc-1'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.void_saas_invoice_idempotent('{org_a}', '{inv1}', 'Tentativa com alocacao ativa', 'k-void-blk'); commit;", succeeds=False, error_code="55000")
    sql(f"begin; {caller(master, 'aal2')} select public.reverse_saas_payment_allocation_idempotent('{org_a}', '{alloc1}', 'Estorno alocacao teste', 'k-rev-a1'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.apply_saas_invoice_adjustment_idempotent('{org_a}', '{inv1}', 'manual_decrease', -30.00, 'Desconto aprovado', 'k-adj-1'); commit;")
    assert sql(f"select amount_open::text from public.v_saas_invoice_balances where id = '{inv1}';") == "150.00"
    agr1 = sql(f"begin; {caller(master, 'aal2')} select public.record_saas_payment_agreement_idempotent('{org_a}', array['{inv1}'::uuid], '[{{\"due_date\":\"2026-12-10\",\"amount\":150.00}}]'::jsonb, 'Acordo 0% encargos', 'k-agr-1'); commit;")
    fisc1 = sql(f"begin; {caller(master, 'aal2')} select public.register_saas_fiscal_document_idempotent('{org_a}', '{inv1}', 'nfse', 'issued', 'NFSE-1', 'PREF-1', '2026-11-12T12:00:00Z'::timestamptz, 'k-fisc-1'); commit;")
    assert UUID_RE.match(agr1) and UUID_RE.match(fisc1)
    summary = json.loads(sql(f"begin; {caller(master, 'aal2')} select public.read_master_saas_financial_summary('{org_a}'); commit;"))
    assert str(summary["total_open"]) == "150.00" or float(summary["total_open"]) == 150.0, summary
    print("PASS Entrega B SaaS ledger, reversals, void guard, agreement & segregated summary")

    # Settle the older invoice so the grace assertion isolates one due date.
    pay_close = sql(f"begin; {caller(master, 'aal2')} select public.register_saas_payment_idempotent('{org_a}', now(), 150.00, 'pix', 'QA-close-older', '[]'::jsonb, 'k-close-older'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.allocate_saas_payment_idempotent('{org_a}', '{pay_close}', '{inv1}', 150.00, 'k-alloc-close-older'); commit;")
    inv_overdue = uid(301)
    sql(f"""
    insert into public.saas_invoices(id, organization_id, subscription_id, invoice_number, competence, service_period_start, service_period_end, issue_date, due_date, amount_due)
    values ('{inv_overdue}', '{org_a}', '{sub_a}', 'SAAS-2026-0009', '2026-10-01', '2026-10-01', '2026-10-31', '2026-10-02', (current_date - interval '3 days')::date, 180.00);
    """)
    sql(f"begin; {caller(master, 'aal2')} select public.mark_saas_subscription_past_due_idempotent('{org_a}', '{inv_overdue}', 'Atraso 3d', 'k-pd-1'); commit;")
    sql(f"begin; {caller(master, 'aal2')} select public.suspend_saas_subscription_manual_idempotent('{org_a}', 'Antes do prazo', 'k-susp-early'); commit;", succeeds=False, error_code="55000")
    sql(f"update public.saas_subscriptions set past_due_since = now() - interval '10 days', grace_until = now() - interval '2 days' where id = '{sub_a}';")
    # C03 Regression guard: expiring grace_until while still past_due MUST NOT auto-block writes before manual suspension
    assert sql(f"select private.tenant_write_allowed('{org_a}')::text;") == "true"
    sql(f"begin; {caller(master, 'aal2')} select public.suspend_saas_subscription_manual_idempotent('{org_a}', 'Suspensao manual apos tolerancia', 'k-susp-ok'); commit;")
    assert sql(f"select private.tenant_write_allowed('{org_a}')::text;") == "false"
    sql(f"begin; {caller(org_a_admin, 'aal1')} select public.assign_tenant_user_role('{org_a}', '{org_a_u4}', '{role_treasurer}', 'Bloqueado suspenso', 'k-susp-wr'); commit;", succeeds=False, error_code="42501")
    tkt_id = sql(f"begin; {caller(org_a_admin, 'aal1')} select public.create_saas_support_ticket('{org_a}', 'Duvida em conta suspensa', 'billing', 'high', 'Preciso negociar faturas','k-ticket-suspended'); commit;")
    assert UUID_RE.match(tkt_id)
    sql(f"begin; {caller(master, 'aal2')} select public.reactivate_saas_subscription_idempotent('{org_a}', 'Reativacao com acordo registrado', 'k-react-1'); commit;")
    assert sql(f"select private.tenant_write_allowed('{org_a}')::text;") == "true"
    sql(f"begin; {caller(master, 'aal2')} select public.cancel_saas_subscription_idempotent('{org_a}', true, 'Cancelamento D01 teste', 'k-can-d01'); commit;")
    assert sql(f"select (status = 'canceled' and canceled_at::date + 90 > current_date + 80)::text from public.saas_subscriptions where id = '{sub_a}';") == "true"
    print("PASS Entrega C manual past_due, 7-day grace guard, manual suspension write-block, support access & D01 retention")

    sql(f"begin; {caller(support, 'aal2')} select public.add_master_support_internal_note_idempotent('{tkt_id}', 'Nota restrita da operacao', 'triage', 'k-note-1'); commit;")
    sql(f"begin; {caller(support, 'aal2')} select public.assign_master_support_ticket_idempotent('{tkt_id}', '{support}', 'urgent', 'k-assign-1'); commit;")
    assert sql(f"begin; {caller(org_a_admin, 'aal1')} select count(*) from public.saas_support_ticket_messages where ticket_id = '{tkt_id}' and visibility = 'internal_note'; commit;") == "0"
    assert sql(f"begin; {caller(support, 'aal2')} select count(*) from public.saas_support_ticket_messages where ticket_id = '{tkt_id}' and visibility = 'internal_note'; commit;") == "1"
    int_tkt = sql(f"begin; {caller(support, 'aal2')} select public.create_saas_internal_ticket_idempotent('{org_a}', 'Revisao interna', 'security', 'high', 'Checklist interno', 'k-int-1'); commit;")
    assert UUID_RE.match(int_tkt)
    sess_id = sql(f"begin; {caller(master, 'aal2')} select public.start_master_support_session('{org_a}', 'Diagnostico leitura M04', 'k-sess-1'); commit;")
    notice = json.loads(sql(f"begin; {caller(org_a_admin, 'aal1')} select public.read_tenant_active_support_session('{org_a}'); commit;"))
    assert notice["active"] is True and notice["scope"] == "read_only", notice
    sql(f"begin; {caller(master, 'aal2')} select public.end_master_support_session('{org_a}', '{sess_id}', 'k-sess-end'); commit;")
    notice_after = json.loads(sql(f"begin; {caller(org_a_admin, 'aal1')} select public.read_tenant_active_support_session('{org_a}'); commit;"))
    assert notice_after["active"] is False, notice_after
    print("PASS Entrega D internal notes RLS, triage assignment, internal ticket & active read-only support notice")

    assert sql("select count(*) from public.saas_master_audit_logs where staff_user_id is null or length(btrim(action)) = 0;") == "0"
    print("PASS global M04 audit & relational integrity")


if __name__ == "__main__":
    main()
