-- Proposal: exactly two isolated DEV QA tenants. Execute only after owner approval.
-- No changes to the original A/B plans, accounts, payments or Auth identities.
begin;
do $$
declare t record; org uuid;src uuid;dst uuid;plan uuid;pat uuid;member_id uuid;method_id uuid;payment_id uuid;
begin
 if exists(select 1 from public.organizations where name in('DEV QA INTERFACE A 20261014','DEV QA INTERFACE B 20261014'))
 then raise exception 'QA tenant already exists; inspect, never reseed blindly';end if;
 for t in select * from (values
  ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'A'),
  ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'B')
 ) x(original_org,actor,label) loop
  if not exists(select 1 from public.organizations where id=t.original_org and name='CORSYS DEV TENANT '||t.label)
   or not exists(select 1 from public.saas_subscriptions s join public.saas_plans p on p.id=s.plan_id
    join public.saas_plan_versions v on v.id=s.plan_version_id where s.organization_id=t.original_org and s.status='active'
     and p.price=0 and v.price=0)
  then raise exception 'Wrong DEV or nonzero commercial fixture';end if;
  insert into public.organizations(name) values('DEV QA INTERFACE '||t.label||' 20261014') returning id into org;
  insert into public.user_roles(organization_id,user_id,role_id)
   select org,t.actor,id from public.roles where organization_id=org and code='ADMIN';
  insert into public.saas_tenant_accounts(organization_id) values(org);
  insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status)
   select org,plan_id,plan_version_id,'active' from public.saas_subscriptions where organization_id=t.original_org and status='active';
  insert into public.financial_accounts(organization_id,name,account_type) values(org,'DEV QA Origem','bank') returning id into src;
  insert into public.financial_accounts(organization_id,name,account_type) values(org,'DEV QA Destino','bank') returning id into dst;
  insert into public.accounting_plans(organization_id,name,valid_from,valid_to)
   values(org,'DEV QA plano completo',date_trunc('year',current_date)::date,(date_trunc('year',current_date)+interval '1 year - 1 day')::date) returning id into plan;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature)
   values(org,plan,'1','DEV QA disponibilidades','analytic','patrimonial') returning id into pat;
  insert into public.financial_account_accounting_mappings(organization_id,accounting_plan_id,financial_account_id,accounting_account_id)
   values(org,plan,src,pat),(org,plan,dst,pat);
  update public.accounting_plans set status='published',published_at=now() where id=plan;
  insert into public.members(organization_id,full_name) values(org,'DEV QA integrante fictício') returning id into member_id;
  insert into public.payment_methods(organization_id,name) values(org,'DEV QA método fictício') returning id into method_id;
  insert into public.payments(organization_id,member_id,payment_date,accounting_period,amount,payment_method_id,financial_account_id,source_kind)
   values(org,member_id,current_date,date_trunc('month',current_date)::date,10,method_id,src,'operational') returning id into payment_id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
   values(org,t.actor,'dev_qa.fixture_seed','organization',org,jsonb_build_object('original_identity_tenant',t.original_org,'source',src,'destination',dst,'synthetic_payment',payment_id,'amount',10),
    'Owner-approved isolated browser QA fixture; no external money or providers');
 end loop;
end $$;
commit;
