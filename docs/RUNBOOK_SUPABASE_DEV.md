# Runbook — Supabase DEV

> Procedimento preparado para um projeto **DEV**, não produção.

## Pré-requisitos
- Node.js 20+ quando a CLI for usada como dependência npm;
- Supabase CLI versionada no projeto;
- projeto Supabase DEV separado de produção;
- credenciais somente no ambiente seguro, nunca commitadas.

## Fluxo recomendado
```bash
npm install supabase --save-dev
npx supabase --help
npx supabase init
```

Se houver runtime de containers disponível:
```bash
npx supabase start
npx supabase db reset
```

Para projeto cloud DEV:
```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
```

Se o projeto remoto já possuir alterações manuais que não existem nas migrations, alinhar o histórico antes do push. Não usar produção como primeiro alvo.

## Depois do push
1. rodar `scripts/verify_financial_invariants.sql`;
2. rodar `scripts/verify_post_v31_invariants.sql`;
3. criar usuários de teste em pelo menos dois tenants;
4. executar matriz RLS/cross-tenant;
5. testar comandos positivos/negativos;
6. testar concorrência/idempotência;
7. revisar logs e insecure defaults.

## Gate
Falha de migration, RLS ou isolamento cross-tenant bloqueia a próxima fase.

## Projeto aplicado nesta sessão
18 migrations já aplicadas no DEV autorizado. Os arquivos locais usam versões retornadas pelo conector: conferir `docs/engineering/v35-dev-runtime-manifest.json` antes de qualquer push. Não reaplicar baselines com os antigos nomes do ZIP. Usar CLI fixada em dev-gate; sempre conferir dry-run e alvo DEV. Preparação do banco está autorizada; qualquer custo e produção dependem do usuário.
