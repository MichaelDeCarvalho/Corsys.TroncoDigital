## MFA Master — correção preparada — 28/10/2026

Reprodução online no DEV: Master ativo autenticado sem fator verificado recebia “Nenhuma Loja vinculada”, sem caminho para cadastrar MFA. Branch de correção baseada em `2d1345805b7aa3e1bafca6a461817c2a6b740955`.

MasterMfaGate lê somente o próprio vínculo platform_staff sob RLS existente, antes de abrir Workspace. Master AAL1 recebe configuração TOTP explícita ou desafio de fator verificado; QR apenas em imagem/memória e código limpo após tentativa. AAL2 e RPC read_platform_master_overview continuam obrigatórios. Falhas e identidade divergente bloqueiam; resposta tardia não abre acesso. Apenas configuração incompleta CorSys é substituída por clique explícito, preservando fatores verificados. Demais usuários mantêm o fluxo tenant.

Sem migration, grants, alteração de RLS, criação de fatores reais pelo agente ou publicação. Testes de componente e CI remotos registrados na PR; homologação real com QR/OTP pelo proprietário depende de publicação isolada autorizada. ADR-0037. A prévia anterior b3534270 não contém esta correção. Recuperação de senha, overflow mobile e formulários de despesas em Contas a Receber permanecem fora deste lote.

## Continuação operacional — 21/10/2026

CI323/c6b2fd2 SUCCESS. Revalidação real B em duas abas preservou Loja/formulário; ágape UI B desktop/mobile375 sem overflow PASS, cobrança a4c4db6d cancelada/open0/integrity true. Mútuas agora têm UI com distribuição explícita, prévia da classificação/total, histórico e recuperação idempotente; seis testes focados PASS e build DEV PASS. HTTP/UI mútuas ainda a homologar. Repasse neutro continua lacuna: guard atual de member_receivable exige receita; não declarar esse tratamento pronto.

Ágapes HTTP B19/19 PASS, UI A/B pendente. Corrigida perda de formulário em revalidação da mesma identidade (regressão antes/depois,23 testes App/recuperação PASS), sem ignorar Auth/RLS/MFA. Backend mútuas migration66 DEV, SQL A/B36 negativas rollback PASS nas faixas documentadas; UI/HTTP a concluir. ADR-0035/0036. Agrupar testes de A após aproveitar sessão B.

Ágapes com participantes/cobranças implementados, migration65 DEV, SQL A/B26 negativas rollback e8 testes focados PASS; homologação real pendente. Histórico de aprovações B com voto existente e mobile PASS, CI321/2bd3391 SUCCESS. ADR-0034 e evidências de21/out.

Anuidade/correção A/B e negociação/parcelamento HTTP/UI desktop/mobile A/B aprovados; cleanup confirmado. Cobertura HTTP legada11/13 A/B. CI320/7afea27 SUCCESS; migration64 DEV ajusta compatibilidade de locks/FIFO. Multiaprovação SQL com dois atores A/B e rollback PASS; histórico de votos implementado, homologação browser ainda parcial. Estado/evidências: docs/V35_EXECUTION_20261021.md. Etapa2 aberta; não repetir gates aprovados.

## Continuação operacional — 19/10/2026

Lote HTTP A/B ampliado aprovado: cobertura10/13 legadas A e11/13 B após anuidade/correção B (35 chamadas/35 requisições). Anuidade A aguarda login. Negociação/parcelamento implementados com migrations62/63 DEV, SQL A/B30 negativas rollback PASS e UI testada localmente; HTTP/UI real pendentes. CI317/e1076df SUCCESS. Evidências em docs/V35_EXECUTION_20261019_CONTINUED.md. Não encerrar Etapa2 nem repetir os gates já aprovados.

## Execução Work — 19/10/2026

Identidade SQL rollback e HTTP real A/B de identidade/catálogo PASS. Reajuste institucional futuro implementado e migration60 aplicada somente DEV; SQL A/B rollback PASS. Etapa2 aberta: cobertura HTTP legada e homologação completa não concluídas. Evidências e limites em docs/V35_EXECUTION_20261019.md.

## Mensal institucional UI A/B e HTTP A PASS — 2026-10-16

