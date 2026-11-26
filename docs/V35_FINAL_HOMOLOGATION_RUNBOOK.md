### Integração do candidato e download privado

- Base reconciliada no DEV: onboarding Git `20261109233000` → remoto `20261125210405`. Identidade Git `20261125210000` → remoto `20261125210340`. Preservar ambos.
- O download binário exige implantação da migration `20261126181500` no DEV e da Edge Function `portability-attachment` com verificação de JWT. A origem é `PORTABILITY_APP_ORIGIN` ou a origem DEV de onboarding já configurada.
- Somente o backend lê `tenant-documents`. A RPC vincula documento, objeto e hash ao pacote vigente. A Edge Function confere SHA-256 e tamanho (limite de 16 MiB) e registra o resultado antes de entregar o arquivo.
- Registrar CI, migrations, publicação e aceites autenticados pelos resultados observados na revisão publicada.

# Runbook Consolidado de Integração, Publicação DEV, Homologação Final e Preparação M07 — CorSys Tronco Digital V35

- **Status da Macroetapa M07**: `BLOQUEADO` (nenhuma ação em PROD, domínio público, contratação de planos pagos ou alteração de secrets de produção é autorizada antes da aprovação integral dos gates deste runbook).
- **Base Git de referência**: `83e362d246c65a118967931c39b87ffae1e4a8f4` (`main`, PR #75). A árvore local no container do Gemini foi reconstruída por reversão determinística dos patches sobre o snapshot da base (validada por `git apply --check` limpo dos 5 patches e `check_v35_preservation.py`), **sem declarar igualdade criptográfica de objeto `.git`** com o repositório remoto. No ambiente do Work/GitHub, aplicar o patch candidato diretamente sobre o checkout autêntico do commit `83e362d246c65a118967931c39b87ffae1e4a8f4`.
- **Artefato cumulativo único para aplicação sobre `83e362d246c65a118967931c39b87ffae1e4a8f4`**: `corsys-v35-release-candidate.patch` (preservados intactos `m0203-fechamento.patch`, `m03-contabilidade-relatorios.patch`, `m04-operacao-master-saas.patch` e `m05-privacidade-recuperacao-seguranca.patch`, além do intermediário `corsys-v35-consolidado-m06.patch`).

---

## 1. Checklist de Release e Ordem de Execução Contínua (Work)

1. **Checkout e aplicação em branch dedicada**:
   - Confirmar `git rev-parse HEAD` == `83e362d246c65a118967931c39b87ffae1e4a8f4` em `main` limpa.
   - Criar branch `feat/v35-release-candidate-m07`.
   - Executar `git apply --check --whitespace=nowarn corsys-v35-release-candidate.patch` e `git apply --whitespace=nowarn corsys-v35-release-candidate.patch`.
2. **Verificação local e abertura de PR**:
   - Executar `npm ci`, `npm run typecheck`, `npm test -- --run`, `npm run build`, `npm run check --prefix dev-gate`, `python3 scripts/check_v35_preservation.py`, `bash scripts/test_v35_m05_runner_hardening.sh` e `python3 scripts/v35_m05_backup_manifest.py --self-test`.
   - Abrir PR para `main` e aguardar conclusão dos 3 jobs do GitHub Actions (`foundation-checks.yml`: `static`, `onboarding` com 8 gates em `postgres:17` descartável e `frontend` com dry-run Wrangler DEV).
3. **Preflight, Reconciliação e Aplicação das Migrations Novas no Supabase DEV (`szqkdekwhzxsoxorgvaz`)**:
   - Executar exclusivamente o preflight da Seção 2 antes de qualquer escrita.
   - Aplicar **somente** as migrations novas ausentes no histórico remoto, na ordem estrita da Seção 2, seguida de read-back imediato.
4. **Publicação Cloudflare Workers DEV (`corsys-tronco-digital-dev`)**:
   - Confirmar build automático do Cloudflare Workers Builds após merge na `main` e verificar correspondência dos assets JS/CSS servidos em `https://corsys-tronco-digital-dev.corsys1.workers.dev`.
5. **Execução Contínua da Bateria de Homologação DEV (Seções 7 a 12)**:
   - Executar primeiro todos os gates automatizados (Seção 6.1) e, em sequência contínua, os ensaios autenticados em navegador (Seção 6.2 e Seções 7 a 12), aproveitando as autorizações já concedidas em `docs/V35_CLOSURE_APPROVAL.md` (`AC-V35-20261125-v1`) sem solicitar novas confirmações técnicas ao proprietário.

---

## 2. Ordem de Integração das Migrations, Preflight e Read-Back (Supabase DEV)

### 2.1 Regra de Ouro sobre Histórico Remoto
- **Proibido reaplicar ou renomear** as 79 migrations já aplicadas no Supabase DEV (`szqkdekwhzxsoxorgvaz`), incluindo `20261115120000_v35_tenant_timezone_financial_dates.sql` (registrada no DEV sob versão `20261115184137_v35_tenant_timezone_financial_dates`) e `20261124220000_v35_commercial_draft_audit_logs.sql` (registrada no DEV sob versão `20261125002909_v35_commercial_draft_audit_logs`).

### 2.2 Preflight SQL Obrigatório (Somente Leitura no DEV)
Antes de aplicar qualquer migration, consultar `supabase_migrations.schema_migrations` e o catálogo do banco DEV:
1. Confirmar projeto DEV (`szqkdekwhzxsoxorgvaz`) e presença das âncoras `20261115184137` e `20261125002909`.
2. Verificar quais das 5 migrations pendentes de fim de ciclo ainda não constam em `supabase_migrations.schema_migrations`:
   - **M01.03 (`20261109233000_v35_onboarding_acceptance.sql`)**: verificar se `public.accept_onboarding_invite(uuid, uuid, text, boolean)` e `private.finish_onboarding_invite_with_identity(uuid, uuid, uuid)` já existem no catálogo (o registro de 25/11/2026 confirmou presença dessas RPCs no DEV; se já presentes, **não** reaplicar DDL conflitante, apenas conciliar registro).
   - **A04/E02 (`20261125210000_v35_platform_identity_master_edit.sql`)**: verificar `to_regprocedure('public.save_platform_identity(text,text,text,text,text,text,text,text)')`.
   - **M03 (`20261126000000_v35_m03_accounting_books_and_dre.sql`)**: verificar `to_regclass('public.accounting_plan_role_mappings')` e `to_regprocedure('public.read_tenant_dre_gerencial(uuid,date,date)')`.
   - **M04 (`20261126120000_v35_m04_master_saas_operations.sql`)**: verificar `to_regprocedure('public.suspend_saas_subscription_manual_idempotent(uuid,text,text)')` e `to_regprocedure('public.read_tenant_commercial_status(uuid)')`.
   - **M05 (`20261126180000_v35_m05_privacy_retention_recovery.sql`)**: verificar `to_regclass('public.tenant_portability_exports')`, `to_regprocedure('public.create_tenant_portability_export_idempotent(uuid,text,uuid,text,text)')` e `to_regprocedure('public.authorize_tenant_portability_attachment_download(uuid,uuid,uuid)')`.

### 2.3 Ordem Estrita de Aplicação e Read-Back no DEV
Aplicar sequencialmente apenas as migrations ausentes no DEV:
1. `20261125210000_v35_platform_identity_master_edit.sql`
   - **Read-back**: confirmar `save_platform_identity` com `prosecdef = true`, `search_path = ''` e `has_function_privilege('anon', ..., 'EXECUTE') = false`.
2. `20261126000000_v35_m03_accounting_books_and_dre.sql`
   - **Read-back**: confirmar tabela `public.accounting_plan_role_mappings` com RLS ativo e RPCs `set_accounting_plan_role_mapping_idempotent`, `read_tenant_accounting_diary_summary`, `read_tenant_accounting_diary`, `read_tenant_accounting_ledger` e `read_tenant_dre_gerencial`.
3. `20261126120000_v35_m04_master_saas_operations.sql`
   - **Read-back**: confirmar que `private.tenant_write_allowed` retorna `true` para `status = 'past_due'` mesmo com `grace_until < now()` (regra `C03`) e `false` somente após `status = 'suspended'`; confirmar RPCs comerciais, de faturamento manual SaaS e de suporte.
4. `20261126180000_v35_m05_privacy_retention_recovery.sql`
   - **Read-back**: confirmar as 10 tabelas M05 com RLS ativo (`relrowsecurity = true`) e as 20 RPCs M05 (incluindo `create_tenant_portability_export_idempotent` com 41 datasets e `authorize_tenant_portability_attachment_download`).

---

## 3. Plano de Rollback e Recuperação

- **Frontend (Cloudflare Workers DEV)**:
  - Caso o deploy automático apresente regressão de bundle ou roteamento, reverter imediatamente no painel/CLI do Cloudflare Workers para o Version ID estável anterior documentado no handoff (`0f6747d8-2461-4d54-bef5-6f94725590d9` / build `3ca9d183-730d-4f76-868c-faca67a5054b`) sem alterar secrets ou variáveis.
- **Banco de Dados (Supabase DEV)**:
  - As migrations `20261125210000`, `20261126000000`, `20261126120000` e `20261126180000` são **estritamente aditivas** (`begin; ... commit;`) e não destroem nem truncam dados existentes.
  - Se qualquer migration falhar durante a aplicação, a transação reverte automaticamente (`ROLLBACK`).
  - Caso seja necessário reverter funcionalmente após commit em DEV, aplicar migration compensatória aditiva restaurando a definição anterior de `private.tenant_write_allowed` e revogando `EXECUTE` nas RPCs novas para `authenticated`, sem executar `DROP TABLE CASCADE` sobre tabelas de auditoria ou razão financeiro.
- **Fixtures de Homologação (`M02.03`)**:
  - Os scripts `scripts/prepare_dev_m0203_closure_qa.sql` e `scripts/cleanup_dev_m0203_closure_qa.sql` operam com `ROLLBACK` por padrão (`DRY_RUN_ROLLED_BACK`) e, quando executados com commit na Loja fictícia isolada (`QA_CLOSURE_*`), limpam exclusivamente os vínculos temporários criados na rodada, preservando rascunhos preexistentes e a trilha contábil imutável.

---

## 4. Inventário de Configurações e Referências a Secrets (Zero Valores Armazenados)

| Escopo | Nome da Variável / Secret | Finalidade | Onde Reside | Regra de Segurança |
|---|---|---|---|---|
| Frontend (Vite / Cloudflare) | `VITE_SUPABASE_URL` | URL pública da API Supabase do ambiente | Cloudflare Workers Build Variables / `.env` local | Pública por ambiente; DEV aponta para `szqkdekwhzxsoxorgvaz`, PROD apontará para projeto PROD isolado. |
| Frontend (Vite / Cloudflare) | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (`anon` / publishable) do Supabase | Cloudflare Workers Build Variables / `.env` local | Pública com RLS obrigatório; nunca usar `service_role` no cliente. |
| Edge Function (`onboarding-invite`) | `SUPABASE_URL` | URL interna injetada pelo runtime Supabase | Supabase Edge Runtime | Automática por projeto. |
| Edge Function (`onboarding-invite`) | `SUPABASE_ANON_KEY` | Validação do JWT do operador Master (`verify_jwt=true`) | Supabase Edge Runtime | Automática por projeto. |
| Edge Function (`onboarding-invite`) | `SUPABASE_SERVICE_ROLE_KEY` | Despacho controlado de convite após validação Master/AAL2 | Supabase Edge Vault | **Estriamente server-side**; proibido expor em logs, cliente ou CI. |
| Edge Function (`onboarding-invite`) | `ONBOARDING_APP_ORIGIN` | Allowlist de origem CORS e callback URL de aceite | Supabase Secrets | Em DEV: `https://corsys-tronco-digital-dev.corsys1.workers.dev`. Em PROD: domínio oficial final. |
| Supabase Auth / SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME` | Entrega de convites de onboarding e recuperação de senha (`D05`) | Supabase Auth SMTP Settings | Credenciais gerenciadas exclusivamente no painel Supabase; jamais ler ou logar senha SMTP. |
| Runner Backup/Restore (`M05.02`) | `SOURCE_DB_URL`, `TARGET_DB_URL`, `BACKUP_PASSPHRASE` | Conexões PostgreSQL e chave simétrica AES-256 (`gpg`/`openssl`) para ensaio descartável | Variáveis de ambiente efêmeras do operador/CI | Higienizadas por `sanitize_conn`; bloqueio ativo contra strings `szqkdekwhzxsoxorgvaz`, `prod`, `production` e `live` no destino. |

---

## 5. Isolamento entre Configuração DEV e Futura Configuração PROD (Sem Ativação)

- **Ambiente DEV (`ATIVO PARA HOMOLOGAÇÃO`)**:
  - Worker: `corsys-tronco-digital-dev` (`wrangler.dev.jsonc`, `workers_dev: true`, `preview_urls: false`).
  - Supabase Project ID: `szqkdekwhzxsoxorgvaz`.
  - Dados permitidos: exclusivamente fictícios (`QA_*`, `CORSYS QA ONBOARDING`, e-mails sob controle do proprietário com `+corsys-v35-qa`).
- **Ambiente PROD (`BLOQUEADO — NÃO ATIVAR NESTA RODADA`)**:
  - Exigirá projeto Supabase PROD **completamente separado** do DEV (novo `project_ref`, novas chaves, banco zerado sem fatos ou rascunhos de QA/homologação).
  - Exigirá Worker de produção separado com domínio próprio (quando contratado e aprovado pelo proprietário no gate `M07.01`), `ONBOARDING_APP_ORIGIN` apontando exclusivamente para o domínio de produção e catálogo comercial iniciado com exatamente os dois planos aprovados (`C01`/`C07`: R$ 125/mês até 3 usuários ativos e R$ 180/mês até 10 usuários ativos, zero promoções automáticas).

---

## 6. Checklist de Segurança, Privacidade e Separação de Testes Automatizados vs. Navegador Real

### 6.1 Gates Automatizados (Sem Navegador Autenticado / Executáveis via CLI e CI)
1. **Estático, Tipagem e Preservação**:
   - `npm ci`
   - `npm run typecheck`
   - `python3 scripts/check_v35_preservation.py`
   - `python3 scripts/check_sql.py` (no job `static` do CI com `pglast`)
2. **Suíte Completa de Testes Frontend/Serviços e DEV Gate**:
   - `npm test -- --run` (registrar a contagem real do job frontend da revisão testada)
   - `npm run build`
   - `npm run check --prefix dev-gate` (13/13 subtestes TAP)
   - `bash scripts/test_v35_m05_runner_hardening.sh` (9/9 asserções fail-closed)
   - `python3 scripts/v35_m05_backup_manifest.py --self-test`
3. **Gates PostgreSQL 17 Descartáveis (no job `onboarding` do GitHub Actions CI)**:
   - `python3 scripts/check_onboarding_invite_pg.py`
   - `python3 scripts/check_cash_flow_pg.py`
   - `python3 scripts/check_commercial_concurrency_pg.py` (`C01–C05` comercial)
   - `python3 scripts/check_financial_agreement_fifo_reversal_pg.py` (`T1–T6` acordo × FIFO e estornos)
   - `python3 scripts/check_platform_identity_pg.py`
   - `python3 scripts/check_accounting_books_pg.py` (M03: Anexo III, Diário, Razão e DRE Gerencial B01)
   - `python3 scripts/check_master_saas_m04_pg.py` (M04: assentos C07, contratação expressa C02, troca prospectiva C05, ledger SaaS C04, regressão C03 `past_due` pós-tolerância vs. suspensão manual, D01 90 dias e notas internas C06)
   - `python3 scripts/check_privacy_recovery_pg.py` (M05: portabilidade D02 com 41 datasets, `authorize_tenant_portability_attachment_download`, triagem 2 dias úteis, imutabilidade do razão D03, recuperação dupla evidência D05 e incidentes 24h D06)

### 6.2 Operações que Exigem Navegador e Autenticação Real no DEV (Work)
- **Não repetir** gates já homologados e válidos: Grupo A HTTP somente leitura 5/5 PASS (`V35_HTTP_READONLY_GATE_20261115.md`), drawer mobile F1/F2/F3 (`025d165d`), leitura de Configurações da Plataforma (`6e676aad`), modo Projetado do Fluxo de Caixa (`34291d4`), ciclo de planos M06.02 (`534eb6b4`) e Onboarding M01.04 (`PR #72`).
- Executar com sessão autenticada no DEV **apenas** os aceites operacionais abaixo (Seções 7 a 12).

---

## 7. Aceites Financeiros M02.03 e Conciliação M02.02-A (Navegador Autenticado DEV)

1. **Preparação da Fixture Isolada (`E04`/`B06`/`E06`)**:
   - Executar `scripts/prepare_dev_m0203_closure_qa.sql` primeiro em modo padrão (`ROLLBACK` -> confirmar `DRY_RUN_ROLLED_BACK`) e depois com commit autorizado na Loja fictícia de fechamento (`COMMITTED`), anotando `organization_id` e `round_id` emitidos via `NOTICE`.
2. **Execução Automatizada de 2 Sessões (`ADMIN` + `TREASURER`)**:
   - Executar `npm run test:m0203:homologation -- --org-id "<UUID>" --round-id "<ROUND_ID>"` (`scripts/homologate_m0203_dev.mjs`).
   - Confirmar os 4 aceites restantes:
     - **S1 — Acordo pela tela (`MemberAgreements.tsx` + `MemberPayments.tsx`)**: consolidação R$ 100 + R$ 60 -> 2 × R$ 80, saída dos títulos originais da carteira em aberto, pagamento de uma parcela e estorno reabrindo apenas a parcela estornada;
     - **S2 — Mensalidades (`MemberConfiguration.tsx` + `MonthlyChargeGeneration.tsx`)**: valor geral, precedência de valor individual, isenção programada e reexecução idempotente sem duplicação;
     - **S3 — Quórum de 2 aprovadores (`ContasPagar.tsx` / `PayableApprovals.tsx`)**: bloqueio de liquidação em `0/2` e `1/2` e liberação/liquidação com segundo aprovador distinto em `2/2`;
     - **S4 — Conciliação (`BankReconciliation.tsx` / `M02.02-A`)**: interceptação cliente simulando leitura truncada/incoerente, confirmação de travamento completo dos botões de conciliar/desfazer com zero RPCs de escrita e recuperação íntegra após remoção da interceptação.
3. **Limpeza Auditada**:
   - Executar `scripts/cleanup_dev_m0203_closure_qa.sql` (confirmar `INITIAL_CLEANUP` e revogação total dos vínculos da rodada, inclusive `ADMIN`, preservando rascunhos preexistentes e trilha contábil).

---

## 8. Aceites Contábeis M03 (Navegador Autenticado DEV + Gate Profissional `#43`)

1. **Mapeamento Governado do Anexo III (`view-plano-contas` -> `AccountingRoleMappings.tsx`)**:
   - Em plano de contas em rascunho de Loja QA, vincular os 8 papéis contábeis obrigatórios (`member_receivable_control`, `institutional_receivable_control`, `member_advance_liability`, `institutional_payable_control`, `revenue_deduction`, `financial_fee_expense`, `opening_balance_contra`, `closing_result_account`) via `set_accounting_plan_role_mapping_idempotent` e confirmar bloqueio de mutação após publicação do plano.
2. **Diário, Razão, DRE Gerencial e Exportações (`view-dre` e `view-relatorios`)**:
   - Consultar `Diário Contábil` (`B04`), `Razão Contábil` (`B05` com saldo inicial derivado exclusivamente de partidas anteriores) e `DRE Gerencial` (`B01` cascata completa, `B02` alternância de contas analíticas ativas zeradas e `B03` comparativos com período anterior e orçamento).
   - Validar exportação integral CSV/XLSX/PDF e confirmar que períodos com lacuna de mapeamento (`integral_ok = false`) exibem alerta e bloqueiam exportação integral oficial.

---

## 9. Aceites Comerciais e Operação Master M04 (Sessão Master AAL2 DEV)

1. **Modelos de Planos e Ciclo de Vida da Assinatura (`view-master-planos` e `view-master-clientes` -> Cliente 360º)**:
   - Verificar carregamento dos modelos de rascunho `C01` (R$ 125 / 3 usuários ativos e R$ 180 / 10 usuários ativos) sem autopublicação.
   - Em Loja fictícia QA, validar contratação expressa (`C02`, vigência no dia 1º do mês seguinte), agendamento prospectivo de upgrade/downgrade (`C05` preservando `saas_subscription_price_terms`) e consulta sob demanda de assentos (`C07`, excluindo `MASTER`/`SUPPORT`) em `view-cadastros`.
2. **Faturamento Manual SaaS (`view-master-cobranca` / `C04`)**:
   - Validar registro de pagamento manual SaaS, alocação, estorno compensatório, bloqueio de anulação de fatura com alocação ativa, acordo comercial `0%`, vínculo de documento fiscal externo e aba `Resumo SaaS` segregada da contabilidade das Lojas.
3. **Inadimplência, Tolerância de 7 Dias e Suspensão Manual (`C03` + `D01`)**:
   - Confirmar em Loja QA `past_due` que o término de `grace_until` **não** bloqueia escrita automaticamente, que `suspend_saas_subscription_manual_idempotent` falha antes do prazo e sucede após o prazo bloqueando novas gravações enquanto preserva leitura, exportações e abertura de chamados, e que o cancelamento abre a janela de 90 dias (`D01`).
4. **Suporte e SLA Comercial (`view-master-operacao` / `C06`)**:
   - Confirmar criação de chamado interno Master, nota interna invisível para a Loja, triagem sob clique, cálculo de SLA em horário comercial (`Seg–Sex 09–18 BRT`) e banner de sessão `read_only` ativa no topo da Loja (`Workspace.tsx`).

---

## 10. Aceites de Privacidade, Portabilidade e Recuperação M05 (DEV + Ensaio Descartável)

1. **Portabilidade Integral e Download Binário de Anexos (`view-configuracoes` -> `TenantPrivacyPortabilityPanel.tsx` / `D02`)**:
   - Gerar pacote `organization_full` (JSON e CSV) e confirmar presença dos 41 datasets, digest SHA-256, expiração de 24 horas e flag `binary_files_included: false`.
   - Acionar `Baixar binário do anexo` (`authorize_tenant_portability_attachment_download`): confirmar registro em `audit_logs` e comportamento fail-closed caso o objeto binário ou bucket privado (`tenant-documents`) não esteja provisionado no Storage do projeto.
   - Com sessão de integrante vinculado, gerar `data_subject_package` e confirmar negação (`42501`) para `organization_full`.
2. **Direitos LGPD, Pseudonimização vs. Anonimização e Retenção (`D01` / `D03`)**:
   - Registrar solicitação de eliminação sobre `financial_ledger`, confirmar prazo de triagem de 2 dias úteis e verificar que tentativa de decisão `anonymized_verified` sobre razão financeiro é bloqueada (`55000`), permitindo `retained_by_law` com preservação integral do ledger.
3. **Backup/Restore Seletivo Descartável, Recuperação Privilegiada e Incidentes (`view-master-operacao` -> `MasterPrivacyOpsPanel.tsx` / `D04`–`D06`)**:
   - Executar ensaio de backup/restore seletivo em instâncias PostgreSQL descartáveis via `scripts/run_v35_m05_backup_restore_trial.sh` (`scripts/v35_m05_single_tenant_recovery_check.sql`), medir RPO/RTO reais do ensaio e registrar o manifesto sanitizado via `record_backup_restore_verification_idempotent`.
   - Validar registro de decisão de recuperação privilegiada com dupla evidência e 2 operadores distintos (`register_privileged_recovery_decision_idempotent`), revogação de acesso comprometido (`revoke_compromised_tenant_access_idempotent`) e registro de incidente técnico com meta interna de 24h e bloqueio de padrões de segredo/CPF (`record_operational_incident_idempotent`).

---

## 11. Procedimento Consolidado de Homologação das 21 Telas e Aceites M06

| # | ID da Tela | Status Consolidado | Ação no Fechamento DEV |
|---|---|---|---|
| 1 | `view-master` | Implementado, aguardando homologação | Conferir filtro `cancel_scheduled` após apply da migration M04. |
| 2 | `view-master-clientes` | Implementado, aguardando homologação | Conferir painel de ciclo de vida M04 no Cliente 360º (Seção 9.1). |
| 3 | `view-master-cobranca` | Implementado, aguardando homologação | Conferir operações de ledger SaaS manual e Resumo SaaS (Seção 9.2). |
| 4 | `view-master-planos` | Implementado e testado (`M06.02 CONCLUIDO`) | Reutilizar homologação `534eb6b4`; conferir apenas botão de modelo R$ 125/R$ 180 sem publicar. |
| 5 | `view-master-operacao` | Implementado, aguardando homologação | Conferir notas internas/SLA M04 e aba `Privacidade e Segurança` M05 (Seções 9.4 e 10.3). |
| 6 | `view-master-config` | Implementado, aguardando homologação | Reutilizar leitura `6e676aad`; testar editor Master AAL2 de identidade após apply de `20261125210000`. |
| 7 | `view-chamados` | Implementado e testado (`HOMOLOGADO_DEV`) | Reutilizar homologação `f9f900a` (não reabrir). |
| 8 | `view-dashboard` | Implementado e testado | Reutilizar KPIs/responsividade; conferir banners transversais M04 (`read_only`, `C03`, `D01`). |
| 9 | `view-integrantes` | Implementado e testado | Reutilizar homologação existente e timezone `20261115184137`. |
| 10 | `view-financeiro` | Implementado, aguardando homologação | Executar S1 e S2 via `npm run test:m0203:homologation` (Seção 7). |
| 11 | `view-inadimplencia` | Implementado e testado | Reutilizar homologação `20261113230430` + timezone `20261115184137`. |
| 12 | `view-tesouraria` | Implementado, aguardando homologação | Executar S4 (`M02.02-A` conciliação truncada/incoerente) na suíte M02.03 (Seção 7). |
| 13 | `view-fluxo-caixa` | Implementado e testado (`HOMOLOGADO_DEV`) | Reutilizar homologação `34291d4` (não reabrir). |
| 14 | `view-contas-pagar` | Implementado e testado | Executar S3 (quórum 2/2) na suíte M02.03 (Seção 7). |
| 15 | `view-contas-receber` | Implementado e testado | Reutilizar validações institucionais mensais/anuais/reversões existentes. |
| 16 | `view-dre` | Implementado, aguardando homologação | Conferir DRE Gerencial B01–B03 após apply da migration M03 (Seção 8). |
| 17 | `view-plano-contas` | Implementado, aguardando homologação | Conferir `AccountingRoleMappings` (Anexo III) após apply da migration M03 (Seção 8). |
| 18 | `view-config-dre` | Implementado e testado | Reutilizar validações de períodos, alçadas e orçamento com rótulos gerenciais. |
| 19 | `view-relatorios` | Implementado, aguardando homologação | Conferir Diário, Razão e exportações integrais fail-closed após apply da migration M03 (Seção 8). |
| 20 | `view-cadastros` | Implementado, aguardando homologação | Reutilizar RBAC `20261101181945`; conferir botão `Consultar assentos do plano` (`C07`). |
| 21 | `view-configuracoes` | Implementado, aguardando homologação | Conferir resumo comercial M04 e painel LGPD M05 (`TenantPrivacyPortabilityPanel`, Seção 10.1 e 10.2). |

- **Gate M06.03 Adicional**: executar Grupo B HTTP persistente (`dev-gate/tests/negative-http-authorization.mjs`) sob flag explícita de autorização no DEV, confirmando recusa `42501`/`28000` em mutações cruzadas entre Lojas A e B e perfis sem permissão.

---

## 12. Pendências Jurídicas, Contábeis e Limites/Custos Estimados de Infraestrutura (Sem Contratação)

### 12.1 Pendências Externas Obrigatórias Antes da Abertura Comercial (`M07.03`)
1. **Validação Contábil Profissional (`Issue #43` / `B01`–`B05`)**: parecer de contador habilitado sobre a classificação de rubricas da DRE Gerencial e escrituração dos livros Diário e Razão (a V35 opera expressamente com rotulagem **gerencial**, não substituindo escrituração fiscal assinada pelo contador).
2. **Validação Jurídica e Identidade Real da Prestadora (`A04` / `D01`–`D03` / `E02`)**: revisão final dos Termos de Uso, Política de Privacidade e Tabela de Temporalidade (`AC-V35-20261125-v1`) e preenchimento dos dados reais da empresa prestadora pelo proprietário no editor Master AAL2 (`view-master-config`) antes da publicação de versão comercial em PROD.

### 12.2 Limites e Custos Estimados da Infraestrutura Existente (Sem Contratação Automática)
- **Supabase (Banco, Auth, Edge Functions e Storage)**:
  - *Plano Gratuito (Free Tier atual no DEV)*: 500 MB de banco PostgreSQL, 1 GB de Storage, sem Point-in-Time Recovery (PITR) nativo e sujeito a pausa por inatividade; **não garante sozinho** RPO ≤ 24h / RTO ≤ 8h automatizados sem execução externa do runner criptografado (`run_v35_m05_backup_restore_trial.sh`).
  - *Estimativa para Produção (`M07.01`, apenas mediante aprovação futura do proprietário)*: Supabase Pro (estimado em ~US$ 25/mês por projeto + uso de backups diários gerenciados/PITR se contratado), permitindo backups automáticos diários com retenção e isolamento completo entre projetos DEV e PROD.
- **Cloudflare Workers (Hospedagem SPA e Assets)**:
  - *Plano Gratuito (Free Tier)*: 100.000 requisições/dia; suficiente para DEV e início controlado de operação.
  - *Estimativa para Produção (opcional)*: Cloudflare Workers Paid (~US$ 5/mês) + registro de domínio próprio (~R$ 40 a R$ 80/ano no Registro.br), a serem contratados exclusivamente pelo proprietário no gate `M07.01`.
- **SMTP Transacional (Resend / SMTP Customizado)**:
  - *Plano Atual*: tier gratuito com limite diário/mensal de envios; suficiente para onboarding controlado e recuperação de acesso por link expirável (`D05`).
