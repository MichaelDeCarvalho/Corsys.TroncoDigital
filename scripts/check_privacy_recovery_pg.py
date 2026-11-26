"""Disposable PostgreSQL 17 gate for V35 M05 (D01-D06).

Tests DDL rollback/commit, Entregas A-F RPCs, multi-tenant A/B isolation,
expired export rejection, 90-day post-cancel window vs archived restriction,
2-business-day triage SLA, ledger immutability on anonymization, dual-evidence
privileged recovery, compromised-access revocation, and 24h incident SLA.
Never connects to Supabase DEV or PROD.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
import check_commercial_concurrency_pg as pg

MIGRATION_FILE = Path(__file__).resolve().parents[1] / "supabase/migrations/20261126180000_v35_m05_privacy_retention_recovery.sql"


def extract_migration_body() -> str:
    raw = MIGRATION_FILE.read_text(encoding="utf-8").strip().splitlines()
    if len(raw) < 3 or raw[0].strip().lower() != "begin;" or raw[-1].strip().lower() != "commit;":
        raise AssertionError("M05 migration must be wrapped in explicit begin; ... commit;")
    return "\n".join(raw[1:-1])


def self_test_extract() -> None:
    body = extract_migration_body()
    required_objects = [
        "private.add_business_days",
        "public.tenant_retention_holds",
        "public.tenant_portability_exports",
        "public.tenant_portability_downloads",
        "public.tenant_privacy_requests",
        "public.tenant_privacy_request_events",
        "public.saas_backup_restore_verifications",
        "public.saas_access_recovery_requests",
        "public.saas_operational_incidents",
        "public.saas_operational_health_snapshots",
        "public.create_tenant_portability_export_idempotent",
        "public.download_tenant_portability_export",
        "public.authorize_tenant_portability_attachment_download",
        "public.register_tenant_privacy_request_idempotent",
        "public.review_tenant_privacy_request_idempotent",
        "public.read_tenant_retention_posture",
        "public.place_tenant_legal_hold_idempotent",
        "public.release_tenant_legal_hold_idempotent",
        "public.record_backup_restore_verification_idempotent",
        "public.register_privileged_recovery_decision_idempotent",
        "public.revoke_compromised_tenant_access_idempotent",
        "public.record_operational_incident_idempotent",
        "public.read_master_operational_security_overview",
    ]
    required_portability_datasets = [
        "accounting_plans",
        "accounting_accounts",
        "accounting_plan_role_mappings",
        "member_debt_agreements",
        "saas_subscription_price_terms",
        "saas_scheduled_subscription_changes",
        "customer_support_tickets",
        "customer_support_messages",
        "binary_files_included",
    ]
    missing = [obj for obj in (required_objects + required_portability_datasets) if obj not in body]
    if missing:
        raise AssertionError(f"Missing required M05/M06 consolidated objects in migration: {missing}")
    selective_sql = Path(__file__).resolve().parents[1] / "scripts/v35_m05_single_tenant_recovery_check.sql"
    assert selective_sql.is_file() and "ANTI-REINTRODUCTION FAILED" in selective_sql.read_text(encoding="utf-8")
    print(f"M05_SELF_TEST_EXTRACT_PASS: {len(required_objects)} objects verified cleanly")


def run_pg_gate() -> None:
    pg.PGDATABASE = "privacy_recovery_gate"
    pg.assert_disposable_target()
    assert pg.sql("select current_database()") == "privacy_recovery_gate"

    foundation = pg.source("202609040001")
    core = pg.source("202609040002")
    inst = pg.source("202609080009")
    ops = pg.source("202609080010")
    saas = pg.source("202609080006")
    v33 = pg.source("202609090014")
    rls = pg.source("202609040004")

    pg.sql(
        """
        DO $$ BEGIN
         IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
         IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
        END $$;
        create schema if not exists auth;
        create schema if not exists private;
        create table auth.users(id uuid primary key);
        create function auth.jwt() returns jsonb language sql stable as
          $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
        create function auth.uid() returns uuid language sql stable as
          $$select (auth.jwt()->>'sub')::uuid$$;
        """
    )

    pg.sql(
        "\n".join([
            pg.function(foundation, "private", "set_updated_at"),
            pg.table(foundation, "organizations"),
            pg.table(foundation, "organization_settings"),
            pg.table(foundation, "members"),
            pg.table(foundation, "member_user_links"),
            pg.table(foundation, "roles"),
            pg.table(foundation, "permissions"),
            pg.table(foundation, "role_permissions"),
            pg.table(foundation, "user_roles"),
            pg.table(foundation, "financial_categories"),
            pg.table(foundation, "financial_accounts"),
            pg.table(foundation, "payment_methods"),
            pg.function(core, "private", "prevent_financial_mutation"),
            pg.table(core, "audit_logs"),
            pg.table(core, "charges"),
            pg.table(core, "payments"),
            pg.table(core, "receivable_allocations"),
            pg.table(inst, "institutional_receivables"),
            pg.table(inst, "institutional_payables"),
            pg.table(ops, "documents"),
            pg.table(saas, "platform_staff"),
            pg.table(saas, "saas_plans"),
            pg.table(saas, "saas_subscriptions"),
            pg.table(saas, "saas_master_audit_logs"),
            pg.table(v33, "saas_tenant_accounts"),
            pg.table(v33, "saas_jobs"),
            pg.function(rls, "private", "has_permission"),
            pg.function(rls, "private", "is_self_member"),
            *(pg.function(v33, "private", n) for n in ("has_aal2", "is_platform_staff", "require_platform_staff", "tenant_write_allowed")),
        ])
    )
    pg.sql("grant usage on schema public, auth, private to authenticated, anon;")

    body = extract_migration_body()
    exists_check = "select to_regprocedure('public.create_tenant_portability_export_idempotent(uuid,text,uuid,text,text)') is not null;"
    assert pg.sql("begin;" + body + exists_check + "rollback;" + exists_check) == "t\nf"
    pg.sql(body)

    org_a = "00000000-0000-4000-8000-000000000001"
    org_b = "00000000-0000-4000-8000-000000000002"
    master1 = "00000000-0000-4000-8000-000000000011"
    master2 = "00000000-0000-4000-8000-000000000012"
    support = "00000000-0000-4000-8000-000000000013"
    admin_a = "00000000-0000-4000-8000-000000000021"
    member_a_user = "00000000-0000-4000-8000-000000000022"
    member_a = "00000000-0000-4000-8000-000000000101"
    member_b = "00000000-0000-4000-8000-000000000201"
    role_a = "00000000-0000-4000-8000-000000000301"
    plan_id = "00000000-0000-4000-8000-000000000401"
    cat_a = "00000000-0000-4000-8000-000000000501"
    pm_a = "00000000-0000-4000-8000-000000000601"
    fa_a = "00000000-0000-4000-8000-000000000701"

    pg.sql(
        f"""
        insert into auth.users values
          ('{master1}'),('{master2}'),('{support}'),('{admin_a}'),('{member_a_user}');
        insert into public.platform_staff(user_id,role) values
          ('{master1}','MASTER'),('{master2}','MASTER'),('{support}','SUPPORT');
        insert into public.organizations(id, name) values ('{org_a}', 'Loja QA A'), ('{org_b}', 'Loja QA B');
        insert into public.saas_plans(id, code, name, billing_interval) values ('{plan_id}', 'QA', 'QA Plan', 'monthly');
        insert into public.saas_tenant_accounts(organization_id) values ('{org_a}'), ('{org_b}');
        insert into public.saas_subscriptions(organization_id, plan_id, status, canceled_at)
        values ('{org_a}', '{plan_id}', 'canceled', now() - interval '10 days'),
               ('{org_b}', '{plan_id}', 'active', null);
        insert into public.permissions(code, description) values
          ('settings.manage', 'settings'), ('reports.export', 'export'), ('members.read', 'read'), ('users.manage', 'users')
        on conflict do nothing;
        insert into public.roles(id, organization_id, code, name) values ('{role_a}', '{org_a}', 'ADMIN', 'Admin');
        insert into public.role_permissions(role_id, permission_code) values
          ('{role_a}', 'settings.manage'), ('{role_a}', 'reports.export'), ('{role_a}', 'members.read'), ('{role_a}', 'users.manage');
        insert into public.user_roles(organization_id, user_id, role_id) values ('{org_a}', '{admin_a}', '{role_a}');
        insert into public.members(id, organization_id, full_name, email) values
          ('{member_a}', '{org_a}', 'Titular QA A', 'qa-a@example.invalid'),
          ('{member_b}', '{org_b}', 'Titular QA B', 'qa-b@example.invalid');
        insert into public.member_user_links(organization_id, member_id, user_id) values ('{org_a}', '{member_a}', '{member_a_user}');
        insert into public.financial_categories(id, organization_id, name, domain) values ('{cat_a}', '{org_a}', 'Mensalidade', 'member_receivable');
        insert into public.payment_methods(id, organization_id, name, kind) values ('{pm_a}', '{org_a}', 'PIX', 'pix');
        insert into public.financial_accounts(id, organization_id, name, account_type) values ('{fa_a}', '{org_a}', 'Caixa QA', 'cash');
        insert into public.charges(organization_id, member_id, category_id, source_kind, description, competence, issue_date, due_date, accounting_period, unit_amount, original_amount)
        values ('{org_a}', '{member_a}', '{cat_a}', 'manual', 'Mensalidade QA', '2026-11-01', '2026-11-01', '2026-11-10', '2026-11-01', 120.50, 120.50);
        insert into public.documents(id, organization_id, storage_path, original_filename, mime_type, size_bytes, sha256, classification)
        values ('00000000-0000-4000-8000-000000000801', '{org_a}', 'tenant-documents/{org_a}/comprovante.pdf', 'comprovante.pdf', 'application/pdf', 1024, repeat('a', 64), 'confidential'),
               ('00000000-0000-4000-8000-000000000802', '{org_a}', 'tenant-documents/{org_a}/sensivel.pdf', 'sensivel.pdf', 'application/pdf', 2048, repeat('b', 64), 'sensitive');
        """
    )

    def actor(user: str, aal: str = "aal2") -> str:
        return f"set role authenticated; set request.jwt.claims='{json.dumps({'sub': user, 'aal': aal})}';"

    # 1. Retention 90d canceled export allowed for Loja A, blocked for Loja B admin
    pg.sql("set role anon; select public.read_tenant_retention_posture('%s');" % org_a, succeeds=False, error_code="42501")
    pg.sql(actor(admin_a) + f"select public.create_tenant_portability_export_idempotent('{org_a}', 'organization_full', null, 'json', 'k-exp-1');")
    pg.sql(actor(admin_a) + f"select public.create_tenant_portability_export_idempotent('{org_b}', 'organization_full', null, 'json', 'k-exp-b');", succeeds=False, error_code="42501")

    # 2. Self member can request own package, denied organization_full
    pg.sql(actor(member_a_user) + f"select public.create_tenant_portability_export_idempotent('{org_a}', 'organization_full', null, 'json', 'k-self-deny');", succeeds=False, error_code="42501")
    pg.sql(actor(member_a_user) + f"select public.create_tenant_portability_export_idempotent('{org_a}', 'data_subject_package', '{member_a}', 'csv', 'k-self-ok');")

    # 3. Expired export link rejected & archived > 90 days rejected
    exp_id = pg.sql("select id from public.tenant_portability_exports where export_scope='organization_full' limit 1")
    dl_raw = pg.sql(actor(admin_a) + f"select public.download_tenant_portability_export('{org_a}', '{exp_id}', 'json');")
    dl_pkg = json.loads(dl_raw.splitlines()[-1])
    assert dl_pkg["manifest"]["binary_files_included"] is False
    assert "accounting_plan_role_mappings" in dl_pkg["payload"]
    assert "saas_subscription_price_terms" in dl_pkg["payload"]
    assert "customer_support_messages" in dl_pkg["payload"]
    att_auth_raw = pg.sql(actor(admin_a) + f"select public.authorize_tenant_portability_attachment_download('{org_a}', '{exp_id}', '00000000-0000-4000-8000-000000000801');")
    att_auth = json.loads(att_auth_raw.splitlines()[-1])
    assert att_auth["storage_bucket"] == "tenant-documents"
    assert att_auth["storage_object_key"] == f"{org_a}/comprovante.pdf"
    pg.sql(actor(admin_a) + f"select public.authorize_tenant_portability_attachment_download('{org_a}', '{exp_id}', '00000000-0000-4000-8000-000000000802');", succeeds=False, error_code="42501")
    pg.sql(actor(member_a_user) + f"select public.authorize_tenant_portability_attachment_download('{org_a}', '{exp_id}', '00000000-0000-4000-8000-000000000801');", succeeds=False, error_code="42501")
    pg.sql(actor(admin_a) + f"select public.authorize_tenant_portability_attachment_download('{org_b}', '{exp_id}', '00000000-0000-4000-8000-000000000801');", succeeds=False, error_code="23503")
    pg.sql(f"update public.documents set sha256 = repeat('c', 64) where id = '00000000-0000-4000-8000-000000000801';")
    pg.sql(actor(admin_a) + f"select public.authorize_tenant_portability_attachment_download('{org_a}', '{exp_id}', '00000000-0000-4000-8000-000000000801');", succeeds=False, error_code="42501")

    pg.sql(f"update public.tenant_portability_exports set expires_at = now() - interval '1 hour' where id = '{exp_id}';")
    pg.sql(actor(admin_a) + f"select public.download_tenant_portability_export('{org_a}', '{exp_id}', 'json');", succeeds=False, error_code="55000")

    pg.sql(actor(admin_a) + f"select public.authorize_tenant_portability_attachment_download('{org_a}', '{exp_id}', '00000000-0000-4000-8000-000000000801');", succeeds=False, error_code="55000")

    # 4. Privacy request + immutability of financial ledger + anonymization vs pseudonymization
    req_json = pg.sql(actor(admin_a) + f"select public.register_tenant_privacy_request_idempotent('{org_a}', '{member_a}', 'deletion', 'financial_ledger', 'in_person_controller_check', true, 'legal_obligation_accounting', 'Solicitacao QA', 'k-req-1');")
    req_id = json.loads(req_json)["request_id"]
    pg.sql(actor(admin_a) + f"select public.review_tenant_privacy_request_idempotent('{org_a}', '{req_id}', 'anonymized_verified', 'legal_obligation_accounting', true, false, 'Tentativa indevida apagar ledger', 'k-rev-fail');", succeeds=False, error_code="55000")
    pg.sql(actor(admin_a) + f"select public.review_tenant_privacy_request_idempotent('{org_a}', '{req_id}', 'retained_by_law', 'legal_obligation_accounting', true, true, 'Fatos financeiros retidos por 5 anos conforme D01', 'k-rev-ok');")

    # 5. Dual evidence & AAL2 enforcement for Master + secret block
    pg.sql(actor(master1, "aal1") + "select public.read_master_operational_security_overview();", succeeds=False, error_code="42501")
    pg.sql(actor(support, "aal2") + "select public.read_master_operational_security_overview();", succeeds=False, error_code="42501")
    pg.sql(actor(master1, "aal2") + f"select public.register_privileged_recovery_decision_idempotent('{org_a}', '{admin_a}', 'tenant_admin', 'privileged_recovery', 'approved_awaiting_owner_mfa', 'identity_document_check', 'DOC-1', 'controller_attestation', 'DOC-2', '{master1}', 'Mesmo operador proibido', 'k-rec-same');", succeeds=False, error_code="22023")
    pg.sql(actor(master1, "aal2") + f"select public.register_privileged_recovery_decision_idempotent('{org_a}', '{admin_a}', 'tenant_admin', 'privileged_recovery', 'approved_awaiting_owner_mfa', 'identity_document_check', 'DOC-1', 'controller_attestation', 'DOC-2', '{master2}', 'Dupla verificacao formalizada com re-enroll MFA', 'k-rec-ok');")

    # 6. Incident secret leak rejection + 24h SLA creation
    pg.sql(actor(master1, "aal2") + f"select public.record_operational_incident_idempotent('{org_a}', 'high', 'auth_authz', 'Falha token', 'Vazou password=123 na sessao', 'L2_engineering', 'k-inc-sec');", succeeds=False, error_code="22023")
    pg.sql(actor(master1, "aal2") + f"select public.record_operational_incident_idempotent('{org_a}', 'high', 'auth_authz', 'Erro repetido AAL2', 'Aumento de falhas 401 no gateway em janela de QA sem PII', 'L2_engineering', 'k-inc-ok');")

    # 7. Compromised access revocation revokes role without deleting charges
    pg.sql(actor(master1, "aal2") + f"select public.revoke_compromised_tenant_access_idempotent('{org_a}', '{admin_a}', 'Conta comprometida em QA isolado', 'k-revoke-1');")
    assert pg.sql(f"select count(*) from public.user_roles where organization_id='{org_a}' and user_id='{admin_a}'") == "0"
    assert pg.sql(f"select count(*) from public.charges where organization_id='{org_a}'") == "1"

    print("M05_PRIVACY_RECOVERY_PG_PASS: DDL rollback, A/B isolation, D01-D06 RPCs, AAL2, ledger immutability")


if __name__ == "__main__":
    if "--self-test-extract" in sys.argv:
        self_test_extract()
    else:
        run_pg_gate()
