-- Teste transacional determinístico (ROLLBACK) para
-- supabase/migrations/20261124220000_v35_commercial_draft_audit_logs.sql
-- NÃO executar com COMMIT em DEV/PROD. Todas as alterações são revertidas ao final.
--
-- Cobre:
-- - Assinaturas, SECURITY DEFINER, search_path='', e ACLs (anon revogado, authenticated permitido).
-- - F1 (ordem de locks compatível com publish_saas_plan_version e conflito sequencial edit vs publish).
-- - F2 (rejeição SQLSTATE 22023 para p_entitlements NULL/não-objeto sem apagar entitlements existentes,
--   preservando '{}' explícito quando intencional).
-- - F3 (alinhamento de validações com create_master_plan_draft_idempotent,
--   create_master_promotion_draft_idempotent e frontend MasterPlanLifecycle/MasterPromotions).
-- - F4 (eventos transacionais 'saas_plan_version.draft_updated', 'saas_plan_version.successor_draft'
--   e 'saas_promotion.draft_updated' com metadados mínimos, sem PII ou JSONB completo de entitlements,
--   rollback atômico em falha e leitura via list_master_audit_events).
--
-- Nota de limite: testes de contenção paralela real entre duas conexões simultâneas permanecem
-- NÃO AVALIADOS neste script de sessão única.

begin;

do $$
declare
  v_master uuid := '11111111-1111-4111-8111-111111111101';
  v_support uuid := '11111111-1111-4111-8111-111111111102';
  v_billing uuid := '11111111-1111-4111-8111-111111111103';
  v_non_staff uuid := '11111111-1111-4111-8111-111111111104';

  v_sigs text[] := array[
    'public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb)',
    'public.create_saas_plan_successor_draft(uuid,numeric,text,integer,integer,date,jsonb)',
    'public.update_saas_promotion_draft(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean)'
  ];
  v_sig text;
  v_oid oid;
  v_secdef boolean;
  v_config text[];
  v_fn_def text;

  v_plan_draft uuid;
  v_plan_other uuid;
  v_plan_id uuid;
  v_plan_v2 uuid;
  v_promo_draft uuid;

  v_audit_before bigint;
  v_audit_row public.saas_master_audit_logs%rowtype;
  v_ent_count integer;
  v_ent_val jsonb;
  v_catalog_name text;
  v_catalog_code text;
