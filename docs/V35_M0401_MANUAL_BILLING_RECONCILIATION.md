# V35 — Reconciliação preliminar M04.01: faturamento SaaS manual e contrato

**Data da leitura:** 10/11/2026. **Estado:** implementação já existente, sem nova mutation ou homologação real.

## Evidência de código já integrada (não reconstruir)

- `src/components/MasterBilling.tsx`: painel Master de emissão manual, escolha de Loja/competência, preview contratual, valor obtido no servidor, bloqueio por fatura ativa, confirmação idempotente, retry com a mesma chave sob resposta incerta. Lista faturas/pagamentos com composição e checagens.
- `src/lib/master-billing.ts`: read-model de faturas, pagamentos e decomposição financeira; `previewMasterManualInvoice`, `issueMasterManualInvoice` e validações de escopo.
- `supabase/migrations/20261029030000_v35_master_manual_invoice.sql`: `preview_saas_manual_invoice` e `issue_saas_manual_invoice`, `MASTER` + MFA `AAL2`, preço exclusivamente por `saas_subscription_price_terms` válido durante a competência integral, negação para `trialing` e ambiguidade de preço, idempotência, bloqueio por Loja e prevenção de duplicidade.
- `docs/adr/0039-master-manual-saas-invoice.md`: contrato, limites e decisões do projeto.
- `supabase/tests/test_master_manual_invoice_rollback.sql` e `src/components/MasterBilling.test.tsx`: evidências automatizadas em código. O ADR descreve rollback e testes frontend; não converter automaticamente isso em aceite JWT real.

## Verificação Supabase DEV somente leitura

Na data da revisão, existiam `public.preview_saas_manual_invoice(uuid,date,date)` e `public.issue_saas_manual_invoice(uuid,date,date,text,text)`, ambas `SECURITY DEFINER`. Para ambas, `anon` não tinha EXECUTE; `authenticated` tinha EXECUTE, com autorização `private.require_platform_staff('MASTER')` dentro das funções segundo o SQL versionado. **Isso não demonstra** execução real com JWT de MASTER AAL2 nem autenticação de papel negativo, e não autoriza emitir fatura.

## Lacunas e gates restantes

1. Confirmar em DEV o histórico e a versão aplicada dessa migration sem alterar dados, seus grants e o `search_path` efetivo; confrontar contratos/preços históricos e a política vigente. Planos e preços comerciais do SaaS ainda dependem de aprovação específica. Sem preço contratual válido, a emissão deve continuar bloqueada.
2. Homologar `MASTER/AAL2`, `MASTER/AAL1`, usuário de Loja, usuário anon, assinatura suspensa/trial, preço ausente ou não unívoco e tentativa de outra organização. Só avançar com autorização de DEV e credenciais de teste legitimamente disponíveis.
3. Testar prévia/duplicidade, limites de competência/ciclo e idempotência em rollback/ambiente descartável sempre que possível. Não emitir faturas reais para cliente sem autorização explícita — são registros financeiros persistentes.
4. Reconciliar com regras existentes de ciclo contratual, assinaturas, alterações de plano, vencimento, reajustes, cancelamento, pagamento manual, recebimentos e auditoria; distinguir **emissão interna de fatura** de cobrança bancária, nota fiscal ou gateway (não implementados neste escopo).
5. Não implementar ou supor preços, reajustes, regras de cobrança, vencimentos ou cancelamento que o proprietário ainda não definiu. Não migrar PROD e não enviar cobranças.

**Conclusão restrita:** emissão manual já está **codificada e presente como RPC DEV**. A M04.01 **não deve ser reconstruída**; classificá-la como **PARCIALMENTE RECONCILIADA / GATES PENDENTES**, até conferir ciclo/contrato e autenticação/resultado HTTP reais. A próxima análise de engenharia deve buscar a primeira lacuna comprovada, não presumir inexistência de faturamento manual.
