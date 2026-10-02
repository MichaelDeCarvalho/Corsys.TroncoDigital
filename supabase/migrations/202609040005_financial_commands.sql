-- Corsys Tesouraria
-- Migration 005: initial transactional financial commands
--
-- These RPCs are intended to be called with the authenticated user's JWT.
-- Do not call them with a browser-exposed privileged key.

create or replace function private.idempotency_begin(
  p_organization_id uuid,
  p_operation text,
  p_key text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_hash text := encode(extensions.digest(p_payload::text, 'sha256'), 'hex');
  v_existing public.idempotency_keys%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.idempotency_keys(
    organization_id, user_id, operation, idempotency_key, payload_hash
  )
  values (
    p_organization_id, v_user_id, p_operation, p_key, v_hash
  )
  on conflict (organization_id, user_id, idempotency_key) do nothing;

  select *
    into v_existing
  from public.idempotency_keys
  where organization_id = p_organization_id
    and user_id = v_user_id
    and idempotency_key = p_key
  for update;

  if v_existing.payload_hash <> v_hash or v_existing.operation <> p_operation then
    raise exception 'idempotency key reused with different operation or payload'
      using errcode = '22023';
  end if;

  if v_existing.status = 'completed' then
    return v_existing.result_reference;
  end if;

  if v_existing.status = 'failed' then
    update public.idempotency_keys
      set status = 'processing',
          error_code = null,
          completed_at = null
    where id = v_existing.id;
  end if;

  return null;
end;
$$;

create or replace function private.idempotency_complete(
  p_organization_id uuid,
  p_key text,
  p_result uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.idempotency_keys
  set status = 'completed',
      result_reference = p_result,
      completed_at = now(),
      error_code = null
  where organization_id = p_organization_id
    and user_id = (select auth.uid())
    and idempotency_key = p_key;
$$;

revoke all on function private.idempotency_begin(uuid, text, text, jsonb) from public;
revoke all on function private.idempotency_complete(uuid, text, uuid) from public;

create or replace function public.create_manual_charge(
  p_organization_id uuid,
  p_member_id uuid,
  p_category_id uuid,
  p_description text,
  p_competence date,
  p_issue_date date,
  p_due_date date,
  p_accounting_period date,
  p_amount numeric,
  p_reference text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_result uuid;
  v_charge_id uuid;
  v_user_id uuid := (select auth.uid());
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id, 'charges.create');

  if extract(day from p_competence) <> 1 or extract(day from p_accounting_period) <> 1 then
    raise exception 'competence/accounting_period must be first day of month'
      using errcode = '22023';
  end if;

  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'amount must have at most 2 decimal places' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'member_id', p_member_id,
    'category_id', p_category_id,
    'description', p_description,
    'competence', p_competence,
    'issue_date', p_issue_date,
    'due_date', p_due_date,
    'accounting_period', p_accounting_period,
    'amount', p_amount,
    'reference', p_reference
  );

  v_existing_result := private.idempotency_begin(
    p_organization_id, 'create_manual_charge', p_idempotency_key, v_payload
  );

  if v_existing_result is not null then
    return v_existing_result;
  end if;

  insert into public.charges(
    organization_id,
    member_id,
    category_id,
    source_kind,
    description,
    reference,
    competence,
    issue_date,
    due_date,
    accounting_period,
    quantity,
    unit_amount,
    original_amount,
    created_by
  )
  values (
    p_organization_id,
    p_member_id,
    p_category_id,
    'manual',
    p_description,
    p_reference,
    p_competence,
    p_issue_date,
    p_due_date,
    p_accounting_period,
    1,
    p_amount,
    p_amount,
    v_user_id
  )
  returning id into v_charge_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  )
  values (
    p_organization_id,
    v_user_id,
    'charge.create',
    'charge',
    v_charge_id,
    jsonb_build_object('amount', p_amount, 'member_id', p_member_id)
  );

  perform private.idempotency_complete(p_organization_id, p_idempotency_key, v_charge_id);

  return v_charge_id;
end;
$$;

