# V35 P1 — Decisão Técnica de Data Contábil e Timezone (UTC vs BRT / Por Tenant)

**Data de registro:** 2026-11-13 (Atualizado em 2026-11-15)  
**Estado:** **DECISÃO APROVADA E IMPLEMENTADA EM CÓDIGO (`ADR-0048` + migration `20261115120000_v35_tenant_timezone_financial_dates.sql`)** — aguardando aplicação no Supabase DEV  
**Referência:** Homologação ChatGPT Work — Divergência de `current_date` observada às `21:11 BRT` em `2026-11-13` (PostgreSQL retornou `2026-11-14`)

---

## 1. Problema Observado em Homologação Real

Em `2026-11-13` às `21:11` (horário de Brasília, `America/Sao_Paulo`, UTC-3), a função `public.read_tenant_delinquency_bucket_summary` no Supabase DEV retornou `server_date = '2026-11-14'`.

Motivo:
- O PostgreSQL do Supabase DEV opera com `TimeZone = 'UTC'`.
- Funções e views financeiras utilizam `current_date` diretamente em comparações com colunas `date` (`due_date < current_date` e `current_date - first_due`).
- Entre `21:00` e `23:59` BRT (`00:00`–`02:59` UTC do dia seguinte), cobranças que vencem no dia seguinte ou atingem limiares exatos de faixa (`30 -> 31`, `60 -> 61`, `90 -> 91` dias) mudam de status/faixa com **3 horas de antecedência** em relação ao calendário civil brasileiro.

---

## 2. Funções e Objetos Afetados no Backend

Inspeção estática do repositório identificou uso de `current_date` (UTC na sessão padrão do servidor) em:
- `public.read_tenant_delinquency` (`20261009190647_tenant_delinquency_paginated_report.sql`)
- `public.read_tenant_delinquency_bucket_summary` (`20261113123000_v35_tenant_delinquency_buckets.sql`)
- `public.read_tenant_delinquency_filtered` (`20261113123000_v35_tenant_delinquency_buckets.sql`)
- `public.read_tenant_financial_dashboard` (`20261009190304_tenant_financial_dashboard_kpis.sql`) — usa `current_date` para `receivables_overdue`, `payables_overdue`, início do mês (`date_trunc('month', current_date)`) e `as_of`
- Demais consultas e projeções que utilizam `current_date` (transferências entre contas, conciliação bancária, acordos de dívida, regras e prévias de recorrência mensal/anual, configuração/termos de integrante, rascunhos e guardas contábeis, políticas de aprovação, eventos de Ágape e lotes de Mútua)

### Estado do Schema de Timezone e Implementação Canônica (`ADR-0048`)

A tabela `public.organization_settings` (`20261002201615_202609040001_foundation.sql`, linha 49) define:
```sql
timezone text not null default 'America/Sao_Paulo'
```
Com a aprovação da **Opção B (`ADR-0048`)**, a migration aditiva `supabase/migrations/20261115120000_v35_tenant_timezone_financial_dates.sql`:
1. Valida estritamente `organization_settings.timezone` contra `pg_timezone_names` (`private.is_valid_iana_timezone` + constraint `organization_settings_timezone_format_check` + trigger `validate_organization_settings_timezone`), rejeitando fusos inválidos de forma fail-closed (`22023`).
2. Centraliza a data civil da Loja em `private.tenant_current_date_at(p_organization_id uuid, p_reference_at timestamptz)` e `private.tenant_current_date(p_organization_id uuid)`, com fallback determinístico para `'America/Sao_Paulo'`.
3. Aplica `private.tenant_current_date(p_organization_id)` de forma uniforme ao Dashboard, Inadimplência e 16 comandos/consultas financeiros e contábeis por Loja, preservando todos os timestamps de auditoria em `timestamptz` (UTC).

### Comportamento no Frontend (Preservado e Coerente)

- `src/components/DelinquencyReport.tsx` **não** usa `new Date()` do navegador para classificar faixas ou calcular dias em atraso quando a resposta do banco está ausente: requer explicitamente `serverDate` de `read_tenant_delinquency_bucket_summary` e, na ausência, exibe estado explícito (`Requer migration` / aviso de indisponibilidade).
- `src/lib/finance-data.ts` (`formatDate`) formata datas `YYYY-MM-DD` literalmente sem conversão de fuso do navegador, evitando deslocamento artificial de `-1` dia no cliente.
- Cobertura de testes unitários de múltiplos fusos (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `UTC`), transição de dia (`21:00–23:59 BRT`) e limites de faixa (`0, 1, 30, 31, 60, 61, 90, 91`) em `src/lib/delinquency-report.test.ts` e `supabase/tests/test_tenant_timezone_financial_dates_rollback.sql`.

---

## 3. Alternativas Arquiteturais Avaliadas

| Opção | Descrição | Vantagens | Riscos / Observações |
|---|---|---|---|
| **A — Manter UTC (`current_date`)** | Documentar que todo fechamento diário é UTC e exibir `"Data de referência (UTC)"` | Zero mudança SQL | **Rejeitada**: às 21h01 BRT, cobrança com vencimento no dia seguinte já é exibida como vencida |
| **B — Timezone por Tenant (`organization_settings.timezone`)** *(APROVADA — ADR-0048)* | Helper canônico `private.tenant_current_date(p_organization_id uuid)` consultando `organization_settings.timezone` (validado contra `pg_timezone_names` com fallback `'America/Sao_Paulo'`) aplicado de forma uniforme em Dashboard, Inadimplência e operações financeiras da Loja | Aproveita coluna existente no schema (`organization_settings.timezone`); atende todos os fusos do Brasil (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `America/Noronha`, etc.); mantém determinismo por Loja | Implementada em `20261115120000_v35_tenant_timezone_financial_dates.sql` com validação IANA fail-closed (`22023`) e testes SQL rollback |
| **C — Padrão fixo `'America/Sao_Paulo'`** | Helper canônico `private.brt_current_date()` retornando `(clock_timestamp() at time zone 'America/Sao_Paulo')::date` | Simples, sem leitura por tenant | **Preterida em favor da Opção B**: Lojas em outros fusos horários brasileiros (`AM`, `AC`, `RO`, `RR`, `MT`, `MS`) seguiriam o relógio de Brasília |

---

## 4. Registro da Decisão Aprovada (`ADR-0048`)

1. **Política oficial aprovada pelo proprietário:** **Opção B** — data civil por `organization_settings.timezone` (default `'America/Sao_Paulo'`), formalizada em `docs/adr/0048-tenant-timezone-financial-current-date.md`.
2. **Artefatos entregues:**
   - ADR: `docs/adr/0048-tenant-timezone-financial-current-date.md`
   - Migration aditiva: `supabase/migrations/20261115120000_v35_tenant_timezone_financial_dates.sql`
   - Teste SQL transacional (rollback): `supabase/tests/test_tenant_timezone_financial_dates_rollback.sql`
   - Testes automatizados Vitest: `src/lib/delinquency-report.test.ts`
3. **Próximo passo operacional:** aplicar `20261115120000_v35_tenant_timezone_financial_dates.sql` no Supabase DEV antes do reteste remoto de virada de dia (`21:00–23:59 BRT`).
