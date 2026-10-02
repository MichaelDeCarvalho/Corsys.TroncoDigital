# 03 — Comandos do kit

Dentro de `dev-gate/`:

```bash
npm install
cp .env.example .env.dev
```

Preencha `.env.dev` localmente. Não envie esse arquivo no chat e não commite.

Depois:

```bash
npm run fixture
npm run test:tenant-isolation
```

O script de fixture usa a chave secreta **somente no processo local/server-side** para criar
usuários/fixtures de DEV. O teste de isolamento usa a chave publicável e autentica usuários normais,
portanto passa pelo Auth/RLS como o aplicativo passará.

Critério:
- qualquer `ASSERTION FAILED` = BLOCKER;
- vazamento de organização, membro, ticket, plataforma ou staff = BLOCKER CRÍTICO.
