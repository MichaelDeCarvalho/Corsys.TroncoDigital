# ADR-0053 — Livros Contábeis Gerenciais (Diário e Razão), Vínculos Anexo III e DRE Gerencial B01 (M03)

- **Data:** 2026-11-26
- **Status:** Implementado para revisão, CI e validação contábil (não aplicado em DEV/PROD)
- **Macroetapa:** M03 — Contabilidade, DRE e Relatórios (`M03.02`, `M03.03`, `M03.04`)
- **Base de código:** `83e362d246c65a118967931c39b87ffae1e4a8f4` (`main`, PR #75)

## Contexto e Decisões Base

Consoante `docs/V35_CLOSURE_APPROVAL.md` (`AC-V35-20261125-v1`) e `ADR-0050`:
1. A DRE do sistema é **gerencial** (`B01–B05`), com aviso explícito de que a DRE contábil oficial é elaborada pelo contador.
2. O escopo contábil inclui **Diário Contábil** por partidas dobradas, **Razão Contábil** por conta analítica e **Exportação Integral** (XLSX e impressão/PDF) com metadados, totalizadores conciliados e trava fail-closed contra amostras incompletas.
3. Nenhuma conta ou saldo de abertura pode ser inventado a partir de texto livre ou heurísticas: faltas de vínculo de conta, categoria ou papel contábil do Anexo III permanecem visíveis com `integral_ok = false` e bloqueiam a emissão do selo integral e das exportações integrais.

## Decisão

### 1. Governança de Papéis Contábeis (Anexo III) — `public.accounting_plan_role_mappings`
- Criada a tabela tenant-scoped `public.accounting_plan_role_mappings` vinculando cada `accounting_plan_id` aos papéis estruturais obrigatórios (`member_receivable_control`, `institutional_receivable_control`, `member_advance_liability`, `institutional_payable_control`, `revenue_deduction`, `financial_fee_expense`, `opening_balance_contra`, `closing_result_account`).
- Aplicados os mesmos controles de imutabilidade em planos `published` (`private.prevent_published_accounting_structure_mutation`, SQLSTATE `55000`), validação estrita de natureza analítica (`private.validate_accounting_plan_role_mapping`, SQLSTATE `23514`), RLS por `finance.read`, bloqueio de escrita direta, e comando governado `public.set_accounting_plan_role_mapping_idempotent` (`accounting.manage`, CAS `40001`, auditoria transacional em `public.audit_logs`).

### 2. Projeção Canônica em Partidas Dobradas — `private.tenant_accounting_journal(uuid)`
- Consolida os 22 fluxos operacionais imutáveis já existentes no schema (`charges` incluindo parcelas `replacement`, `charge_adjustments` com `discount`/`waiver` roteados explicitamente para `revenue_deduction`, `charge_cancellations`, `payments` e `payment_reversals`, `receivable_allocations` e `allocation_reversals`, `member_credits` e `member_credit_reversals`, `institutional_payables`/correções/cancelamentos/pagamentos/estornos, `institutional_receivables`/correções/cancelamentos/recebimentos/estornos, `financial_account_transfers`/estornos e `account_opening_entries`), com data civil por fuso horário da Loja (`private.tenant_current_date_at`, `ADR-0048`).
- Pernas sem plano publicado vigente ou sem mapeamento permanecem `NULL` (`is_fully_mapped = false`, `mapping_gap_reason` preenchido), jamais substituídas por contas genéricas.

### 3. Consultas Governadas e Selo Integral (`reports.read`)
- **Diário Contábil:** `public.read_tenant_accounting_diary_summary(...)` e `public.read_tenant_accounting_diary(...)` com filtros por base temporal (`event_date` ou `competence`), intervalo, tipo de evento, conta contábil e estornos/retificações, totalização em centavos (`total_debit = total_credit`), paginação integral (`p_page_size <= 200`), contagem de legados `non-posting` (`private.tenant_accounting_legacy_count`) e flag `integral_ok`.
- **Razão Contábil:** `public.read_tenant_accounting_ledger(...)` por conta analítica, com **saldo inicial estritamente derivado das partidas anteriores** (`opening_balance_source`: `'prior_entries'` ou `'no_prior_entries_zero'`), saldo corrente `D`/`C` determinístico em janelas ordenadas por `(event_date, accounting_period, created_at, source_table, source_id, entry_id)` e conciliação direta contra o Diário (`reconciles_with_diary`).
- **DRE Gerencial Estruturada (B01):** `public.read_tenant_dre_gerencial(...)` entregando a cascata gerencial (`Receitas Brutas -> (-) Deduções -> Receitas Líquidas -> (-) Custos -> Resultado Bruto -> (-) Despesas Operacionais -> Resultado Operacional -> (+/-) Resultado Financeiro -> Superávit/Déficit Gerencial`), inclusão de contas analíticas ativas zeradas de planos publicados no período, comparativos reais com período imediatamente anterior e mesmo período do ano anterior (`null` / `Sem dados` quando ausentes) e aviso gerencial não fiscal obrigatório.
- **Exportações Integrais (`src/lib/report-export.ts`):** suporte XLSX multi-aba (`write-excel-file` v4 `Sheet[]` com células literais anti-injeção de fórmulas) e impressão/PDF via DOM seguro (`textContent`), bloqueados automaticamente no cliente quando `!integral_ok`, divergência de contagem ou falha na conciliação em centavos.

## Consequências e Limites

- **Positivo:** Entrega Diário, Razão, DRE Gerencial B01 e exportações integrais sem alterar migrations baseline, sem inventar lançamentos/saldos e mantendo compatibilidade total com `read_tenant_dre`.
- **Pendente / Gates:** Requer execução no CI PostgreSQL 17 (`scripts/check_accounting_books_pg.py`), parsing AST SQL (`check_sql.py`), revisão contábil da classificação B01–B05 (Issue `#43`), aplicação controlada em DEV após autorização e homologação autenticada DEV.
