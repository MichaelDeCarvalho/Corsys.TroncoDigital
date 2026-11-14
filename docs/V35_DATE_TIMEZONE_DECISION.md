# V35 P1 — Decisão Técnica de Data Contábil e Timezone (UTC vs BRT / Por Tenant)

**Data de registro:** 2026-11-13  
**Estado:** Aguardando aprovação formal de negócio / ADR antes de preparar/aplicar migration SQL no PostgreSQL DEV  
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
- Demais consultas e projeções que utilizam `current_date` (`read_master_client_360_summary`, vigências de planos/termos, etc.)

### Estado Atual do Schema de Timezone

A tabela `public.organization_settings` (`20261002201615_202609040001_foundation.sql`, linha 49) já possui:
```sql
timezone text not null default 'America/Sao_Paulo'
```
Entretanto:
1. A função `save_tenant_identity` (`20261009012944_tenant_identity_commands.sql`, ADR-0011) não expõe edição do campo `timezone` pela Loja.
2. Nenhuma função SQL financeira atual lê `organization_settings.timezone`.

### Comportamento Atual no Frontend (Preservado e Coerente)

- `src/components/DelinquencyReport.tsx` **não** usa `new Date()` do navegador para classificar faixas ou calcular dias em atraso quando a resposta do banco está ausente: requer explicitamente `serverDate` de `read_tenant_delinquency_bucket_summary` e, na ausência, exibe estado explícito (`Requer migration` / aviso de indisponibilidade).
- `src/lib/finance-data.ts` (`formatDate`) formata datas `YYYY-MM-DD` literalmente sem conversão de fuso do navegador, evitando deslocamento artificial de `-1` dia no cliente.
- Cobertura adicional de testes unitários de transição de dia (`21:11 BRT` / `2026-11-13` vs `2026-11-14` UTC) e limites de faixa (`0, 1, 30, 31, 60, 61, 90, 91`) adicionada em `src/lib/delinquency-report.test.ts`.

---

## 3. Alternativas Arquiteturais Avaliadas

| Opção | Descrição | Vantagens | Riscos / Observações |
|---|---|---|---|
| **A — Manter UTC (`current_date`)** | Documentar que todo fechamento diário é UTC e exibir `"Data de referência (UTC)"` | Zero mudança SQL | **Incompatível com UX operacional no Brasil**: às 21h01 BRT, cobrança com vencimento no dia seguinte já é exibida como vencida |
| **B — Timezone por Tenant (`organization_settings.timezone`)** *(Recomendação técnica)* | Criar helper canônico `private.tenant_current_date(p_organization_id uuid)` consultando `organization_settings.timezone` (validado contra `pg_timezone_names` com fallback `'America/Sao_Paulo'`) e aplicá-lo de forma uniforme em Dashboard, Inadimplência, Fluxo de Caixa e vencimentos | Aproveita coluna já existente no schema (`organization_settings.timezone`); atende todos os 4 fusos do Brasil (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `America/Noronha`); mantém determinismo por Loja | Exige validação estrita de IANA timezone (allowlist) caso venha a ser editável; requer atualização coordenada de `read_tenant_financial_dashboard`, `read_tenant_delinquency*` e funções correlatas na mesma migration |
| **C — Padrão fixo `'America/Sao_Paulo'`** | Criar helper canônico `private.brt_current_date()` retornando `(clock_timestamp() at time zone 'America/Sao_Paulo')::date` | Simples, sem leitura por tenant, elimina descompasso de `21:00–23:59 BRT` imediatamente | Lojas em outros fusos horários brasileiros (`AM`, `AC`, `RO`, `RR`, `MT`, `MS`) seguirão o relógio de Brasília |

---

## 4. Decisão de Negócio Pendente (Gate Obrigatório Antes da Migration)

Antes de criar e aplicar qualquer migration SQL alterando o cálculo oficial de vencimento e inadimplência:

1. **Confirmar política oficial entre Opção B vs Opção C** (por ADR específico, p. ex. `ADR-0041`):
   - **Opção B (Recomendada tecnicamente):** data civil por `organization_settings.timezone` (default `'America/Sao_Paulo'`), aplicada uniformemente a `read_tenant_financial_dashboard`, `read_tenant_delinquency`, `read_tenant_delinquency_bucket_summary`, `read_tenant_delinquency_filtered` e demais verificações financeiras de vencimento da Loja.
   - **Opção C:** calendário único nacional `'America/Sao_Paulo'` em toda a camada financeira de Lojas.
2. **Alinhar escopo da data no `Master` (control plane):** definir se métricas globais da plataforma (`read_master_saas_overview`, `read_master_client_360_summary`) permanecem em UTC ou adotam `'America/Sao_Paulo'`.
3. **Sem alteração silenciosa:** nenhuma migration SQL aditiva foi aplicada nem escrita sem essa decisão formal para evitar divergência entre Dashboard, Inadimplência e contratos vigentes.
