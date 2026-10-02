# ADR-0013 — Billing SaaS separado do financeiro das Lojas

- **Status:** accepted
- **Data:** 2026-09-07
- **Contexto:** a Corsys cobrará assinatura pelo uso do sistema.
- **Problema:** mensalidade do software não pode se misturar com mensalidade dos integrantes nem com tesouraria do cliente.
- **Decisão:** criar núcleo próprio `saas_subscriptions + saas_invoices + saas_payments + allocations`, com fatos financeiros imutáveis e saldos derivados.
- **Alternativas consideradas:** reutilizar `charges/payments` de integrantes; delegar toda a verdade ao provider externo.
- **Consequências positivas:** reconciliação comercial independente, suporte a pagamento manual/provider e histórico auditável.
- **Trade-offs / riscos:** maior número de entidades e necessidade de webhook/idempotência.
- **Impacto em segurança:** dados de faturamento visíveis apenas a Master/Billing e admins autorizados da própria Loja.
- **Impacto em dados/migrations:** migration 006.
- **Plano de rollout:** provider-agnostic primeiro; escolher provider em ADR posterior.
- **Rollback:** núcleo pode operar manualmente até integração de provider.
