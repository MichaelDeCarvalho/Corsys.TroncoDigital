# ADR 0011 — Atualização versionada da identidade institucional

Status: aprovado para DEV, 2026-10-08 (Brasil).

A tabela `organization_settings` já existia com dados institucionais, logo, timezone e textos. A V35 exige edição de contato, endereço e chave PIX, sem permitir que o frontend altere diretamente todas as colunas ou outras Lojas.

Decisão: RPC `save_tenant_identity` restringe campos permitidos e checa `settings.manage` antes do lookup. Primeiro cadastro serializa com lock na organização; edições exigem `expected_updated_at` e retornam `40001` se obsoletas. Idempotency key protege reenvio; auditoria lista campos alterados, sem valores pessoais ou PIX.

O helper global `private.set_updated_at` usa `now()`, que não avança durante uma transação. Substituímos apenas o trigger de `organization_settings` pelo `private.bump_tenant_settings_updated_at` para versão monotônica em microssegundos; preservar trigger genérico nas demais tabelas. Como alternativa rejeitada, usar UPDATE direto da Data API ou alteração cega da linha.

Consequências: logo, timezone, textos e histórico permanecem; PIX é apenas identificador de recebimento e nunca realiza transação. SQL A/B com ROLLBACK passou para create/retry/update/stale/roles/suspensão/anon/audit. HTTP/JWT, corrida simultânea e UI real não avaliados. Rollback operacional: revogar EXECUTE da RPC, mantendo tabelas e dados; forward-fix para trigger se necessário. Somente DEV.

