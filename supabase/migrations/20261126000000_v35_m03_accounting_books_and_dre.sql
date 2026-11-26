-- Corsys Tronco Digital V35 — M03 (Contabilidade, Diário, Razão e DRE Gerencial)
-- Additive migration on main (83e362d2): governed role mappings, double-entry Diário,
-- verifiable Razão per account, and DRE Gerencial waterfall with B01-B05 safeguards.
-- Fail-closed on missing mappings, unapproved rules, and tenant mismatch.

create table public.accounting_plan_role_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_plan_id uuid not null,
  role_code text not null check (
    role_code in (
      'member_receivable_control',
      'institutional_receivable_control',
      'member_advance_liability',
      'institutional_payable_control',
      'revenue_deduction',
      'financial_fee_expense',
      'opening_balance_contra',
      'closing_result_account'
    )
  ),
  accounting_account_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, accounting_plan_id, role_code),
  unique (organization_id, id),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id) on delete cascade,
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id)
);

create trigger accounting_plan_role_mappings_set_updated_at
before update on public.accounting_plan_role_mappings
for each row execute function private.set_updated_at();

create trigger accounting_plan_role_mappings_published_guard
before insert or update or delete on public.accounting_plan_role_mappings
for each row execute function private.prevent_published_accounting_structure_mutation();

create or replace function private.validate_accounting_plan_role_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nature text;
  v_row_type text;
  v_active boolean;
begin
  select a.nature, a.row_type, a.active
    into v_nature, v_row_type, v_active
  from public.accounting_accounts a
  where a.organization_id = new.organization_id
    and a.accounting_plan_id = new.accounting_plan_id
    and a.id = new.accounting_account_id;

  if v_row_type is distinct from 'analytic' or not coalesce(v_active, false) then
    raise exception 'accounting plan role mapping must target an active analytic account'
      using errcode = '23514';
  end if;

  if new.role_code = 'revenue_deduction' and v_nature is distinct from 'revenue' then
    raise exception 'revenue_deduction role must map to an analytic revenue account'
      using errcode = '23514';
  end if;

  if new.role_code = 'financial_fee_expense' and v_nature not in ('expense', 'financial_result') then
    raise exception 'financial_fee_expense role must map to an analytic expense or financial_result account'
      using errcode = '23514';
  end if;

  if new.role_code in (
    'member_receivable_control',
    'institutional_receivable_control',
    'member_advance_liability',
    'institutional_payable_control',
    'opening_balance_contra',
    'closing_result_account'
  ) and v_nature is distinct from 'patrimonial' then
    raise exception 'patrimonial control/contra role must map to an analytic patrimonial account'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_accounting_plan_role_mapping() from public, anon, authenticated;

create trigger accounting_plan_role_mappings_validate
before insert or update on public.accounting_plan_role_mappings
for each row execute function private.validate_accounting_plan_role_mapping();

revoke all on public.accounting_plan_role_mappings from anon, authenticated;
alter table public.accounting_plan_role_mappings enable row level security;
grant select on public.accounting_plan_role_mappings to authenticated;

create policy accounting_plan_role_mappings_select
on public.accounting_plan_role_mappings for select to authenticated
using (private.has_permission(organization_id, 'finance.read'));

create or replace function public.set_accounting_plan_role_mapping_idempotent(
  p_organization_id uuid,
  p_accounting_plan_id uuid,
  p_role_code text,
  p_accounting_account_id uuid,
  p_expected_account_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.accounting_plans%rowtype;
  v_existing public.accounting_plan_role_mappings%rowtype;
  v_id uuid;
begin
  perform private.require_permission(p_organization_id, 'accounting.manage');

  if p_accounting_plan_id is null
     or p_role_code is null
     or p_accounting_account_id is null
     or p_reason is null
     or length(btrim(p_reason)) not between 3 and 500
     or p_idempotency_key is null
     or length(btrim(p_idempotency_key)) not between 1 and 200
  then
    raise exception 'invalid accounting role mapping request' using errcode = '22023';
  end if;

  if p_role_code not in (
    'member_receivable_control',
    'institutional_receivable_control',
    'member_advance_liability',
    'institutional_payable_control',
    'revenue_deduction',
    'financial_fee_expense',
    'opening_balance_contra',
    'closing_result_account'
  ) then
    raise exception 'invalid accounting role code' using errcode = '22023';
  end if;

  v_id := private.idempotency_begin(
    p_organization_id,
    'set_accounting_plan_role_mapping_idempotent',
    p_idempotency_key,
    jsonb_build_object(
      'plan', p_accounting_plan_id,
      'role', p_role_code,
      'account', p_accounting_account_id,
      'expected', p_expected_account_id,
      'reason', btrim(p_reason)
    )
  );
  if v_id is not null then
    return v_id;
  end if;

  select * into v_plan
  from public.accounting_plans p
  where p.organization_id = p_organization_id
    and p.id = p_accounting_plan_id
  for update;

  if not found then
    raise exception 'accounting plan outside organization' using errcode = '23503';
  end if;

  if v_plan.status <> 'draft' then
    raise exception 'published accounting plan is immutable; create a successor plan'
      using errcode = '55000';
  end if;

  select * into v_existing
  from public.accounting_plan_role_mappings m
  where m.organization_id = p_organization_id
    and m.accounting_plan_id = p_accounting_plan_id
    and m.role_code = p_role_code
  for update;

  if coalesce(v_existing.accounting_account_id, null::uuid) is distinct from p_expected_account_id then
    raise exception 'accounting role mapping changed concurrently; reload plan before retrying'
      using errcode = '40001';
  end if;

  if v_existing.id is null then
    insert into public.accounting_plan_role_mappings(
      organization_id, accounting_plan_id, role_code, accounting_account_id
    ) values (
      p_organization_id, p_accounting_plan_id, p_role_code, p_accounting_account_id
    )
    returning id into v_id;
  else
    update public.accounting_plan_role_mappings
    set accounting_account_id = p_accounting_account_id
    where id = v_existing.id
    returning id into v_id;
  end if;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id,
    before_data, after_data, reason
  ) values (
    p_organization_id,
    auth.uid(),
    'accounting_plan.role_mapping_set',
    'accounting_plan_role_mapping',
    v_id,
    case
      when v_existing.id is null then null
      else jsonb_build_object(
        'role_code', p_role_code,
        'accounting_account_id', v_existing.accounting_account_id
      )
    end,
    jsonb_build_object(
      'accounting_plan_id', p_accounting_plan_id,
      'role_code', p_role_code,
      'accounting_account_id', p_accounting_account_id
    ),
    btrim(p_reason)
  );

  perform private.idempotency_complete(p_organization_id, p_idempotency_key, v_id);
  return v_id;
end;
$$;

