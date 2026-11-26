-- Browser roles cannot access this private bucket directly, even under broader permissive policies.
begin;
insert into storage.buckets (id, name, public, file_size_limit)
values ('tenant-documents', 'tenant-documents', false, 16777216)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy tenant_documents_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'tenant-documents')
with check (bucket_id <> 'tenant-documents');
commit;