Estado autoritativo: migrations57/20261016215748 e58/20261016220039 aplicadas DEV.
Commitae1d4a618c79a1ac299cba41b9e91c4ad48c1758; preview6959e115-e1da-4a6a-a082-1ad43a0fac19.
Alias v35-finance, sem deploy de tráfego/PROD. HTML/app/QA HTTP200 iguais ao build.
App app-teNnx2Xh.js SHA25686b975c388329de3ded64b56fdf142ae64a203bc28614607047b97839d11ea33;
QA qa-TpmFiPTa.js c842be044b1b9ebc515bd54413f0a4e1fa6a16e98ad40f2bbe8e081b99b1adb3.
UI cadastro/prévia/emissão/cancelamento/desativação A/B já concluída.
HTTP A real:4 tabelas estrangeiras ocultas, escopo42501/ID23503, replay simultâneo
mesmoUUID, payload divergente22023 e disputa chaves distintas umUUID+PT409/HTTP409,
sem timeout. Uma obrigação/auditoria por regra/competência; após cancelar,23514
nega nova emissão. Despesa/receita em Jul/Ago2027; RESULT PASS, cleanup confirmado.
SQL final: regrasA inativas, quatro obrigações canceladas/integrity_ok/aberto0,
saldo10. Deadlocks2 cumulativos, sem aumento após57 (não é garantia absoluta).
IDs despesaJul05ba3bc7-ea9c-4671-9765-feaa21f60c3b/Ago180cba1d-a03b-4e0f-b616-d85cdd5c9115;
receitaJuld116ea09-e81d-44ad-96ae-60cfb458d876/Ago1a08be97-6183-4a46-9799-7ed4bb9aad5e.
Gate é execução única: NÃO repetir A; histórico bloqueia reemissão. B Jul/Ago
vazios e inativa conforme UI anterior; login B solicitado para mesmo novo gate.
SessãoA Edge4 aba1875274888 /dev-qa. Antes de login entrar na raiz, depois/dev-qa.
294 testes/tipos/build PASS +25 focados com nova regressãoPT409/cleanup PASS;
SQL4positivos/56negativos rollback após58 PASS, preservação58 PASS.
Read-back segurança quatroRPCs SECURITY DEFINER/search_pathvazio/anonsemexecute,
sem40001 mensal; permissões/RLS conservadas. CI298/run38973320275 em execução;
CI296/297 success. Billing resolvido, não pedir de novo.
Auditoria read-only localizou13 funções públicas históricas ainda com40001;
revisar conflitos de negócio no próximo lote, sem concluir que todos os usos são
iguais. Lista em docs/V35_HTTP_CONFLICT_AUDIT.md. Etapa2 ainda aberta.

## Regressão concorrente mensal em correção — 2026-10-16

UI mensal A/B concluída e cleanup SQL saldo10/canceladas/regras inativas.
CI296 e297 SUCCESS: billing resolvido. Novo gate HTTP A falhou em chaves distintas:
replay mesma chave passou, um fato/auditoria por competência, mas outro pedido
timeout15s; não registrar PASS. TentativasA somente despesaNov2026–Jun2027
canceladas; sem recebimento/pagamento e saldo10. Deadlocks observados2.
Migration57/20261016215748 aplica NO KEY UPDATE na organização (3comandos);
58/20261016220039 usa PT409 para conflito de negócio, evitando retry infinito
PostgREST com40001 conforme fonte oficial. Não editar56/57 após aplicadas.
Helper cleanup agora usa chave única por execução e verifica regra inativa,
obrigação cancelada/integrity_ok/aberto0 e saldo10. Corrigido replay antigo de
cleanup que deixara regraA ativa; UI desativou e SQL confirmou inativa.
Gate final usa Jul/Ago2027, vazio preflight A/B, R$1 por operação. Próximo publicar
e executar com A atual. B depois depende login. Não repetirmeses comhistórico.
SQL rollback4positivos/56negativos PASS após58;294 testes/tipos/build PASS,
mais regressão PT409 e cleanup em25 testes focados PASS; preservação58 PASS.
Outros40001 históricos precisam auditoria antes de fechar Etapa2. ADR0030.

## Mensal institucional UI A/B concluída — HTTP em preparo — 2026-10-16

UI A concluiu cadastro/prévia/emissãoR$1/cancelamento/desativação para despesa e
receita. Read-back: saldo10, ambas canceladas/integrity_ok/aberto0, regras inativas.
A despesa regra a4dec375-abec-4f42-bdf7-23597e2376b3, obrigação05499b17-bfdc-45df-9555-53f242207c32;
A receita regra33f6406e-b8db-4528-8a1f-dd3d6a3792d0, obrigação22de6cf9-e146-44fe-9271-4453b386fe72.
B já concluída; não repetir. CI296/run38971046250 reexecutada e SUCCESS após
usuário regularizar billing. Bloqueio anterior resolvido; não pedir regularização.
Novo helper opcional dev-qa-monthly usa somente quatro regras QA fixas existentes,
ativa temporariamente e emite atéR$1 em novembro/dezembro2026 para replay/chaves
distintas, isolamento e histórico cancelado. Preflight exige ausência nas duas
competências antes de escrever, saldo10 e regras inativas. Cleanup recupera IDs
da regra/meses, cancela, desativa e verifica saldo. É gate de execução única:
não repetir cegamente após persistência, pois histórico bloqueia reemissão.
Sem nova migration/grants/tokens. HTTP mensal ainda NÃO executado. Sessão A
Edge4 aba1875274888 no alias v35-finance; publicar QA após checks e testar A.

