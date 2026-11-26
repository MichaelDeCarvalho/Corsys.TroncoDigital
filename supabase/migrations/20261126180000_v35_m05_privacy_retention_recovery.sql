begin;

-- ============================================================================
-- Migration: 20261126180000_v35_m05_privacy_retention_recovery.sql
-- ADR-0055: M05 — Privacidade, Portabilidade, Retenção, Backup/Restore,
--                 Recuperação de Acesso e Segurança Operacional (D01-D06)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Private Helpers (Self-contained SHA-256, Idempotency & Business Days)
-- ----------------------------------------------------------------------------

create or replace function private.m05_sha256_hex(p_input text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(pg_catalog.sha256(convert_to(coalesce(p_input, ''), 'utf8')), 'hex');
$$;

revoke all on function private.m05_sha256_hex(text) from public, anon, authenticated;

create or replace function private.add_business_days(
  p_start timestamptz,
  p_days integer
)
returns timestamptz
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_local_date date := (p_start at time zone 'America/Sao_Paulo')::date;
  v_local_time time := (p_start at time zone 'America/Sao_Paulo')::time;
  v_added integer := 0;
begin
  if p_days is null or p_days < 0 then
    raise exception 'business days must be non-negative' using errcode = '22023';
  end if;

  while v_added < p_days loop
    v_local_date := v_local_date + 1;
    if extract(isodow from v_local_date) not in (6, 7) then
      v_added := v_added + 1;
    end if;
  end loop;

  return ((v_local_date::timestamp + v_local_time) at time zone 'America/Sao_Paulo');
end;
$$;

revoke all on function private.add_business_days(timestamptz, integer) from public, anon, authenticated;

create table if not exists private.m05_idempotency_keys (
  scope_key text not null,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  operation text not null check (length(btrim(operation)) > 0),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (scope_key, actor_user_id, idempotency_key),
  check (
    (result_json is null and completed_at is null)
    or (result_json is not null and completed_at is not null)
  )
);

revoke all on table private.m05_idempotency_keys from public, anon, authenticated;

create or replace function private.m05_idempotency_begin(
  p_scope_key text,
  p_operation text,
  p_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_hash text := private.m05_sha256_hex(coalesce(p_payload::text, '{}'));
  v_existing private.m05_idempotency_keys%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_key is null or length(btrim(p_key)) not between 1 and 200 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  insert into private.m05_idempotency_keys (
    scope_key, actor_user_id, idempotency_key, operation, payload_hash
  ) values (
    p_scope_key, v_user_id, btrim(p_key), p_operation, v_hash
  )
  on conflict (scope_key, actor_user_id, idempotency_key) do nothing;

  select * into v_existing
  from private.m05_idempotency_keys
  where scope_key = p_scope_key
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_key)
  for update;

  if v_existing.operation <> p_operation or v_existing.payload_hash <> v_hash then
    raise exception 'idempotency key conflict with different payload' using errcode = 'PT409';
  end if;

  return v_existing.result_json;
end;
$$;

revoke all on function private.m05_idempotency_begin(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.m05_idempotency_complete(
  p_scope_key text,
  p_key text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  update private.m05_idempotency_keys
  set result_json = p_result,
      completed_at = clock_timestamp()
  where scope_key = p_scope_key
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_key);
end;
$$;

revoke all on function private.m05_idempotency_complete(text, text, jsonb) from public, anon, authenticated;

create or replace function private.m05_has_secret_pattern(p_text text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(p_text, '') ~* '(password|senha|token|secret|jwt|otp|bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sb_secret_[a-zA-Z0-9_-]+)';
$$;

revoke all on function private.m05_has_secret_pattern(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. Entrega C — Retenção & Encerramento Contratual (D01 / D03)
-- ----------------------------------------------------------------------------

create table if not exists public.tenant_retention_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_category text not null
    check (data_category in ('financial_ledger', 'access_logs', 'operational_logs', 'cadastral', 'attachments', 'all')),
  hold_reason text not null check (length(btrim(hold_reason)) between 5 and 500),
  legal_reference text not null check (length(btrim(legal_reference)) between 3 and 200),
  hold_status text not null default 'active' check (hold_status in ('active', 'released')),
  placed_by_user_id uuid not null references auth.users(id),
  released_by_user_id uuid references auth.users(id),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text check (release_reason is null or length(btrim(release_reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (hold_status = 'active' and released_at is null and released_by_user_id is null)
    or (hold_status = 'released' and released_at is not null and released_by_user_id is not null and release_reason is not null)
  )
);

create index if not exists tenant_retention_holds_org_idx
  on public.tenant_retention_holds (organization_id, hold_status, placed_at desc);

create trigger tenant_retention_holds_set_updated_at
  before update on public.tenant_retention_holds
  for each row execute function private.set_updated_at();

revoke all on table public.tenant_retention_holds from public, anon, authenticated;
alter table public.tenant_retention_holds enable row level security;
grant select on public.tenant_retention_holds to authenticated;

create policy tenant_retention_holds_select
  on public.tenant_retention_holds
  for select to authenticated
  using (
    private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT')
    or private.has_permission(organization_id, 'settings.manage')
    or private.has_permission(organization_id, 'audit.read')
  );

create or replace function private.m05_retention_snapshot(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.saas_subscriptions%rowtype;
  v_write_allowed boolean;
  v_export_window_ends timestamptz;
  v_phase text := 'active_operations';
  v_export_allowed boolean := true;
  v_active_holds integer := 0;
begin
  select s.* into v_sub
  from public.saas_subscriptions s
  where s.organization_id = p_organization_id
  order by s.created_at desc
  limit 1;

  v_write_allowed := private.tenant_write_allowed(p_organization_id);

  if v_sub.id is null then
    v_phase := 'no_subscription_restricted';
    v_export_allowed := true;
  elsif v_sub.status = 'canceled' then
    v_export_window_ends := coalesce(v_sub.canceled_at, v_sub.updated_at, v_sub.created_at) + interval '90 days';
    if clock_timestamp() <= v_export_window_ends then
      v_phase := 'post_cancel_export_window';
      v_export_allowed := true;
    else
      v_phase := 'archived_restricted';
      v_export_allowed := false;
    end if;
  elsif v_sub.status = 'cancel_scheduled' then
    if v_sub.current_period_end is not null then
      v_export_window_ends := (v_sub.current_period_end::timestamptz + interval '90 days');
      if current_date > v_sub.current_period_end then
        if clock_timestamp() <= v_export_window_ends then
          v_phase := 'post_cancel_export_window';
          v_export_allowed := true;
        else
          v_phase := 'archived_restricted';
          v_export_allowed := false;
        end if;
      else
        v_phase := 'suspended_export_allowed';
        v_export_allowed := true;
      end if;
    else
      v_phase := 'suspended_export_allowed';
      v_export_allowed := true;
    end if;
  elsif v_sub.status = 'suspended' or not v_write_allowed then
    v_phase := 'suspended_export_allowed';
    v_export_allowed := true;
  end if;

  select count(*) into v_active_holds
  from public.tenant_retention_holds h
  where h.organization_id = p_organization_id
    and h.hold_status = 'active';

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'subscription_status', coalesce(v_sub.status, 'none'),
    'canceled_at', v_sub.canceled_at,
    'current_period_end', v_sub.current_period_end,
    'write_allowed', v_write_allowed,
    'export_allowed', v_export_allowed,
    'export_window_ends_at', v_export_window_ends,
    'retention_phase', v_phase,
    'legal_hold_active', v_active_holds > 0,
    'active_holds_count', v_active_holds,
    'auto_purge_enabled', false,
    'deletion_requires_controller_order', true,
    'schedule', jsonb_build_array(
      jsonb_build_object(
        'category', 'financial_ledger',
        'retention_label', '5 anos (piso contratual após encerramento do exercício)',
        'legal_note', 'Sujeito a prazo maior e parecer contábil/fiscal formal; sem eliminação automática.'
      ),
      jsonb_build_object(
        'category', 'access_logs',
        'retention_label', '6 meses (proposta inicial)',
        'legal_note', 'Sujeito ao enquadramento legal aplicável.'
      ),
      jsonb_build_object(
        'category', 'operational_logs',
        'retention_label', '90 dias',
        'legal_note', 'Logs operacionais técnicos não essenciais à guarda contábil.'
      ),
      jsonb_build_object(
        'category', 'post_cancellation_export_window',
        'retention_label', '90 dias após cancelamento',
        'legal_note', 'Leitura e portabilidade autenticadas sem novas gravações financeiras; após 90 dias, arquivo com acesso restrito.'
      )
    )
  );
end;
$$;

revoke all on function private.m05_retention_snapshot(uuid) from public, anon, authenticated;

create or replace function public.read_tenant_retention_posture(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_snapshot jsonb;
  v_holds jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;
  if not (
    private.is_platform_staff('MASTER')
    or private.is_platform_staff('SUPPORT')
    or private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'reports.export')
    or private.has_permission(p_organization_id, 'audit.read')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;

  v_snapshot := private.m05_retention_snapshot(p_organization_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', h.id,
      'data_category', h.data_category,
      'hold_reason', h.hold_reason,
      'legal_reference', h.legal_reference,
      'hold_status', h.hold_status,
      'placed_at', h.placed_at,
      'released_at', h.released_at,
      'release_reason', h.release_reason
    )
    order by h.placed_at desc
  ), '[]'::jsonb)
  into v_holds
  from public.tenant_retention_holds h
  where h.organization_id = p_organization_id;

  return v_snapshot || jsonb_build_object('holds', v_holds);
end;
$$;

revoke all on function public.read_tenant_retention_posture(uuid) from public, anon;
grant execute on function public.read_tenant_retention_posture(uuid) to authenticated;

create or replace function public.place_tenant_legal_hold_idempotent(
  p_organization_id uuid,
  p_data_category text,
  p_hold_reason text,
  p_legal_reference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_hold_id uuid;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (
    private.is_platform_staff('MASTER')
    or private.has_permission(p_organization_id, 'settings.manage')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;
  if p_data_category not in ('financial_ledger', 'access_logs', 'operational_logs', 'cadastral', 'attachments', 'all') then
    raise exception 'invalid data category' using errcode = '22023';
  end if;
  if p_hold_reason is null or length(btrim(p_hold_reason)) not between 5 and 500 or private.m05_has_secret_pattern(p_hold_reason) then
    raise exception 'invalid hold reason' using errcode = '22023';
  end if;
  if p_legal_reference is null or length(btrim(p_legal_reference)) not between 3 and 200 then
    raise exception 'invalid legal reference' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'place_tenant_legal_hold',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'data_category', p_data_category,
      'hold_reason', btrim(p_hold_reason),
      'legal_reference', btrim(p_legal_reference)
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.tenant_retention_holds (
    organization_id, data_category, hold_reason, legal_reference, hold_status, placed_by_user_id
  ) values (
    p_organization_id, p_data_category, btrim(p_hold_reason), btrim(p_legal_reference), 'active', v_user
  )
  returning id into v_hold_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.legal_hold_placed',
    'tenant_retention_holds',
    v_hold_id,
    jsonb_build_object('data_category', p_data_category, 'legal_reference', btrim(p_legal_reference)),
    btrim(p_hold_reason)
  );

  if private.is_platform_staff('MASTER') then
    insert into public.saas_master_audit_logs (
      staff_user_id, organization_id, action, resource_type, resource_id, metadata
    ) values (
      v_user, p_organization_id, 'privacy.legal_hold_placed', 'tenant_retention_holds', v_hold_id::text,
      jsonb_build_object('data_category', p_data_category, 'legal_reference', btrim(p_legal_reference))
    );
  end if;

  v_result := jsonb_build_object(
    'hold_id', v_hold_id,
    'organization_id', p_organization_id,
    'data_category', p_data_category,
    'hold_status', 'active'
  );

  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.place_tenant_legal_hold_idempotent(uuid, text, text, text, text) from public, anon;
grant execute on function public.place_tenant_legal_hold_idempotent(uuid, text, text, text, text) to authenticated;

create or replace function public.release_tenant_legal_hold_idempotent(
  p_organization_id uuid,
  p_hold_id uuid,
  p_release_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_hold public.tenant_retention_holds%rowtype;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (
    private.is_platform_staff('MASTER')
    or private.has_permission(p_organization_id, 'settings.manage')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if p_release_reason is null or length(btrim(p_release_reason)) not between 3 and 500 or private.m05_has_secret_pattern(p_release_reason) then
    raise exception 'invalid release reason' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'release_tenant_legal_hold',
    p_idempotency_key,
    jsonb_build_object('organization_id', p_organization_id, 'hold_id', p_hold_id, 'release_reason', btrim(p_release_reason))
  );
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_hold
  from public.tenant_retention_holds
  where id = p_hold_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'legal hold not found' using errcode = '23503';
  end if;
  if v_hold.hold_status <> 'active' then
    raise exception 'legal hold already released' using errcode = 'PT409';
  end if;

  update public.tenant_retention_holds
  set hold_status = 'released',
      released_by_user_id = v_user,
      released_at = clock_timestamp(),
      release_reason = btrim(p_release_reason)
  where id = p_hold_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.legal_hold_released',
    'tenant_retention_holds',
    p_hold_id,
    jsonb_build_object('hold_status', 'active'),
    jsonb_build_object('hold_status', 'released'),
    btrim(p_release_reason)
  );

  if private.is_platform_staff('MASTER') then
    insert into public.saas_master_audit_logs (
      staff_user_id, organization_id, action, resource_type, resource_id, metadata
    ) values (
      v_user, p_organization_id, 'privacy.legal_hold_released', 'tenant_retention_holds', p_hold_id::text,
      jsonb_build_object('hold_status', 'released')
    );
  end if;

  v_result := jsonb_build_object(
    'hold_id', p_hold_id,
    'organization_id', p_organization_id,
    'hold_status', 'released'
  );
  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.release_tenant_legal_hold_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.release_tenant_legal_hold_idempotent(uuid, uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Entrega A — Portabilidade & Exportação (D02)
-- ----------------------------------------------------------------------------

create table if not exists public.tenant_portability_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id),
  export_scope text not null check (export_scope in ('organization_full', 'data_subject_package')),
  subject_member_id uuid,
  package_format text not null default 'json' check (package_format in ('json', 'csv')),
  status text not null check (status in ('ready', 'blocked_incomplete', 'expired')),
  retention_posture text not null,
  manifest jsonb not null,
  data_dictionary jsonb not null,
  payload_json jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  block_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (
    (export_scope = 'organization_full' and subject_member_id is null)
    or (export_scope = 'data_subject_package' and subject_member_id is not null)
  ),
  foreign key (organization_id, subject_member_id)
    references public.members(organization_id, id)
);

create index if not exists tenant_portability_exports_org_idx
  on public.tenant_portability_exports (organization_id, created_at desc);

revoke all on table public.tenant_portability_exports from public, anon, authenticated;
alter table public.tenant_portability_exports enable row level security;
grant select on public.tenant_portability_exports to authenticated;

create policy tenant_portability_exports_select
  on public.tenant_portability_exports
  for select to authenticated
  using (
    private.has_permission(organization_id, 'settings.manage')
    or private.has_permission(organization_id, 'reports.export')
    or (
      export_scope = 'data_subject_package'
      and subject_member_id is not null
      and private.is_self_member(organization_id, subject_member_id)
    )
  );

create table if not exists public.tenant_portability_downloads (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null,
  organization_id uuid not null,
  downloaded_by_user_id uuid not null references auth.users(id),
  downloaded_format text not null check (downloaded_format in ('json', 'csv')),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  downloaded_at timestamptz not null default now(),
  foreign key (organization_id, export_id)
    references public.tenant_portability_exports(organization_id, id)
);

create index if not exists tenant_portability_downloads_org_idx
  on public.tenant_portability_downloads (organization_id, export_id, downloaded_at desc);

create trigger tenant_portability_downloads_immutable
  before update or delete on public.tenant_portability_downloads
  for each row execute function private.prevent_financial_mutation();

revoke all on table public.tenant_portability_downloads from public, anon, authenticated;
alter table public.tenant_portability_downloads enable row level security;
grant select on public.tenant_portability_downloads to authenticated;

create policy tenant_portability_downloads_select
  on public.tenant_portability_downloads
  for select to authenticated
  using (
    private.has_permission(organization_id, 'settings.manage')
    or private.has_permission(organization_id, 'audit.read')
    or downloaded_by_user_id = (select auth.uid())
  );

create or replace function private.m05_portability_dictionary(p_scope text)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_scope = 'organization_full' then jsonb_build_object(
      'version', '2026.11-m06-consolidated',
      'scope', 'organization_full',
      'open_formats', jsonb_build_array('json', 'csv'),
      'monetary_convention', 'Valores em centavos inteiros (amount_cents) e decimal string BRL.',
      'attachments_distinction', 'O pacote portátil exporta o inventário de metadados e hashes SHA-256 dos anexos elegíveis (binary_files_included=false); não equivale ao download binário dos objetos do Storage privado.',
      'excluded_categories', jsonb_build_array('auth_credentials', 'secrets_and_tokens', 'cross_tenant_records', 'master_internal_tickets', 'master_internal_notes', 'master_audit_logs', 'storage_binary_blobs'),
      'datasets', jsonb_build_object(
        'organization', 'Identidade pública cadastral e fuso horário da Loja.',
        'members', 'Cadastro de integrantes vinculados à Loja (campos de contato e status).',
        'roles_and_permissions', 'Papéis e vínculos RBAC autorizados da Loja sem credenciais.',
        'financial_categories', 'Plano de categorias financeiras da Loja.',
        'financial_accounts', 'Contas financeiras da Loja sem credenciais bancárias ou segredos.',
        'payment_methods', 'Meios de pagamento cadastrados na Loja.',
        'financial_periods', 'Competências e períodos financeiros registrados na Loja.',
        'charges', 'Títulos e cobranças de integrantes com centavos exatos.',
        'charge_adjustments', 'Ajustes compensatórios de cobranças de integrantes.',
        'charge_cancellations', 'Cancelamentos compensatórios de cobranças de integrantes.',
        'payments', 'Pagamentos de integrantes recebidos pela Loja.',
        'payment_reversals', 'Estornos compensatórios de pagamentos de integrantes (M02).',
        'receivable_allocations', 'Alocações entre pagamentos/créditos e cobranças (FIFO/M02).',
        'allocation_reversals', 'Reversões compensatórias de alocações de recebíveis (M02).',
        'member_credits', 'Créditos de integrantes registrados na Loja.',
        'member_debt_agreements', 'Acordos de parcelamento de dívida de integrantes (M02).',
        'member_debt_agreement_items', 'Títulos originais consolidados nos acordos de integrantes (M02).',
        'member_debt_agreement_installments', 'Parcelas geradas pelos acordos de integrantes (M02).',
        'institutional_receivables', 'Recebíveis institucionais registrados na Loja.',
        'institutional_receivable_corrections', 'Correções compensatórias de recebíveis institucionais.',
        'institutional_receivable_cancellations', 'Cancelamentos de recebíveis institucionais.',
        'institutional_receipts', 'Recebimentos institucionais efetivados (M02).',
        'institutional_receipt_allocations', 'Alocações de recebimentos institucionais (M02).',
        'institutional_payables', 'Contas a pagar institucionais registradas na Loja.',
        'institutional_payable_corrections', 'Correções compensatórias de contas a pagar institucionais.',
        'institutional_payable_cancellations', 'Cancelamentos de contas a pagar institucionais.',
        'payable_approval_requests', 'Solicitações de alçada e aprovação de despesas.',
        'payable_approval_decisions', 'Decisões de aprovação de despesas por alçada.',
        'institutional_payable_payments', 'Pagamentos institucionais efetivados (M02).',
        'institutional_payable_payment_allocations', 'Alocações de pagamentos institucionais (M02).',
        'financial_account_transfers', 'Transferências internas entre contas financeiras da Loja.',
        'budget_cycles', 'Ciclos orçamentários da Loja.',
        'accounting_budget_lines', 'Linhas orçamentárias por conta contábil e período.',
        'bank_statement_imports', 'Lotes de extratos bancários importados para conciliação.',
        'bank_reconciliation_matches', 'Vínculos de conciliação bancária da Loja.',
        'accounting_plans', 'Planos de contas contábeis da Loja (M03).',
        'accounting_accounts', 'Contas contábeis sintéticas e analíticas da Loja (M03).',
        'accounting_plan_role_mappings', 'Mapeamentos contábeis governados para Diário, Razão e DRE Gerencial (M03).',
        'saas_subscriptions', 'Histórico de assinatura comercial da Loja na plataforma (M04).',
        'saas_subscription_price_terms', 'Vigências históricas de preço contratado da assinatura (M04).',
        'saas_scheduled_subscription_changes', 'Mudanças comerciais prospectivas agendadas para a Loja (M04).',
        'saas_invoices', 'Faturas SaaS emitidas para a Loja (M04).',
        'saas_invoice_items', 'Itens das faturas SaaS emitidas para a Loja (M04).',
        'saas_payment_agreements', 'Acordos comerciais de faturas SaaS celebrados com a Loja (M04).',
        'customer_support_tickets', 'Chamados de suporte do escopo da Loja (excluídos chamados internos Master — M04).',
        'customer_support_messages', 'Mensagens visíveis ao cliente nos chamados da Loja (excluídas notas internas Master — M04).',
        'tenant_retention_holds', 'Preservações legais ativas e históricas da Loja (M05).',
        'tenant_privacy_requests', 'Solicitações LGPD registradas no escopo da Loja (M05).',
        'eligible_attachments', 'Inventário de metadados e hashes SHA-256 de anexos elegíveis (sem binários embutidos).',
        'audit_logs', 'Trilha de auditoria do tenant sanitizada (sem payloads técnicos sensíveis).'
      )
    )
    else jsonb_build_object(
      'version', '2026.11-m06-consolidated',
      'scope', 'data_subject_package',
      'open_formats', jsonb_build_array('json', 'csv'),
      'monetary_convention', 'Valores em centavos inteiros (amount_cents) e decimal string BRL.',
      'attachments_distinction', 'Não inclui objetos binários do Storage privado.',
      'excluded_categories', jsonb_build_array('other_members_records', 'institutional_payables', 'auth_credentials', 'master_internal_tickets', 'master_internal_notes', 'cross_tenant_records', 'storage_binary_blobs'),
      'datasets', jsonb_build_object(
        'member_profile', 'Dados cadastrais do próprio titular na Loja.',
        'charges', 'Cobranças atribuídas exclusivamente ao titular.',
        'payments', 'Pagamentos atribuídos exclusivamente ao titular.',
        'receivable_allocations', 'Alocações vinculadas exclusivamente às cobranças/pagamentos do titular.',
        'member_credits', 'Créditos vinculados exclusivamente ao titular.',
        'member_debt_agreements', 'Acordos de parcelamento celebrados pelo titular (M02).',
        'member_debt_agreement_installments', 'Parcelas de acordos vinculadas ao titular (M02).',
        'tenant_privacy_requests', 'Solicitações LGPD vinculadas exclusivamente ao titular (M05).'
      )
    )
  end;
$$;

revoke all on function private.m05_portability_dictionary(text) from public, anon, authenticated;

create or replace function public.create_tenant_portability_export_idempotent(
  p_organization_id uuid,
  p_export_scope text,
  p_subject_member_id uuid,
  p_package_format text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_retention jsonb;
  v_posture text;
  v_export_id uuid;
  v_expires_at timestamptz;
  v_payload jsonb;
  v_dictionary jsonb;
  v_manifest jsonb;
  v_sha256 text;
  v_status text := 'ready';
  v_block_reason text := null;
  v_org jsonb;
  v_members jsonb := '[]'::jsonb;
  v_roles_perms jsonb := '[]'::jsonb;
  v_categories jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
  v_financial_periods jsonb := '[]'::jsonb;
  v_charges jsonb := '[]'::jsonb;
  v_charge_adjustments jsonb := '[]'::jsonb;
  v_charge_cancellations jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_payment_reversals jsonb := '[]'::jsonb;
  v_allocations jsonb := '[]'::jsonb;
  v_allocation_reversals jsonb := '[]'::jsonb;
  v_member_credits jsonb := '[]'::jsonb;
  v_agreements jsonb := '[]'::jsonb;
  v_agreement_items jsonb := '[]'::jsonb;
  v_agreement_installments jsonb := '[]'::jsonb;
  v_inst_receivables jsonb := '[]'::jsonb;
  v_inst_rec_corrections jsonb := '[]'::jsonb;
  v_inst_rec_cancellations jsonb := '[]'::jsonb;
  v_inst_receipts jsonb := '[]'::jsonb;
  v_inst_receipt_allocs jsonb := '[]'::jsonb;
  v_inst_payables jsonb := '[]'::jsonb;
  v_inst_pay_corrections jsonb := '[]'::jsonb;
  v_inst_pay_cancellations jsonb := '[]'::jsonb;
  v_payable_app_reqs jsonb := '[]'::jsonb;
  v_payable_app_decs jsonb := '[]'::jsonb;
  v_inst_pay_payments jsonb := '[]'::jsonb;
  v_inst_pay_allocs jsonb := '[]'::jsonb;
  v_account_transfers jsonb := '[]'::jsonb;
  v_budget_cycles jsonb := '[]'::jsonb;
  v_budget_lines jsonb := '[]'::jsonb;
  v_bank_imports jsonb := '[]'::jsonb;
  v_bank_matches jsonb := '[]'::jsonb;
  v_accounting_plans jsonb := '[]'::jsonb;
  v_accounting_accounts jsonb := '[]'::jsonb;
  v_accounting_role_mappings jsonb := '[]'::jsonb;
  v_saas_subscriptions jsonb := '[]'::jsonb;
  v_saas_price_terms jsonb := '[]'::jsonb;
  v_saas_scheduled_changes jsonb := '[]'::jsonb;
  v_saas_invoices jsonb := '[]'::jsonb;
  v_saas_invoice_items jsonb := '[]'::jsonb;
  v_saas_agreements jsonb := '[]'::jsonb;
  v_support_tickets jsonb := '[]'::jsonb;
  v_support_messages jsonb := '[]'::jsonb;
  v_retention_holds jsonb := '[]'::jsonb;
  v_privacy_requests jsonb := '[]'::jsonb;
  v_attachments jsonb := '[]'::jsonb;
  v_audit_logs jsonb := '[]'::jsonb;
  v_charges_cents bigint := 0;
  v_payments_cents bigint := 0;
  v_payables_cents bigint := 0;
  v_receivables_cents bigint := 0;
  v_alloc_cents bigint := 0;
  v_agreements_cents bigint := 0;
  v_saas_invoices_cents bigint := 0;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;
  if p_export_scope not in ('organization_full', 'data_subject_package') then
    raise exception 'invalid export scope' using errcode = '22023';
  end if;
  if coalesce(p_package_format, 'json') not in ('json', 'csv') then
    raise exception 'invalid package format' using errcode = '22023';
  end if;

  if p_export_scope = 'organization_full' and p_subject_member_id is not null then
    raise exception 'subject member id must be null for organization_full scope' using errcode = '22023';
  end if;
  if p_export_scope = 'data_subject_package' and p_subject_member_id is null then
    raise exception 'subject member id is required for data_subject_package scope' using errcode = '22023';
  end if;

  if p_export_scope = 'organization_full' then
    if not (
      private.has_permission(p_organization_id, 'settings.manage')
      or private.has_permission(p_organization_id, 'reports.export')
    ) then
      raise exception 'access denied for organization export' using errcode = '42501';
    end if;
  else
    if not (
      private.has_permission(p_organization_id, 'settings.manage')
      or private.has_permission(p_organization_id, 'members.read')
      or private.is_self_member(p_organization_id, p_subject_member_id)
    ) then
      raise exception 'access denied for data subject package' using errcode = '42501';
    end if;
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;
  if p_subject_member_id is not null and not exists (
    select 1 from public.members where organization_id = p_organization_id and id = p_subject_member_id
  ) then
    raise exception 'subject member not found in organization' using errcode = '23503';
  end if;

  v_retention := private.m05_retention_snapshot(p_organization_id);
  v_posture := v_retention->>'retention_phase';
  if not coalesce((v_retention->>'export_allowed')::boolean, false) then
    raise exception 'export window expired; tenant is in archived restricted retention' using errcode = '55000';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'create_tenant_portability_export',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'export_scope', p_export_scope,
      'subject_member_id', p_subject_member_id,
      'package_format', coalesce(p_package_format, 'json')
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  v_dictionary := private.m05_portability_dictionary(p_export_scope);
  v_expires_at := clock_timestamp() + interval '24 hours';

  if p_export_scope = 'organization_full' then
    select jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'number', o.number,
      'orient', o.orient,
      'obedience', o.obedience,
      'cnpj', o.cnpj,
      'status', o.status,
      'timezone', coalesce(os.timezone, 'America/Sao_Paulo')
    )
    into v_org
    from public.organizations o
    left join public.organization_settings os on os.organization_id = o.id
    where o.id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'preferred_name', m.preferred_name,
        'degree_or_office', m.degree_or_office,
        'initiation_date', m.initiation_date,
        'admission_date', m.admission_date,
        'cpf', m.cpf,
        'phone', m.phone,
        'whatsapp', m.whatsapp,
        'email', m.email,
        'status', m.status,
        'created_at', m.created_at
      )
      order by m.created_at asc, m.id asc
    ), '[]'::jsonb)
    into v_members
    from public.members m
    where m.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'role_id', r.id,
        'role_code', r.code,
        'role_name', r.name,
        'user_id', ur.user_id
      )
      order by r.code asc, ur.user_id asc
    ), '[]'::jsonb)
    into v_roles_perms
    from public.roles r
    left join public.user_roles ur
      on ur.organization_id = r.organization_id and ur.role_id = r.id
    where r.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'domain', c.domain,
        'active', c.active
      )
      order by c.display_order asc, c.id asc
    ), '[]'::jsonb)
    into v_categories
    from public.financial_categories c
    where c.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'institution', a.institution,
        'account_type', a.account_type,
        'active', a.active
      )
      order by a.created_at asc, a.id asc
    ), '[]'::jsonb)
    into v_accounts
    from public.financial_accounts a
    where a.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'name', pm.name,
        'active', pm.active
      )
      order by pm.created_at asc, pm.id asc
    ), '[]'::jsonb)
    into v_payment_methods
    from public.payment_methods pm
    where pm.organization_id = p_organization_id;

    if to_regclass('public.financial_periods') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'period', fp.period,
          'created_at', fp.created_at
        )
        order by fp.period asc, fp.id asc
      ), '[]'::jsonb)
      into v_financial_periods
      from public.financial_periods fp
      where fp.organization_id = p_organization_id;
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ch.id,
          'member_id', ch.member_id,
          'category_id', ch.category_id,
          'source_kind', ch.source_kind,
          'description', ch.description,
          'competence', ch.competence,
          'issue_date', ch.issue_date,
          'due_date', ch.due_date,
          'original_amount', ch.original_amount,
          'original_amount_cents', round(ch.original_amount * 100)::bigint
        )
        order by ch.issue_date asc, ch.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ch.original_amount * 100)::bigint), 0)
    into v_charges, v_charges_cents
    from public.charges ch
    where ch.organization_id = p_organization_id;

    if to_regclass('public.charge_adjustments') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ca.id,
          'member_id', ca.member_id,
          'charge_id', ca.charge_id,
          'direction', ca.direction,
          'adjustment_kind', ca.adjustment_kind,
          'amount', ca.amount,
          'amount_cents', round(ca.amount * 100)::bigint,
          'reason', ca.reason,
          'accounting_period', ca.accounting_period,
          'created_at', ca.created_at
        )
        order by ca.created_at asc, ca.id asc
      ), '[]'::jsonb)
      into v_charge_adjustments
      from public.charge_adjustments ca
      where ca.organization_id = p_organization_id;
    end if;

    if to_regclass('public.charge_cancellations') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', cc.id,
          'member_id', cc.member_id,
          'charge_id', cc.charge_id,
          'reason', cc.reason,
          'accounting_period', cc.accounting_period,
          'created_at', cc.created_at
        )
        order by cc.created_at asc, cc.id asc
      ), '[]'::jsonb)
      into v_charge_cancellations
      from public.charge_cancellations cc
      where cc.organization_id = p_organization_id;
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'member_id', p.member_id,
          'payment_date', p.payment_date,
          'amount', p.amount,
          'amount_cents', round(p.amount * 100)::bigint,
          'source_kind', p.source_kind,
          'reference', p.reference
        )
        order by p.payment_date asc, p.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(p.amount * 100)::bigint), 0)
    into v_payments, v_payments_cents
    from public.payments p
    where p.organization_id = p_organization_id;

    if to_regclass('public.payment_reversals') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'member_id', pr.member_id,
          'payment_id', pr.payment_id,
          'reason', pr.reason,
          'accounting_period', pr.accounting_period,
          'created_at', pr.created_at
        )
        order by pr.created_at asc, pr.id asc
      ), '[]'::jsonb)
      into v_payment_reversals
      from public.payment_reversals pr
      where pr.organization_id = p_organization_id;
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ra.id,
          'member_id', ra.member_id,
          'charge_id', ra.charge_id,
          'payment_id', ra.payment_id,
          'member_credit_id', ra.member_credit_id,
          'amount', ra.amount,
          'amount_cents', round(ra.amount * 100)::bigint,
          'accounting_period', ra.accounting_period
        )
        order by ra.created_at asc, ra.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ra.amount * 100)::bigint), 0)
    into v_allocations, v_alloc_cents
    from public.receivable_allocations ra
    where ra.organization_id = p_organization_id;

    if to_regclass('public.allocation_reversals') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ar.id,
          'member_id', ar.member_id,
          'allocation_id', ar.allocation_id,
          'reason', ar.reason,
          'accounting_period', ar.accounting_period,
          'created_at', ar.created_at
        )
        order by ar.created_at asc, ar.id asc
      ), '[]'::jsonb)
      into v_allocation_reversals
      from public.allocation_reversals ar
      where ar.organization_id = p_organization_id;
    end if;

    if to_regclass('public.member_credits') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', mc.id,
          'member_id', mc.member_id,
          'credit_kind', mc.credit_kind,
          'amount', mc.amount,
          'amount_cents', round(mc.amount * 100)::bigint,
          'reason', mc.reason,
          'accounting_period', mc.accounting_period,
          'created_at', mc.created_at
        )
        order by mc.created_at asc, mc.id asc
      ), '[]'::jsonb)
      into v_member_credits
      from public.member_credits mc
      where mc.organization_id = p_organization_id;
    end if;

    if to_regclass('public.member_debt_agreements') is not null then
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', mda.id,
            'member_id', mda.member_id,
            'agreement_date', mda.agreement_date,
            'negotiated_amount', mda.negotiated_amount,
            'negotiated_amount_cents', round(mda.negotiated_amount * 100)::bigint,
            'installment_count', mda.installment_count,
            'reason', mda.reason,
            'created_at', mda.created_at
          )
          order by mda.agreement_date asc, mda.id asc
        ), '[]'::jsonb),
        coalesce(sum(round(mda.negotiated_amount * 100)::bigint), 0)
      into v_agreements, v_agreements_cents
      from public.member_debt_agreements mda
      where mda.organization_id = p_organization_id;
    end if;

    if to_regclass('public.member_debt_agreement_items') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'agreement_id', mdai.agreement_id,
          'original_charge_id', mdai.original_charge_id,
          'included_amount', mdai.included_amount,
          'included_amount_cents', round(mdai.included_amount * 100)::bigint,
          'created_at', mdai.created_at
        )
        order by mdai.created_at asc, mdai.agreement_id asc
      ), '[]'::jsonb)
      into v_agreement_items
      from public.member_debt_agreement_items mdai
      where mdai.organization_id = p_organization_id;
    end if;

    if to_regclass('public.member_debt_agreement_installments') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', mdain.id,
          'agreement_id', mdain.agreement_id,
          'installment_number', mdain.installment_number,
          'charge_id', mdain.charge_id,
          'due_date', mdain.due_date,
          'amount', mdain.amount,
          'amount_cents', round(mdain.amount * 100)::bigint,
          'created_at', mdain.created_at
        )
        order by mdain.due_date asc, mdain.installment_number asc
      ), '[]'::jsonb)
      into v_agreement_installments
      from public.member_debt_agreement_installments mdain
      where mdain.organization_id = p_organization_id;
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ir.id,
          'category_id', ir.category_id,
          'description', ir.description,
          'counterparty_name', ir.counterparty_name,
          'competence', ir.competence,
          'issue_date', ir.issue_date,
          'due_date', ir.due_date,
          'amount', ir.amount,
          'amount_cents', round(ir.amount * 100)::bigint
        )
        order by ir.issue_date asc, ir.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ir.amount * 100)::bigint), 0)
    into v_inst_receivables, v_receivables_cents
    from public.institutional_receivables ir
    where ir.organization_id = p_organization_id;

    if to_regclass('public.institutional_receivable_corrections') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', irc.id,
          'receivable_id', irc.receivable_id,
          'previous_amount', irc.previous_amount,
          'new_amount', irc.new_amount,
          'reason', irc.reason,
          'accounting_period', irc.accounting_period,
          'created_at', irc.created_at
        )
        order by irc.created_at asc, irc.id asc
      ), '[]'::jsonb)
      into v_inst_rec_corrections
      from public.institutional_receivable_corrections irc
      where irc.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_receivable_cancellations') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'receivable_id', irx.receivable_id,
          'canceled_amount', irx.canceled_amount,
          'reason', irx.reason,
          'accounting_period', irx.accounting_period,
          'created_at', irx.created_at
        )
        order by irx.created_at asc, irx.receivable_id asc
      ), '[]'::jsonb)
      into v_inst_rec_cancellations
      from public.institutional_receivable_cancellations irx
      where irx.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_receipts') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', irec.id,
          'receipt_date', irec.receipt_date,
          'accounting_period', irec.accounting_period,
          'amount', irec.amount,
          'amount_cents', round(irec.amount * 100)::bigint,
          'financial_account_id', irec.financial_account_id,
          'reference', irec.reference,
          'created_at', irec.created_at
        )
        order by irec.receipt_date asc, irec.id asc
      ), '[]'::jsonb)
      into v_inst_receipts
      from public.institutional_receipts irec
      where irec.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_receipt_allocations') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ira.id,
          'receipt_id', ira.receipt_id,
          'receivable_id', ira.receivable_id,
          'amount', ira.amount,
          'amount_cents', round(ira.amount * 100)::bigint,
          'accounting_period', ira.accounting_period,
          'created_at', ira.created_at
        )
        order by ira.created_at asc, ira.id asc
      ), '[]'::jsonb)
      into v_inst_receipt_allocs
      from public.institutional_receipt_allocations ira
      where ira.organization_id = p_organization_id;
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ip.id,
          'category_id', ip.category_id,
          'description', ip.description,
          'counterparty_name', ip.counterparty_name,
          'competence', ip.competence,
          'issue_date', ip.issue_date,
          'due_date', ip.due_date,
          'amount', ip.amount,
          'amount_cents', round(ip.amount * 100)::bigint,
          'posting_status', ip.posting_status
        )
        order by ip.issue_date asc, ip.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ip.amount * 100)::bigint), 0)
    into v_inst_payables, v_payables_cents
    from public.institutional_payables ip
    where ip.organization_id = p_organization_id;

    if to_regclass('public.institutional_payable_corrections') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ipc.id,
          'payable_id', ipc.payable_id,
          'previous_amount', ipc.previous_amount,
          'new_amount', ipc.new_amount,
          'reason', ipc.reason,
          'accounting_period', ipc.accounting_period,
          'created_at', ipc.created_at
        )
        order by ipc.created_at asc, ipc.id asc
      ), '[]'::jsonb)
      into v_inst_pay_corrections
      from public.institutional_payable_corrections ipc
      where ipc.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_payable_cancellations') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'payable_id', ipx.payable_id,
          'canceled_amount', ipx.canceled_amount,
          'reason', ipx.reason,
          'accounting_period', ipx.accounting_period,
          'created_at', ipx.created_at
        )
        order by ipx.created_at asc, ipx.payable_id asc
      ), '[]'::jsonb)
      into v_inst_pay_cancellations
      from public.institutional_payable_cancellations ipx
      where ipx.organization_id = p_organization_id;
    end if;

    if to_regclass('public.payable_approval_requests') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', par.id,
          'payable_id', par.payable_id,
          'minimum_approvers', par.minimum_approvers,
          'amount_snapshot', par.amount_snapshot,
          'created_at', par.created_at
        )
        order by par.created_at asc, par.id asc
      ), '[]'::jsonb)
      into v_payable_app_reqs
      from public.payable_approval_requests par
      where par.organization_id = p_organization_id;
    end if;

    if to_regclass('public.payable_approval_decisions') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', pad.id,
          'approval_request_id', pad.approval_request_id,
          'decision', pad.decision,
          'reason', pad.reason,
          'created_at', pad.created_at
        )
        order by pad.created_at asc, pad.id asc
      ), '[]'::jsonb)
      into v_payable_app_decs
      from public.payable_approval_decisions pad
      where pad.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_payable_payments') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ipp.id,
          'payment_date', ipp.payment_date,
          'accounting_period', ipp.accounting_period,
          'amount', ipp.amount,
          'amount_cents', round(ipp.amount * 100)::bigint,
          'financial_account_id', ipp.financial_account_id,
          'reference', ipp.reference,
          'created_at', ipp.created_at
        )
        order by ipp.payment_date asc, ipp.id asc
      ), '[]'::jsonb)
      into v_inst_pay_payments
      from public.institutional_payable_payments ipp
      where ipp.organization_id = p_organization_id;
    end if;

    if to_regclass('public.institutional_payable_payment_allocations') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ippa.id,
          'payable_payment_id', ippa.payable_payment_id,
          'payable_id', ippa.payable_id,
          'amount', ippa.amount,
          'amount_cents', round(ippa.amount * 100)::bigint,
          'accounting_period', ippa.accounting_period,
          'created_at', ippa.created_at
        )
        order by ippa.created_at asc, ippa.id asc
      ), '[]'::jsonb)
      into v_inst_pay_allocs
      from public.institutional_payable_payment_allocations ippa
      where ippa.organization_id = p_organization_id;
    end if;

    if to_regclass('public.financial_account_transfers') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', fat.id,
          'from_account_id', fat.from_account_id,
          'to_account_id', fat.to_account_id,
          'transfer_date', fat.transfer_date,
          'accounting_period', fat.accounting_period,
          'amount', fat.amount,
          'amount_cents', round(fat.amount * 100)::bigint,
          'reference', fat.reference,
          'reason', fat.reason,
          'created_at', fat.created_at
        )
        order by fat.transfer_date asc, fat.id asc
      ), '[]'::jsonb)
      into v_account_transfers
      from public.financial_account_transfers fat
      where fat.organization_id = p_organization_id;
    end if;

    if to_regclass('public.budget_cycles') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', bc.id,
          'name', bc.name,
          'period_start', bc.period_start,
          'period_end', bc.period_end,
          'status', bc.status,
          'created_at', bc.created_at
        )
        order by bc.period_start asc, bc.id asc
      ), '[]'::jsonb)
      into v_budget_cycles
      from public.budget_cycles bc
      where bc.organization_id = p_organization_id;
    end if;

    if to_regclass('public.accounting_budget_lines') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', abl.id,
          'budget_cycle_id', abl.budget_cycle_id,
          'accounting_plan_id', abl.accounting_plan_id,
          'accounting_account_id', abl.accounting_account_id,
          'period', abl.period,
          'amount', abl.amount,
          'amount_cents', round(abl.amount * 100)::bigint
        )
        order by abl.period asc, abl.id asc
      ), '[]'::jsonb)
      into v_budget_lines
      from public.accounting_budget_lines abl
      where abl.organization_id = p_organization_id;
    end if;

    if to_regclass('public.bank_statement_imports') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', bsi.id,
          'financial_account_id', bsi.financial_account_id,
          'period_start', bsi.period_start,
          'period_end', bsi.period_end,
          'opening_balance', bsi.opening_balance,
          'closing_balance', bsi.closing_balance,
          'file_name', bsi.file_name,
          'file_sha256', bsi.file_sha256,
          'status', bsi.status,
          'created_at', bsi.created_at
        )
        order by bsi.created_at asc, bsi.id asc
      ), '[]'::jsonb)
      into v_bank_imports
      from public.bank_statement_imports bsi
      where bsi.organization_id = p_organization_id;
    end if;

    if to_regclass('public.bank_reconciliation_matches') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', brm.id,
          'statement_line_id', brm.statement_line_id,
          'member_payment_id', brm.member_payment_id,
          'institutional_receipt_id', brm.institutional_receipt_id,
          'payable_payment_id', brm.payable_payment_id,
          'account_transfer_id', brm.account_transfer_id,
          'matched_amount', brm.matched_amount,
          'created_at', brm.created_at
        )
        order by brm.created_at asc, brm.id asc
      ), '[]'::jsonb)
      into v_bank_matches
      from public.bank_reconciliation_matches brm
      where brm.organization_id = p_organization_id;
    end if;

    if to_regclass('public.accounting_plans') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ap.id,
          'name', ap.name,
          'status', ap.status,
          'valid_from', ap.valid_from,
          'valid_to', ap.valid_to,
          'published_at', ap.published_at,
          'created_at', ap.created_at
        )
        order by ap.valid_from asc, ap.id asc
      ), '[]'::jsonb)
      into v_accounting_plans
      from public.accounting_plans ap
      where ap.organization_id = p_organization_id;
    end if;

    if to_regclass('public.accounting_accounts') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', aa.id,
          'accounting_plan_id', aa.accounting_plan_id,
          'parent_account_id', aa.parent_account_id,
          'code', aa.code,
          'description', aa.description,
          'row_type', aa.row_type,
          'nature', aa.nature,
          'operational_classification', aa.operational_classification,
          'active', aa.active
        )
        order by aa.code asc, aa.id asc
      ), '[]'::jsonb)
      into v_accounting_accounts
      from public.accounting_accounts aa
      where aa.organization_id = p_organization_id;
    end if;

    if to_regclass('public.accounting_plan_role_mappings') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', aprm.id,
          'accounting_plan_id', aprm.accounting_plan_id,
          'role_code', aprm.role_code,
          'accounting_account_id', aprm.accounting_account_id,
          'created_at', aprm.created_at
        )
        order by aprm.role_code asc, aprm.id asc
      ), '[]'::jsonb)
      into v_accounting_role_mappings
      from public.accounting_plan_role_mappings aprm
      where aprm.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_subscriptions') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ss.id,
          'plan_id', ss.plan_id,
          'status', ss.status,
          'started_at', ss.started_at,
          'current_period_start', ss.current_period_start,
          'current_period_end', ss.current_period_end,
          'cancel_at_period_end', ss.cancel_at_period_end,
          'canceled_at', ss.canceled_at,
          'created_at', ss.created_at
        )
        order by ss.created_at asc, ss.id asc
      ), '[]'::jsonb)
      into v_saas_subscriptions
      from public.saas_subscriptions ss
      where ss.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_subscription_price_terms') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', spt.id,
          'subscription_id', spt.subscription_id,
          'effective_from', spt.effective_from,
          'effective_to', spt.effective_to,
          'unit_price', spt.unit_price,
          'unit_price_cents', round(spt.unit_price * 100)::bigint,
          'adjustment_reason', spt.adjustment_reason,
          'created_at', spt.created_at
        )
        order by spt.effective_from asc, spt.id asc
      ), '[]'::jsonb)
      into v_saas_price_terms
      from public.saas_subscription_price_terms spt
      where spt.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_scheduled_subscription_changes') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ssc.id,
          'subscription_id', ssc.subscription_id,
          'change_type', ssc.change_type,
          'target_plan_version_id', ssc.target_plan_version_id,
          'effective_at', ssc.effective_at,
          'status', ssc.status,
          'reason', ssc.reason,
          'created_at', ssc.created_at
        )
        order by ssc.effective_at asc, ssc.id asc
      ), '[]'::jsonb)
      into v_saas_scheduled_changes
      from public.saas_scheduled_subscription_changes ssc
      where ssc.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_invoices') is not null then
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', si.id,
            'subscription_id', si.subscription_id,
            'invoice_number', si.invoice_number,
            'competence', si.competence,
            'issue_date', si.issue_date,
            'due_date', si.due_date,
            'amount_due', si.amount_due,
            'amount_due_cents', round(si.amount_due * 100)::bigint,
            'description', si.description,
            'created_at', si.created_at
          )
          order by si.issue_date asc, si.id asc
        ), '[]'::jsonb),
        coalesce(sum(round(si.amount_due * 100)::bigint), 0)
      into v_saas_invoices, v_saas_invoices_cents
      from public.saas_invoices si
      where si.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_invoice_items') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', sii.id,
          'invoice_id', sii.invoice_id,
          'item_type', sii.item_type,
          'description', sii.description,
          'quantity', sii.quantity,
          'unit_amount', sii.unit_amount,
          'line_amount', sii.line_amount,
          'line_amount_cents', round(sii.line_amount * 100)::bigint
        )
        order by sii.created_at asc, sii.id asc
      ), '[]'::jsonb)
      into v_saas_invoice_items
      from public.saas_invoice_items sii
      where sii.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_payment_agreements') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', spa.id,
          'agreement_number', spa.agreement_number,
          'agreement_date', spa.agreement_date,
          'negotiated_amount', spa.negotiated_amount,
          'negotiated_amount_cents', round(spa.negotiated_amount * 100)::bigint,
          'installment_count', spa.installment_count,
          'terms', spa.terms,
          'created_at', spa.created_at
        )
        order by spa.agreement_date asc, spa.id asc
      ), '[]'::jsonb)
      into v_saas_agreements
      from public.saas_payment_agreements spa
      where spa.organization_id = p_organization_id;
    end if;

    if to_regclass('public.saas_support_tickets') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', st.id,
          'ticket_seq', st.ticket_seq,
          'subject', st.subject,
          'category', st.category,
          'priority', st.priority,
          'status', st.status,
          'opened_at', st.opened_at,
          'resolved_at', st.resolved_at,
          'closed_at', st.closed_at
        )
        order by st.opened_at asc, st.id asc
      ), '[]'::jsonb)
      into v_support_tickets
      from public.saas_support_tickets st
      where st.organization_id = p_organization_id
        and coalesce(to_jsonb(st)->>'ticket_scope', 'tenant') = 'tenant';
    end if;

    if to_regclass('public.saas_support_ticket_messages') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', stm.id,
          'ticket_id', stm.ticket_id,
          'sender_kind', stm.sender_kind,
          'visibility', stm.visibility,
          'body', stm.body,
          'created_at', stm.created_at
        )
        order by stm.created_at asc, stm.id asc
      ), '[]'::jsonb)
      into v_support_messages
      from public.saas_support_ticket_messages stm
      join public.saas_support_tickets st
        on st.id = stm.ticket_id
        and st.organization_id = p_organization_id
        and coalesce(to_jsonb(st)->>'ticket_scope', 'tenant') = 'tenant'
      where stm.visibility = 'customer';
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', trh.id,
        'data_category', trh.data_category,
        'hold_reason', trh.hold_reason,
        'legal_reference', trh.legal_reference,
        'hold_status', trh.hold_status,
        'placed_at', trh.placed_at,
        'released_at', trh.released_at
      )
      order by trh.placed_at asc, trh.id asc
    ), '[]'::jsonb)
    into v_retention_holds
    from public.tenant_retention_holds trh
    where trh.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', tpr.id,
        'member_id', tpr.member_id,
        'request_type', tpr.request_type,
        'data_category', tpr.data_category,
        'legal_basis', tpr.legal_basis,
        'decision_outcome', tpr.decision_outcome,
        'ledger_preserved', tpr.ledger_preserved,
        'created_at', tpr.created_at
      )
      order by tpr.created_at asc, tpr.id asc
    ), '[]'::jsonb)
    into v_privacy_requests
    from public.tenant_privacy_requests tpr
    where tpr.organization_id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'storage_path', d.storage_path,
        'original_filename', d.original_filename,
        'mime_type', d.mime_type,
        'size_bytes', d.size_bytes,
        'sha256', d.sha256,
        'classification', d.classification,
        'binary_embedded', false,
        'created_at', d.created_at
      )
      order by d.created_at asc, d.id asc
    ), '[]'::jsonb)
    into v_attachments
    from public.documents d
    where d.organization_id = p_organization_id
      and d.classification in ('internal', 'confidential');

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'entity_type', al.entity_type,
        'entity_id', al.entity_id,
        'reason', al.reason,
        'created_at', al.created_at
      )
      order by al.created_at asc, al.id asc
    ), '[]'::jsonb)
    into v_audit_logs
    from public.audit_logs al
    where al.organization_id = p_organization_id;

    v_payload := jsonb_build_object(
      'organization', v_org,
      'members', v_members,
      'roles_and_permissions', v_roles_perms,
      'financial_categories', v_categories,
      'financial_accounts', v_accounts,
      'payment_methods', v_payment_methods,
      'financial_periods', v_financial_periods,
      'charges', v_charges,
      'charge_adjustments', v_charge_adjustments,
      'charge_cancellations', v_charge_cancellations,
      'payments', v_payments,
      'payment_reversals', v_payment_reversals,
      'receivable_allocations', v_allocations,
      'allocation_reversals', v_allocation_reversals,
      'member_credits', v_member_credits,
      'member_debt_agreements', v_agreements,
      'member_debt_agreement_items', v_agreement_items,
      'member_debt_agreement_installments', v_agreement_installments,
      'institutional_receivables', v_inst_receivables,
      'institutional_receivable_corrections', v_inst_rec_corrections,
      'institutional_receivable_cancellations', v_inst_rec_cancellations,
      'institutional_receipts', v_inst_receipts,
      'institutional_receipt_allocations', v_inst_receipt_allocs,
      'institutional_payables', v_inst_payables,
      'institutional_payable_corrections', v_inst_pay_corrections,
      'institutional_payable_cancellations', v_inst_pay_cancellations,
      'payable_approval_requests', v_payable_app_reqs,
      'payable_approval_decisions', v_payable_app_decs,
      'institutional_payable_payments', v_inst_pay_payments,
      'institutional_payable_payment_allocations', v_inst_pay_allocs,
      'financial_account_transfers', v_account_transfers,
      'budget_cycles', v_budget_cycles,
      'accounting_budget_lines', v_budget_lines,
      'bank_statement_imports', v_bank_imports,
      'bank_reconciliation_matches', v_bank_matches,
      'accounting_plans', v_accounting_plans,
      'accounting_accounts', v_accounting_accounts,
      'accounting_plan_role_mappings', v_accounting_role_mappings,
      'saas_subscriptions', v_saas_subscriptions,
      'saas_subscription_price_terms', v_saas_price_terms,
      'saas_scheduled_subscription_changes', v_saas_scheduled_changes,
      'saas_invoices', v_saas_invoices,
      'saas_invoice_items', v_saas_invoice_items,
      'saas_payment_agreements', v_saas_agreements,
      'customer_support_tickets', v_support_tickets,
      'customer_support_messages', v_support_messages,
      'tenant_retention_holds', v_retention_holds,
      'tenant_privacy_requests', v_privacy_requests,
      'eligible_attachments', v_attachments,
      'audit_logs', v_audit_logs
    );

    v_manifest := jsonb_build_object(
      'export_scope', p_export_scope,
      'organization_id', p_organization_id,
      'format', coalesce(p_package_format, 'json'),
      'retention_posture', v_posture,
      'binary_files_included', false,
      'attachments_note', 'Inventário portátil de metadados e hashes SHA-256 dos anexos elegíveis (storage_path, mime_type, size_bytes, sha256); não equivale à exportação binária dos arquivos do Storage privado.',
      'restoration_note', 'Exportação portátil somente para leitura, portabilidade e auditoria externa; restauração automática por upload é proibida.',
      'excluded_scopes', jsonb_build_array('auth_credentials', 'secrets_and_tokens', 'cross_tenant_records', 'master_internal_tickets', 'master_internal_notes', 'master_audit_logs', 'storage_binary_blobs'),
      'counts', jsonb_build_object(
        'members', jsonb_array_length(v_members),
        'roles_and_permissions', jsonb_array_length(v_roles_perms),
        'financial_categories', jsonb_array_length(v_categories),
        'financial_accounts', jsonb_array_length(v_accounts),
        'payment_methods', jsonb_array_length(v_payment_methods),
        'financial_periods', jsonb_array_length(v_financial_periods),
        'charges', jsonb_array_length(v_charges),
        'charge_adjustments', jsonb_array_length(v_charge_adjustments),
        'charge_cancellations', jsonb_array_length(v_charge_cancellations),
        'payments', jsonb_array_length(v_payments),
        'payment_reversals', jsonb_array_length(v_payment_reversals),
        'receivable_allocations', jsonb_array_length(v_allocations),
        'allocation_reversals', jsonb_array_length(v_allocation_reversals),
        'member_credits', jsonb_array_length(v_member_credits),
        'member_debt_agreements', jsonb_array_length(v_agreements),
        'member_debt_agreement_items', jsonb_array_length(v_agreement_items),
        'member_debt_agreement_installments', jsonb_array_length(v_agreement_installments),
        'institutional_receivables', jsonb_array_length(v_inst_receivables),
        'institutional_receivable_corrections', jsonb_array_length(v_inst_rec_corrections),
        'institutional_receivable_cancellations', jsonb_array_length(v_inst_rec_cancellations),
        'institutional_receipts', jsonb_array_length(v_inst_receipts),
        'institutional_receipt_allocations', jsonb_array_length(v_inst_receipt_allocs),
        'institutional_payables', jsonb_array_length(v_inst_payables),
        'institutional_payable_corrections', jsonb_array_length(v_inst_pay_corrections),
        'institutional_payable_cancellations', jsonb_array_length(v_inst_pay_cancellations),
        'payable_approval_requests', jsonb_array_length(v_payable_app_reqs),
        'payable_approval_decisions', jsonb_array_length(v_payable_app_decs),
        'institutional_payable_payments', jsonb_array_length(v_inst_pay_payments),
        'institutional_payable_payment_allocations', jsonb_array_length(v_inst_pay_allocs),
        'financial_account_transfers', jsonb_array_length(v_account_transfers),
        'budget_cycles', jsonb_array_length(v_budget_cycles),
        'accounting_budget_lines', jsonb_array_length(v_budget_lines),
        'bank_statement_imports', jsonb_array_length(v_bank_imports),
        'bank_reconciliation_matches', jsonb_array_length(v_bank_matches),
        'accounting_plans', jsonb_array_length(v_accounting_plans),
        'accounting_accounts', jsonb_array_length(v_accounting_accounts),
        'accounting_plan_role_mappings', jsonb_array_length(v_accounting_role_mappings),
        'saas_subscriptions', jsonb_array_length(v_saas_subscriptions),
        'saas_subscription_price_terms', jsonb_array_length(v_saas_price_terms),
        'saas_scheduled_subscription_changes', jsonb_array_length(v_saas_scheduled_changes),
        'saas_invoices', jsonb_array_length(v_saas_invoices),
        'saas_invoice_items', jsonb_array_length(v_saas_invoice_items),
        'saas_payment_agreements', jsonb_array_length(v_saas_agreements),
        'customer_support_tickets', jsonb_array_length(v_support_tickets),
        'customer_support_messages', jsonb_array_length(v_support_messages),
        'tenant_retention_holds', jsonb_array_length(v_retention_holds),
        'tenant_privacy_requests', jsonb_array_length(v_privacy_requests),
        'eligible_attachments', jsonb_array_length(v_attachments),
        'audit_logs', jsonb_array_length(v_audit_logs)
      ),
      'totals_cents', jsonb_build_object(
        'charges_total_cents', v_charges_cents,
        'payments_total_cents', v_payments_cents,
        'allocations_total_cents', v_alloc_cents,
        'member_debt_agreements_total_cents', v_agreements_cents,
        'institutional_receivables_total_cents', v_receivables_cents,
        'institutional_payables_total_cents', v_payables_cents,
        'saas_invoices_total_cents', v_saas_invoices_cents
      )
    );
  else
    select jsonb_build_object('id', o.id, 'name', o.name)
    into v_org
    from public.organizations o
    where o.id = p_organization_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'full_name', m.full_name,
        'preferred_name', m.preferred_name,
        'degree_or_office', m.degree_or_office,
        'initiation_date', m.initiation_date,
        'admission_date', m.admission_date,
        'cpf', m.cpf,
        'phone', m.phone,
        'whatsapp', m.whatsapp,
        'email', m.email,
        'status', m.status,
        'created_at', m.created_at
      )
    ), '[]'::jsonb)
    into v_members
    from public.members m
    where m.organization_id = p_organization_id
      and m.id = p_subject_member_id;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ch.id,
          'member_id', ch.member_id,
          'description', ch.description,
          'competence', ch.competence,
          'due_date', ch.due_date,
          'original_amount', ch.original_amount,
          'original_amount_cents', round(ch.original_amount * 100)::bigint
        )
        order by ch.issue_date asc, ch.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ch.original_amount * 100)::bigint), 0)
    into v_charges, v_charges_cents
    from public.charges ch
    where ch.organization_id = p_organization_id
      and ch.member_id = p_subject_member_id;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'member_id', p.member_id,
          'payment_date', p.payment_date,
          'amount', p.amount,
          'amount_cents', round(p.amount * 100)::bigint,
          'reference', p.reference
        )
        order by p.payment_date asc, p.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(p.amount * 100)::bigint), 0)
    into v_payments, v_payments_cents
    from public.payments p
    where p.organization_id = p_organization_id
      and p.member_id = p_subject_member_id;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ra.id,
          'member_id', ra.member_id,
          'charge_id', ra.charge_id,
          'payment_id', ra.payment_id,
          'amount', ra.amount,
          'amount_cents', round(ra.amount * 100)::bigint
        )
        order by ra.created_at asc, ra.id asc
      ), '[]'::jsonb),
      coalesce(sum(round(ra.amount * 100)::bigint), 0)
    into v_allocations, v_alloc_cents
    from public.receivable_allocations ra
    where ra.organization_id = p_organization_id
      and ra.member_id = p_subject_member_id;

    if to_regclass('public.member_credits') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', mc.id,
          'member_id', mc.member_id,
          'credit_kind', mc.credit_kind,
          'amount', mc.amount,
          'amount_cents', round(mc.amount * 100)::bigint,
          'reason', mc.reason,
          'accounting_period', mc.accounting_period,
          'created_at', mc.created_at
        )
        order by mc.created_at asc, mc.id asc
      ), '[]'::jsonb)
      into v_member_credits
      from public.member_credits mc
      where mc.organization_id = p_organization_id
        and mc.member_id = p_subject_member_id;
    end if;

    if to_regclass('public.member_debt_agreements') is not null then
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', mda.id,
            'member_id', mda.member_id,
            'agreement_date', mda.agreement_date,
            'negotiated_amount', mda.negotiated_amount,
            'negotiated_amount_cents', round(mda.negotiated_amount * 100)::bigint,
            'installment_count', mda.installment_count,
            'reason', mda.reason,
            'created_at', mda.created_at
          )
          order by mda.agreement_date asc, mda.id asc
        ), '[]'::jsonb),
        coalesce(sum(round(mda.negotiated_amount * 100)::bigint), 0)
      into v_agreements, v_agreements_cents
      from public.member_debt_agreements mda
      where mda.organization_id = p_organization_id
        and mda.member_id = p_subject_member_id;
    end if;

    if to_regclass('public.member_debt_agreement_installments') is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', mdain.id,
          'agreement_id', mdain.agreement_id,
          'installment_number', mdain.installment_number,
          'charge_id', mdain.charge_id,
          'due_date', mdain.due_date,
          'amount', mdain.amount,
          'amount_cents', round(mdain.amount * 100)::bigint
        )
        order by mdain.due_date asc, mdain.installment_number asc
      ), '[]'::jsonb)
      into v_agreement_installments
      from public.member_debt_agreement_installments mdain
      join public.member_debt_agreements mda
        on mda.id = mdain.agreement_id and mda.organization_id = p_organization_id
      where mdain.organization_id = p_organization_id
        and mda.member_id = p_subject_member_id;
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', tpr.id,
        'member_id', tpr.member_id,
        'request_type', tpr.request_type,
        'data_category', tpr.data_category,
        'legal_basis', tpr.legal_basis,
        'decision_outcome', tpr.decision_outcome,
        'ledger_preserved', tpr.ledger_preserved,
        'created_at', tpr.created_at
      )
      order by tpr.created_at asc, tpr.id asc
    ), '[]'::jsonb)
    into v_privacy_requests
    from public.tenant_privacy_requests tpr
    where tpr.organization_id = p_organization_id
      and tpr.member_id = p_subject_member_id;

    v_payload := jsonb_build_object(
      'organization', v_org,
      'member_profile', v_members,
      'charges', v_charges,
      'payments', v_payments,
      'receivable_allocations', v_allocations,
      'member_credits', v_member_credits,
      'member_debt_agreements', v_agreements,
      'member_debt_agreement_installments', v_agreement_installments,
      'tenant_privacy_requests', v_privacy_requests
    );

    v_manifest := jsonb_build_object(
      'export_scope', p_export_scope,
      'organization_id', p_organization_id,
      'subject_member_id', p_subject_member_id,
      'format', coalesce(p_package_format, 'json'),
      'retention_posture', v_posture,
      'binary_files_included', false,
      'attachments_note', 'Pacote individual de dados estruturados do titular; não inclui arquivos binários do Storage privado.',
      'restoration_note', 'Pacote exclusivo do titular; não equivale à base integral da Loja e não suporta restauração automática por upload.',
      'excluded_scopes', jsonb_build_array('other_members_records', 'institutional_payables', 'auth_credentials', 'master_internal_tickets', 'master_internal_notes', 'cross_tenant_records', 'storage_binary_blobs'),
      'counts', jsonb_build_object(
        'member_profile', jsonb_array_length(v_members),
        'charges', jsonb_array_length(v_charges),
        'payments', jsonb_array_length(v_payments),
        'receivable_allocations', jsonb_array_length(v_allocations),
        'member_credits', jsonb_array_length(v_member_credits),
        'member_debt_agreements', jsonb_array_length(v_agreements),
        'member_debt_agreement_installments', jsonb_array_length(v_agreement_installments),
        'tenant_privacy_requests', jsonb_array_length(v_privacy_requests)
      ),
      'totals_cents', jsonb_build_object(
        'charges_total_cents', v_charges_cents,
        'payments_total_cents', v_payments_cents,
        'allocations_total_cents', v_alloc_cents,
        'member_debt_agreements_total_cents', v_agreements_cents
      )
    );
  end if;

  if v_org is null or v_payload is null or v_manifest is null then
    v_status := 'blocked_incomplete';
    v_block_reason := 'incomplete_tenant_package';
  end if;

  v_sha256 := private.m05_sha256_hex(v_payload::text);

  insert into public.tenant_portability_exports (
    organization_id, requested_by_user_id, export_scope, subject_member_id,
    package_format, status, retention_posture, manifest, data_dictionary,
    payload_json, payload_sha256, block_reason, expires_at
  ) values (
    p_organization_id, v_user, p_export_scope, p_subject_member_id,
    coalesce(p_package_format, 'json'), v_status, v_posture, v_manifest, v_dictionary,
    v_payload, v_sha256, v_block_reason, v_expires_at
  )
  returning id into v_export_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.portability_export_created',
    'tenant_portability_exports',
    v_export_id,
    jsonb_build_object(
      'export_scope', p_export_scope,
      'package_format', coalesce(p_package_format, 'json'),
      'status', v_status,
      'payload_sha256', v_sha256,
      'expires_at', v_expires_at
    ),
    'Portabilidade LGPD D02'
  );

  v_result := jsonb_build_object(
    'export_id', v_export_id,
    'organization_id', p_organization_id,
    'export_scope', p_export_scope,
    'subject_member_id', p_subject_member_id,
    'package_format', coalesce(p_package_format, 'json'),
    'status', v_status,
    'retention_posture', v_posture,
    'payload_sha256', v_sha256,
    'expires_at', v_expires_at,
    'manifest', v_manifest,
    'data_dictionary', v_dictionary
  );

  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.create_tenant_portability_export_idempotent(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.create_tenant_portability_export_idempotent(uuid, text, uuid, text, text) to authenticated;

create or replace function public.list_tenant_portability_exports(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_can_org boolean;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  v_can_org := private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'reports.export');

  if not v_can_org and not exists (
    select 1 from public.member_user_links l
    where l.organization_id = p_organization_id and l.user_id = v_user
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'export_id', e.id,
        'organization_id', e.organization_id,
        'export_scope', e.export_scope,
        'subject_member_id', e.subject_member_id,
        'package_format', e.package_format,
        'status', case when e.status = 'ready' and e.expires_at <= clock_timestamp() then 'expired' else e.status end,
        'retention_posture', e.retention_posture,
        'payload_sha256', e.payload_sha256,
        'manifest', e.manifest,
        'expires_at', e.expires_at,
        'created_at', e.created_at
      )
      order by e.created_at desc
    )
    from public.tenant_portability_exports e
    where e.organization_id = p_organization_id
      and (
        v_can_org
        or (
          e.export_scope = 'data_subject_package'
          and e.subject_member_id is not null
          and private.is_self_member(p_organization_id, e.subject_member_id)
        )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_tenant_portability_exports(uuid) from public, anon;
grant execute on function public.list_tenant_portability_exports(uuid) to authenticated;

create or replace function public.download_tenant_portability_export(
  p_organization_id uuid,
  p_export_id uuid,
  p_requested_format text default 'json'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_exp public.tenant_portability_exports%rowtype;
  v_retention jsonb;
  v_downloaded_at timestamptz := clock_timestamp();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if coalesce(p_requested_format, 'json') not in ('json', 'csv') then
    raise exception 'invalid download format' using errcode = '22023';
  end if;

  select * into v_exp
  from public.tenant_portability_exports
  where organization_id = p_organization_id
    and id = p_export_id
  for update;

  if not found then
    raise exception 'portability export not found' using errcode = '23503';
  end if;

  if v_exp.export_scope = 'organization_full' then
    if not (
      private.has_permission(p_organization_id, 'settings.manage')
      or private.has_permission(p_organization_id, 'reports.export')
    ) then
      raise exception 'access denied' using errcode = '42501';
    end if;
  else
    if not (
      private.has_permission(p_organization_id, 'settings.manage')
      or private.has_permission(p_organization_id, 'members.read')
      or private.is_self_member(p_organization_id, v_exp.subject_member_id)
    ) then
      raise exception 'access denied' using errcode = '42501';
    end if;
  end if;

  v_retention := private.m05_retention_snapshot(p_organization_id);
  if not coalesce((v_retention->>'export_allowed')::boolean, false) then
    raise exception 'export window expired; tenant is in archived restricted retention' using errcode = '55000';
  end if;

  if v_exp.status = 'blocked_incomplete' then
    raise exception 'portability export blocked due to incomplete integrity verification' using errcode = '55000';
  end if;

  if v_exp.status = 'expired' or v_exp.expires_at <= v_downloaded_at then
    update public.tenant_portability_exports
    set status = 'expired'
    where id = v_exp.id and status <> 'expired';
    raise exception 'portability export link expired' using errcode = '55000';
  end if;

  insert into public.tenant_portability_downloads (
    export_id, organization_id, downloaded_by_user_id, downloaded_format, payload_sha256, downloaded_at
  ) values (
    v_exp.id, p_organization_id, v_user, coalesce(p_requested_format, 'json'), v_exp.payload_sha256, v_downloaded_at
  );

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.portability_export_downloaded',
    'tenant_portability_exports',
    v_exp.id,
    jsonb_build_object(
      'downloaded_format', coalesce(p_requested_format, 'json'),
      'payload_sha256', v_exp.payload_sha256
    ),
    'Download autenticado de portabilidade LGPD D02'
  );

  return jsonb_build_object(
    'export_id', v_exp.id,
    'organization_id', v_exp.organization_id,
    'export_scope', v_exp.export_scope,
    'subject_member_id', v_exp.subject_member_id,
    'package_format', coalesce(p_requested_format, 'json'),
    'payload_sha256', v_exp.payload_sha256,
    'expires_at', v_exp.expires_at,
    'downloaded_at', v_downloaded_at,
    'manifest', v_exp.manifest,
    'data_dictionary', v_exp.data_dictionary,
    'payload', v_exp.payload_json
  );
end;
$$;

revoke all on function public.download_tenant_portability_export(uuid, uuid, text) from public, anon;
grant execute on function public.download_tenant_portability_export(uuid, uuid, text) to authenticated;

create or replace function public.authorize_tenant_portability_attachment_download(
  p_organization_id uuid,
  p_export_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_exp public.tenant_portability_exports%rowtype;
  v_doc public.documents%rowtype;
  v_retention jsonb;
  v_storage_bucket text := 'tenant-documents';
  v_storage_object_key text;
  v_slash_pos integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null or p_export_id is null or p_document_id is null then
    raise exception 'organization_id, export_id and document_id are required' using errcode = '22023';
  end if;

  select * into v_exp
  from public.tenant_portability_exports
  where organization_id = p_organization_id
    and id = p_export_id
  for update;

  if not found then
    raise exception 'portability export not found' using errcode = '23503';
  end if;

  if v_exp.export_scope <> 'organization_full' then
    raise exception 'attachment binary download requires organization_full export scope' using errcode = '42501';
  end if;

  if not (
    private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'reports.export')
  ) then
    raise exception 'access denied for organization attachment download' using errcode = '42501';
  end if;

  v_retention := private.m05_retention_snapshot(p_organization_id);
  if not coalesce((v_retention->>'export_allowed')::boolean, false) then
    raise exception 'export window expired; tenant is in archived restricted retention' using errcode = '55000';
  end if;

  if v_exp.status = 'blocked_incomplete' then
    raise exception 'portability export blocked due to incomplete integrity verification' using errcode = '55000';
  end if;

  if v_exp.status = 'expired' or v_exp.expires_at <= clock_timestamp() then
    update public.tenant_portability_exports
    set status = 'expired'
    where id = v_exp.id and status <> 'expired';
    raise exception 'portability export link expired' using errcode = '55000';
  end if;

  select * into v_doc
  from public.documents
  where organization_id = p_organization_id
    and id = p_document_id;

  if not found then
    raise exception 'document not found in organization' using errcode = '23503';
  end if;

  if v_doc.classification not in ('internal', 'confidential') then
    raise exception 'document classification is not eligible for standard portability export' using errcode = '42501';
  end if;

  if v_doc.sha256 is null or v_doc.sha256 !~ '^[0-9a-fA-F]{64}$'
     or v_doc.storage_path not like 'tenant-documents/' || p_organization_id::text || '/%'
     or not exists (
       select 1 from jsonb_array_elements(v_exp.payload_json->'eligible_attachments') item
       where item->>'id' = v_doc.id::text
         and item->>'storage_path' = v_doc.storage_path
         and item->>'sha256' = v_doc.sha256
         and item->>'size_bytes' = v_doc.size_bytes::text
     ) then
    raise exception 'document is not eligible for this export snapshot' using errcode = '42501';
  end if;

  v_storage_object_key := substring(v_doc.storage_path from length('tenant-documents/') + 1);
  if v_storage_object_key ~ '(^|/)[.]{1,2}(/|$)' or right(v_storage_object_key, 1) = '/' then
    raise exception 'invalid tenant object key' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.portability_attachment_download_authorized',
    'documents',
    v_doc.id,
    jsonb_build_object(
      'export_id', v_exp.id,
      'document_id', v_doc.id,
      'storage_bucket', v_storage_bucket,
      'storage_object_key', v_storage_object_key,
      'original_filename', v_doc.original_filename,
      'sha256', v_doc.sha256
    ),
    'Download binário autenticado de anexo elegível via Storage privado (D02)'
  );

  return jsonb_build_object(
    'export_id', v_exp.id,
    'document_id', v_doc.id,
    'organization_id', p_organization_id,
    'storage_bucket', v_storage_bucket,
    'storage_object_key', v_storage_object_key,
    'storage_path', v_doc.storage_path,
    'original_filename', v_doc.original_filename,
    'mime_type', v_doc.mime_type,
    'size_bytes', v_doc.size_bytes,
    'sha256', v_doc.sha256,
    'expires_at', v_exp.expires_at
  );
