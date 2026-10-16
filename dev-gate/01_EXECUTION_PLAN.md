# 01 — Plano de execução

## Ambiente obrigatório
Use um projeto Supabase exclusivo de DEV. Não use produção como primeiro alvo.

## Caminho local recomendado
Com Node.js e um runtime compatível com Docker:

```bash
npm install supabase --save-dev
npx supabase init
npx supabase start
npx supabase db reset
```

`db reset` deve aplicar 001–016 + forward fix do zero sem intervenção.

## Projeto cloud DEV
Depois de criar um projeto DEV:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Nunca execute `db reset --linked` sem conferir que o projeto ligado é descartável DEV/STAGING.
Esse comando apaga os dados do projeto remoto ligado.

## Regra de mudanças
Depois de adotar migrations, não faça alterações de schema diretamente no Table Editor/SQL Editor
do projeto remoto como fonte de verdade. Toda alteração estrutural deve entrar em migration.

## Resultado esperado do Gate 1
- migrations 001–016 + forward fix aplicadas;
- nenhuma migration parcial;
- migrations locais e remotas alinhadas;
- invariantes SQL executados;
- duas organizações de teste criadas;
- JWT real de usuários distintos;
- testes cross-tenant PASS.

A CLI já está fixada em dev-gate. Na raiz, usar `./dev-gate/node_modules/.bin/supabase`; não instalar outra versão por conveniência. Configuração local já existe. O kit de fixture requer DEV cloud.
