# ERD lógico — núcleo financeiro

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ MEMBERS : possui
    ORGANIZATIONS ||--o{ FINANCIAL_CATEGORIES : configura
    ORGANIZATIONS ||--o{ FINANCIAL_ACCOUNTS : possui
    ORGANIZATIONS ||--o{ FUNDS : possui
    ORGANIZATIONS ||--o{ ROLES : define
    ORGANIZATIONS ||--o{ LEGACY_FINANCIAL_RECORDS : arquiva

    MEMBERS ||--o{ CHARGES : recebe
    MEMBERS ||--o{ PAYMENTS : realiza
    MEMBERS ||--o{ MEMBER_CREDITS : possui
    MEMBERS ||--o{ RECEIVABLE_ALLOCATIONS : vincula

    FINANCIAL_CATEGORIES ||--o{ CHARGES : classifica
    RECURRING_RULES ||--o{ RECURRING_RULE_VERSIONS : versiona
    RECURRING_RULES ||--o{ CHARGES : gera

    CHARGE_PLANS ||--o{ CHARGES : agrupa
    CHARGES ||--o{ CHARGE_ADJUSTMENTS : ajusta
    CHARGES ||--o| CHARGE_CANCELLATIONS : cancela

    PAYMENTS ||--o{ RECEIVABLE_ALLOCATIONS : origina
    MEMBER_CREDITS ||--o{ RECEIVABLE_ALLOCATIONS : origina
    CHARGES ||--o{ RECEIVABLE_ALLOCATIONS : recebe

    RECEIVABLE_ALLOCATIONS ||--o| ALLOCATION_REVERSALS : reverte
    PAYMENTS ||--o| PAYMENT_REVERSALS : estorna
    MEMBER_CREDITS ||--o| MEMBER_CREDIT_REVERSALS : estorna

    EVENTS ||--o{ EVENT_PARTICIPANTS : possui
    MEMBERS ||--o{ EVENT_PARTICIPANTS : participa
    CHARGES ||--o| EVENT_PARTICIPANTS : materializa

    MUTUAL_BATCHES ||--o{ MUTUAL_ASSIGNMENTS : possui
    MEMBERS ||--o{ MUTUAL_ASSIGNMENTS : recebe
    CHARGES ||--o| MUTUAL_ASSIGNMENTS : materializa
```

## Fonte operacional da verdade

```text
Charge
  + Charge Adjustments
  - Cancellation semantics
          |
          v
Receivable Allocation
          ^
          |
Payment / Member Credit
```

Não existem colunas primárias de:

- saldo do integrante;
- saldo restante da cobrança;
- crédito restante do pagamento;
- saldo atual da conta;
- saldo atual do fundo.


## Reconciliação

A view `v_member_financial_reconciliation` deve produzir:

```text
posição líquida derivada das views
=
último saldo acumulado do extrato
```

Qualquer divergência é tratada como erro de integridade, não como diferença de apresentação.
