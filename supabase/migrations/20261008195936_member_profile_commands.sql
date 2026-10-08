-- Additive DEV member profile command. No direct member write grants.
-- Financial terms, Auth identities, CPF and role links are deliberately separate.
create or replace function private.normalize_member_profile(p_profile jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = ''
as $$
declare
 v_result jsonb := '{}'::jsonb;
 v_key text; v_value text; v_date date; v_limit integer;
begin
 if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
  raise exception 'profile must be an object' using errcode='22023';
 end if;
 for v_key in select jsonb_object_keys(p_profile) loop
  if v_key not in ('full_name','preferred_name','degree_or_office','phone','whatsapp','email','initiation_date','admission_date','notes','status') then
   raise exception 'unsupported profile field' using errcode='22023';
  end if;
  if jsonb_typeof(p_profile->v_key) not in ('string','null') then
   raise exception 'profile fields must be strings or null' using errcode='22023';
  end if;
 end loop;
 foreach v_key in array array['full_name','preferred_name','degree_or_office','phone','whatsapp','email','initiation_date','admission_date','notes','status'] loop
  v_value := nullif(btrim(p_profile->>v_key),'');
  v_limit := case v_key when 'full_name' then 180 when 'preferred_name' then 120 when 'degree_or_office' then 120 when 'email' then 254 when 'notes' then 4000 when 'phone' then 40 when 'whatsapp' then 40 when 'status' then 20 else 10 end;
  if length(v_value)>v_limit then raise exception 'profile field too long' using errcode='22023'; end if;
  if v_key='full_name' and v_value is null then raise exception 'full name required' using errcode='22023'; end if;
  if v_key='status' then
   v_value := coalesce(v_value,'active');
   if v_value not in ('active','away','inactive','disconnected') then raise exception 'invalid member situation' using errcode='22023'; end if;
  end if;
  if v_key='email' and v_value is not null and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'invalid email' using errcode='22023'; end if;
  if v_key in ('initiation_date','admission_date') and v_value is not null then
   if v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid date format' using errcode='22023'; end if;
   begin v_date := v_value::date;
   exception when datetime_field_overflow or invalid_datetime_format then raise exception 'invalid profile date' using errcode='22023'; end;
   if to_char(v_date,'YYYY-MM-DD')<>v_value then raise exception 'invalid profile date' using errcode='22023'; end if;
  end if;
  v_result := v_result || jsonb_build_object(v_key,v_value);
 end loop;
 return v_result;
end $$;
revoke all on function private.normalize_member_profile(jsonb) from public,anon,authenticated;

-- Profile concurrency must advance even for multiple edits in one transaction.
create or replace function private.set_member_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 new.updated_at := greatest(clock_timestamp(),old.updated_at + interval '1 microsecond');
 return new;
end $$;
revoke all on function private.set_member_updated_at() from public,anon,authenticated;
create or replace trigger members_set_updated_at before update on public.members
for each row execute function private.set_member_updated_at();

create or replace function public.save_member_profile(
 p_organization_id uuid,
 p_member_id uuid,
 p_expected_updated_at timestamptz,
 p_profile jsonb,
 p_reason text,
 p_idempotency_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_profile jsonb; v_before public.members%rowtype; v_after public.members%rowtype;
 v_result uuid; v_changed jsonb;
begin
 perform private.require_permission(p_organization_id,'members.write');
 if p_organization_id is null or (p_member_id is null) <> (p_expected_updated_at is null) then
  raise exception 'create requires no member/version; edit requires both' using errcode='22023';
 end if;
 if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'idempotency key required' using errcode='22023'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception 'reason required' using errcode='22023'; end if;
 v_profile := private.normalize_member_profile(p_profile);
 v_result := private.idempotency_begin(p_organization_id,'save_member_profile',p_idempotency_key,
  jsonb_build_object('member_id',p_member_id,'expected_updated_at',p_expected_updated_at,'profile',v_profile,'reason',btrim(p_reason)));
 if v_result is not null then return v_result; end if;
 if p_member_id is null then
  insert into public.members(organization_id,full_name,preferred_name,degree_or_office,phone,whatsapp,email,initiation_date,admission_date,notes,status)
  values(p_organization_id,v_profile->>'full_name',v_profile->>'preferred_name',v_profile->>'degree_or_office',v_profile->>'phone',v_profile->>'whatsapp',v_profile->>'email',(v_profile->>'initiation_date')::date,(v_profile->>'admission_date')::date,v_profile->>'notes',v_profile->>'status')
  returning * into v_after;
 else
  select * into v_before from public.members where organization_id=p_organization_id and id=p_member_id for update;
  if not found then raise exception 'member not in organization' using errcode='23503'; end if;
  if v_before.updated_at<>p_expected_updated_at then raise exception 'member changed; reload before editing' using errcode='40001'; end if;
  update public.members set
   full_name=v_profile->>'full_name',preferred_name=v_profile->>'preferred_name',degree_or_office=v_profile->>'degree_or_office',
   phone=v_profile->>'phone',whatsapp=v_profile->>'whatsapp',email=v_profile->>'email',
   initiation_date=(v_profile->>'initiation_date')::date,admission_date=(v_profile->>'admission_date')::date,
   notes=v_profile->>'notes',status=v_profile->>'status'
  where organization_id=p_organization_id and id=p_member_id returning * into v_after;
 end if;
 select coalesce(jsonb_agg(k),'[]'::jsonb) into v_changed
 from jsonb_object_keys(v_profile) as keys(k)
 where p_member_id is null or to_jsonb(v_before)->k is distinct from v_profile->k;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason,technical_context)
 values(p_organization_id,auth.uid(),case when p_member_id is null then 'member.create' else 'member.update' end,'member',v_after.id,
  case when p_member_id is null then null else jsonb_build_object('status',v_before.status) end,
  jsonb_build_object('status',v_after.status),btrim(p_reason),jsonb_build_object('changed_fields',v_changed));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_after.id);
 return v_after.id;
end $$;
revoke all on function public.save_member_profile(uuid,uuid,timestamptz,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_member_profile(uuid,uuid,timestamptz,jsonb,text,text) to authenticated;
