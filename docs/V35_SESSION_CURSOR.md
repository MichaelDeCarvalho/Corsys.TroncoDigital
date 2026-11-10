## V35 M04.02 — reconciliação de sessões temporárias

M04.02 reconciliada sobre main 82014d1. As três RPCs existentes exigem MASTER/AAL2 e auth.uid, ligam sessão ao operador e Loja, geram prazo de 15 minutos no servidor, serializam abertura por Loja, preservam chave/replay e auditam abertura/encerramento. O helper de leitura exige vínculo, escopo read_only e janela ativa; a sessão não cria identidade nem papel tenant. Gate SQL DEV de 29/10 com rollback preservado. A auditoria UI posterior observou eventos históricos de início/fim, sem provar o ciclo completo com JWT. Neste PR, o cliente valida escopo, Loja e prazo, bloqueia comandos até consulta válida e reutiliza a chave após perda de resposta com o mesmo payload. Contagem usa prazo monotônico de apresentação; a expiração efetiva continua no servidor. 14 testes focados e typecheck locais. Homologação pendente: JWT Master/AAL2, sessão simultânea de outro operador, negações de escrita e outra Loja, expiração e auditoria no escopo autorizado.

M04.03 começa em PR separado: loadPlatformJobs limita aos 25 mais recentes sem filtro de status/tipo/Loja nem paginação. Falhas antigas podem ficar inacessíveis pela tela Saúde/Jobs. Implementar diagnóstico consultável com filtros e paginação estável, preservando autorização e dados sanitizados; não acionar retry nesta entrega.

## Marco 10/11/2026 — M03.03 rubricas integradas e M04.01 reconciliada parcialmente

- PR #42, HEAD `dd975efc0beb1ba2934b254aa4927e11ef736510`, CI #463 static/frontend/onboarding **3/3 PASS**, integrado em `b9b0fb542d31eeef20879586e25cf5a981372e8d`. DRE, comparativo e Relatórios apresentam receita registrada, custo, despesa, resultado operacional antes do financeiro e resultado financeiro, usando `read_tenant_dre`/naturezas históricas e soma por competência em centavos.
- **M03.03 PARCIAL INTEGRADA:** sem Receita Bruta/Deduções/Receita Líquida segregadas; competência, cancelamentos e reclassificação histórica dependem de matriz contábil validada. **M03.04 BLOQUEADA PARA LIVRO INTEGRAL:** projeções da DRE e tesouraria não substituem partidas dobradas e contrapartidas. Decisões rastreadas na [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43). Não criar lançamentos ou classificação arbitrária.
- **M04.01:** já existem `MasterBilling`, preview/emissão manual idempotente no código e as duas RPCs `preview_saas_manual_invoice` e `issue_saas_manual_invoice` no DEV. Read-back somente leitura em 10/11/2026 confirmou ambas como `SECURITY DEFINER` sem EXECUTE de anon; execução autenticada autorizada dentro do servidor por Master/AAL2 conforme migration. JWT real, contratos/ciclos/termos comerciais e fatura real **não homologados**. [Reconciliação e gates](V35_M0401_MANUAL_BILLING_RECONCILIATION.md). Nenhuma escrita no Supabase DEV nem PROD.

---

## V35 M03.03 — rubricas com classificação demonstrável

M03.03 sobre main 19bae9c: as telas DRE, comparativo e relatórios distinguem receitas registradas, custos, despesas e resultado financeiro pela natureza histórica retornada por read_tenant_dre. O demonstrativo separa resultado antes do financeiro e resultado total; a soma por competência conserva sinais e centavos. M03.01 permanece integrada com gates DEV já registrados.

Para completar Receita Bruta, Deduções e Receita Líquida, o contador deve definir quais contas/eventos reduzem a receita e como versionar essa classificação por plano/competência, inclusive cancelamentos e correções. Natureza revenue e a classificação recorrente/avulsa não distinguem dedução de ajuste. M03.04 integral exige eventos contábeis balanceados: v_dre_entries expõe somente a perna de resultado e o ledger de tesouraria expõe movimentos de caixa. Faltam regras explícitas para contrapartidas de recebíveis, obrigações, adiantamentos e saldos iniciais, além de como registrar liquidações e reversões. Não publicar esses recortes como Diário ou Razão integral.

## Marco 10/11/2026 — M02.02-D integrada; M02.03 aguarda autorização DEV