## Recorrência mensal B homologada; A pendente — 2026-10-16

Commit41f4ead0d9fcbd1aba25de051d29a0edbaecca6a enviado ao PR4.
Preview53304611-1bb5-44ee-b5dd-6d82186301f0 no alias v35-finance; sem mudar tráfego.
HTTP200 e bytes iguais: index SHA256 bc60dbc159138767802a4c059740eb46910e046ed204187c06dd11c93c9df246;
app-C2dtEIhP.js 8579ffba8fd44ff663fefd3de99906e3211fc9094862e24aab1ceaa06eb4f47a;
CSS0093a8ed83ea769e899c4d5f058f245129a9761a3c70633c091fbaf4722ce172.
UI real B: cadastro de despesa/receitaR$1, prévia, emissão, cancelamento e
regra desativada PASS; prévia bloqueia repetição inclusive após cancelamento.
Regra despesa1d792556-5a99-4454-8b7f-57cb92d346de;
obrigação abf5b027-c9e9-4f4d-8d60-c684824858e5.
Regra receita79578aa9-20c7-4ade-9b65-ee98b57f03fe;
obrigação49afaf80-2542-44fa-8794-c8f5f0e3d96c.
Read-back SQL: ambas inativas, obrigações canceladas/integrity_ok/aberto0,
nenhuma obrigação institucional aberta B e saldoR$10.
Desktop1912/client1897 sem overflow; mobile390/client375/scroll375 e prévia
visualmente legível. Viewport restaurado. Não comprova paridade das21 telas.
292 testes/tipos/build,12 gates DEV, gramática SQL e preservação PASS.
CI295/run38970341421 NÃO EXECUTOU jobs: GitHub informa pagamento pendente ou
limite de gastos atingido. Logs404 e stepsvazios confirmados; anotação lida na UI.
Não alterar billing nem declarar CI PASS. Usuário informado para regularizar.
Login A solicitado somente para NOVA recorrência; sessão B ainda no Edge4,
aba1875274888. Não repetir HTTP/UI estornos anteriores. HTTP concorrente mensal
não avaliado; SQL com claims simuladas4positivos/56negativos PASS rollback.
Etapa2/anual/especial/reajuste/negociação/multiaprovadores/21telas abertos.

## Estado vigente — recorrência mensal institucional — 2026-10-16

Estorno institucional UI e HTTP A/B concluído; limpeza SQL confirmou saldo R$10
por Loja e nenhuma obrigação aberta. Novo incremento: migration56 aplicada DEV,
cadastro/ativação de regra mensal, prévia e geração única por competência.
292 testes, tipos e build PASS; gate SQL A/B com 4 positivos e 56 rejeições PASS
com rollback, incluindo política de aprovação. Homologação UI deste novo incremento
pendente. Anual/especial/reajuste, demais fluxos e 21 telas continuam abertos.
Sem merge ou produção.

# PROJECT CONTEXT — Corsys.TroncoDigital

## Estado atual — institucional A/B UI e HTTP A — 2026-10-16

UI A/B do estorno institucional concluída e limpeza confirmada por SQL; saldoR$10
por Loja. Gate HTTP real A passou isolamento, replay concorrente, payload divergente
e disputa de estorno/uma auditoria. Cleanup/DRE PASS. Commitca98d22,270 testes/
tipos/build PASS, versãoe1785942 no alias v35-finance com QA opcional.
Login B solicitado somente para novo HTTP B→A; etapas anteriores não precisam
repetir. Outros requisitos da Etapa2 e21 telas continuam abertos. Sem merge/PROD.

## Marco atual — estorno institucional B — 2026-10-16

Conexão administrativa restaurada, migration55 e estorno institucional implementado.
Commit f0ac5ec:269 testes/tipos/build PASS, CI #290 success. Preview841a8aa5 no
alias v35-finance. Jornada B completa pela UI (despesa/receitaR$1, liquidação,
estorno, reabertura e cancelamento), read-back SQL saldoR$10/abertos0/auditorias2.
Login A solicitado para concluir o mesmo novo escopo. IDs/hashes no handoff.
Etapa2 aberta; sem merge/PROD e sem repetir jornadas básicas anteriores.

## Estado vigente — conexão Supabase restaurada — 2026-10-15

Ferramentas agora permitem escolher conta; TroncoDigital DEV acessível por SQL.
Read-back administrativo QA FINANCE A/B: saldoR$10 e nenhuma cobrança/obrigação
aberta, coerente com UI anterior. Migration55/20261016003940 aplicada somente DEV:
estorno institucional e bloqueio de conciliar fato institucional estornado.
Gate SQL A/B:4 positivos/44 negações esperadas PASS rollback, claims simuladas.
Interface preparada com histórico/confirmar/replay; homologação DEV ainda pendente.
ADR-0028 registra locks, limites de obrigação cancelada e conciliação ativa.
Sem merge/PROD; Etapa2 e21 telas ainda abertas. Estados de acesso negado abaixo
são histórico resolvido; não solicitar novas reconexões.

