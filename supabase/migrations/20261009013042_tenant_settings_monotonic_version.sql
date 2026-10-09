-- A dedicated monotonic version trigger for the tenant settings record.
-- Preserve the original shared timestamp function for every other table.
create function private.bump_tenant_settings_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 return new;
end $$;
revoke all on function private.bump_tenant_settings_updated_at() from public,anon,authenticated;
drop trigger organization_settings_set_updated_at on public.organization_settings;
create trigger organization_settings_set_updated_at before update on public.organization_settings
for each row execute function private.bump_tenant_settings_updated_at();
