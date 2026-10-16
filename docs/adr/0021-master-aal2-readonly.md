# ADR 0021 — Segregação do Master SaaS e acesso apenas AAL2

Status: aceito para DEV (2026-10-10), primeiro incremento do frontend Master, produção bloqueada.

Decisão: funções `read_platform_master_overview` e `list_platform_master_tenants` consultam diretório e indicadores agregados, sempre com `private.require_platform_staff('MASTER')`, que impõe MFA AAL2 e staff ativo. A navegação `Master SaaS` só é mostrada após validação positiva do servidor, mas não é um mecanismo de autorização: endpoints e views seguem aplicando verificação no PostgreSQL. `MasterConsole` exibe visão geral e diretório; `MasterCommercialCatalog` exibe histórico comercial read-only por views protegidas. Não há impersonação, troca de identidade, operações financeiras de cliente ou alteração comercial com esta UI.

Evidência: `DEV_MASTER_READONLY_AAL2_ROLLBACK_PASS`, inclusive MASTER AAL2 positivo, MASTER AAL1 negado, tenant AAL2 negado, anon sem EXECUTE. Cliente/mocks/CI não provam login real MFA e não equivalem aos 6 módulos Master nem Cliente 360º. Recuperação via revoke EXECUTE e remoção de nav, sem afetar assinaturas. Onboarding, billing Master, suporte cross-tenant temporário e CRUD/versionamento comercial continuam no backlog V35.

