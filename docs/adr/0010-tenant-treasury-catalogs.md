# ADR 0010 — Catálogos de tesouraria por Loja

- **Status:** accepted para DEV, 2026-10-08 Brasil / 2026-10-09 UTC
- **Contexto:** a V35 exige contas de caixa/banco, fundos e formas de pagamento em Plano de Contas. As tabelas existiam com RLS/SELECT, sem mutação por clientes.
- **Decisão:** preservar as tabelas e implementar dois comandos RPC autorizados: `create_treasury_catalog_item` e `set_treasury_catalog_status`. Os comandos suportam `account` (`bank|pix|cash|other`), `fund` (descrição) e `method`, com validação explícita e `settings.manage`.
- **Alternativas rejeitadas:** abertura de INSERT/UPDATE autenticado na tabela, exclusão de contas históricas e duplicação de estrutura contábil.
- **Segurança:** require_permission e assinatura elegível antes do lookup, IDs/linhas do tenant, grants de RPC apenas authenticated, deny anon, search_path vazio, validação servidor, lock e idempotência, auditoria. RLS/grants de tabelas não alterados.
- **Concorrência:** criação serializa nomes normalizados; transição de status exige `expected_active` e lock, devolve `40001` quando obsoleta. Correção aditiva para `EXECUTE INTO` usa `v_old is null` por `active NOT NULL`.
- **Consequência:** status não exclui nem altera saldos/fatos financeiros; operações de postagem devem futuramente respeitar flags active, exigindo teste específico.
- **Migrations:** DEV `20261009011416` e `20261009011533`, fontes/hashes no manifesto. Rollback operacional é revogar EXECUTE dessas RPCs, sem apagar histórico.
- **Testes:** SQL A/B com simulação de claims e ROLLBACK PASS; HTTP/JWT real, concorrência em conexões distintas e revisão visual pendentes.
- **PR:** #4, branch `feat/v35-dev-gate-20261002`.
