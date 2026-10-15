begin;
do $$
declare t record;p record;v_import uuid;v_line uuid;v_match uuid;v_key text;v_hash text;v_lines jsonb;v_other uuid;
 v_payments bigint:=(select count(*) from public.payments);v_imports bigint:=(select count(*) from public.bank_statement_imports);
begin
 for t in select * from (values
  ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid),
  ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid)
 ) x(org,actor) loop
  select * into strict p from public.payments where organization_id=t.org and source_kind='operational' and amount>=1 order by id limit 1;
  select id into strict v_other from public.financial_accounts where organization_id<>t.org order by id limit 1;
  v_lines:=jsonb_build_array(jsonb_build_object('date',p.payment_date,'description','DEV rollback bank match','amount','1.00','external_id','test-1'));
  v_key:=gen_random_uuid()::text;v_hash:=md5(v_key)||md5(v_key);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  begin
   perform public.stage_tenant_bank_statement(t.org,v_other,'test.csv',v_hash,v_lines,'Foreign account test',gen_random_uuid()::text);
   raise exception 'foreign account accepted';exception when foreign_key_violation then null;end;
  v_import:=public.stage_tenant_bank_statement(t.org,p.financial_account_id,'test.csv',v_hash,v_lines,'Import test',v_key);
  if public.stage_tenant_bank_statement(t.org,p.financial_account_id,'test.csv',v_hash,v_lines,'Import test',v_key)<>v_import then raise exception 'stage replay failed';end if;
  begin
   perform public.stage_tenant_bank_statement(t.org,p.financial_account_id,'other.csv',v_hash,v_lines,'Import test',v_key);
   raise exception 'mismatched replay accepted';exception when invalid_parameter_value then null;end;
  select id into strict v_line from public.bank_statement_lines where organization_id=t.org and statement_import_id=v_import;
  begin
   perform public.match_tenant_bank_statement(t.org,v_line,'member_payment',p.id,1,'Before validation',gen_random_uuid()::text);
   raise exception 'staged match accepted';exception when object_not_in_prerequisite_state then null;end;
  perform public.validate_tenant_bank_statement(t.org,v_import,'Reviewed import',gen_random_uuid()::text);
  v_key:=gen_random_uuid()::text;
  v_match:=public.match_tenant_bank_statement(t.org,v_line,'member_payment',p.id,1,'Manual match test',v_key);
  if public.match_tenant_bank_statement(t.org,v_line,'member_payment',p.id,1,'Manual match test',v_key)<>v_match then raise exception 'match replay failed';end if;
  if not exists(select 1 from public.bank_statement_imports where id=v_import and status='reconciled') then raise exception 'status not reconciled';end if;
  begin
   perform public.match_tenant_bank_statement(t.org,v_line,'member_payment',p.id,1,'Overmatch test',gen_random_uuid()::text);
   raise exception 'overmatch accepted';exception when check_violation then null;end;
  v_key:=gen_random_uuid()::text;
  perform public.reverse_tenant_bank_match(t.org,v_match,'Undo reviewed match',v_key);
  perform public.reverse_tenant_bank_match(t.org,v_match,'Undo reviewed match',v_key);
  if not exists(select 1 from public.v_bank_reconciliation_lines where statement_line_id=v_line and matched_amount=0) then raise exception 'reversal failed';end if;
  if exists(select 1 from public.bank_statement_imports where organization_id<>t.org) then raise exception 'RLS leak';end if;
  begin
   perform public.validate_tenant_bank_statement(case when t.org='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' then 'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid else 'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid end,v_import,'Foreign tenant test',gen_random_uuid()::text);
   raise exception 'foreign tenant allowed';exception when insufficient_privilege then null;end;
  execute 'reset role';
 end loop;
 if (select count(*) from public.payments)<>v_payments then raise exception 'ledger changed';end if;
 if (select count(*) from public.bank_statement_imports)<>v_imports+2 then raise exception 'unexpected imports';end if;
 if exists(select 1 from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public'
  and proc.proname in('stage_tenant_bank_statement','validate_tenant_bank_statement','match_tenant_bank_statement','reverse_tenant_bank_match')
  and has_function_privilege('anon',proc.oid,'execute')) then raise exception 'anonymous execute allowed';end if;
end $$;
rollback;
select 'DEV_BANK_RECONCILIATION_ROLLBACK_PASS' result;
