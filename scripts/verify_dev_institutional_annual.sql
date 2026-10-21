-- DEV QA A/B only; every annual obligation and fixture rolls back. No cash movements.
begin;
do $$
declare t record;direction text;cat uuid;rule uuid;v jsonb;stale jsonb;v_fact uuid;key text;tag text;checks integer:=0;cash_before numeric;viewer uuid;
begin
 for t in select * from(values
  ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid),
  ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid)
 )f(org,actor,other) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')then raise exception 'unexpected fixture';end if;
  select coalesce(sum(balance),0) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  foreach direction in array array['payable','receivable'] loop
   select id into strict cat from public.financial_categories where organization_id=t.org and active
    and domain=case when direction='payable' then 'institutional_expense' else 'institutional_revenue' end;
   tag:='DEV QA ANNUAL ROLLBACK '||gen_random_uuid();key:=tag||' create';
   execute 'set local role authenticated';
   rule:=public.create_tenant_institutional_annual_rule(t.org,direction,cat,tag,'DEV QA fictício',1,'2027-02-01',31,tag,key);
   if public.create_tenant_institutional_annual_rule(t.org,direction,cat,tag,'DEV QA fictício',1,'2027-02-01',31,tag,key)<>rule then raise exception 'create replay changed';end if;
   v:=public.preview_institutional_annual_generation(t.org,rule,'2027-03-01');
   if (v->>'ready')::boolean or (v->>'annual_month')::integer<>2 then raise exception 'wrong anniversary month became ready';end if;
   begin perform public.generate_institutional_annual_obligation(t.org,rule,'2027-03-01',v->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'wrong month emitted';exception when check_violation then checks:=checks+1;end;
   v:=public.preview_institutional_annual_generation(t.org,rule,'2027-02-01');stale:=v;
   if not(v->>'ready')::boolean or v->>'due_date'<>'2027-02-28' then raise exception 'annual due date/eligibility incorrect';end if;
   perform public.set_tenant_institutional_annual_rule_status(t.org,rule,true,false,tag,tag||' off');
   begin perform public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'stale status emitted';exception when sqlstate 'PT409' then checks:=checks+1;end;
   perform public.set_tenant_institutional_annual_rule_status(t.org,rule,false,true,tag,tag||' on');
   begin perform public.create_tenant_institutional_annual_rule(t.other,direction,cat,tag,'DEV QA',1,'2027-02-01',31,tag,gen_random_uuid()::text);
    raise exception 'foreign scope accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.preview_institutional_annual_generation(t.org,gen_random_uuid(),'2027-02-01');
    raise exception 'foreign rule accepted';exception when foreign_key_violation then checks:=checks+1;end;
   v:=public.preview_institutional_annual_generation(t.org,rule,'2027-02-01');key:=tag||' emit';
   v_fact:=public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,key);
   if public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,key)<>v_fact then raise exception 'generation replay changed';end if;
   begin perform public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'duplicate annual emission';exception when sqlstate 'PT409' then checks:=checks+1;end;
   perform public.cancel_tenant_institutional_obligation_idempotent(t.org,v_fact,direction,'2027-02-01',tag,tag||' cancel');
   v:=public.preview_institutional_annual_generation(t.org,rule,'2027-02-01');
   if (v->>'ready')::boolean or (v->>'existing_id')::uuid<>v_fact then raise exception 'cancellation cleared annual history';end if;
   begin perform public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'cancelled annual reemitted';exception when check_violation then checks:=checks+1;end;
   perform public.schedule_institutional_recurring_price(t.org,rule,(stale->>'version_id')::uuid,2,'2027-03-01',tag,tag||' price');
   v:=public.preview_institutional_annual_generation(t.org,rule,'2027-03-01');
   if (v->>'ready')::boolean or (v->>'annual_month')::integer<>2 or (v->>'amount')::numeric<>2 then raise exception 'price change moved annual anniversary';end if;
   execute 'reset role';
   if (select count(*) from public.audit_logs where organization_id=t.org and action='institutional_rule.generate' and entity_id=v_fact)<>1 then raise exception 'duplicate annual audit';end if;
  end loop;
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  begin
   update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
   execute 'set local role authenticated';
   begin perform public.create_tenant_institutional_annual_rule(t.org,'receivable',cat,tag||' viewer','DEV QA',1,'2027-02-01',31,tag,gen_random_uuid()::text);
    raise exception 'viewer created annual rule';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.generate_institutional_annual_obligation(t.org,rule,'2027-02-01',v->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'viewer emitted annual obligation';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
  if (select coalesce(sum(balance),0) from public.v_financial_account_balances where organization_id=t.org)<>cash_before then raise exception 'annual generation moved cash';end if;
 end loop;
 if checks<>28 then raise exception 'missing annual negative checks: %',checks;end if;
 if has_function_privilege('anon','public.generate_institutional_annual_obligation(uuid,uuid,date,text,text,text)','execute') then raise exception 'anonymous annual command';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_ANNUAL_ROLLBACK_PASS' as result;
