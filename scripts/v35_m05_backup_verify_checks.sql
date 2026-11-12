-- ==============================================================================
-- CorSys Tronco Digital V35 — M05.02: Checks de Comparação e Verificação Pós-Restore
-- PostgreSQL 17 Descartável / Validação de Integridade e Isolamento Multi-Tenant
--
-- Execução:
--   psql -X -v ON_ERROR_STOP=1 -f scripts/v35_m05_backup_verify_checks.sql
--
-- O script executa assertivas determinísticas e falha explicitamente
-- com RAISE EXCEPTION se houver qualquer divergência de contagem, centavos,
-- integridade referencial ou isolamento RLS/permissões.
-- ==============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- BLOCO 1: Verificação de Contagens, Vínculos e Valores em Centavos
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_a UUID := '00000000-0000-4000-8000-000000000001';
  v_org_b UUID := '00000000-0000-4000-8000-000000000002';

  v_count_orgs INTEGER;
  v_count_members_a INTEGER;
  v_count_members_b INTEGER;
  v_count_links_a INTEGER;
  v_count_links_b INTEGER;
  v_count_payables_a INTEGER;
  v_count_payables_b INTEGER;
  v_count_charges_a INTEGER;
  v_count_charges_b INTEGER;
  v_count_tickets_a INTEGER;
  v_count_tickets_b INTEGER;
  v_count_tickets_internal INTEGER;
  v_count_events_total INTEGER;
  v_count_audit_a INTEGER;
  v_count_audit_b INTEGER;
  v_count_master_audit INTEGER;

  v_sum_payables_cents_a BIGINT;
  v_sum_payables_cents_b BIGINT;
  v_sum_charges_cents_a BIGINT;
  v_sum_charges_cents_b BIGINT;
