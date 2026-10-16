-- Authorized DEV szqkdekwhzxsoxorgvaz only. Persistent fixtures; no schema/Auth/grants.
begin;
do $$
declare v_org uuid; v_plan uuid; v_member uuid; v_cat uuid; v_account uuid; v_domain text; v_nature text; v_code integer;
begin
 foreach v_org in array array['f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid] loop
  if not exists(select 1 from public.organizations where id=v_org and name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B'))
    or not private.tenant_write_allowed(v_org)
    or exists(select 1 from public.members where organization_id=v_org and full_name='DEV STAGE1 ISOLATED FIFO')
    or exists(select 1 from public.accounting_plans where organization_id=v_org and (name='DEV STAGE1 2027 plan' or (status='published' and daterange(valid_from,valid_to+1,'[)') && daterange('2027-01-01','2028-01-01','[)')))) then
   raise exception 'DEV setup precondition failed; inspect, do not repeat seed';
  end if;
  insert into public.members(organization_id,full_name) values(v_org,'DEV STAGE1 ISOLATED FIFO') returning id into v_member;
  insert into public.accounting_plans(organization_id,name,valid_from,valid_to) values(v_org,'DEV STAGE1 2027 plan','2027-01-01','2027-12-31') returning id into v_plan;
  v_code:=0;
  foreach v_domain in array array['member_receivable','institutional_revenue','institutional_expense'] loop
   v_code:=v_code+1;v_nature:=case when v_domain='institutional_expense' then 'expense' else 'revenue' end;
   insert into public.financial_categories(organization_id,name,domain) values(v_org,'DEV STAGE1 '||v_domain,v_domain) returning id into v_cat;
   insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification)
   values(v_org,v_plan,v_code::text,'DEV STAGE1 '||v_domain,'analytic',v_nature,case when v_nature='expense' then 'variable' else 'ad_hoc' end) returning id into v_account;
   insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id) values(v_org,v_plan,v_cat,v_account);
  end loop;
  update public.accounting_plans set status='published',published_at=now() where id=v_plan;
 end loop;
end; $$;
commit;
select o.id organization_id,m.id fifo_member_id,p.id accounting_plan_id,
 (select id from public.financial_categories where organization_id=o.id and name='DEV STAGE1 member_receivable') member_category_id,
 (select id from public.financial_categories where organization_id=o.id and name='DEV STAGE1 institutional_revenue') revenue_category_id,
 (select id from public.financial_categories where organization_id=o.id and name='DEV STAGE1 institutional_expense') expense_category_id
from public.organizations o join public.members m on m.organization_id=o.id and m.full_name='DEV STAGE1 ISOLATED FIFO'
join public.accounting_plans p on p.organization_id=o.id and p.name='DEV STAGE1 2027 plan'
where o.id in ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539') order by o.name;
