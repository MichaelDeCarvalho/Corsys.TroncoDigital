-- DEV QA A/B, two distinct authenticated identities, full ROLLBACK.
-- Temporary approval-only role is never committed or visible to other transactions.
begin;
do $$
declare t record;policy uuid;category uuid;method uuid;account uuid;payable uuid;request uuid;
 limited_role uuid;first_vote uuid;payment uuid;k text;phase text;cash_before numeric;checks integer:=0;
begin
 for t in select * from(values
 ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid),
 ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid)
 )f(org,actor,second_actor) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')
   or exists(select 1 from public.user_roles where organization_id=t.org and user_id=t.second_actor)
  then raise exception 'unexpected QA scope/role baseline';end if;
  select sum(balance) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  select id into strict category from public.financial_categories where organization_id=t.org and domain='institutional_expense' and active;
  select id into method from public.payment_methods where organization_id=t.org and active order by id limit 1;
  select id into account from public.financial_accounts where organization_id=t.org and active order by id limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.second_actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  begin perform public.decide_payable_approval_idempotent(t.org,gen_random_uuid(),'approve','DEV QA foreign scope',gen_random_uuid()::text);raise exception 'unassigned actor accepted';exception when insufficient_privilege then checks:=checks+1;end;
  execute 'reset role';
  insert into public.roles(organization_id,code,name)values(t.org,'DEV_QA_APPROVER_20261021','DEV QA rollback approver')returning id into limited_role;
  insert into public.role_permissions(role_id,permission_code)values(limited_role,'approvals.review'),(limited_role,'finance.read');
  insert into public.user_roles(organization_id,user_id,role_id)values(t.org,t.second_actor,limited_role);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  policy:=public.create_tenant_approval_policy_draft(t.org,'DEV QA two approvers','all',null,2,'2026-10-22','2026-10-31','DEV QA rollback multiapproval',gen_random_uuid()::text);
  perform public.publish_tenant_approval_policy_idempotent(t.org,policy,'DEV QA rollback multiapproval',gen_random_uuid()::text);
  foreach phase in array array['approve','reject'] loop
   payable:=public.create_institutional_payable(t.org,category,null,'DEV QA two approvers '||phase,'DEV QA fictitious','2026-10-01','2026-10-22','2026-10-23','2026-10-01',1,gen_random_uuid()::text);
   select approval_request_id into strict request from public.v_payable_approval_state where organization_id=t.org and payable_id=payable and approval_required and minimum_approvers=2 and approval_status='pending';
   k:=gen_random_uuid()::text;
   first_vote:=public.decide_payable_approval_idempotent(t.org,request,'approve','DEV QA first approver',k);
   if first_vote<>public.decide_payable_approval_idempotent(t.org,request,'approve','DEV QA first approver',k)then raise exception 'vote replay mismatch';end if;
   begin perform public.decide_payable_approval_idempotent(t.org,request,'approve','DEV QA duplicate vote',gen_random_uuid()::text);raise exception 'same actor counted twice';exception when unique_violation then checks:=checks+1;end;
   if not exists(select 1 from public.v_payable_approval_state where payable_id=payable and approval_status='pending' and approvals=1)then raise exception 'single actor satisfied threshold';end if;
   begin perform public.register_institutional_payable_payment(t.org,payable,'2026-10-21','2026-10-01',1,1,method,account,'DEV QA before threshold',gen_random_uuid()::text);raise exception 'payment before threshold';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';
   perform set_config('request.jwt.claims',jsonb_build_object('sub',t.second_actor,'role','authenticated','aal','aal1')::text,true);
   execute 'set local role authenticated';
   perform public.decide_payable_approval_idempotent(t.org,request,phase,'DEV QA second approver',gen_random_uuid()::text);
   begin perform public.register_institutional_payable_payment(t.org,payable,'2026-10-21','2026-10-01',1,1,method,account,'DEV QA approval-only role',gen_random_uuid()::text);raise exception 'approver role paid expense';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';
   if (select count(distinct actor_user_id) from public.payable_approval_decisions where approval_request_id=request)<>2
    or (select count(*) from public.audit_logs where entity_id=request and action in('payable_approval.approve','payable_approval.reject'))<>2
   then raise exception 'multiapproval audit/identity mismatch';end if;
   perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
   execute 'set local role authenticated';
   if phase='approve' then
    if not exists(select 1 from public.v_payable_approval_state where payable_id=payable and approval_status='approved' and approvals=2)then raise exception 'two actors did not approve';end if;
    payment:=public.register_institutional_payable_payment(t.org,payable,'2026-10-21','2026-10-01',1,1,method,account,'DEV QA after threshold',gen_random_uuid()::text);
    perform public.reverse_tenant_institutional_movement(t.org,'payable_payment',payment,'2026-10-21','DEV QA rollback payment',gen_random_uuid()::text);
   else
    if not exists(select 1 from public.v_payable_approval_state where payable_id=payable and approval_status='rejected' and approvals=1 and rejections=1)then raise exception 'rejection not respected';end if;
    begin perform public.register_institutional_payable_payment(t.org,payable,'2026-10-21','2026-10-01',1,1,method,account,'DEV QA rejected expense',gen_random_uuid()::text);raise exception 'rejected expense paid';exception when insufficient_privilege then checks:=checks+1;end;
   end if;
   execute 'reset role';
   if (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>cash_before then raise exception 'multiapproval cash invariant';end if;
   execute 'set local role authenticated';
  end loop;
  execute 'reset role';
 end loop;
 if checks<>16 then raise exception 'missing multiapproval denials: %',checks;end if;
end $$;
rollback;
select 'DEV_MULTIAPPROVER_AB_ROLLBACK_PASS' result;
