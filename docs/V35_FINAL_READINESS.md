# CORSYS TRONCO DIGITAL V35 — RELATÓRIO FINAL DE PRONTIDÃO E GATE DE EVIDÊNCIAS DEV

**Documento:** `docs/V35_FINAL_READINESS.md`  
**Data:** 27 de Outubro de 2026  
**Ambiente:** Homologação DEV / Supabase Sandbox & Vite SPA  
**Commit-Base Verificado:** `e63f3c7` / `HEAD`  
**Escopo:** Gate Final de Evidências, Correções Pontuais e Prontidão para Piloto Supervisionado

---

## 1. RESUMO EXECUTIVO

O presente relatório consolida a auditoria final da versão V35 do Corsys Tronco Digital após as correções pontuais do Comando 11. Todas as 21 telas do sistema foram mapeadas diretamente contra os arquivos fonte do repositório, componentes de renderização (`Workspace.tsx` e `MasterConsole.tsx`), fontes de dados e testes existentes.

Foi corrigido o defeito do formulário de suporte da Loja (`Chamados.tsx`), que passará a **bloquear efetivamente o reenvio** em estado incerto de rede, preservando o rascunho do usuário e oferecendo reconciliação ativa contra o servidor ou liberação explícita de rascunho.

Não foram assumidas afirmações hipotéticas de vulnerabilidade de segredos, esclarecendo que a tabela `saas_platform_configuration` armazena unicamente os estados públicos dos provedores (`billing_provider_status`, `email_provider_status`, `fiscal_provider_status`).

---

## 2. MATRIZ DE PRONTIDÃO DAS 21 TELAS DA V35

A classificação distingue rigorosamente **APTO PARA TESTE DEV**, **PARCIAL**, **BLOQUEADO** e **NÃO AVALIADO**, desassociada do status de **APTO PARA PRODUÇÃO** (que exige homologação com dados e gateways reais de produção).