create or replace function public.register_payment(
  p_organization_id uuid,
  p_member_id uuid,
  p_payment_date date,
  p_accounting_period date,
  p_amount numeric,
  p_payment_method_id uuid,
  p_financial_account_id uuid,
  p_reference text,
  p_notes text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_result uuid;
  v_payment_id uuid;
  v_user_id uuid := (select auth.uid());
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id, 'payments.create');

  if extract(day from p_accounting_period) <> 1 then
    raise exception 'accounting_period must be first day of month' using errcode = '22023';
  end if;

  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'amount must have at most 2 decimal places' using errcode = '22023';
  end if;

  if p_financial_account_id is null then
    raise exception 'operational payment requires financial account' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'member_id', p_member_id,
    'payment_date', p_payment_date,
    'accounting_period', p_accounting_period,
    'amount', p_amount,
    'payment_method_id', p_payment_method_id,
    'financial_account_id', p_financial_account_id,
    'reference', p_reference,
    'notes', p_notes
  );

  v_existing_result := private.idempotency_begin(
    p_organization_id, 'register_payment', p_idempotency_key, v_payload
  );

  if v_existing_result is not null then
    return v_existing_result;
  end if;

  insert into public.payments(
    organization_id,
    member_id,
    payment_date,
    accounting_period,
    amount,
    payment_method_id,
    financial_account_id,
    source_kind,
    reference,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_member_id,
    p_payment_date,
    p_accounting_period,
    p_amount,
    p_payment_method_id,
    p_financial_account_id,
    'operational',
    p_reference,
    p_notes,
    v_user_id
  )
  returning id into v_payment_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  )
  values (
    p_organization_id,
    v_user_id,
    'payment.create',
    'payment',
    v_payment_id,
    jsonb_build_object('amount', p_amount, 'member_id', p_member_id)
  );

  perform private.idempotency_complete(p_organization_id, p_idempotency_key, v_payment_id);

  return v_payment_id;
end;
$$;


create or replace function public.allocate_payment_to_charge(
  p_organization_id uuid,
  p_payment_id uuid,
  p_charge_id uuid,
  p_amount numeric,
  p_accounting_period date,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_allocation_id uuid;
  v_existing_result uuid;
  v_payload jsonb;
begin
  perform private.require_permission(p_organization_id, 'allocations.manage');

  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'amount must have at most 2 decimal places' using errcode = '22023';
  end if;

  if extract(day from p_accounting_period) <> 1 then
    raise exception 'accounting_period must be first day of month' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'payment_id', p_payment_id,
    'charge_id', p_charge_id,
    'amount', p_amount,
    'accounting_period', p_accounting_period
  );

  v_existing_result := private.idempotency_begin(
    p_organization_id, 'allocate_payment_to_charge', p_idempotency_key, v_payload
  );

  if v_existing_result is not null then
    return v_existing_result;
  end if;

  select member_id
    into v_member_id
  from public.payments
  where id = p_payment_id
    and organization_id = p_organization_id
  for update;

  if v_member_id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  insert into public.receivable_allocations(
    organization_id,
    member_id,
    charge_id,
    payment_id,
    amount,
    accounting_period,
    created_by
  )
  values (
    p_organization_id,
    v_member_id,
    p_charge_id,
    p_payment_id,
    p_amount,
    p_accounting_period,
    v_user_id
  )
  returning id into v_allocation_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  )
  values (
    p_organization_id,
    v_user_id,
    'allocation.create',
    'receivable_allocation',
    v_allocation_id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'charge_id', p_charge_id,
      'amount', p_amount
    )
  );

  perform private.idempotency_complete(
    p_organization_id, p_idempotency_key, v_allocation_id
  );

  return v_allocation_id;
end;
$$;

