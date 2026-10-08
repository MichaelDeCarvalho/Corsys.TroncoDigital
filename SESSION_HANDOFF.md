# SESSION HANDOFF — 2026-10-03 UTC / 2026-10-02 Brasil

Repo MichaelDeCarvalho/Corsys.TroncoDigital, branch feat/v35-dev-gate-20261002, PR draft #4: https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/4 . Base feat/v35-foundation. HEAD anterior a este incremento: 271e4277603f306be5608a7bc6e3837dfd6c1057. Sem merge/produção autorizados.

## Marco confirmado

Preview DEV https://corsys-tronco-digital-dev.corsys1.workers.dev/ abriu no navegador; HTTP 200 e JS/CSS 200. Proprietário confirmou login real dos dois usuários e visibilidade Michael/TENANT A, jobmcc/TENANT B, em 2026-10-02. Senhas não obtidas. Este teste manual não é teste negativo de segurança.

Proprietário determinou preservar no mínimo todo o piloto V35. ZIP reenviado coincide com SHA da fonte previamente importada. HTML V34 operacional recebido separadamente e inventariado em docs/V35_PILOT_PARITY.md / V35_PILOT_INVENTORY.md; 6 telas Master + 15 cliente, campos/ações/abas e fragmentos dinâmicos. Referência sanitizada remove apenas duas tags externas de antivírus; original intacto. Não executar o protótipo como aplicativo real. Navegador bloqueou localhost/file; revisão estática, sem cliques ou homologação visual. docs/V35_COVERAGE.md registra domínios, regras, 29 ADRs e pendências de interface. scripts/check_v35_preservation.py acrescentado à CI: 29 ADRs, 19 migrations aplicadas, 51 documentos e 263 declarações SQL preservados. Não equivale a teste semântico ou prova de paridade visual.

## Incremento

Financeiro no menu desktop/mobile: cobranças de integrantes, contas a pagar e contas a receber, por Loja; páginas de 25, refresh e anterior/próxima. Valores efetivos/em aberto derivados no banco; cancelamento e aprovação exibidos conforme views. Sem novas migrations, grants ou escritas. Integrantes, Auth e chamados preservados.

Consulta SQL das três views sob authenticated e claims simuladas AAL1 foi executada; todas retornaram zero linhas próprias/cruzadas. Demonstra acesso às views, não isolamento negativo com fatos presentes nem HTTP/JWT assinado. Nenhum fato financeiro criado neste incremento.

## Verificação

npm run check: typecheck app/node PASS, 23 testes frontend PASS e build Vite PASS. Testes cobrem navegação financeira, precisão de exibição, separação de domínios, paginação, resposta tardia, tenant inesperado, inconsistência/valor inválido, erro e retry. Testes de componentes usam client simulado; não são teste de autorização real. Gate de preservação PASS.

CI do commit ada7ccca: frontend PASS e static FAILED por caminhos de ADRs no novo manifesto. Corrigidos para docs/adr/v35/, sem alterar conteúdo histórico. Cloudflare confirmou deploy ada7ccca com sucesso. CI do commit 69920e8e PASS (run 37090789414), deploy Cloudflare confirmado; assets HTTP200 correspondentes ao build. Não marcar publicação do incremento como verificada antes da evidência dos assets correspondentes. Inspeção autenticada desktop/mobile ainda pendente por ausência de sessão de teste neste navegador.

## Pendências e próxima etapa

1. Validar HTTP/JWT positivo/negativo, MFA/AAL2, suspensão e concorrência/idempotência antes de liberar comandos financeiros.
2. Completar integrantes e configurações; comandos financeiros por RPCs existentes, com invariantes/versionamento.
3. Completar Master SaaS, planos/promoções V35, onboarding, suporte/SLA, billing, DRE/orçamento/conciliação e demais domínios da matriz.
4. Cumprir IDs do inventário recebido e homologar ambas as lojas/Master desktop/mobile; nunca declarar paridade integral sem evidência de cada fluxo. V35 mantém nome/código editável em todo rascunho com snapshots publicados imutáveis; supera a restrição V34.

