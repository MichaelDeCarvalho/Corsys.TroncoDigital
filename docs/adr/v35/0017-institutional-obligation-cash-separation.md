# ADR-0017 — Obrigações institucionais separadas de caixa

## Status
Aceito.

## Decisão
Contas a Pagar e Contas a Receber representam obrigações/direitos por competência. Pagamentos e recebimentos representam fatos de caixa. A relação ocorre por alocações.

## Consequências
- `institutional_payables` não é pagamento.
- `institutional_receivables` não é recebimento.
- Pagamentos e recebimentos podem ser parciais.
- Fluxo de Caixa deriva de fatos de caixa.
- DRE deriva de competência e correções.
