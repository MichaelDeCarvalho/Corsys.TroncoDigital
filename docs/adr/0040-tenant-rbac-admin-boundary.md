# ADR-0040 — Limite de autorização em Perfis e Permissões da Loja

- **Data:** 01/11/2026
- **Status:** Aprovada para DEV; produção não liberada
- **Escopo:** `view-cadastros`, RPCs `assign_tenant_user_role` e `revoke_tenant_user_role`

## Contexto

O modelo RBAC já permite `users.manage` via `role_permissions`, inclusive em papéis delegados. Autorizar qualquer detentor dessa permissão a conceder `ADMIN` a um terceiro permitiria elevação indireta de privilégios, ainda que a autoelevação direta fosse negada.

## Decisão

1. A atribuição ou revogação do perfil `ADMIN` exige **simultaneamente** `users.manage` e que o ator já possua `ADMIN` **na mesma Loja**; a verificação é determinística no PostgreSQL, nunca na UI.
2. Modificações são serializadas por `organizations FOR UPDATE` antes da contagem de administradores; revogar o último `ADMIN` permanece proibido (`55000`).
3. Usuários sem `ADMIN`, mas com `users.manage`, podem gerenciar apenas outros perfis existentes.
4. Alvos devem estar vinculados à Loja; toda mutação tem motivo, idempotência e auditoria append-only. A consulta de `user_profiles` permanece restrita por RLS a usuários ligados a Lojas gerenciadas.
5. Papéis do sistema não são redefinidos e permissões não podem ser editadas pelo frontend.

## Implementação e evidências

Migração Supabase DEV `20261101181945_tenant_rbac_management.sql` (histórico `tenant_rbac_management`). Instalação DEV: PASS. Verificação dos grants: `anon` sem `EXECUTE`, `authenticated` com `EXECUTE` condicionado a validação interna. Smoke SQL transacional com claims simuladas: não-Admin não concede nem revoga ADMIN, atribuição comum preservada, replay idempotente e auditoria única; ROLLBACK confirmou ausência de dados fictícios.

## Limites e continuidade

A homologação de concorrência HTTP independente e a navegação browser com sessões reais ainda não foram executadas. `main` contém o envio inicial do Gemini; correções somente na branch `feat/v35-tenant-rbac` / PR #11. Sem merge, deploy ou migração em produção.
