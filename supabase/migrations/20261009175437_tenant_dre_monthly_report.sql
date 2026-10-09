-- DEV V35: read-only DRE rows grouped by historical accounting snapshot.
-- Signed amounts derive exclusively from v_dre_entries, not from payments or balances.
create function public.read_tenant_dre(
 p_organization_id uuid,
 p_from_period date,
 p_to_period date
) returns table (
 accounting_period date,
 accounting_plan_id uuid,
 accounting_account_id uuid,
 account_code text,
 account_description text,
 nature text,
 operational_classification text,
 signed_amount numeric
)
language plpgsql
security definer set search_path='' as $$
begin
 perform private.require_permission(p_organization_id,'reports.read');
 if p_from_period is null or p_to_period is null
    or extract(day from p_from_period)<>1 or extract(day from p_to_period)<>1
    or p_to_period<p_from_period
    or p_to_period>=p_from_period+interval '12 months'
 then raise exception 'DRE month range must be 1 to 12 inclusive competencies'
    using errcode='22023';end if;
 return query
 select e.period, a.accounting_plan_id, a.id, a.code, a.description,
  a.nature, a.operational_classification,
  sum(e.signed_amount)::numeric(14,2)
 from public.v_dre_entries e
 join public.accounting_accounts a
   on a.organization_id=e.organization_id and a.id=e.accounting_account_id
 where e.organization_id=p_organization_id
   and e.period>=p_from_period and e.period<=p_to_period
   and a.nature in ('revenue','cost','expense','financial_result')
 group by e.period,a.accounting_plan_id,a.id,a.code,a.description,
  a.nature,a.operational_classification
 order by e.period,a.code,a.id;
end $$;
revoke all on function public.read_tenant_dre(uuid,date,date) from public,anon,authenticated;
grant execute on function public.read_tenant_dre(uuid,date,date) to authenticated;
