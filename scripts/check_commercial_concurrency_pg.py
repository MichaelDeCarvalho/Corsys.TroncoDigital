"""Disposable PostgreSQL multi-session concurrency gate for V35 commercial plan RPCs.

Executes C01-C05 against an isolated local/CI PostgreSQL instance using the real
repository SQL definitions (including ADR-0049 migration 20261124220000). Never
connects to Supabase DEV or PROD.
"""
from __future__ import annotations

import concurrent.futures
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = os.environ.get("PGPORT", "55432")
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "onboarding-ci")
PGDATABASE = os.environ.get("PGDATABASE", "commercial_concurrency_gate")

FORBIDDEN_TARGETS = ("supabase.co", "supabase.com", "szqkdekwhzxsoxorgvaz", "pooler")
ALLOWED_DB_SUFFIXES = ("_gate", "_test", "_trial")

SQLSTATE_RE = re.compile(r"ERROR:\s+([0-9A-Z]{5}):")


def assert_disposable_target() -> None:
    target = f"{PGHOST}:{PGPORT}/{PGDATABASE}".lower()
    for token in FORBIDDEN_TARGETS:
        if token in target:
            raise SystemExit(f"REFUSING to run against non-disposable target containing '{token}': {target}")
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


def function(src: str, schema: str, name: str) -> str:
    return extract(src, rf"create or replace function {schema}\.{name}\(", r"\$\$;")


def trigger(src: str, name: str) -> str:
    return extract(src, rf"create trigger {name}\b", r";")


def base_env(app: str) -> dict[str, str]:
    return {**os.environ, "PGHOST": PGHOST, "PGPORT": PGPORT, "PGUSER": PGUSER,
            "PGPASSWORD": PGPASSWORD, "PGDATABASE": PGDATABASE, "PGAPPNAME": app}


@dataclass
class SqlResult:
    returncode: int
    stdout: str
    stderr: str
    sqlstate: str | None


def run_sql_raw(query: str, app: str = "commercial-conc", timeout: int = 30) -> SqlResult:
    proc = subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
         "-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", PGDATABASE],
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


def sql(query: str, app: str = "commercial-conc", succeeds: bool = True, error_code: str | None = None) -> str:
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


