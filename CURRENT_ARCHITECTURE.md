# CURRENT ARCHITECTURE

## Estado real — 2026-10-02
Fundação SQL V35 e gate de validação versionados nesta branch; estrutura inicial frontend React/Vite herdada da branch existente, sem integração financeira real e sem backend HTTP. Não há deploy.

## Banco preparado
`supabase/migrations/`: 16 originais + 1 forward fix. Domínios: organizações/roles/integrantes, financeiro imutável, planos contábeis por vigência, AP/AR institucional, conciliação/orçamento/documentos/LGPD, SaaS billing/control plane, suporte/onboarding e catálogo V35.

As tabelas, views, policies, triggers e RPCs estão descritos em SQL. Existência em ambiente Supabase real: NÃO AVALIADA. Bootstrap está em `docs/BOOTSTRAP.md`.

## Ferramentas executáveis
- `dev-gate/`: fixtures Auth/admin em servidor local e testes usando chaves publicáveis/JWT de usuários normais.
- Guard: alvo cloud DEV exato, acknowledgement DEV_ONLY, identidades/tenants distintos e fixture vinculada ao projeto.
- `scripts/check_sql.py`: gramática SQL; não valida corpos PL/pgSQL, dependências, RLS ou concorrência.
- `scripts/verify_*`: verificações transacionais de banco; ainda não executadas.
- `supabase/config.toml`: configuração local gerada pela CLI; não sincronizada com cloud. Signups públicos desabilitados, MFA TOTP habilitado.

## Segurança prevista e correção
RLS, views security_invoker, grants mínimos e comandos financeiros server-side fazem parte do schema preparado. A migration adicional permite execução dos helpers administrativos apenas para usuários autenticados e verifica MASTER/BILLING + AAL2 dentro das funções; views filtram esse público. Comportamento real ainda não comprovado.

## GitHub / CI
Workflow `foundation-checks.yml`: syntax JS, testes do guard e gramática SQL; somente contents:read; actions fixadas por SHA; sem secrets ou deploy. CI remota ainda não observada nesta etapa. Resultado estático aprovado não libera release.

## Arquitetura alvo
Next.js/React/TypeScript responsivo, Supabase e Cloudflare. Framework, adaptador Cloudflare e configuração de build precisam ser confirmados quando o frontend existir. Referência anexada em `docs/engineering/cloudflare-engineering.md`; ela não é configuração aplicada.

## Limitações
Sem projeto Supabase DEV selecionado/criado; sem runtime PostgreSQL/Docker; sem JWT real, MFA, testes financeiros ou concorrência executados; Storage privado e provedor de billing pendentes; sem URL de preview/produção.

## Branch preexistente preservada
Ao conferir branches foi identificado `feat/v35-foundation@d1aa2540c6c5506fb8ec3cdb0b61b630ed935872`, com estrutura React/Vite/TypeScript e cliente Supabase. Esta entrega deriva dessa revisão e preserva o frontend sem alterações. A arquitetura Next.js do pacote é alvo histórico, não stack atual nem decisão de migração. Testes/build do frontend herdado NÃO EXECUTADOS nesta etapa.
