# ADR-010 — Comandos financeiros transacionais

**Status:** Aceito

Cliente não recebe CRUD irrestrito sobre fatos financeiros.
Operações críticas passam por funções/comandos transacionais com autorização server-side.
