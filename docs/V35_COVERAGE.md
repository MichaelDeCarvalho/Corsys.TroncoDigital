# V35 — preservação do escopo e cobertura de implementação

## Contrato de continuidade

A V35 é o escopo mínimo do produto, por instrução do proprietário em 2026-10-02. Implementar por etapas não remove telas, parâmetros, regras ou ideias do escopo. Não substituir funções do banco por regras inventadas no frontend. Mudanças incompatíveis exigem decisão explícita registrada; fatos financeiros e histórico comercial permanecem preservados.

Fonte: `corsys-v35-supabase-dev-gate.zip`, SHA-256 `2679c70bcf64b4c914d30fdd84778f13bae915e1ae278d71b7b0d684db8ef98b`. O ZIP reenviado é idêntico à fonte importada. Contém 16 migrations, 29 ADRs, dicionários e matrizes de testes; **não contém HTML/CSS/JS nem capturas das telas do piloto**. Assim, a preservação das especificações documentadas é verificável, mas a equivalência visual/funcional integral com o piloto continua NÃO AVALIADA. Incorporar o HTML original quando disponibilizado, sem tratá-lo como autorização de backend.

A base foi importada para 19 migrations DEV: 16 baselines, correções 009/014 pré-aplicação e três migrations adicionais de segurança. Os hashes históricos e aplicados têm manifestos separados. Nenhuma migration, grant, policy ou função do banco foi alterada neste incremento.

## Matriz de cobertura

“Base presente” significa schema/RPC/decisões existentes no pacote aplicado; não significa todos os cenários de runtime aprovados. “Pendente” mantém o requisito obrigatório no backlog.

| Domínio V35 | Backend / fonte preservada | Frontend atual | Aceite ainda necessário |
|---|---|---|---|
| Identidade, Lojas e permissões | Auth, organizations, user_roles, RLS | Login/logout e seleção de Loja | JWT negativo, suspensão e perfis não-admin |
| Integrantes e vínculos | members, member_user_links, member_offices | Listagem e busca | Cadastro/edição, todos os campos do dicionário, vínculos e portal |
| Mensalidades e recorrência | recurring_rules, recurring_member_terms, versões | Consulta de cobranças | Configuração, geração por competência, recorrência idempotente |
| Cobranças, créditos e posição | charges, adjustments, allocations, credit balances | Valores efetivo/em aberto e situação, paginados | Extrato, negociação e comandos de correção |
| Pagamentos de integrantes | payments e reversões | Pendente | Registro, alocação, estorno e concorrência |
| Plano contábil por vigência | accounting_plans/accounts/mappings | Pendente | Rascunho/publicação, vigência, imutabilidade |
| Contas a pagar | payables, corrections, cancellations, approval state | Consulta de fatos postados e aprovação | Cadastro, correção, cancelamento e liquidação |
| Contas a receber institucionais | receivables, corrections, receipts | Consulta de fatos postados | Cadastro, recebimento, alocação e correções |
| Aprovação de despesas | Políticas versionadas, threshold, snapshots, decisões | Situação na consulta de contas a pagar | Parametrização, fila e decisão autorizada |
| Caixa, bancos e fundos | financial_accounts, movimentos, transferências, fundos | Pendente | Saldos derivados, abertura, extratos e transferências |
| DRE e orçamento | v_dre_entries, budgets, budget_vs_actual | Pendente | Período, plano, fundos, competência e relatórios |
| Conciliação bancária | statement imports, linhas e matches | Pendente | Importação validada, vinculação e desfazimento |
| Fechamento e histórico legado | Períodos fechados, legacy_financial_records | Pendente | Fechamento/reabertura autorizada; legado non-posting |
| Comunicação e privacidade | Preferências, comunicações e privacy requests | Pendente | Estados, solicitações e minimização de dados |
| Clientes e assinaturas SaaS | Control plane, ciclo comercial e contatos | Pendente | Master separado, AAL2, ativação/suspensão/retomada |
| Planos SaaS V35 | Rascunhos, snapshots, versões, vigência e entitlements | Pendente | CRUD autorizado, publicação, filtros, ativação e exclusão bloqueada |
| Promoções V35 | Séries, rascunhos, publicação e resgates | Pendente | Edição, ativação e exclusão apenas se nunca usada/publicada |
| Billing SaaS | Faturas, pagamentos, alocações, multa/juros, acordos | Pendente | Valores-base/encargos/pago/saldo e separação total do financeiro da Loja |
| Onboarding controlado | Runs/eventos e retomada por etapa | Pendente | Cinco etapas; convites Auth apenas por backend autorizado |
| Suporte e SLA | Chamados tenant/internos, mensagens, métricas e sessões | Abertura/listagem de chamados próprios | Conversas, Kanban Master, primeira resposta, SLA e sessões auditadas |
| Configuração da plataforma e equipe | Settings tipadas, platform_staff, proteção último Master | Pendente | MFA, administração e operações privilegiadas |
| Web/mobile | ADR-0015, mesma autorização, sem escrita offline | Layout adaptativo, navegação móvel, consulta com scroll interno | Revisão visual em celular real; piloto visual ainda ausente |
| Arquivos e integrações | Responsabilidades definidas na arquitetura | Pendente | Storage privado e providers; custos apresentados antes |

