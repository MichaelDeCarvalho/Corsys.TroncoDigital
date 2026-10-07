-- ONLY project szqkdekwhzxsoxorgvaz, fictitious zero-price DEV subscription.
-- Run ONLY in its SQL Editor. Not a migration. Never alter Auth or ledger.
begin;
do $$
begin
 if (select count(*) from public.saas_subscriptions s join public.saas_plans p on p.id=s.plan_id
     where s.id='65f775a3-ac8c-4e36-87f1-91e0f473c6a1'
       and s.organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539'
       and p.code='dev_http_financial_20261007' and p.price=0 and s.grace_until is null) <> 1
   or not exists(select 1 from public.organizations where id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and name='CORSYS DEV TENANT B')
   or not exists(select 1 from public.saas_tenant_accounts where organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and access_override='none')
   or not exists(select 1 from public.saas_subscriptions where id='bcd6b8fd-c0eb-49e0-854a-06a35f04037f' and organization_id='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' and status='active') then
  raise exception 'DEV fixture mismatch; no changes applied';
 end if;
 if not exists(select 1 from public.saas_subscriptions where id='65f775a3-ac8c-4e36-87f1-91e0f473c6a1' and status='suspended') then
  raise exception 'Expected B suspended; inspect state first';
 end if;
 update public.saas_subscriptions set status='active' where id='65f775a3-ac8c-4e36-87f1-91e0f473c6a1';
end;
$$;
commit;
select organization_id,status from public.saas_subscriptions where id in ('bcd6b8fd-c0eb-49e0-854a-06a35f04037f','65f775a3-ac8c-4e36-87f1-91e0f473c6a1') order by organization_id;
