# Execução contínua V35 — 19/10/2026

O proprietário determinou continuar entre incrementos, pedindo intervenção apenas para autenticação, bloqueio real de ferramenta ou produção. Não repetir gates já aprovados. PR #5 permanece draft, sem merge/produção.

## HTTP legado e reajuste institucional

Lote novo executado no preview DEV `7e6b1002-001a-423e-a1ac-97d36c9b2213`, sob JWT reais A/B, usando o cliente do aplicativo. Cada identidade: **69 chamadas/69 requests, PASS**, sem retries automáticos. O helper registra somente RPC/status/código, nunca payloads, headers ou credenciais.

Oito RPCs legadas adicionais: `save_member_profile`, `schedule_tenant_monthly_price`, `transition_member_term`, `generate_monthly_member_charges`, `publish_tenant_budget`, `set_tenant_budget_line`, `set_draft_accounting_mapping`, `publish_validated_accounting_plan`. Também validada `schedule_institutional_recurring_price` (nova).

Em cada operação: HTTP409/PT409 com replay rejeitado simultâneo e chaves distintas; escopo estrangeiro42501 e IDs estrangeiros23503. Nas cinco operações com resultado persistido de fixture: replay concorrente retornou o mesmo UUID; payload divergente22023. Snapshots de cadastro, regras, termos, orçamento, contabilidade, obrigações e caixa permaneceram iguais. Readback administrativo: uma auditoria por operação de fixture, sem duplicação.

Somado ao gate anterior de identidade/catálogo, cobertura HTTP409: **10/13 RPCs legadas A/B**. Correção institucional, estorno e sucessão Master continuam separados. O teste de estorno precisa distinguir a corrida real de alocação de um simples erro por ID; o Master exige identidade MASTER/AAL2, não uma conta tenant.

Fixtures novas são metadados QA, criados em transação após preflight com rollback. Arquivo `seed_dev_legacy_http_metadata.sql` permanece ROLLBACK por padrão. Integrantes fictícios inativos; regras mensais/institucionais desativadas após A/B; orçamentos vazios e planos futuros permanecem drafts como evidência. Readback final: charges21/payments22/payables22/receivables14; saldo10 por Loja; deadlocks2 cumulativos, sem aumento. Não repetir o lote após cleanup: o helper exige regras ainda ativas e recusa fixtures já limpas.

Dois roteiros SQL antigos tiveram fixtures reconciliadas: criação de categoria ativa passou a ser bloqueada pelo guard contábil atual. Os testes usam categoria elegível das Lojas QA, sem afrouxar o guard, e limitam alterações de papel por usuário+organização. `DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS` e `DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS` observados. Corrigida expectativa residual40001 paraPT409.

## Anuidade institucional

Migration #61 `20261019233739_institutional_annual_recurrence.sql` aplicada exclusivamente DEV. Quatro RPCs anuais separadas, sem alterar funções mensais, tabelas ou RLS. Aniversário fixado na primeira versão de preço; reajuste não o move. Prévia com fingerprint, categoria/plano, período aberto, vencimento ajustado, idempotência, aprovação de despesas e geração única por competência. Cancelamento não permite reemitir a anuidade. ADR-0032.

UI permite periodicidade mensal/anual, com comandos escolhidos a partir da regra conferida; recusa prévia anual incoerente com seu mês. SQL A/B × despesa/receita com rollback PASS e28 negativas esperadas, incluindo mês errado, obsolescência, duplicidade e cancelamento. Caixa preservado. Homologação real anual/concorrência HTTP ainda pendente neste checkpoint. O helper anual novo testa também correção institucional, recupera criação persistida com resposta perdida e cancela/desativa no finally.

Testes locais: suíte completa 44 arquivos/307 testes PASS após UI anual; um teste adicional do helper anual PASS, cobrindo recuperação de resposta perdida e restauração de fetch. Tipos/build, gramática SQL e preservação de 61 migrations PASS. CI da revisão enviada deve ser conferido. Avisos do advisor sobre quatro novas RPCs definer autenticadas são esperados pelo desenho com autorização interna; anon é revogado. Avisos anteriores de proteção de senha e tabelas backend permanecem registrados, sem alegação de segurança integral.

Etapa2 permanece aberta. Próximo escopo imediato é a homologação anual real e os três gates legados restantes; negociar/parcelar, especiais, multiaprovação, ágapes/mútuas e paridade das21telas continuam no escopo. Não tratar esta referência como conclusão do sistema.
