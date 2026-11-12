-- ==============================================================================
-- CorSys Tronco Digital V35 — M05.02: Fixture Sintética Reproduzível de Duas Lojas
-- PostgreSQL 17 Descartável / Ambiente de Ensaio de Backup & Restauração
--
-- PRE-REQUISITOS OBRIGATÓRIOS ANTES DA CARGA/RESTORE:
--   1. Schemas: public, private, auth, extensions
--   2. Extensões: pgcrypto, btree_gist (no schema extensions)
--   3. Papéis (Roles): postgres, anon, authenticated, service_role
--   4. Funções de compatibilidade Auth: auth.uid(), auth.jwt(), auth.role()
--   5. Migrations do repositório aplicadas até a HEAD (incluindo V35)
-- ==============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Identidades Sintéticas de Autenticação (auth.users)
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'user.loja.a@corsys.synthetic', '{"name":"Operador Loja A"}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000012', 'user.loja.b@corsys.synthetic', '{"name":"Operador Loja B"}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000099', 'master.platform@corsys.synthetic', '{"name":"Operador Master"}'::jsonb, now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Perfis de Usuário (public.user_profiles)
-- -----------------------------------------------------------------------------
INSERT INTO public.user_profiles (user_id, display_name)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'Administrador Loja A'),
  ('00000000-0000-4000-8000-000000000012', 'Administrador Loja B'),
  ('00000000-0000-4000-8000-000000000099', 'Operador Master SaaS')
ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- -----------------------------------------------------------------------------
-- 3. Staff da Plataforma (public.platform_staff)
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_staff (user_id, role, active)
VALUES
  ('00000000-0000-4000-8000-000000000099', 'MASTER', true)
ON CONFLICT (user_id) DO UPDATE SET role = 'MASTER', active = true;

-- -----------------------------------------------------------------------------
-- 4. Organizações / Lojas (public.organizations)
-- -----------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, number, orient, obedience, cnpj, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'CORSYS V35 SYNTHETIC LOJA A', '101', 'Oriente de Curitiba', 'GLP', '11.111.111/0001-11', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'CORSYS V35 SYNTHETIC LOJA B', '102', 'Oriente de Cascavel', 'GLP', '22.222.222/0001-22', 'active')
ON CONFLICT (id) DO NOTHING;

-- Configurações das Lojas
INSERT INTO public.organization_settings (organization_id, pix_key, email, phone, timezone)
VALUES
  ('00000000-0000-4000-8000-000000000001', '11111111000111', 'contato@lojaa.synthetic', '+5541999990001', 'America/Sao_Paulo'),
  ('00000000-0000-4000-8000-000000000002', '22222222000122', 'contato@lojab.synthetic', '+5545999990002', 'America/Sao_Paulo')
