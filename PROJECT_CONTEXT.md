# PROJECT CONTEXT — Corsys.TroncoDigital

## Produto e usuários
SaaS multi-tenant de tesouraria, gestão financeira e DRE para Lojas Maçônicas. Papéis: Master, Support/Billing, administrador da Loja, tesoureiro, consulta e integrante.

## Estado observado — 2026-10-02
Base anterior: `main@4142ff1c63855d71bbf94bdf3f61ec8bdcde3d9a`, documentação ECC sem código de produto. Esta etapa incorpora fundação SQL V35 e ferramentas de validação em `feat/v35-dev-gate-20261002`.

## Fonte funcional
`corsys-v35-supabase-dev-gate.zip`, identificado e recuperado nesta sessão. 16 migrations originais importadas; hashes históricos em `docs/engineering/v35-source-manifest.json`. Documentos de domínio em `docs/`; ADRs herdados em `docs/adr/v35/`. Relatórios herdados descrevem revisões históricas, não execução atual.

## Stack
- Implementado nesta etapa: PostgreSQL SQL/migrations, Node.js ESM para gate DEV, parser Python para gramática SQL.
- Dependências fixadas e lockfile: `dev-gate/package.json` e `package-lock.json`.
- Arquitetura alvo herdada: Next.js/React/TypeScript; aplicação web responsiva/PWA-ready para desktop e mobile; Supabase Auth/Postgres/Storage; Cloudflare para deploy.
- Frontend: estrutura inicial React/Vite/TypeScript observada em branch existente; backend HTTP/Storage/billing provider ainda não implementados ou configurados.
- Nenhuma escrita financeira offline no MVP.

## Regras críticas
`organization_id` delimita tenant. Obrigação não é pagamento; recebível não é caixa. Fatos postados não são sobrescritos. Valores financeiros são exatos. Saldos são derivados. Comandos exigem autorização determinística; suspensão bloqueia escritas. Billing SaaS permanece separado da tesouraria. Master exige AAL2.

## Ambientes e repositório
- Repositório privado: `MichaelDeCarvalho/Corsys.TroncoDigital`.
- Principal: `main`; mudanças relevantes via branch e PR.
- Local: checks estáticos e unitários executados; Docker/Postgres indisponíveis nesta sessão.
- Supabase DEV: projeto autorizado `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc; 18 migrations aplicadas.
- Cloudflare/produção: nenhuma alteração executada.

## Próximo marco e critério de pronto
Concluir JWT/RLS cross-tenant, MFA e concorrência/idempotência em DEV. Migrations, catálogo e invariantes SQL já executados. Somente então integrar UI financeira real. A interface React/Vite preexistente não foi reescrita. Checks estáticos não aprovam produção.

## Continuidade
Ler `CURRENT_ARCHITECTURE.md`, `SECURITY_REGISTER.md`, `RELEASE_CHECKLIST.md` e `SESSION_HANDOFF.md`. Metodologia ECC permanece seletiva.

## Branch preexistente preservada
Ao conferir branches foi identificado `feat/v35-foundation@d1aa2540c6c5506fb8ec3cdb0b61b630ed935872`, com estrutura React/Vite/TypeScript e cliente Supabase. Esta entrega deriva dessa revisão e preserva o frontend sem alterações. A arquitetura Next.js do pacote é alvo histórico, não stack atual nem decisão de migração. Testes/build do frontend herdado NÃO EXECUTADOS nesta etapa.

## Supabase DEV verificado — 2026-10-02
Projeto existente `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, região sa-east-1, plano Free, ACTIVE_HEALTHY. Usuário autorizou preparo DEV, migrations, dados fictícios e desenvolvimento com preview; cobranças devem ser apresentadas antes e produção depende de aprovação posterior. Nenhum projeto/branch pago criado.

18 migrations aplicadas. Histórico e nomes locais alinhados às versões atribuídas pelo conector; mapa e hashes de execução em `docs/engineering/v35-dev-runtime-manifest.json`. O manifesto da fonte conserva hashes originais históricos. As migrations 009 e 014 receberam correções antes da primeira aplicação bem-sucedida: chaves das tabelas de cancelamento e ordem de colunas da view de faturas. Migration posterior remove execução anônima de funções SECURITY DEFINER e restringe defaults de novos grants.

VERIFICADO: 138 tabelas públicas, todas com RLS; catálogo de views/helpers; invariantes financeiras com dados fictícios transacionais e rollback; pós-V31; quatro testes locais do guard DEV. Teste financeiro atualizado para publicar o plano contábil exigido pela V35. Advisor não aponta funções definer executáveis por anon. Permanecem 37 avisos de RPCs autenticadas (autorização interna requer teste comportamental) e três tabelas backend sem policies (negação por padrão).

NÃO AVALIADO: login/JWT real, isolamento entre tenants com usuários reais, MFA/AAL2, concorrência/idempotência, configuração Auth cloud, build do frontend herdado, preview Cloudflare e produção. Dados fictícios do teste financeiro foram revertidos; usuários Auth e fixtures persistentes ainda não criados. Credencial administrativa Auth de DEV e dois usuários de teste devem ser provisionados em ambiente seguro; nunca colar secrets no chat ou commitá-los. Configuração TOML local não comprova configuração cloud.