create or replace function public.allocate_payment_fifo(
  p_organization_id uuid,
  p_payment_id uuid,
  p_accounting_period date
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_payment_amount numeric(14,2);
  v_already_allocated numeric(14,2);
  v_remaining numeric(14,2);
  v_open numeric(14,2);
  v_apply numeric(14,2);
  v_charge record;
begin
  perform private.require_permission(p_organization_id, 'allocations.manage');

  if extract(day from p_accounting_period) <> 1 then
    raise exception 'accounting_period must be first day of month' using errcode = '22023';
  end if;

  select p.member_id, p.amount
    into v_member_id, v_payment_amount
  from public.payments p
  where p.id = p_payment_id
    and p.organization_id = p_organization_id
  for update;

  if v_member_id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.payment_reversals where payment_id = p_payment_id) then
    raise exception 'payment is reversed' using errcode = '55000';
  end if;

  select coalesce(sum(a.amount), 0)
    into v_already_allocated
  from public.receivable_allocations a
  left join public.allocation_reversals ar on ar.allocation_id = a.id
  where a.payment_id = p_payment_id
    and ar.id is null;

  v_remaining := v_payment_amount - v_already_allocated;

  for v_charge in
    select c.id
    from public.charges c
    left join public.charge_cancellations cc on cc.charge_id = c.id
    where c.organization_id = p_organization_id
      and c.member_id = v_member_id
      and cc.id is null
    order by c.due_date asc, c.issue_date asc, c.id asc
    for update of c
  loop
    exit when v_remaining <= 0;

    select
      c.original_amount
      + coalesce((
          select sum(case when ca.direction = 'increase' then ca.amount else -ca.amount end)
          from public.charge_adjustments ca
          where ca.charge_id = c.id
        ), 0)
      - coalesce((
          select sum(a.amount)
          from public.receivable_allocations a
          left join public.allocation_reversals ar on ar.allocation_id = a.id
          left join public.payment_reversals pr on pr.payment_id = a.payment_id
          left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
          where a.charge_id = c.id
            and ar.id is null
            and pr.id is null
            and cr.id is null
        ), 0)
      into v_open
    from public.charges c
    where c.id = v_charge.id;

    if v_open > 0 then
      v_apply := least(v_open, v_remaining);

      insert into public.receivable_allocations(
        organization_id, member_id, charge_id, payment_id,
        amount, accounting_period, created_by
      )
      values (
        p_organization_id, v_member_id, v_charge.id, p_payment_id,
        v_apply, p_accounting_period, v_user_id
      );

      v_remaining := v_remaining - v_apply;
    end if;
  end loop;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  )
  values (
    p_organization_id,
    v_user_id,
    'allocation.fifo',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'allocated_now', v_payment_amount - v_already_allocated - v_remaining,
      'remaining_credit', v_remaining
    )
  );

  return v_remaining;
end;
$$;

create or replace function public.reverse_payment(
  p_organization_id uuid,
  p_payment_id uuid,
  p_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_reversal_id uuid;
  v_allocation record;
begin
  perform private.require_permission(p_organization_id, 'payments.reverse');

  if extract(day from p_accounting_period) <> 1 then
    raise exception 'accounting_period must be first day of month' using errcode = '22023';
  end if;

  if coalesce(length(btrim(p_reason)), 0) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;

  select member_id
    into v_member_id
  from public.payments
  where id = p_payment_id
    and organization_id = p_organization_id
  for update;

  if v_member_id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.payment_reversals where payment_id = p_payment_id) then
    raise exception 'payment already reversed' using errcode = '23505';
  end if;

  for v_allocation in
    select a.id
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    where a.payment_id = p_payment_id
      and ar.id is null
    order by a.created_at, a.id
  loop
    insert into public.allocation_reversals(
      organization_id, member_id, allocation_id, reason,
      accounting_period, created_by
    )
    values (
      p_organization_id, v_member_id, v_allocation.id,
      'Reversão decorrente de estorno do pagamento: ' || p_reason,
      p_accounting_period, v_user_id
    );
  end loop;

  insert into public.payment_reversals(
    organization_id, member_id, payment_id, reason,
    accounting_period, created_by
  )
  values (
    p_organization_id, v_member_id, p_payment_id, p_reason,
    p_accounting_period, v_user_id
  )
  returning id into v_reversal_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, reason
  )
  values (
    p_organization_id,
    v_user_id,
    'payment.reverse',
    'payment',
    p_payment_id,
    p_reason
  );

  return v_reversal_id;
end;
$$;

create or replace function public.cancel_charge(
  p_organization_id uuid,
  p_charge_id uuid,
  p_accounting_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_member_id uuid;
  v_cancel_id uuid;
  v_allocation record;
begin
  perform private.require_permission(p_organization_id, 'charges.cancel');

  if extract(day from p_accounting_period) <> 1 then
    raise exception 'accounting_period must be first day of month' using errcode = '22023';
  end if;

  if coalesce(length(btrim(p_reason)), 0) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;

  select member_id
    into v_member_id
  from public.charges
  where id = p_charge_id
    and organization_id = p_organization_id
  for update;

  if v_member_id is null then
    raise exception 'charge not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.charge_cancellations where charge_id = p_charge_id) then
    raise exception 'charge already cancelled' using errcode = '23505';
  end if;

  for v_allocation in
    select a.id
    from public.receivable_allocations a
    left join public.allocation_reversals ar on ar.allocation_id = a.id
    left join public.payment_reversals pr on pr.payment_id = a.payment_id
    left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
    where a.charge_id = p_charge_id
      and ar.id is null
      and pr.id is null
      and cr.id is null
    order by a.created_at, a.id
  loop
    insert into public.allocation_reversals(
      organization_id, member_id, allocation_id, reason,
      accounting_period, created_by
    )
    values (
      p_organization_id, v_member_id, v_allocation.id,
      'Reversão decorrente de cancelamento da cobrança: ' || p_reason,
      p_accounting_period, v_user_id
    );
  end loop;

  insert into public.charge_cancellations(
    organization_id, member_id, charge_id, reason,
    accounting_period, created_by
  )
  values (
    p_organization_id, v_member_id, p_charge_id, p_reason,
    p_accounting_period, v_user_id
  )
  returning id into v_cancel_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, reason
  )
  values (
    p_organization_id,
    v_user_id,
    'charge.cancel',
    'charge',
    p_charge_id,
    p_reason
  );

  return v_cancel_id;