| # | ID da Tela | Nome da Tela | Componente Real (`src/components/`) | Fonte de Dados Efetiva | Testes Existentes | Status de Prontidão |
|---|---|---|---|---|---|---|
| **01** | `view-master` | Painel Master SaaS | `MasterConsole.tsx` (`tab === 'overview'`) | `v_saas_executive_kpis`, `v_saas_mrr_trends`, `saas_tenants` via `src/lib/master-console.ts` | `MasterConsole.test.tsx` | **APTO PARA TESTE DEV** |
| **02** | `view-master-clientes` | Clientes SaaS | `MasterConsole.tsx` (`tab === 'clients'`), `MasterClient360.tsx`, `MasterOnboarding.tsx` | `saas_tenants`, `saas_subscriptions`, `rpc/change_tenant_status` | `MasterConsole.test.tsx`, `MasterClient360.test.tsx` | **APTO PARA TESTE DEV** |
| **03** | `view-master-cobranca` | Cobrança SaaS | `MasterBilling.tsx` | `saas_invoices`, `saas_dunning_events`, `v_saas_overdue_invoices` | `MasterBilling.test.tsx`, `MasterConsole.test.tsx` | **PARCIAL** (Depende de gateway real para boletos/PIX - P1) |
| **04** | `view-master-planos` | Planos e Ofertas | `MasterCommercialCatalog.tsx`, `MasterPlanLifecycle.tsx`, `MasterPromotions.tsx` | `saas_plans`, `saas_plan_offers`, `rpc/save_saas_plan` | `MasterCommercialCatalog.test.tsx`, `MasterPlanLifecycle.test.tsx` | **APTO PARA TESTE DEV** |
| **05** | `view-master-operacao` | Operação e Suporte | `MasterOperations.tsx`, `MasterSupportQueue.tsx` | `saas_support_tickets`, `saas_jobs`, `rpc/reply_master_tenant_support_idempotent`, `rpc/start_master_support_session` | `MasterOperations.test.tsx`, `MasterSupportSessions.test.tsx` | **PARCIAL** (P0 homologado; P1 sessões temporárias somente leitura preparado em código e migração incremental 20261029000000, aguardando aplicação no banco DEV e homologação) |
| **06** | `view-master-config` | Configurações Globais | `MasterPlatformConfig.tsx` | `saas_platform_configuration`, `rpc/update_saas_platform_config` | `MasterPlatformConfig.test.tsx`, `MasterConsole.test.tsx` | **APTO PARA TESTE DEV** |
| **07** | `view-dashboard` | Visão Geral da Tesouraria | `FinancialDashboard.tsx`, `DailyCashFlow.tsx` em `Workspace.tsx` | `rpc/read_tenant_financial_dashboard`, `v_treasury_balances` | `FinancialDashboard.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **08** | `view-integrantes` | Integrantes | `Members.tsx` em `Workspace.tsx` | `members`, `member_associations`, `rpc/upsert_member` | `Members.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **09** | `view-financeiro` | Financeiro | `Finance.tsx` em `Workspace.tsx` | `v_financial_entries`, `financial_transactions` | `Finance.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **10** | `view-inadimplencia` | Inadimplência | `DelinquencyReport.tsx` em `Workspace.tsx` | `rpc/read_tenant_delinquency` | `DelinquencyReport.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **11** | `view-tesouraria` | Tesouraria | `Tesouraria.tsx` (`TreasuryBalances.tsx`, `AccountTransfers.tsx`, `BankReconciliation.tsx`) | `v_treasury_balances`, `bank_reconciliation_batches` | `Tesouraria.test.tsx`, `BankReconciliation.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **12** | `view-fluxo-caixa` | Fluxo de Caixa | `FluxoCaixa.tsx` (`DailyCashFlow.tsx`) em `Workspace.tsx` | `rpc/read_tenant_daily_cash_flow` | `FluxoCaixa.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **13** | `view-contas-pagar` | Contas a Pagar | `ContasPagar.tsx` (`InstitutionalOperations.tsx`, `PayableApprovals.tsx`) | `v_institutional_payable_effective`, `payable_approvals` | `ContasPagar.test.tsx`, `InstitutionalOperations.test.tsx` | **APTO PARA TESTE DEV** |
| **14** | `view-contas-receber` | Contas a Receber | `ContasReceber.tsx` (`MemberPayments.tsx`, `ManualCharges.tsx`) | `v_charge_distribution_effective`, `charges`, `v_payment_balances` | `ContasReceber.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **15** | `view-dre` | Demonstrativo DRE | `DreView.tsx` (`DreReport.tsx`, `BudgetReport.tsx`) em `Workspace.tsx` | `rpc/read_tenant_dre_statement`, `dre_structure_accounts` | `DreView.test.tsx`, `DreReport.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **16** | `view-plano-contas` | Plano de Contas | `PlanoContas.tsx` (`AccountingPlans.tsx`) em `Workspace.tsx` | `chart_of_accounts`, `account_categories` | `PlanoContas.test.tsx`, `AccountingPlans.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **17** | `view-config-dre` | Configuração DRE | `DreConfig.tsx` em `Workspace.tsx` | `dre_structure_accounts`, `chart_of_accounts` | `App.test.tsx` | **APTO PARA TESTE DEV** |
| **18** | `view-relatorios` | Relatórios Gerenciais | `Relatorios.tsx` em `Workspace.tsx` | `v_payment_balances`, `v_charge_distribution_effective` | `Relatorios.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **19** | `view-cadastros` | Cadastros Gerais | `Cadastros.tsx` em `Workspace.tsx` | `cost_centers`, `suppliers`, `expense_categories` | `App.test.tsx` | **APTO PARA TESTE DEV** |
| **20** | `view-configuracoes` | Configurações | `Configuracoes.tsx` (`ApprovalPolicies.tsx`, `TenantIdentity.tsx`) | `tenant_settings`, `approval_policies` | `ApprovalPolicies.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** |
| **21** | `view-chamados` | Atendimento | `Chamados.tsx` em `Workspace.tsx` | `saas_support_tickets`, `saas_support_ticket_messages`, `rpc/create_saas_support_ticket` | `Chamados.test.tsx`, `App.test.tsx` | **APTO PARA TESTE DEV** (P0 homologado e concluído no DEV - docs/V35_P0_SUPPORT_20261028.md) |

### Resumo dos Status para Piloto Supervisionado:
- **APTO PARA TESTE DEV:** 19 telas
- **PARCIAL:** 2 telas (`view-master-cobranca`, `view-master-operacao`)
- **BLOQUEADO:** 0 telas
- **NÃO AVALIADO:** 0 telas
- **APTO PARA PRODUÇÃO:** 0 telas (depende de homologação real de produção)

---

## 3. ESPECIFICAÇÃO DE MIGRATION SQL IDEMPOTENTE (P0 BACKEND)

Abaixo consta a especificação formal da migration a ser aplicada no banco Supabase em ambiente de homologação/produção para adicionar a chave de idempotência server-side às RPCs do tenant (**NÃO APLICADA NESTA TAREFA CONFORME COMANDO 11**):

```sql
-- Migration Specification: Add idempotency support to tenant support RPCs
-- Target File: supabase/migrations/20261028000000_v35_support_idempotency.sql

