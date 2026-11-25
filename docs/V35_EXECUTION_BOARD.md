## Posição vigente — 25/11/2026

Lote 01: PRs #67/#68/#69 integrados; #50 SUPERSEDIDO sem merge. Lote 02/M01.03: SQL aplicado DEV, jornada de convite/aceite ainda pendente de configuração Edge/redirect e homologação. Entrega A04 da M04: editor Master implementado, testes CI PASS e SQL aplicado; abertura/fechamento do editor real VERIFIED sem gravação; gravação pela UI NOT EVALUATED. M06.02 permanece CONCLUIDO; M06.01/M06.03 EM_EXECUCAO. Nenhuma macro adicional encerrada. Autorização consolidada em V35_CLOSURE_APPROVAL.md; evidências e próximo ato em ../SESSION_HANDOFF.md.

---

## Editor Master da identidade da prestadora — 25/11/2026

Implementação da ressalva A04/E03: formulário de identidade em MasterPlatformConfig e RPC save_platform_identity, somente MASTER/AAL2, allowlist de dez campos, nulos para opcionais, lock/CAS de updated_at, audit de nomes de campos sem valores pessoais, sem editar política comercial/termos/contratos. Resposta incerta exige atualização/reconciliação antes de novo envio. CNPJ numérico e alfanumérico aceitos em formato (sem afirmar consulta/validação cadastral oficial). Fonte de formato: Receita Federal, https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico .

Migration nova 20261125210000_v35_platform_identity_master_edit.sql preparada; ainda NÃO APLICADA no DEV neste registro. Teste PostgreSQL descartável real incluído no CI (DDL rollback, negativas, allowlist, CAS, atomicidade e auditoria). TypeScript PASS; PlatformIdentityEditor/MasterPlatformConfig 18/18 PASS locais. PostgreSQL/CI do novo incremento a conferir; não são substituídos por mock. Nenhum dado de identidade existente atualizado. Rollback de UI: retirar o editor; função aditiva pode permanecer sem uso até forward-fix, sem apagar audit.

PR #68 integrado em 4031452307e771d526e9082dc2a67c59282ff486 após 3/3 PASS; aprovação com ressalvas persistida em docs/V35_CLOSURE_APPROVAL.md e ADR-0050. DRE gerencial entregue na revisão anterior; cadastro real permanece ao final. Próximo gate: CI PostgreSQL e aplicação aditiva exclusivamente DEV após preflight/read-back. PROD/limpeza continuam fora da operação corrente.

## Aprovação consolidada com ressalvas — 25/11/2026

Fonte vinculante: [V35_CLOSURE_APPROVAL.md](V35_CLOSURE_APPROVAL.md). Pacote AC-V35-20261125-v1 aprovado pelo proprietário, com DRE **gerencial** (oficial pelo contador), sigilo de todo conteúdo, cadastro real da prestadora ao final em editor Master/MFA, início comercial sem fatos de homologação e conta QA isolada no DEV. Dados reais ainda ausentes não bloqueiam desenvolvimento. Diário/Razão não foram excluídos pela ressalva sobre DRE; mantêm gates próprios. Autonomia DEV aprovada; implantação PROD depende do gate final. Nenhuma limpeza/reset agora.

Lote 01: PR #67 integrado em f9e1f56cb4ecc78ba454acfff5dbe7e28c561d96 após CI 581ba2f 3/3 PASS. PR #50 fechado como SUPERSEDIDO: fixture e lockfile já idênticos à main, runner endurecido e teste presentes; sem merge do diff antigo. Preservadas evidências e estados das macros, inclusive M06.02 CONCLUIDO.

Neste incremento, identificação gerencial em navegação, telas, configurações e títulos/escopo de exportações; retirada alegação de validade fiscal pela publicação de plano. Cálculos/RPCs/segurança inalterados. TypeScript PASS; 38/38 testes focados em cinco arquivos PASS localmente. Editor de identidade ainda é lacuna a executar, não declarado pronto. Registro de aprovação inclui as minutas com sigilo reforçado; uso jurídico real continua condicionado aos gates existentes.

## M06.01 — Evidência local de conciliação e próximo gate (25/11/2026)

Quatro novos cenários UI da M02.02-A fecharam a lacuna automatizada de bloqueio/recuperação sob leitura incompleta/incoerente: **12/12 PASS local** com fontes da base `fed69b8`, serviço real e cliente simulado. Sem alteração de componente/serviço ou ambiente. CI do incremento a conferir no PR #67. Gate DEV específico permanece NOT EVALUATED e não será substituído por esses testes. [Requisito, evidência e próximo experimento](V35_M0201_FINANCIAL_RECONCILIATION.md). M06.01/M06.03 seguem EM_EXECUCAO; M06.02 CONCLUIDO preservado. Notas anteriores de “próxima reconciliação do código” foram atendidas neste recorte; próximo ato é o aceite independente delimitado, sem novas operações financeiras.

---

## Reconciliação M06.01/M06.03 — 25/11/2026

Base: `62a6ba87bd30b85bee4f6aa640b25bd3b02aae90`. Esta atualização corrige o controle de execução; não altera código, schema, permissões ou ambientes.

- **VERIFICADO nesta retomada:** main na revisão acima; CI [45686141566](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/45686141566) concluído com static/onboarding/frontend SUCCESS e check Workers Builds DEV SUCCESS. Isso não constitui nova homologação do runtime.
- **VERIFICADO por leitura administrativa DEV:** histórico com 79 migrations, incluindo `20261115184137_v35_tenant_timezone_financial_dates`; presentes `private.is_valid_iana_timezone`, `private.tenant_current_date_at` e `private.tenant_current_date`. O arquivo Git permanece `20261115120000_v35_tenant_timezone_financial_dates.sql`. Não reaplicar nem renomear.
- **Evidência anterior preservada:** teste PostgreSQL transacional de timezone registrado em [reconciliação de migrations](V35_MIGRATION_RECONCILIATION_DEV.md); Grupo A HTTP somente leitura 5/5 PASS fornecido pelo proprietário em 15/11, conforme [registro](V35_HTTP_READONLY_GATE_20261115.md). Não reexecutados nesta retomada.
- **M06.02 permanece CONCLUIDO**, com paginação visual além da primeira página NOT EVALUATED e risco residual de deadlock `40P01` não eliminado. C01–C05 PASS em PostgreSQL descartável não equivalem a todos os cenários de concorrência/recuperação da V35.
- **M06.01/M06.03 permanecem EM_EXECUCAO.** A aplicação de timezone e o Grupo A deixam de ser pendências. Restam os aceites por requisito das 21 telas, Grupo B persistente no recorte ainda não comprovado e recuperação/regressões não cobertas pelas evidências existentes.
- Nenhum teste de produto, migration, deploy, operação financeira, convite ou acesso PROD foi executado neste incremento documental. A existência das funções não é uma nova prova comportamental.

### Aceites restantes e dependências

A lista operacional por tela está no início de [V35_SCREEN_PARITY_MATRIX.md](V35_SCREEN_PARITY_MATRIX.md). Conclusão exige requisito original e evidência no escopo efetivo; uma tabela não promove telas automaticamente. Próximo recorte único: M06.01 / view-tesouraria, bloqueio seguro da conciliação por leitura truncada/incoerente (M02.02-A). Grupo B exige autorização específica de operações/identidades/cleanup. M01.03/04, issue #43 e M05 mantêm seus bloqueios próprios. Notas antigas abaixo são históricas quando contradizem esta reconciliação.

---

