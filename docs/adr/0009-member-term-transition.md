# ADR 0009 — Sucessão ou encerramento futuro de condição individual

- **Status:** accepted para DEV
- **Data:** 2026-10-08
- **Contexto:** condições `recurring_member_terms` possuíam término inclusivo, mas a UI/RPC só permitiam inserção; termos sem término não podiam ser substituídos sem conflito de exclusão.
- **Decisão:** disponibilizar `transition_member_term`, uma operação transacional para encerrar termo aberto na competência anterior a uma data futura e opcionalmente inserir um sucessor da mesma regra. Término puro retorna ao valor geral da regra. Não permitir substituição retroativa, reedição de valor histórico, escrita direta do browser nem geração implícita de cobranças.
- **Autorização:** exigir `settings.manage`, assinatura elegível via `private.require_permission`, organização/integrante e termo vinculados, consulta com lock, validação de valores finitos dentro de numeric(14,2), idempotência e auditoria. RPC com search_path vazio e EXECUTE negado a anon.
- **Alternativas:** update direto do client (rejeitado por autorização/concorrência); deletar termo anterior (rejeitado por perda do histórico); inserir sucessor sobreposto (rejeitado por constraint e semântica).
- **Benefícios:** programação de isenções e valores futuros sem alterar cobranças já lançadas. Fechamento e sucessão são atômicos; retry usa a mesma chave.
- **Trade-offs/riscos:** `effective_to` é atualizado somente para delimitar vigência histórica; hipótese de termos já consumidos em competências anteriores é preservada porque fronteira futura. Últimos termos já fechados não podem ser reabertos pelo comando; tratamento é fail-closed (`40001`). Concorrência simultânea de HTTP real ainda não foi homologada. Todo SECURITY DEFINER precisa de revisão contínua.
- **Migration:** DEV `20261008211155_member_term_transition`; sem alteração de RLS, grants de tabelas, cobranças ou pagamentos. Manifesto mantém SHA256 da fonte.
- **Validação:** `scripts/verify_dev_member_term_transition.sql`, duas lojas, claims simuladas, positivos, negativos, auditoria e ROLLBACK PASS. HTTP/JWT real não avaliado; testes frontend na CI devem ser conferidos.
- **Rollback/forward-fix:** revogar EXECUTE da nova RPC caso necessário, preservando dados; mudanças de banco já versionadas não devem ser desfeitas por reset. Desenvolvimento apenas, sem deploy de produção.
- **PR:** #4, branch `feat/v35-dev-gate-20261002`.
