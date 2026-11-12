# CorSys Tronco Digital V35 — Matriz de Riscos e Cobertura de Testes (M06.03 & M07)

> **Status:** CONSOLIDAÇÃO DE EVIDÊNCIAS E REVISÃO DE RISCO  
> **Data:** 11/11/2026  
> **Precedência:** `AGENTS.md`, `CURRENT_ARCHITECTURE.md`, `PROJECT_CONTEXT.md`

---

## 1. Resumo da Matriz de Risco por Domínio

| Domínio | Categoria de Risco | Controles de Segurança & Imutabilidade | Evidência de Teste Executada | Estado de Homologação DEV/PROD |
|---|---|---|---|---|
| **Auth & Isolation** | Acesso Cross-Tenant / Autenticação Nula | RLS por `organization_id`, validação no cliente e servidor, `private.is_tenant_user(org_id)` | `532/532 PASS` (Vitest) | `INTEGRADO` (Requer sessão JWT real em DEV para aceite E2E) |
| **Plataforma Master & MFA** | Elevação de Privilégio / Bypass AAL2 | `private.require_platform_staff('MASTER')`, checagem AAL2, `MfaGate.tsx` | `MasterOperations.test.tsx`, `MfaGate.test.tsx` (PASS) | `INTEGRADO_COM_GATES_PENDENTES` |
| **Suporte & Trilha (M04.03-C)** | Vazamento de Chamados Internos / Truncamento | RLS `saas_support_ticket_events_select`, ordenação estável por `created_at` e `id`, limite 200 | `master-support.test.ts`, `MasterSupportQueue.test.tsx`, `Chamados.test.tsx` (PASS) | `CONCLUIDO_EM_CODIGO` |
| **Operações Financeiras** | Mutação Financeira Histórica | Triggers `prevent_financial_mutation()`, id de idempotência único, fail-closed sob inconsistência | `FinancialPeriods.test.tsx`, `ContasPagar.test.tsx`, `Tesouraria.test.tsx` (PASS) | `AGUARDA_AUTORIZACAO_DEV` (M02.03) |
| **Contabilidade & DRE** | Classificação Arbitrária / Incoerência | Distinção por natureza histórica (`read_tenant_dre`), rubricas sem deduções presumidas | `DreConfig.test.tsx`, `DreReport.test.tsx`, `DreView.test.tsx` (PASS) | `AGUARDA_DECISAO_CONTABIL` (Issue #43) |
| **Privacidade & Backup (M05)** | Perda de Trilha / Restauração Incompleta | Ledger imutável, runbook descartável em `docs/V35_BACKUP_RECOVERY_RUNBOOK.md` | `Configuracoes.test.tsx` (PASS) | `PENDENTE_EVIDENCIA_EXECUCAO_OBSERVADA` |

---

## 2. Inventário de Telas e Paridade V35 (21 Telas)

1. **Home / Painel Geral (`Workspace.tsx`):** Dashboard com 6 KPIs financeiros de RPC, fluxo de caixa diário, atalhos rápidos de navegação. Responsive (grid adaptativo).
2. **Integrantes (`Members.tsx`):** Busca, filtro de situação, controle por período.
3. **Cadastros & RBAC (`Cadastros.tsx`):** Atribuição e revogação de papéis, prevenção de autoelevação de ADMIN, confirmação modal com chave de idempotência.
4. **Contas a Pagar (`ContasPagar.tsx` & `PayableApprovals.tsx`):** Aprovações operacionais de pagamentos com dupla alça quando aplicável.
5. **Contas a Receber (`ContasReceber.tsx` & `MemberPayments.tsx`):** Gestão de cobranças de integrantes e convênios.
6. **Tesouraria & Bancos (`Tesouraria.tsx`, `TreasuryBalances.tsx`, `BankReconciliation.tsx`, `AccountTransfers.tsx`):** Conciliação bancária, saldos por conta e transferências.
7. **Fluxo de Caixa (`FluxoCaixa.tsx`, `DailyCashFlow.tsx`, `CashFlowSnapshot.tsx`):** Detalhamento de movimentações, tendência histórica e fotografia saldos.
8. **DRE Contábil (`DreView.tsx`, `DreReport.tsx`, `BudgetReport.tsx`):** Demonstrativo de resultado, comparativo e orçamento.
9. **Financeiro Geral (`Finance.tsx`, `FinancialPeriods.tsx`, `ApprovalHistory.tsx`):** Fechamento e reabertura de competência com motivo obrigatório.
10. **Inadimplência (`DelinquencyReport.tsx`):** Aging de atrasos e exportação.
11. **Relatórios Gerenciais (`Relatorios.tsx`):** Relatórios consolidados e impressão.
12. **Plano de Contas (`PlanoContas.tsx`, `AccountingPrepublication.tsx`):** Estrutura hierárquica e publicação validada idempotente.
13. **Configurações DRE (`DreConfig.tsx`):** Diagnóstico de cobertura de mapeamentos contábeis, contraste visual corrigido para alto contraste.
14. **Chamados / Suporte (`Chamados.tsx`):** Criação, mensagens, busca por id/assunto e **trilha de eventos (`saas_support_ticket_events`)**.
15. **Configurações da Loja (`Configuracoes.tsx`, `TenantIdentity.tsx`):** Identidade, assinatura SaaS, auditoria de governança e status LGPD sem dados mockados.
16. **Painel Master SaaS (`MasterConsole.tsx`):** Visão geral da plataforma e métricas globais.
17. **Operações Master (`MasterOperations.tsx`):** Fila de chamados Master, Saúde/Jobs com paginação por cursor (keyset), sessões temporárias.
18. **Fila de Suporte Master (`MasterSupportQueue.tsx`):** Respostas de suporte Master idempotentes e **trilha de eventos do chamado**.
19. **Catálogo Comercial Master (`MasterCommercialCatalog.tsx`):** Planos SaaS, versões e elegibilidade.
20. **Auditoria Master (`MasterAudit.tsx`):** Trilha imutável de eventos administrativos da plataforma.
21. **Visão 360 do Cliente (`MasterClient360.tsx`):** Diagnóstico integrado de Loja cliente.

---

## 3. Matriz de Verificação Técnica (Chat vs DEV / Produção)

| Item de Verificação | Executável no Chat (Simulado / Mocks) | Exige Ambiente DEV Autorizado | Exige Produção / Aceite do Proprietário |
|---|---|---|---|
| Suíte de testes unitários Vitest (532 testes) | **PASS (532/532)** | — | — |
| Typecheck TypeScript (`tsc --noEmit`) | **PASS (0 erros)** | — | — |
| Compilação do Applet (`compile_applet`) | **PASS (Succeeded)** | — | — |
| Validação de Trilha de Chamados (`saas_support_ticket_events`) | **PASS (Código & Unitário)** | Pendente JWT real Master | — |
| Execução de Restauração de Backup | Manual descartável | Pendente janela DEV | — |
| Envio real de convites SMTP e aceite E2E | — | Pendente M01.04 em DEV | — |
| Ativação do Fluxo de Caixa M02.03 em DEV | — | Pendente M02.03 | — |
| Release Final & Entrada em Beta | — | — | **BLOQUEADO** (Requer conclusão V35 + Aceite do Proprietário) |

---

## 4. Condições de Entrada em Release e Beta (M07)

- **Condição 1:** Fechamento integral de todas as microentregas M01 a M06.
- **Condição 2:** Validação sem regressão dos 532 testes unitários e typecheck limpo.
- **Condição 3:** Homologação com JWT real dos acessos Master/AAL2 e sessões de suporte em ambiente DEV.
- **Condição 4:** Autorização explícita e por escrito do proprietário para liberação do ambiente Beta.
