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

Este smoke test não substitui concorrência/idempotência, MFA real e testes financeiros negativos. Execute as matrizes em `docs/` e checks SQL. `npm run check` roda somente sintaxe JS e dez testes locais do guard/assertions.

Para validar migrations em Supabase local, usar a CLI da dependência fixada na raiz do projeto e runtime Docker; este script de fixture está intencionalmente restrito a DEV cloud e não aceita localhost.


## Usuários já criados: executar sem chave administrativa

Não é necessário executar `fixture` nem obter chave secreta para os dois usuários existentes. Dentro de dev-gate, após npm ci:

```bash
cp .env.example .env.dev
cp fixture.ids.example.json fixture.ids.json
npm run test:tenant-isolation
```

Preencher `.env.dev` em terminal/editor seguro: URL DEV exata, chave publicável, os dois e-mails de teste e suas senhas já existentes, SUPABASE_DEV_PROJECT_REF=szqkdekwhzxsoxorgvaz e CORSYS_DEV_FIXTURE_ACK=DEV_ONLY. Não enviar arquivo/senhas/tokens pelo chat. Os UUIDs do exemplo foram conferidos no DEV em 2026-10-06 UTC. A chave secreta não é utilizada pelo smoke test. Não alterar senhas ou recriar usuários para realizar esta validação.

O teste confirma getUser com o UUID esperado, leituras próprias positivas, consultas explícitas cruzadas, views financeiras cruzadas, catálogo Master oculto, comando Master negado, chamados próprios/cruzados, anônimo e JWT inválido. Os dois chamados legítimos de teste ficam no DEV com prefixo RLS DEV TEST; nenhuma cobrança ou mensagem externa é gerada. A execução pode deixar chamado parcial se falhar; inspecionar antes de repetir.

Views financeiras sem dados próprios não demonstram isolamento positivo financeiro. Este smoke não aprova MFA real, suspensão via HTTP, perfis Consulta/Integrante, expiração de suporte ou concorrência. Só imprimir PASS após toda a execução. Erro de rede/schema não equivale a negação autorizada.

Referências oficiais consultadas em 2026-10-06 UTC: https://supabase.com/docs/reference/javascript/auth-signinwithpassword e https://supabase.com/docs/reference/javascript/auth-getuser.


## Financeiro HTTP e concorrência

Fixtures financeiras persistidas em DEV; ver ../docs/DEV_FINANCIAL_HTTP_GATE.md antes de executar. Usuários/senhas já existentes, sem chave administrativa.

```bash
npm run test:financial-http
```

O roteiro cria fatos fictícios persistentes em ambas as lojas. Não repetir após falha sem inspecionar o tag. Não executar seed/fixture novamente. NÃO aprova MFA real, suspensão ou toda a matriz V35.
