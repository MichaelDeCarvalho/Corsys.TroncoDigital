# ADR-0027 — Chamados, SLA operacional e chamados internos

## Status
Aceito.

## Decisão
Chamados registram abertura, autor, atualização, primeira resposta, resolução e tempo decorrido derivado. Chamado de cliente é isolado por tenant. Chamado interno da Corsys usa `ticket_scope=internal` e nunca é liberado pela RLS do tenant.

## Consequência
O Kanban Master pode acompanhar fila e tempos sem expor chamados internos ou de outras Lojas.
