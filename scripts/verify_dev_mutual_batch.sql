-- DEV QA A/B. Both documented ranges 710-721 and 722-745 are tested with rollback.
begin;
do $$
declare t record;r record;category uuid;member1 uuid;member2 uuid;v jsonb;assignment jsonb;batch uuid;k text;x record;
 viewer uuid;checks integer:=0;cash_before numeric;before_batches bigint:=(select count(*) from public.mutual_batches);
begin
 for t in select * from(values
 ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'23bdcd76-b7a2-47b5-9f65-267d4c1053be'::uuid),
 ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'d5842ad6-913d-4a3e-8250-876fb2e2a215'::uuid)
 )f(org,actor,other,foreign_member) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')then raise exception 'unexpected mutual fixture';end if;
  select sum(balance) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  select id into strict category from public.financial_categories where organization_id=t.org and domain='member_receivable' and active;
  select id into member1 from public.members where organization_id=t.org and status='active' order by id limit 1;
  insert into public.members(organization_id,full_name,status)values(t.org,'DEV QA mutual second member','active')returning id into member2;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  assignment:=jsonb_build_array(jsonb_build_object('mutual_number',710,'member_id',member1));
  begin perform public.preview_mutual_batch(t.other,category,710,710,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);raise exception 'foreign mutual scope';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,710,710,1.25,'2026-10-01','2026-10-21','2026-10-22',jsonb_build_array(jsonb_build_object('mutual_number',710,'member_id',t.foreign_member)));raise exception 'foreign assignee';exception when foreign_key_violation then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,710,711,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);raise exception 'unassigned number';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,710,711,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment||assignment);raise exception 'duplicate number';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,711,711,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);raise exception 'number outside range';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,710,710,-1,'2026-10-01','2026-10-21','2026-10-22',assignment);raise exception 'negative mutual';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_mutual_batch(t.org,category,710,710,1.25,'2026-10-01','2026-09-21','2026-10-22',assignment);raise exception 'issue outside competence';exception when invalid_parameter_value then checks:=checks+1;end;
  for r in select * from(values(710,721),(722,745))q(start_number,end_number) loop
   select jsonb_agg(jsonb_build_object('mutual_number',n,'member_id',case when n%2=0 then member1 else member2 end) order by n)
   into assignment from generate_series(r.start_number,r.end_number)n;
   v:=public.preview_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);
   if not(v->>'ready')::boolean or(v->>'charge_count')::integer<>r.end_number-r.start_number+1
    or(v->>'total_amount')::numeric<>1.25*(r.end_number-r.start_number+1) or v->>'account_nature' is null then raise exception 'mutual preview totals/classification';end if;
   begin perform public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,repeat('0',64),'DEV QA stale mutual',gen_random_uuid()::text);raise exception 'stale mutual';exception when sqlstate 'PT409' then checks:=checks+1;end;
   if r.start_number=710 then
    begin
     perform public.close_financial_period_idempotent(t.org,'2026-10-01','DEV QA mutual closed rollback',gen_random_uuid()::text);
     begin perform public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA closed mutual',gen_random_uuid()::text);raise exception 'closed mutual';exception when sqlstate '55000' then checks:=checks+1;end;
     raise exception using errcode='P1234';
    exception when sqlstate 'P1234' then null;end;
   end if;
   k:=gen_random_uuid()::text;
   batch:=public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA mutual range',k);
   if batch<>public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA mutual range',k)then raise exception 'mutual replay mismatch';end if;
   begin perform public.create_mutual_batch(t.org,category,r.start_number,r.end_number,2,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA mutual range',k);raise exception 'changed mutual payload';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA mutual range',gen_random_uuid()::text);raise exception 'duplicate mutual batch';exception when sqlstate 'PT409' then checks:=checks+1;end;
   if (select count(*) from public.mutual_assignments where organization_id=t.org and mutual_batch_id=batch)<>r.end_number-r.start_number+1
    or (select sum(b.open_amount) from public.v_charge_balances b join public.mutual_assignments a on a.charge_id=b.charge_id where a.organization_id=t.org and a.mutual_batch_id=batch)<>1.25*(r.end_number-r.start_number+1)
    or (select count(*) from public.audit_logs where entity_id=batch and action='mutual_batch.create')<>1 then raise exception 'mutual charge/audit/linkage mismatch';end if;
   for x in select charge_id from public.mutual_assignments where organization_id=t.org and mutual_batch_id=batch loop
    perform public.cancel_member_charge_idempotent(t.org,x.charge_id,'2026-10-01','DEV QA mutual rollback cleanup',gen_random_uuid()::text);
   end loop;
   v:=public.preview_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);
   if (v->>'ready')::boolean or(v->>'existing_batch_id')::uuid<>batch then raise exception 'canceled mutual range lost history';end if;
   begin perform public.create_mutual_batch(t.org,category,r.start_number,r.end_number,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA mutual reissue',gen_random_uuid()::text);raise exception 'canceled mutual reissued';exception when sqlstate 'PT409' then checks:=checks+1;end;
  end loop;
  execute 'reset role';
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  begin
   update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
   execute 'set local role authenticated';
   begin perform public.preview_mutual_batch(t.org,category,722,745,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment);raise exception 'viewer mutual preview';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.create_mutual_batch(t.org,category,722,745,1.25,'2026-10-01','2026-10-21','2026-10-22',assignment,v->>'fingerprint','DEV QA viewer mutual',gen_random_uuid()::text);raise exception 'viewer mutual creation';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
  if (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>cash_before then raise exception 'mutual changed cash';end if;
 end loop;
 if checks<>36 or(select count(*) from public.mutual_batches)<>before_batches+4 then raise exception 'mutual coverage %',checks;end if;
 if has_function_privilege('anon','public.create_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb,text,text,text)','execute')then raise exception 'anon mutual command';end if;
end $$;
rollback;
select 'DEV_MUTUAL_BATCH_AB_ROLLBACK_PASS' result;