end;
$$;

revoke all on function public.authorize_tenant_portability_attachment_download(uuid, uuid, uuid) from public, anon;
grant execute on function public.authorize_tenant_portability_attachment_download(uuid, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Entrega B — Privacidade & Direitos dos Titulares (D02 / D03)
-- ----------------------------------------------------------------------------

create table if not exists public.tenant_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid,
  requested_by_user_id uuid not null references auth.users(id),
  request_type text not null
    check (request_type in ('access', 'correction', 'portability', 'anonymization', 'deletion')),
  requester_verification_method text not null
    check (requester_verification_method in ('authenticated_member_link', 'signed_document_verified', 'in_person_controller_check')),
  requester_verified boolean not null default false,
  data_category text not null
    check (data_category in ('cadastral', 'financial_ledger', 'sensitive_philosophical', 'access_logs', 'operational_logs', 'attachments')),
  legal_basis text not null
    check (legal_basis in ('legal_obligation_accounting', 'contract_execution', 'legitimate_interest', 'consent', 'exercise_of_rights')),
  decision_outcome text not null default 'pending_triage'
    check (decision_outcome in ('pending_triage', 'fulfilled', 'pseudonymized', 'anonymized_verified', 'retained_by_law', 'rejected_unverified')),
  triage_due_at timestamptz not null,
  triaged_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id),
  controller_justification text,
  anonymization_assessment jsonb not null default '{}'::jsonb,
  ledger_preserved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

