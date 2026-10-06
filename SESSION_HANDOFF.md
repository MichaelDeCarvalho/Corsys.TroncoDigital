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
