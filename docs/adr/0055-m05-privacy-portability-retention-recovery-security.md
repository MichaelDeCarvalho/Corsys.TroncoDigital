# ADR-0055: M05 — Privacidade, Portabilidade, Retenção, Backup/Restore, Recuperação de Acesso e Segurança Operacional

- **Status:** Aceito (Desenvolvimento Acelerado V35 — M05.01 a M05.03)
- **Data:** 2026-11-26
- **Decisões relacionadas:** D01, D02, D03, D04, D05, D06, C03, C05, C06, E03, E06, E07, E08
- **ADRs relacionados:** ADR-0006, ADR-0011, ADR-0012, ADR-0014, ADR-0049, ADR-0050, ADR-0052

## Contexto

A macroetapa **M05 — Privacidade, Recuperação e Segurança Operacional** consolida as obrigações de proteção de dados (LGPD), portabilidade, retenção pós-cancelamento, verificação de backup/restauração descartável, recuperação privilegiada de acesso com dupla evidência e resposta a incidentes operacionais do CorSys Tronco Digital V35.

## Decisões Arquiteturais

### 1. Portabilidade e Exportação Autenticada por Loja e por Titular (D02 — Entrega A)
- A migration `20261126180000_v35_m05_privacy_retention_recovery.sql` introduz `public.tenant_portability_exports` e `public.tenant_portability_downloads` (append-only via trigger `prevent_financial_mutation`).
- O RPC `create_tenant_portability_export_idempotent` suporta dois escopos estritos:
  - `organization_full`: restrito a perfis autorizados da Loja (`settings.manage` ou `reports.export`); inclui manifesto com contagens e somas exatas em centavos inteiros (`charges`, `payments`, `receivable_allocations`, `institutional_receivables`, `institutional_payables`), dicionário de dados, metadados de anexos elegíveis e trilha de auditoria do tenant sanitizada.
  - `data_subject_package`: restrito ao próprio titular (`private.is_self_member`) ou gestor autorizado; contém exclusivamente dados do titular, sem expor registros de outros integrantes ou obrigações institucionais da Loja.
- Segredos, credenciais, tokens, dados de outras Lojas (`organization_id` cruzado), tickets internos (`ticket_scope = 'internal'`) e logs Master (`saas_master_audit_logs`) são estritamente excluídos.
- Cada pacote possui digest criptográfico `payload_sha256` (`pg_catalog.sha256`), expiração obrigatória em 24 horas (`expires_at`) e nota explícita proibindo restauração automática por upload.
- No frontend (`src/lib/privacy-portability.ts`), a geração CSV aplica normalização Unicode `NFKC` e neutralização de fórmulas (`=`, `+`, `-`, `@`) consistente com `delinquency-export.ts`.

### 2. Direitos dos Titulares, Pseudonimização vs. Anonimização e Imutabilidade Contábil (D02/D03 — Entrega B)
- Tabelas `public.tenant_privacy_requests` e `public.tenant_privacy_request_events` (append-only) com RPCs `register_tenant_privacy_request_idempotent`, `review_tenant_privacy_request_idempotent` e `list_tenant_privacy_requests`.
- Meta interna de triagem de **2 dias úteis** calculada determinísticamente por `private.add_business_days(clock_timestamp(), 2)` no fuso `America/Sao_Paulo`.
- O sistema diferencia formalmente:
  - `pseudonymized`: quando permanece risco de reidentificação por combinação de tabelas, descrições, anexos ou logs (trocar nome por UUID não é anonimização); minimiza contatos dispensáveis e desativa vínculo de acesso (`member_user_links`) mantendo proteção.
  - `anonymized_verified`: permitido somente para categorias não contábeis quando `p_reidentification_risk_remains = false`.
  - `retained_by_law`: exigido para `financial_ledger`; qualquer tentativa de excluir ou anonimizar fatos financeiros imutáveis falha em modo fail-closed (`SQLSTATE 55000`).

### 3. Temporalidade, Janela Pós-Cancelamento de 90 Dias e Preservação Legal (D01/D03 — Entrega C)
- Reconciliado com o contrato de ciclo de vida de assinaturas sem redefinir `private.tenant_write_allowed`:
  - Enquanto `tenant_write_allowed` bloqueia novas gravações financeiras durante suspensão ou após cancelamento, a leitura e a portabilidade autenticada permanecem disponíveis durante os **90 dias** após `canceled_at` (`post_cancel_export_window`).
  - Após 90 dias do cancelamento, a postura passa para `archived_restricted`, bloqueando novas exportações normais pelo tenant.
- Tabela `public.tenant_retention_holds` e RPCs `place_tenant_legal_hold_idempotent` / `release_tenant_legal_hold_idempotent` permitem bloquear descarte sob preservação legal ou parecer contábil.
- Eliminação automática (`auto_purge_enabled = false`) permanece desativada.

### 4. Backup Criptografado, Rotação de 35 Dias e Restore Seletivo Descartável (D04 — Entrega D)
- Preservado o runner endurecido `scripts/run_v35_m05_backup_restore_trial.sh` e sua suíte `scripts/test_v35_m05_runner_hardening.sh`.
- Adicionados:
  - `scripts/v35_m05_backup_manifest.py`: manifesto sanitizado cobrindo banco, buckets privados (`tenant-documents`, `org-assets`) e checklist de configuração sem valores de secrets.
  - `scripts/v35_m05_single_tenant_recovery_check.sql`: comprova em PostgreSQL 17 descartável a recuperação seletiva da Loja A sem sobrescrever ou alterar a Loja B, bloqueando a reintrodução de contatos pseudonimizados/desativados.
  - Tabela append-only `public.saas_backup_restore_verifications` (`MASTER + AAL2`), mantendo RPO ≤ 24h e RTO ≤ 8h como metas (`target_unproven` até comprovação em ensaio descartável).

### 5. Recuperação de Acesso com Dupla Evidência e Revogação de Conta Comprometida (D05 — Entrega E)
- `src/auth/useAuth.ts`, `src/App.tsx` e `src/auth/PasswordRecovery.tsx` tratam links expirados ou já utilizados (`error_code=otp_expired` / `access_denied`) em modo fail-closed e com mensagem não enumerável.
- Tabela `public.saas_access_recovery_requests` e RPC `register_privileged_recovery_decision_idempotent` exigem `MASTER + AAL2`, dois operadores distintos (`verified_by_secondary <> verified_by_primary`), duas evidências distintas e obrigatoriedade de novo MFA pelo titular (`requires_owner_mfa_reenroll = true`), bloqueando padrões de senha/OTP/token.
- RPC `revoke_compromised_tenant_access_idempotent` revoga `user_roles` e `member_user_links` da conta comprometida na Loja sem alterar fatos financeiros ou auditoria imutável.

### 6. Monitoramento Técnico Mínimo e Resposta a Incidentes (D06 — Entrega F)
- Tabelas `public.saas_operational_incidents` e `public.saas_operational_health_snapshots` (append-only) e RPCs `read_master_operational_security_overview`, `record_operational_incident_idempotent` e `update_operational_incident_status_idempotent` (`MASTER + AAL2`).
- Meta interna de notificação em até **24 horas** da ciência (`detected_at + interval '24 hours'`), responsável operacional inicial `Michael`, retenção mínima de **5 anos** e bloqueio de segredos/CPF no resumo técnico.
- Monitoramento externo contínuo permanece honestamente reportado como `continuous_monitoring_active: false` enquanto probe externo sem custo adicional não estiver habilitado; nenhuma comunicação jurídica externa é automatizada.
