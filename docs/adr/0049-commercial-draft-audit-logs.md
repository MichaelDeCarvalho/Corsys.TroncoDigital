# ADR-0049: Auditoria Transacional, Ordem de Locks e Proteção de Entitlements nas RPCs de Rascunho e Sucessora Comercial

- **Status:** aplicada exclusivamente no Supabase DEV (`szqkdekwhzxsoxorgvaz`, versão remota **`20261125002909_v35_commercial_draft_audit_logs`**, originada de `supabase/migrations/20261124220000_v35_commercial_draft_audit_logs.sql`); PROD não alterado
- **Data:** 2026-11-24
- **Contexto relacionado:** M06.02 (`view-master-planos`), Ciclo de Vida Comercial V35 (`20261002202107`, `20261010010836`, `20261010210329`, `20261010211529`, `20261102000933`), `765a8a661f7375a22183f17c35036a297f4c1e79`

## Contexto

Na consolidação do Ciclo de Vida Comercial de Planos e Ofertas (`MasterPlanLifecycle.tsx`, `MasterPromotions.tsx`), confirmou-se por conferência documental das migrations que nove operações comerciais já gravam eventos em `public.saas_master_audit_logs`, mas três RPCs definidas na migration `20261002202107_202609100016_v35_plan_promotion_lifecycle.sql` não emitiam registro de auditoria nem replicavam integralmente as validações introduzidas nos comandos `*_idempotent`:

1. `public.update_saas_plan_version_draft`
2. `public.create_saas_plan_successor_draft`
3. `public.update_saas_promotion_draft`

Além disso, na revisão arquitetural independente da proposta SQL preliminar, foram apontados dois achados obrigatórios:

- **F1 (Ordem de locks):** inverter `update_saas_plan_version_draft` para bloquear `saas_plans` antes de `saas_plan_versions` criaria ordem de locks incompatível com `public.publish_saas_plan_version` (que bloqueia `saas_plan_versions` primeiro e depois atualiza `saas_plans`).
- **F2 (Proteção de entitlements contra `NULL`):** o uso de `coalesce(p_entitlements, '{}'::jsonb)` converteria `NULL` em `'{}'::jsonb`, fazendo `private.replace_plan_version_entitlements` apagar silenciosamente todos os entitlements já salvos no rascunho.

## Problema

1. Fechar a lacuna de governança administrativa em `public.saas_master_audit_logs` para as três mutações comerciais (`saas_plan_version.draft_updated`, `saas_plan_version.successor_draft` e `saas_promotion.draft_updated`), mantendo execução atômica e rollback conjunto em caso de erro.
2. Garantir compatibilidade de concorrência entre todas as RPCs do ciclo de planos sem introduzir ciclo AB-BA com `publish_saas_plan_version`.
3. Impedir apagamento acidental de entitlements por entrada `NULL` ou JSON inválido, preservando `'{}'::jsonb` apenas quando explicitamente enviado.
4. Alinhar validações de entrada entre as três RPCs, as RPCs `*_idempotent` já existentes e os componentes `MasterPlanLifecycle.tsx` / `MasterPromotions.tsx`, sem ampliar regras comerciais desnecessariamente.

## Decisão

Criar exclusivamente a migration aditiva `supabase/migrations/20261124220000_v35_commercial_draft_audit_logs.sql` (sem alterar nenhuma das 66 migrations históricas preservadas):

1. **Ordem de locks compatível (F1):**
   - `public.update_saas_plan_version_draft` **preserva a ordem original**: executa validações de entrada antes de adquirir locks; em seguida bloqueia `public.saas_plan_versions` (`for update`) e só atualiza `public.saas_plans` após verificar `v_has_published`.
   - Matriz de concorrência verificada entre as cinco RPCs de plano (`20261002202107`):
     - `update_saas_plan_version_draft` × `publish_saas_plan_version`: **100% compatíveis** — ambas bloqueiam `saas_plan_versions` (`for update`) primeiro e só depois tocam `saas_plans`. Em corrida sobre o mesmo rascunho, serializam no mesmo lock de versão sem AB-BA; se a publicação concluir antes, a edição falha de forma determinística com `23503`.
     - `update_saas_plan_version_draft` / `publish_saas_plan_version` × `create_saas_plan_successor_draft`: compatíveis — `create_saas_plan_successor_draft` bloqueia `saas_plans` (`for update`) e insere nova linha com `version_number = max + 1` sem bloquear versões `draft`/`published` preexistentes; caso um plano já tenha versão publicada (`v_has_published = true`), `update_saas_plan_version_draft` nem sequer atualiza `saas_plans`.
     - `update_saas_plan_version_draft` / `publish_saas_plan_version` × `set_saas_plan_active`: compatíveis — `set_saas_plan_active` bloqueia/atualiza exclusivamente `saas_plans.active`.
     - `update_saas_plan_version_draft` / `publish_saas_plan_version` × `delete_saas_plan_if_unused`: `delete_saas_plan_if_unused` (inalterada no baseline) bloqueia `saas_plans` e depois exclui `saas_plan_versions`, mantendo ordem inversa preexistente apenas para remoção de plano sem vínculos mediante confirmação explícita `EXCLUIR`. Não alterar `delete_saas_plan_if_unused` nem `publish_saas_plan_version` representa a menor modificação segura no escopo desta entrega.
2. **Proteção fail-closed contra `NULL` em entitlements (F2):**
   - Remoção completa de `coalesce(p_entitlements, '{}'::jsonb)` em `update_saas_plan_version_draft` e `create_saas_plan_successor_draft`.
   - Validação imediata antes de locks ou escritas: exige `p_entitlements is not null`, `jsonb_typeof(p_entitlements) = 'object'` e `pg_column_size(p_entitlements) <= 16000` (caso contrário `SQLSTATE '22023'`). `'{}'::jsonb` explícito permanece aceito.
