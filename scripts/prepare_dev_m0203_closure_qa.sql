-- CorSys Tronco Digital V35 — M02.03 Isolated DEV Closure Fixture Setup
-- Target ONLY: Supabase DEV (szqkdekwhzxsoxorgvaz). Never run against PROD.
-- Default is dry-run ROLLBACK. Before running in DEV SQL Editor or psql:
--   1. Set project_ref = 'szqkdekwhzxsoxorgvaz' and env_ack = 'DEV_ONLY' below.
--   2. Set operator1_email (ADMIN) and operator2_email (TREASURER) to two distinct DEV emails.
--   3. Optionally set raw_round_id (default 'AUTO' generates a unique round identifier).
--   4. Run dry-run first and check NOTICE / PRE_TRANSACTION_END / final execution_status.
--   5. Replace final ROLLBACK with COMMIT only for authorized DEV QA execution.

create temp table if not exists pg_temp._m0203_prepare_ctx (
  round_id text not null,
  expected_org_id uuid not null,
  operator1_email text not null,
  operator2_email text not null,
  project_ref text not null,
  env_ack text not null,
  created_at timestamptz not null default now()
) on commit preserve rows;

truncate table pg_temp._m0203_prepare_ctx;

insert into pg_temp._m0203_prepare_ctx (
  round_id, expected_org_id, operator1_email, operator2_email, project_ref, env_ack
)
select
  case
    when upper(btrim(p.raw_round_id)) in ('', 'AUTO')
      then 'M0203-' || to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDD"T"HH24MISS"Z"') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    else upper(btrim(p.raw_round_id))
  end,
  gen_random_uuid(),
  lower(btrim(p.operator1_email)),
  lower(btrim(p.operator2_email)),
  lower(btrim(p.project_ref)),
  upper(btrim(p.env_ack))
from (
  select
    'REPLACE_PROJECT_REF'::text as project_ref,
    'REPLACE_DEV_ONLY'::text as env_ack,
    'REPLACE_OPERATOR1_EMAIL'::text as operator1_email,
    'REPLACE_OPERATOR2_EMAIL'::text as operator2_email,
    'AUTO'::text as raw_round_id
) p;

begin;

create temp table if not exists pg_temp._m0203_prepare_tx (
  round_id text not null,
  organization_id uuid not null,
  organization_name text not null,
  created_user_roles jsonb not null,
  tx_status text not null
) on commit drop;

do $$
declare
  v_ctx pg_temp._m0203_prepare_ctx%rowtype;
  v_user1 uuid;
  v_user2 uuid;
  v_org_name text;
  v_org uuid;
  v_role_admin uuid;
  v_role_treasurer uuid;
  v_created_user_roles jsonb;
  v_dev_anchor_count integer := 0;
  v_plan_id uuid;
  v_plan_ver_id uuid;
  v_acc_plan uuid;
  v_pat uuid;
  v_rev uuid;
  v_exp uuid;
  v_bank uuid;
  v_method uuid;
  v_cat_member uuid;
  v_cat_exp uuid;
  v_cat_rev uuid;
  v_rule uuid;
  v_import uuid;
  v_year_start date := date_trunc('year', current_date)::date;
  v_year_end date := (date_trunc('year', current_date) + interval '2 years' - interval '1 day')::date;
  v_month_start date := date_trunc('month', current_date)::date;
