"""Disposable PostgreSQL gate. Connection is restricted to the CI service."""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import time

root = Path(__file__).resolve().parents[1]
migrations = root / "supabase/migrations"

def source(fragment):
    path, = migrations.glob(f"*{fragment}*.sql")
    return path.read_text(encoding="utf-8")

def extract(source_text, start, end):
    matches = re.findall(start + r".*?" + end, source_text, re.S)
    value, = matches
    return value

def sql(query, app="invite-gate", succeeds=True, error_code="42501"):
    result = subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
         "-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "onboarding_gate"],
        input=query, text=True, capture_output=True, timeout=25,
        env={**os.environ, "PGAPPNAME": app, "PGPASSWORD": "onboarding-ci"},
    )
    if succeeds:
        assert result.returncode == 0, result.stderr
        return result.stdout.strip()
    assert result.returncode != 0 and error_code in result.stderr, result.stderr

def table(src, name):
    return extract(src, rf"create table public\.{name} \(", r"\n\);")

def function(src, name):
    return extract(src, rf"create or replace function private\.{name}\(", r"\$\$;")

v33 = source("v33_saas_control_plane")
v34 = source("v34_master_operations")
foundation = source("202609040001")
core = source("202609040002")
v32 = source("202609080006")
fixture = [
    """create role anon; create role authenticated; create role service_role;
    create schema private; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.organizations(id uuid primary key);
    create table public.saas_plan_versions(id uuid primary key);""",
    function(foundation, "set_updated_at"),
    function(core, "prevent_financial_mutation"),
    table(v32, "platform_staff"),
    *(function(v33, name) for name in ("has_aal2", "is_platform_staff", "require_platform_staff")),
    table(v33, "saas_jobs"),
    *(table(v34, name) for name in ("saas_onboarding_runs", "saas_onboarding_step_events")),
    extract(v34, r"alter table public.saas_jobs\s+drop constraint", r"'onboarding_invite'\s*\)\);"),
    extract(v33, "create trigger saas_jobs_set_updated_at", ";"),
    extract(v34, "create trigger saas_onboarding_runs_set_updated_at", ";"),
    extract(v34, "create trigger saas_onboarding_step_events_immutable", ";"),
]
assert sql("select current_database() || ':' || current_user") == "onboarding_gate:postgres"
sql("\n".join(fixture))

migration = source("v35_onboarding_invite_consumer").strip().splitlines()
assert migration[0].strip().lower() == "begin;" and migration[-1].strip().lower() == "commit;"
body = "\n".join(migration[1:-1])
assert not re.search(r"(?im)^\s*(commit|rollback|start\s+transaction)\s*;", body)
exists = "select to_regprocedure('public.claim_onboarding_invite(uuid,uuid)') is not null;"
assert sql("begin;\n" + body + "\n" + exists + "\nrollback;\n" + exists) == "t\nf"
print("PASS migration DDL rolled back")
# Independent multiconnection test uses only the disposable CI database.
sql("begin;\n" + body + "\ncommit;")

def uid(n):
    return f"00000000-0000-4000-8000-{n:012d}"

master, support, other_master = (uid(n) for n in (1, 2, 3))
orgs = [uid(11), uid(12)]
runs = [uid(n) for n in range(21, 26)]
emails = ["new@example.test", "NEW@example.test", "existing@example.test",
          "lost@example.test", "unrelated@example.test"]
jobs = [uid(n) for n in range(31, 36)]
sql(f"""
insert into auth.users values ('{master}', 'master@example.test'),
 ('{support}', 'existing@example.test'), ('{other_master}', 'other-master@example.test');
insert into platform_staff(user_id, role) values ('{master}', 'MASTER'),
 ('{support}', 'SUPPORT'), ('{other_master}', 'MASTER');
insert into organizations values ('{orgs[0]}'), ('{orgs[1]}');
""")
for i, (run, job, email) in enumerate(zip(runs, jobs, emails)):
    org = orgs[int(i > 0)]
    sql(f"""
    insert into saas_onboarding_runs(id,status,current_step,organization_id,invite_email,idempotency_key,created_by)
      values ('{run}','awaiting_invite','invite','{org}','{email}','{run}','{master}');
    insert into saas_jobs(id,organization_id,job_type,idempotency_key,correlation_id,sanitized_payload)
      values ('{job}','{org}','onboarding_invite','onboarding-invite:{run}','{run}',
              '{{"onboarding_run_id":"{run}"}}');
    """)

def caller(user, aal):
    claims = json.dumps({"sub": user, "aal": aal})
    return f"set role authenticated; set request.jwt.claims = '{claims}';"

