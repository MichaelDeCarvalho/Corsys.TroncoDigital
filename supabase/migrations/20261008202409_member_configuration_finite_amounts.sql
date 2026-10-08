-- Forward validation fix; preserve existing grants, RLS, rows and audit.
create or replace function public.schedule_member_configuration(
 p_organization_id uuid,p_member_id uuid,p_kind text,p_reference_id uuid,
 p_effective_from date,p_effective_to date,p_term_type text,p_override_amount numeric,
 p_reason text,p_idempotency_key text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_permission text;
begin
 -- Permission precedes all sensitive lookups. Financial parameters require ADMIN settings.
 v_permission:=case when p_kind='office' then 'members.write' else 'settings.manage' end;
 perform private.require_permission(p_organization_id,v_permission);
 if p_kind is null or p_kind not in ('office','term') or p_member_id is null or p_reference_id is null or p_effective_from is null
  or p_effective_to<p_effective_from or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid configuration input' using errcode='22023'; end if;
 if p_kind='office' then
  if p_effective_from<current_date or p_term_type is not null or p_override_amount is not null then raise exception 'office must start today or later without financial terms' using errcode='22023'; end if;
 else
  if p_effective_from<=date_trunc('month',current_date)::date or extract(day from p_effective_from)<>1
   or (p_effective_to is not null and extract(day from p_effective_to)<>1)
   or p_term_type is null or p_term_type not in ('standard','exempt','override_amount') then raise exception 'future first-of-month terms required' using errcode='22023'; end if;
  if (p_term_type='override_amount' and (p_override_amount is null or p_override_amount::text in ('NaN','Infinity','-Infinity') or p_override_amount<0 or p_override_amount>999999999999.99 or p_override_amount<>round(p_override_amount,2)))
   or (p_term_type<>'override_amount' and p_override_amount is not null) then raise exception 'invalid individual amount' using errcode='22023'; end if;
 end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_member_configuration',p_idempotency_key,
  jsonb_build_object('member',p_member_id,'kind',p_kind,'reference',p_reference_id,'from',p_effective_from,'to',p_effective_to,'term',p_term_type,'amount',p_override_amount,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 if not exists(select 1 from public.members where organization_id=p_organization_id and id=p_member_id) then raise exception 'member outside organization' using errcode='23503'; end if;
 if p_kind='office' then
  if not exists(select 1 from public.office_types where organization_id=p_organization_id and id=p_reference_id and active) then raise exception 'active office outside organization' using errcode='23503'; end if;
  insert into public.member_offices(organization_id,member_id,office_type_id,effective_from,effective_to,notes,created_by)
  values(p_organization_id,p_member_id,p_reference_id,p_effective_from,p_effective_to,btrim(p_reason),auth.uid()) returning id into v_id;
 else
  if not exists(select 1 from public.recurring_rules r join public.financial_categories c on c.organization_id=r.organization_id and c.id=r.category_id
   where r.organization_id=p_organization_id and r.id=p_reference_id and r.active and r.frequency='monthly' and c.active and c.allow_recurrence and c.domain='member_receivable') then raise exception 'active monthly rule outside organization or ineligible' using errcode='23503'; end if;
  insert into public.recurring_member_terms(organization_id,member_id,recurring_rule_id,effective_from,effective_to,term_type,override_amount,reason,created_by)
  values(p_organization_id,p_member_id,p_reference_id,p_effective_from,p_effective_to,p_term_type,p_override_amount,btrim(p_reason),auth.uid()) returning id into v_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'member_configuration.schedule',case when p_kind='office' then 'member_office' else 'recurring_member_term' end,v_id,
  jsonb_build_object('member_id',p_member_id,'reference_id',p_reference_id,'from',p_effective_from,'to',p_effective_to,'term_type',p_term_type,'override_amount',p_override_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
