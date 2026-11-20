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

## M06.02 — drawer transversal NÃO HOMOLOGADO (18/11/2026)

- Base **`a298d5f973cdecee75be2529a5a47d3803143dc0`**; funcional f9f900a; DEV **`105ad0e7-86e6-4886-b382-42fb3c7b2b56`** confirmado. Reutilizado CI 44440984311 **3/3 PASS / 596 testes**; sem novo deploy, suíte ou código funcional alterado. Consultados referência V35 original, inventário, matriz e cursor.
- **A PASS nos mecanismos testados:** clique/Enter/Space dos dois acionadores, Escape/backdrop, ARIA, fechamento por rota e retorno ao acionador correto; acionadores encobertos durante abertura não foram forçados pelo ponteiro.
- **B FAIL — F1/F3:** foco inicial fica em mobileMenu/Menu fora e encoberto; rota ativa tem o mesmo indicador visual com/sem :focus-visible. Tab/Shift+Tab circulam após a primeira tecla; controles fechados não recebem foco nos percursos testados.
- **C FAIL — F2:** abrir em 390 e ampliar para 1024 sem recarga mantém backdrop e trap de teclado no desktop, bloqueando conteúdo. Causa corroborada: estado/listener modal não conciliados com breakpoint. Retorno mobile permite Escape, mas não sana bloqueio desktop.
- Larguras 320/390/768/1024/1440 e 760/960 medidas sem overflow. **761/961 exatos NOT EVALUATED:** navegador aplicou 762/962. Em 390×320, todos os 16 itens alcançáveis, rolagem interna 564 px e página sem rolar.
- **D PASS na UI:** Loja com 15 rotas/títulos/aria-current conferidos, sem Master; Master com 16 itens; cinco atalhos inferiores por perfil. Não é teste de autorização no servidor.
- **Próxima ação única: Gemini corrigir F2 → F1 → F3** com escopo mínimo em AppShell.tsx/styles.css e testes pertinentes; reproduções completas em [SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Não desenvolver outra frente nem refazer chamados Master.
- Drawer **AGUARDA_CORRECAO_GEMINI**; M06.02 geral EM_EXECUCAO; chamados Master permanecem CONCLUIDOS. Documento proposto em PR rascunho sem merge; CI anterior reutilizado, commit documental [skip ci], sem modificar workflows/proteções. Viewports restaurados, sem operações financeiras/persistentes, dados ou configurações de plataforma alterados.

---

## M06.02 — chamados Master encerrados no recorte (18/11/2026)

- Revisão funcional **`f9f900a6306f7a2275fdb3d17f4b7801d75173f8`**, árvore exata `e4e62ba64785efff91e05d49429f5beaf35f63d3`, checkout isolado limpo. CI **44438915012: 3/3 PASS**, check **596/596 testes/85 arquivos**, typecheck/build/dry-run PASS no CI.
- Publicação automática DEV existente confirmada: build `c35879e6-5ed4-4d73-8448-d9f0af2847c9`, versão **`9586c7b2-e230-4248-a179-ba7c173021ad`**. Sem novo deploy manual. Rollback de referência `c110100d-4d25-4b20-afaf-6c768cdbbce6` (d859b16).
- Assets JS/CSS com nomes de conteúdo coincidentes com build local; **SHA-256 CSS remoto/local idêntico**. SHA-256 remoto JS NOT EVALUATED. Não usado bundle CI placeholder.
- **PASS real A/B/C:** interno #10 (Nota interna, Evento interno, sem alerta/formulário cliente); cliente #13 (três mensagens, dois eventos, formulário preservado); alternância sem resíduos ou mistura.
- **PASS D no cenário disponível:** Administração da Loja carregou as três mensagens customer do próprio #13, dois eventos, recarga e formulário preservados. Ausência de nota interna nesse cliente limita a negativa real: **NOT EVALUATED**, com teste automatizado separado e aprovado.
- **PASS smoke 390/1440 px**; reaproveitadas ARIA/foco/seis resoluções anteriores. Paginação real insuficiente e contraste quantitativo continuam **NOT EVALUATED**. Histórico de wrapper local não convertido em PASS.
- **CONCLUIDO apenas o recorte de chamados Master**; M06.02 geral **EM_EXECUCAO**. Nenhuma escrita de dados/configuração/código funcional/PROD; conteúdos e identidades não registrados na nova evidência.
- Próxima prioridade recomendada: **M06.02 — homologação de teclado/foco do drawer transversal (`AppShell.tsx`)**, já implementado e com QA browser pendente na matriz; reconciliar V35 e corrigir apenas defeito demonstrado. Evidência completa no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).
- PR #62 reutilizado com os quatro documentos e histórico preservado; CI e integração documental serão conferidos nesta execução.

---

## M06.02 — acessibilidade Master aprovada no recorte, aceite parcial com FAIL (18/11/2026)

