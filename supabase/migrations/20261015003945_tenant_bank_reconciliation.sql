-- No ledger writes: import -> review -> validate -> explicit match/reversal.
create function public.stage_tenant_bank_statement(p_organization_id uuid,p_account_id uuid,
 p_file_name text,p_file_sha256 text,p_lines jsonb,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_line jsonb;v_n integer:=0;v_date date;v_amount numeric;
begin
 perform private.require_permission(p_organization_id,'reconciliation.manage');
 if p_file_name is null or length(p_file_name) not between 1 and 200
  or p_file_sha256 is null or p_file_sha256!~'^[a-f0-9]{64}$'
  or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500
  or octet_length(p_lines::text)>1000000
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid statement import' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'stage_tenant_bank_statement',btrim(p_idempotency_key),
  jsonb_build_object('account',p_account_id,'name',p_file_name,'hash',p_file_sha256,'lines',p_lines,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.financial_accounts where organization_id=p_organization_id and id=p_account_id and active for share;
 if not found then raise exception 'active account not found in tenant' using errcode='23503';end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(v_line) is distinct from 'object'
   or v_line->>'date' is null or (v_line->>'date')!~'^\d{4}-\d{2}-\d{2}$'
   or v_line->>'description' is null or length(btrim(v_line->>'description')) not between 1 and 500
   or v_line->>'amount' is null or (v_line->>'amount')!~'^-?\d{1,12}(\.\d{1,2})?$'
   or v_line->>'external_id' is not null and length(btrim(v_line->>'external_id')) not between 1 and 200
  then raise exception 'invalid statement line' using errcode='22023';end if;
  v_date:=(v_line->>'date')::date;v_amount:=(v_line->>'amount')::numeric;
  if v_date<date '2020-01-01' or v_date>current_date or v_amount=0 or abs(v_amount)>999999999999.99
  then raise exception 'invalid statement date or amount' using errcode='22023';end if;
 end loop;
 insert into public.bank_statement_imports(organization_id,financial_account_id,period_start,period_end,file_name,file_sha256,imported_by)
 select p_organization_id,p_account_id,min((value->>'date')::date),max((value->>'date')::date),p_file_name,p_file_sha256,auth.uid()
 from jsonb_array_elements(p_lines) returning id into v_id;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_n:=v_n+1;
  insert into public.bank_statement_lines(organization_id,statement_import_id,line_number,transaction_date,description,amount,external_id)
   values(p_organization_id,v_id,v_n,(v_line->>'date')::date,btrim(v_line->>'description'),(v_line->>'amount')::numeric,nullif(btrim(v_line->>'external_id'),''));
 end loop;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'bank_statement.stage','bank_statement_import',v_id,
  jsonb_build_object('account',p_account_id,'sha256',p_file_sha256,'line_count',v_n),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.stage_tenant_bank_statement(uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.stage_tenant_bank_statement(uuid,uuid,text,text,jsonb,text,text) to authenticated;

create function public.validate_tenant_bank_statement(p_organization_id uuid,p_import_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_import public.bank_statement_imports%rowtype;
begin
 perform private.require_permission(p_organization_id,'reconciliation.manage');
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid validation request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'validate_tenant_bank_statement',btrim(p_idempotency_key),
  jsonb_build_object('import',p_import_id,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_import from public.bank_statement_imports where organization_id=p_organization_id and id=p_import_id for update;
 if not found then raise exception 'statement not found in tenant' using errcode='23503';end if;
 if v_import.status<>'staged' then raise exception 'statement is not staged' using errcode='55000';end if;
 if not exists(select 1 from public.bank_statement_lines where organization_id=p_organization_id and statement_import_id=p_import_id)
 then raise exception 'empty statement' using errcode='23514';end if;
 update public.bank_statement_imports set status='validated' where id=p_import_id and organization_id=p_organization_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,reason)
 values(p_organization_id,auth.uid(),'bank_statement.validate','bank_statement_import',p_import_id,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_import_id);
 return p_import_id;
end $$;
revoke all on function public.validate_tenant_bank_statement(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.validate_tenant_bank_statement(uuid,uuid,text,text) to authenticated;

create function public.match_tenant_bank_statement(p_organization_id uuid,p_line_id uuid,p_kind text,p_target_id uuid,
 p_amount numeric,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_import uuid;v_status text;v_account uuid;
begin
 perform private.require_permission(p_organization_id,'reconciliation.manage');
 if p_kind is null or p_kind not in('member_payment','institutional_receipt','institutional_payable_payment','account_transfer')
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>999999999999.99
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid reconciliation request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'match_tenant_bank_statement',btrim(p_idempotency_key),
  jsonb_build_object('line',p_line_id,'kind',p_kind,'target',p_target_id,'amount',p_amount,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select statement_import_id into v_import from public.bank_statement_lines where organization_id=p_organization_id and id=p_line_id;
 if not found then raise exception 'line not found in tenant' using errcode='23503';end if;
 -- All match/reversal commands lock the import before line/target locks.
 select status,financial_account_id into v_status,v_account from public.bank_statement_imports
  where organization_id=p_organization_id and id=v_import for update;
 if v_status not in('validated','reconciled') then raise exception 'statement must be validated' using errcode='55000';end if;
 insert into public.bank_reconciliation_matches(organization_id,statement_line_id,member_payment_id,institutional_receipt_id,payable_payment_id,account_transfer_id,matched_amount,matched_by)
 values(p_organization_id,p_line_id,case when p_kind='member_payment' then p_target_id end,
  case when p_kind='institutional_receipt' then p_target_id end,case when p_kind='institutional_payable_payment' then p_target_id end,
  case when p_kind='account_transfer' then p_target_id end,p_amount,auth.uid()) returning id into v_id;
 update public.bank_statement_imports set status=case when exists(select 1 from public.v_bank_reconciliation_lines
  where organization_id=p_organization_id and statement_import_id=v_import and reconciliation_status<>'reconciled') then 'validated' else 'reconciled' end
  where organization_id=p_organization_id and id=v_import;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'bank_statement.match','bank_reconciliation_match',v_id,
  jsonb_build_object('line',p_line_id,'kind',p_kind,'target',p_target_id,'amount',p_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.match_tenant_bank_statement(uuid,uuid,text,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.match_tenant_bank_statement(uuid,uuid,text,uuid,numeric,text,text) to authenticated;

create function public.reverse_tenant_bank_match(p_organization_id uuid,p_match_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_import uuid;
begin
 perform private.require_permission(p_organization_id,'reconciliation.manage');
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid reconciliation reversal' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'reverse_tenant_bank_match',btrim(p_idempotency_key),
  jsonb_build_object('match',p_match_id,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select l.statement_import_id into v_import from public.bank_reconciliation_matches m join public.bank_statement_lines l
  on l.organization_id=m.organization_id and l.id=m.statement_line_id where m.organization_id=p_organization_id and m.id=p_match_id;
 if not found then raise exception 'match not found in tenant' using errcode='23503';end if;
 perform id from public.bank_statement_imports where organization_id=p_organization_id and id=v_import for update;
 perform id from public.bank_reconciliation_matches where organization_id=p_organization_id and id=p_match_id for update;
 insert into public.bank_reconciliation_match_reversals(match_id,organization_id,reason,reversed_by)
  values(p_match_id,p_organization_id,btrim(p_reason),auth.uid());
 update public.bank_statement_imports set status='validated' where organization_id=p_organization_id and id=v_import;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,reason)
 values(p_organization_id,auth.uid(),'bank_statement.match_reverse','bank_reconciliation_match',p_match_id,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_match_id);
 return p_match_id;
end $$;
revoke all on function public.reverse_tenant_bank_match(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reverse_tenant_bank_match(uuid,uuid,text,text) to authenticated;

-- A transfer has one independent bank leg per account; do not count the opposite leg.
create or replace function private.validate_bank_reconciliation_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line_amount numeric;
  v_line_signed numeric;
  v_statement_account uuid;
  v_existing_line numeric;
  v_existing_target numeric;
  v_target_amount numeric;
  v_target_account uuid;
  v_transfer_from uuid;
  v_transfer_to uuid;
begin
  select abs(l.amount), l.amount, i.financial_account_id
  into v_line_amount, v_line_signed, v_statement_account
  from public.bank_statement_lines l
  join public.bank_statement_imports i
    on i.organization_id = l.organization_id
   and i.id = l.statement_import_id
  where l.organization_id = new.organization_id
    and l.id = new.statement_line_id
  for update of l;

  if v_line_amount is null then
    raise exception 'statement line not found' using errcode = '23503';
  end if;

  select coalesce(sum(m.matched_amount), 0)
  into v_existing_line
  from public.bank_reconciliation_matches m
  left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
  where m.statement_line_id = new.statement_line_id
    and r.match_id is null;

  if v_existing_line + new.matched_amount > v_line_amount then
    raise exception 'reconciliation matches exceed statement line amount'
      using errcode = '23514';
  end if;

  if new.member_payment_id is not null then
    select p.amount, p.financial_account_id
      into v_target_amount, v_target_account
    from public.payments p
    where p.organization_id = new.organization_id
      and p.id = new.member_payment_id
      and p.source_kind = 'operational'
    for update;

    if v_target_amount is null
       or v_line_signed <= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'member payment does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.member_payment_id = new.member_payment_id
      and r.match_id is null;

  elsif new.institutional_receipt_id is not null then
    select r.amount, r.financial_account_id
      into v_target_amount, v_target_account
    from public.institutional_receipts r
    where r.organization_id = new.organization_id
      and r.id = new.institutional_receipt_id
    for update;

    if v_target_amount is null
       or v_line_signed <= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'institutional receipt does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals rr on rr.match_id = m.id
    where m.institutional_receipt_id = new.institutional_receipt_id
      and rr.match_id is null;

  elsif new.payable_payment_id is not null then
    select p.amount, p.financial_account_id
      into v_target_amount, v_target_account
    from public.institutional_payable_payments p
    where p.organization_id = new.organization_id
      and p.id = new.payable_payment_id
    for update;

    if v_target_amount is null
       or v_line_signed >= 0
       or v_target_account is distinct from v_statement_account then
      raise exception 'payable payment does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.payable_payment_id = new.payable_payment_id
      and r.match_id is null;

  else
    select t.amount, t.from_account_id, t.to_account_id
      into v_target_amount, v_transfer_from, v_transfer_to
    from public.financial_account_transfers t
    where t.organization_id = new.organization_id
      and t.id = new.account_transfer_id
    for update;

    if v_target_amount is null
       or (v_line_signed > 0 and v_transfer_to is distinct from v_statement_account)
       or (v_line_signed < 0 and v_transfer_from is distinct from v_statement_account) then
      raise exception 'account transfer does not match bank statement account/direction'
        using errcode = '23514';
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_existing_target
    from public.bank_reconciliation_matches m
    left join public.bank_reconciliation_match_reversals r on r.match_id = m.id
    where m.account_transfer_id = new.account_transfer_id
      and r.match_id is null
      and m.statement_line_id in (select bl.id from public.bank_statement_lines bl join public.bank_statement_imports bi on bi.organization_id=bl.organization_id and bi.id=bl.statement_import_id where bi.organization_id=new.organization_id and bi.financial_account_id=v_statement_account);
  end if;

  if coalesce(v_existing_target, 0) + new.matched_amount > v_target_amount then
    raise exception 'reconciliation matches exceed financial fact amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

