# CURRENT ARCHITECTURE

React 19 + Vite 6 + TypeScript, cliente supabase-js browser com chave publicável. PostgreSQL/Supabase Auth em DEV. Não há servidor HTTP próprio; consultas usam Data API com RLS, chamados usam RPC autorizada. Sem Storage/billing provider integrados.

src/auth: login e ciclo de sessão. src/lib/tenant-data.ts: selects limitados e RPC de suporte. Workspace é recriado ao trocar tenant; abort e revisão impedem exposição por respostas atrasadas. Busca de integrantes local sobre até 200; chamados mostram até 100 recentes. Valores exibidos são contagens carregadas, não totais globais.

Persistência de sessão usa SDK; secrets administrativos ficam fora do browser. CSP permite apenas o projeto DEV. wrangler.dev.jsonc publica somente assets, sem Worker dinâmico, domínio ou configuração de produção. Build exige URL HTTPS e chave sb_publishable; .env.local é ignorado.

Ferramentas: dev-gate (Node ESM), scripts/check_sql.py (gramática apenas), scripts/verify_* (banco). supabase/config.toml é configuração local, não comprova Auth cloud. Workflow foundation-checks.yml possui jobs static e frontend, contents:read, actions fixadas por SHA, sem deploy/secrets.

## Estado verificado em 2026-10-02

Supabase DEV autorizado: `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, plano Free. 19 migrations aplicadas; 138 tabelas públicas com RLS. Dois usuários Auth confirmados, cada um ADMIN de sua própria Loja DEV, com um integrante fictício em cada Loja. Senhas não acessadas ou alteradas.

Catálogo de permissões, invariantes financeiras e pós-V31 aprovados. Isolamento via SET ROLE authenticated/anon e claims simuladas aprovado: leitura própria, ocultação cruzada, chamado próprio, criação cruzada negada, helpers administrativos negados em AAL1. Escritas transacionais dos testes revertidas. Essa evidência não substitui login/JWT real pela Data API.

Frontend React/Vite/TypeScript conectado ao Supabase: login por senha, validação de sessão por getUser, logout local, seleção de Loja, integrantes com busca e criação/listagem de chamados. Auth callback síncrono; respostas atrasadas descartadas; dados removidos ao trocar usuário/tenant. RLS e RPCs são a fronteira de autorização. Sem lançamentos financeiros na interface.

Dependências fixadas, lockfile raiz, configuração exclusiva Cloudflare DEV de assets estáticos e headers de segurança. CI separa testes frontend dos testes do guard DEV; usa chave publicável fictícia para build, sem Auth real ou deploy.

## Pendências

Login real com os dois usuários, HTTP/JWT cross-tenant, MFA/AAL2, suspensão e concorrência/idempotência ainda não avaliados. Testes da interface usam client simulado. Preview remoto depende de autenticação Cloudflare: wrangler whoami informou sessão ausente. Nenhum deploy, upgrade, cobrança ou alteração em produção efetuado. Qualquer custo deve ser apresentado antes; produção depende de aprovação posterior.

Advisors: 37 avisos de RPCs definer autenticadas, três tabelas backend sem policies (negação por padrão), proteção contra senhas vazadas desabilitada. Remediação Auth deve considerar eventual custo antes da ativação.