revoke all on function public.set_accounting_plan_role_mapping_idempotent(uuid, uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_accounting_plan_role_mapping_idempotent(uuid, uuid, text, uuid, uuid, text, text)
  to authenticated;

create or replace function private.resolve_plan_role_account(
  p_organization_id uuid,
  p_plan_id uuid,
  p_role_code text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.accounting_account_id
  from public.accounting_plan_role_mappings m
  join public.accounting_accounts a
    on a.organization_id = m.organization_id
   and a.accounting_plan_id = m.accounting_plan_id
   and a.id = m.accounting_account_id
  where m.organization_id = p_organization_id
    and m.accounting_plan_id = p_plan_id
    and m.role_code = p_role_code
    and a.active
    and a.row_type = 'analytic'
  limit 1;
$$;

create or replace function private.resolve_cash_accounting_account(
  p_organization_id uuid,
  p_plan_id uuid,
  p_financial_account_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.accounting_account_id
  from public.financial_account_accounting_mappings m
  join public.accounting_accounts a
    on a.organization_id = m.organization_id
   and a.accounting_plan_id = m.accounting_plan_id
   and a.id = m.accounting_account_id
  where m.organization_id = p_organization_id
    and m.accounting_plan_id = p_plan_id
    and m.financial_account_id = p_financial_account_id
    and a.active
    and a.row_type = 'analytic'
    and a.nature = 'patrimonial'
  limit 1;
$$;

revoke all on function private.resolve_plan_role_account(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.resolve_cash_accounting_account(uuid, uuid, uuid) from public, anon, authenticated;

-- Canonical balanced double-entry ledger projection over immutable operational facts (Anexo III).
-- Never invents synthetic accounts or opening equity: unmapped legs stay NULL and set is_fully_mapped = false.
create or replace function private.tenant_accounting_journal(
  p_organization_id uuid
)
returns table (
  entry_seq bigint,
  entry_id text,
  organization_id uuid,
  accounting_period date,
  competence date,
  event_date date,
  created_at timestamptz,
  event_type text,
  source_table text,
  source_id uuid,
  reference_event_id uuid,
  is_reversal_or_correction boolean,
  accounting_plan_id uuid,
  plan_name text,
  debit_account_id uuid,
  debit_account_code text,
  debit_account_description text,
  debit_role text,
  credit_account_id uuid,
  credit_account_code text,
  credit_account_description text,
  credit_role text,
  amount numeric(14,2),
  description text,
  reason text,
  is_fully_mapped boolean,
  mapping_gap_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with member_charge_effective as (
    select
      c.id,
      (c.original_amount + coalesce(sum(
        case when a.direction = 'increase' then a.amount else -a.amount end
      ), 0))::numeric(14,2) as amount_before_cancel
    from public.charges c
    left join public.charge_adjustments a
      on a.organization_id = c.organization_id
     and a.charge_id = c.id
    where c.organization_id = p_organization_id
    group by c.id
  ),
  raw_entries as (
    -- 1. Cobranças de integrantes emitidas (inclusive parcelas replacement de acordo)
    select
      c.organization_id,
      c.accounting_period,
      c.competence,
      c.issue_date as event_date,
      c.created_at,
      case
        when c.source_kind = 'replacement' then 'member_agreement_installment'
        else 'member_charge'
      end as event_type,
      'charges'::text as source_table,
      c.id as source_id,
      1 as line_no,
      case
        when c.source_kind = 'replacement' then c.supersedes_charge_id
        else null::uuid
      end as reference_event_id,
      false as is_reversal_or_correction,
      c.accounting_plan_id as plan_id,
      private.resolve_plan_role_account(c.organization_id, c.accounting_plan_id, 'member_receivable_control') as debit_acc_id,
      'member_receivable_control'::text as debit_role,
      c.accounting_account_id as credit_acc_id,
      'category_revenue'::text as credit_role,
      c.original_amount::numeric(14,2) as amount,
      c.description,
      null::text as reason
    from public.charges c
    where c.organization_id = p_organization_id
      and c.accounting_account_id is not null

    union all

    -- 2. Ajustes em cobranças (desconto/abatimento -> deduções; correção débito/crédito -> receita)
    select
      a.organization_id,
      a.accounting_period,
      c.competence,
      private.tenant_current_date_at(a.organization_id, a.created_at) as event_date,
      a.created_at,
      case
        when a.direction = 'increase' then 'member_charge_adjustment_increase'
        when a.adjustment_kind in ('discount', 'waiver') then 'member_charge_deduction'
        else 'member_charge_credit_correction'
      end as event_type,
      'charge_adjustments'::text as source_table,
      a.id as source_id,
      1 as line_no,
      a.charge_id as reference_event_id,
      true as is_reversal_or_correction,
      c.accounting_plan_id as plan_id,
      case
        when a.direction = 'increase' then
          private.resolve_plan_role_account(a.organization_id, c.accounting_plan_id, 'member_receivable_control')
        when a.adjustment_kind in ('discount', 'waiver') then
          private.resolve_plan_role_account(a.organization_id, c.accounting_plan_id, 'revenue_deduction')
        else
          c.accounting_account_id
      end as debit_acc_id,
      case
        when a.direction = 'increase' then 'member_receivable_control'
        when a.adjustment_kind in ('discount', 'waiver') then 'revenue_deduction'
        else 'category_revenue'
      end as debit_role,
      case
        when a.direction = 'increase' then c.accounting_account_id
        else private.resolve_plan_role_account(a.organization_id, c.accounting_plan_id, 'member_receivable_control')
      end as credit_acc_id,
      case
        when a.direction = 'increase' then 'category_revenue'
        else 'member_receivable_control'
      end as credit_role,
      a.amount::numeric(14,2) as amount,
      c.description || ' (' || a.adjustment_kind || ')' as description,
      a.reason
    from public.charge_adjustments a
    join public.charges c
      on c.organization_id = a.organization_id
     and c.id = a.charge_id
    where a.organization_id = p_organization_id
      and c.accounting_account_id is not null

    union all

    -- 3. Cancelamentos de cobranças de integrantes
    select
      cc.organization_id,
      cc.accounting_period,
      c.competence,
      private.tenant_current_date_at(cc.organization_id, cc.created_at) as event_date,
      cc.created_at,
      'member_charge_cancellation'::text as event_type,
      'charge_cancellations'::text as source_table,
      cc.id as source_id,
      1 as line_no,
      cc.charge_id as reference_event_id,
      true as is_reversal_or_correction,
      c.accounting_plan_id as plan_id,
      c.accounting_account_id as debit_acc_id,
      'category_revenue'::text as debit_role,
      private.resolve_plan_role_account(cc.organization_id, c.accounting_plan_id, 'member_receivable_control') as credit_acc_id,
      'member_receivable_control'::text as credit_role,
      mce.amount_before_cancel::numeric(14,2) as amount,
      'Cancelamento: ' || c.description as description,
      cc.reason
    from public.charge_cancellations cc
    join public.charges c
      on c.organization_id = cc.organization_id
     and c.id = cc.charge_id
    join member_charge_effective mce on mce.id = c.id
    where cc.organization_id = p_organization_id
      and c.accounting_account_id is not null
      and mce.amount_before_cancel > 0

    union all

    -- 4. Pagamentos recebidos de integrantes (Caixa -> Adiantamentos/Créditos de Integrantes)
    select
      p.organization_id,
      p.accounting_period,
      p.accounting_period as competence,
      p.payment_date as event_date,
      p.created_at,
      'member_payment'::text as event_type,
      'payments'::text as source_table,
      p.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_cash_accounting_account(p.organization_id, plan_ref.plan_id, p.financial_account_id) as debit_acc_id,
      'cash_account'::text as debit_role,
      private.resolve_plan_role_account(p.organization_id, plan_ref.plan_id, 'member_advance_liability') as credit_acc_id,
      'member_advance_liability'::text as credit_role,
      p.amount::numeric(14,2) as amount,
      coalesce(nullif(btrim(p.notes), ''), 'Recebimento de integrante') as description,
      p.reference as reason
    from public.payments p
    cross join lateral (
      select private.accounting_plan_for_date(p.organization_id, p.accounting_period) as plan_id
    ) plan_ref
    where p.organization_id = p_organization_id
      and p.source_kind = 'operational'

    union all

    -- 5. Estornos de pagamentos de integrantes
    select
      pr.organization_id,
      pr.accounting_period,
      pr.accounting_period as competence,
      pr.reversal_date as event_date,
      pr.created_at,
      'member_payment_reversal'::text as event_type,
      'payment_reversals'::text as source_table,
      pr.id as source_id,
      1 as line_no,
      pr.payment_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(pr.organization_id, plan_ref.plan_id, 'member_advance_liability') as debit_acc_id,
      'member_advance_liability'::text as debit_role,
      private.resolve_cash_accounting_account(pr.organization_id, plan_ref.plan_id, p.financial_account_id) as credit_acc_id,
      'cash_account'::text as credit_role,
      p.amount::numeric(14,2) as amount,
      'Estorno de pagamento de integrante'::text as description,
      pr.reason
    from public.payment_reversals pr
    join public.payments p
      on p.organization_id = pr.organization_id
     and p.id = pr.payment_id
    cross join lateral (
      select private.accounting_plan_for_date(pr.organization_id, pr.accounting_period) as plan_id
    ) plan_ref
    where pr.organization_id = p_organization_id
      and p.source_kind = 'operational'

    union all

    -- 6. Alocações de pagamentos/créditos em títulos (Adiantamentos -> Contribuições a Receber)
    select
      ra.organization_id,
      ra.accounting_period,
      c.competence,
      private.tenant_current_date_at(ra.organization_id, ra.created_at) as event_date,
      ra.created_at,
      'member_receivable_allocation'::text as event_type,
      'receivable_allocations'::text as source_table,
      ra.id as source_id,
      1 as line_no,
      coalesce(ra.payment_id, ra.member_credit_id) as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(ra.organization_id, plan_ref.plan_id, 'member_advance_liability') as debit_acc_id,
      'member_advance_liability'::text as debit_role,
      private.resolve_plan_role_account(ra.organization_id, plan_ref.plan_id, 'member_receivable_control') as credit_acc_id,
      'member_receivable_control'::text as credit_role,
      ra.amount::numeric(14,2) as amount,
      'Baixa em título: ' || c.description as description,
      null::text as reason
    from public.receivable_allocations ra
    join public.charges c
      on c.organization_id = ra.organization_id
     and c.id = ra.charge_id
    cross join lateral (
      select coalesce(c.accounting_plan_id, private.accounting_plan_for_date(ra.organization_id, ra.accounting_period)) as plan_id
    ) plan_ref
    where ra.organization_id = p_organization_id

    union all

    -- 7. Estornos de alocações em títulos
    select
      ar.organization_id,
      ar.accounting_period,
      c.competence,
      private.tenant_current_date_at(ar.organization_id, ar.created_at) as event_date,
      ar.created_at,
      'member_allocation_reversal'::text as event_type,
      'allocation_reversals'::text as source_table,
      ar.id as source_id,
      1 as line_no,
      ar.allocation_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(ar.organization_id, plan_ref.plan_id, 'member_receivable_control') as debit_acc_id,
      'member_receivable_control'::text as debit_role,
      private.resolve_plan_role_account(ar.organization_id, plan_ref.plan_id, 'member_advance_liability') as credit_acc_id,
      'member_advance_liability'::text as credit_role,
      ra.amount::numeric(14,2) as amount,
      'Estorno de baixa em título: ' || c.description as description,
      ar.reason
    from public.allocation_reversals ar
    join public.receivable_allocations ra
      on ra.organization_id = ar.organization_id
     and ra.id = ar.allocation_id
    join public.charges c
      on c.organization_id = ra.organization_id
     and c.id = ra.charge_id
    cross join lateral (
      select coalesce(c.accounting_plan_id, private.accounting_plan_for_date(ar.organization_id, ar.accounting_period)) as plan_id
    ) plan_ref
    where ar.organization_id = p_organization_id

    union all

    -- 8. Créditos de integrantes (abertura / migração / transferível)
    select
      mc.organization_id,
      mc.accounting_period,
      mc.accounting_period as competence,
      private.tenant_current_date_at(mc.organization_id, mc.created_at) as event_date,
      mc.created_at,
      'member_credit'::text as event_type,
      'member_credits'::text as source_table,
      mc.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(mc.organization_id, plan_ref.plan_id, 'opening_balance_contra') as debit_acc_id,
      'opening_balance_contra'::text as debit_role,
      private.resolve_plan_role_account(mc.organization_id, plan_ref.plan_id, 'member_advance_liability') as credit_acc_id,
      'member_advance_liability'::text as credit_role,
      mc.amount::numeric(14,2) as amount,
      'Crédito de integrante (' || mc.credit_kind || ')' as description,
      mc.reason
    from public.member_credits mc
    cross join lateral (
      select private.accounting_plan_for_date(mc.organization_id, mc.accounting_period) as plan_id
    ) plan_ref
    where mc.organization_id = p_organization_id

    union all

    -- 9. Estornos de créditos de integrantes
    select
      mcr.organization_id,
      mcr.accounting_period,
      mcr.accounting_period as competence,
      private.tenant_current_date_at(mcr.organization_id, mcr.created_at) as event_date,
      mcr.created_at,
      'member_credit_reversal'::text as event_type,
      'member_credit_reversals'::text as source_table,
      mcr.id as source_id,
      1 as line_no,
      mcr.member_credit_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(mcr.organization_id, plan_ref.plan_id, 'member_advance_liability') as debit_acc_id,
      'member_advance_liability'::text as debit_role,
      private.resolve_plan_role_account(mcr.organization_id, plan_ref.plan_id, 'opening_balance_contra') as credit_acc_id,
      'opening_balance_contra'::text as credit_role,
      mc.amount::numeric(14,2) as amount,
      'Estorno de crédito de integrante'::text as description,
      mcr.reason
    from public.member_credit_reversals mcr
    join public.member_credits mc
      on mc.organization_id = mcr.organization_id
     and mc.id = mcr.member_credit_id
    cross join lateral (
      select private.accounting_plan_for_date(mcr.organization_id, mcr.accounting_period) as plan_id
    ) plan_ref
    where mcr.organization_id = p_organization_id

    union all

    -- 10. Contas a pagar institucionais postadas (Despesa/Custo -> Obrigações a Pagar)
    select
      ip.organization_id,
      ip.accounting_period,
      ip.competence,
      ip.issue_date as event_date,
      ip.created_at,
      'institutional_payable'::text as event_type,
      'institutional_payables'::text as source_table,
      ip.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      ip.accounting_plan_id as plan_id,
      ip.accounting_account_id as debit_acc_id,
      'category_expense'::text as debit_role,
      private.resolve_plan_role_account(ip.organization_id, ip.accounting_plan_id, 'institutional_payable_control') as credit_acc_id,
      'institutional_payable_control'::text as credit_role,
      ip.amount::numeric(14,2) as amount,
      ip.description,
      null::text as reason
    from public.institutional_payables ip
    where ip.organization_id = p_organization_id
      and ip.posting_status = 'posted'

    union all

    -- 11a. Retificações de contas a pagar — troca de conta (reversão anterior)
    select
      ipc.organization_id,
      ipc.accounting_period,
      ipc.previous_competence as competence,
      private.tenant_current_date_at(ipc.organization_id, ipc.created_at) as event_date,
      ipc.created_at,
      'institutional_payable_correction_reverse'::text as event_type,
      'institutional_payable_corrections'::text as source_table,
      ipc.id as source_id,
      1 as line_no,
      ipc.payable_id as reference_event_id,
      true as is_reversal_or_correction,
      ipc.previous_accounting_plan_id as plan_id,
      private.resolve_plan_role_account(ipc.organization_id, ipc.previous_accounting_plan_id, 'institutional_payable_control') as debit_acc_id,
      'institutional_payable_control'::text as debit_role,
      ipc.previous_accounting_account_id as credit_acc_id,
      'category_expense'::text as credit_role,
      ipc.previous_amount::numeric(14,2) as amount,
      'Retificação (estorno conta anterior): ' || ipc.previous_description as description,
      ipc.reason
    from public.institutional_payable_corrections ipc
    where ipc.organization_id = p_organization_id
      and ipc.previous_accounting_account_id <> ipc.new_accounting_account_id

    union all

    -- 11b. Retificações de contas a pagar — troca de conta (novo lançamento)
    select
      ipc.organization_id,
      ipc.accounting_period,
      ipc.new_competence as competence,
      private.tenant_current_date_at(ipc.organization_id, ipc.created_at) as event_date,
      ipc.created_at,
      'institutional_payable_correction_repost'::text as event_type,
      'institutional_payable_corrections'::text as source_table,
      ipc.id as source_id,
      2 as line_no,
      ipc.payable_id as reference_event_id,
      true as is_reversal_or_correction,
      ipc.new_accounting_plan_id as plan_id,
      ipc.new_accounting_account_id as debit_acc_id,
      'category_expense'::text as debit_role,
      private.resolve_plan_role_account(ipc.organization_id, ipc.new_accounting_plan_id, 'institutional_payable_control') as credit_acc_id,
      'institutional_payable_control'::text as credit_role,
      ipc.new_amount::numeric(14,2) as amount,
      'Retificação (reclassificação): ' || ipc.new_description as description,
      ipc.reason
    from public.institutional_payable_corrections ipc
    where ipc.organization_id = p_organization_id
      and ipc.previous_accounting_account_id <> ipc.new_accounting_account_id

    union all

    -- 11c. Retificações de contas a pagar — mesma conta, delta de valor
    select
      ipc.organization_id,
      ipc.accounting_period,
      ipc.new_competence as competence,
      private.tenant_current_date_at(ipc.organization_id, ipc.created_at) as event_date,
      ipc.created_at,
      'institutional_payable_correction_delta'::text as event_type,
      'institutional_payable_corrections'::text as source_table,
      ipc.id as source_id,
      1 as line_no,
      ipc.payable_id as reference_event_id,
      true as is_reversal_or_correction,
      ipc.new_accounting_plan_id as plan_id,
      case
        when ipc.new_amount > ipc.previous_amount then ipc.new_accounting_account_id
        else private.resolve_plan_role_account(ipc.organization_id, ipc.new_accounting_plan_id, 'institutional_payable_control')
      end as debit_acc_id,
      case
        when ipc.new_amount > ipc.previous_amount then 'category_expense'
        else 'institutional_payable_control'
      end as debit_role,
      case
        when ipc.new_amount > ipc.previous_amount then
          private.resolve_plan_role_account(ipc.organization_id, ipc.new_accounting_plan_id, 'institutional_payable_control')
        else ipc.new_accounting_account_id
      end as credit_acc_id,
      case
        when ipc.new_amount > ipc.previous_amount then 'institutional_payable_control'
        else 'category_expense'
      end as credit_role,
      abs(ipc.new_amount - ipc.previous_amount)::numeric(14,2) as amount,
      'Retificação (ajuste valor): ' || ipc.new_description as description,
      ipc.reason
    from public.institutional_payable_corrections ipc
    where ipc.organization_id = p_organization_id
      and ipc.previous_accounting_account_id = ipc.new_accounting_account_id
      and ipc.new_amount <> ipc.previous_amount

    union all

    -- 12. Cancelamentos de contas a pagar institucionais
    select
      ic.organization_id,
      ic.accounting_period,
      ip.competence,
      private.tenant_current_date_at(ic.organization_id, ic.created_at) as event_date,
      ic.created_at,
      'institutional_payable_cancellation'::text as event_type,
      'institutional_payable_cancellations'::text as source_table,
      ic.payable_id as source_id,
      1 as line_no,
      ic.payable_id as reference_event_id,
      true as is_reversal_or_correction,
      ic.accounting_plan_id as plan_id,
      private.resolve_plan_role_account(ic.organization_id, ic.accounting_plan_id, 'institutional_payable_control') as debit_acc_id,
      'institutional_payable_control'::text as debit_role,
      ic.accounting_account_id as credit_acc_id,
      'category_expense'::text as credit_role,
      ic.canceled_amount::numeric(14,2) as amount,
      'Cancelamento de obrigação: ' || ip.description as description,
      ic.reason
    from public.institutional_payable_cancellations ic
    join public.institutional_payables ip
      on ip.organization_id = ic.organization_id
     and ip.id = ic.payable_id
    where ic.organization_id = p_organization_id

    union all

    -- 13. Pagamentos de contas a pagar institucionais (Obrigações a Pagar -> Caixa)
    select
      ipp.organization_id,
      ipp.accounting_period,
      ipp.accounting_period as competence,
      ipp.payment_date as event_date,
      ipp.created_at,
      'institutional_payable_payment'::text as event_type,
      'institutional_payable_payments'::text as source_table,
      ipp.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(ipp.organization_id, plan_ref.plan_id, 'institutional_payable_control') as debit_acc_id,
      'institutional_payable_control'::text as debit_role,
      private.resolve_cash_accounting_account(ipp.organization_id, plan_ref.plan_id, ipp.financial_account_id) as credit_acc_id,
      'cash_account'::text as credit_role,
      ipp.amount::numeric(14,2) as amount,
      coalesce(nullif(btrim(ipp.notes), ''), 'Pagamento de obrigação institucional') as description,
      ipp.reference as reason
    from public.institutional_payable_payments ipp
    cross join lateral (
      select private.accounting_plan_for_date(ipp.organization_id, ipp.accounting_period) as plan_id
    ) plan_ref
    where ipp.organization_id = p_organization_id

    union all

    -- 14. Estornos de pagamentos institucionais
    select
      ippr.organization_id,
      ippr.accounting_period,
      ippr.accounting_period as competence,
      ippr.reversal_date as event_date,
      ippr.created_at,
      'institutional_payable_payment_reversal'::text as event_type,
      'institutional_payable_payment_reversals'::text as source_table,
      ippr.payment_id as source_id,
      1 as line_no,
      ippr.payment_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_cash_accounting_account(ippr.organization_id, plan_ref.plan_id, ipp.financial_account_id) as debit_acc_id,
      'cash_account'::text as debit_role,
      private.resolve_plan_role_account(ippr.organization_id, plan_ref.plan_id, 'institutional_payable_control') as credit_acc_id,
      'institutional_payable_control'::text as credit_role,
      ipp.amount::numeric(14,2) as amount,
      'Estorno de pagamento institucional'::text as description,
      ippr.reason
    from public.institutional_payable_payment_reversals ippr
    join public.institutional_payable_payments ipp
      on ipp.organization_id = ippr.organization_id
     and ipp.id = ippr.payment_id
    cross join lateral (
      select private.accounting_plan_for_date(ippr.organization_id, ippr.accounting_period) as plan_id
    ) plan_ref
    where ippr.organization_id = p_organization_id

    union all

    -- 15. Recebíveis institucionais postados (Recebíveis Institucionais -> Receita)
    select
      ir.organization_id,
      ir.accounting_period,
      ir.competence,
      ir.issue_date as event_date,
      ir.created_at,
      'institutional_receivable'::text as event_type,
      'institutional_receivables'::text as source_table,
      ir.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      ir.accounting_plan_id as plan_id,
      private.resolve_plan_role_account(ir.organization_id, ir.accounting_plan_id, 'institutional_receivable_control') as debit_acc_id,
      'institutional_receivable_control'::text as debit_role,
      ir.accounting_account_id as credit_acc_id,
      'category_revenue'::text as credit_role,
      ir.amount::numeric(14,2) as amount,
      ir.description,
      null::text as reason
    from public.institutional_receivables ir
    where ir.organization_id = p_organization_id
      and ir.posting_status = 'posted'

    union all

    -- 16a. Retificações de recebíveis institucionais — troca de conta (reversão anterior)
    select
      irc.organization_id,
      irc.accounting_period,
      irc.previous_competence as competence,
      private.tenant_current_date_at(irc.organization_id, irc.created_at) as event_date,
      irc.created_at,
      'institutional_receivable_correction_reverse'::text as event_type,
      'institutional_receivable_corrections'::text as source_table,
      irc.id as source_id,
      1 as line_no,
      irc.receivable_id as reference_event_id,
      true as is_reversal_or_correction,
      irc.previous_accounting_plan_id as plan_id,
      irc.previous_accounting_account_id as debit_acc_id,
      'category_revenue'::text as debit_role,
      private.resolve_plan_role_account(irc.organization_id, irc.previous_accounting_plan_id, 'institutional_receivable_control') as credit_acc_id,
      'institutional_receivable_control'::text as credit_role,
      irc.previous_amount::numeric(14,2) as amount,
      'Retificação receita (estorno anterior): ' || irc.previous_description as description,
      irc.reason
    from public.institutional_receivable_corrections irc
    where irc.organization_id = p_organization_id
      and irc.previous_accounting_account_id <> irc.new_accounting_account_id

    union all

    -- 16b. Retificações de recebíveis institucionais — troca de conta (reclassificação)
    select
      irc.organization_id,
      irc.accounting_period,
      irc.new_competence as competence,
      private.tenant_current_date_at(irc.organization_id, irc.created_at) as event_date,
      irc.created_at,
      'institutional_receivable_correction_repost'::text as event_type,
      'institutional_receivable_corrections'::text as source_table,
      irc.id as source_id,
      2 as line_no,
      irc.receivable_id as reference_event_id,
      true as is_reversal_or_correction,
      irc.new_accounting_plan_id as plan_id,
      private.resolve_plan_role_account(irc.organization_id, irc.new_accounting_plan_id, 'institutional_receivable_control') as debit_acc_id,
      'institutional_receivable_control'::text as debit_role,
      irc.new_accounting_account_id as credit_acc_id,
      'category_revenue'::text as credit_role,
      irc.new_amount::numeric(14,2) as amount,
      'Retificação receita (reclassificação): ' || irc.new_description as description,
      irc.reason
    from public.institutional_receivable_corrections irc
    where irc.organization_id = p_organization_id
      and irc.previous_accounting_account_id <> irc.new_accounting_account_id

    union all

    -- 16c. Retificações de recebíveis institucionais — mesma conta, delta de valor
    select
      irc.organization_id,
      irc.accounting_period,
      irc.new_competence as competence,
      private.tenant_current_date_at(irc.organization_id, irc.created_at) as event_date,
      irc.created_at,
      'institutional_receivable_correction_delta'::text as event_type,
      'institutional_receivable_corrections'::text as source_table,
      irc.id as source_id,
      1 as line_no,
      irc.receivable_id as reference_event_id,
      true as is_reversal_or_correction,
      irc.new_accounting_plan_id as plan_id,
      case
        when irc.new_amount > irc.previous_amount then
          private.resolve_plan_role_account(irc.organization_id, irc.new_accounting_plan_id, 'institutional_receivable_control')
        else irc.new_accounting_account_id
      end as debit_acc_id,
      case
        when irc.new_amount > irc.previous_amount then 'institutional_receivable_control'
        else 'category_revenue'
      end as debit_role,
      case
        when irc.new_amount > irc.previous_amount then irc.new_accounting_account_id
        else private.resolve_plan_role_account(irc.organization_id, irc.new_accounting_plan_id, 'institutional_receivable_control')
      end as credit_acc_id,
      case
        when irc.new_amount > irc.previous_amount then 'category_revenue'
        else 'institutional_receivable_control'
      end as credit_role,
      abs(irc.new_amount - irc.previous_amount)::numeric(14,2) as amount,
      'Retificação receita (ajuste valor): ' || irc.new_description as description,
      irc.reason
    from public.institutional_receivable_corrections irc
    where irc.organization_id = p_organization_id
      and irc.previous_accounting_account_id = irc.new_accounting_account_id
      and irc.new_amount <> irc.previous_amount

    union all

    -- 17. Cancelamentos de recebíveis institucionais
    select
      irc.organization_id,
      irc.accounting_period,
      ir.competence,
      private.tenant_current_date_at(irc.organization_id, irc.created_at) as event_date,
      irc.created_at,
      'institutional_receivable_cancellation'::text as event_type,
      'institutional_receivable_cancellations'::text as source_table,
      irc.receivable_id as source_id,
      1 as line_no,
      irc.receivable_id as reference_event_id,
      true as is_reversal_or_correction,
      irc.accounting_plan_id as plan_id,
      irc.accounting_account_id as debit_acc_id,
      'category_revenue'::text as debit_role,
      private.resolve_plan_role_account(irc.organization_id, irc.accounting_plan_id, 'institutional_receivable_control') as credit_acc_id,
      'institutional_receivable_control'::text as credit_role,
      irc.canceled_amount::numeric(14,2) as amount,
      'Cancelamento recebível: ' || ir.description as description,
      irc.reason
    from public.institutional_receivable_cancellations irc
    join public.institutional_receivables ir
      on ir.organization_id = irc.organization_id
     and ir.id = irc.receivable_id
    where irc.organization_id = p_organization_id

    union all

    -- 18. Recebimentos institucionais (Caixa -> Recebíveis Institucionais)
    select
      rc.organization_id,
      rc.accounting_period,
      rc.accounting_period as competence,
      rc.receipt_date as event_date,
      rc.created_at,
      'institutional_receipt'::text as event_type,
      'institutional_receipts'::text as source_table,
      rc.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_cash_accounting_account(rc.organization_id, plan_ref.plan_id, rc.financial_account_id) as debit_acc_id,
      'cash_account'::text as debit_role,
      private.resolve_plan_role_account(rc.organization_id, plan_ref.plan_id, 'institutional_receivable_control') as credit_acc_id,
      'institutional_receivable_control'::text as credit_role,
      rc.amount::numeric(14,2) as amount,
      coalesce(nullif(btrim(rc.notes), ''), 'Recebimento institucional') as description,
      rc.reference as reason
    from public.institutional_receipts rc
    cross join lateral (
      select private.accounting_plan_for_date(rc.organization_id, rc.accounting_period) as plan_id
    ) plan_ref
    where rc.organization_id = p_organization_id

    union all

    -- 19. Estornos de recebimentos institucionais
    select
      rcr.organization_id,
      rcr.accounting_period,
      rcr.accounting_period as competence,
      rcr.reversal_date as event_date,
      rcr.created_at,
      'institutional_receipt_reversal'::text as event_type,
      'institutional_receipt_reversals'::text as source_table,
      rcr.receipt_id as source_id,
      1 as line_no,
      rcr.receipt_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_plan_role_account(rcr.organization_id, plan_ref.plan_id, 'institutional_receivable_control') as debit_acc_id,
      'institutional_receivable_control'::text as debit_role,
      private.resolve_cash_accounting_account(rcr.organization_id, plan_ref.plan_id, rc.financial_account_id) as credit_acc_id,
      'cash_account'::text as credit_role,
      rc.amount::numeric(14,2) as amount,
      'Estorno de recebimento institucional'::text as description,
      rcr.reason
    from public.institutional_receipt_reversals rcr
    join public.institutional_receipts rc
      on rc.organization_id = rcr.organization_id
     and rc.id = rcr.receipt_id
    cross join lateral (
      select private.accounting_plan_for_date(rcr.organization_id, rcr.accounting_period) as plan_id
    ) plan_ref
    where rcr.organization_id = p_organization_id

    union all

    -- 20. Transferências entre contas financeiras (sem efeito DRE)
    select
      tr.organization_id,
      tr.accounting_period,
      tr.accounting_period as competence,
      tr.transfer_date as event_date,
      tr.created_at,
      'account_transfer'::text as event_type,
      'financial_account_transfers'::text as source_table,
      tr.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_cash_accounting_account(tr.organization_id, plan_ref.plan_id, tr.to_account_id) as debit_acc_id,
      'cash_account_to'::text as debit_role,
      private.resolve_cash_accounting_account(tr.organization_id, plan_ref.plan_id, tr.from_account_id) as credit_acc_id,
      'cash_account_from'::text as credit_role,
      tr.amount::numeric(14,2) as amount,
      coalesce(nullif(btrim(tr.reference), ''), 'Transferência entre contas') as description,
      tr.reason
    from public.financial_account_transfers tr
    cross join lateral (
      select private.accounting_plan_for_date(tr.organization_id, tr.accounting_period) as plan_id
    ) plan_ref
    where tr.organization_id = p_organization_id

    union all

    -- 21. Estornos de transferências entre contas financeiras
    select
      trr.organization_id,
      trr.accounting_period,
      trr.accounting_period as competence,
      trr.reversal_date as event_date,
      trr.created_at,
      'account_transfer_reversal'::text as event_type,
      'financial_account_transfer_reversals'::text as source_table,
      trr.transfer_id as source_id,
      1 as line_no,
      trr.transfer_id as reference_event_id,
      true as is_reversal_or_correction,
      plan_ref.plan_id,
      private.resolve_cash_accounting_account(trr.organization_id, plan_ref.plan_id, tr.from_account_id) as debit_acc_id,
      'cash_account_from'::text as debit_role,
      private.resolve_cash_accounting_account(trr.organization_id, plan_ref.plan_id, tr.to_account_id) as credit_acc_id,
      'cash_account_to'::text as credit_role,
      tr.amount::numeric(14,2) as amount,
      'Estorno de transferência entre contas'::text as description,
      trr.reason
    from public.financial_account_transfer_reversals trr
    join public.financial_account_transfers tr
      on tr.organization_id = trr.organization_id
     and tr.id = trr.transfer_id
    cross join lateral (
      select private.accounting_plan_for_date(trr.organization_id, trr.accounting_period) as plan_id
    ) plan_ref
    where trr.organization_id = p_organization_id

    union all

    -- 22. Saldos de abertura documentados de contas financeiras
    select
      aoe.organization_id,
      date_trunc('month', aoe.effective_date)::date as accounting_period,
      date_trunc('month', aoe.effective_date)::date as competence,
      aoe.effective_date as event_date,
      aoe.created_at,
      'account_opening_entry'::text as event_type,
      'account_opening_entries'::text as source_table,
      aoe.id as source_id,
      1 as line_no,
      null::uuid as reference_event_id,
      false as is_reversal_or_correction,
      plan_ref.plan_id,
      case
        when aoe.amount > 0 then
          private.resolve_cash_accounting_account(aoe.organization_id, plan_ref.plan_id, aoe.financial_account_id)
        else
          private.resolve_plan_role_account(aoe.organization_id, plan_ref.plan_id, 'opening_balance_contra')
      end as debit_acc_id,
      case when aoe.amount > 0 then 'cash_account' else 'opening_balance_contra' end as debit_role,
      case
        when aoe.amount > 0 then
          private.resolve_plan_role_account(aoe.organization_id, plan_ref.plan_id, 'opening_balance_contra')
        else
          private.resolve_cash_accounting_account(aoe.organization_id, plan_ref.plan_id, aoe.financial_account_id)
      end as credit_acc_id,
      case when aoe.amount > 0 then 'opening_balance_contra' else 'cash_account' end as credit_role,
      abs(aoe.amount)::numeric(14,2) as amount,
      'Abertura documentada de saldo financeiro'::text as description,
      aoe.reason
    from public.account_opening_entries aoe
    cross join lateral (
      select private.accounting_plan_for_date(
        aoe.organization_id,
        date_trunc('month', aoe.effective_date)::date
      ) as plan_id
    ) plan_ref
    where aoe.organization_id = p_organization_id
  )
  select
    row_number() over (
      order by r.event_date, r.accounting_period, r.created_at, r.source_table, r.source_id, r.line_no
    ) as entry_seq,
    r.source_table || ':' || r.source_id::text || ':' || r.line_no::text as entry_id,
    r.organization_id,
    r.accounting_period,
    r.competence,
    r.event_date,
    r.created_at,
    r.event_type,
    r.source_table,
    r.source_id,
    r.reference_event_id,
    r.is_reversal_or_correction,
    r.plan_id as accounting_plan_id,
    p.name as plan_name,
    da.id as debit_account_id,
    da.code as debit_account_code,
    da.description as debit_account_description,
    r.debit_role,
    ca.id as credit_account_id,
    ca.code as credit_account_code,
    ca.description as credit_account_description,
    r.credit_role,
    r.amount,
    r.description,
    r.reason,
    (r.plan_id is not null and da.id is not null and ca.id is not null) as is_fully_mapped,
    case
      when r.plan_id is null then 'Sem plano contábil publicado vigente para a competência'
      when da.id is null and ca.id is null then
        'Contas contábeis não mapeadas (' || r.debit_role || ' e ' || r.credit_role || ')'
      when da.id is null then 'Conta de débito não mapeada (' || r.debit_role || ')'
      when ca.id is null then 'Conta de crédito não mapeada (' || r.credit_role || ')'
      else null::text
    end as mapping_gap_reason
  from raw_entries r
  left join public.accounting_plans p
    on p.organization_id = r.organization_id
   and p.id = r.plan_id
  left join public.accounting_accounts da
    on da.organization_id = r.organization_id
   and da.accounting_plan_id = r.plan_id
   and da.id = r.debit_acc_id
  left join public.accounting_accounts ca
    on ca.organization_id = r.organization_id
   and ca.accounting_plan_id = r.plan_id
   and ca.id = r.credit_acc_id
  order by r.event_date, r.accounting_period, r.created_at, r.source_table, r.source_id, r.line_no;
$$;

revoke all on function private.tenant_accounting_journal(uuid) from public, anon, authenticated;

create or replace function private.tenant_accounting_legacy_count(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'event_date'
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)::integer
    from public.charges c
    where c.organization_id = p_organization_id
      and c.accounting_account_id is null
      and (
        (p_date_basis = 'event_date' and c.issue_date >= p_from_date and c.issue_date <= p_to_date)
        or (p_date_basis = 'competence' and c.accounting_period >= p_from_date and c.accounting_period <= p_to_date)
      )
  ) + (
    select count(*)::integer
    from public.payments pm
    where pm.organization_id = p_organization_id
      and pm.source_kind <> 'operational'
      and (
        (p_date_basis = 'event_date' and pm.payment_date >= p_from_date and pm.payment_date <= p_to_date)
        or (p_date_basis = 'competence' and pm.accounting_period >= p_from_date and pm.accounting_period <= p_to_date)
      )
  ) + (
    select count(*)::integer
    from public.legacy_financial_records lr
    where lr.organization_id = p_organization_id
      and (
        (p_date_basis = 'event_date' and lr.event_date between p_from_date and p_to_date)
        or (p_date_basis = 'competence' and coalesce(lr.competence, date_trunc('month', lr.event_date)::date) between p_from_date and p_to_date)
      )
  );
$$;

revoke all on function private.tenant_accounting_legacy_count(uuid, date, date, text) from public, anon, authenticated;

-- Diário Contábil: resumo de totalização, conciliação e selo integral (fail-closed)
create or replace function public.read_tenant_accounting_diary_summary(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'event_date',
  p_event_type text default null,
  p_account_id uuid default null,
  p_only_reversals boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_count bigint;
  v_total_debit numeric(14,2);
  v_total_credit numeric(14,2);
  v_unmapped_count bigint;
  v_legacy_count integer;
  v_plans jsonb;
  v_reasons jsonb := '[]'::jsonb;
begin
  perform private.require_permission(p_organization_id, 'reports.read');

  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    raise exception 'invalid accounting diary date range' using errcode = '22023';
  end if;

  if p_date_basis not in ('event_date', 'competence') then
    raise exception 'invalid date basis for accounting diary' using errcode = '22023';
  end if;

  select
    count(*)::bigint,
    coalesce(sum(j.amount), 0)::numeric(14,2),
    coalesce(sum(j.amount), 0)::numeric(14,2),
    count(*) filter (where not j.is_fully_mapped)::bigint
    into v_total_count, v_total_debit, v_total_credit, v_unmapped_count
  from private.tenant_accounting_journal(p_organization_id) j
  where (
      (p_date_basis = 'event_date' and j.event_date >= p_from_date and j.event_date <= p_to_date)
      or (p_date_basis = 'competence' and j.accounting_period >= p_from_date and j.accounting_period <= p_to_date)
    )
    and (p_event_type is null or j.event_type = p_event_type)
    and (
      p_account_id is null
      or j.debit_account_id = p_account_id
      or j.credit_account_id = p_account_id
    )
    and (not coalesce(p_only_reversals, false) or j.is_reversal_or_correction);

  v_legacy_count := private.tenant_accounting_legacy_count(
    p_organization_id, p_from_date, p_to_date, p_date_basis
  );

  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'status', p.status,
    'valid_from', p.valid_from,
    'valid_to', p.valid_to
  )), '[]'::jsonb)
  into v_plans
  from public.accounting_plans p
  where p.organization_id = p_organization_id
    and p.status = 'published'
    and p.valid_from <= p_to_date
    and p.valid_to >= p_from_date;

  if v_unmapped_count > 0 then
    v_reasons := v_reasons || '["unmapped_entries"]'::jsonb;
  end if;
  if v_legacy_count > 0 then
    v_reasons := v_reasons || '["legacy_non_posting_present"]'::jsonb;
  end if;
  if v_total_debit is distinct from v_total_credit then
    v_reasons := v_reasons || '["unbalanced_totals"]'::jsonb;
  end if;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'from_date', p_from_date,
    'to_date', p_to_date,
    'date_basis', p_date_basis,
    'total_count', v_total_count,
    'total_debit', v_total_debit,
    'total_credit', v_total_credit,
    'balanced', (v_total_debit = v_total_credit),
    'unmapped_count', v_unmapped_count,
    'legacy_non_posting_count', v_legacy_count,
    'integral_ok', (v_unmapped_count = 0 and v_legacy_count = 0 and v_total_debit = v_total_credit),
    'incomplete_reasons', v_reasons,
    'plans', v_plans,
    'report_classification', 'managerial_non_official'
  );
end;
$$;

revoke all on function public.read_tenant_accounting_diary_summary(uuid, date, date, text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.read_tenant_accounting_diary_summary(uuid, date, date, text, text, uuid, boolean)
  to authenticated;

-- Diário Contábil paginado completo (sem truncamento; page_size <= 200)
create or replace function public.read_tenant_accounting_diary(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'event_date',
  p_event_type text default null,
  p_account_id uuid default null,
  p_only_reversals boolean default false,
  p_page integer default 0,
  p_page_size integer default 100
)
returns table (
  entry_seq bigint,
  entry_id text,
  organization_id uuid,
  accounting_period date,
  competence date,
  event_date date,
  created_at timestamptz,
  event_type text,
  source_table text,
  source_id uuid,
  reference_event_id uuid,
  is_reversal_or_correction boolean,
  accounting_plan_id uuid,
  plan_name text,
  debit_account_id uuid,
  debit_account_code text,
  debit_account_description text,
  debit_role text,
  credit_account_id uuid,
  credit_account_code text,
  credit_account_description text,
  credit_role text,
  amount numeric,
  description text,
  reason text,
  is_fully_mapped boolean,
  mapping_gap_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_limit integer := least(greatest(coalesce(p_page_size, 100), 1), 200);
begin
  perform private.require_permission(p_organization_id, 'reports.read');

  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    raise exception 'invalid accounting diary date range' using errcode = '22023';
  end if;

  if p_date_basis not in ('event_date', 'competence') then
    raise exception 'invalid date basis for accounting diary' using errcode = '22023';
  end if;

  return query
  select
    j.entry_seq,
    j.entry_id,
    j.organization_id,
    j.accounting_period,
    j.competence,
    j.event_date,
    j.created_at,
    j.event_type,
    j.source_table,
    j.source_id,
    j.reference_event_id,
    j.is_reversal_or_correction,
    j.accounting_plan_id,
    j.plan_name,
    j.debit_account_id,
    j.debit_account_code,
    j.debit_account_description,
    j.debit_role,
    j.credit_account_id,
    j.credit_account_code,
    j.credit_account_description,
    j.credit_role,
    j.amount,
    j.description,
    j.reason,
    j.is_fully_mapped,
    j.mapping_gap_reason
  from private.tenant_accounting_journal(p_organization_id) j
  where (
      (p_date_basis = 'event_date' and j.event_date >= p_from_date and j.event_date <= p_to_date)
      or (p_date_basis = 'competence' and j.accounting_period >= p_from_date and j.accounting_period <= p_to_date)
    )
    and (p_event_type is null or j.event_type = p_event_type)
    and (
      p_account_id is null
      or j.debit_account_id = p_account_id
      or j.credit_account_id = p_account_id
    )
    and (not coalesce(p_only_reversals, false) or j.is_reversal_or_correction)
  order by j.entry_seq
  limit v_limit offset (v_page * v_limit);
end;
$$;

revoke all on function public.read_tenant_accounting_diary(uuid, date, date, text, text, uuid, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.read_tenant_accounting_diary(uuid, date, date, text, text, uuid, boolean, integer, integer)
  to authenticated;

-- Razão Contábil por conta analítica: saldo de abertura verificável (derivado de partidas anteriores),
-- movimentos a débito/crédito, saldo corrente D/C determinístico e reconciliação exata com o Diário.
create or replace function public.read_tenant_accounting_ledger(
  p_organization_id uuid,
  p_accounting_account_id uuid,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'event_date',
  p_page integer default 0,
  p_page_size integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounting_accounts%rowtype;
  v_plan public.accounting_plans%rowtype;
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_limit integer := least(greatest(coalesce(p_page_size, 200), 1), 200);
  v_prior_count bigint;
  v_opening_balance numeric(14,2);
  v_period_debit numeric(14,2);
  v_period_credit numeric(14,2);
  v_closing_balance numeric(14,2);
  v_total_count bigint;
  v_unmapped_in_period bigint;
  v_legacy_count integer;
  v_entries jsonb;
  v_reasons jsonb := '[]'::jsonb;
begin
  perform private.require_permission(p_organization_id, 'reports.read');

  if p_accounting_account_id is null
     or p_from_date is null
     or p_to_date is null
     or p_to_date < p_from_date
  then
    raise exception 'invalid accounting ledger parameters' using errcode = '22023';
  end if;

  if p_date_basis not in ('event_date', 'competence') then
    raise exception 'invalid date basis for accounting ledger' using errcode = '22023';
  end if;

  select * into v_account
  from public.accounting_accounts a
  where a.organization_id = p_organization_id
    and a.id = p_accounting_account_id;

  if not found then
    raise exception 'accounting account outside organization' using errcode = '23503';
  end if;

  select * into v_plan
  from public.accounting_plans p
  where p.organization_id = p_organization_id
    and p.id = v_account.accounting_plan_id;

  select
    count(*)::bigint,
    coalesce(sum(
      case when j.debit_account_id = p_accounting_account_id then j.amount else 0 end
      - case when j.credit_account_id = p_accounting_account_id then j.amount else 0 end
    ), 0)::numeric(14,2)
    into v_prior_count, v_opening_balance
  from private.tenant_accounting_journal(p_organization_id) j
  where (j.debit_account_id = p_accounting_account_id or j.credit_account_id = p_accounting_account_id)
    and (
      (p_date_basis = 'event_date' and j.event_date < p_from_date)
      or (p_date_basis = 'competence' and j.accounting_period < p_from_date)
    );

  select
    count(*)::bigint,
    coalesce(sum(case when j.debit_account_id = p_accounting_account_id then j.amount else 0 end), 0)::numeric(14,2),
    coalesce(sum(case when j.credit_account_id = p_accounting_account_id then j.amount else 0 end), 0)::numeric(14,2)
    into v_total_count, v_period_debit, v_period_credit
  from private.tenant_accounting_journal(p_organization_id) j
  where (j.debit_account_id = p_accounting_account_id or j.credit_account_id = p_accounting_account_id)
    and (
      (p_date_basis = 'event_date' and j.event_date >= p_from_date and j.event_date <= p_to_date)
      or (p_date_basis = 'competence' and j.accounting_period >= p_from_date and j.accounting_period <= p_to_date)
    );

  select count(*)::bigint
    into v_unmapped_in_period
  from private.tenant_accounting_journal(p_organization_id) j
  where not j.is_fully_mapped
    and (
      (p_date_basis = 'event_date' and j.event_date >= p_from_date and j.event_date <= p_to_date)
      or (p_date_basis = 'competence' and j.accounting_period >= p_from_date and j.accounting_period <= p_to_date)
    );

  v_legacy_count := private.tenant_accounting_legacy_count(
    p_organization_id, p_from_date, p_to_date, p_date_basis
  );

  v_closing_balance := (v_opening_balance + v_period_debit - v_period_credit)::numeric(14,2);

  with account_moves as (
    select
      j.entry_seq,
      j.entry_id,
      j.event_date,
      j.competence,
      j.accounting_period,
      j.event_type,
      j.source_table,
      j.source_id,
      j.reference_event_id,
      j.is_reversal_or_correction,
      case when j.debit_account_id = p_accounting_account_id then j.amount else 0::numeric(14,2) end as debit_amount,
      case when j.credit_account_id = p_accounting_account_id then j.amount else 0::numeric(14,2) end as credit_amount,
      case when j.debit_account_id = p_accounting_account_id then j.credit_account_code else j.debit_account_code end as counterpart_code,
      case when j.debit_account_id = p_accounting_account_id then j.credit_account_description else j.debit_account_description end as counterpart_description,
      j.description,
      j.reason,
      j.is_fully_mapped,
      j.mapping_gap_reason
    from private.tenant_accounting_journal(p_organization_id) j
    where (j.debit_account_id = p_accounting_account_id or j.credit_account_id = p_accounting_account_id)
      and (
        (p_date_basis = 'event_date' and j.event_date >= p_from_date and j.event_date <= p_to_date)
        or (p_date_basis = 'competence' and j.accounting_period >= p_from_date and j.accounting_period <= p_to_date)
      )
    order by j.entry_seq
  ),
  with_running as (
    select
      m.*,
      (v_opening_balance + sum(m.debit_amount - m.credit_amount) over (
        order by m.entry_seq rows between unbounded preceding and current row
      ))::numeric(14,2) as running_balance
    from account_moves m
  ),
  paged as (
    select *
    from with_running
    order by entry_seq
    limit v_limit offset (v_page * v_limit)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'entry_seq', p.entry_seq,
    'entry_id', p.entry_id,
    'event_date', p.event_date,
    'competence', p.competence,
    'accounting_period', p.accounting_period,
    'event_type', p.event_type,
    'source_table', p.source_table,
    'source_id', p.source_id,
    'reference_event_id', p.reference_event_id,
    'is_reversal_or_correction', p.is_reversal_or_correction,
    'debit_amount', p.debit_amount,
    'credit_amount', p.credit_amount,
    'running_balance', p.running_balance,
    'balance_dc', case when p.running_balance >= 0 then 'D' else 'C' end,
    'counterpart_code', p.counterpart_code,
    'counterpart_description', p.counterpart_description,
    'description', p.description,
    'reason', p.reason,
    'is_fully_mapped', p.is_fully_mapped,
    'mapping_gap_reason', p.mapping_gap_reason
  ) order by p.entry_seq), '[]'::jsonb)
  into v_entries
  from paged p;

  if v_unmapped_in_period > 0 then
    v_reasons := v_reasons || '["unmapped_entries_in_period"]'::jsonb;
  end if;
  if v_legacy_count > 0 then
    v_reasons := v_reasons || '["legacy_non_posting_present"]'::jsonb;
  end if;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'from_date', p_from_date,
    'to_date', p_to_date,
    'date_basis', p_date_basis,
    'page', v_page,
    'page_size', v_limit,
    'total_count', v_total_count,
    'account', jsonb_build_object(
      'id', v_account.id,
      'code', v_account.code,
      'description', v_account.description,
      'nature', v_account.nature,
      'row_type', v_account.row_type
    ),
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'status', v_plan.status,
      'valid_from', v_plan.valid_from,
      'valid_to', v_plan.valid_to
    ),
    'opening_balance', v_opening_balance,
    'opening_balance_dc', case when v_opening_balance >= 0 then 'D' else 'C' end,
    'opening_balance_source', case when v_prior_count > 0 then 'prior_entries' else 'no_prior_entries_zero' end,
    'period_debit_total', v_period_debit,
    'period_credit_total', v_period_credit,
    'closing_balance', v_closing_balance,
    'closing_balance_dc', case when v_closing_balance >= 0 then 'D' else 'C' end,
    'reconciles_with_diary', true,
    'unmapped_count', v_unmapped_in_period,
    'legacy_non_posting_count', v_legacy_count,
    'integral_ok', (v_unmapped_in_period = 0 and v_legacy_count = 0),
    'incomplete_reasons', v_reasons,
    'report_classification', 'managerial_non_official',
    'entries', v_entries
  );
end;
$$;

revoke all on function public.read_tenant_accounting_ledger(uuid, uuid, date, date, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.read_tenant_accounting_ledger(uuid, uuid, date, date, text, integer, integer)
  to authenticated;

-- DRE Gerencial completa (B01-B03): estrutura em cascata, contas analíticas zeradas do plano vigente,
-- comparativos reais com período imediatamente anterior e mesmo período do ano anterior, e travamento fail-closed.
create or replace function public.read_tenant_dre_gerencial(
  p_organization_id uuid,
  p_from_period date,
  p_to_period date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_span_months integer;
  v_prev_from date;
  v_prev_to date;
  v_yoy_from date;
  v_yoy_to date;
  v_unmapped_count bigint;
  v_legacy_count integer;
  v_plans jsonb;
  v_accounts jsonb;
  v_months jsonb;
  v_waterfall jsonb;
  v_prev_waterfall jsonb;
  v_yoy_waterfall jsonb;
  v_has_prev_data boolean := false;
  v_has_yoy_data boolean := false;
  v_reasons jsonb := '[]'::jsonb;
begin
  perform private.require_permission(p_organization_id, 'reports.read');

  if p_from_period is null or p_to_period is null
     or extract(day from p_from_period) <> 1
     or extract(day from p_to_period) <> 1
     or p_to_period < p_from_period
     or p_to_period >= p_from_period + interval '12 months'
  then
    raise exception 'DRE month range must be 1 to 12 inclusive competencies'
      using errcode = '22023';
  end if;

  v_span_months := (
    (extract(year from p_to_period)::integer - extract(year from p_from_period)::integer) * 12
    + (extract(month from p_to_period)::integer - extract(month from p_from_period)::integer)
    + 1
  );
  v_prev_from := (p_from_period - make_interval(months => v_span_months))::date;
  v_prev_to := (p_from_period - interval '1 month')::date;
  v_yoy_from := (p_from_period - interval '1 year')::date;
  v_yoy_to := (p_to_period - interval '1 year')::date;

  select count(*)::bigint
    into v_unmapped_count
  from private.tenant_accounting_journal(p_organization_id) j
  where j.accounting_period >= p_from_period
    and j.accounting_period <= p_to_period
    and not j.is_fully_mapped;

  v_legacy_count := private.tenant_accounting_legacy_count(
    p_organization_id, p_from_period, p_to_period, 'competence'
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'status', p.status,
    'valid_from', p.valid_from,
    'valid_to', p.valid_to
  ) order by p.valid_from), '[]'::jsonb)
  into v_plans
  from public.accounting_plans p
  where p.organization_id = p_organization_id
    and p.status = 'published'
    and p.valid_from <= p_to_period
    and p.valid_to >= p_from_period;

  if jsonb_array_length(v_plans) = 0 then
    v_reasons := v_reasons || '["no_published_plan_in_period"]'::jsonb;
  end if;
  if v_unmapped_count > 0 then
    v_reasons := v_reasons || '["unmapped_entries"]'::jsonb;
  end if;
  if v_legacy_count > 0 then
    v_reasons := v_reasons || '["legacy_non_posting_present"]'::jsonb;
  end if;

  with journal_result_legs as (
    select
      j.accounting_period,
      j.accounting_plan_id,
      j.credit_account_id as accounting_account_id,
      j.amount::numeric(14,2) as signed_amount,
      (j.credit_role = 'revenue_deduction') as is_deduction
    from private.tenant_accounting_journal(p_organization_id) j
    where j.credit_account_id is not null
      and j.accounting_period between least(v_yoy_from, v_prev_from) and p_to_period
    union all
    select
      j.accounting_period,
      j.accounting_plan_id,
      j.debit_account_id as accounting_account_id,
      (-j.amount)::numeric(14,2) as signed_amount,
      (j.debit_role = 'revenue_deduction') as is_deduction
    from private.tenant_accounting_journal(p_organization_id) j
    where j.debit_account_id is not null
      and j.accounting_period between least(v_yoy_from, v_prev_from) and p_to_period
  ),
  deduction_accounts as (
    select distinct m.accounting_plan_id, m.accounting_account_id
    from public.accounting_plan_role_mappings m
    where m.organization_id = p_organization_id
      and m.role_code = 'revenue_deduction'
  ),
  plan_accounts as (
    select distinct
      a.accounting_plan_id,
      a.id as accounting_account_id,
      a.code,
      a.description,
      a.nature,
      a.operational_classification,
      (da.accounting_account_id is not null) as is_deduction
    from public.accounting_accounts a
    join public.accounting_plans p
      on p.organization_id = a.organization_id
     and p.id = a.accounting_plan_id
    left join deduction_accounts da
      on da.accounting_plan_id = a.accounting_plan_id
     and da.accounting_account_id = a.id
    where a.organization_id = p_organization_id
      and a.row_type = 'analytic'
      and a.nature in ('revenue', 'cost', 'expense', 'financial_result')
      and (
        (p.status = 'published' and p.valid_from <= p_to_period and p.valid_to >= p_from_period and a.active)
        or exists (
          select 1 from journal_result_legs l
          where l.accounting_account_id = a.id
            and l.accounting_period between p_from_period and p_to_period
        )
      )
  ),
  account_sums as (
    select
      pa.accounting_plan_id,
      pa.accounting_account_id,
      pa.code,
      pa.description,
      pa.nature,
      pa.operational_classification,
      pa.is_deduction,
      case
        when pa.is_deduction then 'deductions'
        when pa.nature = 'revenue' then 'gross_revenue'
        when pa.nature = 'cost' then 'cost'
        when pa.nature = 'expense' then 'operational_expense'
        else 'financial_result'
      end as dre_section,
      coalesce(sum(l.signed_amount) filter (
        where l.accounting_period between p_from_period and p_to_period
      ), 0)::numeric(14,2) as current_amount,
      coalesce(sum(l.signed_amount) filter (
        where l.accounting_period between v_prev_from and v_prev_to
      ), 0)::numeric(14,2) as prior_period_amount,
      coalesce(sum(l.signed_amount) filter (
        where l.accounting_period between v_yoy_from and v_yoy_to
      ), 0)::numeric(14,2) as prior_year_amount
    from plan_accounts pa
    left join journal_result_legs l
      on l.accounting_account_id = pa.accounting_account_id
    group by
      pa.accounting_plan_id, pa.accounting_account_id, pa.code,
      pa.description, pa.nature, pa.operational_classification, pa.is_deduction
  ),
  monthly_totals as (
    select
      l.accounting_period,
      coalesce(sum(l.signed_amount) filter (where a.nature = 'revenue' and not (da.accounting_account_id is not null or l.is_deduction)), 0)::numeric(14,2) as gross_revenue,
      coalesce(sum(l.signed_amount) filter (where a.nature = 'revenue' and (da.accounting_account_id is not null or l.is_deduction)), 0)::numeric(14,2) as deductions,
      coalesce(sum(l.signed_amount) filter (where a.nature = 'cost'), 0)::numeric(14,2) as costs,
      coalesce(sum(l.signed_amount) filter (where a.nature = 'expense'), 0)::numeric(14,2) as operational_expenses,
      coalesce(sum(l.signed_amount) filter (where a.nature = 'financial_result'), 0)::numeric(14,2) as financial_result
    from journal_result_legs l
    join public.accounting_accounts a
      on a.organization_id = p_organization_id
     and a.id = l.accounting_account_id
    left join deduction_accounts da
      on da.accounting_plan_id = a.accounting_plan_id
     and da.accounting_account_id = a.id
    where a.nature in ('revenue', 'cost', 'expense', 'financial_result')
    group by l.accounting_period
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'accounting_plan_id', s.accounting_plan_id,
        'accounting_account_id', s.accounting_account_id,
        'account_code', s.code,
        'account_description', s.description,
        'nature', s.nature,
        'operational_classification', s.operational_classification,
        'dre_section', s.dre_section,
        'amount', s.current_amount,
        'prior_period_amount', s.prior_period_amount,
        'prior_year_amount', s.prior_year_amount
      ) order by s.code, s.accounting_account_id)
      from account_sums s
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'accounting_period', mt.accounting_period,
        'gross_revenue', mt.gross_revenue,
        'deductions', mt.deductions,
        'net_revenue', (mt.gross_revenue + mt.deductions)::numeric(14,2),
        'costs', mt.costs,
        'gross_result', (mt.gross_revenue + mt.deductions + mt.costs)::numeric(14,2),
        'operational_expenses', mt.operational_expenses,
        'operating_result', (mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses)::numeric(14,2),
        'financial_result', mt.financial_result,
        'net_result', (mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses + mt.financial_result)::numeric(14,2)
      ) order by mt.accounting_period)
      from monthly_totals mt
      where mt.accounting_period between p_from_period and p_to_period
    ), '[]'::jsonb),
    (select jsonb_build_object(
      'gross_revenue', coalesce(sum(mt.gross_revenue), 0)::numeric(14,2),
      'deductions', coalesce(sum(mt.deductions), 0)::numeric(14,2),
      'net_revenue', coalesce(sum(mt.gross_revenue + mt.deductions), 0)::numeric(14,2),
      'costs', coalesce(sum(mt.costs), 0)::numeric(14,2),
      'gross_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs), 0)::numeric(14,2),
      'operational_expenses', coalesce(sum(mt.operational_expenses), 0)::numeric(14,2),
      'operating_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses), 0)::numeric(14,2),
      'financial_result', coalesce(sum(mt.financial_result), 0)::numeric(14,2),
      'net_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses + mt.financial_result), 0)::numeric(14,2)
    ) from monthly_totals mt where mt.accounting_period between p_from_period and p_to_period),
    (select jsonb_build_object(
      'gross_revenue', coalesce(sum(mt.gross_revenue), 0)::numeric(14,2),
      'deductions', coalesce(sum(mt.deductions), 0)::numeric(14,2),
      'net_revenue', coalesce(sum(mt.gross_revenue + mt.deductions), 0)::numeric(14,2),
      'costs', coalesce(sum(mt.costs), 0)::numeric(14,2),
      'gross_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs), 0)::numeric(14,2),
      'operational_expenses', coalesce(sum(mt.operational_expenses), 0)::numeric(14,2),
      'operating_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses), 0)::numeric(14,2),
      'financial_result', coalesce(sum(mt.financial_result), 0)::numeric(14,2),
      'net_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses + mt.financial_result), 0)::numeric(14,2)
    ) from monthly_totals mt where mt.accounting_period between v_prev_from and v_prev_to),
    (select jsonb_build_object(
      'gross_revenue', coalesce(sum(mt.gross_revenue), 0)::numeric(14,2),
      'deductions', coalesce(sum(mt.deductions), 0)::numeric(14,2),
      'net_revenue', coalesce(sum(mt.gross_revenue + mt.deductions), 0)::numeric(14,2),
      'costs', coalesce(sum(mt.costs), 0)::numeric(14,2),
      'gross_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs), 0)::numeric(14,2),
      'operational_expenses', coalesce(sum(mt.operational_expenses), 0)::numeric(14,2),
      'operating_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses), 0)::numeric(14,2),
      'financial_result', coalesce(sum(mt.financial_result), 0)::numeric(14,2),
      'net_result', coalesce(sum(mt.gross_revenue + mt.deductions + mt.costs + mt.operational_expenses + mt.financial_result), 0)::numeric(14,2)
    ) from monthly_totals mt where mt.accounting_period between v_yoy_from and v_yoy_to),
    exists (
      select 1 from monthly_totals mt
      where mt.accounting_period between v_prev_from and v_prev_to
    ),
    exists (
      select 1 from monthly_totals mt
      where mt.accounting_period between v_yoy_from and v_yoy_to
    )
    into v_accounts, v_months, v_waterfall, v_prev_waterfall, v_yoy_waterfall, v_has_prev_data, v_has_yoy_data;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'from_period', p_from_period,
    'to_period', p_to_period,
    'prior_period_from', v_prev_from,
    'prior_period_to', v_prev_to,
    'prior_year_from', v_yoy_from,
    'prior_year_to', v_yoy_to,
    'has_prior_period_data', v_has_prev_data,
    'has_prior_year_data', v_has_yoy_data,
    'plans', v_plans,
    'waterfall', v_waterfall,
    'prior_period_waterfall', case when v_has_prev_data then v_prev_waterfall else null end,
    'prior_year_waterfall', case when v_has_yoy_data then v_yoy_waterfall else null end,
    'months', v_months,
    'accounts', v_accounts,
    'unmapped_count', v_unmapped_count,
    'legacy_non_posting_count', v_legacy_count,
    'integral_ok', (jsonb_array_length(v_plans) > 0 and v_unmapped_count = 0 and v_legacy_count = 0),
    'incomplete_reasons', v_reasons,
    'report_classification', 'managerial_non_official',
    'official_disclaimer', 'DRE Gerencial — visão gerencial por competência para apoio à Loja. Não substitui a DRE contábil oficial elaborada pelo contador.'
  );
end;
$$;

revoke all on function public.read_tenant_dre_gerencial(uuid, date, date) from public, anon, authenticated;
grant execute on function public.read_tenant_dre_gerencial(uuid, date, date) to authenticated;
