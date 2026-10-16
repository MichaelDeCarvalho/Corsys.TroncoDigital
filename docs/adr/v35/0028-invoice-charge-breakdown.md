# ADR-0028 — Encargos separados do valor-base da fatura

## Status
Aceito.

## Decisão
A tabela de cobrança diferencia valor-base, multa, juros/outros ajustes, total atualizado, pago e saldo. Encargos postados são ajustes imutáveis, não reescrita do valor original.

## Consequência
A dívida histórica fica explicável e auditável. Política de multa/juros é contratual/versionada, não constante universal.
