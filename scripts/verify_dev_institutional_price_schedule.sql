-- DEV only, new disposable rules. Simulated claims; all changes roll back.
begin;
do $$
declare t record;cat uuid;rule uuid;old_version uuid;new_version uuid;fact uuid;p jsonb;stale jsonb;
 tag text;key text;direction text;cash_before numeric;checks integer:=0;viewer uuid;
begin
 for t in select * from(values
  ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid),
  ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid)
 ) f(org,actor,other) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')
  then raise exception 'unexpected fixture';end if;
  select coalesce(sum(balance),0) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  foreach direction in array array['payable','receivable'] loop
   select id into strict cat from public.financial_categories where organization_id=t.org
    and domain=case when direction='payable' then 'institutional_expense' else 'institutional_revenue' end;
   tag:='DEV QA PRICE '||gen_random_uuid()::text;key:=tag||' schedule';
   execute 'set local role authenticated';
   rule:=public.create_tenant_institutional_monthly_rule(t.org,direction,cat,tag,'DEV QA fictício',1,'2026-10-01',31,tag,tag||' create');
   p:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
   old_version:=(p->>'version_id')::uuid;
   fact:=public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',p->>'fingerprint',tag,tag||' original');
   stale:=public.preview_institutional_monthly_generation(t.org,rule,'2026-11-01');
   new_version:=public.schedule_institutional_recurring_price(t.org,rule,old_version,2,'2026-11-01',tag,key);
   if new_version is null or new_version=old_version or
    public.schedule_institutional_recurring_price(t.org,rule,old_version,2,'2026-11-01',tag,key)<>new_version
   then raise exception 'price replay mismatch';end if;
   begin perform public.schedule_institutional_recurring_price(t.org,rule,old_version,3,'2026-11-01',tag,key);
    raise exception 'changed replay accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.schedule_institutional_recurring_price(t.org,rule,old_version,3,'2026-12-01',tag,gen_random_uuid()::text);
    raise exception 'stale version accepted';exception when sqlstate 'PT409' then checks:=checks+1;end;
   begin perform public.schedule_institutional_recurring_price(t.other,rule,new_version,3,'2026-12-01',tag,gen_random_uuid()::text);
    raise exception 'foreign scope accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.schedule_institutional_recurring_price(t.org,rule,gen_random_uuid(),3,'2026-12-01',tag,gen_random_uuid()::text);
    raise exception 'foreign version accepted';exception when foreign_key_violation then checks:=checks+1;end;
   begin perform public.schedule_institutional_recurring_price(t.org,rule,new_version,'NaN','2026-12-01',tag,gen_random_uuid()::text);
    raise exception 'NaN accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.schedule_institutional_recurring_price(t.org,rule,new_version,3,'2026-10-01',tag,gen_random_uuid()::text);
    raise exception 'retroactive price accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-11-01',stale->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'stale generation accepted';exception when sqlstate 'PT409' then checks:=checks+1;end;
   p:=public.preview_institutional_monthly_generation(t.org,rule,'2026-11-01');
   if (p->>'amount')::numeric<>2 or (p->>'version_id')::uuid<>new_version then raise exception 'future price incorrect';end if;
   perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-11-01',p->>'fingerprint',tag,tag||' future');
   p:=public.preview_institutional_monthly_generation(t.org,rule,'2026-12-01');
   perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-12-01',p->>'fingerprint',tag,tag||' December');
   begin perform public.schedule_institutional_recurring_price(t.org,rule,new_version,3,'2026-12-01',tag,gen_random_uuid()::text);
    raise exception 'issued price rewritten';exception when check_violation then checks:=checks+1;end;
   execute 'reset role';
   if (select amount from public.institutional_recurring_rule_versions where id=old_version)<>1
    or (select valid_to_competence from public.institutional_recurring_rule_versions where id=old_version)<>'2026-10-01'::date
    or (select count(*) from public.audit_logs where organization_id=t.org and entity_id=rule and action='institutional_rule.price_schedule')<>1
   then raise exception 'price history or audit incorrect';end if;
   if direction='payable' then
    if (select amount from public.institutional_payables where id=fact)<>1 then raise exception 'posted payable changed';end if;
   else
    if (select amount from public.institutional_receivables where id=fact)<>1 then raise exception 'posted receivable changed';end if;
   end if;
   select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
   begin
    update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
    execute 'set local role authenticated';
    begin perform public.schedule_institutional_recurring_price(t.org,rule,new_version,3,'2027-01-01',tag,gen_random_uuid()::text);
     raise exception 'viewer accepted';exception when insufficient_privilege then checks:=checks+1;end;
    execute 'reset role';raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
  end loop;
  if (select coalesce(sum(balance),0) from public.v_financial_account_balances where organization_id=t.org)<>cash_before
  then raise exception 'cash changed';end if;
 end loop;
 if checks<>36 then raise exception 'missing negative checks: %',checks;end if;
 if has_function_privilege('anon','public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text)','execute')
 then raise exception 'anonymous execute';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_PRICE_SCHEDULE_ROLLBACK_PASS' as result;
