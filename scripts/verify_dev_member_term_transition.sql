-- DEV ONLY. Transactional test of future-only transition. All fixtures rolled back.
begin;
do $$
declare t record; v_cat uuid; v_rule uuid; v_old uuid; v_new uuid; v_key text;
 v_from date:=(date_trunc('month',current_date)+interval '24 months')::date;
 v_charges bigint:=(select count(*) from public.charges);
 v_payments bigint:=(select count(*) from public.payments);
begin
for t in select * from (values
 ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','94b84958-4dd9-435d-9a4e-244220835d70','d5842ad6-913d-4a3e-8250-876fb2e2a215','23bdcd76-b7a2-47b5-9f65-267d4c1053be'),
 ('559ba052-c408-4418-b806-0c0c4b8e3603','7a6aa771-524d-4d5a-9d38-7006175e1cb4','23bdcd76-b7a2-47b5-9f65-267d4c1053be','d5842ad6-913d-4a3e-8250-876fb2e2a215')
) x(uid,org,member,foreign_member) loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.uid,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 select id into strict v_cat from public.financial_categories where organization_id=t.org::uuid and active and allow_recurrence and domain='member_receivable' order by id limit 1;
 v_rule:=public.create_tenant_monthly_rule(t.org::uuid,v_cat,'DEV TRANSITION GATE RULE',125,(v_from)::date,10,'DEV rollback test',gen_random_uuid()::text);
 v_old:=public.schedule_member_configuration(t.org::uuid,t.member::uuid,'term',v_rule,v_from,null,'exempt',null,'DEV rollback test',gen_random_uuid()::text);
 v_key:=gen_random_uuid()::text;
 v_new:=public.transition_member_term(t.org::uuid,t.member::uuid,v_old,(v_from+interval '2 months')::date,'override_amount',150.50,'DEV succession test',v_key);
 if v_new<>public.transition_member_term(t.org::uuid,t.member::uuid,v_old,(v_from+interval '2 months')::date,'override_amount',150.50,'DEV succession test',v_key) then raise exception 'idempotency retry mismatch'; end if;
 if not exists(select 1 from public.recurring_member_terms where id=v_old and effective_to=(v_from+interval '1 month')::date and term_type='exempt')
 or not exists(select 1 from public.recurring_member_terms where id=v_new and effective_to is null and override_amount=150.50)
 then raise exception 'term boundary/value invalid'; end if;
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_old,(v_from+interval '3 months')::date,'standard',null,'DEV stale',gen_random_uuid()::text); raise exception 'stale transition accepted'; exception when sqlstate 'PT409' then null; end;
 begin perform public.transition_member_term(t.org::uuid,t.foreign_member::uuid,v_new,(v_from+interval '3 months')::date,'standard',null,'DEV foreign',gen_random_uuid()::text); raise exception 'cross-tenant member accepted'; exception when foreign_key_violation then null; end;
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '3 months')::date,'override_amount','NaN'::numeric,'DEV NaN',gen_random_uuid()::text); raise exception 'NaN accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '3 months')::date,'override_amount','Infinity'::numeric,'DEV Infinity',gen_random_uuid()::text); raise exception 'Infinity accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '3 months')::date,'override_amount',1.123,'DEV precision',gen_random_uuid()::text); raise exception 'precision accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '3 months')::date,'override_amount',1000000000000,'DEV overflow',gen_random_uuid()::text); raise exception 'overflow accepted'; exception when invalid_parameter_value then null; end;
 if public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '4 months')::date,null,null,'DEV close test',gen_random_uuid()::text)<>v_new then raise exception 'close result invalid'; end if;
 if not exists(select 1 from public.recurring_member_terms where id=v_new and effective_to=(v_from+interval '3 months')::date) then raise exception 'close boundary invalid'; end if;
 execute 'reset role';
 if (select count(*) from public.audit_logs where organization_id=t.org::uuid and action='member_configuration.transition' and entity_id in(v_old,v_new))<>2 then raise exception 'audit count invalid'; end if;
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='TREASURER') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '5 months')::date,'exempt',null,'DEV treasurer denied',gen_random_uuid()::text); raise exception 'treasurer allowed'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='VIEWER') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '5 months')::date,'exempt',null,'DEV viewer denied',gen_random_uuid()::text); raise exception 'viewer allowed'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.user_roles set role_id=(select id from public.roles where organization_id=t.org::uuid and code='ADMIN') where user_id=t.uid::uuid and organization_id=t.org::uuid;
 update public.saas_subscriptions set status='suspended' where organization_id=t.org::uuid;
 execute 'set local role authenticated';
 begin perform public.transition_member_term(t.org::uuid,t.member::uuid,v_new,(v_from+interval '5 months')::date,'exempt',null,'DEV suspended denied',gen_random_uuid()::text); raise exception 'suspended allowed'; exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.saas_subscriptions set status='active' where organization_id=t.org::uuid;
end loop;
if has_function_privilege('anon','public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text)','EXECUTE') then raise exception 'anon granted'; end if;
if v_charges<>(select count(*) from public.charges) or v_payments<>(select count(*) from public.payments) then raise exception 'ledger changed'; end if;
end $$;
rollback;
select 'DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS' as result;
