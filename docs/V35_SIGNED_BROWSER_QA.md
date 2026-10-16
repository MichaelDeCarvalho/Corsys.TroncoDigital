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

# Jornadas assinadas DEV — 2026-10-14

## Escopo autorizado

Proprietário autorizou persistir duas Lojas QA isoladas, com as identidades A/B
existentes, duas contas mapeadas e R$10 fictícios por Loja. Sem novos usuários,
convites, provedores externos ou cobranças. Históricos originais A/B preservados.
Preflight `seed_dev_transfer_browser_qa.sql` passou com rollback antes da aprovação;
persistência posterior confirmada. Não reexecutar seed cegamente.

- QA A: `68ca5c28-b1bd-4d42-b758-f80b4b31a97f`; origem
  `d6e9a3e6-cacf-491f-b2fa-55f7ab54028f`, destino `92d120d5-0f45-47f1-8cee-c06ea6925e15`.
- QA B: `98b857a9-0547-4c83-a3fa-11783ae4912e`; origem
  `ca86e4c5-de93-4134-ba0e-ea47b3e56e3a`, destino `aade161d-62ab-4576-9446-a979aa60977f`.
- Seed usou current_date UTC do banco (2026-10-15), portanto as jornadas usam essa
  data contábil fictícia. Data desta sessão no Brasil: 2026-10-14.

As Lojas originais têm planos publicados sem conta patrimonial; o guard rejeita
ativar nova conta sem cobertura em todos os planos aplicáveis. Não alterar guard,
triggers, mappings ou planos históricos para facilitar homologação. As Lojas QA
foram criadas com as duas contas e mappings antes de publicar seu próprio plano.

## Defeito encontrado e correção

Transferência B UI gravou uma única vez (`1f124bed-e806-433f-97e8-45f86ea18027`),
mas o frontend classificou UUID válido como resposta incerta: regex tinha um grupo
de quatro caracteres ausente. Retry com mesma chave não duplicou o registro.
Regex corrigida; também preservado feedback de sucesso/erro durante reload dos
dados. Dois testes existentes ampliados para exigir confirmação visível falharam
antes e passaram após correção. Não é apenas teste de chamada do mock.

## Testes HTTP pelo navegador sem extrair credenciais

`dev-qa.html` é uma entrada adicional opcional, construída somente com
`VITE_DEV_QA_ENABLED=true` e Supabase DEV exato. Build normal não inclui essa página.
Runtime verifica hostname DEV, flag e identidade esperada; esses gates limitam a
ferramenta de teste, não substituem autorização/RLS do banco. Sem novos grants.
Hostnames aceitos: Worker DEV exato ou sua Version URL com prefixo hexadecimal
de oito caracteres. Três testes dos gates incluem recusa de alvo/hostname/flag
incorretos. A configuração de build também recusou alvo fora do DEV.

Outra publicação (`bb8d6c3b`, 02:43 UTC) substituiu a versão `31831e03` publicada
por esta sessão às 02:41 UTC e removeu a entrada QA. Usar upload de versão sem
trocar tráfego, evitando disputar o endpoint principal. Version URL exige login
normal na nova origem; não transportar credenciais entre origens. Referência:
[Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/).

Usa o cliente Supabase padrão da aplicação e getUser; não lê/exibe/exporta JWT,
senha ou armazenamento de sessão. Não contém login próprio. Testes acionados por
botões usam requisições RPC reais e Promise.all no próprio cliente, evitando a
serialização observada no conector SQL. A identidade A/B deve ser autenticada
normalmente na aplicação antes de abrir a página QA.

Rotinas: leitura própria positiva + RLS estrangeiro; RPC com org e IDs estrangeiros;
transferência com replay concorrente de mesma chave, payload divergente e disputa
de saldo entre chaves; conciliação B com replay concorrente e disputa de capacidade
nos dois extratos previamente aprovados. Cleanup em finally estorna/desfaz somente
os IDs retornados pelas próprias chamadas. Erros de transporte/validação não são
aceitos como prova de isolamento. Fixtures com saldo inesperado falham fechado.

## Resultados observados

- Commit funcional `4ab9db1`: 241 testes, tipos/build PASS; CI `38672271404` #280
  success. Guard de hostname/versão acrescentou um terceiro teste focal PASS.
