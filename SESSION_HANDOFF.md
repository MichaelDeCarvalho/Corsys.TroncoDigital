## Preview e jornada institucional B — 2026-10-16

Commit funcional f0ac5ec, 269 testes/40 arquivos, tipos/build PASS; CI #290,
run38967138712 success. Publicado somente como versão isolada
841a8aa5-5353-4f57-a517-df89e2bc0a9f, alias v35-finance preservado, sem alterar
tráfego. HTML/JS/CSS HTTP200 e iguais ao build; JS index-CmPGR9WU.js SHA256
c9c7cf698be3d89fa09b96ed3cdd5bde489745626447d6bda7aa15086496c384.
CSS index-CIurdFNA.css SHA2560093a8ed83ea769e899c4d5f058f245129a9761a3c70633c091fbaf4722ce172.
B no Edge: despesaR$1 e receitaR$1 criadas, liquidadas integralmente, estornadas
com confirmação ESTORNAR; obrigação reabriu automaticamente emR$1 e depois foi
cancelada. Sem nova emissão ou alteração de fatos originais. Read-back SQL B:
saldo origemR$10, duas obrigações canceladas/aberto0, dois movimentos estornados,
duas auditorias institutional_movement.reverse. Histórico de teste preservado.
Despesa b84f6a6c-33d3-40df-b497-40e21082c714; pagamento
df07315b-31a3-4ecb-b3c0-199626f47e69. Receita
3e0c4d4f-2186-4aff-8b40-15456fd8820c; recebimento
537d75b6-e41b-4e6a-bec2-eee51d912cc8. Referências DEV QA REVERSAL B ...20261016.
Mobile390x844 observado: client/document375, sem overflow global; histórico tem
rolagem horizontal própria. Override restaurado. Não é paridade integral21 telas.
Solicitado login DEV A na mesma origem para repetir apenas este novo escopo.
Aba atual1875274888, Edge id4; preservar. Não repetir B/seed/OAuth.
Ainda pendentes A UI, concorrência real nova e demais requisitos da Etapa2.

## Estado vigente — acesso restaurado e estorno institucional — 2026-10-15

Supabase multiaccount agora expõe seleção de conexão nas ferramentas. Conexão
correta identificada por list_projects: somente TroncoDigital em Michael - jobmcc.
Consulta administrativa PASS; não pedir nova autorização/reconexão. Banco DEV
szqkdekwhzxsoxorgvaz tem55 migrations, última20261016003940. Arquivo criado pela
CLI e alinhado ao timestamp retornado pelo apply_migration; hash no manifesto.
Read-back A/B QA FINANCE confirmou R$10, zero cobranças/obrigações abertas.
Comando reverse_tenant_institutional_movement e guard de conciliação aplicados.
Quatro jornadas SQL positivas e44 rejeições esperadas A/B PASS rollback, claims
simuladas, não HTTP/concorrência real. UI nova em InstitutionalReversals: tipos,
histórico validado, confirmação, replay da mesma chave após resultado incerto,
refresh da obrigação após sucesso. Testes de componente e loader passaram.
Publicação/QA assinada dessa interface em preparação; não declarar homologada.
Próximo: terminar build/commit, versions upload alias v35-finance sem trocar
tráfego; QA B na sessão existente, depois A com login humano se necessário.
Antes de operar conferir Loja QA FINANCE exata. Cada operação fictícia atéR$1,
estornar e cancelar ao final, preservar seedR$10. Nenhum merge/PROD autorizado.
Detalhes em ADR-0028 e V35_INSTITUTIONAL_REVERSAL_PLAN.md. Etapa2 segue aberta.

## Conexão Supabase — nova conta adicionada — 2026-10-15

Navegador Edge atual id4, Supabase tab1875274733 no projeto correto
szqkdekwhzxsoxorgvaz, organização Michael - jobmcc/fblwfnjkisduhzuylazo.
Plugin ainda listava somente Distribuição/Catálogo/Água e SQL DEV negado.
Pela UI ChatGPT > Plugins > Supabase > Gerenciar > Conectar outra conta,
foi iniciado OAuth na sessão correta; organização Michael - jobmcc selecionada.
O proprietário clicou Authorize ChatGPT e confirmou FEITO. Retorno OAuth observado
 e configurações agora mostram DUAS contas com mesmo nome Conta de Michael no
Supabase. Controles de conta estão desabilitados nesta UI, inclusive após reload.
Não remover a antiga: ela atende outros projetos. Não pedir nova autorização OAuth.
Consulta/listagem por ferramentas DEPOIS do consentimento ainda usa conta antiga
 e nega o DEV. Nova conexão persistida não equivale a roteamento deste chat corrigido.
Próximo: proprietário recarregar este chat/cliente e reenviar menção Supabase;
verificar list_projects + consulta read-only ao DEV antes de migration. Se ainda
falhar, tratar seleção/roteamento multiaccount no cliente; não reduzir RLS/grants,
transferir projetos, buscar tokens ou presumir solução. Sem alterações no banco,
sem nova migration ou publicação nesta tentativa. Repo funcional permanece37879f6.

## Estado vigente — jornadas financeiras A/B concluídas — 2026-10-15

Este bloco substitui as pendências de login/jornada B nos registros anteriores.
DEV B permanece no Edge 1875274749, alias v35-finance. NÃO repetir seed nem A/B.
QA FINANCE B 7a6aa771-524d-4d5a-9d38-7006175e1cb4 concluiu pela interface:
- mensal março/2027 R$1, batch 0bd3365f-daeb-429f-bae5-85c30aa006c7;
  nova prévia zero novas/uma existente e sem botão de emissão;
- pagamento R$1 em 02/03/2027 (prefixo 84ad3760), alocação integral e estorno;
  crédito/alocação zerados, mensalidade reaberta e depois cancelada;
- avulsa outubro R$1 criada/cancelada; outubro fechado, nova avulsa rejeitada
  pelo servidor e competência reaberta;
- despesa e receita R$1 corrigidas para R$0,50/vencimento21/10 e canceladas;
- origem R$10, destino sem movimentos; DRE outubro2026/março2027 receitas,
  despesas e resultado R$0. Última leitura DRE e Loja selecionada reconferidas.
A concluiu o mesmo escopo. Nenhuma liquidação institucional executada.
Build funcional 37879f6, preview c7008f47, 252 testes/tipos/build PASS e CI #286
success; auditoria de dependências retornou zero vulnerabilidades. Evidência de
UI não substitui read-back SQL atual, nem comprova toda a Etapa 2/21 telas.
Próximo bloqueio: estorno institucional requer confirmar catálogo real, migration
mínima, testes SQL e UI. Contrato/aceite em docs/V35_INSTITUTIONAL_REVERSAL_PLAN.md.
CLI local migration new falhou ao gravar telemetria fora do workspace; não criou
arquivo. Nenhuma nova migration, comando de estorno ou interface foi implementada.
Consulta administrativa read-only ao DEV continua negada pela integração mesmo
após reconexões. Não contornar acesso, liquidar sem estorno validado ou publicar
recurso incompleto. Projeto DEV exato szqkdekwhzxsoxorgvaz. Sem merge/produção.

## Retomada após aprovação das fixtures — 2026-10-15

Proprietário aprovou explicitamente QA FINANCE A/B, saldo inicial R$10 e operações
fictícias até R$1, com cancelamentos/estornos e histórico preservado. Seed persistido
uma vez. NÃO repetir. A: 94b84958-4dd9-435d-9a4e-244220835d70;
B: 7a6aa771-524d-4d5a-9d38-7006175e1cb4. Sessão A ativa no Edge 1875274749,
alias v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev.
A UI: prévia/atualização/geração mensal março2027 R$1; nova prévia recusou duplicação;
batch 997f14d1-535f-47c2-8922-d0b88059da3a. Recebimento R$1 02/03/2027, ID começa
b598d5dd, alocado integralmente; estorno confirmado, crédito zero e cobrança aberta
novamente. Cobrança mensal cancelada; avulsa R$1 outubro criada/cancelada. Outubro
fechado, tentativa de avulsa bloqueada, competência reaberta. Tudo observado UI.
Despesa R$1 criada, corrigida para R$0,50 e cancelamento enviado; conferir conclusão.
Atualização: cancelamento da despesa confirmado; receita também criada R$1,
corrigida R$0,50/vencimento21/10 e cancelada/zero aberto. Outubro reaberto.
Correção loader passou 252 testes/tipos/build/preservação; commit37879f6 enviado,
versãoDEVc7008f47 no mesmo alias, assets iguais ao build. Reload mantém sessão A;
conferir nova leitura institucional e saldos antes de pedir troca para B.
Conferido no novo build: despesa/receita canceladas/zero aberto sem erro; origem
R$10, destino sem movimentos; DRE outubro2026 e março2027 toda zerada. Mobile390
document/client375, override restaurado. CI #286/run38811322401 success.
Solicitado login B na mesma aba/alias; não repetir A. Próximo B: selecionar
DEV QA FINANCE B 20261015, gerar mensal março2027R$1, conferir nova emissão negada,
registrar R$1/alocar/estornar, cancelar mensalidade, avulsaR$1/cancelar, despesa e
receitaR$1/corrigirR$0,50/cancelar, fechamento outubro/bloqueio/reabrir e saldos/DRE.
Cada operação atéR$1 autorizada. Não estornar pagamento inicial deR$10.
Sem pagamento institucional criado. Não liquidar antes de implementar/validar
estorno institucional: nenhum comando correspondente localizado no código versionado.
SQL administrativo voltou sem permissão; usuário reconectou duas vezes, mas a
chamada direta ao DEV continua negada. Primeira listagem mostrou conta de Água/
Catálogo/Distribuição; última reconexão foi declarada TroncoDigital, sem sucesso
na consulta. Não insistir em credenciais ou trocar projetos. UI normal funciona.
Correção local adicional em institutional-operations.ts rejeita duplicatas,
saldos inconsistentes/cancelado com aberto e aprovação desconhecida; quatro
regressões falharam antes/passaram após. Validação geral em andamento.
Ver V35_STAGE_2_IMPLEMENTATION.md para histórico. Etapa 2 aberta.

## Histórico — Sequência 1–5 autorizada — 2026-10-15

Passo 1 consolidado em docs/V35_VERTICAL_DELIVERIES.md. Passo 2 em execução:
oito gates SQL rollback e matriz nova de 60 negações A/B PASS; tipos/build/243
testes/gramática/preservação/12 guardas PASS. Corrigido bloqueio permanente após
Atualizar regras durante prévia mensal lenta; regressão falhou antes/passou após.
Não repetir todos os testes sem mudança. Não há regra mensal persistida para QA.
Preflight scripts/prepare_dev_financial_browser_qa.sql passou com rollback; COMMIT
bloqueado pelo auto-review por autorização anterior restrita a QA INTERFACE.
Precisa aprovação específica das novas QA FINANCE A/B e login no novo preview;
não gravar por outro caminho. Plano imutável original e fixtures antigas intactos.
Commit funcional 991ae9c enviado; versão isolada a782b50f publicada sem trocar
tráfego, assets HTML/JS/CSS iguais ao build. Alias v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev
aberto no Edge 1875274749 para login A. CI #284/run38676894646 inicialmente em curso.
Ver docs/V35_STAGE_2_IMPLEMENTATION.md para escopo e próximos gates. Sem PROD/merge.

## Homologação A/B encerrada no escopo — 2026-10-15

Sessão A real na versão isolada 962f7b1b concluiu transferência R$1/estorno UI,
OFX persistido/validado/conciliado/desfeito e HTTP isolamento A→B/replay/disputa.
Todos PASS observados. B já havia concluído CSV/UI/HTTP e concorrência bancária.
Read-back conjunto confirmou A/B 10/0, zero transferências sem estorno, zero valor
conciliado ativo nas fixtures e zero faturas SaaS QA; originais 17 cobranças/16
pagamentos. IDs/SHA e limitações em docs/V35_SIGNED_BROWSER_QA.md.
Não repetir jornadas nem pedir login A novamente. Sem nova migration, publicação,
merge ou produção nesta conclusão. Próximo: revisar pendências da Etapa 2 e lotes
em docs/V35_VERTICAL_DELIVERIES.md; não tratar 21 telas como concluídas.
Se precisar publicar DEV, preservar a versão isolada e coordenar o outro publicador
que altera o endpoint principal. Manter históricos fictícios identificados.

