-- DEV only: synthetic destination lives entirely inside the rolled-back transaction.
begin;
do $$
declare
 o uuid; u uuid; src uuid; dst uuid; t uuid; replay uuid; k text;
 fixture uuid; plan uuid; patrimonial uuid; member_id uuid; method_id uuid;
 bank_import uuid;bank_line uuid;bank_match uuid;bank_account uuid;bank_amount text;
 before_src numeric; after_src numeric; total_before numeric; total_after numeric;
 facts_before bigint;
begin
 foreach o in array array['f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid] loop
  select ur.user_id into strict u from public.user_roles ur join public.roles r on r.id=ur.role_id
   where ur.organization_id=o and r.code='ADMIN';
  -- A fresh disposable tenant avoids changing published accounting plans in A/B.
  insert into public.organizations(name) values('DEV ROLLBACK transfer '||gen_random_uuid()) returning id into fixture;
  insert into public.user_roles(organization_id,user_id,role_id)
   select fixture,u,id from public.roles where organization_id=fixture and code='ADMIN';
  insert into public.saas_tenant_accounts(organization_id) values(fixture);
  insert into public.saas_subscriptions(organization_id,plan_id,plan_version_id,status)
   select fixture,plan_id,plan_version_id,'active' from public.saas_subscriptions where organization_id=o and status='active';
  o:=fixture;
  insert into public.financial_accounts(organization_id,name,account_type)
   values(o,'DEV ROLLBACK source','bank') returning id into src;
  insert into public.financial_accounts(organization_id,name,account_type)
   values(o,'DEV ROLLBACK transfer destination '||gen_random_uuid(),'bank') returning id into dst;
  insert into public.accounting_plans(organization_id,name,valid_from,valid_to)
   values(o,'DEV ROLLBACK plan',date_trunc('year',current_date)::date,(date_trunc('year',current_date)+interval '1 year - 1 day')::date) returning id into plan;
  insert into public.accounting_accounts(organization_id,accounting_plan_id,code,description,row_type,nature)
   values(o,plan,'1','DEV ROLLBACK patrimonial','analytic','patrimonial') returning id into patrimonial;
  insert into public.financial_account_accounting_mappings(organization_id,accounting_plan_id,financial_account_id,accounting_account_id)
   values(o,plan,src,patrimonial),(o,plan,dst,patrimonial);
  update public.accounting_plans set status='published',published_at=now() where id=plan;
  insert into public.members(organization_id,full_name) values(o,'DEV ROLLBACK member') returning id into member_id;
  insert into public.payment_methods(organization_id,name) values(o,'DEV ROLLBACK method') returning id into method_id;
  insert into public.payments(organization_id,member_id,payment_date,accounting_period,amount,payment_method_id,financial_account_id,source_kind)
   values(o,member_id,current_date,date_trunc('month',current_date)::date,10,method_id,src,'operational');
  select coalesce(sum(signed_amount),0) into before_src from public.v_financial_account_movements
   where organization_id=o and financial_account_id=src and movement_date<=current_date;
  if before_src<1 then raise exception 'fixture requires positive source balance'; end if;
  select coalesce(sum(signed_amount),0) into total_before from public.v_financial_account_movements where organization_id=o;
  select count(*) into facts_before from public.v_dre_entries where organization_id=o;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  k:=gen_random_uuid()::text;
  t:=public.register_tenant_account_transfer_idempotent(o,src,dst,current_date,1,'DEV rollback','Positive command test',k);
  replay:=public.register_tenant_account_transfer_idempotent(o,src,dst,current_date,1,'DEV rollback','Positive command test',k);
  if replay<>t then raise exception 'transfer replay differs'; end if;
  begin
   perform public.register_tenant_account_transfer_idempotent(o,src,dst,current_date,2,'DEV rollback','Positive command test',k);
   raise exception 'changed replay accepted'; exception when invalid_parameter_value then null;
  end;
  execute 'reset role';
  select coalesce(sum(signed_amount),0) into after_src from public.v_financial_account_movements
   where organization_id=o and financial_account_id=src and movement_date<=current_date;
  select coalesce(sum(signed_amount),0) into total_after from public.v_financial_account_movements where organization_id=o;
  if after_src<>before_src-1 or total_after<>total_before then raise exception 'cash balance invariant failed'; end if;
  if (select count(*) from public.v_dre_entries where organization_id=o)<>facts_before then raise exception 'transfer changed DRE facts'; end if;
  execute 'set local role authenticated';
  -- Both statement sides must be independently matchable for one transfer.
  foreach bank_account in array array[src,dst] loop
   bank_amount:=case when bank_account=src then '-1.00' else '1.00' end;
   k:=gen_random_uuid()::text;
   bank_import:=public.stage_tenant_bank_statement(o,bank_account,'DEV rollback transfer.csv',md5(k)||md5(k),
    jsonb_build_array(jsonb_build_object('date',current_date,'description','DEV transfer bank leg','amount',bank_amount,'external_id',k)),
    'Bank transfer leg test',k);
   perform public.validate_tenant_bank_statement(o,bank_import,'Reviewed transfer leg',gen_random_uuid()::text);
   select id into strict bank_line from public.bank_statement_lines where statement_import_id=bank_import and organization_id=o;
   bank_match:=public.match_tenant_bank_statement(o,bank_line,'account_transfer',t,1,'Transfer bank match test',gen_random_uuid()::text);
   if not exists(select 1 from public.bank_statement_imports where id=bank_import and status='reconciled') then raise exception 'transfer leg not reconciled';end if;
  end loop;
  k:=gen_random_uuid()::text;
  replay:=public.reverse_tenant_account_transfer_idempotent(o,t,current_date,'Positive reversal test',k);
  if replay<>t or public.reverse_tenant_account_transfer_idempotent(o,t,current_date,'Positive reversal test',k)<>t then raise exception 'reversal replay differs'; end if;
  begin
   perform public.reverse_tenant_account_transfer_idempotent(o,t,current_date,'Duplicate reversal test',gen_random_uuid()::text);
   raise exception 'second reversal accepted'; exception when check_violation then null;
  end;
  execute 'reset role';
  select coalesce(sum(signed_amount),0) into after_src from public.v_financial_account_movements
   where organization_id=o and financial_account_id=src and movement_date<=current_date;
  if after_src<>before_src then raise exception 'reversal failed to restore source'; end if;
 end loop;
end $$;
rollback;
select 'DEV_TRANSFER_POSITIVE_ROLLBACK_PASS' result;
