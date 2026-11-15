-- Teste transacional determinístico (ROLLBACK) para 20261115120000_v35_tenant_timezone_financial_dates.sql
-- Verifica:
-- 1. Assinaturas, SECURITY DEFINER, search_path='' e permissões EXECUTE (anon/PUBLIC revogados, authenticated concedido nas RPCs públicas).
-- 2. Ausência de uso residual de current_date em funções escopadas por Loja.
-- 3. Validação estrita de fuso horário IANA (private.is_valid_iana_timezone e trigger organization_settings_timezone_guard com SQLSTATE 22023).
-- 4. Cálculo determinístico de data civil por Loja (private.tenant_current_date_at / private.tenant_current_date) em múltiplos fusos e na virada de dia/mês.
-- 5. Fronteiras de mês e fuso horário em:
--    - public.close_financial_period_idempotent e public.reopen_financial_period_idempotent
--    - public.correct_institutional_payable (política de aprovação vigente na data civil da Loja)
--    - private.validate_mutual_batch_input, public.preview_mutual_batch e public.create_mutual_batch
--    - public.read_tenant_financial_dashboard, public.read_tenant_delinquency_bucket_summary e public.read_tenant_delinquency_filtered
--    - Isolamento entre Lojas (SQLSTATE 42501).

begin;

do $$
declare
  v_org_sp uuid := '10000000-0000-4000-8000-000000000101';
  v_org_am uuid := '10000000-0000-4000-8000-000000000102';
  v_org_ac uuid := '10000000-0000-4000-8000-000000000103';
  v_org_utc uuid := '10000000-0000-4000-8000-000000000104';
  v_org_fallback uuid := '10000000-0000-4000-8000-000000000105';

  v_user_sp uuid := '20000000-0000-4000-8000-000000000201';
  v_user_utc uuid := '20000000-0000-4000-8000-000000000204';

  v_role_sp uuid := '30000000-0000-4000-8000-000000000301';
  v_role_utc uuid := '30000000-0000-4000-8000-000000000304';

  v_plan_sp uuid := '40000000-0000-4000-8000-000000000401';
  v_plan_utc uuid := '40000000-0000-4000-8000-000000000404';

  v_acc_rev_sp uuid := '50000000-0000-4000-8000-000000000501';
  v_acc_exp_sp uuid := '50000000-0000-4000-8000-000000000502';
  v_acc_rev_utc uuid := '50000000-0000-4000-8000-000000000504';
  v_acc_exp_utc uuid := '50000000-0000-4000-8000-000000000505';

  v_cat_mut_sp uuid := '60000000-0000-4000-8000-000000000601';
  v_cat_pay_sp uuid := '60000000-0000-4000-8000-000000000602';
  v_cat_mut_utc uuid := '60000000-0000-4000-8000-000000000604';
  v_cat_pay_utc uuid := '60000000-0000-4000-8000-000000000605';

  v_member_sp uuid := '70000000-0000-4000-8000-000000000701';
  v_member_utc uuid := '70000000-0000-4000-8000-000000000704';

  v_payable_sp uuid := '80000000-0000-4000-8000-000000000801';
  v_payable_utc uuid := '80000000-0000-4000-8000-000000000804';

  v_instant_2111_brt timestamptz := '2026-11-14T00:11:00Z'::timestamptz;
  v_instant_0030_brt timestamptz := '2026-11-14T03:30:00Z'::timestamptz;

  v_public_sigs text[] := array[
    'public.read_tenant_financial_dashboard(uuid)',
    'public.read_tenant_delinquency(uuid,integer,integer)',
    'public.read_tenant_delinquency_bucket_summary(uuid)',
    'public.read_tenant_delinquency_filtered(uuid,text,integer,integer)',
    'public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text)',
    'public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text)',
    'public.stage_tenant_bank_statement(uuid,uuid,text,text,jsonb,text,text)',
    'public.preview_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date)',
    'public.preview_monthly_charge_generation(uuid,uuid,date)',
    'public.create_tenant_monthly_rule(uuid,uuid,text,numeric,date,integer,text,text)',
    'public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text)',
    'public.schedule_member_configuration(uuid,uuid,text,uuid,date,date,text,numeric,text,text)',
    'public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text)',
    'public.create_tenant_institutional_monthly_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text)',
    'public.preview_institutional_monthly_generation(uuid,uuid,date)',
    'public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text)',
    'public.create_tenant_institutional_annual_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text)',
    'public.preview_institutional_annual_generation(uuid,uuid,date)',
    'public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text)',
    'public.preview_accounting_plan_publication(uuid,uuid)',
    'public.create_tenant_approval_policy_draft(uuid,text,text,numeric,integer,date,date,text,text)',
    'public.preview_agape_event(uuid,uuid,text,date,date,numeric,uuid[])',
    'public.preview_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb)',
    'public.create_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb,text,text,text)',
    'public.close_financial_period_idempotent(uuid,date,text,text)',
    'public.reopen_financial_period_idempotent(uuid,date,text,text)',
    'public.correct_institutional_payable(uuid,uuid,uuid,uuid,text,date,date,numeric,date,text)'
  ];
  v_private_sigs text[] := array[
    'private.is_valid_iana_timezone(text)',
    'private.validate_organization_settings_timezone()',
    'private.tenant_current_date_at(uuid,timestamptz)',
    'private.tenant_current_date(uuid)',
    'private.guard_tenant_accounting_change()',
    'private.validate_mutual_batch_input(uuid,integer,integer,numeric,date,date,date,jsonb)'
  ];
  v_sig text;
  v_oid oid;
  v_secdef boolean;
  v_config text[];
  v_period_id uuid;
  v_period_id_replay uuid;
  v_corr_sp uuid;
  v_corr_utc uuid;
  v_req_Approval boolean;
  v_preview_sp jsonb;
  v_preview_utc jsonb;
  v_batch_sp uuid;
  v_batch_sp_replay uuid;
  v_batch_utc uuid;
  v_dash_sp jsonb;
  v_dash_utc jsonb;
  v_summary_sp jsonb;
  v_summary_utc jsonb;