## Histórico — Orçamento operacional DEV — 2026-10-14

Mais recente: versão isolada `962f7b1b-1652-4ae5-86d3-4e53f4cbe7ae`, commit
`23906b6` (CI #281 success), URL no V35_SIGNED_BROWSER_QA.md. Publicada por
versions upload sem trocar tráfego; outro publicador substitui o DEV principal.
B UI/CSV e HTTP isolamento/concorrência de transferências e conciliação PASS.
Todos vínculos/transferências B desfeitos, saldos 10/0 e originais preservados.
Proprietário entrou B nessa versão e foi solicitado a trocar para A na aba Edge
1875274749; aguardar sessão real A. Arquivo OFX de A está em
.test-tmp/DEV_QA_UPLOAD_A_20261014.ofx, uma linha fictícia R$10 em 2026-10-15.
Próximo A: selecionar DEV QA INTERFACE A, transferir R$1/estornar na UI, importar
OFX/validar/conciliar pagamento sintético/desfazer, depois abrir /dev-qa e executar
isolamento e concorrência de transferências. Não pedir senha/token nem .env.dev.

Retomada seguinte: proprietário autorizou duas Lojas QA isoladas A/B (IDs no novo
V35_SIGNED_BROWSER_QA.md), cada uma com duas contas e R$10 sintéticos. Seed
preflight rollback e persistência passaram, sem alterações originais. B UI criou
transferência 1f124bed-e806-433f-97e8-45f86ea18027; UUID regex frontend defeituosa
gerou resultado incerto, retry não duplicou. Correção/testes preparados. Estornar
esse registro pela UI após publicar correção, antes de gate de saldo 10/0.
Página dev-qa.html opcional para testar RPC HTTP com sessões existentes sem
extrair JWT. Publicar somente DEV e observar resultados; não presumir testes PASS.

Retomada seguinte: conciliação implementada, migration #54 aplicada DEV,
239 testes/tipos/build e 12 guardas locais PASS. SQL A/B e transferência positiva
com estorno/duas pontas conciliadas PASS, tudo rollback. Dois extratos B autorizados
ficam persistidos para disputa; primeira tentativa via conector sem sobreposição,
vínculo desfeito. HTTP real aguarda .env.dev local A/B (não pedir secrets no chat).
Atualização posterior: DEV `485cc0a0`, `19c9c32` publicado e assets iguais ao build.
Browser B duas abas: único aceite de R$100, concorrente rejeitado, desfazimento pela
tela e zero vínculos ativos conferidos. Prévia CSV local e QA desktop/mobile PASS
após correção de overflow. Quatro negativas HTTP anon PASS. VIEWER/suspensão SQL PASS.
Proprietário prefere browser, sem .env.dev; registrar HTTP A/B completo não avaliado,
sem pedir credenciais novamente. Ver docs/V35_BANK_RECONCILIATION.md antes de avançar.

Atualização de publicação: commit funcional 0a3ed4e, CI38659598745 success, versão
DEV23727d71-ec86-4fc1-8650-346264573d9f. Bundle remoto igual ao local por SHA256.
Browser A percorreu draft/linha/remoção/reinclusão/publicação/consulta; Edge1440/390
conferido, quatro negativas HTTP anon PASS. Ciclo fictício publicado
ce7f052b-2f0b-4db0-9ff7-e29d44f0b195 fica preservado; 17 cobranças/16 pagamentos.
Sessão B no Edge passou: draft/linha R$250/publicação imutável; seletor sem ciclo A.
Ciclo B 73d7be4f-bfc2-474c-a7ea-26320fb5b3a5 preservado como evidência DEV.
Negativos HTTP cross-tenant com JWT real e corrida
independente continuam pendentes. Não avançar classificando esses limites como PASS.

Nova migration #53 `20261015001840_tenant_budget_lifecycle` aplicada DEV e hash no
manifesto. BudgetManagement em Financeiro > Planejar orçamento: draft/linhas/revisão/
publicação, com RPCs autenticadas e idempotentes e histórico imutável. ADR-0006 e
docs/V35_BUDGET_LIFECYCLE.md registram segurança, testes e recuperação. 224 testes,
tipos/build, SQL lifecycle A/B rollback, regressões e preservação PASS. Sem ledger,
RLS, grants diretos, produção ou merge. Próximo: publicar/homologar esta jornada
no preview com registro de versão/SHA, antes de avançar outra entrega funcional.

## Retomada auditada — 2026-10-14

QA positivo posterior: proprietário aprovou fixture orçamentária temporária. Teste
real no preview A passou (250 orçado / 500 realizado / -250 restante / 200% explícito).
Ciclo `6f953af3-c600-4bf2-ae3c-4ff1a0c63236` e linha removidos por cleanup restrito;
zero remanescentes, 17 cobranças/16 pagamentos preservados. Aprovação resolveu
bloqueio de fixture registrado abaixo; não há aprovação pendente para esse teste.
Desktop/mobile separados, demais papéis e fechamento da Etapa 2 continuam pendentes.

Atualização: OAuth Cloudflare concluído. A publicação DEV existente
`4d47c0cf-d659-4403-8624-8fe63d259b80` contém os assets exatos do build `be967cf`
(hashes JS/CSS no relatório); não houve novo upload. CI `38655489396` success.
Sessão A e orçamento vazio conferidos no build publicado. Fixture positiva de
orçamento persistida para QA foi bloqueada pelo auto-review; aprovação específica
solicitada, nenhum registro criado. Viewport do navegador interno permaneceu
754x668 apesar do pedido 1440x1000; não declarar desktop/mobile homologados.

Base `210a039b`, branch `feat/v35-dev-gate-20261002`, PR draft #4 confirmado.
Auditoria, evidências, seis lotes e 21 telas em `docs/V35_VERTICAL_DELIVERIES.md`.
Lote 0: orçamento consultivo com execução visual, validação de duplicatas/moeda/
centavos e Wrangler 4.151.0. 217 testes/tipos/build, 12 guardas DEV, preservação,
regressões financeiras e novo SQL de orçamento A/B PASS. SQL revertido; 52 migrations,
sem DDL novo. OAuth Cloudflare solicitado para preview; login Loja A observado.
Sem merge/PROD. Etapa 2 não encerrada. Próximo: publicar/homologar o lote 0, antes
de avançar demais lotes. Cadastro/publicação de orçamento e conciliação permanecem
pendentes; transferência positiva exige duas contas legitimamente mapeadas.

## Incremento 29 — busca filtrada de clientes Master, 2026-10-10

- Migração DEV #52 `20261010224802_master_tenant_search_filters` aplicada, SQL e SHA256 no manifesto. Nova RPC `search_platform_master_tenants(search,status,plan,limit,offset)` exige MASTER/MFA AAL2 no PostgreSQL, retorna o mesmo contrato de `list_platform_master_tenants`, pagina 1–50 linhas e até offset 20.000. A busca ocorre no banco por nome, número, cidade e contatos do cadastro comercial, não revela e-mail/telefone no resultado; status `active`/`past_due` e plano por nome/código. `anon` sem EXECUTE.
- `MasterConsole` agora tem formulário “Filtrar clientes SaaS” e botão Limpar filtros. `loadMasterTenants` mantém RPC histórica para ausência de filtros e usa nova RPC somente com filtros, preservando teste/regressão do dashboard. Botões de Cliente 360 e Cobrança Master continuam consumindo lista da página atual, não implementam navegação direta entre todos os clientes.
- SQL `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS` verificou busca de DEV-A/DEV-B, status ativo, paginação distinta, filtro sem resultado, parâmetro inválido e acessos negados Master AAL1/tenant AAL2/anon, tudo revertido. Testes React incluem filtro/limpeza e rejeição de input >100 caracteres. CI do último commit verificar.
- Paridade parcial com `view-master-clientes`: campo Plano é texto de busca por nome/código, não SELECT catálogo, e permanecem buscas combinadas com filtros avançados, cards de saúde/uso, 360° completo, onboarding cinco etapas e ações do HTML. Sem merge/PROD.

## Incremento 28 — fluxo de caixa diário com realizado e pendente (2026-10-10)

- Migração DEV #51 `20261010224130_tenant_daily_cash_flow_summary` aplicada e versionada, hash SHA256 no manifesto. RPC `read_tenant_daily_cash_flow(org,from,to)` exige `finance.read` no PostgreSQL e intervalo máximo de 93 dias, valida `integrity_ok` de cobranças, recebíveis e pagamentos institucionais, e agrupa todas as movimentações efetivas/débitos em SQL, evitando soma parcial de consultas paginadas. Recebimentos incluem pagamentos de integrantes/institucionais líquidos de reversões, saídas incluem pagamentos a fornecedores líquidos de reversões. Transferências entre contas e entradas de abertura foram explicitamente excluídas de recebimentos/saídas operacionais para evitar dupla contagem.
- **Pendentes** em colunas distintas: cobranças em aberto de integrantes, recebíveis institucionais e contas a pagar pela data de vencimento; não confundir com fluxo realizado, saldos de contas bancárias ou previsão estatística de recebimento. Retorna todos os dias do período mesmo com zeros.
- UI `DailyCashFlow` integrada em `Financeiro > Fluxo de caixa`: filtro de datas, resumos realizados/projetados e tabela diária validada contra equações financeiras completas em `daily-cash-flow.ts`. Nenhuma gravação ocorre. Testes Vitest de período, valores inválidos, saldo versus projeção, erros de permissão e mudança de datas.
- Gate SQL **`DEV_DAILY_CASH_FLOW_ROLLBACK_PASS`** executado com claims A/B simuladas: 30 dias de setembro/2026 por Loja, recebimentos registrados reconciliados exatamente com movimentações assinadas, valores a receber comparados às views, acesso cross-tenant negado, janela acima de 93 dias negada e anon sem EXECUTE. ROLLBACK, sem alteração em dados.
- PENDÊNCIAS: gráficos de fluxo de caixa V35, cortes mais amplos, cash balance projetado com saldos iniciais e riscos de recebimento, validação JWT HTTP real, concorrência e QA mobile/desktop. Etapa 2 não encerrada. Sem produção.

## Incremento 27 — exportação CSV privada de inadimplência (2026-10-10)

- `Financeiro > Inadimplência` ganhou botão `Exportar CSV completo`, acionado pelo usuário autenticado com `finance.read`, sem endpoint de exportação público e sem chave de serviço no navegador. `loadDelinquencyExport` percorre as páginas da RPC autorizada `read_tenant_delinquency`, valida cada posição, detecta integrante duplicado entre páginas, interrompe em erro ou mudança de tenant e bloqueia arquivos parciais (limite **1.000 integrantes**). `createDelinquencyCsv` usa UTF-8 BOM, `;` para pt-BR e neutraliza células iniciadas por fórmulas (`=`, `+`, `-`, `@`) ou controles. Não exporta CPF, telefone ou e-mail. Sem custos/serviços externos.
- Testes Vitest em `src/lib/delinquency-export.test.ts` cobrem duas páginas (31 registros), CSV injection, valores incorretos, duplicatas, interrupção ao trocar de Loja e limite. Teste na UI confirma que exportação não roda automaticamente e falha fechada se a consulta retorna erro de autorização. CI do HEAD deve ser verificada.
- **Limitações:** CSV NÃO é XLSX nem PDF; registros podem mudar entre páginas e não há snapshot consistente de transação (informado na UI). Não é relatório contábil auditado de corte; para comprovantes oficiais e volumetria alta é preciso exportação server-side com snapshot consistente, LGPD e retenção adequada. Teste real de download em navegador mobile/desktop NÃO AVALIADO.
- DEV somente, branch PR #4. Etapa 2 continua aberta, sem produção ou merge.

## Incremento 26 — transferências internas entre contas e estornos (2026-10-10)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Supabase **50 migrations**, #50 `20261010222543_tenant_account_transfer_commands` aplicada/versionada com SHA256 no manifesto. Sem merge, deploy ou alteração de PROD.
- Criadas RPCs `register_tenant_account_transfer_idempotent` e `reverse_tenant_account_transfer_idempotent`. Exigem `institutional.manage` e assinatura com escrita permitida; usam `private.idempotency_begin/complete`, chave/payload, `financial_account_transfers` e `financial_account_transfer_reversals` imutáveis; bloqueiam contas da própria Loja, datas futuras, saldo insuficiente, mesma conta, reversão duplicada e competência fechada. Auditoria separada em `audit_logs`. As views originais `v_financial_account_movements` e `v_financial_account_balances` já projetavam transferências e reversões como movimento de igual valor e sinal inverso entre contas; não são receitas/despesas DRE.
- Nova aba `Financeiro > Transferências` com formulário entre contas ativas, saldo da origem, extrato paginado de transferências da Loja e estorno por confirmação digitada `ESTORNAR` + motivo, retry idempotente após perda de resposta. Componente `AccountTransfers`, loader `account-transfers.ts`, testes React com mocks.
- Teste SQL `DEV_TRANSFER_GUARDS_ROLLBACK_PASS`: conta destino estrangeira negada, origem=destino negada, estorno inexistente negado e anonimato sem EXECUTE, tudo revertido. Tentativa de montar **novo tenant temporário com duas contas mapeadas para ensaio positivo** foi bloqueada pela ferramenta de segurança; NÃO executar bypass. DEV atualmente tem só **1 conta ativa por Loja**, inviabilizando teste de transferência positiva sem preparação contábil completa. Portanto **TRANSFERÊNCIA REAL POSITIVA + ESTORNO NO BANCO NÃO HOMOLOGADOS**; não declarar PASS. Teste multi-conexão e saldo concorrente também NOT EVALUATED.
- Etapa 2 segue aberta: criar plano sucessor e mapear/ativar segunda conta por Loja com autorização, validar ciclo positivo/reversão, reconciliação OFX/CSV, saldos de fundos, remessas, paridade 21 telas, exportação segura, HTTP JWT assinado e QA mobile/desktop. Não produzir nem cobrar cliente.
- CI final do HEAD: conferir GitHub Actions; não extrapolar status de commit anterior.

## Incremento 25 — versões sucessoras de ofertas Master (2026-10-10)

- Migração DEV #49 `20261010211529_master_promotion_successor_idempotent` aplicada, hash SHA256 no manifesto. `create_master_promotion_successor_idempotent` exige MASTER/AAL2, chave + hash invariantes, bloqueia série para concorrência e confere a última versão publicada; cria somente draft sucessor com validade futura, sem mutação do histórico. Publicação existente fecha a vigência da versão anterior.
- `MasterPromotions` agora escolhe nova série ou sucessora de uma oferta publicada, com mesma validação monetária e confirmação posterior de publicação. Teste React adicional distingue RPC de sucessão de edição direta. 
- SQL `DEV_MASTER_PROMOTION_SUCCESSOR_ROLLBACK_PASS`: versão inicial publicada, sucessora draft/publicada, janela anterior encerrada, chave reutilizada com payload diferente negada e origem obsoleta `40001` bloqueada; tudo em transação `ROLLBACK`. **JWT HTTP real e concorrência em conexões simultâneas NÃO AVALIADOS.**
- Pendente Stage 2: revisão/edição de promoções draft, exclusão/retirada autorizada, resgates reais, billing SaaS, contas/tesouraria específicas e demais 21 telas V35. Não houve deploy/merge produção.

## Incremento 24 — políticas de aprovação parametrizáveis (2026-10-10)

- Migração DEV #48 `20261010210919_tenant_expense_approval_policy_lifecycle` aplicada/versionada SHA256. `create_tenant_approval_policy_draft` exige `approvals.manage`, regras `off`/`all`/`threshold`, limite em BRL centesimal quando applicable, 1–10 aprovadores e vigência futura. `publish_tenant_approval_policy_idempotent` delega à RPC auditada existente de publicação, com motivo e replay idempotente. Constraint de não sobreposição entre políticas publicadas continua no PostgreSQL.
- UI `ApprovalPolicies` integrada ao Financeiro em aba separada da fila de decisões. Permite cadastro de rascunho, leitura do histórico tenant-scoped e publicação somente após digitar `PUBLICAR`. Nenhuma política altera cobrança/contrato histórico, votos anteriores ou aprovações já tomadas.
- Teste SQL A/B `scripts/verify_dev_expense_approval_policies.sql`: `DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS`, duas Lojas, publish/replay, bloqueio de vigência sobreposta, anon sem grant, ROLLBACK. Testes React incluem draft threshold, publish confirm, retry e row cross-tenant bloqueado; conferir CI do HEAD antes de aceite.
- PENDENTE: autores/roles autorizados a aprovar, regra de autoaprovação, delegação, workflows especiais do HTML V35, HTTP JWT real e concorrência independente. PROD não autorizada.

## Incremento 23 — ofertas promocionais Master (2026-10-10)

- Migração DEV #47 `20261010210329_master_promotion_draft_publication_idempotent` aplicada, SQL + SHA256 no manifesto. Duas RPCs `create_master_promotion_draft_idempotent` e `publish_master_promotion_draft_idempotent` validam MASTER/AAL2 no PostgreSQL, usam `private.master_idempotency_keys` e hash de payload para impedir duplicidade/alteração em retry; preservam versões e registram `saas_master_audit_logs`.
- UI `MasterPromotions` integrada ao `MasterCommercialCatalog`: cria rascunho com desconto percentual/fixo/preço de teste, vigência, elegibilidade, máximo de resgates, combinação e duração; publica apenas draft selecionado após digitar `PUBLICAR`. Nenhum contrato, cliente, fatura ou resgate é ativado retroativamente pela tela.
- Script DEV `verify_dev_master_promotions.sql` retornou `DEV_MASTER_PROMOTION_ROLLBACK_PASS`: criação de rascunho, prevenção de payload divergente na mesma key, publicação, retry, auditoria e AAL1/tenant/anon negados, tudo ROLLBACK. Frontend testado por Vitest (criação, publicação, retry, permissão); confirmar CI do último commit.
- Pendentes Master: ofertas sucessoras e edição de drafts, ações de ativação/aposentadoria, contratos, cobrança, verificação real de resgate, importação de clientes e Cliente360 completo. Etapa2 segue ABERTA. Não houve produção.

## Incremento 22 — Master draft replay protegido por payload (2026-10-10)

- Migration DEV #46 `20261010205909_master_onboarding_strict_idempotency`, SQL e SHA256 versionados. RPC `create_master_onboarding_draft_idempotent(key,payload)` usa `private.require_platform_staff('MASTER')` AAL2, normaliza campos, valida papel ADMIN e dados essenciais, serializa mesma key via advisory lock, compara todos os campos com rascunho existente e só invoca a RPC antiga no primeiro envio. Key existente com payload diferente ou status não-draft gera `22023`, nenhuma mutação/evento adicional.
- Frontend `MasterOnboarding` agora chama wrapper protegido, mantendo a mesma key/payload quando resultado de transporte é incerto. Script SQL `DEV_MASTER_ONBOARDING_STRICT_REPLAY_ROLLBACK_PASS` validou replay, colisão de payload rejeitada, uma única linha e um único evento, AAL1 e tenant negados, anon sem grant. ROLLBACK.
- Atenção: RPC legada `save_saas_onboarding_draft` continua diretamente chamável por MASTER/AAL2; sua colisão sem validação não pode ser considerada corrigida para todos os consumidores. Nova UI usa wrapper; antes de PROD mapear consumidores e restringir/aposentar legado ou endurecê-lo com compatibilidade validada. Nenhum deploy PROD, HTTP/JWT real não avaliado.
- CI `GitHub Actions` do SHA consolidado deve ser verificada depois desta revisão documental. Etapa 2 ainda aberta: convite/aceite real e entrega, integrações comerciais, paridade do piloto, Master completo, relatórios e segurança E2E.

## Incremento 21 — onboarding e Cliente 360 Master (2026-10-10)

- DEV branch `feat/v35-dev-gate-20261002`, PR #4. Supabase migrações **45**, `20261010010836_master_plan_draft_publication_idempotent` (#44, anterior) e `20261010205431_master_client_360_summary` (#45, nova), SQLs versionados e hashes SHA256 conferidos no manifesto.
- `MasterOnboarding`: lista rascunhos e versões comerciais publicadas, cadastra proposta de Loja com valores de contrato, administrador/invite previsto, início, plano, identificador e MFA MASTER. Reutiliza `save_saas_onboarding_draft`, cuja constraint exige papel inicial `ADMIN` (corrigido após teste). Draft NÃO cria organização, assinatura nem convite. O comando `provision_saas_onboarding_database` existente fica acessível somente após seleção de draft completo e confirmação digitada `PROVISIONAR`; ele cria Loja + assinatura e enfileira tarefa de convite **sem comprovar envio de e-mail**, sem provedor de cobrança ativado. Fluxo final de convite/termos ainda pendente.
- Gates SQL AAL2 Master, tenant e AAL1 com ROLLBACK: `DEV_MASTER_ONBOARDING_DRAFT_ROLLBACK_PASS` e `DEV_MASTER_ONBOARDING_PROVISION_ROLLBACK_PASS`. O primeiro teste de contagens do provision falhou por contar organizações sob RLS authenticated (retornava 0): corrigido conferindo totais após `RESET ROLE` e gate PASS. Nenhuma Loja fictícia persistida.
- `MasterClient360` e função `read_master_client_360(org)` mostram somente um cliente SaaS escolhido (cadastro, assinatura, faturas abertas/vencidas e chamados), exige `private.require_platform_staff('MASTER')` AAL2 no backend, controla escopo e integridade. SQL `DEV_MASTER_CLIENT_360_ROLLBACK_PASS`: números reconciliados com view, AAL1 e tenant negados, anon sem EXECUTE. NÃO exibe ledger de integrantes, nem concede acesso de suporte/impersonação. Testes frontend adicionados, conferir CI do HEAD.
- Limitação relevante: tela Cliente360 é **panorama**, ainda não representa formulário/edit completo, trilha de auditoria, negociação, contrato, atendimento e gráficos do piloto. Onboarding exige convite autenticado/consentimento, gestão de status e tratamentos de falhas; não declarar homologia integral.
- Não houve merge nem deploy PRODUÇÃO. HTTP/JWT com tokens assinados reais, sessões concorrentes independentes e validação visual mobile/desktop continuam **NOT EVALUATED**. Etapa 2 permanece aberta.

## Incremento 20 — operação Master de suporte e respostas (2026-10-10)
- Branch DEV PR #4, migration #43 `20261010005826_master_tenant_support_idempotent_reply` versionada e SHA256 conferido no manifesto. `MasterSupportQueue` mostra chamados internos e da Loja, métricas reais, mensagens e paginação; `MasterConsole` tem aba Operação e suporte.
- `reply_master_tenant_support_idempotent` exige MASTER ativo + MFA AAL2 no PostgreSQL, restringe `ticket_scope='tenant'`, valida mensagem e status, usa mesma chave/payload após perda de resposta e delega à RPC auditada `reply_saas_support_ticket`. Não concede escrita em chamados internos ou impersonação cross-tenant.
- Gates SQL `DEV_MASTER_SUPPORT_RLS_ROLLBACK_PASS` e `DEV_MASTER_SUPPORT_REPLY_ROLLBACK_PASS`: Master AAL2 pode, AAL1/tenant sem MASTER/anon não pode; chamada repetida não duplica mensagem; ROLLBACK. Claims do SQL são simuladas, **não** JWT HTTP assinados.
- CI funcional `cb6fe527` run `38011418036`: 162/162 testes em 26 arquivos, TypeScript, build e estático PASS. Antes de production exige HTTP/JWT real, QA desktop/mobile e restante da paridade 21 telas.
- Master overview, diretório, versões comerciais permanecem READ-ONLY; **resposta a ticket de cliente e mudança de status são comandos reais em DEV**, sem ativar cobranças comerciais.
- Pendências Stage2: onboarding, Cliente 360, billing SaaS, políticas de aprovação completas, negociação, ágapes/mútuas, conciliação, transferências, exportação PDF/XLSX, regras anuais e institucionais, paridade piloto, segurança HTTP concorrência, testes de navegação real. Sem PROD ou merge.

## Incrementos 15–19 — recorrência, tesouraria, correções e Master (2026-10-09/10)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Supabase DEV **42 migrations**, #36–42 versionadas em `docs/engineering/v35-dev-runtime-manifest.json` com SHA256 dos SQL aplicados. Nenhum deploy ou alteração PROD autorizados.
- **Mensalidade recorrente:** `preview_monthly_charge_generation` e `generate_monthly_member_charges`, último lote transacional, fingerprint da prévia, vigência, isenção, preço individual, dia de vencimento ajustado a meses curtos, até 200 integrantes por regra, `charges_recurring_base_uidx` + chave idempotente e snapshot contábil. Teste `DEV_MONTHLY_GENERATION_ROLLBACK_PASS` em Tenant A/B com geração de 2 cobranças por Loja e ROLLBACK.
- **Operações de competência/cobranças:** wrappers idempotentes para cancelar cobrança de integrante e fechar/reabrir competência; telas `ManualCharges` e `FinancialPeriods`. SQL `DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS` A/B.
- **Painel e relatórios:** 6 KPIs server-side (`read_tenant_financial_dashboard`), inadimplência paginada (`read_tenant_delinquency`), caixa/bancos com saldo por view e movimentações paginadas, orçamento×realizado nas views originais. SQL `DEV_FINANCIAL_DASHBOARD_ROLLBACK_PASS`, `DEV_DELINQUENCY_REPORT_ROLLBACK_PASS` e `DEV_TREASURY_READ_RLS_ROLLBACK_PASS` A/B. Orçamento DEV sem ciclo cadastrado; consultas de orçamento são testadas por mocks, não existe orçamento executado de negócio.
- **Institucional:** novas RPCs `cancel_tenant_institutional_obligation_idempotent` e `correct_tenant_institutional_obligation_idempotent`. Correção bloqueia estado stale `40001` com snapshot/lock e reaproveita comandos antigos, auditoria, aprovação recalculada por política atual, classificação histórica. SQL `DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS` e `DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS`, ambas Lojas e ROLLBACK. UI `InstitutionalOperations` atualizada com correção/cancelamento.
- **Master SaaS:** `read_platform_master_overview` e `list_platform_master_tenants` com `private.require_platform_staff('MASTER')` e MFA/AAL2; nav Master renderiza somente após validação de overview, com painel, diretório e catálogo histórico read-only `MasterCommercialCatalog`. SQL `DEV_MASTER_READONLY_AAL2_ROLLBACK_PASS` com rejeição de sessão AAL1, conta de Loja AAL2 e anon. Nenhuma impersonação, onboarding ou cobrança Master ativada.
- CI pré-Master commit `5c21457f`: 141 testes PASS, frontend build/static PASS. CI para incrementos posteriores conferir o SHA final; nunca contar checks anteriores como aceite de HEAD.
- **Etapa 2 ABERTA**: Master onboarding/360º/billing, catálogo comercial editável/versionado, relatórios Excel/PDF privados e filtros do piloto, conciliação OFX/CSV, transferências e saldos de fundos, negociações/ágapes/mútuas, regras anuais/institucionais, 21 telas HTML V35 e paridade visual mobile/desktop, HTTP/JWT real, sessões concorrentes independentes, qualidade de acessibilidade e segurança. Stage 1 não equivale ao release PROD.
- Atenção a CAPs de 150/200 registros: falham fechado onde limitados, exigem paginação/escala V35. Não exponha entitlements, dados cross-tenant ou execução de Master a partir de CSS/nav; segurança final está no PostgreSQL.

## Incremento 14 — decisões de aprovação de despesas (2026-10-09)

- Migration DEV #35 `20261009181235_payable_approval_idempotent_decisions`, SQL/hash no manifesto. A RPC `decide_payable_approval_idempotent` valida `approvals.review`, decisão `approve/reject`, razão e chave de idempotência e chama a RPC auditada preexistente `decide_payable_approval`. A unicidade `(approval_request_id,actor_user_id)` e eventos imutáveis continuam válidos.
- Interface `PayableApprovals.tsx` adicionada ao Financeiro; exibe apenas solicitações `pending` da Loja conforme `v_payable_approval_state`, com aprovação/rejeição e justificativa. A decisão não gera pagamento. Segurança fail closed para falha de RLS, tenant cruzado, consulta acima de 150 pedidos e replay incerto.
- SQL DEV A/B `DEV_APPROVAL_IDEMPOTENCY_ROLLBACK_PASS`, incluindo criação temporária de obrigação, aprovação/replay e ROLLBACK. Testes React adicionados; CI da SHA final conferir. Visão de aprovação pendente de design completo V35 (políticas, múltiplos aprovadores, autorrevisão, histórico e decisão em casos complexos).
- **Etapa 2 ainda NÃO encerrada.** Permanecem geração de recorrência, operações de correção/cancelamento, orçamento, conciliação, Master SaaS, 21 telas piloto e homologações JWT HTTP/concurrency/visual. Sem produção.

## Incremento 13 — tesouraria institucional com cadastro e liquidação (2026-10-09)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Sem migrations adicionais além das 34 existentes.
- UI `InstitutionalOperations.tsx` e loader `institutional-operations.ts` em Financeiro. Reutiliza RPCs existentes idempotentes: payable/receivable create e payable-payment/receipt, sem duplicar lógica monetária em React. Bloqueia liquidação de despesas sem aprovação e de valores superiores ao saldo; resultados com `integrity_ok` obrigatório e filtro tenant.
- SQL A/B `scripts/verify_dev_institutional_lifecycle.sql`: `DEV_INSTITUTIONAL_LIFECYCLE_ROLLBACK_PASS`, inclusive create/retry e pagamento parcial, tudo revertido. `verify_dev_institutional_foreign_id.sql` PASS. Scripts `verify_dev_financial_lifecycle.sql` PASS. `verify_dev_financial_commands.sql` foi interrompido por precondição histórica incompatível `Fixture changed`, não por divergência testada de valores; atualizar fixture separadamente.
- CI `37971091914` testou commit `69d4d5a4` e aprovou 101 testes/15 arquivos e build. A próxima revisão documental deve ter seu próprio CI validado.
- PENDENTE: autorizar/decidir aprovações, correções e cancelamentos de obrigação, periodicidade institucional, conciliação, contas/fundos, relatórios comparativos, Master SaaS, 21 telas completas HTML V35, HTTP/JWT real e concorrência independente.
- Não executar merge/deploy PROD. Nenhum trabalho em background depois deste turno.

## Incremento 12 — pagamentos e DRE realizados (2026-10-09)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4, Supabase DEV migrations #33/#34 aplicadas e versionadas.
- UI `MemberPayments`: registrar pagamentos de integrantes, alocação manual a cobrança e reversão auditada com replay seguro; consultas isoladas por Loja/integrante e `integrity_ok`. Reutiliza RPCs `register_payment` e `allocate_payment_to_charge`; wrapper novo `reverse_member_payment_idempotent` protege reversão e delega à RPC original.
- UI `DreReport`: consulta até 12 competências da `v_dre_entries` agrupada por conta histórica e natureza, sem apresentar crédito/caixa como receita; relatório somente realizado, sem orçamento/comparativo V35.
- GATES SQL executados: `DEV_MEMBER_PAYMENT_OPERATIONS_ROLLBACK_PASS` e `DEV_DRE_REPORT_ROLLBACK_PASS`, ambas as Lojas e ROLLBACK. Sem alteração em 17 cobranças / 16 pagamentos existentes. Componentes/testes de frontend precisam ter CI final confirmada (não inferir sucesso por SQL).
- Risco: UI limita listagem de integrantes e extratos; revisão com volumes reais/paginação necessária. RPC antiga `reverse_payment` permanece acessível, embora a nova UI use wrapper idempotente. HTTP/JWT assinados, concorrência comprovada, visual desktop/mobile e dezenas de módulos V35 ainda pendentes.
- Não realizar merge/PROD sem critérios de aceite e homologação.

## Incremento 11 — concorrência por Loja e cobertura contábil (2026-10-09 Brasil)

- PR #4 / branch `feat/v35-dev-gate-20261002`, migration DEV #32 `20261009165809_tenant_scoped_accounting_publication_guard`, SHA256 no manifesto.
- Substituídos bloqueios `LOCK TABLE SHARE` globais da publicação por bloqueios `organizations FOR UPDATE` de cada Loja. Seis triggers `accounting_tenant_change_guard` em categorias, contas de caixa/banco, contas contábeis, dois mapeamentos e planos contábeis coordenam escritas concorrentes por tenant. RPC de vínculo contábil passa a bloquear a Loja **antes** do plano para impedir inversão de ordem/deadlocks.
- Categorias novas ativas sem mapeamentos nos planos publicados atuais/futuros são rejeitadas com `23514`. Categorias inativas são admitidas para planejamento de sucessor. Novas contas financeiras são criadas **inativas** por padrão, auditadas corretamente; tentativa de ativá-las sem classificação patrimonial em todos os planos publicados aplicáveis é rejeitada. Triggers impedem inclusive gravações privilegiadas que ignorassem RPCs. UI ajustada e testes de erro `23514`; `scripts/verify_dev_treasury_catalog.sql` atualizado para novo contrato.
- Verificações executadas com transações SQL `ROLLBACK` A/B: `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS`, `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS`, `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS`, `DEV_TREASURY_CATALOG_ROLLBACK_PASS` e `DEV_TENANT_ACCOUNTING_GUARD_ROLLBACK_PASS`. Contagens persistidas: planos 6, publicados 4, template 91, categorias 8, contas financeiras 2, charges 17, payments 16.
- Tentativa de três consultas simultâneas pela API de execução SQL não demonstrou lock do mesmo tenant: falhou na asserção `same-tenant lock unexpectedly free`. O executor pareceu enfileirar consultas. **Concorrência entre conexões comprovadamente independentes: NOT EVALUATED.** Gate definido em `docs/engineering/ACCOUNTING_CONCURRENCY_TEST_PLAN.md`; não declarar PASS.
- CI do último commit: conferir GitHub Actions. HTTP com JWT real, sessões DB independentes, V35 visual desktop/mobile, escala e regras de vigência de novas categorias ainda pendentes. Nenhum deploy/merge de produção.

## Incremento 10 — publicação validada (2026-10-09)

- Branch `feat/v35-dev-gate-20261002`, PR #4, Supabase DEV migration 31 `20261009162535_validated_accounting_plan_publication`; fonte e hash no manifesto.
- Wrapper `publish_validated_accounting_plan` verifica `accounting.manage`, vigência esperada, retry idempotente e prontidão real sob locks na Loja/rascunho e nas tabelas contábeis. Publicação antiga continua apenas internamente, com EXECUTE autenticado revogado.
- Frontend `AccountingPrepublication` exige confirmação e motivo, reenvia payload inalterado em erro incerto e atualiza estado quando o servidor confirma UUID idêntico ao plano.
- SQL rollback A/B `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS` cobre sucesso, bloqueios, imutabilidade, auditoria e ausência de alterações financeiras persistentes. CI da SHA final deve ser conferida antes de classificar.
- Risco: SHARE lock global em 5 tabelas bloqueia gravações de outros tenants durante publicação. Testar concorrência de conexões separadas e HTTP/JWT real antes de produção, além de verificar compatibilidade de clientes externos com RPC legada revogada.
- Próximo: validação multi-sessão, sucessão de categorias ativas pós-publicação e paridade visual V35 desktop/mobile. Nenhum merge/deploy em PROD.

## Incremento 9 — Pré-validação para publicação contábil (2026-10-09)

- Contexto: V35 Etapa 2; GitHub PR draft #4 branch `feat/v35-dev-gate-20261002`.
- DEV migration #30: `20261009041818_accounting_plan_prepublication_preview`, fonte/hashes no manifesto. RPC `preview_accounting_plan_publication` é somente leitura, `accounting.manage`, status draft/futuro, contagem de cobertura, incompatibilidades, ciclos e conflito com published.
- UI `AccountingPrepublication.tsx` e testes, integrada em `AccountingPlans` para rascunhos; apenas mostra razões de bloqueio e quantidades. Prontidão no preview **não** publica nem torna o plano ativo.
- SQL de integração A/B `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS` verificado; nenhuma mudança persistida nas fixtures e nenhuma alteração de ledger.
- CI dos arquivos frontend/consolidação: verificar no GitHub Actions pela SHA final antes de declarar PASS. HTTP/JWT real, concorrência simultânea de publicação e homologação visual/mobile não executados.
- Próximo passo crítico: definir comando transacional de publicação que reavalie o preview sob locks, com retry idempotente e prevenção de alterações pós-check; testar cenários concorrentes e evitar sobrescrever fatos históricos. Avaliar o endpoint legado `publish_accounting_plan` antes de liberar UI, preservando isolamento, publicações existentes e o HTML V35.
- Sem merge, deploy de produção ou pagamento de provedores.

## Incremento 8 — Plano de Contas: drafts e mappings (2026-10-08 Brasil)

- Branch `feat/v35-dev-gate-20261002`, PR draft #4, nova migration DEV29 `20261009014331_tenant_accounting_drafts_and_mappings`, fonte SHA256 no manifesto.
- Código: `src/lib/accounting-plans.ts`, `src/components/AccountingPlans.tsx`/`.test.tsx`, módulo conectado a `FinancialStructure` e CSS responsivo; wrapper idempotente para plano draft a partir de template (91 contas), duplicata da Loja ou branco; vinculação draft de categoria/conta financeira a conta analítica com natureza compatível.
- Preservação: plano publicado imutável, mapeamentos/valores históricos não alterados; nenhuma publicação automática, sem alteração de ledger, RLS ou grants de tabela.
- SQL DEV `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS` confirmado A/B, inclusive 91 contas/86 hierarquias; fixtures SQL revertidos. 6 planos DEV anteriores e template padrão preservados.
- CI validar revisão exata após commit. HTTPS/JWT real do novo recurso, concorrência entre sessões e homologação visual com HTML V35/mobile ainda não verificados.
- Próximo: revisão de códigos/estrutura V35, validação pré-publicação e sucessão sem sobreposição, regras de categoria neutra/repasse, operações financeiras e relatórios.
- Sem produção/merge/contratações.

## Incremento 7 — Identidade da Loja, 2026-10-08 Brasil

- DEV migrations 27/28 `20261009012944_tenant_identity_commands` e `20261009013042_tenant_settings_monotonic_version`, fontes e hashes no manifesto.
- Nova UI `TenantIdentity.tsx` inserida na tela Plano de Contas; cadastro e edição de contato, PIX, endereço e localização, sem fluxo de transferência.
- RPC de gravação única com `settings.manage` + idempotência + lock da Loja + revisão otimista e auditoria minimizada. Trigger corrigido somente para `organization_settings` por bug de `now()` em transações.
- SQL de DEV A/B, cenários positivos/negativos e ROLLBACK PASS; fixture não persistida. Os 17 títulos e 16 pagamentos financeiros anteriores seguem intactos.
- Verificar CI do commit final, HTTP/JWT real, concorrência entre conexões, mobile, HTML V35, demais parâmetros, plano contábil, logo e demais configurações ainda pendentes. Nada liberado em produção.

## Incremento 6 — contas/fundos/meios de pagamento (2026-10-08 Brasil)

- Branch: `feat/v35-dev-gate-20261002` no PR draft #4.
- Migrations DEV 25 e 26: `20261009011416_tenant_treasury_catalog_commands`, `20261009011533_treasury_catalog_scope_error_fix`. Fontes e hashes versionados.
- RPCs protegidas: criação/ativação/desativação de financial_accounts, funds e payment_methods, sem DELETE, sem novos grants ou RLS e sem operações financeiras; permission `settings.manage`/assinatura. Correção de checagem explícita `v_old is null` após EXECUTE INTO.
- Frontend: `TreasuryCatalogs.tsx` dentro de `FinancialStructure.tsx`; `treasury-catalogs.ts` carrega três catálogos com escopo explícito; testes de componente e CSS responsivo.
- Gate SQL reexecutado A/B (claims simuladas, ROLLBACK): `DEV_TREASURY_CATALOG_ROLLBACK_PASS`; resultados reais positivos/negativos e contagens financeiras preservadas.
- Validação CI do commit final: consultar GitHub Actions antes de classificar. E2E HTTP/JWT real, corrida simultânea, screenshot/mobile e paridade integral não avaliados.
- Próximo: identidade/parâmetros da Loja, plano contábil e mapeamentos, regras especiais e geração/baixas, mantendo escopo do HTML V35. Sem merge/prod/pagamento contratado.

## Retomada sem Work — 2026-10-08, Etapa 2 / incremento 5

- Base: `feat/v35-dev-gate-20261002`, PR draft #4; migração 24 aplicada somente DEV: `20261008211155_member_term_transition`.
- Implementação: transição atômica de termo mensal aberto, validação de competência futura, lock, idempotência, auditoria, autorização `settings.manage`, sem escrita direta nem alteração de ledger.
- UI: substituir ou encerrar condição individual/isenção na ficha do integrante, tratamento de conflito `40001` e atualização de histórico.
- Evidência: SQL DEV executado para A/B com testes positivos/negativos, exceções financeiras e `ROLLBACK`, `DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS`. Integridade histórica e 24 migrations no manifesto.
- Não avaliado nesta verificação: HTTP/JWT real da nova RPC, concorrência de clientes simultâneos, preview visual desktop/mobile, paridade V35 integral. Não declarar produção pronta.
- Próximo incremento: contas financeiras, fundos, meios de pagamento, parâmetros e plano de contas, preservando piloto e ACLs. Nova UI precisa ser validada pela CI no commit efetivo.
- Sem merge, deploy de produção, novo provider ou custo pago.

# SESSION HANDOFF — 2026-10-03 UTC / 2026-10-02 Brasil

## Etapa 2 — catálogo mensal entregue, 2026-10-08

Implementado FinancialStructure em navegação Plano de Contas; cria categoria, regra mensal/preço inicial futuro e programa preço sucessor. MigrationCLI2.119.0 alinhada ao DEV20261008203643, total23no manifesto. Ver ADR0008 e docs/V35_STAGE_2_IMPLEMENTATION.md. Typecheck/45 testes/build PASS; placeholder público de build, sem publicação. SQL DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS antes/depois DDL; teste final ampliado suspensão3RPCs PASS. Claims simuladas, sem credenciais/HTTPnovo. Pós-teste8categorias originais, regras/preços/termos0, doisADMIN e subscriptionsactive, flags originaisallow_recurrencefalse. Ledger não modificado. Advisors43/3/1. Nenhuma produção/custo/merge.
Próximo: sucessão/encerramento de termos individuais; catálogos de contas/fundos/meios, parâmetros Loja e plano/mapeamentos. Preservar natureza neutra/repasse e regras especiais do piloto; regras anuais/institucionais e geração/previsão não implementadas aqui. Consolidação HTTP real e paridade visual/mobile ainda pendentes. CI após push; preview não publicado por esta sessão.


## Validação final de valores individuais — 2026-10-08

Migration20261008202409 rejeita NaN/Infinity/-Infinity, valores acima de999999999999.99, negativos e precisão maior que2casas com22023 antes de qualquer persistência. Correção aditiva da RPC, sem editar migration já aplicada; mesmo catálogo/permissões/idem/audit. PostgreSQL aceita NaN em comparação não negativa; validação explícita necessária no servidor, além do formulário. Teste rollback ampliado NaN/Infinity/overflow passou antes/depois de aplicação. Nenhum valor não finito persistido pelo teste. Total22migrations alinhadas ao manifesto. Advisors permanecem40/3/1.
CI do incremento cargos/termos8a4beff0:37838896130/run46 completed success. Nenhuma publicação feita pela CI (bundle apenas validado sem upload). CI da correção de validação conferir no commit seguinte. Etapa2 em execução; HTTP real novo e paridade visual pendentes.


## Etapa 2 — cargos e termos futuros, 2026-10-08

Implementados catálogo de cargos (criação), atribuição com vigência e programação de mensalidade individual/isenta/geral. Migration CLI2.119.0 alinhada ao DEV20261008201550, duas RPCs idempotentes/auditadas com search_path vazio, require_permission antes de consultas e sem grants diretos ou alterações de RLS. settings.manage (ADMIN) para catálogo/termos; members.write (ADMIN/TREASURER) para atribuição de cargo. Motivo de programação obrigatório.
Termos começam em competência futura, cargos hoje ou depois; exclusões existentes rejeitam sobreposição. Vários cargos diferentes simultâneos continuam permitidos pelo contrato existente. Configurações não reescrevem ledger nem geram cobranças. Sucessão/encerramento de vigência aberta, ativação/desativação de catálogo e regras/preços versionados ainda pendentes.
Tela conectada lê quatro tabelas com organização/integrante explícitos, AbortSignal e rejeição de escopo inesperado. Mostra históricos, vazio real e até200registros. Falha ambígua bloqueia edição e repete mesma chave/payload até confirmação. Catálogo de regras mensais permanece vazio no DEV; fluxo mensal depende do próximo incremento de regras/categorias/preços, sem catálogo fictício persistido para aparentar funcionamento.

DEV_MEMBER_CONFIGURATION_ROLLBACK_PASS antes/depois de DDL; após aplicação também ADMIN A/B positivos, retries, sobreposição23P01, IDs estrangeiros23503, precisão/retroatividade22023, auditoria, TREASURER cargo positivo/configuração financeira negada, VIEWER e suspensão42501, anon sem EXECUTE. Claims SQL simuladas; NÃO nova prova HTTP/JWT ou corrida simultânea. Todos fixtures e mudanças de papel/assinatura/eligibilidade revertidos por ROLLBACK.
Typecheck/39 testes frontend/build PASS, chave pública placeholder só para build, sem publicação/homologação visual. CI desta entrega conferir no commit remoto. Advisors:40RPC definer autenticadas (38 anteriores +2 novas intencionais),3backend RLS sem policy e aviso preexistente de senha vazada; não declarar scanner limpo.
Próximo: categorias elegíveis e regras mensais/preços com vigência; depois sucessão de termos e estruturas financeiras. Etapa2 EM EXECUÇÃO. Paridade integral do HTML V35 continua obrigatória, inclusive campos ainda ausentes no banco. Produção e entrada em operação não autorizadas.


## Etapa 2 — cadastro/edição cadastral implementados, 2026-10-08

Novo comando public.save_member_profile usa members.write (ADMIN/TREASURER no catálogo existente), require_permission e bloqueio de assinatura. Payload permitido limitado a dados cadastrais; desconhecidos/CPF/organization_id/roles/valores financeiros rejeitados. Criação/edição transacionais por RPC, sem INSERT/UPDATE/DELETE direto para authenticated, sem alteração de RLS.
Reutiliza idempotency_begin/complete; mesmo envio retorna UUID sem novo audit, chave com payload diferente22023. Edição bloqueia a linha e compara updated_at exato, stale40001; ID estrangeiro23503, org/perfil/status não permitido42501. Trigger específico de members avança updated_at com clock_timestamp/maior que anterior, inclusive dentro da mesma transação; demais tabelas mantêm trigger original.
Audit registra ator, entidade, situação e nomes dos campos alterados; não copia contatos/observações para snapshots. Motivo livre deve evitar dados sensíveis desnecessários.
Formulário conectado ao Workspace: nome/preferencial, quatro situações, texto de grau/cargo, telefone/WhatsApp/e-mail, datas e observações; motivo obrigatório, duplicidade bloqueada, conflito pede reload. Falha ambígua mantém payload/chave e campos bloqueados até confirmação por retry; callback tardio não atualiza outra Loja.
Grau/cargo textual não substitui catálogo/cargo vigente. Mensalidade individual/isenção versionadas, criação de login, CPF, vínculos, cargos com vigência e paridade integral continuam pendentes; não concluir etapa2.

Migration gerada pela CLI2.119.0 e aplicada no DEV com versão20261008195936; fonte/hash no manifesto. Recuperação: forward-fix aditivo; se houver falha operacional, revogar EXECUTE da novaRPC e manter leituras/dados, sem apagar integrantes/ledger. Não aplicada produção.
DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS antes e depois da aplicação: positivosA/B, retry, payload divergente, mass-assignment/date/name inválidos, estrangeiros, escrita direta, stale, VIEWER, suspensão e Master sem papeltenant. Claims simuladas/SQL, NÃO HTTP/JWT real novo. Zero integrantes temporários remanescentes; A/B ADMIN e assinaturasactive conferidos.
npm run check PASS: typecheck,36 testes frontend, build com chaveplaceholder; build não prova login/deploy. HTTP real novo, concorrência simultânea e homologação visual pendentes. CI do incremento de consulta880cc5a/run37834705645success; novaCI conferir após push.

Advisors pós-DDL:38 RPCs definer autenticadas (37 existentes + novaRPC intencional com require_permission),3 tabelas backend RLS sem policies e aviso preexistente de proteção contra senhas vazadas. Não declarar scanner zero nem modificar grants/RLS backend para remover avisos:
- [RPC autenticada definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabelas backend sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


## Etapa 2 — primeiro incremento de consulta cadastral

Busca por nome/contato, quatro situações e ficha dos campos existentes implementadas; ver docs/V35_STAGE_2_IMPLEMENTATION.md. Typecheck/32 testes/build PASS; SQL A/B dos campos ampliados isolados PASS com claims simuladas. Sem writes/schema/grants. Cadastro/edição, cargos/termos com vigência, mensalidade/isenção e estrutura configurável continuam pendentes. Build placeholder não prova deploy; conferir CI após push e não declarar paridade/etapa2 concluída. CI do encerramento etapa1 0bb69d7: run37833762180success.

## Estado atual — 2026-10-08 Brasil

Etapa 1 CONCLUÍDA no DEV; etapa 2 EM EXECUÇÃO, começando pela conciliação de integrantes, parâmetros e estrutura financeira com o piloto V35. Evidência consolidada e limites: [V35_STAGE_1_CLOSURE_REPORT.md](docs/V35_STAGE_1_CLOSURE_REPORT.md).
Último HTTP: DEV FINAL AUTHORIZATION 09fcfa34-48ad-4c19-ac60-b2c173b2648b, PASS nas duas lojas; 28 views e oito negativas adicionais por recurso em cada loja. Estados finais e saldos conferidos administrativamente. CI do código f467d8e6: run 37720733935 success.
Produção/release comercial continuam bloqueados pelo escopo restante V35, homologação, recuperação e aprovação. Os registros datados abaixo são históricos; suas pendências da etapa 1 são superadas somente no escopo discriminado no relatório, sem converter cenários não avaliados em PASS.


Repo MichaelDeCarvalho/Corsys.TroncoDigital, branch feat/v35-dev-gate-20261002, PR draft #4: https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/4 . Base feat/v35-foundation. HEAD anterior a este incremento: 271e4277603f306be5608a7bc6e3837dfd6c1057. Sem merge/produção autorizados.

## Marco confirmado

Preview DEV https://corsys-tronco-digital-dev.corsys1.workers.dev/ abriu no navegador; HTTP 200 e JS/CSS 200. Proprietário confirmou login real dos dois usuários e visibilidade Michael/TENANT A, jobmcc/TENANT B, em 2026-10-02. Senhas não obtidas. Este teste manual não é teste negativo de segurança.

Proprietário determinou preservar no mínimo todo o piloto V35. ZIP reenviado coincide com SHA da fonte previamente importada. HTML V34 operacional recebido separadamente e inventariado em docs/V35_PILOT_PARITY.md / V35_PILOT_INVENTORY.md; 6 telas Master + 15 cliente, campos/ações/abas e fragmentos dinâmicos. Referência sanitizada remove apenas duas tags externas de antivírus; original intacto. Não executar o protótipo como aplicativo real. Navegador bloqueou localhost/file; revisão estática, sem cliques ou homologação visual. docs/V35_COVERAGE.md registra domínios, regras, 29 ADRs e pendências de interface. scripts/check_v35_preservation.py acrescentado à CI: 29 ADRs, 19 migrations aplicadas, 51 documentos e 263 declarações SQL preservados. Não equivale a teste semântico ou prova de paridade visual.

## Incremento

Financeiro no menu desktop/mobile: cobranças de integrantes, contas a pagar e contas a receber, por Loja; páginas de 25, refresh e anterior/próxima. Valores efetivos/em aberto derivados no banco; cancelamento e aprovação exibidos conforme views. Sem novas migrations, grants ou escritas. Integrantes, Auth e chamados preservados.

Consulta SQL das três views sob authenticated e claims simuladas AAL1 foi executada; todas retornaram zero linhas próprias/cruzadas. Demonstra acesso às views, não isolamento negativo com fatos presentes nem HTTP/JWT assinado. Nenhum fato financeiro criado neste incremento.

## Verificação

npm run check: typecheck app/node PASS, 23 testes frontend PASS e build Vite PASS. Testes cobrem navegação financeira, precisão de exibição, separação de domínios, paginação, resposta tardia, tenant inesperado, inconsistência/valor inválido, erro e retry. Testes de componentes usam client simulado; não são teste de autorização real. Gate de preservação PASS.

CI do commit ada7ccca: frontend PASS e static FAILED por caminhos de ADRs no novo manifesto. Corrigidos para docs/adr/v35/, sem alterar conteúdo histórico. Cloudflare confirmou deploy ada7ccca com sucesso. CI do commit 69920e8e PASS (run 37090789414), deploy Cloudflare confirmado; assets HTTP200 correspondentes ao build. Não marcar publicação do incremento como verificada antes da evidência dos assets correspondentes. Inspeção autenticada desktop/mobile ainda pendente por ausência de sessão de teste neste navegador.

## Pendências e próxima etapa

1. Validar HTTP/JWT positivo/negativo, MFA/AAL2, suspensão e concorrência/idempotência antes de liberar comandos financeiros.
2. Completar integrantes e configurações; comandos financeiros por RPCs existentes, com invariantes/versionamento.
3. Completar Master SaaS, planos/promoções V35, onboarding, suporte/SLA, billing, DRE/orçamento/conciliação e demais domínios da matriz.
4. Cumprir IDs do inventário recebido e homologar ambas as lojas/Master desktop/mobile; nunca declarar paridade integral sem evidência de cada fluxo. V35 mantém nome/código editável em todo rascunho com snapshots publicados imutáveis; supera a restrição V34.

Advisors históricos: 37 avisos de RPCs definer autenticadas, três tabelas backend sem policies por negação padrão, proteção contra senhas vazadas desabilitada. Nenhum upgrade/custo novo ativado. DEV autorizado; toda cobrança deve ser apresentada antes, produção aprovada depois.

## Comandos

npm ci --ignore-scripts; npm run check; npm run check --prefix dev-gate; python scripts/check_v35_preservation.py; python scripts/check_sql.py (requer scripts/requirements-checks.txt). Build funcional usa .env.local ignorado; placeholder CI não autentica. Apenas configuração wrangler.dev.jsonc. Não pedir senhas/tokens no chat.

Verificações adicionais locais: quatro testes guard DEV PASS, gramática SQL PASS e Wrangler dry-run PASS. A correção de caminhos deve ser validada no checkout remoto, não somente na cópia local que contém ambas as pastas.

## Revisão do piloto — 2026-10-03

Este incremento preserva referência HTML/JSON/relatórios e adiciona integridade ao gate; não modifica frontend, banco ou permissões. São 129 ocorrências de campos nas telas + 3 compartilhadas + 297 dinâmicas/históricas em 126 fragmentos, não campos únicos. O escopo foi conciliado com a V35 sem transformar simulações em funcionalidades prontas. Consultar os dois relatórios antes de qualquer módulo; CI desse incremento deve ser conferida após push.

## Evidência de vídeos — 2026-10-03 Brasil

Sete vídeos inspecionados por quadros e cenas críticas, total aproximado 8min38s, desktop 1920×1032. docs/V35_PILOT_VIDEO_REVIEW.md registra timestamps/cobertura/ajustes/pendências; hashes em docs/engineering/v35-pilot-video-evidence.json. Fonte gravada é corsys-tesouraria-preview-v35-planos-ofertas.html, recebida neste incremento; ver conciliação V35. V35 exibe filtros, exclusão controlada e identidade editável em rascunho sucessor; preservar junto ao baseline V34. Master + Aurora/André parcialmente observados; não afirmar homologação funcional da segunda Loja ou mobile ou comandos reais. Recursos não gravados continuam obrigatórios. CI da revisão anterior 55276f6: run 37093088888 success.

## Fonte V35 recebida e layout comum — 2026-10-03

O HTML V35 foi recebido e preservado separadamente do histórico V34. Consultar docs/V35_PILOT_RECONCILIATION.md e docs/V35_PILOT_V35_INVENTORY.md: 21 telas, 132 campos estáticos, três compartilhados e 301 ocorrências em 132 fragmentos. Todas as lojas usam um único layout reutilizável, conforme confirmação do proprietário; dados, identidade, papel e situação comercial variam por organização. Nove vídeos revisados; Ricardo/segunda loja e aviso de atraso agora têm amostra visual. Não exigir repetição integral das telas por cliente. Recebimento da fonte resolvido; paridade React/Supabase, mobile, comandos persistidos e autorização real permanecem pendentes. Nenhuma mudança de frontend/banco/deploy neste incremento.


## Etapa 1 iniciada — 2026-10-05 Brasil / 2026-10-06 UTC

Proprietário autorizou avançar pela sequência de oito etapas. docs/V35_DELIVERY_PLAN.md registra estado/evidência e pendências. Decisões comerciais em docs/adr/0005-commercial-launch-decisions.md e config/commercial-decisions.json: dois planos BRL 125/180 mensais, cobrança manual e futura Stripe preferencial; suporte interno/WhatsApp manual, automação futura; domínio pendente. Configuração registrada, catálogo/integrações ainda não ativados.

SQL de catálogo e isolamento reexecutado com sucesso. Novo scripts/verify_dev_subscription_and_staff.sql passou após corrigir fixture publicada sem timestamp: tolerância/suspensão/override, limites de staff/AAL e proteção do último Master; claims simuladas, helpers/triggers, rollback conferido sem dados temporários. Não equivale a HTTP/JWT/MFA reais ou comandos financeiros completos. dev-gate possui roteiro HTTP reforçado e exemplo dos UUIDs existentes, sem necessidade de chave administrativa. Oito testes locais passaram; roteiro HTTP autenticado ainda não executado por ausência das senhas em ambiente seguro. Não solicitar senhas/tokens pelo chat nem alterar credenciais existentes. Nenhuma migration, grant, schema, frontend, produção ou serviço pago alterado.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.


## Recuperação de senha DEV — 2026-10-07

Implementado Esqueci minha senha, solicitação resetPasswordForEmail com redirectTo da origem atual, tratamento PASSWORD_RECOVERY e formulário autenticado updateUser. SDK detectSessionInUrl=true; flag de recuperação é somente apresentação, identidade validada por getUser e RLS continua server-side. Formulário compara identidade antes de trocar senha, exige confirmação/12 caracteres, bloqueia duplicidade e limpa campos após tentativa; resposta de solicitação não confirma existência de conta. Recuperação mantém workspace oculto até retorno explícito ao login. Site URL/Redirect URLs DEV configurados conforme relato do proprietário, não conferidos via API. Reenvio e recuperação reais por e-mail dependem de homologação do proprietário; nenhum e-mail enviado pelo agente, nenhuma senha/token lido, nenhum grant ou schema alterado. Não declarar etapa 1 concluída. Ver docs/DEV_PASSWORD_RECOVERY.md.


## Smoke HTTP autenticado aprovado — 2026-10-07, 18:20 Brasil

Evidência: saída integral fornecida pelo proprietário, execução local Windows/Node
v24.20.0 na cópia da branch DEV. O agente não executou este comando com as credenciais;
a classificação é execução pelo proprietário com resultado PASS apresentado.
Nenhuma senha, token ou arquivo .env foi recebido.

Comando: npm run test:tenant-isolation.
Resultado:
PASS: real Auth identities, tenant reads/RPCs, tenant-to-Master denial and invalid JWT. Financial positive fixtures, MFA, suspension and concurrency remain separate gates.

Baseline HTTP aprovado: login/getUser dos dois UUIDs esperados, consultas próprias
positivas de organização/integrantes, consultas cruzadas explícitas ocultas,
views financeiras cruzadas, catálogo/configuração/staff Master ocultos,
RPC Master negada, chamado próprio criado/lido e chamado cruzado negado,
acesso anônimo restrito e JWT inválido rejeitado com HTTP 401.

Limites: views financeiras sem fatos próprios não comprovam isolamento financeiro
positivo por HTTP; os fatos SQL anteriores foram revertidos. Não aprova MFA real,
perfis/expiração/revogação/suspensão por HTTP, matriz completa de RPCs ou concorrência
simultânea. Etapa 1 continua EM EXECUÇÃO. A recuperação real por e-mail não foi
homologada: o proprietário encontrou a senha existente. Manter credenciais somente
no .env.dev privado local, sem commit/upload. Chamados legítimos do smoke permanecem
no DEV com prefixo RLS DEV TEST, conforme roteiro.


## Próximo gate preparado — 2026-10-07

Ver docs/DEV_FINANCIAL_HTTP_GATE.md. Estrutura financeira fictícia persistida nas duas lojas e plano DEV de valor zero com assinaturas active, sem cobrança, Auth/grants/schema alterados. Comandos SQL com claims simuladas despachados em paralelo: saldo disputado preservou uma alocação de 100 e crédito zero; mesma chave preservou uma cobrança/audit. Sobreposição exata não instrumentada; não equivale a HTTP real. Novo npm run test:financial-http preparado para credenciais privadas locais; 10 testes locais PASS e sintaxe PASS. Roteiro HTTP financeiro e MFA/suspensão/matriz ainda pendentes. Não apagar ledger nem repetir seed/roteiro após falha sem inspeção. Scripts antigos com precondição de zero planos/assinaturas agora bloqueiam por fixture alterada, esperado.


## HTTP financeiro aprovado pelo proprietário — 2026-10-07, 18:51 Brasil

Execução Windows/Node v24.20.0 pelo proprietário; saída PASS apresentada no chat, não executada pelo agente com credenciais. npm ci: 0 vulnerabilidades no dev-gate; npm run check: 10 testes PASS. npm run test:financial-http: Tenant A e Tenant B PASS; HTTP/JWT real, views próprias positivas/cruzadas ocultas, auditoria, idempotência com requisições simultâneas e disputa de alocação aprovados no escopo do roteiro. Tag: DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe. Fatos fictícios permanecem no DEV; não repetir sem necessidade nem apagar ledger. Tentativas anteriores pararam antes de escritas por dependência ausente, project ref e identidade inesperada; configuração corrigida localmente, nenhuma senha/token recebido. CI Foundation checks do código c39de3a: run 37690001216 success. Não é teste de carga em escala nem cobertura de todas as RPCs. Etapa 1 continua aberta: MFA real, suspensão/revogação/perfis por HTTP, recuperação por e-mail e matriz restante. Produção e merge não aprovados.


## Gate suspensão/retomada preparado — 2026-10-07, após PASS financeiro HTTP

Ver docs/DEV_SUSPENSION_MFA_GATE.md. Roteiros test:suspension-http (seis RPCs/42501, leitura própria positiva e saldos preservados) e test:restoration-http (write positivo de pagamento fictício 1) preparados. SQL fixo suspend/restore somente assinatura DEV zero-price B, mantendo A active; transições/helpers validados em transação revertida: DEV_SUSPENSION_TRANSITIONS_ROLLBACK_PASS, claims simuladas. As duas lojas continuam active; não iniciar janela sem conseguir restaurar. 10 testes locais PASS e sintaxe PASS; HTTP das novas fases ainda pendente. check:mfa-posture só inventário INFO com getUser/assurance/listFactors, sem cadastrar fator nem alterar Auth; não é MFA PASS. MFA real e staff positivo, sessão/revogação/perfis/matriz completa continuam abertos. Nenhuma alteração persistente de status, schema, grants, layout, senha, cobrança ou produção. Código/docs devem ter CI conferida após push.


## Diagnóstico MFA real e janela de suspensão — 2026-10-07, 21:52 Brasil

Proprietário executou check:mfa-posture no Windows com logins reais: A current=aal1 next=aal1 verified_factors=0; B current=aal1 next=aal1 verified_factors=0. Inventário INFO, NÃO aprovação MFA; sem alteração de fatores/Auth. npm ci: zero vulnerabilidades dev-gate; 10 testes locais PASS apresentados. Código de preparação 933d6eb: Foundation checks run 37693053151 success.

JANELA ABERTA: agente executou scripts/suspend_dev_tenant_b_http.sql no DEV autorizado; consulta confirmou B suspended e A active. Aguardar resultado do proprietário para npm run test:suspension-http. Restaurar B com scripts/restore_dev_tenant_b_http.sql imediatamente ao receber resultado, inclusive se FAIL, ou se proprietário interromper os testes. Em seguida validar npm run test:restoration-http com login real. Não marcar suspensão HTTP como PASS antes da saída. Nenhum ledger/Auth/grant/schema/produção alterado; status temporário somente assinatura fictícia zero-price B. Notas anteriores de ambas active referem-se à preparação, não à janela atual.


## Suspensão HTTP aprovada e janela encerrada — 2026-10-07, 21:54 Brasil

Proprietário executou npm run test:suspension-http com logins/JWT reais. Seis negativas 42501 PASS: create_manual_charge, register_payment, allocate_payment_to_charge, allocate_payment_fifo, cancel_charge, reverse_payment. Próprias views financeiras positivas e saldos preservados; A active. Tag DEV SUSPENSION 7cb919d9-81de-402a-b708-9404af5c5e3c. Saída apresentada pelo proprietário; agente não recebeu credenciais nem executou HTTP autenticado.

JANELA ENCERRADA: imediatamente após saída, agente executou scripts/restore_dev_tenant_b_http.sql no projeto DEV e consulta confirmou A active e B active. Isto supera o registro anterior de B suspended. Pendente npm run test:restoration-http para provar retomada positiva com JWT real. Suspensão validada somente B, status suspended e seis RPCs; canceled/past_due/security_hold, demais RPCs/perfis/revogação e MFA real não aprovados. Sem alterações em Auth, ledger, schema/grants, cobrança ou produção; etapa 1 segue aberta.


## Retomada HTTP positiva aprovada — 2026-10-07, 21:56 Brasil

Proprietário executou npm run test:restoration-http no Windows com JWT/login real e apresentou PASS: ambas assinaturas active; register_payment da loja B voltou a escrever, pagamento fictício 1 com available_amount=1, organização própria e integrity_ok=true. Tag DEV SUSPENSION ef9110f9-141b-4a21-be25-a50865935970. Fato fictício permanece DEV. Agente não recebeu credenciais nem executou este HTTP autenticado. Fecha a pendência da retomada neste cenário B active -> suspended -> active e seis RPCs negadas. Não aprova MFA, revogação de papéis/sessões, canceled/past_due/security_hold, todas as RPCs ou demais perfis. Etapa 1 continua aberta; ambas lojas ativas, nenhuma janela de suspensão pendente. Próximo escopo: MFA real com staff e matriz de autorização restante, preservando usuários tenant/credenciais atuais e sem promoção automática a Master.


## Gate estorno/cancelamento preparado — 2026-10-07, após retomada HTTP

Ver docs/DEV_FINANCIAL_LIFECYCLE_GATE.md. Novo test:financial-lifecycle cria fatos fictícios próprios nas duas lojas, testa reverse_payment/cancel_charge concorrentes (um UUID/um 23505), saldos/reversão de alocações/audit/originais preservados, ID estrangeiro P0002 e organização alheia 42501, motivo/período 22023 e FIFO após estorno 55000. Só corrige fatos novos, sem FIFO positivo sobre integrante compartilhado. 11 testes locais PASS e sintaxe PASS. SQL verify_dev_financial_lifecycle.sql passou nas duas lojas dentro de ROLLBACK, claims simuladas; não comprova JWT/HTTP/concorrência. HTTP novo ainda pendente do proprietário. Ambas lojas continuam active, sem nova janela de status, Auth/grants/schema/frontend/cobrança/produção alterados. Etapa 1 segue aberta para MFA/staff, revogação/perfis, institucional/FIFO positivo e matriz restante. CI deve ser conferida após push.


## Lifecycle HTTP aprovado pelo proprietário — 2026-10-07, 22:10 Brasil

Execução Windows/Node pelo proprietário, npm ci zero vulnerabilidades dev-gate e 11 testes locais PASS apresentados. npm run test:financial-lifecycle: Tenant A PASS, Tenant B PASS e conclusão HTTP/JWT PASS. Tag DEV LIFECYCLE 8b67cd58-6f78-4f70-b3e7-d3e07f287653. Estorno/cancelamento nos dois encadeamentos, operações simultâneas com evento único/rejeição exata de duplicata, efeitos nos saldos, auditoria/ator, reversão de alocações, originais preservados e negativas de recursos estrangeiros aprovados no escopo do roteiro. Fatos fictícios corrigidos permanecem no DEV. Saída fornecida pelo proprietário; agente não executou HTTP com credenciais, não recebeu senha/token/env. CI do código preparado: Foundation checks run 37710839313 success. Novo gate deixa de ser somente preparado; HTTP positivo/negativo dessa matriz está aprovado, sem inferir cobertura integral. Ambas lojas ativas, nenhuma suspensão pendente. Etapa 1 continua aberta: MFA real/staff, revogação/perfis/sessões, FIFO positivo, financeiro institucional e matriz restante. Não repetir comandos já aprovados sem motivo, não apagar ledger. Produção/merge/cobranças novas não aprovadas.


## Pacote restante da etapa 1 preparado — 2026-10-07 Brasil / 2026-10-08 UTC

Proprietário determinou continuar até fechar etapa1; não declarar encerrada enquanto gates reais pendentes. Ver docs/DEV_STAGE1_CLOSURE_GATE.md. Persistidas somente fixtures DEV isoladas para FIFO e plano/mapeamentos 2027, sem sobreposição/alteração de fatos 2026. SQL rollback PASS: FIFO/institucional/fechamento, 20 comandos cross-org por identidade, FK institucional23503 e cinco transições de perfil/restauração. 12 testes locais/sintaxe PASS. Preparados test:stage1-remaining, test:profiles-live (JWT original sem refresh durante fases) e test:master-mfa (QR local privado, OTP mascarado, AAL1 negativo/AAL2 positivo). Todos novos HTTP/TOTP ainda NÃO EXECUTADOS pelo proprietário. Ambas assinaturas active, papéis ADMIN originais preservados e nenhum vínculo/staff/fator temporário aplicado. Conta dedicada escolhida via pergunta pelo proprietário: michael.c.carvalho+corsys-dev-master@gmail.com; consulta Auth ainda não encontrou usuário, staff_count=0. Proprietário precisa criá-la no painel e manter senha local; conector não oferece criação Auth. Não inserir Auth por SQL nem fabricar tokens. Bind primeiro Master só após identidade criada/conferida, proteção do último Master permanece. Support/Billing/sessões/expiração/revogação e critérios críticos remanescentes continuam obrigatórios, não cobertos por Master sozinho. Mudanças não promovem etapa2, não alteram produção/cobrança/grants/schema/frontend. Conferir CI contra novo commit. Pendências reais dependem de execução/OTP do proprietário, não de autorização nova.


## HTTP restante aprovado pelo proprietário — 2026-10-08 UTC

Execução local Windows/Node v24.20.0 pelo proprietário na pasta de download (3), saída integral apresentada; nenhuma credencial recebida pelo agente. npm ci: zero vulnerabilidades no dev-gate; npm run check: 12 testes PASS. npm run test:stage1-remaining: Tenant A e Tenant B PASS. Tag: DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696.

Com JWT real nas duas lojas: 20 RPCs do catálogo negaram organização alheia; FIFO positivo ordenado e concorrente preservou alocações/saldos; financeiro institucional positivo/cruzado, idempotência, saldos e auditoria passaram; fechamento negou lançamento e reabertura permitiu escrita positiva. Saída confirmou competências reabertas. Fatos fictícios 2027 permanecem DEV; não repetir o gate de integrante limpo nem apagar ledger sem inspeção. O catálogo testa negação por organização, não toda combinação de parâmetros/IDs. Não comprova idempotência de eventos de auditoria FIFO.

Supera a pendência HTTP deste roteiro na preparação anterior. Perfis/revogação live ainda NÃO executados; próxima execução é test:profiles-live, aguardando WAIT antes de cada alteração SQL e restaurando ADMIN em erro/cancelamento. Nenhuma mudança persistente de papel aplicada nesta atualização. Master/MFA real, Support/Billing e ciclo de sessões/expiração/revogação permanecem OPEN. Consulta Auth nesta sessão não encontrou a conta dedicada escolhida. Etapa 1 permanece EM EXECUÇÃO; etapa 2 pendente. CI do código testado 28053c3: Foundation checks run 37713949588 success. Este incremento registra evidência, sem alterar código/schema/grants/produção/cobrança.


## Perfis e revogação live HTTP aprovados — 2026-10-07, 22:56 Brasil

Proprietário executou test:profiles-live no Windows/Node v24.20.0, mesma cópia (3) do código 28053c3. Tag DEV LIVE PROFILES ff496b1b-823d-4021-9fd5-d21b240f9a6c. ADMIN baseline e TREASURER financeiro positivo/limites Master e tenant PASS apresentados. VIEWER leituras próprias e 20 escritas negadas PASS apresentado. Chegada ao WAIT REVOKED LINK demonstra que as assertions anteriores de integrante vinculado passaram; chegada ao WAIT RESTORE ADMIN demonstra que as assertions de revogação passaram. Saída final apresentada: same JWT ADMIN restored; all original scopes and positive write restored PASS. Nenhuma credencial/token recebido pelo agente.

Agente aplicou cinco transições SQL DEV guardadas somente B, entre os WAITs do mesmo processo: TREASURER, VIEWER, vínculo único, remoção do vínculo e ADMIN original. getUser e comparação do token original sem refresh sustentam revogação da autorização com JWT ainda válido, NÃO invalidação de sessão Auth. Consulta SQL final conferiu A/B ADMIN, zero member_user_links e created_at original 2026-10-02 22:58:27.201308+00. Janela de perfis ENCERRADA; restauração persistida antes da confirmação HTTP final. Dois pagamentos fictícios 1 permanecem DEV, não apagar ledger nem repetir teste sem necessidade.

Gates tenant de perfis/vínculo/revogação deste roteiro concluídos. Master/MFA, staff Support/Billing, suporte temporário/expiração/revogação e ciclo de sessões Auth continuam separados e OPEN. Consulta Auth atual não encontrou michael.c.carvalho+corsys-dev-master@gmail.com; próximo passo é criação oficial da conta dedicada no painel pelo proprietário, senha privada local, seguida de conferência e bind guardado. Etapa 1 segue EM EXECUÇÃO, etapa 2 pendente. Nenhum schema/grant/produção/cobrança alterado.


## Master DEV dedicado vinculado — 2026-10-07, 23:04 Brasil

Proprietário confirmou criação oficial da conta no painel. Consulta Auth conferiu michael.c.carvalho+corsys-dev-master@gmail.com, UUID 71e27b4c-f0ba-46f7-832f-4faf29e8603d, email confirmado em 2026-10-08 02:04:16.172606+00. Executado bind_dev_dedicated_master.sql com guards: sem roles/links tenant, nenhum staff anterior, plano DEV fixo zero-price presente. Retorno conferiu MASTER active=true. Primeiro Master DEV ativo; preservar proteção do último Master. Contas tenant não promovidas. Nenhuma senha/token recebida, nenhum fator inscrito pelo agente. HTTP Master/AAL1/TOTP/AAL2 ainda PENDENTE do proprietário; próximo comando test:master-mfa com UUID e senha somente em .env.dev privado. Etapa1 aberta, sem produção/cobrança/schema/grants alterados.


## Correção do contrato AAL1 no teste Master — 2026-10-07, 23:11 Brasil

Primeira execução Master pelo proprietário interrompeu em AAL1 staff RLS: private rows exposed (1 != 0), antes de enrollment. Login/UUID/AAL1 e RPC privilegiada negada42501 já passaram pelas assertions anteriores. Inspeção da política real platform_staff_select_self_or_master confirmou SELECT user_id=auth.uid() OR private.is_platform_staff('MASTER'); helpers privilegiados exigem AAL2. A leitura do próprio vínculo em AAL1 é permitida pela política existente; a expectativa zero-row do teste estava errada. Corrigido test:master-mfa para consultar o escopo staff inteiro e exigir exatamente a própria linha MASTER ativa (UUID conferido), mantendo a negação42501 da RPC em AAL1 e a prova TOTP/AAL2/RPC/audit positiva posterior. Não alterar RLS/grants/helpers para satisfazer teste incorreto. 12 testes locais e sintaxe PASS; reexecução HTTP/MFA ainda pendente. Nenhum fator criado pela tentativa que falhou. Não classificar MFA como PASS.


## Compatibilidade do QR MFA corrigida — 2026-10-07, 23:15 Brasil

Proprietário apresentou 12 checks PASS e Master identidade/AAL1/comando privilegiado negado PASS. Enrollment iniciou, mas qrDataUrl rejeitou prefixo antes de SVG; desafio/verificação/AAL2 não executados. Consulta read-only de factor_type/status/count confirmou zero fatores remanescentes da conta dedicada após finally (não consultados QR, secret ou OTP). Fonte primária supabase/auth internal/api/mfa.go usa goqrsvg/SVGo; ajstarks/svgo svg.go define cabeçalho XML + comentário Generated by SVGo antes de <svg>. Validação anterior aceitava XML mas não comentário; corrigido helper para aceitar comentários XML completos antes da raiz SVG, mantendo rejeição de HTML, URLs remotas, DOCTYPE e comentários incompletos. Teste de regressão com cabeçalho sintético em SVG bruto, data URL bruto, percent-encoded e base64 PASS; 12 testes/sintaxe PASS. Nenhum QR real lido ou logado; nenhum grant/RLS/Auth alterado pelo agente. MFA real continua OPEN até proprietário executar novamente e apresentar TOTP/AAL2/RPC/audit PASS.


## MFA Master comprovado; expectativa de leitura da auditoria corrigida — 2026-10-07, 23:26 Brasil

Execução local do proprietário alcançou a consulta de auditoria após passar enrollment/challengeAndVerify real, currentLevel=aal2, getUser UUID conferido, vínculo MASTER ativo positivo, plano fixo price0 já active=true e RPC set_saas_plan_active retornando UUID esperado. Interrompeu por42501 permission denied for table saas_master_audit_logs; roteiro integral encerrou com FAIL e NÃO deve ser descrito como saída final PASS. Etapas anteriores comprovadas pelo ponto de falha, mais inventário administrativo factor_type=totp/status=verified. Nenhum secret/OTP/QR/token recebido pelo agente.

Inspeção de contrato: tabela saas_master_audit_logs RLS=true, sem policies e sem SELECT authenticated, backend-only. Não adicionar grant/policy para satisfazer expectativa errada. Consulta administrativa encontrou exatamente um evento saas_plan.reactivate/resource_type saas_plan/recurso7c71fda8-13b9-4bd4-999a-7df06937666d, actor71e27b4c-f0ba-46f7-832f-4faf29e8603d, reason DEV MASTER MFA fb5a5b74-00b4-45c8-9a6b-0565c2b69f56, previous_active=true e new_active=true. Evidência combinada: MFA/AAL1 negativo/AAL2 positivo/RPC e auditoria backend comprovados nesta execução; saída integral corrigida ainda não executada. Sem cobrança comercial ativada.

Roteiro corrigido exige42501 para leitura direta backend-audit e informa que operador precisa conferir evento único pela tag; não converte qualquer erro em PASS nem declara auditoria positiva via HTTP. 12 testes/sintaxe locais PASS. Não repetir cadastro TOTP: fator verificado permanece para próximas autenticações. Reexecução desnecessária desta operação comprovada; futura execução corrigida reutiliza fator. Support/Billing, suporte temporário/expiração/revogação e ciclo Auth permanecem OPEN, etapa1 em execução, etapa2 pendente.


## Gate staff live preparado — 2026-10-07, após MFA Master

Ver docs/DEV_STAFF_LIVE_GATE.md. Novo test:staff-live preparado: terceira identidade dedicada michael.c.carvalho+corsys-dev-staff@gmail.com, SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno, mesma sessão JWT em janela read_only A/negação B, expiração por datas passadas/reabertura/revogação, Billing positivo subscriptions e limites Support/Master, active=false, cleanup e logout global com refresh anterior negado por código Auth específico (rede não PASS). Não confundir revogação refresh com invalidação criptográfica instantânea do access JWT. Fatos são ticket/mensagem internos fictícios; nenhum pagamento/cobrança/provedor ativado.

Oito scripts bind/transição/cleanup guardados preservam último Master e contas tenant. Teste de todas transições em ROLLBACK passou DEV_STAFF_TRANSITIONS_ROLLBACK_PASS, usando B só dentro da transação com ADMIN removido/revertido. 12 testes/sintaxe locais PASS. Consulta posterior confirmou A/B ADMIN, único Master ativo, zero janelas suporte abertas e conta staff ainda inexistente. Nenhuma nova transição persistida, HTTP/TOTP desta conta NÃO executados. Proprietário precisa criar conta oficial, sem senha no chat; depois conferirUUID/bind e preencher .env privado. Em FAIL/cancelamento operador deve executar cleanup imediatamente. Stage1 continua aberta; nenhuma produção/custo/grant/schema/policy alterada. Conferir CI do pacote após push.


## Conta staff criada e janela preparada — 2026-10-07, 23:37 Brasil

Proprietário criou oficialmente michael.c.carvalho+corsys-dev-staff@gmail.com. Consulta Auth conferiu UUID0cb72963-9bef-4740-9f20-db4b9d54c74b e email_confirmed_at2026-10-08 02:36:51.497373+00. Executado bind_dev_dedicated_staff.sql guardado; retorno/consulta conferiu SUPPORT active=true e Master71e27b4c-f0ba-46f7-832f-4faf29e8603d ainda MASTER active=true. Nenhuma janela tenant criada; A/B admins preservados. HTTP/MFA novo PENDENTE do proprietário; credenciais não recebidas. CI pacote staff Foundation checks37718586263/run39 completed success. Proprietário deve baixar branch atualizada, preservar .env privado e preencher TEST_STAFF_USER_ID/password somente local; próximo comando test:staff-live. JANELA STAFF TEMPORÁRIO ABERTA: cleanup obrigatório via staff_dev_cleanup.sql em erro/cancelamento/conclusão, nunca remover Master. Ainda sem fator staff inscrito pelo agente. Etapa1 aberta, sem produção/custo/schema/grants.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.


## Matriz final recursos/views preparada — 2026-10-07, após staff PASS

Ver docs/DEV_FINAL_AUTHORIZATION_GATE.md. Staff/MFA/expiração/revogação/refresh concluídos. Revisão mantém etapa1 aberta pela pendência explícita de IDs elegíveis estrangeiros com own organization e views diretas/DRE. Novo test:authorization-final preparado: oito negativas por loja para plano/source/policy/request/payable/receivable, 28views (dez com fatos próprios financeiros/DRE obrigatórios), positivos de duplicação própria/policy2030off/decisão manual/audit. Duas policies draft2030off e duas solicitações MANUAIS fictícias seedadas sobre payables DEV100; não altera valores originais/current policy nem afirma fluxo automático completo de aprovação. SQL verify_dev_final_authorization.sql passou com claims simuladas/ROLLBACK; 12 testes locais/sintaxe PASS. HTTP real do novo roteiro ainda PENDENTE. Preparar pacote dev-gate público sem .env real/node_modules/QR para owner; não repetir gates já aprovados. Após PASS revisar estado final e critérios antes de encerrar1/promover2. Sem produção/custos/Auth/grants/schema.

