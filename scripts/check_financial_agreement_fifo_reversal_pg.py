"""Disposable PostgreSQL multi-session financial integrity & concurrency gate.

Exercises:
- Real two-session concurrency between create_member_debt_agreement and
  allocate_payment_fifo over the same member's charges in BOTH orders
  (FIFO first -> PT409/23503; Agreement first -> FIFO skips settled original
  charges, preserves payment credit / allocates only to untouched charges, and
  preserves negotiated replacement principal without deadlocks or duplication).
- Controlled 55P03 lock_timeout rollback safety between FIFO and agreement.
- Contract, cross-tenant, validation, balance reconciliation, and multi-session
  concurrency parity for reverse_member_payment_idempotent (replacing legacy
  reverse_payment coverage gap), including reversal after debt agreement.

Never connects to Supabase DEV or PROD. Requires local disposable PostgreSQL 17.
"""
from __future__ import annotations

import concurrent.futures
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = os.environ.get("PGPORT", "55432")
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "onboarding-ci")
PGDATABASE = os.environ.get("PGDATABASE", "financial_integrity_gate")

FORBIDDEN_TARGETS = ("supabase.co", "supabase.com", "szqkdekwhzxsoxorgvaz", "pooler")
ALLOWED_DB_SUFFIXES = ("_gate", "_test", "_trial")

SQLSTATE_RE = re.compile(r"ERROR:\s+([0-9A-Z]{5}):")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def assert_disposable_target() -> None:
    target = f"{PGHOST}:{PGPORT}/{PGDATABASE}".lower()
    for token in FORBIDDEN_TARGETS:
        if token in target:
            raise SystemExit(
                f"REFUSING to run against non-disposable target containing '{token}': {target}"
            )
    if PGHOST not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit(f"REFUSING to run against non-local host: {PGHOST}")
    if not PGDATABASE.endswith(ALLOWED_DB_SUFFIXES):
        raise SystemExit(
            f"REFUSING to run against database '{PGDATABASE}'; expected suffix in {ALLOWED_DB_SUFFIXES}"
        )


def source(fragment: str) -> str:
    matches = list(MIGRATIONS.glob(f"*{fragment}*.sql"))
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
    return extract(src, rf"create (?:or replace )?function {schema}\.{name}\(", r"as\s+\$\$.*?\$\$;")


def trigger(src: str, name: str) -> str:
    return extract(src, rf"create trigger {name}\b", r";")


def base_env(app: str) -> dict[str, str]:
    return {
        **os.environ,
        "PGHOST": PGHOST,
        "PGPORT": PGPORT,
        "PGUSER": PGUSER,
        "PGPASSWORD": PGPASSWORD,
        "PGDATABASE": PGDATABASE,
        "PGAPPNAME": app,
    }


@dataclass
class SqlResult:
    returncode: int
    stdout: str
    stderr: str
    sqlstate: str | None


def run_sql_raw(query: str, app: str = "fin-integrity", timeout: int = 30) -> SqlResult:
    proc = subprocess.run(
        [
            "psql",
            "-XAtq",
            "-v",
            "ON_ERROR_STOP=1",
            "-v",
            "VERBOSITY=verbose",
            "-h",
            PGHOST,
            "-p",
            PGPORT,
            "-U",
            PGUSER,
            "-d",
            PGDATABASE,
        ],
        input=query,
        text=True,
        capture_output=True,
        timeout=timeout,
        env=base_env(app),
    )
    match = SQLSTATE_RE.search(proc.stderr)
    return SqlResult(
        returncode=proc.returncode,
        stdout=proc.stdout.strip(),
        stderr=proc.stderr.strip(),
        sqlstate=match.group(1) if match else None,
    )


def sql(
    query: str,
    app: str = "fin-integrity",
    succeeds: bool = True,
    error_code: str | None = None,
) -> str:
    res = run_sql_raw(query, app=app)
    if succeeds:
        assert res.returncode == 0, f"[{app}] SQL failed unexpectedly ({res.sqlstate}): {res.stderr}"
        return res.stdout
    assert res.returncode != 0, f"[{app}] Expected SQL failure ({error_code}), got success: {res.stdout}"
    if error_code is not None:
        assert res.sqlstate == error_code or error_code in res.stderr, (
            f"[{app}] Expected SQLSTATE {error_code}, got {res.sqlstate}: {res.stderr}"
        )
    return res.stderr


