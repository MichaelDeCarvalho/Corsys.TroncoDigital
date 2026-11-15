-- Verification test (with rollback) for 20261115120000_v35_tenant_timezone_financial_dates.sql (ADR-0048)
begin;

do $$
declare
  v_org_sp uuid := '10000000-0000-4000-8000-000000000101';
  v_org_am uuid := '10000000-0000-4000-8000-000000000102';
  v_org_ac uuid := '10000000-0000-4000-8000-000000000103';
  v_org_utc uuid := '10000000-0000-4000-8000-000000000104';
  v_rollover_ts timestamptz := '2026-11-14 00:11:00+00'; -- 2026-11-13 21:11:00 BRT
  v_am_rollover_ts timestamptz := '2026-11-14 03:30:00+00'; -- 2026-11-14 00:30:00 BRT, 2026-11-13 23:30:00 AMT
  v_ac_rollover_ts timestamptz := '2026-11-14 04:30:00+00'; -- 2026-11-14 00:30:00 AMT, 2026-11-13 23:30:00 ACT
begin
  -- 1. Validação de IANA timezones permitidos (allowlist pg_timezone_names + formato canônico)
  assert private.is_valid_iana_timezone('America/Sao_Paulo') is true, 'America/Sao_Paulo must be valid';
  assert private.is_valid_iana_timezone('America/Manaus') is true, 'America/Manaus must be valid';
  assert private.is_valid_iana_timezone('America/Rio_Branco') is true, 'America/Rio_Branco must be valid';
  assert private.is_valid_iana_timezone('America/Noronha') is true, 'America/Noronha must be valid';
  assert private.is_valid_iana_timezone('UTC') is true, 'UTC must be valid';

  assert private.is_valid_iana_timezone(null) is false, 'NULL timezone must be rejected';
  assert private.is_valid_iana_timezone('') is false, 'Empty timezone must be rejected';
  assert private.is_valid_iana_timezone(' America/Sao_Paulo ') is false, 'Padded timezone must be rejected';
  assert private.is_valid_iana_timezone('localtime') is false, 'localtime must be rejected';
  assert private.is_valid_iana_timezone('posixrules') is false, 'posixrules must be rejected';
  assert private.is_valid_iana_timezone('-03:00') is false, 'Raw numeric offset must be rejected';
  assert private.is_valid_iana_timezone('Invalid/Zone_Name') is false, 'Unknown timezone must be rejected';

  -- 2. Criar organizações temporárias com diferentes fusos horários
  insert into public.organizations (id, name, number, status)
  values
    (v_org_sp, 'Loja São Paulo', '9101', 'active'),
    (v_org_am, 'Loja Manaus', '9102', 'active'),
    (v_org_ac, 'Loja Rio Branco', '9103', 'active'),
    (v_org_utc, 'Loja UTC', '9104', 'active');

  -- Sem linha em organization_settings -> fallback seguro 'America/Sao_Paulo'
  assert private.tenant_current_date_at(v_org_sp, v_rollover_ts) = date '2026-11-13',
    'Missing organization_settings must default to America/Sao_Paulo (2026-11-13 at 21:11 BRT)';

  insert into public.organization_settings (organization_id, timezone)
  values
    (v_org_sp, 'America/Sao_Paulo'),
    (v_org_am, 'America/Manaus'),
    (v_org_ac, 'America/Rio_Branco'),
    (v_org_utc, 'UTC');

  -- 3. Virada de dia UTC vs fusos brasileiros (21:11 BRT = 00:11 UTC)
  assert private.tenant_current_date_at(v_org_sp, v_rollover_ts) = date '2026-11-13',
    'Sao_Paulo must remain on 2026-11-13 at 00:11 UTC (21:11 BRT)';
  assert private.tenant_current_date_at(v_org_am, v_rollover_ts) = date '2026-11-13',
    'Manaus must remain on 2026-11-13 at 00:11 UTC (20:11 AMT)';
  assert private.tenant_current_date_at(v_org_ac, v_rollover_ts) = date '2026-11-13',
    'Rio_Branco must remain on 2026-11-13 at 00:11 UTC (19:11 ACT)';
  assert private.tenant_current_date_at(v_org_utc, v_rollover_ts) = date '2026-11-14',
    'UTC tenant must advance to 2026-11-14 at 00:11 UTC';

  -- Diferença entre São Paulo (UTC-3) e Manaus (UTC-4) às 03:30 UTC
  assert private.tenant_current_date_at(v_org_sp, v_am_rollover_ts) = date '2026-11-14',
    'Sao_Paulo must be 2026-11-14 at 03:30 UTC (00:30 BRT)';
  assert private.tenant_current_date_at(v_org_am, v_am_rollover_ts) = date '2026-11-13',
    'Manaus must still be 2026-11-13 at 03:30 UTC (23:30 AMT)';

  -- Diferença entre Manaus (UTC-4) e Rio Branco (UTC-5) às 04:30 UTC
  assert private.tenant_current_date_at(v_org_am, v_ac_rollover_ts) = date '2026-11-14',
    'Manaus must be 2026-11-14 at 04:30 UTC (00:30 AMT)';
  assert private.tenant_current_date_at(v_org_ac, v_ac_rollover_ts) = date '2026-11-13',
    'Rio_Branco must still be 2026-11-13 at 04:30 UTC (23:30 ACT)';

  -- 4. Impedir configuração de timezone inválido em organization_settings (fail-closed 22023)
  begin
    update public.organization_settings
    set timezone = 'Invalid/Timezone'
    where organization_id = v_org_sp;
    raise exception 'Expected invalid timezone update to fail';
  exception
    when sqlstate '22023' or sqlstate '23514' then
      null;
  end;
end $$;

rollback;