create index if not exists tenant_privacy_requests_org_idx
  on public.tenant_privacy_requests (organization_id, decision_outcome, created_at desc);

create trigger tenant_privacy_requests_set_updated_at
  before update on public.tenant_privacy_requests
  for each row execute function private.set_updated_at();

revoke all on table public.tenant_privacy_requests from public, anon, authenticated;
alter table public.tenant_privacy_requests enable row level security;
grant select on public.tenant_privacy_requests to authenticated;

create policy tenant_privacy_requests_select
  on public.tenant_privacy_requests
  for select to authenticated
  using (
    private.has_permission(organization_id, 'settings.manage')
    or private.has_permission(organization_id, 'members.read')
    or (
      member_id is not null
      and private.is_self_member(organization_id, member_id)
    )
  );

create table if not exists public.tenant_privacy_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('registered', 'reviewed')),
  from_outcome text,
  to_outcome text not null,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, request_id)
    references public.tenant_privacy_requests(organization_id, id)
);

create trigger tenant_privacy_request_events_immutable
  before update or delete on public.tenant_privacy_request_events
  for each row execute function private.prevent_financial_mutation();

revoke all on table public.tenant_privacy_request_events from public, anon, authenticated;
alter table public.tenant_privacy_request_events enable row level security;
grant select on public.tenant_privacy_request_events to authenticated;

