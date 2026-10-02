# ERD pós-V31 — visão de alto nível

```text
CORSYS / CONTROL PLANE
platform_staff
  ├── saas_tenant_accounts ── organizations
  ├── saas_plans ── saas_subscriptions ── saas_subscription_price_terms
  ├── saas_invoices ── saas_invoice_items
  ├── saas_payments ── saas_payment_allocations
  ├── saas_tenant_contacts
  └── support_sessions / master_audit_logs

TENANT
organizations
  ├── roles / permissions / user_roles
  ├── members ── member_user_links
  ├── office_types ── member_offices
  └── user_ui_preferences

CONTÁBIL
accounting_plans
  ├── accounting_accounts
  ├── financial_category_account_mappings ── financial_categories
  └── financial_account_accounting_mappings ── financial_accounts

INTEGRANTES
members
  ├── charges ── charge_adjustments / charge_cancellations
  ├── payments ── payment_reversals
  ├── member_credits
  ├── receivable_allocations
  └── member_debt_agreements

INSTITUCIONAL
institutional_payables
  ├── corrections / cancellations
  ├── payable_approval_requests ── payable_approval_decisions
  └── payment_allocations ── institutional_payable_payments

institutional_receivables
  ├── corrections / cancellations
  └── receipt_allocations ── institutional_receipts

CAIXA / CONTROLE
financial_accounts
  ├── account_opening_entries
  ├── financial_account_transfers
  └── bank_statement_imports ── bank_statement_lines ── reconciliation_matches

budget_cycles
  ├── accounting_budget_lines
  └── fund_budget_lines
```