BEGIN
  -- 1. Contagens de Organizações
  SELECT count(*) INTO v_count_orgs FROM public.organizations WHERE id IN (v_org_a, v_org_b);
  IF v_count_orgs <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Expected 2 organizations, found %', v_count_orgs;
  END IF;

  -- 2. Contagens de Integrantes
  SELECT count(*) INTO v_count_members_a FROM public.members WHERE organization_id = v_org_a;
  SELECT count(*) INTO v_count_members_b FROM public.members WHERE organization_id = v_org_b;
  IF v_count_members_a <> 2 OR v_count_members_b <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Members count mismatch (Org A: %, Org B: %)', v_count_members_a, v_count_members_b;
  END IF;

  -- 3. Vínculos de Usuários (member_user_links)
  SELECT count(*) INTO v_count_links_a FROM public.member_user_links WHERE organization_id = v_org_a;
  SELECT count(*) INTO v_count_links_b FROM public.member_user_links WHERE organization_id = v_org_b;
  IF v_count_links_a <> 1 OR v_count_links_b <> 1 THEN
    RAISE EXCEPTION 'CHECK FAILED: User links count mismatch (Org A: %, Org B: %)', v_count_links_a, v_count_links_b;
  END IF;

  -- 4. Contagens de Contas a Pagar
  SELECT count(*) INTO v_count_payables_a FROM public.institutional_payables WHERE organization_id = v_org_a;
  SELECT count(*) INTO v_count_payables_b FROM public.institutional_payables WHERE organization_id = v_org_b;
  IF v_count_payables_a <> 2 OR v_count_payables_b <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Payables count mismatch (Org A: %, Org B: %)', v_count_payables_a, v_count_payables_b;
  END IF;

  -- 5. Valores Exatos em Centavos (Preservação Integral sem Arredondamentos Decimais)
  -- Loja A: 10000.25 + 5000.25 = 15000.50 -> 1.500.050 centavos
  -- Loja B:  7000.15 + 5000.10 = 12000.25 -> 1.200.025 centavos
  SELECT coalesce(sum(round(amount * 100)::bigint), 0) INTO v_sum_payables_cents_a
  FROM public.institutional_payables WHERE organization_id = v_org_a;

  SELECT coalesce(sum(round(amount * 100)::bigint), 0) INTO v_sum_payables_cents_b
  FROM public.institutional_payables WHERE organization_id = v_org_b;

  IF v_sum_payables_cents_a <> 1500050 THEN
    RAISE EXCEPTION 'CHECK FAILED: Payables cents mismatch for Loja A: expected 1500050, got %', v_sum_payables_cents_a;
  END IF;

  IF v_sum_payables_cents_b <> 1200025 THEN
    RAISE EXCEPTION 'CHECK FAILED: Payables cents mismatch for Loja B: expected 1200025, got %', v_sum_payables_cents_b;
  END IF;

  -- 6. Valores Exatos em Centavos de Cobranças (Charges)
  -- Loja A: 500.00 + 300.00 = 800.00 -> 80.000 centavos
  -- Loja B: 400.00 + 200.00 = 600.00 -> 60.000 centavos
  SELECT coalesce(sum(round(original_amount * 100)::bigint), 0) INTO v_sum_charges_cents_a
  FROM public.charges WHERE organization_id = v_org_a;

  SELECT coalesce(sum(round(original_amount * 100)::bigint), 0) INTO v_sum_charges_cents_b
  FROM public.charges WHERE organization_id = v_org_b;

  IF v_sum_charges_cents_a <> 80000 THEN
    RAISE EXCEPTION 'CHECK FAILED: Charges cents mismatch for Loja A: expected 80000, got %', v_sum_charges_cents_a;
  END IF;

  IF v_sum_charges_cents_b <> 60000 THEN
    RAISE EXCEPTION 'CHECK FAILED: Charges cents mismatch for Loja B: expected 60000, got %', v_sum_charges_cents_b;
  END IF;

  -- 7. Chamados de Suporte e Trilha de Eventos (M04.03-C)
  SELECT count(*) INTO v_count_tickets_a FROM public.saas_support_tickets WHERE organization_id = v_org_a;
  SELECT count(*) INTO v_count_tickets_b FROM public.saas_support_tickets WHERE organization_id = v_org_b;
  SELECT count(*) INTO v_count_tickets_internal FROM public.saas_support_tickets WHERE ticket_scope = 'internal';

  IF v_count_tickets_a <> 1 OR v_count_tickets_b <> 1 OR v_count_tickets_internal <> 1 THEN
    RAISE EXCEPTION 'CHECK FAILED: Tickets count mismatch (A: %, B: %, Internal: %)',
      v_count_tickets_a, v_count_tickets_b, v_count_tickets_internal;
  END IF;

  SELECT count(*) INTO v_count_events_total FROM public.saas_support_ticket_events;
  IF v_count_events_total <> 5 THEN
    RAISE EXCEPTION 'CHECK FAILED: Support ticket events total expected 5, found %', v_count_events_total;
  END IF;

  -- 8. Auditoria de Tenant e Auditoria Master
  SELECT count(*) INTO v_count_audit_a FROM public.audit_logs WHERE organization_id = v_org_a;
  SELECT count(*) INTO v_count_audit_b FROM public.audit_logs WHERE organization_id = v_org_b;
  IF v_count_audit_a <> 2 OR v_count_audit_b <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Tenant audit logs count mismatch (A: %, B: %)', v_count_audit_a, v_count_audit_b;
  END IF;

  SELECT count(*) INTO v_count_master_audit FROM public.saas_master_audit_logs;
  IF v_count_master_audit <> 3 THEN
    RAISE EXCEPTION 'CHECK FAILED: Master audit logs expected 3, found %', v_count_master_audit;
  END IF;

  -- 9. Imutabilidade da Auditoria
  BEGIN
    UPDATE public.audit_logs SET reason = 'MUTATION_ATTEMPT' WHERE organization_id = v_org_a;
    RAISE EXCEPTION 'CHECK FAILED: audit_logs allowed UPDATE mutation!';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN NULL; -- Sucesso: trigger prevent_financial_mutation disparado
  END;

  BEGIN
    DELETE FROM public.saas_master_audit_logs WHERE action = 'support_session.open';
    RAISE EXCEPTION 'CHECK FAILED: saas_master_audit_logs allowed DELETE mutation!';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN NULL; -- Sucesso: trigger prevent_financial_mutation disparado
  END;

  RAISE NOTICE 'CHECK 1 PASS: Contagens, vínculos FK, valores em centavos e auditoria verificados com sucesso.';
