begin;
do $$
declare v_master uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 v_tenant uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 v_org uuid;v_ticket uuid;v_internal uuid;v_message uuid;v_key text;v_count bigint;
begin
 select organization_id,id into v_org,v_ticket from public.saas_support_tickets
 where ticket_scope='tenant' and organization_id is not null order by id limit 1;
 select id into v_internal from public.saas_support_tickets
 where ticket_scope='internal' limit 1;
 if v_ticket is null or v_internal is null then raise exception 'Missing test tickets';end if;
 select count(*) into v_count from public.saas_support_ticket_messages where ticket_id=v_ticket;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 v_key:=gen_random_uuid()::text;
 v_message:=public.reply_master_tenant_support_idempotent(v_org,v_ticket,'DEV master test reply','triage',v_key);
 if v_message<>public.reply_master_tenant_support_idempotent(v_org,v_ticket,'DEV master test reply','triage',v_key)
 then raise exception 'Master support replay mismatch';end if;
 if (select count(*) from public.saas_support_ticket_messages where ticket_id=v_ticket)<>v_count+1
 then raise exception 'Reply created duplicate messages';end if;
 if not exists(select 1 from public.saas_support_ticket_messages
   where id=v_message and visibility='customer' and sender_kind='platform_staff')
 then raise exception 'Reply not attributed to platform';end if;
 begin
  perform public.reply_master_tenant_support_idempotent(v_org,v_internal,'DEV invalid internal reply',null,gen_random_uuid()::text);
  raise exception 'Internal ticket replied through tenant RPC';
 exception when foreign_key_violation then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_master,'role','authenticated','aal','aal1')::text,true);
 begin
  perform public.reply_master_tenant_support_idempotent(v_org,v_ticket,'DEV AAL1 should deny',null,gen_random_uuid()::text);
  raise exception 'Master AAL1 was accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_tenant,'role','authenticated','aal','aal2')::text,true);
 begin
  perform public.reply_master_tenant_support_idempotent(v_org,v_ticket,'DEV tenant should deny',null,gen_random_uuid()::text);
  raise exception 'Tenant gained Master reply permission';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if has_function_privilege('anon','public.reply_master_tenant_support_idempotent(uuid,uuid,text,text,text)','execute')
 then raise exception 'Anonymous Master reply privilege';end if;
end $$;
rollback;
select 'DEV_MASTER_SUPPORT_REPLY_ROLLBACK_PASS' as result;