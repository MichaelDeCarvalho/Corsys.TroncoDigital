-- Explicit number-to-member assignments. No automatic member choice or financial repasse.
create function private.validate_mutual_batch_input(
 p_category_id uuid,p_number_start integer,p_number_end integer,p_unit_amount numeric,
 p_competence date,p_issue_date date,p_due_date date,p_assignments jsonb
) returns void language plpgsql stable set search_path='' as $$
begin
 if p_category_id is null or p_number_start is null or p_number_end is null
  or p_number_start<1 or p_number_end<p_number_start or p_number_end::bigint-p_number_start::bigint+1>200
  or p_unit_amount is null or p_unit_amount::text in('NaN','Infinity','-Infinity')
  or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_unit_amount*(p_number_end::bigint-p_number_start::bigint+1)>999999999999.99
  or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_competence<(date_trunc('month',current_date)-interval '12 months')::date
  or p_competence>=(date_trunc('month',current_date)+interval '13 months')::date
  or p_issue_date is null or not isfinite(p_issue_date) or date_trunc('month',p_issue_date)::date<>p_competence
  or p_due_date is null or not isfinite(p_due_date) or p_due_date<p_issue_date or p_due_date>(p_issue_date+interval '12 months')::date
  or p_assignments is null or jsonb_typeof(p_assignments)<>'array'
 then raise exception 'invalid mutual batch parameters' using errcode='22023';end if;
 if jsonb_array_length(p_assignments)<>p_number_end::bigint-p_number_start::bigint+1
  or exists(select 1 from jsonb_array_elements(p_assignments)x where jsonb_typeof(x)<>'object'
   or not coalesce(x->>'mutual_number'~'^[1-9][0-9]{0,9}$',false)
   or not coalesce(x->>'member_id'~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false))
 then raise exception 'every mutual number requires an explicit member' using errcode='22023';end if;
 if (select count(distinct x->>'mutual_number') from jsonb_array_elements(p_assignments)x)<>jsonb_array_length(p_assignments)
  or exists(select 1 from jsonb_array_elements(p_assignments)x where (x->>'mutual_number')::numeric<p_number_start or (x->>'mutual_number')::numeric>p_number_end)
 then raise exception 'mutual numbers must uniquely cover requested range' using errcode='22023';end if;
end $$;
revoke all on function private.validate_mutual_batch_input(uuid,integer,integer,numeric,date,date,date,jsonb) from public,anon,authenticated;

create function public.preview_mutual_batch(
 p_organization_id uuid,p_category_id uuid,p_number_start integer,p_number_end integer,p_unit_amount numeric,
 p_competence date,p_issue_date date,p_due_date date,p_assignments jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_count integer;v_mapping record;v_existing uuid;v_snapshot jsonb;v_nature text;v_code text;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 perform private.validate_mutual_batch_input(p_category_id,p_number_start,p_number_end,p_unit_amount,p_competence,p_issue_date,p_due_date,p_assignments);
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active and domain='member_receivable';
 if not found then raise exception 'mutual category not eligible in tenant' using errcode='23503';end if;
 select count(*),jsonb_agg(jsonb_build_object('mutual_number',a.mutual_number,'member_id',m.id,'name',m.full_name,'amount',p_unit_amount) order by a.mutual_number)
 into v_count,v_rows from jsonb_to_recordset(p_assignments)a(mutual_number integer,member_id uuid)
 join public.members m on m.organization_id=p_organization_id and m.id=a.member_id and m.status='active';
 if v_count<>jsonb_array_length(p_assignments) then raise exception 'mutual assignee absent or inactive in tenant' using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,p_competence) then raise exception 'mutual accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,p_category_id,p_competence);
 if not found then raise exception 'mutual category requires published classification' using errcode='23514';end if;
 select nature,code into strict v_nature,v_code from public.accounting_accounts where organization_id=p_organization_id
  and accounting_plan_id=v_mapping.accounting_plan_id and id=v_mapping.accounting_account_id;
 select id into v_existing from public.mutual_batches where organization_id=p_organization_id and competence=p_competence
  and number_start<=p_number_end and number_end>=p_number_start order by id limit 1;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'category_id',p_category_id,'number_start',p_number_start,'number_end',p_number_end,
  'unit_amount',p_unit_amount,'competence',p_competence,'issue_date',p_issue_date,'due_date',p_due_date,'assignments',v_rows,'charge_count',v_count,
  'total_amount',p_unit_amount*v_count,'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id,
  'account_nature',v_nature,'account_code',v_code,'existing_batch_id',v_existing,'ready',v_existing is null);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.preview_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb) to authenticated;

