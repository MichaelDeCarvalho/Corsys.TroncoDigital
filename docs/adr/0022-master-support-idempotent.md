# ADR 0022 — Operação de suporte Master com resposta idempotente e isolamento

Status: aceito para DEV, 2026-10-10. Produção não autorizada.

## Contexto
O piloto V35 prevê chamados de Loja e tickets internos, conversas, autoria, mudanças de estado e métricas auditáveis. O banco já possui `saas_support_tickets`, `saas_support_ticket_messages`, eventos e RPC `reply_saas_support_ticket`, além da view `v_saas_support_ticket_metrics` com `security_invoker=true`. Master já exige MFA AAL2. Erro de transporte após criação de resposta poderia duplicar mensagem no retry.

## Decisão
Exibir lista paginada e conversa Master a partir do backend, sem inferir métricas pelo relógio do browser. Diferenciar explicitamente `ticket_scope=tenant` e `internal`, mantendo visibilidade conforme RLS. Encapsular respostas tenant na RPC `reply_master_tenant_support_idempotent`, que exige `private.require_platform_staff('MASTER')`, valida escopo, mensagem e estado, bloqueia o ticket sob transação e reutiliza RPC original auditada, guardando resposta para reenvio com chave/payload invariantes. Nenhum comando de responder ticket interno pela API tenant, nenhuma impersonação. Todos os writes permanecem no PostgreSQL.

## Evidências e limites
SQL `verify_dev_master_support_rls.sql`, `verify_dev_master_support_reply.sql` executados com `ROLLBACK`, incluindo Master AAL2 positivo, AAL1/tenant/anon negados e replay sem duplicação; React CI 162 testes no commit `cb6fe527`. AAL de JWT HTTP real, autenticação MFA pela UI, atribuição, notas internas, Kanban completo, sessão suporte read_only temporária e concorrência multiconexão ainda precisam de ensaios próprios. Para conter a nova escrita em DEV, `REVOKE EXECUTE` no wrapper, sem apagar mensagens/eventos.

