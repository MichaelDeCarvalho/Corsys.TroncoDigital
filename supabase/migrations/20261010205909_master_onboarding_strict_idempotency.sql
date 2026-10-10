-- DEV V35: protect Master onboarding draft keys against payload collisions.
-- The legacy draft command's ON CONFLICT updates updated_at but does not compare payload.
create or replace function public.create_master_onboarding_draft_idempotent(
 p_idempotency_key text,p_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_name text;v_number text;v_admin text;v_admin_email text;v_billing_email text;
 v_invite text;v_slug text;v_city text;v_state text;v_plan uuid;
 v_price numeric;v_start date;v_trial integer;v_id uuid;
 v_record public.saas_onboarding_runs%rowtype;
 v_payload jsonb;v_record_payload jsonb;
begin
 perform private.require_platform_staff('MASTER');
 if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or p_payload is null or jsonb_typeof(p_payload)<>'object'
 then raise exception 'invalid Master draft idempotency payload' using errcode='22023';end if;
 v_name:=btrim(p_payload->>'prospective_name');
 v_number:=btrim(p_payload->>'organization_number');
 v_admin:=btrim(p_payload->>'admin_name');
 v_admin_email:=btrim(p_payload->>'admin_email');
 v_billing_email:=btrim(p_payload->>'billing_email');
 v_invite:=btrim(p_payload->>'invite_email');
 v_slug:=lower(btrim(p_payload->>'tenant_slug'));
 v_city:=nullif(btrim(p_payload->>'city'),'');
 v_state:=nullif(upper(btrim(p_payload->>'state_code')),'');
 if coalesce(length(v_name),0) not between 3 and 180
 or coalesce(length(v_number),0) not between 1 and 40
 or coalesce(length(v_admin),0) not between 3 and 140
 or coalesce(length(v_admin_email),0) not between 5 and 254
 or coalesce(length(v_billing_email),0) not between 5 and 254
 or coalesce(length(v_invite),0) not between 5 and 254
 or v_admin_email not like '%@%.%' or v_billing_email not like '%@%.%'
 or v_invite not like '%@%.%' or v_slug !~ '^[a-z0-9][a-z0-9-]{2,60}$'
 or (v_state is not null and v_state !~ '^[A-Z]{2}$')
 or (v_city is not null and length(v_city)>140)
 or coalesce(p_payload->>'contract_price','') !~ '^\d{1,12}(\.\d{1,2})?$'
 or coalesce(p_payload->>'trial_days','') !~ '^\d{1,3}$'
 or coalesce(p_payload->>'subscription_start','') !~ '^\d{4}-\d{2}-\d{2}$'
 or coalesce(p_payload->>'plan_version_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then raise exception 'invalid Master onboarding draft fields' using errcode='22023';end if;
 v_plan:=(p_payload->>'plan_version_id')::uuid;
 v_price:=(p_payload->>'contract_price')::numeric;
 v_start:=(p_payload->>'subscription_start')::date;
 v_trial:=(p_payload->>'trial_days')::integer;
 if v_price>999999999999.99 or v_trial>365 then raise exception 'invalid draft price/trial' using errcode='22023';end if;
 v_payload:=jsonb_build_object('prospective_name',v_name,'organization_number',v_number,
  'admin_name',v_admin,'admin_email',v_admin_email,'billing_email',v_billing_email,
  'invite_email',v_invite,'tenant_slug',v_slug,'city',v_city,'state_code',v_state,
  'plan_version_id',v_plan,'contract_price',v_price,'subscription_start',v_start,
  'trial_days',v_trial,'initial_role','ADMIN','initial_accounting_plan_mode','blank',
  'terms_acceptance_required',true);
 perform pg_advisory_xact_lock(hashtextextended('master-draft:'||btrim(p_idempotency_key),0));
 select * into v_record from public.saas_onboarding_runs
  where idempotency_key=btrim(p_idempotency_key) for update;
 if found then
  v_record_payload:=jsonb_build_object(
   'prospective_name',v_record.prospective_name,
   'organization_number',v_record.organization_number,
   'admin_name',v_record.admin_name,'admin_email',v_record.admin_email,
   'billing_email',v_record.billing_email,'invite_email',v_record.invite_email,
   'tenant_slug',v_record.tenant_slug,'city',v_record.city,'state_code',v_record.state_code,
   'plan_version_id',v_record.plan_version_id,'contract_price',v_record.contract_price,
   'subscription_start',v_record.subscription_start,'trial_days',v_record.trial_days,
   'initial_role',v_record.initial_role,'initial_accounting_plan_mode',v_record.initial_accounting_plan_mode,
   'terms_acceptance_required',v_record.terms_acceptance_required);
  if v_record.status<>'draft' or v_payload<>v_record_payload
   then raise exception 'Master onboarding key reused for different payload or state' using errcode='22023';end if;
  return v_record.id;
 end if;
 v_id:=public.save_saas_onboarding_draft(null,btrim(p_idempotency_key),'commercial',
  v_name,v_number,null,v_city,v_state,v_admin,v_admin_email,v_billing_email,null,
  v_plan,v_price,v_start,v_trial,v_slug,'ADMIN','blank',v_invite,true);
 return v_id;
end $$;
revoke all on function public.create_master_onboarding_draft_idempotent(text,jsonb) from PUBLIC,anon,authenticated;
grant execute on function public.create_master_onboarding_draft_idempotent(text,jsonb) to authenticated;
