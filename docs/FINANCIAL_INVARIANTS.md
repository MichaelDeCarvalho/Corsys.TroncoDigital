# Invariantes financeiras

## I-001 — Valores exatos
Todo valor monetário persistido usa `numeric(14,2)`.

## I-002 — Valor positivo
Cobranças, pagamentos, créditos e alocações não aceitam valor zero ou negativo.

## I-003 — Saldo derivado
Saldo nunca é fonte primária editável.

## I-004 — Imutabilidade
Fatos financeiros confirmados não aceitam `UPDATE` ou `DELETE`.

Correções são novos eventos:

- adjustment;
- cancellation;
- reversal.

## I-005 — Crédito e desconto são conceitos diferentes
Desconto/isenção reduz uma cobrança via `charge_adjustments`.
Crédito transferível fica em `member_credits`.

## I-006 — Alocação tem exatamente uma origem
Uma alocação aponta para:

- um `payment`; ou
- um `member_credit`;

nunca ambos e nunca nenhum.

## I-007 — Mesmo integrante
Charge, payment/member_credit e allocation devem pertencer ao mesmo integrante e organização.

## I-008 — Não sobrealocar
A soma de alocações ativas não pode superar:

- o valor efetivo da cobrança;
- o valor do pagamento;
- o valor do crédito.

## I-009 — Reversão explícita
Pagamento com alocações ativas não pode ser estornado até as alocações serem revertidas.
Cobrança com alocações ativas não pode ser cancelada até as alocações serem revertidas.

## I-010 — Período fechado
Novos fatos com `accounting_period` fechado são rejeitados.
Correções posteriores devem ser lançadas em período aberto.

## I-011 — Idempotência de recorrência
A mesma regra + integrante + competência não pode gerar duas cobranças-base.

## I-012 — Retry de comando
A mesma idempotency key não pode representar payload diferente.

## I-013 — Pagamento operacional precisa de conta
Pagamento `operational` exige `financial_account_id`.

## I-014 — Histórico migrado não é caixa atual
`migration_reconciled` não entra no saldo corrente de conta financeira.

## I-015 — Cancelamento não apaga cobrança
A cobrança original permanece registrada.

## I-016 — Estorno não altera pagamento
O pagamento original permanece registrado.

## I-017 — Recebível não é caixa
`charge` não produz movimento bancário.

## I-018 — Integridade visível
Views expõem `integrity_ok`; estados impossíveis não são mascarados.


## I-019 — Histórico legado não reconciliado é non-posting
Registro histórico sem contexto suficiente não entra em `charges`/`payments` canônicos.
Ele fica em `legacy_financial_records` e não altera saldos.
