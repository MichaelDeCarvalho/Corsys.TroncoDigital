begin;
do $$
declare t record;v_member uuid;v_cat uuid;v_charge uuid;v_cancel uuid;
 v_close uuid;v_reopen uuid;v_key text;v_before bigint:=(select count(*) from public.charges);
begin
 for t in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
 ) a(org,actor) loop
 select id into v_member from public.members where organization_id=t.org and status='active' order by id limit 1;
 select c.id into v_cat from public.financial_categories c
 join public.financial_category_account_mappings m on m.category_id=c.id and m.organization_id=c.organization_id
 join public.accounting_plans p on p.id=m.accounting_plan_id
 where c.organization_id=t.org and c.domain='member_receivable' and c.active and
 p.status='published' and p.valid_from<='2026-10-01' and p.valid_to>='2026-10-01'
 order by c.id limit 1;
 if v_cat is null or v_member is null then raise exception 'Missing test fixtures';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 v_charge:=public.create_manual_charge(t.org,v_member,v_cat,'DEV temporary manual charge',
 '2026-10-01','2026-10-01','2026-10-10','2026-10-01',15,
 'DEV manual','DEV-'||gen_random_uuid()::text);
 v_key:=gen_random_uuid()::text;
 v_cancel:=public.cancel_member_charge_idempotent(t.org,v_charge,'2026-10-01','DEV cancel duplicate-safe',v_key);
 if v_cancel<>public.cancel_member_charge_idempotent(t.org,v_charge,'2026-10-01','DEV cancel duplicate-safe',v_key)
 then raise exception 'Cancel retry mismatch';end if;
 if not exists(select 1 from public.v_charge_balances where charge_id=v_charge and
 is_cancelled and open_amount=0 and integrity_ok)then raise exception 'Cancelled charge ledger mismatch';end if;
 v_key:=gen_random_uuid()::text;
 v_close:=public.close_financial_period_idempotent(t.org,'2026-08-01','DEV period closed for test',v_key);
 if v_close<>public.close_financial_period_idempotent(t.org,'2026-08-01','DEV period closed for test',v_key)
 then raise exception 'Close retry mismatch';end if;
 execute 'reset role';
 if not private.is_period_closed(t.org,'2026-08-01') then raise exception 'Close not effective';end if;
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_reopen:=public.reopen_financial_period_idempotent(t.org,'2026-08-01','DEV period reopened for test',v_key);
 if v_reopen<>public.reopen_financial_period_idempotent(t.org,'2026-08-01','DEV period reopened for test',v_key)
 then raise exception 'Reopen retry mismatch';end if;
 execute 'reset role';
 if private.is_period_closed(t.org,'2026-08-01') then raise exception 'Period was not reopened';end if;
 end loop;
 if has_function_privilege('anon','public.cancel_member_charge_idempotent(uuid,uuid,date,text,text)','execute')
 or has_function_privilege('anon','public.close_financial_period_idempotent(uuid,date,text,text)','execute')
 or has_function_privilege('anon','public.reopen_financial_period_idempotent(uuid,date,text,text)','execute')
 then raise exception 'Anon finance command grant';end if;
 if (select count(*) from public.charges)<>v_before+2 then raise exception 'Fixture charge count mismatch';end if;
end $$;
rollback;
select 'DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS' as result;