# V35 — retomada e entregas verticais (2026-10-14)

## Estado consolidado vigente — 2026-10-15

Este bloco substitui os estados operacionais históricos abaixo. Requisitos e
critérios de aceite permanecem integrais. Base desta consolidação: `be62954`,
branch `feat/v35-dev-gate-20261002`, PR draft #4; 56 migrations DEV.

| Frente | Implementado e verificado | Falta para aceite integral |
|---|---|---|
| Orçamento | Draft/linhas/publicação/consulta; jornadas UI A/B e execução acima de 100% | Matriz completa de papéis e integração visual integral |
| Transferências | Duas contas mapeadas por Loja QA autorizada; UI A/B com estorno; HTTP replay/disputa de saldo A/B; DRE preservada | Demais papéis, período fechado/suspensão sob HTTP e paridade integral |
| Conciliação | OFX A/CSV B persistidos, validados, conciliados/desfeitos pela UI; replay/disputa HTTP B | Demais papéis, formatos adicionais e paridade integral |
| Recorrência mensal | Integrantes e institucional mensal: cadastro/prévia/emissão/cancelamento/desativação UI A/B; SQL rollback e componentes | Disputa HTTP mensal em diagnóstico; faltam especiais/anuais/reajuste do inventário |
| Cobranças/pagamentos | Avulsa/cancelamento, registro/alocação/estorno; testes SQL rollback e componentes | Jornada básica A/B concluída; faltam negociação/parcelamento/eventos previstos |
| Obrigações/aprovações | Cadastro/liquidação/correção/cancelamento, política e decisão | Criação/correção/cancelamento A/B concluídos; estorno institucional UI/HTTP A/B concluído; faltam multiaprovador e histórico completo |
| Fechamento | Eventos de fechamento/reabertura e testes SQL rollback | Bloqueio de avulsa e reabertura A/B concluídos; faltam demais comandos/papéis/suspensão em HTTP |
| 21 telas | Componentes parciais e sequência de seis lotes abaixo | Aceite campo/ação a campo/ação, responsividade e visual do HTML original |

Evidência atual das três primeiras frentes: [QA assinado](V35_SIGNED_BROWSER_QA.md),
[orçamento](V35_BUDGET_LIFECYCLE.md), [conciliação](V35_BANK_RECONCILIATION.md).
Read-back final A/B: saldos QA 10/0, zero transferências sem estorno, zero valor
conciliado ativo nas fixtures, zero faturas SaaS QA; originais 17 cobranças/16
pagamentos. Não pedir novamente credenciais ou segunda conta para esses ensaios.

Passo 1 (consolidação): concluído. Passo 2: auditar e completar as quatro últimas
frentes financeiras acima, sem reclassificar SQL simulado como HTTP real.
Depois avançar lotes 1–6; aplicar testes/build/segurança/preview e registrar aceite
por entrega antes da seguinte. Etapa 2 aberta. Sem autorização de merge/produção.

### Histórico de execução (estados abaixo não são pendências atuais)

## QA positivo autenticado — aprovado e executado

O proprietário aprovou explicitamente o ciclo sintético persistido durante o teste
e sua exclusão ao final. Criado somente no tenant DEV A o draft
`6f953af3-c600-4bf2-ae3c-4ff1a0c63236`, nome `DEV QA ORCAMENTO be967cf TEMPORARIO`,
competência setembro/2026, com uma linha de R$250 para conta existente cujo realizado
na view é R$500. Nenhuma cobrança, pagamento ou movimento criado/alterado.

No preview publicado, sessão autenticada A: ciclo selecionado, competência 2026-09,
consulta de conta contábil retornou R$250 orçado, R$500 realizado, -R$250 restante,
indicador visual limitado a 100 e texto **200% — acima do orçamento**. PASS para
essa jornada real. Entrada automatizada do mês exigiu confirmação por teclado;
não foi alterado o DOM nem simulado estado React para obter o resultado.

Cleanup transacional limitado por UUID/tenant/nome/status draft: ciclo e linha
removidos. Read-back: zero ciclos/linhas desse UUID, 17 cobranças e 16 pagamentos
preservados. Consulta atualizada no navegador após limpeza. O bloqueio anterior
do auto-review foi resolvido pela aprovação explícita, sem contorno de controle.
Limite: viewport efetivo 754x668; desktop/mobile separados e B/Master não avaliados
nesta jornada. Não representa orçamento editável/publicável ou fechamento da Etapa 2.

## Publicação DEV conferida após autenticação

