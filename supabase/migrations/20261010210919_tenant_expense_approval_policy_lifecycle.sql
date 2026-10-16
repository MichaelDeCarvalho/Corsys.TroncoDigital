-- DEV V35: audited, idempotent tenant approval policy draft and publish.
create or replace function public.create_tenant_approval_policy_draft(
 p_organization_id uuid,p_name text,p_mode text,p_threshold_amount numeric,
 p_minimum_approvers integer,p_valid_from date,p_valid_to date,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'approvals.manage');
 if p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_mode not in ('off','all','threshold')
  or (p_mode='threshold' and (p_threshold_amount is null or p_threshold_amount::text in ('NaN','Infinity','-Infinity') or
    p_threshold_amount<0 or p_threshold_amount>999999999999.99 or p_threshold_amount<>round(p_threshold_amount,2)))
  or (p_mode<>'threshold' and p_threshold_amount is not null)
  or p_minimum_approvers is null or p_minimum_approvers not between 1 and 10
  or p_valid_from is null or p_valid_to is null or p_valid_to<p_valid_from
  or p_valid_from<=current_date
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid approval policy draft request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_approval_policy_draft',btrim(p_idempotency_key),
  jsonb_build_object('name',btrim(p_name),'mode',p_mode,'threshold',p_threshold_amount,
   'approvers',p_minimum_approvers,'from',p_valid_from,'to',p_valid_to,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 -- Future published overlap is forbidden by the constraint on publication,
 -- but block obvious conflicting drafts too for user-friendly correction.
 if exists(select 1 from public.expense_approval_policies
  where organization_id=p_organization_id and status='published'
  and daterange(valid_from,valid_to+1,'[)')&&daterange(p_valid_from,p_valid_to+1,'[)'))
 then raise exception 'new policy overlaps published policy' using errcode='23514';end if;
 insert into public.expense_approval_policies(
  organization_id,name,mode,threshold_amount,minimum_approvers,
  status,valid_from,valid_to,created_by)
 values(p_organization_id,btrim(p_name),p_mode,p_threshold_amount,p_minimum_approvers,
  'draft',p_valid_from,p_valid_to,auth.uid()) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'approval_policy.draft_create','expense_approval_policy',v_id,
  jsonb_build_object('name',btrim(p_name),'mode',p_mode,'threshold',p_threshold_amount,
   'minimum_approvers',p_minimum_approvers,'from',p_valid_from,'to',p_valid_to),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_approval_policy_draft(uuid,text,text,numeric,integer,date,date,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_approval_policy_draft(uuid,text,text,numeric,integer,date,date,text,text) to authenticated;

create or replace function public.publish_tenant_approval_policy_idempotent(
 p_organization_id uuid,p_policy_id uuid,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'approvals.manage');
 if p_policy_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500
 or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid approval policy publication' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'publish_tenant_approval_policy_idempotent',
  btrim(p_idempotency_key),jsonb_build_object('policy_id',p_policy_id,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 v_id:=public.publish_expense_approval_policy(p_organization_id,p_policy_id);
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,reason)
 values(p_organization_id,auth.uid(),'approval_policy.publish_confirmed','expense_approval_policy',v_id,btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.publish_tenant_approval_policy_idempotent(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.publish_tenant_approval_policy_idempotent(uuid,uuid,text,text) to authenticated;
