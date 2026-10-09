-- DEV 20261009012944, identity/PIX/contact write behind settings.manage. No changes to RLS or ledger.
CREATE OR REPLACE FUNCTION public.save_tenant_identity(p_organization_id uuid, p_expected_updated_at timestamp with time zone, p_phone text, p_email text, p_pix_key text, p_address text, p_postal_code text, p_city text, p_state_code text, p_country_code text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_id uuid;
 v_current public.organization_settings%rowtype;
 v_exists boolean;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or length(coalesce(p_phone,''))>40 or length(coalesce(p_email,''))>254
  or length(coalesce(p_pix_key,''))>150 or length(coalesce(p_address,''))>500
  or length(coalesce(p_postal_code,''))>20 or length(coalesce(p_city,''))>120
  or (p_state_code is not null and (p_state_code !~ '^[A-Z]{2}$'))
  or p_country_code is null or p_country_code !~ '^[A-Z]{2}$'
  or (p_email is not null and p_email<>'' and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
 then raise exception 'invalid tenant identity input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'save_tenant_identity',p_idempotency_key,
  jsonb_build_object('expected',p_expected_updated_at,'phone',p_phone,'email',p_email,
  'pix',p_pix_key,'address',p_address,'postal',p_postal_code,'city',p_city,
  'state',p_state_code,'country',p_country_code,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 -- Lock the tenant to serialize first creation as well as edits.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503'; end if;
 select * into v_current from public.organization_settings
  where organization_id=p_organization_id for update;
 v_exists:=found;
 if v_exists then
  if p_expected_updated_at is null or v_current.updated_at is distinct from p_expected_updated_at then
   raise exception 'tenant identity revision conflict' using errcode='40001'; end if;
  update public.organization_settings set
    phone=nullif(btrim(p_phone),''),email=nullif(btrim(p_email),''),
    pix_key=nullif(btrim(p_pix_key),''),address=nullif(btrim(p_address),''),
    postal_code=nullif(btrim(p_postal_code),''),city=nullif(btrim(p_city),''),
    state_code=p_state_code,country_code=p_country_code,
    updated_at=greatest(clock_timestamp(),v_current.updated_at+interval '1 microsecond')
  where organization_id=p_organization_id;
 else
  if p_expected_updated_at is not null then raise exception 'tenant identity created concurrently' using errcode='40001';end if;
  insert into public.organization_settings(organization_id,phone,email,pix_key,address,postal_code,city,state_code,country_code)
  values(p_organization_id,nullif(btrim(p_phone),''),nullif(btrim(p_email),''),
    nullif(btrim(p_pix_key),''),nullif(btrim(p_address),''),
    nullif(btrim(p_postal_code),''),nullif(btrim(p_city),''),p_state_code,p_country_code);
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,
  before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'organization.identity_save','organization_settings',p_organization_id,
  jsonb_build_object('existed',v_exists,'expected_updated_at',p_expected_updated_at),
  jsonb_build_object('fields',jsonb_build_array('phone','email','pix_key','address','postal_code','city','state_code','country_code')),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_organization_id);
 return p_organization_id;
end $function$
;
revoke all on function public.save_tenant_identity(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_tenant_identity(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text) to authenticated;
