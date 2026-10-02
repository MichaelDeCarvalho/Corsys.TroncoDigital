# PROJECT CONTEXT — Corsys.TroncoDigital

SaaS multi-tenant de tesouraria e gestão financeira para Lojas Maçônicas. Organization_id delimita tenant; obrigação não é pagamento; recebível não é caixa; fatos postados não são sobrescritos; saldos são derivados; Master exige AAL2. Sem escrita financeira offline.

Fonte funcional: pacote V35 importado, manifesto histórico em docs/engineering/v35-source-manifest.json e hashes efetivamente aplicados em v35-dev-runtime-manifest.json. Next.js é alvo histórico do pacote; stack atual preserva React/Vite/TypeScript da branch feat/v35-foundation.

Repo privado MichaelDeCarvalho/Corsys.TroncoDigital; branch feat/v35-dev-gate-20261002; PR draft #4, base feat/v35-foundation. Sem merge.

## Estado verificado em 2026-10-02

Supabase DEV autorizado: `szqkdekwhzxsoxorgvaz`, organização Michael - jobmcc, plano Free. 19 migrations aplicadas; 138 tabelas públicas com RLS. Dois usuários Auth confirmados, cada um ADMIN de sua própria Loja DEV, com um integrante fictício em cada Loja. Senhas não acessadas ou alteradas.

Catálogo de permissões, invariantes financeiras e pós-V31 aprovados. Isolamento via SET ROLE authenticated/anon e claims simuladas aprovado: leitura própria, ocultação cruzada, chamado próprio, criação cruzada negada, helpers administrativos negados em AAL1. Escritas transacionais dos testes revertidas. Essa evidência não substitui login/JWT real pela Data API.

Frontend React/Vite/TypeScript conectado ao Supabase: login por senha, validação de sessão por getUser, logout local, seleção de Loja, integrantes com busca e criação/listagem de chamados. Auth callback síncrono; respostas atrasadas descartadas; dados removidos ao trocar usuário/tenant. RLS e RPCs são a fronteira de autorização. Sem lançamentos financeiros na interface.

Dependências fixadas, lockfile raiz, configuração exclusiva Cloudflare DEV de assets estáticos e headers de segurança. CI separa testes frontend dos testes do guard DEV; usa chave publicável fictícia para build, sem Auth real ou deploy.

## Pendências

Login real com os dois usuários, HTTP/JWT cross-tenant, MFA/AAL2, suspensão e concorrência/idempotência ainda não avaliados. Testes da interface usam client simulado. Preview remoto depende de autenticação Cloudflare: wrangler whoami informou sessão ausente. Nenhum deploy, upgrade, cobrança ou alteração em produção efetuado. Qualquer custo deve ser apresentado antes; produção depende de aprovação posterior.

Advisors: 37 avisos de RPCs definer autenticadas, três tabelas backend sem policies (negação por padrão), proteção contra senhas vazadas desabilitada. Remediação Auth deve considerar eventual custo antes da ativação.