END $$;


-- -----------------------------------------------------------------------------
-- BLOCO 2: Verificação Transacional de Acesso e Isolamento — Loja A
-- -----------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  v_user_a UUID := '00000000-0000-4000-8000-000000000011';
  v_org_a UUID := '00000000-0000-4000-8000-000000000001';
  v_org_b UUID := '00000000-0000-4000-8000-000000000002';
  v_count INTEGER;
  v_rec RECORD;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Loja A deve enxergar exatamente seus 2 integrantes
  SELECT count(*) INTO v_count FROM public.members WHERE organization_id = v_org_a;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Loja A did not see its 2 members (found %)', v_count;
  END IF;

  -- Loja A NUNCA deve enxergar integrantes da Loja B
  SELECT count(*) INTO v_count FROM public.members WHERE organization_id = v_org_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Loja A read % members from Loja B', v_count;
  END IF;

  -- Loja A NUNCA deve enxergar contas a pagar da Loja B
  SELECT count(*) INTO v_count FROM public.institutional_payables WHERE organization_id = v_org_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Loja A read % payables from Loja B', v_count;
  END IF;

  -- Loja A deve enxergar apenas o evento visível ao cliente de seu chamado (1 evento)
  SELECT count(*) INTO v_count FROM public.saas_support_ticket_events WHERE organization_id = v_org_a;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CHECK FAILED: Loja A expected 1 customer event, found %', v_count;
  END IF;

  -- Loja A NUNCA deve enxergar eventos da Loja B
  SELECT count(*) INTO v_count FROM public.saas_support_ticket_events WHERE organization_id = v_org_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Loja A read % events from Loja B', v_count;
  END IF;

  -- Proteção de Projeção M04.03-C: Acesso às colunas reason e actor_user_id DEVE FALHAR
  BEGIN
    EXECUTE 'SELECT reason FROM public.saas_support_ticket_events LIMIT 1';
    RAISE EXCEPTION 'SECURITY BREACH: Column reason was readable by Loja A user!';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL; -- Sucesso: coluna bloqueada por grant
  END;

  BEGIN
    EXECUTE 'SELECT actor_user_id FROM public.saas_support_ticket_events LIMIT 1';
    RAISE EXCEPTION 'SECURITY BREACH: Column actor_user_id was readable by Loja A user!';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL; -- Sucesso: coluna bloqueada por grant
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'CHECK 2 PASS: Isolamento e projeção restrita da Loja A verificados com sucesso.';
END $$;
ROLLBACK;