## Estado vigente — 2026-10-15 — QA FINANCE A/B

Jornadas autorizadas A e B concluídas no preview v35-finance/c7008f47: mensalidade
com prevenção de nova emissão, pagamento/alocação/estorno, cancelamentos,
correção de despesa/receita e fechamento/bloqueio/reabertura. Read-back UI A/B:
origem R$10, destino sem movimentos, DRE outubro2026/março2027 zerada. Não repetir
seed nem solicitar login B. Detalhes e IDs no handoff e relatório da Etapa 2.
252 testes/tipos/build PASS, CI #286 success; auditoria de dependências zero.
Nenhuma liquidação institucional criada. Próximo: estorno institucional conforme
plano específico, ainda sem implementação/migration. Integração administrativa
continua sem permissão no DEV correto; leitura SQL atual não foi validada.
Sem merge/produção. Etapa 2 e 21 telas não concluídas.

## Fixtures autorizadas e jornada A — 2026-10-15

QA FINANCE A/B aprovadas e persistidas; aprovação anterior bloqueada está resolvida.
IDs e roteiro em V35_STAGE_2_IMPLEMENTATION.md. Sessão A no alias v35-finance passou
mensalidade R$1, nova emissão bloqueada, pagamento/alocação/estorno, cancelamento
mensal/avulso e fechamento/bloqueio/reabertura de outubro. Despesa criada/corrigida/
cancelada pela UI, assim como receita corrigida/cancelada. Caixa final R$10 e DRE
outubro2026/março2027 zerada; login B solicitado para a mesma jornada. Nova proteção de integridade de leituras
institucionais: regressões falharam antes/passaram após; 252 testes/tipos/build PASS.
Supabase administrativo perdeu acesso; reconexões declaradas pelo proprietário
ainda não liberaram consulta direta no projeto correto. Não pedir aprovação das
fixtures novamente nem presumir dados administrativos conferidos após a perda.

## Continuação autorizada — 2026-10-15

Proprietário autorizou sequência 1–5 sem pausas rotineiras, exceto dependência de
validação humana. Passo 1 consolidado em V35_VERTICAL_DELIVERIES.md. Passo 2:
oito gates SQL rollback e nova matriz 60 negações A/B PASS; corrigido bloqueio da
prévia mensal após atualizar regras (teste falhou antes/passou após), 243 testes,
tipos/build/gramática/preservação/12 guardas PASS. Detalhes e limites atuais em
V35_STAGE_2_IMPLEMENTATION.md. Nova fixture financeira passou preflight rollback,
mas persistência bloqueada pela revisão automática por escopo da autorização
anterior. Aguardar aprovação específica; sem registros novos, sem bypass.

## Fechamento de jornadas DEV — 2026-10-14

Atualização de execução: B concluiu transferência/estorno pela UI com confirmação
corrigida e CSV persistido completo até conciliar/desfazer. HTTP real B passou
isolamento por escopo/IDs, replay simultâneo, payload divergente e disputa de saldo
de transferências; conciliação passou replay simultâneo e disputa de capacidade.
Read-back: saldo QA B 10/0, zero transferências ativas, zero vínculo ativo nas
fixtures de disputa, zero faturas SaaS QA; originais 17 cobranças/16 pagamentos.
Versão fixa de homologação `962f7b1b`, sem trocar tráfego do endpoint principal
após detectar publicação concorrente. CI #281 success. Em 2026-10-15, sessão A
concluiu transferência/estorno UI, OFX persistido completo e HTTP A→B/replay/disputa
de saldo, todos PASS observados. Read-back conjunto: A/B 10/0, zero transferências
sem estorno e valores conciliados ativos, zero faturas QA, originais 17/16.
Este escopo está homologado; Etapa 2 completa e 21 telas continuam abertas.

Duas Lojas QA isoladas A/B persistidas após aprovação específica, cada uma com
duas contas mapeadas e R$10 fictícios; originais intactas. Transferência B revelou
regex UUID incorreta no frontend: lançamento real confirmado no banco, feedback
incerto sem duplicação. Correção mínima e regressões de confirmação preparadas.
Página QA opcional permite testes HTTP sob sessão browser existente, sem tokens
no chat/arquivos. Ver docs/V35_SIGNED_BROWSER_QA.md antes de declarar novo aceite.

## Conciliação DEV — 2026-10-14