def build_schema_sql() -> str:
    foundation = source("202609040001_foundation")
    core = source("202609040002_financial_core")
    views = source("202609040003_financial_views")
    commands = source("202609040005_financial_commands")
    saas_platform = source("202609080006_saas_platform")
    saas_security = source("202609080007_saas_security")
    accounting = source("202609080008_post_v31_accounting_domain")
    controls = source("202609080010_operational_controls")
    rev_idemp = source("20261009174649_member_payment_reversal_idempotent")
    cancel_idemp = source("20261009184801_member_charge_cancellation_and_period_idempotency")
    agr_locks = source("20261021223703_member_agreement_lock_compatibility")
    tz_dates = source("20261115120000_v35_tenant_timezone_financial_dates")
    harden_anon = source("20261002202518_harden_anonymous_rpc_permissions")

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
          email text
        );
        create function auth.jwt() returns jsonb language sql stable as
          $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
        create function auth.uid() returns uuid language sql stable as
          $$ select (auth.jwt()->>'sub')::uuid $$;
        """,
        # 0001 foundation
        function(foundation, "private", "set_updated_at"),
        table(foundation, "organizations"),
        trigger(foundation, "organizations_set_updated_at"),
        table(foundation, "organization_settings"),
        trigger(foundation, "organization_settings_set_updated_at"),
        table(foundation, "permissions"),
        extract(foundation, r"insert into public\.permissions \(code, description\) values", r";"),
        table(foundation, "roles"),
        table(foundation, "role_permissions"),
        table(foundation, "user_roles"),
        extract(foundation, r"create index user_roles_user_id_idx", r";"),
        function(foundation, "private", "seed_default_roles"),
        trigger(foundation, "organizations_seed_default_roles"),
        table(foundation, "members"),
        extract(foundation, r"create index members_org_name_idx", r";"),
        trigger(foundation, "members_set_updated_at"),
        table(foundation, "member_user_links"),
        table(foundation, "financial_categories"),
        trigger(foundation, "financial_categories_set_updated_at"),
        table(foundation, "payment_methods"),
        table(foundation, "financial_accounts"),
        trigger(foundation, "financial_accounts_set_updated_at"),
        table(foundation, "account_opening_entries"),
        table(foundation, "funds"),
        table(foundation, "recurring_rules"),
        table(foundation, "events"),
        table(foundation, "financial_periods"),
        table(foundation, "period_events"),
        extract(foundation, r"create index period_events_period_seq_idx", r";"),
        function(foundation, "private", "is_period_closed"),
        # 0002 financial core
        function(core, "private", "prevent_financial_mutation"),
        function(core, "private", "reject_closed_period"),
        table(core, "charge_batches"),
        table(core, "charge_plans"),
        table(core, "charges"),
        extract(core, r"create unique index charges_generation_key_uidx", r";"),
        extract(core, r"create unique index charges_recurring_base_uidx", r";"),
        extract(core, r"create unique index charges_supersedes_uidx", r";"),
        extract(core, r"create index charges_member_due_idx", r";"),
        function(core, "private", "validate_charge_insert"),
        trigger(core, "charges_validate_business"),
        trigger(core, "charges_reject_closed_period"),
        trigger(core, "charges_immutable"),
        table(core, "charge_adjustments"),
        table(core, "charge_cancellations"),
        table(core, "payments"),
        extract(core, r"create index payments_member_date_idx", r";"),
        trigger(core, "payments_reject_closed_period"),
        trigger(core, "payments_immutable"),
        table(core, "member_credits"),
        trigger(core, "member_credits_reject_closed_period"),
        trigger(core, "member_credits_immutable"),
        table(core, "receivable_allocations"),
        extract(core, r"create index receivable_allocations_payment_charge_idx", r";"),
        extract(core, r"create index receivable_allocations_credit_charge_idx", r";"),
        extract(core, r"create index receivable_allocations_payment_idx", r";"),
        extract(core, r"create index receivable_allocations_credit_idx", r";"),
        extract(core, r"create index receivable_allocations_charge_idx", r";"),
        trigger(core, "receivable_allocations_reject_closed_period"),
        trigger(core, "receivable_allocations_immutable"),
        table(core, "allocation_reversals"),
        trigger(core, "allocation_reversals_reject_closed_period"),
        trigger(core, "allocation_reversals_immutable"),
        table(core, "payment_reversals"),
        trigger(core, "payment_reversals_reject_closed_period"),
        trigger(core, "payment_reversals_immutable"),
        table(core, "member_credit_reversals"),
        trigger(core, "member_credit_reversals_reject_closed_period"),
        trigger(core, "member_credit_reversals_immutable"),
        table(core, "audit_logs"),
        extract(core, r"create index audit_logs_org_entity_idx", r";"),
        trigger(core, "audit_logs_immutable"),
        table(core, "idempotency_keys"),
        function(core, "private", "validate_charge_adjustment"),
        trigger(core, "charge_adjustments_validate"),
        trigger(core, "charge_adjustments_reject_closed_period"),
        trigger(core, "charge_adjustments_immutable"),
        function(core, "private", "validate_receivable_allocation"),
        trigger(core, "receivable_allocations_validate"),
        function(core, "private", "validate_payment_reversal"),
        trigger(core, "payment_reversals_validate"),
        function(core, "private", "validate_member_credit_reversal"),
        trigger(core, "member_credit_reversals_validate"),
        function(core, "private", "validate_charge_cancellation"),
        trigger(core, "charge_cancellations_validate"),
        trigger(core, "charge_cancellations_reject_closed_period"),
        trigger(core, "charge_cancellations_immutable"),
        trigger(core, "financial_periods_immutable"),
        trigger(core, "period_events_immutable"),
        # 0003 financial views
        view(views, "v_active_allocations"),
        view(views, "v_charge_balances"),
        view(views, "v_payment_balances"),
        view(views, "v_member_credit_balances"),
        view(views, "v_member_financial_position"),
        view(views, "v_member_statement"),
        view(views, "v_member_financial_reconciliation"),
        # 0006 & 0007 SaaS security & tenant active gate
        table(saas_platform, "platform_staff"),
        table(saas_platform, "saas_tenant_accounts"),
        table(saas_platform, "saas_support_sessions"),
        function(saas_security, "private", "is_platform_staff"),
        function(saas_security, "private", "has_active_support_session"),
        function(saas_security, "private", "tenant_write_allowed"),
        function(saas_security, "private", "belongs_to_org"),
        function(saas_security, "private", "has_permission"),
        function(saas_security, "private", "require_permission"),
        # 0008 accounting plan snapshot required by charges_accounting_snapshot & preview_member_debt_agreement
        table(accounting, "accounting_plans"),
        extract(accounting, r"alter table public\.accounting_plans\s+add constraint accounting_plans_published_no_overlap", r";"),
        table(accounting, "accounting_accounts"),
        table(accounting, "financial_category_account_mappings"),
        function(accounting, "private", "prevent_published_accounting_structure_mutation"),
        trigger(accounting, "accounting_accounts_published_guard"),
        trigger(accounting, "category_account_mappings_published_guard"),
        function(accounting, "private", "prevent_published_accounting_plan_mutation"),
        trigger(accounting, "accounting_plans_published_guard"),
        function(accounting, "private", "validate_category_account_mapping"),
        trigger(accounting, "financial_category_account_mappings_validate"),
        function(accounting, "private", "accounting_plan_for_date"),
        function(accounting, "private", "resolve_category_account"),
        extract(accounting, r"alter table public\.charges\s+add column if not exists accounting_plan_id", r";"),
        extract(accounting, r"alter table public\.charges\s+add constraint charges_accounting_plan_fk", r";"),
        function(accounting, "private", "populate_charge_accounting_snapshot"),
        trigger(accounting, "charges_accounting_snapshot"),
        extract(accounting, r"alter table public\.payment_reversals\s+add column if not exists reversal_date", r";"),
        # 0010 member_debt_agreements tables
        table(controls, "member_debt_agreements"),
        trigger(controls, "member_debt_agreements_immutable"),
        table(controls, "member_debt_agreement_items"),
        table(controls, "member_debt_agreement_installments"),
        table(controls, "member_debt_agreement_events"),
        trigger(controls, "member_debt_agreement_events_immutable"),
        # 0005 financial commands
        function(commands, "private", "idempotency_begin"),
        function(commands, "private", "idempotency_complete"),
        function(commands, "public", "create_manual_charge"),
        function(commands, "public", "register_payment"),
        function(commands, "public", "allocate_payment_to_charge"),
        function(commands, "public", "allocate_payment_fifo"),
        function(commands, "public", "reverse_payment"),
        function(commands, "public", "cancel_charge"),
        function(commands, "public", "close_financial_period"),
        function(commands, "public", "reopen_financial_period"),
        extract(commands, r"revoke all on function public\.create_manual_charge\(", r"grant execute on function public\.reopen_financial_period\([^)]*\) to authenticated;"),
        # V35 wrappers & lock/timezone migrations
        rev_idemp,
        cancel_idemp,
        agr_locks,
        function(tz_dates, "private", "is_valid_iana_timezone"),
        extract(tz_dates, r"do \$\$\s*begin\s*if not exists \(\s*select 1\s*from pg_catalog\.pg_constraint\s*where conname = 'organization_settings_timezone_format_check'", r"end \$\$;"),
        function(tz_dates, "private", "validate_organization_settings_timezone"),
        trigger(tz_dates, "organization_settings_timezone_guard"),
        function(tz_dates, "private", "tenant_current_date_at"),
        function(tz_dates, "private", "tenant_current_date"),
        function(tz_dates, "public", "preview_member_debt_agreement"),
        extract(tz_dates, r"revoke all on function public\.preview_member_debt_agreement\(", r";"),
        extract(tz_dates, r"grant execute on function public\.preview_member_debt_agreement\(", r";"),
        # Harden anon grants & base table posture
        "revoke all on all tables in schema public from anon, authenticated;",
        "revoke execute on all functions in schema private from public, anon, authenticated;",
        "grant usage on schema private to authenticated;",
        "grant execute on function private.require_permission(uuid, text) to authenticated;",
        extract(
            harden_anon,
            r"do \$\$\s*declare v_function regprocedure;",
            r"end;\s*\$\$;",
        ),
        extract(
            harden_anon,
            r"alter default privileges for role postgres in schema public",
            r";",
        ),
    ]
    return "\n\n".join(statements)


def uid(n: int) -> str:
    return f"00000000-0000-4000-8000-{n:012d}"


def caller(user_id: str, aal: str = "aal1") -> str:
    claims = json.dumps({"sub": user_id, "role": "authenticated", "aal": aal})
    return f"set local role authenticated; set local request.jwt.claims = '{claims}';"


def wait_for(predicate, timeout_s: float = 10.0, interval_s: float = 0.03, desc: str = "state") -> str:
    deadline = time.monotonic() + timeout_s
    last = ""
    while time.monotonic() < deadline:
        val = predicate()
        if val:
            return val
        time.sleep(interval_s)
    raise AssertionError(f"Timed out waiting for PostgreSQL {desc} (last={last!r})")


def run_concurrent_pair(
    tag: str,
    sync_key: int,
    s1_user: str,
    s1_rpc: str,
    s2_user: str,
    s2_rpc: str,
    *,
    s1_finish: str = "commit;",
    s1_lock_timeout_ms: int = 6000,
    s2_lock_timeout_ms: int = 6000,
    statement_timeout_ms: int = 20000,
    hold_until_s2_finishes: bool = False,
) -> tuple[SqlResult, SqlResult, str]:
    """Execute s1 and s2 over two independent PostgreSQL connections and prove real Lock contention."""
    ctrl_app = f"{tag}-ctrl"
    s1_app = f"{tag}-s1"
    s2_app = f"{tag}-s2"

    ctrl = subprocess.Popen(
        [
            "psql",
            "-XAtq",
            "-v",
            "ON_ERROR_STOP=1",
            "-h",
            PGHOST,
            "-p",
            PGPORT,
            "-U",
            PGUSER,
            "-d",
            PGDATABASE,
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=base_env(ctrl_app),
    )
    released = False

    def release_ctrl() -> None:
        nonlocal released
        if released:
            return
        released = True
        try:
            if ctrl.stdin and not ctrl.stdin.closed:
                ctrl.stdin.write(f"select pg_advisory_unlock({sync_key});\n\\q\n")
                ctrl.stdin.flush()
            out, err = ctrl.communicate(timeout=10)
            if ctrl.returncode != 0:
                raise AssertionError(f"[{tag}] Control session failed: {err or out}")
        except Exception:
            ctrl.kill()
            ctrl.communicate()
            raise

    try:
        assert ctrl.stdin is not None
        ctrl.stdin.write(f"select pg_advisory_lock({sync_key});\n")
        ctrl.stdin.flush()

        wait_for(
            lambda: sql(
                f"select count(*) from pg_locks l "
                f"join pg_stat_activity a on a.pid = l.pid "
                f"where a.application_name = '{ctrl_app}' "
                f"and l.locktype = 'advisory' and l.objid = {sync_key} and l.granted;"
            )
            == "1",
            desc=f"{tag} control advisory lock",
        )

        s1_script = "\n".join(
            [
                f"set lock_timeout = '{s1_lock_timeout_ms}ms';",
                f"set statement_timeout = '{statement_timeout_ms}ms';",
                "begin;",
                caller(s1_user),
                s1_rpc,
                "reset role;",
                "reset lock_timeout;",
                f"select pg_advisory_lock({sync_key});",
                f"select pg_advisory_unlock({sync_key});",
                s1_finish,
            ]
        )

        s2_script = "\n".join(
            [
                f"set lock_timeout = '{s2_lock_timeout_ms}ms';",
                f"set statement_timeout = '{statement_timeout_ms}ms';",
                "begin;",
                caller(s2_user),
                s2_rpc,
                "commit;",
            ]
        )

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(run_sql_raw, s1_script, s1_app, 30)

            def s1_paused_after_rpc() -> str:
                if f1.done():
                    r1 = f1.result()
                    raise AssertionError(
                        f"[{tag}] S1 exited before holding lock gate (rc={r1.returncode}): {r1.stderr}"
                    )
                return sql(
                    f"select a.pid::text from pg_stat_activity a "
                    f"join pg_locks l on l.pid = a.pid "
                    f"where a.application_name = '{s1_app}' "
                    f"and a.wait_event = 'advisory' "
                    f"and l.locktype = 'advisory' and l.objid = {sync_key} and not l.granted "
                    f"limit 1;"
                )

            s1_pid = wait_for(s1_paused_after_rpc, desc=f"{tag} S1 RPC lock hold")
            f2 = pool.submit(run_sql_raw, s2_script, s2_app, 30)

            def s2_blocked_by_s1() -> str:
                if f2.done():
                    r2 = f2.result()
                    raise AssertionError(
                        f"[{tag}] Expected lock contention did NOT occur; S2 finished immediately "
                        f"(rc={r2.returncode}, sqlstate={r2.sqlstate}): {r2.stderr or r2.stdout}"
                    )
                return sql(
                    f"select a.pid || '|' || coalesce(a.wait_event, '') || '|' || "
                    f"string_agg(l.locktype || ':' || coalesce(l.relation::regclass::text, '-') || ':' || l.mode, ',') "
                    f"from pg_stat_activity a "
                    f"join pg_locks l on l.pid = a.pid and not l.granted "
                    f"where a.application_name = '{s2_app}' "
                    f"and a.wait_event_type = 'Lock' "
                    f"and {s1_pid} = any(pg_blocking_pids(a.pid)) "
                    f"group by a.pid, a.wait_event;"
                )

            contention_detail = wait_for(
                s2_blocked_by_s1,
                timeout_s=8.0,
                interval_s=0.02,
                desc=f"{tag} real Lock contention (S2 blocked by S1)",
            )

            if hold_until_s2_finishes:
                res2 = f2.result()
                release_ctrl()
                res1 = f1.result()
            else:
                release_ctrl()
                res1 = f1.result()
                res2 = f2.result()

        assert res1.sqlstate != "40P01", f"[{tag}] DEADLOCK 40P01 in S1: {res1.stderr}"
        assert res2.sqlstate != "40P01", f"[{tag}] DEADLOCK 40P01 in S2: {res2.stderr}"
        return res1, res2, contention_detail
    finally:
        release_ctrl()


def assert_global_integrity() -> None:
    assert (
        sql("select count(*) from public.v_charge_balances where integrity_ok is not true;")
        == "0"
    ), "Charge balance integrity violation"
    assert (
        sql("select count(*) from public.v_payment_balances where integrity_ok is not true;")
        == "0"
    ), "Payment balance integrity violation"
    assert (
        sql("select count(*) from public.v_member_financial_position where integrity_ok is not true;")
        == "0"
    ), "Member position integrity violation"
    assert (
        sql(
            "select count(*) from public.v_member_financial_reconciliation "
            "where reconciled is not true or integrity_ok is not true;"
        )
        == "0"
    ), "Member financial reconciliation mismatch"
    assert (
        sql("select count(*) from public.audit_logs where actor_user_id is null or length(btrim(action)) = 0;")
        == "0"
    ), "Audit log integrity violation"


def main() -> None:
    if "--self-test-extract" in sys.argv:
        schema_sql = build_schema_sql()
        assert len(schema_sql) > 10000
        assert "public.create_member_debt_agreement" in schema_sql
        assert "public.allocate_payment_fifo" in schema_sql
        assert "public.reverse_member_payment_idempotent" in schema_sql
        assert "public.preview_member_debt_agreement" in schema_sql
        assert "rls_auto_enable" not in schema_sql
        print(f"PASS SQL extraction self-test ({len(schema_sql)} chars)")
        return

    assert_disposable_target()
    assert sql("select current_database() || ':' || current_user;") == f"{PGDATABASE}:{PGUSER}"

    sql(build_schema_sql(), app="fin-bootstrap")
    print("PASS disposable schema bootstrap")

    org_a, org_b = uid(101), uid(102)
    actor_a1, actor_a2, viewer_a, actor_b = uid(201), uid(202), uid(203), uid(204)
    cat_a, cat_b = uid(301), uid(302)
    method_a, method_b = uid(401), uid(402)
    acct_a, acct_b = uid(501), uid(502)
    plan_a, plan_b = uid(601), uid(602)
    acc_rev_a, acc_rev_b = uid(701), uid(702)

    sql(
        f"""
        insert into auth.users(id, aud, role, email) values
          ('{actor_a1}', 'authenticated', 'authenticated', 'a1@corsys.test'),
          ('{actor_a2}', 'authenticated', 'authenticated', 'a2@corsys.test'),
          ('{viewer_a}', 'authenticated', 'authenticated', 'viewer@corsys.test'),
          ('{actor_b}', 'authenticated', 'authenticated', 'b@corsys.test');

        insert into public.organizations(id, name) values
          ('{org_a}', 'Loja Sintetica A'),
          ('{org_b}', 'Loja Sintetica B');

        insert into public.organization_settings(organization_id, timezone) values
          ('{org_a}', 'America/Sao_Paulo'),
          ('{org_b}', 'America/Sao_Paulo');

        insert into public.saas_tenant_accounts(organization_id, billing_name, commercial_status) values
          ('{org_a}', 'Loja Sintetica A', 'active'),
          ('{org_b}', 'Loja Sintetica B', 'active');

        insert into public.user_roles(organization_id, user_id, role_id)
        select '{org_a}', '{actor_a1}', id from public.roles where organization_id = '{org_a}' and code = 'ADMIN'
        union all
        select '{org_a}', '{actor_a2}', id from public.roles where organization_id = '{org_a}' and code = 'TREASURER'
        union all
        select '{org_a}', '{viewer_a}', id from public.roles where organization_id = '{org_a}' and code = 'VIEWER'
        union all
        select '{org_b}', '{actor_b}', id from public.roles where organization_id = '{org_b}' and code = 'ADMIN';

        insert into public.financial_categories(id, organization_id, name, domain, active, allow_installments) values
          ('{cat_a}', '{org_a}', 'Mensalidade Sintetica', 'member_receivable', true, true),
          ('{cat_b}', '{org_b}', 'Mensalidade Sintetica', 'member_receivable', true, true);

        insert into public.payment_methods(id, organization_id, name, active) values
          ('{method_a}', '{org_a}', 'PIX Sintetico', true),
          ('{method_b}', '{org_b}', 'PIX Sintetico', true);

        insert into public.financial_accounts(id, organization_id, name, account_type, active) values
          ('{acct_a}', '{org_a}', 'Conta Sintetica A', 'bank', true),
          ('{acct_b}', '{org_b}', 'Conta Sintetica B', 'bank', true);

        insert into public.accounting_plans(id, organization_id, name, status, valid_from, valid_to, published_at) values
          ('{plan_a}', '{org_a}', 'Plano Sintetico A', 'draft', '2020-01-01', '2099-12-31', null),
          ('{plan_b}', '{org_b}', 'Plano Sintetico B', 'draft', '2020-01-01', '2099-12-31', null);

        insert into public.accounting_accounts(id, organization_id, accounting_plan_id, code, description, row_type, nature, operational_classification, active) values
          ('{acc_rev_a}', '{org_a}', '{plan_a}', '1.01.001', 'Receita Sintetica A', 'analytic', 'revenue', 'recurring', true),
          ('{acc_rev_b}', '{org_b}', '{plan_b}', '1.01.001', 'Receita Sintetica B', 'analytic', 'revenue', 'recurring', true);

        insert into public.financial_category_account_mappings(organization_id, accounting_plan_id, category_id, accounting_account_id) values
          ('{org_a}', '{plan_a}', '{cat_a}', '{acc_rev_a}'),
          ('{org_b}', '{plan_b}', '{cat_b}', '{acc_rev_b}');

        update public.accounting_plans
        set status = 'published', published_at = now()
        where id in ('{plan_a}', '{plan_b}');
        """
    )

    today = sql(f"select ((now() at time zone 'America/Sao_Paulo')::date)::text;")
    period = f"{today[:7]}-01"
    first_due = sql(f"select (('{today}'::date + interval '1 month')::date)::text;")
    due_earliest = sql(f"select (('{today}'::date - interval '20 days')::date)::text;")
    due_middle = sql(f"select (('{today}'::date - interval '10 days')::date)::text;")
    due_latest = sql(f"select (('{today}'::date - interval '5 days')::date)::text;")

    # Baseline anon & VIEWER privilege denials
    for call_sql in (
        f"select public.preview_member_debt_agreement('{org_a}', '{uid(900)}', array['{uid(901)}'::uuid], 10, 1, '{today}', '{first_due}');",
        f"select public.create_member_debt_agreement('{org_a}', '{uid(900)}', array['{uid(901)}'::uuid], 10, 1, '{today}', '{first_due}', repeat('0', 64), 'anon block', 'k-anon');",
        f"select public.allocate_payment_fifo('{org_a}', '{uid(901)}', '{period}');",
        f"select public.reverse_member_payment_idempotent('{org_a}', '{uid(901)}', '{period}', 'anon block', 'k-anon');",
    ):
        sql(f"begin; set local role anon; {call_sql} commit;", succeeds=False, error_code="42501")
        sql(f"begin; {caller(viewer_a)} {call_sql} commit;", succeeds=False, error_code="42501")
    print("PASS anon and VIEWER privilege denials on agreement/FIFO/reversal RPCs")

    def create_member(member_id: str, org_id: str, name: str) -> None:
        sql(f"insert into public.members(id, organization_id, full_name, status) values ('{member_id}', '{org_id}', '{name}', 'active');")

    def make_charge(actor: str, org_id: str, member_id: str, cat_id: str, due: str, amount: str, tag: str) -> str:
        return sql(
            f"begin; {caller(actor)} select public.create_manual_charge("
            f"'{org_id}', '{member_id}', '{cat_id}', '{tag}', '{period}', '{today}', '{due}', '{period}', {amount}, '{tag}', 'chg-{tag}'); commit;"
        )

    def make_payment(actor: str, org_id: str, member_id: str, method_id: str, acct_id: str, amount: str, tag: str) -> str:
        return sql(
            f"begin; {caller(actor)} select public.register_payment("
            f"'{org_id}', '{member_id}', '{today}', '{period}', {amount}, '{method_id}', '{acct_id}', '{tag}', '{tag}', 'pay-{tag}'); commit;"
        )

    def preview_fingerprint(actor: str, org_id: str, member_id: str, charge_ids_sql: str, amount: str, installments: int) -> str:
        raw = sql(
            f"begin; {caller(actor)} select public.preview_member_debt_agreement("
            f"'{org_id}', '{member_id}', {charge_ids_sql}, {amount}, {installments}, '{today}', '{first_due}')->>'fingerprint'; commit;"
        )
        assert re.fullmatch(r"[0-9a-f]{64}", raw), raw
        return raw

    # ------------------------------------------------------------------
    # T1: FIFO first (partial payment) -> Agreement waits on charges -> PT409
    #     Includes reverse charge array input [c2, c1] to verify lock order.
    # ------------------------------------------------------------------
    m1 = uid(801)
    create_member(m1, org_a, "Integrante T1 FIFO Primeiro Parcial")
    c1 = make_charge(actor_a1, org_a, m1, cat_a, due_earliest, "100.00", "t1-c1")
    c2 = make_charge(actor_a1, org_a, m1, cat_a, due_middle, "50.00", "t1-c2")
    fp_t1 = preview_fingerprint(actor_a1, org_a, m1, f"array['{c2}'::uuid, '{c1}'::uuid]", "120.00", 2)
    p1 = make_payment(actor_a1, org_a, m1, method_a, acct_a, "60.00", "t1-p1")

    r1, r2, det_t1 = run_concurrent_pair(
        "t1-fifo-partial-agr",
        88001,
        actor_a1,
        f"select public.allocate_payment_fifo('{org_a}', '{p1}', '{period}');",
        actor_a2,
        f"select public.create_member_debt_agreement('{org_a}', '{m1}', array['{c2}'::uuid, '{c1}'::uuid], 120.00, 2, '{today}', '{first_due}', '{fp_t1}', 'Acordo concorrente T1', 'k-t1-agr');",
    )
    assert r1.returncode == 0 and r1.stdout.splitlines()[0] == "0.00", (r1.stdout, r1.stderr)
    assert r2.returncode != 0 and r2.sqlstate == "PT409", (r2.sqlstate, r2.stderr)
    assert sql(f"select count(*) from public.member_debt_agreements where member_id = '{m1}';") == "0"
    assert sql(f"select count(*) from public.charge_adjustments where member_id = '{m1}';") == "0"
    assert sql(f"select count(*) from public.charges where member_id = '{m1}' and source_kind = 'replacement';") == "0"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c1}';") == "40.00|60.00"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c2}';") == "50.00|0.00"
    assert sql(f"select available_amount::text || '|' || allocated_amount::text from public.v_payment_balances where payment_id = '{p1}';") == "0.00|60.00"
    assert sql(f"select open_receivables::text || '|' || available_credit::text || '|' || net_position::text from public.v_member_financial_position where member_id = '{m1}';") == "90.00|0.00|90.00"
    print(f"PASS T1 FIFO first (partial) -> agreement PT409 ({det_t1})")

    # ------------------------------------------------------------------
    # T2: FIFO first (full settlement) -> Agreement waits -> 23503 (no longer open)
    # ------------------------------------------------------------------
    m2 = uid(802)
    create_member(m2, org_a, "Integrante T2 FIFO Primeiro Quitacao")
    c3 = make_charge(actor_a1, org_a, m2, cat_a, due_earliest, "40.00", "t2-c3")
    c4 = make_charge(actor_a1, org_a, m2, cat_a, due_middle, "60.00", "t2-c4")
    fp_t2 = preview_fingerprint(actor_a1, org_a, m2, f"array['{c3}'::uuid, '{c4}'::uuid]", "80.00", 2)
    p2 = make_payment(actor_a1, org_a, m2, method_a, acct_a, "100.00", "t2-p2")

    r1, r2, det_t2 = run_concurrent_pair(
        "t2-fifo-full-agr",
        88002,
        actor_a1,
        f"select public.allocate_payment_fifo('{org_a}', '{p2}', '{period}');",
        actor_a2,
        f"select public.create_member_debt_agreement('{org_a}', '{m2}', array['{c3}'::uuid, '{c4}'::uuid], 80.00, 2, '{today}', '{first_due}', '{fp_t2}', 'Acordo concorrente T2', 'k-t2-agr');",
    )
    assert r1.returncode == 0 and r1.stdout.splitlines()[0] == "0.00", (r1.stdout, r1.stderr)
    assert r2.returncode != 0 and r2.sqlstate == "23503", (r2.sqlstate, r2.stderr)
    assert sql(f"select count(*) from public.member_debt_agreements where member_id = '{m2}';") == "0"
    assert sql(f"select open_receivables::text || '|' || available_credit::text || '|' || net_position::text from public.v_member_financial_position where member_id = '{m2}';") == "0.00|0.00|0.00"
    print(f"PASS T2 FIFO first (full) -> agreement 23503 ({det_t2})")

    # ------------------------------------------------------------------
    # T3a: Agreement FIRST -> FIFO SECOND (with 1 untouched open charge c7)
    #      FIFO locks c5 behind S1, wakes up seeing c5/c6 open_amount=0,
    #      skips c5/c6 completely, allocates 25.00 to c7, keeps 75.00 credit!
    # ------------------------------------------------------------------
    m3 = uid(803)
    create_member(m3, org_a, "Integrante T3a Acordo Primeiro")
    c5 = make_charge(actor_a1, org_a, m3, cat_a, due_earliest, "80.00", "t3a-c5")
    c6 = make_charge(actor_a1, org_a, m3, cat_a, due_middle, "40.00", "t3a-c6")
    c7 = make_charge(actor_a1, org_a, m3, cat_a, due_latest, "25.00", "t3a-c7")
    p3 = make_payment(actor_a1, org_a, m3, method_a, acct_a, "100.00", "t3a-p3")
    fp_t3a = preview_fingerprint(actor_a1, org_a, m3, f"array['{c6}'::uuid, '{c5}'::uuid]", "90.00", 2)

    r1, r2, det_t3a = run_concurrent_pair(
        "t3a-agr-first-fifo",
        88003,
        actor_a1,
        f"select public.create_member_debt_agreement('{org_a}', '{m3}', array['{c6}'::uuid, '{c5}'::uuid], 90.00, 2, '{today}', '{first_due}', '{fp_t3a}', 'Acordo T3a antes FIFO', 'k-t3a-agr');",
        actor_a2,
        f"select public.allocate_payment_fifo('{org_a}', '{p3}', '{period}');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    agr_t3a = r1.stdout.splitlines()[0]
    assert UUID_RE.match(agr_t3a), r1.stdout
    assert r2.stdout.splitlines()[0] == "75.00", r2.stdout
    assert sql(f"select open_amount::text || '|' || allocated_amount::text || '|' || effective_amount::text from public.v_charge_balances where charge_id = '{c5}';") == "0.00|0.00|0.00"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text || '|' || effective_amount::text from public.v_charge_balances where charge_id = '{c6}';") == "0.00|0.00|0.00"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c7}';") == "0.00|25.00"
    assert sql(f"select count(*) || '|' || sum(original_amount)::text from public.charges where member_id = '{m3}' and source_kind = 'replacement';") == "2|90.00"
    assert sql(f"select available_amount::text || '|' || allocated_amount::text from public.v_payment_balances where payment_id = '{p3}';") == "75.00|25.00"
    assert sql(f"select open_receivables::text || '|' || available_credit::text || '|' || net_position::text from public.v_member_financial_position where member_id = '{m3}';") == "90.00|75.00|15.00"
    assert sql(f"select count(*) from public.receivable_allocations where payment_id = '{p3}' and charge_id in ('{c5}', '{c6}');") == "0"
    print(f"PASS T3a agreement first -> FIFO skips settled debt, preserves principal & credit ({det_t3a})")

    # ------------------------------------------------------------------
    # T3b: Agreement FIRST -> FIFO SECOND (ALL existing charges in agreement)
    #      FIFO sees v_open = 0 across all locked charges, allocates 0.00,
    #      leaves full payment credit untouched and replacement debt intact.
    # ------------------------------------------------------------------
    m3b = uid(804)
    create_member(m3b, org_a, "Integrante T3b Acordo Total Primeiro")
    c8 = make_charge(actor_a1, org_a, m3b, cat_a, due_earliest, "70.00", "t3b-c8")
    c9 = make_charge(actor_a1, org_a, m3b, cat_a, due_middle, "30.00", "t3b-c9")
    p3b = make_payment(actor_a1, org_a, m3b, method_a, acct_a, "60.00", "t3b-p3b")
    fp_t3b = preview_fingerprint(actor_a1, org_a, m3b, f"array['{c8}'::uuid, '{c9}'::uuid]", "85.00", 2)

    r1, r2, det_t3b = run_concurrent_pair(
        "t3b-agr-only-fifo",
        88004,
        actor_a1,
        f"select public.create_member_debt_agreement('{org_a}', '{m3b}', array['{c8}'::uuid, '{c9}'::uuid], 85.00, 2, '{today}', '{first_due}', '{fp_t3b}', 'Acordo total T3b', 'k-t3b-agr');",
        actor_a2,
        f"select public.allocate_payment_fifo('{org_a}', '{p3b}', '{period}');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert r2.stdout.splitlines()[0] == "60.00", r2.stdout
    assert sql(f"select count(*) from public.receivable_allocations where payment_id = '{p3b}';") == "0"
    assert sql(f"select open_receivables::text || '|' || available_credit::text || '|' || net_position::text from public.v_member_financial_position where member_id = '{m3b}';") == "85.00|60.00|25.00"
    print(f"PASS T3b agreement first (no untouched charges) -> FIFO leaves full credit ({det_t3b})")

    # ------------------------------------------------------------------
    # T4: Controlled 55P03 lock_timeout + S1 rollback -> zero partial writes
    # ------------------------------------------------------------------
    m4 = uid(805)
    create_member(m4, org_a, "Integrante T4 Timeout")
    c10 = make_charge(actor_a1, org_a, m4, cat_a, due_earliest, "50.00", "t4-c10")
    p4 = make_payment(actor_a1, org_a, m4, method_a, acct_a, "20.00", "t4-p4")
    fp_t4 = preview_fingerprint(actor_a1, org_a, m4, f"array['{c10}'::uuid]", "45.00", 1)

    r1, r2, det_t4 = run_concurrent_pair(
        "t4-lock-timeout",
        88005,
        actor_a1,
        f"select public.allocate_payment_fifo('{org_a}', '{p4}', '{period}');",
        actor_a2,
        f"select public.create_member_debt_agreement('{org_a}', '{m4}', array['{c10}'::uuid], 45.00, 1, '{today}', '{first_due}', '{fp_t4}', 'Acordo timeout T4', 'k-t4-agr');",
        s1_finish="rollback;",
        s2_lock_timeout_ms=1500,
        hold_until_s2_finishes=True,
    )
    assert r1.returncode == 0
    assert r2.returncode != 0 and r2.sqlstate == "55P03", (r2.sqlstate, r2.stderr)
    assert sql(f"select open_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c10}';") == "50.00|0.00"
    assert sql(f"select available_amount::text || '|' || allocated_amount::text from public.v_payment_balances where payment_id = '{p4}';") == "20.00|0.00"
    assert sql(f"select count(*) from public.member_debt_agreements where member_id = '{m4}';") == "0"
    assert sql(f"select count(*) from public.audit_logs where organization_id = '{org_a}' and entity_id = '{p4}' and action = 'allocation.fifo';") == "0"
    print(f"PASS T4 55P03 lock_timeout + rollback leaves zero partial state ({det_t4})")

    # ------------------------------------------------------------------
    # T5: reverse_member_payment_idempotent parity with financial-lifecycle
    #     + concurrent replay + concurrent competition + post-agreement reversal
    # ------------------------------------------------------------------
    # T5a: Contract, tenant isolation & closed-period negatives
    m5 = uid(806)
    create_member(m5, org_a, "Integrante T5 Estorno Idempotente")
    c11 = make_charge(actor_a1, org_a, m5, cat_a, due_earliest, "100.00", "t5a-c11")
    p5 = make_payment(actor_a1, org_a, m5, method_a, acct_a, "100.00", "t5a-p5")
    alloc5 = sql(
        f"begin; {caller(actor_a1)} select public.allocate_payment_to_charge("
        f"'{org_a}', '{p5}', '{c11}', 40.00, '{period}', 'alloc-t5a'); commit;"
    )

    # Foreign tenant payment inside own tenant -> P0002; foreign org -> 42501
    mb = uid(899)
    create_member(mb, org_b, "Integrante B")
    pb = make_payment(actor_b, org_b, mb, method_b, acct_b, "30.00", "t5a-pb")
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_a}', '{pb}', '{period}', 'Estorno indevido', 'k-neg-p0002'); commit;",
        succeeds=False,
        error_code="P0002",
    )
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_b}', '{pb}', '{period}', 'Estorno cross org', 'k-neg-42501'); commit;",
        succeeds=False,
        error_code="42501",
    )
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', '  ab  ', 'k-neg-reason'); commit;",
        succeeds=False,
        error_code="22023",
    )
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period[:8]}02', 'Periodo invalido', 'k-neg-period'); commit;",
        succeeds=False,
        error_code="22023",
    )
    # Closed period blocks reversal inside sub-rolled-back transaction
    sql(
        f"begin; {caller(actor_a1)} "
        f"select public.close_financial_period('{org_a}', '{period}', 'Fechamento temporario T5a'); "
        f"select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', 'Estorno periodo fechado', 'k-neg-closed'); rollback;",
        succeeds=False,
        error_code="55000",
    )

    # T5b: Simultaneous SAME-KEY replay on reverse_member_payment_idempotent
    r1, r2, det_t5b = run_concurrent_pair(
        "t5b-rev-same-key",
        88006,
        actor_a1,
        f"select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', 'Estorno concorrente mesma chave', 'k-t5b-replay');",
        actor_a1,
        f"select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', 'Estorno concorrente mesma chave', 'k-t5b-replay');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    rev5_1 = r1.stdout.splitlines()[0]
    rev5_2 = r2.stdout.splitlines()[0]
    assert UUID_RE.match(rev5_1) and rev5_1 == rev5_2, (rev5_1, rev5_2)
    assert sql(f"select count(*) from public.payment_reversals where payment_id = '{p5}';") == "1"
    assert sql(f"select count(*) from public.allocation_reversals where allocation_id = '{alloc5}';") == "1"
    assert sql(f"select count(*) from public.audit_logs where entity_id = '{p5}' and action = 'payment.reverse';") == "1"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text || '|' || is_cancelled::text from public.v_charge_balances where charge_id = '{c11}';") == "100.00|0.00|false"
    assert sql(f"select available_amount::text || '|' || allocated_amount::text || '|' || is_reversed::text from public.v_payment_balances where payment_id = '{p5}';") == "0.00|0.00|true"
    # Original immutable ledger rows preserved
    assert sql(f"select original_amount::text from public.charges where id = '{c11}';") == "100.00"
    assert sql(f"select amount::text from public.payments where id = '{p5}';") == "100.00"
    assert sql(f"select amount::text from public.receivable_allocations where id = '{alloc5}';") == "40.00"
    # Reversed payment blocks FIFO, divergent replay -> 22023, new key -> 23505, reopened charge can cancel
    sql(
        f"begin; {caller(actor_a1)} select public.allocate_payment_fifo('{org_a}', '{p5}', '{period}'); commit;",
        succeeds=False,
        error_code="55000",
    )
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', 'Payload divergente T5b', 'k-t5b-replay'); commit;",
        succeeds=False,
        error_code="22023",
    )
    sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent('{org_a}', '{p5}', '{period}', 'Segunda chave apos estorno', 'k-t5b-newkey'); commit;",
        succeeds=False,
        error_code="23505",
    )
    cancel_id = sql(
        f"begin; {caller(actor_a1)} select public.cancel_member_charge_idempotent('{org_a}', '{c11}', '{period}', 'Cancelar apos estorno T5b', 'k-t5b-cancel'); commit;"
    )
    assert UUID_RE.match(cancel_id)
    assert sql(f"select open_amount::text || '|' || is_cancelled::text from public.v_charge_balances where charge_id = '{c11}';") == "0.00|true"
    print(f"PASS T5a/T5b reverse_member_payment_idempotent lifecycle + concurrent same-key replay ({det_t5b})")

    # T5c: Simultaneous DIFFERENT-KEY competition on reverse_member_payment_idempotent -> 1 UUID + 23505
    m6 = uid(807)
    create_member(m6, org_a, "Integrante T5c Disputa Estorno")
    c12 = make_charge(actor_a1, org_a, m6, cat_a, due_earliest, "100.00", "t5c-c12")
    p6 = make_payment(actor_a1, org_a, m6, method_a, acct_a, "60.00", "t5c-p6")
    assert (
        sql(
            f"begin; {caller(actor_a1)} select public.allocate_payment_fifo('{org_a}', '{p6}', '{period}'); commit;"
        )
        == "0.00"
    )
    r1, r2, det_t5c = run_concurrent_pair(
        "t5c-rev-diff-key",
        88007,
        actor_a1,
        f"select public.reverse_member_payment_idempotent('{org_a}', '{p6}', '{period}', 'Estorno A1 disputa', 'k-t5c-a1');",
        actor_a2,
        f"select public.reverse_member_payment_idempotent('{org_a}', '{p6}', '{period}', 'Estorno A2 disputa', 'k-t5c-a2');",
    )
    assert r1.returncode == 0 and UUID_RE.match(r1.stdout.splitlines()[0]), (r1.stdout, r1.stderr)
    assert r2.returncode != 0 and r2.sqlstate == "23505", (r2.sqlstate, r2.stderr)
    assert sql(f"select count(*) from public.payment_reversals where payment_id = '{p6}';") == "1"
    assert sql(f"select count(*) from public.allocation_reversals ar join public.receivable_allocations a on a.id = ar.allocation_id where a.payment_id = '{p6}';") == "1"
    assert sql(f"select count(*) from public.audit_logs where entity_id = '{p6}' and action = 'payment.reverse';") == "1"
    assert sql(f"select open_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c12}';") == "100.00|0.00"
    print(f"PASS T5c reverse_member_payment_idempotent concurrent different-key race ({det_t5c})")

    # T5d: Reversal of partial payment already linked prior to a debt agreement
    m7 = uid(808)
    create_member(m7, org_a, "Integrante T5d Estorno Pos Acordo")
    c13 = make_charge(actor_a1, org_a, m7, cat_a, due_earliest, "100.00", "t5d-c13")
    p7 = make_payment(actor_a1, org_a, m7, method_a, acct_a, "30.00", "t5d-p7")
    assert (
        sql(
            f"begin; {caller(actor_a1)} select public.allocate_payment_fifo('{org_a}', '{p7}', '{period}'); commit;"
        )
        == "0.00"
    )
    fp_t5d = preview_fingerprint(actor_a1, org_a, m7, f"array['{c13}'::uuid]", "50.00", 1)
    agr_t5d = sql(
        f"begin; {caller(actor_a1)} select public.create_member_debt_agreement("
        f"'{org_a}', '{m7}', array['{c13}'::uuid], 50.00, 1, '{today}', '{first_due}', '{fp_t5d}', 'Acordo saldo 70 para 50', 'k-t5d-agr'); commit;"
    )
    assert UUID_RE.match(agr_t5d)
    rev_t5d = sql(
        f"begin; {caller(actor_a1)} select public.reverse_member_payment_idempotent("
        f"'{org_a}', '{p7}', '{period}', 'Estorno parcial apos acordo T5d', 'k-t5d-rev'); commit;"
    )
    assert UUID_RE.match(rev_t5d)
    assert sql(f"select open_amount::text || '|' || effective_amount::text || '|' || allocated_amount::text from public.v_charge_balances where charge_id = '{c13}';") == "30.00|30.00|0.00"
    assert sql(f"select sum(open_amount)::text from public.v_charge_balances cb join public.member_debt_agreement_installments i on i.charge_id = cb.charge_id where i.agreement_id = '{agr_t5d}';") == "50.00"
    assert sql(f"select open_receivables::text || '|' || available_credit::text || '|' || net_position::text from public.v_member_financial_position where member_id = '{m7}';") == "80.00|0.00|80.00"
    print("PASS T5d reverse_member_payment_idempotent reopens only prior allocation after agreement")

    assert_global_integrity()
    print("PASS global balance, reconciliation & audit invariants (T1-T5)")


if __name__ == "__main__":
    main()