def build_schema_sql() -> tuple[str, str]:
    foundation = source("202609040001")
    core = source("202609040002")
    saas_platform = source("202609080006")
    v33 = source("202609090014")
    v34 = source("202609100015")
    v35 = source("202609100016")
    idemp = source("master_plan_draft_publication_idempotent")
    adr0049 = source("20261124220000_v35_commercial_draft_audit_logs")

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
        create table public.organizations (
          id uuid primary key default gen_random_uuid(),
          name text not null default 'Org Gate'
        );
        """,
        function(foundation, "private", "set_updated_at"),
        function(core, "private", "prevent_financial_mutation"),
        table(saas_platform, "platform_staff"),
        trigger(saas_platform, "platform_staff_set_updated_at"),
        table(saas_platform, "saas_plans"),
        trigger(saas_platform, "saas_plans_set_updated_at"),
        table(saas_platform, "saas_plan_entitlements"),
        trigger(saas_platform, "saas_plan_entitlements_set_updated_at"),
        table(saas_platform, "saas_subscriptions"),
        table(saas_platform, "saas_master_audit_logs"),
        trigger(saas_platform, "saas_master_audit_logs_immutable"),
        *(function(v33, "private", name) for name in ("has_aal2", "is_platform_staff", "require_platform_staff")),
        table(v33, "saas_plan_versions"),
        extract(v33, r"create unique index saas_plan_versions_plan_valid_from_uidx", r";"),
        table(v33, "saas_plan_version_entitlements"),
        function(v33, "private", "guard_published_saas_plan_version"),
        *(trigger(v33, name) for name in (
            "saas_plan_versions_published_guard",
            "saas_plan_version_entitlements_published_guard",
            "saas_plan_versions_set_updated_at",
            "saas_plan_version_entitlements_set_updated_at",
        )),
        extract(v33, r"alter table public\.saas_subscriptions\s+add column if not exists plan_version_id", r";"),
        extract(v33, r"alter table public\.saas_subscriptions\s+add constraint saas_subscriptions_plan_version_fk", r";"),
        table(v33, "saas_promotions"),
        trigger(v33, "saas_promotions_set_updated_at"),
        table(v33, "saas_promotion_plan_versions"),
        table(v33, "saas_scheduled_subscription_changes"),
        table(v34, "saas_onboarding_runs"),
        function(v34, "private", "replace_plan_version_entitlements"),
        extract(v34, r"alter table public\.saas_promotions\s+add column if not exists promotion_series_id", r";"),
        extract(v35, r"alter table public\.saas_plan_versions\s+add column if not exists display_name_snapshot", r";"),
        extract(v35, r"alter table public\.saas_plan_versions\s+add constraint saas_plan_versions_display_name_nonblank", r";"),
        extract(v35, r"create index if not exists saas_plan_versions_admin_history_idx", r";"),
        function(v35, "private", "saas_plan_delete_block_reason"),
        *(function(v35, "public", name) for name in (
            "create_saas_plan_draft",
            "publish_saas_plan_version",
            "set_saas_plan_active",
            "delete_saas_plan_if_unused",
        )),
        extract(v34, r"revoke all on function public\.create_saas_plan_draft\(", r";"),
        extract(v34, r"revoke all on function public\.publish_saas_plan_version\(", r";"),
        extract(v34, r"grant execute on function public\.create_saas_plan_draft\(", r";"),
        extract(v34, r"grant execute on function public\.publish_saas_plan_version\(", r";"),
        extract(v35, r"revoke all on function private\.saas_plan_delete_block_reason\(", r";"),
        extract(v35, r"revoke all on function public\.set_saas_plan_active\(", r";"),
        extract(v35, r"revoke all on function public\.delete_saas_plan_if_unused\(", r";"),
        extract(v35, r"grant execute on function public\.set_saas_plan_active\(", r";"),
        extract(v35, r"grant execute on function public\.delete_saas_plan_if_unused\(", r";"),
        idemp,
    ]
    return "\n\n".join(statements), adr0049


def uid(n: int) -> str:
    return f"00000000-0000-4000-8000-{n:012d}"


def caller(user_id: str, aal: str = "aal2") -> str:
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
    """Execute s1 and s2 over two independent PostgreSQL connections and prove real lock contention."""
    ctrl_app = f"{tag}-ctrl"
    s1_app = f"{tag}-s1"
    s2_app = f"{tag}-s2"

    ctrl = subprocess.Popen(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", PGDATABASE],
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
            ) == "1",
            desc=f"{tag} control advisory lock",
        )

        s1_script = "\n".join([
            f"set lock_timeout = '{s1_lock_timeout_ms}ms';",
            f"set statement_timeout = '{statement_timeout_ms}ms';",
            "begin;",
            caller(s1_user, "aal2"),
            s1_rpc,
            "reset role;",
            "reset lock_timeout;",
            f"select pg_advisory_lock({sync_key});",
            f"select pg_advisory_unlock({sync_key});",
            s1_finish,
        ])

        s2_script = "\n".join([
            f"set lock_timeout = '{s2_lock_timeout_ms}ms';",
            f"set statement_timeout = '{statement_timeout_ms}ms';",
            "begin;",
            caller(s2_user, "aal2"),
            s2_rpc,
            "commit;",
        ])

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(run_sql_raw, s1_script, s1_app, 30)

            def s1_paused_after_rpc() -> str:
                if f1.done():
                    r1 = f1.result()
                    raise AssertionError(f"[{tag}] S1 exited before holding lock gate (rc={r1.returncode}): {r1.stderr}")
                row = sql(
                    f"select a.pid::text from pg_stat_activity a "
                    f"join pg_locks l on l.pid = a.pid "
                    f"where a.application_name = '{s1_app}' "
                    f"and a.wait_event = 'advisory' "
                    f"and l.locktype = 'advisory' and l.objid = {sync_key} and not l.granted "
                    f"limit 1;"
                )
                return row

            s1_pid = wait_for(s1_paused_after_rpc, desc=f"{tag} S1 RPC lock hold")
            f2 = pool.submit(run_sql_raw, s2_script, s2_app, 30)

            def s2_blocked_by_s1() -> str:
                if f2.done():
                    r2 = f2.result()
                    raise AssertionError(
                        f"[{tag}] Expected lock contention did NOT occur; S2 finished immediately "
                        f"(rc={r2.returncode}, sqlstate={r2.sqlstate}): {r2.stderr or r2.stdout}"
                    )
                detail = sql(
                    f"select a.pid || '|' || coalesce(a.wait_event, '') || '|' || "
                    f"string_agg(l.locktype || ':' || coalesce(l.relation::regclass::text, '-') || ':' || l.mode, ',') "
                    f"from pg_stat_activity a "
                    f"join pg_locks l on l.pid = a.pid and not l.granted "
                    f"where a.application_name = '{s2_app}' "
                    f"and a.wait_event_type = 'Lock' "
                    f"and {s1_pid} = any(pg_blocking_pids(a.pid)) "
                    f"group by a.pid, a.wait_event;"
                )
                return detail

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


def main() -> None:
    assert_disposable_target()
    assert sql("select current_database() || ':' || current_user;") == f"{PGDATABASE}:{PGUSER}"

    bootstrap_sql, adr0049_sql = build_schema_sql()
    sql(bootstrap_sql, app="conc-bootstrap")

    # Verify ADR-0049 migration cleanly rolls back and applies cleanly
    assert not re.search(r"(?im)^\s*(begin|commit|rollback|start\s+transaction)\s*;", adr0049_sql)
    adr0049_sigs = (
        "public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb)",
        "public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb)",
        "public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean)",
    )
    exists_expr = " and ".join(f"to_regprocedure('{sig}') is not null" for sig in adr0049_sigs)
    audit_expr = " and ".join(
        f"coalesce(pg_get_functiondef(to_regprocedure('{sig}')) like '%saas_master_audit_logs%', false)"
        for sig in adr0049_sigs
    )
    exists_check = f"select ({exists_expr})::text || '|' || ({audit_expr})::text;"
    rb_res = sql(
        exists_check + "\nbegin;\n" + adr0049_sql + "\n" + exists_check + "\nrollback;\n" + exists_check,
        app="conc-adr0049-rb",
    )
    assert rb_res == "false|false\ntrue|true\nfalse|false", (
        f"ADR-0049 DDL rollback mismatch: {rb_res!r}"
    )
    sql("begin;\n" + adr0049_sql + "\ncommit;", app="conc-adr0049-apply")
    print("PASS schema bootstrap and ADR-0049 DDL rollback/apply")

    master_1, master_2, support = uid(1), uid(2), uid(3)
    sql(f"""
    insert into auth.users(id, aud, role, email) values
      ('{master_1}', 'authenticated', 'authenticated', 'master1@corsys.test'),
      ('{master_2}', 'authenticated', 'authenticated', 'master2@corsys.test'),
      ('{support}', 'authenticated', 'authenticated', 'support@corsys.test');
    insert into public.platform_staff(user_id, role, active) values
      ('{master_1}', 'MASTER', true),
      ('{master_2}', 'MASTER', true),
      ('{support}', 'SUPPORT', true);
    """)

    # Baseline privilege sanity checks before concurrency scenarios
    sql("begin; set local role anon; select public.publish_saas_plan_version('" + uid(999) + "'); commit;", succeeds=False, error_code="42501")
    sql("begin; " + caller(master_1, "aal1") + " select public.set_saas_plan_active('" + uid(999) + "', false, 'x'); commit;", succeeds=False, error_code="42501")
    sql("begin; " + caller(support, "aal2") + " select public.delete_saas_plan_if_unused('" + uid(999) + "', 'x'); commit;", succeeds=False, error_code="42501")
    print("PASS baseline Master/AAL2 and anon/SUPPORT denials")

    def create_draft_plan(code: str, name: str, price: str = "100.00", entitlements: str = '{"seats": 10}') -> tuple[str, str]:
        ver_id = sql(
            "begin; "
            + caller(master_1, "aal2")
            + f" select public.create_master_plan_draft_idempotent("
              f"'{code}', '{name}', {price}, 'monthly', 7, 5, '2027-01-01', '{entitlements}'::jsonb, '{code}-init'); commit;"
        )
        plan_id = sql(f"select plan_id from public.saas_plan_versions where id = '{ver_id}';")
        return plan_id, ver_id

    # ------------------------------------------------------------------
    # C01: Simultaneous draft edit (update vs update on same draft)
    # ------------------------------------------------------------------
    c01_plan, c01_ver = create_draft_plan("conc_c01", "Plano C01 Inicial", "100.00", '{"seats": 10, "legacy": true}')
    r1, r2, det = run_concurrent_pair(
        "c01a", 77001,
        master_1,
        f"select public.update_saas_plan_version_draft('{c01_ver}', 'Plano C01 Alpha', 'conc_c01_a', 150.00, 'monthly', 7, 5, '2027-01-01', '{{\"seats\": 20, \"s1\": true}}'::jsonb);",
        master_2,
        f"select public.update_saas_plan_version_draft('{c01_ver}', 'Plano C01 Beta', 'conc_c01_b', 220.00, 'yearly', 14, 10, '2027-02-01', '{{\"seats\": 50, \"s2\": true}}'::jsonb);",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert sql(
        f"select display_name_snapshot || '|' || internal_code_snapshot || '|' || price::text || '|' || billing_interval || '|' || trial_days::text || '|' || grace_days::text || '|' || valid_from::text "
        f"from public.saas_plan_versions where id = '{c01_ver}';"
    ) == "Plano C01 Beta|conc_c01_b|220.00|yearly|14|10|2027-02-01"
    assert sql(
        f"select name || '|' || code || '|' || price::text || '|' || billing_interval from public.saas_plans where id = '{c01_plan}';"
    ) == "Plano C01 Beta|conc_c01_b|220.00|yearly"
    assert sql(
        f"select string_agg(entitlement_key || '=' || entitlement_value::text, ',' order by entitlement_key) "
        f"from public.saas_plan_version_entitlements where plan_version_id = '{c01_ver}';"
    ) == "s2=true,seats=50"
    assert sql(
        f"select string_agg(staff_user_id::text || ':' || (metadata->>'code'), ',' order by id) "
        f"from public.saas_master_audit_logs where resource_id = '{c01_ver}' and action = 'saas_plan_version.draft_updated';"
    ) == f"{master_1}:conc_c01_a,{master_2}:conc_c01_b"

    # C01b: Controlled lock_timeout (55P03) leaves zero partial write or leaked audit log
    r1_t, r2_t, det_t = run_concurrent_pair(
        "c01b", 77002,
        master_1,
        f"select public.update_saas_plan_version_draft('{c01_ver}', 'Plano C01 Rollback', 'conc_c01_rb', 333.00, 'monthly', 1, 1, '2027-03-01', '{{\"tmp\": 1}}'::jsonb);",
        master_2,
        f"select public.update_saas_plan_version_draft('{c01_ver}', 'Timeout Test', 'conc_c01_to', 999.00, 'monthly', 1, 1, '2027-04-01', '{{\"to\": 1}}'::jsonb);",
        s1_finish="rollback;",
        s2_lock_timeout_ms=1500,
        hold_until_s2_finishes=True,
    )
    assert r1_t.returncode == 0
    assert r2_t.returncode != 0 and r2_t.sqlstate == "55P03", (r2_t.sqlstate, r2_t.stderr)
    assert sql(f"select internal_code_snapshot from public.saas_plan_versions where id = '{c01_ver}';") == "conc_c01_b"
    assert sql(f"select count(*) from public.saas_master_audit_logs where resource_id = '{c01_ver}' and action = 'saas_plan_version.draft_updated';") == "2"
    print(f"PASS C01 simultaneous draft edit & 55P03 lock_timeout ({det} | {det_t})")

    # ------------------------------------------------------------------
    # C02: Edit vs Publish (publish wins -> 23503; edit wins -> publishes updated)
    # ------------------------------------------------------------------
    c02a_plan, c02a_ver = create_draft_plan("conc_c02a", "Plano C02a", "100.00", '{"tier": "base"}')
    r1, r2, det_a = run_concurrent_pair(
        "c02a", 77003,
        master_1,
        f"select public.publish_saas_plan_version('{c02a_ver}');",
        master_2,
        f"select public.update_saas_plan_version_draft('{c02a_ver}', 'Tampered', 'conc_c02a_bad', 999.00, 'yearly', 0, 0, '2027-05-01', '{{\"tier\": \"tampered\"}}'::jsonb);",
    )
    assert r1.returncode == 0, r1.stderr
    assert r2.returncode != 0 and r2.sqlstate == "23503", (r2.sqlstate, r2.stderr)
    assert sql(f"select status || '|' || price::text || '|' || display_name_snapshot from public.saas_plan_versions where id = '{c02a_ver}';") == "published|100.00|Plano C02a"
    assert sql(f"select entitlement_value::text from public.saas_plan_version_entitlements where plan_version_id = '{c02a_ver}' and entitlement_key = 'tier';") == '"base"'
    assert sql(f"select string_agg(action, ',' order by id) from public.saas_master_audit_logs where resource_id = '{c02a_ver}';") == "saas_plan_version.draft_created,saas_plan_version.publish"

    c02b_plan, c02b_ver = create_draft_plan("conc_c02b", "Plano C02b Init", "100.00", '{"tier": "base"}')
    r1, r2, det_b = run_concurrent_pair(
        "c02b", 77004,
        master_1,
        f"select public.update_saas_plan_version_draft('{c02b_ver}', 'Plano C02b Final', 'conc_c02b_ok', 180.00, 'monthly', 7, 5, '2027-01-01', '{{\"tier\": \"pro\"}}'::jsonb);",
        master_2,
        f"select public.publish_saas_plan_version('{c02b_ver}');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert sql(f"select status || '|' || price::text || '|' || display_name_snapshot from public.saas_plan_versions where id = '{c02b_ver}';") == "published|180.00|Plano C02b Final"
    assert sql(f"select name || '|' || code from public.saas_plans where id = '{c02b_plan}';") == "Plano C02b Final|conc_c02b_ok"
    assert sql(f"select string_agg(action, ',' order by id) from public.saas_master_audit_logs where resource_id = '{c02b_ver}';") == (
        "saas_plan_version.draft_created,saas_plan_version.draft_updated,saas_plan_version.publish"
    )
    print(f"PASS C02 edit vs publish ({det_a} | {det_b})")

    # ------------------------------------------------------------------
    # C03: Simultaneous successor drafts (unique version_number + rollback safety)
    # ------------------------------------------------------------------
    c03_plan, c03_v1 = create_draft_plan("conc_c03", "Plano C03", "100.00", '{"rev": 1}')
    sql("begin; " + caller(master_1, "aal2") + f" select public.publish_saas_plan_version('{c03_v1}'); commit;")
    r1, r2, det_3a = run_concurrent_pair(
        "c03a", 77005,
        master_1,
        f"select public.create_saas_plan_successor_draft('{c03_plan}', 210.00, 'monthly', 0, 7, '2027-03-01', '{{\"rev\": 2}}'::jsonb);",
        master_2,
        f"select public.create_saas_plan_successor_draft('{c03_plan}', 260.00, 'yearly', 14, 10, '2027-04-01', '{{\"rev\": 3}}'::jsonb);",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    v2_id = r1.stdout.splitlines()[0]
    v3_id = r2.stdout.splitlines()[0]
    assert re.fullmatch(r"[0-9a-f-]{36}", v2_id) and re.fullmatch(r"[0-9a-f-]{36}", v3_id)
    assert v2_id != v3_id
    assert sql(
        f"select string_agg(version_number::text || ':' || status || ':' || price::text, ',' order by version_number) "
        f"from public.saas_plan_versions where plan_id = '{c03_plan}';"
    ) == "1:published:100.00,2:draft:210.00,3:draft:260.00"
    assert sql(
        f"select string_agg(resource_id || ':' || (metadata->>'version_number'), ',' order by id) "
        f"from public.saas_master_audit_logs where action = 'saas_plan_version.successor_draft' and (metadata->>'plan_id') = '{c03_plan}';"
    ) == f"{v2_id}:2,{v3_id}:3"

    # C03b: Rollback of S1 successor does not skip version_number or leave orphan audit
    r1, r2, det_3b = run_concurrent_pair(
        "c03b", 77006,
        master_1,
        f"select public.create_saas_plan_successor_draft('{c03_plan}', 280.00, 'monthly', 0, 7, '2027-05-01', '{{\"rev\": 99}}'::jsonb);",
        master_2,
        f"select public.create_saas_plan_successor_draft('{c03_plan}', 290.00, 'monthly', 0, 7, '2027-06-01', '{{\"rev\": 4}}'::jsonb);",
        s1_finish="rollback;",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    v4_id = r2.stdout.splitlines()[0]
    assert sql(
        f"select string_agg(version_number::text, ',' order by version_number) from public.saas_plan_versions where plan_id = '{c03_plan}';"
    ) == "1,2,3,4"
    assert sql(
        f"select count(*) from public.saas_master_audit_logs where action = 'saas_plan_version.successor_draft' and (metadata->>'plan_id') = '{c03_plan}';"
    ) == "3"
    assert sql(f"select count(*) from public.saas_plan_version_entitlements where entitlement_value = '99'::jsonb;") == "0"
    assert v4_id
    print(f"PASS C03 simultaneous successor drafts & rollback safety ({det_3a} | {det_3b})")

    # ------------------------------------------------------------------
    # C04: Draft edit vs active toggle (both directions preserve fields & active flag)
    # ------------------------------------------------------------------
    c04a_plan, c04a_ver = create_draft_plan("conc_c04a", "Plano C04a", "100.00")
    r1, r2, det_4a = run_concurrent_pair(
        "c04a", 77007,
        master_1,
        f"select public.update_saas_plan_version_draft('{c04a_ver}', 'Plano C04a Editado', 'conc_c04a_ed', 175.00, 'yearly', 10, 8, '2027-01-01', '{{\"k\": 1}}'::jsonb);",
        master_2,
        f"select public.set_saas_plan_active('{c04a_plan}', false, 'Desativar concorrente C04a');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert sql(
        f"select active::text || '|' || name || '|' || code || '|' || price::text || '|' || billing_interval "
        f"from public.saas_plans where id = '{c04a_plan}';"
    ) == "false|Plano C04a Editado|conc_c04a_ed|175.00|yearly"
    assert sql(
        f"select string_agg(action, ',' order by id) from public.saas_master_audit_logs "
        f"where resource_id in ('{c04a_plan}', '{c04a_ver}') and action in ('saas_plan_version.draft_updated', 'saas_plan.deactivate');"
    ) == "saas_plan_version.draft_updated,saas_plan.deactivate"

    c04b_plan, c04b_ver = create_draft_plan("conc_c04b", "Plano C04b", "100.00")
    r1, r2, det_4b = run_concurrent_pair(
        "c04b", 77008,
        master_1,
        f"select public.set_saas_plan_active('{c04b_plan}', false, 'Desativar antes de editar');",
        master_2,
        f"select public.update_saas_plan_version_draft('{c04b_ver}', 'Plano C04b Editado', 'conc_c04b_ed', 190.00, 'monthly', 5, 3, '2027-02-01', '{{\"k\": 2}}'::jsonb);",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert sql(
        f"select active::text || '|' || name || '|' || code || '|' || price::text "
        f"from public.saas_plans where id = '{c04b_plan}';"
    ) == "false|Plano C04b Editado|conc_c04b_ed|190.00"
    print(f"PASS C04 draft edit vs activation/deactivation ({det_4a} | {det_4b})")

    # ------------------------------------------------------------------
    # C05: Edit / Publish vs Delete unused plan (no orphans, no block bypass)
    # ------------------------------------------------------------------
    # C05a: update wins -> delete waits and removes updated unused plan cleanly
    c05a_plan, c05a_ver = create_draft_plan("conc_c05a", "Plano C05a", "100.00", '{"x": 1}')
    r1, r2, det_5a = run_concurrent_pair(
        "c05a", 77009,
        master_1,
        f"select public.update_saas_plan_version_draft('{c05a_ver}', 'C05a Atualizado', 'conc_c05a_ed', 130.00, 'monthly', 0, 7, '2027-01-01', '{{\"x\": 2}}'::jsonb);",
        master_2,
        f"select public.delete_saas_plan_if_unused('{c05a_plan}', 'Excluir C05a apos update');",
    )
    assert r1.returncode == 0 and r2.returncode == 0, (r1.stderr, r2.stderr)
    assert r2.stdout.strip() == "t"
    assert sql(f"select count(*) from public.saas_plans where id = '{c05a_plan}';") == "0"
    assert sql(f"select count(*) from public.saas_plan_versions where plan_id = '{c05a_plan}';") == "0"
    assert sql(f"select count(*) from public.saas_plan_version_entitlements where plan_version_id = '{c05a_ver}';") == "0"
    assert sql(
        f"select string_agg(action || ':' || coalesce(metadata->>'name', metadata->>'code'), ',' order by id) "
        f"from public.saas_master_audit_logs where resource_id in ('{c05a_plan}', '{c05a_ver}') "
        f"and action in ('saas_plan_version.draft_updated', 'saas_plan.delete_unused');"
    ) == "saas_plan_version.draft_updated:conc_c05a_ed,saas_plan.delete_unused:C05a Atualizado"

    # C05b: delete wins -> update waits and fails deterministically (23503), zero orphans
    c05b_plan, c05b_ver = create_draft_plan("conc_c05b", "Plano C05b", "100.00", '{"y": 1}')
    r1, r2, det_5b = run_concurrent_pair(
        "c05b", 77010,
        master_1,
        f"select public.delete_saas_plan_if_unused('{c05b_plan}', 'Excluir C05b antes de update');",
        master_2,
        f"select public.update_saas_plan_version_draft('{c05b_ver}', 'C05b Fantasma', 'conc_c05b_x', 333.00, 'monthly', 0, 7, '2027-01-01', '{{\"y\": 99}}'::jsonb);",
    )
    assert r1.returncode == 0 and r1.stdout.strip() == "t", r1.stderr
    assert r2.returncode != 0 and r2.sqlstate == "23503", (r2.sqlstate, r2.stderr)
    assert sql(f"select count(*) from public.saas_plans where id = '{c05b_plan}';") == "0"
    assert sql(f"select count(*) from public.saas_plan_versions where plan_id = '{c05b_plan}';") == "0"
    assert sql(f"select count(*) from public.saas_plan_version_entitlements where plan_version_id = '{c05b_ver}';") == "0"
    assert sql(
        f"select string_agg(action, ',' order by id) from public.saas_master_audit_logs where resource_id in ('{c05b_plan}', '{c05b_ver}');"
    ) == "saas_plan_version.draft_created,saas_plan.delete_unused"

    # C05c: publish wins -> concurrent delete is blocked deterministically (55000) without bypass
    c05c_plan, c05c_ver = create_draft_plan("conc_c05c", "Plano C05c", "100.00", '{"z": 1}')
    r1, r2, det_5c = run_concurrent_pair(
        "c05c", 77011,
        master_1,
        f"select public.publish_saas_plan_version('{c05c_ver}');",
        master_2,
        f"select public.delete_saas_plan_if_unused('{c05c_plan}', 'Excluir C05c bloqueado por publish');",
    )
    assert r1.returncode == 0, r1.stderr
    assert r2.returncode != 0 and r2.sqlstate == "55000", (r2.sqlstate, r2.stderr)
    assert sql(f"select status from public.saas_plan_versions where id = '{c05c_ver}';") == "published"
    assert sql(f"select count(*) from public.saas_plans where id = '{c05c_plan}';") == "1"
    assert sql(
        f"select count(*) from public.saas_master_audit_logs where resource_id = '{c05c_plan}' and action = 'saas_plan.delete_unused';"
    ) == "0"
    print(f"PASS C05 edit/publish vs delete unused ({det_5a} | {det_5b} | {det_5c})")

    # Global post-run relational and audit integrity checks
    assert sql(
        "select count(*) from public.saas_plan_version_entitlements e "
        "left join public.saas_plan_versions v on v.id = e.plan_version_id where v.id is null;"
    ) == "0"
    assert sql(
        "select count(*) from public.saas_plan_versions v "
        "left join public.saas_plans p on p.id = v.plan_id where p.id is null;"
    ) == "0"
    assert sql(
        "select count(*) from public.saas_master_audit_logs "
        "where staff_user_id is null or length(btrim(action)) = 0;"
    ) == "0"
    print("PASS global post-concurrency relational & audit integrity")


if __name__ == "__main__":
    main()
