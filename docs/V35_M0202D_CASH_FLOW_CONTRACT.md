# V35 — M02.02-D: leitura financeira reconciliada para paridade do Fluxo de Caixa

**Estado:** contrato técnico de execução, sem código novo de banco, migration, DEV ou deploy.  
**Base de revisão:** `main=b13aa26d0f1ac5d4cf833820f418fd8ce4cd181e` (10/11/2026).

## Evidência existente, não reconstruir

- Referência [inventário V35](V35_PILOT_V35_INVENTORY.md), tela `view-fluxo-caixa`: **Maiores Despesas**, saldo inicial/atual, diário e tabela por **Data / Tipo / Descrição / Conta / Categoria / Entrada / Saída**.
- Resumo diário real: `public.read_tenant_daily_cash_flow(uuid,date,date)`; intervalos de até 93 dias, totais operacionais e pendências por vencimento. Preserva estornos, exclui abertura e transferências do movimento operacional.
- PR #37 / `66db9bf7`: detalhamento paginado de eventos operacionais da view `v_financial_account_movements`, com conta financeira, origem, direção, contagem exata e bloqueio por truncamento.
- PR #38 / `b13aa26d`: aba Saldo reaproveita `TreasuryBalances` e `v_financial_account_balances` por Loja; valores **derivados não conciliados**. Ambos PRs frontend/onboarding/static PASS no GitHub, **não publicados/homologados DEV**.
- No DEV, leitura sem escrita confirmou `security_invoker=true` nas views `v_financial_account_movements` e `v_financial_account_balances`; `financial_accounts` tem RLS e SELECT por `finance.read`. Política `payments_select` usa `private.can_read_financial_member`, que contempla `finance.read`. Nenhuma mudança de permissão é proposta com base nessa leitura.
- **Repasse neutro**: desconsiderado por decisão do proprietário em 10/11/2026. Não reabrir domínio/RPC/conta patrimonial para esse conceito.

## O que falta de verdade

1. **Descrição e categoria reais da origem:** o evento de caixa possui identificador `source_id` e `movement_type`, mas a view atual não traz descrição/categoria. Não transformar o rótulo genérico do evento em descrição do lançamento nem derivar categoria da direção do dinheiro.
2. **Maiores Despesas:** o ranking deve usar fatos coerentes com o conceito de fluxo efetivo do período, sem misturar obrigações apenas previstas, transferências, estornos ou despesas duplicadas. Antes do desenho, conferir no HTML V35 o significado de “Maiores Despesas” (categoria, conta e base temporal).
3. **Saldo inicial, atual e evolução histórica:** extrair do conjunto completo de movimentos para a Loja e intervalo, preservando abertura, transferências e reversões no saldo patrimonial. Diferenciar explicitamente saldo **contábil derivado** e saldo bancário **conciliado**; não inferir conciliação.
4. **Reconciliação e consistência:** usar leitura server-side com escopo e autorização determinísticos. Não depender de somatórios de páginas do PostgREST nem de duas leituras independentes como se formassem uma fotografia única. Preservar `read_tenant_daily_cash_flow` e sua semântica ou documentar a necessidade de contrato sucessor.

## Dependências que exigem inspeção antes de codificar

- `v_financial_account_movements` relaciona `institutional_payable_payment` a `institutional_payable_payments.id`, e reversão ao mesmo payment id; `institutional_payable_payment_allocations` relaciona pagamentos às obrigações, que têm categoria e descrição efetivas em `v_institutional_payable_effective`.
- Existe `institutional_payable_allocation_reversals`; a reversão do pagamento e a reversão de alocações devem ser analisadas juntas. Um pagamento pode estar alocado a múltiplas obrigações/categorias. Não distribuir valor total repetidamente para cada categoria.
- Para recebimentos institucionais, verificar `institutional_receipt_allocations` e estornos; para integrante, revisar `payments`, `payment_allocations`/equivalente real e `payment_reversals`, sem presumir nome de tabela ou semântica.
- Alterações posteriores de categoria/descrição por `institutional_payable_corrections` podem afetar classificação histórica. Escolher e documentar critério verificável por data do fato, não usar última correção sem avaliação.
- Se houver pagamento sem alocação, não inventar categoria ou apontar pagamento completo como despesa categorizada. Mostrar informação não classificada ou bloquear ranking, conforme contrato de integridade demonstrável.

## Gate mínimo para a próxima implementação

- **Segurança:** usuário sem `finance.read` e outra Loja negados; nenhum vazamento de descrição de terceiro; somente RPCs/leitura necessárias, RLS ou autorização explícita, sem novas capacidades administrativas.
- **Integridade:** somas em centavos, pagamentos parciais, múltiplas alocações, estornos, cobranças em aberto, transferências e abertura, categorias ausentes, períodos vazios, truncamento, concorrência/snapshot e igualdade com o resumo operacional no cenário comprovável.
- **Apresentação:** detalhe por origem com descrição/categoria efetivas, ranking com base declarada, saldo inicial/atual/evolução denominados corretamente; responsivo desktop/mobile, estados vazio/erro/negado, paginação completa e nenhuma soma local como total global.
- **Evidência:** adicionar testes de backend/PostgreSQL descartável e de frontend proporcionais ao novo contrato. Só classificar *codificado/integrado* após CI; ativação de migration/DEV, JWT real e homologação com dados de teste dependem de autorização específica.
- **Preservação:** não reexecutar gates A/B já aprovados sem alteração material, não tocar PROD, não criar dados financeiros persistentes sem autorização. Fonte V35 HTML permanece somente leitura.

**Próximo executor:** M02.02-D após reconciliação da branch principal e requisitos específicos do HTML. Se a fonte não definir algum critério contábil, documentar o ponto e não inventar regra.
