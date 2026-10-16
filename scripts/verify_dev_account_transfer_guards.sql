begin;
do $$
declare v_org uuid:='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b';
 v_actor uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 v_other_account uuid:='cf48c695-c424-4fd2-abbf-46ec5192a6c2';
 v_foreign_account uuid:='a7618966-ad8e-466b-b11d-2ca52ce6372d';
 v_t uuid:='00000000-0000-4000-8000-000000000001';
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 begin
 perform public.register_tenant_account_transfer_idempotent(v_org,v_other_account,v_other_account,
 current_date,10,'test','same account denied',gen_random_uuid()::text);
 raise exception 'same source and destination allowed';exception when invalid_parameter_value then null;end;
 begin
 perform public.register_tenant_account_transfer_idempotent(v_org,v_other_account,v_foreign_account,
 current_date,10,'test','foreign account denied',gen_random_uuid()::text);
 raise exception 'foreign account allowed';exception when foreign_key_violation then null;end;
 begin
 perform public.reverse_tenant_account_transfer_idempotent(v_org,v_t,current_date,
 'unknown transfer denied',gen_random_uuid()::text);
 raise exception 'nonexistent reversal accepted';exception when foreign_key_violation then null;end;
 execute 'reset role';
 if has_function_privilege('anon','public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text)','execute')
 or has_function_privilege('anon','public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text)','execute')
 then raise exception 'anonymous privilege present';end if;
end $$;
rollback;
select 'DEV_TRANSFER_GUARDS_ROLLBACK_PASS' as result;