Migration #54 aplicada: staging/validação, vínculo manual e desfazimento auditável,
sem ledger. Interface OFX/CSV implementada; 239 testes/tipos/build e SQL A/B com
rollback PASS. Transferência/estorno positivos e ambas as pontas conciliadas passaram
em Lojas descartáveis revertidas. Não equivale a jornada browser de transferência.
Dois extratos de concorrência B persistidos com aprovação específica. Tentativa
via conector foi sequencial; não alegar concorrência real. Teste HTTP pronto,
credenciais locais A/B pendentes. Ver docs/V35_BANK_RECONCILIATION.md e ADR-0027.
Atualização: publicado DEV `485cc0a0`/commit `19c9c32`, hashes remotos conferidos.
Edge B em duas abas: um vínculo aceito e outro rejeitado; único ativo conferido e
desfeito pela tela. QA 1440/390 após correção mobile PASS. HTTP anon quatro PASS.
Proprietário optou por sessões browser; HTTP A/B completo continua não avaliado.

## Orçamento operacional DEV — 2026-10-14

Publicação concluída: versão DEV `23727d71` do commit `0a3ed4e`, hash do bundle
conferido e CI #274 success. Jornada autenticada A draft → linha → remoção/reinclusão
→ publicação imutável → realizado passou. Edge 1440/390 verificado; quatro negativas
HTTP anon PASS. Orçamento fictício `DEV QA ORCAMENTO 0a3ed4e` permanece publicado
no DEV como evidência, sem ledger alterado. Sessão B também criou linha e publicou
seu próprio ciclo, sem visualizar o ciclo A. HTTP cross-tenant e concorrência
independente do novo fluxo pendentes; não é encerramento da Etapa 2.

Financeiro > Planejar orçamento implementa criar draft, editar/remover linhas e
publicar conteúdo revisado com confirmação. Migration #53 aplicada somente DEV;
RPCs budgets.manage/finance.read, auditoria, idempotência, lock/revisão otimista e
imutabilidade publicada. Sem alterar ledger/RLS/grants diretos. 224 testes/tipos/build
e gate SQL A/B com rollback PASS. Ver `docs/V35_BUDGET_LIFECYCLE.md` e ADR-0006.
Publicação/QA real têm escopo e limites registrados no relatório; não encerrar Etapa 2.

## Retomada auditada — 2026-10-14

QA positivo autenticado de orçamento concluído após aprovação específica: preview
A exibiu 250/500/-250 e 200% acima do orçamento; fixture temporária removida e
ausência conferida. Sem alteração no ledger. Esse bloqueio está resolvido; permanecem
os demais limites do relatório e a Etapa 2 aberta.

Atualização: OAuth Cloudflare resolvido; versão DEV existente `4d47c0cf` corresponde
ao build funcional `be967cf` por SHA256 JS/CSS. Sem novo upload. CI #271 success.
Login A e orçamento vazio observados. QA positivo de orçamento aguarda aprovação
específica do fixture temporário após bloqueio automático; desktop/mobile ainda
não homologados. Evidência detalhada no relatório de entregas.

Branch/PR #4 confirmados em `210a039b`; 52 migrations e 138 tabelas no DEV.
Ver `docs/V35_VERTICAL_DELIVERIES.md` para evidências atuais e as 21 telas em seis
lotes com gate DEV. Etapa 2 permanece em execução. Lote 0 acrescenta execução visual
e validações de duplicatas/moeda/centavos ao orçamento consultivo, e atualiza
Wrangler 4.151.0 para corrigir cadeia de três alertas high. 217 testes/tipos/build,
12 guardas locais, preservação e SQL rollback A/B PASS no escopo registrado.
Sem nova migration ou escrita persistida. Publicação/aceite do build novo dependem
de OAuth Cloudflare e QA; login real do proprietário na Loja A observado.
Cadastro/publicação de orçamento, conciliação OFX/CSV e transferência positiva pendentes.

## Incremento 29 — consulta filtrada Master com MFA (2026-10-10)

Diretório de clientes Master permite buscar no servidor por nome, número, cidade, contato, status comercial e plano, limitado/paginado, com gate MASTER/AAL2 no PostgreSQL. Migração DEV #52, SQL com rollback `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS`. A tela não transfere todo cadastro para filtragem no navegador. Campo de plano ainda é busca textual; select de planos e paridade completa do piloto pendentes. Etapa 2 ainda em progresso.


## Etapa 2 — fluxo de caixa consolidado (2026-10-10)

Incluída aba `Financeiro > Fluxo de caixa` com realizado por dia e projeção de recebíveis/obrigações separados, sem contar transferências internas como receita/despesa e sem somar páginas limitadas. Migração DEV #51, teste SQL de reconciliação nas duas Lojas com rollback `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS`. Ainda faltam gráficos, visão de caixa inicial/projetado, filtros do piloto, JWT HTTP real e visual mobile/desktop. Não representa aceite integral da tela V35.


