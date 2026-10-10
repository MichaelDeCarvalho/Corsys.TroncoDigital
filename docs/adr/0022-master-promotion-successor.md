# ADR 0022 — Versões sucessoras de promoções sem mutação histórica

Status: DEV only, 2026-10-10.

A versão promocional publicada não deve ser editada; seu benefício e validade constituem histórico comercial. A base V35 já fornece `create_saas_promotion_successor_draft` e `publish_saas_promotion_version`, mas faltava retry protegido e verificação de origem mais recente.

Decisão: `create_master_promotion_successor_idempotent` valida MASTER/AAL2, parâmetros, idempotência de payload e bloqueio transacional da série; rejeita predecessor obsoleto e inicia nova versão apenas como draft. A UI escolhe série atual publicada, não atualiza registro anterior. Publicação explícita pelo fluxo já existente encerra a janela da versão anterior.

Segurança/validação: `DEV_MASTER_PROMOTION_SUCCESSOR_ROLLBACK_PASS` confirma draft, publicação, retrocompatibilidade histórica, colisão de chave e rejeição de fonte obsoleta em DEV com ROLLBACK. Risco: teste SQL de claims não comprova token HTTP assinado ou concorrência em conexões reais; sem promoção aplicada à cobrança, nem PROD autorizado.