- Revisão funcional `d859b16262c48a16001b7cd778620371f13df3a3`, árvore `d965b9c1d4aa78800c945393d4a40e9177fea3c9`. Checkout isolado recuperado por objetos GitHub e hashes exatos, limpo; alterações do workspace antigo preservadas.
- CI 44429221490 **3/3 PASS**. Local: typecheck, 591 testes/85 arquivos e build executados; wrapper de `npm run check` não disponibilizou exit agregado após build, portanto gate agregado local **NOT EVALUATED**. Dry-run local Wrangler 4.156.1 **PASS/exit 0**, logs redirecionados ao workspace.
- Workers Builds confirmou publicação automática existente do HEAD: build `6fc04cf6-a726-46ba-a2f7-0b8ce307c876`, versão DEV **`c110100d-4d25-4b20-afaf-6c768cdbbce6`**. Sem novo deploy. Rollback de referência: base f65848bf, versão `6a43db80-7bd6-476a-9f31-9f0a07e8d1b5`.
- JS `index-DxjyA-rF.js` e CSS `index-CPLBN8x7.css` carregados no DEV coincidem com nomes de conteúdo do build local; SHA-256 remoto e chunk não carregado NOT EVALUATED.
- Sessão Master existente no navegador integrado acessou consultas protegidas. **PASS real:** estado/ARIA, clique, Enter/Space, alternância, tabulação sem controles ocultos, foco efetivo em Recolher e retorno ao Detalhes correto (#13/Enter e #10/Space), conversa do cliente #13, separação visual de escopo, buscas, limpar, atualizar/foco e Mostrar todos.
- **PASS de contenção nas seis resoluções** 320/390/428/768/1024/1440; documento clientWidth=scrollWidth em todas. Medidas completas e limites de contraste visual em [SESSION_HANDOFF.md](../SESSION_HANDOFF.md). Paginação real/foco entre páginas **NOT EVALUATED**: seis chamados, página de 25; sem registros artificiais.
- **FAIL reproduzido duas vezes:** abrir conversa interna #10 (`6845109b-c3fa-47a4-b226-fe6415d4edf6`) mostra “Não foi possível validar o histórico desta conversa.”; cabeçalho/evento interno corretos, conversa de cliente #13 carrega. Causa e vínculo com d859b16 **NOT EVALUATED**.
- **Próxima prioridade M06.02:** diagnosticar somente a leitura de mensagens internas #10 e propor correção mínima apenas com evidência, preservando validações e autorização; conferir término do wrapper local. Sem mudança funcional autorizada nesta homologação. Recorte integral **EM_EXECUCAO / aceite parcial com FAIL**, não CONCLUIDO. Histórico inicial de bloqueios abaixo foi superado quanto a checkout e sessão, não apagado.

---

## M06.02 — homologação dos chamados Master bloqueada (18/11/2026)

- Revisão alvo: `d859b16262c48a16001b7cd778620371f13df3a3`; base `f65848bfdc5994fa967d928267bb9267b8c76ecc`. GitHub confirma diff de três arquivos; cursor/handoff preservados.
- CI [44429221490](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44429221490): **3/3 PASS**. Log frontend confirma check (591 testes/85 arquivos; MasterSupportQueue 12/12), build e dry-run PASS **no CI**.
- Workspace local em `20b093f08f3330130050c6b3925481e854cbed79`, sujo e preservado. Clone isolado falhou com `Could not resolve host: github.com`; checkout íntegro, check/dry-run locais e build comparável indisponíveis.
- DEV abriu no Edge com sessão de Administração da Loja/Tenant A; Master AAL2 não confirmado. Não houve publicação, mudança funcional, mutation de banco ou alteração Auth/MFA.
- **BLOQUEADO:** homologação real de disclosure/teclado/foco, filtros/paginação, escopo/conversa e seis resoluções **NOT EVALUATED**. Versão DEV atual/assets/rollback não verificados. Detalhes e matriz de evidências no início de [SESSION_HANDOFF.md](../SESSION_HANDOFF.md).
- Próxima prioridade continua **este recorte M06.02**: obter checkout isolado íntegro com acesso ao GitHub, confirmar sessão Master AAL2 autorizada, publicar exclusivamente a revisão alvo no DEV pelo procedimento versionado e homologar os critérios pendentes. Não encerrar nem avançar por CI verde. Nenhum defeito demonstrado para remediação/Gemini.

---

## V35 — consolidação Dashboard Mobile e próxima microentrega M06.02 (18/11/2026)

- Decisão do proprietário nesta sessão: investigação e desenvolvimento de Dashboard Mobile/Novo Ágape encerrados na revisão funcional `a3a8c1b0acce1b8e425afed37248d5a919d92fa2`. A M06.02 integral continua EM_EXECUCAO.
- Evidência direta anterior do Work preservada abaixo: DEV `a5db79ae-ad74-457a-93c7-a84b44723f61`, hashes JS/CSS coincidentes, cenário A e regressões aprovados.
- Evidência complementar fornecida pelo proprietário, atribuída ao Codex, em Chromium real com Playwright e fixtures locais sobre `a3a8c1b0`: B PASS com 0 px no atraso controlado; C PASS incluindo scrollIntoView; D PASS funcional para HTTP 500, 42501 e 28000, seis placeholders sem valores indevidos e recuperação; 12/12 acionamentos residuais corretos, inclusive com 3,47 CSS px de folga; deslocamento visual máximo reportado de 0,59 CSS px e compensação natural de rolagem pelo Chromium, sem reposicionamento artificial pelo script. Esses experimentos foram informados pelo proprietário e não foram executados nem repetidos pelo Work nesta consolidação; artefatos externos não foram anexados ao PR.
- Ressalva preservada: FAIL no critério documental de tolerância de 1 CSS px. Esse limite não era requisito numérico original e não foi demonstrado defeito funcional associado. Não reinterpretar o FAIL como PASS nem deduzir seu cálculo a partir do deslocamento visual máximo informado.
- Residual: testes controlados no Cloudflare DEV autenticado permanecem NOT EVALUATED e devem ser concluídos antes da liberação aplicável em produção. Por decisão do proprietário, essa pendência não bloqueia outras entregas independentes da M06.02.
- Próxima microentrega recomendada para o Gemini: acessibilidade da expansão de detalhes da fila Master de suporte (`view-master-operacao`). Inspeção da main encontrou botão “Detalhes do chamado #…” sem `aria-expanded`/`aria-controls` e linha expandida sem identificador de painel. Revisar contra HTML original e preservar a consulta e os controles já existentes; corrigir o vínculo e o estado acessível do disclosure e o retorno de foco ao recolher quando necessário.
- Aceite do próximo recorte: expansão/recolhimento por Enter e Space; estado acessível e associação botão/painel corretos; retorno de foco previsível ao Recolher; identificadores longos, tabela e paginação contidos em 320/390/428/768/1024/1440 px; estados vazio/erro/loading distinguíveis; regressões de filtros/paginação e escopo da Loja preservadas. Arquivos prováveis: `MasterSupportQueue.tsx`, teste existente correspondente e `ResponsiveLayout.test.tsx`; `styles.css` apenas se houver defeito reproduzido. Homologação Master real depende de sessão autorizada AAL2. Nenhuma sessão de suporte, resposta ou alteração de ticket integra o teste de leitura.
- Dependências externas continuam registradas no quadro: M01.03/M01.04 ativação e termos; M03 decisão contábil #43; M05 política jurídica/recuperação e gates de release. Reconciliar o estado atual antes de executar essas frentes, pois o backlog inclui registros históricos.

---

## V35 — Dashboard Mobile: homologação parcial independente (18/11/2026)

- Revisão `a3a8c1b0acce1b8e425afed37248d5a919d92fa2`, CI 44394038164 com frontend/onboarding/static PASS. Cópia isolada limpa e build Vite exit 0. DEV já publicado em `a5db79ae-ad74-457a-93c7-a84b44723f61`; sem republicação. Assets públicos e locais idênticos: JS SHA256 `4bfe90ed33618ea19563792ace48de209333c72e488786c6726c5cb513536611`, CSS `d097c336347da0070d63898805dea564882ff010f7a98bd126589e49cb50d404`. Referência de rollback preservada da base homologada: `52ffabb6-4dce-4672-b564-61bd6207c242` / `73d5f8a`.
- Cenário A PASS: centro, lateral e Enter abriram Financeiro/Ágapes nas quatro resoluções (12 acionamentos). Em 320×800, retângulo do botão [26,8;257,7;251,2;108,4], scrollY 1918,4, barra iniciando em 734,9. Em 390×844, [26,8;279,9;321,6;108,4], scrollY 1787,2, barra em 778,9. Em 768×900 e 1440×900, retângulos [494,3;375,5;211,7;148,4] e [742,9;364,4;199;171,2], scrollY 900,8 e 748. Sem overflow nas medições (305/305,375/375,753/753,1425/1425).
- Cenário B controlado NOT EVALUATED: ferramenta não expõe interceptação seletiva de RPC nem listeners para pointerdown/pointerup/click. Duas transições naturais em 320×800 capturaram seis placeholders → seis KPIs com docY 2176,137 e delta 0 px, scrollY 0. Isso acrescenta evidência de estabilidade sem cumprir o atraso controlado exigido.
- Cenário C parcial: foco por teclado posicionou integralmente Novo Ágape acima da barra móvel nas duas resoluções mobile e manteve hit-test no próprio botão. Os cinco controles móveis funcionaram (Início, Integrantes, Financeiro, Inadimplência e Menu). scrollIntoView explícito NOT EVALUATED pela API disponível; desktop e tablet sem barra inferior visível.
- Cenário D controlado NOT EVALUATED. Uma falha real da consulta manteve seis placeholders, zero botões dentro deles, nenhum valor em R$, e mensagem “Os indicadores financeiros não puderam ser verificados. Valores não são exibidos.” Atualizar indicadores recuperou os cartões. Negação simulada de acesso não executada.
- Regressões PASS no recorte: destinos dos seis KPIs e dez atalhos por Enter, preservação de nome não salvo na reentrada da mesma rota, seção padrão após saída/retorno e rascunho vazio em outra Loja de teste. Nenhum formulário enviado.
- Correção específica ainda pendente de homologação final por B/D controlados, alvos reais dos eventos e scrollIntoView explícito. Completar esse recorte com navegador que permita interceptação da única RPC e observação dos eventos, preservando código, permissões e dados. M06.02 integral segue aberta.

---

## V35 — M06.02: estabilização dos KPIs no Dashboard mobile e folga de rolagem da `.mobile-nav` (18/11/2026)

- **Base analisada:** GitHub `main` `47d728a8b4c2189bc6092456340af0edb4709b63` (CI GitHub Actions `44390518135` 3/3 PASS sobre `73d5f8a9da5396f465d8efeeb464b1fd217b668d`).
- **Mecanismos e ajustes pré-homologação aplicados:**
  1. **Deslocamento vertical na chegada assíncrona e nos estados terminais dos KPIs (`1.207,5 px` medidos em `320 × 800 px`):** `src/components/FinancialDashboard.tsx` renderiza `data-testid="financial-kpi-placeholders"` (`className="metric-grid" aria-hidden="true"`) com 6 cartões estruturais `.panel.metric.metric-placeholder` sempre que `!values` (`loading`, `denied` ou `error`), utilizando o título e a descrição estáticos de cada KPI com `<strong>—</strong>` (sem valores monetários fictícios e sem expor `<button>`). Isso evita o colapso de altura tanto na chegada dos indicadores quanto nas transições terminais de erro ou acesso negado (`42501`/`28000`).
  2. **Mock de RPC em `src/components/WorkspaceDashboard.test.tsx`:** captura a implementação original via `base.rpc.getMockImplementation()!` antes de interceptar `read_tenant_financial_dashboard`, eliminando recursão nas demais RPCs e comprovando a resolução de `read_tenant_daily_cash_flow`.
  3. **Folga de rolagem da barra móvel fixa (`.mobile-nav`, `y = 734,9..800 px` em `320 × 800 px`):** preservada em `src/styles.css` (`--mobile-nav-clearance: calc(88px + env(safe-area-inset-bottom, 0px))` em `scroll-padding-bottom`, `scroll-margin-bottom` e `padding-bottom` com `safe-area-inset-bottom`).
- **Preservação:** `Workspace.tsx`, `Finance.tsx`, `AppShell.tsx`, Auth, MFA, RLS, RBAC, contratos de RPC, banco e Cloudflare PROD inalterados.
- **Próxima ação:** sincronizar com GitHub, aguardar CI 3/3 PASS, publicar no Cloudflare DEV (quando autorizado) e executar no ChatGPT Work o reteste geométrico real em `320 × 800 px`.

---

## V35 — M06.02: navegação Master no DEV com revisão identificada (15/11/2026)

- Login confirmado pelo proprietário e sessão Master observada no Edge após a recuperação do Cloudflare DEV principal. Worker `325b1f83-3d3f-4230-8e53-3eeafb2768d8`, build da main `9e0ff0a9ac9e2b0511925c7d8e2e82daa7d2a907`, entrada `index-Ca9UP64Z.js` idêntica ao build local. TypeScript, 85 arquivos Vitest, Vite e dry-run aprovados. O Supabase DEV aceitou a chave pública publicada (HTTP 200 na consulta de configuração de Auth). A cópia antiga ainda tem a configuração rejeitada.
- Abertas as seis telas Master em 320, 390, 768 e 1440 × 900 px (24 navegações). A aba selecionada foi confirmada e não houve overflow horizontal da página nesse recorte. A tabela de Clientes SaaS apresentou rolagem interna a 320 px. Busca sintética sem correspondência removeu as linhas e Limpar filtros restaurou a listagem.
- Menu a 320 px, com o bundle identificado: foco inicial em Início, Tab/Shift+Tab circularam entre primeiro e último itens, Escape fechou o drawer e restaurou o foco no botão Abrir menu. O comportamento anterior de Escape não foi reproduzido nessa versão.
- As 21 rotas foram abertas ao menos uma vez nas quatro larguras ao longo dos dois recortes (15 Loja no bundle anterior e seis Master no atual). Isso comprova navegação e medição nos recortes, com paridade visual/funcional integral ainda pendente. Revalidar Cadastros e Plano de Contas com o patch do PR #57 em ambiente publicado. Nenhuma ação persistente foi executada na auditoria Master.

---

## V35 — M06.02: auditoria autenticada da Loja e abas responsivas (15/11/2026)

- O proprietário conseguiu entrar no Edge com a mesma conta que apresentou erro genérico no navegador interno do Work. A causa desse erro permanece indeterminada. A sessão existente do Edge permitiu leitura no DEV.
- Foram abertas as 15 rotas de Loja nas quatro larguras solicitadas (60 navegações). Este recorte cobre navegação inicial e medição horizontal, com confirmação da causa em duas telas. A verificação detalhada de estados, filtros, tabelas e paridade visual permanece pendente, assim como as seis telas Master, que não estavam acessíveis nessa sessão.
- Overflow reproduzido no DEV: Cadastros a 320 px (documento de 357 px) e Plano de Contas a 320 e 390 px (434 px). Nas duas telas, a fila de abas estava em flex sem quebra de linha. A correção permite quebra apenas nessas duas filas e aguarda revalidação no navegador com a revisão corrigida.
- Em 320 px, Escape deixou o drawer aberto no DEV observado. A main `9e0ff0a` já contém o tratamento de Escape em `AppShell.tsx`. Validar com um bundle rastreável dessa revisão ou posterior antes de alterar o menu.

---

## V35 — M06.01/M06.02: auditoria inicial do Cloudflare DEV no Work (15/11/2026)

- GitHub `main` confirmada em `9e0ff0a9ac9e2b0511925c7d8e2e82daa7d2a907`, merge do PR #56. [Foundation checks #514](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/43787149625) passou nos três jobs no head do PR. O proprietário reportou TypeScript, Vitest 582/582 e Vite build aprovados na cópia local após a atualização do teste.
- Cloudflare DEV acessível no navegador Work. O HTML servido aponta para `index-BlX9kh_-.js` e `index-DW5QeZdM.css`, compatíveis com o log do proprietário. Worker `080970ed-368b-47f2-a4b6-d06342622917` informado pelo proprietário. A origem em um ZIP com ajuste manual impede atribuir o bundle ao SHA exato da main apenas por esses nomes.
- Tela pública de login medida em viewports de 320/390/768/1440 × 900 px. Largura do documento de 320/375/753/1440 px, respectivamente, sem overflow horizontal de página. Os campos e botões medidos couberam horizontalmente. Em 320 e 768 px, o botão de recuperação exige rolagem vertical para visualização completa a 900 px de altura. Esse recorte é uma medição do login público.
- Matriz e HTML de referência têm os mesmos 21 IDs. M06.01/M06.02 seguem pendentes de auditoria autenticada no DEV publicado, incluindo comparação visual/funcional com a referência, menu por clique e teclado, filtros e tabelas. Gate HTTP somente leitura 5/5 informado pelo proprietário, Grupo B persistente pulado.
- Próxima ação: abrir no navegador Work uma sessão DEV com conta de teste autorizada e concluir MFA quando exigido. Executar o recorte de leitura Master e Loja nas quatro larguras e propor correções localizadas somente quando houver reprodução.

---

## V35 Fechamento dos Gates M02.03 / M04.03 / M06 — Roteiro HTTP Read-Only, Master Mobile 320 px e Data Civil por Fuso da Loja (15/11/2026)

## V35 — Testes intermitentes do Dashboard na suíte local completa (15/11/2026)

- **Evidência do proprietário:** Windows PowerShell, Node 24.20.0, cópia atualizada `5c06ecb9`: `npm.cmd run check` interrompido em Vitest com **580 PASS / 2 FAIL** (85 arquivos: 84 PASS, 1 FAIL), ambos em `WorkspaceDashboard.test.tsx`, nos seletores `Consolidado` e `Total a receber`. A execução isolada do mesmo arquivo retornou **7/7 PASS**.
- **Diagnóstico delimitado:** o dashboard é montado após consultas assíncronas de Loja/dados; o `findByRole` destes dois testes tinha timeout implícito de 1 segundo. Em execução concorrente, os controles não estavam prontos até o limite. A leitura isolada e o CI anterior não reproduziram a falha.
- **Correção neste PR:** aguardar o título semântico `Atalhos e Ações Rápidas` como sinal real de que `TenantPanel` terminou de carregar, com timeout máximo de 8 segundos; em seguida verificar `Consolidado` imediatamente. O KPI `Total a receber` mantém sua espera individual de até 8 segundos devido à RPC independente. Não alterar implementação, asserções de navegação, dados, timers globais ou regras financeiras.
- **Evidência pendente:** rerun da suíte completa na cópia Windows e CI do PR; build Cloudflare DEV e publicação **não realizados**. Se a falha persistir, investigar a ordem e integridade das consultas ao invés de simplesmente aumentar timeouts.
- **Próxima ação:** integrar mediante CI 3/3 PASS; atualizar apenas o arquivo de teste na cópia local ou usar nova `main`, executar `npm.cmd run check`; só então continuar publicação controlada DEV.

---


## V35 — M06.02: acessibilidade do menu mobile (15/11/2026)

- **Defeito em código:** `AppShell.tsx` não fechava o menu lateral com Escape, deixava o foco no elemento anterior ao abrir e não limitava a tabulação à navegação expandida; no CSS, o menu deslocado para fora da tela podia permanecer navegável por teclado.
- **Correção mínima em revisão:** foco inicial no primeiro item ao abrir, Escape fecha/restaura o foco ao botão de origem, Tab/Shift+Tab permanecem nos itens do menu, clique no backdrop e seleção de rota restauram o foco. CSS `@media (max-width: 960px)` adiciona `visibility: hidden` ao menu fechado e `visible` ao aberto; desktop permanece inalterado.
- **Regressão:** `ResponsiveLayout.test.tsx` inclui cliques, Escape, armadilha de Tab, backdrop e regressão de CSS de menu fechado, sem novas dependências.
- **Evidência:** verificar CI e revisão de diff do PR; QA físico em 320/390/768 px, leitor de tela e publicação Cloudflare DEV **não executados** nesta microentrega.
- **Deploy:** o projeto possui `npm run deploy:dev` com `wrangler.dev.jsonc`; GitHub CI faz apenas `--dry-run`. Autenticação Wrangler/Cloudflare e smoke test pós-publicação requerem ambiente autorizado, sem usar PROD.
- **Próxima ação:** integrar o PR caso CI PASS, executar deploy DEV com credenciais no ambiente do proprietário e homologar navegação mobile/desktop contra referência V35 (eventualmente usando Gemini como auditor visual sem compartilhar segredos).

---


## V35 — M06.02: continuidade de período no Fluxo de Caixa (15/11/2026)

- **Correção no código:** `FluxoCaixa.tsx` passa a preservar a instância de `DailyCashFlow` quando alterna Consolidado / Projetado / Receitas × Desp. / Saldo. O período selecionado não é descartado por troca de modo; mudança de `organizationId` mantém remount e reinicialização de contexto.
- **Regressão adicionada:** `FluxoCaixa.test.tsx` valida datas após os quatro modos e confirma reset ao trocar de Loja. Sem mudança de RPCs, valores, RLS, controle financeiro ou banco.
- **Validação:** CI e QA browser pendentes de execução; não declarar homologação visual somente por teste React.
- **Próxima ação:** revisar CI/PR e continuar M06.01/M06.02; agrupar implantação dos incrementos em Cloudflare DEV quando especificamente autorizada.

---


## V35 — M06.01/02: histórico de versões de planos (15/11/2026)

- **Escopo pontual em revisão:** `view-master-planos`, histórico de versões, controles V35 `F001–F003` e `A002`. Adicionados filtros por data inicial de vigência, data final para filtrar a vigência **inicial** da versão, situação e botão `Limpar filtros` com total visível, conforme `docs/pilot/v35-planos-ofertas.reference.html` (seção `view-master-planos`, `applyVersionFilters`).
- **Fonte da consulta:** `loadPlatformCommercialCatalog` continua recuperando catálogo completo em modo somente leitura, com bloqueio de catálogo incompleto (>200 itens) e validações já existentes. Filtragem aplicada localmente ao conjunto **completo validado**, sem consulta paginada parcial, alteração de RLS, preço, assinatura, faturamento, publicação ou banco.
- **Evidência de desenvolvimento:** testes de componentes em `MasterCommercialCatalog.test.tsx` cobrem limites inclusivos, situações `future`/`inactive`, limpeza, ausência de resultados e isolamento de consulta; CI/QA visual devem ser registrados após execução (não declarar homologado DEV por código integrado).
- **Próxima ação:** CI e revisão do PR, depois QA real desktop/mobile dos filtros no Worker DEV somente mediante publicação especificamente autorizada; continuar M06.01/02 em lacunas comprovadas do inventário das 21 telas.

---


## V35 — M06.01/02: filtros reais no Master Cobrança (15/11/2026)

- **Entrega em PR #52:** `view-master-cobranca`: filtros de leitura por número da fatura, status e competência em consulta server-side, sob a Loja selecionada e antes da paginação. Incluídos reset de filtros ao trocar de Loja, validações de valores inválidos e escape de curinga ILIKE.
- **Evidência técnica:** pipeline GitHub Actions `Foundation checks` 3/3 PASS (static/onboarding/frontend) na revisão `4d033eb78492ad082d68776f5bafc992b7edc9ae` antes das atualizações exclusivamente documentais; testes específicos `MasterBilling.test.tsx` ampliados. Não houve teste browser/HTTP desta nova UI, nem deploy.
- **Próxima ação:** após integração, homologar filtros de faturas na tela Master usando DEV e continuar M06.01/M06.02 no inventário das 21 telas. Limitações de cobrança automática/registro de pagamento, termos, dados pessoais e contabilidade permanecem.
- **Preservação:** nenhum dado financeiro alterado, nenhuma migration, role, RLS, segredo ou PROD tocado.

---


## V35 — Retomada após gate HTTP 5/5 (15/11/2026)

- **Entrega confirmada pelo proprietário:** `npm.cmd run test:negative-auth:readonly --prefix dev-gate`, Grupo A **5/5 PASS** com JWT reais, negativa cross-tenant bidirecional, usuário sem `finance.read`, Master AAL1 negado e Master AAL2/TOTP autorizado. **Grupo B persistente SKIPPED** por padrão.
- **Correção incorporada neste PR:** adicionar `p_page: 0` à RPC `read_tenant_cash_flow_detail` no cenário `noFinanceClient`, mantendo `PGRST202` como falha (nunca negativa válida).
- **Evidência delimitada:** [V35_HTTP_READONLY_GATE_20261115.md](V35_HTTP_READONLY_GATE_20261115.md). Não equivale a homologação das operações persistentes, dos 21 fluxos visuais, de recuperação nem de PROD.
- **Próxima microentrega ativa:** **M06.01/M06.02 — reconciliação e conclusão funcional/visual da paridade V35**, a partir da referência imutável `docs/pilot/v35-planos-ofertas.reference.html`, inventário e matriz de 21 telas. Priorizar lacuna comprovada e testar isoladamente, sem recriar telas existentes.
- **Continuam bloqueadas:** M01.03/04 (termos e convites), M03.02–04 (contabilidade, issue #43), M05.01 (LGPD), M05.02/Grupo B conforme autorização separada, M07 (PROD).
- **Base do registro:** GitHub `main` `8461e92760041bb4f76901e714fa6e4d6bbb0f8b` + correção de teste neste PR; homologação HTTP realizada na cópia Windows do proprietário.

---


- **Situação (sobre HEAD `02d698b35074902be9291984216e55a6809b2b9e`):**
  1. **ENTREGA 1 (Roteiro HTTP Somente Leitura — `dev-gate/`):** `dev-gate/tests/negative-http-authorization.mjs` separado em **Grupo A (Somente Leitura — padrão `--readonly`)** e **Grupo B (Persistente — bloqueado sem `--include-persistent` + `ALLOW_DEV_PERSISTENT_AUTH_TESTS=true`)**. Asserções em `dev-gate/tools/isolation-assertions.mjs` endurecidas para rejeitar falsos `PASS` (`PGRST202`, `42883`, `22023`) e validar sucesso de RPC autorizada (`assertAuthorizedRpcSuccess`). Assinatura de `create_institutional_payable` no Grupo B alinhada aos 11 parâmetros reais (`p_accounting_period`).
  2. **ENTREGA 2 (Master Mobile `320 px`):** Identificada e corrigida a interceptação de ponteiro do drawer `.sidebar` em `@media (max-width: 960px)` (`pointer-events: none` quando fechado e `pointer-events: auto` quando `.sidebar.open` em `src/styles.css`, mais `type="button"` nos 8 botões de `.finance-sections` em `src/components/MasterConsole.tsx`), que fazia o clique por coordenada em `"Operação e suporte"` atingir o 8º botão do menu lateral (`DRE Contábil`) na mesma altura vertical. Teste de regressão adicionado em `src/components/ResponsiveLayout.test.tsx`.
  3. **ENTREGA 4 (Regra de Data Financeira por Fuso da Loja — `ADR-0048`):** Aprovada pelo proprietário e implementada na migration aditiva `supabase/migrations/20261115120000_v35_tenant_timezone_financial_dates.sql` (`private.is_valid_iana_timezone`, trigger/constraint `22023` em `organization_settings.timezone`, `private.tenant_current_date_at` e `private.tenant_current_date` aplicados ao Dashboard, Inadimplência e 16 comandos/consultas financeiras e contábeis), com teste SQL rollback (`supabase/tests/test_tenant_timezone_financial_dates_rollback.sql`) e testes multi-fuso/fronteiras em `src/lib/delinquency-report.test.ts`.
- **Execução local do Gate HTTP:** `BLOCKED` no container local por ausência proposital de `.env.dev` com credenciais privadas; script pronto para execução direta pelo proprietário via `npm run test:negative-auth:readonly --prefix dev-gate`.
- **Próxima ação única:** Sincronizar com `main`, aplicar `supabase/migrations/20261115120000_v35_tenant_timezone_financial_dates.sql` no Supabase DEV e executar `npm run test:negative-auth:readonly --prefix dev-gate` na máquina local do proprietário.

---

## V35 Master Execution Controller V2 — Correções P0, Paridade V35 e Fechamento Local (13/11/2026)

- **Situação:** Corrigida a regressão P0 em `loadDelinquencyPage` (`read_tenant_delinquency` restaurada para `delinquency-export.ts`) e os 4 defeitos críticos da inadimplência global (`20261113123000_v35_tenant_delinquency_buckets.sql`, `delinquency-report.ts`, `DelinquencyReport.tsx`): `42883`/`PGRST202` isolados como `migrationPending`, remoção de `p_limit: 1000` client-side, eliminação de `.catch(() => [])` e de fallback para relógio local do navegador, cards com `<button aria-pressed>`, checagem de `integrity_ok` e retorno determinístico das 4 faixas no SQL, além de exportação `XLSX` e `Imprimir / PDF`.
- **Paridade V35 avançada no código:** `Workspace.tsx` com `role="group"`/`aria-pressed`, botão expandir fluxo (`aria-expanded`) e atalhos operacionais ligados a `Finance.tsx` (`initialSection`); `Relatorios.tsx` com aba `'inadimplencia'` ativa; `Members.tsx` sem datas fixas de 09/2026 e usando leitura real via `public.v_member_communication_status`; limpeza de import morto em `PlanoContas.tsx`; atualização da matriz das 21 telas em `docs/V35_SCREEN_PARITY_MATRIX.md`.
- **Ambiente DEV/PostgreSQL local:** Nenhuma migration ou comando remoto executado; `psql`/`postgres` ausentes no container local, portanto execução runtime em PG17 descartável permanece pendente para o fluxo de DEV/CI.
- **Próxima ação única:** Aplicar no Supabase DEV, em ordem controlada pelos runbooks, `20261110220000_v35_cash_flow_detail.sql` (M02.03), `20261113123000_v35_tenant_delinquency_buckets.sql` (M06.01 Inadimplência Global) e `20261111220000_v35_jobs_read_aal2.sql` (M04.03-B), mantendo `20261109233000` (M01.03) dependente dos termos jurídicos e mantendo M03.02–M03.04 (`#43`) e M05.01 aguardando decisão humana.

---

## V35 M06.01 — Conclusão da Inadimplência Global (`view-inadimplencia`) com RPCs no PostgreSQL (13/11/2026)

- **Situação:** Criada a migration versionada `supabase/migrations/20261113123000_v35_tenant_delinquency_buckets.sql` implementando as funções de banco `read_tenant_delinquency_bucket_summary` (totais globais autoritativos por faixa de atraso) e `read_tenant_delinquency_filtered` (paginação server-side com filtro opcional de faixa e data de referência determinística). Atualizado o serviço frontend (`delinquency-report.ts`) e o componente (`DelinquencyReport.tsx`) para consumir as novas RPCs com graceful fallback para DEV.
- **Verificação:** `compile_applet` PASS, `lint_applet` / typecheck PASS, `FinancialDashboard.test.tsx` (5/5 PASS) e `DelinquencyReport.test.tsx` (7/7 PASS) executados com sucesso.
- **Próxima ação única:** Avançar para a próxima microentrega funcional da matriz de paridade (`view-financeiro`).

---

## V35 M06.01 — Ajustes finais do Dashboard e implementação de Inadimplência por faixas (`view-inadimplencia`) (13/11/2026)

- **Situação:** Ajustes de acessibilidade no Dashboard (`FinancialDashboard.tsx` utilizando botões semânticos reais e rotas de navegação alinhadas aos requisitos `view-dashboard-A001` a `A005`). Implementada na tela de Inadimplência (`DelinquencyReport.tsx`) a filtragem interativa por faixas de atraso (Até 30 dias, 31–60, 61–90, Acima de 90) com banner indicativo e botão para limpar filtro.
- **Verificação:** `compile_applet` PASS, `lint_applet` / typecheck PASS, `FinancialDashboard.test.tsx` (5/5 PASS) e `DelinquencyReport.test.tsx` (8/8 PASS) executados com sucesso.
- **Próxima ação única:** Avançar para a próxima microentrega funcional da matriz de paridade (`view-financeiro`).

---

## V35 M06.01 — Integração dos modos do Dashboard e navegação dos indicadores (`view-dashboard` A001–A009) (13/11/2026)

- **Situação:** Integrados na página `home` (`Workspace.tsx`) os três modos originais da V35 do Dashboard (`consolidado`, `movimentos` / Receitas x Desp., e `saldo` — requisitos `view-dashboard-A007`, `A008`, `A009`), controlando dinamicamente a exibição em `DailyCashFlow`. Implementada também a navegação funcional a partir dos 6 KPIs financeiros canônicos (`FinancialDashboard.tsx` — requisitos `view-dashboard-A001` a `A005`) direcionando para as páginas de destino correspondentes (`contas-receber`, `inadimplencia`, `fluxo-caixa`, `tesouraria`, `contas-pagar`).
- **Verificação:** `compile_applet` PASS, `lint_applet` / typecheck PASS, testes unitários `FinancialDashboard.test.tsx` (5/5 PASS) e suíte geral PASS.
- **Próxima ação única:** Avançar para a próxima microentrega funcional da matriz de paridade (`view-inadimplencia` ou `view-financeiro`).

---

## V35 M06.01 — Finalização e alinhamento estrito do Dashboard (`view-dashboard`) (12/11/2026)

- **Situação:** Removidas do `FinancialDashboard.tsx` as métricas e razões não aprovadas (comparação entre períodos distintos de `received_this_month` e `payables_open`, bem como estimativa de posição líquida de patrimônio). Preservados integralmente os 6 KPIs financeiros canônicos calculados pelo backend (`read_tenant_financial_dashboard`), com isolamento por `organization_id` e tratamento fail-closed.
- **Verificação:** Suíte `FinancialDashboard.test.tsx` (5/5 PASS) e `DelinquencyReport.test.tsx` (8/8 PASS) executadas e aprovadas com sucesso.
- **Próxima ação única:** Avançar para a próxima microentrega funcional da matriz de paridade (`view-inadimplencia` ou `view-financeiro`).

---

## V35 M06.01 — Correção de SLA de chamados, robustez de durações e testes de CI (12/11/2026)

- **Situação:** Correção de SLA de chamados (`loadTenantTickets` usando o read-model `v_saas_support_ticket_metrics` e escopo `ticket_scope = 'tenant'`), sanitização estrita de durações (sem `NaN`), suíte dedicada de testes `src/lib/support.test.ts` (8/8 PASS) e correção de sincronização assíncrona no teste `MasterSupportSessions.test.tsx` concluídas com sucesso.
- **Microentrega ativa (M06.01):** Correções funcionais e paridade da tela de chamados (SLA e métricas) 100% verificadas.
- **Próxima ação única:** Avançar para a próxima microentrega funcional prioritária da matriz de paridade (`view-dashboard` ou `view-inadimplencia`).
- **Verificação:** `compile_applet` PASS, `lint_applet` / typecheck PASS, testes unitários PASS.

---

## V35 M05.02 — Fixture sintética e checks de restauração preparados (11/11/2026)

- **M05.02 PREPARADA (Ensaio local: NÃO TESTADO; aguarda execução observada em PostgreSQL 17):**
  - Entregues os artefatos executáveis: runner `scripts/run_v35_m05_backup_restore_trial.sh`, bootstrap `scripts/v35_m05_prepare_source_db.sql`, carga `scripts/v35_m05_fixture_seed.sql` e asserções `scripts/v35_m05_backup_verify_checks.sql`.
  - **Correção da dependência rls_auto_enable**: Identificada a origem como função de event trigger da plataforma Supabase (`ensure_rls` / `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Incluída a definição completa em `scripts/v35_m05_prepare_source_db.sql` antes da aplicação das migrations, desbloqueando a linha 17 de `20261002202518_harden_anonymous_rpc_permissions.sql` sem alterar a migration histórica.
  - **Correção da validação SQL**: Removida a metainstrução `\set ON_ERROR_STOP on` de `scripts/v35_m05_backup_verify_checks.sql`, preservando a flag `-v ON_ERROR_STOP=1` nas invocações psql do runner e do runbook. As 5 assertivas e o marcador `V35_M0502_VERIFICATION_PASS` foram preservados integralmente.
  - **Correção de dependências frontend**: Lockfile regenerado e validado com sucesso via `npm ci --ignore-scripts` (218 pacotes auditados, 0 vulnerabilidades).
  - Estado da restauração: **NÃO TESTADO** no container local do AI Studio por ausência de cluster PostgreSQL local; M05.02 transiciona para `VERIFICADO` somente quando o restore real em PostgreSQL 17.11 for executado, os 5 checks e o marcador forem observados em ambas as bases e o diff de logs for zero.

- **M05.01 PENDENTE (Fluxos e decisões/contratos faltantes):**
  - *Exportação integral / Portabilidade*: PENDENTE de contrato server-side com RPC exportadora delimitada por `organization_id`, projeção mínima e sanitização de dados pessoais.
  - *Anonimização e Exclusão (Esquecimento)*: PENDENTE de definição jurídica/contábil de prazos de retenção legal do ledger financeiro (mínimo 5 anos conforme legislação) e contrato de ofuscação de PII nos cadastros de integrantes.
  - *Restauração pontual por tenant*: PENDENTE de protocolo de isolamento transacional por organização (o `pg_dump --table` não filtra por tenant; exige restore lógico seletivo ou replicação controlada).

- **M04.03-C Trilha do Chamado (Verificações e Conciliação):**
  - Bloqueio de projeção das colunas `reason` e `actor_user_id` verificado e confirmado para Master (authenticated) e Loja B (authenticated) via erro `42501` (`insufficient_privilege`).
  - Negativa de Master/AAL1 validada com claims simuladas (retorno de 0 eventos na ausência de MFA).
  - A conciliação do histórico da migration (`20261111223000_v35_support_event_read_projection.sql` no GitHub vs `20261112015957` no Supabase DEV) continua pendente de revisão.

---

## V35 M04.03-C — trilha de chamados preparada localmente

Base GitHub main 97f67281c9e55ac6d58271386c65f1dd690703f1, com a mesma árvore da cópia local antes das alterações. M04.03-B integrada pelo PR #48. O port local reaproveita a interface do AI Studio, limita campos em ambas as consultas e exige eventos de cliente na leitura da Loja. Gate local PostgreSQL 17.5 em memória PASS com a migration proposta, políticas versionadas e dados sintéticos. Master/SUPPORT AAL2, isolamento Loja A/B, negativos AAL1 e anônimo, projeção, ordem e escrita interna verificados. Gateway/JWT real e restauração permanecem pendentes. ADR 0047 registra o contrato. O runbook M05 descreve restauração em base descartável com dados sintéticos e aguarda evidência de execução. Sem integração ou publicação da M04.03-C.

## V35 M04.03-B — autorização de leitura dos Jobs

M04.03-B sobre main fefd376. A política anterior delega a is_platform_staff, cujo código versionado já verifica AAL2; a nova política exige o claim explicitamente. SELECT autenticado passa a usar lista de colunas diagnósticas, excluindo payload, idempotency_key e correlation_id. O histórico A mantém filtros e cursor; removido o leitor antigo sem consumidores. O PR preserva as permissões de service_role e as RPCs internas de onboarding. Gate PostgreSQL descartável com claims simuladas e testes de cursor; JWT real no DEV pendente.

M04.03-C proposta: expor trilha cronológica de eventos do chamado no detalhe Master. Hoje a fila mostra tempos de primeira resposta/resolução e conversa, mas a interface não consulta saas_support_ticket_events. Reutilizar eventos existentes com escopo do chamado, autorização e campos sanitizados. Metas de SLA dependem de política explícita.

## V35 M04.03-A — histórico filtrável/paginado de jobs (10/11/2026)

- PR #45 / merge `e997634226c37bd607a57bfffd80c14882143687`: M04.02 integrada em código, testes CI #467 static/frontend/onboarding 3/3 PASS. RPCs de suporte MASTER/AAL2 já presentes no DEV; **ciclo JWT real não homologado**, nenhuma sessão aberta.
- Branch `feat/v35-m0403-job-history-keyset`: Saúde / Jobs passa a consultar histórico por **cursor (created_at DESC, id DESC)**, página de 25 registros com sentinela, filtros de status, tipo e Loja. A consulta reaproveita `saas_jobs` existente, faz somente SELECT explícito de campos diagnósticos; **não coleta payload sanitizado, chave idempotente ou segredos**, não executa retry nem novas mutações. Valida respostas e escopo de Loja; exibe erro sem dados antigos após falhas. Status válidos: queued/running/succeeded/failed/canceled; tipos conforme CHECK do DEV. Não usar offset como total global.
- **Observação de segurança:** read-back somente leitura em DEV revelou policy `saas_jobs_platform_select` com `private.is_platform_staff('MASTER')`, sem verificação AAL2 explícita. Registrado em [issue #46](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/issues/46) para endurecimento server-side e teste JWT real; **não afirmar que RLS deste read-model já exige MFA**. A entrega atual não modifica RLS, migrations, Supabase DEV ou produção.
- Sem jobs em DEV na consulta de 10/11/2026; a prova de histórico antigo (>25), ordenação em datas empatadas, filtragem negativa e política AAL2 ainda depende de testes controlados após autorização de DEV. CI da branch registra checks do cliente.
- M04.03 segue EM_EXECUCAO para SLA, trilha de eventos e operação restante. Não confundir queued/succeeded/failed com envio entregue e não habilitar retry sem comando e idempotência próprios.

---

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
