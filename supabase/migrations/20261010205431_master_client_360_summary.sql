-- DEV only. Tenant 360 read from platform staff boundary, never a tenant role.
create or replace function public.read_master_client_360(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_org public.organizations%rowtype;v_account public.saas_tenant_accounts%rowtype;
 v_sub public.saas_subscriptions%rowtype;
 v_invoice_count bigint;v_invoice_open numeric(14,2);v_invoice_overdue numeric(14,2);
 v_tickets_open bigint;v_tickets_total bigint;v_integrity_failed boolean;
begin
 perform private.require_platform_staff('MASTER');
 if p_organization_id is null then raise exception 'organization required' using errcode='22023';end if;
 select * into v_org from public.organizations where id=p_organization_id;
 if not found then raise exception 'client organization not found' using errcode='23503';end if;
 select * into v_account from public.saas_tenant_accounts where organization_id=p_organization_id;
 select * into v_sub from public.saas_subscriptions where organization_id=p_organization_id
 order by started_at desc,id desc limit 1;
 select count(*),coalesce(sum(amount_open),0),coalesce(sum(amount_open) filter(where due_date<current_date),0),
    coalesce(bool_or(integrity_ok is not true),false)
 into v_invoice_count,v_invoice_open,v_invoice_overdue,v_integrity_failed
 from public.v_saas_invoice_balances where organization_id=p_organization_id;
 if v_integrity_failed then raise exception 'client invoice integrity failed' using errcode='23514';end if;
 select count(*),count(*) filter(where status not in ('resolved','closed'))
 into v_tickets_total,v_tickets_open
 from public.saas_support_tickets where organization_id=p_organization_id and ticket_scope='tenant';
 return jsonb_build_object(
  'organization_id',v_org.id,'name',v_org.name,'number',v_org.number,'status',v_org.status,
  'commercial_status',v_account.commercial_status,'customer_since',v_account.customer_since,
  'billing_email',v_account.billing_email,'billing_provider',v_account.billing_provider,
  'subscription_id',v_sub.id,'subscription_status',v_sub.status,
  'subscription_start',v_sub.current_period_start,'subscription_end',v_sub.current_period_end,
  'plan_version_id',v_sub.plan_version_id,'invoices_total',v_invoice_count,
  'invoices_open_amount',v_invoice_open,'invoices_overdue_amount',v_invoice_overdue,
  'tickets_total',v_tickets_total,'tickets_open',v_tickets_open,
  'as_of',current_date,'integrity_ok',true
 );
end $$;
revoke all on function public.read_master_client_360(uuid) from public,anon,authenticated;
grant execute on function public.read_master_client_360(uuid) to authenticated;
