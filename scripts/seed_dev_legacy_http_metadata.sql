-- DEV QA metadata only. No charge, obligation, payment or ledger writes.
-- Default ROLLBACK. Inspect output before authorized fixture persistence.
begin;
do $$
declare t record;cases jsonb:='[]';a jsonb;replay jsonb;profile jsonb;old_stamp timestamptz;
 member uuid;cat uuid;rule uuid;initial uuid;latest uuid;term uuid;plan uuid;target uuid;mapping uuid;
 budget uuid;account uuid;ip_rule uuid;ip_initial uuid;ip_latest uuid;template uuid;key text;tag text;
 before_charges bigint:=(select count(*) from public.charges);
 before_payments bigint:=(select count(*) from public.payments);
begin
 select id into strict template from public.accounting_plan_templates where code='corsys_complete_br' and active;
 for t in select * from(values
  ('A','a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid),
  ('B','559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid)
 ) f(label,actor,org) loop
  tag:='DEV HTTP LEGACY 20261019 '||t.label;
  if not exists(select 1 from public.organizations where id=t.org and name='DEV QA FINANCE '||t.label||' 20261015')
   or exists(select 1 from public.members where organization_id=t.org and full_name=tag)
  then raise exception 'fixture absent or already seeded; inspect instead of rerunning';end if;
  select id into strict cat from public.financial_categories where organization_id=t.org and domain='member_receivable' and active and allow_recurrence;
  select a.id into strict account from public.accounting_accounts a join public.accounting_plans p on p.id=a.accounting_plan_id and p.organization_id=a.organization_id
   where a.organization_id=t.org and a.row_type='analytic' and a.active and a.nature='revenue' and p.status='published'
   and date '2026-10-01' between p.valid_from and p.valid_to order by a.id limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  -- Inactive test member never enters the previously approved monthly fixture.
  profile:=jsonb_build_object('full_name',tag,'status','inactive');key:=tag||' member create';
  member:=public.save_member_profile(t.org,null,null,profile,tag,key);
  select updated_at into strict old_stamp from public.members where organization_id=t.org and id=member;
  key:=tag||' member update';
  perform public.save_member_profile(t.org,member,old_stamp,profile,tag,key);
  replay:=jsonb_build_object('p_organization_id',t.org,'p_member_id',member,'p_expected_updated_at',old_stamp,'p_profile',profile,'p_reason',tag,'p_idempotency_key',key);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','save_member_profile','args',replay||jsonb_build_object('p_expected_updated_at','1900-01-01T00:00:00Z'),'replay',replay,'result',member));
  rule:=public.create_tenant_monthly_rule(t.org,cat,tag,1,'2026-11-01',10,tag,tag||' rule');
  select id into strict initial from public.recurring_rule_versions where recurring_rule_id=rule;
  key:=tag||' price';latest:=public.schedule_tenant_monthly_price(t.org,rule,initial,2,'2026-12-01',tag,key);
  replay:=jsonb_build_object('p_organization_id',t.org,'p_rule_id',rule,'p_expected_version_id',initial,'p_unit_amount',2,'p_valid_from','2026-12-01','p_reason',tag,'p_idempotency_key',key);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','schedule_tenant_monthly_price','args',replay,'replay',replay,'result',latest));
  term:=public.schedule_member_configuration(t.org,member,'term',rule,'2026-11-01',null,'exempt',null,tag,tag||' term');
  key:=tag||' close term';perform public.transition_member_term(t.org,member,term,'2026-12-01',null,null,tag,key);
  replay:=jsonb_build_object('p_organization_id',t.org,'p_member_id',member,'p_current_term_id',term,'p_next_from','2026-12-01','p_next_type',null,'p_next_amount',null,'p_reason',tag,'p_idempotency_key',key);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','transition_member_term','args',replay,'replay',replay,'result',term));
  if not(public.preview_monthly_charge_generation(t.org,rule,'2027-01-01')->>'ready')::boolean then raise exception 'monthly preview not ready';end if;
  a:=jsonb_build_object('p_organization_id',t.org,'p_rule_id',rule,'p_competence','2027-01-01','p_expected_fingerprint',repeat('0',64),'p_reason',tag,'p_idempotency_key',tag||' stale generation');
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','generate_monthly_member_charges','args',a));
  budget:=public.create_tenant_budget_draft(t.org,tag,'2026-10-01','2026-12-01',tag,tag||' budget');
  a:=jsonb_build_object('p_organization_id',t.org,'p_cycle_id',budget,'p_expected_revision',repeat('0',32),'p_reason',tag,'p_idempotency_key',tag||' budget conflict');
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','publish_tenant_budget','args',a));
  a:=a||jsonb_build_object('p_kind','account','p_item_id',account,'p_period','2026-10-01','p_amount',1);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','set_tenant_budget_line','args',a));
  plan:=public.create_tenant_accounting_draft(t.org,tag,'2035-01-01','2035-12-31','template',template,tag,tag||' accounting draft');
  select id into strict target from public.accounting_accounts where organization_id=t.org and accounting_plan_id=plan and row_type='analytic' and nature='revenue' and active order by code limit 1;
  key:=tag||' mapping';mapping:=public.set_draft_accounting_mapping(t.org,plan,'category',cat,target,null,tag,key);
  replay:=jsonb_build_object('p_organization_id',t.org,'p_accounting_plan_id',plan,'p_kind','category','p_source_id',cat,'p_accounting_account_id',target,'p_expected_account_id',null,'p_reason',tag,'p_idempotency_key',key);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','set_draft_accounting_mapping','args',replay,'replay',replay,'result',mapping));
  a:=jsonb_build_object('p_organization_id',t.org,'p_plan_id',plan,'p_expected_valid_from','2034-01-01','p_expected_valid_to','2034-12-31','p_reason',tag,'p_idempotency_key',tag||' publish stale');
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','publish_validated_accounting_plan','args',a));
  select id into strict cat from public.financial_categories where organization_id=t.org and domain='institutional_revenue' and active;
  ip_rule:=public.create_tenant_institutional_monthly_rule(t.org,'receivable',cat,tag,'DEV QA fictício',1,'2026-11-01',10,tag,tag||' institutional rule');
  select id into strict ip_initial from public.institutional_recurring_rule_versions where organization_id=t.org and recurring_rule_id=ip_rule;
  key:=tag||' institutional price';ip_latest:=public.schedule_institutional_recurring_price(t.org,ip_rule,ip_initial,2,'2026-12-01',tag,key);
  replay:=jsonb_build_object('p_organization_id',t.org,'p_rule_id',ip_rule,'p_expected_version_id',ip_initial,'p_amount',2,'p_valid_from','2026-12-01','p_reason',tag,'p_idempotency_key',key);
  cases:=cases||jsonb_build_array(jsonb_build_object('label',t.label,'actor',t.actor,'org',t.org,'name','schedule_institutional_recurring_price','args',replay,'replay',replay,'result',ip_latest));
  execute 'reset role';
 end loop;
 if before_charges<>(select count(*) from public.charges) or before_payments<>(select count(*) from public.payments)
 then raise exception 'unexpected financial fact';end if;
 perform set_config('qa.legacy_cases',cases::text,true);
end $$;
select current_setting('qa.legacy_cases')::jsonb as fixture_cases;
rollback;