- PR #40, HEAD `746bd5819d04c4eb91f276c1d1434d4e6309af27`, revisão do contrato SQL e testes registrada no PR; CI #459 static/onboarding/frontend **3/3 PASS**. Integrado à `main` no squash `86f1c62634d4e2dc0a5ad1fbac1cd49218517907`.
- M02.02-A/B/C/D **integradas somente em código**. Migration de D `20261110220000_v35_cash_flow_detail.sql` **ausente** na leitura do DEV em 10/11/2026; frontend novo **não publicado**, QA de JWT/finance.read reais não realizado. Gate necessário: [V35_M0203_DEV_GATE.md](V35_M0203_DEV_GATE.md) (no cursor use link direto). Não declarar M02.03 homologada.
- **Reconciliada M03.01 antes de reconstruir:** `AccountingPrepublication.tsx` já contém a confirmação expressa e a RPC `publish_validated_accounting_plan`, com tratamento idempotente e testes de frontend. Migrations `20261009162535` e `20261009165809` e ADRs 0014/0015 registram autorização, rechecagem sob lock por Loja, imutabilidade e gate DEV SQL A/B rollback. Read-back no Supabase DEV confirmou ambas RPCs de preview/publicação existentes; anon sem EXECUTE na função validada, authenticated sem EXECUTE no comando legado, função validada autenticada com autorização interna `accounting.manage`. **M03.01 NÃO é funcionalidade ausente**; faltam conferir JWT/HTTP real, simultaneidade e UX quando necessário. A nota residual da tela sobre "publicação automática indisponível" não deve ser interpretada como inexistência de publicação validada manual.
- Próxima microentrega de código deve reconciliar o restante do domínio M03 contra a V35, priorizando lacunas contábeis reais; M02.03 exige autorização específica de ativação DEV.

---

## V35 M02.02-D — Fluxo de Caixa

M02.02-D sobre main 698dd1b. read_tenant_cash_flow_detail exige finance.read e produz uma fotografia por chamada: detalhe de 25 linhas, ranking líquido das 10 categorias positivas e saldos históricos completos. Saldo inclui abertura, transferências e estornos; conciliação e DRE seguem contratos próprios. Ranking usa alocações existentes no registro do pagamento e correções anteriores àquele registro; o estorno abate a mesma composição na data efetiva. Resíduo fica sem categoria. Consultas posteriores podem observar commits novos. PostgreSQL 17 descartável no CI, sem ativação DEV.

## M02.02-B/C integradas; próximo contrato M02.02-D (10/11/2026)

- PR #37, detalhamento operacional paginado de movimentos por conta, integrado à `main` em `66db9bf751093b46e5d4df23e57437df0c7200d5`, CI static/frontend/onboarding 3/3 PASS.
- PR #38, aba Saldo usando `TreasuryBalances` e os valores derivados por conta (não conciliados), integrado em `b13aa26d0f1ac5d4cf833820f418fd8ce4cd181e`, CI 3/3 PASS. Não há saldo histórico inicial por competência nesse incremento.
- Supabase DEV **somente leitura**: `security_invoker=true` confirmado para as duas views utilizadas; contas financeiras têm RLS SELECT para `finance.read`, e a leitura de pagamentos inclui essa permissão. **Nenhum deploy ou migration** dos PRs B/C, nenhum JWT/QA DEV específico realizado.
- Próximo passo M02.02-D documentado em `docs/V35_M0202D_CASH_FLOW_CONTRACT.md`: categoria e descrição real de origem, ranking de maiores despesas e saldo inicial/evolução, com semântica de liquidação/estorno e classificação histórica validada. Sem soma de página nem categorias presumidas.
- M02.02-A (conciliação) continua integrada sem gate DEV, e `repasse neutro` segue excluído por decisão expressa. Preservar source HTML e homologações financeiras anteriores.

---

## M02.02-C — saldo contábil por conta no Fluxo de Caixa (10/11/2026)

