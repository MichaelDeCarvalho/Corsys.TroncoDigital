begin;
do $$
declare master_user uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 tenant_user uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 id1 uuid;id2 uuid;id3 uuid;key_id text;pub_key text;
 n_before bigint:=(select count(*) from public.saas_promotions);
 audits_before bigint:=(select count(*) from public.saas_master_audit_logs);
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master_user,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 key_id:='DEV-PROMO-'||gen_random_uuid();
 id1:=public.create_master_promotion_draft_idempotent('DEV OFFER TEST','DEV'||
  substr(replace(gen_random_uuid()::text,'-',''),1,8),'percent',12,'once',null,
  '2027-01-01T12:00:00Z',null,'new_customers',100,false,key_id);
 if id1 is null then raise exception 'Promotion draft missing';end if;
 select id into id2 from public.saas_promotions where id=id1 and status='draft';
 if id2<>id1 then raise exception 'Draft not created';end if;
 -- Intentional changed payload must fail on reused key.
 begin
  perform public.create_master_promotion_draft_idempotent('CHANGED NAME',
    (select public_code from public.saas_promotions where id=id1),'percent',12,'once',null,
    '2027-01-01T12:00:00Z',null,'new_customers',100,false,key_id);
  raise exception 'Changed promo payload replay allowed';
 exception when invalid_parameter_value then null;end;
 pub_key:='DEV-PROMO-PUB-'||gen_random_uuid();
 id2:=public.publish_master_promotion_draft_idempotent(id1,pub_key);
 id3:=public.publish_master_promotion_draft_idempotent(id1,pub_key);
 if id2<>id1 or id3<>id1 or (select status from public.saas_promotions where id=id1)<>'published'
 then raise exception 'Master promotion publication failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master_user,'role','authenticated','aal','aal1')::text,true);
 begin
  perform public.publish_master_promotion_draft_idempotent(id1,'DEV-AAL1-'||gen_random_uuid());
  raise exception 'AAL1 can publish promotion';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',tenant_user,'role','authenticated','aal','aal2')::text,true);
 begin
  perform public.publish_master_promotion_draft_idempotent(id1,'DEV-TENANT-'||gen_random_uuid());
  raise exception 'Tenant can publish promotion';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 if (select count(*) from public.saas_promotions)<>n_before+1
 or (select count(*) from public.saas_master_audit_logs)<>audits_before+2
 then raise exception 'Master promotion audit or version count unexpected';end if;
 if has_function_privilege('anon','public.publish_master_promotion_draft_idempotent(uuid,text)','execute')
 then raise exception 'Anon promotion publish permission';end if;
end $$;
rollback;
select 'DEV_MASTER_PROMOTION_ROLLBACK_PASS' as result;