## M06.02 — Encerramento Documental: `CONCLUIDO` com ressalvas registradas (`view-master-planos`, 25/11/2026)

- **Base verificada:** `534eb6b4b7ea0860288e3dfe6d6f6ec93a1c0239` (correção de sincronização assíncrona em `WorkspaceDashboard.test.tsx`, zero alteração em código de produção, RPCs, migrations, DEV ou PROD).
- **CI GitHub Actions (`45529859036`) — 3/3 PASS:**
  - `static`: **PASS**
  - `onboarding`: **PASS** (inclui `Commercial concurrency PostgreSQL gate` — cenários `C01–C05` e integridade relacional/auditoria de `saas_plan_version_entitlements`, `saas_plan_versions` e `saas_master_audit_logs` em `postgres:17` descartável: **PASS**)
  - `frontend`: **PASS** (`625/625` testes + `wrangler deploy --config wrangler.dev.jsonc --dry-run`)
- **Cloudflare Workers Builds DEV (`corsys-tronco-digital-dev`):** **SUCCESS** (Build ID `3ca9d183-730d-4f76-868c-faca67a5054b`, Version ID `0f6747d8-2461-4d54-bef5-6f94725590d9`).
- **Homologação operacional autenticada MASTER/AAL2 no Supabase DEV (`szqkdekwhzxsoxorgvaz`, Cloudflare DEV `46499507`):** **PASS** — ADR-0049 aplicada sob `20261125002909_v35_commercial_draft_audit_logs`, eventos comerciais **39, 40 e 42** + eventos de exclusão controlada **43 e 44** confirmados em `saas_master_audit_logs`, catálogo restaurado sem resíduos comerciais observados, e paginação SQL em duas páginas **PASS**.
- **Ressalvas explícitas (registradas separadamente sob o estado oficial `CONCLUIDO`, visto que `CONCLUIDA_COM_RESSALVAS` não integra a semântica oficial da Seção 2):**
  - Paginação visual além da primeira página na interface: **`NOT EVALUATED`**.
  - Risco teórico residual de deadlock (`40P01`) por ordenação inversa de locks em `C05` entre `update_saas_plan_version_draft` (`saas_plan_versions -> saas_plans` em plano ainda sem versão publicada) e `delete_saas_plan_if_unused` (`saas_plans -> saas_plan_versions`): **não eliminado** (RPCs mantidas inalteradas; em eventual intercalação estreita o PostgreSQL falha fechado com rollback `40P01` sem corrupção).
- **Estado final:** **`M06.02` promovida a `CONCLUIDO`** com as ressalvas acima; macroetapa **`M06` permanece `EM_EXECUCAO`** por pendências de `M06.01`/`M06.03` (aplicação DEV da migration `20261115120000_v35_tenant_timezone_financial_dates.sql` e fechamento da suíte final).

---

## M06.02 — Gate Final de Concorrência Comercial em CI Descartável (`view-master-planos`, 24/11/2026)

- **Entrega codificada (`b59721e7`):** implementado `scripts/check_commercial_concurrency_pg.py` (`C01–C05` + `55P03` + verificação anti-`40P01` + integridade de `saas_master_audit_logs`) e integrado ao job `onboarding` de `.github/workflows/foundation-checks.yml` usando o serviço PostgreSQL 17 descartável (`commercial_concurrency_gate`).
- **Preservação e segurança:** utiliza exclusivamente as definições SQL reais do repositório (incluindo `20261124220000_v35_commercial_draft_audit_logs.sql`), trava contra uso em Supabase DEV/PROD e mantém inalteradas todas as RPCs e migrations baseline.
- **Estado operacional:** validação estática/extração SQL aprovada localmente; execução runtime em PostgreSQL 17 permanece **`NOT EVALUATED`** localmente (sem `psql`/`docker`), aguardando execução do GitHub Actions após push. **`M06.02` permanece `EM_EXECUCAO`.**

---

## M06.02 — Consolidação Pós-Migration ADR-0049 no DEV (`view-master-planos`, 24/11/2026)

- **Ativação exclusiva DEV (`szqkdekwhzxsoxorgvaz`):** arquivo `20261124220000_v35_commercial_draft_audit_logs.sql` (base `765a8a661f7375a22183f17c35036a297f4c1e79`) aplicado sob versão **`20261125002909_v35_commercial_draft_audit_logs`** (`SUCCESS`, PROD não alterado), com **`COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS`**, `SECURITY DEFINER`, `anon` sem `EXECUTE`, `MASTER/AAL2` preservado e zero mutação persistente nos dados/auditoria.
- **Alinhamento UI e reconciliação:** textos informativos atualizados em `MasterPlanLifecycle.tsx` e `MasterPromotions.tsx`; divergência `#9` (`20261124220000` → `20261125002909`) registrada em `docs/V35_MIGRATION_RECONCILIATION_DEV.md` preservando `#1`–`#8`, nome do arquivo Git e pendência de `20261109233000`.
- **Estado operacional:** concorrência simultânea entre duas sessões permanece **`NOT EVALUATED`**; homologação operacional autenticada no DEV pendente pós-sync/push e deploy Cloudflare DEV. **`M06.02` permanece `EM_EXECUCAO`.**

---

## M06.02 — Revisão Final da Migration de Auditoria Comercial (`view-master-planos`, 24/11/2026 — preparado)

- **Artefatos produzidos (`ADR-0049`):** `supabase/migrations/20261124220000_v35_commercial_draft_audit_logs.sql` e `supabase/tests/test_commercial_draft_audit_rollback.sql`, cobrindo auditoria transacional em `public.saas_master_audit_logs` para `update_saas_plan_version_draft` (`saas_plan_version.draft_updated`), `create_saas_plan_successor_draft` (`saas_plan_version.successor_draft`) e `update_saas_promotion_draft` (`saas_promotion.draft_updated`).
- **Correções F1/F2/F3 aplicadas na proposta SQL:** ordem de locks preservada (`saas_plan_versions -> saas_plans`, compatível com `publish_saas_plan_version`), rejeição fail-closed `22023` para `p_entitlements IS NULL` ou não-objeto (sem `coalesce(..., '{}')`), e validação alinhada com RPCs idempotentes e UI sem `p_valid_from > now()`.
- **Estado operacional:** nenhuma migration aplicada remotamente; execução real em PostgreSQL e contenção multi-sessão permanecem `NÃO AVALIADAS` localmente. Textos informativos da UI mantidos até aplicação da migration no DEV. **`M06.02` permanece `EM_EXECUCAO`.**

---

## M06.02 — Correção de integridade no Ciclo de Vida Comercial (`view-master-planos`, 24/11/2026)

- **F1 (sem reenvio cego em RPCs não idempotentes):** `update_saas_plan_version_draft`, `set_saas_plan_active`, `update_saas_promotion_draft` e `set_saas_promotion_series_active` agora operam com `retryable: false`; em resultado de rede incerto, exigem reconciliação via `Atualizar rascunhos` / `Atualizar ofertas` com bloqueio de novas gravações até recarga bem-sucedida, preservando `p_idempotency_key` nos comandos `*_idempotent`.
- **F2 (fail-closed em entitlements):** `loadPlanVersionEntitlements` rejeita linhas sem ou com `plan_version_id` diverso, chaves inválidas/duplicadas e payloads truncados (`> 200`), mantendo o formulário de edição travado.
- **F3 (auditoria SQL sem nova migration):** conferido nas migrations versionadas que criação/sucessora de promoção, criação inicial de plano, publicação, ativação/desativação e exclusão gravam em `saas_master_audit_logs`, enquanto `update_saas_plan_version_draft`, `create_saas_plan_successor_draft` e `update_saas_promotion_draft` mantêm apenas autoria/timestamp na versão sem trigger de auditoria. **M06.02 permanece `EM_EXECUCAO`.**

