-- Applied only in Supabase DEV. Read-only authorization-gated accounting publication preview.
CREATE OR REPLACE FUNCTION public.preview_accounting_plan_publication(p_organization_id uuid, p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_plan public.accounting_plans%rowtype;
  v_accounts integer;
  v_analytic integer;
  v_category_total integer;
  v_cash_total integer;
  v_missing_categories integer;
  v_missing_cash integer;
  v_invalid_category integer;
  v_invalid_cash integer;
  v_bad_hierarchy integer;
  v_cycles integer;
  v_overlap integer;
  v_issues jsonb := '[]'::jsonb;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');

  if p_plan_id is null then
    raise exception 'accounting plan is required' using errcode='22023';
  end if;

  select * into v_plan
  from public.accounting_plans p
  where p.organization_id=p_organization_id and p.id=p_plan_id;

  if not found then
    raise exception 'accounting plan outside organization' using errcode='23503';
  end if;

  select count(*),count(*) filter (where row_type='analytic' and active)
    into v_accounts,v_analytic
  from public.accounting_accounts
  where organization_id=p_organization_id and accounting_plan_id=p_plan_id;

  select count(*) into v_bad_hierarchy
  from public.accounting_accounts child
  join public.accounting_accounts parent
    on parent.organization_id=child.organization_id
    and parent.accounting_plan_id=child.accounting_plan_id
    and parent.id=child.parent_account_id
  where child.organization_id=p_organization_id
    and child.accounting_plan_id=p_plan_id
    and (parent.row_type='analytic' or parent.nature<>child.nature);

  with recursive ancestry as (
    select a.id root_id,a.parent_account_id,a.id as current_id,
      array[a.id] path,false is_cycle
    from public.accounting_accounts a
    where a.organization_id=p_organization_id and a.accounting_plan_id=p_plan_id
    union all
    select ancestry.root_id,parent.parent_account_id,parent.id,
      ancestry.path||parent.id,parent.id=any(ancestry.path)
    from ancestry
    join public.accounting_accounts parent
      on parent.organization_id=p_organization_id
     and parent.accounting_plan_id=p_plan_id
     and parent.id=ancestry.parent_account_id
    where not ancestry.is_cycle
  )
  select count(distinct root_id) filter (where is_cycle) into v_cycles from ancestry;

  select count(*),
    count(*) filter (where not exists(
      select 1 from public.financial_category_account_mappings m
      where m.organization_id=c.organization_id and m.accounting_plan_id=p_plan_id
        and m.category_id=c.id
    ))
  into v_category_total,v_missing_categories
  from public.financial_categories c
  where c.organization_id=p_organization_id and c.active;

  select count(*),
    count(*) filter (where not exists(
      select 1 from public.financial_account_accounting_mappings m
      where m.organization_id=a.organization_id and m.accounting_plan_id=p_plan_id
        and m.financial_account_id=a.id
    ))
  into v_cash_total,v_missing_cash
  from public.financial_accounts a
  where a.organization_id=p_organization_id and a.active;

  select count(*) into v_invalid_category
  from public.financial_category_account_mappings m
  join public.financial_categories c
    on c.organization_id=m.organization_id and c.id=m.category_id
  join public.accounting_accounts a
    on a.organization_id=m.organization_id and a.accounting_plan_id=m.accounting_plan_id
    and a.id=m.accounting_account_id
  where m.organization_id=p_organization_id and m.accounting_plan_id=p_plan_id
    and (not a.active or a.row_type<>'analytic'
      or (c.domain in ('member_receivable','institutional_revenue') and a.nature<>'revenue')
      or (c.domain='institutional_expense' and a.nature not in ('cost','expense','financial_result'))
      or c.domain not in ('member_receivable','institutional_revenue','institutional_expense'));

  select count(*) into v_invalid_cash
  from public.financial_account_accounting_mappings m
  join public.accounting_accounts a
    on a.organization_id=m.organization_id and a.accounting_plan_id=m.accounting_plan_id
    and a.id=m.accounting_account_id
  where m.organization_id=p_organization_id and m.accounting_plan_id=p_plan_id
    and (not a.active or a.row_type<>'analytic' or a.nature<>'patrimonial');

  select count(*) into v_overlap
  from public.accounting_plans other
  where other.organization_id=p_organization_id and other.id<>p_plan_id
    and other.status='published'
    and other.valid_from<=v_plan.valid_to and other.valid_to>=v_plan.valid_from;

  if v_plan.status<>'draft' then
    v_issues:=v_issues||'["not_draft"]'::jsonb;
  end if;
  if v_plan.valid_from<=date_trunc('month',current_date)::date then
    v_issues:=v_issues||'["nonfuture_start"]'::jsonb;
  end if;
  if v_overlap>0 then v_issues:=v_issues||'["published_overlap"]'::jsonb; end if;
  if v_accounts=0 then v_issues:=v_issues||'["empty_chart"]'::jsonb; end if;
  if v_analytic=0 then v_issues:=v_issues||'["no_active_analytic"]'::jsonb; end if;
  if v_bad_hierarchy>0 then v_issues:=v_issues||'["invalid_hierarchy"]'::jsonb; end if;
  if v_cycles>0 then v_issues:=v_issues||'["hierarchy_cycle"]'::jsonb; end if;
  if v_missing_categories>0 then v_issues:=v_issues||'["categories_unmapped"]'::jsonb; end if;
  if v_missing_cash>0 then v_issues:=v_issues||'["cash_accounts_unmapped"]'::jsonb; end if;
  if v_invalid_category>0 then v_issues:=v_issues||'["invalid_category_mappings"]'::jsonb; end if;
  if v_invalid_cash>0 then v_issues:=v_issues||'["invalid_cash_mappings"]'::jsonb; end if;

  return jsonb_build_object(
    'plan_id',v_plan.id,'status',v_plan.status,
    'ready',jsonb_array_length(v_issues)=0,
    'issues',v_issues,
    'account_count',v_accounts,
    'analytic_account_count',v_analytic,
    'active_category_count',v_category_total,
    'missing_category_count',v_missing_categories,
    'active_financial_account_count',v_cash_total,
    'missing_financial_account_count',v_missing_cash,
    'invalid_category_mapping_count',v_invalid_category,
    'invalid_financial_mapping_count',v_invalid_cash,
    'invalid_hierarchy_count',v_bad_hierarchy,
    'hierarchy_cycle_count',v_cycles,
    'overlapping_published_plan_count',v_overlap,
    'checked_at',clock_timestamp()
  );
end;
$function$
;
revoke all on function public.preview_accounting_plan_publication(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preview_accounting_plan_publication(uuid,uuid) to authenticated;
