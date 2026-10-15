## Marco vigente — jornadas QA FINANCE A/B — 2026-10-15

A pendência de login/jornada B dos blocos anteriores foi concluída na versão DEV
c7008f47 (commit funcional37879f6). B gerou mensalidade março/2027 R$1, confirmou
prévia sem nova emissão, recebeu/alocou/estornou R$1, cancelou mensalidade e avulsa,
fechou outubro, confirmou rejeição de nova avulsa e reabriu. Batch B
`0bd3365f-daeb-429f-bae5-85c30aa006c7`, pagamento prefixo `84ad3760`.
Despesa/receita B criadas R$1, corrigidas R$0,50/vencimento21/10 e canceladas.
Read-back UI final A e B: origem R$10, destino sem movimentos, cobranças e
obrigações de teste canceladas, pagamento de teste estornado; DRE outubro/2026
e março/2027 com receitas/despesas/resultado R$0. Histórico mantido conforme
aprovação. Não repetir fixtures ou pagamentos. Nenhuma liquidação institucional.
252 testes/tipos/build e CI #286 PASS; npm audit retornou zero vulnerabilidades
em dependências, sem equivaler a garantia de segurança da aplicação.
Read-back administrativo atual NÃO AVALIADO: consulta direta ao DEV negada.
Próxima entrega e critérios: [estorno institucional](V35_INSTITUTIONAL_REVERSAL_PLAN.md).
Ainda não implementada/aplicada; Etapa 2, aprovações ampliadas e 21 telas abertas.

## Aprovação e jornada financeira A — 2026-10-15

Conclusão adicional observada: despesa e receita de R$1 criadas, corrigidas para
R$0,50/vencimento 21/10/2026 e canceladas, ambas zero aberto. Nenhuma liquidação
institucional executada. Outubro/2026 terminou reaberto. Correção do loader:
252 testes em 39 arquivos, tipos/build e preservação PASS; sem nova migration.
Commit funcional `37879f6`, versão isolada `c7008f47-1160-4b23-8d02-a157d27c069a`,
mesmo alias estável v35-finance, sem alterar tráfego principal. HTML/JS/CSS HTTP200
e iguais ao build; JS index-COCphutR.js SHA256
`330dc5a8deb9cc7818cf68a02c879432a5a2165ce051678c730447c8a964c6f9`.
Não inferir aceite integral: jornada B, liquidação/estorno institucional,
aprovações e read-back administrativo atual permanecem pendentes.

Read-back pela UI no build novo COCphutR: despesa/receita canceladas e zero aberto,
sem erro de leitura; ambas cobranças canceladas; Caixa e bancos mostra origem
R$10 e destino sem movimentos. DRE consultada 2026-10 a 2027-03: outubro e março
com receitas/despesas/resultado R$0, incluindo linhas de contas zeradas. Competência
outubro reaberta. Mobile390x844: largura documento/client375, sem overflow global,
menu móvel observado e override restaurado; não é paridade visual integral V35.
CI funcional `38811322401` #286 completed success. Próximo: login B solicitado na
mesma origem para repetir jornada na QA FINANCE B. Não repetir seed nem operações A.

Proprietário aprovou a proposta abaixo, incluindo operações fictícias até R$1.
Fixtures persistidas uma vez: QA FINANCE A `94b84958-4dd9-435d-9a4e-244220835d70`,
QA FINANCE B `7a6aa771-524d-4d5a-9d38-7006175e1cb4`. Não são as QA INTERFACE.
Cada uma tem um integrante, duas contas mapeadas, três categorias, plano próprio
2026–2027, pagamento inicial fictício R$10 e regra mensal R$1. Sem usuário/e-mail
novo ou provedor externo. Aprovação resolveu bloqueio anterior; não pedir de novo.

A: integrante `d5842ad6-913d-4a3e-8250-876fb2e2a215`, regra
`6d9b6897-0f5f-45b8-b82a-88a53cf02577`, origem
`b6116441-5a43-4661-8d5b-1a844c48f6b5`, destino
`6af9f28f-b43d-4a4a-9c14-d6357bfa9c90`.
B: integrante `23bdcd76-b7a2-47b5-9f65-267d4c1053be`, regra
`a7e86c73-df13-4b93-a9ee-403ae35b1321`, origem
`27f1f82c-5487-41f3-b269-7abc692a4bca`, destino
`5f2e0f57-15bf-4cc5-a7ea-1272dd97dbe3`.

Jornada A no Edge/preview a782b50f: regra selecionada, prévia de março/2027 com
um elegível/uma cobrança; atualização e nova prévia utilizáveis, geração confirmada
batch `997f14d1-535f-47c2-8922-d0b88059da3a`; nova prévia mostra zero novas/uma já
gerada e botão de confirmação ausente. Isso não reproduz artificialmente latência;
o caso de resposta obsoleta permanece comprovado pelo teste React, não por throttling.
Recebimento R$1 de 02/03/2027, ID prefixo b598d5dd, alocado na mensalidade;
sem crédito restante e cobrança quitada na consulta. Estorno posterior pela UI:
pagamento Estornado/zero alocado/zero disponível, mensalidade reaberta. Mensalidade
cancelada e avulsa R$1 de outubro criada/cancelada, ambas zero aberto. Fechamento
outubro confirmado; nova avulsa negada pelo servidor; reabertura confirmada.
Sem read-back administrativo novo: integração Supabase perdeu acesso; após duas
reconexões declaradas pelo proprietário, consulta direta ao DEV segue sem permissão.
Evidências atuais desta jornada são da UI real; não declarar auditoria SQL completa.

Revisão do loader institucional reproduziu quatro lacunas em respostas malformadas:
duplicata, divergência de um centavo, cancelado com aberto e status de aprovação
desconhecido. Quatro regressões falharam antes/passaram após correção. Loader agora
confere identidades únicas e saldos em centavos inteiros, além da autorização/RLS
que permanecem no servidor. Casos de recebível e cancelamento parcial válido
adicionais passam. Nenhuma escrita, grant, RPC ou migration alterada por esse ajuste.

## Histórico — Retomada financeira — 2026-10-15

Passo 1 concluído: estado vigente consolidado em V35_VERTICAL_DELIVERIES.md e
referenciado na matriz de paridade. Etapa 2 permanece aberta; estados históricos
abaixo não substituem V35_SIGNED_BROWSER_QA.md.

### Verificado nesta execução

- Baseline: 242 testes em 39 arquivos PASS. Após correção: 243/39 PASS; tipos/build,
  gramática SQL, preservação e 12 guardas locais DEV PASS. Bundle padrão >500 kB
  continua aviso preexistente. Nenhuma migration, grant ou alteração RLS.
