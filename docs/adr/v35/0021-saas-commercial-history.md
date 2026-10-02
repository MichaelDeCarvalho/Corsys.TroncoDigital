# ADR-0021 — Histórico comercial SaaS separado dos tenants

## Status
Aceito.

## Decisão
Preço contratado, contatos comerciais, itens de fatura e eventos de cobrança do SaaS vivem no control plane da plataforma e nunca entram no financeiro interno das Lojas.

## Consequências
- Mudança de preço não reescreve fatura histórica.
- Billing SaaS não aparece no Caixa/DRE do tenant.
- Dados completos de cartão não são armazenados; somente referências/metadata não sensíveis do provider quando necessário.
- Master/Billing continuam separados de roles de tenant.