- PR #37 M02.02-B integrado na `main=66db9bf751093b46e5d4df23e57437df0c7200d5`, CI static/frontend/onboarding 3/3 PASS. Detalhamento paginado operacional em código; nenhuma publicação DEV ou alteração em produção.
- Branch `feat/v35-m0202-c-cash-flow-balances`: modo **Saldo** do Fluxo de Caixa reutiliza `TreasuryBalances` e `v_financial_account_balances` já existentes, com escopo Loja e RLS do backend; não calcula saldo por soma de páginas nem o classifica como conciliado. Teste de rejeição de conta estrangeira incluído. **Sem migration/deploy**, CI deste incremento a verificar.
- Mantêm-se pendentes saldo inicial/evolução histórica, descrição e categoria do movimento de origem e ranking de maiores despesas. Exigem leitura server-side real e testes específicos; não apresentar resultados parciais como globais. A M02.02-A continua integrada, aguardando gate DEV. Repasse neutro está desconsiderado.

---

## M02.02-B — detalhamento paginado do Fluxo de Caixa (10/11/2026)

- Branch `feat/v35-m0202-b-cash-flow-movements` baseada na `main=c41b68237064209242a2848148f723055fe2b076`. Incremento frontend **somente código, sem migration/deploy**: o modo Consolidado e Receitas × Desp. exibe eventos operacionais reais paginados por conta a partir de `v_financial_account_movements` (RLS/security_invoker existente), sem misturar transferências/abertura com recebimentos e pagamentos.
- A consulta valida escopo da Loja, período de 1–93 dias, tipo/direção, conta financeira, contagem exata do PostgREST e completude da página antes de exibir; páginas não são somadas como saldos globais. Documentação e testes focados incluídos em PR, resultados de CI a conferir. **Não** homologado DEV nem produção.
- A V35 ainda exige categoria/descrição real de origem, ranking de maiores despesas e visão de saldo com base confiável. Não inventar categoria nem deduzir natureza contábil da direção da caixa; avaliar RPC de leitura consolidada no próximo incremento. Guardas de M02.02-A preservadas. Repasse neutro foi DESCONSIDERADO em 10/11/2026.

---

## Decisão de escopo — 10/11/2026: desconsiderar repasse neutro

O proprietário declarou que **repasse neutro não integra o comportamento de negócio desejado**. A menção nos campos `DYN-008-F002` e `view-plano-contas-F082` do protótipo HTML V35 permanece apenas como **evidência histórica da fonte original**; não constitui requisito autorizado para produção. **Não implementar** categoria neutra, tratamento patrimonial/passivo, RPC, mapeamento ou cenários de estorno/baixa específicos desse conceito. Não alterar `sources/` nem o HTML original.

Esta decisão substitui instruções históricas de "confirmar regra contábil" ou "repasse neutro bloqueado" presentes abaixo. A M02.02 segue para paridade de Fluxo de Caixa e gates realmente pendentes, sem esse bloqueio. Outros tipos de repasse/obrigação efetivamente contratados continuam sujeitos às regras já existentes, sem inferir mudanças.

---

## M02.02-A integrada — correção de conciliação (09/11/2026)

- PR #33 M02.01 reconciliou inventário financeiro e foi integrado à `main` em `a320ca9a120c9f51ac4b71e2f53ca94e8f9cfa1f`.
- PR #34 M02.02-A, originalmente empilhado no #33, foi reconciliado com a `main` por commit com base única em `a320ca9a` (lease conferido; sem descartar arquivos funcionais). Revisão final `50ba0d593a69f455642b60a0186154ebe6d695c1`, CI frontend/static/onboarding **3/3 PASS**; integrado por squash em `16bfd8e8d0838a20f2be5464a5e9c122eef0d3ea`.
- Correção: estornos por lista de IDs do extrato em lotes, contagens exatas para linhas/matches/estornos, soma de vínculos ativos em centavos comparada ao total de cada linha e falha fechada sob inconsistência/truncamento. Oito testes focados e typecheck aprovados antes do rebase. **Não há transação única entre as múltiplas consultas**; se a integração exigir consistência de snapshot sob escrita concorrente, avaliar RPC de leitura única, sem declarar garantia inexistente.
- Código integrado, **não publicado/homologado DEV** neste ciclo; nenhuma migration, operação financeira, PROD ou envio de convite.
- M02.02 continua EM_EXECUCAO: repasse neutro **bloqueado até definição da natureza e titularidade contábil pela Loja**. Próxima alternativa independente já rastreada na matriz: paridade de consulta do Fluxo de Caixa (movimentos detalhados/ranking), respeitando RPC existente. Não reexecutar gates A/B já aprovados.

---

## V35 M02.02-A — integridade da conciliação

