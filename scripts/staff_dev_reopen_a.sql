-- Authorized DEV only; dedicated non-Master staff. Cleanup on failure/cancellation.
begin;
do $$
declare v_user uuid; v_count integer;
begin
 select id into strict v_user from auth.users where lower(email)='michael.c.carvalho+corsys-dev-staff@gmail.com' and email_confirmed_at is not null;
 if v_user in ('71e27b4c-f0ba-46f7-832f-4faf29e8603d','a752dda8-4ef0-4c58-9d3b-b8fee14ec624','559ba052-c408-4418-b806-0c0c4b8e3603')
 or exists(select 1 from public.user_roles where user_id=v_user)
 or exists(select 1 from public.member_user_links where user_id=v_user)
 or not exists(select 1 from public.platform_staff where user_id='71e27b4c-f0ba-46f7-832f-4faf29e8603d' and role='MASTER' and active)
 or not exists(select 1 from public.organizations where id='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' and name='CORSYS DEV TENANT A')
 or not exists(select 1 from public.organizations where id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and name='CORSYS DEV TENANT B')
 or exists(select 1 from public.saas_support_sessions where staff_user_id=v_user and (organization_id<>'f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' or reason<>'DEV STAFF LIVE 20261008')) then raise exception 'DEV dedicated staff fixture mismatch'; end if;
 if not exists(select 1 from public.platform_staff where user_id=v_user and role='SUPPORT' and active) then raise exception 'Expected active SUPPORT'; end if;
 if (select count(*) from public.saas_support_sessions where staff_user_id=v_user and reason='DEV STAFF LIVE 20261008')<>1 then raise exception 'Expected one fixture support session'; end if;
 update public.saas_support_sessions set expires_at=now()+interval '15 minutes' where staff_user_id=v_user and organization_id='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b' and reason='DEV STAFF LIVE 20261008' and ended_at is null and expires_at<now();
 if not found then raise exception 'Expected expired support window'; end if;
end; $$;
commit;
