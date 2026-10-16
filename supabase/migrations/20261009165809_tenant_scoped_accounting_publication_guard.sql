-- DEV V35 increment 11. Tenant-row synchronization replaces global SHARE table locks.
-- A single migration atomically installs all guards and updates the publication RPC.
CREATE OR REPLACE FUNCTION private.guard_tenant_accounting_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_need_check boolean := false;
begin
 if tg_op='INSERT' then v_org:=new.organization_id;
 else v_org:=old.organization_id; end if;
 if tg_op='UPDATE' and new.organization_id is distinct from old.organization_id then
   raise exception 'accounting tenant cannot change' using errcode='23514';
 end if;
 -- All writers synchronize with publication for their own organization only.
 perform 1 from public.organizations where id=v_org for update;
 if not found then raise exception 'accounting organization not found' using errcode='23503';end if;

 if tg_op<>'DELETE' and tg_table_name in
   ('accounting_accounts','financial_category_account_mappings',
    'financial_account_accounting_mappings') then
   if exists(select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.id=new.accounting_plan_id and p.status='published') then
     raise exception 'published accounting structure cannot be modified' using errcode='55000';
   end if;
 end if;

 if tg_op<>'DELETE' and tg_table_name='financial_categories' then
   v_need_check := tg_op='INSERT';
   if tg_op='UPDATE' then
     v_need_check := old.active is distinct from true or old.domain is distinct from new.domain;
   end if;
   if new.active and v_need_check and exists(
    select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.status='published'
       and p.valid_to>=date_trunc('month',current_date)::date
       and not exists(
         select 1 from public.financial_category_account_mappings m
          join public.accounting_accounts a
           on a.organization_id=m.organization_id
          and a.accounting_plan_id=m.accounting_plan_id
          and a.id=m.accounting_account_id
          where m.organization_id=v_org and m.accounting_plan_id=p.id
          and m.category_id=new.id and a.active and a.row_type='analytic'
          and ((new.domain in ('member_receivable','institutional_revenue') and a.nature='revenue')
            or (new.domain='institutional_expense' and a.nature in ('cost','expense','financial_result')))
       )
   ) then
     raise exception 'category cannot be active without coverage in every applicable published plan; create a successor'
       using errcode='23514';
   end if;
 end if;

 if tg_op<>'DELETE' and tg_table_name='financial_accounts' then
   v_need_check := tg_op='INSERT';
   if tg_op='UPDATE' then v_need_check := old.active is distinct from true;end if;
   if new.active and v_need_check and exists(
     select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.status='published'
       and p.valid_to>=date_trunc('month',current_date)::date
       and not exists(
         select 1 from public.financial_account_accounting_mappings m
          join public.accounting_accounts a
           on a.organization_id=m.organization_id
          and a.accounting_plan_id=m.accounting_plan_id
          and a.id=m.accounting_account_id
          where m.organization_id=v_org and m.accounting_plan_id=p.id
           and m.financial_account_id=new.id
           and a.active and a.row_type='analytic' and a.nature='patrimonial'
       )
   ) then
     raise exception 'financial account cannot be active without coverage in every applicable published plan; create a successor'
       using errcode='23514';
   end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function private.guard_tenant_accounting_change() from public,anon,authenticated;

create trigger accounting_tenant_change_guard
before insert or update or delete on public.financial_categories
for each row execute function private.guard_tenant_accounting_change();

create trigger accounting_tenant_change_guard
before insert or update or delete on public.financial_accounts
for each row execute function private.guard_tenant_accounting_change();

create trigger accounting_tenant_change_guard
before insert or update or delete on public.accounting_accounts
for each row execute function private.guard_tenant_accounting_change();

create trigger accounting_tenant_change_guard
before insert or update or delete on public.financial_category_account_mappings
for each row execute function private.guard_tenant_accounting_change();

create trigger accounting_tenant_change_guard
before insert or update or delete on public.financial_account_accounting_mappings
for each row execute function private.guard_tenant_accounting_change();