create policy tenant_privacy_request_events_select
  on public.tenant_privacy_request_events
  for select to authenticated
  using (
    private.has_permission(organization_id, 'settings.manage')
    or private.has_permission(organization_id, 'audit.read')
    or actor_user_id = (select auth.uid())
  );

create or replace function public.register_tenant_privacy_request_idempotent(
  p_organization_id uuid,
  p_member_id uuid,
  p_request_type text,
  p_data_category text,
  p_verification_method text,
  p_requester_verified boolean,
  p_legal_basis text,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_req_id uuid;
  v_now timestamptz := clock_timestamp();
  v_due timestamptz;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null or not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;
  if p_member_id is not null and not exists (
    select 1 from public.members where organization_id = p_organization_id and id = p_member_id
  ) then
    raise exception 'member not found in organization' using errcode = '23503';
  end if;

  if not (
    private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'members.write')
    or (p_member_id is not null and private.is_self_member(p_organization_id, p_member_id))
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  if p_request_type not in ('access', 'correction', 'portability', 'anonymization', 'deletion') then
    raise exception 'invalid privacy request type' using errcode = '22023';
  end if;
  if p_data_category not in ('cadastral', 'financial_ledger', 'sensitive_philosophical', 'access_logs', 'operational_logs', 'attachments') then
    raise exception 'invalid data category' using errcode = '22023';
  end if;
  if p_verification_method not in ('authenticated_member_link', 'signed_document_verified', 'in_person_controller_check') then
    raise exception 'invalid verification method' using errcode = '22023';
  end if;
  if p_legal_basis not in ('legal_obligation_accounting', 'contract_execution', 'legitimate_interest', 'consent', 'exercise_of_rights') then
    raise exception 'invalid legal basis' using errcode = '22023';
  end if;
  if p_notes is not null and private.m05_has_secret_pattern(p_notes) then
    raise exception 'notes cannot contain secrets or credentials' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'register_tenant_privacy_request',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'member_id', p_member_id,
      'request_type', p_request_type,
      'data_category', p_data_category,
      'verification_method', p_verification_method,
      'requester_verified', coalesce(p_requester_verified, false),
      'legal_basis', p_legal_basis
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  v_due := private.add_business_days(v_now, 2);

  insert into public.tenant_privacy_requests (
    organization_id, member_id, requested_by_user_id, request_type,
    requester_verification_method, requester_verified, data_category,
    legal_basis, decision_outcome, triage_due_at, controller_justification
  ) values (
    p_organization_id, p_member_id, v_user, p_request_type,
    p_verification_method, coalesce(p_requester_verified, false), p_data_category,
    p_legal_basis, 'pending_triage', v_due, nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_req_id;

  insert into public.tenant_privacy_request_events (
    organization_id, request_id, actor_user_id, event_type, from_outcome, to_outcome, notes
  ) values (
    p_organization_id, v_req_id, v_user, 'registered', null, 'pending_triage',
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.subject_request_registered',
    'tenant_privacy_requests',
    v_req_id,
    jsonb_build_object(
      'request_type', p_request_type,
      'data_category', p_data_category,
      'requester_verified', coalesce(p_requester_verified, false),
      'triage_due_at', v_due
    ),
    'Registro de direito de titular LGPD D02/D03'
  );

  v_result := jsonb_build_object(
    'request_id', v_req_id,
    'organization_id', p_organization_id,
    'decision_outcome', 'pending_triage',
    'triage_due_at', v_due,
    'ledger_preserved', true
  );
  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.register_tenant_privacy_request_idempotent(uuid, uuid, text, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.register_tenant_privacy_request_idempotent(uuid, uuid, text, text, text, boolean, text, text, text) to authenticated;

create or replace function public.review_tenant_privacy_request_idempotent(
  p_organization_id uuid,
  p_request_id uuid,
  p_decision_outcome text,
  p_legal_basis text,
  p_requester_verified boolean,
  p_reidentification_risk_remains boolean,
  p_controller_justification text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_req public.tenant_privacy_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_assessment jsonb;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (
    private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'users.manage')
  ) then
    raise exception 'controller permission required to review privacy request' using errcode = '42501';
  end if;

  if p_decision_outcome not in ('fulfilled', 'pseudonymized', 'anonymized_verified', 'retained_by_law', 'rejected_unverified') then
    raise exception 'invalid decision outcome' using errcode = '22023';
  end if;
  if p_legal_basis not in ('legal_obligation_accounting', 'contract_execution', 'legitimate_interest', 'consent', 'exercise_of_rights') then
    raise exception 'invalid legal basis' using errcode = '22023';
  end if;
  if p_controller_justification is null or length(btrim(p_controller_justification)) not between 10 and 500 or private.m05_has_secret_pattern(p_controller_justification) then
    raise exception 'controller justification must be between 10 and 500 characters' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'review_tenant_privacy_request',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'request_id', p_request_id,
      'decision_outcome', p_decision_outcome,
      'legal_basis', p_legal_basis,
      'requester_verified', coalesce(p_requester_verified, false),
      'reidentification_risk_remains', coalesce(p_reidentification_risk_remains, true),
      'controller_justification', btrim(p_controller_justification)
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_req
  from public.tenant_privacy_requests
  where organization_id = p_organization_id
    and id = p_request_id
  for update;

  if not found then
    raise exception 'privacy request not found' using errcode = '23503';
  end if;
  if v_req.decision_outcome <> 'pending_triage' then
    raise exception 'privacy request already reviewed' using errcode = 'PT409';
  end if;

  if p_decision_outcome <> 'rejected_unverified' and not coalesce(p_requester_verified, false) then
    raise exception 'requester identity verification is mandatory before approval or retention execution' using errcode = '22023';
  end if;

  if v_req.data_category = 'financial_ledger'
     and v_req.request_type in ('anonymization', 'deletion')
     and p_decision_outcome in ('anonymized_verified', 'fulfilled') then
    raise exception 'immutable financial ledger cannot be erased; classify as retained_by_law or pseudonymized' using errcode = '55000';
  end if;

  if p_decision_outcome = 'anonymized_verified' and coalesce(p_reidentification_risk_remains, true) then
    raise exception 'cannot classify as anonymized_verified while reidentification risk remains; classify as pseudonymized' using errcode = '22023';
  end if;

  v_assessment := jsonb_build_object(
    'reidentification_risk_remains', coalesce(p_reidentification_risk_remains, true),
    'checked_surfaces', jsonb_build_array('members', 'charges_descriptions', 'attachments_metadata', 'audit_logs'),
    'classification_note', case
      when p_decision_outcome = 'pseudonymized' then 'Substituir nome por identificador não equivale à anonimização enquanto houver combinação reidentificável; proteção mantida.'
      when p_decision_outcome = 'anonymized_verified' then 'Sem risco residual de reidentificação na categoria não contábil avaliada; fatos financeiros preservados.'
      else 'Decisão de controlador registrada sem mutação de fatos contábeis imutáveis.'
    end
  );

  update public.tenant_privacy_requests
  set decision_outcome = p_decision_outcome,
      legal_basis = p_legal_basis,
      requester_verified = coalesce(p_requester_verified, false),
      triaged_at = v_now,
      reviewed_by_user_id = v_user,
      controller_justification = btrim(p_controller_justification),
      anonymization_assessment = v_assessment,
      ledger_preserved = true
  where id = v_req.id;

  -- D03: For pseudonymized outcome on cadastral/philosophical categories only,
  -- minimize non-ledger contact/philosophical attributes & deactivate access link,
  -- NEVER deleting member rows or touching financial ledger / audit facts.
  if p_decision_outcome = 'pseudonymized'
     and v_req.member_id is not null
     and v_req.data_category in ('cadastral', 'sensitive_philosophical') then
    update public.members
    set phone = null,
        whatsapp = null,
        email = null,
        notes = null,
        degree_or_office = null,
        status = 'disconnected'
    where organization_id = p_organization_id
      and id = v_req.member_id;

    delete from public.member_user_links
    where organization_id = p_organization_id
      and member_id = v_req.member_id;
  end if;

  insert into public.tenant_privacy_request_events (
    organization_id, request_id, actor_user_id, event_type, from_outcome, to_outcome, notes
  ) values (
    p_organization_id, v_req.id, v_user, 'reviewed', v_req.decision_outcome, p_decision_outcome,
    btrim(p_controller_justification)
  );

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'privacy.subject_request_reviewed',
    'tenant_privacy_requests',
    v_req.id,
    jsonb_build_object('decision_outcome', v_req.decision_outcome),
    jsonb_build_object(
      'decision_outcome', p_decision_outcome,
      'legal_basis', p_legal_basis,
      'ledger_preserved', true
    ),
    btrim(p_controller_justification)
  );

  v_result := jsonb_build_object(
    'request_id', v_req.id,
    'organization_id', p_organization_id,
    'decision_outcome', p_decision_outcome,
    'legal_basis', p_legal_basis,
    'triaged_at', v_now,
    'ledger_preserved', true,
    'anonymization_assessment', v_assessment
  );
  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.review_tenant_privacy_request_idempotent(uuid, uuid, text, text, boolean, boolean, text, text) from public, anon;
grant execute on function public.review_tenant_privacy_request_idempotent(uuid, uuid, text, text, boolean, boolean, text, text) to authenticated;

create or replace function public.list_tenant_privacy_requests(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_can_org boolean;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null then
    raise exception 'organization id required' using errcode = '22023';
  end if;

  v_can_org := private.has_permission(p_organization_id, 'settings.manage')
    or private.has_permission(p_organization_id, 'members.read');

  if not v_can_org and not exists (
    select 1 from public.member_user_links l
    where l.organization_id = p_organization_id and l.user_id = v_user
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'request_id', r.id,
        'organization_id', r.organization_id,
        'member_id', r.member_id,
        'request_type', r.request_type,
        'data_category', r.data_category,
        'requester_verification_method', r.requester_verification_method,
        'requester_verified', r.requester_verified,
        'legal_basis', r.legal_basis,
        'decision_outcome', r.decision_outcome,
        'triage_due_at', r.triage_due_at,
        'triaged_at', r.triaged_at,
        'controller_justification', r.controller_justification,
        'anonymization_assessment', r.anonymization_assessment,
        'ledger_preserved', r.ledger_preserved,
        'created_at', r.created_at
      )
      order by r.created_at desc
    )
    from public.tenant_privacy_requests r
    where r.organization_id = p_organization_id
      and (
        v_can_org
        or (r.member_id is not null and private.is_self_member(p_organization_id, r.member_id))
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_tenant_privacy_requests(uuid) from public, anon;
grant execute on function public.list_tenant_privacy_requests(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Entrega D — Backup & Recuperação (D04)
-- ----------------------------------------------------------------------------

create table if not exists public.saas_backup_restore_verifications (
  id uuid primary key default gen_random_uuid(),
  trial_scope text not null
    check (trial_scope in ('disposable_full_restore', 'disposable_selective_tenant_restore', 'storage_inventory_check')),
  target_env_label text not null check (length(btrim(target_env_label)) between 3 and 120),
  source_label text not null check (length(btrim(source_label)) between 3 and 120),
  rpo_target_hours integer not null default 24 check (rpo_target_hours = 24),
  rto_target_hours integer not null default 8 check (rto_target_hours = 8),
  observed_rpo_hours numeric(8,2) check (observed_rpo_hours is null or observed_rpo_hours >= 0),
  observed_rto_minutes numeric(8,2) check (observed_rto_minutes is null or observed_rto_minutes >= 0),
  backup_rotation_days integer not null check (backup_rotation_days between 1 and 35),
  selective_tenant_isolation_passed boolean not null default false,
  deleted_data_reintroduction_blocked boolean not null default false,
  verification_status text not null
    check (verification_status in ('target_unproven', 'verified_disposable', 'failed')),
  evidence_summary text not null check (length(btrim(evidence_summary)) between 5 and 500),
  recorded_by_user_id uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  check (lower(target_env_label) !~ '(prod|szqkdekwhzxsoxorgvaz|live)')
);

create trigger saas_backup_restore_verifications_immutable
  before update or delete on public.saas_backup_restore_verifications
  for each row execute function private.prevent_financial_mutation();

revoke all on table public.saas_backup_restore_verifications from public, anon, authenticated;
alter table public.saas_backup_restore_verifications enable row level security;
grant select on public.saas_backup_restore_verifications to authenticated;

create policy saas_backup_restore_verifications_select
  on public.saas_backup_restore_verifications
  for select to authenticated
  using (private.is_platform_staff('MASTER'));

create or replace function public.record_backup_restore_verification_idempotent(
  p_trial_scope text,
  p_target_env_label text,
  p_source_label text,
  p_observed_rpo_hours numeric,
  p_observed_rto_minutes numeric,
  p_backup_rotation_days integer,
  p_selective_tenant_isolation_passed boolean,
  p_deleted_data_reintroduction_blocked boolean,
  p_verification_status text,
  p_evidence_summary text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_id uuid;
  v_result jsonb;
begin
  perform private.require_platform_staff('MASTER');

  if p_trial_scope not in ('disposable_full_restore', 'disposable_selective_tenant_restore', 'storage_inventory_check') then
    raise exception 'invalid trial scope' using errcode = '22023';
  end if;
  if p_target_env_label is null or length(btrim(p_target_env_label)) not between 3 and 120 then
    raise exception 'invalid target env label' using errcode = '22023';
  end if;
  if lower(p_target_env_label) ~ '(prod|szqkdekwhzxsoxorgvaz|live)' then
    raise exception 'disposable verification only; production or DEV targets forbidden' using errcode = '42501';
  end if;
  if p_source_label is null or length(btrim(p_source_label)) not between 3 and 120 then
    raise exception 'invalid source label' using errcode = '22023';
  end if;
  if p_backup_rotation_days is null or p_backup_rotation_days not between 1 and 35 then
    raise exception 'backup rotation days must be between 1 and 35 per D04' using errcode = '22023';
  end if;
  if p_verification_status not in ('target_unproven', 'verified_disposable', 'failed') then
    raise exception 'invalid verification status' using errcode = '22023';
  end if;
  if p_evidence_summary is null or length(btrim(p_evidence_summary)) not between 5 and 500 or private.m05_has_secret_pattern(p_evidence_summary) then
    raise exception 'invalid or sensitive evidence summary' using errcode = '22023';
  end if;
  if p_verification_status = 'verified_disposable'
     and p_trial_scope = 'disposable_selective_tenant_restore'
     and (not coalesce(p_selective_tenant_isolation_passed, false) or not coalesce(p_deleted_data_reintroduction_blocked, false)) then
    raise exception 'selective restore verification requires isolation and reintroduction checks passed' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    'platform',
    'record_backup_restore_verification',
    p_idempotency_key,
    jsonb_build_object(
      'trial_scope', p_trial_scope,
      'target_env_label', btrim(p_target_env_label),
      'source_label', btrim(p_source_label),
      'backup_rotation_days', p_backup_rotation_days,
      'verification_status', p_verification_status,
      'evidence_summary', btrim(p_evidence_summary)
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_backup_restore_verifications (
    trial_scope, target_env_label, source_label, observed_rpo_hours, observed_rto_minutes,
    backup_rotation_days, selective_tenant_isolation_passed, deleted_data_reintroduction_blocked,
    verification_status, evidence_summary, recorded_by_user_id
  ) values (
    p_trial_scope, btrim(p_target_env_label), btrim(p_source_label), p_observed_rpo_hours, p_observed_rto_minutes,
    p_backup_rotation_days, coalesce(p_selective_tenant_isolation_passed, false), coalesce(p_deleted_data_reintroduction_blocked, false),
    p_verification_status, btrim(p_evidence_summary), v_user
  )
  returning id into v_id;

  insert into public.saas_master_audit_logs (
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, null, 'backup.restore_verification_recorded', 'saas_backup_restore_verifications', v_id::text,
    jsonb_build_object(
      'trial_scope', p_trial_scope,
      'verification_status', p_verification_status,
      'backup_rotation_days', p_backup_rotation_days
    )
  );

  v_result := jsonb_build_object(
    'verification_id', v_id,
    'trial_scope', p_trial_scope,
    'verification_status', p_verification_status,
    'rpo_target_hours', 24,
    'rto_target_hours', 8,
    'backup_rotation_days', p_backup_rotation_days
  );
  perform private.m05_idempotency_complete('platform', p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.record_backup_restore_verification_idempotent(text, text, text, numeric, numeric, integer, boolean, boolean, text, text, text) from public, anon;
grant execute on function public.record_backup_restore_verification_idempotent(text, text, text, numeric, numeric, integer, boolean, boolean, text, text, text) to authenticated;

create or replace function public.list_backup_restore_verifications(p_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');

  return coalesce((
    select jsonb_agg(row_json order by verified_at desc)
    from (
      select
        v.verified_at,
        jsonb_build_object(
          'id', v.id,
          'trial_scope', v.trial_scope,
          'target_env_label', v.target_env_label,
          'source_label', v.source_label,
          'rpo_target_hours', v.rpo_target_hours,
          'rto_target_hours', v.rto_target_hours,
          'observed_rpo_hours', v.observed_rpo_hours,
          'observed_rto_minutes', v.observed_rto_minutes,
          'backup_rotation_days', v.backup_rotation_days,
          'selective_tenant_isolation_passed', v.selective_tenant_isolation_passed,
          'deleted_data_reintroduction_blocked', v.deleted_data_reintroduction_blocked,
          'verification_status', v.verification_status,
          'evidence_summary', v.evidence_summary,
          'verified_at', v.verified_at
        ) as row_json
      from public.saas_backup_restore_verifications v
      order by v.verified_at desc
      limit least(greatest(coalesce(p_limit, 25), 1), 100)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_backup_restore_verifications(integer) from public, anon;
grant execute on function public.list_backup_restore_verifications(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Entrega E — Recuperação de Acesso & Revogação (D05)
-- ----------------------------------------------------------------------------

create table if not exists public.saas_access_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  target_user_id uuid not null references auth.users(id),
  account_tier text not null
    check (account_tier in ('tenant_admin', 'platform_master', 'platform_support', 'tenant_member')),
  recovery_kind text not null
    check (recovery_kind in ('mfa_reset_review', 'privileged_recovery', 'compromised_revocation')),
  status text not null
    check (status in ('pending_dual_evidence', 'approved_awaiting_owner_mfa', 'revoked_access', 'rejected')),
  evidence_primary_type text not null check (length(btrim(evidence_primary_type)) between 3 and 100),
  evidence_primary_ref text not null check (length(btrim(evidence_primary_ref)) between 3 and 160),
  evidence_secondary_type text,
  evidence_secondary_ref text,
  verified_by_primary uuid not null references auth.users(id),
  verified_by_secondary uuid references auth.users(id),
  requires_owner_mfa_reenroll boolean not null default true check (requires_owner_mfa_reenroll = true),
  notes text not null check (length(btrim(notes)) between 5 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verified_by_secondary is null or verified_by_secondary <> verified_by_primary)
);

create trigger saas_access_recovery_requests_set_updated_at
  before update on public.saas_access_recovery_requests
  for each row execute function private.set_updated_at();

revoke all on table public.saas_access_recovery_requests from public, anon, authenticated;
alter table public.saas_access_recovery_requests enable row level security;
grant select on public.saas_access_recovery_requests to authenticated;

create policy saas_access_recovery_requests_select
  on public.saas_access_recovery_requests
  for select to authenticated
  using (private.is_platform_staff('MASTER'));

create or replace function public.register_privileged_recovery_decision_idempotent(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_account_tier text,
  p_recovery_kind text,
  p_decision text,
  p_evidence_primary_type text,
  p_evidence_primary_ref text,
  p_evidence_secondary_type text,
  p_evidence_secondary_ref text,
  p_verified_by_secondary uuid,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_id uuid;
  v_result jsonb;
begin
  perform private.require_platform_staff('MASTER');

  if p_target_user_id is null then
    raise exception 'target user id required' using errcode = '22023';
  end if;
  if p_account_tier not in ('tenant_admin', 'platform_master', 'platform_support', 'tenant_member') then
    raise exception 'invalid account tier' using errcode = '22023';
  end if;
  if p_recovery_kind not in ('mfa_reset_review', 'privileged_recovery', 'compromised_revocation') then
    raise exception 'invalid recovery kind' using errcode = '22023';
  end if;
  if p_decision not in ('pending_dual_evidence', 'approved_awaiting_owner_mfa', 'rejected') then
    raise exception 'invalid decision status' using errcode = '22023';
  end if;
  if p_evidence_primary_type is null or length(btrim(p_evidence_primary_type)) < 3
     or p_evidence_primary_ref is null or length(btrim(p_evidence_primary_ref)) < 3 then
    raise exception 'primary evidence is required' using errcode = '22023';
  end if;
  if p_notes is null or length(btrim(p_notes)) not between 5 and 500 then
    raise exception 'notes must be between 5 and 500 characters' using errcode = '22023';
  end if;
  if private.m05_has_secret_pattern(p_evidence_primary_ref)
     or private.m05_has_secret_pattern(p_evidence_secondary_ref)
     or private.m05_has_secret_pattern(p_notes) then
    raise exception 'recovery records cannot contain passwords, OTPs, tokens or secrets' using errcode = '22023';
  end if;

  if p_decision = 'approved_awaiting_owner_mfa' then
    if p_verified_by_secondary is null or p_verified_by_secondary = v_user then
      raise exception 'dual verification by two distinct operators is required for privileged recovery' using errcode = '22023';
    end if;
    if p_evidence_secondary_type is null or length(btrim(p_evidence_secondary_type)) < 3
       or p_evidence_secondary_ref is null or length(btrim(p_evidence_secondary_ref)) < 3 then
      raise exception 'two distinct evidences are required for privileged recovery approval' using errcode = '22023';
    end if;
    if btrim(p_evidence_primary_type) = btrim(p_evidence_secondary_type)
       and btrim(p_evidence_primary_ref) = btrim(p_evidence_secondary_ref) then
      raise exception 'secondary evidence must differ from primary evidence' using errcode = '22023';
    end if;
  end if;

  v_existing := private.m05_idempotency_begin(
    coalesce(p_organization_id::text, 'platform'),
    'register_privileged_recovery_decision',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'target_user_id', p_target_user_id,
      'account_tier', p_account_tier,
      'recovery_kind', p_recovery_kind,
      'decision', p_decision,
      'evidence_primary_type', btrim(p_evidence_primary_type),
      'evidence_primary_ref', btrim(p_evidence_primary_ref),
      'verified_by_secondary', p_verified_by_secondary
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_access_recovery_requests (
    organization_id, target_user_id, account_tier, recovery_kind, status,
    evidence_primary_type, evidence_primary_ref,
    evidence_secondary_type, evidence_secondary_ref,
    verified_by_primary, verified_by_secondary,
    requires_owner_mfa_reenroll, notes
  ) values (
    p_organization_id, p_target_user_id, p_account_tier, p_recovery_kind, p_decision,
    btrim(p_evidence_primary_type), btrim(p_evidence_primary_ref),
    nullif(btrim(coalesce(p_evidence_secondary_type, '')), ''),
    nullif(btrim(coalesce(p_evidence_secondary_ref, '')), ''),
    v_user, p_verified_by_secondary,
    true, btrim(p_notes)
  )
  returning id into v_id;

  insert into public.saas_master_audit_logs (
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'access.recovery_decision_recorded', 'saas_access_recovery_requests', v_id::text,
    jsonb_build_object(
      'account_tier', p_account_tier,
      'recovery_kind', p_recovery_kind,
      'status', p_decision,
      'requires_owner_mfa_reenroll', true,
      'dual_verified', p_verified_by_secondary is not null
    )
  );

  v_result := jsonb_build_object(
    'recovery_id', v_id,
    'status', p_decision,
    'requires_owner_mfa_reenroll', true
  );
  perform private.m05_idempotency_complete(coalesce(p_organization_id::text, 'platform'), p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.register_privileged_recovery_decision_idempotent(uuid, uuid, text, text, text, text, text, text, text, uuid, text, text) from public, anon;
grant execute on function public.register_privileged_recovery_decision_idempotent(uuid, uuid, text, text, text, text, text, text, text, uuid, text, text) to authenticated;

create or replace function public.revoke_compromised_tenant_access_idempotent(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_revoked_roles integer := 0;
  v_revoked_links integer := 0;
  v_recovery_id uuid;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (
    private.is_platform_staff('MASTER')
    or private.has_permission(p_organization_id, 'users.manage')
  ) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if p_organization_id is null or not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found' using errcode = '23503';
  end if;
  if p_target_user_id is null then
    raise exception 'target user id required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 or private.m05_has_secret_pattern(p_reason) then
    raise exception 'valid sanitized reason required' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    p_organization_id::text,
    'revoke_compromised_tenant_access',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'target_user_id', p_target_user_id,
      'reason', btrim(p_reason)
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  delete from public.user_roles
  where organization_id = p_organization_id
    and user_id = p_target_user_id;
  get diagnostics v_revoked_roles = row_count;

  delete from public.member_user_links
  where organization_id = p_organization_id
    and user_id = p_target_user_id;
  get diagnostics v_revoked_links = row_count;

  insert into public.saas_access_recovery_requests (
    organization_id, target_user_id, account_tier, recovery_kind, status,
    evidence_primary_type, evidence_primary_ref,
    verified_by_primary, requires_owner_mfa_reenroll, notes
  ) values (
    p_organization_id, p_target_user_id, 'tenant_admin', 'compromised_revocation', 'revoked_access',
    'authorized_revocation_order', 'revocation:' || p_target_user_id::text,
    v_user, true, btrim(p_reason)
  )
  returning id into v_recovery_id;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data, reason
  ) values (
    p_organization_id,
    v_user,
    'access.compromised_tenant_access_revoked',
    'user_roles',
    p_target_user_id,
    jsonb_build_object(
      'revoked_roles_count', v_revoked_roles,
      'revoked_links_count', v_revoked_links,
      'requires_owner_mfa_reenroll', true
    ),
    btrim(p_reason)
  );

  if private.is_platform_staff('MASTER') then
    insert into public.saas_master_audit_logs (
      staff_user_id, organization_id, action, resource_type, resource_id, metadata
    ) values (
      v_user, p_organization_id, 'access.compromised_tenant_access_revoked', 'user_roles', p_target_user_id::text,
      jsonb_build_object(
        'revoked_roles_count', v_revoked_roles,
        'revoked_links_count', v_revoked_links,
        'recovery_id', v_recovery_id
      )
    );
  end if;

  v_result := jsonb_build_object(
    'recovery_id', v_recovery_id,
    'organization_id', p_organization_id,
    'target_user_id', p_target_user_id,
    'status', 'revoked_access',
    'revoked_roles_count', v_revoked_roles,
    'revoked_links_count', v_revoked_links,
    'requires_owner_mfa_reenroll', true
  );
  perform private.m05_idempotency_complete(p_organization_id::text, p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.revoke_compromised_tenant_access_idempotent(uuid, uuid, text, text) from public, anon;
grant execute on function public.revoke_compromised_tenant_access_idempotent(uuid, uuid, text, text) to authenticated;

create or replace function public.list_access_recovery_requests(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');

  return coalesce((
    select jsonb_agg(row_json order by created_at desc)
    from (
      select
        r.created_at,
        jsonb_build_object(
          'id', r.id,
          'organization_id', r.organization_id,
          'target_user_id', r.target_user_id,
          'account_tier', r.account_tier,
          'recovery_kind', r.recovery_kind,
          'status', r.status,
          'evidence_primary_type', r.evidence_primary_type,
          'evidence_primary_ref', r.evidence_primary_ref,
          'evidence_secondary_type', r.evidence_secondary_type,
          'evidence_secondary_ref', r.evidence_secondary_ref,
          'requires_owner_mfa_reenroll', r.requires_owner_mfa_reenroll,
          'notes', r.notes,
          'created_at', r.created_at
        ) as row_json
      from public.saas_access_recovery_requests r
      order by r.created_at desc
      limit least(greatest(coalesce(p_limit, 30), 1), 100)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_access_recovery_requests(integer) from public, anon;
grant execute on function public.list_access_recovery_requests(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Entrega F — Monitoramento & Incidentes (D06)
-- ----------------------------------------------------------------------------

create table if not exists public.saas_operational_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (category in ('availability', 'auth_authz', 'job_failure', 'backup_restore', 'privacy_security')),
  status text not null default 'open' check (status in ('open', 'investigating', 'mitigated', 'closed')),
  title text not null check (length(btrim(title)) between 4 and 180),
  sanitized_summary text not null check (length(btrim(sanitized_summary)) between 10 and 1000),
  operational_owner text not null default 'Michael',
  escalation_level text not null check (escalation_level in ('L1_ops', 'L2_engineering', 'L3_controller_legal')),
  tenant_notification_due_at timestamptz not null,
  tenant_notified_at timestamptz,
  retention_years integer not null default 5 check (retention_years >= 5),
  detected_at timestamptz not null default now(),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saas_operational_incidents_status_idx
  on public.saas_operational_incidents (status, severity, detected_at desc);

create trigger saas_operational_incidents_set_updated_at
  before update on public.saas_operational_incidents
  for each row execute function private.set_updated_at();

revoke all on table public.saas_operational_incidents from public, anon, authenticated;
alter table public.saas_operational_incidents enable row level security;
grant select on public.saas_operational_incidents to authenticated;

create policy saas_operational_incidents_select
  on public.saas_operational_incidents
  for select to authenticated
  using (private.is_platform_staff('MASTER'));

create table if not exists public.saas_operational_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  probe_interval_target_minutes integer not null default 5 check (probe_interval_target_minutes = 5),
  continuous_monitoring_active boolean not null default false,
  status text not null check (status in ('healthy', 'degraded', 'unconfigured')),
  error_code text,
  recorded_by_user_id uuid not null references auth.users(id),
  checked_at timestamptz not null default now()
);

create trigger saas_operational_health_snapshots_immutable
  before update or delete on public.saas_operational_health_snapshots
  for each row execute function private.prevent_financial_mutation();

revoke all on table public.saas_operational_health_snapshots from public, anon, authenticated;
alter table public.saas_operational_health_snapshots enable row level security;
grant select on public.saas_operational_health_snapshots to authenticated;

create policy saas_operational_health_snapshots_select
  on public.saas_operational_health_snapshots
  for select to authenticated
  using (private.is_platform_staff('MASTER'));

create or replace function public.record_operational_incident_idempotent(
  p_organization_id uuid,
  p_severity text,
  p_category text,
  p_title text,
  p_sanitized_summary text,
  p_escalation_level text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_detected timestamptz := clock_timestamp();
  v_due timestamptz := v_detected + interval '24 hours';
  v_id uuid;
  v_result jsonb;
begin
  perform private.require_platform_staff('MASTER');

  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'invalid severity' using errcode = '22023';
  end if;
  if p_category not in ('availability', 'auth_authz', 'job_failure', 'backup_restore', 'privacy_security') then
    raise exception 'invalid category' using errcode = '22023';
  end if;
  if p_escalation_level not in ('L1_ops', 'L2_engineering', 'L3_controller_legal') then
    raise exception 'invalid escalation level' using errcode = '22023';
  end if;
  if p_title is null or length(btrim(p_title)) not between 4 and 180 then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  if p_sanitized_summary is null or length(btrim(p_sanitized_summary)) not between 10 and 1000 then
    raise exception 'invalid summary' using errcode = '22023';
  end if;
  if private.m05_has_secret_pattern(p_title)
     or private.m05_has_secret_pattern(p_sanitized_summary)
     or btrim(p_sanitized_summary) ~ '[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}' then
    raise exception 'incident summaries must not include secrets, credentials or CPF/PII' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    coalesce(p_organization_id::text, 'platform'),
    'record_operational_incident',
    p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'severity', p_severity,
      'category', p_category,
      'title', btrim(p_title),
      'sanitized_summary', btrim(p_sanitized_summary),
      'escalation_level', p_escalation_level
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_operational_incidents (
    organization_id, severity, category, status, title, sanitized_summary,
    operational_owner, escalation_level, tenant_notification_due_at,
    retention_years, detected_at, created_by_user_id
  ) values (
    p_organization_id, p_severity, p_category, 'open', btrim(p_title), btrim(p_sanitized_summary),
    'Michael', p_escalation_level, v_due, 5, v_detected, v_user
  )
  returning id into v_id;

  insert into public.saas_master_audit_logs (
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, p_organization_id, 'security.incident_recorded', 'saas_operational_incidents', v_id::text,
    jsonb_build_object(
      'severity', p_severity,
      'category', p_category,
      'escalation_level', p_escalation_level,
      'tenant_notification_due_at', v_due
    )
  );

  v_result := jsonb_build_object(
    'incident_id', v_id,
    'status', 'open',
    'severity', p_severity,
    'operational_owner', 'Michael',
    'tenant_notification_due_at', v_due,
    'retention_years', 5,
    'external_legal_notice_automated', false
  );
  perform private.m05_idempotency_complete(coalesce(p_organization_id::text, 'platform'), p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.record_operational_incident_idempotent(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.record_operational_incident_idempotent(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.update_operational_incident_status_idempotent(
  p_incident_id uuid,
  p_next_status text,
  p_mark_tenant_notified boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_inc public.saas_operational_incidents%rowtype;
  v_notified timestamptz;
  v_result jsonb;
begin
  perform private.require_platform_staff('MASTER');

  if p_next_status not in ('open', 'investigating', 'mitigated', 'closed') then
    raise exception 'invalid incident status' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    'platform',
    'update_operational_incident_status',
    p_idempotency_key,
    jsonb_build_object(
      'incident_id', p_incident_id,
      'next_status', p_next_status,
      'mark_tenant_notified', coalesce(p_mark_tenant_notified, false)
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_inc
  from public.saas_operational_incidents
  where id = p_incident_id
  for update;

  if not found then
    raise exception 'incident not found' using errcode = '23503';
  end if;

  v_notified := case
    when coalesce(p_mark_tenant_notified, false) then coalesce(v_inc.tenant_notified_at, clock_timestamp())
    else v_inc.tenant_notified_at
  end;

  update public.saas_operational_incidents
  set status = p_next_status,
      tenant_notified_at = v_notified
  where id = p_incident_id;

  insert into public.saas_master_audit_logs (
    staff_user_id, organization_id, action, resource_type, resource_id, metadata
  ) values (
    v_user, v_inc.organization_id, 'security.incident_status_updated', 'saas_operational_incidents', p_incident_id::text,
    jsonb_build_object('from_status', v_inc.status, 'to_status', p_next_status, 'tenant_notified', v_notified is not null)
  );

  v_result := jsonb_build_object(
    'incident_id', p_incident_id,
    'status', p_next_status,
    'tenant_notified_at', v_notified
  );
  perform private.m05_idempotency_complete('platform', p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.update_operational_incident_status_idempotent(uuid, text, boolean, text) from public, anon;
grant execute on function public.update_operational_incident_status_idempotent(uuid, text, boolean, text) to authenticated;

create or replace function public.list_operational_incidents(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff('MASTER');

  return coalesce((
    select jsonb_agg(row_json order by detected_at desc)
    from (
      select
        i.detected_at,
        jsonb_build_object(
          'id', i.id,
          'organization_id', i.organization_id,
          'severity', i.severity,
          'category', i.category,
          'status', i.status,
          'title', i.title,
          'sanitized_summary', i.sanitized_summary,
          'operational_owner', i.operational_owner,
          'escalation_level', i.escalation_level,
          'tenant_notification_due_at', i.tenant_notification_due_at,
          'tenant_notified_at', i.tenant_notified_at,
          'retention_years', i.retention_years,
          'detected_at', i.detected_at
        ) as row_json
      from public.saas_operational_incidents i
      order by i.detected_at desc
      limit least(greatest(coalesce(p_limit, 30), 1), 100)
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_operational_incidents(integer) from public, anon;
grant execute on function public.list_operational_incidents(integer) to authenticated;

create or replace function public.record_operational_health_snapshot_idempotent(
  p_status text,
  p_continuous_monitoring_active boolean,
  p_error_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing jsonb;
  v_id uuid;
  v_result jsonb;
begin
  perform private.require_platform_staff('MASTER');

  if p_status not in ('healthy', 'degraded', 'unconfigured') then
    raise exception 'invalid health status' using errcode = '22023';
  end if;
  if p_error_code is not null and private.m05_has_secret_pattern(p_error_code) then
    raise exception 'invalid error code' using errcode = '22023';
  end if;

  v_existing := private.m05_idempotency_begin(
    'platform',
    'record_operational_health_snapshot',
    p_idempotency_key,
    jsonb_build_object(
      'status', p_status,
      'continuous_monitoring_active', coalesce(p_continuous_monitoring_active, false),
      'error_code', p_error_code
    )
  );
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.saas_operational_health_snapshots (
    probe_interval_target_minutes, continuous_monitoring_active, status, error_code, recorded_by_user_id
  ) values (
    5, coalesce(p_continuous_monitoring_active, false), p_status, nullif(btrim(coalesce(p_error_code, '')), ''), v_user
  )
  returning id into v_id;

  v_result := jsonb_build_object(
    'snapshot_id', v_id,
    'status', p_status,
    'probe_interval_target_minutes', 5,
    'continuous_monitoring_active', coalesce(p_continuous_monitoring_active, false)
  );
  perform private.m05_idempotency_complete('platform', p_idempotency_key, v_result);
  return v_result;
end;
$$;

revoke all on function public.record_operational_health_snapshot_idempotent(text, boolean, text, text) from public, anon;
grant execute on function public.record_operational_health_snapshot_idempotent(text, boolean, text, text) to authenticated;

create or replace function public.read_master_operational_security_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_failed_jobs integer := 0;
  v_open_incidents integer := 0;
  v_critical_incidents integer := 0;
  v_overdue_notifications integer := 0;
  v_pending_recovery integer := 0;
  v_revoked_access integer := 0;
  v_latest_backup jsonb;
  v_latest_probe jsonb;
begin
  perform private.require_platform_staff('MASTER');

  select count(*) into v_failed_jobs
  from public.saas_jobs j
  where j.status = 'failed'
    and j.created_at >= clock_timestamp() - interval '24 hours';

  select
    count(*) filter (where i.status <> 'closed'),
    count(*) filter (where i.status <> 'closed' and i.severity = 'critical'),
    count(*) filter (where i.status <> 'closed' and i.tenant_notified_at is null and i.tenant_notification_due_at < clock_timestamp())
  into v_open_incidents, v_critical_incidents, v_overdue_notifications
  from public.saas_operational_incidents i;

  select
    count(*) filter (where r.status = 'pending_dual_evidence'),
    count(*) filter (where r.status = 'revoked_access')
  into v_pending_recovery, v_revoked_access
  from public.saas_access_recovery_requests r;

  select jsonb_build_object(
    'trial_scope', v.trial_scope,
    'verification_status', v.verification_status,
    'backup_rotation_days', v.backup_rotation_days,
    'rpo_target_hours', v.rpo_target_hours,
    'rto_target_hours', v.rto_target_hours,
    'verified_at', v.verified_at
  )
  into v_latest_backup
  from public.saas_backup_restore_verifications v
  order by v.verified_at desc
  limit 1;

  select jsonb_build_object(
    'status', s.status,
    'continuous_monitoring_active', s.continuous_monitoring_active,
    'probe_interval_target_minutes', s.probe_interval_target_minutes,
    'error_code', s.error_code,
    'checked_at', s.checked_at
  )
  into v_latest_probe
  from public.saas_operational_health_snapshots s
  order by s.checked_at desc
  limit 1;

  return jsonb_build_object(
    'operational_owner', 'Michael',
    'probe_interval_target_minutes', 5,
    'continuous_monitoring_active', coalesce((v_latest_probe->>'continuous_monitoring_active')::boolean, false),
    'external_legal_notice_automated', false,
    'failed_jobs_24h', v_failed_jobs,
    'open_incidents', v_open_incidents,
    'critical_incidents', v_critical_incidents,
    'overdue_24h_notifications', v_overdue_notifications,
    'pending_recovery_reviews', v_pending_recovery,
    'revoked_compromised_accounts', v_revoked_access,
    'latest_backup_verification', coalesce(v_latest_backup, jsonb_build_object(
      'verification_status', 'target_unproven',
      'rpo_target_hours', 24,
      'rto_target_hours', 8,
      'backup_rotation_days', 35
    )),
    'latest_health_probe', coalesce(v_latest_probe, jsonb_build_object(
      'status', 'unconfigured',
      'continuous_monitoring_active', false,
      'probe_interval_target_minutes', 5
    ))
  );
end;
$$;

revoke all on function public.read_master_operational_security_overview() from public, anon;
grant execute on function public.read_master_operational_security_overview() to authenticated;

commit;
