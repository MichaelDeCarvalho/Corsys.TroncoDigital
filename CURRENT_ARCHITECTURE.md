# CURRENT ARCHITECTURE

## Estado real — 2026-10-02
Fundação SQL V35 e gate de validação versionados nesta branch; estrutura inicial frontend React/Vite herdada da branch existente, sem integração financeira real e sem backend HTTP. Não há deploy.

## Banco aplicado em DEV
`supabase/migrations/`: 16 baselines (009 e 014 corrigidas antes de aplicação) + 2 correções de permissões. Domínios: organizações/roles/integrantes, financeiro imutável, planos contábeis por vigência, AP/AR institucional, conciliação/orçamento/documentos/LGPD, SaaS billing/control plane, suporte/onboarding e catálogo V35.

As tabelas, views, policies, triggers e RPCs estão descritos em SQL. Existência em Supabase DEV: VERIFICADA. Bootstrap está em `docs/BOOTSTRAP.md`.

## Ferramentas executáveis
- `dev-gate/`: fixtures Auth/admin em servidor local e testes usando chaves publicáveis/JWT de usuários normais.
- Guard: alvo cloud DEV exato, acknowledgement DEV_ONLY, identidades/tenants distintos e fixture vinculada ao projeto.
- `scripts/check_sql.py`: gramática SQL; não valida corpos PL/pgSQL, dependências, RLS ou concorrência.
- `scripts/verify_*`: verificações de banco executadas em DEV; invariantes financeiras com rollback.
- `supabase/config.toml`: configuração local gerada pela CLI; não sincronizada com cloud. Signups públicos desabilitados, MFA TOTP habilitado.

## Segurança prevista e correção
RLS, views security_invoker, grants mínimos e comandos financeiros server-side fazem parte do schema preparado. A migration adicional permite execução dos helpers administrativos apenas para usuários autenticados e verifica MASTER/BILLING + AAL2 dentro das funções; views filtram esse público. Comportamento real ainda não comprovado.

## GitHub / CI
Workflow `foundation-checks.yml`: syntax JS, testes do guard e gramática SQL; somente contents:read; actions fixadas por SHA; sem secrets ou deploy. CI inicial 36965906504 aprovada; revisão após esta atualização pendente. Resultado estático aprovado não libera release.

## Arquitetura alvo
Next.js/React/TypeScript responsivo, Supabase e Cloudflare. A aplicação existente usa React/Vite/TypeScript; Next.js é referência histórica, sem decisão de migração. Configuração Cloudflare ainda pendente. Referência anexada em `docs/engineering/cloudflare-engineering.md`; ela não é configuração aplicada.

## Limitações
DEV preparado e testes financeiros SQL aprovados; sem JWT real, MFA ou concorrência executados; Storage privado e provedor de billing pendentes; sem URL de preview/produção.

## Branch preexistente preservada
Ao conferir branches foi identificado `feat/v35-foundation@d1aa2540c6c5506fb8ec3cdb0b61b630ed935872`, com estrutura React/Vite/TypeScript e cliente Supabase. Esta entrega deriva dessa revisão e preserva o frontend sem alterações. A arquitetura Next.js do pacote é alvo histórico, não stack atual nem decisão de migração. Testes/build do frontend herdado NÃO EXECUTADOS nesta etapa.

## Supabase DEV verificado — 2026-10-02
Projeto existente `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, região sa-east-1, plano Free, ACTIVE_HEALTHY. Usuário autorizou preparo DEV, migrations, dados fictícios e desenvolvimento com preview; cobranças devem ser apresentadas antes e produção depende de aprovação posterior. Nenhum projeto/branch pago criado.

18 migrations aplicadas. Histórico e nomes locais alinhados às versões atribuídas pelo conector; mapa e hashes de execução em `docs/engineering/v35-dev-runtime-manifest.json`. O manifesto da fonte conserva hashes originais históricos. As migrations 009 e 014 receberam correções antes da primeira aplicação bem-sucedida: chaves das tabelas de cancelamento e ordem de colunas da view de faturas. Migration posterior remove execução anônima de funções SECURITY DEFINER e restringe defaults de novos grants.

VERIFICADO: 138 tabelas públicas, todas com RLS; catálogo de views/helpers; invariantes financeiras com dados fictícios transacionais e rollback; pós-V31; quatro testes locais do guard DEV. Teste financeiro atualizado para publicar o plano contábil exigido pela V35. Advisor não aponta funções definer executáveis por anon. Permanecem 37 avisos de RPCs autenticadas (autorização interna requer teste comportamental) e três tabelas backend sem policies (negação por padrão).

NÃO AVALIADO: login/JWT real, isolamento entre tenants com usuários reais, MFA/AAL2, concorrência/idempotência, configuração Auth cloud, build do frontend herdado, preview Cloudflare e produção. Dados fictícios do teste financeiro foram revertidos; usuários Auth e fixtures persistentes ainda não criados. Credencial administrativa Auth de DEV e dois usuários de teste devem ser provisionados em ambiente seguro; nunca colar secrets no chat ou commitá-los. Configuração TOML local não comprova configuração cloud.
