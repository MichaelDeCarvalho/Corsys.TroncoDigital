## Estado vigente — 25/11/2026, após autorização consolidada

**VERIFIED:** 81 arquivos SQL no Git e 81 versões no DEV. M01.03 deixou de ser migration pendente; a jornada e a função Edge têm gates separados, conforme SESSION_HANDOFF.md. Baseline de 66 arquivos preservada.

| Divergência adicional | Arquivo Git | Versão remota DEV | Evidência |
|---|---|---|---|
| 10 | 20261125210000_v35_platform_identity_master_edit.sql | 20261125210340 | apply SUCCESS; função/ACL/fingerprint e auditoria conferidos; PostgreSQL descartável PLATFORM_IDENTITY_PG_PASS |
| 11 | 20261109233000_v35_onboarding_acceptance.sql | 20261125210405 | apply SUCCESS; tabelas vazias, RPCs/ACL conferidas; CI M01.03 PASS |

As nove divergências anteriores permanecem válidas. São 15 arquivos após os 66 baseline: quatro timestamps idênticos e onze mapeados. Não reaplicar SQL já instalado; não renomear arquivos nem executar migration repair/db reset/db push para forçar igualdade de timestamps. Histórico abaixo permanece como evidência anterior, supersedido nos totais e na pendência M01.03.

---

# Plano de Reconciliação de Migrations — Repositório vs Supabase DEV

**Data de registro:** 2026-11-13  
**Última atualização:** 2026-11-24  
**Estado:** ADR-0049 aplicada exclusivamente no Supabase DEV (`20261125002909_v35_commercial_draft_audit_logs`) e verificada com `COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS`; reconciliação de timestamps ainda pendente de autorização específica.  
**Restrição de preservação:** Os **66** arquivos históricos fixados em `docs/engineering/v35-dev-runtime-manifest.json` permanecem **intactos** (`python3 scripts/check_v35_preservation.py` = PASS). Nenhuma migration já aplicada deve ser renomeada sem plano explícito e revisão do manifesto.

---

## 1. Inventário Quantitativo Atual

- **Total de arquivos em `supabase/migrations/`:** **80** arquivos `.sql`
  - **66** arquivos baseline fixados em `docs/engineering/v35-dev-runtime-manifest.json`
  - **14** arquivos posteriores ao manifesto
- **Total reportado no histórico remoto DEV (`supabase_migrations.schema_migrations`):** **79** migrations aplicadas
- **Diferença líquida (80 vs 79):** **1** migration local ainda **não aplicada** no DEV:
  - `20261109233000_v35_onboarding_acceptance.sql` *(M01.03 — fluxo de aceite de onboarding; deliberadamente preservada pendente de homologação específica)*
- **Convergências pós-manifesto com timestamp idêntico confirmado (4 arquivos):**
  1. `20261101181945_tenant_rbac_management.sql`
  2. `20261102000933_master_audit_read_model.sql`
  3. `20261109184607_v35_onboarding_invite_consumer.sql`
  4. `20261109190747_v35_onboarding_invite_reconciliation.sql`

---

## 2. Matriz Completa das 9 Divergências de Timestamp (GitHub vs Supabase DEV)

Todas as 9 divergências correspondem a migrations V35 aplicadas manualmente/via MCP ou timestamp distinto no DEV cloud após o corte dos 66 arquivos baseline:

