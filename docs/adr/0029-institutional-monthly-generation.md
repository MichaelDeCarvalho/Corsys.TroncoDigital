# ADR-0029 — Geração mensal institucional

Data: 2026-10-16. Estado: implementado no DEV, homologação UI B concluída, A pendente.

## Decisão

Reutilizar institutional_recurring_rules/versions e obrigações existentes, com
quatro comandos estreitos. Cadastro/situação exigem settings.manage; prévia/emissão
exigem institutional.manage, identidade ativa e assinatura apta. Emitir somente
mediante prévia com fingerprint, confirmação e idempotência. Serializar organização,
período e regra; chave determinística por regra/competência impede duplicação,
inclusive após cancelamento. Despesa respeita política de aprovação publicada.
Ajustar vencimento ao último dia válido. Não gerar caixa nem agendamento automático.

## Consequências e validação

Sem novas tabelas/grants/RLS. UI mantém chave em resultado incerto e descarta
prévias obsoletas. 292 testes/tipos/build PASS; SQL rollback A/B com 4 positivos e
56 rejeições esperadas PASS. UI B homologada e limpa; UI A e concorrência HTTP mensal pendentes. Anual/especial,
reajuste e aprovação por múltiplas identidades não estão concluídos por este ADR.
