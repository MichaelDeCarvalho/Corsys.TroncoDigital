-- V35 DEV: deterministic monthly member-charge generation, no auto-posting.
-- Candidate rows are internal and enforce no write. Only explicit authorized RPC emits facts.
create or replace function private.monthly_charge_candidates(
 p_organization_id uuid, p_rule_id uuid, p_competence date
) returns table(member_id uuid,amount numeric,due_date date,decision text)
language sql stable security definer set search_path='' as $$
 select m.id,
 case when t.term_type='exempt' then 0::numeric(14,2)
      when t.term_type='override_amount' then t.override_amount
      else v.unit_amount end as amount,
 make_date(extract(year from p_competence)::integer,
           extract(month from p_competence)::integer,
           least(r.due_day,
             extract(day from (p_competence+interval '1 month - 1 day'))::integer)) as due_date,
 case when t.term_type='exempt' or (t.term_type='override_amount' and t.override_amount=0)
       then 'exempt'
      when v.id is null then 'missing_price'
      when exists(select 1 from public.charges c
           where c.organization_id=p_organization_id and c.member_id=m.id
             and c.recurring_rule_id=p_rule_id and c.competence=p_competence
             and c.supersedes_charge_id is null) then 'existing'
      else 'create' end as decision
 from public.members m
 join public.recurring_rules r on r.organization_id=m.organization_id
    and r.id=p_rule_id and r.organization_id=p_organization_id
 left join lateral (
   select rv.id,rv.unit_amount from public.recurring_rule_versions rv
   where rv.recurring_rule_id=r.id and rv.valid_from_competence<=p_competence
     and (rv.valid_to_competence is null or rv.valid_to_competence>=p_competence)
   order by rv.valid_from_competence desc limit 1
 ) v on true
 left join lateral (
   select mt.term_type,mt.override_amount from public.recurring_member_terms mt
   where mt.organization_id=p_organization_id and mt.recurring_rule_id=p_rule_id
     and mt.member_id=m.id and mt.effective_from<=p_competence
     and (mt.effective_to is null or mt.effective_to>=p_competence)
   order by mt.effective_from desc limit 1
 ) t on true
 where m.organization_id=p_organization_id and m.status='active'
 order by m.id;
$$;
revoke all on function private.monthly_charge_candidates(uuid,uuid,date) from PUBLIC,anon,authenticated;

