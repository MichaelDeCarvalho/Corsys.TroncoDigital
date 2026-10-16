# ADR-0002 — Incorporar a fundação V35 e validar DEV antes da UI financeira

- Status: accepted
- Data: 2026-10-02
- Contexto: repositório com governança ECC, sem aplicação; pacote V35 contém 16 migrations preparadas e gate DEV.
- Decisão: incorporar migrations sem alterar seus bytes, documentos de domínio e kit de testes; preservar governança existente. ADRs herdados ficam em `docs/adr/v35/` para evitar colisão com ADR-0001 ECC.
- Correção adicional: migration gerada pela CLI restaura EXECUTE dos helpers das views administrativas, exige staff MASTER/BILLING com AAL2 dentro das funções e filtra as views para esse público.
- Arquitetura alvo herdada: Next.js/React/TypeScript, web responsiva, Supabase, Cloudflare; nenhum frontend novo foi criado nesta etapa; estrutura React/Vite existente foi preservada.
- Alternativa rejeitada: conectar UI financeira a schema nunca executado.
- Segurança: teste RLS com JWT real é gate obrigatório; grants, SQL parser e testes locais não comprovam isolamento.
- Dados: migrations originais não foram aplicadas; nenhuma base externa foi alterada.
- Rollout: projeto Supabase DEV dedicado → 001–016 + forward fix → catálogo/invariantes → JWT/RLS/MFA → concorrência/idempotência → UI.
- Rollback: reverter o PR antes de aplicar; depois de aplicado, usar correção posterior versionada. Nunca resetar produção.
- Riscos: dependências entre migrations, PL/pgSQL, grants e triggers ainda precisam de execução real.

## Branch preexistente preservada
Ao conferir branches foi identificado `feat/v35-foundation@d1aa2540c6c5506fb8ec3cdb0b61b630ed935872`, com estrutura React/Vite/TypeScript e cliente Supabase. Esta entrega deriva dessa revisão e preserva o frontend sem alterações. A arquitetura Next.js do pacote é alvo histórico, não stack atual nem decisão de migração. Testes/build do frontend herdado NÃO EXECUTADOS nesta etapa.