M02.02-A: leitura da conciliação restringe estornos aos IDs dos vínculos do extrato, em lotes de 100. Confere contagem exata e totais por linha em centavos; leitura truncada ou incoerente bloqueia as ações. Oito testes focados e typecheck locais passaram. Gate DEV futuro somente do cenário de truncamento, se autorizado. Repasse neutro depende da definição contábil.

## V35 M02.01 — reconciliação financeira

M02.01 reconciliada sobre main 0a753406. Matriz em docs/V35_M0201_FINANCIAL_RECONCILIATION.md. Próxima M02.02: garantir completude da leitura de vínculos ativos na conciliação sob truncamento de estornos. Repasse neutro segue lacuna de domínio; confirmar regra contábil antes de implementar. Gates financeiros A/B anteriores preservados. Revisão exclusivamente documental.

## Estado vigente — M01.03 integrada no GitHub, sem ativação DEV (09/11/2026)

- **Código:** PR #31, revisão `23b04c9319782550e83ac2dc4862cb1dd2c25bb5`, integrada via squash no commit `0addb8281300b018e6e8396feba2d6d08d458467`. CI static/frontend/onboarding **3/3 PASS**; diffs e origem documental revisados.
- **Implementação integrada:** callback `/onboarding/accept`, aceite explícito, identidade Supabase Auth associada à Loja, perfil mínimo, documento imutável em `private.onboarding_terms_documents`, hash SHA-256 verificado no browser/servidor, receipt e auditoria atômicos, retry de aceite idempotente e falha fechada quando não há documento publicado.
- **Estado de ambiente:** migration `20261109233000_v35_onboarding_acceptance.sql` **não aplicada** no Supabase DEV; nenhuma Edge Function, frontend ou Auth redirect da M01.03 publicado; nenhum envio de convite nem alteração em PROD. **INTEGRADO ≠ HOMOLOGADO_DEV**.
- **Decisão jurídica/comercial:** minuta de Termos de Uso não vigente; aprovação de texto oficial UTF-8, versão, data de vigência, hash e publicação somente após revisão jurídica/comercial. Não registrar documento fictício. M01.04 (convite real/JWT/aceite positivo) exige autorização separada e destinatário controlado.
- **Roteiro de ativação técnica DEV:** `docs/V35_M0103_DEV_GATE.md`. A aplicação de migration, deploy, configuração de origem e alterações do Auth dependem de aprovação específica; se autorizadas antes do texto jurídico definitivo, só executar negativas/controles permitidos, sem habilitar aceite indevido.
- **Próxima microentrega independente:** M02.01 — reconciliação do inventário V35 com componentes atuais, migrations e evidências existentes. Já identificada presença de `AccountTransfers`, `MutualBatches`, `DreReport`, `BankReconciliation`, `Relatorios`, `AccountingPlans` e migrations correlatas: a existência **não** prova paridade, mas impede reconstrução presumida. Investigar somente lacunas sem evidência; iniciar por fluxos financeiros da Loja.

---

- Roteiro do gate M01.03: [V35_M0103_DEV_GATE.md](V35_M0103_DEV_GATE.md). Minuta recebida como referência não vigente; documento oficial e destinatário do teste pendentes.

## M01.03 — callback e documento oficial

Verificação local: typecheck, 32 testes do App e três do dispatcher passaram. O job PostgreSQL/onboarding do run 42686830483 passou na revisão eb110eb. O frontend daquele run falhou na resolução de tipos de node:crypto no teste. A revisão seguinte isolou o import no runner Vitest e passou localmente.

PR #31 — callback /onboarding/accept?run_id=..., com sessão validada pelo Auth existente e sem abertura do Workspace durante o aceite. O convite usa o redirect construído exclusivamente a partir de ONBOARDING_APP_ORIGIN (HTTPS). Sem origem configurada, o dispatcher retorna 503 antes da reserva. A tela exibe texto UTF-8 como texto puro, verifica SHA-256 e exige ação explícita. O banco compara o mesmo conteúdo oficial e revalida vigência/versão/hash em toda nova ativação. O fluxo comercial exige termos mesmo se a flag legada estiver desligada. Replay concluído consulta o recibo, sem novo aceite.