create function public.create_mutual_batch(
 p_organization_id uuid,p_category_id uuid,p_number_start integer,p_number_end integer,p_unit_amount numeric,
 p_competence date,p_issue_date date,p_due_date date,p_assignments jsonb,
 p_expected_fingerprint text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_preview jsonb;v_row jsonb;v_charge uuid;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 if p_assignments is null or jsonb_typeof(p_assignments)<>'array' then raise exception 'invalid mutual assignments' using errcode='22023';end if;
 if jsonb_array_length(p_assignments) not between 1 and 200
  or p_expected_fingerprint is null or p_expected_fingerprint!~'^[a-f0-9]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid mutual confirmation' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_mutual_batch',btrim(p_idempotency_key),
  jsonb_build_object('category',p_category_id,'start',p_number_start,'end',p_number_end,'unit',p_unit_amount,
   'competence',p_competence,'issue',p_issue_date,'due',p_due_date,'assignments',p_assignments,'fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform private.validate_mutual_batch_input(p_category_id,p_number_start,p_number_end,p_unit_amount,p_competence,p_issue_date,p_due_date,p_assignments);
 perform id from public.organizations where id=p_organization_id for no key update;
 insert into public.financial_periods(organization_id,period) values(p_organization_id,p_competence) on conflict(organization_id,period) do nothing;
 perform id from public.financial_periods where organization_id=p_organization_id and period=p_competence for update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id for share;
 perform m.id from public.members m where m.organization_id=p_organization_id and m.id in
  (select a.member_id from jsonb_to_recordset(p_assignments)a(mutual_number integer,member_id uuid)) order by m.id for share;
 v_preview:=public.preview_mutual_batch(p_organization_id,p_category_id,p_number_start,p_number_end,p_unit_amount,p_competence,p_issue_date,p_due_date,p_assignments);
 if v_preview->>'fingerprint'<>p_expected_fingerprint then raise exception 'mutual preview changed' using errcode='PT409';end if;
 if not coalesce((v_preview->>'ready')::boolean,false) then raise exception 'mutual range already issued in competence' using errcode='PT409';end if;
 insert into public.mutual_batches(organization_id,number_start,number_end,unit_amount,competence,notes,created_by)
 values(p_organization_id,p_number_start,p_number_end,p_unit_amount,p_competence,btrim(p_reason),auth.uid()) returning id into v_id;
 for v_row in select value from jsonb_array_elements(v_preview->'assignments') loop
  insert into public.charges(organization_id,member_id,category_id,source_kind,generation_key,description,reference,
   competence,issue_date,due_date,accounting_period,unit_amount,original_amount,created_by)
  values(p_organization_id,(v_row->>'member_id')::uuid,p_category_id,'mutual',
   'mutual:'||v_id::text||':'||(v_row->>'mutual_number'),'Mútua '||(v_row->>'mutual_number'),v_id::text,
   p_competence,p_issue_date,p_due_date,p_competence,p_unit_amount,p_unit_amount,auth.uid()) returning id into v_charge;
  insert into public.mutual_assignments(organization_id,mutual_batch_id,mutual_number,member_id,charge_id)
  values(p_organization_id,v_id,(v_row->>'mutual_number')::integer,(v_row->>'member_id')::uuid,v_charge);
 end loop;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'mutual_batch.create','mutual_batch',v_id,v_preview,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.create_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb,text,text,text) to authenticated;