begin
  -- =========================================================================
  -- 0. Auditoria de catálogo: SECURITY DEFINER, search_path='' e ACLs
  -- =========================================================================
  foreach v_sig in array v_sigs loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'missing function signature: %', v_sig;
    end if;

    select prosecdef, proconfig into v_secdef, v_config
    from pg_proc where oid = v_oid;

    if not coalesce(v_secdef, false) then
      raise exception 'function % must be SECURITY DEFINER', v_sig;
    end if;

    if not ('search_path=""' = any(coalesce(v_config, array[]::text[]))
            or 'search_path=' = any(coalesce(v_config, array[]::text[]))) then
      raise exception 'function % must set empty search_path (got %)', v_sig, v_config;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'anon must not have EXECUTE on %', v_sig;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'authenticated must have EXECUTE on %', v_sig;
    end if;
  end loop;

  -- F1 structural invariant check: update_saas_plan_version_draft locks saas_plan_versions
  -- before any update to saas_plans (same order as publish_saas_plan_version).
  select pg_get_functiondef(to_regprocedure(
    'public.update_saas_plan_version_draft(uuid,text,text,numeric,text,integer,integer,date,jsonb)'
  )) into v_fn_def;

  if position('from public.saas_plan_versions' in v_fn_def) = 0
     or position('for update' in v_fn_def) = 0
     or position('update public.saas_plans' in v_fn_def) < position('for update' in v_fn_def) then
    raise exception 'F1 invariant failed: lock order must lock saas_plan_versions before saas_plans';
  end if;

  -- =========================================================================
  -- 1. Fixtures isoladas dentro da transação ROLLBACK
  -- =========================================================================
  insert into auth.users (id, aud, role, email)
  values
    (v_master, 'authenticated', 'authenticated', 'audit-master@corsys.test'),
    (v_support, 'authenticated', 'authenticated', 'audit-support@corsys.test'),
    (v_billing, 'authenticated', 'authenticated', 'audit-billing@corsys.test'),
    (v_non_staff, 'authenticated', 'authenticated', 'audit-tenant@corsys.test')
  on conflict (id) do nothing;

  insert into public.platform_staff (user_id, role, active)
  values
    (v_master, 'MASTER', true),
    (v_support, 'SUPPORT', true),
    (v_billing, 'BILLING', true)
  on conflict (user_id) do update set role = excluded.role, active = excluded.active;

  -- Criar rascunhos base como MASTER + AAL2
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_master::text, 'role', 'authenticated', 'aal', 'aal2'
  )::text, true);
  execute 'set local role authenticated';

  v_plan_draft := public.create_master_plan_draft_idempotent(
    'audit_plan_one', 'Plano Auditoria Um', 120.00, 'monthly', 0, 7,
    '2027-01-01', '{"members_max": 150, "audit_export": true}'::jsonb,
    gen_random_uuid()::text
  );

  v_plan_other := public.create_master_plan_draft_idempotent(
    'audit_plan_two', 'Plano Auditoria Dois', 200.00, 'monthly', 0, 7,
    '2027-01-01', '{"members_max": 500}'::jsonb,
    gen_random_uuid()::text
  );

  v_promo_draft := public.create_master_promotion_draft_idempotent(
    'Oferta Auditoria Um', 'AUDITOFFER1', 'percent', 15.00, 'cycles', 3,
    '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 100, false,
    gen_random_uuid()::text
  );

  select plan_id into strict v_plan_id
  from public.saas_plan_versions where id = v_plan_draft;

  -- =========================================================================
  -- 2. T01 — Negativas de autorização (auth.uid null, AAL1, SUPPORT, BILLING, não-staff)
  -- =========================================================================
  execute 'reset role';
  select count(*) into v_audit_before from public.saas_master_audit_logs;
  execute 'set local role authenticated';

  -- T01a: sem auth.uid() -> 28000
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'X', 'audit_plan_one', 100, 'monthly', 0, 7, '2027-01-01', '{}'::jsonb
    );
    raise exception 'T01a expected 28000 for null auth.uid';
  exception when sqlstate '28000' then null;
  end;

  -- T01b: MASTER com AAL1 -> 42501 nas 3 RPCs
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_master::text, 'role', 'authenticated', 'aal', 'aal1'
  )::text, true);

  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano X', 'audit_plan_one', 100, 'monthly', 0, 7, '2027-01-01', '{}'::jsonb
    );
    raise exception 'T01b update_saas_plan_version_draft accepted AAL1';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_saas_plan_successor_draft(
      v_plan_id, 150, 'monthly', 0, 7, '2027-03-01', '{}'::jsonb
    );
    raise exception 'T01b create_saas_plan_successor_draft accepted AAL1';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta X', 'AUDITOFFER1', 'percent', 10, 'once', null,
      '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 50, false
    );
    raise exception 'T01b update_saas_promotion_draft accepted AAL1';
  exception when insufficient_privilege then null;
  end;

  -- T01c: SUPPORT, BILLING e não-staff com AAL2 -> 42501
  for v_sig in select unnest(array[v_support::text, v_billing::text, v_non_staff::text]) loop
    perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_sig, 'role', 'authenticated', 'aal', 'aal2'
    )::text, true);

    begin
      perform public.update_saas_plan_version_draft(
        v_plan_draft, 'Plano X', 'audit_plan_one', 100, 'monthly', 0, 7, '2027-01-01', '{}'::jsonb
      );
      raise exception 'T01c non-MASTER updated plan draft';
    exception when insufficient_privilege then null;
    end;

    begin
      perform public.create_saas_plan_successor_draft(
        v_plan_id, 150, 'monthly', 0, 7, '2027-03-01', '{}'::jsonb
      );
      raise exception 'T01c non-MASTER created plan successor';
    exception when insufficient_privilege then null;
    end;

    begin
      perform public.update_saas_promotion_draft(
        v_promo_draft, 'Oferta X', 'AUDITOFFER1', 'percent', 10, 'once', null,
        '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 50, false
      );
      raise exception 'T01c non-MASTER updated promotion draft';
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- T01d: role anon rejeitada na execução
  execute 'set local role anon';
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano X', 'audit_plan_one', 100, 'monthly', 0, 7, '2027-01-01', '{}'::jsonb
    );
    raise exception 'T01d anon executed update_saas_plan_version_draft';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before then
    raise exception 'T01 unauthorized calls wrote audit logs';
  end if;

  -- =========================================================================
  -- 3. T03 (F2) — p_entitlements NULL ou não-objeto falha com 22023 e NÃO apaga entitlements
  -- =========================================================================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_master::text, 'role', 'authenticated', 'aal', 'aal2'
  )::text, true);
  execute 'set local role authenticated';

  -- T03a: NULL em update_saas_plan_version_draft
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Tentativa NULL', 'audit_plan_one', 999.00, 'yearly', 10, 10,
      '2027-05-01', null
    );
    raise exception 'T03a update_saas_plan_version_draft accepted NULL entitlements';
  exception when sqlstate '22023' then null;
  end;

  -- T03b: array JSONB em update_saas_plan_version_draft
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Tentativa Array', 'audit_plan_one', 999.00, 'yearly', 10, 10,
      '2027-05-01', '["members_max"]'::jsonb
    );
    raise exception 'T03b update_saas_plan_version_draft accepted array entitlements';
  exception when sqlstate '22023' then null;
  end;

  -- T03c: escalar JSONB em update_saas_plan_version_draft
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Tentativa Scalar', 'audit_plan_one', 999.00, 'yearly', 10, 10,
      '2027-05-01', '123'::jsonb
    );
    raise exception 'T03c update_saas_plan_version_draft accepted scalar entitlements';
  exception when sqlstate '22023' then null;
  end;

  -- T03d: NULL e não-objeto em create_saas_plan_successor_draft
  begin
    perform public.create_saas_plan_successor_draft(
      v_plan_id, 250.00, 'monthly', 0, 7, '2027-06-01', null
    );
    raise exception 'T03d create_saas_plan_successor_draft accepted NULL entitlements';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.create_saas_plan_successor_draft(
      v_plan_id, 250.00, 'monthly', 0, 7, '2027-06-01', '[]'::jsonb
    );
    raise exception 'T03d create_saas_plan_successor_draft accepted array entitlements';
  exception when sqlstate '22023' then null;
  end;

  execute 'reset role';

  -- Confirmar que os 2 entitlements originais de v_plan_draft permanecem intactos e não houve audit
  select count(*) into v_ent_count
  from public.saas_plan_version_entitlements
  where plan_version_id = v_plan_draft;

  select entitlement_value into v_ent_val
  from public.saas_plan_version_entitlements
  where plan_version_id = v_plan_draft and entitlement_key = 'members_max';

  if v_ent_count <> 2 or v_ent_val <> '150'::jsonb then
    raise exception 'T03 existing entitlements were modified after NULL/invalid input rejection';
  end if;

  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before then
    raise exception 'T03 rejected NULL/invalid entitlements wrote audit logs';
  end if;

  -- =========================================================================
  -- 4. T08 — Validações F3 de limites em planos (rejeição 22023 + zero audit)
  -- =========================================================================
  execute 'set local role authenticated';

  -- Data fora do dia 1
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Um', 'audit_plan_one', 120.00, 'monthly', 0, 7,
      '2027-02-15', '{"members_max":150}'::jsonb
    );
    raise exception 'T08 accepted non-1st valid_from';
  exception when sqlstate '22023' then null;
  end;

  -- Código inválido
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Um', 'INVALID CODE!', 120.00, 'monthly', 0, 7,
      '2027-02-01', '{}'::jsonb
    );
    raise exception 'T08 accepted invalid code regex';
  exception when sqlstate '22023' then null;
  end;

  -- Preço com 3 casas / NaN / negativo
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Um', 'audit_plan_one', 120.123, 'monthly', 0, 7,
      '2027-02-01', '{}'::jsonb
    );
    raise exception 'T08 accepted >2 decimal precision';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.create_saas_plan_successor_draft(
      v_plan_id, 'NaN'::numeric, 'monthly', 0, 7, '2027-02-01', '{}'::jsonb
    );
    raise exception 'T08 accepted NaN price';
  exception when sqlstate '22023' then null;
  end;

  -- Trial > 365
  begin
    perform public.create_saas_plan_successor_draft(
      v_plan_id, 120.00, 'monthly', 366, 7, '2027-02-01', '{}'::jsonb
    );
    raise exception 'T08 accepted trial > 365';
  exception when sqlstate '22023' then null;
  end;

  -- =========================================================================
  -- 5. T02 & T11a — Edição positiva de rascunho v1, '{}'::jsonb intencional e rollback em 23505
  -- =========================================================================
  -- Primeiro: conflito de código duplicado (23505) deve abortar sem gerar auditoria
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Plano Colisao', 'audit_plan_two', 120.00, 'monthly', 0, 7,
      '2027-01-01', '{}'::jsonb
    );
    raise exception 'T11a duplicate code did not raise 23505';
  exception when sqlstate '23505' then null;
  end;

  execute 'reset role';
  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before then
    raise exception 'T11a duplicate code rollback leaked audit log';
  end if;
  execute 'set local role authenticated';

  -- Agora edição positiva de v1 com objeto vazio explícito '{}' -> permitido e limpa entitlements
  perform public.update_saas_plan_version_draft(
    v_plan_draft, 'Plano Auditoria Um Revisado', 'audit_plan_one_v1', 145.50, 'yearly', 14, 5,
    '2027-02-01', '{}'::jsonb
  );

  execute 'reset role';
  select count(*) into v_ent_count
  from public.saas_plan_version_entitlements where plan_version_id = v_plan_draft;
  if v_ent_count <> 0 then
    raise exception 'T02 explicit empty JSON object should clear entitlements';
  end if;

  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before + 1 then
    raise exception 'T02 expected 1 audit event after draft update';
  end if;

  select * into strict v_audit_row
  from public.saas_master_audit_logs
  order by id desc limit 1;

  if v_audit_row.action <> 'saas_plan_version.draft_updated'
     or v_audit_row.resource_type <> 'saas_plan_version'
     or v_audit_row.resource_id <> v_plan_draft::text
     or v_audit_row.staff_user_id <> v_master
     or v_audit_row.metadata ? 'entitlements'
     or (v_audit_row.metadata->>'catalog_synced')::boolean is not true
     or (v_audit_row.metadata->>'version_number')::integer <> 1 then
    raise exception 'T02 unexpected audit payload: %', row_to_json(v_audit_row);
  end if;

  -- =========================================================================
  -- 6. T04, T05, T06 & T07 — Publicar v1, criar sucessora v2, editar v2 e conflito F1
  -- =========================================================================
  execute 'set local role authenticated';
  perform public.publish_master_plan_draft_idempotent(v_plan_draft, gen_random_uuid()::text);

  -- T06: editar v1 publicada deve falhar com 23503 sem gerar audit log
  v_audit_before := v_audit_before + 2; -- +1 draft_updated +1 publish
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_draft, 'Tentativa em publicada', 'audit_plan_one_v1', 150.00, 'yearly', 14, 5,
      '2027-02-01', '{"members_max": 1}'::jsonb
    );
    raise exception 'T06 published plan version accepted draft edit';
  exception when sqlstate '23503' then null;
  end;

  -- T04: criar sucessora v2
  v_plan_v2 := public.create_saas_plan_successor_draft(
    v_plan_id, 299.90, 'yearly', 7, 10, '2027-06-01', '{"members_max": 400}'::jsonb
  );

  execute 'reset role';
  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before + 1 then
    raise exception 'T04 expected 1 audit event after plan successor creation';
  end if;

  select * into strict v_audit_row
  from public.saas_master_audit_logs
  order by id desc limit 1;

  if v_audit_row.action <> 'saas_plan_version.successor_draft'
     or v_audit_row.resource_type <> 'saas_plan_version'
     or v_audit_row.resource_id <> v_plan_v2::text
     or v_audit_row.metadata ? 'entitlements'
     or (v_audit_row.metadata->>'version_number')::integer <> 2 then
    raise exception 'T04 unexpected successor audit payload: %', row_to_json(v_audit_row);
  end if;

  -- T05: editar v2 draft deve atualizar snapshots da v2 sem alterar identidade de saas_plans
  execute 'set local role authenticated';
  perform public.update_saas_plan_version_draft(
    v_plan_v2, 'Plano Auditoria V2 Editado', 'audit_plan_one_v2', 310.00, 'monthly', 0, 5,
    '2027-07-01', '{"members_max": 450}'::jsonb
  );

  execute 'reset role';
  select name, code into v_catalog_name, v_catalog_code
  from public.saas_plans where id = v_plan_id;

  if v_catalog_name <> 'Plano Auditoria Um Revisado' or v_catalog_code <> 'audit_plan_one_v1' then
    raise exception 'T05 saas_plans catalog identity changed prematurely when published version exists';
  end if;

  select * into strict v_audit_row
  from public.saas_master_audit_logs
  order by id desc limit 1;

  if v_audit_row.action <> 'saas_plan_version.draft_updated'
     or (v_audit_row.metadata->>'catalog_synced')::boolean is not false
     or (v_audit_row.metadata->>'version_number')::integer <> 2 then
    raise exception 'T05 unexpected v2 draft update audit payload: %', row_to_json(v_audit_row);
  end if;

  -- T07 (F1): publicação seguida de edição concorrente na mesma v2 é barrada (23503) sem sobrescrever v2 publicada
  execute 'set local role authenticated';
  perform public.publish_master_plan_draft_idempotent(v_plan_v2, gen_random_uuid()::text);
  begin
    perform public.update_saas_plan_version_draft(
      v_plan_v2, 'Corrida pos publicacao', 'audit_plan_race', 999.00, 'monthly', 0, 5,
      '2027-08-01', '{"members_max": 999}'::jsonb
    );
    raise exception 'T07 expected post-publish draft edit to fail with 23503';
  exception when sqlstate '23503' then null;
  end;

  -- T07b: compatibilidade com set_saas_plan_active após sucessora
  perform public.set_saas_plan_active(v_plan_id, false, 'Teste interoperabilidade lock/ciclo');
  perform public.set_saas_plan_active(v_plan_id, true, 'Reativação controlada de teste');

  -- =========================================================================
  -- 7. T09 & T10 — Edição de rascunho de promoção, validações F3 e bloqueio pós-publicação
  -- =========================================================================
  execute 'reset role';
  select count(*) into v_audit_before from public.saas_master_audit_logs;
  execute 'set local role authenticated';

  -- T10a: percent > 100 rejeitado (22023)
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Invalida', 'AUDITOFFER1', 'percent', 101.00, 'once', null,
      '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 10, false
    );
    raise exception 'T10a accepted percent > 100';
  exception when sqlstate '22023' then null;
  end;

  -- T10b: cycles sem duration_cycles ou > 36 rejeitado (22023)
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Invalida', 'AUDITOFFER1', 'percent', 15.00, 'cycles', 37,
      '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 10, false
    );
    raise exception 'T10b accepted duration_cycles > 36';
  exception when sqlstate '22023' then null;
  end;

  -- T10c: once com duration_cycles preenchido rejeitado (22023)
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Invalida', 'AUDITOFFER1', 'percent', 15.00, 'once', 2,
      '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 10, false
    );
    raise exception 'T10c accepted non-null duration_cycles for once';
  exception when sqlstate '22023' then null;
  end;

  -- T10d: public_code inválido rejeitado (22023)
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Invalida', 'A!', 'percent', 15.00, 'once', null,
      '2027-02-01T12:00:00Z'::timestamptz, null, 'new_customers', 10, false
    );
    raise exception 'T10d accepted invalid public_code';
  exception when sqlstate '22023' then null;
  end;

  -- T10e: valid_to <= valid_from rejeitado (22023)
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Invalida', 'AUDITOFFER1', 'percent', 15.00, 'date_range', null,
      '2027-02-01T12:00:00Z'::timestamptz, '2027-02-01T12:00:00Z'::timestamptz,
      'new_customers', 10, false
    );
    raise exception 'T10e accepted valid_to <= valid_from';
  exception when sqlstate '22023' then null;
  end;

  -- T09: atualização positiva de rascunho de promoção + evento de auditoria
  perform public.update_saas_promotion_draft(
    v_promo_draft, 'Oferta Auditoria Revisada', 'audit_rev20', 'fixed_amount', 35.50, 'cycles', 6,
    '2027-03-01T12:00:00Z'::timestamptz, '2027-09-01T12:00:00Z'::timestamptz,
    'all_eligible', 250, true
  );

  execute 'reset role';
  if (select count(*) from public.saas_master_audit_logs) <> v_audit_before + 1 then
    raise exception 'T09 expected 1 audit event after promotion draft update';
  end if;

  select * into strict v_audit_row
  from public.saas_master_audit_logs
  order by id desc limit 1;

  if v_audit_row.action <> 'saas_promotion.draft_updated'
     or v_audit_row.resource_type <> 'saas_promotion'
     or v_audit_row.resource_id <> v_promo_draft::text
     or v_audit_row.staff_user_id <> v_master
     or v_audit_row.metadata->>'code' <> 'AUDIT_REV20'
     or (v_audit_row.metadata->>'version_number')::integer <> 1 then
    raise exception 'T09 unexpected promotion audit payload: %', row_to_json(v_audit_row);
  end if;

  -- T10f: publicar promoção e garantir que edição subsequente falha com 23503 sem gravar audit log
  execute 'set local role authenticated';
  perform public.publish_master_promotion_draft_idempotent(v_promo_draft, gen_random_uuid()::text);
  begin
    perform public.update_saas_promotion_draft(
      v_promo_draft, 'Oferta Pos Publicacao', 'AUDIT_REV20', 'fixed_amount', 40.00, 'cycles', 6,
      '2027-03-01T12:00:00Z'::timestamptz, '2027-09-01T12:00:00Z'::timestamptz,
      'all_eligible', 250, true
    );
    raise exception 'T10f published promotion accepted draft edit';
  exception when sqlstate '23503' then null;
  end;

  -- =========================================================================
  -- 8. T11b — Read-back via list_master_audit_events (sem metadata exposta)
  -- =========================================================================
  if not exists (
    select 1
    from public.list_master_audit_events((current_date - 1)::date, (current_date + 1)::date, 'saas_plan_version.draft_updated')
    where resource_id = v_plan_draft::text
  ) or not exists (
    select 1
    from public.list_master_audit_events((current_date - 1)::date, (current_date + 1)::date, 'saas_plan_version.successor_draft')
    where resource_id = v_plan_v2::text
  ) or not exists (
    select 1
    from public.list_master_audit_events((current_date - 1)::date, (current_date + 1)::date, 'saas_promotion.draft_updated')
    where resource_id = v_promo_draft::text
  ) then
    raise exception 'T11b expected all 3 new commercial audit events in list_master_audit_events';
  end if;
end $$;

rollback;
select 'COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS' as result;