Advisors históricos: 37 avisos de RPCs definer autenticadas, três tabelas backend sem policies por negação padrão, proteção contra senhas vazadas desabilitada. Nenhum upgrade/custo novo ativado. DEV autorizado; toda cobrança deve ser apresentada antes, produção aprovada depois.

## Comandos

npm ci --ignore-scripts; npm run check; npm run check --prefix dev-gate; python scripts/check_v35_preservation.py; python scripts/check_sql.py (requer scripts/requirements-checks.txt). Build funcional usa .env.local ignorado; placeholder CI não autentica. Apenas configuração wrangler.dev.jsonc. Não pedir senhas/tokens no chat.

Verificações adicionais locais: quatro testes guard DEV PASS, gramática SQL PASS e Wrangler dry-run PASS. A correção de caminhos deve ser validada no checkout remoto, não somente na cópia local que contém ambas as pastas.

## Revisão do piloto — 2026-10-03

Este incremento preserva referência HTML/JSON/relatórios e adiciona integridade ao gate; não modifica frontend, banco ou permissões. São 129 ocorrências de campos nas telas + 3 compartilhadas + 297 dinâmicas/históricas em 126 fragmentos, não campos únicos. O escopo foi conciliado com a V35 sem transformar simulações em funcionalidades prontas. Consultar os dois relatórios antes de qualquer módulo; CI desse incremento deve ser conferida após push.

## Evidência de vídeos — 2026-10-03 Brasil

Sete vídeos inspecionados por quadros e cenas críticas, total aproximado 8min38s, desktop 1920×1032. docs/V35_PILOT_VIDEO_REVIEW.md registra timestamps/cobertura/ajustes/pendências; hashes em docs/engineering/v35-pilot-video-evidence.json. Fonte gravada é corsys-tesouraria-preview-v35-planos-ofertas.html, recebida neste incremento; ver conciliação V35. V35 exibe filtros, exclusão controlada e identidade editável em rascunho sucessor; preservar junto ao baseline V34. Master + Aurora/André parcialmente observados; não afirmar homologação funcional da segunda Loja ou mobile ou comandos reais. Recursos não gravados continuam obrigatórios. CI da revisão anterior 55276f6: run 37093088888 success.

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


## HTTP financeiro aprovado pelo proprietário — 2026-10-07, 18:51 Brasil

Execução Windows/Node v24.20.0 pelo proprietário; saída PASS apresentada no chat, não executada pelo agente com credenciais. npm ci: 0 vulnerabilidades no dev-gate; npm run check: 10 testes PASS. npm run test:financial-http: Tenant A e Tenant B PASS; HTTP/JWT real, views próprias positivas/cruzadas ocultas, auditoria, idempotência com requisições simultâneas e disputa de alocação aprovados no escopo do roteiro. Tag: DEV HTTP 428ce717-21fa-41cc-a7b5-47512ef83bfe. Fatos fictícios permanecem no DEV; não repetir sem necessidade nem apagar ledger. Tentativas anteriores pararam antes de escritas por dependência ausente, project ref e identidade inesperada; configuração corrigida localmente, nenhuma senha/token recebido. CI Foundation checks do código c39de3a: run 37690001216 success. Não é teste de carga em escala nem cobertura de todas as RPCs. Etapa 1 continua aberta: MFA real, suspensão/revogação/perfis por HTTP, recuperação por e-mail e matriz restante. Produção e merge não aprovados.


## Gate suspensão/retomada preparado — 2026-10-07, após PASS financeiro HTTP

Ver docs/DEV_SUSPENSION_MFA_GATE.md. Roteiros test:suspension-http (seis RPCs/42501, leitura própria positiva e saldos preservados) e test:restoration-http (write positivo de pagamento fictício 1) preparados. SQL fixo suspend/restore somente assinatura DEV zero-price B, mantendo A active; transições/helpers validados em transação revertida: DEV_SUSPENSION_TRANSITIONS_ROLLBACK_PASS, claims simuladas. As duas lojas continuam active; não iniciar janela sem conseguir restaurar. 10 testes locais PASS e sintaxe PASS; HTTP das novas fases ainda pendente. check:mfa-posture só inventário INFO com getUser/assurance/listFactors, sem cadastrar fator nem alterar Auth; não é MFA PASS. MFA real e staff positivo, sessão/revogação/perfis/matriz completa continuam abertos. Nenhuma alteração persistente de status, schema, grants, layout, senha, cobrança ou produção. Código/docs devem ter CI conferida após push.


