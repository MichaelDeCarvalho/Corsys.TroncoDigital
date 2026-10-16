-- Corsys Tesouraria
-- Migration 003: derived financial views

create or replace view public.v_active_allocations
with (security_invoker = true)
as
select a.*
from public.receivable_allocations a
left join public.allocation_reversals ar on ar.allocation_id = a.id
left join public.payment_reversals pr on pr.payment_id = a.payment_id
left join public.member_credit_reversals cr on cr.member_credit_id = a.member_credit_id
where ar.id is null
  and pr.id is null
  and cr.id is null;

create or replace view public.v_charge_balances
with (security_invoker = true)
as
with adjustment_totals as (
  select
    charge_id,
    coalesce(sum(case when direction = 'increase' then amount else 0 end), 0)::numeric(14,2) as increases,
    coalesce(sum(case when direction = 'decrease' then amount else 0 end), 0)::numeric(14,2) as decreases
  from public.charge_adjustments
  group by charge_id
),
allocation_totals as (
  select
    charge_id,
    coalesce(sum(amount), 0)::numeric(14,2) as allocated_amount
  from public.v_active_allocations
  group by charge_id
)
select
  c.id as charge_id,
  c.organization_id,
  c.member_id,
  c.category_id,
  c.description,
  c.reference,
  c.competence,
  c.issue_date,
  c.due_date,
  c.accounting_period,
  c.original_amount,
  coalesce(a.increases, 0)::numeric(14,2) as adjustment_increases,
  coalesce(a.decreases, 0)::numeric(14,2) as adjustment_decreases,
  (c.original_amount + coalesce(a.increases, 0) - coalesce(a.decreases, 0))::numeric(14,2) as effective_amount,
  coalesce(al.allocated_amount, 0)::numeric(14,2) as allocated_amount,
  case
    when cc.id is not null then 0::numeric(14,2)
    else (c.original_amount + coalesce(a.increases, 0) - coalesce(a.decreases, 0) - coalesce(al.allocated_amount, 0))::numeric(14,2)
  end as open_amount,
  (cc.id is not null) as is_cancelled,
  case
    when cc.id is not null then 'cancelled'
    when (c.original_amount + coalesce(a.increases, 0) - coalesce(a.decreases, 0) - coalesce(al.allocated_amount, 0)) = 0 then 'paid'
    when coalesce(al.allocated_amount, 0) > 0 then 'partially_paid'
    else 'open'
  end as settlement_status,
  (
    (c.original_amount + coalesce(a.increases, 0) - coalesce(a.decreases, 0)) >= 0
    and coalesce(al.allocated_amount, 0) <= (c.original_amount + coalesce(a.increases, 0) - coalesce(a.decreases, 0))
  ) as integrity_ok
from public.charges c
left join adjustment_totals a on a.charge_id = c.id
left join allocation_totals al on al.charge_id = c.id
left join public.charge_cancellations cc on cc.charge_id = c.id;

create or replace view public.v_payment_balances
with (security_invoker = true)
as
with allocation_totals as (
  select
    payment_id,
    coalesce(sum(amount), 0)::numeric(14,2) as allocated_amount
  from public.v_active_allocations
  where payment_id is not null
  group by payment_id
)
select
  p.id as payment_id,
  p.organization_id,
  p.member_id,
  p.payment_date,
  p.accounting_period,
  p.amount,
  p.source_kind,
  p.financial_account_id,
  coalesce(a.allocated_amount, 0)::numeric(14,2) as allocated_amount,
  case
    when pr.id is not null then 0::numeric(14,2)
    else (p.amount - coalesce(a.allocated_amount, 0))::numeric(14,2)
  end as available_amount,
  (pr.id is not null) as is_reversed,
  (coalesce(a.allocated_amount, 0) <= p.amount) as integrity_ok
from public.payments p
left join allocation_totals a on a.payment_id = p.id
left join public.payment_reversals pr on pr.payment_id = p.id;