authorize = "select public.authorize_onboarding_invite_dispatch();"
claim = lambda i, actor=master: f"select job_id from public.claim_onboarding_invite('{runs[i]}','{actor}');"
finish = lambda i, actor, accepted: f"select public.finish_onboarding_invite('{jobs[i]}','{actor}',{accepted});"
for role in ("anon", "authenticated"):
    sql(f"set role {role};" + claim(4), succeeds=False)
    sql(f"set role {role};" + finish(4, master, "true"), succeeds=False)
sql("set role anon;" + authorize, succeeds=False)
sql(caller(master, "aal1") + authorize, succeeds=False)
sql(caller(support, "aal2") + authorize, succeeds=False)
assert sql(caller(master, "aal2") + authorize) == master
server = "set role service_role;"
sql(server + claim(4, support), succeeds=False)
print("PASS Master/AAL2 and RPC permissions")

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    first = pool.submit(sql, server + "begin;" + claim(0) + "select pg_sleep(5);commit;", "invite-first")
    def wait_for(query, expected):
        for _ in range(80):
            if sql(query) == expected:
                return
            time.sleep(0.05)
        raise AssertionError("Expected concurrent PostgreSQL state was not observed")
    wait_for("select count(*) from pg_stat_activity where application_name='invite-first' and wait_event='PgSleep';", "1")
    same = pool.submit(sql, server + claim(0), "invite-same")
    duplicate = pool.submit(sql, server + claim(1), "invite-duplicate")
    wait_for("select count(*) from pg_stat_activity where application_name in ('invite-same','invite-duplicate') and wait_event_type='Lock';", "2")
    assert first.result() == jobs[0]
    assert same.result() == duplicate.result() == ""

assert sql(server + claim(2)) == ""
assert sql(server + finish(0, other_master, "true")) == "f"
assert sql(server + finish(0, master, "true")) == "t"
assert sql(server + finish(0, master, "true")) == "f"
assert sql(server + claim(0)) == ""
assert sql(server + claim(3)) == jobs[3]
assert sql(server + claim(3)) == ""  # finalization response lost
assert sql(server + finish(3, master, "false")) == "t"
assert sql(server + claim(3)) == ""
assert sql("select status || ':' || coalesce(last_error_code,'') from saas_jobs order by id;").splitlines() == [
    "succeeded:", "failed:invite_recipient_reserved", "failed:invite_existing_account",
    "failed:invite_outcome_unknown", "queued:",
]
assert sql("""select count(*) from saas_onboarding_step_events
where sanitized_summary::text like '%@%' or
  sanitized_summary - 'job_id' - 'outcome' <> '{}'::jsonb;""") == "0"
assert sql("select count(*) from saas_onboarding_step_events;") == "6"
assert sql("select count(*) from saas_onboarding_runs where status <> 'awaiting_invite';") == "0"
print("PASS two concurrent blocked claimants, deduplication, replay, finalization and sanitized audit")


# M01.02: rollback boundary first, then test new functions in disposable PG only.
reconciliation = source("v35_onboarding_invite_reconciliation").strip().splitlines()
assert reconciliation[0].strip().lower() == "begin;" and reconciliation[-1].strip().lower() == "commit;"
reconciliation_body = "\n".join(reconciliation[1:-1])
assert not re.search(r"(?im)^\s*(commit|rollback|start\s+transaction)\s*;", reconciliation_body)
reconcile_exists = "select to_regprocedure('public.expire_onboarding_invite_claims(integer)') is not null;"
assert sql("begin;\n" + reconciliation_body + "\n" + reconcile_exists +
           "\nrollback;\n" + reconcile_exists) == "t\nf"
sql("begin;\n" + reconciliation_body + "\ncommit;")
print("PASS reconciliation migration DDL rollback")

reconcile_list = "select count(*) from public.list_onboarding_invite_reconciliation(25);"
expire = "select public.expire_onboarding_invite_claims(25);"
observation_id = uid(81)
observe = lambda job, id, code: (
    f"select public.observe_onboarding_invite_reconciliation('{job}','{id}','{code}');"
)
for role in ("anon",):
    sql(f"set role {role};" + reconcile_list, succeeds=False)
    sql(f"set role {role};" + expire, succeeds=False)
    sql(f"set role {role};" + observe(jobs[3], observation_id, "review_pending"),
        succeeds=False)
sql(caller(master, "aal1") + reconcile_list, succeeds=False)
sql(caller(support, "aal2") + expire, succeeds=False)
sql(caller(support, "aal2") + observe(jobs[3], observation_id, "review_pending"),
    succeeds=False)