create or replace function public.preview_monthly_charge_generation(
 p_organization_id uuid,p_rule_id uuid,p_competence date
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rule public.recurring_rules%rowtype;v_category public.financial_categories%rowtype;
 v_mapping uuid;v_count integer;v_create integer;v_exempt integer;v_existing integer;v_missing integer;
 v_checksum text;v_closed boolean;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 if p_rule_id is null or p_competence is null or extract(day from p_competence)<>1
   or p_competence<(date_trunc('month',current_date)-interval '12 months')::date
   or p_competence>=(date_trunc('month',current_date)+interval '13 months')::date
 then raise exception 'monthly competence out of supported range' using errcode='22023';end if;
 select * into v_rule from public.recurring_rules
 where id=p_rule_id and organization_id=p_organization_id;
 if not found then raise exception 'monthly rule not found in organization' using errcode='23503';end if;
 select * into v_category from public.financial_categories
 where id=v_rule.category_id and organization_id=p_organization_id;
 select a.accounting_account_id into v_mapping
 from private.resolve_category_account(p_organization_id,v_rule.category_id,p_competence) a;
 select count(*),count(*) filter(where decision='create'),
   count(*) filter(where decision='exempt'),count(*) filter(where decision='existing'),
   count(*) filter(where decision='missing_price'),
   encode(extensions.digest(coalesce(string_agg(
     member_id::text||'|'||coalesce(amount::text,'NULL')||'|'||decision||'|'||due_date::text,
     ';' order by member_id),'')||'|'||p_organization_id::text||'|'||
       p_rule_id::text||'|'||p_competence::text,'sha256'),'hex')
 into v_count,v_create,v_exempt,v_existing,v_missing,v_checksum
 from private.monthly_charge_candidates(p_organization_id,p_rule_id,p_competence);
 v_closed:=private.is_period_closed(p_organization_id,p_competence);
 return jsonb_build_object(
  'organization_id',p_organization_id,'rule_id',p_rule_id,'competence',p_competence,
  'rule_name',v_rule.name,'ready',
    v_rule.active and v_rule.frequency='monthly'
    and coalesce(v_category.active,false) and coalesce(v_category.allow_recurrence,false)
    and v_category.domain='member_receivable'
    and v_mapping is not null and not v_closed and v_count>0 and v_count<=200
    and v_missing=0 and v_create>0,
  'eligible_members',v_count,'to_create',v_create,'exempt',v_exempt,
  'already_generated',v_existing,'missing_price',v_missing,
  'accounting_mapping_ready',v_mapping is not null,'period_closed',v_closed,
  'fingerprint',v_checksum
 );
end $$;
revoke all on function public.preview_monthly_charge_generation(uuid,uuid,date) from PUBLIC,anon,authenticated;
grant execute on function public.preview_monthly_charge_generation(uuid,uuid,date) to authenticated;

create or replace function public.generate_monthly_member_charges(
 p_organization_id uuid,p_rule_id uuid,p_competence date,p_expected_fingerprint text,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_existing uuid;v_batch uuid;v_preview jsonb;v_rule public.recurring_rules%rowtype;
 v_row record;v_created integer:=0;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 if p_rule_id is null or p_competence is null or extract(day from p_competence)<>1
  or p_expected_fingerprint is null or p_expected_fingerprint !~ '^[0-9a-f]{64}$'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid monthly generation request' using errcode='22023';end if;
 v_existing:=private.idempotency_begin(
  p_organization_id,'generate_monthly_member_charges',p_idempotency_key,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,
    'expected_fingerprint',p_expected_fingerprint,'reason',btrim(p_reason)));
 if v_existing is not null then return v_existing;end if;
 -- Serialize with published-accounting changes, price scheduling and member-term updates.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'organization not found' using errcode='23503';end if;
 select * into v_rule from public.recurring_rules
  where id=p_rule_id and organization_id=p_organization_id for update;
 if not found then raise exception 'recurring rule not found' using errcode='23503';end if;
 -- Member-configuration commands lock member rows; use identical lock order.
 perform 1 from public.members where organization_id=p_organization_id and status='active'
  order by id for update;
 v_preview:=public.preview_monthly_charge_generation(p_organization_id,p_rule_id,p_competence);
 if not coalesce((v_preview->>'ready')::boolean,false) then
  raise exception 'monthly generation preview not ready' using errcode='23514';end if;
 if v_preview->>'fingerprint'<>p_expected_fingerprint then
  raise exception 'monthly generation preview changed' using errcode='40001';end if;
 insert into public.charge_batches(organization_id,batch_type,description,competence,created_by)
 values(p_organization_id,'recurring',
   'Regra mensal '||v_rule.name||' / '||to_char(p_competence,'YYYY-MM'),p_competence,auth.uid())
 returning id into v_batch;
 for v_row in select * from private.monthly_charge_candidates(p_organization_id,p_rule_id,p_competence)
  where decision='create' order by member_id loop
  insert into public.charges(
   organization_id,member_id,category_id,batch_id,recurring_rule_id,
   source_kind,generation_key,description,reference,competence,issue_date,due_date,
   accounting_period,quantity,unit_amount,original_amount,created_by
  ) values (
   p_organization_id,v_row.member_id,v_rule.category_id,v_batch,p_rule_id,
   'recurring',
   'monthly:'||p_rule_id::text||':'||v_row.member_id::text||':'||to_char(p_competence,'YYYY-MM'),
   v_rule.name||' — '||to_char(p_competence,'MM/YYYY'),
   to_char(p_competence,'YYYY-MM'),
   p_competence,p_competence,v_row.due_date,p_competence,
   1,v_row.amount,v_row.amount,auth.uid()
  );
  v_created:=v_created+1;
 end loop;
 if v_created<>(v_preview->>'to_create')::integer then
  raise exception 'monthly generation count changed' using errcode='40001';end if;
 insert into public.audit_logs(
  organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason
 ) values (
  p_organization_id,auth.uid(),'monthly_charges.generate','charge_batch',v_batch,
  jsonb_build_object('rule_id',p_rule_id,'competence',p_competence,
   'created',v_created,'skipped_exempt',v_preview->'exempt',
   'already_generated',v_preview->'already_generated','fingerprint',p_expected_fingerprint),
  btrim(p_reason)
 );
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_batch);
 return v_batch;
end $$;
revoke all on function public.generate_monthly_member_charges(uuid,uuid,date,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.generate_monthly_member_charges(uuid,uuid,date,text,text,text) to authenticated;