create or replace view public.v_member_credit_balances
with (security_invoker = true)
as
with allocation_totals as (
  select
    member_credit_id,
    coalesce(sum(amount), 0)::numeric(14,2) as allocated_amount
  from public.v_active_allocations
  where member_credit_id is not null
  group by member_credit_id
)
select
  c.id as member_credit_id,
  c.organization_id,
  c.member_id,
  c.amount,
  coalesce(a.allocated_amount, 0)::numeric(14,2) as allocated_amount,
  case
    when cr.id is not null then 0::numeric(14,2)
    else (c.amount - coalesce(a.allocated_amount, 0))::numeric(14,2)
  end as available_amount,
  (cr.id is not null) as is_reversed,
  (coalesce(a.allocated_amount, 0) <= c.amount) as integrity_ok
from public.member_credits c
left join allocation_totals a on a.member_credit_id = c.id
left join public.member_credit_reversals cr on cr.member_credit_id = c.id;

create or replace view public.v_member_financial_position
with (security_invoker = true)
as
with receivables as (
  select
    organization_id,
    member_id,
    coalesce(sum(open_amount), 0)::numeric(14,2) as open_receivables,
    bool_and(integrity_ok) as integrity_ok
  from public.v_charge_balances
  group by organization_id, member_id
),
payment_credits as (
  select
    organization_id,
    member_id,
    coalesce(sum(available_amount), 0)::numeric(14,2) as available_payment_credit,
    bool_and(integrity_ok) as integrity_ok
  from public.v_payment_balances
  group by organization_id, member_id
),
other_credits as (
  select
    organization_id,
    member_id,
    coalesce(sum(available_amount), 0)::numeric(14,2) as available_member_credit,
    bool_and(integrity_ok) as integrity_ok
  from public.v_member_credit_balances
  group by organization_id, member_id
)
select
  m.organization_id,
  m.id as member_id,
  coalesce(r.open_receivables, 0)::numeric(14,2) as open_receivables,
  coalesce(p.available_payment_credit, 0)::numeric(14,2) as available_payment_credit,
  coalesce(c.available_member_credit, 0)::numeric(14,2) as available_member_credit,
  (
    coalesce(p.available_payment_credit, 0)
    + coalesce(c.available_member_credit, 0)
  )::numeric(14,2) as available_credit,
  (
    coalesce(r.open_receivables, 0)
    - coalesce(p.available_payment_credit, 0)
    - coalesce(c.available_member_credit, 0)
  )::numeric(14,2) as net_position,
  (
    coalesce(r.integrity_ok, true)
    and coalesce(p.integrity_ok, true)
    and coalesce(c.integrity_ok, true)
  ) as integrity_ok
from public.members m
left join receivables r
  on r.organization_id = m.organization_id and r.member_id = m.id
left join payment_credits p
  on p.organization_id = m.organization_id and p.member_id = m.id
left join other_credits c
  on c.organization_id = m.organization_id and c.member_id = m.id;