## Etapa 2 — exportação privada de inadimplência (2026-10-10)

Relatório de inadimplência agora permite CSV compatível com Excel, por ação explícita: consulta paginada da mesma RPC com permissão tenant `finance.read`, limite de 1.000 registros, nenhuma planilha parcial se falhar, e sanitização anti-injeção de fórmula. Exclui CPF/e-mail/telefone. Não representa XLSX/PDF nem fotografia transacional única; QA real de navegador ainda pendente. Nenhum deploy produção.


## Etapa 2 — transferências internas e estornos em DEV, 2026-10-10

Comandos de movimentação entre contas e estorno append-only agora disponíveis em Financeiro > Transferências, migration #50. Exigem contas ativas da mesma Loja, saldo contabilizado, competência aberta, permissão institucional, motivo, auditoria e replay idempotente. O banco mantém DRE e transferências distintos. Teste negativo A/B de isolamento/cancelamento SQL passou com ROLLBACK, mas **ciclo positivo NÃO foi validado**: só há uma conta ativa em cada tenant piloto, e criação de tenant fictício temporário para fixture foi bloqueada pelas configurações de segurança. CI frontend verificar. PROD continua bloqueado.


## Master SaaS — promoção sucessora (2026-10-10)

O catálogo Master permite criar rascunho de uma promoção nova ou versão sucessora sem editar ofertas históricas. Migração DEV #49, `create_master_promotion_successor_idempotent`, controle de hash/replay, validação MASTER/MFA e serialização de série. Gate SQL com rollback passou. Não houve resgates, alterações de assinatura, faturas ou clientes.


## Etapa 2 — parametrização de aprovação de despesas (2026-10-10)

Além da fila de votos, o Financeiro possui agora cadastro e publicação de políticas de aprovação versionadas por Loja: nenhuma aprovação, todas as despesas ou limiar, mínimo 1–10 aprovadores e vigências futuras. RPCs com `approvals.manage`, auditoria, idempotência e constraint de vigência; SQL nas duas Lojas com ROLLBACK PASS. Stage2 ainda em execução.


## Master SaaS — ofertas por versão (2026-10-10)

Comandos Master DEV de rascunho e publicação de ofertas implementados com MFA/AAL2, idempotência e auditoria, integrados ao catálogo comercial. Novo número de migrations: 47. SQL rollback Master AAL2 positivo e tenant/AAL1/anon negativos passou. Promos não afetam automaticamente assinaturas e clientes existentes; futuras ofertas sucessoras, resgates e contratação ainda pendentes.


## Master SaaS — proteção de rascunho idempotente, 2026-10-10

RPC #46 `create_master_onboarding_draft_idempotent` protege mesma chave contra alteração de dados, com validação MASTER/AAL2 no servidor, e impede duplicidade de eventos ao retransmitir a mesma proposta. A interface Master usa esse wrapper. SQL AAL2 positivo e AAL1/tenant negativos com rollback. Legado ainda permitido para Master exige migração de clientes antigos antes de produção.


## Master SaaS — onboarding e panorama Cliente 360°, 2026-10-10

Além do catálogo, cobrança e suporte Master, já existe fluxo de rascunho de nova Loja e provisionamento após confirmação específica em DEV. Cria uma Loja e assinatura com tarefa de convite pendente, sem entrega externa verificada, usando RPC preexistente MASTER com MFA. Cliente360 traz status comercial, assinatura, faturas SaaS em aberto/vencidas e total de chamados; acesso exclusivo MASTER/MFA. SQL de ambos os fluxos foi executado com ROLLBACK e retentativa, sem clientes fictícios persistidos; testes frontend adicionados. Ainda não representa paridade total V35, nem autoriza produção.


## Master SaaS — resposta e acompanhamento de chamados (2026-10-10)
O Master DEV inclui agora uma fila de operação com histórico, métricas de primeira resposta e resposta ao chamado de cliente por RPC idempotente AAL2/Master. Chamados internos permanecem restritos e sem comando de resposta no frontend. SQL AAL2/RLS e React 162 testes passaram; demais telas Master e homologação por JWT HTTP real ainda pendentes.


## Etapa 2 — incremento transversal verificado 2026-10-09/10

O Financeiro DEV incorporou geração mensal idempotente (prévia, vigência e condições individuais), cobranças manuais/cancelamentos, fechamento mensal auditado, saldos de caixa/bancos, orçamento×realizado, indicadores globais da Loja e inadimplência por integrante. Operações institucionais agora incluem correção/cancelamento auditados com revisão otimista. Master SaaS recebeu área de consulta segregada por papel Master+AAL2, sem autorizar operação de contratos comerciais. SQL de regressão A/B com transações revertidas passou; os 42 arquivos migration do DEV foram versionados. **Faltam Master operacional, múltiplas telas completas e homologação de segurança, concorrência e UX. Não tratar esta base DEV como produção/homologação concluída.**


