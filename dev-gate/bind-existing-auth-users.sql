-- DEV only; run after seed-dev-organizations.sql.
-- Set corsys_test.user_a and corsys_test.user_b to the confirmed Auth UUIDs
-- in this SQL session before running. No emails/passwords stored in source.
begin;
do $$
declare v_a uuid:=current_setting('corsys_test.user_a')::uuid;
v_b uuid:=current_setting('corsys_test.user_b')::uuid;
begin
  if v_a=v_b or (select count(*) from auth.users where id in (v_a,v_b) and email_confirmed_at is not null)<>2 then
    raise exception 'Two distinct confirmed Auth users required';
  end if;
  if (select count(*) from public.organizations where name in ('CORSYS DEV TENANT A','CORSYS DEV TENANT B'))<>2 then
    raise exception 'Both DEV organizations required';
  end if;
  insert into public.user_profiles(user_id,display_name)
  values(v_a,'Administrador DEV Tenant A'),(v_b,'Administrador DEV Tenant B')
  on conflict(user_id) do nothing;
  insert into public.user_roles(organization_id,user_id,role_id)
  select o.id,v.user_id,r.id
  from (values ('CORSYS DEV TENANT A',v_a),('CORSYS DEV TENANT B',v_b)) v(name,user_id)
  join public.organizations o on o.name=v.name
  join public.roles r on r.organization_id=o.id and r.code='ADMIN'
  on conflict do nothing;
end;
$$;
commit;