create or replace view public.v_member_statement
with (security_invoker = true)
as
with charge_effective as (
  select charge_id, effective_amount
  from public.v_charge_balances
),
events as (
  select
    c.organization_id,
    c.member_id,
    c.created_at as event_at,
    10 as event_order,
    'charge'::text as event_type,
    c.id as record_id,
    c.category_id,
    c.description,
    c.reference,
    c.competence,
    c.due_date,
    c.original_amount::numeric(14,2) as debit,
    0::numeric(14,2) as credit,
    c.created_by as actor_user_id
  from public.charges c

  union all

  select
    a.organization_id,
    a.member_id,
    a.created_at,
    20,
    'charge_adjustment',
    a.id,
    c.category_id,
    a.reason,
    c.reference,
    c.competence,
    c.due_date,
    case when a.direction = 'increase' then a.amount else 0 end::numeric(14,2),
    case when a.direction = 'decrease' then a.amount else 0 end::numeric(14,2),
    a.created_by
  from public.charge_adjustments a
  join public.charges c on c.id = a.charge_id

  union all

  select
    cc.organization_id,
    cc.member_id,
    cc.created_at,
    30,
    'charge_cancellation',
    cc.id,
    c.category_id,
    cc.reason,
    c.reference,
    c.competence,
    c.due_date,
    0::numeric(14,2),
    ce.effective_amount::numeric(14,2),
    cc.created_by
  from public.charge_cancellations cc
  join public.charges c on c.id = cc.charge_id
  join charge_effective ce on ce.charge_id = c.id

  union all

  select
    p.organization_id,
    p.member_id,
    p.created_at,
    40,
    'payment',
    p.id,
    null::uuid,
    coalesce(p.notes, 'Pagamento'),
    p.reference,
    p.accounting_period,
    null::date,
    0::numeric(14,2),
    p.amount::numeric(14,2),
    p.created_by
  from public.payments p

  union all

  select
    pr.organization_id,
    pr.member_id,
    pr.created_at,
    50,
    'payment_reversal',
    pr.id,
    null::uuid,
    pr.reason,
    p.reference,
    pr.accounting_period,
    null::date,
    p.amount::numeric(14,2),
    0::numeric(14,2),
    pr.created_by
  from public.payment_reversals pr
  join public.payments p on p.id = pr.payment_id

  union all

  select
    c.organization_id,
    c.member_id,
    c.created_at,
    60,
    'member_credit',
    c.id,
    null::uuid,
    c.reason,
    null::text,
    c.accounting_period,
    null::date,
    0::numeric(14,2),
    c.amount::numeric(14,2),
    c.created_by
  from public.member_credits c

  union all

  select
    cr.organization_id,
    cr.member_id,
    cr.created_at,
    70,
    'member_credit_reversal',
    cr.id,
    null::uuid,
    cr.reason,
    null::text,
    cr.accounting_period,
    null::date,
    c.amount::numeric(14,2),
    0::numeric(14,2),
    cr.created_by
  from public.member_credit_reversals cr
  join public.member_credits c on c.id = cr.member_credit_id
)
select
  e.*,
  sum(e.debit - e.credit) over (
    partition by e.organization_id, e.member_id
    order by e.event_at, e.event_order, e.record_id
    rows between unbounded preceding and current row
  )::numeric(14,2) as running_balance
from events e;

-- Saldo parcial de contas: abertura + pagamentos operacionais do núcleo de integrantes.
-- A Fase 2 ampliará esta view com receitas, despesas e transferências institucionais.
create or replace view public.v_account_member_inflows
with (security_invoker = true)
as
select
  o.organization_id,
  o.financial_account_id,
  o.effective_date as movement_date,
  o.amount::numeric(14,2) as amount,
  'opening'::text as movement_type,
  o.id as source_id
from public.account_opening_entries o

union all

select
  p.organization_id,
  p.financial_account_id,
  p.payment_date,
  case when pr.id is null then p.amount else 0::numeric end::numeric(14,2),
  'member_payment'::text,
  p.id
from public.payments p
left join public.payment_reversals pr on pr.payment_id = p.id
where p.source_kind = 'operational';

create or replace view public.v_account_member_inflow_balances
with (security_invoker = true)
as
select
  organization_id,
  financial_account_id,
  sum(amount)::numeric(14,2) as partial_balance
from public.v_account_member_inflows
group by organization_id, financial_account_id;


create or replace view public.v_member_financial_reconciliation
with (security_invoker = true)
as
with statement_end as (
  select distinct on (organization_id, member_id)
    organization_id,
    member_id,
    running_balance
  from public.v_member_statement
  order by organization_id, member_id, event_at desc, event_order desc, record_id desc
)
select
  p.organization_id,
  p.member_id,
  p.net_position,
  coalesce(s.running_balance, 0)::numeric(14,2) as statement_balance,
  (p.net_position = coalesce(s.running_balance, 0)) as reconciled,
  p.integrity_ok
from public.v_member_financial_position p
left join statement_end s
  on s.organization_id = p.organization_id
 and s.member_id = p.member_id;