begin
  select * into strict v_ctx from pg_temp._m0203_prepare_ctx limit 1;

  if v_ctx.project_ref <> 'szqkdekwhzxsoxorgvaz' or v_ctx.env_ack <> 'DEV_ONLY' then
    raise exception 'Ambiente nao autorizado: confirme externamente project_ref = szqkdekwhzxsoxorgvaz e env_ack = DEV_ONLY';
  end if;

  if current_database() <> 'postgres' then
    raise exception 'Banco inesperado (%): esperado postgres do DEV szqkdekwhzxsoxorgvaz', current_database();
  end if;

  select count(*)::integer into v_dev_anchor_count
  from public.organizations o
  join public.saas_subscriptions s on s.organization_id = o.id and s.status = 'active'
  join public.saas_plans p on p.id = s.plan_id and p.price = 0
  join public.saas_plan_versions v on v.id = s.plan_version_id and v.price = 0
  where (o.id = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid and o.name = 'CORSYS DEV TENANT A')
     or (o.id = 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid and o.name = 'CORSYS DEV TENANT B');

  if v_dev_anchor_count <> 2 then
    raise exception 'Identidade DEV nao confirmada no PostgreSQL (ancoras CORSYS DEV TENANT A/B gratuitas encontradas=%). Execucao bloqueada.', v_dev_anchor_count;
  end if;

  if v_ctx.operator1_email = '' or v_ctx.operator1_email = 'replace_operator1_email'
     or v_ctx.operator2_email = '' or v_ctx.operator2_email = 'replace_operator2_email'
     or v_ctx.operator1_email = v_ctx.operator2_email then
    raise exception 'Informe dois e-mails DEV distintos para operador 1 (ADMIN) e operador 2 (TREASURER)';
  end if;

  if v_ctx.round_id !~ '^[A-Z0-9_-]{3,40}$' then
    raise exception 'round_id invalido (%): utilize A-Z, 0-9, _ ou - (3 a 40 caracteres)', v_ctx.round_id;
  end if;

  v_org_name := 'QA_CLOSURE_' || v_ctx.round_id;

  select id into v_user1 from auth.users where lower(email) = v_ctx.operator1_email;
  select id into v_user2 from auth.users where lower(email) = v_ctx.operator2_email;
  if v_user1 is null or v_user2 is null or v_user1 = v_user2 then
    raise exception 'Os dois usuarios de QA devem existir no auth.users do DEV e ser distintos';
  end if;

  if exists (select 1 from public.organizations where id = v_ctx.expected_org_id or name = v_org_name) then
    raise exception 'Fixture % (%) para a rodada % ja existe; use outro round_id ou execute cleanup antes', v_org_name, v_ctx.expected_org_id, v_ctx.round_id;
  end if;

  select p.id, v.id into v_plan_id, v_plan_ver_id
  from public.saas_plans p
  join public.saas_plan_versions v on v.plan_id = p.id
  where p.price = 0 and v.price = 0
  order by v.created_at asc
  limit 1;

  if v_plan_id is null or v_plan_ver_id is null then
    raise exception 'Plano SaaS DEV gratuito (price = 0) nao encontrado para fixture isolada';
  end if;

  insert into public.organizations (id, name, number, status)
  values (v_ctx.expected_org_id, v_org_name, left('QA-' || v_ctx.round_id, 40), 'active')
  returning id into v_org;

  insert into public.saas_tenant_accounts (organization_id) values (v_org);
  insert into public.saas_subscriptions (organization_id, plan_id, plan_version_id, status)
  values (v_org, v_plan_id, v_plan_ver_id, 'active');

  select id into v_role_admin from public.roles where organization_id = v_org and code = 'ADMIN';
  select id into v_role_treasurer from public.roles where organization_id = v_org and code = 'TREASURER';
  if v_role_admin is null or v_role_treasurer is null then
    raise exception 'Papeis padrao ADMIN/TREASURER nao semeados para a Loja %', v_org;
  end if;

  insert into public.user_roles (organization_id, user_id, role_id)
  values
    (v_org, v_user1, v_role_admin),
    (v_org, v_user2, v_role_treasurer);

  v_created_user_roles := jsonb_build_array(
    jsonb_build_object(
      'organization_id', v_org,
      'user_id', v_user1,
      'role_id', v_role_admin,
      'role_code', 'ADMIN'
    ),
    jsonb_build_object(
      'organization_id', v_org,
      'user_id', v_user2,
      'role_id', v_role_treasurer,
      'role_code', 'TREASURER'
    )
  );

  insert into public.financial_accounts (organization_id, name, account_type)
  values (v_org, 'Conta QA Closure M02.03', 'bank')
  returning id into v_bank;

  insert into public.payment_methods (organization_id, name)
  values (v_org, 'PIX QA M02.03')
  returning id into v_method;

  insert into public.financial_categories (organization_id, name, domain, allow_recurrence, allow_installments)
  values (v_org, 'Mensalidade QA M02.03', 'member_receivable', true, true)
  returning id into v_cat_member;

  insert into public.financial_categories (organization_id, name, domain)
  values (v_org, 'Despesa Institucional QA M02.03', 'institutional_expense')
  returning id into v_cat_exp;

  insert into public.financial_categories (organization_id, name, domain)
  values (v_org, 'Receita Institucional QA M02.03', 'institutional_revenue')
  returning id into v_cat_rev;

  insert into public.accounting_plans (organization_id, name, valid_from, valid_to)
  values (v_org, 'Plano Contabil QA M02.03', v_year_start, v_year_end)
  returning id into v_acc_plan;

  insert into public.accounting_accounts (organization_id, accounting_plan_id, code, description, row_type, nature)
  values (v_org, v_acc_plan, '1.1.01', 'Disponibilidades QA M02.03', 'analytic', 'patrimonial')
  returning id into v_pat;

  insert into public.accounting_accounts (organization_id, accounting_plan_id, code, description, row_type, nature, operational_classification)
  values (v_org, v_acc_plan, '3.1.01', 'Receitas QA M02.03', 'analytic', 'revenue', 'recurring')
  returning id into v_rev;

  insert into public.accounting_accounts (organization_id, accounting_plan_id, code, description, row_type, nature, operational_classification)
  values (v_org, v_acc_plan, '4.1.01', 'Despesas QA M02.03', 'analytic', 'expense', 'fixed')
  returning id into v_exp;

  insert into public.financial_category_account_mappings (organization_id, accounting_plan_id, category_id, accounting_account_id)
  values
    (v_org, v_acc_plan, v_cat_member, v_rev),
    (v_org, v_acc_plan, v_cat_rev, v_rev),
    (v_org, v_acc_plan, v_cat_exp, v_exp);

  insert into public.financial_account_accounting_mappings (organization_id, accounting_plan_id, financial_account_id, accounting_account_id)
  values (v_org, v_acc_plan, v_bank, v_pat);

  update public.accounting_plans
  set status = 'published', published_at = now()
  where id = v_acc_plan;

  insert into public.members (organization_id, full_name, status)
  values
    (v_org, 'QA M0203 Integrante 01 Padrao', 'active'),
    (v_org, 'QA M0203 Integrante 02 Individual', 'active'),
    (v_org, 'QA M0203 Integrante 03 Isento', 'active');

  insert into public.recurring_rules (organization_id, category_id, name, frequency, due_day, active)
  values (v_org, v_cat_member, 'Mensalidade Geral QA M02.03', 'monthly', 10, true)
  returning id into v_rule;

  insert into public.recurring_rule_versions (recurring_rule_id, valid_from_competence, valid_to_competence, unit_amount)
  values (v_rule, v_month_start, null, 150.00);

  insert into public.expense_approval_policies (
    organization_id, name, mode, threshold_amount, minimum_approvers,
    status, valid_from, valid_to, created_by, published_by, published_at
  )
  values (
    v_org, 'Quorum 2 Aprovadores QA M02.03', 'all', null, 2,
    'published', v_year_start, v_year_end, v_user1, v_user1, now()
  );

  insert into public.bank_statement_imports (
    organization_id, financial_account_id, period_start, period_end,
    file_name, file_sha256, status, imported_by
  )
  values (
    v_org, v_bank, (current_date - interval '7 days')::date, current_date,
    'QA_CLOSURE_M0203_EXTRATO.csv', repeat('a', 64), 'validated', v_user1
  )
  returning id into v_import;

  insert into public.bank_statement_lines (
    organization_id, statement_import_id, line_number, transaction_date, description, amount, external_id
  )
  values
    (v_org, v_import, 1, current_date, 'QA_CLOSURE_M0203_LINHA_01', 100.00, 'qa-m0203-line-1'),
    (v_org, v_import, 2, current_date, 'QA_CLOSURE_M0203_LINHA_02', -50.00, 'qa-m0203-line-2');

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason)
  values (
    v_org,
    v_user1,
    'dev_qa.m0203_closure_prepare',
    'organization',
    v_org,
    jsonb_build_object(
      'round_id', v_ctx.round_id,
      'organization_id', v_org,
      'organization_name', v_org_name,
      'created_user_roles', v_created_user_roles
    ),
    'Isolated M02.03 closure fixture on DEV only (E04/B06) round ' || v_ctx.round_id
  );

  insert into pg_temp._m0203_prepare_tx (
    round_id, organization_id, organization_name, created_user_roles, tx_status
  )
  values (
    v_ctx.round_id, v_org, v_org_name, v_created_user_roles, 'PREPARED_IN_TRANSACTION'
  );

  raise notice 'M0203_PREPARE round_id=% organization_id=% organization_name=% created_user_roles=%',
    v_ctx.round_id, v_org, v_org_name, v_created_user_roles;
