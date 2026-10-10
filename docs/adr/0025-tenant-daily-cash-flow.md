# ADR 0025 — Separar fluxo de caixa realizado de obrigações por vencimento

Status: DEV aprovado para testes, 2026-10-10.

## Contexto
A tela `view-fluxo-caixa` do HTML V35 exige movimentações operacionais, projetadas e leitura diária. O backend já tem uma view de movimentações contendo recebimentos, pagamentos, estornos, abertura patrimonial e transferências internas. Somar indiscriminadamente esses eventos ou somar páginas paginadas criaria fluxo operacional enganoso.

## Decisão
Adicionar `read_tenant_daily_cash_flow(org,inicio,fim)`, RPC SECURITY DEFINER read-only com `finance.read`, intervalos de 1–93 dias e testes de integridade. O realizado diário contém apenas entradas operacionais de integrantes/recebíveis institucionais e desembolsos de despesas institucionais, líquidos de estornos. Transferências de banco/caixa e saldos de abertura são excluídos. A projeção é outro conjunto: obrigações ainda em aberto, classificadas pela data de vencimento original, sem supor pagamento/recebimento garantidos nem adicionar ao realizado.

## Validação/limites
SQL A/B com ROLLBACK `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS` em setembro/2026 reconciliou integralmente receipts em ambas as Lojas e as posições de cobrança por vencimento, bloqueou usuário de outra Loja, anon e período maior que 93 dias. Frontend consulta RPC e valida o conjunto completo de datas/equações financeiras. Ainda não implementa gráficos/saldo cumulativo e forecast real probabilístico do piloto. JWT HTTP assinado, testes de concorrência e QA visual não são cobertos pelo SQL executor. Sem produção.

