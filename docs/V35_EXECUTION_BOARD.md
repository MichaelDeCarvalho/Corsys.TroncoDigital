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
| M02 | Operações financeiras da Loja | Todos os cenários V35 faltantes reconciliados e homologados; invariantes preservadas | EM_EXECUCAO (D no DEV `20261113230306`; P1 timezone codificada em `20261115120000`; aguarda aplicação DEV e gate HTTP read-only) |
| M03 | Contabilidade, DRE e relatórios completos | Plano publicado com segurança, rubricas validadas, Diário/Razão e exportação integral | BLOQUEADO por decisão contábil (#43) |
| M04 | Operação Master SaaS | Catálogo, contratos, faturamento e suporte nos fluxos aprovados | PARCIAL_HOMOLOGADO_DEV |
| M05 | Privacidade, recuperação e segurança operacional | Portabilidade, retenção, auditoria, backups e recuperação verificáveis | PENDENTE_CONFIRMADO |
| M06 | Paridade integral V35 e qualidade transversal | 21 telas e fluxos de inventário conferidos, inclusive mobile/acessibilidade e regressão direcionada | EM_EXECUCAO (responsividade 320/390/768/1440 px homologada pelo Work + fix Master 320 px + ADR-0048 timezone codificada; aguarda aplicação DEV e gate HTTP read-only) |
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
| M02.03 | Aceite funcional financeiro final sem repetir gates equivalentes | AGUARDA_AUTORIZACAO_DEV | Migration D (`20261113230306`) aplicada no DEV; Grupo A somente leitura preparado em `npm run test:negative-auth:readonly --prefix dev-gate` (rejeitando `PGRST202`/`42883`/`22023`); P1 timezone implementada em `20261115120000_v35_tenant_timezone_financial_dates.sql` (`ADR-0048`); aguarda execução do gate HTTP read-only com `.env.dev` e aplicação da migration `20261115120000` no DEV. |
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
| M06.01 | Matriz de equivalência funcional de todas as 21 telas com inventário V35 | EM_EXECUCAO | Matriz das 21 telas atualizada (`V35_SCREEN_PARITY_MATRIX.md`); `20261113123000_v35_tenant_delinquency_buckets.sql` **aplicada no DEV (`20261113230430`)**; **P1 timezone decidida (`ADR-0048`) e implementada em `20261115120000_v35_tenant_timezone_financial_dates.sql`** (aguarda aplicação no DEV). |
| M06.02 | Desktop/mobile, teclado/acessibilidade, vazio/erro/loading, tema e ergonomia | EM_EXECUCAO | Responsividade das 6 telas testadas homologada pelo Work em `320, 390, 768 e 1440 px` (02d698b); corrigida a interceptação de clique em `320 px` no botão `"Operação e suporte"` do `MasterConsole` (`.sidebar` `pointer-events: none` quando fechado + `type="button"`). |
| M06.03 | Suite final por risco: autorização A/B, integridade, concorrência, regressão e recuperação | EM_EXECUCAO | Vitest ampliado (multi-fuso, fronteiras `0..91`, regressão mobile Master `320 px`); `dev-gate` com 13/13 testes PASS e Grupo A read-only isolado (`test:negative-auth:readonly`); `test_tenant_timezone_financial_dates_rollback.sql` preparado; aguarda execução local do gate HTTP pelo proprietário e aplicação da migration `20261115120000` no DEV. |
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
