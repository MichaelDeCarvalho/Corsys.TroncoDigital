-- Applied DEV migration 20261009011416; only authorized catalogs; no financial facts or table privileges altered.
CREATE OR REPLACE FUNCTION public.create_treasury_catalog_item(p_organization_id uuid, p_kind text, p_name text, p_account_type text, p_institution text, p_identification text, p_description text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_name text;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_name:=btrim(p_name);
 if p_kind is null or p_kind not in ('account','fund','method')
  or v_name is null or length(v_name) not between 1 and 120
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or length(coalesce(p_institution,''))>120 or length(coalesce(p_identification,''))>120
  or length(coalesce(p_description,''))>1000
  or (p_kind='account' and (p_account_type is null or p_account_type not in ('bank','pix','cash','other') or p_description is not null))
  or (p_kind<>'account' and (p_account_type is not null or p_institution is not null or p_identification is not null))
  or (p_kind='method' and p_description is not null)
 then raise exception 'invalid treasury catalog data' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_treasury_catalog_item',p_idempotency_key,
  jsonb_build_object('kind',p_kind,'name',v_name,'type',p_account_type,
   'institution',nullif(btrim(p_institution),''),
   'identification',nullif(btrim(p_identification),''),
   'description',nullif(btrim(p_description),''),
   'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':treasury:'||p_kind||':'||lower(v_name),0));
 if p_kind='account' then
  if exists(select 1 from public.financial_accounts where organization_id=p_organization_id and lower(btrim(name))=lower(v_name))
    then raise exception 'duplicate treasury catalog name' using errcode='23505'; end if;
  insert into public.financial_accounts(organization_id,name,account_type,institution,identification)
   values(p_organization_id,v_name,p_account_type,nullif(btrim(p_institution),''),nullif(btrim(p_identification),''))
   returning id into v_id;
 elsif p_kind='fund' then
  if exists(select 1 from public.funds where organization_id=p_organization_id and lower(btrim(name))=lower(v_name))
    then raise exception 'duplicate treasury catalog name' using errcode='23505'; end if;
  insert into public.funds(organization_id,name,description)
   values(p_organization_id,v_name,nullif(btrim(p_description),''))
   returning id into v_id;
 else
  if exists(select 1 from public.payment_methods where organization_id=p_organization_id and lower(btrim(name))=lower(v_name))
    then raise exception 'duplicate treasury catalog name' using errcode='23505'; end if;
  insert into public.payment_methods(organization_id,name) values(p_organization_id,v_name)
   returning id into v_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
  values(p_organization_id,auth.uid(),'treasury_catalog.create',p_kind,v_id,
   jsonb_build_object('name',v_name,'type',p_account_type,'active',true),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_treasury_catalog_status(p_organization_id uuid, p_kind text, p_item_id uuid, p_expected_active boolean, p_new_active boolean, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_old boolean; v_table text;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_kind is null or p_kind not in ('account','fund','method')
  or p_item_id is null or p_expected_active is null or p_new_active is null
  or p_expected_active=p_new_active
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid treasury status change' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'set_treasury_catalog_status',p_idempotency_key,
  jsonb_build_object('kind',p_kind,'item',p_item_id,'expected',p_expected_active,'new',p_new_active,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 v_table:=case p_kind when 'account' then 'financial_accounts' when 'fund' then 'funds' else 'payment_methods' end;
 execute format('select active from public.%I where organization_id=$1 and id=$2 for update',v_table)
  into v_old using p_organization_id,p_item_id;
 if not found then raise exception 'treasury item outside organization' using errcode='23503'; end if;
 if v_old is distinct from p_expected_active then
  raise exception 'treasury status changed concurrently' using errcode='40001'; end if;
 execute format('update public.%I set active=$1 where organization_id=$2 and id=$3',v_table)
  using p_new_active,p_organization_id,p_item_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(p_organization_id,auth.uid(),'treasury_catalog.status',p_kind,p_item_id,
   jsonb_build_object('active',v_old),jsonb_build_object('active',p_new_active),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,p_item_id);
 return p_item_id;
end $function$
;
revoke all on function public.create_treasury_catalog_item(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_treasury_catalog_item(uuid,text,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.set_treasury_catalog_status(uuid,text,uuid,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.set_treasury_catalog_status(uuid,text,uuid,boolean,boolean,text,text) to authenticated;
