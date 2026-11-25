begin;

-- Owner approval A04/E03. Only the platform identity singleton can change here;
-- commercial policy, legal versions, contracts and secrets are excluded.
create or replace function public.save_platform_identity(
  p_identity jsonb,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.saas_platform_configuration%rowtype;
  v_data jsonb := '{}'::jsonb;
  v_key text;
  v_value text;
  v_timestamp timestamptz;
  v_fields text[] := array['trade_name','legal_name','tax_id','postal_code','address_line','city','state_code','billing_email','support_email','support_phone'];
  v_changed text[];
begin
  perform private.require_platform_staff('MASTER');
  if p_identity is null or jsonb_typeof(p_identity) <> 'object'
    or p_expected_updated_at is null or p_reason is null
    or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'invalid platform identity input' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_identity)) <> cardinality(v_fields)
    or exists(select 1 from jsonb_object_keys(p_identity) k where not (k = any(v_fields))) then
    raise exception 'identity fields must match the allowlist' using errcode = '22023';
  end if;
  foreach v_key in array v_fields loop
    if jsonb_typeof(p_identity -> v_key) not in ('string','null') then
      raise exception 'invalid identity field type' using errcode = '22023';
    end if;
    v_value := nullif(btrim(p_identity ->> v_key), '');
    if length(v_value) > 240 or v_value ~ '[[:cntrl:]]' then
      raise exception 'invalid identity field value' using errcode = '22023';
    end if;
    if v_key = 'tax_id' then
      v_value := upper(regexp_replace(v_value, '[./-]', '', 'g'));
      -- Accept numeric and 2026 alphanumeric CNPJ formats; this is not a
      -- registry lookup or certification of the identifier's legal validity.
      if v_value is not null and v_value !~ '^[A-Z0-9]{12}[0-9]{2}$' then
        raise exception 'invalid CNPJ format' using errcode = '22023';
      end if;
    elsif v_key = 'postal_code' then
      v_value := replace(v_value, '-', '');
      if v_value is not null and v_value !~ '^[0-9]{8}$' then
        raise exception 'invalid postal code format' using errcode = '22023';
      end if;
    elsif v_key = 'state_code' then
      v_value := upper(v_value);
      if v_value is not null and not (v_value = any(array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) then
        raise exception 'invalid state code' using errcode = '22023';
      end if;
    elsif v_key in ('billing_email','support_email') then
      if v_value is not null and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'invalid email format' using errcode = '22023';
      end if;
    end if;
    v_data := v_data || jsonb_build_object(v_key, v_value);
  end loop;
  if v_data ->> 'trade_name' is null then
    raise exception 'trade name required' using errcode = '22023';
  end if;
  select * into v_old from public.saas_platform_configuration where singleton for update;
  if not found then
    raise exception 'platform configuration missing' using errcode = '55000';
  end if;
  if v_old.updated_at <> p_expected_updated_at then
    raise exception 'configuration changed; reload before editing' using errcode = 'PT409';
  end if;
  select array_agg(k order by k) into v_changed
    from unnest(v_fields) k where (to_jsonb(v_old) -> k) is distinct from (v_data -> k);
  if v_changed is null then return v_old.updated_at; end if;
  update public.saas_platform_configuration set
    trade_name = v_data ->> 'trade_name', legal_name = v_data ->> 'legal_name',
    tax_id = v_data ->> 'tax_id', postal_code = v_data ->> 'postal_code',
    address_line = v_data ->> 'address_line', city = v_data ->> 'city',
    state_code = v_data ->> 'state_code', billing_email = v_data ->> 'billing_email',
    support_email = v_data ->> 'support_email', support_phone = v_data ->> 'support_phone',
    updated_by = auth.uid()
  where singleton returning updated_at into v_timestamp;
  insert into public.saas_master_audit_logs(staff_user_id,action,resource_type,resource_id,metadata)
  values (auth.uid(),'platform.identity.updated','platform_configuration','singleton',
    jsonb_build_object('changed_fields',to_jsonb(v_changed),'reason',btrim(p_reason)));
  return v_timestamp;
end;
$$;
revoke all on function public.save_platform_identity(jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.save_platform_identity(jsonb,timestamptz,text) to authenticated;

commit;
