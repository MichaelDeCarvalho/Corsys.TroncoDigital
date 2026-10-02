# Dicionário — camada SaaS

## `platform_staff`
Usuários globais da Corsys. Papéis: `MASTER`, `SUPPORT`, `BILLING`.

Não substitui `user_roles`, que continua scoped por Loja.

## `saas_tenant_accounts`
Cadastro comercial 1:1 da organização/cliente.

Principais campos:
- `organization_id`;
- contato de faturamento;
- dados fiscais mínimos;
- `commercial_status`;
- `grace_until`;
- `retention_until`;
- referência do customer no provider.

## `saas_plans`
Plano comercial do SaaS.

Preço não deve ser hardcoded na interface.

## `saas_plan_entitlements`
Limites e funcionalidades contratadas.

## `saas_subscriptions`
Contrato recorrente entre organização e plano.

## `saas_subscription_events`
Eventos de ciclo de vida. Append-only.

## `saas_invoices`
Cobrança do uso da plataforma. Fato imutável após emissão.

Não confundir com `charges` de integrantes ou contas a receber da Loja.

## `saas_invoice_voids`
Anulação explícita de fatura SaaS.

## `saas_payments`
Recebimento efetivo da Corsys relativo à assinatura.

## `saas_payment_allocations`
Aloca pagamento SaaS a uma ou mais faturas.

## `saas_payment_reversals`
Estorno explícito de recebimento SaaS.

## `v_saas_invoice_balances`
Deriva:
- valor faturado;
- valor pago;
- valor aberto;
- status `open|partial|paid|overdue|void`.

## `saas_webhook_events`
Deduplicação e rastreio técnico de eventos do provider.

Nunca usar payload bruto sensível como log indiscriminado.

## `saas_support_sessions`
Sessão temporária para acesso cross-tenant de suporte.

Escopo inicial apenas leitura/configuração em leitura.

## `saas_master_audit_logs`
Auditoria global da operação Master.

Separada da auditoria financeira interna de cada Loja.

## `saas_terms_versions` / `saas_terms_acceptances`
Versionamento e aceite de Termos, Privacidade e DPA quando aplicável.

## `saas_fiscal_documents`
Metadados de NFS-e/recibo/documento referente à cobrança SaaS.
Não representa lançamento financeiro interno da Loja.
