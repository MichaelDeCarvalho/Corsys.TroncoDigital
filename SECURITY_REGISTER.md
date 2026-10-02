# SECURITY REGISTER

> Nunca registrar secrets reais.

## Findings

| ID | Data | Categoria | Severidade | Status | Componente | Evidência | Mitigação |
|---|---|---|---|---|---|---|---|
| SEC-001 | 2026-10-02 | Cobertura | média | aberto | repositório | Código da aplicação ausente; controles não podem ser auditados | Versionar código real e executar revisão de auth, autorização, dados, entradas, secrets e deploy |
| SEC-002 | 2026-10-02 | CI/CD | informativa | aberto | GitHub | Nenhum workflow observado na revisão inspecionada | Definir checks somente após identificar stack e comandos reais |

## Controles críticos

| Controle | Default esperado | Evidência | Última revisão |
|---|---|---|---|
| Autenticação | fail-closed | NÃO AVALIADO | 2026-10-02 |
| Autorização | deny / least privilege | NÃO AVALIADO | 2026-10-02 |
| Isolamento de tenant | obrigatório quando multi-tenant | NÃO AVALIADO | 2026-10-02 |
| RLS | isolamento quando aplicável | NÃO AVALIADO | 2026-10-02 |
| Secrets | server-side | NÃO AVALIADO | 2026-10-02 |
| Webhooks | autenticados/verificados | NÃO AVALIADO | 2026-10-02 |
| CI/CD | least privilege | NÃO AVALIADO | 2026-10-02 |

## Exceções aceitas

Nenhuma exceção aceita registrada.

## Auditorias

| Data | Escopo | Tipo | Resultado | Limitações |
|---|---|---|---|---|
| 2026-10-02 | repositório GitHub | diagnóstico inicial ECC | NÃO AVALIADO para segurança do produto | somente README disponível; sem código/configuração do produto |

## Regra

Ausência de finding não significa ausência de vulnerabilidade. Scanners, buscas textuais e checklists são sinais; autorização, isolamento, persistência e comportamento devem ser testados no sistema real.


## Atualização V35 — 2026-10-02

| ID | Severidade | Estado | Evidência / ação |
|---|---|---|---|
| SEC-003 | média funcional | aplicada; teste de papéis pendente | Views V35 chamam helpers privados com EXECUTE revogado; forward fix concede execução a authenticated e verifica staff/AAL2 internamente, com filtro administrativo nas views |
| SEC-004 | alta para release | aberto | Catálogo RLS e invariantes financeiras SQL aprovados; JWT/RLS comportamental, MFA e concorrência pendentes; gate bloqueia release/UI financeira integrada |
| SEC-005 | preventiva | verificado somente local | Kit de fixture exige projeto DEV exato e identidades distintas; 4 testes locais aprovados |

SEC-001 evolui: fundação SQL incorporada; estrutura inicial frontend existe na branch herdada; backend HTTP e integrações continuam pendentes. SEC-002 evolui: CI estática adicionada na branch, resultado remoto pendente. Não foi realizada auditoria completa de segurança nesta etapa.

| SEC-006 | preventiva | mitigado em DEV | Grants explícitos do Supabase permitiam anon executar funções definer; revogados em migration, advisor confirma ausência desse finding |

## Supabase DEV verificado — 2026-10-02
Projeto existente `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, região sa-east-1, plano Free, ACTIVE_HEALTHY. Usuário autorizou preparo DEV, migrations, dados fictícios e desenvolvimento com preview; cobranças devem ser apresentadas antes e produção depende de aprovação posterior. Nenhum projeto/branch pago criado.

19 migrations aplicadas. Histórico e nomes locais alinhados às versões atribuídas pelo conector; mapa e hashes de execução em `docs/engineering/v35-dev-runtime-manifest.json`. O manifesto da fonte conserva hashes originais históricos. As migrations 009 e 014 receberam correções antes da primeira aplicação bem-sucedida: chaves das tabelas de cancelamento e ordem de colunas da view de faturas. Migration posterior remove execução anônima de funções SECURITY DEFINER e restringe defaults de novos grants.

VERIFICADO: 138 tabelas públicas, todas com RLS; catálogo de views/helpers; invariantes financeiras com dados fictícios transacionais e rollback; pós-V31; quatro testes locais do guard DEV. Teste financeiro atualizado para publicar o plano contábil exigido pela V35. Advisor não aponta funções definer executáveis por anon. Permanecem 37 avisos de RPCs autenticadas (autorização interna requer teste comportamental) e três tabelas backend sem policies (negação por padrão).

NÃO AVALIADO: login/JWT real, isolamento entre tenants com usuários reais, MFA/AAL2, concorrência/idempotência, configuração Auth cloud, build do frontend herdado, preview Cloudflare e produção. Dados fictícios do teste financeiro foram revertidos; usuários Auth e fixtures persistentes ainda não criados. Credencial administrativa Auth de DEV e dois usuários de teste devem ser provisionados em ambiente seguro; nunca colar secrets no chat ou commitá-los. Configuração TOML local não comprova configuração cloud.

## Auth e isolamento SQL — 2026-10-02
Dois usuários criados pelo usuário no painel Auth, e-mails confirmados, vinculados como ADMIN somente às respectivas Lojas DEV. Nenhuma senha acessada ou alterada. Seed de vínculo parametrizado por UUID em dev-gate/bind-existing-auth-users.sql.

19 migrations aplicadas; nova support_policy_helper_permissions corrige falta de EXECUTE para authenticated em private.is_tenant_user(uuid), usado pelo RLS de chamados, e private.has_aal2(), usado pelas views administrativas. anon/PUBLIC continuam sem EXECUTE. Falha original reproduzida com papel authenticated; após correção, teste de leitura/escrita legítima e negação cruzada aprovado em ambos os tenants.

VERIFICADO: scripts/verify_dev_role_isolation.sql (SET ROLE authenticated/anon + claims simuladas): organizações/integrantes próprios visíveis, outros ocultos; chamado próprio criado e lido; criação cruzada negada com 42501; configuração/staff/catálogos administrativos ocultos; helper administrativo bloqueado em AAL1; anônimo sem linhas. Escritas do teste revertidas. Catálogo de permissões aprovado.

NÃO AVALIADO: login com senha, assinatura JWT e HTTP/Data API, MFA real, concorrência/idempotência e suspensão. SET ROLE/claims simuladas não substituem autenticação real. Próximo: testes de sessão real em ambiente seguro e aplicação/preview; nenhum secret deve ser colado no chat. Cloudflare e produção ainda pendentes.
 
## Advisor Auth observado — 2026-10-02
Aviso auth_leaked_password_protection: proteção contra senhas vazadas desabilitada no Auth cloud. Não significa que as senhas de teste estejam comprometidas. Remediação e eventual dependência de plano/custo devem ser verificadas antes de ativar; nenhum upgrade autorizado ou executado. Permanecem 37 avisos de RPCs definer autenticadas e três tabelas backend sem policies.
