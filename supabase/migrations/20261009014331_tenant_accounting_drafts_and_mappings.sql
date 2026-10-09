-- Applied Supabase DEV migration 20261009014331. Additive wrappers over existing V35 accounting schema.
CREATE OR REPLACE FUNCTION public.create_tenant_accounting_draft(p_organization_id uuid, p_name text, p_valid_from date, p_valid_to date, p_source_kind text, p_source_id uuid, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result uuid;
begin
 perform private.require_permission(p_organization_id,'accounting.manage');
 if p_name is null or length(btrim(p_name)) not between 3 and 120
    or p_valid_from is null or p_valid_to is null
    or p_valid_from<=date_trunc('month',current_date)::date
    or extract(day from p_valid_from)<>1
    or p_valid_to < p_valid_from
    or p_valid_to<>(date_trunc('month',p_valid_to)+interval '1 month - 1 day')::date
    or p_source_kind is null or p_source_kind not in ('blank','template','duplicate')
    or (p_source_kind='blank' and p_source_id is not null)
    or (p_source_kind<>'blank' and p_source_id is null)
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid future accounting draft request' using errcode='22023'; end if;
 v_result:=private.idempotency_begin(p_organization_id,'create_tenant_accounting_draft',p_idempotency_key,
    jsonb_build_object('name',btrim(p_name),'from',p_valid_from,'to',p_valid_to,
      'source_kind',p_source_kind,'source_id',p_source_id,'reason',btrim(p_reason)));
 if v_result is not null then return v_result;end if;
 -- Reuse the existing audited accounting constructor and its 91-account template hierarchy.
 v_result:=public.create_accounting_plan(p_organization_id,btrim(p_name),
    p_valid_from,p_valid_to,p_source_kind,p_source_id);
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'accounting_plan.draft_request','accounting_plan',v_result,
   jsonb_build_object('source_kind',p_source_kind,'source_id',p_source_id),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_draft_accounting_mapping(p_organization_id uuid, p_accounting_plan_id uuid, p_kind text, p_source_id uuid, p_accounting_account_id uuid, p_expected_account_id uuid, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result uuid;v_mapping_id uuid;v_old_target uuid;v_kind text;v_source_domain text;v_target_nature text;v_target_type text;v_target_active boolean;
begin
 perform private.require_permission(p_organization_id,'accounting.manage');
 if p_accounting_plan_id is null or p_source_id is null or p_accounting_account_id is null
   or p_kind is null or p_kind not in ('category','financial_account')
   or p_reason is null or length(btrim(p_reason)) not between 3 and 500
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid accounting mapping request' using errcode='22023';end if;
 v_result:=private.idempotency_begin(p_organization_id,'set_draft_accounting_mapping',p_idempotency_key,
  jsonb_build_object('plan',p_accounting_plan_id,'kind',p_kind,'source',p_source_id,
  'account',p_accounting_account_id,'expected',p_expected_account_id,'reason',btrim(p_reason)));
 if v_result is not null then return v_result;end if;
 perform 1 from public.accounting_plans p
 where p.organization_id=p_organization_id and p.id=p_accounting_plan_id and p.status='draft' for update;
 if not found then raise exception 'draft plan not found in organization' using errcode='23503';end if;
 select a.nature,a.row_type,a.active into v_target_nature,v_target_type,v_target_active
 from public.accounting_accounts a
 where a.organization_id=p_organization_id and a.accounting_plan_id=p_accounting_plan_id
  and a.id=p_accounting_account_id;
 if not found then raise exception 'target account outside draft' using errcode='23503';end if;
 if v_target_type<>'analytic' or not v_target_active then
  raise exception 'target accounting account must be active analytic' using errcode='23514';end if;
 if p_kind='category' then
  select c.domain into v_source_domain from public.financial_categories c
   where c.organization_id=p_organization_id and c.id=p_source_id;
  if not found then raise exception 'category outside organization' using errcode='23503';end if;
  if (v_source_domain in ('member_receivable','institutional_revenue') and v_target_nature<>'revenue')
    or (v_source_domain='institutional_expense' and v_target_nature not in('cost','expense','financial_result')) then
   raise exception 'account nature incompatible with category domain' using errcode='23514';end if;
  select id,accounting_account_id into v_mapping_id,v_old_target from public.financial_category_account_mappings
   where organization_id=p_organization_id and accounting_plan_id=p_accounting_plan_id
     and category_id=p_source_id for update;
 else
  perform 1 from public.financial_accounts
   where organization_id=p_organization_id and id=p_source_id;
  if not found then raise exception 'financial account outside organization' using errcode='23503';end if;
  if v_target_nature<>'patrimonial' then
   raise exception 'financial account must map to patrimonial account' using errcode='23514';end if;
  select id,accounting_account_id into v_mapping_id,v_old_target from public.financial_account_accounting_mappings
   where organization_id=p_organization_id and accounting_plan_id=p_accounting_plan_id
     and financial_account_id=p_source_id for update;
 end if;
 if v_old_target is distinct from p_expected_account_id then
  raise exception 'mapping changed; reload before editing' using errcode='40001';end if;
 if v_mapping_id is null then
  if p_kind='category' then
   insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id)
    values(p_organization_id,p_accounting_plan_id,p_source_id,p_accounting_account_id) returning id into v_result;
  else
   insert into public.financial_account_accounting_mappings(organization_id,accounting_plan_id,financial_account_id,accounting_account_id)
    values(p_organization_id,p_accounting_plan_id,p_source_id,p_accounting_account_id) returning id into v_result;
  end if;
 else
  v_result:=v_mapping_id;
  if v_old_target<>p_accounting_account_id then
   if p_kind='category' then
    update public.financial_category_account_mappings set accounting_account_id=p_accounting_account_id where id=v_mapping_id;
   else
    update public.financial_account_accounting_mappings set accounting_account_id=p_accounting_account_id where id=v_mapping_id;
   end if;
  end if;
 end if;
 if v_old_target is distinct from p_accounting_account_id then
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
   values(p_organization_id,auth.uid(),'accounting_plan.mapping_set','accounting_mapping',v_result,
     jsonb_build_object('kind',p_kind,'plan',p_accounting_plan_id,'source',p_source_id,'account',v_old_target),
     jsonb_build_object('kind',p_kind,'plan',p_accounting_plan_id,'source',p_source_id,'account',p_accounting_account_id),btrim(p_reason));
 end if;
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$
;
revoke all on function public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text) to authenticated;
revoke all on function public.set_draft_accounting_mapping(uuid,uuid,text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.set_draft_accounting_mapping(uuid,uuid,text,uuid,uuid,uuid,text,text) to authenticated;
