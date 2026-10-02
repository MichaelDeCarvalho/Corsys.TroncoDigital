# ADR-008 — Idempotência no backend e banco

**Status:** Aceito

Geração usa `generation_key` e constraints.
Comandos críticos usam `idempotency_keys`.
Frontend não é controle de duplicidade.
