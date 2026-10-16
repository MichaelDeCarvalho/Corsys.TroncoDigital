# Matriz de testes — fundação financeira

**Status deste pacote:** casos definidos; execução real pendente de PostgreSQL/Supabase local.

| ID | Cenário | Resultado esperado |
|---|---|---|
| F-001 | Cobrança R$100 sem pagamento | aberto R$100 |
| F-002 | Pagamento R$100 alocado integralmente | aberto R$0, crédito R$0 |
| F-003 | Pagamento R$40 em cobrança R$100 | aberto R$60 |
| F-004 | Pagamento R$150 em cobrança R$100 | crédito disponível R$50 |
| F-005 | Tentar alocar acima do saldo da cobrança | rejeitado |
| F-006 | Tentar alocar acima do saldo do pagamento | rejeitado |
| F-007 | Ajuste reduz cobrança abaixo do já alocado | rejeitado |
| F-008 | UPDATE em pagamento confirmado | rejeitado |
| F-009 | DELETE em cobrança confirmada | rejeitado |
| F-010 | Cancelar cobrança com alocações ativas | rejeitado |
| F-011 | Reverter alocações e cancelar cobrança | permitido |
| F-012 | Estornar pagamento com alocações ativas | rejeitado |
| F-013 | Reverter alocações e estornar pagamento | permitido |
| F-014 | Mesmo integrante/regra/competência duas vezes | segunda cobrança-base rejeitada |
| F-015 | Retry mesma idempotency key/payload | retorna referência original |
| F-016 | Reusar key com payload diferente | rejeitado |
| F-017 | Pagamento operacional sem conta | rejeitado |
| F-018 | `migration_reconciled` sem conta | permitido; não entra no caixa atual |
| F-019 | Legacy non-posting | não altera posição nem caixa |
| F-020 | Fechar competência e inserir fato nela | rejeitado |
| F-021 | Reabrir competência com permissão | novo fato volta a ser aceito |
| F-022 | Usuário sem `finance.read` lê outro integrante | negado |
| F-023 | Portal MEMBER lê seu próprio financeiro | permitido |
| F-024 | Portal MEMBER lê financeiro de outro | negado |
| F-025 | Duas alocações concorrentes | não podem sobrealocar |
| F-026 | Duas gerações recorrentes concorrentes | somente uma cobrança-base |
| F-027 | Regra de preço com períodos sobrepostos | rejeitada |
| F-028 | Vínculo recorrente com vigências sobrepostas | rejeitado |
| F-029 | Posição líquida x extrato final | `reconciled = true` |
| F-030 | Integridade impossível introduzida por caminho privilegiado | `integrity_ok = false` ou operação bloqueada |

## Gates antes de UI financeira

1. migrations aplicam do zero;
2. script de invariantes passa;
3. testes RLS positivos e negativos passam;
4. testes de concorrência passam;
5. `v_member_financial_reconciliation.reconciled = true` nos fixtures;
6. nenhum comando financeiro crítico depende de `UPDATE`/`DELETE` no fato original.