## Etapa 2 — fila de aprovação financeira (2026-10-09)

Decisões de aprovação/rejeição de despesas institucionais adicionadas ao Financeiro utilizando a view existente e o backend `approvals.review`, com wrapper idempotente DEV35. SQL teste A/B com ROLLBACK aprovado; não alterou aprovações reais. Ainda faltam a configuração de políticas, histórico, fluxo completo de múltiplos aprovadores e a paridade integral V35.


## Etapa 2 — obrigações institucionais operacionais, 2026-10-09

O Financeiro possui cadastro e liquidação parcial/total de contas a pagar e a receber, consumindo RPCs auditadas/idempotentes já existentes; não cria regras contábeis alternativas no navegador. O painel distingue obrigação de liquidação, verifica aprovação de despesas, integridade e escopo tenant. Testes SQL DEV A/B com ROLLBACK aprovados, CI 101/101 teste no último commit funcional. Etapa 2 permanece incompleta diante da paridade do piloto V35 e homologações HTTP/JWT e de concorrência.


## Etapa 2 — pagamentos de integrantes e DRE (2026-10-09)

Supabase DEV tem 34 migrations. Foram acrescentados no Financeiro os fluxos de registrar pagamento de integrante, alocar manualmente em cobrança e estornar com idempotência/auditoria, além de DRE por competência com dados efetivamente contabilizados. Os gates SQL A/B foram executados com ROLLBACK e mantiveram 17 cobranças e 16 pagamentos existentes. A Etapa 2 continua significativamente incompleta: faltam telas/integridade HTTP, módulos institucionais, relatórios/planilhas, Master SaaS e paridade V35.


## Etapa 2 — bloqueios contábeis por Loja e novas categorias (2026-10-09)

A migration DEV #32 removeu os SHARE locks globais da publicação, adicionou seis triggers de proteção das configurações por tenant e impede ativação de categoria/conta financeira sem cobertura nos planos contábeis publicados aplicáveis. Conta nova nasce inativa, permitindo planejamento de plano sucessor; categorias novas padrão inativas no formulário. SQL rollback/regressões A/B aprovados. Conexões simultâneas realmente independentes não foram validadas; produção permanece bloqueada.


## Incremento 10 — publicação de Plano Contábil DEV, 2026-10-09

A V35 possui agora fluxo de publicação explicitamente confirmada do Plano de Contas, com rechecagem atômica no Supabase DEV, idempotência e auditoria. A migração DEV31 revogou a exposição direta do endpoint legado `publish_accounting_plan`, mantendo-o apenas como etapa interna da RPC validada. Teste SQL de duas Lojas com fixtures revertidos demonstrou publicação válida, proteção contra duplicidades e erros de escopo. Exigir validação HTTP/JWT, concorrência, preview/mobile e paridade integral antes de produção; Etapa 2 ainda não encerrada.


## Etapa 2 — pré-publicação contábil, 2026-10-09

Pré-verificação de publicação do Plano de Contas integrada à tela, verificando obrigatoriedade de vínculos, natureza, hierarquia e vigência publicada. Migração DEV #30 e gate SQL A/B com ROLLBACK passaram. Ainda **não há publicação pelo frontend**, nem homologação HTTP/JWT, concorrência real ou paridade visual integral do piloto V35. Próxima etapa requer contrato de publicação atômica revalidado no servidor.


## Etapa 2 — plano contábil com 91 códigos e mapeamentos, 2026-10-08 Brasil

O template existente Corsys de 91 contas/86 pais foi reutilizado (não recriado). Planos draft futuros podem ser construídos de template, duplicata ou em branco; mapeamentos draft de categorias e contas financeiras agora têm UI e RPC auditada/idempotente. Supabase DEV alcançou 29 migrations. Plano publicado permanece somente leitura e imutável; publicação guiada e checagem integral de cobertura V35 pendentes. Gate SQL A/B com ROLLBACK passou. Não declarar Etapa 2 encerrada ou produção autorizada.


## Implementação incremental — identidade da Loja, 2026-10-08 Brasil

Parâmetros de contato, endereço/CEP/UF e chave PIX implementados em `organization_settings` com UI e RPC autorizada; 28 migrations aplicadas somente ao DEV. Persistência otimista e auditada, gatilho monotônico para proteger a revisão, sem alterações financeiras. Testes SQL A/B `ROLLBACK` aprovados, frontend/CI a conferir. Demais opções do HTML V35, logo, planos contábeis/mapeamentos e relatórios não concluídos.


## Etapa 2 — catálogos de contas/fundos/meios conectados, 2026-10-08 Brasil

