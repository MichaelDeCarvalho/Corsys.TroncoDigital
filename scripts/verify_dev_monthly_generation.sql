begin;
do $$
declare t record;cat uuid;rule uuid;members uuid[];preview jsonb;again jsonb;
 batch uuid; idem text; amount numeric;qty integer;initial bigint:=(select count(*) from public.charges);
begin
for t in select * from (values
('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
) a(org,actor) loop
 select c.id into cat from public.financial_categories c
 join public.financial_category_account_mappings map on map.category_id=c.id and map.organization_id=c.organization_id
 join public.accounting_plans ap on ap.id=map.accounting_plan_id and ap.organization_id=c.organization_id
 where c.organization_id=t.org and c.domain='member_receivable' and c.active
 and ap.status='published' and ap.valid_from<='2027-02-01' and ap.valid_to>='2027-02-01'
 limit 1;
 if cat is null then raise exception 'Fixture accounting mapping missing';end if;
 update public.financial_categories set allow_recurrence=true where id=cat and organization_id=t.org;
 select array_agg(id order by id) into members from public.members where organization_id=t.org and status='active';
 if array_length(members,1)<>3 then raise exception 'Expected 3 active DEV members';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 rule:=public.create_tenant_monthly_rule(t.org,cat,'DEV TEMP monthly '||gen_random_uuid()::text,100,
    '2027-01-01',31,'DEV temporary recurring trial',gen_random_uuid()::text);
 perform public.schedule_member_configuration(t.org,members[1],'term',rule,'2027-02-01',null,'exempt',null,'DEV exempt term',gen_random_uuid()::text);
 perform public.schedule_member_configuration(t.org,members[2],'term',rule,'2027-02-01',null,'override_amount',35.50,'DEV override term',gen_random_uuid()::text);
 preview:=public.preview_monthly_charge_generation(t.org,rule,'2027-02-01');
 if preview->>'ready'<>'true' or (preview->>'eligible_members')::int<>3 or
    (preview->>'to_create')::int<>2 or (preview->>'exempt')::int<>1 or
    preview->>'accounting_mapping_ready'<>'true'
 then raise exception 'Invalid preview %',preview;end if;
 idem:=gen_random_uuid()::text;
 batch:=public.generate_monthly_member_charges(t.org,rule,'2027-02-01',preview->>'fingerprint','DEV authorize monthly batch',idem);
 if batch<>public.generate_monthly_member_charges(t.org,rule,'2027-02-01',preview->>'fingerprint','DEV authorize monthly batch',idem) then raise exception 'Idempotent replay changed';end if;
 select count(*),sum(original_amount) into qty,amount from public.charges
 where organization_id=t.org and batch_id=batch;
 if qty<>2 or amount<>135.50 then raise exception 'Wrong generated amount % %',qty,amount;end if;
 if exists(select 1 from public.charges where batch_id=batch and
  (due_date<>'2027-02-28' or accounting_plan_id is null or accounting_account_id is null or source_kind<>'recurring'))
 then raise exception 'Snapshot or short month due date invalid';end if;
 again:=public.preview_monthly_charge_generation(t.org,rule,'2027-02-01');
 if (again->>'to_create')::int<>0 or (again->>'already_generated')::int<>2 or again->>'ready'<>'false' then raise exception 'Duplicate preview not closed %',again;end if;
 begin
  perform public.generate_monthly_member_charges(t.org,rule,'2027-02-01',preview->>'fingerprint','DEV try duplicated monthly batch',gen_random_uuid()::text);
  raise exception 'Duplicate batch accepted';
 exception when check_violation then null;end;
 execute 'reset role';
end loop;
if has_function_privilege('anon','public.generate_monthly_member_charges(uuid,uuid,date,text,text,text)','execute') or
has_function_privilege('anon','public.preview_monthly_charge_generation(uuid,uuid,date)','execute')
then raise exception 'Anon recurring function enabled';end if;
if (select count(*) from public.charges)<>initial+4 then raise exception 'Expected four generated temporary rows';end if;
end $$;
rollback;
select 'DEV_MONTHLY_GENERATION_ROLLBACK_PASS' as result;
