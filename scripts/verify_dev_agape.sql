-- DEV QA A/B, fictitious event/participants/charges all roll back.
begin;
do $$
declare t record;category uuid;member1 uuid;member2 uuid;inactive uuid;v_event uuid;v jsonb;k text;tag text;x record;
 checks integer:=0;cash_before numeric;viewer uuid;events_before bigint:=(select count(*) from public.events);
begin
 for t in select * from(values
 ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'23bdcd76-b7a2-47b5-9f65-267d4c1053be'::uuid),
 ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'d5842ad6-913d-4a3e-8250-876fb2e2a215'::uuid)
 )f(org,actor,other,foreign_member) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')then raise exception 'unexpected event fixture';end if;
  select sum(balance) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  select id into strict category from public.financial_categories where organization_id=t.org and domain='member_receivable' and active;
  select id into member1 from public.members where organization_id=t.org and status='active' order by id limit 1;
  insert into public.members(organization_id,full_name,status)values(t.org,'DEV QA AGAPE participant','active')returning id into member2;
  insert into public.members(organization_id,full_name,status)values(t.org,'DEV QA AGAPE inactive','inactive')returning id into inactive;
  tag:='DEV QA AGAPE '||gen_random_uuid()::text;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  begin perform public.preview_agape_event(t.other,category,tag,'2026-10-21','2026-10-22',1.25,array[member1]);raise exception 'foreign scope accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[t.foreign_member]);raise exception 'foreign member accepted';exception when foreign_key_violation then checks:=checks+1;end;
  begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[inactive]);raise exception 'inactive participant';exception when foreign_key_violation then checks:=checks+1;end;
  begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member1]);raise exception 'duplicate participant';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',-1,array[member1]);raise exception 'negative amount';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-20',1.25,array[member1]);raise exception 'due before event';exception when invalid_parameter_value then checks:=checks+1;end;
  v:=public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2]);
  if not(v->>'ready')::boolean or (v->>'participant_count')::integer<>2 or(v->>'charge_count')::integer<>2 or(v->>'total_amount')::numeric<>2.5 then raise exception 'event preview totals';end if;
  execute 'reset role';
  update public.members set full_name='DEV QA AGAPE changed' where organization_id=t.org and id=member2;
  execute 'set local role authenticated';
  begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,gen_random_uuid()::text);raise exception 'stale member preview';exception when sqlstate 'PT409' then checks:=checks+1;end;
  v:=public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2]);
  begin
   perform public.close_financial_period_idempotent(t.org,'2026-10-01','DEV QA agape closed rollback',gen_random_uuid()::text);
   begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,gen_random_uuid()::text);raise exception 'event in closed period';exception when sqlstate '55000' then checks:=checks+1;end;
   raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
  k:=gen_random_uuid()::text;
  v_event:=public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,k);
  if v_event<>public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,k)then raise exception 'event replay mismatch';end if;
  begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',2,array[member1,member2],v->>'fingerprint',tag,k);raise exception 'divergent event payload';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,gen_random_uuid()::text);raise exception 'event duplicated';exception when sqlstate 'PT409' then checks:=checks+1;end;
  if (select count(*) from public.event_participants where organization_id=t.org and public.event_participants.event_id=v_event and charge_id is not null)<>2
   or (select sum(b.open_amount) from public.v_charge_balances b join public.event_participants e on e.charge_id=b.charge_id where e.organization_id=t.org and e.event_id=v_event)<>2.5
   or (select count(*) from public.audit_logs where entity_id=v_event and action='agape.create')<>1
  then raise exception 'event linkage/charges/audit mismatch';end if;
  for x in select charge_id from public.event_participants e where e.organization_id=t.org and e.event_id=v_event loop
   perform public.cancel_member_charge_idempotent(t.org,x.charge_id,'2026-10-01',tag,gen_random_uuid()::text);
  end loop;
  begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1.25,array[member1,member2],v->>'fingerprint',tag,gen_random_uuid()::text);raise exception 'canceled event reissued';exception when sqlstate 'PT409' then checks:=checks+1;end;
  tag:=tag||' free';v:=public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',0,array[member1,member2]);
  v_event:=public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',0,array[member1,member2],v->>'fingerprint',tag,gen_random_uuid()::text);
  if (v->>'charge_count')::integer<>0 or (select count(*) from public.event_participants e where e.organization_id=t.org and e.event_id=v_event and charged_amount=0 and charge_id is null)<>2 then raise exception 'free attendance created debt';end if;
  execute 'reset role';
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  begin
   update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
   execute 'set local role authenticated';
   begin perform public.preview_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1,array[member1]);raise exception 'viewer preview';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.create_agape_event(t.org,category,tag,'2026-10-21','2026-10-22',1,array[member1],v->>'fingerprint',tag,gen_random_uuid()::text);raise exception 'viewer creation';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
  if (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>cash_before then raise exception 'event moved cash';end if;
 end loop;
 if checks<>26 or (select count(*) from public.events)<>events_before+4 then raise exception 'event gate coverage %',checks;end if;
 if has_function_privilege('anon','public.create_agape_event(uuid,uuid,text,date,date,numeric,uuid[],text,text,text)','execute')then raise exception 'anonymous event execution';end if;
end $$;
rollback;
select 'DEV_AGAPE_AB_ROLLBACK_PASS' result;
