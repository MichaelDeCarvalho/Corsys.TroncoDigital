-- Authorized DEV QA FINANCE A/B only; all rules, facts and changes roll back.
-- Claims simulated, not signed HTTP or concurrency.
begin;
do $$
declare t record;direction text;cat uuid;rule uuid;preview jsonb;key text;tag text;fact uuid;
 checks integer:=0;before_cash numeric;viewer uuid;v_ok boolean;
begin
 for t in select * from(values
  ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid),
  ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid)
 ) f(org,actor,other) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')
   or private.is_period_closed(t.org,'2026-10-01') then raise exception 'QA fixture mismatch';end if;
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  select coalesce(sum(balance),0) into before_cash from public.v_financial_account_balances where organization_id=t.org;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  foreach direction in array array['payable','receivable'] loop
   select id into strict cat from public.financial_categories where organization_id=t.org
    and domain=case when direction='payable' then 'institutional_expense' else 'institutional_revenue' end;
   tag:='DEV QA INSTITUTIONAL MONTHLY '||gen_random_uuid()::text;key:=tag||' create';
   if direction='payable' then
    insert into public.expense_approval_policies(organization_id,name,mode,minimum_approvers,status,valid_from,valid_to,created_by,published_by,published_at)
    values(t.org,tag,'all',2,'published','2026-10-01','2026-10-31',t.actor,t.actor,now());
   end if;
   execute 'set local role authenticated';
   rule:=public.create_tenant_institutional_monthly_rule(t.org,direction,cat,tag,'DEV QA fictício',1,'2026-10-01',31,tag,key);
   if public.create_tenant_institutional_monthly_rule(t.org,direction,cat,tag,'DEV QA fictício',1,'2026-10-01',31,tag,key)<>rule
   then raise exception 'rule replay mismatch';end if;
   begin perform public.create_tenant_institutional_monthly_rule(t.org,direction,cat,tag,'DEV QA fictício',2,'2026-10-01',31,tag,key);
    raise exception 'changed create replay accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.create_tenant_institutional_monthly_rule(t.other,direction,cat,tag,'DEV QA fictício',1,'2026-10-01',31,tag,gen_random_uuid()::text);
    raise exception 'foreign create accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.create_tenant_institutional_monthly_rule(t.org,direction,cat,tag||' invalid','DEV QA fictício','NaN','2026-10-01',31,tag,gen_random_uuid()::text);
    raise exception 'NaN accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.preview_institutional_monthly_generation(t.other,rule,'2026-10-01');
    raise exception 'foreign preview accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.preview_institutional_monthly_generation(t.org,gen_random_uuid(),'2026-10-01');
    raise exception 'foreign rule ID accepted';exception when foreign_key_violation then checks:=checks+1;end;
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-09-01');
   if (preview->>'ready')::boolean or preview->>'version_id' is not null then raise exception 'missing price became ready';end if;
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2027-02-01');
   if not(preview->>'ready')::boolean or preview->>'due_date'<>'2027-02-28' then raise exception 'February due clamp failed';end if;
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
   if not(preview->>'ready')::boolean or preview->>'organization_id'<>t.org::text
    or preview->>'direction'<>direction or (preview->>'amount')::numeric<>1
   then raise exception 'positive preview mismatch';end if;
   perform public.set_tenant_institutional_monthly_rule_status(t.org,rule,true,false,tag,tag||' deactivate');
   begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'stale preview accepted';exception when serialization_failure then checks:=checks+1;end;
   begin perform public.set_tenant_institutional_monthly_rule_status(t.org,rule,true,false,tag,gen_random_uuid()::text);
    raise exception 'stale status accepted';exception when serialization_failure then checks:=checks+1;end;
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
   begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,gen_random_uuid()::text);
    raise exception 'inactive generation accepted';exception when check_violation then checks:=checks+1;end;
   perform public.set_tenant_institutional_monthly_rule_status(t.org,rule,false,true,tag,tag||' reactivate');
   begin
    perform public.close_financial_period(t.org,'2026-10-01',tag);
    preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
    if not(preview->>'period_closed')::boolean then raise exception 'closed period not reported';end if;
    begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,gen_random_uuid()::text);
     raise exception 'closed generation accepted';exception when check_violation then checks:=checks+1;end;
    raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   execute 'reset role';
   begin
    update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
    execute 'set local role authenticated';
    begin perform public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
     raise exception 'viewer preview accepted';exception when insufficient_privilege then checks:=checks+1;end;
    begin perform public.set_tenant_institutional_monthly_rule_status(t.org,rule,true,false,tag,gen_random_uuid()::text);
     raise exception 'viewer status accepted';exception when insufficient_privilege then checks:=checks+1;end;
    execute 'reset role';raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   begin
    update public.saas_subscriptions set status='suspended' where organization_id=t.org and status='active';
    execute 'set local role authenticated';
    begin perform public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
     raise exception 'suspended preview accepted';exception when insufficient_privilege then checks:=checks+1;end;
    execute 'reset role';raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   execute 'set local role authenticated';
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');key:=tag||' generate';
   fact:=public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,key);
   if public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,key)<>fact
   then raise exception 'generation replay mismatch';end if;
   execute format('select true from public.%I where organization_id=$1 and id=$2 and recurring_rule_id=$3 and amount=1 and due_date=date ''2026-10-31''',
    case when direction='payable' then 'institutional_payables' else 'institutional_receivables' end)
    into v_ok using t.org,fact,rule;
   if v_ok is distinct from true then raise exception 'generated snapshot mismatch';end if;
   if direction='payable' and not exists(select 1 from public.institutional_payables p join public.payable_approval_requests r
    on r.organization_id=p.organization_id and r.payable_id=p.id where p.organization_id=t.org and p.id=fact
    and p.approval_required and p.approval_min_approvers=2 and r.minimum_approvers=2 and r.amount_snapshot=1)
   then raise exception 'generation failed to preserve the configured approval request';end if;
   begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,key||' duplicate');
    raise exception 'second emission accepted';exception when serialization_failure then checks:=checks+1;end;
   perform public.cancel_tenant_institutional_obligation_idempotent(t.org,fact,direction,'2026-10-01',tag,tag||' cancel');
   preview:=public.preview_institutional_monthly_generation(t.org,rule,'2026-10-01');
   if (preview->>'ready')::boolean or preview->>'existing_id'<>fact::text then raise exception 'canceled history lost generation guard';end if;
   begin perform public.generate_institutional_monthly_obligation(t.org,rule,'2026-10-01',preview->>'fingerprint',tag,key||' regenerate canceled');
    raise exception 'canceled month emitted again';exception when check_violation then checks:=checks+1;end;
   execute 'reset role';
   if (select count(*) from public.audit_logs where organization_id=t.org and action='institutional_rule.generate' and entity_id=fact)<>1
   then raise exception 'generation audit duplicate/missing';end if;
  end loop;
  if (select coalesce(sum(balance),0) from public.v_financial_account_balances where organization_id=t.org)<>before_cash
  then raise exception 'obligation generation moved money';end if;
 end loop;
 if checks<>56 then raise exception 'negative checks count mismatch: %',checks;end if;
 if has_function_privilege('anon','public.generate_institutional_monthly_obligation(uuid,uuid,date,text,text,text)','execute')
 then raise exception 'anonymous generation grant';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_MONTHLY_A_B_4_POSITIVE_56_NEGATIVE_ROLLBACK_PASS (simulated claims; not HTTP)' result;
