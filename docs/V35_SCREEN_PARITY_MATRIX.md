# V35 — Matriz de Paridade de Telas

Esta matriz mapeia as telas do inventário V35 aos componentes React e backend correspondentes.

| ID | Tela (Pilot V35) | Componente | Status de Paridade | Pendências |
|---|---|---|---|---|
| 1 | Cadastro de Loja | `Configuracoes.tsx` | EM_EXECUCAO | Validação final de campos |
| 2 | Perfis e Permissões | `Cadastros.tsx` | PENDENTE | Integração RBAC |
| 3 | Assinatura SaaS | `Configuracoes.tsx` | A_CONFERIR | Dados de assinatura |
| 4 | Fluxo de Caixa | `FluxoCaixa.tsx` | INTEGRADO | Séries temporais |
| 5 | Tesouraria | `Tesouraria.tsx` | INTEGRADO | Conciliação |
| 6 | Contas a Pagar | `ContasPagar.tsx` | INTEGRADO | - |
| 7 | Contas a Receber | `ContasReceber.tsx` | INTEGRADO | - |
| 8 | DRE | `DreView.tsx` | INTEGRADO | Classificação |
| 9 | Relatórios | `Relatorios.tsx` | INTEGRADO | Exportação PDF/XLSX |
| 10 | Plano de Contas | `PlanoContas.tsx` | INTEGRADO | - |
| 11 | Dashboard | `FinancialDashboard.tsx`| INTEGRADO | Séries temporais |
| 12 | Master SaaS (Painel) | `MasterConsole.tsx` | INTEGRADO | - |
| 13 | Master Clientes | `Members.tsx` | INTEGRADO | - |
| 14 | Master Cobrança | `MasterBilling.tsx` | INTEGRADO | - |
| 15 | Master Planos | `MasterCommercialCatalog.tsx`| INTEGRADO | - |
| 16 | Master Operação | `MasterOperations.tsx`| INTEGRADO | SLA/Retry |
| 17 | Master Config | `MasterPlatformConfig.tsx`| INTEGRADO | - |
| 18 | Master Onboarding | `MasterOnboarding.tsx`| INTEGRADO | - |
| 19 | Chamados | `Chamados.tsx` | INTEGRADO | SLA |
| 20 | Auditoria Master | `MasterAudit.tsx` | INTEGRADO | - |
| 21 | Acordos | `MemberAgreements.tsx`| INTEGRADO | - |
