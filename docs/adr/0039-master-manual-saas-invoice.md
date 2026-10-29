# 0039 — Cobrança SaaS Master: Emissão manual de faturas contratuais

Data: 29/10/2026. Escopo: V35 — Cobrança SaaS Master / Faturamento Manual.

## Evidência e decisão

A gestão operacional de assinaturas SaaS na plataforma CorSys Tronco Digital exige a capacidade de emissão pontual/manual de faturas de assinatura para Lojas clientes pelo operador Master, sem recorrer a fluxos automáticos de lote e mantendo integridade financeira irrestrita. Nenhuma digitação arbitrária de preços no frontend, criação de faturas sem contrato de preço rastreável, emissão para assinaturas em trial ou mutação de tabelas imutáveis é permitida.

Decidiu-se pela introdução de RPCs transacionais server-side com derivação estritamente contratual de preço e garantia de idempotência:
1. `preview_saas_manual_invoice`: Exige operador autenticado com papel `MASTER` e garantia MFA (`aal2`). Valida a existência da Loja (`organization_id`), a normalização da competência ao primeiro dia do mês (`extract(day from competence) = 1`), a presença de assinatura faturável (`saas_subscriptions` em status `active`, `past_due` ou `cancel_scheduled`, rejeitando explicitamente `trialing` sob `55000`) e datas de vigência da assinatura. Deriva o preço unitário e total estritamente a partir das cláusulas vigentes em `saas_subscription_price_terms`, exigindo termo unívoco cobrindo todo o mês de serviço sem lacunas ou alterações intra-mês; **sem fallback para catálogo de planos ou versões de plano**. Aplica fail-closed: múltiplos termos sobrepostos ou termos parciais rejeitam com SQLSTATE `55000`. Calcula as datas de prestação do serviço e o vencimento contratual. Verifica se já existe fatura ativa emitida para a mesma competência, retornando o indicador `already_billed: true` para prevenção de duplicidade.
2. `issue_saas_manual_invoice`: Exige `MASTER` + `AAL2`. Trava deterministicamente a linha da Loja (`for update`) para serializar faturamentos concorrentes antes da leitura do contrato. Bloqueia duplicidade de faturas não canceladas para o mesmo período (`55000`). Registra a intenção em `private.idempotency_begin` com hash do payload contendo organização, assinatura, competência, vencimento, valor monetário e descrição normalizada (rejeitando reuso com payload ou descrição divergente sob `22023`). Gera número sequencial padronizado via `saas_invoice_seq` com prefixo da plataforma (`saas_platform_configuration.invoice_prefix`). Insere atomicamente a fatura em `public.saas_invoices`, o item contratual em `public.saas_invoice_items`, o registro de auditoria em `public.saas_master_audit_logs` e completa a chave via `private.idempotency_complete`. Replays idênticos retornam o UUID da fatura gerada sem duplicação de dados.

Na interface `MasterBilling` (`src/components/MasterBilling.tsx`), disponibilizou-se a funcionalidade de emissão manual:
- Painel integrado com seleção da competência (`AAAA-MM`), vencimento determinístico e descrição opcional.
- Consulta prévia obrigatória que exibe plano, preço contratual derivado do servidor (somente leitura), período de prestação e discriminação de itens.
- Invalidação automática imediata da prévia diante de alteração de Loja, competência, vencimento ou descrição.
- Proteção contra respostas assíncronas concorrentes/desatualizadas (`AbortController` e controle transacional de requisição).
- Bloqueio fail-closed de confirmação quando a competência já estiver faturada.
- Emissão idempotente com preservação de chave em falhas de rede com resultado incerto para permitir retry seguro sem gerar faturas duplicadas.

## Validação e limites

- Invariantes de autorização (`MASTER` + `AAL2`), fail-closed de termos concorrentes/parciais, ausência de contrato, rejeição de trial, integridade de competência, inserção atômica sob lock, idempotência com payload hash (incluindo descrição) e bloqueio de duplicidade cobertos por script dry-run de rollback transacional (`supabase/tests/test_master_manual_invoice_rollback.sql`), em conformidade com as constraints de FK de `auth.users` e `saas_plan_versions`.
- Testes automatizados de frontend e modelo de cliente em `src/components/MasterBilling.test.tsx` (12 testes passando).
- Validação estática completa de TypeScript (`npm run typecheck`) e suíte de testes (`npm test`).
- Apenas faturas internas de assinatura foram implementadas; não foram integrados gateways externos, PIX, boletos, emissão fiscal (NF-e) ou conciliação bancária neste lote.
- Migration aplicada exclusivamente no Supabase DEV `szqkdekwhzxsoxorgvaz` em 29/10/2026, registrada pelo Supabase como `20261029204044_v35_master_manual_invoice`, após P1 `20261029021140`. Teste SQL `supabase/tests/test_master_manual_invoice_rollback.sql` executado no PostgreSQL DEV e finalizado com `ROLLBACK` (PASS após correção da fixture `organizations.slug`); read-back: 0 faturas, 0 itens, 0 termos de preço, 0 registros de emissão e 0 usuários fictícios persistentes. RPCs instaladas: 2; EXECUTE de `anon`: negado; `authenticated`: disponível sujeito à exigência interna MASTER+AAL2. Produção não modificada. Homologação HTTP com autenticação Master real e concorrência por conexões independentes ainda não executadas.
