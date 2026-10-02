# SESSION HANDOFF

2026-10-02 — preparo Supabase DEV da Corsys V35.

## Supabase DEV verificado — 2026-10-02
Projeto existente `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, região sa-east-1, plano Free, ACTIVE_HEALTHY. Usuário autorizou preparo DEV, migrations, dados fictícios e desenvolvimento com preview; cobranças devem ser apresentadas antes e produção depende de aprovação posterior. Nenhum projeto/branch pago criado.

19 migrations aplicadas. Histórico e nomes locais alinhados às versões atribuídas pelo conector; mapa e hashes de execução em `docs/engineering/v35-dev-runtime-manifest.json`. O manifesto da fonte conserva hashes originais históricos. As migrations 009 e 014 receberam correções antes da primeira aplicação bem-sucedida: chaves das tabelas de cancelamento e ordem de colunas da view de faturas. Migration posterior remove execução anônima de funções SECURITY DEFINER e restringe defaults de novos grants.

VERIFICADO: 138 tabelas públicas, todas com RLS; catálogo de views/helpers; invariantes financeiras com dados fictícios transacionais e rollback; pós-V31; quatro testes locais do guard DEV. Teste financeiro atualizado para publicar o plano contábil exigido pela V35. Advisor não aponta funções definer executáveis por anon. Permanecem 37 avisos de RPCs autenticadas (autorização interna requer teste comportamental) e três tabelas backend sem policies (negação por padrão).

NÃO AVALIADO: login/JWT real, isolamento entre tenants com usuários reais, MFA/AAL2, concorrência/idempotência, configuração Auth cloud, build do frontend herdado, preview Cloudflare e produção. Dados financeiros transacionais revertidos; usuários Auth e fixtures básicas agora persistem em DEV. Credencial administrativa Auth de DEV e dois usuários de teste devem ser provisionados em ambiente seguro; nunca colar secrets no chat ou commitá-los. Configuração TOML local não comprova configuração cloud.

## Próxima ação
1. Provisionar credenciais Auth DEV de modo seguro e criar dois usuários fictícios pelo admin Auth; executar kit de isolamento existente.
2. Exercitar MASTER/BILLING/SUPPORT com AAL1/AAL2, suspensão e concorrência/idempotência.
3. Integrar UI financeira responsiva após aprovação desses gates; preparar preview Cloudflare sem cobrança nova antes de informar usuário.

## Git e continuidade
Branch `feat/v35-dev-gate-20261002`, PR draft https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/4, base `feat/v35-foundation`. Nenhum merge ou deploy. Frontend React/Vite preservado. CI inicial 36965906504 success; CI desta atualização pendente. Release BLOCKED por gates comportamentais e produto/deploy.

## Variáveis
Somente nomes: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_DEV_PROJECT_REF, CORSYS_DEV_FIXTURE_ACK, TEST_ADMIN_A_EMAIL, TEST_ADMIN_A_PASSWORD, TEST_ADMIN_B_EMAIL, TEST_ADMIN_B_PASSWORD.
## Atualização das fixtures — 2026-10-02
Usuário autorizou dois e-mails para login de teste (mantidos no ambiente, não registrados aqui), criação de duas Lojas e continuidade DEV. Criadas CORSYS DEV TENANT A (DEV-A) e B (DEV-B), cada uma com um integrante fictício e roles ADMIN/TREASURER/VIEWER/MEMBER. Seed reproduzível em dev-gate/seed-dev-organizations.sql. Na conferência anterior, usuários Auth ainda não existiam; foram posteriormente criados pelo usuário e vinculados nesta etapa. Conector não possui criação de usuários Auth; secret administrativa não disponível. Necessário acesso Auth admin seguro ou autorização de fallback para painel Supabase no navegador. CI do commit f3498ba9521855793447090ed57a9b37ca5dbca3: ambas as execuções concluídas com success.

## Auth e isolamento SQL — 2026-10-02
Dois usuários criados pelo usuário no painel Auth, e-mails confirmados, vinculados como ADMIN somente às respectivas Lojas DEV. Nenhuma senha acessada ou alterada. Seed de vínculo parametrizado por UUID em dev-gate/bind-existing-auth-users.sql.

19 migrations aplicadas; nova support_policy_helper_permissions corrige falta de EXECUTE para authenticated em private.is_tenant_user(uuid), usado pelo RLS de chamados, e private.has_aal2(), usado pelas views administrativas. anon/PUBLIC continuam sem EXECUTE. Falha original reproduzida com papel authenticated; após correção, teste de leitura/escrita legítima e negação cruzada aprovado em ambos os tenants.

VERIFICADO: scripts/verify_dev_role_isolation.sql (SET ROLE authenticated/anon + claims simuladas): organizações/integrantes próprios visíveis, outros ocultos; chamado próprio criado e lido; criação cruzada negada com 42501; configuração/staff/catálogos administrativos ocultos; helper administrativo bloqueado em AAL1; anônimo sem linhas. Escritas do teste revertidas. Catálogo de permissões aprovado.

NÃO AVALIADO: login com senha, assinatura JWT e HTTP/Data API, MFA real, concorrência/idempotência e suspensão. SET ROLE/claims simuladas não substituem autenticação real. Próximo: testes de sessão real em ambiente seguro e aplicação/preview; nenhum secret deve ser colado no chat. Cloudflare e produção ainda pendentes.