| # | Arquivo no Repositório (`supabase/migrations/`) | Versão / Timestamp no Supabase DEV | Macroentrega / Escopo | Origem da Evidência |
|---|---|---|---|---|
| 1 | `20261028000000_v35_support_idempotency.sql` | `20261029003946` | M04.03 P0 — Idempotência em criação/resposta de chamados SaaS | `docs/V35_P0_SUPPORT_20261028.md` |
| 2 | `20261029000000_v35_master_readonly_support_sessions.sql` | `20261029021140` | M04.02 — Sessões temporárias Master somente leitura | `SESSION_HANDOFF.md` / `ADR-0038` |
| 3 | `20261029030000_v35_master_manual_invoice.sql` | `20261029204044` | M04.01 — Emissão manual de fatura SaaS (`preview_saas_manual_invoice` / `issue_saas_manual_invoice`) | `docs/V35_M0401_MANUAL_BILLING_RECONCILIATION.md` (RPCs confirmadas presentes no catálogo DEV) |
| 4 | `20261110220000_v35_cash_flow_detail.sql` | `20261113230306` | M02.02-D — `read_tenant_cash_flow_detail` (histórico diário e ranking de despesas) | Homologação ChatGPT Work (`2026-11-13`) |
| 5 | `20261111220000_v35_jobs_read_aal2.sql` | `20261113230344` | M04.03-B — Leitura auditada de jobs com `MASTER` + `AAL2` | Homologação ChatGPT Work (`2026-11-13`) |
| 6 | `20261111223000_v35_support_event_read_projection.sql` | `20261112015957` | M04.03-C — Projeção de leitura de eventos/SLA de suporte | `SESSION_HANDOFF.md` / `V35_EXECUTION_BOARD.md` |
| 7 | `20261113123000_v35_tenant_delinquency_buckets.sql` | `20261113230430` | M06.01 — `read_tenant_delinquency_bucket_summary` e `read_tenant_delinquency_filtered` | Homologação ChatGPT Work (`2026-11-13`) |
| 8 | `20261115120000_v35_tenant_timezone_financial_dates.sql` | `20261115184137` | ADR-0048 — Calendário financeiro por fuso IANA da Loja | Migration e teste PostgreSQL transacional com `ROLLBACK` confirmados no DEV (`2026-11-15`) |
| 9 | `20261124220000_v35_commercial_draft_audit_logs.sql` | `20261125002909` | M06.02 / ADR-0049 — Auditoria transacional, ordem de locks e guarda de entitlements em rascunho/sucessora comercial | Aplicação no DEV (`szqkdekwhzxsoxorgvaz`, `20261125002909_v35_commercial_draft_audit_logs`) e `COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS` (`2026-11-24`) |

> **Nota de integridade:** As últimas migrations listadas (`#4`–`#9`, incluindo `20261125002909`) **já foram aplicadas** ao Supabase DEV. **Não reaplicar manualmente o SQL**, não renomear `20261124220000_v35_commercial_draft_audit_logs.sql` no GitHub, não modificar os registros `#1`–`#8` e não executar `db push` / `db reset` ou `migration repair` sem autorização específica.

---

## 3. Procedimento Seguro de Reconciliação (Somente em Janela Autorizada)

**Regra crítica:** Não executar `supabase migration repair`, `supabase db push` ou `supabase db reset` cegamente. Executar apenas no terminal autenticado do proprietário após backup/inspeção de metadados.

### Passo 1 — Leitura Somente-Leitura do Histórico Real no DEV
Consultar diretamente a tabela de controle no projeto DEV (`szqkdekwhzxsoxorgvaz`):
```sql
select version, name
from supabase_migrations.schema_migrations
where version >= '20261028000000'
order by version;
```
E confirmar via CLI sem alterar estado:
```bash
npx supabase migration list --linked
```
Com isso, registrar o timestamp exato da entrada `#3` (`v35_master_manual_invoice`) na tabela acima.

### Passo 2 — Validar Paridade Estrutural dos Objetos no Banco
Conferir que nenhuma das 9 migrations divergentes teve alteração de assinatura ou corpo diferente entre Git e DEV (via `pg_get_functiondef` somente-leitura para os objetos de `#1`–`#9`, sem alterar dados).

### Passo 3 — Decisão de Reconciliação (Sem Quebrar o Manifesto Baseline)
Como os **66** arquivos baseline permanecem imutáveis, há duas estratégias seguras para os **9** pares divergentes:
1. **Estratégia recomendada (sem alterar arquivos Git caso `schema_migrations` seja reparado na DEV/novo ambiente):**
   - Na próxima sincronização controlada com autorização do proprietário, alinhar os registros de `supabase_migrations.schema_migrations` no DEV via `supabase migration repair --status reverted <versao_remota>` + `supabase migration repair --status applied <versao_repo>` **somente após** confirmar em Passo 2 que o conteúdo SQL já aplicado no DEV equivale ao arquivo versionado no Git.
2. **Alternativa (caso o histórico remoto DEV seja mantido como canônico antes de promover para Staging/Prod):**
   - Renomear no repositório apenas os arquivos pós-manifesto **ainda não indexados por `v35-dev-runtime-manifest.json`** para coincidir exatamente com o `version` aplicado no DEV, em PR revisado exclusivamente para alinhamento de migrations (após confirmar Passo 2 para os 9 itens, mantendo `20261109233000_v35_onboarding_acceptance.sql` pendente).

---

## 4. Critério de Conclusão da Reconciliação

- `npx supabase migration list --linked` exibindo **79/79** aplicadas correspondendo 1:1 aos arquivos do repositório e apenas `20261109233000_v35_onboarding_acceptance.sql` como pendente (até homologação de M01.03).
- `python3 scripts/check_v35_preservation.py` mantendo **PASS** com os 66 hashes baseline inalterados.