## Diagnóstico MFA real e janela de suspensão — 2026-10-07, 21:52 Brasil

Proprietário executou check:mfa-posture no Windows com logins reais: A current=aal1 next=aal1 verified_factors=0; B current=aal1 next=aal1 verified_factors=0. Inventário INFO, NÃO aprovação MFA; sem alteração de fatores/Auth. npm ci: zero vulnerabilidades dev-gate; 10 testes locais PASS apresentados. Código de preparação 933d6eb: Foundation checks run 37693053151 success.

JANELA ABERTA: agente executou scripts/suspend_dev_tenant_b_http.sql no DEV autorizado; consulta confirmou B suspended e A active. Aguardar resultado do proprietário para npm run test:suspension-http. Restaurar B com scripts/restore_dev_tenant_b_http.sql imediatamente ao receber resultado, inclusive se FAIL, ou se proprietário interromper os testes. Em seguida validar npm run test:restoration-http com login real. Não marcar suspensão HTTP como PASS antes da saída. Nenhum ledger/Auth/grant/schema/produção alterado; status temporário somente assinatura fictícia zero-price B. Notas anteriores de ambas active referem-se à preparação, não à janela atual.


## Suspensão HTTP aprovada e janela encerrada — 2026-10-07, 21:54 Brasil

Proprietário executou npm run test:suspension-http com logins/JWT reais. Seis negativas 42501 PASS: create_manual_charge, register_payment, allocate_payment_to_charge, allocate_payment_fifo, cancel_charge, reverse_payment. Próprias views financeiras positivas e saldos preservados; A active. Tag DEV SUSPENSION 7cb919d9-81de-402a-b708-9404af5c5e3c. Saída apresentada pelo proprietário; agente não recebeu credenciais nem executou HTTP autenticado.

JANELA ENCERRADA: imediatamente após saída, agente executou scripts/restore_dev_tenant_b_http.sql no projeto DEV e consulta confirmou A active e B active. Isto supera o registro anterior de B suspended. Pendente npm run test:restoration-http para provar retomada positiva com JWT real. Suspensão validada somente B, status suspended e seis RPCs; canceled/past_due/security_hold, demais RPCs/perfis/revogação e MFA real não aprovados. Sem alterações em Auth, ledger, schema/grants, cobrança ou produção; etapa 1 segue aberta.


## Retomada HTTP positiva aprovada — 2026-10-07, 21:56 Brasil

Proprietário executou npm run test:restoration-http no Windows com JWT/login real e apresentou PASS: ambas assinaturas active; register_payment da loja B voltou a escrever, pagamento fictício 1 com available_amount=1, organização própria e integrity_ok=true. Tag DEV SUSPENSION ef9110f9-141b-4a21-be25-a50865935970. Fato fictício permanece DEV. Agente não recebeu credenciais nem executou este HTTP autenticado. Fecha a pendência da retomada neste cenário B active -> suspended -> active e seis RPCs negadas. Não aprova MFA, revogação de papéis/sessões, canceled/past_due/security_hold, todas as RPCs ou demais perfis. Etapa 1 continua aberta; ambas lojas ativas, nenhuma janela de suspensão pendente. Próximo escopo: MFA real com staff e matriz de autorização restante, preservando usuários tenant/credenciais atuais e sem promoção automática a Master.


## Gate estorno/cancelamento preparado — 2026-10-07, após retomada HTTP

Ver docs/DEV_FINANCIAL_LIFECYCLE_GATE.md. Novo test:financial-lifecycle cria fatos fictícios próprios nas duas lojas, testa reverse_payment/cancel_charge concorrentes (um UUID/um 23505), saldos/reversão de alocações/audit/originais preservados, ID estrangeiro P0002 e organização alheia 42501, motivo/período 22023 e FIFO após estorno 55000. Só corrige fatos novos, sem FIFO positivo sobre integrante compartilhado. 11 testes locais PASS e sintaxe PASS. SQL verify_dev_financial_lifecycle.sql passou nas duas lojas dentro de ROLLBACK, claims simuladas; não comprova JWT/HTTP/concorrência. HTTP novo ainda pendente do proprietário. Ambas lojas continuam active, sem nova janela de status, Auth/grants/schema/frontend/cobrança/produção alterados. Etapa 1 segue aberta para MFA/staff, revogação/perfis, institucional/FIFO positivo e matriz restante. CI deve ser conferida após push.


