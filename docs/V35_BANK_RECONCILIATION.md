# Conciliação DEV — 2026-10-14

## Implementado

Financeiro > Conciliação bancária: prévia OFX/CSV, staging, revisão/VALIDAR,
correspondência manual/CONCILIAR e desfazimento/DESFAZER com motivo e auditoria.
Valores e movimentos reais vêm do banco. Não registra ou estorna pagamentos.
Mantém padrões de tabela responsiva e estados de erro do projeto; referência
visual: seção Conciliação bancária no HTML original V35 preservado.

CSV UTF-8 com cabeçalho `data;descricao;valor;id`, ponto decimal, data ISO, id
opcional; aspas/descrições com separador aceitas. OFX BRL SGML/XML simples com
STMTTRN, DTPOSTED, TRNAMT, FITID e MEMO/NAME; sem entidades XML. Limites 1 MB,
500 linhas, 100 imports na consulta, 500 movimentos do período e 1.000 vínculos.
Excesso falha fechado. Importações de moedas/formatos incompatíveis são recusadas.
Variação do extrato não equivale a saldo bancário final.

## Evidência verificada

- Publicação final DEV: commit `19c9c323843bf792ea3e24c5ad0e6a79c7de2ddb`, versão
  `485cc0a0-5a60-4e75-8cc4-6658b874b631`. CI `38670814645` (#278) completed success.
  Assets remoto/local idênticos:
  JS `index-CM7eC9be.js` SHA256 `10ee8e93041586bddc40bc6fdd1e164e7b46bc513d548b90bfefe54bf551d226`;
  CSS `index-o9vIR7UR.css` SHA256 `c8a2f3b3c17dbc5a939d391a9b1f7fb1d8218a36b112c7db46860d01e31fa7bf`.
- Sessão B real no Edge, duas abas com os extratos aprovados: confirmações
  despachadas no mesmo Promise.all; uma aceitou e outra rejeitou. Banco confirmou
  um único vínculo ativo de R$100. Vínculo `292144a8-088b-424e-80dd-de0ced4d678f`
  desfeito pela tela; read-back final zero ativos, ambos imports validated,
  17 cobranças/16 pagamentos e duas contas originais preservados. Isso cobre a
  disputa funcional por capacidade em duas abas; não instrumenta sobreposição
  dos locks no servidor nem substitui stress/concorrência das transferências.
- Prévia CSV na sessão real exibiu uma linha de R$100 antes de confirmação;
  nenhum terceiro extrato foi gravado. Staging/validação persistidos foram
  exercitados por SQL; ainda não são jornada completa de upload assinada browser.
- Desktop 1440x1000: documento/client 1425 px; mobile 390x844: documento/client
  375 px após corrigir overflow de cartões (antes 444 px). Cartões mobile 295 px;
  tabela com rolagem própria, 295/655 px. Screenshots inspecionadas; override reset.
- Quatro RPCs anon por HTTP: todas HTTP401/42501. Gate SQL ampliado confirmou
  VIEWER negado nas quatro RPCs e assinatura suspensa negada, com rollback.

- Migration #54 `20261015003945_tenant_bank_reconciliation` aplicada somente DEV.
- 239 testes frontend em 38 arquivos, tipos e build PASS; build repetido após
  o ajuste CSS final. Parser: 11 casos; UI: confirmação, payload, replay incerto e
  recusa de escopo estrangeiro/truncamento. Build mantém aviso de chunk >500 kB.
- `DEV_BANK_RECONCILIATION_ROLLBACK_PASS`: A/B, staged sem match, validação,
  match/replay, excesso, desfazimento/replay, RLS, conta/tenant estrangeiros e anon.
- `DEV_TRANSFER_POSITIVE_ROLLBACK_PASS`: duas identidades DEV em Lojas descartáveis
  com duas contas mapeadas; transferência/replay, payload divergente, estorno/replay,
  duplicidade rejeitada, total de caixa e DRE preservados. Ambas as pontas de um
  mesmo transfer reconciliadas independentemente. Tudo revertido, sem alterar A/B.
- Dois extratos `DEV QA CONCURRENCY 20261014-1/2.csv` persistidos na Loja B com
  autorização específica do proprietário: imports `d42c6633-6b71-4261-ab94-6dfd45773726`
  e `209e5ce1-4dab-4d80-9cca-fee64d3422f7`. Não alteram ledger/saldos.
- Primeira disputa via conector: PASS/23514, mas horários sem sobreposição
  (00:43:48–51 UTC e 00:43:56 UTC). **Não comprova concorrência.** Vínculo
  `62658975-ed31-4c4e-9a78-0e59e2eb875a` desfeito; histórico preservado.

## Gates restantes

`dev-gate/tests/bank-reconciliation-http.mjs` usa somente os dois extratos aprovados,
faz leitura positiva/negativas A/B, replay simultâneo e disputa de capacidade,
desfaz os vínculos em finally e preserva os extratos. Executar de dev-gate:
`node --env-file=.env.dev tests/bank-reconciliation-http.mjs`.
Precisa dos logins locais A/B e chave pública; não precisa de secret/service_role.
Proprietário escolheu seguir com as sessões do navegador e registrar esse limite;
o gate HTTP completo não foi executado, e não há solicitação de credenciais pendente.
Não ler/exportar JWT do navegador. Ausência de credencial local não é PASS.

QA assinada e publicação acima têm escopo delimitado. Testes de concorrência de transferências/fechamento e paridade completa
V35 não são cobertos pelo gate de conciliação. Etapa 2 segue aberta. Sem PROD/merge.

Transferência positiva pela interface das Lojas A/B ainda depende de segunda conta
ativa com cobertura contábil válida. O guard recusou a criação direta dessa conta
nas Lojas com planos publicados; não foram alterados planos, mappings históricos
ou triggers para contornar a regra. O positivo executado é o comando autenticado
em fixture isolada revertida, não a jornada dessas duas Lojas no navegador.
