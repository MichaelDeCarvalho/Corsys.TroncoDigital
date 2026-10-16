# ADR-0014 — Master e suporte não são papéis de tenant

- **Status:** accepted
- **Data:** 2026-09-07
- **Contexto:** a Corsys precisa gerenciar clientes e oferecer suporte.
- **Problema:** um perfil global com bypass invisível de RLS criaria risco grave de LGPD e isolamento.
- **Decisão:** `platform_staff` é separado de `user_roles`. Master administra metadados comerciais. Acesso ao ambiente do cliente requer `saas_support_sessions`, motivo, expiração, auditoria e escopo read-only por padrão.
- **Alternativas consideradas:** MASTER em todas as organizations; service role no frontend; bypass global de RLS.
- **Consequências positivas:** least privilege e rastreabilidade.
- **Trade-offs / riscos:** suporte é deliberadamente mais controlado.
- **Impacto em segurança:** reduz blast radius de credencial Master.
- **Impacto em dados/migrations:** migration 006/007.
- **Plano de rollout:** testar sessão expirada, cross-tenant, ausência de sessão e tentativas de escrita.
- **Rollback:** suporte pode operar sem impersonation, usando somente diagnósticos comerciais.
