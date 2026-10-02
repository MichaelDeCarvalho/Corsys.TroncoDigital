-- Corsys Tronco Digital
-- Migration 012: post-V31 permissions, views and RLS
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

insert into public.permissions(code, description) values
  ('accounting.manage', 'Gerenciar planos e mapeamentos contábeis'),
  ('institutional.manage', 'Gerenciar contas a pagar/receber e liquidações institucionais'),
  ('reconciliation.manage', 'Gerenciar conciliação bancária'),
  ('budgets.manage', 'Gerenciar orçamentos'),
  ('approvals.manage', 'Gerenciar políticas de aprovação'),
  ('approvals.review', 'Aprovar ou rejeitar despesas'),
  ('imports.manage', 'Gerenciar importações'),
  ('privacy.manage', 'Gerenciar solicitações de privacidade'),
  ('communications.manage', 'Gerenciar comunicações com integrantes'),
  ('documents.manage', 'Gerenciar documentos financeiros')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on true
where r.code = 'ADMIN'
  and p.code in (
    'accounting.manage','institutional.manage','reconciliation.manage',
    'budgets.manage','approvals.manage','approvals.review','imports.manage',
    'privacy.manage','communications.manage','documents.manage'
  )
on conflict do nothing;

insert into public.role_permissions(role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on true
where r.code = 'TREASURER'
  and p.code in (
    'institutional.manage','reconciliation.manage','budgets.manage',
    'approvals.review','imports.manage','communications.manage','documents.manage'
  )
on conflict do nothing;

create or replace function private.seed_default_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_treasurer uuid;
  v_viewer uuid;
  v_member uuid;
begin
  insert into public.roles(organization_id, code, name, is_system)
  values
    (new.id, 'ADMIN', 'Administrador', true),
    (new.id, 'TREASURER', 'Tesoureiro', true),
    (new.id, 'VIEWER', 'Consulta', true),
    (new.id, 'MEMBER', 'Integrante', true);

  select id into v_admin from public.roles where organization_id = new.id and code = 'ADMIN';
  select id into v_treasurer from public.roles where organization_id = new.id and code = 'TREASURER';
  select id into v_viewer from public.roles where organization_id = new.id and code = 'VIEWER';
  select id into v_member from public.roles where organization_id = new.id and code = 'MEMBER';

  insert into public.role_permissions(role_id, permission_code)
  select v_admin, p.code from public.permissions p;

  insert into public.role_permissions(role_id, permission_code)
  select v_treasurer, p.code
  from public.permissions p
  where p.code in (
    'members.read','members.write','finance.read',
    'charges.create','charges.adjust','charges.cancel',
    'payments.create','payments.reverse','credits.manage','allocations.manage',
    'periods.close','reports.read','reports.export','audit.read',
    'institutional.manage','reconciliation.manage','budgets.manage',
    'approvals.review','imports.manage','communications.manage','documents.manage'
  );

  insert into public.role_permissions(role_id, permission_code)
  select v_viewer, p.code
  from public.permissions p
  where p.code in ('members.read','finance.read','reports.read');

  return new;
end;
$$;

create or replace view public.v_payable_approval_state
with (security_invoker = true)
as
with latest_correction as (
  select distinct on (c.payable_id)
    c.payable_id, c.id as correction_id, c.approval_required, c.approval_min_approvers
  from public.institutional_payable_corrections c
  order by c.payable_id, c.correction_seq desc
),
requirement as (
  select
    p.organization_id,
    p.id as payable_id,
    c.correction_id,
    coalesce(c.approval_required, p.approval_required) as approval_required,
    coalesce(c.approval_min_approvers, p.approval_min_approvers) as minimum_approvers
  from public.institutional_payables p
  left join latest_correction c on c.payable_id = p.id
),
request as (
  select distinct on (r.payable_id)
    r.payable_id, r.id as approval_request_id
  from public.payable_approval_requests r
  join requirement q on q.payable_id = r.payable_id
  where (q.correction_id is null and r.correction_id is null)
     or r.correction_id = q.correction_id
  order by r.payable_id, r.created_at desc
),
counts as (
  select
    d.approval_request_id,
    count(*) filter (where d.decision = 'approve') as approvals,
    count(*) filter (where d.decision = 'reject') as rejections
  from public.payable_approval_decisions d
  group by d.approval_request_id
)
select
  q.organization_id, q.payable_id, q.approval_required, q.minimum_approvers,
  r.approval_request_id,
  coalesce(c.approvals,0) as approvals,
  coalesce(c.rejections,0) as rejections,
  case
    when not q.approval_required then 'not_required'
    when r.approval_request_id is null then 'missing_request'
    when coalesce(c.rejections,0) > 0 then 'rejected'
    when coalesce(c.approvals,0) >= q.minimum_approvers then 'approved'
    else 'pending'
  end as approval_status
from requirement q
left join request r on r.payable_id = q.payable_id
left join counts c on c.approval_request_id = r.approval_request_id;

create or replace view public.v_institutional_payable_effective
with (security_invoker = true)
as
with latest as (
  select distinct on (c.payable_id)
    c.payable_id, c.new_category_id, c.new_accounting_plan_id,
    c.new_accounting_account_id, c.new_fund_id, c.new_expense_classification,
    c.new_description, c.new_competence, c.new_due_date, c.new_amount
  from public.institutional_payable_corrections c
  order by c.payable_id, c.correction_seq desc
),
alloc as (
  select a.payable_id, sum(a.amount)::numeric(14,2) as allocated_amount
  from public.institutional_payable_payment_allocations a
  left join public.institutional_payable_allocation_reversals ar on ar.allocation_id = a.id
  left join public.institutional_payable_payment_reversals pr on pr.payment_id = a.payable_payment_id
  where ar.allocation_id is null and pr.payment_id is null
  group by a.payable_id
)
select
  p.organization_id,
  p.id as payable_id,
  coalesce(l.new_category_id,p.category_id) as category_id,
  coalesce(l.new_accounting_plan_id,p.accounting_plan_id) as accounting_plan_id,
  coalesce(l.new_accounting_account_id,p.accounting_account_id) as accounting_account_id,
  coalesce(l.new_fund_id,p.fund_id) as fund_id,
  coalesce(l.new_expense_classification,p.expense_classification) as expense_classification,
  coalesce(l.new_description,p.description) as description,
  p.counterparty_name,
  coalesce(l.new_competence,p.competence) as competence,
  coalesce(l.new_due_date,p.due_date) as due_date,
  coalesce(l.new_amount,p.amount)::numeric(14,2) as effective_amount,
  coalesce(a.allocated_amount,0)::numeric(14,2) as allocated_amount,
  greatest(
    coalesce(l.new_amount,p.amount)
    - coalesce(a.allocated_amount,0)
    - coalesce(c.canceled_amount,0),
    0
  )::numeric(14,2) as open_amount,
  (c.payable_id is not null) as is_canceled,
  ap.approval_status,
  (
    coalesce(a.allocated_amount,0) + coalesce(c.canceled_amount,0)
    <= coalesce(l.new_amount,p.amount)
  ) as integrity_ok
from public.institutional_payables p
left join latest l on l.payable_id = p.id
left join alloc a on a.payable_id = p.id
left join public.institutional_payable_cancellations c on c.payable_id = p.id
left join public.v_payable_approval_state ap on ap.payable_id = p.id
where p.posting_status = 'posted';

create or replace view public.v_institutional_receivable_effective
with (security_invoker = true)
as
with latest as (
  select distinct on (c.receivable_id)
    c.receivable_id, c.new_category_id, c.new_accounting_plan_id,
    c.new_accounting_account_id, c.new_fund_id, c.new_revenue_classification,
    c.new_description, c.new_competence, c.new_due_date, c.new_amount
  from public.institutional_receivable_corrections c
  order by c.receivable_id, c.correction_seq desc
),
alloc as (
  select a.receivable_id, sum(a.amount)::numeric(14,2) as allocated_amount
  from public.institutional_receipt_allocations a
  left join public.institutional_receipt_allocation_reversals ar on ar.allocation_id = a.id
  left join public.institutional_receipt_reversals rr on rr.receipt_id = a.receipt_id
  where ar.allocation_id is null and rr.receipt_id is null
  group by a.receivable_id
)
select
  r.organization_id,
  r.id as receivable_id,
  coalesce(l.new_category_id,r.category_id) as category_id,
  coalesce(l.new_accounting_plan_id,r.accounting_plan_id) as accounting_plan_id,
  coalesce(l.new_accounting_account_id,r.accounting_account_id) as accounting_account_id,
  coalesce(l.new_fund_id,r.fund_id) as fund_id,
  coalesce(l.new_revenue_classification,r.revenue_classification) as revenue_classification,
  coalesce(l.new_description,r.description) as description,
  r.counterparty_name,
  coalesce(l.new_competence,r.competence) as competence,
  coalesce(l.new_due_date,r.due_date) as due_date,
  coalesce(l.new_amount,r.amount)::numeric(14,2) as effective_amount,
  coalesce(a.allocated_amount,0)::numeric(14,2) as allocated_amount,
  greatest(
    coalesce(l.new_amount,r.amount)
    - coalesce(a.allocated_amount,0)
    - coalesce(c.canceled_amount,0),
    0
  )::numeric(14,2) as open_amount,
  (c.receivable_id is not null) as is_canceled,
  (
    coalesce(a.allocated_amount,0) + coalesce(c.canceled_amount,0)
    <= coalesce(l.new_amount,r.amount)
  ) as integrity_ok
from public.institutional_receivables r
left join latest l on l.receivable_id = r.id
left join alloc a on a.receivable_id = r.id
left join public.institutional_receivable_cancellations c on c.receivable_id = r.id
where r.posting_status = 'posted';

create or replace view public.v_financial_account_movements
with (security_invoker = true)
as
select o.organization_id, o.financial_account_id, o.effective_date as movement_date,
       o.amount::numeric(14,2) as signed_amount, 'opening'::text as movement_type, o.id as source_id
from public.account_opening_entries o
union all
select p.organization_id,p.financial_account_id,p.payment_date,p.amount::numeric(14,2),
       'member_payment',p.id
from public.payments p where p.source_kind='operational'
union all
select p.organization_id,p.financial_account_id,r.reversal_date,(-p.amount)::numeric(14,2),
       'member_payment_reversal',r.payment_id
from public.payment_reversals r join public.payments p on p.id=r.payment_id
where p.source_kind='operational'
union all
select r.organization_id,r.financial_account_id,r.receipt_date,r.amount::numeric(14,2),
       'institutional_receipt',r.id
from public.institutional_receipts r
union all
select r.organization_id,r.financial_account_id,rr.reversal_date,(-r.amount)::numeric(14,2),
       'institutional_receipt_reversal',rr.receipt_id
from public.institutional_receipt_reversals rr join public.institutional_receipts r on r.id=rr.receipt_id
union all
select p.organization_id,p.financial_account_id,p.payment_date,(-p.amount)::numeric(14,2),
       'institutional_payable_payment',p.id
from public.institutional_payable_payments p
union all
select p.organization_id,p.financial_account_id,r.reversal_date,p.amount::numeric(14,2),
       'institutional_payable_payment_reversal',r.payment_id
from public.institutional_payable_payment_reversals r
join public.institutional_payable_payments p on p.id=r.payment_id
union all
select t.organization_id,t.from_account_id,t.transfer_date,(-t.amount)::numeric(14,2),
       'account_transfer_out',t.id
from public.financial_account_transfers t
union all
select t.organization_id,t.to_account_id,t.transfer_date,t.amount::numeric(14,2),
       'account_transfer_in',t.id
from public.financial_account_transfers t
union all
select t.organization_id,t.from_account_id,r.reversal_date,t.amount::numeric(14,2),
       'account_transfer_reversal_in',t.id
from public.financial_account_transfer_reversals r
join public.financial_account_transfers t on t.id=r.transfer_id
union all
select t.organization_id,t.to_account_id,r.reversal_date,(-t.amount)::numeric(14,2),
       'account_transfer_reversal_out',t.id
from public.financial_account_transfer_reversals r
join public.financial_account_transfers t on t.id=r.transfer_id;

create or replace view public.v_financial_account_balances
with (security_invoker = true)
as
select organization_id,financial_account_id,sum(signed_amount)::numeric(14,2) as balance
from public.v_financial_account_movements
group by organization_id,financial_account_id;

create or replace view public.v_dre_entries
with (security_invoker = true)
as
with member_charge_effective as (
  select c.id,
    (c.original_amount + coalesce(sum(case when a.direction='increase' then a.amount else -a.amount end),0))::numeric(14,2)
      as amount_before_cancel
  from public.charges c
  left join public.charge_adjustments a on a.charge_id=c.id
  group by c.id
),
payable_corrections as (
  select c.organization_id,c.accounting_period as period,c.previous_accounting_account_id as accounting_account_id,
         c.previous_fund_id as fund_id,c.payable_id as source_id,
         'institutional_payable_correction_reverse'::text as source_type,
         c.previous_amount::numeric(14,2) as signed_amount
  from public.institutional_payable_corrections c
  where c.previous_accounting_account_id<>c.new_accounting_account_id
  union all
  select c.organization_id,c.accounting_period,c.new_accounting_account_id,c.new_fund_id,c.payable_id,
         'institutional_payable_correction_repost',(-c.new_amount)::numeric(14,2)
  from public.institutional_payable_corrections c
  where c.previous_accounting_account_id<>c.new_accounting_account_id
  union all
  select c.organization_id,c.accounting_period,c.new_accounting_account_id,c.new_fund_id,c.payable_id,
         'institutional_payable_correction_delta',(-(c.new_amount-c.previous_amount))::numeric(14,2)
  from public.institutional_payable_corrections c
  where c.previous_accounting_account_id=c.new_accounting_account_id
),
receivable_corrections as (
  select c.organization_id,c.accounting_period as period,c.previous_accounting_account_id as accounting_account_id,
         c.previous_fund_id as fund_id,c.receivable_id as source_id,
         'institutional_receivable_correction_reverse'::text as source_type,
         (-c.previous_amount)::numeric(14,2) as signed_amount
  from public.institutional_receivable_corrections c
  where c.previous_accounting_account_id<>c.new_accounting_account_id
  union all
  select c.organization_id,c.accounting_period,c.new_accounting_account_id,c.new_fund_id,c.receivable_id,
         'institutional_receivable_correction_repost',c.new_amount::numeric(14,2)
  from public.institutional_receivable_corrections c
  where c.previous_accounting_account_id<>c.new_accounting_account_id
  union all
  select c.organization_id,c.accounting_period,c.new_accounting_account_id,c.new_fund_id,c.receivable_id,
         'institutional_receivable_correction_delta',(c.new_amount-c.previous_amount)::numeric(14,2)
  from public.institutional_receivable_corrections c
  where c.previous_accounting_account_id=c.new_accounting_account_id
)
select c.organization_id,c.accounting_period as period,c.accounting_account_id,null::uuid as fund_id,
       c.id as source_id,'member_charge'::text as source_type,c.original_amount::numeric(14,2) as signed_amount
from public.charges c where c.accounting_account_id is not null
union all
select a.organization_id,a.accounting_period,c.accounting_account_id,null::uuid,a.charge_id,
       'member_charge_adjustment',
       (case when a.direction='increase' then a.amount else -a.amount end)::numeric(14,2)
from public.charge_adjustments a join public.charges c on c.id=a.charge_id
where c.accounting_account_id is not null
union all
select cc.organization_id,cc.accounting_period,c.accounting_account_id,null::uuid,cc.charge_id,
       'member_charge_cancellation',(-e.amount_before_cancel)::numeric(14,2)
from public.charge_cancellations cc
join public.charges c on c.id=cc.charge_id
join member_charge_effective e on e.id=c.id
where c.accounting_account_id is not null
union all
select p.organization_id,p.accounting_period,p.accounting_account_id,p.fund_id,p.id,
       'institutional_payable',(-p.amount)::numeric(14,2)
from public.institutional_payables p where p.posting_status='posted'
union all
select * from payable_corrections
union all
select c.organization_id,c.accounting_period,c.accounting_account_id,c.fund_id,c.payable_id,
       'institutional_payable_cancellation',c.canceled_amount::numeric(14,2)
from public.institutional_payable_cancellations c
union all
select r.organization_id,r.accounting_period,r.accounting_account_id,r.fund_id,r.id,
       'institutional_receivable',r.amount::numeric(14,2)
from public.institutional_receivables r where r.posting_status='posted'
union all
select * from receivable_corrections
union all
select c.organization_id,c.accounting_period,c.accounting_account_id,c.fund_id,c.receivable_id,
       'institutional_receivable_cancellation',(-c.canceled_amount)::numeric(14,2)
from public.institutional_receivable_cancellations c;

create or replace view public.v_accounting_budget_vs_actual
with (security_invoker = true)
as
with actual as (
  select organization_id,accounting_account_id,period,
         abs(sum(signed_amount))::numeric(14,2) as actual_amount
  from public.v_dre_entries
  group by organization_id,accounting_account_id,period
)
select b.organization_id,b.budget_cycle_id,b.accounting_plan_id,b.accounting_account_id,b.period,
       b.amount::numeric(14,2) as budget_amount,
       coalesce(a.actual_amount,0)::numeric(14,2) as actual_amount,
       (b.amount-coalesce(a.actual_amount,0))::numeric(14,2) as remaining_amount
from public.accounting_budget_lines b
left join actual a
  on a.organization_id=b.organization_id
 and a.accounting_account_id=b.accounting_account_id
 and a.period=b.period;

create or replace view public.v_fund_budget_vs_actual
with (security_invoker = true)
as
with actual as (
  select
    organization_id,
    fund_id,
    period,
    sum(case when signed_amount < 0 then -signed_amount else 0 end)::numeric(14,2) as actual_amount
  from public.v_dre_entries
  where fund_id is not null
  group by organization_id,fund_id,period
)
select b.organization_id,b.budget_cycle_id,b.fund_id,b.period,
       b.amount::numeric(14,2) as budget_amount,
       coalesce(a.actual_amount,0)::numeric(14,2) as actual_amount,
       (b.amount-coalesce(a.actual_amount,0))::numeric(14,2) as available_amount
from public.fund_budget_lines b
left join actual a
  on a.organization_id=b.organization_id
 and a.fund_id=b.fund_id
 and a.period=b.period;

create or replace view public.v_bank_reconciliation_lines
with (security_invoker = true)
as
with matches as (
  select m.statement_line_id,sum(m.matched_amount)::numeric(14,2) as matched_amount
  from public.bank_reconciliation_matches m
  left join public.bank_reconciliation_match_reversals r on r.match_id=m.id
  where r.match_id is null
  group by m.statement_line_id
)
select l.organization_id,l.id as statement_line_id,l.statement_import_id,l.transaction_date,
       l.description,l.amount,coalesce(m.matched_amount,0)::numeric(14,2) as matched_amount,
       case
         when coalesce(m.matched_amount,0)=0 then 'unmatched'
         when coalesce(m.matched_amount,0)=abs(l.amount) then 'reconciled'
         when coalesce(m.matched_amount,0)<abs(l.amount) then 'partial'
         else 'integrity_error'
       end as reconciliation_status,
       (coalesce(m.matched_amount,0)<=abs(l.amount)) as integrity_ok
from public.bank_statement_lines l
left join matches m on m.statement_line_id=l.id;

create or replace view public.v_privacy_request_status
with (security_invoker = true)
as
select r.*,e.event_type as latest_status,e.created_at as latest_status_at
from public.privacy_requests r
left join lateral (
  select pe.event_type,pe.created_at
  from public.privacy_request_events pe
  where pe.privacy_request_id=r.id
  order by pe.id desc limit 1
) e on true;

create or replace view public.v_member_communication_status
with (security_invoker = true)
as
select c.*,e.event_type as latest_status,e.created_at as latest_status_at
from public.member_communications c
left join lateral (
  select ce.event_type,ce.created_at
  from public.member_communication_events ce
  where ce.communication_id=c.id
  order by ce.id desc limit 1
) e on true;

-- Deny broad access first.
revoke all on
  public.office_types,public.member_offices,public.recurring_member_terms,public.user_ui_preferences,
  public.accounting_plan_templates,public.accounting_account_templates,
  public.accounting_plans,public.accounting_accounts,
  public.financial_category_account_mappings,public.financial_account_accounting_mappings,
  public.expense_approval_policies,public.institutional_recurring_rules,
  public.institutional_recurring_rule_versions,public.institutional_payables,
  public.institutional_receivables,public.institutional_payable_corrections,
  public.institutional_receivable_corrections,public.institutional_payable_cancellations,
  public.institutional_receivable_cancellations,public.payable_approval_requests,
  public.payable_approval_decisions,public.institutional_payable_payments,
  public.institutional_payable_payment_allocations,public.institutional_payable_allocation_reversals,
  public.institutional_payable_payment_reversals,public.institutional_receipts,
  public.institutional_receipt_allocations,public.institutional_receipt_allocation_reversals,
  public.institutional_receipt_reversals,public.financial_account_transfers,
  public.financial_account_transfer_reversals,public.fund_transfers,public.fund_transfer_reversals,
  public.documents,public.payable_documents,public.receivable_documents,
  public.bank_statement_imports,public.bank_statement_lines,public.bank_reconciliation_matches,
  public.bank_reconciliation_match_reversals,public.budget_cycles,public.accounting_budget_lines,
  public.fund_budget_lines,public.import_jobs,public.import_rows,public.import_confirmations,
  public.data_retention_policies,public.privacy_requests,public.privacy_request_events,
  public.member_communications,public.member_communication_events,public.notifications,
  public.member_debt_agreements,public.member_debt_agreement_items,
  public.member_debt_agreement_installments,public.member_debt_agreement_events,
  public.saas_tenant_contacts,public.saas_subscription_price_terms,public.saas_invoice_items,
  public.saas_billing_profiles,public.saas_collection_events,public.saas_payment_allocation_reversals
from anon, authenticated;

-- RLS on every newly exposed table.
alter table public.office_types enable row level security;
alter table public.member_offices enable row level security;
alter table public.recurring_member_terms enable row level security;
alter table public.user_ui_preferences enable row level security;
alter table public.accounting_plan_templates enable row level security;
alter table public.accounting_account_templates enable row level security;
alter table public.accounting_plans enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.financial_category_account_mappings enable row level security;
alter table public.financial_account_accounting_mappings enable row level security;
alter table public.expense_approval_policies enable row level security;
alter table public.institutional_recurring_rules enable row level security;
alter table public.institutional_recurring_rule_versions enable row level security;
alter table public.institutional_payables enable row level security;
alter table public.institutional_receivables enable row level security;
alter table public.institutional_payable_corrections enable row level security;
alter table public.institutional_receivable_corrections enable row level security;
alter table public.institutional_payable_cancellations enable row level security;
alter table public.institutional_receivable_cancellations enable row level security;
alter table public.payable_approval_requests enable row level security;
alter table public.payable_approval_decisions enable row level security;
alter table public.institutional_payable_payments enable row level security;
alter table public.institutional_payable_payment_allocations enable row level security;
alter table public.institutional_payable_allocation_reversals enable row level security;
alter table public.institutional_payable_payment_reversals enable row level security;
alter table public.institutional_receipts enable row level security;
alter table public.institutional_receipt_allocations enable row level security;
alter table public.institutional_receipt_allocation_reversals enable row level security;
alter table public.institutional_receipt_reversals enable row level security;
alter table public.financial_account_transfers enable row level security;
alter table public.financial_account_transfer_reversals enable row level security;
alter table public.fund_transfers enable row level security;
alter table public.fund_transfer_reversals enable row level security;
alter table public.documents enable row level security;
alter table public.payable_documents enable row level security;
alter table public.receivable_documents enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliation_matches enable row level security;
alter table public.bank_reconciliation_match_reversals enable row level security;
alter table public.budget_cycles enable row level security;
alter table public.accounting_budget_lines enable row level security;
alter table public.fund_budget_lines enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_confirmations enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.privacy_request_events enable row level security;
alter table public.member_communications enable row level security;
alter table public.member_communication_events enable row level security;
alter table public.notifications enable row level security;
alter table public.member_debt_agreements enable row level security;
alter table public.member_debt_agreement_items enable row level security;
alter table public.member_debt_agreement_installments enable row level security;
alter table public.member_debt_agreement_events enable row level security;
alter table public.saas_tenant_contacts enable row level security;
alter table public.saas_subscription_price_terms enable row level security;
alter table public.saas_invoice_items enable row level security;
alter table public.saas_billing_profiles enable row level security;
alter table public.saas_collection_events enable row level security;
alter table public.saas_payment_allocation_reversals enable row level security;

grant select on
  public.office_types,public.member_offices,public.recurring_member_terms,
  public.accounting_plan_templates,public.accounting_account_templates,
  public.accounting_plans,public.accounting_accounts,
  public.financial_category_account_mappings,public.financial_account_accounting_mappings,
  public.expense_approval_policies,public.institutional_recurring_rules,
  public.institutional_recurring_rule_versions,public.institutional_payables,
  public.institutional_receivables,public.institutional_payable_corrections,
  public.institutional_receivable_corrections,public.institutional_payable_cancellations,
  public.institutional_receivable_cancellations,public.payable_approval_requests,
  public.payable_approval_decisions,public.institutional_payable_payments,
  public.institutional_payable_payment_allocations,public.institutional_payable_allocation_reversals,
  public.institutional_payable_payment_reversals,public.institutional_receipts,
  public.institutional_receipt_allocations,public.institutional_receipt_allocation_reversals,
  public.institutional_receipt_reversals,public.financial_account_transfers,
  public.financial_account_transfer_reversals,public.fund_transfers,public.fund_transfer_reversals,
  public.documents,public.payable_documents,public.receivable_documents,
  public.bank_statement_imports,public.bank_statement_lines,public.bank_reconciliation_matches,
  public.bank_reconciliation_match_reversals,public.budget_cycles,public.accounting_budget_lines,
  public.fund_budget_lines,public.import_jobs,public.import_rows,public.import_confirmations,
  public.data_retention_policies,public.privacy_requests,public.privacy_request_events,
  public.member_communications,public.member_communication_events,public.notifications,
  public.member_debt_agreements,public.member_debt_agreement_items,
  public.member_debt_agreement_installments,public.member_debt_agreement_events,
  public.saas_tenant_contacts,public.saas_subscription_price_terms,public.saas_invoice_items,
  public.saas_billing_profiles,public.saas_collection_events,public.saas_payment_allocation_reversals,
  public.v_payable_approval_state,public.v_institutional_payable_effective,
  public.v_institutional_receivable_effective,public.v_financial_account_movements,
  public.v_financial_account_balances,public.v_dre_entries,
  public.v_accounting_budget_vs_actual,public.v_fund_budget_vs_actual,
  public.v_bank_reconciliation_lines,public.v_privacy_request_status,
  public.v_member_communication_status
to authenticated;

grant select,insert,update,delete on public.user_ui_preferences to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy office_types_select on public.office_types for select to authenticated
using (private.belongs_to_org(organization_id));

create policy member_offices_select on public.member_offices for select to authenticated
using (private.has_permission(organization_id,'members.read') or private.is_self_member(organization_id,member_id));

create policy recurring_member_terms_select
on public.recurring_member_terms for select to authenticated
using (private.can_read_financial_member(organization_id, member_id));

create policy user_ui_preferences_select on public.user_ui_preferences for select to authenticated
using (user_id=(select auth.uid()) and (organization_id is null or private.belongs_to_org(organization_id)));
create policy user_ui_preferences_insert on public.user_ui_preferences for insert to authenticated
with check (user_id=(select auth.uid()) and (organization_id is null or private.belongs_to_org(organization_id)));
create policy user_ui_preferences_update on public.user_ui_preferences for update to authenticated
using (user_id=(select auth.uid()) and (organization_id is null or private.belongs_to_org(organization_id)))
with check (user_id=(select auth.uid()) and (organization_id is null or private.belongs_to_org(organization_id)));
create policy user_ui_preferences_delete on public.user_ui_preferences for delete to authenticated
using (user_id=(select auth.uid()) and (organization_id is null or private.belongs_to_org(organization_id)));

create policy accounting_plan_templates_select
on public.accounting_plan_templates for select to authenticated
using (active or private.is_platform_staff('MASTER'));

create policy accounting_account_templates_select
on public.accounting_account_templates for select to authenticated
using (
  exists (
    select 1
    from public.accounting_plan_templates t
    where t.id = accounting_account_templates.accounting_plan_template_id
      and (t.active or private.is_platform_staff('MASTER'))
  )
);

create policy accounting_plans_select on public.accounting_plans for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy accounting_accounts_select on public.accounting_accounts for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy financial_category_account_mappings_select on public.financial_category_account_mappings for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy financial_account_accounting_mappings_select on public.financial_account_accounting_mappings for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy expense_approval_policies_select on public.expense_approval_policies for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_recurring_rules_select on public.institutional_recurring_rules for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_recurring_rule_versions_select on public.institutional_recurring_rule_versions for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy institutional_payables_select on public.institutional_payables for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receivables_select on public.institutional_receivables for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_payable_corrections_select on public.institutional_payable_corrections for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receivable_corrections_select on public.institutional_receivable_corrections for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_payable_cancellations_select on public.institutional_payable_cancellations for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receivable_cancellations_select on public.institutional_receivable_cancellations for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy payable_approval_requests_select on public.payable_approval_requests for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy payable_approval_decisions_select on public.payable_approval_decisions for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy institutional_payable_payments_select on public.institutional_payable_payments for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_payable_payment_allocations_select on public.institutional_payable_payment_allocations for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_payable_allocation_reversals_select on public.institutional_payable_allocation_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_payable_payment_reversals_select on public.institutional_payable_payment_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receipts_select on public.institutional_receipts for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receipt_allocations_select on public.institutional_receipt_allocations for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receipt_allocation_reversals_select on public.institutional_receipt_allocation_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy institutional_receipt_reversals_select on public.institutional_receipt_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy financial_account_transfers_select on public.financial_account_transfers for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy financial_account_transfer_reversals_select on public.financial_account_transfer_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy fund_transfers_select on public.fund_transfers for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy fund_transfer_reversals_select on public.fund_transfer_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy documents_select on public.documents for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy payable_documents_select on public.payable_documents for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy receivable_documents_select on public.receivable_documents for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy bank_statement_imports_select on public.bank_statement_imports for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy bank_statement_lines_select on public.bank_statement_lines for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy bank_reconciliation_matches_select on public.bank_reconciliation_matches for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy bank_reconciliation_match_reversals_select on public.bank_reconciliation_match_reversals for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy budget_cycles_select on public.budget_cycles for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy accounting_budget_lines_select on public.accounting_budget_lines for select to authenticated
using (private.has_permission(organization_id,'finance.read'));
create policy fund_budget_lines_select on public.fund_budget_lines for select to authenticated
using (private.has_permission(organization_id,'finance.read'));

create policy import_jobs_select on public.import_jobs for select to authenticated
using (private.has_permission(organization_id,'imports.manage'));
create policy import_rows_select on public.import_rows for select to authenticated
using (private.has_permission(organization_id,'imports.manage'));
create policy import_confirmations_select on public.import_confirmations for select to authenticated
using (private.has_permission(organization_id,'imports.manage'));

create policy data_retention_policies_select on public.data_retention_policies for select to authenticated
using (private.has_permission(organization_id,'privacy.manage'));
create policy privacy_requests_select on public.privacy_requests for select to authenticated
using (
  private.has_permission(organization_id,'privacy.manage')
  or requester_user_id=(select auth.uid())
  or (member_id is not null and private.is_self_member(organization_id,member_id))
);
create policy privacy_request_events_select on public.privacy_request_events for select to authenticated
using (
  private.has_permission(organization_id,'privacy.manage')
  or exists (
    select 1 from public.privacy_requests r
    where r.id=privacy_request_events.privacy_request_id
      and (
        r.requester_user_id=(select auth.uid())
        or (r.member_id is not null and private.is_self_member(r.organization_id,r.member_id))
      )
  )
);

create policy member_communications_select on public.member_communications for select to authenticated
using (
  private.has_permission(organization_id,'communications.manage')
  or (visible_to_member and private.is_self_member(organization_id,member_id))
);
create policy member_communication_events_select on public.member_communication_events for select to authenticated
using (
  private.has_permission(organization_id,'communications.manage')
  or exists (
    select 1 from public.member_communications c
    where c.id=member_communication_events.communication_id
      and c.visible_to_member
      and private.is_self_member(c.organization_id,c.member_id)
  )
);

create policy notifications_select on public.notifications for select to authenticated
using (user_id=(select auth.uid()));
create policy notifications_update_read_at on public.notifications for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

create policy member_debt_agreements_select on public.member_debt_agreements for select to authenticated
using (private.can_read_financial_member(organization_id,member_id));
create policy member_debt_agreement_items_select on public.member_debt_agreement_items for select to authenticated
using (
  exists (
    select 1 from public.member_debt_agreements a
    where a.organization_id=member_debt_agreement_items.organization_id
      and a.id=member_debt_agreement_items.agreement_id
      and private.can_read_financial_member(a.organization_id,a.member_id)
  )
);
create policy member_debt_agreement_installments_select on public.member_debt_agreement_installments for select to authenticated
using (
  exists (
    select 1 from public.member_debt_agreements a
    where a.organization_id=member_debt_agreement_installments.organization_id
      and a.id=member_debt_agreement_installments.agreement_id
      and private.can_read_financial_member(a.organization_id,a.member_id)
  )
);
create policy member_debt_agreement_events_select on public.member_debt_agreement_events for select to authenticated
using (
  exists (
    select 1 from public.member_debt_agreements a
    where a.organization_id=member_debt_agreement_events.organization_id
      and a.id=member_debt_agreement_events.agreement_id
      and private.can_read_financial_member(a.organization_id,a.member_id)
  )
);

create policy saas_tenant_contacts_select on public.saas_tenant_contacts for select to authenticated
using (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')
       or private.has_permission(organization_id,'settings.manage'));
create policy saas_subscription_price_terms_select on public.saas_subscription_price_terms for select to authenticated
using (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')
       or private.has_permission(organization_id,'settings.manage'));
create policy saas_invoice_items_select on public.saas_invoice_items for select to authenticated
using (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')
       or private.has_permission(organization_id,'settings.manage'));
create policy saas_billing_profiles_select on public.saas_billing_profiles for select to authenticated
using (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')
       or private.has_permission(organization_id,'settings.manage'));
create policy saas_collection_events_select on public.saas_collection_events for select to authenticated
using (private.is_platform_staff('MASTER') or private.is_platform_staff('BILLING')
       or private.has_permission(organization_id,'settings.manage'));

create policy saas_payment_allocation_reversals_select
on public.saas_payment_allocation_reversals for select to authenticated
using (
  private.is_platform_staff('MASTER')
  or private.is_platform_staff('BILLING')
  or private.has_permission(organization_id,'settings.manage')
);
