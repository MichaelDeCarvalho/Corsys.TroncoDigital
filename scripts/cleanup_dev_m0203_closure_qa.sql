-- CorSys Tronco Digital V35 — M02.03 Isolated DEV Closure Cleanup
-- Target ONLY: Supabase DEV (szqkdekwhzxsoxorgvaz), exact round_id and organization_id created by prepare_dev_m0203_closure_qa.sql.
-- Revokes ALL and ONLY user_roles created in the specified round (including ADMIN) and proves absence.
-- Preserves preexisting drafts (expense_approval_policies/accounting_plans), accounting trail, ledger, charges, payments and audit entries.
-- Default is dry-run ROLLBACK; replace final ROLLBACK with COMMIT after review.

create temp table if not exists pg_temp._m0203_cleanup_ctx (
  round_id text not null,
  raw_organization_id text not null,
  organization_id uuid,
  project_ref text not null,
  env_ack text not null,
  dev_anchor_count integer not null,
  expected_roles jsonb not null,
  prior_cleanup_count integer not null,
  pre_existing_round_roles integer not null,
  created_at timestamptz not null default now()
) on commit preserve rows;

truncate table pg_temp._m0203_cleanup_ctx;

insert into pg_temp._m0203_cleanup_ctx (
  round_id,
  raw_organization_id,
  organization_id,
  project_ref,
  env_ack,
  dev_anchor_count,
  expected_roles,
  prior_cleanup_count,
  pre_existing_round_roles
)
select
  p.round_id,
  p.raw_organization_id,
  p.org_id,
  p.project_ref,
  p.env_ack,
  (
    select count(*)::integer
    from public.organizations o
    join public.saas_subscriptions s on s.organization_id = o.id and s.status = 'active'
    join public.saas_plans sp on sp.id = s.plan_id and sp.price = 0
    join public.saas_plan_versions sv on sv.id = s.plan_version_id and sv.price = 0
    where (o.id = 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid and o.name = 'CORSYS DEV TENANT A')
       or (o.id = 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid and o.name = 'CORSYS DEV TENANT B')
  ),
  coalesce(prep.expected_roles, '[]'::jsonb),
  coalesce(prior_cln.cnt, 0),
  coalesce(pre_ur.cnt, 0)