- Versão isolada `962f7b1b-1652-4ae5-86d3-4e53f4cbe7ae`, commit `23906b6`, upload
  sem trocar tráfego. URL `https://962f7b1b-corsys-tronco-digital-dev.corsys1.workers.dev/`.
  HTML principal/QA e assets iguais ao build por SHA256. Entrada canônica QA `/dev-qa`.
- B UI corrigida confirmou transferência `6bcb2d6a-811b-4d5e-8a09-3047e9e4a9f8`
  de R$1 e estorno. Também estornou o primeiro lançamento. Saldos 10/0 restaurados.
- B CSV browser completo: `DEV_QA_UPLOAD_B_20261014.csv`, import
  `e41657b5-6f27-4fc8-a9ce-0b9396d8d82c`, SHA256
  `67c55cb3bf8577c84d3b6834d4ffb38e9e741f98dee3fc2ebcc5a852aad08fce`.
  Prévia → staged → VALIDAR → vínculo R$10 → reconciled → DESFAZER, tudo pela tela.
  Vínculo `9403480b-784c-4f3c-817c-6dd98fc08a79` preservado com reversão; import
  voltou a validated. Persistência é das linhas normalizadas, não do arquivo bruto.
- HTTP real B: próprio positivo, orçamento com org/ID estrangeiros negado, conta
  estrangeira em transferência e tenant estrangeiro negados. SELECTs estrangeiros
  vazios em cinco tabelas; uma tabela vazia no tenant remoto não prova por si só RLS.
- HTTP concorrente B: duas chamadas mesma chave retornaram mesmo UUID; payload
  divergente 22023. Duas chaves de R$9 disputaram R$10: um vencedor e um 23514,
  saldo intermediário 1/9; estornos restauraram 10/0, DRE permaneceu vazia.
- Conciliação HTTP B: replay simultâneo mesma chave retornou um único vínculo;
  disputa de capacidade entre chaves teve um vencedor e um 23514; cleanup deixou
  zero valor conciliado nos dois extratos originais autorizados. PASS observado
  na página, seguido de read-back SQL independente.
- Read-back posterior B: zero transferências sem estorno; saldos 10/0; nenhum
  valor ativo conciliado nos extratos de disputa. Nenhuma fatura SaaS nas Lojas QA.
- CI do commit `23906b6`: execução `38673128298` #281 completed success.

## Fechamento A e read-back conjunto — 2026-10-15

- Sessão real A confirmada no Edge, seletor exibindo somente original A e QA A.
- UI A: transferência `0ba7ff08-f218-4594-9707-0c836c945554`, R$1,
  confirmação visível e saldos 9/1; estorno confirmado e saldos 10/0 restaurados.
- OFX A completo pela interface: prévia de uma linha R$10 → staged → VALIDAR →
  vínculo com pagamento sintético `22adbd88-f517-4c1b-9680-37662e940056` →
  reconciled → DESFAZER → validated, zero conciliado. Import
  `46d1bd1b-ac7b-421e-afc3-dfc0c8b199f8`, SHA256
  `0dbc55a253c19027493c7ebaa525728c5687f41612bef78d3f083fdc92e5a9a7`.
  Vínculo `f4f147d2-ae7d-472f-b46a-2e87397f61f8` preservado com reversão.
- HTTP A→B: cinco leituras estrangeiras ocultas, leitura própria positiva e RPCs
  com escopo/IDs estrangeiros recusadas. Resultado PASS observado na página QA.
- HTTP concorrente A: mesmo UUID no replay simultâneo, divergência 22023;
  disputa R$9/R$9 sobre R$10 com um vencedor e um 23514, saldo 1/9;
  estornos restauraram 10/0 e DRE vazia. Resultado PASS observado.
- Read-back SQL independente conjunto: A e B com saldos 10/0, zero transferências
  sem estorno, zero valor conciliado nos imports QA e nos dois extratos originais
  de disputa; ambos imports QA validated; zero faturas SaaS QA. Lojas originais
  continuam com 17 cobranças e 16 pagamentos.

Estas jornadas concluem o escopo funcional solicitado de transferência A/B,
CSV/OFX persistidos e testes HTTP cruzados/concorrentes descritos acima. Não
encerram a Etapa 2 inteira nem a implementação das 21 telas. Testes de carga,
intervalos internos dos locks e toda matriz de papéis não são cobertos.
