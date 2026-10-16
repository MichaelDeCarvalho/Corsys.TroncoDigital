# ADR 0020 — Ciclo versionado de ofertas promocionais Master

Status: DEV only, 2026-10-10.

## Contexto
O banco V35 mantém versões de promoções, estados de publicação, séries e auditoria; o frontend Master exibia apenas dados históricos. É necessário criar rascunhos e publicar sem conceder benefícios automaticamente nem alterar contratos vigentes.

## Decisão
Acrescentar `create_master_promotion_draft_idempotent` e `publish_master_promotion_draft_idempotent` usando `private.master_idempotency_keys` para autorização de replay com hash do payload, permissão Master AAL2 e auditoria. A UI separa criação de rascunho da publicação com confirmação `PUBLICAR`. O comando de publicação delega à RPC V35 original, que fecha vigências anteriores da mesma série quando há sucessor, sem recalcular faturas históricas.

## Riscos e evidência
Script `verify_dev_master_promotions.sql` passou em DEV com ROLLBACK incluindo Master AAL2, Master AAL1 negado e tenant AAL2 negado, replay protegido, auditoria. Não garante concessão/consumo de benefícios ou integração com cobranças; nenhum provedor externo foi chamado. Não há mudanças em PROD. Antes da publicação pública verificar segurança de resgates, concorrência real, UI mobile e histórico de códigos promocionais.