---

## M06.02 — Planos SaaS (`view-master-planos`): PASS visual da apresentação e Ciclo de Vida Comercial Completo (24/11/2026)

- **Reconciliação (`6585c1e6`):** CI **`45474973273`** **3/3 PASS** (**609/609 testes**), Workers Builds DEV **SUCCESS** e **PASS visual** pelo Work no recorte de apresentação de Planos SaaS (`view-master-planos`), sem promover a tela integral a `HOMOLOGADO_DEV`.
- **Ciclo de Vida Comercial Completo (`view-master-planos`) IMPLEMENTADO E TESTADO localmente no Gemini:** acoplamento das 7 RPCs reais já existentes no baseline DEV (`20261002202054` / `20261002202107`) — edição de rascunho de plano (`update_saas_plan_version_draft` + leitura `saas_plan_version_entitlements`), nova versão sucessora de plano (`create_saas_plan_successor_draft`), ativação/desativação (`set_saas_plan_active`), exclusão segura sem vínculos (`delete_saas_plan_if_unused`), edição de rascunho de oferta (`update_saas_promotion_draft` + leitura `saas_promotions`, restrita a `draft`), ativação/desativação de série (`set_saas_promotion_series_active`) e exclusão segura sem uso (`delete_saas_promotion_series_if_unused`), com atualização automática do catálogo (`onCatalogChange`).
- **Candidatas bloqueadas documentadas:** `view-master-config` (sem RPCs de gravação no schema) e `view-master-cobranca` além da emissão manual (sem RPCs de gateway/régua/acordo). **M06.02 segue EM_EXECUCAO**, aguardando sync/push, CI integral e QA autenticado DEV no Work.

---

## M06.02 — Fluxo de Caixa (aviso Projetado encerrado) e Paridade de Apresentação em Planos SaaS (24/11/2026)

- **Fluxo de Caixa (`view-fluxo-caixa` — aviso Projetado):** **CONCLUÍDO** no recorte visual sobre o commit **`34291d4`** (`34291d4945bb01659c5c11dbbd877ac2e06e961d`), CI **`45463715864`** **3/3 PASS**, Workers Builds DEV **SUCCESS** e homologação visual **PASS em 390 e 1024 px** com período preservado de **02/11 a 24/11/2026** (consolidado diretamente sem PR documental isolado).
- **Planos SaaS (`view-master-planos` — paridade de apresentação):** **IMPLEMENTADO E TESTADO no Gemini** sobre **`34291d4`**: rótulos comerciais legíveis (`Mensal`/`Anual`/`Personalizada` e situações de versão/oferta com tratamento neutro para desconhecidos), cards comerciais responsivos de planos e ofertas baseados exclusivamente nos campos reais retornados por `v_saas_plan_version_admin` e `v_saas_promotion_series_admin`, preservação dos formulários `MasterPlanLifecycle`/`MasterPromotions` e filtros `valid_from`/status.
- **Lacunas documentadas (Entrega C):** colunas `Usuários` (não fornecida pela view) e `Ações` por linha (operações seguem nos formulários idempotentes com `PUBLICAR`) permanecem documentadas, sem dados simulados ou botões inativos.
- **Verificações locais:** Vitest focado **22/22 PASS (exit 0)** (`MasterCommercialCatalog` 7/7, `MasterPlanLifecycle` 5/5, `MasterPromotions` 6/6, `FluxoCaixa` 4/4), `typecheck` PASS e `vite build` PASS. **M06.02 geral segue EM_EXECUCAO** aguardando sync/push, CI integral no GitHub Actions e QA autenticado DEV.

---

## M06.02 — Configurações da Plataforma: homologação residual somente leitura concluída (24/11/2026)

**Recorte de leitura CONCLUIDO; M06.02 geral EM_EXECUCAO e tela integral não promovida a HOMOLOGADO_DEV.** Homologação real pelo navegador Work no Cloudflare DEV, sessão Master existente aceita pela área AAL2. Sem novo login, inspeção de tokens, alteração funcional ou escrita no banco. A indisponibilidade anterior do navegador foi superada nesta sessão.

- **Revisão:** main `6e676aadcb9c2803b80cc1816a54545ec530fbd4`, conferida pelo conector GitHub. CI [45455733688](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/45455733688) conferida: frontend/static/onboarding **3/3 PASS**, log frontend **608/608 em 85 arquivos e MasterPlatformConfig 13/13**. Resultados reaproveitados, sem suíte/build local repetidos. Versão DEV `4e50220f-ddc2-4f47-a08a-78b970f9cea5` e Workers Builds `52236cfc-a4c9-4d77-b5f9-b993957c42b1` SUCCESS **informados pelo proprietário**, sem nova verificação do painel Cloudflare nesta rodada. Assets observados no DOM: `index-SxEyO9l3.js` e `index-Cg4ixQHO.css`; equivalência binária com o build NOT EVALUATED.
- **A — PASS real:** clique/navegação nas seis seções; identidade, regras, cobrança, comunicação, termos e integrações carregados. Termos sem registros exibem estado vazio coerente. Sem criar dados para preencher cenários ausentes.
- **B — PASS real:** seis abas e seis painéis existentes no DOM; todos os `aria-controls` e `aria-labelledby` apontam reciprocamente para IDs existentes; um selecionado/visível/tabIndex 0 e cinco `hidden`/display none/tabIndex -1. Setas nas quatro direções, circularidade nas bordas, Home/End, Enter/Space, Tab para painel ativo e Shift+Tab de volta à aba executados. Foco real, sem focus() artificial. Um único `#view-master-config`. O registro histórico de “apenas painel ativo no DOM” foi superado pela correção residual desta revisão, preservado abaixo como histórico.
- **C — PASS no observável + testes reutilizados:** carregamento inicial observado, vazio de termos e Atualizar com retorno dos dados e seção Integrações preservada. Conteúdo/última atualização registrada coerentes antes/depois; não se alterou configuração para fabricar valor novo. Erros reais de autorização/rede, falha parcial e resposta tardia NOT EVALUATED no DEV; cobertura automatizada existente de 42501/28000/erro sanitizado, limpeza de dados obsoletos, consultas parciais, sequenciamento e recuperação reaproveitada do CI, sem induzir falha na sessão.
- **D — PASS no conteúdo disponível:** seis seções em cada largura 320/390/768/1024/1440, altura 900; nenhuma excedeu a largura do documento. scrollWidth respectivamente 305/375/753/1009/1425 (barra vertical descontada). Tema escuro conferido em capturas e foco de teclado distinto em desktop/mobile; `:focus-visible` verdadeiro, outline dourado rgb(197,168,128), largura computada 1,6 px e sombra adicional. Tabela de termos preenchida, valores cadastrais longos e contraste quantitativo NOT EVALUATED no DEV; não se fabricaram registros. Viewport restaurado ao final.
- **E — PASS na apresentação:** três integrações como “Não configurado” e “Disponibilidade operacional não verificada”, billing também “Pendente de homologação”; nenhum segredo exibido nos conteúdos inspecionados e nenhum campo editável na seção. Projeções explícitas/ausência de mutações cobertas pelos testes existentes. Não é auditoria de tráfego, nova prova de autorização/RLS nem comprovação operacional dos provedores. Estados configured/desconhecido cobertos apenas pelos testes automatizados.

