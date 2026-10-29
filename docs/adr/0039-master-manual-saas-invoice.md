# 0039 — Cobrança SaaS Master: Emissão manual de faturas contratuais

Data: 29/10/2026. Escopo: V35 — Cobrança SaaS Master / Faturamento Manual.

## Evidência e decisão

A gestão operacional de assinaturas SaaS na plataforma CorSys Tronco Digital exige a capacidade de emissão pontual/manual de faturas de assinatura para Lojas clientes pelo operador Master, sem recorrer a fluxos automáticos de lote e mantendo integridade financeira irrestrita. Nenhuma digitação arbitrária de preços no frontend, criação de faturas sem assinatura ativa ou mutação de tabelas imutáveis é permitida.

Decidiu-se pela introdução de RPCs transacionais server-side com derivação contratual de preço e garantia de idempotência:
1. `preview_saas_manual_invoice`: Exige operador autenticado com papel `MASTER` e garantia MFA (`aal2`). Valida a existência da Loja (`organization_id`), a normalização da competência ao primeiro dia do mês (`extract(day from competence) = 1`) e a presença de assinatura ativa/faturável (`saas_subscriptions`). Deriva o preço unitário e total estritamente a partir das cláusulas vigentes em `saas_subscription_price_terms`, com fallback determinístico para `saas_plan_versions` e `saas_plans`. Aplica fail-closed: múltiplos termos sobrepostos no período rejeitam com SQLSTATE `55000`. Calcula as datas de prestação do serviço e o vencimento contratual. Verifica se já existe fatura emitida para a mesma competência, retornando o indicador `already_billed: true` para prevenção de duplicidade.
2. `issue_saas_manual_invoice`: Exige `MASTER` + `AAL2`. Trava deterministicamente a linha da Loja (`for update`) para serializar faturamentos concorrentes. Bloqueia duplicidade de faturas não canceladas para o mesmo período (`55000`). Registra a intenção em `private.idempotency_begin` com hash do payload (rejeitando reuso com payload divergente sob `22023`). Gera número sequencial padronizado via `saas_invoice_seq` com prefixo da plataforma (`saas_platform_configuration.invoice_prefix`). Insere atomicamente a fatura em `public.saas_invoices`, o item contratual em `public.saas_invoice_items`, o registro de auditoria em `public.saas_master_audit_logs` e completa a chave via `private.idempotency_complete`. Replays idênticos retornam o UUID da fatura gerada sem duplicação de dados.

Na interface `MasterBilling` (`src/components/MasterBilling.tsx`), disponibilizou-se a funcionalidade de emissão manual:
- Painel integrado com seleção da competência (`AAAA-MM`), vencimento determinístico e descrição opcional.
- Consulta prévia obrigatória que exibe plano, preço contratual derivado do servidor (somente leitura), período de prestação e discriminação de itens.
- Bloqueio fail-closed de confirmação quando a competência já estiver faturada.
- Emissão idempotente com chave determinística preservada em caso de erros de rede para evitar duplicações em tentativas consecutivas.

## Validação e limites

- Invariantes de autorização (`MASTER` + `AAL2`), fail-closed de termos concorrentes, integridade de competência, inserção atômica, idempotência com payload hash e duplicidade cobertos por script dry-run de rollback transacional (`supabase/tests/test_master_manual_invoice_rollback.sql`).
- Testes automatizados de frontend e modelo de cliente em `src/components/MasterBilling.test.tsx` (10 testes passando).
- Validação estática completa de TypeScript (`npm run typecheck`) e suíte de testes (`npm test`).
- Apenas faturas internas de assinatura foram implementadas; não foram integrados gateways externos, PIX, boletos, emissão fiscal (NF-e) ou conciliação bancária neste lote.
- A migração incremental `20261029000001_v35_master_manual_invoice.sql` foi preparada e validada no código local; o banco Supabase DEV e produção NÃO foram modificados.