ON CONFLICT (organization_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Perfis e Atribuição de Usuários (public.user_roles)
-- -----------------------------------------------------------------------------
INSERT INTO public.user_roles (organization_id, user_id, role_id)
SELECT org.id, '00000000-0000-4000-8000-000000000011', r.id
FROM public.organizations org
JOIN public.roles r ON r.organization_id = org.id AND r.code = 'ADMIN'
WHERE org.id = '00000000-0000-4000-8000-000000000001'
ON CONFLICT (organization_id, user_id, role_id) DO NOTHING;

INSERT INTO public.user_roles (organization_id, user_id, role_id)
SELECT org.id, '00000000-0000-4000-8000-000000000012', r.id
FROM public.organizations org
JOIN public.roles r ON r.organization_id = org.id AND r.code = 'ADMIN'
WHERE org.id = '00000000-0000-4000-8000-000000000002'
ON CONFLICT (organization_id, user_id, role_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Categorias Financeiras (public.financial_categories)
-- -----------------------------------------------------------------------------
INSERT INTO public.financial_categories (id, organization_id, name, domain, active, display_order)
VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'Despesas Operacionais A', 'institutional_expense', true, 1),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'Mensalidades Ordinárias A', 'member_receivable', true, 2),
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000002', 'Despesas Operacionais B', 'institutional_expense', true, 1),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000002', 'Mensalidades Ordinárias B', 'member_receivable', true, 2)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Integrantes (public.members) e Vínculos (public.member_user_links)
-- -----------------------------------------------------------------------------
INSERT INTO public.members (id, organization_id, full_name, preferred_name, status, email)
VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Integrante Sintético A1', 'Membro A1', 'active', 'membro.a1@corsys.synthetic'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Integrante Sintético A2', 'Membro A2', 'active', 'membro.a2@corsys.synthetic'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'Integrante Sintético B1', 'Membro B1', 'active', 'membro.b1@corsys.synthetic'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000002', 'Integrante Sintético B2', 'Membro B2', 'active', 'membro.b2@corsys.synthetic')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_user_links (organization_id, member_id, user_id)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000012')
ON CONFLICT (organization_id, member_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Contas a Pagar Institucionais (public.institutional_payables)
-- Precisão Exata:
--   Loja A: R$ 10.000,25 + R$ 5.000,25 = R$ 15.000,50 (1.500.050 centavos)
--   Loja B: R$  7.000,15 + R$ 5.000,10 = R$ 12.000,25 (1.200.025 centavos)
-- -----------------------------------------------------------------------------
INSERT INTO public.institutional_payables (
  id, organization_id, category_id, description, competence, issue_date, due_date, accounting_period, amount, posting_status, created_by
)
VALUES
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 'Aluguel do Templo Loja A', '2026-11-01', '2026-11-01', '2026-11-20', '2026-11-01', 10000.25, 'draft', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 'Energia Elétrica Loja A', '2026-11-01', '2026-11-01', '2026-11-25', '2026-11-01', 5000.25, 'draft', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000401', 'Manutenção Templo Loja B', '2026-11-01', '2026-11-01', '2026-11-15', '2026-11-01', 7000.15, 'draft', '00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000401', 'Internet e Telefonia Loja B', '2026-11-01', '2026-11-01', '2026-11-18', '2026-11-01', 5000.10, 'draft', '00000000-0000-4000-8000-000000000012')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Cobranças / Recebíveis (public.charges)
-- Loja A: R$ 500,00 + R$ 300,00 = R$ 800,00 (80.000 centavos)
-- Loja B: R$ 400,00 + R$ 200,00 = R$ 600,00 (60.000 centavos)
-- -----------------------------------------------------------------------------
-- Prepare both plans as drafts so the normal accounting guards remain active.
DO $$
DECLARE
  v_org uuid;
  v_plan uuid;
  v_account uuid;
  v_category record;
BEGIN
  FOREACH v_org IN ARRAY ARRAY[
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid
  ] LOOP
    INSERT INTO public.accounting_plans (organization_id, name, valid_from, valid_to)
    VALUES (v_org, 'M05.02 — plano sintético', DATE '2026-11-01', DATE '2026-11-30')
    RETURNING id INTO v_plan;

    FOR v_category IN
      SELECT id, name, domain FROM public.financial_categories
      WHERE organization_id = v_org AND active
    LOOP
      INSERT INTO public.accounting_accounts
        (organization_id, accounting_plan_id, code, description, row_type, nature, operational_classification)
      VALUES (
        v_org, v_plan, v_category.id::text, v_category.name, 'analytic',
        CASE WHEN v_category.domain = 'institutional_expense' THEN 'expense' ELSE 'revenue' END,
        CASE WHEN v_category.domain = 'institutional_expense' THEN 'variable' ELSE 'recurring' END
      )
      RETURNING id INTO v_account;

      INSERT INTO public.financial_category_account_mappings
        (organization_id, accounting_plan_id, category_id, accounting_account_id)
      VALUES (v_org, v_plan, v_category.id, v_account);
    END LOOP;

    UPDATE public.accounting_plans
    SET status = 'published', published_at = now()
    WHERE organization_id = v_org AND id = v_plan;
  END LOOP;
END $$;

INSERT INTO public.charges (
  id, organization_id, member_id, category_id, source_kind, description, competence, issue_date, due_date, accounting_period, quantity, unit_amount, original_amount, created_by
)
VALUES
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'manual', 'Mensalidade 11/2026 A1', '2026-11-01', '2026-11-01', '2026-11-10', '2026-11-01', 1, 500.00, 500.00, '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000302', 'manual', 'Mensalidade 11/2026 A2', '2026-11-01', '2026-11-01', '2026-11-10', '2026-11-01', 1, 300.00, 300.00, '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000402', 'manual', 'Mensalidade 11/2026 B1', '2026-11-01', '2026-11-01', '2026-11-10', '2026-11-01', 1, 400.00, 400.00, '00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000402', 'manual', 'Mensalidade 11/2026 B2', '2026-11-01', '2026-11-01', '2026-11-10', '2026-11-01', 1, 200.00, 200.00, '00000000-0000-4000-8000-000000000012')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. Chamados e Trilha de Eventos (M04.03-C)
-- -----------------------------------------------------------------------------
INSERT INTO public.saas_support_tickets (id, organization_id, ticket_scope, subject, opened_by_user_id, status)
VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'tenant', 'Dúvida Faturamento Loja A', '00000000-0000-4000-8000-000000000011', 'working'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000002', 'tenant', 'Suporte Conciliação Loja B', '00000000-0000-4000-8000-000000000012', 'new'),
  ('00000000-0000-4000-8000-000000000503', null, 'internal', 'Auditoria Interna de Infraestrutura', '00000000-0000-4000-8000-000000000099', 'new')