**Limites preservados:** edição persistente de parâmetros e revisão/publicação de termos permanecem fora deste recorte. Não salvar/publicar/criar registros. Sem alterações Supabase/Auth/MFA/RLS/RBAC/PROD, sem deploy manual, sem reabrir chamados Master/drawer/Planos/Cobrança/Dashboard.

**Próxima microentrega prioritária no Gemini — M06.02, Fluxo de Caixa / aviso do modo Projetado:** reconciliar a V35 e corrigir somente a inconsistência de tema identificada no código atual: `FluxoCaixa.tsx` usa `background: var(--highlight, #f3f4f6)`, mas `src/styles.css` não declara `--highlight`; substituir por token/classe escura existente e preservar conteúdo, períodos/modos, consultas e contratos. Defeito de fonte verificado; aparência real desta tela NOT EVALUATED nesta rodada. Testes proporcionais existentes/focados, sem repetir gates aprovados; nenhum desenvolvimento executado pelo Work.

Este incremento altera exclusivamente os quatro documentos de continuidade (cursor, quadro, matriz e handoff), preservando histórico. Revisão do diff, CI documental e integração ficam rastreadas no PR; não afirmar merge antes de confirmação.

---

## M06.02 — Configurações da Plataforma (`view-master-config`): implementação F1–F5 e testes concluídos no Gemini (19/11/2026)

Base **`3da4f1e1656da23736c38c63b70f8f3d41828ea8`** (funcional anterior `025d165da1e587c40170ec967b9ce16ccb7e6b4e`, PR #65 integrado, CI `44651527695` 3/3 PASS, Workers Builds `4a69d852-ffaf-4ecf-8ad0-08930ddc6d2c` SUCCESS). **Diretriz operacional do proprietário registrada:** Gemini AI Studio como agente prioritário para diagnóstico, implementação, revisão local e testes automatizados/executáveis; ChatGPT Work reservado para homologação independente autenticada no Cloudflare DEV e verificações indisponíveis no Gemini.

Implementadas e verificadas F1 (limpeza de dados obsoletos ao iniciar/atualizar consulta, renderização condicionada ao sucesso simultâneo de `loadPlatformConfiguration` e `loadPlatformTerms`, descarte de respostas obsoletas via `AbortController` + sequência monotônica, sanitização de erro genérico e recuperação por `Atualizar`), F2 (padrão WAI-ARIA Tabs completo nas 6 seções com `ArrowRight`/`ArrowLeft`/`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Space`, apenas painel ativo no DOM e preservação da aba ativa após `Atualizar`), F3 (tema escuro CorSys, distinção visual entre aba selecionada e `:focus-visible`, região rolável na tabela de termos e `overflow-wrap: anywhere`), F4 (projeção explícita `PLATFORM_CONFIGURATION_SELECT` sem `select('*')` e sem `updated_by`, reconciliação de `PLATFORM_TERMS_SELECT` com o schema PostgreSQL de `saas_terms_versions` e validadores `validatePlatformConfiguration`/`validatePlatformTerms`) e F5 (estados de integração `Configurado`, `Não configurado` e `Estado não reconhecido` com `Disponibilidade operacional não verificada`, sem `Conectado`/`Operacional`/`Homologado`).

**Verificações locais no Gemini:** `MasterPlatformConfig.test.tsx` **12/12 PASS (exit 0)**; suíte completa **607/607 PASS em 85 arquivos (exit 0)**; `typecheck` **PASS (exit 0)**; `vite build` **PASS (exit 0)**; Wrangler DEV dry-run **PASS (exit 0)**. **Implementação concluída; CI pós-push e homologação autenticada Master/AAL2 no Cloudflare DEV permanecem pendentes.** M06.02 geral **EM_EXECUCAO**. Planos SaaS, Cobrança SaaS, drawer, chamados Master e Dashboard Mobile não reabertos. Evidências completas no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).

---

## M06.02 — Cobrança SaaS: consulta/filtros/acessibilidade aprovados no recorte disponível (19/11/2026)

Main **46b08c20d36cb792004c134d76dbd445ecdaac7b**, funcional025d165 e src f10358a3abda5b85f220713a69a24c55f871621b preservadas. DEV **96a75c83-ce8a-449a-95a3-d642c2a27570**, Workers Builds b479de7f SUCCESS. CI44626184697 **3/3 PASS/598 testes**, MasterBilling17/17 e ResponsiveLayout7/7 reutilizados, sem suíte/build local repetidos ou novo deploy. Assets C-35ixZm/BJXaZgFj observados; equivalência binária com build Windows/ambiente Workers **NOT EVALUATED**, limitação mantida.

**A PASS UI:** sem Loja inicial; seis Lojas consultadas, uma fatura cancelada em QA Finance A, demais vazias e zero pagamentos em todas; troca de Loja/modo limpa composição/filtros, sem resíduos. Não é prova de RLS. **B PASS disponível:** número completo/parcial/inexistente, seis status, curingas literais negativos, competência2026-11/12 e combinação, Aplicar Enter, Limpar Enter/Space, atualização e reset por Loja. Só Todos/Cancelado tiveram correspondência positiva; outros status positivos e paginação real/reset desde página2 **NOT EVALUATED**. Anterior/Próxima disabled coerentes na página1.

**C PASS observável:** composição por Enter, base/totalR$1,00 e ajustes/pago/abertoR$0,00, statusvoid; regra de cancelado respeitada. Atualização, vazios, loading da composição e limpeza de contexto observados. Loading inicial de documentos não capturado conclusivamente, erro/recuperação reais, reconciliação independente e pagamentos/alocações/ativo-revertido **NOT EVALUATED**; negativos automatizados separados. **D PASS:** 320/390/768/1024/1440 sem overflow do documento; tabelas preenchidas de fatura/composição com scroll interno, valores alcançáveis, labels, teclado/foco e campos nativos; tabela de pagamentos preenchida NOT EVALUATED. **E PASS inspeção:** painel manual abre/fecha, rótulos/avisos conferidos. **Não acionados prévia RPC nem emissão**, apenas foco por Tab no botão de consulta. Testes existentes de idempotência/invalidação/falhas reaproveitados; operações reais não homologadas.

**Microentrega delimitada CONCLUIDA no aceite funcional; Cobrança SaaS integral NÃO HOMOLOGADA; M06.02 EM_EXECUCAO.** Diferenças V35 registradas: cards/totais ausentes nesta consulta, Loja selecionada em vez de coluna/busca global Cliente, base/encargos em composição separada, automação/régua/política/acordos/ações comerciais fora do recorte; consulta de jobs existente em outro módulo não substitui esses fluxos. Não detectado defeito funcional que justifique correção Gemini. Evidências, medidas e limites no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).

Novo PR documental com histórico preservado, revisão/CI/integração rastreados no PR e relatório. Próxima recomendação M06.02: **Configurações da Plataforma — leitura/estados/teclado/responsividade sem salvar parâmetros**, pendência do recorte real na matriz. Planos/drawer/chamados/Dashboard não reabertos. Sem alterações funcionais/financeiras/DB/Auth/segurança/deploy/PROD; demais NOT EVALUATED históricos preservados.

---

## M06.02 — Planos SaaS: recorte de leitura/filtros/acessibilidade aprovado (19/11/2026)