-- -----------------------------------------------------------------------------
-- BLOCO 3: Verificação Transacional de Acesso e Isolamento — Loja B
-- -----------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  v_user_b UUID := '00000000-0000-4000-8000-000000000012';
  v_org_a UUID := '00000000-0000-4000-8000-000000000001';
  v_org_b UUID := '00000000-0000-4000-8000-000000000002';
  v_count INTEGER;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user_b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Loja B deve enxergar exatamente seus 2 integrantes
  SELECT count(*) INTO v_count FROM public.members WHERE organization_id = v_org_b;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CHECK FAILED: Loja B did not see its 2 members (found %)', v_count;
  END IF;

  -- Loja B NUNCA deve enxergar integrantes da Loja A
  SELECT count(*) INTO v_count FROM public.members WHERE organization_id = v_org_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Loja B read % members from Loja A', v_count;
  END IF;

  -- Loja B NUNCA deve enxergar contas a pagar da Loja A
  SELECT count(*) INTO v_count FROM public.institutional_payables WHERE organization_id = v_org_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Loja B read % payables from Loja A', v_count;
  END IF;

  -- Loja B deve enxergar apenas o evento visível ao cliente de seu chamado (1 evento)
  SELECT count(*) INTO v_count FROM public.saas_support_ticket_events WHERE organization_id = v_org_b;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CHECK FAILED: Loja B expected 1 customer event, found %', v_count;
  END IF;

  -- Proteção de Projeção M04.03-C: Acesso a reason e actor_user_id bloqueado para Loja B
  BEGIN
    EXECUTE 'SELECT reason FROM public.saas_support_ticket_events LIMIT 1';
    RAISE EXCEPTION 'SECURITY BREACH: Column reason was readable by Loja B user!';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    EXECUTE 'SELECT actor_user_id FROM public.saas_support_ticket_events LIMIT 1';
    RAISE EXCEPTION 'SECURITY BREACH: Column actor_user_id was readable by Loja B user!';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'CHECK 3 PASS: Isolamento e projeção restrita da Loja B verificados com sucesso.';
END $$;
ROLLBACK;


-- -----------------------------------------------------------------------------
-- BLOCO 4: Verificação Transacional de Acesso Anônimo (Fail-Closed)
-- -----------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  EXECUTE 'SET LOCAL ROLE anon';

  -- Membros: deve lançar 42501 ou retornar 0
  BEGIN
    SELECT count(*) INTO v_count FROM public.members;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'SECURITY BREACH: Anonymous role read % members!', v_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL; -- 42501 esperado
  END;

  -- Contas a Pagar: deve lançar 42501 ou retornar 0
  BEGIN
    SELECT count(*) INTO v_count FROM public.institutional_payables;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'SECURITY BREACH: Anonymous role read % payables!', v_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- Eventos de Suporte: deve lançar 42501 ou retornar 0
  BEGIN
    SELECT count(*) INTO v_count FROM public.saas_support_ticket_events;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'SECURITY BREACH: Anonymous role read % support ticket events!', v_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- Auditoria: deve lançar 42501 ou retornar 0
  BEGIN
    SELECT count(*) INTO v_count FROM public.audit_logs;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'SECURITY BREACH: Anonymous role read % audit logs!', v_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'CHECK 4 PASS: Negação anônima (fail-closed) verificada com sucesso.';
END $$;
ROLLBACK;


-- -----------------------------------------------------------------------------
-- BLOCO 5: Verificação de Master — Negativa AAL1 vs Acesso AAL2
-- -----------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  v_master UUID := '00000000-0000-4000-8000-000000000099';
  v_count INTEGER;
BEGIN
  -- 1. Teste de Master com AAL1 (sem MFA)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_master, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.saas_support_ticket_events;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY BREACH: Master AAL1 was able to read % events without MFA!', v_count;
  END IF;

  -- 2. Teste de Master com AAL2 (com MFA)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_master, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  SELECT count(*) INTO v_count FROM public.saas_support_ticket_events;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'CHECK FAILED: Master AAL2 expected 5 events (customer + internal), found %', v_count;
  END IF;

  -- 3. Mesmo Master AAL2 tem razão bloqueada na coluna saas_support_ticket_events
  BEGIN
    EXECUTE 'SELECT reason FROM public.saas_support_ticket_events LIMIT 1';
    RAISE EXCEPTION 'SECURITY BREACH: Column reason was readable by Master authenticated role!';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL; -- Sucesso: apenas service_role pode consultar reason
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'CHECK 5 PASS: Master AAL1 negado e Master AAL2 autorizado com privilégio mínimo.';
END $$;
ROLLBACK;

SELECT 'V35_M0502_VERIFICATION_PASS' AS status;