## Regras que a interface deve respeitar

- Saldo calculado no backend; não editável nem substituído por soma parcial no navegador.
- Obrigação não é pagamento; recebível não é caixa; mensalidade de integrante não é mensalidade SaaS.
- Correção/estorno/cancelamento por eventos, nunca UPDATE/DELETE de fato financeiro confirmado.
- Valor monetário exato no banco; alocação sem excesso, mesmo integrante/tenant, fechamento e idempotência.
- Versionamento de planos, preço, promoção, políticas e vigências preserva snapshots anteriores.
- Entitlement e permissão são validados no servidor; esconder botão não concede nem revoga acesso.
- Master/Support/Billing exigem AAL2; suporte cross-tenant temporário, auditado e read-only.
- Uma lista vazia não comprova que o usuário vê todo o financeiro. RLS pode reduzir resultados conforme seu papel.

## Verificação de preservação

`python scripts/check_v35_preservation.py` verifica presença de 51 documentos, hashes de 29 ADRs e 19 migrations aplicadas, além de 263 declarações SQL originais. A CI executa o mesmo gate. Ele detecta alterações/remoções dessas referências; **não prova comportamento das funções, ausência de DROP posterior, paridade de telas ou completude de todas as regras**. Testes funcionais e de autorização continuam obrigatórios. Novas evoluções devem ser aditivas; mudança intencional das referências exige reconciliação registrada.

## Sequência de evolução

1. Consultas financeiras usando views existentes (este incremento).
2. Validar HTTP/JWT positivo/negativo, MFA, suspensão, idempotência e concorrência, antes de liberar comandos financeiros.
3. Completar integrantes/parametrizações e fluxos financeiros conforme dicionários e matrizes, sem perder os domínios acima.
4. Entregar control plane Master com a matriz V35 de planos/promoções, onboarding e suporte/SLA.
5. Confrontar o HTML original do piloto e homologar desktop/mobile e todos os fluxos antes da aprovação de produção.

## Decisões originais rastreáveis

Cada decisão continua obrigatória para o módulo correspondente, inclusive as duas ADRs numeradas 0026 na origem.

