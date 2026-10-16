# ADR 0020 — Correções financeiras por eventos e idempotência

Status: aceito para DEV (2026-10-09/10), sem autorização PROD.

Decisão: `cancel_member_charge_idempotent`, `close_financial_period_idempotent`, `reopen_financial_period_idempotent`, `cancel_tenant_institutional_obligation_idempotent` e `correct_tenant_institutional_obligation_idempotent` encapsulam comandos de backend auditados existentes e conservam chaves de operação para reenvio seguro. Correção institucional exige estado esperado (categoria/fundo/descrição/competência/vencimento/valor/valor já liquidado) e bloqueia a obrigação base antes de comparar; divergência retorna `40001` e exige atualização, sem escrita. As regras originais mantêm classificação contábil, limites de valor liquidado, snapshot de aprovação e eventos históricos.

Alternativas recusadas: UPDATE/DELETE de fatos financeiros, otimização no browser, reenvio com nova chave após timeout, sobrescrever dados com formulário desatualizado.

Evidência: `DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS`, `DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS`, `DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS` em duas Lojas, com replays, negações e ROLLBACK. Testes HTTP/JWT real e concorrência independente ainda pendentes. RPCs antigas continuam acessíveis com as permissões existentes; rever contratos antes de produção.