end;
$$;

create or replace function public.close_financial_period(
  p_organization_id uuid,
  p_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_period_id uuid;
  v_event_id uuid;
begin
  perform private.require_permission(p_organization_id, 'periods.close');

  if extract(day from p_period) <> 1 then
    raise exception 'period must be first day of month' using errcode = '22023';
  end if;

  if coalesce(length(btrim(p_reason)), 0) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;

  insert into public.financial_periods(organization_id, period)
  values (p_organization_id, p_period)
  on conflict (organization_id, period) do nothing;

  select id into v_period_id
  from public.financial_periods
  where organization_id = p_organization_id and period = p_period
  for update;

  if private.is_period_closed(p_organization_id, p_period) then
    raise exception 'period already closed' using errcode = '55000';
  end if;

  insert into public.period_events(
    organization_id, financial_period_id, event_type, reason, actor_user_id
  )
  values (
    p_organization_id, v_period_id, 'close', p_reason, v_user_id
  )
  returning id into v_event_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, reason
  )
  values (
    p_organization_id, v_user_id, 'period.close', 'financial_period', v_period_id, p_reason
  );

  return v_event_id;
end;
$$;

create or replace function public.reopen_financial_period(
  p_organization_id uuid,
  p_period date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_period_id uuid;
  v_event_id uuid;
begin
  perform private.require_permission(p_organization_id, 'periods.reopen');

  if extract(day from p_period) <> 1 then
    raise exception 'period must be first day of month' using errcode = '22023';
  end if;

  if coalesce(length(btrim(p_reason)), 0) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;

  select id into v_period_id
  from public.financial_periods
  where organization_id = p_organization_id and period = p_period
  for update;

  if v_period_id is null or not private.is_period_closed(p_organization_id, p_period) then
    raise exception 'period is not closed' using errcode = '55000';
  end if;

  insert into public.period_events(
    organization_id, financial_period_id, event_type, reason, actor_user_id
  )
  values (
    p_organization_id, v_period_id, 'reopen', p_reason, v_user_id
  )
  returning id into v_event_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, reason
  )
  values (
    p_organization_id, v_user_id, 'period.reopen', 'financial_period', v_period_id, p_reason
  );

  return v_event_id;
end;
$$;

-- RPC exposure: authenticated only.
revoke all on function public.create_manual_charge(uuid, uuid, uuid, text, date, date, date, date, numeric, text, text) from public;
revoke all on function public.register_payment(uuid, uuid, date, date, numeric, uuid, uuid, text, text, text) from public;
revoke all on function public.allocate_payment_to_charge(uuid, uuid, uuid, numeric, date, text) from public;
revoke all on function public.allocate_payment_fifo(uuid, uuid, date) from public;
revoke all on function public.reverse_payment(uuid, uuid, date, text) from public;
revoke all on function public.cancel_charge(uuid, uuid, date, text) from public;
revoke all on function public.close_financial_period(uuid, date, text) from public;
revoke all on function public.reopen_financial_period(uuid, date, text) from public;

grant execute on function public.create_manual_charge(uuid, uuid, uuid, text, date, date, date, date, numeric, text, text) to authenticated;
grant execute on function public.register_payment(uuid, uuid, date, date, numeric, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.allocate_payment_to_charge(uuid, uuid, uuid, numeric, date, text) to authenticated;
grant execute on function public.allocate_payment_fifo(uuid, uuid, date) to authenticated;
grant execute on function public.reverse_payment(uuid, uuid, date, text) to authenticated;
grant execute on function public.cancel_charge(uuid, uuid, date, text) to authenticated;
grant execute on function public.close_financial_period(uuid, date, text) to authenticated;
grant execute on function public.reopen_financial_period(uuid, date, text) to authenticated;
