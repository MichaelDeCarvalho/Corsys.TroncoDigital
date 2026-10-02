# ADR-0015 — Web responsiva e PWA-ready

- **Status:** accepted
- **Data:** 2026-09-07
- **Contexto:** o sistema deve funcionar no navegador e no celular.
- **Problema:** manter dois aplicativos financeiros separados aumentaria custo e risco de divergência.
- **Decisão:** uma aplicação web responsiva, mobile-first/PWA-ready, compartilhando backend, autorização e regras financeiras. Sem escrita financeira offline no MVP.
- **Alternativas consideradas:** app nativo separado; desktop-only.
- **Consequências positivas:** uma base de código e mesma segurança em desktop/mobile.
- **Trade-offs / riscos:** recursos nativos avançados podem exigir evolução posterior.
- **Impacto em segurança:** mesmo token/RLS/backend para qualquer viewport.
- **Impacto em dados/migrations:** nenhum específico.
- **Plano de rollout:** testar breakpoints, touch, rotas diretas, autenticação e operações críticas em navegadores móveis.
- **Rollback:** navegador desktop continua operando independentemente de instalação PWA.
