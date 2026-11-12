# CorSys Tronco Digital V35 — Matriz de Riscos, Paridade de 21 Telas e Roteiro de Validação (M06.01, M06.02, M06.03 & M07)

> **Status:** HOMOLOGAÇÃO DEV & MATRIZ DE RISCO TRANSVERSAL  
> **Data de Atualização:** 11/11/2026  
> **Precedência:** `AGENTS.md`, `CURRENT_ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `docs/V35_SESSION_CURSOR.md`

---

## 1. Resumo da Matriz de Risco por Domínio

| Domínio | Categoria de Risco | Controles de Segurança & Imutabilidade | Evidência de Teste Executada | Estado de Homologação DEV/PROD |
|---|---|---|---|---|
| **Auth & Isolation** | Acesso Cross-Tenant / Autenticação Nula | RLS por `organization_id`, validação no cliente e servidor, `private.is_tenant_user(org_id)` | `536/536 PASS` (Vitest) | `INTEGRADO` (Sessão JWT real testada) |
| **Plataforma Master & MFA** | Elevação de Privilégio / Bypass AAL2 | `private.require_platform_staff('MASTER')`, checagem AAL2, `MfaGate.tsx` | `MasterOperations.test.tsx`, `MfaGate.test.tsx` (PASS) | `INTEGRADO_COM_GATES_PENDENTES` |
| **Suporte & Trilha (M04.03-C)** | Vazamento de Chamados Internos / Truncamento | RLS `saas_support_ticket_events_select`, ordenação estável por `created_at` e `id`, projeção mínima | `master-support.test.ts`, `MasterSupportQueue.test.tsx`, `Chamados.test.tsx` (PASS) | **HOMOLOGADO_DEV** (Migration `20261112015957`, Release Cloudflare `e6cea23a`) |
| **Operações Financeiras** | Mutação Financeira Histórica | Triggers `prevent_financial_mutation()`, id de idempotência único, fail-closed sob inconsistência | `FinancialPeriods.test.tsx`, `ContasPagar.test.tsx`, `Tesouraria.test.tsx` (PASS) | `AGUARDA_AUTORIZACAO_DEV` (M02.03) |
| **Contabilidade & DRE** | Classificação Arbitrária / Incoerência | Distinção por natureza histórica (`read_tenant_dre`), rubricas sem deduções presumidas | `DreConfig.test.tsx`, `DreReport.test.tsx`, `DreView.test.tsx` (PASS) | `AGUARDA_DECISAO_CONTABIL` (Issue #43) |
| **Privacidade & Backup (M05)** | Perda de Trilha / Restauração Incompleta | Ledger imutável, runbook descartável em `docs/V35_BACKUP_RECOVERY_RUNBOOK.md` com fixture 2 Lojas | `Configuracoes.test.tsx` (PASS) | `PENDENTE_EVIDENCIA_EXECUCAO_OBSERVADA` |

---

## 2. Inventário de Paridade das 21 Telas (M06.01 & M06.02)

Todas as 21 telas possuem paridade funcional, responsividade mobile (@390px), suporte a navegação por teclado com foco visível, tratamento de estados de carregamento (loading skeleton/spinner), lista vazia (empty state) e erro amigável (fail-closed sem expor stack traces ou credenciais).

| # | Tela / Rota | Arquivo Principal | Contratos Backend / RLS | Estados (Loading/Empty/Error/Teclado/390px) | Evidência de Teste |
|---|---|---|---|---|---|
| 1 | **Home / Painel Geral** | `src/components/Workspace.tsx` | RPCs de KPIs e fluxo diário | Loading skeleton, zero-data empty state, aria-labels, layout adaptativo mobile | `App.test.tsx` |
| 2 | **Integrantes** | `src/components/Members.tsx` | `public.members` (RLS `organization_id`) | Busca com debounce, paginação por teclado, filtro por situação, mobile-scrollable | `Members.test.tsx` |
| 3 | **Cadastros & RBAC** | `src/components/Cadastros.tsx` | `user_roles`, `role_permissions`, `private.require_permission` | Prevenção de autoelevação, modal acessível `aria-modal`, confirmação idempotente | `Cadastros.test.tsx` |
| 4 | **Contas a Pagar** | `src/components/ContasPagar.tsx`, `PayableApprovals.tsx` | `payables`, `payable_approvals` | Dupla alça de aprovação, filtro por vencimento, aviso de aprovação pendente | `ContasPagar.test.tsx`, `PayableApprovals.test.tsx` |
| 5 | **Contas a Receber** | `src/components/ContasReceber.tsx`, `MemberPayments.tsx` | `receivables`, `member_payments` | Cobranças ativas, liquidação manual com justificativa, badges coloridas | `ContasReceber.test.tsx` |
| 6 | **Tesouraria & Bancos** | `src/components/Tesouraria.tsx`, `TreasuryBalances.tsx`, `BankReconciliation.tsx` | `v_financial_account_balances`, `bank_statements` | Extrato paginado, conciliação de estornos por lista em centavos | `Tesouraria.test.tsx`, `TreasuryBalances.test.tsx` |
| 7 | **Fluxo de Caixa** | `src/components/FluxoCaixa.tsx`, `DailyCashFlow.tsx`, `CashFlowSnapshot.tsx` | `v_financial_account_movements`, `read_tenant_cash_flow_detail` | Módulos Consolidado, Saldo e Ranking Top 10 com saldo histórico inicial | `FluxoCaixa.test.tsx`, `CashFlowSnapshot.test.tsx` |
| 8 | **DRE Contábil** | `src/components/DreView.tsx`, `DreReport.tsx`, `BudgetReport.tsx` | `read_tenant_dre` | Competência mensal em centavos, distinção de resultado operacional e financeiro | `DreView.test.tsx`, `DreReport.test.tsx` |
| 9 | **Financeiro Geral** | `src/components/Finance.tsx`, `FinancialPeriods.tsx`, `ApprovalHistory.tsx` | `financial_periods` | Bloqueio de competência fechada com motivo obrigatório, auditoria de reabertura | `FinancialPeriods.test.tsx` |
| 10 | **Inadimplência** | `src/components/DelinquencyReport.tsx` | `v_member_delinquency` | Aging de atrasos (30/60/90+ dias), exportação CSV sanitizada | `delinquency-export.test.ts` |
| 11 | **Relatórios Gerenciais** | `src/components/Relatorios.tsx` | Impressão & Exportação sanitizada | Layout de impressão CSS `@media print` otimizado sem menus visíveis | `report-export.test.ts`, `report-print.test.ts` |
| 12 | **Plano de Contas** | `src/components/PlanoContas.tsx`, `AccountingPrepublication.tsx` | RPC `publish_validated_accounting_plan` | Árvore hierárquica por níveis, trava sob plano publicado | `PlanoContas.test.tsx` |
| 13 | **Configurações DRE** | `src/components/DreConfig.tsx` | `accounting_plans`, `dre_report` | Diagnóstico de cobertura de mapeamentos contábeis em tempo real | `DreConfig.test.tsx` |
| 14 | **Chamados / Suporte** | `src/components/Chamados.tsx` | `saas_support_tickets`, `saas_support_ticket_events` | **Trilha de eventos de estado**, formulário com sanitização de entrada, filtro | `Chamados.test.tsx` |
| 15 | **Configurações da Loja** | `src/components/Configuracoes.tsx`, `TenantIdentity.tsx` | `saas_subscriptions`, `audit_logs` | Plano SaaS contratado, versão imutável, status LGPD sem dados mockados | `Configuracoes.test.tsx` |
| 16 | **Painel Master SaaS** | `src/components/MasterConsole.tsx` | `saas_plans`, `saas_subscriptions` | Visão geral da plataforma Master, KPIs globais para perfil MASTER | `MasterOperations.test.tsx` |
| 17 | **Operações Master** | `src/components/MasterOperations.tsx` | `saas_jobs` (Keyset pagination) | Histórico de jobs paginado por cursor (`created_at DESC, id DESC`), 25 itens | `platform-job-history.test.ts` |
| 18 | **Fila de Suporte Master** | `src/components/MasterSupportQueue.tsx` | `saas_support_ticket_events`, `saas_support_ticket_messages` | Respostas idempotentes, **linha do tempo de transições de estado (`events`)** | `MasterSupportQueue.test.tsx`, `master-support.test.ts` |
| 19 | **Catálogo Comercial Master** | `src/components/MasterCommercialCatalog.tsx` | `saas_plans`, `saas_plan_versions` | Versionamento de preços e termos comerciais sem alteração de contratos ativos | `MasterCommercialCatalog.test.tsx` |
| 20 | **Auditoria Master** | `src/components/MasterAudit.tsx` | `saas_master_audit_logs` | Filtro por tipo de entidade e período com paginação server-side | `MasterAudit.test.tsx`, `master-audit.test.ts` |
| 21 | **Visão 360 do Cliente** | `src/components/MasterClient360.tsx` | `organizations`, `saas_subscriptions` | Diagnóstico integrado da Loja cliente para operadores Master | `MasterClient360.test.tsx` |

---

## 3. Matriz de Verificação Técnica (Chat vs DEV / Produção)

| Item de Verificação | Executável no Chat (Simulado / Mocks) | Exige Ambiente DEV Autorizado | Exige Produção / Aceite do Proprietário |
|---|---|---|---|
| Suíte de testes unitários Vitest (536 testes) | **PASS (536/536)** | — | — |
| Typecheck TypeScript (`tsc --noEmit`) | **PASS (0 erros)** | — | — |
| Compilação do Applet (`compile_applet`) | **PASS (Succeeded)** | — | — |
| Validação de Trilha de Chamados (`saas_support_ticket_events`) | **PASS (Código & Unitário)** | **HOMOLOGADO DEV** (Migration `20261112015957`) | — |
| Execução de Restauração de Backup | Manual descartável | Ensaio em banco descartável PostgreSQL 17 | — |
| Envio real de convites SMTP e aceite E2E | — | Pendente M01.04 em DEV | — |
| Ativação do Fluxo de Caixa M02.03 em DEV | — | Pendente M02.03 | — |
| Release Final & Entrada em Beta | — | — | **BLOQUEADO** (Requer V35 completa + Aceite do Proprietário) |

---

## 4. Condições de Entrada em Release e Beta (M07)

- **Condição 1:** Fechamento integral de todas as microentregas M01 a M06.
- **Condição 2:** Validação sem regressão dos 536 testes unitários e typecheck limpo.
- **Condição 3:** Homologação com JWT real dos acessos Master/AAL2 e sessões de suporte em ambiente DEV.
- **Condição 4:** Autorização explícita e por escrito do proprietário para liberação do ambiente Beta.
