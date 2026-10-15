-- REVIEWABLE PROPOSAL: transaction-only preflight. No COMMIT.
-- DEV project szqkdekwhzxsoxorgvaz only; no emails, users or external billing.
-- Default is rollback. Persist only within the owner-authorized DEV test workflow.
begin;
do $$
declare t record;org uuid;src uuid;dst uuid;plan uuid;pat uuid;rev uuid;exp uuid;
 member_id uuid;method_id uuid;member_cat uuid;expense_cat uuid;income_cat uuid;
begin
 if exists(select 1 from public.organizations where name in ('DEV QA FINANCE A 20261015','DEV QA FINANCE B 20261015'))
 then raise exception 'Finance fixtures already exist; inspect, never reseed';end if;
 for t in select * from (values
  ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'A'),
  ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'B')
 ) f(original,actor,label) loop
  if not exists(select 1 from public.organizations where id=t.original and name='CORSYS DEV TENANT '||t.label)
   or (select count(*) from public.saas_subscriptions s join public.saas_plans p on p.id=s.plan_id
     join public.saas_plan_versions v on v.id=s.plan_version_id where s.organization_id=t.original and s.status='active' and p.price=0 and v.price=0)<>1
  then raise exception 'Wrong DEV fixture or nonzero billing';end if;
  insert into public.organizations(name) values('DEV QA FINANCE '||t.label||' 20261015') returning id into org;
  insert into public.user_roles(organization_id,user_id,role_id)
   select org,t.actor,id from public.roles where organization_id=org and code='ADMIN';
  insert into public.saas_tenant_accounts(organization_id) values(org);
  insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status)
   select org,plan_id,plan_version_id,'active' from public.saas_subscriptions where organization_id=t.original and status='active';
  insert into public.financial_accounts(organization_id,name,account_type) values(org,'DEV QA Origem','bank') returning id into src;
  insert into public.financial_accounts(organization_id,name,account_type) values(org,'DEV QA Destino','bank') returning id into dst;
  insert into public.financial_categories(organization_id,name,domain,allow_recurrence)
   values(org,'DEV QA mensalidade','member_receivable',true) returning id into member_cat;
  insert into public.financial_categories(organization_id,name,domain)
   values(org,'DEV QA despesa','institutional_expense') returning id into expense_cat;
  insert into public.financial_categories(organization_id,name,domain)
   values(org,'DEV QA receita','institutional_revenue') returning id into income_cat;
  insert into public.accounting_plans(organization_id,name,valid_from,valid_to)
   values(org,'DEV QA financeiro completo','2026-01-01','2027-12-31') returning id into plan;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature)
   values(org,plan,'1','DEV QA disponibilidades','analytic','patrimonial') returning id into pat;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification)
   values(org,plan,'2','DEV QA receita','analytic','revenue','recurring') returning id into rev;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature,operational_classification)
   values(org,plan,'3','DEV QA despesa','analytic','expense','fixed') returning id into exp;
  insert into public.financial_category_account_mappings(organization_id,accounting_plan_id,category_id,accounting_account_id)
   values(org,plan,member_cat,rev),(org,plan,income_cat,rev),(org,plan,expense_cat,exp);
  insert into public.financial_account_accounting_mappings(organization_id,accounting_plan_id,financial_account_id,accounting_account_id)
   values(org,plan,src,pat),(org,plan,dst,pat);
  update public.accounting_plans set status='published',published_at=now() where id=plan;
  insert into public.members(organization_id,full_name) values(org,'DEV QA integrante fictício') returning id into member_id;
  insert into public.payment_methods(organization_id,name) values(org,'DEV QA método fictício') returning id into method_id;
  insert into public.payments(organization_id,member_id,payment_date,accounting_period,amount,payment_method_id,financial_account_id,source_kind)
   values(org,member_id,current_date,date_trunc('month',current_date)::date,10,method_id,src,'operational');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  perform public.create_tenant_monthly_rule(org,member_cat,'DEV QA mensal R$1',1,'2027-03-01',10,'DEV QA financial UI preflight',gen_random_uuid()::text);
  if (public.preview_monthly_charge_generation(org,(select id from public.recurring_rules where organization_id=org),'2027-03-01')->>'ready')<>'true'
  then raise exception 'Financial QA preview unavailable';end if;
  execute 'reset role';
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,reason)
   values(org,t.actor,'dev_qa.financial_fixture','organization',org,'DEV QA isolated financial browser fixture; synthetic amounts only');
 end loop;
end $$;
rollback;
select 'DEV_FINANCIAL_BROWSER_FIXTURE_PREFLIGHT_ROLLBACK_PASS' as result;
