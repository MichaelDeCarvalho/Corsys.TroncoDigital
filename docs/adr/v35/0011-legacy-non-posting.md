# ADR-011 — Histórico legado não reconciliado é non-posting

**Status:** Aceito

Dados antigos sem contexto suficiente para reconstrução segura não entram no núcleo canônico.

- histórico reconciliado: `migration_reconciled`;
- saldo consolidado de abertura: `migration_opening` / `opening_credit`;
- histórico apenas informativo: `legacy_financial_records`.

Motivo: impedir que pagamentos antigos isolados gerem crédito atual artificial ou que cobranças antigas isoladas gerem dívida atual artificial.
