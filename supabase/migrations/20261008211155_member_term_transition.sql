-- Supabase DEV applied migration version 20261008211155. Future-only. No posted fact edits.
CREATE OR REPLACE FUNCTION public.transition_member_term(p_organization_id uuid, p_member_id uuid, p_current_term_id uuid, p_next_from date, p_next_type text, p_next_amount numeric, p_reason text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_current public.recurring_member_terms%rowtype;
 v_result uuid;
 v_last date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_member_id is null or p_current_term_id is null or p_next_from is null
   or extract(day from p_next_from)<>1 or p_next_from<=date_trunc('month',current_date)::date
   or (p_next_type is not null and p_next_type not in ('standard','exempt','override_amount'))
   or (p_next_type='override_amount' and (p_next_amount is null or p_next_amount::text in ('NaN','Infinity','-Infinity')
      or p_next_amount<0 or p_next_amount>999999999999.99 or p_next_amount<>round(p_next_amount,2)))
   or (p_next_type is distinct from 'override_amount' and p_next_amount is not null)
   or p_reason is null or length(btrim(p_reason)) not between 3 and 500
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid member term transition' using errcode='22023'; end if;
 v_result:=private.idempotency_begin(p_organization_id,'transition_member_term',p_idempotency_key,
   jsonb_build_object('member',p_member_id,'current_term',p_current_term_id,'next_from',p_next_from,
    'next_type',p_next_type,'next_amount',p_next_amount,'reason',btrim(p_reason)));
 if v_result is not null then return v_result; end if;
 -- Serialize all transitions for the member; a second writer must re-check the old term.
 perform 1 from public.members
  where organization_id=p_organization_id and id=p_member_id for update;
 if not found then raise exception 'member outside organization' using errcode='23503'; end if;
 select * into v_current from public.recurring_member_terms
  where organization_id=p_organization_id and member_id=p_member_id and id=p_current_term_id for update;
 if not found then raise exception 'member term outside organization' using errcode='23503'; end if;
 if v_current.effective_to is not null then
   raise exception 'member term already transitioned' using errcode='40001';
 end if;
 if p_next_from<=v_current.effective_from then
   raise exception 'successor must follow existing term' using errcode='22023';
 end if;
 v_last:=(p_next_from-interval '1 month')::date;
 if v_last<v_current.effective_from then
   raise exception 'invalid term closing boundary' using errcode='22023';
 end if;
 update public.recurring_member_terms
    set effective_to=v_last where id=v_current.id and organization_id=p_organization_id;
 if p_next_type is null then
   v_result:=v_current.id; -- close only: general rule applies from the next competence.
 else
   insert into public.recurring_member_terms(
      organization_id,member_id,recurring_rule_id,effective_from,effective_to,
      term_type,override_amount,reason,created_by)
   values (p_organization_id,p_member_id,v_current.recurring_rule_id,p_next_from,null,
      p_next_type,p_next_amount,btrim(p_reason),auth.uid())
   returning id into v_result;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,
    before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'member_configuration.transition','recurring_member_term',v_current.id,
  jsonb_build_object('term_id',v_current.id,'member_id',p_member_id,'rule_id',v_current.recurring_rule_id,
   'from',v_current.effective_from,'to',v_current.effective_to,'term_type',v_current.term_type),
  jsonb_build_object('closed_through',v_last,'next_term_id',case when p_next_type is null then null else v_result end,
   'next_from',p_next_from,'next_type',p_next_type,'next_amount',p_next_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$
;
revoke all on function public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text) to authenticated;