- Oito gates SQL existentes executados novamente, todos rollback PASS: geração
  mensal; pagamento/alocação/estorno; cancelamento/fechamento/reabertura; correção
  institucional; cancelamento institucional; decisão de aprovação; ciclo de
  política; lifecycle com estorno/cancelamento nas duas ordens.
- Novo scripts/verify_dev_financial_state_matrix.sql: 60 negações esperadas A/B,
  positivos antes/depois e rollback PASS. Por tenant: cinco comandos de integrante
  em período fechado, fechamento futuro recusado, 12 comandos negados para VIEWER
  e os mesmos 12 negados sob suspensão. Leitura própria preservada, alocação após
  reabertura/restauração confirmada. Claims simuladas, NÃO HTTP/JWT.
- As primeiras tentativas de fixture falharam por competência futura e mapeamento
  inexistente; não contam como PASS. Teste usa categoria 2026 para integrantes,
  categorias 2027 para obrigações e regra futura 2027. Não altera planos publicados.
  Bloqueio de competência institucional e mensal não integra essas 60 negações.
- Read-back após rollback: originais 17 cobranças/16 pagamentos; zero novas Lojas
  financeiras da proposta abaixo.

### Correção de interface reproduzida

MonthlyChargeGeneration: Atualizar regras durante prévia pendente invalidava a
resposta antiga, mas deixava previewPending ativo para sempre. Reset agora libera
os controles e mantém a resposta obsoleta descartada. Novo teste falhou antes,
passou após ajuste, verificando nova prévia utilizável e nenhuma geração automática.
Homologação browser da nova revisão ainda pendente; não confundir teste React com
aceite do preview. Nenhuma regra financeira alterada.

### Próxima validação concreta

Correção publicada em versão DEV `a782b50f-be91-4faa-948d-31010f9b3e66`, commit
`991ae9c`, sem alteração de tráfego. URL fixa
https://a782b50f-corsys-tronco-digital-dev.corsys1.workers.dev/ ; alias estável
https://v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev/ aberto no Edge
na tela de login. Login normal A necessário nessa origem, sem transferir tokens.
HTML/JS/CSS remotos iguais aos arquivos locais (HTTP 200 e comparação byte a byte).
JS index-Dede1ZMg.js SHA256
`a507797616384927dacd922975bfcc4dbaba1c8dde680d5a645323275ee5347e`;
CSS index-o9vIR7UR.css SHA256
`c8a2f3b3c17dbc5a939d391a9b1f7fb1d8218a36b112c7db46860d01e31fa7bf`.
Upload observado não equivale à jornada autenticada homologada.

Não há regra recorrente persistida em A/B. As Lojas QA INTERFACE existentes têm
plano publicado somente patrimonial; não adicionar categorias a plano imutável.
Proposta em scripts/prepare_dev_financial_browser_qa.sql: duas novas Lojas isoladas
DEV QA FINANCE A/B 20261015, com as respectivas identidades DEV existentes, preço
SaaS zero, duas contas, três categorias mapeadas em plano próprio, um integrante,
um pagamento inicial fictício de R$10 e regra mensal de R$1 a partir de março/2027.
Sem novos usuários, e-mails, convites ou provedores externos. Preflight rollback
PASS, persistência rejeitada pela revisão automática: aprovação anterior limitada
às Lojas QA INTERFACE. Nenhum registro dessa proposta gravado. Aguardar aprovação
específica; não contornar. Futuras operações de QA devem ser identificadas,
canceladas/estornadas ao encerrar, com histórico preservado e controles originais.

Pendências: aprovação das fixtures, login no novo preview e jornada integrada
autenticada; recorrências especiais/anuais/institucionais, negociação/parcelamento,
multiaprovadores e requisitos restantes do inventário. Não avançar outro lote
classificando essas pendências como concluídas.

## Histórico — Incremento 29 — diretório SaaS pesquisável e paginado, 2026-10-10

