# ADR 0014 — Publicação contábil validada e idempotente

Status: **aceito exclusivamente em DEV**, 2026-10-09. Complementa ADR 0012 e 0013 e `docs/adr/v35/0016-accounting-plans-effective-dating.md`.

**Problema:** o comando legado `publish_accounting_plan` verificava mapeamento ausente e draft, mas não todos os riscos da pré-validação nova; continuava alcançável por usuários com `accounting.manage` via REST RPC. Confiar no botão da UI ou no preview antigo criaria bypass/TOCTOU.

**Decisão:** expor ao authenticated apenas `publish_validated_accounting_plan`, que exige permissão contábil e elegibilidade da Loja, expected_from/to, motivo e chave de idempotência. A transação trava a Loja e plano draft, protege as 5 tabelas de categorias/contas/mapeamentos com `SHARE` e refaz `preview_accounting_plan_publication`. Se `ready=false`, falha fechado com `23514`; se há revisão de vigência obsoleta, `40001`. Quando apto, chama `publish_accounting_plan` internamente e registra auditoria. Constraint exclusão de validade publicada e triggers de imutabilidade permanecem.

**Segurança/compatibilidade:** revogado `EXECUTE` de `publish_accounting_plan` para `PUBLIC,anon,authenticated`. A função antiga não foi removida nem alterada, preservando contrato interno; consumidores externos do RPC antigo requerem migração explícita. Nenhum grant novo em tabelas, nenhum dado migrado, nenhum pagamento.

**Compromissos:** `LOCK TABLE SHARE` é global, e não por organização. Foi preferido a aceitar phantoms de inserção durante a publicação; só apropriado para operação rara, monitorar tempo/espera e avaliar alternativa por lock de tenant + gatilhos quando necessidade/escala comprovarem. Mudanças de catálogo **posteriores** à publicação ainda podem exigir sucessor, e não foram restringidas neste incremento.

**Validação:** migration Supabase DEV `20261009162535`, SHA256 no manifesto. `scripts/verify_dev_validated_accounting_publication.sql` com `ROLLBACK_PASS` nas duas Lojas (sucesso, negativo, retry, escopo, roles, assinatura, colisão, auditoria, imutabilidade e ledger). Teste HTTP/JWT assinado, sessões simultâneas, revisão mobile e impacto de locks **não avaliados**. Não homologado para produção.

**Contenção:** revogar EXECUTE da nova RPC; preservar planos e dados. Evitar reset do banco. Qualquer mudança em regras de publicação precisa de nova migration e revalidação.