3. **Alinhamento estrito de validações (F3):**
   - Planos (`update_saas_plan_version_draft`, `create_saas_plan_successor_draft`): `p_code` (`^[a-z0-9][a-z0-9_-]{1,40}$`), `p_name` (`2..120` chars), `p_price` finito (`0..999999999999.99`, precisão de 2 casas), `p_billing_interval` (`monthly|yearly|custom`), `p_trial_days`/`p_grace_days` (`0..365`), `p_valid_from` finito e no 1º dia do mês (`extract(day from p_valid_from) = 1`), alinhados a `create_master_plan_draft_idempotent` e `MasterPlanLifecycle.tsx`.
   - Promoções (`update_saas_promotion_draft`): `p_name` (`3..120`), `p_public_code` (`^[A-Z0-9_-]{3,40}$`), `p_benefit_type` (`percent|fixed_amount|trial_price`), `p_benefit_value` finito (`> 0`, `<= 999999999999.99`, precisão de 2 casas, `<= 100` se `percent`), `p_duration_type`/`p_duration_cycles` (`cycles` exige `1..36`; demais exigem `null`), `p_valid_from`/`p_valid_to` finitos (`p_valid_to > p_valid_from` quando informado — sem exigir `p_valid_from > now()` para não bloquear edição de rascunhos existentes), `p_eligibility_scope` (`new_customers|selected_customers|all_eligible`), `p_max_redemptions` (`null` ou `1..1000000`) e `p_stackable is not null`.
4. **Auditoria transacional mínima (F4):**
   - Inserts em `public.saas_master_audit_logs` ao final de cada função bem-sucedida (`saas_plan_version.draft_updated`, `saas_plan_version.successor_draft`, `saas_promotion.draft_updated`), gravando `staff_user_id`, `action`, `resource_type`, `resource_id` e `metadata` mínima (sem dump JSONB de entitlements, PII ou secrets). Compatível com `public.list_master_audit_events`.
5. **Privilégios:** `SECURITY DEFINER`, `set search_path = ''`, `private.require_platform_staff('MASTER')` (MFA/AAL2), `REVOKE ALL ... FROM public, anon, authenticated` e `GRANT EXECUTE ... TO authenticated`.

## Alternativas consideradas

- **Inverter a ordem de locks em `update_saas_plan_version_draft` e `publish_saas_plan_version` (`saas_plans` → `saas_plan_versions`):** descartada para evitar ampliar o escopo para funções fora dos três alvos e para não introduzir divergência caso aplicada isoladamente.
- **Usar triggers em `saas_plan_versions` / `saas_promotions` para auditar:** descartada porque triggers não distinguem com clareza criação inicial idempotente (`draft_created`) de edição (`draft_updated`) ou sucessora (`successor_draft`), além de dificultarem a inclusão de metadados coerentes sem lógica implícita de sessão.

## Consequências, Trade-offs e Riscos

- **Positivas:** 100% das mutações comerciais da tela `view-master-planos` passam a registrar trilha imutável em `saas_master_audit_logs`; elimina risco de perda de entitlements por `NULL` e previne deadlock AB-BA com publicação.
- **Limitações / Riscos:** no Supabase DEV (`szqkdekwhzxsoxorgvaz`), o teste transacional `supabase/tests/test_commercial_draft_audit_rollback.sql` foi executado com **`COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS`** (3 RPCs atualizadas com `SECURITY DEFINER`, `anon` sem `EXECUTE`, controle `MASTER + AAL2` preservado, dados de negócio e contagem de auditoria intactos após `ROLLBACK`). Permanece **`NOT EVALUATED`** a contenção simultânea real entre duas sessões paralelas, bem como a homologação operacional autenticada no navegador DEV. Os textos informativos em `MasterPlanLifecycle.tsx` e `MasterPromotions.tsx` foram alinhados pós-ativação DEV nesta consolidação.

## Impacto em Segurança e Dados

- Nenhuma ampliação de permissões/RLS ou exposição de `saas_master_audit_logs` (leitura segue exclusiva de `list_master_audit_events` para `MASTER + AAL2`, omitindo `metadata`).
- Nenhuma tabela nova e nenhuma alteração retroativa em registros existentes; PROD não alterado.

## Rollout e Rollback

- **Rollout DEV concluído (`20261125002909`):** migration `20261124220000_v35_commercial_draft_audit_logs.sql` aplicada com sucesso no DEV (`szqkdekwhzxsoxorgvaz`), divergência de timestamp registrada em `docs/V35_MIGRATION_RECONCILIATION_DEV.md` sem renomear o arquivo no Git, e cópias da UI alinhadas pós-ativação em `MasterPlanLifecycle.tsx` e `MasterPromotions.tsx`. Homologação operacional autenticada no DEV permanece pendente.
- **Rollback:** criar nova migration forward-only restaurando as definições anteriores de `20261002202107_202609100016_v35_plan_promotion_lifecycle.sql` para as três funções (preservando os logs já gravados em `saas_master_audit_logs`, cuja tabela é append-only/imutável).

## PR / Commit relacionado

- Migration versionada e auditada sobre `main` (`765a8a661f7375a22183f17c35036a297f4c1e79`), aplicada exclusivamente ao DEV sob versão `20261125002909_v35_commercial_draft_audit_logs`; consolidação pós-migration da UI e documentos aguardando sync/push, CI e homologação independente no Work.
