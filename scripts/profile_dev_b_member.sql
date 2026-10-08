-- Authorized DEV only. Live JWT test window; restore ADMIN before finishing.
begin;
do $$
declare v_role uuid;
begin
 if not exists(select 1 from public.organizations where id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and name='CORSYS DEV TENANT B')
  or exists(select 1 from public.platform_staff where user_id='559ba052-c408-4418-b806-0c0c4b8e3603')
  or exists(select 1 from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and organization_id<>'b112d600-bf1a-4bfd-bc1c-e9e9b749b539')
  or not exists(select 1 from public.members where id='20ec239c-36b4-46b3-af72-0f583a02cd93' and organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539' and full_name='DEV HTTP FINANCIAL TEST') then raise exception 'DEV profile fixture mismatch'; end if;
 if (select count(*) from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603')<>1
 or not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and r.code='VIEWER')
 or exists(select 1 from public.member_user_links where user_id='559ba052-c408-4418-b806-0c0c4b8e3603') then raise exception 'Expected VIEWER without links'; end if;
 delete from public.user_roles where user_id='559ba052-c408-4418-b806-0c0c4b8e3603' and organization_id='b112d600-bf1a-4bfd-bc1c-e9e9b749b539';
 insert into public.member_user_links(organization_id,member_id,user_id) values('b112d600-bf1a-4bfd-bc1c-e9e9b749b539','20ec239c-36b4-46b3-af72-0f583a02cd93','559ba052-c408-4418-b806-0c0c4b8e3603');
end; $$; commit;