Main **b3fe1b336c4d574fb371af67ab84a66db766445b**, funcional025d165, src f10358a3abda5b85f220713a69a24c55f871621b preservada. DEV **b86d492c-e8ec-4ab0-82a2-f3d75ded4fbc**, Workers Builds4b96aad6 SUCCESS; CI44622872535 **3/3 PASS/598 testes**, catálogo6/6, ciclo5/5, promoções6/6 reaproveitados. Sem suíte repetida/deploy manual. Assets servidos C-35ixZm/BJXaZgFj diferem dos nomes do build Windows local; correspondência binária/causa **NOT EVALUATED**, sem afirmar igualdade.

**A PASS na UI disponível:** 1 versão vigente (DEV HTTP - no billing, v1, R$0,00, monthly, início2026-10-07 aberto/current),0 ofertas; reconciliação independente por conector sem contexto equivalente **NOT EVALUATED**. **B PASS:** seis status; datas valid_from isoladas/inclusivas, combinação, intervalo vazio/invertido, contagem, limpar Enter/Space e atualizar. Positivas draft/future/historical/inactive e ofertas preenchidas NOT EVALUATED. **C PASS nos estados observados:** loading/atualização/retorno,0de1 filtrado e ofertas vazias. Limite201 rejeitado para cada domínio em controle local da função real, sem banco/rede/registros; erro/recuperação reais e catálogo integralmente vazio NOT EVALUATED. **D PASS:** 320/390/768/1024/1440 sem overflow do documento, tabela com scroll interno, labels, datas/status por teclado, Tab/Shift+Tab/foco e formulários sem submissão. **E PASS na UI/testes:** publicação disabled sem rascunho, PUBLICAR rotulado, avisos contratuais e preço/promoção separados; operações comerciais e nova prova de autorização servidor NOT EVALUATED.

**Microentrega delimitada CONCLUIDA no aceite funcional; Planos SaaS integral NÃO HOMOLOGADO.** Não alterar status integral da tela. Histórico/limites preservados; sem defeito funcional reproduzido. Diferenças V35: cards/hero substituídos por formulários antes do catálogo, coluna Usuários/ações por linha não apresentadas, tabela de ofertas em vez de cards, códigos monthly/current sem tradução. Lacunas de paridade/apresentação, sem inferir inexistência backend ou executar operações fora do recorte. Evidências, datas/medidas e limites no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).

Novo PR exclusivamente documental, revisão/CI/integração rastreados no PR e relatório. M06.02 geral EM_EXECUCAO. Próxima recomendação: **Cobrança SaaS — QA de filtros/estados/teclado/responsividade somente leitura**, pendência da matriz; sem emitir faturas/cobrar/alterar assinaturas. Drawer, chamados Master e Dashboard Mobile não reabertos. Sem alterações funcionais/DB/Auth/segurança/PROD; contraste quantitativo e demais NOT EVALUATED históricos mantidos.

---

## M06.02 — F1 aprovada; drawer transversal com aceite funcional CONCLUIDO (19/11/2026)

Revisão **`025d165da1e587c40170ec967b9ce16ccb7e6b4e`**. CI [44619837345](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44619837345) **3/3 PASS / 598 testes / 85 arquivos / ResponsiveLayout 7/7 / TypeScript, build e dry-run PASS**. Workers Builds automático SUCCESS, build `89075dd8-f62f-43f8-829f-997ba9425a6e`, DEV avaliado **`9c42e309-1d47-4e72-b017-f7eb5b60e24d`**. Assets index-DVZ5_eI3.js/index-BE1i90wT.css correspondem ao build local exato PASS/exit0. Rollback de referência 8f7afd32 (3be7995). Sem deploy manual/suíte local repetida.

**F1 PASS real: 18/18 em 390×844**, três repetições de clique/Enter/Space por acionador superior/inferior, individualizadas no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Todas: activeElement=Início antes de Tab e após estabilização, dentro do drawer aberto; ARIA coerente; Master SaaS preservado; Escape/restauração ao acionador correto. Nenhum focus() artificial ou efeito duplicado observado. **Regressões PASS:** backdrop, seleção de Integrantes, fechamento rápido, ausência de foco tardio e preservação de Integrantes após avanço por Tab. **Smoke F2/F3 PASS:** 390→1024→390 sem backdrop/trap ou reabertura; foco da rota ativa claramente distinto com :focus-visible real. R1/R2 e matriz anterior reutilizados, sem repetir navegação completa.

**Drawer com aceite funcional CONCLUIDO; encerramento documental via PR #63 após revisão/CI/integração e conferência pós-merge. M06.02 geral EM_EXECUCAO.** Histórico F1/F2/F3 abaixo preservado; chamados Master e Dashboard Mobile não reabertos. Contraste quantitativo, pixels exatos761/961, SHA-256 remoto e demais NOT EVALUATED históricos mantidos, incluindo paginação real insuficiente. Sem código funcional/dados/Auth/PROD alterados.

**Próxima recomendação M06.02:** homologar filtros/estados e acessibilidade de **Planos SaaS (`view-master-planos`)**, conforme QA real pendente na matriz e escopo do quadro; vigência/status, contagem/limpeza e teclado, confrontando a V35 original. Primeiro verificar implementação existente, somente leitura/interação, sem criar planos/promoções. Resultados de CI/merge/rebuild documental serão registrados no PR e relatório final.

---

## M06.02 — reteste final do drawer: somente F1 pendente (19/11/2026)

Revisão **`3be7995c3f76579630b4597b5fca8c47a787ae8e`**, CI [44607492433](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44607492433) **3/3 PASS / 597 testes / 85 arquivos / ResponsiveLayout 6/6**; typecheck/build/dry-run aprovados. Workers Builds automático SUCCESS: DEV **`8f7afd32-598d-4d79-a30b-f0dfad02d38b`**, build `8684bef8-b2ea-46b3-968a-3702a6338e08`. Assets index-CBmSvN6r.js/index-DsHs0NTJ.css coincidem com build local exato PASS/exit 0; SHA-256 remoto NOT EVALUATED. Rollback de referência DEV 105ad0e7 (a298d5f); nenhum deploy manual.

**Homologação real:** **F2 PASS** (390→1024→390, backdrop/modalidade removidos, Tab/Shift+Tab/Escape livres, hit-test Atualizar plataforma no próprio controle); **F3 PASS** (Master SaaS e Início ativo da Loja com indicador visivelmente distinto sob foco real/:focus-visible; aria-current preservado). **F1 FAIL:** clique superior/inferior deixa activeElement=#mobileMenu/Menu fora da sidebar mesmo após estabilização; clique nativo superior reproduziu e Enter inferior também falhou. Houve sucessos de Enter/Space, sem garantia determinística. Não usado focus() artificial em Início; rAF existente não comprovou resultado.

**R1/R2 PASS nos cenários observados:** foco passa a BODY ao ocultar sidebar/barra inferior; próximo Tab alcança Pular para conteúdo, sem retenção invisível nem bloqueio. Escape após 760→762 retorna ao superior visível. 960→962 encerra estado modal. **761/961 exatos NOT EVALUATED** (aplicados 762/962). 320/390/768/1024/1440 sem overflow; cinco atalhos por perfil; altura 390×320 com rolagem interna até scrollTop564 e todos os 16 itens alcançáveis. Tab/Shift+Tab circulares após recuperação inicial, Escape/backdrop/rota e três ciclos sem foco tardio PASS. Evidências completas, estilos computados e medidas no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).

**Drawer NÃO HOMOLOGADO / AGUARDA_CORRECAO_GEMINI somente F1.** M06.02 EM_EXECUCAO; chamados Master CONCLUIDOS. Menor correção: sincronização/validação da transferência inicial para Início em AppShell.tsx, com cancelamento ao fechar/navegar/redimensionar; preservar F2/F3 aprovados e retestar seis entradas no navegador. PR #63 documental atualizado sem skip ci, mantido em rascunho e sem merge; CI acompanhado no PR. Histórico das três falhas abaixo preservado. Não avançar outra microentrega. Sem código funcional/dados/Auth/PROD alterados. Mantidas as limitações de paginação real, contraste quantitativo e demais NOT EVALUATED anteriores.

