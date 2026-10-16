-- DEV szqkdekwhzxsoxorgvaz; authorized isolated QA FINANCE only.
-- All facts, profiles and subscription changes roll back. Claims simulated, not HTTP.
begin;
do $$
declare t record;k text;cat uuid;method uuid;account uuid;obligation uuid;movement uuid;
 tag text;key text;cash numeric;dre jsonb;view_name text;id_col text;alloc_rev text;
 import_id uuid;line_id uuid;match_id uuid;viewer uuid;admin uuid;checks integer:=0;v_ok boolean;
begin
 for t in select * from (values
  ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid),
  ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid)
 ) f(org,actor,other) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')
   or private.is_period_closed(t.org,'2026-10-01') then raise exception 'QA fixture mismatch';end if;
  select id into strict method from public.payment_methods where organization_id=t.org and name='DEV QA método fictício';
  select id into strict account from public.financial_accounts where organization_id=t.org and name='DEV QA Origem';
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  select id into strict admin from public.roles where organization_id=t.org and code='ADMIN';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  foreach k in array array['payable_payment','institutional_receipt'] loop
   select id into strict cat from public.financial_categories where organization_id=t.org
    and domain=case when k='payable_payment' then 'institutional_expense' else 'institutional_revenue' end;
   view_name:=case when k='payable_payment' then 'v_institutional_payable_effective' else 'v_institutional_receivable_effective' end;
   id_col:=case when k='payable_payment' then 'payable_id' else 'receivable_id' end;
   alloc_rev:=case when k='payable_payment' then 'institutional_payable_allocation_reversals' else 'institutional_receipt_allocation_reversals' end;
   tag:='DEV QA REVERSAL ROLLBACK '||gen_random_uuid()::text;key:=tag||' reverse';
   execute 'set local role authenticated';
   select coalesce(sum(balance),0) into cash from public.v_financial_account_balances where organization_id=t.org;
   execute format('select public.%I($1,$2,null,$3,$3,date ''2026-10-01'',date ''2026-10-15'',date ''2026-10-20'',date ''2026-10-01'',1,$4)',
    case when k='payable_payment' then 'create_institutional_payable' else 'create_institutional_receivable' end)
    into obligation using t.org,cat,tag,tag||' obligation';
   select coalesce(jsonb_agg(to_jsonb(d) order by d.account_code),'[]'::jsonb) into dre
    from public.read_tenant_dre(t.org,'2026-10-01','2026-10-01') d;
   execute format('select public.%I($1,$2,date ''2026-10-15'',date ''2026-10-01'',1,0.50,$3,$4,$5,$6)',
    case when k='payable_payment' then 'register_institutional_payable_payment' else 'register_institutional_receipt' end)
    into movement using t.org,obligation,method,account,tag,tag||' movement';
   -- Both account-scope denial and a foreign/missing ID under own scope.
   begin perform public.reverse_tenant_institutional_movement(t.other,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
    raise exception 'foreign tenant accepted';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.reverse_tenant_institutional_movement(t.org,k,gen_random_uuid(),'2026-10-15',tag,gen_random_uuid()::text);
    raise exception 'missing/foreign ID accepted';exception when foreign_key_violation then checks:=checks+1;end;
   begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-14',tag,gen_random_uuid()::text);
    raise exception 'backdated reversal accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   -- Closed-period and canceled-obligation rejection, each isolated by subtransaction.
   begin
    perform public.close_financial_period(t.org,'2026-10-01',tag);
    begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
     raise exception 'closed period accepted';exception when sqlstate '55000' then checks:=checks+1;end;
    raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   begin
    execute format('select public.%I($1,$2,date ''2026-10-01'',$3)',case when k='payable_payment' then 'cancel_institutional_payable' else 'cancel_institutional_receivable' end)
     using t.org,obligation,tag;
    begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
     raise exception 'canceled allocation accepted';exception when sqlstate '55000' then checks:=checks+1;end;
    raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   execute 'reset role';
   begin
    update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
    execute 'set local role authenticated';
    begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
     raise exception 'viewer accepted';exception when insufficient_privilege then checks:=checks+1;end;
    execute 'reset role';raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   begin
    update public.saas_subscriptions set status='suspended' where organization_id=t.org and status='active';
    execute 'set local role authenticated';
    begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
     raise exception 'suspended tenant accepted';exception when insufficient_privilege then checks:=checks+1;end;
    execute 'reset role';raise exception using errcode='P1234';
   exception when sqlstate 'P1234' then null;end;
   execute 'set local role authenticated';
   import_id:=public.stage_tenant_bank_statement(t.org,account,tag||'.csv',encode(extensions.digest(tag,'sha256'),'hex'),
    jsonb_build_array(jsonb_build_object('date','2026-10-15','description',tag,'amount',case when k='payable_payment' then '-0.50' else '0.50' end)),tag,tag||' import');
   perform public.validate_tenant_bank_statement(t.org,import_id,tag,tag||' validate');
   select id into strict line_id from public.bank_statement_lines where organization_id=t.org and statement_import_id=import_id;
   match_id:=public.match_tenant_bank_statement(t.org,line_id,case when k='payable_payment' then 'institutional_payable_payment' else 'institutional_receipt' end,movement,0.50,tag,tag||' match');
   begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,gen_random_uuid()::text);
    raise exception 'active bank match accepted';exception when sqlstate '55000' then checks:=checks+1;end;
   perform public.reverse_tenant_bank_match(t.org,match_id,tag,tag||' unmatch');
   if public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,key)<>movement
    or public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,key)<>movement
   then raise exception 'reversal/replay result mismatch';end if;
   begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-16',tag,key);
    raise exception 'divergent replay accepted';exception when invalid_parameter_value then checks:=checks+1;end;
   begin perform public.reverse_tenant_institutional_movement(t.org,k,movement,'2026-10-15',tag,key||' second');
    raise exception 'second reversal accepted';exception when unique_violation then checks:=checks+1;end;
   begin perform public.match_tenant_bank_statement(t.org,line_id,case when k='payable_payment' then 'institutional_payable_payment' else 'institutional_receipt' end,movement,0.50,tag,tag||' reversed match');
    raise exception 'reversed movement matched';exception when sqlstate '55000' then checks:=checks+1;end;
   if (select coalesce(sum(balance),0) from public.v_financial_account_balances where organization_id=t.org)<>cash
    or (select coalesce(jsonb_agg(to_jsonb(d) order by d.account_code),'[]'::jsonb) from public.read_tenant_dre(t.org,'2026-10-01','2026-10-01') d)<>dre
   then raise exception 'cash not restored or DRE changed by settlement/reversal';end if;
   execute format('select true from public.%I where organization_id=$1 and %I=$2 and open_amount=1 and allocated_amount=0 and not is_canceled and integrity_ok',view_name,id_col)
    into v_ok using t.org,obligation;
   if v_ok is distinct from true then raise exception 'obligation not reopened';end if;
   execute 'reset role';
   if (select count(*) from public.audit_logs where organization_id=t.org and entity_id=movement and action='institutional_movement.reverse')<>1
   then raise exception 'duplicate/missing reversal audit';end if;
  end loop;
 end loop;
 if checks<>44 then raise exception 'negative count mismatch: %',checks;end if;
 if has_function_privilege('anon','public.reverse_tenant_institutional_movement(uuid,text,uuid,date,text,text)','execute')
  or has_function_privilege('authenticated','private.reject_reversed_institutional_bank_match()','execute')
 then raise exception 'unexpected execution privilege';end if;
end $$;
rollback;
select 'DEV_INSTITUTIONAL_REVERSAL_A_B_4_POSITIVE_44_NEGATIVE_ROLLBACK_PASS (simulated claims, not HTTP/concurrency)' as result;