end $$;

select
  'PRE_TRANSACTION_END' as phase,
  round_id,
  organization_id,
  organization_name,
  created_user_roles,
  tx_status
from pg_temp._m0203_prepare_tx;

rollback; -- Padrao DRY-RUN. Somente para persistir no DEV autorizado, substitua por: commit;

select
  case
    when count(c.*) = 0 then 'NO_EVIDENCE'
    when bool_or(
      c.project_ref <> 'szqkdekwhzxsoxorgvaz'
      or c.env_ack <> 'DEV_ONLY'
      or current_database() <> 'postgres'
      or c.operator1_email in ('', 'replace_operator1_email')
      or c.operator2_email in ('', 'replace_operator2_email')
      or c.operator1_email = c.operator2_email
      or c.round_id !~ '^[A-Z0-9_-]{3,40}$'
    ) then 'FAILED_PRECONDITION_OR_ENV'
    when (
      select count(*)::integer
      from public.organizations ao
      join public.saas_subscriptions s on s.organization_id = ao.id and s.status = 'active'
      join public.saas_plans sp on sp.id = s.plan_id and sp.price = 0
      join public.saas_plan_versions sv on sv.id = s.plan_version_id and sv.price = 0
      where (ao.id = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid and ao.name = 'CORSYS DEV TENANT A')
         or (ao.id = 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid and ao.name = 'CORSYS DEV TENANT B')
    ) <> 2 then 'FAILED_DEV_IDENTITY_ANCHOR'
    when max(a.id::text) is not null and max(o.id::text) is not null and max(ur_cnt.cnt) = 2 then 'COMMITTED'
    when max(a.id::text) is null and max(o.id::text) is null and coalesce(max(ur_cnt.cnt), 0) = 0 then 'DRY_RUN_ROLLED_BACK'
    else 'FAILED_INCONSISTENT_STATE'
  end as execution_status,
  max(c.round_id) as round_id,
  max(c.expected_org_id::text)::uuid as organization_id,
  max(coalesce(a.after_data ->> 'organization_name', 'QA_CLOSURE_' || c.round_id)) as organization_name,
  coalesce((array_agg(a.after_data -> 'created_user_roles') filter (where a.after_data is not null))[1], '[]'::jsonb) as committed_user_roles,
  coalesce(max(ur_cnt.cnt), 0) as persisted_user_roles_count
from pg_temp._m0203_prepare_ctx c
left join public.organizations o on o.id = c.expected_org_id
left join public.audit_logs a
  on a.organization_id = c.expected_org_id
 and a.action = 'dev_qa.m0203_closure_prepare'
 and upper(coalesce(a.after_data ->> 'round_id', '')) = c.round_id
left join lateral (
  select count(*)::integer as cnt
  from public.user_roles ur
  where ur.organization_id = c.expected_org_id
) ur_cnt on true;
