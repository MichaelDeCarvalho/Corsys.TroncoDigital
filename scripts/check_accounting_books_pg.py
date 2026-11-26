"""Disposable PostgreSQL M03 accounting books & DRE Gerencial gate.

Exercises:
- DDL rollback safety + production migration execution (`20261126000000_v35_m03_accounting_books_and_dre.sql`)
- Role permissions (`anon`, unauthorized `authenticated`, cross-tenant A/B isolation)
- Governed Anexo III `set_accounting_plan_role_mapping_idempotent` validation, immutability on
  published plans (`55000`), nature guards (`23514`), optimistic concurrency (`40001`), and idempotency
- Double-entry Diário Contábil (`read_tenant_accounting_diary_summary` + `read_tenant_accounting_diary`)
- Analytical Razão Contábil (`read_tenant_accounting_ledger`) with prior-entry opening balance,
  deterministic running balance (`D`/`C`), and exact cent tie-out to Diário
- Structured B01 DRE Gerencial (`read_tenant_dre_gerencial`) with waterfall, prior-period
  comparatives, zero-balance active analytic accounts, and fail-closed unmapped/legacy sealing.

Never connects to Supabase DEV or PROD. Requires local disposable PostgreSQL 17.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"

PGHOST = os.environ.get("PGHOST", "127.0.0.1")
PGPORT = os.environ.get("PGPORT", "55432")
PGUSER = os.environ.get("PGUSER", "postgres")
PGPASSWORD = os.environ.get("PGPASSWORD", "onboarding-ci")
PGDATABASE = os.environ.get("PGDATABASE", "accounting_books_gate")

FORBIDDEN_TARGETS = ("supabase.co", "supabase.com", "szqkdekwhzxsoxorgvaz", "pooler")
ALLOWED_DB_SUFFIXES = ("_gate", "_test", "_trial")

SQLSTATE_RE = re.compile(r"ERROR:\s+([0-9A-Z]{5}):")


def assert_disposable_target() -> None:
    target = f"{PGHOST}:{PGPORT}/{PGDATABASE}".lower()
    for token in FORBIDDEN_TARGETS:
        if token in target:
            raise SystemExit(f"REFUSING non-disposable target containing '{token}': {target}")
    if PGHOST not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit(f"REFUSING non-local host: {PGHOST}")
    if not PGDATABASE.endswith(ALLOWED_DB_SUFFIXES):
        raise SystemExit(f"REFUSING database '{PGDATABASE}'; expected suffix in {ALLOWED_DB_SUFFIXES}")


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


def function(src: str, schema: str, name: str) -> str:
    return extract(src, rf"create (?:or replace )?function {schema}\.{name}\(", r"as\s+\$\$.*?\$\$;")


def build_extracted_prerequisites() -> dict[str, str]:
    m_found = source("202609040001_foundation")
    m_acc = source("202609080008_post_v31_accounting_domain")
    m_tz = source("v35_tenant_timezone_financial_dates")
    m_m03 = source("v35_m03_accounting_books_and_dre")

    return {
        "fn_set_updated_at": function(m_found, "private", "set_updated_at"),
        "tbl_accounting_plans": table(m_acc, "accounting_plans"),
        "tbl_accounting_accounts": table(m_acc, "accounting_accounts"),
        "tbl_fin_acc_mappings": table(m_acc, "financial_account_accounting_mappings"),
        "fn_prevent_pub_struct": function(m_acc, "private", "prevent_published_accounting_structure_mutation"),
        "fn_plan_for_date": function(m_acc, "private", "accounting_plan_for_date"),
        "fn_valid_tz": function(m_tz, "private", "is_valid_iana_timezone"),
        "fn_tenant_date_at": function(m_tz, "private", "tenant_current_date_at"),
        "m03_migration": m_m03,
    }


def uid(n: int) -> str:
    return f"00000000-0000-4000-9000-{n:012d}"


def sql(query: str, code: str | None = None, app: str = "m03-books") -> str:
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
    if code is not None:
        assert proc.returncode != 0, f"[{app}] Expected error {code}, got success: {proc.stdout}"
        assert sqlstate == code or code in proc.stderr, f"[{app}] Expected {code}, got {sqlstate}: {proc.stderr}"
        return proc.stderr
    assert proc.returncode == 0, f"[{app}] SQL failed ({sqlstate}): {proc.stderr}"
    return proc.stdout.strip()


def run_pg_gate() -> None:
    assert_disposable_target()
    parts = build_extracted_prerequisites()

    org_a = uid(1)
    org_b = uid(2)
    user_admin_a = uid(10)
    user_viewer = uid(11)
    user_admin_b = uid(12)

    sql(
        f"""
        create schema if not exists private;
        create schema if not exists auth;
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
        end $$;

        create table auth.users (id uuid primary key);
        insert into auth.users values ('{user_admin_a}'), ('{user_viewer}'), ('{user_admin_b}');

        create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('qa.actor', true), '')::uuid $$;

        create table public.organizations (
          id uuid primary key,
          name text not null
        );
        insert into public.organizations values ('{org_a}', 'Loja A'), ('{org_b}', 'Loja B');

        create table public.organization_settings (
          organization_id uuid primary key references public.organizations(id) on delete cascade,
          timezone text not null default 'America/Sao_Paulo'
        );
        insert into public.organization_settings values ('{org_a}', 'America/Sao_Paulo'), ('{org_b}', 'America/Sao_Paulo');

        create function private.has_permission(p_org uuid, p_perm text) returns boolean
        language sql stable as $$
          select (
            (p_org = '{org_a}' and auth.uid() = '{user_admin_a}' and p_perm in ('finance.read', 'accounting.manage', 'reports.read'))
            or (p_org = '{org_b}' and auth.uid() = '{user_admin_b}' and p_perm in ('finance.read', 'accounting.manage', 'reports.read'))
          );
        $$;

        create function private.require_permission(p_org uuid, p_perm text) returns void
        language plpgsql stable as $$
        begin
          if auth.uid() is null or not private.has_permission(p_org, p_perm) then
            raise exception 'permission denied for %', p_perm using errcode = '42501';
          end if;
        end;
        $$;

        create table public.idempotency_keys (
          organization_id uuid not null,
          command_name text not null,
          idempotency_key text not null,
          payload_hash text not null,
          result_id uuid,
          primary key (organization_id, idempotency_key)
        );

        create function private.idempotency_begin(p_org uuid, p_cmd text, p_key text, p_payload jsonb)
        returns uuid language plpgsql as $$
        declare
          v_row public.idempotency_keys%rowtype;
        begin
          select * into v_row from public.idempotency_keys
          where organization_id = p_org and idempotency_key = p_key;
          if found then
            if v_row.command_name <> p_cmd or v_row.payload_hash <> md5(p_payload::text) then
              raise exception 'idempotency conflict' using errcode = '40001';
            end if;
            return v_row.result_id;
          end if;
          insert into public.idempotency_keys(organization_id, command_name, idempotency_key, payload_hash)
          values (p_org, p_cmd, p_key, md5(p_payload::text));
          return null;
        end;
        $$;

        create function private.idempotency_complete(p_org uuid, p_key text, p_result uuid)
        returns void language sql as $$
          update public.idempotency_keys
          set result_id = p_result
          where organization_id = p_org and idempotency_key = p_key;
        $$;

        {parts['fn_set_updated_at']}
        {parts['fn_valid_tz']}
        {parts['fn_tenant_date_at']}

        create table public.financial_accounts (
          id uuid primary key,
          organization_id uuid not null references public.organizations(id) on delete cascade,
          name text not null,
          unique (organization_id, id)
        );

        {parts['tbl_accounting_plans']}
        {parts['tbl_accounting_accounts']}
        {parts['tbl_fin_acc_mappings']}
        {parts['fn_prevent_pub_struct']}
        {parts['fn_plan_for_date']}

        create table public.audit_logs (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references public.organizations(id) on delete cascade,
          actor_user_id uuid references auth.users(id),
          action text not null,
          entity_type text not null,
          entity_id uuid,
          before_data jsonb,
          after_data jsonb,
          reason text,
          created_at timestamptz not null default now()
        );

        create table public.charges (
          id uuid primary key,
          organization_id uuid not null,
          accounting_plan_id uuid,
          accounting_account_id uuid,
          accounting_period date not null,
          competence date not null,
          issue_date date not null,
          source_kind text not null default 'monthly',
          supersedes_charge_id uuid,
          original_amount numeric(14,2) not null,
          description text not null,
          created_at timestamptz not null default now()
        );
        create table public.charge_adjustments (
          id uuid primary key,
          organization_id uuid not null,
          charge_id uuid not null,
          accounting_period date not null,
          direction text not null,
          adjustment_kind text not null,
          amount numeric(14,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.charge_cancellations (
          id uuid primary key,
          organization_id uuid not null,
          charge_id uuid not null,
          accounting_period date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.payments (
          id uuid primary key,
          organization_id uuid not null,
          financial_account_id uuid not null,
          accounting_period date not null,
          payment_date date not null,
          source_kind text not null default 'operational',
          amount numeric(14,2) not null,
          reference text,
          notes text,
          created_at timestamptz not null default now()
        );
        create table public.payment_reversals (
          id uuid primary key,
          organization_id uuid not null,
          payment_id uuid not null,
          accounting_period date not null,
          reversal_date date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.receivable_allocations (
          id uuid primary key,
          organization_id uuid not null,
          charge_id uuid not null,
          payment_id uuid,
          member_credit_id uuid,
          accounting_period date not null,
          amount numeric(14,2) not null,
          created_at timestamptz not null default now()
        );
        create table public.allocation_reversals (
          id uuid primary key,
          organization_id uuid not null,
          allocation_id uuid not null,
          accounting_period date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.member_credits (
          id uuid primary key,
          organization_id uuid not null,
          credit_kind text not null default 'opening_credit',
          accounting_period date not null,
          amount numeric(14,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.member_credit_reversals (
          id uuid primary key,
          organization_id uuid not null,
          member_credit_id uuid not null,
          accounting_period date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_payables (
          id uuid primary key,
          organization_id uuid not null,
          accounting_plan_id uuid,
          accounting_account_id uuid,
          accounting_period date not null,
          competence date not null,
          issue_date date not null,
          posting_status text not null default 'posted',
          amount numeric(14,2) not null,
          description text not null,
          created_at timestamptz not null default now()
        );
        create table public.institutional_payable_corrections (
          id uuid primary key,
          organization_id uuid not null,
          payable_id uuid not null,
          accounting_period date not null,
          previous_accounting_plan_id uuid,
          previous_accounting_account_id uuid,
          previous_competence date,
          previous_amount numeric(14,2),
          previous_description text,
          new_accounting_plan_id uuid,
          new_accounting_account_id uuid,
          new_competence date,
          new_amount numeric(14,2),
          new_description text,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_payable_cancellations (
          id uuid primary key,
          organization_id uuid not null,
          payable_id uuid not null,
          accounting_plan_id uuid,
          accounting_account_id uuid,
          accounting_period date not null,
          canceled_amount numeric(14,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_payable_payments (
          id uuid primary key,
          organization_id uuid not null,
          financial_account_id uuid not null,
          accounting_period date not null,
          payment_date date not null,
          amount numeric(14,2) not null,
          reference text,
          notes text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_payable_payment_reversals (
          id uuid primary key,
          organization_id uuid not null,
          payment_id uuid not null,
          accounting_period date not null,
          reversal_date date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_receivables (
          id uuid primary key,
          organization_id uuid not null,
          accounting_plan_id uuid,
          accounting_account_id uuid,
          accounting_period date not null,
          competence date not null,
          issue_date date not null,
          posting_status text not null default 'posted',
          amount numeric(14,2) not null,
          description text not null,
          created_at timestamptz not null default now()
        );
        create table public.institutional_receivable_corrections (
          id uuid primary key,
          organization_id uuid not null,
          receivable_id uuid not null,
          accounting_period date not null,
          previous_accounting_plan_id uuid,
          previous_accounting_account_id uuid,
          previous_competence date,
          previous_amount numeric(14,2),
          previous_description text,
          new_accounting_plan_id uuid,
          new_accounting_account_id uuid,
          new_competence date,
          new_amount numeric(14,2),
          new_description text,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_receivable_cancellations (
          id uuid primary key,
          organization_id uuid not null,
          receivable_id uuid not null,
          accounting_plan_id uuid,
          accounting_account_id uuid,
          accounting_period date not null,
          canceled_amount numeric(14,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_receipts (
          id uuid primary key,
          organization_id uuid not null,
          financial_account_id uuid not null,
          accounting_period date not null,
          receipt_date date not null,
          amount numeric(14,2) not null,
          reference text,
          notes text,
          created_at timestamptz not null default now()
        );
        create table public.institutional_receipt_reversals (
          id uuid primary key,
          organization_id uuid not null,
          receipt_id uuid not null,
          accounting_period date not null,
          reversal_date date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.financial_account_transfers (
          id uuid primary key,
          organization_id uuid not null,
          from_account_id uuid not null,
          to_account_id uuid not null,
          accounting_period date not null,
          transfer_date date not null,
          amount numeric(14,2) not null,
          reference text,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.financial_account_transfer_reversals (
          id uuid primary key,
          organization_id uuid not null,
          transfer_id uuid not null,
          accounting_period date not null,
          reversal_date date not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.account_opening_entries (
          id uuid primary key,
          organization_id uuid not null,
          financial_account_id uuid not null,
          effective_date date not null,
          amount numeric(14,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
        create table public.legacy_financial_records (
          id uuid primary key,
          organization_id uuid not null,
          event_date date,
          competence date,
          description text not null
        );
        """
    )

    # 1. DDL Rollback test + Commit
    exists_check = "select to_regclass('public.accounting_plan_role_mappings') is not null, to_regprocedure('public.read_tenant_dre_gerencial(uuid,date,date)') is not null;"
    rollback_out = sql("begin;\n" + parts["m03_migration"] + "\n" + exists_check + "\nrollback;\n" + exists_check)
    assert rollback_out.splitlines() == ["t|t", "f|f"], f"Rollback failed: {rollback_out}"

    sql("begin;\n" + parts["m03_migration"] + "\ncommit;")

    # 2. Seed published plan on Loja A, draft plan for role-mapping tests, accounts & financial account
    plan_a = uid(100)
    plan_draft = uid(101)
    fin_bank = uid(200)
    fin_unmapped = uid(201)

    acc_bank = uid(301)
    acc_mem_rec = uid(302)
    acc_inst_rec = uid(303)
    acc_mem_adv = uid(304)
    acc_inst_pay = uid(305)
    acc_open_contra = uid(306)
    acc_rev_mens = uid(307)
    acc_rev_zero = uid(308)
    acc_ded = uid(309)
    acc_exp_admin = uid(310)
    acc_draft_ctrl = uid(311)

    sql(
        f"""
        insert into public.financial_accounts values
          ('{fin_bank}', '{org_a}', 'Banco Principal'),
          ('{fin_unmapped}', '{org_a}', 'Conta Sem Vinculo');

        insert into public.accounting_plans (id, organization_id, name, status, valid_from, valid_to) values
          ('{plan_a}', '{org_a}', 'Plano 2026', 'draft', '2026-01-01', '2026-12-31'),
          ('{plan_draft}', '{org_a}', 'Plano Rascunho', 'draft', '2027-01-01', '2027-12-31');

        insert into public.accounting_accounts (id, organization_id, accounting_plan_id, code, description, nature, row_type, operational_classification, active) values
          ('{acc_bank}', '{org_a}', '{plan_a}', '1.1.01.01', 'Banco Principal', 'patrimonial', 'analytic', null, true),
          ('{acc_mem_rec}', '{org_a}', '{plan_a}', '1.1.02.01', 'Contribuições a Receber', 'patrimonial', 'analytic', null, true),
          ('{acc_inst_rec}', '{org_a}', '{plan_a}', '1.1.02.02', 'Recebíveis Institucionais', 'patrimonial', 'analytic', null, true),
          ('{acc_mem_adv}', '{org_a}', '{plan_a}', '2.1.01.01', 'Adiantamentos de Integrantes', 'patrimonial', 'analytic', null, true),
          ('{acc_inst_pay}', '{org_a}', '{plan_a}', '2.1.02.01', 'Obrigações a Pagar', 'patrimonial', 'analytic', null, true),
          ('{acc_open_contra}', '{org_a}', '{plan_a}', '2.9.01.01', 'Contrapartida Abertura', 'patrimonial', 'analytic', null, true),
          ('{acc_rev_mens}', '{org_a}', '{plan_a}', '3.1.01.01', 'Mensalidades', 'revenue', 'analytic', 'recurring', true),
          ('{acc_rev_zero}', '{org_a}', '{plan_a}', '3.1.02.01', 'Doações Eventuais', 'revenue', 'analytic', 'ad_hoc', true),
          ('{acc_ded}', '{org_a}', '{plan_a}', '3.9.01.01', 'Descontos Concedidos', 'revenue', 'analytic', 'ad_hoc', true),
          ('{acc_exp_admin}', '{org_a}', '{plan_a}', '4.2.01.01', 'Despesas Administrativas', 'expense', 'analytic', 'fixed', true),
          ('{acc_draft_ctrl}', '{org_a}', '{plan_draft}', '1.1.02.01', 'Contribuições Rascunho', 'patrimonial', 'analytic', null, true);

        insert into public.financial_account_accounting_mappings (id, organization_id, accounting_plan_id, financial_account_id, accounting_account_id) values
          ('{uid(400)}', '{org_a}', '{plan_a}', '{fin_bank}', '{acc_bank}');
        """
    )

    def as_actor(actor: str | None) -> str:
        if actor is None:
            return "set role anon;"
        return f"set role authenticated; set qa.actor = '{actor}';"

    # 3. Role mapping governance: permissions, nature validation, concurrency, idempotency, immutability
    sql(as_actor(None) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_draft}','member_receivable_control','{acc_draft_ctrl}',null,'Setup','k1');", "42501")
    sql(as_actor(user_viewer) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_draft}','member_receivable_control','{acc_draft_ctrl}',null,'Setup','k2');", "42501")
    sql(as_actor(user_admin_b) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_draft}','member_receivable_control','{acc_draft_ctrl}',null,'Cross','k3');", "42501")

    # Wrong nature (patrimonial account assigned to revenue_deduction on plan_a)
    sql(as_actor(user_admin_a) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_a}','revenue_deduction','{acc_bank}',null,'Nature check','k4');", "23514")

    # Configure all needed Anexo III roles via governed RPC on draft plan_a, verify idempotency & 40001 CAS
    roles = [
        ("member_receivable_control", acc_mem_rec),
        ("institutional_receivable_control", acc_inst_rec),
        ("member_advance_liability", acc_mem_adv),
        ("institutional_payable_control", acc_inst_pay),
        ("revenue_deduction", acc_ded),
        ("opening_balance_contra", acc_open_contra),
    ]
    for idx, (role_code, acc_id) in enumerate(roles, start=1):
        res1 = sql(as_actor(user_admin_a) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_a}','{role_code}','{acc_id}',null,'Role {role_code}','rk-{idx}');")
        res2 = sql(as_actor(user_admin_a) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_a}','{role_code}','{acc_id}',null,'Role {role_code}','rk-{idx}');")
        assert res1 == res2 and res1, "Idempotent replay mismatch"

    # Stale expected_account_id fails with 40001
    sql(as_actor(user_admin_a) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_a}','member_receivable_control','{acc_bank}',null,'Stale','rk-stale');", "40001")

    # Publish plan_a; further role mapping mutations blocked with 55000
    sql(f"update public.accounting_plans set status = 'published' where id = '{plan_a}';")
    sql(as_actor(user_admin_a) + f"select public.set_accounting_plan_role_mapping_idempotent('{org_a}','{plan_a}','member_receivable_control','{acc_bank}','{acc_mem_rec}','After publish','rk-pub');", "55000")

    # 4. Seed balanced double-entry facts across 2026-09 (opening/prior) and 2026-10 (current)
    sql(
        f"""
        -- 2026-09: Opening balance R$ 500 + Prior monthly revenue R$ 100
        insert into public.account_opening_entries values
          ('{uid(501)}', '{org_a}', '{fin_bank}', '2026-09-01', 500.00, 'Saldo inicial comprovado', '2026-09-01T09:00:00Z');
        insert into public.charges values
          ('{uid(502)}', '{org_a}', '{plan_a}', '{acc_rev_mens}', '2026-09-01', '2026-09-01', '2026-09-05', 'monthly', null, 100.00, 'Mensalidade Setembro', '2026-09-05T10:00:00Z');

        -- 2026-10: Charge R$ 200, Discount R$ 20, Payment R$ 180, Allocation R$ 180, Payable R$ 50, Pay R$ 50, Reversal R$ 50
        insert into public.charges values
          ('{uid(503)}', '{org_a}', '{plan_a}', '{acc_rev_mens}', '2026-10-01', '2026-10-01', '2026-10-02', 'monthly', null, 200.00, 'Mensalidade Outubro', '2026-10-02T10:00:00Z');
        insert into public.charge_adjustments values
          ('{uid(504)}', '{org_a}', '{uid(503)}', '2026-10-01', 'decrease', 'discount', 20.00, 'Pontualidade', '2026-10-03T10:00:00Z');
        insert into public.payments values
          ('{uid(505)}', '{org_a}', '{fin_bank}', '2026-10-01', '2026-10-04', 'operational', 180.00, 'PIX-180', 'Pagamento Mensalidade', '2026-10-04T10:00:00Z');
        insert into public.receivable_allocations values
          ('{uid(506)}', '{org_a}', '{uid(503)}', '{uid(505)}', '2026-10-01', 180.00, '2026-10-04T10:05:00Z');
        insert into public.institutional_payables values
          ('{uid(507)}', '{org_a}', '{plan_a}', '{acc_exp_admin}', '2026-10-01', '2026-10-01', '2026-10-06', 'posted', 50.00, 'Material Expediente', '2026-10-06T10:00:00Z');
        insert into public.institutional_payable_payments values
          ('{uid(508)}', '{org_a}', '{fin_bank}', '2026-10-01', '2026-10-07', 50.00, 'TED-50', 'Pago Expediente', '2026-10-07T10:00:00Z');
        insert into public.institutional_payable_payment_reversals values
          ('{uid(509)}', '{org_a}', '{uid(508)}', '2026-10-01', '2026-10-08', 'Estorno bancário', '2026-10-08T10:00:00Z');
        """
    )

    # 5. Negative RPC checks
    sql(as_actor(None) + f"select public.read_tenant_accounting_diary_summary('{org_a}','2026-10-01','2026-10-31');", "42501")
    sql(as_actor(user_admin_b) + f"select public.read_tenant_accounting_diary_summary('{org_a}','2026-10-01','2026-10-31');", "42501")
    sql(as_actor(user_admin_b) + f"select public.read_tenant_dre_gerencial('{org_a}','2026-10-01','2026-10-01');", "42501")

    # 6. Verify Diário Contábil (2026-10: 7 entries totaling 200+20+180+180+50+50+50 = 730.00)
    summary = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_accounting_diary_summary('{org_a}','2026-10-01','2026-10-31','event_date',null,null,false);"))
    assert summary["total_count"] == 7, summary
    assert float(summary["total_debit"]) == 730.00 and float(summary["total_credit"]) == 730.00, summary
    assert summary["balanced"] is True and summary["integral_ok"] is True, summary

    rev_summary = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_accounting_diary_summary('{org_a}','2026-10-01','2026-10-31','event_date',null,null,true);"))
    assert rev_summary["total_count"] == 2, rev_summary  # discount adjustment + payable payment reversal

    # 7. Verify Razão Contábil on acc_bank (2026-10):
    # Opening from 2026-09: +500 D ('prior_entries')
    # 2026-10 moves: +180 D (payment), -50 C (payable pay), +50 D (reversal) -> total D 180, C 50, closing 680 D
    ledger_bank = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_accounting_ledger('{org_a}','{acc_bank}','2026-10-01','2026-10-31','event_date',0,100);"))
    assert float(ledger_bank["opening_balance"]) == 500.00
    assert ledger_bank["opening_balance_source"] == "prior_entries"
    assert float(ledger_bank["period_debit_total"]) == 230.00
    assert float(ledger_bank["period_credit_total"]) == 50.00
    assert float(ledger_bank["closing_balance"]) == 680.00
    assert ledger_bank["reconciles_with_diary"] is True and ledger_bank["integral_ok"] is True

    # 8. Verify DRE Gerencial (2026-10):
    # Gross Revenue 200, Deductions -20 -> Net Revenue 180, Op Expenses -50 -> Net Result 130.00
    # Prior Period (2026-09): Net Revenue 100, Op Expenses 0 -> Net Result 100.00; YoY: null
    dre = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_dre_gerencial('{org_a}','2026-10-01','2026-10-01');"))
    wf = dre["waterfall"]
    assert float(wf["gross_revenue"]) == 200.00
    assert float(wf["deductions"]) == -20.00
    assert float(wf["net_revenue"]) == 180.00
    assert float(wf["operational_expenses"]) == -50.00
    assert float(wf["net_result"]) == 130.00
    assert dre["has_prior_period_data"] is True and float(dre["prior_period_waterfall"]["net_result"]) == 100.00
    assert dre["has_prior_year_data"] is False and dre["prior_year_waterfall"] is None
    assert dre["integral_ok"] is True
    assert any(a["accounting_account_id"] == acc_rev_zero and float(a["amount"]) == 0.0 for a in dre["accounts"])

    # 9. Fail-closed check: unmapped payment breaks integral_ok across Diário, Razão & DRE Gerencial
    sql(f"insert into public.payments values ('{uid(599)}', '{org_a}', '{fin_unmapped}', '2026-10-01', '2026-10-15', 'operational', 25.00, null, 'Sem mapeamento', '2026-10-15T10:00:00Z');")
    blocked_summary = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_accounting_diary_summary('{org_a}','2026-10-01','2026-10-31');"))
    assert blocked_summary["integral_ok"] is False and blocked_summary["unmapped_count"] == 1
    blocked_dre = json.loads(sql(as_actor(user_admin_a) + f"select public.read_tenant_dre_gerencial('{org_a}','2026-10-01','2026-10-01');"))
    assert blocked_dre["integral_ok"] is False and blocked_dre["unmapped_count"] == 1

    print("PASS M03 accounting books, double-entry diary/ledger reconciliation, B01 DRE waterfall & fail-closed guards")


if __name__ == "__main__":
    if "--self-test-extract" in sys.argv:
        extracted = build_extracted_prerequisites()
        assert len(extracted) == 9 and all(v for v in extracted.values())
        print("PASS self-test-extract (9 SQL artifacts extracted cleanly)")
    else:
        run_pg_gate()