from (
  select
    upper(btrim('REPLACE_ROUND_ID'::text)) as round_id,
    btrim('REPLACE_ORGANIZATION_UUID'::text) as raw_organization_id,
    case
      when btrim('REPLACE_ORGANIZATION_UUID'::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then btrim('REPLACE_ORGANIZATION_UUID'::text)::uuid
      else null
    end as org_id,
    lower(btrim('REPLACE_PROJECT_REF'::text)) as project_ref,
    upper(btrim('REPLACE_DEV_ONLY'::text)) as env_ack
) p
left join lateral (
  select a.after_data -> 'created_user_roles' as expected_roles
  from public.audit_logs a
  where p.org_id is not null
    and a.organization_id = p.org_id
    and a.action = 'dev_qa.m0203_closure_prepare'
    and a.entity_type = 'organization'
    and a.entity_id = p.org_id
    and upper(coalesce(a.after_data ->> 'round_id', '')) = p.round_id
  order by a.created_at desc
  limit 1
) prep on true
left join lateral (
  select count(*)::integer as cnt
  from public.audit_logs a
  where p.org_id is not null
    and a.organization_id = p.org_id
    and a.action = 'dev_qa.m0203_closure_cleanup'
    and a.entity_type = 'organization'
    and a.entity_id = p.org_id
    and upper(coalesce(a.after_data ->> 'round_id', '')) = p.round_id
) prior_cln on true
left join lateral (
  select count(*)::integer as cnt
  from public.user_roles ur
  join jsonb_to_recordset(coalesce(prep.expected_roles, '[]'::jsonb)) as tr(
    organization_id uuid,
    user_id uuid,
    role_id uuid,
    role_code text
  )
    on ur.organization_id = tr.organization_id
   and ur.user_id = tr.user_id
   and ur.role_id = tr.role_id
  where p.org_id is not null
    and ur.organization_id = p.org_id
) pre_ur on true;

begin;

create temp table if not exists pg_temp._m0203_cleanup_tx (
  round_id text not null,
  organization_id uuid not null,
  cleanup_mode text not null,
  revoked_count integer not null,
  remaining_round_roles integer not null,
  revoked_user_roles jsonb not null
) on commit drop;

do $$
declare
  v_ctx pg_temp._m0203_cleanup_ctx%rowtype;
  v_org uuid;
  v_org_name text;
  v_revoked_roles jsonb := '[]'::jsonb;
  v_revoked_count integer := 0;
  v_remaining_after_count integer := 0;
  v_cleanup_mode text;
begin
  select * into strict v_ctx from pg_temp._m0203_cleanup_ctx limit 1;

  if v_ctx.project_ref <> 'szqkdekwhzxsoxorgvaz' or v_ctx.env_ack <> 'DEV_ONLY' then
    raise exception 'Ambiente nao autorizado: confirme externamente project_ref = szqkdekwhzxsoxorgvaz e env_ack = DEV_ONLY';
  end if;

  if current_database() <> 'postgres' then
    raise exception 'Banco inesperado (%): esperado postgres do DEV szqkdekwhzxsoxorgvaz', current_database();
  end if;

  if v_ctx.dev_anchor_count <> 2 then
    raise exception 'Identidade DEV nao confirmada no PostgreSQL (ancoras CORSYS DEV TENANT A/B gratuitas encontradas=%). Cleanup bloqueado.', v_ctx.dev_anchor_count;
  end if;

  if v_ctx.round_id = '' or v_ctx.round_id = 'REPLACE_ROUND_ID' then
    raise exception 'Informe round_id da rodada retornado pelo setup';
  end if;

  if v_ctx.organization_id is null then
    raise exception 'Informe raw_organization_id com o UUID valido da Loja retornado pelo setup (recebido=%)', v_ctx.raw_organization_id;
  end if;
  v_org := v_ctx.organization_id;

  select name into v_org_name
  from public.organizations
  where id = v_org;

  if v_org_name is null then
    raise exception 'Loja % nao encontrada', v_org;
  end if;

  if left(v_org_name, 11) <> 'QA_CLOSURE_' then
    raise exception 'Recusado: Loja % (%) nao pertence ao prefixo isolado QA_CLOSURE_*', v_org_name, v_org;
  end if;

  if v_ctx.expected_roles is null or jsonb_typeof(v_ctx.expected_roles) <> 'array' or jsonb_array_length(v_ctx.expected_roles) = 0 then
    raise exception 'Registro dev_qa.m0203_closure_prepare nao encontrado para a rodada % na Loja %', v_ctx.round_id, v_org;
  end if;

  -- Revoke ALL and ONLY the exact user_roles bindings created by this round (including ADMIN).
  -- Preexisting drafts (expense_approval_policies, accounting_plans) and accounting/audit trail remain untouched.
  with target_roles as (
    select
      (elem ->> 'organization_id')::uuid as organization_id,
      (elem ->> 'user_id')::uuid as user_id,
      (elem ->> 'role_id')::uuid as role_id,
      elem ->> 'role_code' as role_code
    from jsonb_array_elements(v_ctx.expected_roles) as elem
  ),
  deleted_roles as (
    delete from public.user_roles ur
    using target_roles tr
    where ur.organization_id = v_org
      and ur.organization_id = tr.organization_id
      and ur.user_id = tr.user_id
      and ur.role_id = tr.role_id
    returning ur.organization_id, ur.user_id, ur.role_id, tr.role_code
  )
  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'organization_id', dr.organization_id,
          'user_id', dr.user_id,
          'role_id', dr.role_id,
          'role_code', dr.role_code
        )
        order by dr.role_code, dr.user_id
      ),
      '[]'::jsonb
    )
  into v_revoked_count, v_revoked_roles
  from deleted_roles dr;

  -- Confirm exact absence of all round bindings (including ADMIN) after deletion.
  select count(*)::integer into v_remaining_after_count
  from public.user_roles ur
  join jsonb_to_recordset(v_ctx.expected_roles) as tr(
    organization_id uuid,
    user_id uuid,
    role_id uuid,
    role_code text
  )
    on ur.organization_id = tr.organization_id
   and ur.user_id = tr.user_id
   and ur.role_id = tr.role_id
  where ur.organization_id = v_org;

  if v_remaining_after_count <> 0 then
    raise exception 'Falha no cleanup: % vinculo(s) da rodada % ainda permanecem em user_roles', v_remaining_after_count, v_ctx.round_id;
  end if;

  if v_revoked_count > 0 and v_ctx.prior_cleanup_count = 0 then
    v_cleanup_mode := 'INITIAL_CLEANUP';
  elsif v_revoked_count = 0 and v_ctx.prior_cleanup_count > 0 then
    v_cleanup_mode := 'IDEMPOTENT_RERUN';
  elsif v_revoked_count > 0 and v_ctx.prior_cleanup_count > 0 then
    v_cleanup_mode := 'PARTIAL_REMAINING_REVOKED';
  else
    raise exception 'Nenhum vinculo da rodada % ativo e nenhum cleanup anterior registrado para a Loja %', v_ctx.round_id, v_org;
  end if;

  insert into public.audit_logs (
    organization_id, action, entity_type, entity_id, after_data, reason
  )
  values (
    v_org,
    'dev_qa.m0203_closure_cleanup',
    'organization',
    v_org,
    jsonb_build_object(
      'round_id', v_ctx.round_id,
      'organization_id', v_org,
      'cleanup_mode', v_cleanup_mode,
      'expected_round_roles', v_ctx.expected_roles,
      'revoked_user_roles', v_revoked_roles,
      'revoked_count', v_revoked_count,
      'remaining_round_roles', v_remaining_after_count,
      'preserved_preexisting_drafts', true,
      'preserved_accounting_trail', true
    ),
    'Cleanup M02.03 closure QA round ' || v_ctx.round_id || ' (' || v_cleanup_mode || '): revoked exact round bindings (including ADMIN); preserved preexisting drafts and accounting trail'
  );

  insert into pg_temp._m0203_cleanup_tx (
    round_id, organization_id, cleanup_mode, revoked_count, remaining_round_roles, revoked_user_roles
  )
  values (
    v_ctx.round_id, v_org, v_cleanup_mode, v_revoked_count, v_remaining_after_count, v_revoked_roles
  );

  raise notice 'M0203_CLEANUP round_id=% organization_id=% mode=% revoked_count=% remaining_round_roles=% revoked_user_roles=%',
    v_ctx.round_id, v_org, v_cleanup_mode, v_revoked_count, v_remaining_after_count, v_revoked_roles;
