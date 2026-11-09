"""M01.03 gate using the disposable onboarding PostgreSQL fixture."""
from concurrent.futures import ThreadPoolExecutor
import time

def check(sql, source, table, extract, caller, uid):
    foundation = source("202609040001")
    platform = source("202609080006")
    control = source("v33_saas_control_plane")
    sql("\n".join([
        "alter table auth.users add column invited_at timestamptz, add column email_confirmed_at timestamptz;",
        table(foundation, "roles"), table(foundation, "user_roles"),
        table(platform, "saas_terms_versions"), table(platform, "saas_terms_acceptances"),
        extract(control, r"alter table public.saas_terms_versions\s+add column", ";"),
        extract(platform, "create trigger saas_terms_acceptances_immutable", ";"),
    ]))
    lines = source("v35_onboarding_acceptance").strip().splitlines()
    assert lines[0] == "begin;" and lines[-1] == "commit;"
    body = "\n".join(lines[1:-1])
    present = "select to_regprocedure('public.accept_onboarding_invite(uuid,uuid,text,boolean)') is not null;"
    assert sql("begin;\n" + body + "\n" + present + "rollback;" + present) == "t\nf"
    sql("begin;\n" + body + "\ncommit;")

    user, stranger, org, other_org, role, other_role, run, job, version, expired = map(uid, range(901, 911))
    operator = uid(1)
    sql(f"""
    insert into auth.users(id,email,invited_at,email_confirmed_at) values
      ('{user}','m0103@example.test',now(),null),
      ('{stranger}','other-m0103@example.test',now(),now());
    insert into organizations values ('{org}'), ('{other_org}');
    insert into roles(id,organization_id,code,name,is_system) values
      ('{role}','{org}','ADMIN','Admin',true), ('{other_role}','{other_org}','ADMIN','Admin',true);
    insert into saas_terms_versions(id,document_type,version,document_hash,effective_at,valid_to) values
      ('{version}','terms','m0103-current','current-hash',now()-interval '1 day',null),
      ('{expired}','terms','m0103-expired','old-hash',now()-interval '3 days',now()-interval '2 days');
    insert into saas_onboarding_runs(id,status,current_step,organization_id,invite_email,initial_role,idempotency_key,created_by)
      values ('{run}','awaiting_invite','invite','{org}','m0103@example.test','ADMIN','m0103','{operator}');
    insert into saas_jobs(id,organization_id,job_type,status,attempts,idempotency_key,correlation_id)
      values ('{job}','{org}','onboarding_invite','running',1,'onboarding-invite:{run}','{run}');
    insert into saas_onboarding_step_events(onboarding_run_id,step,event_type,sanitized_summary,actor_user_id)
      values ('{run}','invite','started','{{"job_id":"{job}"}}','{operator}');
    """)
    def finish(identity):
        return f"select public.finish_onboarding_invite_with_identity('{job}','{operator}','{identity}');"
    def accept(terms=version, digest="current-hash", consent="true"):
        return f"select public.accept_onboarding_invite('{run}','{terms}','{digest}',{consent});"

    sql("set role authenticated;" + finish(user), succeeds=False)
    sql("set role service_role;" + finish(stranger), succeeds=False, error_code="22023")
    assert sql(f"select status from saas_jobs where id='{job}';") == "running"
    assert sql("set role service_role;" + finish(user)) == "t"
    sql("set role anon;" + accept(), succeeds=False)
    sql(caller(stranger, "aal2") + accept(), succeeds=False)
    sql(caller(user, "aal1") + accept(), succeeds=False)
    sql(f"update auth.users set email_confirmed_at=now() where id='{user}';")
    for attempt in (accept(consent="false"), accept(expired, "old-hash"), accept(digest="wrong")):
        sql(caller(user, "aal1") + attempt, succeeds=False, error_code="22023")
    assert sql(f"select count(*) from user_roles where user_id='{user}';") == "0"

    def wait_for(app, condition):
        for _ in range(65):
            if sql(f"select count(*) from pg_stat_activity where application_name='{app}' and {condition};") == "1":
                return
            time.sleep(0.05)
        raise AssertionError(f"Concurrent session {app} did not reach expected state")

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(sql, "begin;" + caller(user, "aal1") + accept() + "select pg_sleep(5);commit;", "accept-first")
        wait_for("accept-first", "wait_event='PgSleep'")
        second = pool.submit(sql, caller(user, "aal1") + accept(), "accept-second")
        wait_for("accept-second", "wait_event_type='Lock'")
        assert first.result() == second.result() == org

    assert sql(caller(user, "aal1") + accept()) == org
    sql(caller(user, "aal1") + accept(digest="wrong"), succeeds=False, error_code="22023")
    assert sql(f"select organization_id || ':' || role_id from user_roles where user_id='{user}';") == f"{org}:{role}"
    assert sql(f"select terms_version_id from saas_terms_acceptances where user_id='{user}';") == version
    assert sql(f"select count(*) from saas_onboarding_step_events where onboarding_run_id='{run}' and step='completed' and actor_user_id='{user}' and sanitized_summary::text not like '%@%';") == "1"
    assert sql(f"select status from saas_onboarding_runs where id='{run}';") == "completed"
    print("PASS M01.03 PostgreSQL rollback, identity, permissions, terms, tenant scope, concurrent replay and audit")