## Lifecycle HTTP aprovado pelo proprietário — 2026-10-07, 22:10 Brasil

Execução Windows/Node pelo proprietário, npm ci zero vulnerabilidades dev-gate e 11 testes locais PASS apresentados. npm run test:financial-lifecycle: Tenant A PASS, Tenant B PASS e conclusão HTTP/JWT PASS. Tag DEV LIFECYCLE 8b67cd58-6f78-4f70-b3e7-d3e07f287653. Estorno/cancelamento nos dois encadeamentos, operações simultâneas com evento único/rejeição exata de duplicata, efeitos nos saldos, auditoria/ator, reversão de alocações, originais preservados e negativas de recursos estrangeiros aprovados no escopo do roteiro. Fatos fictícios corrigidos permanecem no DEV. Saída fornecida pelo proprietário; agente não executou HTTP com credenciais, não recebeu senha/token/env. CI do código preparado: Foundation checks run 37710839313 success. Novo gate deixa de ser somente preparado; HTTP positivo/negativo dessa matriz está aprovado, sem inferir cobertura integral. Ambas lojas ativas, nenhuma suspensão pendente. Etapa 1 continua aberta: MFA real/staff, revogação/perfis/sessões, FIFO positivo, financeiro institucional e matriz restante. Não repetir comandos já aprovados sem motivo, não apagar ledger. Produção/merge/cobranças novas não aprovadas.


## Pacote restante da etapa 1 preparado — 2026-10-07 Brasil / 2026-10-08 UTC

Proprietário determinou continuar até fechar etapa1; não declarar encerrada enquanto gates reais pendentes. Ver docs/DEV_STAGE1_CLOSURE_GATE.md. Persistidas somente fixtures DEV isoladas para FIFO e plano/mapeamentos 2027, sem sobreposição/alteração de fatos 2026. SQL rollback PASS: FIFO/institucional/fechamento, 20 comandos cross-org por identidade, FK institucional23503 e cinco transições de perfil/restauração. 12 testes locais/sintaxe PASS. Preparados test:stage1-remaining, test:profiles-live (JWT original sem refresh durante fases) e test:master-mfa (QR local privado, OTP mascarado, AAL1 negativo/AAL2 positivo). Todos novos HTTP/TOTP ainda NÃO EXECUTADOS pelo proprietário. Ambas assinaturas active, papéis ADMIN originais preservados e nenhum vínculo/staff/fator temporário aplicado. Conta dedicada escolhida via pergunta pelo proprietário: michael.c.carvalho+corsys-dev-master@gmail.com; consulta Auth ainda não encontrou usuário, staff_count=0. Proprietário precisa criá-la no painel e manter senha local; conector não oferece criação Auth. Não inserir Auth por SQL nem fabricar tokens. Bind primeiro Master só após identidade criada/conferida, proteção do último Master permanece. Support/Billing/sessões/expiração/revogação e critérios críticos remanescentes continuam obrigatórios, não cobertos por Master sozinho. Mudanças não promovem etapa2, não alteram produção/cobrança/grants/schema/frontend. Conferir CI contra novo commit. Pendências reais dependem de execução/OTP do proprietário, não de autorização nova.


## HTTP restante aprovado pelo proprietário — 2026-10-08 UTC

Execução local Windows/Node v24.20.0 pelo proprietário na pasta de download (3), saída integral apresentada; nenhuma credencial recebida pelo agente. npm ci: zero vulnerabilidades no dev-gate; npm run check: 12 testes PASS. npm run test:stage1-remaining: Tenant A e Tenant B PASS. Tag: DEV STAGE1 REMAINING b1d4672b-a471-4179-9a9c-956845b1f696.