OAuth Cloudflare concluído pelo proprietário. Conta e Worker existentes conferidos:
`corsys-tronco-digital-dev`, URL `https://corsys-tronco-digital-dev.corsys1.workers.dev/`.
Já havia versão publicada `4d47c0cf-d659-4403-8624-8fe63d259b80` às 20h41 Brasil
(23:41:46 UTC) de 2026-10-14; não foi necessário novo upload. Não atribuir essa
publicação ao agente: seus assets coincidem com o build local de `be967cf`,
recompilado com a chave pública DEV vigente:

- JS `index-DYt1QjTc.js`, SHA256 `13b4001326491d8728ba98e1f5e91509b086e13b6045803f244d4d55f3783f48`.
- CSS `index-J4Ueqwlt.css`, SHA256 `96619b89eb5c9ce9f8c7c010dc92f9c0770bcd07826af773b83eb64e9d2a5f85`.
- CI de `be967cf`: run `38655489396` (#271) completed success.

Sessão autenticada A preservada após reload; orçamento vazio real e formulário
desabilitado observados no build publicado. Pedido de viewport desktop 1440x1000
não mudou a largura efetiva do navegador interno (754x668), confirmado pelo DOM;
override restaurado. Não declarar desktop 1440/mobile 390 homologados.

Teste positivo com ciclo sintético persistido durante a sessão de navegador foi
rejeitado pelo auto-review por alterar temporariamente o relatório orçamentário
sem ROLLBACK. Nenhum registro foi criado. Aprovação específica pedida ao proprietário
para ciclo temporário identificado, uma linha de R$250 contra realizado R$500, com
exclusão restrita do fixture após QA. Não contornar o bloqueio.
SQL A/B com ROLLBACK e testes de componente não substituem esse teste positivo
autenticado. Gate do lote 0 permanece parcialmente aberto.

## Auditoria inicial e lote 0

Base confirmada: `210a039bf19e4978d9fcd28bfd8eba58aacfd44b`, branch
`feat/v35-dev-gate-20261002`, PR draft #4 aberto, base `feat/v35-foundation`.
DEV `szqkdekwhzxsoxorgvaz`: 52 migrations, 138 tabelas públicas. Listagem geral
não mostrou o projeto, mas consultas diretas funcionaram. Etapa 2 permanece aberta.

Lote 0 iniciado: estabilização da consulta orçamentária e da ferramenta de publicação.
`BudgetReport` ganhou percentual/barra de execução presentes em `view-tesouraria`
do HTML original; gasto acima de 100% e saldo negativo ficam explícitos; base zero
não gera percentual fictício. Leituras recusam duplicatas, moeda não BRL, catálogo
incoerente, agrupamento inválido e divergências de um centavo antes dos totais.
Não implementa cadastro/publicação do orçamento, conciliação ou transferência positiva.

Wrangler fixado de 4.147.0 para 4.151.0 para corrigir cadeia Miniflare/sharp:
audit inicial 3 high, instalação corrigida zero ocorrências. Referência:
https://github.com/advisories/GHSA-wq5f-xc86-pv6w . Sem exploração demonstrada no
site; dependência de desenvolvimento. Nenhuma migration, grant, auth ou RLS alterada.

## Evidências desta execução

| Check | Resultado e limite |
|---|---|
| Baseline frontend | 213 testes, tipos e build PASS |
| Frontend alterado | 217 testes em 35 arquivos, tipos e build PASS; nove testes de orçamento |
| Guardas locais DEV | 12 testes PASS; não são HTTP/JWT |
| Preservação | 29 ADRs, 52 migrations, 51 documentos, 263 declarações, 21 telas PASS |
| Catálogo segurança | `verify_security_catalog.sql` executado sem exceção; não substitui autorização real |
| Invariantes | `FINANCIAL_INVARIANTS_PASS`, `POST_V31_INVARIANTS_PASS` |
| Recorrência | `DEV_MONTHLY_GENERATION_ROLLBACK_PASS` |
| Correções/cancelamentos | `DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS`, `DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS`, `DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS` |
| Transferências | `DEV_TRANSFER_GUARDS_ROLLBACK_PASS`, somente negativas |
| Caixa | `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS` |
| Orçamento | Novo `DEV_BUDGET_READ_ROLLBACK_PASS`: contas/fundos A/B positivos, realizado conferido com DRE, cross-tenant oculto nas duas direções e escrita direta negada |
| Preview existente | Proprietário autenticou Loja A, painel observado; não equivale a build novo homologado ou teste A/B |

SQL usou claims simuladas e ROLLBACK: não representa JWT assinado ou concorrência
independente. O primeiro teste de orçamento encontrou ausência de fundo; fixture
corrigida para criar fundo sintético dentro da transação e execução seguinte PASS.
Nenhum ciclo/fundo sintético persistido. Build mantém aviso de bundle >500 kB.

Vitest inicial falhou em temporário do sandbox Windows; reexecução com TEMP/TMP em
`.test-tmp` passou. Python requer `PYTHONUTF8=1`. Checkout CRLF divergiu de hashes:
arquivos sem mudança Git foram regravados com bytes canônicos de HEAD; não se
alteraram manifests/hashes para aceitar divergência. Fontes HTML/ADRs preservados.

## Organização das 21 telas em jornadas completas

IDs canônicas de `V35_PILOT_V35_INVENTORY.md`; componentes existentes são parciais,
não telas homologadas. Lote 0 ainda em execução; lotes 1–6 são sequência de entrega.

| Lote | Telas | Jornada de aceite |
|---|---|---|
| 1 — parametrizar a Loja | `view-integrantes`, `view-cadastros`, `view-configuracoes`, `view-plano-contas`, `view-config-dre` | Integrante → cargos/termos → categorias/preços/contas/fundos → plano sucessor publicado → cobrança/DRE, sem reescrever histórico |
| 2 — cobrar e receber | `view-financeiro`, `view-inadimplencia` | Prévia/geração recorrente → cobrança → pagamento/alocação → correção/cancelamento/estorno → inadimplência/exportação; retry e período fechado |
| 3 — tesouraria | `view-contas-pagar`, `view-contas-receber`, `view-tesouraria`, `view-fluxo-caixa`, `view-dre` | Obrigação/aprovação/liquidação/correção; transferência e estorno; orçamento draft/publicação/realizado; extrato staging/validação/prévia/confirmação/conciliação; saldos e DRE conferidos |
| 4 — gestão | `view-dashboard`, `view-relatorios` | Indicadores/filtros conciliados, paginação, exportações privadas PDF/XLSX e estados vazios/erros reais |
| 5 — atendimento | `view-chamados` | Abrir/acompanhar/responder chamado com histórico/status e isolamento das Lojas |
| 6 — SaaS | `view-master`, `view-master-clientes`, `view-master-cobranca`, `view-master-planos`, `view-master-operacao`, `view-master-config` | Onboarding/convite real, Cliente360, contratos/planos/promoções/cobrança, suporte temporário somente leitura; Master/MFA server-side |

## Gate por lote e pendências

1. Confrontar campos/ações com IDs do inventário e HTML original, desktop/mobile.
2. Implementar frontend/backend/migration aditiva quando necessária, reutilizando
   autorização, RLS, idempotência e auditoria; nenhuma escrita financeira offline.
3. Tipos/testes/build/preservação e revisão do diff/segurança; SQL A/B com rollback.
4. Publicar somente preview DEV; registrar SHA/versão e assets realmente publicados.
5. Homologar jornadas autenticadas desktop/mobile, positivos/negativos A/B, papéis,
   retry, concorrência relevante, suspensão e fechamento. SQL/mocks não são HTTP/JWT.
6. Atualizar contexto/handoff e registrar aceite antes de avançar. Sem merge/PROD.

Impedimentos iniciais: Cloudflare CLI sem autenticação, resolvido conforme seção
de publicação acima. Login A no preview disponível; B/Master/MFA e novos HTTP não avaliados.
Cada tenant tem uma conta ativa: transferência positiva exige segunda conta e
mapeamento em plano sucessor legítimo, sem alterar planos publicados ou desabilitar
triggers. Orçamento consultivo existe; cadastro/publicação e conciliação OFX/CSV
não têm fluxo frontend operacional completo. Próximo passo é publicar/homologar
lote 0, fechar dependências do lote 1 e avançar jornadas 2/3. Não declarar Etapa 2 concluída.
# Atualização de aceite — 2026-10-14

Orçamento operacional e conciliação passaram a ter implementação vertical DEV;
ver V35_BUDGET_LIFECYCLE.md e V35_BANK_RECONCILIATION.md para evidências atuais.
Conciliação: migration #54, 239 testes, CI #278 success, preview publicado e QA
desktop/mobile. Transferência/estorno positivos em fixture isolada rollback;
duas abas B disputaram um pagamento com apenas um vínculo aceito, depois desfeito.
HTTP cruzado A/B completo e concorrência de transferências seguem não avaliados;
transferência positiva na UI A/B precisa de segunda conta válida. Etapa 2 aberta.
As seções anteriores registram a auditoria histórica, não substituem esses
relatórios de aceite incremental. Nenhum PROD/merge.