create trigger accounting_tenant_change_guard
before insert or update or delete on public.accounting_plans
for each row execute function private.guard_tenant_accounting_change();

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
 -- Coordinate with publication before locking a specific plan, avoiding inverse lock order.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503';end if;
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
CREATE OR REPLACE FUNCTION public.create_treasury_catalog_item(p_organization_id uuid, p_kind text, p_name text, p_account_type text, p_institution text, p_identification text, p_description text, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_name text; v_insert_active boolean:=true;
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
  -- Until coverage exists for every published plan, new financial accounts begin inactive.
  v_insert_active:=false;
  insert into public.financial_accounts(organization_id,name,account_type,institution,identification,active)
   values(p_organization_id,v_name,p_account_type,nullif(btrim(p_institution),''),nullif(btrim(p_identification),''),v_insert_active)
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
   jsonb_build_object('name',v_name,'type',p_account_type,'active',v_insert_active),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.publish_validated_accounting_plan(
  p_organization_id uuid, p_plan_id uuid,
  p_expected_valid_from date, p_expected_valid_to date,
  p_reason text, p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_plan public.accounting_plans%rowtype;
  v_id uuid;
  v_check jsonb;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');
  if p_plan_id is null or p_expected_valid_from is null or p_expected_valid_to is null
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  then raise exception 'invalid accounting publication request' using errcode='22023'; end if;
  v_id := private.idempotency_begin(p_organization_id,'publish_validated_accounting_plan',
     p_idempotency_key,jsonb_build_object('plan',p_plan_id,'from',p_expected_valid_from,
      'to',p_expected_valid_to,'reason',btrim(p_reason)));
  if v_id is not null then return v_id; end if;
  perform 1 from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'organization not found' using errcode='23503'; end if;
  select * into v_plan from public.accounting_plans
   where organization_id=p_organization_id and id=p_plan_id for update;
  if not found then raise exception 'accounting plan outside organization' using errcode='23503'; end if;
  if v_plan.status<>'draft' then
    raise exception 'accounting plan is no longer a draft' using errcode='40001';
  end if;
  if v_plan.valid_from is distinct from p_expected_valid_from
    or v_plan.valid_to is distinct from p_expected_valid_to
  then raise exception 'accounting plan dates changed; reload before publishing' using errcode='40001'; end if;
  -- Every relevant configuration mutation acquires this tenant's organizations row.
  -- No global table locks; independent tenants continue writing concurrently.
  v_check:=public.preview_accounting_plan_publication(p_organization_id,p_plan_id);
  if v_check is null or v_check->>'ready' is distinct from 'true' then
    raise exception 'accounting plan is not ready for publication: %',
      coalesce(v_check->'issues','[]'::jsonb)
      using errcode='23514';
  end if;
  v_id:=public.publish_accounting_plan(p_organization_id,p_plan_id);
  insert into public.audit_logs(
    organization_id,actor_user_id,action,entity_type,entity_id,
    after_data,reason
  ) values (
    p_organization_id,auth.uid(),'accounting_plan.validated_publish',
    'accounting_plan',v_id,
    jsonb_build_object('status','published','validated_from',v_plan.valid_from,
     'validated_to',v_plan.valid_to,
     'active_categories',v_check->'active_category_count',
     'active_financial_accounts',v_check->'active_financial_account_count'),
    btrim(p_reason)
  );
  perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
  return v_id;
end $$;


-- Preserve existing API ACLs and revoked legacy publication endpoint.
revoke all on function public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text) from public,anon,authenticated;
grant execute on function public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text) to authenticated;
revoke execute on function public.publish_accounting_plan(uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_treasury_catalog_item(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_treasury_catalog_item(uuid,text,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.set_draft_accounting_mapping(uuid,uuid,text,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.set_draft_accounting_mapping(uuid,uuid,text,uuid,uuid,uuid,text,text) to authenticated;
