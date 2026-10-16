-- Authorized DEV only. All role/link/staff/session changes ROLLBACK.
-- Database authorization with simulated claims; no signed JWT or MFA verification.
begin;
do $$
declare
 v_org uuid:='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b';
 v_other uuid:='b112d600-bf1a-4bfd-bc1c-e9e9b749b539';
 v_user uuid; v_role uuid; v_member uuid; v_peer uuid; v_session uuid;
begin
 select ur.user_id into strict v_user from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.organization_id=v_org and r.code='ADMIN';
 if exists(select 1 from public.platform_staff where user_id=v_user)
   or exists(select 1 from public.member_user_links where user_id=v_user) then
   raise exception 'DEV identity fixture changed; inspect first';
 end if;
 insert into public.members(organization_id,full_name) values(v_org,'DEV own linked member') returning id into v_member;
 insert into public.members(organization_id,full_name) values(v_org,'DEV peer member') returning id into v_peer;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated','aal','aal1')::text,true);
 delete from public.user_roles where user_id=v_user;
 select id into strict v_role from public.roles where organization_id=v_org and code='TREASURER';
 insert into public.user_roles(organization_id,user_id,role_id) values(v_org,v_user,v_role);
 execute 'set local role authenticated';
 if not private.has_permission(v_org,'payments.create') or not private.has_permission(v_org,'finance.read')
   or private.has_permission(v_org,'users.manage') or private.has_permission(v_other,'finance.read') then
   raise exception 'Treasurer permissions wrong';
 end if;
 execute 'reset role';
 delete from public.user_roles where user_id=v_user;
 select id into strict v_role from public.roles where organization_id=v_org and code='VIEWER';
 insert into public.user_roles(organization_id,user_id,role_id) values(v_org,v_user,v_role);
 execute 'set local role authenticated';
 if not exists(select 1 from public.members where id=v_member)
   or private.has_permission(v_org,'payments.create') or private.has_permission(v_org,'members.write') then
   raise exception 'Viewer permissions wrong';
 end if;
 begin
   perform public.register_payment(v_org,v_member,'2026-09-01','2026-09-01',1,gen_random_uuid(),gen_random_uuid(),null,null,'dev-viewer-denied');
   raise exception 'Viewer accepted financial command';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
 delete from public.user_roles where user_id=v_user;
 insert into public.member_user_links(organization_id,member_id,user_id) values(v_org,v_member,v_user);
 execute 'set local role authenticated';
 if not exists(select 1 from public.members where id=v_member)
   or exists(select 1 from public.members where id=v_peer or organization_id=v_other)
   or not private.can_read_financial_member(v_org,v_member)
   or private.can_read_financial_member(v_org,v_peer) then
   raise exception 'Member self-only authorization wrong';
 end if;
 begin
   perform public.register_payment(v_org,v_member,'2026-09-01','2026-09-01',1,gen_random_uuid(),gen_random_uuid(),null,null,'dev-member-denied');
   raise exception 'Member accepted financial command';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
 delete from public.member_user_links where user_id=v_user;
 execute 'set local role authenticated';
 if exists(select 1 from public.members where organization_id in(v_org,v_other))
   or private.can_read_financial_member(v_org,v_member) then
   raise exception 'Revoked member link still permits access';
 end if;
 execute 'reset role';

 insert into public.platform_staff(user_id,role) values(v_user,'SUPPORT');
 insert into public.saas_support_sessions(staff_user_id,organization_id,reason,scope,expires_at)
 values(v_user,v_other,'DEV transaction-only read access','read_only',now()+interval '1 hour') returning id into v_session;
 execute 'set local role authenticated';
 if private.has_active_support_session(v_other)
   or exists(select 1 from public.members where organization_id=v_other) then
   raise exception 'Support AAL1 accepted';
 end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 if not private.has_active_support_session(v_other)
   or not exists(select 1 from public.members where organization_id=v_other)
   or exists(select 1 from public.members where organization_id=v_org)
   or private.has_permission(v_other,'payments.create') then
   raise exception 'Support scope/tenant restriction wrong';
 end if;
 begin
   perform public.register_payment(v_other,v_peer,'2026-09-01','2026-09-01',1,gen_random_uuid(),gen_random_uuid(),null,null,'dev-support-denied');
   raise exception 'Read-only support accepted payment';
 exception when insufficient_privilege then null;
 end;
 execute 'reset role';
 update public.saas_support_sessions set expires_at=now()-interval '1 second',started_at=now()-interval '1 hour' where id=v_session;
 execute 'set local role authenticated';
 if private.has_active_support_session(v_other)
   or exists(select 1 from public.members where organization_id=v_other) then
   raise exception 'Expired support retains access';
 end if;
 execute 'reset role';
 update public.saas_support_sessions set expires_at=now()+interval '1 hour',ended_at=now() where id=v_session;
 execute 'set local role authenticated';
 if private.has_active_support_session(v_other) then raise exception 'Ended support retains access'; end if;
 execute 'reset role';
 update public.saas_support_sessions set ended_at=null where id=v_session;
 update public.platform_staff set active=false where user_id=v_user;
 execute 'set local role authenticated';
 if private.has_active_support_session(v_other)
   or exists(select 1 from public.members where organization_id=v_other) then
   raise exception 'Inactive support staff retains access';
 end if;
 execute 'reset role';
end;
$$;
rollback;
select 'DEV_ROLES_SUPPORT_PASS (database RLS/helpers; simulated claims; real MFA pending)' as result;