Plano de Contas agora permite contas financeiras (bank/pix/cash/other), fundos e formas de pagamento com cadastro e status, autorização exclusiva `settings.manage` e histórico preservado. Dados permanecem separados por Loja; migrações25/26 aplicadas DEV. SQL A/B em ROLLBACK aprovado; frontend CI e homologação autenticada visual devem ser conferidos. Ainda não há movimentos ou saldos gerados por esses cadastros. Próximo: parâmetros da Loja e plano contábil. Etapa 2 não concluída.


## Etapa 2 — categorias/regras mensais implementadas, 2026-10-08

Cadastro de categoria por domínio/estado/recorrência/parcelamento, regra mensal com preço inicial futuro e preço sucessor conectados ao backend; migração23 aplicada DEV20261008203643. O catálogo vivo permanece com8categorias originais e nenhuma regra/preço novo persistido pelos testes. Não alterar elegibilidade existente nem semear valores de negócio sem revisão do piloto. CI anterior a301a83f/37839360346success; entrega atual conferir depois do push. Etapa2 EM EXECUÇÃO. Ver docs/V35_STAGE_2_IMPLEMENTATION.md para escopo/testes/limitações; campos/fluxos V35 pendentes permanecem obrigatórios.


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


SaaS multi-tenant de tesouraria e gestão financeira para Lojas Maçônicas. organization_id delimita tenant; obrigação não é pagamento; recebível não é caixa; fatos postados não são sobrescritos; saldos são derivados; privilégios Master exigem AAL2. Sem escrita financeira offline.

## Escopo mínimo obrigatório

Preservar no mínimo todas as funcionalidades, parâmetros e ideias documentadas na V35, backend e frontend, conforme determinação do proprietário em 2026-10-02. Consultar docs/V35_COVERAGE.md antes de implementar cada módulo. Entrega incremental não é redução de escopo. O HTML V34 operacional foi recebido separadamente: docs/V35_PILOT_PARITY.md e docs/V35_PILOT_INVENTORY.md registram 21 telas e os controles dinâmicos como mínimo obrigatório junto com a V35. Análise estática realizada; paridade visual/cliques ainda pendentes.

Fontes: docs/engineering/v35-source-manifest.json (origem histórica), v35-dev-runtime-manifest.json (19 migrations efetivamente aplicadas) e v35-preservation-baseline.json (ADRs/documentos/declarações originais). Next.js é alvo histórico; stack atual mantém React/Vite/TypeScript da branch foundation.

## Ambiente e autorização

Repo MichaelDeCarvalho/Corsys.TroncoDigital; branch feat/v35-dev-gate-20261002; PR draft #4, base feat/v35-foundation. Não fazer merge/deploy produção sem aprovação. Supabase DEV szqkdekwhzxsoxorgvaz, organização Michael - jobmcc, plano Free. DEV, dados fictícios e preview autorizados; qualquer cobrança deve ser apresentada antes. Sem upgrade ou recurso pago introduzido neste incremento.

## Estado atual

19 migrations DEV aplicadas, 138 tabelas públicas com RLS; duas Lojas fictícias e dois usuários ADMIN vinculados separadamente. Preview: https://corsys-tronco-digital-dev.corsys1.workers.dev/ . Tela pública/assets verificados. Proprietário confirmou os dois logins e visibilidade somente da própria Loja em 2026-10-02. Senhas não acessadas.

Frontend: Auth verificada por getUser, logout, seleção de Loja, integrantes com busca, abertura/listagem de chamados e consultas paginadas de cobranças/contas a pagar/receber. Consultas financeiras usam views existentes, sem escrita ou recálculo de saldos. Outros módulos V35 mantidos no backlog obrigatório em docs/V35_COVERAGE.md.

## Evidência e limites

Catálogo/invariantes SQL e isolamento com roles/claims simuladas anteriormente aprovados. Nesta etapa as três views financeiras puderam ser consultadas sob role authenticated, retornando zero registros; isso não comprova leitura positiva de fatos nem isolamento cruzado com dados existentes/JWT real. A confirmação manual do proprietário também não substitui testes negativos HTTP/JWT.

Gates restantes: JWT/RLS positivo/negativo, AAL2/MFA, suspensão, concorrência/idempotência, revisão desktop/mobile do fluxo autenticado e paridade com o HTML original. Nenhuma liberação de produção.

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


## Marco DEV — 2026-10-08

- Etapa 2 ganhou comando transacional e UI de sucessão/encerramento de mensalidade individual, com migração `20261008211155_member_term_transition`.
- Transição só em competência futura, com `settings.manage`, auditoria, idempotência, isolamento de tenant e sem alterações em cobranças passadas.
- Os fluxos do piloto V35 ainda não estão integralmente implementados; pagamentos/recorrência/planos/relatórios e paridade de todas as telas continuam backlog.
- Produção não autorizada; CI/HTTP real novos e homologação visual permanecem gates de aceite.

