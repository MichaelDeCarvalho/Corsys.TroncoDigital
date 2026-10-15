# ADR-0006 — ciclo de orçamento por Loja

Data: 2026-10-14 Brasil. Status: aceito para implementação DEV; homologação final pendente.

## Decisão

Reutilizar `budget_cycles`, `accounting_budget_lines`, `fund_budget_lines` e as views
existentes de orçamento × realizado. Planejamento não gera fatos contábeis, cobranças
ou pagamentos. Contas contábeis e fundos são agrupamentos separados, sem soma entre si.

Escrita somente por RPC autenticada com `budgets.manage`, validação server-side,
idempotência e auditoria; leitura por `finance.read`. Mutação bloqueia a linha do
ciclo e compara fingerprint do conteúdo revisado. Publicação é comando explícito
separado, revalida contas analíticas ativas/plano publicado com cobertura de vigência
e fundos ativos, e preserva imutabilidade dos ciclos publicados existente no schema.
Linhas podem ser inseridas/substituídas/removidas somente enquanto draft; limite 400.
Nova revisão de um orçamento publicado usa outro ciclo nomeado, preservando o anterior.

## Consequências e recuperação

Nenhum grant direto/RLS alterado. Funções definer têm search_path vazio e permissão
antes de consultar IDs. Helper privado sem EXECUTE para papéis de cliente. Lock do
ciclo serializa comandos; fontes elegíveis são lidas sob SHARE. Não afirmar concorrência
real por HTTP com base em teste SQL sequencial. Fingerprint é controle otimista,
não substitui autorização. Chave idempotente com payload diferente é rejeitada.

Rollback operacional: retornar UI ao commit anterior e revogar EXECUTE das três
novas funções de escrita se necessário, mantendo dados, leituras e histórico; não
apagar ciclos publicados nem editar migration aplicada. Problemas corrigidos por
migration aditiva. Não habilitar publicação em produção antes dos gates do projeto.