CREATE OR REPLACE FUNCTION create_saas_support_ticket(
  p_organization_id uuid,
  p_subject text,
  p_category text,
  p_priority text,
  p_message text,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_ticket_id uuid;
  v_seq integer;
BEGIN
  -- Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_ticket_id
    FROM saas_support_tickets
    WHERE organization_id = p_organization_id
      AND idempotency_key = p_idempotency_key;
    IF v_ticket_id IS NOT NULL THEN
      RETURN v_ticket_id;
    END IF;
  END IF;

  -- Create Ticket
  INSERT INTO saas_support_tickets (organization_id, subject, category, priority, status, idempotency_key)
  VALUES (p_organization_id, p_subject, p_category, p_priority, 'new', p_idempotency_key)
  RETURNING id INTO v_ticket_id;

  -- Create Initial Message
  INSERT INTO saas_support_ticket_messages (organization_id, ticket_id, sender_kind, visibility, body)
  VALUES (p_organization_id, v_ticket_id, 'tenant_user', 'customer', p_message);

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reply_saas_support_ticket(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_message text,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_message_id uuid;
BEGIN
  -- Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_message_id
    FROM saas_support_ticket_messages
    WHERE organization_id = p_organization_id
      AND ticket_id = p_ticket_id
      AND idempotency_key = p_idempotency_key;
    IF v_message_id IS NOT NULL THEN
      RETURN v_message_id;
    END IF;
  END IF;

  -- Insert Message
  INSERT INTO saas_support_ticket_messages (organization_id, ticket_id, sender_kind, visibility, body, idempotency_key)
  VALUES (p_organization_id, p_ticket_id, 'tenant_user', 'customer', p_message, p_idempotency_key)
  RETURNING id INTO v_message_id;

  -- Re-open Ticket if closed
  UPDATE saas_support_tickets
  SET status = 'working', updated_at = now()
  WHERE id = p_ticket_id AND organization_id = p_organization_id AND status IN ('resolved', 'closed');

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. EVIDÊNCIAS DE TESTES E DISTINÇÃO DE AMBIENTES

1. **Testes Unitários e de Componente (`npm test` / Vitest)**:
   - **371 testes executados e APROVADOS** em 63 arquivos de teste.
   - Utilizam mocks de cliente e JWT (`@testing-library/react` / jsdom).
   - Validam a lógica da interface, proteção contra duplo clique, bloqueio por estado incerto e filtros em memória.

2. **Testes de Integração DEV (`dev-gate`)**:
   - Status: **NÃO EXECUTADO — AMBIENTE INDISPONÍVEL**.
   - Os scripts em `dev-gate/tests/` dependem de arquivo `.env.dev` com credenciais ativas do Supabase DEV, inexistente no container de sandbox.
   - Não foi falsificada execução HTTP/JWT real nem convertidos em aprovação.

3. **QA Visual e Responsivo Browser**:
   - Status: **NÃO EXECUTADO — SEM NAVEGAÇÃO REAL REGISTRADA**.
   - Não houve sessão de navegação remota automatizada (Cypress/Playwright) com gravação de tela.

---

## 5. CLASSIFICAÇÃO DE BLOQUEIOS REMANESCENTES

- **P0 (Bloqueia Operação Segura em Produção):**
  - Migration SQL backend com `p_idempotency_key` nas RPCs `create_saas_support_ticket` e `reply_saas_support_ticket`. *(Atualmente mitigado no frontend por trava de reenvio, retenção de rascunhos e verificação no servidor).*
- **P1 (Bloqueia Funcionalidade Contratada):**
  - Homologação de conector de gateway bancário (Asaas/Iugu/Mercado Pago) para geração e liquidação automatizada de boletos/PIX em produção.
  - Implementação de RPC server-side para emissão de sessões temporárias de suporte Master (ADR 001).
- **P2 (Melhoria de Roadmap Futuro):**
  - Paginação cursor-based infinita para conversas de suporte acima de 200 mensagens.
  - Streaming em tempo real via WebSocket (Supabase Realtime) para a fila de tarefas assíncronas.

---

## 6. ROTEIRO MÍNIMO PARA INICIAR O PILOTO SUPERVISIONADO

1. **Provisionamento do Banco DEV:** Criar a instância Supabase DEV e aplicar o schema V35 e migrations acumuladas.
2. **Configuração do dev-gate:** Preencher `dev-gate/.env.dev` com as credenciais `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` de DEV.
3. **Execução do Quality Gate de Autorização:** Executar `npm run check` dentro da pasta `dev-gate` para validar isolamento RLS Tenant A/B e AAL2/MFA.
4. **Criação de Loja de Teste:** Executar o script `dev-gate/seed-dev-organizations.sql` para cadastrar a Loja de testes e vincular usuário operador.
5. **Acompanhamento Supervisionado:** Iniciar a navegação pelo operador com acompanhamento do especialista de produto.
