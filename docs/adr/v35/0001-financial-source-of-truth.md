# ADR-001 — Fonte única da verdade financeira

**Status:** Aceito

Usar `charges`, `payments`, `member_credits` e `receivable_allocations` como fonte operacional.

Não adotar ledger universal, CQRS ou event sourcing completo no MVP.

Saldos são derivados por views/serviços.
