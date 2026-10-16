-- Authorized DEV only. Live JWT test window; restore ADMIN before finishing.
begin;
do $$
declare v_role uuid;
begin
 if not exists(select 1 from public.organizations where id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and name='CORSYS DEV TENANT B')
  or exists(select 1 from public.platform_staff where user_id='559ba052-c408-4418-b806-0c0c4b8e3603')
  or exists(select 1 from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and organization_id<>'b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
  or not exists(select 1 from public.members where id='20ec239c-36b4-46b3-af72-0f583a02cd93' and organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and full_name='DEV HTTP FINANCIAL TEST') then raise exception 'DEV profile fixture mismatch'; end if;
 if (select count(*) from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603')>1
 or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and r.code not in ('ADMIN','TREASURER','VIEWER'))
 or exists(select 1 from public.member_user_links where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and (member_id<>'20ec239c-36b4-46b3-af72-0f583a02cd93' or organization_id<>'b112d600-bf1a-4bfd-bc1c-e9e9b749b539')) then raise exception 'Unexpected privileges/links; inspect'; end if;
  delete from public.member_user_links where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and member_id='20ec239c-36b4-46b3-af72-0f583a02cd93' and organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539';
 if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and r.code='ADMIN') then
  delete from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539';
  insert into public.user_roles(organization_id,user_id,role_id,created_at)
  values('b112d600-bf1a-4bfd-bc1c-e9e9b749b539','559ba052-c408-4418-b806-0c0c4b8e3603','f41fdb04-9e2e-4eed-a974-1affd92e6912','2026-10-02 22:58:27.201308+00');
 end if;
end; $$; commit;
select ur.user_id,r.code from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='559ba052-c408-4418-b806-0c0c4b8e3603';
