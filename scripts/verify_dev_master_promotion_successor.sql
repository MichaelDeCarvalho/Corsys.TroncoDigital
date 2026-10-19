begin;
do $$
declare staff uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';v_source uuid;v_next uuid;v_key text;v_series uuid;
 prior_count bigint:=(select count(*) from public.saas_promotions);
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 v_source:=public.create_master_promotion_draft_idempotent('DEV Version Source','DEV'||
 substr(replace(gen_random_uuid()::text,'-',''),1,8),'percent',12,'once',null,
 '2027-01-01T12:00:00Z',null,'new_customers',100,false,gen_random_uuid()::text);
 perform public.publish_master_promotion_draft_idempotent(v_source,gen_random_uuid()::text);
 v_key:=gen_random_uuid()::text;
 v_next:=public.create_master_promotion_successor_idempotent(v_source,
 'DEV Version Successor','DEV'||
 substr(replace(gen_random_uuid()::text,'-',''),1,8),'percent',15,'once',null,
 '2027-02-01T12:00:00Z',null,'new_customers',100,false,v_key);
 if not exists(select 1 from public.saas_promotions n join public.saas_promotions prev
 on n.promotion_series_id=prev.promotion_series_id where n.id=v_next and
 prev.id=v_source and n.version_number=prev.version_number+1 and n.status='draft')
 then raise exception 'Promotion successor missing/wrong series';end if;
 begin perform public.create_master_promotion_successor_idempotent(v_source,
  'DEV different payload','DIFFERENT','percent',15,'once',null,
  '2027-02-01T12:00:00Z',null,'new_customers',100,false,v_key);
  raise exception 'changed successor payload accepted';
 exception when invalid_parameter_value then null;end;
 perform public.publish_master_promotion_draft_idempotent(v_next,gen_random_uuid()::text);
 if (select valid_to from public.saas_promotions where id=v_source)<>'2027-02-01T12:00:00Z'::timestamptz
 then raise exception 'Older promotion validity not closed';end if;
 begin perform public.create_master_promotion_successor_idempotent(v_source,
  'DEV stale successor','STALE','percent',20,'once',null,
  '2027-03-01T12:00:00Z',null,'new_customers',100,false,gen_random_uuid()::text);
  raise exception 'Stale promotion version accepted';
 exception when sqlstate 'PT409' then null;end;
 execute 'reset role';
 if (select count(*) from public.saas_promotions)<>prior_count+2 then raise exception 'Unexpected promotion count';end if;
end $$;
rollback;
select 'DEV_MASTER_PROMOTION_SUCCESSOR_ROLLBACK_PASS' as result;