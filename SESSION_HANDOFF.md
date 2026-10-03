# SESSION HANDOFF — 2026-10-03 UTC / 2026-10-02 Brasil

Repo MichaelDeCarvalho/Corsys.TroncoDigital, branch feat/v35-dev-gate-20261002, PR draft #4: https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/4 . Base feat/v35-foundation. HEAD anterior a este incremento: 271e4277603f306be5608a7bc6e3837dfd6c1057. Sem merge/produção autorizados.

## Marco confirmado

Preview DEV https://corsys-tronco-digital-dev.corsys1.workers.dev/ abriu no navegador; HTTP 200 e JS/CSS 200. Proprietário confirmou login real dos dois usuários e visibilidade Michael/TENANT A, jobmcc/TENANT B, em 2026-10-02. Senhas não obtidas. Este teste manual não é teste negativo de segurança.

Proprietário determinou preservar no mínimo todo o piloto V35. ZIP reenviado coincide com SHA da fonte previamente importada. Contém schema/documentação, sem HTML do piloto. docs/V35_COVERAGE.md registra domínios, regras, 29 ADRs e pendências de interface. scripts/check_v35_preservation.py acrescentado à CI: 29 ADRs, 19 migrations aplicadas, 51 documentos e 263 declarações SQL preservados. Não equivale a teste semântico ou prova de paridade visual.

## Incremento

Financeiro no menu desktop/mobile: cobranças de integrantes, contas a pagar e contas a receber, por Loja; páginas de 25, refresh e anterior/próxima. Valores efetivos/em aberto derivados no banco; cancelamento e aprovação exibidos conforme views. Sem novas migrations, grants ou escritas. Integrantes, Auth e chamados preservados.

Consulta SQL das três views sob authenticated e claims simuladas AAL1 foi executada; todas retornaram zero linhas próprias/cruzadas. Demonstra acesso às views, não isolamento negativo com fatos presentes nem HTTP/JWT assinado. Nenhum fato financeiro criado neste incremento.

## Verificação

npm run check: typecheck app/node PASS, 23 testes frontend PASS e build Vite PASS. Testes cobrem navegação financeira, precisão de exibição, separação de domínios, paginação, resposta tardia, tenant inesperado, inconsistência/valor inválido, erro e retry. Testes de componentes usam client simulado; não são teste de autorização real. Gate de preservação PASS.

CI do commit ada7ccca: frontend PASS e static FAILED por caminhos de ADRs no novo manifesto. Corrigidos para docs/adr/v35/, sem alterar conteúdo histórico. Cloudflare confirmou deploy ada7ccca com sucesso. CI/deploy do próximo commit de correção devem ser consultados após push. Não marcar publicação do incremento como verificada antes da evidência dos assets correspondentes. Inspeção autenticada desktop/mobile ainda pendente por ausência de sessão de teste neste navegador.

## Pendências e próxima etapa

1. Validar HTTP/JWT positivo/negativo, MFA/AAL2, suspensão e concorrência/idempotência antes de liberar comandos financeiros.
2. Completar integrantes e configurações; comandos financeiros por RPCs existentes, com invariantes/versionamento.
3. Completar Master SaaS, planos/promoções V35, onboarding, suporte/SLA, billing, DRE/orçamento/conciliação e demais domínios da matriz.
4. Receber HTML original do piloto para confrontar telas, navegação e parâmetros visuais sem apagar requisitos documentados.

Advisors históricos: 37 avisos de RPCs definer autenticadas, três tabelas backend sem policies por negação padrão, proteção contra senhas vazadas desabilitada. Nenhum upgrade/custo novo ativado. DEV autorizado; toda cobrança deve ser apresentada antes, produção aprovada depois.

## Comandos

npm ci --ignore-scripts; npm run check; npm run check --prefix dev-gate; python scripts/check_v35_preservation.py; python scripts/check_sql.py (requer scripts/requirements-checks.txt). Build funcional usa .env.local ignorado; placeholder CI não autentica. Apenas configuração wrangler.dev.jsonc. Não pedir senhas/tokens no chat.

Verificações adicionais locais: quatro testes guard DEV PASS, gramática SQL PASS e Wrangler dry-run PASS. A correção de caminhos deve ser validada no checkout remoto, não somente na cópia local que contém ambas as pastas.
