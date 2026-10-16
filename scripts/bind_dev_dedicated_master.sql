-- Authorized DEV only; selected alias. Execute only after owner creates Auth account.
-- This becomes the first dedicated DEV Master; do not remove the last active Master.
begin;
do $$
declare v_user uuid;
begin
 select id into strict v_user from auth.users where lower(email)='michael.c.carvalho+corsys-dev-master@gmail.com';
 if v_user in ('a752dda8-4ef0-4c58-9d3b-b8fee14ec624','559ba052-c408-4418-b806-0c0c4b8e3603')
   or exists(select 1 from public.user_roles where user_id=v_user)
   or exists(select 1 from public.member_user_links where user_id=v_user)
   or exists(select 1 from public.platform_staff)
   or not exists(select 1 from public.saas_plans where id='7c71fda8-13b9-4bd4-999a-7df06937666d' and code='dev_http_financial_20261007' and price=0) then
  raise exception 'DEV identity/first staff fixture mismatch; inspect before changing privileges';
 end if;
 insert into public.platform_staff(user_id,role,active) values(v_user,'MASTER',true);
end; $$;
commit;
select s.user_id,s.role,s.active from public.platform_staff s join auth.users u on u.id=s.user_id where lower(u.email)='michael.c.carvalho+corsys-dev-master@gmail.com';
