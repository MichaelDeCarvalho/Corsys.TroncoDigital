# ADR-0028 — estorno institucional com preservação do histórico

Decisão de 2026-10-15: reutilizar fatos e tabelas de reversão existentes. Um novo
comando exige institutional.manage, vínculo/permissão/assinatura válidos,
idempotência por ator e organização e motivo explícito. Sem escrita direta do
cliente em tabelas, novos grants de tabela ou mudanças de RLS.

Competência derivada da data do estorno; a linha financial_periods é travada como
no fechamento. Obrigações são travadas por UUID antes do fato, respeitando os
triggers de alocação. Se uma nova obrigação receber alocação durante a tomada de
locks, recusar com40001, sem inverter a ordem. Reverter alocações e depois o fato
na mesma transação; auditoria única e replay retornam o ID original.

Recusar alocação em obrigação já cancelada: retirar sua liquidação sem um novo
evento de ajuste produziria aberto inconsistente. Esse caso permanece pendente
de regra de negócio/modelagem, sem alterar cancelamentos históricos.

Recusar movimento com conciliação ativa; desfazimento da conciliação é explícito
e separado. Guard adicional trava o fato e impede nova conciliação institucional
após estorno. Sem apagar vínculos, linhas bancárias, pagamentos ou recebimentos.

Recuperação: retirar a interface em release sucessor e revogar o comando se
necessário; preservar eventos/auditoria. Não executar migration DOWN destrutiva.
Banco DEV exclusivo szqkdekwhzxsoxorgvaz, nenhuma mudança de produção.

Evidência inicial: quatro casos positivos A/B e44 negações SQL rollback, claims
simuladas. Isso não demonstra concorrência real nem homologação assinada da UI.
Referências: V35_INSTITUTIONAL_REVERSAL_PLAN.md e gate SQL versionado.
