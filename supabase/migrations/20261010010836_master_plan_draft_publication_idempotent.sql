-- DEV V35: transactional Master-scoped idempotency (not tied to a customer tenant).
create table if not exists private.master_idempotency_keys (
 staff_user_id uuid not null references auth.users(id),
 idempotency_key text not null check(length(btrim(idempotency_key)) between 1 and 200),
 operation text not null,
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 result_reference uuid,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 primary key(staff_user_id,idempotency_key),
 check ((result_reference is null and completed_at is null) or
        (result_reference is not null and completed_at is not null))
);
revoke all on table private.master_idempotency_keys from public,anon,authenticated;

create or replace function public.create_master_plan_draft_idempotent(
 p_code text,p_name text,p_price numeric,p_billing_interval text,
 p_trial_days integer,p_grace_days integer,p_valid_from date,
 p_entitlements jsonb,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_key text;v_hash text;v_current private.master_idempotency_keys%rowtype;
begin
 perform private.require_platform_staff('MASTER');
 if p_code is null or btrim(lower(p_code)) !~ '^[a-z0-9][a-z0-9_-]{1,40}$'
  or p_name is null or length(btrim(p_name)) not between 2 and 120
  or p_price is null or p_price::text in ('NaN','Infinity','-Infinity') or p_price<0
  or p_price>999999999999.99 or p_price<>round(p_price,2)
  or p_billing_interval not in ('monthly','yearly','custom')
  or p_trial_days is null or p_trial_days not between 0 and 365
  or p_grace_days is null or p_grace_days not between 0 and 365
  or p_valid_from is null or extract(day from p_valid_from)<>1
  or p_entitlements is null or jsonb_typeof(p_entitlements)<>'object'
  or pg_column_size(p_entitlements)>16000
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid Master plan draft request' using errcode='22023';end if;
 v_key:=btrim(p_idempotency_key);
 v_hash:=encode(extensions.digest(jsonb_build_object(
  'code',lower(btrim(p_code)),'name',btrim(p_name),'price',p_price,'billing_interval',p_billing_interval,
  'trial_days',p_trial_days,'grace_days',p_grace_days,'valid_from',p_valid_from,
  'entitlements',p_entitlements)::text,'sha256'),'hex');
 insert into private.master_idempotency_keys(staff_user_id,idempotency_key,operation,payload_hash)
 values(auth.uid(),v_key,'create_master_plan_draft_idempotent',v_hash)
 on conflict(staff_user_id,idempotency_key)do nothing;
 select * into v_current from private.master_idempotency_keys
 where staff_user_id=auth.uid() and idempotency_key=v_key for update;
 if v_current.payload_hash is distinct from v_hash
  or v_current.operation<>'create_master_plan_draft_idempotent'
 then raise exception 'Master idempotency key reused with different payload'
  using errcode='22023';end if;
 if v_current.result_reference is not null then return v_current.result_reference;end if;
 if v_current.created_at<now()-interval '5 minutes' then
  raise exception 'Master idempotency record pending review' using errcode='55000';end if;
 v_id:=public.create_saas_plan_draft(lower(btrim(p_code)),btrim(p_name),p_price,
   p_billing_interval,p_trial_days,p_grace_days,p_valid_from,p_entitlements);
 insert into public.saas_master_audit_logs(staff_user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'saas_plan_version.draft_created','saas_plan_version',v_id::text,
   jsonb_build_object('code',lower(btrim(p_code)),'valid_from',p_valid_from,'billing_interval',p_billing_interval));
 update private.master_idempotency_keys set result_reference=v_id,completed_at=now()
 where staff_user_id=auth.uid() and idempotency_key=v_key;
 return v_id;
end $$;
revoke all on function public.create_master_plan_draft_idempotent(
 text,text,numeric,text,integer,integer,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_master_plan_draft_idempotent(
 text,text,numeric,text,integer,integer,date,jsonb,text) to authenticated;

create or replace function public.publish_master_plan_draft_idempotent(
 p_plan_version_id uuid,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_key text;v_hash text;v_current private.master_idempotency_keys%rowtype;
begin
 perform private.require_platform_staff('MASTER');
 if p_plan_version_id is null or p_idempotency_key is null
  or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid Master publication request' using errcode='22023';end if;
 v_key:=btrim(p_idempotency_key);
 v_hash:=encode(extensions.digest(
  jsonb_build_object('plan_version_id',p_plan_version_id)::text,'sha256'),'hex');
 insert into private.master_idempotency_keys(staff_user_id,idempotency_key,operation,payload_hash)
 values(auth.uid(),v_key,'publish_master_plan_draft_idempotent',v_hash)
 on conflict(staff_user_id,idempotency_key)do nothing;
 select * into v_current from private.master_idempotency_keys
 where staff_user_id=auth.uid() and idempotency_key=v_key for update;
 if v_current.payload_hash is distinct from v_hash
  or v_current.operation<>'publish_master_plan_draft_idempotent'
 then raise exception 'Master publication key reused with different request'
  using errcode='22023';end if;
 if v_current.result_reference is not null then return v_current.result_reference;end if;
 if v_current.created_at<now()-interval '5 minutes' then
  raise exception 'Master publication requires manual review' using errcode='55000';end if;
 v_id:=public.publish_saas_plan_version(p_plan_version_id);
 update private.master_idempotency_keys set result_reference=v_id,completed_at=now()
 where staff_user_id=auth.uid() and idempotency_key=v_key;
 return v_id;
end $$;
revoke all on function public.publish_master_plan_draft_idempotent(uuid,text) from public,anon,authenticated;
grant execute on function public.publish_master_plan_draft_idempotent(uuid,text) to authenticated;
