-- Authorized Corsys DEV only. Persistent fixtures for real HTTP tests.
-- No Auth changes, invoices, external providers or messages. Zero-price test plan.
begin;
do $$
declare
 v_org uuid; v_user uuid; v_member uuid; v_category uuid; v_method uuid; v_account uuid;
 v_plan uuid; v_revenue uuid; v_saas uuid; v_version uuid;
begin
 if (select count(*) from public.organizations where
   (id='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' and name='CORSYS DEV TENANT A')
   or (id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and name='CORSYS DEV TENANT B'))<>2 then
   raise exception 'Wrong DEV fixtures';
 end if;
 if exists(select 1 from public.saas_plans where code='dev_http_financial_20261007')
   or exists(select 1 from public.accounting_plans where organization_id in(
     'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539'))
   or exists(select 1 from public.saas_subscriptions where organization_id in(
     'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')) then
   raise exception 'Fixture already prepared or configuration changed; inspect; never reseed blindly';
 end if;
 insert into public.saas_plans(code,name,price)
 values('dev_http_financial_20261007','DEV HTTP financial test - no billing',0) returning id into v_saas;
 insert into public.saas_plan_versions(plan_id,version_number,status,price,valid_from,display_name_snapshot,internal_code_snapshot,published_by,published_at)
 values(v_saas,1,'published',0,current_date,'DEV HTTP - no billing','dev_http_financial_20261007',
 'a752dda8-4ef0-4c58-9d3b-b8fee14ec624',now()) returning id into v_version;
 foreach v_org in array array[
 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid] loop
  select ur.user_id into strict v_user from public.user_roles ur join public.roles r on r.id=ur.role_id
  where ur.organization_id=v_org and r.code='ADMIN';
  if (v_org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' and v_user<>'a752dda8-4ef0-4c58-9d3b-b8fee14ec624')
    or (v_org='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and v_user<>'559ba052-c408-4418-b806-0c0c4b8e3603') then
    raise exception 'Unexpected DEV administrator';
  end if;
  insert into public.members(organization_id,full_name)
    values(v_org,'DEV HTTP FINANCIAL TEST') returning id into v_member;
  insert into public.financial_categories(organization_id,name,domain)
    values(v_org,'DEV HTTP TEST category','member_receivable') returning id into v_category;
  insert into public.payment_methods(organization_id,name)
    values(v_org,'DEV HTTP TEST PIX') returning id into v_method;
  insert into public.financial_accounts(organization_id,name,account_type)
    values(v_org,'DEV HTTP TEST bank','bank') returning id into v_account;
  insert into public.accounting_plans(organization_id,name,valid_from,valid_to)
    values(v_org,'DEV HTTP TEST accounting plan','2026-01-01','2026-12-31') returning id into v_plan;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification)
    values(v_org,v_plan,'1','DEV HTTP TEST revenue','analytic','revenue','recurring') returning id into v_revenue;
  insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id)
    values(v_org,v_plan,v_category,v_revenue);
  update public.accounting_plans set status='published',published_at=now() where id=v_plan;
  insert into public.saas_tenant_accounts(organization_id,access_override) values(v_org,'none') on conflict(organization_id) do nothing;
  insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status) values(v_org,v_saas,v_version,'active');
  if not private.tenant_write_allowed(v_org) then raise exception 'Existing access override prevents DEV setup'; end if;
 end loop;
end;
$$;
commit;
select o.id organization_id,m.id member_id,c.id category_id,pm.id payment_method_id,
 a.id financial_account_id,ur.user_id admin_user_id
from public.organizations o
join public.members m on m.organization_id=o.id and m.full_name='DEV HTTP FINANCIAL TEST'
join public.financial_categories c on c.organization_id=o.id and c.name='DEV HTTP TEST category'
join public.payment_methods pm on pm.organization_id=o.id and pm.name='DEV HTTP TEST PIX'
join public.financial_accounts a on a.organization_id=o.id and a.name='DEV HTTP TEST bank'
join public.user_roles ur on ur.organization_id=o.id
join public.roles r on r.id=ur.role_id and r.code='ADMIN'
where o.id in ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b','b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
order by o.name;

