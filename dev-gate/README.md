# Gate DEV — V35

Kit cloud DEV, executado localmente no servidor/terminal. Chave secreta somente para fixtures administrativas; testes usam publishable key e JWT normal. Nenhum secret no Git ou chat.

```bash
npm ci
npm run check
cp .env.example .env.dev
```

Preencha URL, chave publicável, chave secreta, projeto DEV selecionado e dois usuários distintos. `CORSYS_DEV_FIXTURE_ACK=DEV_ONLY` é declaração explícita de alvo descartável; não determina sozinho que o projeto seja seguro. Conferir o ambiente antes de qualquer escrita.

```bash
npm run fixture
npm run test:tenant-isolation
```

`fixture.ids.json` é ignorado no Git e associado ao projeto; as fixtures permanecem em DEV. O script reutiliza usuários existentes sem mudar suas senhas. Se houver usuário antigo, suas credenciais precisam coincidir com as usadas no teste.

Cross-tenant exige erro 42501, criação legítima bem-sucedida e leitura do próprio chamado. Falhas de rede/schema não contam como negação válida. Acesso anônimo também é testado.

Este smoke test não substitui concorrência/idempotência, MFA real e testes financeiros negativos. Execute as matrizes em `docs/` e checks SQL. `npm run check` roda somente sintaxe JS e quatro testes locais do guard.

Para validar migrations em Supabase local, usar a CLI da dependência fixada na raiz do projeto e runtime Docker; este script de fixture está intencionalmente restrito a DEV cloud e não aceita localhost.