| Decisão | Fonte |
|---|---|
| ADR-001 — Fonte única da verdade financeira | [0001-financial-source-of-truth.md](../docs/adr/0001-financial-source-of-truth.md) |
| ADR-002 — Saldos derivados | [0002-derived-balances.md](../docs/adr/0002-derived-balances.md) |
| ADR-003 — Imutabilidade financeira | [0003-financial-immutability.md](../docs/adr/0003-financial-immutability.md) |
| ADR-004 — Cobrança e pagamento são fatos independentes | [0004-charge-payment-separation.md](../docs/adr/0004-charge-payment-separation.md) |
| ADR-005 — Recebíveis e caixa separados | [0005-receivable-cash-separation.md](../docs/adr/0005-receivable-cash-separation.md) |
| ADR-006 — Pagamento é um único fato financeiro | [0006-payment-single-fact.md](../docs/adr/0006-payment-single-fact.md) |
| ADR-007 — Regras recorrentes versionadas | [0007-versioned-recurring-rules.md](../docs/adr/0007-versioned-recurring-rules.md) |
| ADR-008 — Idempotência no backend e banco | [0008-idempotency.md](../docs/adr/0008-idempotency.md) |
| ADR-009 — Fechamento append-only | [0009-period-closing.md](../docs/adr/0009-period-closing.md) |
| ADR-010 — Comandos financeiros transacionais | [0010-transactional-commands.md](../docs/adr/0010-transactional-commands.md) |
| ADR-011 — Histórico legado não reconciliado é non-posting | [0011-legacy-non-posting.md](../docs/adr/0011-legacy-non-posting.md) |
| ADR-0012 — SaaS multi-tenant por organização | [0012-saas-multitenancy.md](../docs/adr/0012-saas-multitenancy.md) |
| ADR-0013 — Billing SaaS separado do financeiro das Lojas | [0013-saas-billing-separation.md](../docs/adr/0013-saas-billing-separation.md) |
| ADR-0014 — Master e suporte não são papéis de tenant | [0014-master-support-boundary.md](../docs/adr/0014-master-support-boundary.md) |
| ADR-0015 — Web responsiva e PWA-ready | [0015-web-mobile-delivery.md](../docs/adr/0015-web-mobile-delivery.md) |
| ADR-0016 — Plano de Contas por vigência | [0016-accounting-plans-effective-dating.md](../docs/adr/0016-accounting-plans-effective-dating.md) |
| ADR-0017 — Obrigações institucionais separadas de caixa | [0017-institutional-obligation-cash-separation.md](../docs/adr/0017-institutional-obligation-cash-separation.md) |
| ADR-0018 — Edição de lançamento postado vira correção auditável | [0018-posted-financial-corrections.md](../docs/adr/0018-posted-financial-corrections.md) |
| ADR-0019 — Aprovação de despesas por política versionada | [0019-expense-approval-policy-snapshot.md](../docs/adr/0019-expense-approval-policy-snapshot.md) |
| ADR-0020 — Conciliação, orçamento, importação e privacidade como domínios explícitos | [0020-reconciliation-budget-privacy.md](../docs/adr/0020-reconciliation-budget-privacy.md) |
| ADR-0021 — Histórico comercial SaaS separado dos tenants | [0021-saas-commercial-history.md](../docs/adr/0021-saas-commercial-history.md) |
| ADR-0022 — Versionamento de Planos SaaS e Promoções | [0022-saas-plan-versioning-and-promotions.md](../docs/adr/0022-saas-plan-versioning-and-promotions.md) |
| ADR-0023 — Inadimplência, encargos, suspensão e acordos | [0023-saas-dunning-late-fees-agreements.md](../docs/adr/0023-saas-dunning-late-fees-agreements.md) |
| ADR-0024 — Suporte Kanban e isolamento de tenant | [0024-support-kanban-and-tenant-isolation.md](../docs/adr/0024-support-kanban-and-tenant-isolation.md) |
| ADR-0025 — Configuração da Plataforma e MFA Master | [0025-platform-settings-and-master-mfa.md](../docs/adr/0025-platform-settings-and-master-mfa.md) |
| ADR-0026 — Onboarding controlado e retomável | [0026-controlled-onboarding.md](../docs/adr/0026-controlled-onboarding.md) |
| ADR-0026 — Lifecycle seguro de Planos SaaS e Ofertas | [0026-safe-plan-promotion-lifecycle.md](../docs/adr/0026-safe-plan-promotion-lifecycle.md) |
| ADR-0027 — Chamados, SLA operacional e chamados internos | [0027-master-support-sla-metrics.md](../docs/adr/0027-master-support-sla-metrics.md) |
| ADR-0028 — Encargos separados do valor-base da fatura | [0028-invoice-charge-breakdown.md](../docs/adr/0028-invoice-charge-breakdown.md) |
