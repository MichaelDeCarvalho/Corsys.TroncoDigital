-- Authorized DEV only: future draft policies and manual approval test requests.
-- Does not update/delete posted ledger, current settings, Auth, grants or subscriptions.
begin;
do $$
declare org uuid; actor uuid; payable uuid; v_policy uuid;
begin
 if exists(select 1 from public.expense_approval_policies where name='DEV FINAL IDOR 20261008') then raise exception 'Fixture already seeded; inspect, never repeat blindly'; end if;
 for org,actor,payable in select * from (values
 ('f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'ed7877e0-520d-44ad-9445-63a955546def'::uuid),
 ('b112d600-bf1a-4bfd-bc1c-e9e9b749b539'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'e5eaac66-41f4-4788-9afa-0acedd9e80c3'::uuid)) x loop
 if not exists(select 1 from public.organizations where id=org and name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B'))
 or not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=actor and ur.organization_id=org and r.code='ADMIN')
 or not exists(select 1 from public.institutional_payables where id=payable and organization_id=org and description='DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696 payable' and amount=100)
 or exists(select 1 from public.payable_approval_requests where organization_id=org and payable_id=payable) then raise exception 'DEV final identity/fact fixture mismatch'; end if;
 insert into public.expense_approval_policies(organization_id,name,mode,minimum_approvers,status,valid_from,valid_to,created_by)
 values(org,'DEV FINAL IDOR 20261008','off',1,'draft','2030-01-01','2030-12-31',actor) returning id into v_policy;
 -- Manual fictitious authorization request; not an automated policy workflow.
 insert into public.payable_approval_requests(organization_id,payable_id,minimum_approvers,amount_snapshot,requested_by)
 values(org,payable,1,100,'71e27b4c-f0ba-46f7-832f-4faf29e8603d');
 end loop;
end; $$;
commit;
select p.organization_id,p.id as policy_id,r.id as approval_request_id,r.payable_id
from public.expense_approval_policies p join public.payable_approval_requests r on r.organization_id=p.organization_id
where p.name='DEV FINAL IDOR 20261008';
