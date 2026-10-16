-- DEV V35: safe creation of a successor version of an existing published promotion.
create or replace function public.create_master_promotion_successor_idempotent(
 p_current_promotion_id uuid,p_name text,p_public_code text,p_benefit_type text,
 p_benefit_value numeric,p_duration_type text,p_duration_cycles integer,
 p_valid_from timestamptz,p_valid_to timestamptz,p_eligibility_scope text,
 p_max_redemptions integer,p_stackable boolean,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_series uuid;v_latest public.saas_promotions%rowtype;v_id uuid;
 v_key text;v_hash text;v_existing private.master_idempotency_keys%rowtype;
begin
 perform private.require_platform_staff('MASTER');
 if p_current_promotion_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
 or p_public_code is null or upper(btrim(p_public_code)) !~ '^[A-Z0-9_-]{3,40}$'
 or p_benefit_type not in ('percent','fixed_amount','trial_price')
 or p_benefit_value is null or p_benefit_value::text in ('NaN','Infinity','-Infinity')
 or p_benefit_value<=0 or p_benefit_value>999999999999.99 or p_benefit_value<>round(p_benefit_value,2)
 or (p_benefit_type='percent' and p_benefit_value>100)
 or p_duration_type not in ('once','cycles','date_range')
 or (p_duration_type='cycles' and (p_duration_cycles is null or p_duration_cycles not between 1 and 36))
 or (p_duration_type<>'cycles' and p_duration_cycles is not null)
 or p_valid_from is null or p_valid_from<=now()
 or (p_valid_to is not null and p_valid_to<=p_valid_from)
 or p_eligibility_scope not in ('new_customers','selected_customers','all_eligible')
 or (p_max_redemptions is not null and p_max_redemptions not between 1 and 1000000)
 or p_stackable is null or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid Master successor promotion' using errcode='22023';end if;
 v_key:=btrim(p_idempotency_key);
 v_hash:=encode(extensions.digest(jsonb_build_object(
  'current_id',p_current_promotion_id,'name',btrim(p_name),'code',upper(btrim(p_public_code)),
  'benefit_type',p_benefit_type,'value',p_benefit_value,
  'duration_type',p_duration_type,'cycles',p_duration_cycles,
  'from',p_valid_from,'to',p_valid_to,'scope',p_eligibility_scope,
  'max',p_max_redemptions,'stackable',p_stackable)::text,'sha256'),'hex');
 insert into private.master_idempotency_keys(staff_user_id,idempotency_key,operation,payload_hash)
 values(auth.uid(),v_key,'create_master_promotion_successor_idempotent',v_hash)
 on conflict(staff_user_id,idempotency_key)do nothing;
 select * into v_existing from private.master_idempotency_keys
 where staff_user_id=auth.uid() and idempotency_key=v_key for update;
 if v_existing.operation<>'create_master_promotion_successor_idempotent' or
 v_existing.payload_hash is distinct from v_hash
 then raise exception 'Master successor idempotency payload conflict' using errcode='22023';end if;
 if v_existing.result_reference is not null then return v_existing.result_reference;end if;
 if v_existing.created_at<now()-interval '5 minutes' then
 raise exception 'Master successor operation needs review' using errcode='55000';end if;
 select promotion_series_id into v_series from public.saas_promotions
 where id=p_current_promotion_id and status='published';
 if v_series is null then raise exception 'published promotion not found' using errcode='23503';end if;
 perform pg_advisory_xact_lock(hashtextextended('promo-successor:'||v_series::text,0));
 select * into v_latest from public.saas_promotions
 where promotion_series_id=v_series order by version_number desc,id desc limit 1 for update;
 if v_latest.id<>p_current_promotion_id or v_latest.status<>'published'
  then raise exception 'promotion source is not latest published version' using errcode='40001';end if;
 if p_valid_from<=v_latest.valid_from or
   (v_latest.valid_to is not null and p_valid_from<v_latest.valid_to)
 then raise exception 'successor validity must follow current published period' using errcode='23514';end if;
 v_id:=public.create_saas_promotion_successor_draft(
  p_current_promotion_id,btrim(p_name),upper(btrim(p_public_code)),p_benefit_type,p_benefit_value,
  p_duration_type,p_duration_cycles,p_valid_from,p_valid_to,p_eligibility_scope,p_max_redemptions,p_stackable);
 insert into public.saas_master_audit_logs(staff_user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'saas_promotion.successor_draft','saas_promotion',v_id::text,
 jsonb_build_object('previous_id',p_current_promotion_id,'promotion_series_id',v_series,'valid_from',p_valid_from));
 update private.master_idempotency_keys set result_reference=v_id,completed_at=now()
 where staff_user_id=auth.uid() and idempotency_key=v_key;
 return v_id;
end $$;
revoke all on function public.create_master_promotion_successor_idempotent(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.create_master_promotion_successor_idempotent(uuid,text,text,text,numeric,text,integer,timestamptz,timestamptz,text,integer,boolean,text) to authenticated;
