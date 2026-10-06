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

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.


## Etapa 1 iniciada — 2026-10-05 Brasil / 2026-10-06 UTC

Proprietário autorizou avançar pela sequência de oito etapas. docs/V35_DELIVERY_PLAN.md registra estado/evidência e pendências. Decisões comerciais em docs/adr/0005-commercial-launch-decisions.md e config/commercial-decisions.json: dois planos BRL 125/180 mensais, cobrança manual e futura Stripe preferencial; suporte interno/WhatsApp manual, automação futura; domínio pendente. Configuração registrada, catálogo/integrações ainda não ativados.

SQL de catálogo e isolamento reexecutado com sucesso. Novo scripts/verify_dev_subscription_and_staff.sql passou após corrigir fixture publicada sem timestamp: tolerância/suspensão/override, limites de staff/AAL e proteção do último Master; claims simuladas, helpers/triggers, rollback conferido sem dados temporários. Não equivale a HTTP/JWT/MFA reais ou comandos financeiros completos. dev-gate possui roteiro HTTP reforçado e exemplo dos UUIDs existentes, sem necessidade de chave administrativa. Oito testes locais passaram; roteiro HTTP autenticado ainda não executado por ausência das senhas em ambiente seguro. Não solicitar senhas/tokens pelo chat nem alterar credenciais existentes. Nenhuma migration, grant, schema, frontend, produção ou serviço pago alterado.