begin
  -- 1. Auditoria de catálogo: existência, SECURITY DEFINER, search_path='' e ACLs
  foreach v_sig in array v_public_sigs loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'missing public function signature: %', v_sig;
    end if;
    select prosecdef, proconfig into v_secdef, v_config from pg_proc where oid = v_oid;
    if not coalesce(v_secdef, false) then
      raise exception 'public function % must be SECURITY DEFINER', v_sig;
    end if;
    if not ('search_path=""' = any(coalesce(v_config, array[]::text[])) or 'search_path=' = any(coalesce(v_config, array[]::text[]))) then
      raise exception 'public function % must set empty search_path (got %)', v_sig, v_config;
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'anon must not have EXECUTE on %', v_sig;
    end if;
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'authenticated must have EXECUTE on %', v_sig;
    end if;
  end loop;

  foreach v_sig in array v_private_sigs loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'missing private function signature: %', v_sig;
    end if;
    select prosecdef, proconfig into v_secdef, v_config from pg_proc where oid = v_oid;
    if not coalesce(v_secdef, false) then
      raise exception 'private function % must be SECURITY DEFINER', v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE') or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'anon/authenticated must not have EXECUTE on private function %', v_sig;
    end if;
  end loop;

  -- 2. Validação de fusos IANA permitidos e rejeitados
  if not private.is_valid_iana_timezone('America/Sao_Paulo')
     or not private.is_valid_iana_timezone('America/Manaus')
     or not private.is_valid_iana_timezone('America/Rio_Branco')
     or not private.is_valid_iana_timezone('UTC') then
    raise exception 'expected valid IANA timezones to be accepted';
  end if;

  if private.is_valid_iana_timezone('')
     or private.is_valid_iana_timezone(null)
     or private.is_valid_iana_timezone('America/Invalid_City')
     or private.is_valid_iana_timezone('BRT')
     or private.is_valid_iana_timezone('UTC-3')
     or private.is_valid_iana_timezone('localtime')
     or private.is_valid_iana_timezone('posixrules')
     or private.is_valid_iana_timezone(' America/Sao_Paulo ') then
    raise exception 'expected invalid IANA timezones to be rejected';
  end if;

  -- 3. Preparação de Lojas em múltiplos fusos
  insert into public.organizations (id, number, name, status)
  values
    (v_org_sp, '99101', 'Loja Teste São Paulo', 'active'),
    (v_org_am, '99102', 'Loja Teste Manaus', 'active'),
    (v_org_ac, '99103', 'Loja Teste Rio Branco', 'active'),
    (v_org_utc, '99104', 'Loja Teste UTC', 'active'),
    (v_org_fallback, '99105', 'Loja Teste Sem Settings', 'active');

  insert into public.organization_settings (organization_id, timezone)
  values
    (v_org_sp, 'America/Sao_Paulo'),
    (v_org_am, 'America/Manaus'),
    (v_org_ac, 'America/Rio_Branco'),
    (v_org_utc, 'UTC');

  insert into public.saas_tenant_accounts (organization_id, billing_name, commercial_status, billing_provider)
  values
    (v_org_sp, 'Loja Teste São Paulo', 'active', 'manual'),
    (v_org_utc, 'Loja Teste UTC', 'active', 'manual');

  insert into public.saas_plans (id, code, name, billing_interval, price, currency, active)
  values ('90000000-0000-4000-8000-000000000901', 'TEST_ESSENTIAL_TZ', 'Plano Teste Timezone', 'monthly', 250.00, 'BRL', true)
  on conflict (code) do nothing;

  insert into public.saas_plan_versions (
    id, plan_id, version_number, status, price, currency, billing_interval, trial_days, grace_days, valid_from, published_at, display_name_snapshot, internal_code_snapshot
  )
  values (
    '90000000-0000-4000-8000-000000000902',
    (select id from public.saas_plans where code = 'TEST_ESSENTIAL_TZ'),
    1, 'published', 250.00, 'BRL', 'monthly', 0, 7, '2025-01-01', now(), 'Plano Teste Timezone', 'TEST_ESSENTIAL_TZ_V1'
  );

  insert into public.saas_subscriptions (organization_id, plan_id, plan_version_id, status, billing_provider)
  values
    (v_org_sp, (select id from public.saas_plans where code = 'TEST_ESSENTIAL_TZ'), '90000000-0000-4000-8000-000000000902', 'active', 'manual'),
    (v_org_utc, (select id from public.saas_plans where code = 'TEST_ESSENTIAL_TZ'), '90000000-0000-4000-8000-000000000902', 'active', 'manual');

  -- 4. Verificar que fuso inválido na tabela é rejeitado com SQLSTATE 22023
  begin
    update public.organization_settings
       set timezone = 'Invalid/Timezone_Name'
     where organization_id = v_org_sp;
    raise exception 'expected invalid timezone update to fail with 22023';
  exception
    when sqlstate '22023' then
      null;
  end;

  -- 5. Virada diária às 21:11 BRT (2026-11-14T00:11:00Z) e 00:30 BRT (2026-11-14T03:30:00Z)
  if private.tenant_current_date_at(v_org_sp, v_instant_2111_brt) <> date '2026-11-13' then
    raise exception 'America/Sao_Paulo at 2026-11-14T00:11:00Z must be 2026-11-13';
  end if;
  if private.tenant_current_date_at(v_org_am, v_instant_2111_brt) <> date '2026-11-13' then
    raise exception 'America/Manaus at 2026-11-14T00:11:00Z must be 2026-11-13';
  end if;
  if private.tenant_current_date_at(v_org_ac, v_instant_2111_brt) <> date '2026-11-13' then
    raise exception 'America/Rio_Branco at 2026-11-14T00:11:00Z must be 2026-11-13';
  end if;
  if private.tenant_current_date_at(v_org_utc, v_instant_2111_brt) <> date '2026-11-14' then
    raise exception 'UTC at 2026-11-14T00:11:00Z must be 2026-11-14';
  end if;
  if private.tenant_current_date_at(v_org_fallback, v_instant_2111_brt) <> date '2026-11-13' then
    raise exception 'Fallback timezone at 2026-11-14T00:11:00Z must default to America/Sao_Paulo (2026-11-13)';
  end if;

  if private.tenant_current_date_at(v_org_sp, v_instant_0030_brt) <> date '2026-11-14' then
    raise exception 'America/Sao_Paulo at 2026-11-14T03:30:00Z must be 2026-11-14';
  end if;
  if private.tenant_current_date_at(v_org_am, v_instant_0030_brt) <> date '2026-11-13' then
    raise exception 'America/Manaus at 2026-11-14T03:30:00Z must still be 2026-11-13';
  end if;

  -- 6. Preparar dados financeiros completos para v_org_sp (America/Sao_Paulo) e v_org_utc (UTC)
  insert into auth.users (id, email)
  values
    (v_user_sp, 'tesoureiro.sp@loja.test'),
    (v_user_utc, 'tesoureiro.utc@loja.test');

  insert into public.roles (id, organization_id, code, name, is_system)
  values
    (v_role_sp, v_org_sp, 'TESOUREIRO_SP', 'Tesoureiro SP', false),
    (v_role_utc, v_org_utc, 'TESOUREIRO_UTC', 'Tesoureiro UTC', false);

  insert into public.role_permissions (role_id, permission_code)
  select r.role_id, p.code
  from (values (v_role_sp), (v_role_utc)) as r(role_id)
  cross join public.permissions p;

  insert into public.user_roles (organization_id, user_id, role_id)
  values
    (v_org_sp, v_user_sp, v_role_sp),
    (v_org_utc, v_user_utc, v_role_utc);

  -- Categorias criadas antes da publicação do plano contábil
  insert into public.financial_categories (id, organization_id, name, domain, active)
  values
    (v_cat_mut_sp, v_org_sp, 'Chamada de Mútua SP', 'member_receivable', true),
    (v_cat_pay_sp, v_org_sp, 'Fornecedor Institucional SP', 'institutional_expense', true),
    (v_cat_mut_utc, v_org_utc, 'Chamada de Mútua UTC', 'member_receivable', true),
    (v_cat_pay_utc, v_org_utc, 'Fornecedor Institucional UTC', 'institutional_expense', true);

  -- Planos contábeis criados em 'draft', populados com contas/mapeamentos e depois publicados (2025..2028)
  insert into public.accounting_plans (id, organization_id, name, status, valid_from, valid_to, created_by)
  values
    (v_plan_sp, v_org_sp, 'Plano SP 2025-2028', 'draft', '2025-01-01', '2028-12-31', v_user_sp),
    (v_plan_utc, v_org_utc, 'Plano UTC 2025-2028', 'draft', '2025-01-01', '2028-12-31', v_user_utc);

  insert into public.accounting_accounts (
    id, organization_id, accounting_plan_id, code, description, row_type, nature,
    operational_classification, active
  )
  values
    (v_acc_rev_sp, v_org_sp, v_plan_sp, '3.1.01', 'Receita Mútua SP', 'analytic', 'revenue', 'ad_hoc', true),
    (v_acc_exp_sp, v_org_sp, v_plan_sp, '4.1.01', 'Despesa Geral SP', 'analytic', 'expense', 'fixed', true),
    (v_acc_rev_utc, v_org_utc, v_plan_utc, '3.1.01', 'Receita Mútua UTC', 'analytic', 'revenue', 'ad_hoc', true),
    (v_acc_exp_utc, v_org_utc, v_plan_utc, '4.1.01', 'Despesa Geral UTC', 'analytic', 'expense', 'fixed', true);

  insert into public.financial_category_account_mappings (
    organization_id, accounting_plan_id, category_id, accounting_account_id
  )
  values
    (v_org_sp, v_plan_sp, v_cat_mut_sp, v_acc_rev_sp),
    (v_org_sp, v_plan_sp, v_cat_pay_sp, v_acc_exp_sp),
    (v_org_utc, v_plan_utc, v_cat_mut_utc, v_acc_rev_utc),
    (v_org_utc, v_plan_utc, v_cat_pay_utc, v_acc_exp_utc);

  update public.accounting_plans
     set status = 'published',
         published_at = now(),
         published_by = created_by
   where id in (v_plan_sp, v_plan_utc);

  insert into public.members (id, organization_id, full_name, degree_or_office, status)
  values
    (v_member_sp, v_org_sp, 'Irmão SP', 'Mestre', 'active'),
    (v_member_utc, v_org_utc, 'Irmão UTC', 'Mestre', 'active');

  -- Políticas de aprovação publicadas:
  -- Em Novembro/2026 (2026-11-01..2026-11-30): mode = 'all' (exige aprovação)
  -- Em Dezembro/2026 (2026-12-01..2026-12-31): mode = 'off' (dispensa aprovação)
  insert into public.expense_approval_policies (
    organization_id, name, mode, threshold_amount, minimum_approvers, status, valid_from, valid_to, created_by, published_at, published_by
  )
  values
    (v_org_sp, 'Política Nov SP', 'all', null, 1, 'published', '2026-11-01', '2026-11-30', v_user_sp, now(), v_user_sp),
    (v_org_sp, 'Política Dez SP', 'off', null, 1, 'published', '2026-12-01', '2026-12-31', v_user_sp, now(), v_user_sp),
    (v_org_utc, 'Política Nov UTC', 'all', null, 1, 'published', '2026-11-01', '2026-11-30', v_user_utc, now(), v_user_utc),
    (v_org_utc, 'Política Dez UTC', 'off', null, 1, 'published', '2026-12-01', '2026-12-31', v_user_utc, now(), v_user_utc);

  -- Contas a pagar institucionais postadas em cada Loja
  insert into public.institutional_payables (
    id, organization_id, category_id, accounting_plan_id, accounting_account_id,
    expense_classification, description, competence, issue_date, due_date,
    accounting_period, amount, posting_status, approval_required,
    approval_min_approvers, created_by, posted_by, posted_at
  )
  values
    (v_payable_sp, v_org_sp, v_cat_pay_sp, v_plan_sp, v_acc_exp_sp, 'fixed', 'Despesa SP Original', '2026-11-01', '2026-11-05', '2026-11-30', '2026-11-01', 150.00, 'posted', false, 0, v_user_sp, v_user_sp, now()),
    (v_payable_utc, v_org_utc, v_cat_pay_utc, v_plan_utc, v_acc_exp_utc, 'fixed', 'Despesa UTC Original', '2026-11-01', '2026-11-05', '2026-11-30', '2026-11-01', 150.00, 'posted', false, 0, v_user_utc, v_user_utc, now());

  -- Cobrança de integrante com vencimento em 2026-11-30 em cada Loja
  insert into public.charges (
    organization_id, member_id, category_id, source_kind, description,
    competence, issue_date, due_date, accounting_period, unit_amount, original_amount, created_by,
    accounting_plan_id, accounting_account_id
  )
  values
    (v_org_sp, v_member_sp, v_cat_mut_sp, 'manual', 'Mensalidade 30/11 SP', '2026-11-01', '2026-11-01', '2026-11-30', '2026-11-01', 200.00, 200.00, v_user_sp, v_plan_sp, v_acc_rev_sp),
    (v_org_utc, v_member_utc, v_cat_mut_utc, 'manual', 'Mensalidade 30/11 UTC', '2026-11-01', '2026-11-01', '2026-11-30', '2026-11-01', 200.00, 200.00, v_user_utc, v_plan_utc, v_acc_rev_utc);

  -- 7. Fixar relógio de referência na virada de mês (2026-12-01T02:30:00Z = 2026-11-30 23:30 BRT)
  --    apenas dentro desta transação de teste (revertida pelo ROLLBACK final)
  create or replace function private.tenant_current_date(p_organization_id uuid)
  returns date
  language sql
  stable
  security definer
  set search_path = ''
  as $mock$
    select private.tenant_current_date_at(p_organization_id, '2026-12-01T02:30:00Z'::timestamptz);
  $mock$;
  revoke all on function private.tenant_current_date(uuid) from PUBLIC, anon, authenticated;

  -- Confirmar datas civis distintas no mesmo instante: SP = 2026-11-30, UTC = 2026-12-01
  if private.tenant_current_date(v_org_sp) <> date '2026-11-30' then
    raise exception 'expected v_org_sp civil date to be 2026-11-30, got %', private.tenant_current_date(v_org_sp);
  end if;
  if private.tenant_current_date(v_org_utc) <> date '2026-12-01' then
    raise exception 'expected v_org_utc civil date to be 2026-12-01, got %', private.tenant_current_date(v_org_utc);
  end if;

  -- =========================================================================
  -- 8. Teste de Fronteira de Mês: close_financial_period_idempotent / reopen_financial_period_idempotent
  -- =========================================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_sp::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  -- 8a. Em SP (2026-11-30), fechar competência futura 2026-12-01 deve falhar com 22023
  begin
    perform public.close_financial_period_idempotent(v_org_sp, date '2026-12-01', 'Tentativa precoce antes da meia-noite BRT', 'idem-close-dec-sp');
    raise exception 'expected close_financial_period_idempotent(2026-12-01) to fail in America/Sao_Paulo on 2026-11-30';
  exception
    when sqlstate '22023' then
      null;
  end;

  -- 8b. Em SP (2026-11-30), fechar e reabrir 2026-10-01 funciona com idempotência
  v_period_id := public.close_financial_period_idempotent(v_org_sp, date '2026-10-01', 'Fechamento outubro SP', 'idem-close-oct-sp');
  v_period_id_replay := public.close_financial_period_idempotent(v_org_sp, date '2026-10-01', 'Fechamento outubro SP', 'idem-close-oct-sp');
  if v_period_id is null or v_period_id <> v_period_id_replay then
    raise exception 'close_financial_period_idempotent must be idempotent';
  end if;

  v_period_id_replay := public.reopen_financial_period_idempotent(v_org_sp, date '2026-10-01', 'Reabertura outubro SP', 'idem-reopen-oct-sp');
  if v_period_id_replay is null then
    raise exception 'reopen_financial_period_idempotent must return reopen event id';
  end if;
  if public.reopen_financial_period_idempotent(v_org_sp, date '2026-10-01', 'Reabertura outubro SP', 'idem-reopen-oct-sp') <> v_period_id_replay then
    raise exception 'reopen_financial_period_idempotent must be idempotent';
  end if;

  -- 8c. Em SP (2026-11-30), reabrir competência futura 2026-12-01 deve falhar com 22023
  begin
    perform public.reopen_financial_period_idempotent(v_org_sp, date '2026-12-01', 'Tentativa reabrir dezembro em novembro BRT', 'idem-reopen-dec-sp');
    raise exception 'expected reopen_financial_period_idempotent(2026-12-01) to fail with 22023 in America/Sao_Paulo on 2026-11-30';
  exception
    when sqlstate '22023' then
      null;
  end;

  -- 8d. Isolamento entre Lojas: usuário SP tentando fechar período na Loja UTC deve falhar com 42501
  begin
    perform public.close_financial_period_idempotent(v_org_utc, date '2026-11-01', 'Tentativa cruzada', 'idem-cross-close');
    raise exception 'expected cross-tenant close_financial_period_idempotent to fail with 42501';
  exception
    when sqlstate '42501' then
      null;
  end;

  -- 8e. Na Loja UTC (já em 2026-12-01), fechar e reabrir 2026-12-01 é permitido
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_utc::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v_period_id := public.close_financial_period_idempotent(v_org_utc, date '2026-12-01', 'Fechamento dezembro UTC', 'idem-close-dec-utc');
  if v_period_id is null then
    raise exception 'expected close_financial_period_idempotent(2026-12-01) to succeed in UTC on 2026-12-01';
  end if;
  perform public.reopen_financial_period_idempotent(v_org_utc, date '2026-12-01', 'Reabertura dezembro UTC', 'idem-reopen-dec-utc');

  -- =========================================================================
  -- 9. Teste de Fronteira de Mês: correct_institutional_payable (política vigente por Loja)
  -- =========================================================================
  -- Em SP (2026-11-30), a política vigente é 'Política Nov SP' (mode = 'all' -> approval_required = true)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_sp::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v_corr_sp := public.correct_institutional_payable(
    v_org_sp, v_payable_sp, v_cat_pay_sp, null,
    'Despesa SP Corrigida em 30/11 BRT', date '2026-11-01', date '2026-11-30',
    180.00, date '2026-11-01', 'Ajuste de valor dentro de novembro BRT'
  );
  select c.approval_required into strict v_req_Approval
  from public.institutional_payable_corrections c
  where c.id = v_corr_sp;
  if v_req_Approval is not true then
    raise exception 'expected correct_institutional_payable in SP (2026-11-30) to use Nov policy (approval_required = true)';
  end if;

  -- Em UTC (2026-12-01), a política vigente é 'Política Dez UTC' (mode = 'off' -> approval_required = false)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_utc::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v_corr_utc := public.correct_institutional_payable(
    v_org_utc, v_payable_utc, v_cat_pay_utc, null,
    'Despesa UTC Corrigida em 01/12 UTC', date '2026-11-01', date '2026-11-30',
    180.00, date '2026-11-01', 'Ajuste de valor já em dezembro UTC'
  );
  select c.approval_required into strict v_req_Approval
  from public.institutional_payable_corrections c
  where c.id = v_corr_utc;
  if v_req_Approval is not false then
    raise exception 'expected correct_institutional_payable in UTC (2026-12-01) to use Dec policy (approval_required = false)';
  end if;

  -- =========================================================================
  -- 10. Teste de Fronteira de Mês e Fluxo Completo de Mútua:
  --     private.validate_mutual_batch_input + public.preview_mutual_batch + public.create_mutual_batch
  -- =========================================================================
  -- Na Loja SP (data civil 2026-11-30, mês corrente 2026-11-01):
  --   Janela válida de competência: [2025-11-01, 2027-11-01] (isto é, < 2027-12-01).
  -- Na Loja UTC (data civil 2026-12-01, mês corrente 2026-12-01):
  --   Janela válida de competência: [2025-12-01, 2027-12-01] (isto é, < 2028-01-01).

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_sp::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  -- 10a. Competência 2027-12-01 deve ser REJEITADA (22023) na Loja SP (ainda em 2026-11-30) tanto no preview quanto no create
  begin
    perform public.preview_mutual_batch(
      v_org_sp, v_cat_mut_sp, 1, 1, 50.00,
      date '2027-12-01', date '2027-12-05', date '2027-12-20',
      jsonb_build_array(jsonb_build_object('mutual_number', 1, 'member_id', v_member_sp::text))
    );
    raise exception 'expected preview_mutual_batch(2027-12-01) to fail in SP on 2026-11-30';
  exception
    when sqlstate '22023' then
      null;
  end;

  begin
    perform public.create_mutual_batch(
      v_org_sp, v_cat_mut_sp, 1, 1, 50.00,
      date '2027-12-01', date '2027-12-05', date '2027-12-20',
      jsonb_build_array(jsonb_build_object('mutual_number', 1, 'member_id', v_member_sp::text)),
      repeat('a', 64), 'Tentativa lote fora da janela de SP', 'idem-mut-out-sp'
    );
    raise exception 'expected create_mutual_batch(2027-12-01) to fail in SP on 2026-11-30';
  exception
    when sqlstate '22023' then
      null;
  end;

  -- Confirmar que create_mutual_batch rejeitado NÃO inseriu período indevido em financial_periods
  if exists (select 1 from public.financial_periods where organization_id = v_org_sp and period = date '2027-12-01') then
    raise exception 'rejected create_mutual_batch must not insert period into financial_periods';
  end if;

  -- 10b. Competência limite inferior 2025-11-01 (-12 meses de 2026-11-01) é VÁLIDA na Loja SP (preview + create + idempotência)
  v_preview_sp := public.preview_mutual_batch(
    v_org_sp, v_cat_mut_sp, 10, 10, 75.00,
    date '2025-11-01', date '2025-11-10', date '2025-11-25',
    jsonb_build_array(jsonb_build_object('mutual_number', 10, 'member_id', v_member_sp::text))
  );
  if (v_preview_sp->>'ready')::boolean is not true then
    raise exception 'expected preview_mutual_batch(2025-11-01) to be ready in SP on 2026-11-30';
  end if;

  v_batch_sp := public.create_mutual_batch(
    v_org_sp, v_cat_mut_sp, 10, 10, 75.00,
    date '2025-11-01', date '2025-11-10', date '2025-11-25',
    jsonb_build_array(jsonb_build_object('mutual_number', 10, 'member_id', v_member_sp::text)),
    v_preview_sp->>'fingerprint', 'Emissão lote mútua fronteira -12m SP', 'idem-mut-valid-sp'
  );
  v_batch_sp_replay := public.create_mutual_batch(
    v_org_sp, v_cat_mut_sp, 10, 10, 75.00,
    date '2025-11-01', date '2025-11-10', date '2025-11-25',
    jsonb_build_array(jsonb_build_object('mutual_number', 10, 'member_id', v_member_sp::text)),
    v_preview_sp->>'fingerprint', 'Emissão lote mútua fronteira -12m SP', 'idem-mut-valid-sp'
  );
  if v_batch_sp is null or v_batch_sp <> v_batch_sp_replay then
    raise exception 'create_mutual_batch must create batch and return idempotent result on replay';
  end if;

  -- 10c. Já na Loja UTC (data civil 2026-12-01), 2025-11-01 está FORA da janela (-13 meses -> 22023),
  --      enquanto 2027-12-01 (+12 meses de 2026-12-01) é VÁLIDA!
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_utc::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  begin
    perform public.preview_mutual_batch(
      v_org_utc, v_cat_mut_utc, 1, 1, 50.00,
      date '2025-11-01', date '2025-11-10', date '2025-11-25',
      jsonb_build_array(jsonb_build_object('mutual_number', 1, 'member_id', v_member_utc::text))
    );
    raise exception 'expected preview_mutual_batch(2025-11-01) to fail in UTC on 2026-12-01';
  exception
    when sqlstate '22023' then
      null;
  end;

  v_preview_utc := public.preview_mutual_batch(
    v_org_utc, v_cat_mut_utc, 20, 20, 90.00,
    date '2027-12-01', date '2027-12-05', date '2027-12-20',
    jsonb_build_array(jsonb_build_object('mutual_number', 20, 'member_id', v_member_utc::text))
  );
  v_batch_utc := public.create_mutual_batch(
    v_org_utc, v_cat_mut_utc, 20, 20, 90.00,
    date '2027-12-01', date '2027-12-05', date '2027-12-20',
    jsonb_build_array(jsonb_build_object('mutual_number', 20, 'member_id', v_member_utc::text)),
    v_preview_utc->>'fingerprint', 'Emissão lote mútua +12m UTC', 'idem-mut-valid-utc'
  );
  if v_batch_utc is null then
    raise exception 'expected create_mutual_batch(2027-12-01) to succeed in UTC on 2026-12-01';
  end if;

  -- =========================================================================
  -- 11. Dashboard e Inadimplência na virada de dia/mês (SP 2026-11-30 vs UTC 2026-12-01)
  -- =========================================================================
  -- Título de 200.00 e conta a pagar de 180.00 com due_date = 2026-11-30:
  --   Em SP (2026-11-30): ainda NÃO venceram hoje (payables_overdue = 0.00, up30 member_count = 0,
  --     receivables_overdue = 75.00 referente apenas ao lote de Mútua de 2025-11-25 emitido no passo 10b).
  --   Em UTC (2026-12-01): JÁ venceram há 1 dia (payables_overdue = 180.00, up30 member_count = 1,
  --     receivables_overdue = 200.00).
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_sp::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v_dash_sp := public.read_tenant_financial_dashboard(v_org_sp);
  select to_jsonb(s) into strict v_summary_sp
  from public.read_tenant_delinquency_bucket_summary(v_org_sp) s
  where s.bucket_id = 'up30';
  if v_dash_sp->>'as_of' <> '2026-11-30'
     or (v_dash_sp->>'receivables_overdue')::numeric <> 75.00
     or (v_dash_sp->>'payables_overdue')::numeric <> 0.00 then
    raise exception 'expected SP dashboard at 2026-11-30 to have 75.00 overdue receivables and 0.00 overdue payables, got %', v_dash_sp;
  end if;
  if v_summary_sp->>'server_date' <> '2026-11-30' or (v_summary_sp->>'member_count')::integer <> 0 then
    raise exception 'expected SP delinquency summary at 2026-11-30 to have 0 overdue members in up30, got %', v_summary_sp;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_utc::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  v_dash_utc := public.read_tenant_financial_dashboard(v_org_utc);
  select to_jsonb(s) into strict v_summary_utc
  from public.read_tenant_delinquency_bucket_summary(v_org_utc) s
  where s.bucket_id = 'up30';
  if v_dash_utc->>'as_of' <> '2026-12-01'
     or (v_dash_utc->>'receivables_overdue')::numeric <> 200.00
     or (v_dash_utc->>'payables_overdue')::numeric <> 180.00 then
    raise exception 'expected UTC dashboard at 2026-12-01 to have 200.00 overdue receivables and 180.00 overdue payables, got %', v_dash_utc;
  end if;
  if v_summary_utc->>'server_date' <> '2026-12-01' or (v_summary_utc->>'member_count')::integer <> 1 then
    raise exception 'expected UTC delinquency summary at 2026-12-01 to have 1 overdue member in up30, got %', v_summary_utc;
  end if;
end;
$$;

rollback;