assert sql("""select
 has_function_privilege('anon','public.list_onboarding_invite_reconciliation(integer)','EXECUTE')::text
 || '|' ||
 has_function_privilege('authenticated','public.list_onboarding_invite_reconciliation(integer)','EXECUTE')::text
 || '|' ||
 has_function_privilege('anon','public.expire_onboarding_invite_claims(integer)','EXECUTE')::text
 || '|' ||
 has_function_privilege('authenticated','public.expire_onboarding_invite_claims(integer)','EXECUTE')::text;""") == "false|true|false|true"
sql(caller(master, "aal2") +
    "select public.list_onboarding_invite_reconciliation(0);",
    succeeds=False, error_code="22023")
print("PASS reconciliation Master/AAL2 grants and parameter guards")

# One stale in-flight claim, one fresh claim, both reserve attempts and email.
stale_run, fresh_run = uid(61), uid(62)
stale_job, fresh_job = uid(71), uid(72)
for run, job, email, delay in [
    (stale_run, stale_job, "stale@example.test", "20 minutes"),
    (fresh_run, fresh_job, "fresh@example.test", "1 minute"),
]:
    sql(f"""
    insert into saas_onboarding_runs(
      id,status,current_step,organization_id,invite_email,idempotency_key,created_by
    ) values (
      '{run}','awaiting_invite','invite','{orgs[1]}','{email}','{run}','{master}'
    );
    insert into saas_jobs(
      id,organization_id,job_type,status,attempts,locked_at,
      idempotency_key,correlation_id,sanitized_payload,last_error_code
    ) values (
      '{job}','{orgs[1]}','onboarding_invite','running',1,
      now() - interval '{delay}','onboarding-invite:{run}','{run}',
      '{{"onboarding_run_id":"{run}"}}','invite_outcome_unknown'
    );
    insert into saas_onboarding_step_events(
      onboarding_run_id,step,event_type,sanitized_summary,actor_user_id
    ) values (
      '{run}','invite','started','{{"job_id":"{job}","outcome":"reserved"}}','{master}'
    );
    """)

# Auth existence is an observation only, not confirmation of delivery.
sql(f"insert into auth.users values ('{uid(80)}','stale@example.test');")
assert sql(caller(master, "aal2") + reconcile_list) == "3"  # failed unknown + 2 running
assert sql(caller(master, "aal2") +
           f"select auth_user_present::text from public.list_onboarding_invite_reconciliation(25) where job_id='{stale_job}';") == "true"
assert sql(caller(master, "aal2") + expire) == "1"
assert sql(caller(master, "aal2") + expire) == "0"
assert sql(f"select status || ':' || attempts || ':' || last_error_code from saas_jobs where id='{stale_job}';") == (
    "failed:1:invite_outcome_unknown"
)
assert sql(f"select status || ':' || attempts from saas_jobs where id='{fresh_job}';") == "running:1"
assert sql(server + f"select count(*) from public.claim_onboarding_invite('{stale_run}','{master}');") == "0"
assert sql(caller(master, "aal2") +
           f"select stale::text from public.list_onboarding_invite_reconciliation(25) where job_id='{fresh_job}';") == "false"
print("PASS stale-only expiry, repeated invocation, reservation preserved, no retry")

# Auditable, idempotent observation; a changed note cannot recycle the same request ID.
baseline_events = int(sql("select count(*) from public.saas_onboarding_step_events;"))
assert sql(caller(master, "aal2") + observe(stale_job, observation_id, "auth_checked")) == "t"
assert sql(caller(master, "aal2") + observe(stale_job, observation_id, "auth_checked")) == "t"
sql(caller(master, "aal2") + observe(stale_job, observation_id, "provider_checked"),
    succeeds=False, error_code="22023")
assert sql(caller(master, "aal2") + observe(fresh_job, uid(82), "review_pending")) == "f"
assert sql("select count(*) from public.saas_onboarding_step_events;") == str(baseline_events + 1)
assert sql(f"""select sanitized_summary->>'auth_user_present'
 from public.saas_onboarding_step_events
 where sanitized_summary->>'request_id' = '{observation_id}';""") == "true"
assert sql("""select count(*) from public.saas_onboarding_step_events
 where sanitized_summary::text like '%@%';""") == "0"
assert sql(f"select attempts from saas_jobs where id='{stale_job}';") == "1"
print("PASS immutable sanitized observations, idempotency, no recipient disclosure")

from check_onboarding_acceptance_pg import check as check_acceptance
check_acceptance(sql, source, table, extract, caller, uid)
