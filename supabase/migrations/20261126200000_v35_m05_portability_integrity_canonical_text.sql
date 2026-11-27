begin;

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
  v_payload_text text;
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

  if v_exp.payload_json is null
     or v_exp.payload_sha256 is null
     or v_exp.payload_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'portability export payload integrity metadata missing' using errcode = '55000';
  end if;

  v_payload_text := v_exp.payload_json::text;
  if private.m05_sha256_hex(v_payload_text) <> lower(v_exp.payload_sha256) then
    raise exception 'portability export payload digest mismatch' using errcode = '55000';
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
      'payload_sha256', v_exp.payload_sha256,
      'payload_text_format', 'pg_jsonb_text_v1'
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
    'payload_text_format', 'pg_jsonb_text_v1',
    'payload_text', v_payload_text,
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

commit;
