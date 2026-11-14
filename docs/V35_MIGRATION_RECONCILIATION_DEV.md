# Plano de Reconciliação de Migrations — Repositório vs Supabase DEV

**Data de registro:** 2026-11-13  
**Estado:** Planejamento seguro preparado para execução autorizada pelo proprietário (nenhum comando remoto executado neste ambiente)  
**Restrição de preservação:** Os **66** arquivos históricos fixados em `docs/engineering/v35-dev-runtime-manifest.json` permanecem **intactos** (`python3 scripts/check_v35_preservation.py` = PASS). Nenhuma migration já aplicada deve ser renomeada sem plano explícito e revisão do manifesto.

---

## 1. Inventário Quantitativo Atual

- **Total de arquivos em `supabase/migrations/`:** **78** arquivos `.sql`
  - **66** arquivos baseline fixados em `docs/engineering/v35-dev-runtime-manifest.json`
  - **12** arquivos posteriores ao manifesto
- **Total reportado no histórico remoto DEV (`supabase_migrations.schema_migrations`):** **77** migrations aplicadas
- **Diferença líquida (78 vs 77):** **1** migration local ainda **não aplicada** no DEV:
  - `20261109233000_v35_onboarding_acceptance.sql` *(M01.03 — fluxo de aceite de onboarding; deliberadamente pendente de homologação específica)*
- **Convergências pós-manifesto com timestamp idêntico confirmado (4 arquivos):**
  1. `20261101181945_tenant_rbac_management.sql`
  2. `20261102000933_master_audit_read_model.sql`
  3. `20261109184607_v35_onboarding_invite_consumer.sql`
  4. `20261109190747_v35_onboarding_invite_reconciliation.sql`

---

## 2. Matriz Completa das 7 Divergências de Timestamp (GitHub vs Supabase DEV)

Todas as 7 divergências correspondem a migrations V35 aplicadas manualmente/via MCP ou timestamp distinto no DEV cloud após o corte dos 66 arquivos baseline:

| # | Arquivo no Repositório (`supabase/migrations/`) | Versão / Timestamp no Supabase DEV | Macroentrega / Escopo | Origem da Evidência |
|---|---|---|---|---|
| 1 | `20261028000000_v35_support_idempotency.sql` | `20261029003946` | M04.03 P0 — Idempotência em criação/resposta de chamados SaaS | `docs/V35_P0_SUPPORT_20261028.md` |
| 2 | `20261029000000_v35_master_readonly_support_sessions.sql` | `20261029021140` | M04.02 — Sessões temporárias Master somente leitura | `SESSION_HANDOFF.md` / `ADR-0038` |
| 3 | `20261029030000_v35_master_manual_invoice.sql` | `20261029204044` | M04.01 — Emissão manual de fatura SaaS (`preview_saas_manual_invoice` / `issue_saas_manual_invoice`) | `docs/V35_M0401_MANUAL_BILLING_RECONCILIATION.md` (RPCs confirmadas presentes no catálogo DEV) |
| 4 | `20261110220000_v35_cash_flow_detail.sql` | `20261113230306` | M02.02-D — `read_tenant_cash_flow_detail` (histórico diário e ranking de despesas) | Homologação ChatGPT Work (`2026-11-13`) |
| 5 | `20261111220000_v35_jobs_read_aal2.sql` | `20261113230344` | M04.03-B — Leitura auditada de jobs com `MASTER` + `AAL2` | Homologação ChatGPT Work (`2026-11-13`) |
| 6 | `20261111223000_v35_support_event_read_projection.sql` | `20261112015957` | M04.03-C — Projeção de leitura de eventos/SLA de suporte | `SESSION_HANDOFF.md` / `V35_EXECUTION_BOARD.md` |
| 7 | `20261113123000_v35_tenant_delinquency_buckets.sql` | `20261113230430` | M06.01 — `read_tenant_delinquency_bucket_summary` e `read_tenant_delinquency_filtered` | Homologação ChatGPT Work (`2026-11-13`) |

> **Nota de integridade:** As últimas 3 migrations (`20261113230306`, `20261113230344`, `20261113230430`) **já foram aplicadas** ao Supabase DEV em `2026-11-13`. **Não reaplicar manualmente o SQL** e não executar `db push` / `db reset` antes de concluir a reconciliação de metadados descrita abaixo.

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
Conferir que nenhuma das 7 migrations divergentes teve alteração de assinatura ou corpo diferente entre Git e DEV (via `pg_get_functiondef` somente-leitura para os objetos de `#1`–`#7`, sem alterar dados).

### Passo 3 — Decisão de Reconciliação (Sem Quebrar o Manifesto Baseline)
Como os **66** arquivos baseline permanecem imutáveis, há duas estratégias seguras para os **7** pares divergentes:
1. **Estratégia recomendada (sem alterar arquivos Git caso `schema_migrations` seja reparado na DEV/novo ambiente):**
   - Na próxima sincronização controlada com autorização do proprietário, alinhar os registros de `supabase_migrations.schema_migrations` no DEV via `supabase migration repair --status reverted <versao_remota>` + `supabase migration repair --status applied <versao_repo>` **somente após** confirmar em Passo 2 que o conteúdo SQL já aplicado no DEV equivale ao arquivo versionado no Git.
2. **Alternativa (caso o histórico remoto DEV seja mantido como canônico antes de promover para Staging/Prod):**
   - Renomear no repositório apenas os arquivos pós-manifesto **ainda não indexados por `v35-dev-runtime-manifest.json`** para coincidir exatamente com o `version` aplicado no DEV, em PR revisado exclusivamente para alinhamento de migrations (após confirmar Passo 2 para os 7 itens, mantendo `20261109233000_v35_onboarding_acceptance.sql` pendente).

---

## 4. Critério de Conclusão da Reconciliação

- `npx supabase migration list --linked` exibindo **77/77** aplicadas correspondendo 1:1 aos arquivos do repositório e apenas `20261109233000_v35_onboarding_acceptance.sql` como pendente (até homologação de M01.03).
- `python3 scripts/check_v35_preservation.py` mantendo **PASS** com os 66 hashes baseline inalterados.
