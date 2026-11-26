# ADR-0054 — Operação Master SaaS: Ciclo Comercial, Assentos, Faturamento Manual, Inadimplência e Suporte (M04)

- **Data:** 2026-11-26
- **Status:** Implementado para revisão, CI PostgreSQL e homologação em DEV (não aplicado em DEV/PROD)
- **Macroetapa:** M04 — Operação Master SaaS (`M04.01`, `M04.02`, `M04.03`, `M04.04`)
- **Base de código:** `83e362d246c65a118967931c39b87ffae1e4a8f4` (`main`, PR #75)

## Contexto e Decisões Base

Consoante `docs/V35_CLOSURE_APPROVAL.md` (decisões `C01–C07` e `D01`) e `docs/V35_M0401_MANUAL_BILLING_RECONCILIATION.md`:
1. **Planos comerciais (`C01`, `C07`):** Os planos comerciais padrão oferecem R$ 125 (até 3 usuários ativos) e R$ 180 (até 10 usuários ativos), com os mesmos módulos funcionais da Loja, contabilizando apenas usuários ativos do tenant em `user_roles` e excluindo pessoal ativo da plataforma (`MASTER`/`SUPPORT`). Atingir o limite bloqueia novas atribuições/convites sem jamais excluir usuários existentes automaticamente.
2. **Contratação e mudanças prospectivas (`C02`, `C05`):** A contratação expressa paga a partir do trial e upgrades/downgrades vigoram sempre no **1º dia do mês seguinte** sem pro-rata ou créditos retroativos; downgrades ficam bloqueados se `active_users > target.max_admin_users`. Condições históricas permanecem gravadas em `saas_subscription_price_terms` (zero reajuste automático).
3. **Cobrança manual SaaS (`C04`):** Faturamento 100% manual no console Master (vencimento padrão dia 10, sem gateway de pagamento, PIX/boleto automático ou emissão automática de NFS-e). Recebimentos, alocações, estornos compensatórios, anulações (somente sem alocações ativas), ajustes, acordos (0% encargos automáticos) e documentos fiscais externos são operados via RPCs idempotentes auditadas para `MASTER + AAL2` e segregados da tesouraria das Lojas.
4. **Inadimplência, suspensão manual e D01 (`C03`, `D01`):** A inadimplência registra `past_due` e tolerância de 7 dias corridos; **nenhuma suspensão é automática**. A suspensão manual exige saldo vencido e fim da tolerância de 7 dias, bloqueando escritas operacionais/financeiras (`private.tenant_write_allowed`) enquanto preserva consulta de dados, exportações e abertura de chamados. A reativação exige ausência de atraso ou acordo registrado. O cancelamento imediato abre janela `D01` de 90 dias para leitura/exportação.
5. **Suporte e SLA comercial (`C06`):** Notas internas (`visibility = 'internal_note'`) ficam estritamente ocultas aos usuários da Loja por RLS; atribuição, prioridade e abertura de chamados internos operam por RPCs idempotentes (`MASTER`/`SUPPORT + AAL2`); SLA de 1 dia útil (540 minutos úteis em horário comercial Seg–Sex 09:00–18:00 `America/Sao_Paulo`); Lojas visualizam aviso somente quando existe sessão de suporte `read_only` ativa em seu escopo.

## Decisão

### 1. Migration aditiva única (`supabase/migrations/20261126120000_v35_m04_master_saas_operations.sql`)
- Funções privadas (`private.tenant_write_allowed`, `private.plan_version_seat_limit`, `private.tenant_active_seat_count`, `private.tenant_seat_limit`).
- Controle de assentos `C07` em `public.read_tenant_seat_usage`, `public.assign_tenant_user_role` e `public.accept_onboarding_invite`.
- Ciclo comercial e retenção em `public.read_tenant_commercial_status`, `public.confirm_saas_subscription_hiring_idempotent`, `public.schedule_saas_plan_change_idempotent`, `public.cancel_scheduled_saas_change_idempotent`, `public.apply_scheduled_saas_plan_change_idempotent`, `public.mark_saas_subscription_past_due_idempotent`, `public.record_saas_collection_event_idempotent`, `public.suspend_saas_subscription_manual_idempotent`, `public.reactivate_saas_subscription_idempotent` e `public.cancel_saas_subscription_idempotent`.
- Ledger/acordos/fiscais SaaS em `public.register_saas_payment_idempotent`, `public.allocate_saas_payment_idempotent`, `public.reverse_saas_payment_allocation_idempotent`, `public.reverse_saas_payment_idempotent`, `public.void_saas_invoice_idempotent`, `public.apply_saas_invoice_adjustment_idempotent`, `public.record_saas_payment_agreement_idempotent`, `public.register_saas_fiscal_document_idempotent` e `public.read_master_saas_financial_summary`.
- Suporte/SLA/aviso e busca estendida em `public.add_master_support_internal_note_idempotent`, `public.assign_master_support_ticket_idempotent`, `public.create_saas_internal_ticket_idempotent`, `public.list_platform_support_staff`, `public.read_tenant_active_support_session` e `public.search_platform_master_tenants` (com 7 status comerciais).

### 2. Interface e Serviços
- Serviços: `src/lib/master-subscriptions.ts`, `src/lib/support-sla.ts`, e extensões em `master-console.ts`, `master-billing.ts`, `master-support.ts` e `master-support-sessions.ts`.
- Componentes Master: `MasterSubscriptionLifecyclePanel.tsx` em `MasterClient360.tsx` (carregamento preguiçoso explícito), modelos de rascunho em `MasterPlanLifecycle.tsx` sem autopublicação, 7 status em `MasterConsole.tsx`, ledger/acordos/fiscais/`Resumo SaaS` em `MasterBilling.tsx` (preservando zero RPC automática na montagem inicial), triagem/notas internas/SLA/chamado interno em `MasterSupportQueue.tsx` (`list_platform_support_staff` apenas sob clique) e faixa sanitizada de Jobs em `MasterOperations.tsx`.
- Componentes Tenant/Onboarding: aviso comercial `C02` em `OnboardingAcceptance.tsx`, painel comercial/assentos/D01 em `Configuracoes.tsx`, consulta explícita sob demanda `"Consultar assentos do plano"` em `Cadastros.tsx`, e banners `read_only` / `past_due` / `suspended` / `D01` em `Workspace.tsx`.

## Consequências e Limites

- **Positivo:** Entregas M04 (`A–D`) isoladas sobre `83e362d2`, compatíveis com `M02.03` e `M03`, com cobertura Vitest e gate PostgreSQL descartável (`scripts/check_master_saas_m04_pg.py` no `.github/workflows/foundation-checks.yml`).
- **Pendente / Gates:** `check_sql.py` (`pglast`), execução em `postgres:17`, aplicação aditiva da migration no DEV e homologação autenticada DEV (`MASTER/AAL2`, `SUPPORT/AAL2` e tenant) seguem `NOT EVALUATED` neste pacote. Nenhum dado DEV existente foi alterado.
