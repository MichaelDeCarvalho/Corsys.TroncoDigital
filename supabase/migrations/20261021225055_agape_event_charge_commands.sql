-- Agape events reuse events, event_participants and immutable member charges.
create function public.preview_agape_event(
 p_organization_id uuid,p_category_id uuid,p_name text,p_event_date date,
 p_due_date date,p_default_amount numeric,p_member_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_members jsonb;v_count integer;v_mapping record;v_snapshot jsonb;v_existing uuid;v_period date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 if p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_event_date is null or not isfinite(p_event_date)
  or p_event_date<(date_trunc('month',current_date)-interval '12 months')::date
  or p_event_date>=(date_trunc('month',current_date)+interval '13 months')::date
  or p_due_date is null or not isfinite(p_due_date) or p_due_date<p_event_date or p_due_date>(p_event_date+interval '12 months')::date
  or p_default_amount is null or p_default_amount::text in('NaN','Infinity','-Infinity')
  or p_default_amount<0 or p_default_amount>999999999999.99 or p_default_amount<>round(p_default_amount,2)
  or p_member_ids is null or cardinality(p_member_ids) not between 1 and 200 or array_position(p_member_ids,null) is not null
  or (select count(distinct x) from unnest(p_member_ids)x)<>cardinality(p_member_ids)
  or p_default_amount*cardinality(p_member_ids)>999999999999.99
 then raise exception 'invalid agape event request' using errcode='22023';end if;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and domain='member_receivable' and active;
 if not found then raise exception 'event category not eligible in tenant' using errcode='23503';end if;
 select count(*),jsonb_agg(jsonb_build_object('member_id',id,'name',full_name,'amount',p_default_amount) order by id)
 into v_count,v_members from public.members where organization_id=p_organization_id and id=any(p_member_ids) and status='active';
 if v_count<>cardinality(p_member_ids) then raise exception 'event member absent or inactive in tenant' using errcode='23503';end if;
 v_period:=date_trunc('month',p_event_date)::date;
 if private.is_period_closed(p_organization_id,v_period) then raise exception 'event accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,p_category_id,p_event_date);
 if not found then raise exception 'event category requires published accounting mapping' using errcode='23514';end if;
 select id into v_existing from public.events where organization_id=p_organization_id and event_type='agape'
  and event_date=p_event_date and lower(btrim(name))=lower(btrim(p_name)) order by id limit 1;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'category_id',p_category_id,'name',btrim(p_name),
  'event_date',p_event_date,'due_date',p_due_date,'competence',v_period,'default_amount',p_default_amount,
  'participants',v_members,'participant_count',v_count,'charge_count',case when p_default_amount>0 then v_count else 0 end,
  'total_amount',p_default_amount*v_count,'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id,
  'existing_id',v_existing,'ready',v_existing is null);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_agape_event(uuid,uuid,text,date,date,numeric,uuid[]) from public,anon,authenticated;
grant execute on function public.preview_agape_event(uuid,uuid,text,date,date,numeric,uuid[]) to authenticated;

create function public.create_agape_event(
 p_organization_id uuid,p_category_id uuid,p_name text,p_event_date date,
 p_due_date date,p_default_amount numeric,p_member_ids uuid[],
 p_expected_fingerprint text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preview jsonb;v_member jsonb;v_charge uuid;v_period date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 if p_expected_fingerprint is null or p_expected_fingerprint!~'^[a-f0-9]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
  or p_event_date is null or not isfinite(p_event_date)
  or p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_member_ids is null or cardinality(p_member_ids) not between 1 and 200
  or array_position(p_member_ids,null) is not null
  or (select count(distinct x) from unnest(p_member_ids)x)<>cardinality(p_member_ids)
  or p_default_amount is null or p_default_amount::text in('NaN','Infinity','-Infinity')
  or p_default_amount<0 or p_default_amount>999999999999.99 or p_default_amount<>round(p_default_amount,2)
  or p_due_date is null or not isfinite(p_due_date)
 then raise exception 'invalid event confirmation' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_agape_event',btrim(p_idempotency_key),
  jsonb_build_object('category',p_category_id,'name',p_name,'date',p_event_date,'due',p_due_date,
   'amount',p_default_amount,'members',p_member_ids,'fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 v_period:=date_trunc('month',p_event_date)::date;
 insert into public.financial_periods(organization_id,period) values(p_organization_id,v_period) on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=v_period for update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id for share;
 perform id from public.members where organization_id=p_organization_id and id=any(p_member_ids) order by id for share;
 v_preview:=public.preview_agape_event(p_organization_id,p_category_id,p_name,p_event_date,p_due_date,p_default_amount,p_member_ids);
 if v_preview->>'fingerprint'<>p_expected_fingerprint then raise exception 'event preview changed' using errcode='PT409';end if;
 if not coalesce((v_preview->>'ready')::boolean,false) then raise exception 'agape event already registered' using errcode='PT409';end if;
 insert into public.events(organization_id,name,event_type,event_date,default_amount,description,created_by)
 values(p_organization_id,btrim(p_name),'agape',p_event_date,p_default_amount,btrim(p_reason),auth.uid()) returning id into v_id;
 for v_member in select value from jsonb_array_elements(v_preview->'participants') loop
  v_charge:=null;
  if p_default_amount>0 then
   insert into public.charges(organization_id,member_id,category_id,source_kind,generation_key,description,reference,
    competence,issue_date,due_date,accounting_period,unit_amount,original_amount,created_by)
   values(p_organization_id,(v_member->>'member_id')::uuid,p_category_id,'event',
    'agape:'||v_id::text||':'||(v_member->>'member_id'),btrim(p_name),v_id::text,v_period,p_event_date,p_due_date,v_period,p_default_amount,p_default_amount,auth.uid()) returning id into v_charge;
  end if;
  insert into public.event_participants(organization_id,event_id,member_id,charged_amount,charge_id)
  values(p_organization_id,v_id,(v_member->>'member_id')::uuid,p_default_amount,v_charge);
 end loop;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'agape.create','event',v_id,v_preview,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_agape_event(uuid,uuid,text,date,date,numeric,uuid[],text,text,text) from public,anon,authenticated;
grant execute on function public.create_agape_event(uuid,uuid,text,date,date,numeric,uuid[],text,text,text) to authenticated;
