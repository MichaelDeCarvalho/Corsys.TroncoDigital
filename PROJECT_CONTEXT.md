# PROJECT CONTEXT — Corsys.TroncoDigital

SaaS multi-tenant de tesouraria e gestão financeira para Lojas Maçônicas. organization_id delimita tenant; obrigação não é pagamento; recebível não é caixa; fatos postados não são sobrescritos; saldos são derivados; privilégios Master exigem AAL2. Sem escrita financeira offline.

## Escopo mínimo obrigatório

Preservar no mínimo todas as funcionalidades, parâmetros e ideias documentadas na V35, backend e frontend, conforme determinação do proprietário em 2026-10-02. Consultar docs/V35_COVERAGE.md antes de implementar cada módulo. Entrega incremental não é redução de escopo. O HTML V34 operacional foi recebido separadamente: docs/V35_PILOT_PARITY.md e docs/V35_PILOT_INVENTORY.md registram 21 telas e os controles dinâmicos como mínimo obrigatório junto com a V35. Análise estática realizada; paridade visual/cliques ainda pendentes.

Fontes: docs/engineering/v35-source-manifest.json (origem histórica), v35-dev-runtime-manifest.json (19 migrations efetivamente aplicadas) e v35-preservation-baseline.json (ADRs/documentos/declarações originais). Next.js é alvo histórico; stack atual mantém React/Vite/TypeScript da branch foundation.

## Ambiente e autorização

Repo MichaelDeCarvalho/Corsys.TroncoDigital; branch feat/v35-dev-gate-20261002; PR draft #4, base feat/v35-foundation. Não fazer merge/deploy produção sem aprovação. Supabase DEV szqkdekwhzxsoxorgvaz, organização Michael - jobmcc, plano Free. DEV, dados fictícios e preview autorizados; qualquer cobrança deve ser apresentada antes. Sem upgrade ou recurso pago introduzido neste incremento.

## Estado atual

19 migrations DEV aplicadas, 138 tabelas públicas com RLS; duas Lojas fictícias e dois usuários ADMIN vinculados separadamente. Preview: https://corsys-tronco-digital-dev.corsys1.workers.dev/ . Tela pública/assets verificados. Proprietário confirmou os dois logins e visibilidade somente da própria Loja em 2026-10-02. Senhas não acessadas.

Frontend: Auth verificada por getUser, logout, seleção de Loja, integrantes com busca, abertura/listagem de chamados e consultas paginadas de cobranças/contas a pagar/receber. Consultas financeiras usam views existentes, sem escrita ou recálculo de saldos. Outros módulos V35 mantidos no backlog obrigatório em docs/V35_COVERAGE.md.

## Evidência e limites

Catálogo/invariantes SQL e isolamento com roles/claims simuladas anteriormente aprovados. Nesta etapa as três views financeiras puderam ser consultadas sob role authenticated, retornando zero registros; isso não comprova leitura positiva de fatos nem isolamento cruzado com dados existentes/JWT real. A confirmação manual do proprietário também não substitui testes negativos HTTP/JWT.

Gates restantes: JWT/RLS positivo/negativo, AAL2/MFA, suspensão, concorrência/idempotência, revisão desktop/mobile do fluxo autenticado e paridade com o HTML original. Nenhuma liberação de produção.