---

# V35 — PLANO MESTRE DE EXECUÇÃO (macroetapas e microentregas)

## M06.02 — drawer: FAIL; correção delimitada pendente (18/11/2026)

Base a298d5f, funcional f9f900a, DEV 105ad0e7. Homologação real do drawer existente: A mecanismos PASS; **B FAIL** (foco inicial fora do painel e ausência de foco distinto na rota ativa); **C FAIL** (mobile aberto → desktop conserva backdrop e trap); D PASS no escopo de navegação UI/aria-current/perfis. 320/390/768/1024/1440, 760/960 e altura reduzida conferidos; pixels exatos 761/961 NOT EVALUATED por aplicação de 762/962 pelo navegador. CI 44440984311/596 anterior reaproveitado; nenhuma suíte, deploy ou mudança funcional nesta execução.

**M06.02 EM_EXECUCAO, recorte drawer AGUARDA_CORRECAO_GEMINI.** Próximo ato prioritário: F2 → F1 → F3, escopo mínimo AppShell.tsx/styles.css/testes de responsividade/foco; reproduzidores no handoff. Não encerrar nem avançar para outro recorte. Evidência documental proposta em PR rascunho sem merge e sem CI repetido ([skip ci] apenas no commit de documentação; workflows/proteções intactos). A microentrega de chamados Master continua CONCLUIDA.

## M06.02 — microentrega de chamados Master encerrada (18/11/2026)

**CONCLUIDO no recorte de leitura Master/Loja e disclosure; M06.02 geral permanece EM_EXECUCAO.** Revisão `f9f900a`, CI 44438915012 **3/3 PASS**, 596 testes/85 arquivos/typecheck/build/dry-run PASS. DEV automático **`9586c7b2-e230-4248-a179-ba7c173021ad`**, assets JS/CSS com nomes correspondentes e SHA-256 CSS remoto/local igual; sem novo deploy manual. Cenários A/B/C PASS reais (interno corrigido, cliente e alternância); D PASS no cliente disponível, com negativa de nota interna no mesmo cliente NOT EVALUATED por ausência desse dado e testes automatizados separados. Smoke 390/1440 PASS; reaproveitadas evidências de acessibilidade/seis resoluções; paginação real e contraste quantitativo permanecem NOT EVALUATED. Handoff preserva histórico, limites e rollback. PR #62 documental reutilizado para fechamento após CI e revisão do diff. **Próximo recorte recomendado ao Gemini:** M06.02, homologação de teclado/foco do drawer transversal já implementado em `AppShell.tsx`, pendência expressa na matriz de telas; reconciliar com V35, sem reconstrução nem repetição dos chamados.

## M06.02 — homologação real Master: aceite parcial com FAIL (18/11/2026)

Checkout exato e sessão Master agora disponíveis. Revisão `d859b16`; CI 44429221490 **3/3 PASS**; testes locais 591/591 e build emitidos, exit agregado do wrapper local NOT EVALUATED; dry-run local **PASS/exit 0**. Publicação automática DEV confirmada por Workers Builds: **`c110100d-4d25-4b20-afaf-6c768cdbbce6`**; nomes de assets JS/CSS coincidem com build local. Disclosure/ARIA, clique/Enter/Space, alternância, foco real em Recolher/retorno correto e filtros/atualização **PASS no DEV**. Seis resoluções sem overflow no documento; paginação real NOT EVALUATED por apenas seis chamados. **FAIL reproduzido: histórico de mensagens da conversa interna #10 indisponível, enquanto #13 cliente carrega.** Causa e relação com o diff não comprovadas. M06.02 segue **EM_EXECUCAO**, recorte integral não encerrado. Próxima prioridade: diagnóstico delimitado da leitura interna #10 e revisão do encerramento do wrapper local, sem ampliar autorização nem alterar código funcional neste ciclo. Histórico, medidas, assets/rollback e reprodução no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).

## M06.02 — chamados Master: gate inicial e bloqueios (18/11/2026)

Revisão `d859b16262c48a16001b7cd778620371f13df3a3` confirmada no GitHub. CI 44429221490 **3/3 PASS**, check (591 testes/85 arquivos), MasterSupportQueue 12/12 e dry-run PASS remotos. **Recorte BLOQUEADO; macro/micro M06.02 permanece EM_EXECUCAO.** Workspace local divergente/sujo preservado e cópia isolada impedida por `Could not resolve host: github.com`. DEV acessível como Administração da Loja/Tenant A; Master AAL2 não confirmado. Sem deploy nesta execução; versão/assets/rollback e homologação real (teclado/foco/filtros/escopo/seis resoluções) NOT EVALUATED. Evidências no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md); prioridade é desbloquear e concluir este mesmo recorte, sem criar registros artificiais, alterar código funcional ou repetir homologações anteriores.

## Consolidação operacional — 18/11/2026

Dashboard Mobile/Novo Ágape encerrado para investigação e desenvolvimento por decisão do proprietário, com evidências de ambientes discriminadas no cursor e handoff. Mantidos o FAIL documental de 1 CSS px e o residual de testes controlados no DEV autenticado antes da liberação aplicável em produção. M06.02 segue EM_EXECUCAO. Próxima microentrega independente: acessibilidade de expansão/recolhimento de detalhes na fila Master de suporte, com paridade de leitura e responsividade; acesso Master/AAL2 necessário para homologação DEV. Estados históricos abaixo exigem reconciliação antes de nova execução.

## Atualização operacional — gate HTTP real aprovado em DEV (15/11/2026)

- **Subgate HTTP somente leitura M02.03/M04.03/M06.03:** **5/5 PASS** observado no PowerShell do proprietário após correção de assinatura `p_page: 0`; negativas A↔B e `finance.read`, Master AAL1 negado, Master AAL2/TOTP positivo. [Evidência detalhada](V35_HTTP_READONLY_GATE_20261115.md).
- **Não promover as microentregas completas a CONCLUIDO:** Grupo B persistente **SKIPPED**, testes de concorrência/recuperação, QA integral das 21 telas e fluxos não incluídos nesse gate. Os estados históricos da tabela abaixo ficam preservados até reconciliação por microentrega.
- **Microentrega ativa na sequência:** **M06.01/M06.02**, confrontar fonte original e componentes React de cada tela, priorizando diferenças observáveis de ação, responsividade, acessibilidade e estados. Não reconstruir telas já implementadas, nem reduzir a V35.
- **DEV/PROD:** nenhuma mutation de banco, mudança de RLS/role, deploy ou operação de produção integra este registro.

---

> **Decisão do proprietário — 03/11/2026:** concluir TODO o escopo aprovado da V35 **antes** de disponibilizar Beta para clientes. Este plano é o índice operacional vivo; não substitui código, ADRs nem evidência de testes. Não reduzir o escopo para um MVP sem nova decisão explícita.

## 1. Como consultar este documento