end $$;

select
  'PRE_TRANSACTION_END' as phase,
  round_id,
  organization_id,
  cleanup_mode,
  revoked_count,
  remaining_round_roles,
  revoked_user_roles
from pg_temp._m0203_cleanup_tx;

rollback; -- Padrao DRY-RUN. Somente para persistir no DEV autorizado, substitua por: commit;

select
  case
    when count(c.*) = 0 then 'NO_EVIDENCE'
    when bool_or(
      c.project_ref <> 'szqkdekwhzxsoxorgvaz'
      or c.env_ack <> 'DEV_ONLY'
      or current_database() <> 'postgres'
      or c.dev_anchor_count <> 2
      or c.round_id in ('', 'REPLACE_ROUND_ID')
      or c.organization_id is null
      or jsonb_typeof(c.expected_roles) <> 'array'
      or jsonb_array_length(c.expected_roles) = 0
    ) then 'FAILED_PRECONDITION_OR_ENV'
    when max(post_cln.cnt) > max(c.prior_cleanup_count) then
      case
        when max(post_ur.cnt) > 0 then 'FAILED_ROLES_STILL_PRESENT'
        when max(c.prior_cleanup_count) = 0 and max(c.pre_existing_round_roles) > 0 then 'COMMITTED_INITIAL_CLEANUP'
        else 'COMMITTED_IDEMPOTENT_RERUN'
      end
    when max(post_cln.cnt) = max(c.prior_cleanup_count) then
      case
        when max(c.prior_cleanup_count) = 0 and max(c.pre_existing_round_roles) > 0 then 'DRY_RUN_ROLLED_BACK_INITIAL'
        when max(c.prior_cleanup_count) > 0 and max(post_ur.cnt) = 0 then 'DRY_RUN_ROLLED_BACK_IDEMPOTENT'
        else 'FAILED_UNEXPECTED_STATE'
      end
    else 'FAILED_UNEXPECTED_STATE'
  end as execution_status,
  max(c.round_id) as round_id,
  max(c.organization_id::text)::uuid as organization_id,
  max(c.pre_existing_round_roles) as round_roles_before,
  max(post_ur.cnt) as round_roles_remaining_after,
  max(c.prior_cleanup_count) as cleanup_audits_before,
  max(post_cln.cnt) as cleanup_audits_after,
  coalesce((array_agg(c.expected_roles))[1], '[]'::jsonb) as expected_round_roles
from pg_temp._m0203_cleanup_ctx c
left join lateral (
  select count(*)::integer as cnt
  from public.audit_logs a
  where c.organization_id is not null
    and a.organization_id = c.organization_id
    and a.action = 'dev_qa.m0203_closure_cleanup'
    and a.entity_type = 'organization'
    and a.entity_id = c.organization_id
    and upper(coalesce(a.after_data ->> 'round_id', '')) = c.round_id
) post_cln on true
left join lateral (
  select count(*)::integer as cnt
  from public.user_roles ur
  join jsonb_to_recordset(coalesce(c.expected_roles, '[]'::jsonb)) as tr(
    organization_id uuid,
    user_id uuid,
    role_id uuid,
    role_code text
  )
    on ur.organization_id = tr.organization_id
   and ur.user_id = tr.user_id
   and ur.role_id = tr.role_id
  where c.organization_id is not null
    and ur.organization_id = c.organization_id
) post_ur on true;
