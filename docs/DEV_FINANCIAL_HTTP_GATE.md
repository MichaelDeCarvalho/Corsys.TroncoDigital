# Etapa 1 — financeiro HTTP e concorrência DEV (2026-10-07)
## Estado
Roteiro HTTP real executado pelo proprietário com PASS apresentado em 2026-10-07; ver evidência abaixo.
A etapa 1 permanece aberta: MFA real, suspensão/revogação HTTP e matriz completa.

## Fixtures persistidas
scripts/seed_dev_financial_http.sql executado somente em szqkdekwhzxsoxorgvaz.
Duas lojas conhecidas; integrante DEV HTTP FINANCIAL TEST, categoria, método,
conta bancária fictícia, plano contábil publicado 2026 e mapeamento por loja.
Plano saas dev_http_financial_20261007 de valor zero com duas assinaturas active.
Não são os planos comerciais 125/180; nenhuma cobrança/invoice/provedor ativado.
Não alterados usuários Auth, roles, grants, senhas nem schema.
As fixtures permanecem para requisições HTTP em transações independentes.
Não executar seed novamente: precondições bloqueiam configuração já existente.
Roteiros antigos que exigiam zero planos/assinaturas agora param por precondição;
isso é esperado. Adaptar explicitamente antes de reexecutá-los, nunca remover guard.

## Banco
Tenant A: duas cobranças 100 e um pagamento 100 via comandos financeiros com
claims simuladas. Duas execute_sql despachadas em paralelo, alocando o mesmo
pagamento em cobranças distintas, com retenção da transação por 3s. Rejeição
esperada 23514 capturada; outros erros não foram suprimidos.
Conferência: uma alocação, total 100, crédito zero, aberto total 100, integridade true.
Tenant B: duas chamadas mesma chave despachadas em paralelo, com retenção 3s;
conferência: uma cobrança e um evento audit, sem duplicação.
Não instrumentado o intervalo exato de sobreposição das sessões PostgreSQL.
Esses resultados não comprovam HTTP/JWT ou toda a matriz de concorrência.
Fatos fictícios identificados DEV DB RACE A e DEV DB SAME KEY B permanecem no DEV.

## Novo roteiro
npm run test:financial-http usa somente publishable key e JWT de usuários normais
com getUser e UUID esperado. financial.fixture.json contém IDs fictícios, sem secrets.
Escopo: cobranças/pagamentos/alocações com mesma chave por Promise.all, confirmação
de UUID único/audit único; payload divergente 22023; foreign organization 42501;
foreign member 23503; over-allocation 23514; duas alocações disputando pagamento
e um vencedor, um erro EXATO 23514; views próprias positivas/cruzadas ocultas com
fatos em ambas; pagamento estrangeiro não localizado no tenant (P0002).
Verifica saldos de fatos desta execução e integridade; não depende de total global,
portanto é compatível com os fatos SQL anteriores.
Dispatch simultâneo de duas requisições por cenário; não é prova de carga em escala.
Fixture tag UUID exibida sem tokens/senhas. Falhas não são PASS e podem deixar
fatos parciais. Não repetir automaticamente: inspecionar pelo tag. Ledger não é apagado.

## Validação do código
10 testes locais PASS: oito anteriores e dois novos sobre falsos positivos em
idempotência/race. Todos scripts passam node --check.
Esses testes não executam HTTP real nem aprovam MFA/suspensão/fechamento/estorno.
CI deve ser conferida após push.

## Execução Windows com as credenciais já existentes
1. Baixar ZIP atualizado da branch feat/v35-dev-gate-20261002, extrair em nova pasta.
2. Copiar somente .env.dev privado da pasta dev-gate antiga para a nova dev-gate.
   Não publicar/uploadar esse arquivo.
3. Abrir cmd na nova dev-gate; npm ci; npm run check (10 testes).
4. npm run test:financial-http.
5. Enviar somente resultado/erro e tag não sensível. Não enviar credenciais.
Cria fatos fictícios persistentes de 2026-09: três cobranças, dois pagamentos e duas
alocações por loja, valores 100/150 de teste; sem dinheiro real/envio externo.
Somente dados públicos/IDs fictícios integram a branch; senhas ficam locais.



## HTTP financeiro aprovado pelo proprietário — 2026-10-07, 18:51 Brasil

Execução Windows/Node v24.20.0 pelo proprietário; saída PASS apresentada no chat, não executada pelo agente com credenciais. npm ci: 0 vulnerabilidades no dev-gate; npm run check: 10 testes PASS. npm run test:financial-http: Tenant A e Tenant B PASS; HTTP/JWT real, views próprias positivas/cruzadas ocultas, auditoria, idempotência com requisições simultâneas e disputa de alocação aprovados no escopo do roteiro. Tag: DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe. Fatos fictícios permanecem no DEV; não repetir sem necessidade nem apagar ledger. Tentativas anteriores pararam antes de escritas por dependência ausente, project ref e identidade inesperada; configuração corrigida localmente, nenhuma senha/token recebido. CI Foundation checks do código c39de3a: run 37690001216 success. Não é teste de carga em escala nem cobertura de todas as RPCs. Etapa 1 continua aberta: MFA real, suspensão/revogação/perfis por HTTP, recuperação por e-mail e matriz restante. Produção e merge não aprovados.