ON CONFLICT (id) DO NOTHING;

-- Trilha de eventos: eventos de cliente e internos
INSERT INTO public.saas_support_ticket_events (
  ticket_id, organization_id, from_status, to_status, visibility, reason, actor_user_id, created_at
)
VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', null, 'new', 'customer', 'Abertura de chamado pelo cliente', '00000000-0000-4000-8000-000000000011', '2026-11-01 10:00:00+00'),
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'new', 'working', 'internal', 'Nota interna: análise técnica iniciada', '00000000-0000-4000-8000-000000000099', '2026-11-01 10:30:00+00'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000002', null, 'new', 'customer', 'Abertura de ticket de suporte Loja B', '00000000-0000-4000-8000-000000000012', '2026-11-02 11:00:00+00'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000002', 'new', 'working', 'internal', 'Nota interna: escalonado para nível 2', '00000000-0000-4000-8000-000000000099', '2026-11-02 11:15:00+00'),
  ('00000000-0000-4000-8000-000000000503', null, null, 'new', 'internal', 'Evento estritamente de plataforma Master', '00000000-0000-4000-8000-000000000099', '2026-11-03 14:00:00+00');

-- -----------------------------------------------------------------------------
-- 11. Auditoria da Loja (public.audit_logs)
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_logs (
  organization_id, actor_user_id, action, entity_type, entity_id, reason, technical_context
)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'member.create', 'member', '00000000-0000-4000-8000-000000000101', 'Iniciação regular Loja A', '{"fixture":"m05_backup_test"}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'payable.create', 'institutional_payable', '00000000-0000-4000-8000-000000000601', 'Lançamento despesa aluguel A', '{"fixture":"m05_backup_test"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'member.create', 'member', '00000000-0000-4000-8000-000000000201', 'Iniciação regular Loja B', '{"fixture":"m05_backup_test"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'payable.create', 'institutional_payable', '00000000-0000-4000-8000-000000000701', 'Lançamento despesa reforma B', '{"fixture":"m05_backup_test"}'::jsonb);

-- -----------------------------------------------------------------------------
-- 12. Auditoria da Plataforma Master (public.saas_master_audit_logs)
-- -----------------------------------------------------------------------------
INSERT INTO public.saas_master_audit_logs (
  staff_user_id, organization_id, action, resource_type, resource_id, metadata
)
VALUES
  ('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000001', 'organization.provision', 'organization', '00000000-0000-4000-8000-000000000001', '{"env":"disposable_pg17","phase":"m05_test"}'::jsonb),
  ('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000002', 'organization.provision', 'organization', '00000000-0000-4000-8000-000000000002', '{"env":"disposable_pg17","phase":"m05_test"}'::jsonb),
  ('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000001', 'support_session.open', 'organization', '00000000-0000-4000-8000-000000000001', '{"reason":"Auditoria de backup descartavel"}'::jsonb);

COMMIT;