O `MasterConsole` ganhou formulário de busca por cliente/número/cidade/contato, status de assinatura e plano, com aplicação/limpeza explícitas. A RPC nova `search_platform_master_tenants` (#52) executa filtro no PostgreSQL somente para MASTER com MFA/AAL2, sem exportar todos os clientes para o browser nem expor CPF/contatos no resultado. `loadMasterTenants` continua usando a RPC histórica quando os filtros estão vazios, para manter compatibilidade. Gate `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS` cobriu AAL2 válido, negações AAL1/tenant/anon, parâmetros inválidos e paginação, com ROLLBACK. Testes React dos filtros foram adicionados; validar CI de HEAD. Permanece pendente seletor real de planos, navegação direta do Cliente 360° a partir de cada resultado, filtros comerciais adicionais e reprodução fiel da tela V35.

## Incremento 28 — fluxo de caixa diário por competência/datas (2026-10-10)

Migração #51 `read_tenant_daily_cash_flow` introduz uma consulta de até 93 dias sem depender de somas de páginas para realizado (pagamentos efetivos e estornos) e para pendente (receitas e despesas ainda abertas agrupadas pelo vencimento). Exclui transferência interna e abertura de caixa do fluxo operacional, para não confundir movimento contábil com receita. UI `DailyCashFlow` em Financeiro apresenta período, seis resumos e linhas de todos os dias, valida data/identidade de linha e invariantes de soma; falha fechado em resultados parciais ou erros de autorização. Gate `DEV_DAILY_CASH_FLOW_ROLLBACK_PASS` de 30 dias setembro/2026 A/B com duas posições positivas reconciliadas, IDOR e intervalo inválido negados, ROLLBACK. Gráficos e projeção de saldo futuro, filtros e visual paridade do HTML V35, QA browser, HTTP JWT real permanecem pendentes.

## Incremento 27 — arquivo CSV da inadimplência, 2026-10-10

Tela `DelinquencyReport` ganhou `Exportar CSV completo` que percorre até 1.000 posições vencidas via RPC autorizada, sem somar apenas a página visível. Cada página é validada, com bloqueio de membro duplicado e de arquivo parcial se houver falha de leitura, autorização, limite ou troca de tenant. Em `src/lib/delinquency-export.ts`, CSV usa separador `;`, decimais pt-BR, UTF-8 BOM, neutralização de fórmula maliciosa, e não transporta CPF/e-mail/telefone. Testes Vitest em `delinquency-export.test.ts` e componente cobrem uso explícito, duas páginas, limite, cancelamento, injeção e falha de autorização. Trata-se de CSV compatível com Excel, **não** XLSX ou PDF; consistência de snapshot única, downloads reais em mobile e retenção LGPD não homologados. Sem alterações no Supabase, sem deploy.

## Incremento 26 — transferências e estornos no Financeiro, 2026-10-10

Migração #50 adicionou RPCs `register_tenant_account_transfer_idempotent` e `reverse_tenant_account_transfer_idempotent`: fundos movidos apenas entre contas da própria Loja, com validação do saldo disponível, proibição de auto-transferência, motivos, bloqueio de competência fechada, período derivado da data, idempotência e audit trail. Ambas usam estruturas históricas `financial_account_transfers`/`reversals`, cujos movimentos assinados já compõem `v_financial_account_movements`; não reconhecem receita ou despesa adicional. Nova aba `Financeiro > Transferências` apresenta contas ativas, transferências paginadas e estorno com confirmação e reenvio da mesma chave. Frontend com testes Vitest.

**Limites de homologação:** SQL gate `DEV_TRANSFER_GUARDS_ROLLBACK_PASS` (self-transfer, conta estrangeira, estorno desconhecido e anon) executado, todos negativos PASS e ROLLBACK. Criação de organização fictícia nova para cobrir fluxo positivo foi bloqueada pelo executor; não houve tentativa de bypass. Cada Loja de teste possui apenas uma conta ativa; preciso configurar segunda conta e classificação patrimonial válida por plano para ensaio positivo legítimo. Portanto ciclo positivo, reconciliação do saldo transferido/estornado no banco e segurança concorrente permanecem NOT EVALUATED. CI do HEAD verificar. Etapa 2 ainda não fechada.

## Incremento 25 — oferta Master sucessora com história preservada, 2026-10-10

A migração #49 `20261010211529_master_promotion_successor_idempotent` adiciona criação segura de draft sucessor para uma série de promoção publicada. O comando exige papel MASTER e MFA, idempotência de chave/payload e lock da série; a origem precisa ser a versão mais recente publicada e a nova janela precisa começar após a origem. Interface `MasterPromotions` suporta modalidade “Nova série” ou “Nova versão”, sem UPDATE in-place. Publicação posterior continua separada e encerra versão histórica na fronteira. SQL `scripts/verify_dev_master_promotion_successor.sql` passou com ROLLBACK: novo draft e publicação, fronteira encerrada, stale/colisão negados. Vitest da nova UI adicionado; confirmar CI final antes de declarar frontend aprovado. Sem resgates ou mudanças de contratos existentes.

## Incremento 24 — regras de aprovação por vigência, 2026-10-10

Implementado `ApprovalPolicies` no Financeiro para criar rascunhos com modo `off`, `all` ou `threshold`, limite monetário (somente threshold), número mínimo de aprovadores 1–10, início/fim e justificativa. Publicação requer confirmação textual e RPC `publish_tenant_approval_policy_idempotent`. Migração #48 também cria `create_tenant_approval_policy_draft`; ambas com `approvals.manage`, auditadas/idempotentes. Backend preexistente continua fonte da policy em vigor e das decisões já tomadas. Gate `DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS` executado com SQL A/B e rollback, incluindo rejeição de overlap entre versões publicadas. Testes React de criação/publicação, retry e isolamento adicionados; CI do HEAD verificar. Fluxos complexos de multiaprovador, revisão de policy, autoaprovação e administração de cargos ainda não homologados.

## Incremento 23 — oferta promocional Master, 2026-10-10

Migração #47 adiciona criação/publish idempotentes de `saas_promotions` por MASTER com MFA; registra auditoria, preserva versões e impede payload divergente em mesma chave. `MasterPromotions` integra `MasterCommercialCatalog`, com rascunho detalhado (benefício %, valor fixo, trial, duração uma vez/ciclos/período, elegibilidade, limites, combine e vigência) e publicação após confirmação textual. SQL `DEV_MASTER_PROMOTION_ROLLBACK_PASS` em Master AAL2, bloqueio de AAL1/tenant, replay e publicação com ROLLBACK. Nenhum benefício foi aplicado, e o sistema não cria automaticamente faturas, assinaturas ou resgates. Rascunho sucessor, ajustes em drafts, desativação, atribuição e validação real de resgate são pendências da paridade V35.

## Incremento 22 — endurecimento do replay de onboarding, 2026-10-10

Novo wrapper `create_master_onboarding_draft_idempotent` migration DEV #46 resolve risco de reutilização da mesma chave para rascunho comercial diferente. Entrada de parâmetros em JSONB é normalizada/validada pelo PostgreSQL e serializada por chave; registro existente é comparado campo a campo (nome, número, contato, convite, slug, plano, preço, datas, UF, cidade, papel ADMIN). Reenvio do mesmo payload retorna o mesmo UUID sem registrar segundo evento, enquanto mudança é rejeitada com `22023`. UI Master agora consome o wrapper. Teste SQL com `ROLLBACK` `DEV_MASTER_ONBOARDING_STRICT_REPLAY_ROLLBACK_PASS`, dois papéis negativos, uma linha/um evento positivos. A RPC anterior permanece por compatibilidade e precisa ser deprecada/restrita antes de produção.

## Incremento 21 — Master onboarding e Cliente 360°, 2026-10-10

Interfaces Master acrescentadas em `MasterConsole`: `MasterOnboarding` cria rascunho de implantação usando RPC preexistente `save_saas_onboarding_draft` (MASTER/AAL2). O rascunho contém dados de cadastro e plano publicado com vigência e preço; mudança de estado de implantação tem ação separada com confirmação digitada `PROVISIONAR`, que invoca `provision_saas_onboarding_database` do pacote V35. O PostgreSQL cria organização, assinatura e evento/job de convite sob a transação; este job **não constitui entrega de e-mail** e serviços externos permanecem fora da validação.

Gate SQL com ROLLBACK `scripts/verify_dev_master_onboarding_draft.sql` passou: salvamento/replay, recusa AAL1 e usuário tenant, sem criar loja/job. `scripts/verify_dev_master_onboarding_provision.sql` passou após corrigir a fixture que somava linhas com RLS ativa: exatamente uma Loja, assinatura e job por run, retry retorna a mesma organização; todos revertidos. Plano inicial role `ADMIN`, não `owner`, por constraint efetiva do schema.

Nova RPC `read_master_client_360` migration #45 para visão comercial e operacional por cliente sem impersonação: status da Loja, contrato/assinatura, faturas SaaS total/em aberto/vencido e chamados do próprio cliente. Gate `DEV_MASTER_CLIENT_360_ROLLBACK_PASS` AAL2 positivo, AAL1/tenant/anon negados, reconciliação com `v_saas_invoice_balances`. UI `MasterClient360` tem seleção explícita e dados validados para uma Loja; não expõe dados pessoais de integrantes. Migration #44 de plano draft/publicação, já aplicada no incremento anterior, agora versionada no runtime manifest com SHA.

**Ainda pendente da Etapa 2:** edição de onboarding, envio/aceite real de convite, trilha status, recursos do plano e consentimento final, Cliente 360 completo, contratos e cobrança SaaS operational, renovações, negociações, métricas, conciliação, transferências, eventos especiais e anuais, paridade integral 21 telas HTML V35, browser QA/multitenant HTTP JWT, concorrência e release security. Não confundir tela existente com cobertura aceita.

## Incremento 20 — Operação Master: chamados e respostas (2026-10-10)
`MasterSupportQueue` mostra chamados e métricas com view existente `security_invoker`, mensagens RLS e separação explícita tenant/internal. A aba `Operação e suporte` está integrada ao `MasterConsole`. Migration #43 `master_tenant_support_idempotent_reply` adicionou RPC para resposta MASTER (AAL2) somente em tickets de cliente, com atualização de status e replay seguro, delegando a `reply_saas_support_ticket` auditada. Testes SQL AAL2 e RLS duas Lojas, todos com ROLLBACK, passaram; testes React (incluindo cancelamento de rede e proibição de responder interno) e CI 162/162 PASS commit `cb6fe527`. **Não** implementa ainda notas internas, atribuição, Kanban completo, auditoria de suporte/read_only temporário, nem Cliente 360 e onboarding. Assinatura e billing SaaS inalterados.

## Incrementos 15–19 — núcleo financeiro e Master read-only (2026-10-09/10)

1. **Geração mensal:** migration DEV #36, prévia com fingerprint/quantidade/isentos/duplicados e confirmação atômica por integrante e competência; valida preços históricos, isenções e overrides, limite de 200, mapeamento contábil e período; lote e cobranças imutáveis. `DEV_MONTHLY_GENERATION_ROLLBACK_PASS` (duas Lojas, dois emitidos e um isento em cada, fevereiro dia 31 -> 28). UI em Financeiro > Gerar mensalidades.
2. **Cobrança avulsa e competência:** migration #37 wrappers idempotentes para `cancel_charge`, `close_financial_period`, `reopen_financial_period`; telas Financeiro > Cobranças avulsas/Fechamento mensal. SQL `DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS`. Escopo: não cancela ledger original in-place e não reabre sem evento.
3. **KPIs, caixa/bancos, inadimplência e orçamento:** migrations #38/39. 6 indicadores financeiros sem soma de páginas, relatório atrasos por integrante paginado e separação de crédito disponível. Caixa/bancos lê saldos e movimentos assinados das views do banco; orçamento lê `v_accounting_budget_vs_actual` e `v_fund_budget_vs_actual`, não mostra dados de execução se orçamento não existe. Gates `DEV_FINANCIAL_DASHBOARD_ROLLBACK_PASS`, `DEV_DELINQUENCY_REPORT_ROLLBACK_PASS`, `DEV_TREASURY_READ_RLS_ROLLBACK_PASS`. Cuidado: o ciclo de orçamento DEV está vazio; teste visual SQL orçamento com dados reais **não realizado**.
4. **Obrigações institucionais:** migrations #40/41 para cancelamento e correção idempotentes, com validação otimista de snapshot JSONB para impedir sobrescrita concorrente `40001`. Frontend `InstitutionalOperations` acrescenta cancelar saldo restante e corrigir descrição, categoria, fundo, competência, vencimento e valor dentro das regras do banco. Correção reutiliza RPCs legadas, snapshot contábil, aprovações e auditoria. Gates `DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS`, `DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS` A/B.
5. **Master SaaS inicial:** migration #42 `read_platform_master_overview` e `list_platform_master_tenants` exigir papel MASTER+AAL2. Área própria no AppShell, mostra indicadores da plataforma, Lojas e histórico de planos e ofertas a partir das views existentes (somente leitura). SQL `DEV_MASTER_READONLY_AAL2_ROLLBACK_PASS`, validado AAL1 negado, tenant AAL2 negado, MASTER AAL2 aceito e anon negado. Não representa paridade de 6 telas Master nem do Cliente 360º.

**Atenção para aceite:** todos os SQL gates citados foram executados com claims simuladas e rollback, não JWT HTTP. CI frontend pré-Master 141 testes PASS commit `5c21457f`; confirmar nova CI do HEAD. Stage 2 NÃO encerrada: integrações SaaS/relatórios/exportação/mensageria/negociação/ágepes/mútuas/recorrência especial, 21 telas detalhadas, validação mobile e segurança real pendentes.

## Incremento 14 — fila e decisões de aprovações institucionais, 2026-10-09

A base já tinha `payable_approval_requests`, `payable_approval_decisions`, view `v_payable_approval_state`, permissão `approvals.review` e a RPC `decide_payable_approval`. A migration DEV `20261009181235_payable_approval_idempotent_decisions` introduziu `decide_payable_approval_idempotent` para preservar a mesma chave/payload em retries após falhas de rede, sem permitir voto duplicado. Frontend `PayableApprovals`, acessível no Financeiro, mostra solicitações pendentes, exige confirmação de aprovar/rejeitar e motivo, sem efeito de pagamento. Seu read model vem da view agregada do PostgreSQL; erro, tenant divergente ou fila acima de 150 itens causam falha fechada.

`scripts/verify_dev_payable_approvals.sql` executado A/B em SQL com `ROLLBACK`: obrigação temporária, request, voto aprovado único e retry idempotente; sem mutação persistida. Testes React cobrem aprovação, retry, bloqueio tenant e cargo não autorizado; confirmar CI final.

O frontend Master de políticas de aprovação, múltiplos níveis, autoaprovação, filtros/status, timeline/ histórico, lista paginada e homologação HTTP/JWT real permanecem pendentes.

## Incremento 13 — operações institucionais de contas a pagar/receber, 2026-10-09

A base já continha comandos de cadastro `create_institutional_payable`/`create_institutional_receivable` e de liquidação `register_institutional_payable_payment`/`register_institutional_receipt`, todos com permissão `institutional.manage`, chave idempotente e auditoria. **Nenhuma nova tabela ou migration foi necessária.**

Implementado o painel `InstitutionalOperations.tsx`, acessível em Financeiro > Operações institucionais, com cadastro autorizado de despesa/receita, seleção de categorias ativas do domínio adequado, fundo opcional, competência/emissão/vencimento, valor centesimal e geração de obrigação contábil separada de caixa. Consultas a `v_institutional_payable_effective`/`v_institutional_receivable_effective` verificam `organization_id`, `integrity_ok`, status de cancelamento e saldo em aberto; limite de 150 registros por tipo é fail-closed para não apresentar totais incompletos.

Formulário de liquidação permite somente obrigações com saldo aberto: contas a pagar exigem `approval_status` de `approved` ou `not_required`. Método de pagamento e conta financeira devem estar ativos na Loja. Montante de liquidação pode ser parcial, mas não exceder o saldo consultado; validação final permanece no PostgreSQL. Retentativa por resultado de transporte incerto preserva chave/payload; nenhum crédito de membro é interpretado como receita institucional. A fila e decisões de aprovação, correções e cancelamentos institucionais permanecem pendentes.

Testes React `InstitutionalOperations.test.tsx` abrangem criação distinta de despesas/receitas, liquidação aprovada e parcial, bloqueio de pendência de aprovação, excesso de valor, retry idempotente, tenant cruzado e integridade. SQL A/B com `ROLLBACK` `scripts/verify_dev_institutional_lifecycle.sql` retornou `DEV_INSTITUTIONAL_LIFECYCLE_ROLLBACK_PASS`: create/replay, liquidação condicional segundo aprovação e saldo efetivo. A verificação preexistente `verify_dev_institutional_foreign_id.sql` também passou. `verify_dev_financial_lifecycle.sql` passou. O script `verify_dev_financial_commands.sql` **não foi executado até o fim** porque a fixture histórica não corresponde mais à configuração do DEV (`Fixture changed; inspect before running`); não classificar como regressão verificada nem como PASS. CI frontend inicial após correção de tipagem teve 101 testes PASS; confirmar SHA consolidado. Nenhuma alteração em PROD ou em fatos persistidos.

## Incremento 12 — pagamentos de integrantes e DRE por competência (2026-10-09)

Reutilizamos o backend V35 preexistente em vez de calcular saldos ou criar pagamentos apenas no navegador. `register_payment` e `allocate_payment_to_charge` já eram RPCs auditadas/idempotentes e geram eventos de pagamento e alocação com autorização, mesmo integrante/Loja, proteção de montantes e competências. Nova migration DEV #33 `20261009174649_member_payment_reversal_idempotent`: `reverse_member_payment_idempotent` delega à `reverse_payment` existente após validar `payments.reverse`, competência, razão e chave de idempotência, evitando replay ambíguo e preservando estornos de alocações.

UI no Financeiro: `MemberPayments.tsx` e `member-payments.ts`, com seleção de integrante da Loja, formas/contas financeiras ativas, registro de pagamento com competência, alocação manual contra cobrança ainda em aberto e estorno com motivo. O extrato usa `v_charge_balances`/`v_payment_balances` e valida `integrity_ok`, tenant/member scope, crédito disponível e valores centesimais. Não soma listagens parciais como saldo global; listagem com limite de 150 fatos por integrante bloqueia se houver mais que o limite. Reenvio após erro de transporte mantém payload e chave de idempotência; em recusa determinística, nenhuma retentativa automática.

Nova migration DEV #34 `20261009175437_tenant_dre_monthly_report` adiciona `read_tenant_dre`, somente leitura, `reports.read`, com competência inicial/final limitada a até 12 meses, agrupando `v_dre_entries` por competência, conta contábil/histórico e natureza. A DRE não mistura recebimento de caixa nem extrapola fatos não contabilizados. `DreReport.tsx` apresenta receitas, custos/despesas, resultado por competência e detalhamento por conta; 1500 linhas no frontend é limite de segurança, com falha fechada para consulta incompleta. **Ainda faltam** orçamento×realizado, neutral/repasse, comparativos detalhados e paridade visual total.

`scripts/verify_dev_member_payment_operations.sql` retornou `DEV_MEMBER_PAYMENT_OPERATIONS_ROLLBACK_PASS` nas duas Lojas, exercitando pagamento, alocação, estorno automático de alocação, replay idempotente e proteção contra duplicidade; nenhum fato novo persistido. `scripts/verify_dev_dre_report.sql` retornou `DEV_DRE_REPORT_ROLLBACK_PASS` nas duas Lojas e conciliou as agregações com a view original. Testes componentes React para as duas telas adicionados; CI precisa comprovar o HEAD consolidado. **HTTP/JWT real, sessões concorrentes independentes, UX/mobile e todos os fluxos financeiros da V35 ainda não avaliados.** Nenhum merge/deploy em produção.

## Incremento 11 — publicações concorrentes por Loja e cadastros pós-publicação, 2026-10-09

Antes: `publish_validated_accounting_plan` fazia `LOCK TABLE ... SHARE` em cinco tabelas globais. Isso podia bloquear gravações de todas as Lojas e gerar inversão de locks com `set_draft_accounting_mapping` (que adquiria lock do plano antes da organização).

Migration DEV `20261009165809_tenant_scoped_accounting_publication_guard` acrescenta um trigger `BEFORE` por cada uma das seis tabelas que participam da prontidão e publicação contábil. Todos os escritores obtêm `FOR UPDATE` da linha `organizations` correspondente, de forma compatível com a transação de publicação, que já obtém essa mesma linha; o `SHARE LOCK` global foi retirado. `set_draft_accounting_mapping` trava a organização antes do plano. Regras de status dos planos publicados permanecem imutáveis.

Segurança funcional após publicação: categorias só podem surgir ativas ou passar a ativas se estiverem mapeadas em todos os planos publicados com vigência até ou após a competência atual. Mudanças de domínio em categorias ativas também são verificadas. Contas de caixa/banco exigem conta contábil analítica patrimonial compatível nos mesmos planos. Novas contas financeiras são criadas **inativas**; categorias também são incentivadas a iniciar inativas pela UI. Auditoria do cadastro bancário reflete o status real. A ativação exige plano sucessor; não há alteração retroativa de planos publicados ou de fatos financeiros. O frontend trata erro `23514` como rejeição determinada (não retry ambíguo).

Testes executados A/B no Supabase DEV com transações revertidas: `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS`, `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS`, `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS`, `DEV_TREASURY_CATALOG_ROLLBACK_PASS`, `DEV_TENANT_ACCOUNTING_GUARD_ROLLBACK_PASS`. As 6 estruturas de trigger e ausência de lock global foram inspecionadas via catálogo PostgreSQL. **Concorrência controlada entre sessões distintas NOT EVALUATED:** tentativa de execução paralela pelo conector não conseguiu comprovar espera da mesma Loja e possivelmente serializou queries; detalhado no plano de teste. Não expor como PASS. CI e visual conferir por commit.

## Incremento 10 — publicação contábil atômica e auditada, 2026-10-09

Nova migration aplicada no Supabase DEV `20261009162535_validated_accounting_plan_publication` (#31) com `accounting.manage`, idempotência, bloqueios de escrita de catálogos e mapeamentos, validação da data esperada e nova prévia no servidor; reutiliza `publish_accounting_plan` como etapa interna. Endpoint antigo com EXECUTE autenticado revogado. Plano publicado fica imutável por triggers/constraints existentes; sobreposição temporal protegida por EXCLUDE. UI `AccountingPrepublication` libera publicação com confirmação explícita e motivo apenas após diagnóstico prévio; reenvio em erro de transporte mantém chave e payload. Transações de teste SQL A/B com `ROLLBACK` passaram, sem modificação persistida em cobranças/pagamentos ou planos publicados. Risco: locks SHARE abrangem todas as Lojas enquanto a transação roda; concorrência real, JWT HTTP, revisão visual/mobile e catálogo pós-publicação ainda pendentes.

## Incremento 9 — Pré-validação contábil sem publicação, 2026-10-09

Foi aplicada no Supabase DEV a migration `20261009041818_accounting_plan_prepublication_preview`. A nova RPC `preview_accounting_plan_publication(organization_id,plan_id)` é diagnóstico **somente leitura** e exige `accounting.manage` (incluindo assinatura elegível), com `anon` sem EXECUTE, validação da Loja e do plano. Não modifica nenhum plano, mapeamento, conta, charge ou payment. O relatório JSON traz `ready`, lista de razões `issues` e contagens para: status draft, início futuro, sobreposição com published, estrutura vazia, analíticas ativas, hierarquia inválida, ciclos contábeis, categorias ativas sem mapeamento, contas bancárias/caixa ativas sem mapeamento e mapeamentos que passaram a apontar para conta inativa/natureza incorreta. Verificação instantânea **não garante** que os dados permanecerão válidos até a publicação.

UI de Plano de Contas: componente `AccountingPrepublication`, botão “Verificar condições de publicação”, mensagens em português e contagens de pendências. Limites de escopo e de resposta são verificados no cliente apenas como defesa adicional, jamais como autorização. Sessão de verificação é descartada ao trocar de plano ou após configuração alterada; falha/resultado desconhecido não indica aprovação. **Não há botão de publicação neste incremento.** Uma futura RPC transacional deverá repetir todos os critérios com lock e idempotência imediatamente antes de publicar. O comando legado `publish_accounting_plan` continua existindo no banco e já checa vínculos ativos e sobreposição; não foi alterado nem invocado pela interface desta entrega.

`scripts/verify_dev_accounting_prepublication.sql` retornou `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS` em A/B: rascunho 91 contas sem vínculos foi negado, preenchimento válido de todas as categorias e contas financeiras ficou pronto, inativação de alvo e ciclo pai/filho detectados, estrutura vazia e sobreposição publicada rejeitadas, outros tenant/usuário e TREASURER/VIEWER/assinatura suspensa negados, anon sem EXECUTE. Fixture de teste e alterações de roles/assinaturas foram totalmente revertidos. Estado anterior confirmado: 6 planos, 14 contas próprias, 91 contas-modelo, 17 charges e 16 payments. SQL com claims simuladas não é HTTP/JWT real nem corrida simultânea entre sessões; visual/mobile V35 e publicação real não foram homologados.

## Incremento 8 — Plano de Contas V35: rascunhos e vínculos, 2026-10-08 Brasil / 2026-10-09 UTC

Inspeção DEV: uma estrutura padrão `corsys_complete_br` com 91 contas-modelo e 86 vínculos hierárquicos; tabelas `accounting_plans`/`accounting_accounts`/`financial_category_account_mappings`/`financial_account_accounting_mappings` já existentes, com 6 planos de teste e 14 contas reais. ADR canônico `docs/adr/v35/0016-accounting-plans-effective-dating.md`: publicado é imutável e válido somente entre primeiro/último dia de competência mensal. O sistema existente já possuía `create_accounting_plan` (template, cópia de plano, blank) e `publish_accounting_plan`, com bloqueio de sobreposição/ausência de mapeamentos; **não duplicamos esse esquema**.

Nova migration DEV `20261009014331_tenant_accounting_drafts_and_mappings`: RPC `create_tenant_accounting_draft` reutiliza o constructor existente, mas exige `accounting.manage`, início em mês futuro, autorização RLS/tenant, idempotência server-side e motivo auditado. RPC `set_draft_accounting_mapping` vincula categoria ou conta de caixa/banco a conta analítica ativa em draft próprio, restringe nature `revenue`/ `cost|expense|financial_result` / `patrimonial`, lock no plano, comparação explícita de conta esperada para evitar lost update, idempotência/audit. Backends existentes continuam protegendo planos publicados e validando FK/compatibilidade. Sem grants nas tabelas nem alterações de RLS, cobranças, pagamentos ou plano publicado.

UI `AccountingPlans` integrada em `FinancialStructure`: lista de planos próprios (publicado apenas leitura), criação de draft com template real/duplicata/blank, vigências mensais, leitura das contas e configuração de vínculos compatíveis por tipo/domínio. Falha de transporte preserva mesmo payload/chave; conflito `40001` exige atualização. Não oferece publicação automática e deixa pendente validação de cobertura antes de expor publicação. Limites UI 100 planos, 200 categorias/contas e 300 contas/vínculos por plano, sem paginação total (risco de catálogos maiores).

`scripts/verify_dev_accounting_draft_mappings.sql` executado no Supabase DEV e retornou `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS`: ADMIN A/B, idempotência de plano/mapeamento, 91 contas e 86 pais, duplicação de contas e vínculos, segunda alteração condicionada, rejeição de stale/natureza errada/FK cruzada/roles sem permissão/suspensão, escrita direta negada, plano published rejeitado, anon sem EXECUTE e invariantes charges/payments intactas. Todas as alterações de teste foram revertidas. Claims simuladas SQL não comprovam sessão JWT por HTTP, corrida de múltiplas conexões, revisão visual/mobile ou paridade integral com os 21 painéis V35. Frontend/CI conferir na revisão final.

## Incremento 7 — Identidade institucional da Loja, 2026-10-08 Brasil / 2026-10-09 UTC

A tabela existente `organization_settings` passa a ter comando exclusivo `save_tenant_identity` com `settings.manage`/bloqueio de assinatura, idempotência, escopo por Loja, lock na organização para inicialização concorrente, atualização apenas de telefone, e-mail, chave PIX, endereço, CEP, cidade, UF e país. Exige `expected_updated_at` em edições e rejeita revisões antigas. Não altera logo, textos de relatório, timezone ou outras configurações. Auditoria registra campos e motivo, sem gravar dados privados/PIX. UI em `TenantIdentity.tsx` com formulário vinculado e retry seguro, conectada ao Plano de Contas. Nenhuma operação monetária decorre do armazenamento da chave PIX.

Migrations DEV `20261009012944_tenant_identity_commands` e `20261009013042_tenant_settings_monotonic_version`, incluídas no manifesto com hashes. A segunda migração corrige especificamente o trigger `organization_settings_set_updated_at`, cujo helper compartilhado usava `now()` (timestamp fixo dentro da transação), tornando conflitos indistinguíveis. Novo trigger exclusivo usa `greatest(clock_timestamp(),old.updated_at + interval '1 microsecond')`. Outras tabelas preservadas.

`scripts/verify_dev_tenant_identity.sql` passou em A/B com transação `ROLLBACK`: primeira gravação/retry, update/versionamento monotônico, stale, cadastro repetido, e-mail inválido, auditoria sem chave PIX, INSERT/UPDATE direto negado, TREASURER/VIEWER/suspensão negados e charges preservadas. Claims SQL simuladas não provam HTTP/JWT real, corrida simultânea de conexões independentes ou revisão visual desktop/mobile. Esses gates e a paridade integral V35 permanecem pendentes.

## Incremento 6 — catálogos de tesouraria, 2026-10-08 Brasil / 2026-10-09 UTC

Implementados cadastro, leitura, ativação e desativação de contas financeiras, fundos e formas de pagamento no módulo Plano de Contas. Duas RPCs servidor `create_treasury_catalog_item` e `set_treasury_catalog_status` exigem `settings.manage` e assinatura elegível, validam tipo/parametrização, têm idempotência, auditoria, lock e rejeição de duplicata de nome normalizado. Alterar status usa pré-condição `expected_active`, com erro `40001` para concorrência e atualização obrigatória; não há exclusão de linha nem lançamento de caixa/ledger. Leitura cliente segue grants SELECT/RLS existentes e verifica organização explicitamente. Formulários mostram falhas e permitem retry idempotente de resposta ambígua.

Migrations DEV `20261009011416_tenant_treasury_catalog_commands` e correção aditiva `20261009011533_treasury_catalog_scope_error_fix`, ambas no manifesto com SHA. A segunda corrige retorno de item inexistente sob SQL dinâmico (`EXECUTE INTO` não altera `FOUND`) e preserva segurança fail-closed. Nenhuma alteração de tabela/RLS/grants de tabela, fatos financeiros ou produção.

`scripts/verify_dev_treasury_catalog.sql` executado com `DEV_TREASURY_CATALOG_ROLLBACK_PASS` nas duas Lojas A/B: criar conta/fundo/meio, payload/retry idempotente, nomes duplicados, campos não permitidos, status/reativação/staleness, auditoria, IDs e leituras cruzadas negados, TREASURER/VIEWER/assinatura suspensa negados, anon sem EXECUTE, escrita direta negada e charges/payments preservados. Todos os fixtures foram revertidos. Claims SQL simuladas não equivalem a sessão HTTP/JWT real, concorrência simultânea ou aprovação de telas V35. Catálogo de fundo vazio no DEV permanece vazio até cadastro autorizado.

**Paridade parcial:** contas/fundos/formas do `view-plano-contas`; pendem vínculos contábeis, status em operações posteriores, saldos, caixa/bancos, conciliação, meios adicionais do piloto, 91 códigos, parâmetros da Loja e testes visual/mobile.

## Incremento 5 — sucessão/encerramento de termos futuros, 2026-10-08

Implementado o comando `transition_member_term`: ADMIN/`settings.manage`; usa idempotência, validação de escopo, lock de integrante e linha, auditoria, requisito de competência futura e encerramento inclusivo na competência anterior. Escolha de término sem sucessor retorna ao valor da regra geral; sucessor pode ser `standard`, `exempt` ou `override_amount`. O tipo/valor do termo anterior, cobrança e pagamento já registrados permanecem intactos. Não substitui geração de cobranças.

Schema aplicado somente no Supabase DEV, migração `20261008211155_member_term_transition`; fonte e sha256 versionados no manifesto. UI `MemberConfiguration` acrescenta a substituição/encerramento de termo sem fim, seleção da competência, valor/isenção, motivo e botão de atualização após conflito. O formulário usa o retry idempotente e a autorização do banco; `40001` é conflito definitivo, não resultado ambíguo.

Testes SQL reais com `ROLLBACK` executados no DEV para organizações A/B: cenário positivo, retry idempotente, vigência/sucessor, fechamento puro, valores inválidos (NaN, Infinity, precisão, overflow), período inválido, referência cruzada, `40001`, auditoria, cargos TREASURER/VIEWER e assinatura suspensa negados, anon sem EXECUTE e contagens de charges/payments preservadas: `DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS`. Script versionado em `scripts/verify_dev_member_term_transition.sql`. SQL com claims AAL1 simuladas não equivale a HTTP/JWT real ou corrida simultânea; novo frontend/CI, preview e paridade integral requerem homologação separada.

Próximo: contas/fundos/meios, parâmetros da Loja, plano/mapeamentos, regras especiais e operações financeiras, sem perder o escopo do HTML V35.

# V35 — etapa 2: integrantes, parâmetros e estrutura financeira

## Incremento 4 — categorias e regras mensais, 2026-10-08

Implementados cadastro de categoria (nome, descrição, domínio, ativa/inativa, recorrência de integrante e parcelamento), regra mensal (descrição, categoria elegível, valor positivo, competência inicial futura, dia1..31) e preço sucessor futuro. Integração na área Plano de Contas/Categorias e Regras, layout comum por Loja. Não homologar o Plano de Contas completo.

RPCs settings.manage: IDs próprios, allow_recurrence/active/member_receivable obrigatórios para regra, idempotência, auditoria, rejeição de nomes duplicados, preços finitos de2casas até999999999999.99. Reajuste serializa pela regra, exige UUID da última versão (stale40001), encerra período anterior no mês antes do sucessor e acrescenta preço. Valor original preservado; charges/payments não recebem UPDATE/INSERT. Alteração futura não muda cobranças postadas.

UI consulta até200categorias/regras/preços; preços limitados aos IDs de regras próprias. Erro/empty/retry explícitos, resposta ambígua mantém envio e bloqueia campos, conflito requer atualização. Última versão exibida pode ser uma programação futura. Limite200não é paginação completa; se amostra não inclui última versão, backend nega versão obsoleta. Históricos/cargas maiores exigem paginação.

Verificação: DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS antes/depois migration20261008203643; positivosA/B categoria/regra/preço, retrymesmoUUID/semduplo audit, payload alterado22023, duplicado23505, futuro/precisão/NaN/Infinity22023, IDs estrangeiros23503, staleness40001, leitura cruzada oculta, escrita direta negada, TREASURER e assinatura suspensa3RPCs42501, anon semEXECUTE, termo isento em nova regra positivo; counts charges/payments preservados. Claims SQL simuladas, NÃO HTTP/JWT real ou corrida simultânea. TudoROLLBACK;8categorias originais, regras/preços/termos0, ADMIN A/B/assinaturasactive/flagsallow_recurrencefalse conferidos.
Typecheck,45testes frontend e build PASS, sem auth/deploy com placeholder. CI registrar no PR após push. Advisors43/3/1, sem nova política/grant de tabela. Changelog/documentação oficial consultados; PostgreSQL17.11 e nenhum índice público gistfloat/ltree encontrado na inspeção restrita relevante. Não é auditoria integral das alterações da plataforma.

Paridade parcial obrigatória: DYN-008 natureza neutra/repasse e vínculo contábil DRE ainda pendentes; domínio operacional não substitui natureza contábil. DYN-009 mensal implementado, regras especiais/anuais/institucionais, edição/ativação e geração/prévia ainda pendentes. Flags de parcelamento configuradas não homologam a jornada de parcelamento. Não concluir etapa2 nem perder mútuas710–721/722–745, GLP, ágapes, joia e demais regras documentadas. Reajuste não executa cobrança/Stripe.

Recuperação: forward-fix; se falha operacional, revogar EXECUTE das três RPCs e manter leituras/histórico. Sem reset/drop/backfill/produção. Migração23 no manifesto com hash alinhado. Próximo: sucessão de termos individuais e catálogos/estrutura contábil restantes.


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
Grau/cargo textual não substitui catálogo/cargo vigente. Termos futuros e cargos com vigência implementados no incremento seguinte; regras/preços, sucessão de termos, criação de login, CPF, vínculos e paridade integral continuam pendentes; não concluir etapa2.

Migration gerada pela CLI2.119.0 e aplicada no DEV com versão20261008195936; fonte/hash no manifesto. Recuperação: forward-fix aditivo; se houver falha operacional, revogar EXECUTE da novaRPC e manter leituras/dados, sem apagar integrantes/ledger. Não aplicada produção.
DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS antes e depois da aplicação: positivosA/B, retry, payload divergente, mass-assignment/date/name inválidos, estrangeiros, escrita direta, stale, VIEWER, suspensão e Master sem papeltenant. Claims simuladas/SQL, NÃO HTTP/JWT real novo. Zero integrantes temporários remanescentes; A/B ADMIN e assinaturasactive conferidos.
npm run check PASS: typecheck,36 testes frontend, build com chaveplaceholder; build não prova login/deploy. HTTP real novo, concorrência simultânea e homologação visual pendentes. CI do incremento de consulta880cc5a/run37834705645success; novaCI conferir após push.

Advisors pós-DDL:38 RPCs definer autenticadas (37 existentes + novaRPC intencional com require_permission),3 tabelas backend RLS sem policies e aviso preexistente de proteção contra senhas vazadas. Não declarar scanner zero nem modificar grants/RLS backend para remover avisos:
- [RPC autenticada definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabelas backend sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


Estado: EM EXECUÇÃO. Etapa 1 encerrada conforme V35_STAGE_1_CLOSURE_REPORT.md.
Fonte obrigatória: V35_PILOT_V35_INVENTORY.md, HTML V35, ADRs e matrizes de cobertura. Não reduzir campos/regras ao que já existe no banco.

## Conciliação inicial — 2026-10-08

| Área obrigatória | Fonte atual observada | Lacuna/entrega |
|---|---|---|
| Busca de integrantes e situação cadastral | view-integrantes-F001/F003; members tem active/away/inactive/disconnected | Implementados busca por nome/preferencial/telefone/WhatsApp/e-mail, filtro, reset e contagem da amostra |
| Ficha cadastral | members possui nomes, degree_or_office, contatos, iniciação/admissão e notes | Consulta implementada dos campos existentes, sem CPF; cadastro/edição ainda pendentes |
| Cargo com vigência | member_offices referencia office_type_id com effective_from/to | Não tratar texto degree_or_office como cargo vigente; catálogo (criação), histórico e programação futura conectados; sucessão/encerramento e catálogo completo pendentes |
| Isenção e valor individual | DYN-015-F007/F008; recurring_member_terms contém term_type/override_amount/effective_from/to | Implementar edição versionada vinculada à regra; individual prevalece sobre geral e isenção ativa impede geração. Sem valor fixo na ficha |
| Status/saldo por período | view-integrantes-F002, A001/A002 e tabela piloto | Consulta financeira atual separada; filtro de período, status derivado, mensalidade, isenção, saldo/crédito e último pagamento ainda obrigatórios |
| Cadastro/edição de integrantes | DYN-015-F001..F008 | members tem somente policy SELECT; nenhuma RPC pública de member encontrada. Criar contratos validados/auditados, proteção de ID e concorrência; não abrir INSERT/UPDATE direto por conveniência |
| Categorias e comportamentos | financial_categories: domain, active, allow_recurrence/installments/default_behavior | UI e comandos de configuração, vigências e preservação do histórico pendentes |
| Recorrência e termos | recurring_rules / recurring_member_terms | Configuração etapa2; prévia/geração idempotente e saldos etapa3. Preservar regras mútuas/GLP/ágape/joia definidas no piloto/ADRs |
| Contas/fundos/meios de pagamento | financial_accounts / funds / payment_methods | Cadastros, ativação/desativação e vínculos próprios sem reescrever fatos |
| Plano contábil e mapeamentos | accounting_plans/accounts, category/account mappings | Rascunhos, validação, publicação e sucessoras imutáveis; não alterar plano publicado |
| Identidade e parâmetros da Loja | organization_settings | Editar dados/contatos, timezone e parâmetros previstos no inventário; integrações/secrets separados |

Esta tabela é início de execução, não inventário substituto do piloto completo. Linhas e fragmentos adicionais permanecem obrigatórios conforme a fonte.

## Incremento 1 — consulta cadastral

Código: Members.tsx integrado ao Workspace; loadTenantData seleciona campos reais da tabela members, mantém organization_id/RLS/abort e rejeição de organização inesperada. Até 200 registros carregados, busca na amostra explicitamente indicada; paginação e busca no banco continuam pendentes.
Situação cadastral separada de posição financeira. Texto de grau/cargo é exibido como registrado, sem afirmar histórico vigente. Observações renderizadas como texto, datas sem conversão de fuso, contatos sem envios/automação. CPF não carregado.
Nenhuma migration, grant, policy, usuário, credencial ou valor financeiro alterado.

Verificação executada: typecheck PASS; 32 testes frontend PASS (incluem filtros combinados, busca sem acento/contato, limpeza, ficha e texto sem execução de HTML). Build Vite PASS com chave pública placeholder de validação; não autentica nem constitui publicação.
SQL no DEV com authenticated/claims simuladas A/B: consulta positiva dos campos ampliados e ausência de linhas estrangeiras; DEV_MEMBER_CONSULTATION_COLUMNS_RLS_PASS. Não é nova execução HTTP com credenciais.
Visual autenticado desktop/mobile e deploy deste incremento ainda não verificados. CI remota deve ser conferida após push.

## Próximo incremento

Contratos de criação/edição de integrante e termos, com validação server-side, autorização members.write, ID estrangeiro negado, auditoria e vigência. Conferir permissões/ADRs antes de escolher contrato; members.write foi conferida no catálogo e utilizada no incremento acima; o texto abaixo preserva a conciliação inicial.
Mensalidade/isenção não devem ser campos soltos que alteram valores históricos. Manter layout único entre todas as lojas.

