begin;

-- Preserve the existing row policy and internal writers. Browser readers need
-- the transition and its scope, without the raw reason or actor identifier.
revoke select on public.saas_support_ticket_events from public, anon, authenticated;
grant select (id, organization_id, ticket_id, from_status, to_status, visibility, created_at)
  on public.saas_support_ticket_events to authenticated;

commit;