Integração: revisar PR e CI. Homologação: aprovar o texto UTF-8 integral, versão, vigência e SHA-256 dos bytes exatos; provisionar metadados e conteúdo privado da mesma versão em transação separada e autorizada. Com aprovação específica, aplicar a migration no DEV antes de publicar Edge e frontend, configurar ONBOARDING_APP_ORIGIN e incluir o callback na allowlist Auth. Conferir primeiro que ausência de conteúdo, hash divergente, sessão inválida e usuário de outra Loja bloqueiam. Na M01.04, autorizar destinatário e envio separadamente e conferir callback/JWT real, acesso posterior, perfil da Loja, recibo e replay. Nenhuma publicação nem alteração DEV nesta etapa.

## Evidência M01.03 e gate de homologação

PR #31, revisão 302b4c9: job onboarding do GitHub Actions 42683699415 aprovado. Gate M01.03 em PostgreSQL 17 descartável confirmou rollback do DDL, negação anônima e de identidade diferente/não confirmada, finalização restrita e atômica, recusa de consentimento ausente e versão/hash inválidos, serialização de duas sessões e um único perfil/recibo/evento na Loja correta.

Homologação: aprovar a versão e o hash do documento oficial e definir a origem do conteúdo para exibição. Preparar a tela de aceite e o retorno do Auth. Após aprovação específica, aplicar a migration M01.03 somente no Supabase DEV e publicar a função compatível. Conferir permissões e ausência de vínculo antes do aceite. Em M01.04, com destinatário autorizado separadamente, validar o retorno Auth, o aceite real, a Loja/perfil, o recibo/auditoria e o replay com JWT real.

## V35 M01.03 — vínculo e aceite

