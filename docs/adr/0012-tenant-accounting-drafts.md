# ADR 0012 — Rascunho contábil e mapeamentos por Loja

Status: **aceito apenas para DEV**, 2026-10-08 (Brasil). Complementa `docs/adr/v35/0016-accounting-plans-effective-dating.md`.

## Contexto
Já existiam template Corsys com 91 contas e 86 pais, seis planos DEV, tabelas de contas e mapeamentos com constraints e triggers. O HTML V35 exige manter códigos, hierarquia, natureza, vigência, mapeamentos e publicação sem reclassificar fatos antigos.

## Decisão
Preservar `create_accounting_plan`, `publish_accounting_plan` e os triggers de imutabilidade; disponibilizar ao frontend somente wrappers `create_tenant_accounting_draft` e `set_draft_accounting_mapping` para operações autorizadas em draft. Exigir `accounting.manage`, assinatura elegível, início futuro, chave idempotente, escopo tenant, razão e auditoria. A vinculação é entre categoria financeira e receita/despesa contábil de natureza compatível, ou entre conta financeira e ativo patrimonial analítico. Não modificar planos publicados.

## Concorrência e segurança
A criação faz retry idempotente; mudança de vínculo trava plano e exige `expected_account_id` (nulo apenas quando ainda não há vínculo). Publicar plano pré-existente concorre no mesmo lock. Mapeamentos inválidos, contas estrangeiras, natureza incompatível e plano já publicado são negados antes da mutação. RLS e privilégios de tabela permanecem como estavam.

## Trade-offs
Persistem endpoints legados `create_accounting_plan` e `publish_accounting_plan` com `accounting.manage`; o frontend não dá acesso a publicar sem verificação da cobertura, mas acesso legítimo via RPC legado continua possível. Valores/registros históricos não são alterados. Limites de listagem do frontend ainda requerem paginação para Lojas grandes. Não há validação de UX real/mobile ou concorrência simultânea HTTP.

## Evidência e recuperação
Migração DEV `20261009014331_tenant_accounting_drafts_and_mappings`, source hash no manifesto. `scripts/verify_dev_accounting_draft_mappings.sql`: A/B, 91 contas, 86 pais, idempotência, compatibilidade, IAM/RLS, rollback PASS. Caso necessário, revogar EXECUTE só das novas RPCs como contenção e executar forward-fix, sem reset de contas/ledger. Não fazer merge ou deploy de produção sem revisão do plano.

