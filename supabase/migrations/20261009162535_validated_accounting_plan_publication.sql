-- Supabase DEV 20261009162535_validated_accounting_plan_publication.
-- Serialized, audited publication with a new server-side readiness validation.
create function public.publish_validated_accounting_plan(
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
  lock table public.financial_categories, public.financial_accounts,
    public.accounting_accounts, public.financial_category_account_mappings,
    public.financial_account_accounting_mappings in share mode;
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

revoke all on function public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text)
  from public, anon, authenticated;
grant execute on function public.publish_validated_accounting_plan(uuid,uuid,date,date,text,text)
  to authenticated;
revoke execute on function public.publish_accounting_plan(uuid,uuid)
  from public, anon, authenticated;
