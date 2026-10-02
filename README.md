# Corsys.TroncoDigital — V35

SaaS de tesouraria para Lojas Maçônicas, com aplicação web responsiva planejada para desktop e mobile.

## Estado
Implementação iniciada: fundação SQL e kit de validação DEV. **Supabase DEV com 18 migrations aplicadas e invariantes SQL aprovadas; estrutura React/Vite herdada, sem integração financeira ou deploy.**

## Validar localmente
Node.js 22+ e Python 3.12:

```bash
npm ci --prefix dev-gate
npm run check --prefix dev-gate
python3 -m pip install -r scripts/requirements-checks.txt
python3 scripts/check_sql.py
```

Esses comandos validam sintaxe/gramática e guardas DEV. Não validam runtime do banco ou RLS.

## Próximo gate
Projeto DEV `szqkdekwhzxsoxorgvaz` já preparado. Concluir testes com usuários Auth reais. Executar `scripts/verify_security_catalog.sql`, invariantes financeiras, JWT/RLS, MFA e concorrência/idempotência. Consulte `docs/RUNBOOK_SUPABASE_DEV.md` e `dev-gate/README.md`.

## Continuidade
`AGENTS.md` → `PROJECT_CONTEXT.md` → `CURRENT_ARCHITECTURE.md` → código/ADRs → `SESSION_HANDOFF.md`.

Metodologia ECC: `docs/engineering/ecc-adoption.md`. Decisão desta etapa: `docs/adr/0002-v35-foundation-import.md`. ADRs históricos V35: `docs/adr/v35/`.

## Branch preexistente preservada
Ao conferir branches foi identificado `feat/v35-foundation@d1aa2540c6c5506fb8ec3cdb0b61b630ed935872`, com estrutura React/Vite/TypeScript e cliente Supabase. Esta entrega deriva dessa revisão e preserva o frontend sem alterações. A arquitetura Next.js do pacote é alvo histórico, não stack atual nem decisão de migração. Testes/build do frontend herdado NÃO EXECUTADOS nesta etapa.
