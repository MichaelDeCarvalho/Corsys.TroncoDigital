-- Manual invariant verification script.
-- Run only in a disposable local database after migrations.
-- This script intentionally rolls back.

begin;

do $$
declare
  v_org uuid;
  v_member uuid;
  v_category uuid;
  v_method uuid;
  v_account uuid;
  v_charge uuid;
  v_payment uuid;
  v_allocation uuid;
begin
  insert into public.organizations(name) values ('Loja Teste') returning id into v_org;

  insert into public.members(organization_id, full_name)
  values (v_org, 'Integrante Teste')
  returning id into v_member;

  insert into public.financial_categories(organization_id, name, domain)
  values (v_org, 'Mensalidade', 'member_receivable')
  returning id into v_category;

  insert into public.payment_methods(organization_id, name)
  values (v_org, 'PIX')
  returning id into v_method;

  insert into public.financial_accounts(organization_id, name, account_type)
  values (v_org, 'Conta Teste', 'bank')
  returning id into v_account;

  insert into public.charges(
    organization_id, member_id, category_id, source_kind,
    description, competence, issue_date, due_date, accounting_period,
    quantity, unit_amount, original_amount
  )
  values (
    v_org, v_member, v_category, 'manual',
    'Mensalidade teste', date '2026-09-01', date '2026-09-01',
    date '2026-09-10', date '2026-09-01',
    1, 100, 100
  )
  returning id into v_charge;

  insert into public.payments(
    organization_id, member_id, payment_date, accounting_period,
    amount, payment_method_id, financial_account_id, source_kind
  )
  values (
    v_org, v_member, date '2026-09-05', date '2026-09-01',
    150, v_method, v_account, 'operational'
  )
  returning id into v_payment;

  insert into public.receivable_allocations(
    organization_id, member_id, charge_id, payment_id,
    amount, accounting_period
  )
  values (
    v_org, v_member, v_charge, v_payment, 100, date '2026-09-01'
  )
  returning id into v_allocation;

  if not exists (
    select 1 from public.v_member_financial_position
    where organization_id = v_org
      and member_id = v_member
      and open_receivables = 0
      and available_payment_credit = 50
      and net_position = -50
      and integrity_ok
  ) then
    raise exception 'FAILED: expected open=0 credit=50 net=-50';
  end if;

  begin
    insert into public.receivable_allocations(
      organization_id, member_id, charge_id, payment_id,
      amount, accounting_period
    )
    values (
      v_org, v_member, v_charge, v_payment, 1, date '2026-09-01'
    );
    raise exception 'FAILED: over-allocation should have been rejected';
  exception
    when check_violation or object_not_in_prerequisite_state or unique_violation then
      null;
  end;

  begin
    update public.payments set amount = 999 where id = v_payment;
    raise exception 'FAILED: immutable payment accepted UPDATE';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;


  -- Reconciliation must match the canonical position.
  if not exists (
    select 1 from public.v_member_financial_reconciliation
    where organization_id = v_org
      and member_id = v_member
      and reconciled
      and integrity_ok
  ) then
    raise exception 'FAILED: statement and financial position are not reconciled';
  end if;

  -- An adjustment cannot reduce effective charge below already allocated amount.
  begin
    insert into public.charge_adjustments(
      organization_id, member_id, charge_id, direction, adjustment_kind,
      amount, reason, accounting_period
    )
    values (
      v_org, v_member, v_charge, 'decrease', 'discount',
      1, 'Teste de redução indevida', date '2026-09-01'
    );
    raise exception 'FAILED: adjustment below allocated amount should have been rejected';
  exception
    when check_violation then
      null;
  end;

  -- Operational payment requires a financial account.
  begin
    insert into public.payments(
      organization_id, member_id, payment_date, accounting_period,
      amount, payment_method_id, financial_account_id, source_kind
    )
    values (
      v_org, v_member, date '2026-09-06', date '2026-09-01',
      10, v_method, null, 'operational'
    );
    raise exception 'FAILED: operational payment without account should have been rejected';
  exception
    when check_violation then
      null;
  end;

  -- Non-posting legacy data must not alter canonical position.
  insert into public.legacy_financial_records(
    organization_id, member_id, record_type, event_date,
    amount, description
  )
  values (
    v_org, v_member, 'payment', date '2025-01-10',
    999, 'Pagamento legado apenas informativo'
  );

  if not exists (
    select 1 from public.v_member_financial_position
    where organization_id = v_org
      and member_id = v_member
      and net_position = -50
  ) then
    raise exception 'FAILED: legacy non-posting record changed canonical position';
  end if;

  -- Close period and confirm that new financial facts are rejected.
  <<period_test>>
  declare
    v_period uuid;
  begin
    insert into public.financial_periods(organization_id, period)
    values (v_org, date '2026-09-01')
    returning id into v_period;

    insert into public.period_events(
      organization_id, financial_period_id, event_type, reason
    )
    values (
      v_org, v_period, 'close', 'Teste de fechamento'
    );

    begin
      insert into public.charges(
        organization_id, member_id, category_id, source_kind,
        description, competence, issue_date, due_date, accounting_period,
        quantity, unit_amount, original_amount
      )
      values (
        v_org, v_member, v_category, 'manual',
        'Cobrança em período fechado', date '2026-09-01',
        date '2026-09-20', date '2026-09-30', date '2026-09-01',
        1, 10, 10
      );
      raise exception 'FAILED: closed period accepted new charge';
    exception
      when object_not_in_prerequisite_state then
        null;
    end;
  end;

  raise notice 'PASS: base financial invariants validated in transaction';
end;
$$;

rollback;