Com JWT real nas duas lojas: 20 RPCs do catálogo negaram organização alheia; FIFO positivo ordenado e concorrente preservou alocações/saldos; financeiro institucional positivo/cruzado, idempotência, saldos e auditoria passaram; fechamento negou lançamento e reabertura permitiu escrita positiva. Saída confirmou competências reabertas. Fatos fictícios 2027 permanecem DEV; não repetir o gate de integrante limpo nem apagar ledger sem inspeção. O catálogo testa negação por organização, não toda combinação de parâmetros/IDs. Não comprova idempotência de eventos de auditoria FIFO.

Supera a pendência HTTP deste roteiro na preparação anterior. Perfis/revogação live ainda NÃO executados; próxima execução é test:profiles-live, aguardando WAIT antes de cada alteração SQL e restaurando ADMIN em erro/cancelamento. Nenhuma mudança persistente de papel aplicada nesta atualização. Master/MFA real, Support/Billing e ciclo de sessões/expiração/revogação permanecem OPEN. Consulta Auth nesta sessão não encontrou a conta dedicada escolhida. Etapa 1 permanece EM EXECUÇÃO; etapa 2 pendente. CI do código testado 28053c3: Foundation checks run 37713949588 success. Este incremento registra evidência, sem alterar código/schema/grants/produção/cobrança.


## Perfis e revogação live HTTP aprovados — 2026-10-07, 22:56 Brasil

Proprietário executou test:profiles-live no Windows/Node v24.20.0, mesma cópia (3) do código 28053c3. Tag DEV LIVE PROFILES ff496b1b-823d-4021-9fd5-d21b240f9a6c. ADMIN baseline e TREASURER financeiro positivo/limites Master e tenant PASS apresentados. VIEWER leituras próprias e 20 escritas negadas PASS apresentado. Chegada ao WAIT REVOKED LINK demonstra que as assertions anteriores de integrante vinculado passaram; chegada ao WAIT RESTORE ADMIN demonstra que as assertions de revogação passaram. Saída final apresentada: same JWT ADMIN restored; all original scopes and positive write restored PASS. Nenhuma credencial/token recebido pelo agente.

Agente aplicou cinco transições SQL DEV guardadas somente B, entre os WAITs do mesmo processo: TREASURER, VIEWER, vínculo único, remoção do vínculo e ADMIN original. getUser e comparação do token original sem refresh sustentam revogação da autorização com JWT ainda válido, NÃO invalidação de sessão Auth. Consulta SQL final conferiu A/B ADMIN, zero member_user_links e created_at original 2026-10-02 22:58:27.201308+00. Janela de perfis ENCERRADA; restauração persistida antes da confirmação HTTP final. Dois pagamentos fictícios 1 permanecem DEV, não apagar ledger nem repetir teste sem necessidade.

Gates tenant de perfis/vínculo/revogação deste roteiro concluídos. Master/MFA, staff Support/Billing, suporte temporário/expiração/revogação e ciclo de sessões Auth continuam separados e OPEN. Consulta Auth atual não encontrou michael.c.carvalho+corsys-dev-master@gmail.com; próximo passo é criação oficial da conta dedicada no painel pelo proprietário, senha privada local, seguida de conferência e bind guardado. Etapa 1 segue EM EXECUÇÃO, etapa 2 pendente. Nenhum schema/grant/produção/cobrança alterado.


## Master DEV dedicado vinculado — 2026-10-07, 23:04 Brasil

Proprietário confirmou criação oficial da conta no painel. Consulta Auth conferiu michael.c.carvalho+corsys-dev-master@gmail.com, UUID 71e27b4c-f0ba-46f7-832f-4faf29e8603d, email confirmado em 2026-10-08 02:04:16.172606+00. Executado bind_dev_dedicated_master.sql com guards: sem roles/links tenant, nenhum staff anterior, plano DEV fixo zero-price presente. Retorno conferiu MASTER active=true. Primeiro Master DEV ativo; preservar proteção do último Master. Contas tenant não promovidas. Nenhuma senha/token recebida, nenhum fator inscrito pelo agente. HTTP Master/AAL1/TOTP/AAL2 ainda PENDENTE do proprietário; próximo comando test:master-mfa com UUID e senha somente em .env.dev privado. Etapa1 aberta, sem produção/cobrança/schema/grants alterados.
