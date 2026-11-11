"""Read authorization gate using the existing disposable onboarding fixture."""

def check(sql, source, extract, uid, caller, master, support, orgs):
    migration = source("v35_jobs_read_aal2").strip().splitlines()
    assert migration[0] == "begin;" and migration[-1] == "commit;"
    policy = extract(source("v33_saas_control_plane"), "create policy saas_jobs_platform_select", ";")
    org_a, org_b = orgs
    tenant = uid(880)
    prefix = f"""
    begin;
    grant usage on schema auth, private to authenticated;
    alter table public.saas_jobs enable row level security;
    {policy}
    grant select on public.saas_jobs to authenticated;
    alter role service_role bypassrls;
    grant select, insert, update on public.saas_jobs to service_role;
    insert into auth.users values ('{tenant}', 'tenant-jobs@example.test');
    insert into public.saas_jobs(id,organization_id,job_type,idempotency_key,created_at,status)
    select ('00000000-0000-4000-8000-' || lpad((900+n)::text,12,'0'))::uuid,
      '{org_a}', 'generate_invoice', 'job-gate-' || n, '2030-01-01', 'failed'
    from generate_series(1,27) n;
    insert into public.saas_jobs(id,organization_id,job_type,idempotency_key,created_at,status)
    values ('{uid(999)}','{org_b}','generate_invoice','job-gate-b','2030-01-01','failed');
    """ + "\n".join(migration[1:-1]) + "\n"
    def run(query, expected=None, code=None):
        out = sql(prefix + query + "\nrollback;", succeeds=code is None, error_code=code or "42501")
        if code is None:
            assert out == expected, out

    table = "public.saas_jobs"
    for user, aal in ((master,"aal1"),(master,""),(support,"aal2"),(tenant,"aal2")):
        run(caller(user,aal)+f"select count(id) from {table};", "0")
    run("set role anon;"+f"select id from {table};", code="42501")

    master_aal2 = caller(master,"aal2")
    fields = "id,organization_id,job_type,status,attempts,max_attempts,last_error_code,created_at,locked_at,completed_at"
    scoped = f"from {table} where organization_id='{org_a}' and status='failed' and job_type='generate_invoice'"
    order = "order by created_at desc,id desc"
    run(master_aal2+f"select count(id) from (select {fields} {scoped} {order} limit 26) page;", "26")
    run(master_aal2+f"select id {scoped} and (created_at,id)<('2030-01-01','{uid(903)}') {order} limit 26;",
        uid(902)+"\n"+uid(901))
    run(master_aal2+f"select id from {table} where organization_id='{org_b}' and id='{uid(999)}';", uid(999))
    for column in ("sanitized_payload","idempotency_key","correlation_id","*"):
        run(master_aal2+f"select {column} from {table};", code="42501")
    run(master_aal2+f"update {table} set status='running';", code="42501")
    run(f"""set role service_role;
    insert into {table}(id,job_type,idempotency_key,sanitized_payload)
    values ('{uid(881)}','generate_invoice','internal-fixture','{{"marker":true}}');
    update {table} set status='running' where id='{uid(881)}';
    select status || ':' || (sanitized_payload->>'marker') from {table} where id='{uid(881)}';
    """, "running:true")
    assert sql(f"select count(id) from {table} where id='{uid(999)}';") == "0"
    print("PASS job policy AAL2, cursor ties, tenant filter, sensitive columns, internal worker and rollback")
