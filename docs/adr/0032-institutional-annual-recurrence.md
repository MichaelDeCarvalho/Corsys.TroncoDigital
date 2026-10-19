# ADR-0032 — Recorrência institucional anual

Data: 19/10/2026. DEV somente.

Quatro RPCs anuais separadas reutilizam tabelas e regras institucionais existentes. As funções mensais e migrations aplicadas permanecem intactas. O mês da primeira versão de preço fixa o aniversário anual; reajustes alteram valores futuros sem mudar esse mês. A prévia inclui esse mês no fingerprint e só fica pronta na competência elegível. Histórico de emissão bloqueia repetição mesmo após cancelamento. Vencimentos usam o último dia disponível do mês.

Cadastro/situação exigem `settings.manage`; prévia/emissão exigem `institutional.manage`. Mantidos assinatura apta, idempotência, locks de organização compatíveis com FKs, fechamento, categoria/mapeamento e aprovação de despesas. Nenhuma nova tabela ou policy; anon sem EXECUTE. Frontend escolhe o comando conforme a frequência conferida e recusa resposta anual com mês incoerente. Reajuste usa a RPC existente.

Migration DEV #61 `20261019233739`. SQL A/B × despesa/receita com rollback PASS, 28 negativas: mês incorreto, prévia obsoleta, escopo/ID estrangeiro, duplicidade e reemissão após cancelamento. Caixa preservado. Testes de interface para cadastro e bloqueio/emissão anual PASS. UI real e concorrência HTTP anual ainda pendentes neste checkpoint. O recurso cobre anuidades institucionais; cobranças de integrantes e eventos especiais mantêm seus requisitos próprios.
