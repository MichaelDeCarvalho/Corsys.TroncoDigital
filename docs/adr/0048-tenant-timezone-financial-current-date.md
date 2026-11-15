# ADR-0048: Data Civil Financeira e de Inadimplência por Fuso Horário da Loja (`organization_settings.timezone`)

- **Status:** Aprovado (Homologação V35 — Fechamento dos Gates M02.03 / M04.03 / M06)
- **Data:** 2026-04-20
- **Decisor:** Proprietário do Produto (`Corsys.TroncoDigital`)

## Contexto

Durante a homologação da V35, constatou-se que o banco PostgreSQL/Supabase opera em `TimeZone = 'UTC'`, fazendo com que `current_date` avalie a data civil em UTC (`(now() AT TIME ZONE 'UTC')::date`).

Para lojas situadas em fusos brasileiros (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, etc.), entre `21:00` e `23:59` do horário local (por exemplo, `00:00` a `02:59 UTC` do dia seguinte), o uso de `current_date` em UTC avançava prematuramente o dia civil em até 3 a 5 horas antes da meia-noite local da Loja, afetando:

1. **Inadimplência e faixas de atraso (`1–30`, `31–60`, `61–90`, `90+` dias):** títulos com vencimento no próprio dia (`due_date = hoje_local`) passavam a ser classificados como vencidos (`1–30 dias`) após as `21:00 BRT`, e títulos nas fronteiras de `30`, `60` e `90` dias mudavam de faixa antes da meia-noite local.
2. **Dashboard financeiro (`read_tenant_financial_dashboard`):** o corte de mês corrente (`date_trunc('month', ...)`), títulos vencidos (`overdue_total`) e contas a pagar vencidas (`payables_overdue`) sofriam virada antecipada no último dia do mês às `21:00 BRT`.
3. **Operações financeiras e contábeis por data default:** transferências entre contas, conciliação bancária, acordos de dívida, geração e prévia de recorrências mensais/anuais, termos de configuração de integrante, rascunhos contábeis, políticas de aprovação, eventos de Ágape e lotes de Mútua.

A coluna `public.organization_settings.timezone` já existia no esquema canônico com default `'America/Sao_Paulo'`.

## Decisão

1. **Fuso configurado individualmente por Loja:** a V35 adota formalmente a data civil do fuso horário IANA configurado na Loja (`public.organization_settings.timezone`), com fallback determinístico para `'America/Sao_Paulo'` quando a Loja ainda não possuir linha em `organization_settings` ou quando o valor não estiver preenchido.
2. **Validação fail-closed de fuso IANA (`22023`):**
   - A função `private.is_valid_iana_timezone(p_timezone text)` valida o identificador contra `pg_timezone_names`, rejeitando valores vazios, espaços, deslocamentos POSIX brutos e abreviações ambíguas.
   - A tabela `public.organization_settings` recebe constraint e trigger (`validate_organization_settings_timezone`) que rejeitam fusos inválidos com `SQLSTATE '22023'`.
3. **Funções canônicas centralizadas (`SECURITY DEFINER`):**
   - `private.tenant_current_date_at(p_organization_id uuid, p_reference_at timestamptz) RETURNS date`: calcula `(p_reference_at AT TIME ZONE v_tz)::date` usando o fuso validado da Loja.
   - `private.tenant_current_date(p_organization_id uuid) RETURNS date`: delega para `private.tenant_current_date_at(p_organization_id, now())`.
4. **Aplicação uniforme na migration aditiva `20261115120000_v35_tenant_timezone_financial_dates.sql`:**
   - Dashboard financeiro (`read_tenant_financial_dashboard`);
   - Inadimplência (`read_tenant_delinquency`, `read_tenant_delinquency_bucket_summary`, `read_tenant_delinquency_filtered`);
   - Transferências entre contas, conciliação bancária, acordos de dívida, regras e prévias de recorrência mensal/anual, configuração/termos de integrante, rascunhos e guardas contábeis, políticas de aprovação, eventos de Ágape e lotes de Mútua;
   - Preservação integral de migrations históricas já listadas em `docs/engineering/v35-dev-runtime-manifest.json`.
5. **Timestamps de auditoria permanecem em `timestamptz` (UTC):**
   - `created_at`, `updated_at`, `paid_at`, `occurred_at` e demais trilhas de auditoria continuam armazenados em `timestamptz`.

## Consequências

- **Positivas:** elimina a virada prematura de dia/mês entre `21:00` e `23:59` no horário local de cada Loja; permite que Lojas no Amazonas (`America/Manaus`), Acre (`America/Rio_Branco`), São Paulo (`America/Sao_Paulo`) ou exterior operem com sua própria meia-noite civil de forma determinística e auditável.
- **Operacionais:** a migration `20261115120000_v35_tenant_timezone_financial_dates.sql` deve ser aplicada no Supabase DEV antes da homologação remota de virada de dia em banco real.
