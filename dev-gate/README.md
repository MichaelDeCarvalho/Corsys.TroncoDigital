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

## Próximo gate: suspensão / retomada / postura MFA
Ver ../docs/DEV_SUSPENSION_MFA_GATE.md para a sequência completa e restauração obrigatória.
`npm run check:mfa-posture` é somente inventário INFO, não MFA PASS e não cadastra fator.
`npm run test:suspension-http` exige B suspended/A active antes de probes.
`npm run test:restoration-http` exige ambas active e cria pagamento fictício 1 na B.
Não suspender loja sem conseguir executar a restauração na mesma janela de teste.

## Estornos/cancelamentos HTTP
`npm run test:financial-lifecycle`: ver ../docs/DEV_FINANCIAL_LIFECYCLE_GATE.md.
Novo gate de 11 testes locais (substitui a contagem de 10 dos incrementos anteriores).
Somente fatos novos fictícios são corrigidos por eventos, sem apagar ledger anterior.
Exige ambas assinaturas active e verifica concorrência de eventos (um sucesso/23505),
saldos, auditoria, motivos/períodos e recursos alheios. Não é MFA/revogação/full matrix PASS.

## Encerramento da etapa 1 — pacote consolidado
Ver ../docs/DEV_STAGE1_CLOSURE_GATE.md. Gate local atualizado: **12 testes**.
`npm run test:stage1-remaining`: catálogo20 negativas, FIFO isolado, institucional e períodos.
`npm run test:profiles-live`: sessão/JWT retido durante cinco mudanças de perfil; exige
coordenação SQL por fase e restauração de ADMIN mesmo em erro/cancelamento.
`npm run test:master-mfa`: conta dedicada/UUID conferido, TOTP local mascarado e Master
positivo AAL2. QR temporário .mfa-local nunca deve ser enviado; ver pré-requisitos no relatório.
Nenhum desses comandos isoladamente representa PASS da etapa inteira.