- **Entrada rápida:** [V35_SESSION_CURSOR.md](V35_SESSION_CURSOR.md) indica a única microentrega ativa, os bloqueios e a próxima ação.
- **Contrato e arquitetura:** `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, código atual e `docs/adr/`; documentos históricos não provam comportamento executável.
- **Histórico técnico:** `SESSION_HANDOFF.md` (registro acumulado), `docs/V35_REMAINING_WORK.md` (lacunas já identificadas), `docs/V35_PILOT_V35_INVENTORY.md` e `docs/V35_PILOT_PARITY.md` (escopo original).
- **Fonte da verdade por afirmação:** código/DB/CI/ambiente real e revisão Git exata. Anotações antigas ou estados de `V35_COVERAGE.md` **não** reabrem entregas sem nova evidência.
- **Arquivos `sources/`, quando presentes, são somente leitura.** Não alterar HTML de referência, textos legais ou protótipos para fazer o código passar.

## 2. Semântica de estados

- `A_CONFERIR`: não houve reconciliação suficiente de inventário, código e evidências; **não** presumir falta de implementação.
- `PENDENTE_CONFIRMADO`: ausência/limitação demonstrada em código ou evidência recente; exige microentrega.
- `EM_EXECUCAO`: há branch/revisão e trabalho delimitado em andamento.
- `PR_ABERTO`: código/documentação propostos, ainda não integrados; CI informado à parte.
- `INTEGRADO`: PR incorporado, mas **não** necessariamente publicado/homologado.
- `HOMOLOGADO_DEV`: comportamento do escopo comprovado em DEV; não significa pronto para PROD.
- `CONCLUIDO`: critérios funcionais, segurança, qualidade e evidências exigidas para a microentrega satisfeitos.
- `BLOQUEADO`: ação pendente de decisão, acesso ou pré-requisito externo identificado.

Cada microentrega tem **um único ID permanente**. Não promover por inferência, não apagar o histórico e não transformar CI verde em homologação de HTTP, navegador, RLS ou entrega de e-mail.

## 3. Macroetapas

| ID | Macroetapa | Condição de conclusão | Estado atual |
|---|---|---|---|
| M00 | Controle de execução e continuidade | Plano, cursor e protocolo de revisão incorporados | CONCLUIDO |
| M01 | Onboarding, identidades e convites | Provisionamento → convite → aceite → vínculo de Loja/papel/termos, autorizado e recuperável | PENDENTE_CONFIRMADO |
| M02 | Operações financeiras da Loja | Todos os cenários V35 faltantes reconciliados e homologados; invariantes preservadas | EM_EXECUCAO; timezone aplicada DEV `20261115184137`; Grupo A 5/5 PASS; aceite financeiro específico ainda pendente |
| M03 | Contabilidade, DRE e relatórios completos | Plano publicado com segurança, rubricas validadas, Diário/Razão e exportação integral | BLOQUEADO por decisão contábil (#43) |
| M04 | Operação Master SaaS | Catálogo, contratos, faturamento e suporte nos fluxos aprovados | PARCIAL_HOMOLOGADO_DEV |
| M05 | Privacidade, recuperação e segurança operacional | Portabilidade, retenção, auditoria, backups e recuperação verificáveis | PENDENTE_CONFIRMADO |
| M06 | Paridade integral V35 e qualidade transversal | 21 telas e fluxos de inventário conferidos, inclusive mobile/acessibilidade e regressão direcionada | EM_EXECUCAO; M06.02 CONCLUIDO; timezone aplicada DEV e Grupo A PASS; aceites M06.01/M06.03 ainda pendentes |
| M07 | Release integral e entrada em operação | Ambiente PROD separado, implantação auditada, rollback, aceite do proprietário, Beta liberado | BLOQUEADO por M01–M06 e aprovação específica |

**Progresso percentual:** não informado até existir matriz de aceite por requisito reconciliada com o código. Quantidade de telas presentes não é percentual de conclusão.

## 4. Microentregas rastreáveis

| ID | Entrega verificável | Situação na retomada | Evidência inicial / condição |
|---|---|---|---|
| M00.01 | Criar quadro mestre, cursor e regra de atualização | CONCLUIDO | PR #25 integrado em `639ef08a`; cursor e quadro disponíveis em `main` |
| M00.02 | Reconciliar microentregas de cada macro com inventário e código antes de executar | CONCLUIDO | Reconciliado via `V35_M0201_FINANCIAL_RECONCILIATION.md`, `V35_M0401_MANUAL_BILLING_RECONCILIATION.md` e `V35_SCREEN_PARITY_MATRIX.md` |
| M01.01 | Consumidor idempotente e autorizado do job `onboarding_invite` | INTEGRADO | PR #26 em `b32692dc`; migration DEV `20261109184607`, Edge ACTIVE v1/JWT; end-to-end JWT real/convite **não homologado**, sem envios |
| M01.02 | Claim/lease, retry, expiração, deduplicação e reconciliação de envio Auth | INTEGRADO | PR #28, CI 3/3 PASS; migration DEV `20261109190747` aplicada, permissões/expiração/observação SQL rollback PASS; **retry permanece bloqueado** sem evidência externa e JWT HTTP real não testado |
| M01.03 | Vínculo explícito à Loja, perfil inicial e aceite versionado | INTEGRADO | PR #31 integrado em `0addb828`; CI 3/3 PASS; callback e documento SHA-256 fail-closed; migration/UI/Edge **não publicados DEV**, termos oficiais e JWT real pendentes |
| M01.04 | Homologar convite real DEV com usuário autorizado, negativas e auditoria | BLOQUEADO | Depende de termos oficiais aprovados, ativação técnica M01.03 no DEV, destinatário de teste e autorização separada de envio/JWT real |
| M02.01 | Reconciliar operações financeiras e cadastros V35 | INTEGRADO | [Matriz de requisitos, código e gates](V35_M0201_FINANCIAL_RECONCILIATION.md), PR #33 integrado `a320ca9a`. |
| M02.02 | Implementar lacunas financeiras confirmadas | INTEGRADO | A/B/C/D integradas: PR #34, #37, #38 e #40 / `86f1c626`; migration D aplicada em DEV (`20261113230306` em 13/11); Vitest `CashFlowSnapshot` ampliado (movimentos/estornos/`top_expenses`); aguarda gate DEV [V35_M0203_DEV_GATE.md](V35_M0203_DEV_GATE.md). |
| M02.03 | Aceite funcional financeiro final sem repetir gates equivalentes | AGUARDA_AUTORIZACAO_DEV | Migration D `20261113230306` e timezone `20261115184137` aplicadas; Grupo A HTTP read-only 5/5 PASS em 15/11 (`V35_HTTP_READONLY_GATE_20261115.md`). Restam aceites financeiros específicos e operações persistentes sem evidência equivalente; autorização própria antes de executá-las. |
| M03.01 | Publicação versionada e idempotente do plano contábil | INTEGRADO_COM_GATES_PENDENTES | `AccountingPrepublication.tsx`, RPC `publish_validated_accounting_plan`, migrations DEV `20261009162535`/`20261009165809`, ADRs 0014/0015 e testes UI/SQL A/B rollback já presentes; read-back DEV confirma funções e grants. JWT real, concorrência e UX final não homologados; não reconstruir. |
| M03.02 | Validar com regra de negócio as rubricas e mapeamentos contábeis V35 | AGUARDA_DECISAO_CONTABIL | Sem classificação arbitrária; validar rubricas de dedução, competência, correções e cancelamentos com profissional contábil e proprietário [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43). |
| M03.03 | Completar DRE por rubricas e preservar competência/histórico | PARCIAL_INTEGRADO | PR #42 integrado `b9b0fb54`, CI #463 3/3 PASS; receita registrada, custo, despesas, resultado antes do financeiro e resultado financeiro; Receita Bruta/Deduções/Receita Líquida aguardam classificação por plano/competência [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43); DEV não publicado. |
| M03.04 | Implementar Diário/Razão detalhados e exportação integral conciliável | BLOQUEADO_DECISAO_CONTABIL | V35 requer partidas e contrapartidas balanceadas que as views DRE e caixa não trazem; matriz de eventos [issue #43](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/43). Exportação atual permanece recorte, nunca livro completo. |
| M04.01 | Reconciliar emissão manual SaaS, ciclos e contratos | PARCIAL_RECONCILIADO | [Evidência e gates](V35_M0401_MANUAL_BILLING_RECONCILIATION.md): `MasterBilling`, preview/emissão idempotente, migration e RPCs já existentes no DEV (timestamp DEV a confirmar em `V35_MIGRATION_RECONCILIATION_DEV.md`); anon negado; JWT Master/AAL2 real, ciclos/contratos/preços e faturas reais não homologados. |
| M04.02 | Reconciliar sessões temporárias Master e limites somente leitura | INTEGRADO_COM_GATES_PENDENTES | PR #45 merge `e9976342`, CI #467 3/3 PASS; validação frontend de tenant/escopo/15min e idempotência; Grupo B persistente isolado em `dev-gate/tests/negative-http-authorization.mjs` com assinatura real de 11 parâmetros; sem homologação JWT Master/AAL2 em DEV. |
| M04.03 | Completar operação de jobs, erros, SLA, trilhas e fluxos restantes Master | PARCIAL_HOMOLOGADO_DEV | M04.03-C homologada no DEV (`20261112015957`, release `e6cea23a`); SLA de chamados corrigido (`support.test.ts`); `20261111220000_v35_jobs_read_aal2.sql` **aplicada no DEV sob versão `20261113230344`**; desvio de clique mobile `320 px` em `"Operação e suporte"` corrigido (`styles.css` + `MasterConsole.tsx`); Grupo A read-only pronto em `npm run test:negative-auth:readonly --prefix dev-gate`. |
| M04.04 | Definir integrações de pagamento/fiscal/automação não incluídas no contrato V35 | BLOQUEADO | **Não** ampliar escopo para gateway automático sem decisão comercial e custo aprovado |
| M05.01 | Portabilidade, correção, minimização e retenção de dados no backend | BLOQUEADO_DECISAO | Fluxos pendentes de contrato ou decisão jurídica/contábil: exportação integral via RPC delimitada por `organization_id`; anonimização/esquecimento com retenção mínima de ledger (≥5 anos); restauração pontual por tenant. |
| M05.02 | Backups, restauração comprovada, monitoramento e runbooks operacionais | PR_ABERTO | PR #50 draft: PostgreSQL 17.11 descartável com 77 migrations, restore, 5 checks e diff zero (CI #481 3/3 PASS). Hardening de segurança concluído (9/9 checks PASS). Sem merge nem publicação DEV/PROD; aguarda autorização expressa do proprietário. |
| M05.03 | Termos, consentimento, autorização e segurança de release | PENDENTE_CONFIRMADO | Aceite versionado pronto em código (M01.03), least privilege, MFA e RLS revisados; depende da decisão de termos oficiais e ativação M01.03 no DEV |
| M06.01 | Matriz de equivalência funcional de todas as 21 telas com inventário V35 | EM_EXECUCAO | Timezone aplicada DEV `20261115184137` (Git `20261115120000`), três helpers privados presentes; Grupo A 5/5 PASS preservado. Aceite das 21 telas por requisito permanece incompleto; próximo recorte: view-tesouraria / conciliação truncada ou incoerente M02.02-A, conforme matriz. |
| M06.02 | Desktop/mobile, teclado/acessibilidade, vazio/erro/loading, tema e ergonomia | CONCLUIDO | `534eb6b4`: CI `45529859036` **3/3 PASS** (`static`, `onboarding` com concorrência `C01–C05` + integridade relacional/auditoria em `postgres:17` descartável, `frontend` `625/625`), Workers Builds DEV **SUCCESS** (`3ca9d183` / versão `0f6747d8`), responsividade `320/390/768/1024/1440 px` + teclado + fix `320 px` (`MasterConsole`), ADR-0049 (`20261125002909`) + homologação operacional MASTER/AAL2 DEV (`46499507`, eventos `39, 40, 42, 43, 44`, catálogo restaurado sem resíduos, paginação SQL 2 páginas PASS). **Ressalvas:** paginação visual além da 1ª página **`NOT EVALUATED`**; risco teórico residual de deadlock `40P01` em interleaving inverso (`update_saas_plan_version_draft` × `delete_saas_plan_if_unused`) **não eliminado** (fail-closed via rollback PostgreSQL). |
| M06.03 | Suite final por risco: autorização A/B, integridade, concorrência, regressão e recuperação | EM_EXECUCAO | Reutilizar Grupo A HTTP read-only 5/5 PASS, timezone aplicada/teste transacional registrado, CI base `45686141566` 3/3 PASS e C01–C05 comercial PASS em PostgreSQL descartável. Restam Grupo B persistente no recorte não comprovado, recuperação e regressões por risco sem evidência equivalente. Não executar novamente gates aprovados por troca de sessão. |
| M07.01 | Preparar e isolar PROD, custos, domínio e configuração pública | BLOQUEADO | Não tocar PROD, secrets, Workers existentes ou credenciais sem aprovação |
| M07.02 | Implantação controlada, migrations, backup/rollback e smoke pós-publicação | BLOQUEADO | Apenas após M01–M06 e autorização específica |
| M07.03 | Aceite integral V35 e autorização explícita para Beta/cliente | BLOQUEADO | Beta **apenas após V35 completa** conforme decisão de 03/11 |

## 5. Regra por ciclo de desenvolvimento

1. Ler `docs/V35_SESSION_CURSOR.md`, verificar `git status` e `origin/main` e preservar alterações locais; nunca `reset --hard` por conveniência.
2. Inspecionar **apenas** o domínio da microentrega ativa: contratos, código, migrations, consumidores e evidências relevantes.
3. Reclassificar `A_CONFERIR` somente após evidência. Se já entregue, referenciar commit/PR/teste e **avançar**, sem reconstrução.
4. Executar **uma** microentrega por PR pequeno, com descrição de escopo, riscos, compatibilidade, testes impactados e critérios de aceite.
5. Após CI, registrar separadamente: **codificado**, **integrado**, **publicado DEV**, **homologado DEV**. Merge de baixo impacto DEV segue autorização existente; segurança crítica ou ativação de novos acessos exige autorização específica; PROD sempre exige aprovação.
6. Atualizar o cursor **na mesma revisão** do código e acrescentar o fato à parte superior de `SESSION_HANDOFF.md`; atualizar arquitetura/contexto/ADR/segurança quando o impacto justificar.
7. Não repetir gates aprovados sem mudança material que invalide a evidência; registrar essa justificativa quando houver repetição.

## 6. Definição de concluído

Para marcar um ID como `CONCLUIDO`: requisito e regra de negócio localizados; implementação verificada na revisão indicada; testes pertinentes (inclusive negativas, se acesso/financeiro); ambiente e publication state declarados; evidências/riscos remanescentes escritos; documentação/handoff atualizados. Se algum desses passos for **não aplicável**, justificar. PR aberto ou CI verde sozinho não satisfaz todos os itens.

**Limites permanentes:** Supabase DEV `szqkdekwhzxsoxorgvaz` para trabalhos autorizados; sem produção, mudança de secrets/credenciais, deleção/renomeação de Workers nem leitura de chaves do navegador. Ativação de novas capacidades sensíveis requer aprovação específica.
