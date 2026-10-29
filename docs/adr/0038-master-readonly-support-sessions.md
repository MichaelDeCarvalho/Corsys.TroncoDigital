# 0038 — Gestão de sessões temporárias Master somente leitura

Data: 28/10/2026. Escopo: V35 P1 — Controle de Acesso e Suporte Master.

## Evidência e decisão

Operações de diagnóstico técnico por operadores da plataforma Corsys exigem inspeção pontual de dados de Lojas sem violar o isolamento multi-tenant ou o princípio de imutabilidade financeira. Nenhuma impersonação no frontend, token arbitrário de longa duração ou permissão de escrita em contas de clientes é admissível.

Decidiu-se pela introdução de RPCs transacionais server-side que gerenciam sessões temporárias estritamente `read_only`:
1. `start_master_support_session`: Exige operador autenticado com papel `MASTER` e garantia MFA (`aal2`). Valida a existência da Loja e exige justificativa técnica obrigatória (5 a 500 caracteres). Define o prazo fixo de validade no servidor em exatamente 15 minutos (`clock_timestamp() + interval '15 minutes'`), sem parâmetros arbitrários de tempo pelo cliente. Bloqueia a abertura de sessões concorrentes para o mesmo operador e Loja. Implementa proteção idempotente com replay seguro (retorna o identificador existente sem duplicar registros nem prorrogar o prazo de sessões expiradas). Registra auditoria em `saas_master_audit_logs`.
2. `get_active_master_support_session`: Consulta de forma vinculada a `auth.uid()` e à Loja (`organization_id`) o status da sessão ativa não expirada e não encerrada, computando os segundos restantes no servidor.
3. `end_master_support_session`: Permite o encerramento idempotente antecipado da sessão pelo operador proprietário (`staff_user_id`), preenchendo `ended_at` e registrando evento de auditoria correspondente. Nega encerramento por outro operador (42501).

A interface `MasterOperations` incorpora a gestão de sessões na aba de suporte: seleção da Loja por diretório ou UUID, formulário de abertura motivado, visualização de sessão ativa com contador regressivo e botão de encerramento, reportando erros reais do servidor de forma fail-closed caso a RPC falhe ou seja rejeitada.

## Validação e limites

- Invariantes de autorização, replay, expiração e auditoria cobertos por script dry-run de rollback transacional (`supabase/tests/test_master_support_sessions_rollback.sql`).
- Testes unitários focados (`src/components/MasterSupportSessions.test.tsx` e `src/components/MasterOperations.test.tsx`) cobrindo autorização, validação de entradas, propagação de erros, ciclo de vida e renderização.
- P0 de idempotência de chamados concluído e homologado em DEV (`docs/V35_P0_SUPPORT_20261028.md`).
- Este lote P1 está preparado e verificado no código local; migração SQL remota NÃO aplicada e homologação DEV pendente.
