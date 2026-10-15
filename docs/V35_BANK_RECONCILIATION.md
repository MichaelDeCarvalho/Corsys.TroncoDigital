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

- Migration #54 `20261015003945_tenant_bank_reconciliation` aplicada somente DEV.
- 239 testes frontend em 38 arquivos, tipos e build PASS, antes do ajuste final
  de classes CSS. Parser: 11 casos; UI: confirmação, payload, replay incerto e
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
Não ler/exportar JWT do navegador. Ausência de credencial local não é PASS.

Preview e QA assinada desktop/mobile deste incremento devem ser registrados após
publicação. Testes de concorrência de transferências/fechamento e paridade completa
V35 não são cobertos pelo gate de conciliação. Etapa 2 segue aberta. Sem PROD/merge.