M01.03 preparada sobre main 625a516a (PR #30). O Auth fornece o UUID ao finalizar o despacho. A RPC de aceite exige esse UUID autenticado, e-mail confirmado, perfil de sistema da própria Loja e, quando exigido, consentimento explícito à versão publicada vigente e ao hash. Vínculo, recibo, conclusão e auditoria são atômicos. Execuções antigas sem prova de identidade permanecem sem vínculo. Três testes locais do handler passaram. Gate PostgreSQL descartável incluído no CI. Ativação DEV aguarda aprovação.

## Estado vigente — M01.02 aplicada e verificada no DEV (09/11/2026)

- **Autorização:** proprietário aprovou aplicação da migration M01.02 e testes **somente** no Supabase DEV `szqkdekwhzxsoxorgvaz`, sem convites/PROD. A aplicação ocorreu após PR #28 e #29 integrados, `main=b39da8b732c583da8fb809e06c23268211180202`.
- **Migration:** `v35_onboarding_invite_reconciliation` aplicada em DEV; versão real Supabase `20261109190747`; arquivo versionado renomeado, **sem alterar SQL**, para `supabase/migrations/20261109190747_v35_onboarding_invite_reconciliation.sql`. Não executar novamente sob versão antiga.
- **Read-back:** três RPCs presentes; `anon` EXECUTE negado e `authenticated` EXECUTE concedido com autorização interna Master/AAL2; SECURITY DEFINER com `search_path` vazio verificado. Antes e depois: **0 jobs, 0 eventos e 0 runs sintéticas** persistidos.
- **Gates DEV:** Master/AAL2 com claims SQL simuladas PASS; Master/AAL1 e não-Master/AAL2 negados nas três RPCs; testes rollback com reservas fictícias PASS (claim stale/fresco, expiração uma vez, tentativas e reserva preservadas, observação idempotente/rejeição de alteração, auditoria sanitizada). Não foi utilizado JWT HTTP real.
- **Limite de escopo:** nenhum e-mail, convite, Auth Admin, retry nem deploy de Edge Function M01.02. A existência de usuário Auth **não comprova entrega**. Sem evidência externa de ausência de efeito, reenvio segue fail-closed; não classificar a M01.02 inteira como CONCLUIDO devido à parte de retry/reconciliação externa.
- **Próxima tarefa de código:** M01.03 — vínculo explícito do usuário, papel mínimo e aceite de termos, reconciliando código atual antes de implementar. M01.04 continua sem autorização para enviar convite de teste; runtime Edge/JWT real não homologado. Fazer Work apenas quando necessário e mediante prompt do usuário.

---

## M01.02 — código integrado, ainda NÃO ativado (09/11/2026)

- PR #28 integrado na `main` em `bf326254fba3e7a66a2f02137fa1e5c6da818461`, checks `static`, `frontend` e `onboarding` PASS na revisão `4474b658`.
- Migration de reconciliação `supabase/migrations/20261109220000_v35_onboarding_invite_reconciliation.sql` **somente versionada no GitHub**: não aplicada no DEV/PROD e não alterou a Edge Function M01.01.
- O código adiciona consulta Master/AAL2, expiração em quarentena e observação idempotente. Expiração preserva tentativas e reservas; **não há retry/reenvio** de resultados desconhecidos. Pendente autorização específica para aplicar no DEV e teste com JWT real, sem envio.
- A M01.02 está `INTEGRADO`, não `CONCLUIDO`/`HOMOLOGADO_DEV`. A retomada deve priorizar revisão do estado real, aplicação autorizada e gate de read-back/negativas, ou avançar para M01.03 sem ativar nada.
- M01.04 (envio de convite de teste com destinatário autorizado) continua bloqueada por aprovação separada. Nenhum convite foi disparado neste ciclo.

---

## Em execução — M01.02, 09/11/2026 (sem ativação)

- **Base:** main `04f99e97521a2841bc2d628277ff791724bc0c93` após PR #27; branch `feat/v35-m0102-invite-reconciliation`. Confirmar commits atuais ao retomar.
- **Escopo desta branch:** migration proposta `20261109220000_v35_onboarding_invite_reconciliation.sql` adicionando RPCs Master/AAL2 para consulta limitada, expiração de claims antigos sem liberar reserva e observação auditável idempotente; ADR-0044 e testes PostgreSQL descartável. Não altera fluxo M01.01 nem sua função implantada.
- **Risco crítico:** `auth.users` não comprova entrega de e-mail nem a ausência de efeito externo. **Nenhum retry automático ou manual foi autorizado/implementado.** Claims `running` vencidos passam a `failed/invite_outcome_unknown` mantendo `attempts=1`; destino continua reservado.
- **Status:** código em revisão, **migration M01.02 não aplicada no DEV**, nenhum deploy, nenhum JWT real e nenhum convite enviado. Revisar CI da branch/PR antes de qualquer merge; autorização específica antes de ativar novas RPCs no DEV.
- **Próximo:** concluir CI + revisão do PR; definir gate de ativação DEV separado e M01.03 (vínculo/papel/termos) sem repetição de testes M01.01. M01.04 somente com autorização de destinatário de teste.

---

## Estado operacional vigente — 09/11/2026: M01.01 ativação técnica DEV

- **Código:** PR #26 integrado à main no commit `b32692dc1b1bd94713c23d0760ff4965001a8ee0`; CI #424 static/frontend/onboarding PASS na revisão `7a7ee9f`. Verificar nova HEAD antes de iniciar outro trabalho.
- **Banco:** migration `v35_onboarding_invite_consumer` **aplicada somente** no Supabase DEV szqkdekwhzxsoxorgvaz, versão de registro `20261109184607`. Três RPCs presentes e grants read-back conferidos: `authorize_onboarding_invite_dispatch` EXECUTE authenticated (sujeito a Master/AAL2), `claim_onboarding_invite` e `finish_onboarding_invite` somente service_role; anon/authenticated sem EXECUTE nas duas funções privilegiadas.
- **Edge Function:** `onboarding-invite` publicada somente no mesmo DEV, ACTIVE v1, `verify_jwt=true`, dois arquivos de código confirmados em leitura independente. Nenhum JWT real foi usado nem convite enviado. Não inferir runtime/SMTP/destinatário verificados a partir de deploy READY.
- **Higiene de migrations:** ferramenta Supabase registrou versão `20261109184607`; arquivo SQL de código renomeado para `supabase/migrations/20261109184607_v35_onboarding_invite_consumer.sql` (conteúdo preservado), evitando nova versão fictícia `20261109000000`. SQL aplicado foi o corpo sem delimitadores externos BEGIN/COMMIT.
- **Próxima execução:** M01.02 pode seguir para desenho/testes de expiração/reconciliação sem envio real. M01.04 precisa autorização **separada** para homologação JWT Master/AAL2 real e um convite com destinatário previamente autorizado, após verificar endpoint/configuração. M01.01 permanece sem aceite end-to-end até esse gate.
- **Restrições:** nenhuma migração ou chamada Auth em PROD; nenhuma senha, JWT, e-mail de convite ou operação de usuário executada. Nenhum job `onboarding_invite` existia no DEV no read-back após migration.

---

# V35 — CURSOR DE RETOMADA (ler primeiro em toda nova conversa)

> **Política aprovada:** terminar integralmente a V35 antes de liberar Beta. Este arquivo é o resumo operacional curto. Histórico antigo permanece em `SESSION_HANDOFF.md`; backlog rastreável em [V35_EXECUTION_BOARD.md](V35_EXECUTION_BOARD.md).

## Snapshot verificável na criação deste controle

- Main verificada por fetch em 09/11/2026: 639ef08a46493ad0b6bc963920f0271959e59253 (PR #25). Branch feat/v35-m01-invite-consumer criada desta revisão com árvore limpa.
- Supabase DEV autorizado: `szqkdekwhzxsoxorgvaz`; Worker DEV `corsys-tronco-digital-dev`.
- Histórico: PRs #15–#24 integrados conforme registros. Não reexecutar homologações por mera mudança de conversa.
- SMTP DEV configurado pelo proprietário (via Supabase Auth/Resend); painel aceitou **um e-mail de recuperação**. Isso **não comprova** recebimento no destino nem envio de convites.
- `MasterOnboarding.tsx` e RPC `provision_saas_onboarding_database`: organização e assinatura criadas, job `onboarding_invite` enfileirado; **consumidor e entrega real ainda não implementados/observados** na evidência existente.

## Posição de execução

- **Macro ativa:** M01 — Onboarding, identidades e convites.
- **Micro ativa:** M01.01 — Revisar contratos reais e implementar consumidor autorizado de `onboarding_invite`, integrando M01.02 apenas se dependência técnica inseparável; documentar limites sem marcar etapa inteira como concluída.
- **Próximo ato técnico:** revisar a M01.01 e executar a M01.02 para expiração e reconciliação. A ativação DEV exige aprovação específica.
- **Bloqueio de ativação:** novas capacidades de acesso/segurança **não** são ativadas sem aprovação específica. Não ler, criar, alterar ou solicitar secrets pelo chat; credenciais permanecem no navegador.
- **Não confundir:** `queued` ≠ convite enviado; aceite do Auth SMTP ≠ entregue na caixa postal; usuário convidado ≠ papel concedido/termos aceitos; CI aprovado ≠ homologação real.

## Startup seguro (sem recapitular todas as conversas)

1. Na cópia local: `git status --short --branch`, `git remote -v`, `git fetch origin`; conciliar trabalho local antes de `git pull --ff-only`. Nunca descartar notas locais ou fazer `reset --hard`.
2. Ler, nesta ordem curta: `AGENTS.md`, este cursor, `docs/V35_EXECUTION_BOARD.md`; consultar `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, `SESSION_HANDOFF.md` e documentos/arquivos do ID ativo apenas na medida necessária.
3. Conferir se outro Work/branch/PR já implementou o ID ativo; não duplicar.
4. Executar apenas a próxima microentrega, testes impactados e registro de resultado; atualizar este cursor com a **revisão real**, estado da CI/DEV, bloqueio e próximo ID antes de encerrar.
5. Ao mudar de conversa, usar: “Continue Corsys.TroncoDigital V35. Leia AGENTS.md e docs/V35_SESSION_CURSOR.md, confirme Git/PR, execute a microentrega ativa indicada em docs/V35_EXECUTION_BOARD.md. Não repita gates aprovados, preserve sources/, segredos e PROD. Atualize cursor/handoff no PR.”

## Registro de execução do cursor

- Criado como documentação de governança em branch, ainda **não** como implementação da microentrega M01.01.
- Última verificação de deploy do PR #24 não é inferida do merge. Próxima execução deve conferir apenas se necessário ao ID ativo.
- M01.01 em revisão: consumidor e migration preparados; 3 testes locais do handler aprovados. Teste PostgreSQL real, ativação e homologação DEV pendentes.

## Evidência M01.01 no PR #26

PR #26, revisão 0278175, CI #423, job onboarding aprovado. PostgreSQL 17 descartável confirmou presença das RPCs antes do ROLLBACK e ausência após ele, com os delimitadores da migration excluídos. O gate usa tabelas, helpers e triggers extraídos das migrations e claims Auth simuladas. Passaram Master/AAL2, negações anon/AAL1/não-Master, RPCs de fila restritas a service_role, concorrência observada entre sessões PostgreSQL, deduplicação, conta existente, replay, ator da reserva na finalização, resultado incerto e auditoria sanitizada. Três testes Node do handler passaram no mesmo job. Runtime Edge, JWT real e envio DEV ficam para o gate de ativação.
