# ADR-0018 — Edição de lançamento postado vira correção auditável

## Status
Aceito.

## Decisão
Rascunhos podem ser alterados. Um lançamento `posted` é imutável. A ação de interface “Editar” gera uma correção vinculada ao original, com snapshot anterior/novo e motivo.

Cancelamento encerra somente o saldo ainda aberto; não apaga pagamentos ou recebimentos históricos.

## Consequências
- Não existe sobrescrita silenciosa de fatos confirmados.
- Correções em período fechado são postadas em período posterior permitido.
- Valor corrigido não pode ficar abaixo do valor já liquidado.
