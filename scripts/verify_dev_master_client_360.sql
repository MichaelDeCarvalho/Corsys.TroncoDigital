begin;
do $$
declare staff uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';member_user uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';v_org uuid;v jsonb;v_expected numeric;
begin
 select id into v_org from public.organizations order by id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 v:=public.read_master_client_360(v_org);
 if v->>'organization_id'<>v_org::text or v->>'integrity_ok'<>'true' then raise exception 'Client 360 tenant mismatch';end if;
 select coalesce(sum(amount_open),0) into v_expected from public.v_saas_invoice_balances where organization_id=v_org;
 if v_expected<>(v->>'invoices_open_amount')::numeric then raise exception 'Client 360 receivables mismatch';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal1')::text,true);
 begin perform public.read_master_client_360(v_org);
  raise exception 'AAL1 unexpectedly viewed Client360';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_user,'role','authenticated','aal','aal2')::text,true);
 begin perform public.read_master_client_360(v_org);
  raise exception 'Tenant user unexpectedly viewed Client360';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if has_function_privilege('anon','public.read_master_client_360(uuid)','execute') then raise exception 'Anonymous Client360 granted';end if;
end $$;
rollback;
select 'DEV_MASTER_CLIENT_360_ROLLBACK_PASS' as result;