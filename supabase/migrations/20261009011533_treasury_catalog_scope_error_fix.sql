-- Forward-only correction: dynamic EXECUTE INTO does not set PL/pgSQL FOUND.
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
 if v_old is null then raise exception 'treasury item outside organization' using errcode='23503'; end if;
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
