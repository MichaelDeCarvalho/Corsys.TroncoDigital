## Checkpoint vigente — execução aprovada (25/11/2026)

Este registro supersede somente estados históricos divergentes abaixo. Autorização vinculante: AC-V35-20261125-v1, com as quatro ressalvas do proprietário em docs/V35_CLOSURE_APPROVAL.md. Não pedir nova aprovação para atividades DEV já abrangidas.

- **Macro/lote:** Lote 01 desbloqueado; Lote 02 / M01.03 em execução; entrega aditiva A04 da M04 integrada. M06.02 permanece CONCLUIDO; nenhuma outra macro foi promovida por esses recortes.
- **Integrações VERIFIED:** PR #67 → f9e1f56cb4ecc78ba454acfff5dbe7e28c561d96; PR #50 SUPERSEDIDO/fechado sem merge (fixture e lockfile já equivalentes, runner endurecido na main); PR #68 → 4031452307e771d526e9082dc2a67c59282ff486; PR #69 → e87c1f5c0e6a9b2f1c74c1b8ba9a6ca17d7cffac. Checks static/onboarding/frontend SUCCESS sobre cada revisão integrada.
- **DRE Gerencial VERIFIED em código/testes:** navegação, telas e exportações identificadas como gerenciais; DRE contábil oficial pelo contador. Cálculos e origem dos fatos preservados. Navegação “DRE Gerencial” observada no navegador DEV; cálculo e conteúdo da tela não re-homologados neste smoke.
- **Identidade Master VERIFIED em PostgreSQL descartável e CI:** editor de dez campos, MASTER/AAL2, allowlist, validação, lock/CAS, idempotência sem alteração e auditoria sem valores pessoais. Dados reais continuam para o final; aprovação jurídica e emissão real não se presumem.
- **Evidências:** PR #69 CI 45700568203, frontend 87 arquivos / 634 testes PASS, build/typecheck/dry-run PASS; onboarding PostgreSQL inclui PLATFORM_IDENTITY_PG_PASS e M01.03 rollback, identity, permissions, terms, tenant scope, concurrent replay e audit PASS. Main e87c1f5 CI 45700892988: static/onboarding/frontend SUCCESS. Testes locais direcionados: DRE 38/38; identidade/configuração 18/18. Não repetir sem mudança que invalide a evidência.
- **DEV aplicado VERIFIED:** 20261125210000_v35_platform_identity_master_edit.sql → versão remota 20261125210340; 20261109233000_v35_onboarding_acceptance.sql → 20261125210405. Projeto exclusivamente szqkdekwhzxsoxorgvaz. Total Git 81 / remoto 81, com 11 divergências de timestamp documentadas; nenhuma renomeação, repair, reset ou db push.
- **Read-back DEV VERIFIED:** configuração única e fingerprint 99d44bd8b5f827c2bd22c95fdd4933f0 preservadas, 12 eventos de auditoria existentes, 7 vínculos de papéis existentes, onboarding_runs=0 e receipts=0; documentos/identidades de aceite novos vazios. Sem atualização cadastral, termos publicados, e-mail enviado ou cliente criado. Authenticated sem UPDATE direto da configuração, anon sem EXECUTE na gravação.
- **Publicação Cloudflare VERIFIED:** Workers Builds do e87c1f5 concluído SUCCESS. Navegador DEV com Master/AAL2 real: configurações carregadas, campos reais não informados, editor aberto com dez campos e fechado sem salvar; nenhuma mutação cadastral. Gravação via UI continua NOT EVALUATED; PostgreSQL/CI de gravação PASS não é convertido em homologação dessa jornada.
- **Bloqueio delimitado M01.03:** Edge onboarding-invite em versão 1 ainda usa finish_onboarding_invite antigo. Fonte Git nova usa finish_onboarding_invite_with_identity e exige ONBOARDING_APP_ORIGIN. Credencial/configuração de ambiente e allowlist de redirect Auth ainda não comprovadas; ferramenta disponível não permite conferir/configurar esses itens. Não substituir a função por código que ficaria indisponível por configuração ausente. Preparar/verificar origem HTTPS DEV e redirect antes do deploy; conservar verify_jwt=true. Jornada real de convite/aceite NOT EVALUATED; não equivale a falha do produto.
- **Outros gates preservados:** sigilo reforçado aprovado para as minutas, publicação jurídica depende revisão profissional; Diário/Razão permanecem no escopo próprio; recuperação/restore e cenários financeiros faltantes mantêm gates anteriores. Gate real de conciliação com interceptação seletiva indisponível nesta ferramenta: BLOCKED/NOT EVALUATED, sem substituir por mocks.
- **PROD e limpeza:** nenhum acesso/mutação produtiva ou apagamento efetuado. Preparar ambiente PROD isolado e vazio, uma organização QA permanente no DEV e Master operacional separado; manifesto de limpeza/base inicial e implantação somente no gate final.
- **Próxima atividade executável:** fechar configuração/implantação compatível da Edge e redirects sem enviar convites fora do destino/limite aprovado; prosseguir nos requisitos independentes dos lotes aprovados. Registrar bloqueios sem paralisar o restante. Cópia isolada closure-work; preservar repo/ e m0602-qa/ antigos.

---

## Editor Master da identidade da prestadora — 25/11/2026

Implementação da ressalva A04/E03: formulário de identidade em MasterPlatformConfig e RPC save_platform_identity, somente MASTER/AAL2, allowlist de dez campos, nulos para opcionais, lock/CAS de updated_at, audit de nomes de campos sem valores pessoais, sem editar política comercial/termos/contratos. Resposta incerta exige atualização/reconciliação antes de novo envio. CNPJ numérico e alfanumérico aceitos em formato (sem afirmar consulta/validação cadastral oficial). Fonte de formato: Receita Federal, https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico .

Migration nova 20261125210000_v35_platform_identity_master_edit.sql preparada; ainda NÃO APLICADA no DEV neste registro. Teste PostgreSQL descartável real incluído no CI (DDL rollback, negativas, allowlist, CAS, atomicidade e auditoria). TypeScript PASS; PlatformIdentityEditor/MasterPlatformConfig 18/18 PASS locais. PostgreSQL/CI do novo incremento a conferir; não são substituídos por mock. Nenhum dado de identidade existente atualizado. Rollback de UI: retirar o editor; função aditiva pode permanecer sem uso até forward-fix, sem apagar audit.

PR #68 integrado em 4031452307e771d526e9082dc2a67c59282ff486 após 3/3 PASS; aprovação com ressalvas persistida em docs/V35_CLOSURE_APPROVAL.md e ADR-0050. DRE gerencial entregue na revisão anterior; cadastro real permanece ao final. Próximo gate: CI PostgreSQL e aplicação aditiva exclusivamente DEV após preflight/read-back. PROD/limpeza continuam fora da operação corrente.

## Aprovação consolidada com ressalvas — 25/11/2026

Fonte vinculante: [V35_CLOSURE_APPROVAL.md](docs/V35_CLOSURE_APPROVAL.md). Pacote AC-V35-20261125-v1 aprovado pelo proprietário, com DRE **gerencial** (oficial pelo contador), sigilo de todo conteúdo, cadastro real da prestadora ao final em editor Master/MFA, início comercial sem fatos de homologação e conta QA isolada no DEV. Dados reais ainda ausentes não bloqueiam desenvolvimento. Diário/Razão não foram excluídos pela ressalva sobre DRE; mantêm gates próprios. Autonomia DEV aprovada; implantação PROD depende do gate final. Nenhuma limpeza/reset agora.

Lote 01: PR #67 integrado em f9e1f56cb4ecc78ba454acfff5dbe7e28c561d96 após CI 581ba2f 3/3 PASS. PR #50 fechado como SUPERSEDIDO: fixture e lockfile já idênticos à main, runner endurecido e teste presentes; sem merge do diff antigo. Preservadas evidências e estados das macros, inclusive M06.02 CONCLUIDO.

Neste incremento, identificação gerencial em navegação, telas, configurações e títulos/escopo de exportações; retirada alegação de validade fiscal pela publicação de plano. Cálculos/RPCs/segurança inalterados. TypeScript PASS; 38/38 testes focados em cinco arquivos PASS localmente. Editor de identidade ainda é lacuna a executar, não declarado pronto. Registro de aprovação inclui as minutas com sigilo reforçado; uso jurídico real continua condicionado aos gates existentes.

## M06.01 — Conciliação M02.02-A: aceite automatizado da tela (25/11/2026)

Base de código inspecionada: `fed69b828177b1ab575aa63967e9959eab6929b3` (PR #67). Mudança restrita a testes e registros; nenhum componente, serviço, RPC ou migration alterado.

**Requisito:** `view-tesouraria`, comparação sistema × extrato e correspondências/status, em `V35_PILOT_V35_INVENTORY.md`; ADR-0027 exige falha explícita ao exceder consultas e proíbe operar sobre amostra parcial. O arquivo OFX/CSV (`view-tesouraria-F001`) e os gates de importação/validação/desfazer já homologados não são reabertos.

**Implementação existente:** `loadBankDetail` valida contagens exatas das linhas/vínculos/estornos, restringe estornos aos vínculos do extrato em lotes de 100 e compara valores ativos em centavos com o total das linhas. O componente limpa o detalhe e só apresenta correspondência/desfazimento após leitura válida. Leituras independentes não oferecem snapshot transacional único.

**Lacuna de evidência fechada localmente:** quatro cenários de componente com o serviço real e cliente simulado: contagem incompleta de linhas, de vínculos, de estornos e divergência entre vínculos ativos e total da linha. Em cada cenário: alerta sanitizado; controles de conciliar/desfazer ausentes; zero RPC de escrita; recuperação pelo botão Atualizar com dados completos/coerentes; controles reaparecem bloqueados até confirmação; zero escrita durante recuperação.

**Execução local: 12/12 PASS, exit 0** (oito testes anteriores + quatro novos), Node v24.20.0/Vitest 5.0.5/jsdom, cópia isolada dos fontes da revisão-base, dependências já instaladas. Configuração local mínima com JSX automático e aliases para dependências; não foi usado o arquivo Vite integral do projeto. A tentativa inicial com o plugin React falhou ao carregar `vite/internal`; a configuração mínima permitiu executar os testes sem alterar toolchain do repositório. Typecheck, build e suíte integral desta alteração: não executados localmente; verificar CI da nova revisão, sem reutilizar o PASS do commit anterior como resultado desta alteração.

**Limite:** testes de componente não comprovam PostgREST/RLS real, limite remoto, isolamento por JWT ou navegador autenticado. O gate DEV específico continua NOT EVALUATED. M06.01/M06.03 EM_EXECUCAO; M06.02 CONCLUIDO preservado.

### Próximo aceite independente delimitado

Work: confirmar sessão autorizada/Loja e extrato de teste já existente; somente leitura. Se o navegador de teste permitir interceptação seletiva das respostas dessas consultas, observar o estado real antes/durante/depois do refresh e aplicar os quatro cenários acima somente nas respostas locais ao browser. Não alterar servidor, limites, roles, RPCs ou fatos financeiros; não clicar importar/validar/conciliar/desfazer. Remover interceptações, atualizar e confirmar recuperação sem chamadas RPC de escrita. Se a ferramenta não permitir interceptação observável ou faltar extrato de teste elegível, registrar BLOCKED/NOT EVALUATED; não criar fixture persistente implicitamente.

Aceite: erro sanitizado e controles indisponíveis em cada resposta incompleta/incoerente; reaparecimento somente após leitura completa, com confirmações obrigatórias ainda ativas; nenhuma mutação de rede. Esse experimento observa a UI em navegador, não comprova o limite real do PostgREST nem snapshot atômico. Qualquer necessidade de seed/mutação deve vir com escopo, IDs/dados e cleanup para autorização própria.

---

## Reconciliação M06.01/M06.03 — 25/11/2026

Base: `62a6ba87bd30b85bee4f6aa640b25bd3b02aae90`. Esta atualização corrige o controle de execução; não altera código, schema, permissões ou ambientes.

- **VERIFICADO nesta retomada:** main na revisão acima; CI [45686141566](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/45686141566) concluído com static/onboarding/frontend SUCCESS e check Workers Builds DEV SUCCESS. Isso não constitui nova homologação do runtime.
- **VERIFICADO por leitura administrativa DEV:** histórico com 79 migrations, incluindo `20261115184137_v35_tenant_timezone_financial_dates`; presentes `private.is_valid_iana_timezone`, `private.tenant_current_date_at` e `private.tenant_current_date`. O arquivo Git permanece `20261115120000_v35_tenant_timezone_financial_dates.sql`. Não reaplicar nem renomear.
- **Evidência anterior preservada:** teste PostgreSQL transacional de timezone registrado em [reconciliação de migrations](docs/V35_MIGRATION_RECONCILIATION_DEV.md); Grupo A HTTP somente leitura 5/5 PASS fornecido pelo proprietário em 15/11, conforme [registro](docs/V35_HTTP_READONLY_GATE_20261115.md). Não reexecutados nesta retomada.
- **M06.02 permanece CONCLUIDO**, com paginação visual além da primeira página NOT EVALUATED e risco residual de deadlock `40P01` não eliminado. C01–C05 PASS em PostgreSQL descartável não equivalem a todos os cenários de concorrência/recuperação da V35.
- **M06.01/M06.03 permanecem EM_EXECUCAO.** A aplicação de timezone e o Grupo A deixam de ser pendências. Restam os aceites por requisito das 21 telas, Grupo B persistente no recorte ainda não comprovado e recuperação/regressões não cobertas pelas evidências existentes.
- Nenhum teste de produto, migration, deploy, operação financeira, convite ou acesso PROD foi executado neste incremento documental. A existência das funções não é uma nova prova comportamental.

### Próxima execução delimitada

Micro ativa: **M06.01**, reconciliação por requisito de **Caixa e Bancos / conciliação (view-tesouraria)**, começando pelo gate específico de truncamento/incoerência M02.02-A. Gemini deve conferir inventário original, código e testes já existentes e produzir apenas a lacuna de aceite; Work executa homologação independente autenticada somente no DEV, dentro da autorização correspondente. Não gerar fatos financeiros nem injetar falhas remotamente nesta autorização documental. Primeiro reutilizar evidências equivalentes; só propor teste novo para lacuna identificada. M06.03 deve consumir essa evidência sem duplicar os gates A/B, comerciais ou de timezone aprovados. Recuperação M05.02 e decisões M01/M03/M05 continuam dependências próprias, sem presumir sua conclusão.

Critério do próximo recorte: identificar requisito original, comportamento sob leitura completa/truncada/incoerente, prova já existente e teste ainda necessário; listar dados, ações e cleanup antes de qualquer pedido de autorização remota. Sem reconstrução da tela nem refatoração. Estado deste incremento: proposta documental em branch/PR, integração e CI da proposta a conferir no PR; o CI acima pertence exclusivamente à base.

---

## M06.02 — Encerramento Documental Condicionado: `CONCLUIDO` com ressalvas (`534eb6b4`, 25/11/2026)

**Microentrega `M06.02` consolidada como `CONCLUIDO` (estado oficial da Seção 2 de `docs/V35_EXECUTION_BOARD.md`, com ressalvas explícitas registradas separadamente), após comprovação remota de CI `45529859036` 3/3 PASS e Workers Builds DEV SUCCESS sobre `534eb6b4b7ea0860288e3dfe6d6f6ec93a1c0239`. Zero alteração em RPCs, frontend de produção, migrations ou bancos DEV/PROD.**

### 1. Gates remotos confirmados (`534eb6b4b7ea0860288e3dfe6d6f6ec93a1c0239`)
- **GitHub Actions [`45529859036`](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/45529859036) — 3/3 PASS:**
  - `static`: **PASS** (JS syntax & DEV guard tests, SQL grammar, Preserve V35 baseline).
  - `onboarding`: **PASS** (inclui `Commercial concurrency PostgreSQL gate` com cenários **`C01–C05` PASS** em `postgres:17` descartável `commercial_concurrency_gate` + integridade relacional e de auditoria de `saas_plan_version_entitlements`, `saas_plan_versions` e `saas_master_audit_logs` **PASS**).
  - `frontend`: **PASS** (`625/625` testes em Vitest após estabilização assíncrona em `WorkspaceDashboard.test.tsx` + `wrangler deploy --config wrangler.dev.jsonc --dry-run`).
- **Cloudflare Workers Builds DEV (`Workers Builds: corsys-tronco-digital-dev`):** **SUCCESS** em `2026-11-25T02:03:25Z` (Build ID `3ca9d183-730d-4f76-868c-faca67a5054b`, Version ID `0f6747d8-2461-4d54-bef5-6f94725590d9`).

### 2. Homologação operacional autenticada DEV e auditoria confirmadas
- **Ambiente DEV (`szqkdekwhzxsoxorgvaz`, Cloudflare DEV release `46499507` / ADR-0049 versão `20261125002909_v35_commercial_draft_audit_logs`):** homologação operacional autenticada **MASTER/AAL2 PASS**.
- **Trilha confirmada em `public.saas_master_audit_logs`:** eventos comerciais **39, 40 e 42** (`draft_updated` / `successor_draft` / promoção) e eventos **43 e 44** de exclusão controlada verificados.
- **Estado pós-homologação:** catálogo comercial restaurado sem resíduos observados; paginação SQL em duas páginas **PASS**.

### 3. Ressalvas e riscos residuais preservados
- **Paginação visual além da primeira página na interface:** **`NOT EVALUATED`**.
- **Risco teórico residual de deadlock (`40P01`) em `C05`:** permanece **não eliminado** o interleaving inverso preexistente entre `update_saas_plan_version_draft` (`saas_plan_versions -> saas_plans` quando não há versão publicada) e `delete_saas_plan_if_unused` (`saas_plans -> saas_plan_versions`); as RPCs permanecem intactas e o PostgreSQL falha fechado com rollback `40P01` sem corrupção.
- **Macroetapa `M06`:** segue **`EM_EXECUCAO`** até fechamento de `M06.01` e `M06.03` (incluindo aplicação controlada de `20261115120000_v35_tenant_timezone_financial_dates.sql` no DEV).

---

## M06.02 — Gate Final de Concorrência Comercial em PostgreSQL Descartável (`view-master-planos`, 24/11/2026)

**Implementado o teste automatizado multi-sessão `scripts/check_commercial_concurrency_pg.py` (`C01–C05`) integrado ao PostgreSQL 17 descartável do CI (`.github/workflows/foundation-checks.yml`), sobre a base `b59721e71e7201e8270b3f01ae42b15fd88606ad`. Execução runtime em PostgreSQL permanece `NOT EVALUATED` localmente por ausência de `psql`/`docker` (aguarda execução no GitHub Actions após push); `M06.02` permanece `EM_EXECUCAO`.**

### 1. Escopo implementado (`scripts/check_commercial_concurrency_pg.py`, `.github/workflows/foundation-checks.yml`)
- **Fonte SQL real:** extrai DDL, constraints, triggers e RPCs reais das migrations (`202609040001`..`20261010010836` e `20261124220000_v35_commercial_draft_audit_logs.sql`), validando primeiro `BEGIN ... ROLLBACK` da ADR-0049 antes da carga na base descartável `commercial_concurrency_gate`.
- **Contenção real multi-conexão:** usa duas conexões independentes (`psql`), `lock_timeout`/`statement_timeout` controlados, barreira por `pg_advisory_lock` após a RPC da Sessão 1 e verificação obrigatória via `pg_stat_activity` (`wait_event_type = 'Lock'`) + `pg_locks` (`NOT granted`) + `pg_blocking_pids`, falhando se a contenção esperada não ocorrer ou se surgir deadlock `40P01`.
- **Cenários cobertos:**
  - `C01`: edição simultânea em `update_saas_plan_version_draft` (serialização, integridade de entitlements/auditoria e timeout controlado `55P03` com zero vazamento).
  - `C02`: `update_saas_plan_version_draft` × `publish_saas_plan_version` nos dois sentidos (bloqueio `23503` pós-publicação sem sobrescrita e publicação preservando edição concluída antes).
  - `C03`: `create_saas_plan_successor_draft` simultânea (numeração sequencial `2`/`3` sem colisão nem falsa idempotência, e continuidade `4` sem lacuna após `ROLLBACK`).
  - `C04`: `update_saas_plan_version_draft` × `set_saas_plan_active` nos dois sentidos (preservação conjunta de campos comerciais, flag `active` e logs de auditoria sem lost update).
  - `C05`: `update_saas_plan_version_draft` / `publish_saas_plan_version` × `delete_saas_plan_if_unused` (`delete` após `update` sem órfãos, `update` pós-`delete` rejeitado com `23503`, e `delete` pós-`publish` bloqueado com `55000` sem bypass).
- **Preservação:** zero execução contra Supabase DEV/PROD, zero alteração nas RPCs de produção, zero alteração nas 66 migrations baseline e sem novos serviços ou dependências externas no workflow.

### 2. Limites e próximo passo
- **Local (`NOT EVALUATED` para runtime PostgreSQL):** ambiente sem `psql`/`docker`; `py_compile`, extração das declarações SQL, `check_v35_preservation.py`, typecheck/lint/build e testes JS comerciais verificados localmente.
- **Próximo passo:** push para executar `.github/workflows/foundation-checks.yml` (job `onboarding`, etapa `Commercial concurrency PostgreSQL gate`) no GitHub Actions (`postgres:17`) e confirmar `C01–C05 PASS` antes de qualquer conclusão da etapa.

---

## M06.02 — Consolidação Pós-Migration ADR-0049 no DEV e Alinhamento da UI (`view-master-planos`, 24/11/2026)

**ADR-0049 aplicada exclusivamente no Supabase DEV (`szqkdekwhzxsoxorgvaz`, versão remota `20261125002909_v35_commercial_draft_audit_logs`, arquivo Git `20261124220000_v35_commercial_draft_audit_logs.sql` em `765a8a661f7375a22183f17c35036a297f4c1e79`), validada com `COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS` e textos informativos da interface atualizados no Gemini; `M06.02` permanece `EM_EXECUCAO` aguardando sync/push, CI, Cloudflare DEV e homologação independente no Work.**

### 1. Evidências confirmadas no Supabase DEV (`szqkdekwhzxsoxorgvaz`)
- Aplicação da migration `20261125002909_v35_commercial_draft_audit_logs`: **SUCCESS** (PROD não alterado).
- Três RPCs atualizadas presentes no catálogo (`update_saas_plan_version_draft`, `create_saas_plan_successor_draft`, `update_saas_promotion_draft`), `SECURITY DEFINER` preservado, `anon` sem permissão de execução e controle `MASTER/AAL2` preservado.
- Teste PostgreSQL transacional aprovado (**`COMMERCIAL_DRAFT_AUDIT_ROLLBACK_PASS`**), com dados de negócio e contagem de `saas_master_audit_logs` preservados após `ROLLBACK` (zero mutação persistente).
- Divergência de timestamp (`20261124220000` no Git vs `20261125002909` no DEV) registrada como item `#9` em `docs/V35_MIGRATION_RECONCILIATION_DEV.md` sem alterar os itens `#1`–`#8`, sem renomear a migration do GitHub e mantendo `20261109233000_v35_onboarding_acceptance.sql` pendente.

### 2. Atualização da interface (somente texto informativo)
- `src/components/MasterPlanLifecycle.tsx`: parágrafo informativo atualizado para registrar que criação inicial idempotente, edição de rascunho, criação de versão sucessora, publicação, ativação/desativação e exclusão gravam evento transacional em `saas_master_audit_logs`.
- `src/components/MasterPromotions.tsx`: parágrafo informativo atualizado para registrar que criação/sucessora idempotente, edição de rascunho promocional, publicação, ativação/desativação e exclusão gravam evento transacional em `saas_master_audit_logs`.
- Nenhuma alteração em formulários, RPCs, contratos, validações, layout, regras comerciais, Auth, MFA, RLS, RBAC ou preços/planos/ofertas.

### 3. Pendências preservadas para homologação independente no Work
- Concorrência simultânea real entre duas sessões permanece **`NOT EVALUATED`**.
- Homologação operacional autenticada no navegador DEV (após sync/push, GitHub Actions PASS e deploy automático no Cloudflare DEV) permanece pendente; **não** declarar `M06.02` integralmente homologada nesta rodada.

---

## M06.02 — Revisão Final da Migration de Auditoria Comercial (`view-master-planos`, 24/11/2026 — preparado para revisão)

**Revisão final da proposta SQL de auditoria para `update_saas_plan_version_draft`, `create_saas_plan_successor_draft` e `update_saas_promotion_draft` CONCLUÍDA localmente no Gemini sobre `dea48d9ca522e91de90dee2f307cf1249ac3be63` (CI `45488251975` 3/3 PASS, 625/625 testes). Nenhuma migration aplicada em DEV/PROD e nenhuma operação comercial remota executada; `M06.02` segue `EM_EXECUCAO`.**

### 1. Artefatos preparados
- `supabase/migrations/20261124220000_v35_commercial_draft_audit_logs.sql`: redefinição idempotente e aditiva das três RPCs em `public` preservando assinaturas, `SECURITY DEFINER`, `set search_path = ''`, `private.require_platform_staff('MASTER')` e `EXECUTE` apenas para `authenticated`.
- `supabase/tests/test_commercial_draft_audit_rollback.sql`: teste determinístico `BEGIN ... ROLLBACK` cobrindo ACLs, invariante estrutural de lock, negativas de autorização (`auth.uid()` nulo, AAL1, `SUPPORT`, `BILLING`, não-staff, `anon`), `F2` (`NULL`/array/escalar em `p_entitlements` sem apagar entitlements preexistentes + `'{}'::jsonb` explícito), validações `F3`, auditoria `F4`, rollback atômico em `23505`/`23503` e leitura via `list_master_audit_events`.
- `docs/adr/0049-commercial-draft-audit-logs.md`: registro decisório de ordem de locks, guarda de entitlements, alinhamento de validação e eventos de auditoria.

### 2. Decisões técnicas consolidadas (F1–F4)
- **F1 (Ordem de locks):** rejeitada a inversão proposta anteriormente (`saas_plans -> saas_plan_versions`) em `update_saas_plan_version_draft`; preservada a ordem original `public.saas_plan_versions ... FOR UPDATE` seguida da atualização condicional de `public.saas_plans`, mantendo compatibilidade direta com `publish_saas_plan_version`. `create_saas_plan_successor_draft` bloqueia `saas_plans FOR UPDATE` antes de inserir nova versão; `set_saas_plan_active` e `delete_saas_plan_if_unused` não concorrem em ciclo invertido com `update_saas_plan_version_draft` (a exclusão exige ausência de assinaturas/faturas e o rascunho não altera estado durante a publicação depois de publicado).
- **F2 (Proteção contra `NULL` em `p_entitlements`):** removido `coalesce(p_entitlements, '{}'::jsonb)` tanto em `update_saas_plan_version_draft` quanto em `create_saas_plan_successor_draft`. Ambas validam `p_entitlements IS NOT NULL`, `jsonb_typeof(p_entitlements) = 'object'` e `pg_column_size(p_entitlements) <= 16000` antes de adquirir qualquer lock (`SQLSTATE 22023`), preservando `'{}'::jsonb` quando explicitamente enviado.
- **F3 (Alinhamento de validação e frontend):** todas as restrições espelham `create_master_plan_draft_idempotent`, `create_master_promotion_draft_idempotent`, `create_master_promotion_successor_idempotent`, `MasterPlanLifecycle.tsx` e `MasterPromotions.tsx`, mantendo `update_saas_promotion_draft` sem `p_valid_from > now()` para permitir edição de rascunhos cuja data inicial já esteja próxima ou em curso antes da publicação.
- **F4 (Auditoria transacional mínima):** inserção em `public.saas_master_audit_logs` ao final de cada mutação (`saas_plan_version.draft_updated`, `saas_plan_version.successor_draft`, `saas_promotion.draft_updated`) somente com IDs/metadados operacionais mínimos, sem PII, secrets ou JSONB integral de entitlements.
- **Textos informativos na UI (`MasterPlanLifecycle.tsx:378`, `MasterPromotions.tsx:339`):** mantidos intencionalmente sem alteração nesta entrega para continuar refletindo a verdade do DEV atual; após aplicação controlada da migration no DEV, remover o aviso de ausência de evento para essas três operações em follow-up dedicado.

### 3. Limites e próximo ciclo
- Ambiente local sem daemon/CLI PostgreSQL (`psql`, `pg_isready`, `docker` ausentes): execução em runtime de `test_commercial_draft_audit_rollback.sql` e contenção real paralela entre duas sessões permanecem **`NOT EVALUATED`**.
- **Próxima etapa:** revisão humana do PR, aplicação controlada de `20261124220000_v35_commercial_draft_audit_logs.sql` no DEV mediante autorização específica, execução da suíte `ROLLBACK` + verificação pós-migração no DEV e ajuste pós-deploy da cópia informativa em `MasterPlanLifecycle.tsx`/`MasterPromotions.tsx`.

---

## M06.02 — Correção de integridade no Ciclo de Vida Comercial (`view-master-planos`, 24/11/2026)

**Correções de integridade F1, F2 e conferência documental F3 CONCLUÍDAS localmente no Gemini sobre a base `67cd89daa943ada01fad9d9638c796ed64e11d46` (CI `45480497365` 3/3 PASS, 617/617 testes). Nenhuma migration SQL criada; `view-master-planos` permanece `IMPLEMENTADO_E_TESTADO` e `M06.02` segue `EM_EXECUCAO`.**

### 1. F1 — Eliminação de reenvio cego em RPCs sem chave de idempotência (`MasterPlanLifecycle.tsx`, `MasterPromotions.tsx`)
- As quatro RPCs sem `p_idempotency_key` (`update_saas_plan_version_draft`, `set_saas_plan_active`, `update_saas_promotion_draft`, `set_saas_promotion_series_active`) passaram para `retryable: false` (além de `create_saas_plan_successor_draft`, `delete_saas_plan_if_unused` e `delete_saas_promotion_series_if_unused`, já não reenviáveis).
- Em falha de transporte com resultado incerto nessas operações: **nenhum** botão `Verificar envio` ou repetição cega é oferecido; o estado entra em `reconcileRequired: true`, todos os formulários de mutação permanecem travados (`locked = pending || uncertain || reconcileRequired`) e é exigida atualização explícita via `Atualizar rascunhos` / `Atualizar ofertas`, que só destrava quando `loadPlatformCommercialCatalog` conclui com sucesso.
- Preservados intactos: reenvio com a mesma `p_idempotency_key` nos comandos `*_idempotent` (`create_master_plan_draft_idempotent`, `publish_master_plan_draft_idempotent`, `create_master_promotion_draft_idempotent`, `create_master_promotion_successor_idempotent`, `publish_master_promotion_draft_idempotent`), guarda de concorrência (`guard.current`) e distinção entre rejeição determinística do banco (`22023`, `23503`, `23505`, `23514`, `42501`, `28000`, `55000`, `PT409`) e falha de rede incerta.

### 2. F2 — Leitura fail-closed dos entitlements (`src/lib/master-commercial.ts`)
- Removido o `continue` silencioso em `loadPlanVersionEntitlements`: o cliente agora exige projeção explícita `.select('plan_version_id,entitlement_key,entitlement_value')` e `.limit(201)` (rejeitando `> 200` linhas).
- Falha fechada (exceção) se qualquer linha não for objeto válido, vier sem ou com `plan_version_id !== planVersionId`, tiver `entitlement_key` vazio/com espaços nas bordas/`> 120` chars/`__proto__`/`constructor`/`prototype`, tiver `entitlement_value === undefined` ou chave duplicada (`seenKeys`).
- Em leitura parcial/inconsistente na edição de rascunho de plano (`MasterPlanLifecycle.tsx`), campos e botão `Salvar alterações do rascunho` permanecem desabilitados (`<fieldset disabled={locked || editLoadingDetails || Boolean(editDetailsError)}>`).

### 3. F3 — Conferência documental da auditoria em SQL (`supabase/migrations/`)
- **Gravam explicitamente em `public.saas_master_audit_logs`:**
  - `create_master_plan_draft_idempotent` → `'saas_plan_version.draft_created'` (`20261010010836`)
  - `publish_master_plan_draft_idempotent` → `publish_saas_plan_version` → `'saas_plan_version.publish'` (`20261002202107`)
  - `set_saas_plan_active` → `'saas_plan.reactivate'` / `'saas_plan.deactivate'` (`20261002202107`)
  - `delete_saas_plan_if_unused` → `'saas_plan.delete_unused'` (`20261002202107`)
  - `create_master_promotion_draft_idempotent` → `'saas_promotion.draft_created'` (`20261010210329`)
  - `create_master_promotion_successor_idempotent` → `'saas_promotion.successor_draft'` (`20261010211529`, preservado em `20261019205415`)
  - `publish_master_promotion_draft_idempotent` → `'saas_promotion.published'` (`20261010210329`)
  - `set_saas_promotion_series_active` → `'saas_promotion.reactivate'` / `'saas_promotion.deactivate'` (`20261002202107`, além de `saas_promotion_series_state`)
  - `delete_saas_promotion_series_if_unused` → `'saas_promotion.delete_unused'` (`20261002202107`)
- **NÃO gravam em `public.saas_master_audit_logs` (sem `INSERT` explícito e sem trigger de auditoria):**
  - `update_saas_plan_version_draft` (`20261002202107:89-174`): atualiza colunas + substitui entitlements e aciona apenas triggers de `updated_at` / guarda de versão publicada.
  - `create_saas_plan_successor_draft` (`20261002202107:176-223`): grava `created_by = auth.uid()` na nova versão em `saas_plan_versions`, sem registro em `saas_master_audit_logs`.
  - `update_saas_promotion_draft` (`20261002202107:518-565`): atualiza rascunho de oferta e aciona apenas `saas_promotions_set_updated_at` e `saas_promotions_published_terms_guard`.
- Textos da interface em `MasterPlanLifecycle.tsx` e `MasterPromotions.tsx` ajustados para descrever fielmente esse recorte sem criar novas migrations.

---

## M06.02 — Planos SaaS (`view-master-planos`): PASS visual da apresentação e Ciclo de Vida Comercial Completo (24/11/2026)

**Paridade visual de apresentação em Planos SaaS (`view-master-planos`) com PASS pelo Work no recorte disponível da revisão `6585c1e62b6b472299948b93925c39b6895f2a7a` (sem promover a tela integral a HOMOLOGADO_DEV); Ciclo de Vida Comercial Completo de Planos e Ofertas (`view-master-planos`) IMPLEMENTADO E TESTADO localmente no Gemini sobre RPCs reais já existentes no DEV (CI pós-push e QA autenticado DEV pendentes); M06.02 geral segue EM_EXECUCAO.**

### 1. Reconciliação de estado anterior (`6585c1e62b6b472299948b93925c39b6895f2a7a`)
- **Base funcional anterior:** `6585c1e62b6b472299948b93925c39b6895f2a7a`, CI **`45474973273`** **3/3 PASS** (**609/609 testes**), Workers Builds DEV **SUCCESS**.
- **Homologação do Work no recorte de apresentação:** **PASS visual** nos rótulos comerciais legíveis e cards de planos/ofertas em `view-master-planos` no recorte disponível, mantendo documentado que isso **não** equivale à homologação integral da tela nem altera seu status canônico na matriz.
- **Triagem de outras candidatas M06.02 (sem inventar backend):**
  - `view-master-config` (Configurações da Plataforma): permanece somente leitura no recorte atual por **ausência de RPCs de escrita** no schema PostgreSQL (`saas_platform_configuration` e `saas_terms_versions` possuem apenas políticas `SELECT` e privilégios de mutação revogados; exigiria nova migration e ADR).
  - `view-master-cobranca` (Cobrança SaaS): emissão manual (`preview/issue_saas_manual_invoice`), filtros, paginação e composição já entregues; pagamentos automáticos, régua/dunning, cancelamento/estorno e acordos comerciais carecem de RPCs específicas no schema e decisões comerciais (`M04.04`).

### 2. Nova entrega funcional implementada (`view-master-planos` — Ciclo de Vida Comercial V35)
- **Contratos reais reutilizados no PostgreSQL DEV (`20261002202054` e `20261002202107`, com `SECURITY DEFINER`, `private.require_platform_staff('MASTER')` MFA/AAL2 e auditoria em `saas_master_audit_logs`):**
  1. **Planos (`src/components/MasterPlanLifecycle.tsx`, `src/lib/master-commercial.ts`):**
     - `create_saas_plan_successor_draft`: criação de nova versão sucessora (`v(max+1)`) em rascunho sobre plano existente sem sobrescrever histórico publicado, carregando entitlements da versão base (`loadPlanVersionEntitlements`) com falha fechada em caso de erro de leitura e proteção contra reenvio duplicado em falha de rede incerta (sem `Verificar envio` automático para criação não-chaveada por idempotência).
     - `update_saas_plan_version_draft`: edição de versão ainda em `draft` (nome, código, preço, periodicidade, teste, tolerância, competência e recursos JSON carregados via `saas_plan_version_entitlements`).
     - `set_saas_plan_active`: desativação e reativação de planos com motivo obrigatório auditado, preservando versões publicadas e assinaturas ativas.
     - `delete_saas_plan_if_unused`: exclusão segura habilitada apenas quando `can_delete_plan === true`, exigindo motivo obrigatório + confirmação digitada `EXCLUIR`, validação estrita de retorno booleano `true` e tratamento determinístico de bloqueio `55000`.
  2. **Ofertas e Promoções (`src/components/MasterPromotions.tsx`, `src/lib/master-commercial.ts`):**
     - `update_saas_promotion_draft`: edição em rascunho **estritamente restrita** a ofertas com `latest_version_status === 'draft'`, carregando detalhes completos de `saas_promotions` (`loadPromotionDraftDetails`) com falha fechada se indisponível. Ofertas publicadas permanecem exclusivamente no fluxo de versão sucessora (`create_master_promotion_successor_idempotent`).
     - `set_saas_promotion_series_active`: desativação e reativação de séries promocionais com motivo obrigatório auditado.
     - `delete_saas_promotion_series_if_unused`: exclusão segura habilitada apenas quando `can_delete === true`, exigindo motivo obrigatório + confirmação digitada `EXCLUIR`, validação de retorno booleano `true` e tratamento determinístico `55000`.
  3. **Sincronização reativa (`src/components/MasterCommercialCatalog.tsx`):** callback opcional `onCatalogChange` atualiza cards e histórico somente após confirmação de comando gravado no servidor, mantendo consultas iniciais e filtros estritamente somente leitura.
- **Regressões e limites:** sem alterações de PROD, RLS, Auth, MFA, migrations ou contratos financeiros; criação/publicação em ambiente DEV real reservadas para homologação controlada no Work após sync/push e CI.

---

## M06.02 — Fluxo de Caixa (aviso Projetado encerrado) e Paridade de Apresentação em Planos SaaS (24/11/2026)

**Aviso do modo Projetado (`view-fluxo-caixa`) CONCLUÍDO no recorte visual; Paridade de apresentação em Planos SaaS (`view-master-planos`) IMPLEMENTADA E TESTADA localmente no Gemini (CI pós-push e QA autenticado DEV pendentes); M06.02 geral segue EM_EXECUCAO.**

### 1. Consolidação do aviso Projetado (`view-fluxo-caixa`)
- **Revisão aplicada:** `34291d4945bb01659c5c11dbbd877ac2e06e961d` (`34291d4`), CI [45463715864](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/45463715864) **3/3 PASS**, Workers Builds DEV **SUCCESS**.
- **Homologação visual em navegador real (proprietário/DEV):** **PASS em 390 px e 1024 px** com fundo escuro `var(--surface-2)` em `src/components/FluxoCaixa.tsx`, texto preservado e período preservado de **02/11/2026 a 24/11/2026** nas trocas de modo (fechado sem PR documental isolado).

### 2. Paridade de apresentação em Planos SaaS (`view-master-planos`, base `34291d4945bb01659c5c11dbbd877ac2e06e961d`)
- **Entrega A — Terminologia comercial (`src/lib/master-commercial.ts`, `src/components/MasterCommercialCatalog.tsx`):** tradução determinística no catálogo de versões e filtros sem alterar valores técnicos subjacentes (`monthly` → `Mensal`, `yearly` → `Anual`, `custom` → `Personalizada`, `current` → `Vigente para novas contratações`, `future` → `Publicada futura`, `historical` → `Histórica / contratos existentes`, `draft` → `Rascunho`, `inactive` → `Plano desativado`) e mapeamento seguro para estados não reconhecidos (`Periodicidade não reconhecida`, `Situação não reconhecida`, `Publicação não reconhecida`, `Status não reconhecido`) e motivos de bloqueio de exclusão (`can_delete_plan`/`can_delete`).
- **Entrega B — Cards comerciais com dados reais (`src/components/MasterCommercialCatalog.tsx`):** adicionados cards responsivos (`.master-config-grid` / `.master-config-card`) para versões de planos visíveis após filtros (identificação do plano/código interno, versão e status de publicação, preço e moeda, periodicidade, situação administrativa, vigência, dias de trial/tolerância e regra de exclusão) e cards de séries de ofertas/promoções (nome/código público, versão, status, vigência, resgates confirmados e regra de exclusão), preservando integralmente os formulários reais `MasterPlanLifecycle` e `MasterPromotions`, os filtros `valid_from`/status, contagem e limpeza, além das notas contratuais V35 (`Regra contratual` e `Boa prática comercial`).
- **Entrega C — Lacunas documentadas (sem invenção de dados ou botões inativos):**
  - Coluna **Usuários** no histórico: **não exibida** porque `public.v_saas_plan_version_admin` não expõe limite estruturado de usuários (`saas_plan_version_entitlements` é JSONB livre e não é consultada pelo catálogo somente leitura).
  - Coluna **Ações por linha** e botões de demonstração (`Editar`, `Publicar` por linha, `Criar sucessora` para planos, `Desativar/Reativar`, `Excluir`): **não adicionados** na tabela somente leitura; criação de rascunho e publicação idempotente com confirmação `PUBLICAR` permanecem nos fluxos protegidos de `MasterPlanLifecycle` e `MasterPromotions`, sem alterar RPCs, banco ou consultas.
- **Verificações locais no Gemini:** `npx vitest run src/components/MasterCommercialCatalog.test.tsx src/components/MasterPlanLifecycle.test.tsx src/components/MasterPromotions.test.tsx src/components/FluxoCaixa.test.tsx` → **4 arquivos / 22 testes PASS (exit 0)** (`MasterCommercialCatalog.test.tsx` 7/7, `MasterPlanLifecycle.test.tsx` 5/5, `MasterPromotions.test.tsx` 6/6, `FluxoCaixa.test.tsx` 4/4); `typecheck` e `vite build` aprovados.
- **Limitações:** suíte integral (`npm run check`) e homologação visual autenticada DEV pós-push permanecem **PENDENTES** (a confirmar via GitHub Actions após sync/push e navegador real no DEV).

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

**Implementação consolidada de F1–F5 e testes automatizados CONCLUÍDOS no Gemini AI Studio. CI pós-push e homologação autenticada no Cloudflare DEV permanecem PENDENTES.** M06.02 geral **EM_EXECUCAO**. Planos SaaS, Cobrança SaaS, drawer transversal, chamados Master e Dashboard Mobile não reabertos.

### Diretriz operacional e revisão de origem

- **Diretriz operacional do proprietário:** Gemini AI Studio definido como agente prioritário para diagnóstico, implementação, revisão local e testes automatizados/executáveis disponíveis no ambiente; ChatGPT Work reservado para homologação independente autenticada no Cloudflare DEV e verificações indisponíveis no Gemini.
- **Revisão de origem:** branch `main`, HEAD **`3da4f1e1656da23736c38c63b70f8f3d41828ea8`** (PR documental #65 integrado; revisão funcional anterior **`025d165da1e587c40170ec967b9ce16ccb7e6b4e`**, CI `44651527695` 3/3 PASS, 598 testes em 85 arquivos, Workers Builds `4a69d852-ffaf-4ecf-8ad0-08930ddc6d2c` SUCCESS).

### Diagnóstico e correções implementadas (F1–F5)

1. **F1 — Eliminação de dados obsoletos e estados fail-closed (`src/components/MasterPlatformConfig.tsx`):**
   - Ao iniciar a consulta ou atualizar (`revision` / troca de `client`), `config` e `terms` são limpos imediatamente (`setConfig(null)`, `setTerms(null)`), impedindo retenção visual de dados obsoletos durante `loading`, `error` ou `denied` (`42501` / `28000`).
   - As abas e os painéis de configuração só são renderizados quando **ambas** as consultas (`loadPlatformConfiguration` e `loadPlatformTerms`) concluem com sucesso e validação aprovada (`!loading && !denied && !error && config !== null && terms !== null`). Falha em qualquer uma das duas consultas bloqueia a exibição parcial.
   - Controle de concorrência com `AbortController` + contador monotônico de requisição (`requestSeqRef`) descarta respostas atrasadas ou abortadas.
   - Mensagens de erro de falha genérica são sanitizadas na fronteira de apresentação, sem expor mensagens técnicas internas do backend, preservando a recuperação pelo botão `Atualizar`.
2. **F2 — Acessibilidade completa das 6 abas (`src/components/MasterPlatformConfig.tsx`):**
   - Implementado o padrão WAI-ARIA Tabs completo para as seis seções (`identity`, `commercial`, `billing`, `communications`, `legal`, `integrations`): `role="tablist"`, `role="tab"`, `id="master-config-tab-${id}"`, `aria-selected`, `aria-controls="master-config-panel-${id}"`, `tabIndex` roving (`0` na aba ativa, `-1` nas inativas) e `role="tabpanel"` com `id="master-config-panel-${id}"` e `aria-labelledby="master-config-tab-${id}"`.
   - Apenas o painel da seção ativa é montado no DOM, eliminando controles ocultos na ordem de tabulação.
   - Navegação por teclado nas abas com ativação imediata e transferência de foco para `ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`, `Home` e `End` (circular), além de `Enter`, `Space` e clique.
   - A seção ativa (`activeSection`) é preservada após atualização bem-sucedida (`Atualizar`).
3. **F3 — Consistência visual com o tema escuro CorSys e responsividade (`src/components/MasterPlatformConfig.tsx`, `src/styles.css`):**
   - Removidas todas as classes claras incompatíveis (`bg-slate-50`, `text-slate-900`, `text-slate-700`, `bg-slate-100`, `bg-blue-600`, `bg-emerald-100`, `bg-amber-100`) em favor de tokens e classes do tema escuro CorSys (`.panel`, `.section-title`, `.callout`, `.status`, `.badge`, `.finance-table`, `.master-config-*` com `var(--surface)`, `var(--text)`, `var(--muted)`, `var(--gold)`, `var(--border-soft)`).
   - Distinção visual explícita entre aba selecionada (`[aria-selected="true"]` com fundo `rgba(197, 168, 128, .14)` e borda dourada translúcida) e foco de teclado (`:focus-visible` com `outline: 2px solid var(--gold)`, `outline-offset: 2px` e `box-shadow`).
   - Tabela de termos envolvida em região nomeada rolável por teclado (`className="finance-table" role="region" aria-label="Tabela de termos e políticas versionadas" tabIndex={0}`), `overflow-wrap: anywhere` em valores longos (endereços, e-mails, CNPJ, razão social) e eliminação de ID duplicado `#view-master-config` quando montado dentro de `MasterConsole`.
4. **F4 — Minimização e validação proporcional de dados (`src/lib/master-config.ts`):**
   - Substituído `.select('*')` em `loadPlatformConfiguration` pela projeção explícita `PLATFORM_CONFIGURATION_SELECT` restrita aos campos não secretos necessários à tela (excluindo `updated_by`).
   - Reconciliada a projeção `PLATFORM_TERMS_SELECT` (`id,document_type,version,status,effective_at,valid_to`) com o schema PostgreSQL real de `public.saas_terms_versions` (`20261002201717_202609080006_saas_platform.sql` e `20261002202042_202609090014_v33_saas_control_plane.sql`), onde a coluna versionada é `version` e não há coluna `title` na tabela física, mantendo compatibilidade normalizada com `version_number` e `title` dos contratos e testes existentes.
   - Adicionados validadores determinísticos fail-closed `validatePlatformConfiguration` e `validatePlatformTerms`: invariante `singleton === true`, inteiros e limites do schema (`default_trial_days >= 0`, `default_grace_days >= 0`, `default_retention_days >= 0`, `default_due_day` entre `1` e `28`), `primary_collection_channel in ('email', 'whatsapp', 'email_whatsapp')`, `status in ('draft', 'published', 'retired')`, timestamps válidos, `valid_to > effective_at` quando presente e rejeição de IDs duplicados.
5. **F5 — Prontidão de integrações sem falsa confirmação (`src/components/MasterPlatformConfig.tsx`):**
   - Removido o rótulo enganoso `Conectado` quando `*_provider_status === 'configured'`.
   - Mapeamento determinístico sem falsa prontidão:
     - `'configured'` → `Configurado` + `Disponibilidade operacional não verificada`.
     - `'not_configured'` → `Não configurado` + `Disponibilidade operacional não verificada` (e tag complementar `Pendente de homologação` no Gateway de Pagamentos).
     - Valor desconhecido → `Estado não reconhecido` + `Disponibilidade operacional não verificada` (sem ecoar string bruta não confiável na interface).

### Reconciliação V35 (`view-master-config`) e limites do escopo

- Mantido o recorte estritamente somente leitura sob governança Master/AAL2, cobrindo as 6 seções da V35 (`identity`, `commercial`, `billing`, `communications`, `legal`, `integrations`).
- Não foram adicionados botões mortos (`Editar configurações`, `Revisar`), modais demonstrativos sem contrato backend auditado nem mutações de banco/Auth/RLS. A edição persistente de configurações globais e o fluxo de revisão de documentos permanecem registrados como lacunas residuais da tela integral frente ao protótipo demonstrativo V35.

### Testes e verificações executados no Gemini

- `npx vitest run src/components/MasterPlatformConfig.test.tsx`: **12/12 PASS (exit 0)** — 3 testes existentes preservados + 9 novos testes cobrindo F1–F5.
- Suíte completa Vitest: **607/607 testes aprovados em 85 arquivos (exit 0)**.
- `npm run typecheck` (`tsc --noEmit`): **PASS (exit 0)**.
- `npm run build` (`vite build`): **PASS (exit 0)**.
- `npx wrangler deploy --dry-run --config wrangler.dev.jsonc`: **PASS (exit 0)**.
- **Pendente após push:** confirmação do GitHub Actions CI no repositório remoto e homologação autenticada Master/AAL2 no Cloudflare DEV pelo ChatGPT Work.

---

## M06.02 — Cobrança SaaS: recorte de consulta/filtros/acessibilidade aprovado (19/11/2026)

**Aceite funcional CONCLUIDO somente no recorte disponível de consulta, filtros, estados observáveis, teclado e responsividade. Cobrança SaaS integral NÃO HOMOLOGADA.** Sem defeito funcional reproduzido; operações financeiras, casos indisponíveis e lacunas V35 permanecem separados. M06.02 geral EM_EXECUCAO. Planos, drawer, chamados Master e Dashboard Mobile não reabertos.

### Revisão, ambiente e reaproveitamento

- GitHub main **`46b08c20d36cb792004c134d76dbd445ecdaac7b`**; funcional `025d165da1e587c40170ec967b9ce16ccb7e6b4e`. Árvore src **`f10358a3abda5b85f220713a69a24c55f871621b`** preservada. Checkout isolado funcional limpo; workspace antigo não modificado.
- Workers Builds **SUCCESS**, build **`b479de7f-66ad-4db3-93ff-73643aeeaf6a`**, versão DEV avaliada **`96a75c83-ce8a-449a-95a3-d642c2a27570`**. Referência de rollback documental anterior: `b86d492c-e8ec-4ab0-82a2-f3d75ded4fbc`, mesmo código funcional. Nenhum deploy executado.
- Assets servidos **index-C-35ixZm.js / index-BJXaZgFj.css**, iguais em nome aos observados na rodada anterior, mas diferentes dos nomes do build Windows então registrado. **Equivalência binária/causa da divergência NOT EVALUATED.** Ambiente e configuração exatos do Workers Builds não foram reproduzidos; não se repetiu build Windows que não resolveria essa limitação, nem se alterou deploy/infra. Origem do commit e preservação do código-fonte verificadas por GitHub/Workers e árvore src, sem afirmar igualdade binária.
- [CI 44626184697](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44626184697) **3/3 PASS**, 598 testes/85 arquivos. Logs confirmam **MasterBilling 17/17**, **ResponsiveLayout 7/7**. Reutilizados sem repetir suíte local. Os testes com clientes simulados não são homologação de operação financeira real.
- Consultados AGENTS.md, handoff/cursor/quadro/matriz, referência view-master-cobranca, MasterBilling.tsx, master-billing.ts e testes. Sessão Master existente acessou a área de consulta; sem mudanças em AAL2/MFA/Auth/RLS/RBAC, leitura de credenciais ou simulação de claims.

### Classificação A–E

| Cenário | Resultado | Limite do aceite |
|---|---|---|
| A — consulta/contexto | **PASS na UI** | Estado inicial sem Loja, seis Lojas consultadas em ambos os modos, trocas sem fatura/composição residual, retorno sem Loja limpa documentos. Não é comprovação independente de RLS. |
| B — filtros/paginação | **PASS nos filtros e controles disponíveis; paginação real NOT EVALUATED** | Número completo/parcial, seis status, competência, combinação, vazio, limpeza/atualização e reset por Loja. Apenas uma fatura; positivas de outros status e navegação para página2 indisponíveis. |
| C — estados/integridade | **PASS na apresentação e consistência aritmética observável; demais critérios NOT EVALUATED** | Composição carregada e reconciliada visualmente com o total; documento cancelado tratado especificamente. Pagamentos, erro/recuperação reais e validação financeira independente indisponíveis. |
| D — responsividade/acessibilidade | **PASS no conteúdo disponível** | Cinco larguras sem overflow do documento; tabelas de fatura/composição preenchidas, scroll interno, labels, teclado/foco e detalhamento. Tabela de pagamentos preenchida NOT EVALUATED. |
| E — emissão manual | **PASS na inspeção permitida** | Painel abre/fecha, labels/avisos e ausência de prévia/confirmação antes da consulta. Não acionados RPC de prévia nem emissão; operações comerciais reais NOT EVALUATED. |

### A — dados e isolamento de contexto

- Entrada direta em Cobrança SaaS: **Selecione a Loja**, sem documentos, filtros de faturas, paginação ou composição apresentados antes da escolha.
- Diretório disponível: CORSYS DEV TENANT A/B; DEV QA FINANCE A/B 20261015; DEV QA INTERFACE A/B 20261014. Consultadas **as seis Lojas** nos modos Faturas e Pagamentos SaaS.
- **Uma fatura cancelada** em QA Finance A; zero faturas nas demais cinco Lojas. **Zero pagamentos SaaS nas seis Lojas**. Nenhum registro criado para ampliar cobertura.
- Documento disponível **CORSYS-202611-00003**, competência **2026-11**, vencimento **10/11/2026**, total atualizado **R$1,00**, pago **R$0,00**, aberto **R$0,00**, status **void**.
- Abrir composição, aplicar filtro na Loja A, reabrir composição e trocar para QA Finance B: tabela/documento/composição anteriores desaparecem, filtros voltam a vazio/Todos e página1. Alternar Faturas→Pagamentos remove a composição e os filtros de fatura; não aparece documento do outro modo. Ao retirar a seleção de Loja no fim, nenhum documento ou detalhamento permanece.
- Seleção de Loja por **Home/ArrowDown/Enter** alcançou Tenant A e consulta vazia correta. Interface mantém aviso de separação entre documentos comerciais SaaS e tesouraria das Lojas. Nenhuma consulta/ação financeira da tesouraria foi executada.

### B — filtros realmente executados

Todos os resultados abaixo foram obtidos na QA Finance A por consulta normal da interface:

| Caso | Resultado real | Classificação |
|---|---|---|
| Todos | 1 fatura cancelada | PASS |
| Pago | vazio | PASS vazio; positiva NOT EVALUATED |
| Parcial | vazio | PASS vazio; positiva NOT EVALUATED |
| Em atraso | vazio | PASS vazio; positiva NOT EVALUATED |
| Em aberto | vazio | PASS vazio; positiva NOT EVALUATED |
| Cancelado | 1 fatura, status void | PASS |
| Número completo CORSYS-202611-00003 | 1 fatura | PASS |
| Número parcial 202611 | mesma fatura | PASS |
| Número inexistente SEM-FATURA-M0602 | vazio | PASS |
| Busca literal CORSYS%, sublinhado e barra invertida | vazio nos três casos | PASS como complemento negativo real; escape parametrizado comprovado separadamente pelos testes existentes |
| Competência 2026-11 | 1 fatura | PASS |
| Parcial202611 + Cancelado + competência2026-11 | 1 fatura | PASS |
| Mesma combinação com competência2026-12 | vazio | PASS |
| Limpar por Enter e Space | campos limpos, Todos, página1, fatura restaurada | PASS |
| Atualizar cobrança | retorno à consulta correta da página1 | PASS |

- Competência confirmada por **edição de segmento no campo nativo e Tab**, não só por valor atribuído ao DOM. Seleção de status por Home/ArrowDown/Enter alcançou Pago e, após aplicar, consulta vazia esperada.
- Aplicar por **Enter no botão e no campo Número da fatura** submeteu somente o formulário de filtros. Limpar por Enter/Space restaurou a consulta.
- Implementação e teste existente17/17 confirmam filtros no cliente de consulta **antes de range/paginação**, .ilike com escape de barra/percentual/sublinhado, .eq de status e competência **AAAA-MM-01**. **Inspeção HTTP independente das requisições NOT EVALUATED**: não havia captura de rede autorizada exposta nesta sessão; não se usaram tokens ou chamadas ocultas para produzi-la.
- **Anterior/Próxima disabled e Página1** em todas as consultas com0/1 registros. Estados e rótulos PASS. **Navegação real Anterior/Próxima e reset desde página2 após aplicar/limpar NOT EVALUATED**, pois não há26 documentos. Permanecer na página1 não comprova reset a partir de outra página.

### C — composição e integridade observável

Composição acessada por **Enter em Ver composição**, com estado real “Conciliando composição do documento” seguido dos valores:

| Item | Valor exibido |
|---|---:|
| Base contratual | R$1,00 |
| Multa | R$0,00 |
| Juros | R$0,00 |
| Descontos e créditos | R$0,00 |
| Outros ajustes | R$0,00 |
| Total atualizado | R$1,00 |
| Pago na listagem | R$0,00 |
| Saldo aberto na listagem | R$0,00 |
| Status | void |

- **Consistência observável PASS:** base+ajustes=total atualizado e total da composição=total da listagem. **Documento cancelado não exige total=pago+aberto**; aberto zero com total histórico1 não foi classificado como erro. A regra especial também consta no consumidor/testes.
- **Integridade financeira independente NOT EVALUATED:** a apresentação e o retorno aceito pelo consumidor não substituem reconciliação com documentos/alocações de origem sob contexto autorizado equivalente. A limitação de contexto do conector já registrada na rodada Planos foi reaproveitada, sem repetir consultas incompatíveis nem alterar claims/Auth.
- **Pagamentos recebido/alocado/crédito não alocado, ativo/revertido: NOT EVALUATED real**, pois não existem pagamentos. Testes existentes cobrem rejeição de alocação inconsistente e outro tenant separadamente.
- **Estados reais PASS:** ausência de documentos nas cinco Lojas, ausência de resultados filtrados na Loja com fatura, atualização/retorno normal, loading da composição e limpeza de contexto/modo. Loading inicial da consulta de documentos foi transitório e **não capturado conclusivamente**; não convertido em PASS por inspeção do código.
- **Erro real, valores obsoletos durante falha, dados parciais e recuperação após falha: NOT EVALUATED.** Não alterada infraestrutura nem registros para provocar esses estados. Testes prévios de rejeição de organização diferente/integridade/composição discordante foram reutilizados, sem confundir fixture com browser real.

### D — medidas reais e teclado

Tabelas preenchidas de Faturas e Composição; o painel manual também estava aberto nas medições, sem executar consulta de prévia:

| innerWidth | Documento clientWidth/scrollWidth | Faturas client/scroll | Composição client/scroll |
|---:|---|---|---|
| 320 | 305/305 | 251/774 | 222/650 |
| 390 | 375/375 | 322/774 | 292/650 |
| 768 | 753/753 | 659/774 | 606/650 |
| 1024 | 1009/1009 | 639/774 | 586/650 |
| 1440 | 1425/1425 | 1043/1043 | 990/990 |

- Todas as tabelas com overflow-x:auto; nenhum controle fora da área horizontal do documento. Inspeção visual sem sobreposição dos filtros/botões/campos; empilhamento no mobile e redistribuição no desktop. Valores monetários reais0/1 legíveis no recorte disponível.
- Composição é região nomeada/tabIndex0. ArrowRight real moveu scroll interno em320; em390 alcançou o extremo direito (~358px), deixando os seis valores monetários visíveis, sem overflow da página.
- Labels associados a Loja, número, status, competência e aos três campos do painel manual. Tab percorreu status, segmentos de competência, Aplicar/Limpar, campos manuais, **Consultar contrato e prévia apenas focado**, alternância de modo, região Faturas e Ver composição. Shift+Tab testado; indicadores dourados de foco visível nos controles/regiões. Controles nativos de data/mês incluem segmentos e botão interno de calendário.
- Paginação tem botões nomeados nativos e estado disabled coerente; interação habilitada e páginas adicionais NOT EVALUATED. Tabela de pagamentos preenchida e valores variados/não nulos adicionais NOT EVALUATED. Contraste quantitativo continua NOT EVALUATED.
- Viewport restaurado, painel manual fechado e seleção de Loja removida ao terminar. Nenhuma submissão comercial.

### E — inspeção da emissão manual, sem prévia

- Botão Emitir fatura manual abre painel e passa a Fechar emissão manual com aria-expanded coerente; fechamento por clique/Enter executado. Campos de competência, vencimento opcional e observação rotulados e alcançáveis; aviso informa cálculo contratual no banco e ausência de preço arbitrário digitado no navegador.
- **Consultar contrato e prévia NÃO acionado.** Apenas recebeu foco na sequência de Tab. Não houve prévia contratual apresentada nem botão Confirmar e emitir fatura nesta inspeção. Nenhuma emissão, recebimento, reversão, alteração de assinatura/encargo/acordo/suspensão/reativação/notificação.
- Evidências automatizadas anteriores reaproveitadas: prévia contratual, idempotência, competência já faturada, invalidação ao mudar campos/Loja e manutenção da chave após falha de comunicação. São testes simulados existentes aprovados no CI, não nova homologação de operações reais ou de autorização no servidor.

### Paridade com view-master-cobranca

| Diferença pertinente | Classificação |
|---|---|
| Cards MRR/Pago/Aberto/Inadimplência e totais consolidados da V35 não aparecem nesta consulta | Lacuna de paridade/apresentação, fora do aceite delimitado; não substituídos por soma de uma página |
| Coluna Cliente substituída por seleção explícita de Loja; busca atual por número, não busca global por nome de cliente | Diferença de escopo/navegação em relação à V35 |
| Valor base/Encargos não constam como colunas principais, mas Base/Multa/Juros/Descontos/Outros são consultáveis em Ver composição | Funcionalidade existente em detalhamento separado; diferença de apresentação |
| Mais status (Em aberto/Cancelado), paginação e modo Pagamentos SaaS | Funcionalidades existentes adicionais ao filtro demonstrativo |
| Automação mensal/régua/política/encargos-acordos e ações por documento da V35 não são operados aqui | Lacunas de paridade do fluxo completo; aplicação/configuração comercial fora do recorte. Consulta de jobs existe em MasterOperations, sem equivaler à configuração da automação e sem nova homologação nesta rodada |
| Ações Registrar pagamento/Enviar cobrança e acordos demonstrativos não acionadas/apresentadas nesta consulta | Fora do recorte; não inferir ausência backend nem declarar operação homologada |
| Status void exibido como código técnico e competência AAAA-MM | Diferença de apresentação/localização, sem erro financeiro demonstrado |

Nenhum valor financeiro demonstrativo do HTML foi usado como dado real. Nenhuma reconstrução ou correção funcional nesta rodada.

### Consolidação e próxima prioridade

- **Encerrar somente a microentrega disponível de consultas/filtros/estados observáveis/acessibilidade/responsividade. Não promover view-master-cobranca integral a HOMOLOGADO_DEV.** Erros/recuperação, integridade independente, pagamentos preenchidos, paginação real, operações críticas e lacunas V35 continuam pendentes/NOT EVALUATED.
- Atualizar os quatro documentos em novo PR exclusivamente documental, revisar diff, CI sem skip e integrar após aprovação; estado final de PR/CI/merge será registrado no PR e relatório. Sem defeito reproduzido para encaminhar correção ao Gemini.
- **Próxima recomendação M06.02: Configurações da Plataforma (`view-master-config`) — leitura, estados, teclado e responsividade, sem salvar parâmetros**, conforme matriz (implementada/testada, QA real do recorte ainda não registrado). Primeiro verificar a implementação existente. Permanecem fora do recorte alterações de segurança, integrações e configurações de plataforma.
- Histórico anterior preservado; Planos, drawer, chamados e Dashboard não reabertos. Sem alterações funcionais, Supabase/banco/migrations/Auth/MFA/AAL2/RLS/RBAC, deploy ou PROD; nenhum documento financeiro criado/modificado.

---

## M06.02 — Planos SaaS: filtros, estados disponíveis e acessibilidade homologados no recorte (19/11/2026)

**Microentrega delimitada de consulta/filtros/acessibilidade CONCLUIDA no aceite funcional. Não equivale à homologação integral de Planos SaaS.** Nenhum defeito funcional reproduzido nas condições disponíveis; lacunas de paridade e NOT EVALUATED discriminados abaixo. M06.02 geral EM_EXECUCAO. Drawer, chamados Master e Dashboard Mobile não reabertos.

### Revisão, ambiente e evidências reaproveitadas

- GitHub main **`b3fe1b336c4d574fb371af67ab84a66db766445b`**, funcional `025d165da1e587c40170ec967b9ce16ccb7e6b4e`. Árvore src **`f10358a3abda5b85f220713a69a24c55f871621b`** idêntica na revisão funcional e na main documental; checkout isolado 025d165 limpo. Workspace antigo preservado.
- Workers Builds pós-merge **SUCCESS**, build **`4b96aad6-71a0-4b7c-9ebb-121983337d2a`**, versão DEV **`b86d492c-e8ec-4ab0-82a2-f3d75ded4fbc`**. Última versão anteriormente homologada `9c42e309-1d47-4e72-b017-f7eb5b60e24d` mantida como referência operacional de rollback (mesmo código funcional). Nenhum deploy manual/PROD.
- Assets observados nesta sessão: **index-C-35ixZm.js / index-BJXaZgFj.css**. O build Windows local 025d165 **PASS/exit0** emitiu index-DVZ5_eI3.js / index-BE1i90wT.css. **Nomes diferem; correspondência binária e causa da diferença de build NOT EVALUATED.** Não afirmar igualdade de assets ou SHA-256 remoto. A origem da versão e identidade do código-fonte estão apoiadas no check Workers/GitHub e na árvore src, separadamente da limitação de reprodutibilidade dos assets. Sem novo deploy para tentar igualar nomes.
- [CI pós-merge 44622872535](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44622872535) **3/3 PASS**, 598 testes/85 arquivos. Logs consultados confirmam **MasterCommercialCatalog 6/6**, **MasterPlanLifecycle 5/5**, **MasterPromotions 6/6**. Reutilizados sem repetir suíte; testes de publicação são fixtures automatizadas, não operações comerciais desta homologação.
- Consultados AGENTS.md, cursor/quadro/matriz, referência HTML versionada seção view-master-planos, três componentes, master-commercial.ts e testes correspondentes. Sessão Master existente no navegador integrado acessou a área protegida; nenhuma mudança em MFA/AAL2/Auth. Sem ler credenciais/tokens ou inferir autorização servidor a partir de menus.

### A–E — classificação consolidada

| Cenário | Resultado | Alcance real |
|---|---|---|
| A — histórico/consistência | **PASS na apresentação disponível; NOT EVALUATED na reconciliação independente e histórico múltiplo** | Uma versão vigente, nenhuma série de ofertas; sete colunas legíveis e coerentes na UI. Conector SQL sem contexto equivalente de autenticação retornou zero linhas na view, portanto não usado para validar/contradizer o registro da sessão Master. |
| B — filtros | **PASS nas condições disponíveis** | Seis status, datas isoladas/inclusivas, combinações, intervalo vazio/invertido, contagem, limpeza e atualização. Correspondência positiva de draft/future/historical/inactive NOT EVALUATED por falta de registros reais. |
| C — estados | **PASS nos estados observados e no controle local de limite; NOT EVALUATED nos demais** | Loading inicial e atualização, ausência de resultados filtrados, retorno normal e ofertas vazias observados. Catálogo integralmente vazio, erro real, dados obsoletos durante falha e recuperação após falha real não disponíveis. |
| D — acessibilidade/responsividade | **PASS no recorte executado** | Cinco larguras, contenção/rolagem da tabela, labels, datas por teclado, Tab/Shift+Tab, status por teclado, Limpar Enter/Space, contagem e foco visível. Sem submissão dos formulários. |
| E — proteção comercial | **PASS na UI disponível e evidência automatizada; operações persistentes/autorizações servidor NOT EVALUATED nesta rodada** | Criação separada de publicação, confirmação PUBLICAR rotulada, controles de publicação disabled sem rascunho; avisos contratuais e formulários separados. Nenhum comando comercial acionado. |

### A — catálogo efetivamente disponível

- **1 versão de plano / 0 séries de ofertas**, conforme contagem e tabelas da sessão Master.
- Nome comercial **DEV HTTP - no billing**; código **dev_http_financial_20261007**; versão **1**; preço **R$ 0,00**; periodicidade **monthly**; início **2026-10-07**, término aberto (“em diante”); status administrativo **current**. Valores reais exibidos na UI, não extraídos do HTML demonstrativo.
- Símbolo de BRL exibido; o código ISO de moeda não aparece em coluna própria. A renderização BRL segue o caminho do componente; **currency bruta independente NOT EVALUATED** nesta rodada.
- Sem promoções ou rascunhos elegíveis; correspondência positiva de ofertas, comparação entre várias versões/publicações/contratos e demais status **NOT EVALUATED**. Nenhum registro criado para ampliar cobertura.
- Consulta autorizada somente SELECT às views via conector retornou plans=[]/promotion_series_count=0 sob contexto diferente do navegador. Não se injetaram claims nem se alterou Auth/RLS para contornar a diferença. **Reconciliação UI×consulta independente NOT EVALUATED**, sem classificar a diferença de contextos como defeito comercial.

### B — filtros executados individualmente

| Filtro de status (datas limpas) | Contagem real | Resultado |
|---|---|---|
| Todos | 1/1 | PASS |
| Rascunho | 0/1 + mensagem sem resultados | PASS vazio; positiva NOT EVALUATED |
| Vigente p/ novas contratações | 1/1 | PASS |
| Publicada futura | 0/1 + mensagem sem resultados | PASS vazio; positiva NOT EVALUATED |
| Histórica / contratos existentes | 0/1 + mensagem sem resultados | PASS vazio; positiva NOT EVALUATED |
| Plano desativado | 0/1 + mensagem sem resultados | PASS vazio; positiva NOT EVALUATED |

Ambas as datas filtram **valid_from**, não valid_to. O único plano tem término aberto, mas é excluído por “Vigência até” anterior ao seu início.

| A partir de | Até | Status | Contagem | Resultado |
|---|---|---|---|---|
| 2026-10-07 | vazio | Todos | 1/1 | PASS — limite inicial inclusivo |
| 2026-10-08 | vazio | Todos | 0/1 | PASS |
| vazio | 2026-10-07 | Todos | 1/1 | PASS — limite superior inclusivo |
| vazio | 2026-10-06 | Todos | 0/1 | PASS |
| 2026-10-07 | 2026-10-07 | Todos | 1/1 | PASS — mesmo dia |
| 2026-11-01 | 2026-11-30 | Todos | 0/1 | PASS — intervalo sem resultados |
| 2026-10-08 | 2026-10-06 | Todos | 0/1 | PASS — intervalo invertido resulta vazio; não há aviso específico de intervalo inválido |
| 2026-10-01 | 2026-10-31 | Vigente | 1/1 | PASS — combinação |

- Datas confirmadas por **teclado real** nos controles nativos, incluindo ajuste de segmento e Tab. A preparação inicial por fill não atualizou de modo confiável o estado React neste canal de automação; essas leituras foram descartadas e não classificadas como defeito. Resultados da tabela vêm de edição confirmada por teclado, com valor final e contagem conferidos.
- **Limpar filtros por Enter e Space PASS:** duas datas vazias, status Todos, contagem restaurada a1/1. Seleção de status por Home/ArrowDown/Enter alcançou Rascunho e0/1; Space em Limpar voltou a1/1.
- **Atualizar catálogo PASS:** observada mensagem Consultando planos e ofertas com tabela/contagem anterior removidas durante uma atualização; retorno normal. No caso com 2026-10-01→2026-10-31/current, valores e resultado1/1 preservados após atualizar.
- Ausência de ofertas permaneceu inalterada em todos os filtros. **Preservação positiva de ofertas preenchidas NOT EVALUATED**, pois existem0 séries.

### C — estados e limite de completude

- **PASS real:** entrada inicial exibiu Consultando rascunhos/ofertas/planos; posteriormente formulários/catálogo. Atualização exibiu loading e remoção da tabela antiga, seguida de retorno. Filtros vazios exibiram Exibindo0de1 e mensagem específica, sem confundir com catálogo sem registros. Ofertas vazias têm mensagem própria.
- **NOT EVALUATED real:** catálogo de planos integralmente vazio; falha de rede/negação do servidor durante sessão carregada; erro com ausência de dados obsoletos; recuperação após falha. Nenhuma infraestrutura alterada para provocar esses estados.
- Evidência automatizada anterior: teste de negação do catálogo confirma ausência de dados/alerta sob fixture de servidor negando, separado de browser. Código limpa rows ao iniciar consulta e valida arrays/duplicidades/preços; inspeção estática não equivale a teste real de falha.
- **PASS controlado local, sem banco/rede:** executada a função real loadPlatformCommercialCatalog com client substituto em memória, retornando array de comprimento201 para planos e, separadamente, para ofertas. Ambos rejeitaram com “Master commercial catalog incomplete”; **0 chamadas ao banco, nenhum registro persistido**, sem executar suíte. Isso comprova a rejeição no consumidor acima200; não comprova runtime de truncamento de servidor nem catálogo real com200/201 registros.

### D — responsividade, teclado e formulários

Medições de largura efetivamente aplicada, documento clientWidth/scrollWidth e contêiner de versões:

| innerWidth | Documento client/scroll | Tabela client/scroll | overflow-x | Resultado |
|---:|---|---|---|---|
| 320 | 305/305 | 251/786 | auto | PASS |
| 390 | 375/375 | 322/786 | auto | PASS |
| 768 | 753/753 | 659/786 | auto | PASS |
| 1024 | 1009/1009 | 639/786 | auto | PASS |
| 1440 | 1425/1425 | 1043/1043 | auto | PASS |

- Nenhum controle dos formulários/filtros ultrapassou horizontalmente o documento; conferência visual em mobile/desktop sem sobreposição entre campos/botões. Em320 formulários/filtros empilham; em1440 filtros cabem na mesma linha. Conteúdo e contagem alcançáveis por rolagem.
- Tabela é região nomeada, tabIndex0. **ArrowRight real em390 moveu scrollLeft para73,6px** dentro da tabela, sem criar overflow do documento. Colunas extensas permanecem alcançáveis; não exigido comprimir código/data para caber.
- Labels associados em todos os inputs/selects/textareas dos planos/promoções e filtros, incluindo checkbox com label envolvente. Formulários têm nomes acessíveis e legendas. Código interno→nome→preço→periodicidade→teste/tolerância→competência→JSON percorridos por Tab; em seguida formulário de promoção, datas nativas/segmentos, elegibilidade, limite, checkbox, botão de criação apenas focado, Atualizar catálogo e filtros. Publicações disabled foram puladas. Nenhuma submissão.
- Campo nativo de mês/data usa segmentos e botão de calendário; tabulação nativa continuou corretamente quando o foco estava em controle interno do widget. **Shift+Tab de Limpar filtros alcançou Status do plano**, com :focus-visible=true e outline dourado sólido1.6px. Datas editadas por teclado, status selecionado por teclado, Enter/Space somente em Limpar filtros.
- Foco visível conferido nos controles e capturas reais; contraste quantitativo permanece **NOT EVALUATED**, sem certificação WCAG integral. Viewport restaurado, filtros limpos e nenhuma operação comercial persistente.

### E — proteção comercial e limites de autorização

- UI separa Criar rascunho SaaS/Publicar plano SaaS e Criar rascunho de promoção/Publicar promoção Master. Textos distinguem criar rascunho, publicar e migrar/aplicar benefícios.
- **Sem rascunhos:** fieldsets/selects/confirmações de publicação e botões Publicar versão comercial/Publicar oferta disabled. Labels exigem PUBLICAR. Elegibilidade com rascunho real e habilitação após digitar confirmação **NOT EVALUATED real**, pois não há rascunho; testes previamente aprovados5/5e6/6 cobrem seleção/confirmação em fixtures.
- Avisos preservam clientes na versão contratada, sucessora não edita desconto histórico e publicação de promoção não aplica resgate automaticamente. Preço-base do plano em formulário próprio, benefício/valor/duração de promoção em formulário separado.
- Não acionados Criar, Publicar, desativar/reativar, excluir, migrar, aplicar benefício/resgate nem Verificar envio. Inspeção de frontend/testes **não é prova nova de autorização no servidor**.

### Paridade V35 — diferenças registradas, sem reconstrução

| Diferença observada | Classificação |
|---|---|
| Dois filtros de início da vigência, seis status, limpeza, contagem e histórico | PASS no recorte de leitura; sem usar dados demonstrativos |
| V35 começa com hero/cards de planos e abre criação por +Novo plano; implementação mostra formulários completos antes do catálogo | Diferença visual/ergonômica e lacuna de apresentação dos cards; não defeito de filtros |
| V35 histórico tem Plano/Versão/Vigência/Preço/Usuários/Status/Ações; atual tem Plano/Código/Versão/Preço/Periodicidade/Vigência/Situação | Lacuna de paridade: Usuários/limites e ações por linha não apresentados; código/periodicidade são informações adicionais. Não inferir ausência de funcionalidades no backend |
| V35 usa cards de promoções; atual prevê tabela e formulários separados | Diferença de apresentação; positiva com ofertas reais NOT EVALUATED |
| monthly/current apresentados como códigos técnicos, sem tradução na linha | Diferença de apresentação/localização, sem erro no valor observado |
| Editar rascunhos, criar sucessora de plano, desativar/reativar/excluir/migrar/resgatar | Fora do recorte; não executados nem homologados integralmente. Sucessora de promoção existe no formulário e em teste automatizado, sem operação real |

### Decisão e próxima ação

- **Encerrar apenas consulta/filtros, estados disponíveis, acessibilidade e responsividade avaliados. Não promover o status integral de view-master-planos a HOMOLOGADO_DEV.** Ausências de dados/cenários, reconciliação independente, assets e lacunas V35 permanecem explícitas.
- Atualizar quatro documentos em **novo PR exclusivamente documental**, revisar diff, CI sem skip e integrar após aprovação. Estado final de PR/CI/merge fica rastreado no PR e relatório; nenhum código funcional corrigido e nenhuma razão demonstrada para retornar ao Gemini nesta rodada.
- **Próxima atividade recomendada M06.02: Cobrança SaaS (`view-master-cobranca`) — filtros/estados/acessibilidade/responsividade somente leitura**, conforme QA visual DEV ainda pendente na matriz. Primeiro verificar implementação atual; sem emitir faturas, cobrar, criar ciclos, alterar assinaturas ou reabrir recortes encerrados. Lacunas de paridade de Planos seguem registradas para priorização M06.01/V35, sem confundir com defeitos comprovados desta homologação.

---

## M06.02 — F1 residual aprovada: drawer transversal CONCLUIDO no aceite funcional (19/11/2026)

**F1 PASS — 18/18 aberturas reais; regressões obrigatórias PASS; smoke F2/F3 PASS.** Recorte do drawer apto ao encerramento documental após revisão/CI/integração do PR #63. M06.02 geral permanece EM_EXECUCAO. Histórico original F1/F2/F3 e limitações anteriores preservados integralmente abaixo. Chamados Master e Dashboard Mobile não reabertos.

### Revisão, CI e publicação efetivamente avaliados

- Main **`025d165da1e587c40170ec967b9ce16ccb7e6b4e`**, base `3be7995c3f76579630b4597b5fca8c47a787ae8e`; diff GitHub limitado a AppShell.tsx, ResponsiveLayout.test.tsx e styles.css. Checkout isolado recuperado pelo procedimento validado, hashes de objetos conferidos, HEAD exato/árvore `b6ef3ad3b53b1cc0b6300fc72110ae768c3ab10a`, limpo. Workspace antigo preservado.
- [CI 44619837345](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44619837345) **3/3 PASS**. Logs frontend confirmam TypeScript, **598/598 testes em 85 arquivos**, **ResponsiveLayout 7/7**, Vite e Cloudflare dry-run aprovados. Suíte automatizada não repetida localmente. CI/Vitest não substituem os resultados de navegador abaixo.
- Workers Builds automático **SUCCESS** para 025d165: build **`89075dd8-f62f-43f8-829f-997ba9425a6e`**, versão DEV avaliada **`9c42e309-1d47-4e72-b017-f7eb5b60e24d`**. Inicialmente pendente e servindo assets antigos: nenhuma abertura foi contabilizada antes de concluir a publicação e recarregar os assets novos. Sem deploy manual.
- Assets efetivamente servidos: **`index-DVZ5_eI3.js` e `index-BE1i90wT.css`**, coincidentes com build Vite local exato **PASS/exit 0**, usando configuração pública DEV existente, sem bundle CI placeholder. SHA-256 local JS `cba2aa26de7f507eeaf2f34a3c502fb0b6b0941339b32738b3ab911af97fe8ad`; CSS `beef658ae1b27617f9ca0856586f6922c2969fc41fbed484afdd2a71e0bc1bb2`. SHA-256 remoto nesta rodada **NOT EVALUATED**.
- **Rollback operacional:** versão DEV anterior `8f7afd32-598d-4d79-a30b-f0dfad02d38b`, build `8684bef8-b2ea-46b3-968a-3702a6338e08`, commit 3be7995. Referência pelo histórico de versões do próprio Worker DEV; não executado. Não confundir o segmento /production do painel Cloudflare desse serviço com autorização para publicar no ambiente PROD do sistema.

### F1 — registro individual das 18 aberturas

Navegador integrado, sessão Master existente, **innerWidth=390 / innerHeight=844**. Rota mantida em Master SaaS para detectar navegação acidental para Início. Ponteiro real por click e teclas reais Enter/Space (pressionamento e liberação completos pelo navegador), sem dispatchEvent nem focus() artificial em Início. Cada abertura teve leitura inicial de document.activeElement antes de qualquer Tab, segunda leitura estabilizada em chamada posterior e fechamento por Escape antes da próxima. Botão Início realmente focado e dentro da sidebar em ambas as leituras; sidebar visível/transform final sem deslocamento, backdrop:block e aria-controls=sidebar nos dois acionadores.

| ID | Acionador | Entrada | Repetição | Foco inicial → estabilizado | aria-expanded superior / inferior | Rota preservada | Foco após Escape | Resultado |
|---:|---|---|---:|---|---|---|---|---|
| 1 | Superior | Clique | 1 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 2 | Superior | Clique | 2 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 3 | Superior | Clique | 3 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 4 | Superior | Enter | 1 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 5 | Superior | Enter | 2 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 6 | Superior | Enter | 3 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 7 | Superior | Space | 1 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 8 | Superior | Space | 2 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 9 | Superior | Space | 3 | Início → Início | true / true | Master SaaS | #mobileMenu | **PASS** |
| 10 | Inferior | Clique | 1 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 11 | Inferior | Clique | 2 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 12 | Inferior | Clique | 3 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 13 | Inferior | Enter | 1 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 14 | Inferior | Enter | 2 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 15 | Inferior | Enter | 3 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 16 | Inferior | Space | 1 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 17 | Inferior | Space | 2 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |
| 18 | Inferior | Space | 3 | Início → Início | true / true | Master SaaS | Menu inferior | **PASS** |

**Total 18/18 PASS.** Todas permaneceram abertas após a entrada completa, sem Tab extra, fechamento duplicado ou navegação involuntária observados. As 18 restaurações após Escape alcançaram o acionador de origem, com open=false, backdrop:none e aria-expanded=false. Não se inferiu aprovação a partir de useLayoutEffect/rAF/transitionend: o aceite se baseia no foco e estado reais lidos no navegador. Não há registro de conteúdo privado/identidades na evidência.

### Regressões diretamente relacionadas — navegador real

| Critério | Resultado | Evidência |
|---|---|---|
| Enter/Space completos e ausência de efeito duplicado | **PASS** | Três repetições por tecla/acionador na tabela; ao finalizar a tecla, drawer aberto e foco em Início, enquanto rota/título continuam Master SaaS. Nenhuma ativação involuntária de Início. Não instrumentados contadores internos de eventos. |
| Escape/restauração por acionador | **PASS** | Executado nas 18 aberturas; superior retorna a #mobileMenu, inferior a Menu. |
| Backdrop | **PASS** | Aberto pelo Menu inferior/Space; clique real em área externa da sidebar (340,400) fecha, preserva Master SaaS e retorna ao Menu inferior. |
| Seleção de rota | **PASS** | Aberto pelo superior/Enter; selecionar Integrantes fecha, muda título e aria-current para Integrantes e retorna a #mobileMenu. |
| Fechamento rápido e cancelamento | **PASS** | Abrir superior por Enter e enviar Escape imediatamente na mesma sequência, sem observação intermediária; fecha com foco no superior. Leitura posterior estabilizada mantém esse foco e sidebar oculta. |
| Ausência de foco tardio | **PASS nos cenários executados** | Após fechamento rápido, nenhuma transferência para sidebar fechada; nas 18 sequências, foco restaurado se mantém até a próxima entrada. |
| Usuário avança para Integrantes | **PASS** | Abrir superior/Enter, Tab de Início para Integrantes; leitura imediata e leitura posterior estabilizada continuam em Integrantes, dentro do drawer, sem retorno imposto a Início; Master SaaS segue rota ativa. |

### Smoke proporcional F2 e F3 — sem repetir matriz

- **F2 PASS:** abrir em 390×844, colocar foco real em Master SaaS por Shift+Tab e ampliar para **1024×844 sem recarregar**. Drawer open=false, backdrop:none, ambos aria-expanded=false, sidebar desktop visível/transform:none. Tab desde Master SaaS alcança Sair fora da sidebar; Escape não reativa modalidade. Voltar a **390×844 sem recarregar** mantém drawer fechado, backdrop:none e sidebar oculta. Nenhum acionamento de Sair.
- **F3 PASS:** Master SaaS ativo sem foco tem outline rgba(197,168,128,0.18) solid 0.8px, offset2.4px, shadow:none. Com foco real por Shift+Tab e **:focus-visible=true**, outline rgb(197,168,128) solid 1.6px, offset1.6px e shadow rgba(197,168,128,0.28) 0px 0px 0px 1px. Aro dourado visivelmente distinto na renderização real; aria-current=page preservado.
- Reutilizadas evidências anteriores de R1/R2, seis/larguras pertinentes, 15 rotas da Loja, 16 itens Master e cinco atalhos. Não repetida matriz completa. Viewport restaurado e drawer fechado ao terminar.

### Consolidação e próxima microentrega

- **Aceite funcional do drawer CONCLUIDO**, sem defeito residual demonstrado nesta revisão; F1 original permanece no histórico como falha de revisões anteriores, agora sanada no reteste de 18 entradas. F2/F3/R1/R2 previamente aprovados preservados, F2/F3 com smoke adicional.
- PR **[#63](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/63)** reaproveitado com os mesmos quatro documentos, histórico integral preservado e commit sem skip ci. Revisão do diff exclusivamente documental, CI exigido, integração e conferência pós-merge/Workers Builds serão registrados no próprio PR e no relatório final, sem alterar código funcional ou publicar manualmente por consequência desta homologação.
- **Próxima microentrega recomendada da M06.02:** homologação DEV dos filtros/estados e acessibilidade de **Planos SaaS (`view-master-planos`)**, já implementados em MasterCommercialCatalog/MasterPlanLifecycle/MasterPromotions, com QA real ainda pendente na matriz oficial. Priorizar vigência inicial/status, contagem/limpeza e teclado/estados, confrontando a seção V35 original; iniciar pela leitura/interação existente, sem criar planos/promoções ou reconstruir componentes. Recomendação derivada da pendência da matriz e do escopo M06.02 do quadro, não nova implementação autorizada.
- Limites preservados: **contraste quantitativo, pixels exatos 761/961** (rodada anterior aplicou762/962), SHA-256 remoto e demais NOT EVALUATED históricos, incluindo paginação real de chamados insuficiente e negativa com nota interna no mesmo cliente. Encerrar o recorte não transforma essas ausências de evidência em PASS nem conclui M06.02/21 telas.
- Nenhuma alteração de código funcional, Supabase/banco/migrations/Auth/MFA/AAL2/RLS/RBAC/RPC, dados da aplicação, operação financeira ou PROD. Sem registros artificiais e sem reabertura de chamados Master/Dashboard Mobile.

---

## M06.02 — reteste final do drawer: F2/F3 aprovados; F1 permanece (19/11/2026)

**Drawer NÃO HOMOLOGADO; AGUARDA_CORRECAO_GEMINI exclusivamente de F1. M06.02 geral EM_EXECUCAO.** Chamados Master continuam CONCLUIDOS. Este registro complementa, sem apagar, as três falhas originais de 18/11 abaixo.

### Revisão, publicação e validação automatizada

- GitHub main confirmado em **`3be7995c3f76579630b4597b5fca8c47a787ae8e`**, base `a298d5f973cdecee75be2529a5a47d3803143dc0`. Diff real limitado a AppShell.tsx, ResponsiveLayout.test.tsx e styles.css. Checkout isolado exato, árvore `7c022b39de5d9488860e085fcb91ed4d015ef795`, limpo; workspace antigo preservado. Recuperação por objetos GitHub com hashes validados, sem repetir investigação de rede.
- [CI 44607492433](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44607492433): **3/3 PASS** (static/onboarding/frontend). Logs frontend confirmam **597/597 testes, 85 arquivos, ResponsiveLayout 6/6**, build e dry-run concluídos; typecheck integrante do check aprovado. Evidência automatizada separada da homologação real; não repetida a suíte.
- Workers Builds publicou automaticamente o mesmo commit: **SUCCESS**, build `8684bef8-b2ea-46b3-968a-3702a6338e08`, **versão DEV `8f7afd32-598d-4d79-a30b-f0dfad02d38b`** ([check de publicação](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/runs/135856818746)). Não houve deploy manual.
- DEV servido em corsys-tronco-digital-dev.corsys1.workers.dev: **`index-CBmSvN6r.js` e `index-DsHs0NTJ.css`**, nomes coincidentes com build Vite local da revisão exata e configuração pública DEV existente. Build local **PASS/exit 0**, sem bundle CI placeholder. SHA-256 local JS `cf75e6c835183e91d479454d67109fb743fc83d4209785aafd34979e32b13e69`; CSS `81299bc390e1ad6d55e0e7d3f52ddea65c93a125f8a7d71d5790e527aa54a58c`. SHA-256 remoto nesta rodada **NOT EVALUATED**; coincidência de nomes não é comparação binária remota.
- **Rollback operacional de referência:** versão DEV anterior `105ad0e7-86e6-4886-b382-42fb3c7b2b56`, build `46063ac3-d61f-45b3-aba0-a2900272ea38`, commit a298d5f. Reversão, se necessária, pelo histórico de versões do próprio Worker DEV; não executada. PROD intacto.
- Navegador integrado com sessão Master existente; Edge com Administração da Loja existente. Apenas navegação e atualização de leitura. Sem login, alteração de AAL2/Auth ou reabertura da homologação de chamados; visibilidade do menu não comprova autorização no servidor.

### Resultados reais — F2, F1, F3, R1 e R2

| Critério | Resultado | Evidência observada no navegador |
|---|---|---|
| **F2 — 390 → 1024 → 390 sem recarga** | **PASS** | Sidebar perde open, backdrop display:none, aria-expanded=false em ambos os acionadores. Shift+Tab desde Início alcança Pular para conteúdo; Tab desde último Master SaaS alcança Sair. Escape não reativa modalidade. Sidebar desktop navega normalmente; clique em Atualizar plataforma funciona e elementFromPoint no centro retorna o próprio controle, sem backdrop. Ao retornar a 390, drawer permanece fechado. |
| F2 — limite 960/961 | **PASS no cruzamento observado; 961 exato NOT EVALUATED** | Em 960, drawer aberto; solicitado 961, aplicado **962**. Em 962, open=false, backdrop:none, aria-expanded=false e foco em item visível da sidebar desktop. |
| F2 — limite 760/761 pelo Menu inferior | **PASS no cruzamento observado; 761 exato NOT EVALUATED** | Aberto em 760 pelo inferior; solicitado 761, aplicado **762**. Barra inferior desaparece; Escape fecha e retorna a **#mobileMenu visível**, sem deixar foco no Menu oculto. |
| **F1 — foco inicial em 390** | **FAIL** | Abertura por clique superior e inferior deixa activeElement=#mobileMenu ou Menu, fora da sidebar, com open=true/backdrop:block/aria-expanded=true. Leituras posteriores estabilizadas mantiveram o foco externo. Clique nativo por coordenada no superior reproduziu. Enter no inferior também permaneceu em Menu após estabilização. Houve aberturas por Enter/Space com foco em Início; esses sucessos não eliminam as falhas reproduzidas. |
| **F3 — rota ativa Master SaaS** | **PASS** | Foco real por Shift+Tab, :focus-visible=true, contorno dourado sólido e sombra distintos do estado sem foco; aria-current=page e identidade visual preservados. Conferência visual no drawer efetivamente renderizado. |
| F3 — rota ativa da Loja e item não ativo | **PASS** | Início ativo da Loja com foco real por Tab apresenta o mesmo indicador dourado distinto. Integrantes não ativo mantém foco visível e não recebe aria-current. Estilos/renderização comparados abaixo. |
| **R1 — desktop sidebar focada → mobile fechado** | **PASS no cenário observado** | Em 1024, Master SaaS recebeu foco por Shift+Tab desde o cabeçalho; ao reduzir a 390, activeElement=BODY, sem foco retido na sidebar oculta. Próximo Tab alcança Pular para conteúdo visível; navegação continua. Não classificado como defeito apenas por cair no documento. |
| **R2 — foco inferior em 390 → 768 fechado** | **PASS no cenário observado** | Integrantes inferior recebeu foco por Tab; ao ampliar a 768, barra oculta e activeElement=BODY. Próximo Tab alcança Pular para conteúdo visível, sem foco em botão invisível ou bloqueio. |

**F1 — reprodução mínima e evidência de foco:** 390×844, drawer fechado → clicar no botão superior → aguardar estabilização → ler document.activeElement **antes de Tab**: BUTTON#mobileMenu, sidebar.contains=false. Repetir Menu inferior: BUTTON com texto Menu, sidebar.contains=false. Ambos acionadores têm aria-controls=sidebar e aria-expanded=true, sidebar visível e backdrop:block. A reprodução superior foi confirmada por clique real na tela em (30,31), além do locator. Não foi usado focus() artificial em Início. Primeiro Tab recupera o foco para Início, mas não satisfaz o critério de foco inicial.

Combinações executadas em 390: clique superior **FAIL**, clique inferior **FAIL**, Enter inferior **FAIL estabilizado**; Enter superior, Space superior e Space inferior tiveram sucesso observado em Início. Outros contextos/reaberturas (inclusive Loja) voltaram a reter foco no acionador; **não há garantia determinística para F1**. Os dois acionadores abrem/fecham e atualizam ARIA, sem inferir PASS integral do foco a partir disso.

**Menor correção recomendada ao Gemini:** limitar o trabalho à sincronização do foco inicial em AppShell.tsx. A chamada de foco e o requestAnimationFrame já existem e **não garantiram o resultado real**. Causa provável, ainda inferida: transferência de foco não concluída/retida no momento efetivo de abertura. Confirmar visibilidade e activeElement no ciclo de abertura; assegurar foco em Início e cancelar qualquer tentativa pendente no fechamento/navegação/redimensionamento. Não prescrever um temporizador arbitrário como prova de correção, não alterar F2/F3 aprovados, rotas, segurança ou dados. Acrescentar verificação proporcional e repetir as seis entradas no navegador antes de encerrar; Vitest isolado não cobre esta falha real.

### Teclado, fechamento e ausência de foco tardio

- Após recuperar pelo primeiro Tab, percorridos os **16 itens Master** em ambas as direções; circularidade Início↔Master SaaS correta, sem fuga para skip-link/cabeçalho/conteúdo/barra inferior.
- Escape restaura o acionador de origem. Backdrop por clique real fecha e devolve ao superior. Selecionar Integrantes após abertura inferior fecha, muda título/aria-current e retorna ao Menu inferior.
- Três ciclos consecutivos Enter/Escape fecharam com foco no superior, open=false e backdrop:none. Leitura posterior manteve foco fora da sidebar; **não observada transferência tardia** para painel fechado.
- Fechado em mobile: Shift+Tab do superior alcança Pular para conteúdo; Tab passa pelo superior e Sair, sem entrar na sidebar oculta. Não ativado Sair.
- Navegação proporcional: Início no mobile 320 e Master SaaS no desktop 1440; Integrantes no desktop da Loja 1024. Sem clique interceptado após fechamento. Reutilizada a evidência anterior das **15 rotas da Loja/16 itens Master**, sem repetir a matriz integral.

### Estilos computados e apresentação visual real — F3

Valores efetivamente lidos no navegador (não normalizados para os valores nominais do CSS):

| Item/estado | :focus-visible | outline | outline-offset | box-shadow |
|---|---|---|---|---|
| Master SaaS ativo, sem foco estabilizado | false | rgba(197,168,128,0.18) solid 0.8px | 2.4px | none |
| Master SaaS ativo, foco por teclado | true | rgb(197,168,128) solid 1.6px | 1.6px | rgba(197,168,128,0.28) 0px 0px 0px 1px |
| Início ativo da Loja, sem foco | false | rgba(197,168,128,0.18) solid 0.8px | 2.4px | none |
| Início ativo da Loja, foco por Tab | true | rgb(197,168,128) solid 1.6px | 1.6px | rgba(197,168,128,0.28) 0px 0px 0px 1px |
| Integrantes da Loja, não ativo com foco | true | rgb(197,168,128) solid 1.6px | 2.4px | none |

Ativos preservam fundo rgba(197,168,128,0.12), cor rgb(226,232,240) e aria-current=page. Não ativo tem fundo transparente, cor rgb(148,163,184) e aria-current ausente. Inspeção visual confirmou aro dourado claramente distinto na rota ativa focada. Valores transitórios durante animação não usados como estado sem foco definitivo. **Contraste quantitativo NOT EVALUATED.**

### Responsividade e regressão proporcional

| Largura solicitada | innerWidth aplicado | Documento clientWidth/scrollWidth observado | Resultado |
|---:|---:|---|---|
| 320 | 320 | 320/320 | Sem overflow; cinco atalhos visíveis |
| 390 | 390 | 390/390; 375/375 quando há scrollbar vertical | Sem overflow; cinco atalhos por perfil |
| 760 | 760 | 760/760 | Barra inferior disponível; drawer abre |
| 761 | **762** | 762/762 | Barra inferior oculta; 761 exato NOT EVALUATED |
| 768 | 768 | 768/768 | Drawer fechado; barra inferior oculta |
| 960 | 960 | 960/960 | Drawer disponível |
| 961 | **962** | 946/946 | Sidebar desktop; 961 exato NOT EVALUATED |
| 1024 | 1024 | 1009/1009 | Sidebar desktop, sem backdrop/trap |
| 1440 | 1440 | 1425/1425 | Sidebar desktop e navegação utilizáveis |

Em **390×320**, sidebar clientHeight=320, scrollHeight=884, scrollTop=564 no último item; Master SaaS visível entre y=222 e 266, body scrollY=0. Todos os 16 itens alcançados por Tab com rolagem interna. Sidebar sem overflow horizontal do documento. Cinco atalhos inferiores confirmados em Master e Loja; ausência de Master no menu da Loja, sem inferir autorização backend. Viewports restaurados e drawer fechado ao concluir.

### Decisão e limites preservados

- **F2 e F3 encerrados neste recorte de correção; F1 continua aberta.** Não reabrir chamados Master nem encaminhar reconstrução do drawer. Prioridade única: corrigir F1 com escopo mínimo e retestar a transferência real do foco.
- PR documental **[#63](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/63)** reaproveitado; quatro documentos apenas, histórico original mantido. Permanece **rascunho, sem merge**, pois o gate funcional obrigatório F1 falhou. Atualização documental sem skip ci; resultado do CI do PR registrado no próprio PR após sua execução. Não realizar integração nem deploy por esta homologação reprovada.
- Limitações históricas continuam: paginação real de chamados por insuficiência de registros, contraste quantitativo, negativa real de notas internas no mesmo cliente e demais NOT EVALUATED anteriores não promovidos. Nesta rodada, pixels exatos 761/961 e SHA-256 remoto também NOT EVALUATED.
- Nenhum código funcional, banco/Supabase/migrations/Auth/MFA/AAL2/RLS/RBAC/RPC, dados de chamados, operação financeira/persistente ou PROD alterado. Sem novo deploy e sem repetição da suíte aprovada. Não avançar a outra microentrega enquanto F1 bloquear o encerramento.

---

## M06.02 — drawer transversal: homologação de navegador com FAIL (18/11/2026)

**Recorte NÃO HOMOLOGADO; AGUARDA_CORRECAO_GEMINI. M06.02 integral EM_EXECUCAO.** A microentrega anterior de chamados Master permanece **CONCLUIDA** e não foi reaberta. Esta execução avaliou somente o drawer existente; nenhum código funcional foi corrigido.

### Revisão, ambiente e referência

- GitHub main confirmado em **`a298d5f973cdecee75be2529a5a47d3803143dc0`**, revisão funcional `f9f900a6306f7a2275fdb3d17f4b7801d75173f8`.
- Cloudflare DEV confirmado pelo Workers Builds dessa main: versão **`105ad0e7-86e6-4886-b382-42fb3c7b2b56`**, build `46063ac3-d61f-45b3-aba0-a2900272ea38`, SUCCESS. Assets observados `index-BUXbLcYE.js` e `index-CPLBN8x7.css`; reaproveitada a validação de publicação anterior, sem novo deploy.
- CI [44440984311](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44440984311) **3/3 PASS** e 596 testes aprovados: evidência automatizada anterior reutilizada. Não reexecutados suíte completa, check local ou dry-run nesta homologação. **CI/Vitest não constituem PASS de navegador para o drawer.**
- Consultados cursor, quadro, matriz, `AppShell.tsx`, regras pertinentes de `styles.css`, inventário V35 e o HTML original versionado `docs/pilot/v35-planos-ofertas.reference.html`. A referência contém os 15 destinos da Loja, navegação Master e acionador `mobileMenu`; inventário `SHARED-A022`, áreas compartilhadas e limites de homologação visual/teclado. Não executar o HTML demonstrativo nem alterar a referência.
- Sessão Master existente no navegador integrado; Administração da Loja existente no Edge. Uma indisponibilidade inicial da sessão da Loja foi recuperada por “Tentar novamente”, sem login, mudança de credenciais ou configuração Auth. Não registrar identidades ou conteúdo privado na evidência.

### Resultado consolidado por cenário

| Cenário | Resultado | Evidência real |
|---|---|---|
| A — abertura/fechamento | **PASS nos mecanismos testados**, com limite de ponteiro descrito abaixo | Acionadores superior e inferior abriram por clique, Enter e Space; aria-expanded dos dois e aria-controls=sidebar coerentes; Escape e backdrop fecharam; seleção de Integrantes fechou e restaurou foco ao acionador correto. |
| B — teclado, foco e isolamento | **FAIL** | Foco inicial permanece fora do drawer; indicador da rota ativa não se distingue entre foco e ausência de foco. Após a primeira tecla, Tab/Shift+Tab circulam corretamente; itens fechados são pulados. |
| C — breakpoints/redimensionamento | **FAIL** | Modos CSS básicos corretos e altura reduzida utilizável, mas abrir mobile e ampliar para desktop mantém backdrop e aprisionamento do teclado. Fronteiras exatas 761/961 não obtidas; limites abaixo. |
| D — rotas/perfis | **PASS no escopo de navegação UI** | Loja: 15 destinos acionados, títulos e aria-current=page corretos, sem Master; Master: 16 itens alcançáveis e entrada Master preservada. Barra inferior com cinco atalhos nos dois perfis. Não equivale à comprovação de autorização no servidor. |

**A — detalhes:** em 390 px, clique/Enter/Space nos dois acionadores, Escape e restauração de foco foram executados. Escape retornou ao `#mobileMenu` quando a abertura veio do topo e ao botão “Menu” quando veio da barra inferior. Clique direto no backdrop à direita da sidebar fechou sem navegar. Seleção de Integrantes em 320 px/Master retornou ao topo; em 390 px/Loja retornou ao Menu inferior, com rota e aria-current corretos. Enter/Enter no superior e Space/Space no inferior também alternaram abrir/fechar enquanto o foco estava indevidamente retido no acionador — isso **não sana F1**. Ponteiro no próprio acionador com menu aberto: **NOT EVALUATED como acionamento direto**, porque o superior está encoberto pela sidebar e o inferior pelo backdrop; não usados force-click ou foco artificial para contornar o modal.

**B — partes aprovadas:** foram percorridos os 16 itens Master por Tab e Shift+Tab; primeiro/último circularam em ambos os sentidos. Após a recuperação pelo primeiro Tab, não houve fuga para Pular para conteúdo, Sair/cabeçalho, conteúdo principal ou barra inferior. Fechado em mobile, Shift+Tab desde o topo alcançou Pular para conteúdo e Tab seguiu para Sair e Atualizar plataforma, sem entrar na sidebar oculta. Sidebar fechada com visibility:hidden/pointer-events:none; clique no atalho Master em 320 px e clique no controle de leitura Atualizar plataforma no desktop chegaram à página sem interceptação. Backdrop do drawer aberto impediu clique no conteúdo subjacente. Nenhuma ação financeira/persistente foi acionada.

### F1 — foco inicial permanece no acionador encoberto (FAIL)

- **Resolução principal:** 390 × 900 CSS px; também observado ao abrir em 768 px e no perfil da Loja em 390 px.
- **Reprodução:** drawer fechado → clicar no acionador superior, ou focá-lo e usar Enter/Space. Repetir com Menu inferior. Não pressionar Tab após abrir.
- **Observado:** sidebar.open, visibility:visible, aria-expanded=true e backdrop visível; `document.activeElement` continua sendo `#mobileMenu` ou “Menu”, **fora da sidebar**. Depois de estabilizar a transição e em nova leitura, continuou no acionador. Reproduzido também por clique por coordenada no botão superior, sem depender de locator.click.
- **Esperado:** foco inicial no primeiro item “Início”, visível e dentro do drawer. O primeiro Tab recupera o foco para a navegação, mas não substitui o foco inicial obrigatório.
- **Causa provável — INFERIDA:** falta de sincronização efetiva entre o efeito de foco e a visibilidade/renderização do drawer. A chamada `firstNavButtonRef.current?.focus()` **já existe**; não alegar ausência dessa implementação. A causa temporal exata ainda exige diagnóstico localizado.
- **Menor correção recomendada:** em `AppShell.tsx`, garantir foco no primeiro item após a abertura estar efetivamente visível no viewport de drawer, com agendamento/cleanup apropriados se necessário. Confirmar activeElement no navegador **antes** de qualquer Tab; preservar ocultação da sidebar fechada e restauração por acionador.

### F2 — estado mobile, backdrop e foco modal persistem no desktop (FAIL)

- **Reprodução principal exata:** 390 × 900 → abrir drawer → percorrer até Master SaaS → redimensionar para **1024 × 900 sem recarregar**.
- **Observado:** sidebar vira position:sticky, mas mantém classe open; backdrop display:block; acionadores superior/inferior ficam ocultos com aria-expanded=true. Foco em Master SaaS; Tab → Início → Integrantes → Cadastros, sempre preso à sidebar. No centro de “Atualizar plataforma”, elementFromPoint encontrou **o backdrop**, não o botão.
- **Esperado:** acima de 960 px, sidebar desktop normal, sem backdrop/modalidade nem restrição de Tab; controles do cabeçalho e conteúdo acessíveis.
- **Retorno a 390 px:** estado aberto e foco na sidebar persistiram; Escape fechou e restaurou o acionador. O retorno funciona como recuperação, mas não elimina o bloqueio indevido no desktop.
- **Reprodução complementar na fronteira:** abrir em 960 px e pedir 961 px resultou em viewport real 962 px; backdrop/estado persistiram. Como o foco ainda estava no acionador que ficou oculto, passou a BODY. Tab enviado à página voltou a Início e permaneceu sob o controle modal.
- **Causa corroborada em código:** `mobileMenuOpen` e o listener global de teclado dependem somente do estado de abertura; não há conciliação com a mudança do breakpoint. `.sidebar-backdrop.open` aplica display:block globalmente, inclusive no desktop.
- **Menor correção recomendada:** em `AppShell.tsx`, conciliar estado/modalidade com `(max-width: 960px)`, encerrar o estado mobile ao entrar no desktop e remover o trap/backdrop. Não restaurar foco para um acionador display:none; usar destino visível e previsível. Em `styles.css`, limitar o backdrop ao modo drawer como defesa complementar. **Não corrigir só escondendo o backdrop:** o listener de Tab também precisa deixar de atuar.

### F3 — rota ativa não ganha indicador visual distinto ao receber foco (FAIL)

- **Reprodução:** em 390 px/Master, abrir drawer; Tab para Início; Shift+Tab para Master SaaS (rota ativa). Observar com :focus-visible=true. Tab para Início e comparar o estilo de Master SaaS agora sem foco.
- **Observado:** nos dois estados, outline `rgba(197,168,128,0.18) solid 0.8px`, outline-offset 2.4px, box-shadow none, fundo `rgba(197,168,128,0.12)` e cor idênticos. Somente os estados de foco mudaram; o indicador visual permaneceu o mesmo. Itens não ativos apresentaram outline dourado sólido de aproximadamente 1.6px no navegador.
- **Esperado:** distinguir visualmente foco de teclado da seleção da rota, inclusive no item ativo.
- **Causa corroborada:** a especificidade de `.side-nav button[aria-current]` sobrescreve o outline global de `:focus-visible`.
- **Menor correção recomendada:** regra de foco da sidebar com precedência suficiente, preservando o estilo da rota ativa fora do foco. Não é necessário redesenhar o menu nem remover aria-current. Esta constatação **não é uma medição quantitativa de contraste/WCAG**.

### Breakpoints e altura reduzida — medidas reais

Medições pelo innerWidth efetivo; leituras transitórias descartadas. Documento sem overflow horizontal nas posições medidas.

| Largura solicitada | innerWidth real | Documento clientWidth/scrollWidth | Sidebar com estado fechado | Barra inferior |
|---:|---:|---:|---|---|
| 320 | 320 | 305/305 | drawer oculto | 5 atalhos visíveis |
| 390 | 390 | 375/375 | drawer oculto | 5 atalhos visíveis |
| 760 | 760 | 745/745 | drawer oculto | 5 atalhos visíveis |
| 761 | **762** | 746/746 | drawer oculto | oculta |
| 768 | 768 | 753/753 | drawer oculto | oculta |
| 960 | 960 | 945/945 | drawer oculto | oculta |
| 961 | **962** | 946/946 | desktop sticky; medido com estado mobile indevidamente aberto | oculta |
| 1024 | 1024 | 1009/1009 | desktop sticky visível | oculta |
| 1440 | 1440 | 1425/1425 | desktop sticky visível | oculta |

- **760 PASS:** barra inferior disponível. **761 exato NOT EVALUATED:** a capacidade de viewport aplicou 762. **960 PASS:** sidebar drawer. **961 exato NOT EVALUATED:** aplicada largura real 962. Valores fracionários foram rejeitados pelo controle de viewport; não tratar 762/962 como se fossem 761/961. Observados os modos corretos dos dois lados das fronteiras, mas os pixels exatos não foram comprovados.
- **390 × 320 PASS para alcance/rolagem interna:** os 16 itens Master percorridos por Tab; scrollHeight 884, clientHeight 320, scrollTop máximo 564; último item visível entre y=222 e y=266. Rolagem da página permaneceu 0. Não confundir com aprovação de F1/F3.
- Desktop normal com estado mobile fechado: Tab desde o último item alcançou Sair; o trap não atuou. O bloqueio de F2 exige a sequência abrir mobile → ampliar.
- Viewports restaurados e drawers fechados ao terminar.

### Perfil da Loja e limite de escopo

Em 1024 px, os 15 botões foram acionados, com título esperado e aria-current=page corretos: Início; Integrantes; Cadastros; Contas a Pagar; Contas a Receber; Tesouraria; Fluxo de Caixa; DRE Contábil; Financeiro; Inadimplência; Relatórios; Plano de Contas; Config. DRE; Chamados; Configurações. Isso testa **navegação da shell**, não reabre homologações de conteúdo/fluxos dessas telas. Barra inferior da Loja: Início, Integrantes, Financeiro, Inadimplência, Menu. Master: Início, Integrantes, Financeiro, Master, Menu; entrada Master SaaS adicional no menu lateral conforme autorização existente. Visibilidade não comprova autorização no servidor.

### Decisão e entrega mínima para o Gemini

**Não encerrar o drawer nem avançar para outro recorte.** Prioridade: F2 (bloqueio no desktop), F1 (foco inicial), F3 (foco visual da rota ativa), em uma correção delimitada. Arquivos prováveis: `src/components/AppShell.tsx`, `src/styles.css` e testes pertinentes em `src/components/ResponsiveLayout.test.tsx` (ou teste comportamental existente apropriado). Não alterar banco/Auth/MFA/RLS/RBAC/RPC ou reconstruir navegação. Validar os três reproduzidores em navegador após correção; cobertura automatizada pertinente não substitui a homologação real.

Registro documental proposto em branch/PR em rascunho, **sem integração** porque os critérios obrigatórios falharam. Reaproveitado CI anterior; o commit documental usa `[skip ci]` para não repetir a suíte completa sem mudança funcional e **não será usado para merge sem novo CI quando aplicável**. Nenhum workflow/configuração de CI foi alterado ou proteção de merge desativada.

Limitações preservadas: fronteiras exatas 761/961 indisponíveis neste controle; contraste quantitativo não avaliado; sem novas negativas de autorização/RLS. Paginação e demais limites da microentrega de chamados continuam no histórico e não foram reavaliados.

---

## M06.02 — encerramento da microentrega de chamados Master (18/11/2026)

**CONCLUIDO no recorte de leitura das conversas Master e regressão da Loja**, na revisão funcional `f9f900a6306f7a2275fdb3d17f4b7801d75173f8`. A M06.02 integral permanece **EM_EXECUCAO**. Este registro supera o FAIL de leitura interna da revisão anterior; o histórico e suas limitações permanecem abaixo.

### Fonte, CI e ambiente DEV

- GitHub `main=f9f900a`, base `d859b16262c48a16001b7cd778620371f13df3a3`, confirmado diretamente nesta execução. A correção afeta apenas os cinco arquivos de leitura/testes em `src/components/MasterSupportQueue*`, `src/lib/master-support*` e `src/lib/support.ts`; acessibilidade/disclosure e configurações de plataforma preservados.
- Checkout isolado reutilizado com o procedimento já validado de objetos GitHub: cinco blobs novos, hashes do commit e árvore exatos, worktree limpo. Árvore funcional `e4e62ba64785efff91e05d49429f5beaf35f63d3`. Workspace anterior e dados não modificados.
- [Actions 44438915012](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44438915012): **3/3 PASS**, frontend/static/onboarding. Log do job frontend `135274602756` confirma **596/596 testes em 85 arquivos**, typecheck, build e Cloudflare dry-run aprovados. Testes automatizados de visibilidade e isolamento continuam separados das evidências reais abaixo; não repetir a suíte nem a matriz anterior sem mudança invalidante.
- Workers Builds **SUCCESS** para a revisão exata: build `c35879e6-5ed4-4d73-8448-d9f0af2847c9`, versão DEV **`9586c7b2-e230-4248-a179-ba7c173021ad`**. [Build do Worker DEV](https://dash.cloudflare.com/ad50eeb9f9d8c4c4f4e9babe314b8af7/workers/services/view/corsys-tronco-digital-dev/production/builds/c35879e6-5ed4-4d73-8448-d9f0af2847c9). A página foi recarregada e os assets da revisão corrigida foram observados nas duas sessões. Não houve novo deploy manual nem publicação no Worker PROD.
- Referência de rollback: versão DEV anterior **`c110100d-4d25-4b20-afaf-6c768cdbbce6`**, revisão `d859b16`, build `6fc04cf6-a726-46ba-a2f7-0b8ce307c876`. Rollback não executado; distribuição percentual de tráfego e disponibilidade do rollback no painel não consultadas.
- Build local com configuração pública DEV existente gerou `index-BUXbLcYE.js`, `index-CPLBN8x7.css` e chunk sob demanda `index-XBmXvlNB.js`. Os nomes de conteúdo de JS/CSS correspondem aos carregados pelo DEV. **CSS remoto e local têm SHA-256 idêntico:** `11fa1e0786357d4ac7ca5bb2b7c14cb5496c0382c431e8fe6299a90f0c29b6fd` (CSS remoto exportado pelo navegador). SHA-256 local JS: `353d670609280d4c915fdd188ba0a8b2d9c168a6c8cd11e6a458d1e242720b3d`; SHA-256 remoto JS **NOT EVALUATED**: exportação de script não disponível nessa capacidade e terminal sem resolução do host. O chunk de exportação não foi carregado. Não usar o bundle CI com placeholder para publicar.
- Não foi repetido `npm run check` local: o gate agregado anterior do wrapper continua sem PASS local e preservado no histórico; o gate de check da revisão atual tem **PASS real no CI**. O build local foi usado para inspeção dos artefatos.

### Homologação funcional real A–D (somente leitura)

Sessões já autenticadas e autorizadas foram utilizadas separadamente: Master AAL2 no navegador integrado e Administração da Loja no Edge. Nenhuma credencial, identificador pessoal ou conteúdo das mensagens foi incluído neste relatório; comparações de conteúdo ocorreram em memória e são registradas apenas como resultado.

| Cenário | Resultado | Evidência real e limite |
|---|---|---|
| A — conversa interna #10 | **PASS** | Uma mensagem carregada como **Nota interna**, um evento como **Evento interno**, zero alertas e sem formulário de resposta ao cliente. O alerta anterior deixou de ocorrer na revisão corrigida. |
| B — conversa de cliente #13 | **PASS** | Três mensagens **Visível ao cliente**, dois eventos de cliente, zero alertas; formulário autorizado de resposta e seleção de status presentes e intocados. |
| C — alternância #10 → #13 → #10 | **PASS** | Cabeçalhos/escopos corretos; mensagens/eventos do chamado anterior não permaneceram no novo. Retorno ao interno restaurou somente seu próprio histórico; zero erros residuais e formulário ausente no interno. Comparação por impressões de conteúdo em memória, sem registrar texto. |
| D — Administração da Loja | **PASS no cenário disponível** | Acesso ao próprio #13: três mensagens carregadas e coincidentes com as mensagens customer vistas pelo Master; dois eventos; duas mensagens da Loja e uma do suporte. Zero alertas, controles de recarga/resposta preservados e nenhuma Nota interna apresentada. |
| D — ocultação de nota interna associada ao mesmo chamado de cliente | **NOT EVALUATED com dados reais** | O #13 não contém nota interna. Não criar fixture para produzir evidência. A negativa permanece comprovada separadamente pelos testes automatizados de `loadTenantTicketMessages`, que filtram customer e rejeitam internal_note retornada indevidamente. |

**Segurança:** a leitura Master usa `customer/internal_note` para mensagens e `customer/internal` para eventos; a leitura da Loja mantém filtro e validação explícitos de `visibility=customer`, além de ticket/tenant. Rejeição automatizada de visibilidade inválida, ticket/organização incompatíveis e eventos internos para Loja preservada. A homologação não substitui nem repete o gate backend/RLS anterior. Nenhuma resposta enviada, status alterado, registro criado ou sessão de suporte iniciada; Supabase/PostgreSQL/migrations/Auth/MFA/AAL2/RLS/RBAC/RPC e código funcional não modificados.

### Smoke e limites residuais

- **PASS mobile 390 px:** conversa interna carregada, Nota interna/Evento interno corretos, zero alertas; disclosure abriu/recolheu. Documento clientWidth/scrollWidth **375/375**.
- **PASS desktop 1440 px:** conversa de cliente carregada e disclosure recolhido normalmente; formulário e eventos preservados. Documento clientWidth/scrollWidth **1425/1425**.
- Reutilizadas as evidências anteriores de ARIA, Enter/Space, tabulação, foco efetivo em Recolher/retorno correto e seis resoluções, pois o código correspondente foi preservado. Não reexecutada a matriz completa. Viewport restaurado.
- Permanecem **NOT EVALUATED**: paginação real por apenas seis registros para páginas de 25; contraste quantitativo; SHA-256 remoto do JS; negativa real de nota interna num chamado de cliente sem tal registro. São limites explícitos, não PASS implícito.
- Limitações históricas de Dashboard Mobile e demais módulos não são encerradas por esta homologação.

### Consolidação e próxima prioridade

Os critérios funcionais obrigatórios disponíveis A–D e smoke passaram; a limitação de ausência de nota interna em chamado de cliente segue a regra explícita do proprietário, com comprovação automatizada separada. **Microentrega de chamados Master encerrada; M06.02 geral continua EM_EXECUCAO.** A aprovação/integração documental do PR #62 depende de seu próprio CI verde e diff restrito aos quatro documentos; o resultado de integração será conferido antes do encerramento da execução.

**Próximo recorte recomendado ao Gemini:** M06.02 — acessibilidade do drawer de navegação transversal (`AppShell.tsx`), cuja homologação de browser permanece pendente na `V35_SCREEN_PARITY_MATRIX.md`. Reconciliar a implementação já existente com a navegação da referência V35 e validar foco inicial, Tab/Shift+Tab, Escape, retorno de foco e controles ocultos em mobile/desktop. Não reconstruir o drawer nem repetir testes de chamados; corrigir somente eventual defeito demonstrado. O quadro M06.02 prevê teclado/acessibilidade/ergonomia; esta é uma prioridade recomendada dentro desse escopo, não uma nova macroetapa nem uma entrega já executada.

---

## M06.02 — homologação real dos chamados Master: parcial com falha de histórico (18/11/2026)

Este registro **atualiza os bloqueios da tentativa inicial abaixo**, preservada como histórico. A acessibilidade do disclosure foi comprovada no DEV; **o aceite integral deste recorte NÃO está concluído** devido à falha reproduzível da conversa interna #10 e aos limites de evidência indicados.

### Revisão, integridade e publicação

- GitHub `main=d859b16262c48a16001b7cd778620371f13df3a3`; base `f65848bfdc5994fa967d928267bb9267b8c76ecc`; diff de apenas três arquivos já conferido na tentativa inicial. Não repetir a revisão automatizada como se fosse nova.
- DNS do terminal continua impedindo clone/fetch. A alternativa somente leitura via conector GitHub recuperou a árvore recursiva completa (**não truncada; 621 blobs**) e os objetos ausentes. Todos os blobs recuperados e árvores foram conferidos pelo SHA-1 Git; o objeto de commit original foi reconstruído com hash exato. **HEAD `d859b16262c48a16001b7cd778620371f13df3a3`, árvore `d965b9c1d4aa78800c945393d4a40e9177fea3c9`, checkout isolado limpo.** Worktree de validação em `repo/.test-tmp/m0602-qa`; workspace antigo e suas alterações preservados.
- CI [44429221490](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44429221490): **PASS 3/3** (frontend/static/onboarding). Evidência anterior permanece válida: check **591 testes/85 arquivos**, MasterSupportQueue **12/12**, typecheck/build e dry-run PASS no runner da revisão.
- Na retomada local, `npm run check` efetivamente executou typecheck, **591/591 testes em 85 arquivos** e gerou o build (1904 módulos; Vite 6.4.5). O wrapper permaneceu aberto após a saída de conclusão do build; **código de saída agregado desse comando local não foi disponibilizado**; o wrapper foi encerrado por interrupção somente após as saídas de testes/build, resultando em exit 1 da interrupção, portanto não promovê-lo a check local PASS nem classificar esse exit como falha funcional dos testes. Uma tentativa anterior ocorreu com cópia incompleta das dependências e falhou por ausência de TypeScript; esse foi um problema do preparo, sem alteração de código.
- Dry-run local de Wrangler **4.156.1 PASS, exit 0**: oito assets lidos, sem bindings, sem upload. A primeira tentativa apresentou EPERM ao gravar logs fora da área permitida; repetir com `WRANGLER_LOG_PATH` no workspace resolveu essa limitação. Nenhum arquivo funcional foi modificado.
- O check GitHub **Workers Builds: corsys-tronco-digital-dev** (`135244889701`) confirmou publicação automática já realizada para o HEAD autorizado, **SUCCESS**. Build `6fc04cf6-a726-46ba-a2f7-0b8ce307c876`; versão **`c110100d-4d25-4b20-afaf-6c768cdbbce6`**. [Build DEV](https://dash.cloudflare.com/ad50eeb9f9d8c4c4f4e9babe314b8af7/workers/services/view/corsys-tronco-digital-dev/production/builds/6fc04cf6-a726-46ba-a2f7-0b8ce307c876). O segmento `production` dessa URL é o ambiente do serviço **DEV**, não prova publicação no Worker de produção do sistema. **Não foi disparado outro deploy nesta retomada.**
- Rollback de referência: versão **`6a43db80-7bd6-476a-9f31-9f0a07e8d1b5`**, build `3c23b19a-546d-4990-b80a-738753545fdc`, associado pelo Workers Builds à base `f65848bf`. Rollback não executado; disponibilidade operacional e tráfego atual no painel Cloudflare não foram consultados.
- Assets carregados pela página DEV coincidem com os nomes de conteúdo gerados localmente: `index-DxjyA-rF.js` e `index-CPLBN8x7.css`. SHA-256 **locais**: JS `3e6bdd974eefb427deebf717e2da6bf61aef0c69f878a2439778fe2665476da0`; CSS `11fa1e0786357d4ac7ca5bb2b7c14cb5496c0382c431e8fe6299a90f0c29b6fd`. Igualdade byte a byte por SHA-256 remoto **NOT EVALUATED**; chunk de exportação sob demanda não carregado no navegador. Configuração pública de build obtida pelo conector, sem leitura de tokens/chaves do navegador nem modificação de configurações Supabase.

### Homologação real — navegador integrado, sessão Master autorizada

O primeiro erro de validação da sessão foi resolvido pelo botão existente “Tentar novamente”. Sessão existente de `michael@lojamais1.com` acessou o console Master e retornou indicadores/fila protegidos por Master/AAL2. Nenhum login, cadastro MFA, alteração Auth ou elevação de permissões foi executado pela automação.

| Critério | Resultado real DEV | Evidência |
|---|---|---|
| Estado inicial recolhido | PASS | Seis botões #13/#12/#11/#10/#9/#8 com aria-expanded=false; painéis existentes e hidden=true |
| aria-expanded e aria-controls | PASS | Associação única master-ticket-details-UUID, elemento correspondente existente; estados acompanhando exibição |
| Ausência de controles ocultos na tabulação | PASS | Painéis recolhidos sem controles filhos; Tab de #13 → Ver conversa → Detalhes #12, sem passar por Recolher oculto |
| Expandir/recolher por clique | PASS | #13 abriu e fechou; estado e painel sincronizados |
| Enter e Space no botão Detalhes | PASS | Sequência Enter/Enter/Space/Space resultou true/false/true/false em #13 |
| Alternância entre chamados | PASS | Expandir #13 e depois #10 recolheu #13; apenas painel #10 visível |
| Foco real em Recolher antes do teclado | PASS | Tab desde Detalhes, passando por Ver conversa; activeElement.textContent=Recolher confirmado **antes** da ação |
| Retorno de foco correto | PASS | Enter no Recolher de #13 → Detalhes #13; Space no Recolher de #10 → Detalhes #10; ambos recolhidos |
| Abrir conversa correta de cliente | PASS | #13 exibiu título correto, mensagens do cliente/equipe e eventos do próprio chamado |
| Abrir histórico da conversa interna | **FAIL** | #10 abriu cabeçalho correto, mas exibiu “Não foi possível validar o histórico desta conversa.” em **duas aberturas independentes** |
| Escopo visual interno/cliente | PASS no recorte observado | #10: Uso interno da plataforma, evento interno e resposta de cliente bloqueada; #13: UUID da Loja e mensagens de cliente. Não foi reexecutado gate backend/RLS |
| Busca por título, número e UUID | PASS | Título completo de #13, número 13 e UUID 81caf24e-2891-4cd4-a112-7201b50cbce4 selecionaram #13 |
| Limpar busca e não reabrir painel obsoleto | PASS | Buscar DEV STAFF LIVE ocultou #13; limpar restaurou seis chamados sem expansão anterior |
| Atualizar chamados e foco | PASS | Expansão e conversa limpas; foco permaneceu no botão Atualizar chamados durante/depois da consulta |
| Mostrar todos os chamados | PASS | Diretório Master → Suporte do Tenant A mostrou #13/#12/#11/#8; após expandir #13 e Mostrar todos, retornaram seis registros, todos recolhidos |
| Foco após Limpar/Mostrar todos | Observação | Botão removido do DOM deixa activeElement=BODY; não observado travamento. Retorno explícito ao campo de busca não implementado |
| Próxima/Anterior e foco entre páginas | NOT EVALUATED | Apenas seis chamados, página de 25; ambos botões desabilitados; nenhum registro artificial criado |
| Vazio/loading/erro distinguíveis | PASS nos estados observados | Consulta em andamento, busca sem resultado e erro de histórico com mensagens distintas |
| Regressão causada por d859b16 | NOT EVALUATED | Falha interna reproduzida, mas não comprovada causalidade com este commit; loader de mensagens não está no diff de três arquivos |

### Resoluções — medidas reais (CSS px)

Medidas com painel #13 expandido. A diferença de 15 px entre viewport e clientWidth corresponde à barra de rolagem vertical observada. As dimensões foram conferidas pelo **innerWidth efetivo**; leituras transitórias durante troca de viewport foram descartadas.

| Viewport | Documento clientWidth | Documento scrollWidth | Tabela clientWidth | Tabela scrollWidth | Overflow horizontal do documento |
|---|---:|---:|---:|---:|---|
| 320 | 305 | 305 | 251 | 841 | PASS — ausente |
| 390 | 375 | 375 | 322 | 841 | PASS — ausente |
| 428 | 413 | 413 | 355 | 841 | PASS — ausente |
| 768 | 753 | 753 | 659 | 841 | PASS — ausente |
| 1024 | 1009 | 1009 | 639 | 841 | PASS — ausente |
| 1440 | 1425 | 1425 | 1043 | 1043 | PASS — ausente |

- Tabela em região `.finance-table`, tabindex=0, overflow-x:auto. Rolagem interna observada ao navegar pelo teclado até Recolher (scrollLeft aproximado 385,6 px em 320 px), sem aumento do scrollWidth do documento. Em 1440 px, sem rolagem horizontal necessária.
- Inspeção visual realizada nos seis tamanhos: conteúdos reais contidos, títulos extensos quebrando na coluna, UUID acessível pela rolagem interna, botões acessíveis por foco/teclado; painel de detalhes com texto escuro e fundo branco. Foco em Recolher visível, outline sólido de aproximadamente 1,6 px.
- Paginação permanece presente e desabilitada pela quantidade insuficiente, sem teste de troca de página. Contraste **inspecionado visualmente**, sem certificação WCAG nem medição instrumental de todas as combinações: auditoria quantitativa de contraste **NOT EVALUATED**. Textos maiores que os existentes no DEV não foram fabricados para o teste.
- Viewport restaurado ao tamanho original ao encerrar; nenhuma resposta, mudança de status, novo chamado ou sessão de suporte foi acionada.

### Reprodução e menor próxima ação

1. Entrar com sessão Master/AAL2 existente no DEV, Operação e suporte → Chamados.
2. Expandir **Detalhes do chamado #10**, ID `6845109b-c3fa-47a4-b226-fe6415d4edf6`, assunto “DEV STAFF LIVE …”.
3. Acionar **Abrir conversa completa** e aguardar as consultas.
4. **Atual:** cabeçalho “Chamado interno” e evento de criação presentes; mensagens substituídas pelo erro “Não foi possível validar o histórico desta conversa.” **Esperado:** histórico autorizado do próprio chamado ou estado vazio válido; falha de integridade/transporte deve permanecer explícita se confirmada.
5. Controle: abrir #13 carregou suas mensagens e eventos corretamente.

**Causa: NOT EVALUATED.** A UI converte em mensagem genérica tanto erro de consulta como rejeição de payload em `loadMasterTicketMessages`; os testes de interface não distinguem essas causas. Não atribuir a RLS, migration ou dado específico por suposição.

**Próxima prioridade M06.02:** diagnosticar somente a leitura da conversa interna #10 e, havendo incompatibilidade comprovada, propor a menor correção no ponto responsável, preservando validações de ticket/tenant/visibilidade e sem ampliar grants/RLS. Revalidar somente esse cenário e impactos comprovados. Revisar também o encerramento do wrapper de check local antes de declarar esse gate local PASS. Acessibilidade de disclosure aprovada no recorte observado; microentrega integral permanece **EM_EXECUCAO / aceite parcial com FAIL**, sem autorização para modificar código funcional nesta homologação.

---

## M06.02 — chamados Master: validação inicial e bloqueios (18/11/2026)

**Estado do recorte: BLOQUEADO para publicação/homologação; M06.02 integral permanece EM_EXECUCAO.**

- Fonte de verdade: GitHub `main=d859b16262c48a16001b7cd778620371f13df3a3`, verificada pelo conector nesta execução. Base `f65848bfdc5994fa967d928267bb9267b8c76ecc`; um commit à frente, sem divergência. Diff restrito a `src/components/MasterSupportQueue.tsx` (+38/-8), `src/components/MasterSupportQueue.test.tsx` (+157) e `docs/V35_SCREEN_PARITY_MATRIX.md` (+1/-1). Cursor e handoff inalterados entre essas revisões.
- CI [44429221490](https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/actions/runs/44429221490): **PASS 3/3**, jobs `frontend`, `static` e `onboarding`. Log do frontend, job `135241960646`, confirma checkout da revisão exata, `npm run check` PASS (typecheck, **591 testes / 85 arquivos**, build), `MasterSupportQueue.test.tsx` **12/12 PASS** e `npx wrangler deploy --config wrangler.dev.jsonc --dry-run` PASS. Evidência automatizada remota, não execução local desta sessão.
- Workspace existente: HEAD `20b093f08f3330130050c6b3925481e854cbed79`, com alterações rastreadas e arquivos não rastreados. Preservado integralmente; não usado para build/deploy. A revisão autorizada não está no banco de objetos local e `origin/main` não está disponível.
- Tentativa de obter cópia isolada via `git clone --no-checkout` falhou: **`Could not resolve host: github.com`**. Sem checkout íntegro da revisão, check/dry-run locais e comparação build local ↔ assets DEV: **NOT EVALUATED**. Não utilizar build antigo nem o bundle CI com configuração placeholder para publicação.
- Navegador Edge: a URL DEV abriu uma sessão existente com rótulo **Administração da Loja**, em **CORSYS DEV TENANT A**, sem console Master visível. Sessão Master AAL2 **não confirmada**; não houve logout, leitura de tokens, alteração Auth/MFA nem tentativa de elevar privilégios.
- Nenhum deploy realizado nesta execução. Versão DEV corrente, correspondência dos assets e referência operacional de rollback: **NOT EVALUATED**; não reutilizar versão histórica como se fosse a atual. Produção, banco e código funcional preservados.

| Critério | Automatizado remoto na revisão | Homologação real DEV nesta execução |
|---|---|---|
| Estado inicial recolhido; aria-expanded; aria-controls correto e único | PASS, suíte 12/12 | NOT EVALUATED |
| Controles ocultos fora da tabulação | Sem prova de tabulação real | NOT EVALUATED |
| Expandir/recolher por clique e alternar dois chamados | PASS, suíte 12/12 | NOT EVALUATED |
| Expandir/recolher por Enter e Space | Não comprovado pelo fireEvent.click | NOT EVALUATED |
| Focar efetivamente Recolher, acioná-lo por teclado e retornar ao Detalhes correto | Teste de clique verifica retorno, sem foco prévio em Recolher | NOT EVALUATED |
| Conversa correta e escopo interno/cliente | Suíte aprovada; não equivale a sessão real | NOT EVALUATED |
| Busca por título, número e identificador; limpar | Cobertura parcial de filtro/limpeza aprovada | NOT EVALUATED |
| Atualizar; Mostrar todos; limpar expansão obsoleta | PASS, suíte 12/12 | NOT EVALUATED |
| Próxima/Anterior e foco após atualização/paginação | Próxima sintética coberta; foco real não comprovado | NOT EVALUATED |
| Regressões funcionais no DEV | Não deduzir do CI | NOT EVALUATED |

| Largura (px) | Documento clientWidth / scrollWidth | Tabela clientWidth / scrollWidth | Overflow, UUID, textos, botões, paginação, contraste e foco |
|---|---|---|---|
| 320 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |
| 390 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |
| 428 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |
| 768 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |
| 1024 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |
| 1440 | NOT EVALUATED | NOT EVALUATED | NOT EVALUATED |

**Próxima ação prioritária:** concluir este mesmo recorte da M06.02 após obter checkout isolado íntegro da revisão autorizada em ambiente com acesso ao GitHub e disponibilizar sessão Master AAL2 no DEV. Seguir o procedimento versionado de publicação, registrar versão/rollback e hashes dos assets, depois homologar apenas os critérios pendentes. Não criar chamados para testar paginação; se não houver registros suficientes, manter NOT EVALUATED. Não há defeito funcional demonstrado que justifique correção ou retorno ao Gemini; não encerrar a microentrega nem selecionar outro recorte como se o aceite estivesse concluído.

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
- **Alterações e ajustes pré-homologação aplicados:**
  - `src/components/FinancialDashboard.tsx`: mantém os 6 cartões estruturais `.panel.metric.metric-placeholder` dentro de `.metric-grid` (`data-testid="financial-kpi-placeholders"`, `aria-hidden="true"`, com título e descrição estáticos de cada indicador e `<strong>—</strong>`) sempre que `!values` (`loading`, `denied` ou `error`), preservando a estabilidade geométrica tanto durante a carga/atualização quanto nos estados terminais de erro ou acesso negado (`42501`/`28000`), sem expor saldos ou botões interativos.
  - `src/components/WorkspaceDashboard.test.tsx`: captura `base.rpc.getMockImplementation()!` antes de substituir `base.rpc.mockImplementation`, eliminando recursão em RPCs não interceptadas e adicionando asserção de resolução para `read_tenant_daily_cash_flow`.
  - `src/components/FinancialDashboard.test.tsx`: valida a permanência dos 6 placeholders estruturais e ausência de botões/valores nos estados terminais `denied` (`42501`) e `error` (`organization_id` divergente), além do ciclo atrasado e `Atualizar indicadores`.
- **Estado de homologação:** testes focados, TypeScript e build Vite aprovados; estabilidade geométrica, hit-testing e homologação em navegador real permanecem `NOT EVALUATED` até a validação independente pelo ChatGPT Work no Cloudflare DEV.

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

## V35 Fechamento dos Gates M02.03 / M04.03 / M06 — Roteiro HTTP Somente Leitura, Master Mobile 320 px e Data Civil por Fuso da Loja (15/11/2026)

## V35 — Correção localizada da instabilidade de testes do Dashboard (15/11/2026)

- **Relatório local recebido:** 2 repetições de `npm.cmd run check` com 2 FAIL/580 PASS (arquivo `src/components/WorkspaceDashboard.test.tsx`), mas `npm.cmd exec -- vitest run src/components/WorkspaceDashboard.test.tsx` isolado **7/7 PASS**. TypeScript da execução completa PASS; build não iniciou porque Vitest encerrou com falha.
- **Base:** GitHub `main` `5c06ecb9223fab5887d001b4816f6750cd123b28`. CI prévio na mesma revisão PASS (não substituir o resultado local).
- **Patch mínimo:** só seletor/sincronização dos dois testes do dashboard, aguardando o conteúdo visível carregado antes dos asserts e timeout explicitamente limitado a 8 s para a RPC de KPI. Nenhuma alteração em `Workspace.tsx`, `FinancialDashboard.tsx`, backend, RLS, Auth ou banco.
- **Pendente:** validar a revisão no CI e repetir `npm.cmd run check` no computador do proprietário; depois build/publicação somente Cloudflare DEV com credenciais locais, sem PROD.
- **Nota:** avisos `act(...)` em outros arquivos foram observados, mas não equivalem a falhas, e não são incluídos nesta microentrega.

---


## V35 — Acessibilidade do drawer mobile e preparação QA Cloudflare DEV (15/11/2026)

- **Base GitHub:** `main` `6481fa0e657011034bc42d451dd39cfd8accecb2`, PR #54 integrado e CI 3/3 PASS.
- **Alteração nesta branch:** `AppShell.tsx` gerencia foco do drawer mobile, retorno de foco ao botão que abriu, Escape e ciclo de Tab nos itens; `src/styles.css` oculta o drawer fora da tela para teclado apenas em viewport <=960 px. Sem modificação de navegação desktop, 21 rotas, autorização ou dados.
- **Testes:** cenários novos em `ResponsiveLayout.test.tsx` para Escape/Tab/restauração/backdrop/navegação e CSS `visibility` sob media query. CI ainda a verificar; QA browser de 320/390/768/1440 px pendente.
- **Deploy:** `wrangler.dev.jsonc` aponta somente para `corsys-tronco-digital-dev`; `npm run deploy:dev` é script existente; CI faz dry-run, não publica. Sem credenciais/sessão autorizada para publicar a partir do ChatGPT nesta entrega. `Cloudflare PROD` inalterado.
- **Próximo passo:** PR/CI, depois publicação DEV controlada e auditoria mobile contra HTML V35 com evidências de screenshots/fluxos sanitizados. Se usar Gemini, fornecer prompt de auditoria restrito à UX, não autorização financeira.

---


## V35 — Paridade funcional: período preservado ao alternar modos do Fluxo de Caixa (15/11/2026)

- **Base:** `main` `38dfe4b9cb108015ed37951e3d532bc7711f806d` (PR #53 integrado).
- **Defeito comprovado em código:** `FluxoCaixa` montava `DailyCashFlow` com uma chave React composta por `organizationId` e `mode`, forçando reset de período a cada troca entre Consolidado, Projetado, Movimentos e Saldo.
- **Correção reversível:** `key={organizationId}`, preservando período por Loja e reinicializando o estado na troca de organização. Adicionado teste de continuidade entre modos e reset no isolamento de contexto entre Lojas.
- **Sem alterações:** Supabase, schema, migrations, grants, contas, políticas, produtos financeiros, Cloudflare ou PROD.
- **Evidência pendente:** pipeline CI desta revisão e QA visual no DEV; subgate HTTP read-only 5/5 previamente aprovado permanece válido, sem repetição desnecessária.
- **Próxima ação:** revisar e integrar PR após checks, continuar lacunas da referência V35.

---


## V35 — M06.01/02: filtros do histórico de planos Master (15/11/2026)

- **Base:** `main` `cab162f012880053b2cf4036e8e2afd6590280b9` (PR #52 integrado).
- **Entrega proposta:** `MasterCommercialCatalog.tsx` passa a renderizar e aplicar os filtros oficiais `view-master-planos-F001,F002,F003,A002`: intervalo inclusivo da data de início da versão, estados `all/draft/current/future/historical/inactive`, limpeza e contagem. O método reproduz a semântica do `applyVersionFilters` do HTML V35; plano desativado prevalece sobre o status da versão.
- **Testes adicionados:** histórico de três versões com data/status distintos, bordas inclusivas, vazio, limpa, exclusão de planos ativos por status desativado e preservação de promoções; consulta somente leitura sem nova RPC.
- **Segurança/preservação:** catálogo já recuperado e validado até o limite de 200; nenhuma operação de publicação, preço, gravação, migração, Auth, RLS, segredo, Worker ou PROD alterada.
- **Evidência:** CI/PR a confirmar; comportamento de navegação em browser e QA DEV **não avaliados** nesta entrega.
- **Próxima ação:** integração condicional ao CI, homologação visual específica quando houver deploy DEV autorizado e continuidade da matriz 21 telas.

---


## V35 — M06.01/02: paridade de filtros em `view-master-cobranca` (15/11/2026)

- **Base:** `main` pós-PR #51 (`91420c7cfd0706167f321973224485325b0813f9`).
- **Entrega proposta:** PR #52 adiciona filtros de fatura por número/status/competência com busca server-side, `organization_id` obrigatório e paginação posterior; acessibilidade básica por `label` e limpeza/reset dos filtros.
- **Segurança:** consulta somente leitura; nenhuma mudança de contratos financeiros, autorização, RLS, banco, provedor ou credenciais.
- **Teste:** Vitest ampliado para filtros, valores inválidos, caracteres curinga e reset; CI Foundation checks static/onboarding/frontend 3/3 PASS na revisão `4d033eb78492ad082d68776f5bafc992b7edc9ae` antes do commit de documentação. QA visual e real DEV ainda NÃO AVALIADOS; não declarar tela homologada.
- **Próxima ação:** integrar PR após CI final e continuar M06.01/M06.02 por requisitos da V35, sem desbloquear operações comerciais não autorizadas.

---


## V35 — Gate HTTP 5/5 comprovado pelo proprietário; paridade das telas como próximo foco (15/11/2026)

- **Base analisada:** `main` `8461e92760041bb4f76901e714fa6e4d6bbb0f8b`. O proprietário executou `npm.cmd run test:negative-auth:readonly --prefix dev-gate` em PowerShell Windows com fixture privada somente local.
- **Evidência reportada:** Grupo A **1/5 A→B PASS**, **2/5 B→A PASS**, **3/5 sem `finance.read` PASS**, **4/5 Master AAL1 bloqueado PASS**, **5/5 Master AAL2/TOTP leitura autorizada PASS**; `PASS: negative HTTP authorization suite completed successfully.`
- **Defeito e solução rastreáveis:** `PGRST202` na chamada negativa de `read_tenant_cash_flow_detail` porque o argumento obrigatório `p_page` foi omitido apenas no cenário `noFinanceClient`; acrescentado `p_page: 0` e a suíte completa passou. Nenhuma asserção foi afrouxada; o usuário corrigiu credenciais locais separadamente.
- **Limites:** Grupo B persistente **SKIPPED** por padrão; nenhuma mutação de DEV pelo gate; CI não reproduziu JWT/TOTP do proprietário; nenhuma evidência de publicação DEV/PROD ou homologação visual nova.
- **Fonte:** `docs/V35_HTTP_READONLY_GATE_20261115.md`.
- **Próxima ação objetiva:** M06.01/M06.02 — paridade funcional/visual das 21 telas React contra HTML V35 e inventário; lacunas M01.03/04, M03 #43, M05 e testes de recuperação seguem independentes.

---


- **Base:** HEAD `02d698b35074902be9291984216e55a6809b2b9e` (CI GitHub Actions 573/573 PASS; responsividade homologada pelo Work em `320, 390, 768 e 1440 px`).
- **ENTREGA 1 — Roteiro HTTP Real Somente Leitura (`dev-gate/`):**
  - `dev-gate/tests/negative-http-authorization.mjs` dividido em **Grupo A (Somente Leitura — padrão `--readonly`, `npm run test:negative-auth:readonly --prefix dev-gate`)** e **Grupo B (Operações Persistentes — bloqueado por padrão, exigindo `--include-persistent` + `ALLOW_DEV_PERSISTENT_AUTH_TESTS=true`)**.
  - `dev-gate/tools/isolation-assertions.mjs` e `dev-gate/tests/isolation-assertions.test.mjs`: `assertPermissionDenied` rejeita explicitamente `PGRST202`, `42883` e `22023` como falso `PASS`; adicionada `assertAuthorizedRpcSuccess` para comprovar leitura positiva autorizada sem erro de função/schema.
  - Assinatura de `create_institutional_payable` no Grupo B corrigida para os 11 parâmetros reais (`p_organization_id`, `p_category_id`, `p_fund_id`, `p_description`, `p_counterparty_name`, `p_competence`, `p_issue_date`, `p_due_date`, `p_accounting_period`, `p_amount`, `p_idempotency_key`).
  - Execução no container local registrada como `BLOCKED` por ausência proposital de `.env.dev` com credenciais privadas.
- **ENTREGA 2 — Navegação Master Mobile em `320 px` (`MasterConsole.tsx` / `styles.css`):**
  - Causa raiz diagnosticada: em `@media (max-width: 960px)`, `.sidebar` (`position: fixed; z-index: 100; transition: transform .22s ease; display: flex !important`) permanecia sem `pointer-events: none` quando fechado/recolhendo, interceptando cliques por coordenada `(x, y)` sobre a altura vertical do 8º item de `.side-nav` (`DRE Contábil`, `id: 'dre'`), enquanto `Enter` via teclado despachava o evento diretamente para `document.activeElement` (`<button>Operação e suporte</button>`).
  - Correção cirúrgica aplicada: `pointer-events: none; box-shadow: none;` em `.sidebar` e `pointer-events: auto;` em `.sidebar.open` dentro de `@media (max-width: 960px)` (`src/styles.css`), além de `type="button"` explícito nos 8 botões de `.finance-sections` em `src/components/MasterConsole.tsx` e teste de regressão em `src/components/ResponsiveLayout.test.tsx`.
- **ENTREGA 4 — Regra de Data Civil Financeira por Fuso Horário da Loja (`ADR-0048`):**
  - Formalizada em `docs/adr/0048-tenant-timezone-financial-current-date.md` e `docs/V35_DATE_TIMEZONE_DECISION.md`.
  - Implementada na migration aditiva `supabase/migrations/20261115120000_v35_tenant_timezone_financial_dates.sql`: `private.is_valid_iana_timezone(text)`, constraint/trigger `validate_organization_settings_timezone` (`22023` fail-closed), `private.tenant_current_date_at(uuid, timestamptz)` e `private.tenant_current_date(uuid)` com base em `organization_settings.timezone` (fallback `'America/Sao_Paulo'`), aplicados uniformemente a `read_tenant_financial_dashboard`, `read_tenant_delinquency`, `read_tenant_delinquency_bucket_summary`, `read_tenant_delinquency_filtered` e 16 comandos/consultas financeiras e contábeis por Loja.
  - Testes adicionados em `supabase/tests/test_tenant_timezone_financial_dates_rollback.sql` e `src/lib/delinquency-report.test.ts` (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `UTC`, virada `21:00–23:59 BRT` e fronteiras `0, 1, 30, 31, 60, 61, 90, 91` dias).

---

## V35 Master Execution Controller V2 — Correções Críticas e Paridade V35 (13/11/2026)

- **Regressão CI e Inadimplência Global (`view-inadimplencia`):**
  - Restaurado `loadDelinquencyPage` para invocar `read_tenant_delinquency` (corrige contrato de `delinquency-export.test.ts` e adiciona parâmetro opcional `bucket` em `loadDelinquencyExport`).
  - Corrigidos os 4 defeitos de `20261113123000_v35_tenant_delinquency_buckets.sql`, `delinquency-report.ts` e `DelinquencyReport.tsx`: detecção estrita de `42883`/`PGRST202` como `migrationPending`, remoção do fallback `p_limit: 1000` em cliente e de `.catch(() => [])`, eliminação do fallback de data local do navegador, `<button aria-pressed>` semântico nos cards, validação de `v_member_financial_position.integrity_ok` no resumo SQL, retorno determinístico das 4 faixas canônicas e exportação XLSX + Imprimir/PDF.
- **Paridade e Higiene V35 em Telas:**
  - `Workspace.tsx` + `Finance.tsx`: modos `Consolidado`, `Receitas x Desp.` e `Saldo` em `role="group"` com `aria-pressed`, alternador expandir fluxo com `aria-expanded`, e atalhos operacionais ligando diretamente às seções de `Finance`.
  - `Relatorios.tsx`: ativada a aba `'inadimplencia'` (com `DelinquencyReport`).
  - `Members.tsx`: período inicial dinâmico (`defaultMonthBounds`) e seção de comunicações conectada via RLS a `public.v_member_communication_status` (sem registros sintéticos).
  - `PlanoContas.tsx`: removido import não utilizado de `AccountingPrepublication`.
  - `docs/V35_SCREEN_PARITY_MATRIX.md`: reconciliada para os 21 IDs canônicos distinguindo claramente código/testes locais, pendências de migration DEV e bloqueios de decisão externa (#43, M05.01, M01.03).
- **Verificação:** `npm run check` (`typecheck` + suíte completa Vitest + `build`), `check_v35_preservation.py`, `compile_applet` e `lint_applet` executados ao término deste ciclo; runtime PostgreSQL 17 não executado localmente por ausência dos binários `psql`/`postgres` no container.

---

## V35 M06.01 — Matriz de Paridade V35 iniciada e correção de SLA em chamados (12/11/2026)

- **Situação:** M05.02 (Hardening de segurança) concluída e aguardando merge do PR #50.
- **Microentrega ativa (M06.01):** Matriz de paridade das 21 telas V35 criada (`docs/V35_SCREEN_PARITY_MATRIX.md`). Lacuna de SLA em `view-chamados` corrigida.
- **Próxima ação:** Selecionar a próxima lacuna funcional prioritária da matriz (`view-dashboard`, `view-inadimplencia` ou similar) e iniciar implementação em PRs independentes.
- **Hardening M05.02:** Runner de restauração endurecido com validações fail-closed. Testes validados (9/9 PASS). Aguarda autorização de merge do PR #50.
- **Compromisso:** Prosseguir com as prioridades 2, 3, 4 e 5 (Paridade, Mobile/UX, Regressão, etc). Não encerrar a sessão sem progresso funcional rastreável.

---

## V35 M05.02 — Correções de CI e preparação do PostgreSQL descartável (11/11/2026)

- **Correções de CI e Executáveis M05.02:**
  1. *Dependências Frontend:* `package-lock.json` regenerado preservando estritamente o `package.json` e validado via `npm ci --ignore-scripts` (0 vulnerabilidades, 217 pacotes instalados com sucesso).
  2. *Validação SQL:* Metainstrução `\set ON_ERROR_STOP on` removida de `scripts/v35_m05_backup_verify_checks.sql` para evitar rejeição por parsers SQL estritos; flag `-v ON_ERROR_STOP=1` mantida em todas as chamadas `psql` no runner e runbook. Cinco assertivas determinísticas e sentinela `V35_M0502_VERIFICATION_PASS` preservadas.
  3. *Preparação PostgreSQL 17 descartável:* Adicionada a definição autêntica da função de plataforma Supabase `public.rls_auto_enable()` e event trigger `ensure_rls` em `scripts/v35_m05_prepare_source_db.sql`, suprindo o requisito de `20261002202518_harden_anonymous_rpc_permissions.sql:17` sem bypass vazio.
  4. *Scripts e Higiene:* Script orquestrador automatizado `scripts/run_v35_m05_backup_restore_trial.sh` criado; arquivo ZIP redundante interno removido do repositório.
- **Status do Ensaio M05.02:** `PREPARADO` / `NÃO TESTADO` (a execução real do backup e restauração permanece pendente de cluster PostgreSQL 17 descartável disponível no ambiente).
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

Base GitHub main 97f67281c9e55ac6d58271386c65f1dd690703f1, com a mesma árvore da cópia local antes das alterações. M04.03-B integrada pelo PR #48. O port local reaproveita a interface do AI Studio, limita campos em ambas as consultas e exige eventos de cliente na leitura da Loja. Gate local PostgreSQL 17.5 em memória PASS com a migration proposta, políticas versionadas e dados sintéticos. Master/SUPPORT AAL2, isolamento Loja A/B, negativos AAL1 e anônimo, projeção, ordem e escrita interna verificados. Gateway/JWT real e restauração permanecem pendentes. ADR 0047 registra o contrato. O runbook M05 descreve restauração em base descartável com dados sintéticos e aguarda evidência de execução. Validação local com a configuração pública de CI e chave placeholder. Typecheck, 537 testes em 81 arquivos e build passaram. O build registrou aviso de tamanho de bundle. Sem integração ou publicação da M04.03-C.

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
- **M04.01:** já existem `MasterBilling`, preview/emissão manual idempotente no código e as duas RPCs `preview_saas_manual_invoice` e `issue_saas_manual_invoice` no DEV. Read-back somente leitura em 10/11/2026 confirmou ambas como `SECURITY DEFINER` sem EXECUTE de anon; execução autenticada autorizada dentro do servidor por Master/AAL2 conforme migration. JWT real, contratos/ciclos/termos comerciais e fatura real **não homologados**. [Reconciliação e gates](docs/V35_M0401_MANUAL_BILLING_RECONCILIATION.md). Nenhuma escrita no Supabase DEV nem PROD.

---

## V35 M03.03 — rubricas com classificação demonstrável

M03.03 sobre main 19bae9c: as telas DRE, comparativo e relatórios distinguem receitas registradas, custos, despesas e resultado financeiro pela natureza histórica retornada por read_tenant_dre. O demonstrativo separa resultado antes do financeiro e resultado total; a soma por competência conserva sinais e centavos. M03.01 permanece integrada com gates DEV já registrados.

Para completar Receita Bruta, Deduções e Receita Líquida, o contador deve definir quais contas/eventos reduzem a receita e como versionar essa classificação por plano/competência, inclusive cancelamentos e correções. Natureza revenue e a classificação recorrente/avulsa não distinguem dedução de ajuste. M03.04 integral exige eventos contábeis balanceados: v_dre_entries expõe somente a perna de resultado e o ledger de tesouraria expõe movimentos de caixa. Faltam regras explícitas para contrapartidas de recebíveis, obrigações, adiantamentos e saldos iniciais, além de como registrar liquidações e reversões. Não publicar esses recortes como Diário ou Razão integral.

## Marco 10/11/2026 — M02.02-D integrada; M02.03 aguarda autorização DEV

- PR #40, HEAD `746bd5819d04c4eb91f276c1d1434d4e6309af27`, revisão do contrato SQL e testes registrada no PR; CI #459 static/onboarding/frontend **3/3 PASS**. Integrado à `main` no squash `86f1c62634d4e2dc0a5ad1fbac1cd49218517907`.
- M02.02-A/B/C/D **integradas somente em código**. Migration de D `20261110220000_v35_cash_flow_detail.sql` **ausente** na leitura do DEV em 10/11/2026; frontend novo **não publicado**, QA de JWT/finance.read reais não realizado. Gate necessário: [V35_M0203_DEV_GATE.md](docs/V35_M0203_DEV_GATE.md) (no cursor use link direto). Não declarar M02.03 homologada.
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

## M02.02-C — reuso de saldos reais da Tesouraria (10/11/2026)

M02.02-B integrada PR #37 / `66db9bf7`, CI 3/3 PASS (sem DEV). Branch `feat/v35-m0202-c-cash-flow-balances`: componente DailyCashFlow no modo Saldo reaproveita TreasuryBalances, que obtém saldo financeiro derivado de movimentos contabilizados por conta, com isolamento de Loja e sem afirmar conciliação bancária. Nenhuma migration/deploy/operação financeira. Testes de modo, saldo por conta e bloqueio cross-tenant propostos. Saldo inicial e evolução por competência ainda requerem backend; não somar página de movimentos. Registrar CI e PR antes de integrar.

## V35 M02.02-B — detalhe operacional por conta em PR (10/11/2026)

Branch `feat/v35-m0202-b-cash-flow-movements` em código da main `c41b6823`: leitor paginado 25 movimentos/consulta, filtros por Loja/período/tipos operacionais, verificação de contagem exata, UUID/dia/direção, contas autorizadas e negação fail-closed a dados truncados/cross-tenant. UI detalhada em Consolidado e Receitas × Desp. após validação do resumo diário; não soma página como total do período. Nenhuma migration, escrita financeira ou deploy, apenas PR/CI. Limite declarado: descrição/categoria de origem e ranking de despesas ainda necessitam consulta backend sem inferências; não declarar paridade V35 completa ou snapshot transacional único. Decisão de desconsiderar repasse neutro permanece válida.

## Decisão de escopo — 10/11/2026: desconsiderar repasse neutro

O proprietário declarou que **repasse neutro não integra o comportamento de negócio desejado**. A menção nos campos `DYN-008-F002` e `view-plano-contas-F082` do protótipo HTML V35 permanece apenas como **evidência histórica da fonte original**; não constitui requisito autorizado para produção. **Não implementar** categoria neutra, tratamento patrimonial/passivo, RPC, mapeamento ou cenários de estorno/baixa específicos desse conceito. Não alterar `sources/` nem o HTML original.

Esta decisão substitui instruções históricas de "confirmar regra contábil" ou "repasse neutro bloqueado" presentes abaixo. A M02.02 segue para paridade de Fluxo de Caixa e gates realmente pendentes, sem esse bloqueio. Outros tipos de repasse/obrigação efetivamente contratados continuam sujeitos às regras já existentes, sem inferir mudanças.

---

## Fechamento M02.02-A — integração GitHub (09/11/2026)

PR #33 integrado `a320ca9a`, matriz M02.01. PR #34 foi apontado para main e reconciliado com squash antecedente por ref protegida com lease; revisão final `50ba0d59` CI static/frontend/onboarding PASS 3/3, merge `16bfd8e8d0838a20f2be5464a5e9c122eef0d3ea`. Completeness checks e testes focados de conciliação integrados; DEV/runtime remoto não testados e nenhuma alteração em Supabase/Cloudflare/produção. Permanecem limites de snapshot entre várias leituras, potencial migração para projeção server-side se exigida por concorrência; não confundir leitura completa com snapshot transacional. Repasse neutro aguarda decisão contábil explícita de titularidade/passivo/baixa; a matriz M02.01 já lista próximo escopo independente.

## V35 M02.02-A — integridade da conciliação

M02.02-A: leitura da conciliação restringe estornos aos IDs dos vínculos do extrato, em lotes de 100. Confere contagem exata e totais por linha em centavos; leitura truncada ou incoerente bloqueia as ações. Oito testes focados e typecheck locais passaram. Gate DEV futuro somente do cenário de truncamento, se autorizado. Repasse neutro depende da definição contábil.

## V35 M02.01 — reconciliação financeira

M02.01 reconciliada sobre main 0a753406. Matriz em docs/V35_M0201_FINANCIAL_RECONCILIATION.md. Próxima M02.02: garantir completude da leitura de vínculos ativos na conciliação sob truncamento de estornos. Repasse neutro segue lacuna de domínio; confirmar regra contábil antes de implementar. Gates financeiros A/B anteriores preservados. Revisão exclusivamente documental.

## Marco M01.03 integrado; M02.01 iniciada (09/11/2026)

- GitHub PR #31 `feat(v35): M01.03` integrado na `main` via squash `0addb8281300b018e6e8396feba2d6d08d458467` após CI HEAD `23b04c9` 3/3 PASS. Code review da origem do documento oficial e condições fail-closed registrada no próprio PR. Não ocorreu ativação DEV/PROD; não reaplicar testes previamente aprovados.
- M01.03 tem migration `20261109233000_v35_onboarding_acceptance.sql`, callback e UI de aceite prontos **somente em código**. Texto de Termos de Uso segue como minuta não vigente, sem publicação, versão, hash nem vigência; M01.04 depende de documento oficial, autorização de ambiente/destinatário e JWT/convite real. Gate: `docs/V35_M0103_DEV_GATE.md`.
- Continuidade sem bloqueio jurídico: microentrega M02.01 iniciada como **reconciliação**, não codificação presumida. Inventário V35 tem 21 telas; na árvore de `src/components` existem `AccountTransfers`, `MutualBatches`, `Relatorios`, `AccountingPlans`, `BankReconciliation`, `FinancialDashboard` etc., e migrations correlatas. Os históricos de paridade têm lacunas, mas nem todas estão atualizadas; classificar com evidência concreta após inspeção de código e gates existentes. Próxima ação: analisar recortes financeiros/cadastros efetivamente não homologados, registrar matriz objetiva, sem repetir provas A/B anteriores.

## M01.03 — callback e documento oficial

Verificação local: typecheck, 32 testes do App e três do dispatcher passaram. O job PostgreSQL/onboarding do run 42686830483 passou na revisão eb110eb. O frontend daquele run falhou na resolução de tipos de node:crypto no teste. A revisão seguinte isolou o import no runner Vitest e passou localmente.

PR #31 — callback /onboarding/accept?run_id=..., com sessão validada pelo Auth existente e sem abertura do Workspace durante o aceite. O convite usa o redirect construído exclusivamente a partir de ONBOARDING_APP_ORIGIN (HTTPS). Sem origem configurada, o dispatcher retorna 503 antes da reserva. A tela exibe texto UTF-8 como texto puro, verifica SHA-256 e exige ação explícita. O banco compara o mesmo conteúdo oficial e revalida vigência/versão/hash em toda nova ativação. O fluxo comercial exige termos mesmo se a flag legada estiver desligada. Replay concluído consulta o recibo, sem novo aceite.

Integração: revisar PR e CI. Homologação: aprovar o texto UTF-8 integral, versão, vigência e SHA-256 dos bytes exatos; provisionar metadados e conteúdo privado da mesma versão em transação separada e autorizada. Com aprovação específica, aplicar a migration no DEV antes de publicar Edge e frontend, configurar ONBOARDING_APP_ORIGIN e incluir o callback na allowlist Auth. Conferir primeiro que ausência de conteúdo, hash divergente, sessão inválida e usuário de outra Loja bloqueiam. Na M01.04, autorizar destinatário e envio separadamente e conferir callback/JWT real, acesso posterior, perfil da Loja, recibo e replay. Nenhuma publicação nem alteração DEV nesta etapa.

## Evidência M01.03 e gate de homologação

PR #31, revisão 302b4c9: job onboarding do GitHub Actions 42683699415 aprovado. Gate M01.03 em PostgreSQL 17 descartável confirmou rollback do DDL, negação anônima e de identidade diferente/não confirmada, finalização restrita e atômica, recusa de consentimento ausente e versão/hash inválidos, serialização de duas sessões e um único perfil/recibo/evento na Loja correta.

Homologação: aprovar a versão e o hash do documento oficial e definir a origem do conteúdo para exibição. Preparar a tela de aceite e o retorno do Auth. Após aprovação específica, aplicar a migration M01.03 somente no Supabase DEV e publicar a função compatível. Conferir permissões e ausência de vínculo antes do aceite. Em M01.04, com destinatário autorizado separadamente, validar o retorno Auth, o aceite real, a Loja/perfil, o recibo/auditoria e o replay com JWT real.

## V35 M01.03 — vínculo e aceite

M01.03 preparada sobre main 625a516a (PR #30). O Auth fornece o UUID ao finalizar o despacho. A RPC de aceite exige esse UUID autenticado, e-mail confirmado, perfil de sistema da própria Loja e, quando exigido, consentimento explícito à versão publicada vigente e ao hash. Vínculo, recibo, conclusão e auditoria são atômicos. Execuções antigas sem prova de identidade permanecem sem vínculo. Três testes locais do handler passaram. Gate PostgreSQL descartável incluído no CI. Ativação DEV aguarda aprovação.

## M01.02 — ativação no DEV e testes SQL (09/11/2026)

- Proprietário autorizou aplicar a migration M01.02 somente no projeto Supabase DEV `szqkdekwhzxsoxorgvaz` e executar testes de autorização e reconciliação, **sem envio de convites e sem produção**. PRs #28/#29 já integrados em `main=b39da8b732c583da8fb809e06c23268211180202`.
- Supabase registrou `v35_onboarding_invite_reconciliation` na versão real `20261109190747`; as RPCs `list_onboarding_invite_reconciliation`, `expire_onboarding_invite_claims` e `observe_onboarding_invite_reconciliation` foram lidas de volta. Privilégios anon negados, authenticated EXECUTE concedido com autorização determinística Master/AAL2; funções SECURITY DEFINER/search_path vazio.
- SQL DEV: chamada Master/AAL2 com claims simuladas PASS; AAL1 Master e AAL2 não-Master negados nas três funções; transação com fixtures fictícias validou expiração stale uma vez, preservação de claim recente/attempts, nenhuma liberação de reenvio, observações auditáveis/idempotentes e payload sem e-mail. `ROLLBACK` executado. Read-back posterior confirmou **0 jobs de convite, 0 eventos de convite e 0 runs sintéticas** persistidos.
- A migration original `20261109220000_v35_onboarding_invite_reconciliation.sql` foi renomeada para `20261109190747_v35_onboarding_invite_reconciliation.sql`, preservando conteúdo; não reaplicar a migração no DEV.
- Não houve chamadas Auth Admin, teste JWT HTTP real, convites, deploy de Edge Function ou PROD. Reenvio seguro com resultado externo ambíguo **continua bloqueado** até existir comprovação verificável. M01.02 com gates de DB DEV aceitos, mas **não integralmente concluída** pelo escopo de retry; próxima microentrega independente: M01.03, seguida do gate M01.04 com autorização específica.

## Marco M01.02 — PR #28 integrado, sem ativação (09/11/2026)

- GitHub `main=bf326254fba3e7a66a2f02137fa1e5c6da818461`, PR #28 integrado após CI static/frontend/onboarding PASS na revisão `4474b658`. Migration `20261109220000_v35_onboarding_invite_reconciliation.sql` está versionada, **não aplicada ao Supabase DEV**. Nenhuma função Edge foi republicada nem convite enviado.
- Segurança: observação de existência de conta Auth não comprova envio, bloqueio contra reenvio permanece e expiração conserva `attempts=1`. ADR-0044. Próximo gate depende de autorização específica para aplicar as três RPCs no DEV e realizar read-back/negativas sem envio; M01.03 pode ser desenvolvida de forma independente. Não reaplicar M01.01.
- Classificação: `INTEGRADO` ≠ `HOMOLOGADO_DEV` ≠ `CONCLUIDO`.

## M01.02 — reconciliação de convites (09/11/2026)

- A partir de `main=04f99e97521a2841bc2d628277ff791724bc0c93`, preparada branch `feat/v35-m0102-invite-reconciliation`. Propõe migration somente ADITIVA e RPCs de consulta/expiração/observação para Master+AAL2, respeitando o isolamento de operações e sem alterar Auth/convites.
- Expiração é quarentena: `running` velho vira `failed/invite_outcome_unknown`, `attempts=1` preservado; não há reenvio, retry, reset de reserva, criação/vínculo de usuários ou prova de delivery. Observação de conta existente é apenas leitura e não habilita acesso.
- ADR-0044 e gate PostgreSQL descartável no mesmo script `check_onboarding_invite_pg.py`; resultados dependem de CI do PR. A migration **não foi aplicada** no Supabase DEV, nenhum deploy ou convite foi executado. Encerramento da M01.02 e homologação DEV ainda pendentes.

## V35 M01.01 — ativação técnica DEV autorizada e verificada (09/11/2026)

- Autorização específica do proprietário: integrar PR #26 e ativar migration/Edge Function **somente DEV**, **sem envio de convites**.
- PR #26 integrado à main em `b32692dc1b1bd94713c23d0760ff4965001a8ee0`; CI #424 PASS (static, frontend, onboarding) para `7a7ee9f`. Não repetir gates anteriores por mudança de conversa.
- Supabase DEV szqkdekwhzxsoxorgvaz: migration `v35_onboarding_invite_consumer` aplicada com sucesso, versão real `20261109184607`. SQL enviado sem delimitadores externos `BEGIN/COMMIT`; read-back 3 RPCs presentes, `authenticated` EXECUTE apenas em autorização; `claim` e `finish` EXECUTE somente service_role; `anon` não pode executar autorização.
- Edge Function `onboarding-invite` implantada DEV, status ACTIVE, versão 1, `verify_jwt=true`, dois arquivos lidos de volta; nenhuma função existia previamente. 0 jobs `onboarding_invite` e 0 eventos de convite na verificação read-only.
- Renomeado arquivo de migration para `supabase/migrations/20261109184607_v35_onboarding_invite_consumer.sql`, alinhando a versão de código ao registro do banco; conteúdo SQL inalterado.
- **Não homologado:** runtime com JWT Master/AAL2 real, funcionamento final da Edge, envio/recebimento de convite, associação de usuário/Loja e termos. Nenhum convite realizado. Fase 2 requer autorização separada e destinatário autorizado; M01.02 continua aberta.

## Evidência M01.01 no PR #26

PR #26, revisão 0278175, CI #423, job onboarding aprovado. PostgreSQL 17 descartável confirmou presença das RPCs antes do ROLLBACK e ausência após ele, com os delimitadores da migration excluídos. O gate usa tabelas, helpers e triggers extraídos das migrations e claims Auth simuladas. Passaram Master/AAL2, negações anon/AAL1/não-Master, RPCs de fila restritas a service_role, concorrência observada entre sessões PostgreSQL, deduplicação, conta existente, replay, ator da reserva na finalização, resultado incerto e auditoria sanitizada. Três testes Node do handler passaram no mesmo job. Runtime Edge, JWT real e envio DEV ficam para o gate de ativação.

## V35 M01.01 — 09/11/2026

M01.01 preparada na branch feat/v35-m01-invite-consumer a partir da main 639ef08a (PR #25). Três testes locais do handler passaram com adaptadores simulados. SQL, runtime Edge e entrega DEV ainda sem homologação. M01.02 segue com reconciliação e expiração operacional. Ativação depende de aprovação específica.

## Cursor ativo V35 — 03/11/2026 (governança em branch)

- **Decisão vigente:** concluir integralmente a V35 antes de iniciar Beta. Escopo rastreado em `docs/V35_EXECUTION_BOARD.md`; próxima microentrega e protocolo de retomada em `docs/V35_SESSION_CURSOR.md`.
- **Base da inspeção:** `main` em `e72cbe424c7238a758037c542eb473f5837042f2` (PR #24 integrado); validar HEAD na execução seguinte. Este registro documental **não** implementa novos convites ou alterações de banco.
- **Próxima microentrega:** M01.01, consumidor server-side seguro e idempotente de `onboarding_invite`, com contrato real de fila/Auth, tests focados e PR. Sem nova capacidade sensível ativada sem aprovação específica.
- **Não repetir:** aceite da auditoria Master, gates financeiros/RLS já aprovados no escopo registrado e teste SMTP de recuperação. A evidência de SMTP **não** equivale ao convite, envio e entrega final.
- **Este arquivo preserva fatos históricos abaixo:** textos antigos devem ser interpretados na revisão e data de origem; a posição atual fica no cursor compacto.

## SMTP DEV ativo e teste de envio aceito — 01/11/2026 Brasil

Atualização que supersede os bloqueios operacionais anotados abaixo: proprietário configurou pessoalmente o SMTP personalizado no Supabase DEV, remetente `michael@lojamais1.com`, nome `CorSys Tronco Digital`, host `smtp.resend.com`, porta `465`; corrigiu whitespace inicial que havia no host. UI confirmou toggle SMTP ativo e senha armazenada, sempre oculta e não lida pelo agente. Com autorização específica do proprietário, o painel de usuários enviou um único e-mail de recuperação para `michael@lojamais1.com` e exibiu “Password recovery sent” / “Sent password recovery to michael@lojamais1.com”. Nenhuma senha foi alterada e nenhum link foi aberto. Isto confirma aceite do envio pelo fluxo Supabase Auth; caixa de entrada/entrega final não foi verificada. Não foi convite de onboarding. Nenhuma API key ou secret foi lida/registrada.

Próximo: implementar consumidor idempotente e autorizado de `onboarding_invite` usando Supabase Auth Admin no servidor; não há Edge Function consumidora implantada, e nenhum convite real foi enviado. Não repetir o e-mail de recuperação como verificação. Consultar a entrega Resend apenas se necessário e sem ler conteúdo de reset.

## SMTP DEV conferido no Brave — 01/11/2026 Brasil

Brave confirmado na organização correta fblwfnjkisduhzuylazo. Navegação ao projeto DEV /auth/smtp funcionou; switch Toggle SMTP aria-checked=false. SMTP personalizado desativado. Somente leitura, nenhum campo ou credencial alterado; remetente escolhido michael@lojamais1.com ainda depende da configuração SMTP. Próxima intervenção: proprietário habilitar/configurar SMTP Resend no DEV e inserir pessoalmente a chave no campo Password; não enviá-la ao chat. Atualiza bloqueio anterior de conta incorreta. Implementação do consumidor onboarding_invite continua pendente e nenhuma mensagem foi enviada.

## Continuidade dos convites — 01/11/2026 Brasil

Proprietário definiu michael@lojamais1.com como remetente dos convites. PR23 integrado em 01aed19d, CI415 PASS, aceite real da auditoria encerrado no escopo registrado abaixo. Consulta read-only do Resend confirmou lojamais1.com verificado, envio habilitado; nenhuma mensagem foi enviada. Tentativa de abrir SMTP do Supabase DEV redirecionou para /dashboard/organizations e mostrou somente a organização cxhyntqrxtpfzasvwdyi (3 projetos), da outra conta; DEV pertence a fblwfnjkisduhzuylazo. Painel DEV/SMTP não foi acessado nem alterado. Próxima intervenção: proprietário abrir painel do projeto szqkdekwhzxsoxorgvaz pela conta correta; depois conferir somente estado SMTP/remetente, sem extrair senha/chaves. Resend conversation_id para chamadas futuras: 01a199a2-09c0-7424-96de-8a25d9db56c1. Nota local ainda não commitada; incorporar na próxima entrega de convites.

## Aceite real da Auditoria Master — 01/11/2026 Brasil

- Proprietário conectou sessão Master real e concluiu MFA no navegador; não foram extraídos JWT, senha ou OTP. Após atualizar a aba antiga, Master > Operação e suporte > Auditoria retornou 5 eventos reais (IDs 25, 24, 21, 20, 1), sem metadata.
- Filtro de ação support_session.start retornou apenas evento 20. Combinação dessa ação com Loja 94b84958-4dd9-435d-9a4e-244220835d70 retornou vazio explícito. Data UTC 01/11/2026 e essa Loja retornaram os eventos 25/24. Filtros restaurados à consulta inicial. Sem paginação real além da primeira página (há somente 5 eventos); não criar histórico artificial para esse teste.
- Leitura administrativa separada confirmou 5 eventos preservados, sem escrita/cancelamento/alteração financeira. Negativas AAL1/tenant/anon seguem comprovadas pelo gate SQL anterior, não repetidas como HTTP.
- PR22 integrado 88b0fb7d; CI413 PASS; Cloudflare DEV585995d2 Ready/100%. Inclui as correções de ferramentas do PR21. Removido rótulo Informativo da aba funcional; alteração apenas de apresentação.
- Próximo bloqueio de onboarding: nenhuma Edge Function implantada para consumir convite. Resend conectado tem somente lojamais1.com verified/sending enabled; remetente do CorSys ainda não definido pelo proprietário. Pergunta enviada; nenhuma mensagem, domínio, chave, DNS ou secret alterado. Não tratar tarefa enfileirada como convite entregue.

## Auditoria Master ativada somente DEV — 01/11/2026

Ativação especificamente autorizada pelo proprietário. Migration master_audit_read_model aplicada somente ao DEV szqkdekwhzxsoxorgvaz, versão real 20261102000933; arquivo alinhado sem alterar SQL aplicado. MASTER_AUDIT_READ_MODEL_SQL_PASS em transação ROLLBACK: resultado autorizado e ordenado, sem metadata, faixa inválida negada, AAL1/não-staff/anon negados, SELECT direto negado. Read-back: 5 eventos antes/depois, RLS true, SELECT authenticated false, anon EXECUTE false, authenticated EXECUTE true sujeito ao helper MASTER+AAL2, search_path vazio. São claims SQL simuladas, não HTTP/MFA real. CI412 PASS para implementação; atualização de registro/versão será checada no PR. Produção e secrets preservados.

## Auditoria Master preparada — 01/11/2026

PR20 integrado e2e346f3 (CI407 PASS), DEV31ee0c40 Ready/100%. PR21 integrado c3e9d529 (CI409 PASS), publicação Cloudflare dessa revisão ainda não observada. Próximo pacote: Auditoria Master preparada com RPC mínima, filtros e paginação, IDs bigint preservados, metadata omitido. 13 testes cliente/integração MasterOperations PASS (inclui resource_type nulo histórico) e typecheck PASS. Teste SQL de autorização/read-back preparado mas NÃO executado; Docker local indisponível, Python local indisponível e CI fará gramática/build. Migration 20261102000933 NÃO aplicada; aprovação específica necessária para ativar consulta cross-tenant de MASTER+AAL2. Após aprovação: aplicar somente DEV, executar gate SQL em ROLLBACK, read-back de grants/RLS e aceite HTTP/UI com sessão real. Sem produção/secrets nem criação de usuários. Consulta DEV de Edge Functions retornou lista vazia: consumidor de convites não implantado, entrega real continua pendente.

## Correções de ferramentas — 01/11/2026

Vite 6.4.5, Vitest 5.0.5 e Wrangler 4.156.1 fixados, sem atualização major. npm audit retornou zero vulnerabilidades após instalação. 478 testes/tipos/build PASS sobre base 6042cedc; main com exportações do PR20 foi reconciliada sem conflitos, CI do PR validará composição final. PR20 integrado e2e346f3, CI407 PASS, publicação automática DEV ainda a conferir. Nenhuma alteração financeira, migration ou secret.

## Continuidade V35 — exportações locais — 01/11/2026

Continuidade: PR #19 integrado autorizado no commit 6042cedc, CI405 PASS, DEV 6df6ff0d Ready/100%. Exportações PDF (impressão nativa) e XLSX implementadas nesta branch para páginas financeiras, recebimentos, DRE e estrutura contábil, sem afirmar exportação integral. 14 testes focados PASS; tipos/build PASS antes do ajuste final de cancelamento da consulta de plano, que será verificado pelo CI. ADR-0041 e docs/V35_REMAINING_WORK.md registram escopo, limitações e sequência restante. Próximos PRs de baixo impacto DEV autorizados com CI aprovado; sem produção/secrets/migrations/financeiro real.

## Cliente 360 com navegação contextual — 01/11/2026

- Base: main `99b057d4` (PR #18 integrado com autorização do proprietário; CI #403 PASS, Cloudflare DEV versão `819dbdeb` Ready/100% confirmada). A pendência de merge/publicação registrada abaixo para #18 está encerrada; não repetir homologações.
- Incremento: Cliente 360 abre cobranças e chamados para a Loja cujo resumo foi validado. MasterConsole preserva o contexto e MasterBilling aceita seleção inicial somente entre as Lojas disponíveis. Navegação geral de Cobrança SaaS limpa o contexto anterior. Resumo e ações ficam ocultos sem seleção válida ou em falha de autorização.
- Referência funcional: inventário V35 SHARED-A040 (Cobranças) e SHARED-A043 (Suporte). Implementação reutiliza os módulos existentes; não afirma paridade integral das demais abas do protótipo.
- Testes locais: 38 cenários nos três componentes afetados PASS (36 na execução conjunta, depois 17 no MasterConsole com duas integrações novas); typecheck PASS antes dos dois últimos testes adicionados. CI do PR verificará o conjunto final, tipos e build. Nenhuma escrita remota financeira, migration, alteração de secrets/PROD ou deploy manual.
- Próxima ação: conferir CI do PR e revisar integração/publicação exclusivamente DEV. Aceite visual real do incremento ainda NÃO AVALIADO; mocks não comprovam RLS/HTTP. Arquitetura e contratos do servidor preservados.

## Retomada DEV e atenção operacional Master — 01/11/2026

- Base conferida: `bf4a459736478b2f9b68440948e58c5fe2e867bb` (PRs #15–#17 integrados). Cloudflare DEV já publicou essa revisão: versão `6af131a5`, estado Ready, tráfego 100%, origem Build/main. NÃO executar novo deploy para resolver a pendência antiga.
- Identidade verificada no painel: Settings > Geral > Nome = `corsys-tronco-digital-dev`; URL do painel e Visit também usam esse nome, igual a `wrangler.dev.jsonc`. Apenas o breadcrumb mostra `corsys-digital-trunk-dev`, acompanhado de outros textos traduzidos. Tradução automática é a explicação inferida; não há evidência de renomeação. Nenhum Worker excluído, renomeado ou reconfigurado.
- Integração existente: repositório MichaelDeCarvalho/Corsys.TroncoDigital, branch main, builds habilitados, raiz `/`, build `npm ci --ignore-scripts && npm run check`, deploy `npx wrangler deploy --config wrangler.dev.jsonc`. CI Foundation checks valida o bundle com dry-run; publicação real é realizada pela integração Cloudflare. Secrets/variáveis não alterados.
- Incremento: área “Ações que exigem atenção” no Master com contagens reais de assinaturas em atraso, chamados abertos e rascunhos. Acesso aos clientes em atraso limpa busca/plano e reinicia paginação com filtro no servidor. Atalhos de suporte global e catálogo; estado vazio limitado aos três indicadores. Não representa tolerância, jobs, webhooks ou sessões do protótipo como dados verificados.
- Validação local: 15 testes de MasterConsole PASS, incluindo três novos cenários (filtro contextual limpo, vazio e negação). Typecheck e build locais PASS (aviso de bundle maior que 500 kB); CI Foundation checks #402/run 41360855410 PASS no código 1fe4791 (PR #18 draft). Esta atualização posterior altera somente o registro de evidência. Sem migrations, operações financeiras ou produção; homologações anteriores não repetidas.
- Continuidade: próxima lacuna exige inventário pontual contra código atual; tabela histórica V35_COVERAGE contém estados antigos e não deve determinar retrabalho. Aceite visual do novo painel e merge/publicação deste incremento permanecem pendentes até evidência correspondente.

## Configurações da Loja (Assinatura, Governança, Suporte, Privacidade) e Contraste DRE — 01/11/2026

- **Branch de trabalho pretendida:** `feat/v35-tenant-settings-overview` (ambiente sem git remoto direto no workspace, código mantido no workspace para exportação).
- **Assinatura e Plano SaaS (`Configuracoes.tsx`):** consulta funcional a `saas_subscriptions`, `saas_plans` e `saas_plan_versions` filtrada por `organization_id` estrito. Preço histórico exibido a partir de `saas_plan_versions.price` contratado (sem inventar preço atual). Apresenta versão, vigência contratual (`valid_from` / `valid_to`), período/competência atual, âncora de faturamento e badges de situação (`active`, `trialing`, `past_due`, `suspended`, etc.).
- **Governança e Auditoria (`Configuracoes.tsx`):** consulta funcional a `audit_logs` da Loja com data/hora, ação traduzida, identificação do responsável (com resolução de nome via `user_profiles` quando disponível) e justificativa/motivo. Contexto técnico e dados sensíveis (`technical_context`, `before_data`, `after_data`) estritamente omitidos da UI.
- **Suporte e Privacidade (`Configuracoes.tsx`):** integração com central de chamados via `onNavigate('support')`; preservação total de `TenantIdentity.tsx`; painel de privacidade e LGPD mantendo funções não disponíveis devidamente informadas como em homologação na plataforma Master, sem simulação local de exportação, exclusão ou backup.
- **Tratamento de estados:** carregamento real, vazio, permissão negada (`42501`/`28000` para `settings.manage` e `audit.read`) e isolamento fail-closed por `organization_id`.
- **Correção de contraste na DRE (`DreConfig.tsx`):** corrigido o contraste de textos em avisos com fundo amarelo claro (`#fffbeb`, `#fef9c3`, `#fef3c7`) e fundo claro/branco (`#f8fafc`), aplicando cores escuras de alto contraste (`#78350f`, `#92400e`, `#14532d`, `#0f172a`, `#334155`), preservando o tema escuro CorSys e sem alterar cálculos ou regras de negócio.
- **Evidências:**
  - `src/components/Configuracoes.test.tsx`: 10/10 PASS.
  - `src/components/DreConfig.test.tsx`: 11/11 PASS.
  - `npm run typecheck`: 0 erros.
  - `compile_applet`: Build succeeded.
- **Salvaguardas:** nenhuma migration executada, sem deploy Cloudflare/PROD, sem push direto na `main`.

## Integração V35 RBAC + DRE — 01/11/2026

- Branch consolidada: `integration/v35-rbac-dre-20261101` sobre `main` (commit Gemini `70e50d83`). Incorpora somente correções funcionais dos PRs #11 (RBAC) e #12 (DRE), migração RBAC versionada realmente instalada em DEV (`20261101181945`), ADR-0040 e histórico técnico das duas frentes.
- Migração anterior `20261101000000_tenant_rbac_management.sql` removida da branch consolidada para evitar reexecução da mesma alteração sob versão divergente. Banco DEV **não foi alterado** nesta integração.
- Evidências preexistentes reaproveitadas: RBAC HTTP positivo + auditoria e limpeza de fixture PASS; DRE unitário corrigido CI #388 PASS. CI do conjunto integrado será checado **uma vez**, sem refazer homologações de outros módulos.
- Nenhuma alteração na `main`, nenhum deploy Cloudflare/PROD e nenhuma migration PROD nesta etapa. Revisão de merge e aceite visual da DRE no DEV ainda pendentes.

## Aceite HTTP real RBAC e encerramento da fixture QA — 01/11/2026

- **Aceite humano na UI Cloudflare DEV:** usuário autenticado do tenant `CORSYS DEV TENANT A` atribuiu e revogou `TREASURER` à fixture `QA RBAC HTTP - TEMPORARIO` (`ebaca665-53db-40a9-96ae-ccff83439705`), preservando o administrador existente. Evidência de logs Supabase `edge_logs`, 1 `POST /rest/v1/rpc/assign_tenant_user_role` HTTP `200` e 1 `POST /rest/v1/rpc/revoke_tenant_user_role` HTTP `200`, JWT `authenticated`. As sete consultas de RBAC `GET` tinham `200` no aceite visual anterior.
- **Auditoria e idempotência de produção de código no DEV:** exatamente 1 `audit_logs.user_role.assign` para `TREASURER` (2026-11-01 19:08:40 UTC) e 1 `audit_logs.user_role.revoke` para `TREASURER` (19:09:00 UTC), mesmo ator ADMIN da Loja e justificativa `Teste funcional DEV RBAC`; 2 registros `idempotency_keys` `completed` correspondentes. Ao final do fluxo a fixture tinha somente `VIEWER`, sem vínculo em `member_user_links`.
- **Limpeza transacional autorizada:** confirmadas conta sem senha, sem identities/sessions, sem vínculo em outras Lojas ou auditorias como ator, e 1 ADMIN preservado. Removidos somente `user_roles`, `user_profiles` e `auth.users` da fixture via transação e verificações antes de `COMMIT`. Read-back separado: **0** usuários/perfis/papéis QA remanescentes, **1 ADMIN**, **0 TREASURER**, **2 eventos de auditoria** e **2 registros de idempotência** preservados; migração RBAC DEV `20261101181945` intacta.
- **Resultado:** **PASS** para renderização/leitura HTTP, emissão HTTP real de assign e revoke, persistência/auditoria/idempotência e limpeza. Negativas HTTP com sessões de não-admin/tenant estrangeiro não foram executadas; a segurança dessas negativas tem evidência SQL com claims simuladas, não equivalentes ao HTTP real. Não anunciar homologação integral de concorrência real.
- **Estado de entrega:** PR #11 segue draft, sem merge; nenhuma publicação em Cloudflare nem alteração em Supabase PROD. Próximo passo: revisão de integração do PR #11 e avanço para primeira lacuna funcional comprovada de V35, preferindo um lote curto no Gemini e evitando reabrir RBAC sem defeito novo.

## Deploy DEV tenant RBAC — 01/11/2026

- **Autorização operacional:** confirmação do proprietário para aplicar a migração exclusivamente no DEV. Supabase DEV projeto `szqkdekwhzxsoxorgvaz` ACTIVE_HEALTHY; migration original ainda não aplicada antes da execução.
- **Implantação:** `mcp__Supabase__apply_migration` retornou `success:true`; versão no banco `20261101181945`, name `tenant_rbac_management`. Para manter histórico determinístico, arquivo versionado renomeado a `supabase/migrations/20261101181945_tenant_rbac_management.sql`, removendo o nome antigo `20261101000000_tenant_rbac_management.sql` somente da branch `feat/v35-tenant-rbac`. `main` não alterada nesta sessão.
- **Evidências:** 2 RPCs instaladas, 1 RLS `user_profiles_select_org`, `anon` sem EXECUTE, `authenticated` com EXECUTE sujeito a `users.manage` interno. Nenhuma organização/perfil/vínculo existente alterado (6 organizações, 6 atribuições); 0 auditorias RBAC persistentes. Smoke SQL após instalação, com usuário delegado e outro usuário fictício, passou: não-ADMIN com `users.manage` não pode conceder ou revogar ADMIN (`42501`); pode atribuir TREASURER; replay retorna mesma referência e produz 1 auditoria na transação. ROLLBACK e read-back confirmaram zero usuários/papéis fictícios e zero auditorias persistentes.
- **Corretivo de privilégio:** a migração pré-deploy foi reforçada: conceder/revogar ADMIN exige também ser ADMIN da mesma Loja; elimina elevação indireta por administradores delegados (`users.manage`). ADR-0040. CI #378 PASS para revisão que incorporou o guard; mudanças posteriores são documentação e alinhamento de versão.
- **Limites:** SQL usou claims simuladas, não HTTP de sessões reais. Nem deploy Cloudflare nem merge PR #11, nem produção, ocorreram. UI React do RBAC permanece pendente de homologação browser com atores reais.
- **Próxima etapa:** conferir CI do head do PR #11 e fazer aceite de UI/HTTP no DEV com sessões autorizadas, sem realizar mudanças comerciais e antes de qualquer liberação à produção.

## Gate RBAC SQL transacional DEV — 01/11/2026

- **CI #376 PASS**, jobs frontend/static concluídos com sucesso na revisão `5588c342`. Testes e build passaram no CI; os 8 testes do Gemini são unitários/mocks.
- **Teste SQL DEV em transação reversível, claims de autenticação simuladas e atores/organizações fictícios:** as RPCs da migração foram instaladas somente dentro de `BEGIN … ROLLBACK`. Validaram-se negativas sem `users.manage` e entre tenants (`42501`), bloqueio do último ADMIN (`55000`), atribuição e revogação, replay com chave idêntica sem duplicar auditoria, divergência de payload (`22023`), recusa de autoelevação para ADMIN e sucessão com administrador remanescente. A sequência chegou até a asserção de contagem após revogar o ator original; essa contagem inicial não era observável sob sua RLS. Com consulta sob a identidade do administrador sobrevivente, o cenário de sucessão foi validado.
- **RLS de `user_profiles`** verificada em transação adicional, com claims do ADMIN aplicadas antes da instrução de leitura. Dois perfis fictícios da Loja A visíveis; perfil da Loja B oculto. PASS (SQL simulado, não HTTP). Não se ampliaram grants.
- Primeiras tentativas esbarraram apenas em **fixtures incorretas**: coluna inexistente `organizations.slug` e ausência de `saas_tenant_accounts`; a última observação dependia de permissões do ator revogado. Essas execuções falharam e reverteram; não devem ser descritas como PASS integral.
- **Read-back pós-ROLLBACK:** RPCs de atribuição/revogação não persistidas; política `user_profiles_select_org` não persistida; zero organizações, usuários ou auditorias de QA; migration `20261101000000` não aplicada. Nenhuma produção modificada.
- **Status:** gate SQL de autorização/isolation/idempotência selecionado PASS nos cenários acima; concorrência sob sessões HTTP independentes e publicação DEV ainda **NOT EVALUATED**. Próxima ação exige aprovação operacional específica para **aplicar exclusivamente a migration DEV**; depois validar leitura/UI HTTP real com usuários de teste autorizados. Não publicar produção/Cloudflare automaticamente.

## Correções de segurança RBAC pré-deploy — 01/11/2026

- Gemini produziu seis arquivos de RBAC, testou 8/8 mocks e compilou localmente; GitHub recebeu o commit `36cac365` **na main**, contrário ao relatório de não publicação. A branch `feat/v35-tenant-rbac` foi sincronizada com esse commit; alterações seguintes ocorreram somente nela.
- **P0 corrigido em migration da branch:** coluna real `public.audit_logs.entity_id` é `uuid`, mas SQL original enviava `p_user_id::text`; `EXPLAIN` no Supabase DEV confirmou erro `42804`. Agora registra UUID corretamente. Contagem de administradores era executada antes de adquirir lock da Loja; migração agora adquire `FOR UPDATE` na organização antes de ler atribuições e validar o último ADMIN, prevenindo revogações concorrentes.
- **P1 corrigido no cliente:** `loadTenantRbac` passou a falhar em consultas RLS de `member_user_links`, `members` e `user_profiles`, em vez de exibir listagens parciais como completas.
- A migração `20261101000000_tenant_rbac_management.sql` **NÃO foi aplicada no Supabase DEV nem PROD**; não executar até o gate de revisão CI e teste SQL/RLS com rollback. A validação acima é inspeção do schema e `EXPLAIN`, não execução da nova função.
- Os oito testes mock do Gemini não provam autorização real de `users.manage`, último administrador sob concorrência, isolamento cross-tenant ou auditoria HTTP. Fazer esses gates de forma proporcional antes de deploy; não gastar tokens do Gemini revalidando telas e módulos que não foram alterados.
- Proteger `main`: evitar sincronização automática do AI Studio para a branch padrão. Feature branch é a fonte desta correção; nenhuma nova mudança direta na `main` foi feita por esta revisão.

## Revisão DRE pós-Gemini — 01/11/2026

- **Origem:** Gemini relatou entrega local sem push, mas os arquivos de `DreConfig.tsx`, `DreConfig.test.tsx`, `Workspace.tsx` e HANDOFF foram publicados diretamente na `main` pelo commit `70e50d83`. Essa evidência prevalece sobre o relatório. Não duplicar exportação nem repetir toda a suíte Gemini.
- **Branch corretiva:** `feat/v35-dre-config`, PR #12 draft, criada a partir do commit do Gemini. Pequenas correções em `DreConfig.tsx`: falhar fechado em erro de leitura do regime em `organization_settings`; não identificar plano publicado fora da vigência como vigente; não declarar cobertura 100% sem plano ou catálogos ativos; considerar apenas mapeamentos a contas analíticas ativas; somente comparar resultados de competências realmente consecutivas.
- **Testes novos:** três regressões focadas para plano expirado, ausência de plano e acesso negado à configuração. Os 8 testes informados pelo Gemini ainda precisam de evidência CI desta branch; PR #12 disparará as verificações. Nenhum dado financeiro, migration, deploy Cloudflare, PROD ou banco foi alterado nesta revisão.
- **Limite funcional:** o novo componente exibe totais de receita, custos/despesas agregados e resultado usando `summarizeDre`; **não** comprova separação de Receita Bruta, Deduções, Receita Líquida, Custos e Despesas Operacionais relatada pelo Gemini. Não derivar rubricas usando heurística. Aceite browser/HTTP DEV pendente, sem retrabalho de RBAC.
- **Dependência:** PR #11 de RBAC foi criado antes do commit Gemini da DRE, está 1 commit atrás da `main`; revisar diff e reconciliar ordem de integração. Ambos PRs draft, sem merge nesta sessão.

## Configurações da DRE (`src/components/DreConfig.tsx`) — 01/11/2026

- Concluída a implementação de Configurações da DRE (`view-config-dre`):
  - **Plano Contábil Vigente**:
    - Consulta determinística do plano em vigor a partir de `loadAccountingCatalog` (`accounting_plans`), identificando planos com status `published` e vigência correspondente ao período atual.
    - Exibição de nome do plano, status (`Publicado (Vigente)` ou `Rascunho`), intervalo de vigência formatado (`DD/MM/AAAA`) e identificador.
  - **Diagnóstico de Cobertura Contábil e Pendências Reais**:
    - Cruzamento automático entre categorias financeiras ativas (`financial_categories`) e mapeamentos do plano (`financial_category_account_mappings`).
    - Cruzamento entre contas financeiras ativas (`financial_accounts`) e mapeamentos patrimoniais (`financial_account_accounting_mappings`).
    - Exibição de percentuais e contadores de cobertura, com listagem explícita das pendências reais (categorias e contas sem vínculo contábil).
    - Exibição de cobertura 100% quando todas as entidades ativas estão associadas a contas analíticas.
  - **Resumo da DRE e Comparativo por Competência**:
    - Consulta consolidada de lançamentos reais via `loadDreReport` (`read_tenant_dre`) e agregação mensal via `summarizeDre`.
    - Apresentação de cartões de KPI consolidados (Total de Receitas, Custos/Despesas e Resultado do Período).
    - Tabela comparativa por competência com valores de receitas, custos/despesas, resultado líquido, indicador de situação (Superávit/Déficit/Equilíbrio) e variação versus mês anterior calculada estritamente com dados históricos.
  - **Regime Contábil**:
    - Consulta a `organization_settings` (`report_texts`). Exibe o regime contábil unicamente quando houver valor previamente persistido no banco; sem inventar dados quando inexistente (informando que a apuração contábil na DRE opera por competência).
  - **Acesso e Navegação**:
    - Atalhos diretos para "Plano de Contas" (`onNavigate('structure')`) e "DRE Detalhada" (`onNavigate('dre')`).
    - Tratamento explícito de permissões negadas (`42501` / `28000`) para `finance.read` e `reports.read`, erros de escopo (`23503`) e botão para recarregar dados.
  - **Testes e Validação**:
    - Criado `src/components/DreConfig.test.tsx` com 8 testes unitários/integrados cobrindo plano vigente, cobertura total, identificação de pendências reais, regime persistido vs ausente, comparativo da DRE, navegação e tratamento de erro de permissão (8/8 PASS).
    - Suíte de DRE (`DreConfig.test.tsx`, `DreReport.test.tsx`, `DreView.test.tsx`): 14/14 PASS.
    - Tipagem TypeScript (`npm run typecheck`) e compilação do applet (`compile_applet`): 0 erros, build aprovado.
- Nenhuma migration aplicada, sem alterações no faturamento, RBAC, Cloudflare ou banco de produção.

## Cadastros — Perfis e Permissões (Tenant RBAC) — 01/11/2026

- Concluída a implementação de Cadastros → Perfis e Permissões (`view-cadastros`):
  - **Migration Incremental `supabase/migrations/20261101000000_tenant_rbac_management.sql`**:
    - Política RLS `user_profiles_select_org`: Permite consulta de perfis por gestores com a permissão `users.manage` no mesmo tenant.
    - RPC `assign_tenant_user_role(uuid, uuid, uuid, text, text)`: Exige permissão `users.manage`, valida vínculo do usuário ao tenant, bloqueia autoelevação para o papel `ADMIN`, registra auditoria em `audit_logs` e executa sob idempotência (`private.idempotency_begin`/`complete`).
    - RPC `revoke_tenant_user_role(uuid, uuid, uuid, text, text)`: Exige permissão `users.manage`, protege contra a remoção do **último administrador** da Loja (`55000`), registra auditoria e executa sob idempotência.
    - **Atenção**: Migration **NÃO foi aplicada no Supabase DEV** conforme diretriz de restrição de execução remota.
  - **Biblioteca Cliente `src/lib/tenant-rbac.ts`**:
    - Tipagem completa (`RoleSummary`, `TenantUserSummary`, `TenantRbacData`) e funções `loadTenantRbac`, `assignTenantUserRole` e `revokeTenantUserRole`.
  - **Componente de Interface `src/components/Cadastros.tsx`**:
    - Visualização dos 4 perfis de sistema (`ADMIN`, `TREASURER`, `VIEWER`, `MEMBER`) com suas respectivas permissões e número de usuários atribuídos.
    - Tabela de usuários vinculados à Loja com seus papéis atuais e seletores para atribuição/revogação de perfil.
    - Modal de confirmação com exigência de justificativa auditada (mínimo 3 caracteres), tratamento amigável de erros (remoção de último admin, falta de permissão, autoelevação) e recarregamento reativo e imediato da interface.
  - **Suíte de Testes Automatizados**:
    - `src/lib/tenant-rbac.test.ts` (4/4 testes PASS).
    - `src/components/Cadastros.test.tsx` (4/4 testes PASS).
    - Verificação de tipos `npm run typecheck` e compilação do applet `compile_applet`: 0 erros, build aprovado.
- Branch de destino: `feat/v35-tenant-rbac`. Alterações preservadas no workspace para exportação. Nenhuma mudança publicada em produção, Cloudflare ou `main`.

## Gate Final HTTP da Cobrança SaaS Master (HTTP QA Verification) — 01/11/2026

- Mecanismo automatizado e reutilizável de QA HTTP real refatorado e corrigido em `src/lib/dev-qa-manual-invoice.ts`:
  - **Consulta Estrita de Auditoria**: Validação em `saas_master_audit_logs` utilizando os campos reais `resource_id`, `action` (`invoice.manual_issue`) e `metadata`. A ausência de registro válido de auditoria provoca reprovação estrita do teste (`throw Error`).
  - **Concorrência Real de Requisições HTTP**: Execução simultânea real via `Promise.all`:
    - Mesma chave e mesmo payload: deduplicação unívoca retornando o mesmo UUID (`assertQAUUID`).
    - Chaves diferentes para mesma competência: emissão da primeira fatura e bloqueio da segunda com `SQLSTATE 55000`.
  - **Autenticação Negativa Real/Preparada**: Validação de negação para chamadas anônimas, usuários de Loja (não-Master), e operadores Master AAL1 sem elevação de privilégios.
  - **Controle de Segurança Multi-Fator (`CONTROLLED_FINANCIAL_TEST`)**:
    - Desabilitado por padrão (`PREFLIGHT` read-only).
    - Validação de URL de projeto DEV esperada (`https://szqkdekwhzxsoxorgvaz.supabase.co`).
    - Allowlist explícita de organizações de QA (`94b84958-4dd9-435d-9a4e-244220835d70`, `7a6aa771-524d-4d5a-9d38-7006175e1cb4`) e competências de QA (`2026-11-01`, `2026-12-01`, `2027-01-01`).
    - Exigência dupla de confirmação operacional: `enableRealFinancialMutation: true` E `operationalAuthConfirmation: true`.
    - Checagem prévia de histórico em `v_saas_invoice_balances` para bloquear execuções com faturas ativas preexistentes.
  - **Injeção Controlada de Transporte HTTP**: Substituição do patch global de `globalThis.fetch` por transporte injetado customizado (`customFetch`), eliminando qualquer colateral ou interferência em módulos externos.
  - **RLS e Preflight**: Execução de `PREFLIGHT` sob isolamento rigoroso de RLS do cliente sem privilégios indevidos.
- Suíte de Testes Automatizados:
  - `src/lib/dev-qa-manual-invoice.test.ts` expandido para 8 testes unitários/integrados focados.
  - Suíte total do módulo de faturamento manual: 20/20 testes aprovados (`MasterBilling.test.tsx` + `dev-qa-manual-invoice.test.ts`).
  - Verificação de tipos `npm run typecheck` e compilação do applet `compile_applet`: 0 erros, build aprovado.
- Branch de trabalho: `fix/v35-manual-invoice-safety-20261029`. Push direto para a `main` desativado.

## Cobrança SaaS Master — Emissão manual de faturas — 29/10/2026

- Correção pontual de segurança e consolidação concluída:
  - Migration incremental `supabase/migrations/20261029030000_v35_master_manual_invoice.sql`:
    - Versionada sequencialmente após a migração P1 do DEV (`20261029021140_v35_master_readonly_support_sessions`), removida a versão antiga `20261029000001`.
    - Sequence `public.saas_invoice_seq` para numeração sequencial determinística e unívoca de faturas.
    - RPC `preview_saas_manual_invoice(uuid, date, date)`: exige `MASTER` + `AAL2` (`private.require_platform_staff`), validação de Loja existente, competência no dia 1 (`extract(day from competence) = 1`), busca da assinatura ativa em `saas_subscriptions` (rejeitando assinaturas em `trialing` sob `55000`) e derivação contratual de preço estritamente a partir de `saas_subscription_price_terms`. **Removido qualquer fallback para versões de plano ou plano base**: exige termo unívoco cobrindo todo o mês sem lacunas ou sobreposições (`55000`). Detecta fatura já emitida para o mês (`already_billed`). Retorna estrutura completa de itens e datas de prestação de serviço.
    - RPC `issue_saas_manual_invoice(uuid, date, date, text, text)`: exige `MASTER` + `AAL2`. Bloqueia competência já faturada (`55000`) e assinaturas em `trialing` (`55000`). Idempotência garantida via `private.idempotency_begin`/`complete` com hash de payload **incluindo a descrição normalizada da fatura** (rejeita reuso divergente com `22023`). Lock transacional na Loja (`for update`) antes da leitura do contrato para prevenir concorrência. Geração de número sequencial `CORSYS-YYYYMM-XXXXX`. Inserção atômica de `saas_invoices`, `saas_invoice_items` e auditoria em `saas_master_audit_logs`.
    - Revogação de acesso de `public` e concessão restrita a `authenticated`.
  - Biblioteca cliente `src/lib/master-billing.ts`:
    - Funções `previewMasterManualInvoice`, `issueMasterManualInvoice`, `buildManualInvoiceIdempotencyKey` e tipagens `MasterManualInvoicePreview`, `MasterManualInvoiceInput`, `MasterManualInvoiceLineItem`. Validações fail-closed de parâmetros e UUIDs.
  - Interface do usuário `src/components/MasterBilling.tsx`:
    - Invalidação automática e imediata da prévia diante de qualquer alteração de Loja, competência, vencimento ou descrição.
    - Proteção contra respostas assíncronas desatualizadas/concorrentes via `AbortController` e controle transacional de requisição.
    - Preservação da chave de idempotência em falhas de rede com resultado incerto para permitir retentativa segura sem duplicar faturas.
    - Bloqueio fail-closed do botão de confirmação quando a competência já possuir fatura ativa.
  - Testes automatizados:
    - Script dry-run `supabase/tests/test_master_manual_invoice_rollback.sql` corrigido com schema real (`auth.users`, campos e constraints obrigatórias de `saas_plan_versions`, teste de termo ausente, termo parcial, termos conflitantes, trialing, replay, divergência de descrição e negativas MASTER/AAL2).
    - `src/components/MasterBilling.test.tsx` (12 testes passando: modelo de leitura, visualização de prévia contratual, invalidação de prévia na alteração de parâmetros, preservação de chave de idempotência em retentativa pós-erro de rede, bloqueio de duplicidade, tratamento de erro de RPC e testes unitários das funções cliente).
  - Governança e documentação:
    - ADR-0039 (`docs/adr/0039-master-manual-saas-invoice.md`) atualizado.
    - `CURRENT_ARCHITECTURE.md` atualizado.
- Branch de trabalho: `fix/v35-manual-invoice-safety-20261029`. Base: `51120a7845e6e992565a0c4621d4f989c093f298`.
- Estado: Implementado no código e testes locais. Migração SQL remota NÃO aplicada ao Supabase DEV `szqkdekwhzxsoxorgvaz`; ambiente de produção e Cloudflare DEV preservados. Nenhuma alteração enviada diretamente para a `main`.

## Mecanismo de logging de erros e monitoramento de exceções no App.tsx — 29/10/2026

- Criado serviço de monitoramento simples e seguro em `src/lib/error-monitor.ts`:
  - Captura estruturada de falhas de renderização (`render_error`), eventos de autenticação (`auth_event`), erros de acesso/sessão (`auth_error`) e erros de configuração (`config_error`).
  - Higienização estrita de dados (`sanitizeContext`): mascaramento fail-closed de chaves sensíveis (`password`, `token`, `secret`, `jwt`, `credential`, `otp`, `cookie`) e redação de strings no formato JWT, impedindo vazamento de credenciais em logs ou console.
  - Comportamento fail-safe com pub/sub para integração sem lançar exceções secundárias.
- Implementado `ErrorBoundary` em `src/App.tsx`:
  - Captura falhas de renderização em qualquer ponto da árvore React (`ConnectedApp`, `Workspace`, `Login`, etc.).
  - Registra a exceção no `errorMonitor` com component stack e categoria `render_error`.
  - Exibe interface de contingência amigável ao usuário (`session-screen`), sem expor stack traces ou dados sensíveis (Clean UI), com opção de reinício ("Tentar novamente").
- Instrumentado ciclo de autenticação em `src/App.tsx`:
  - Captura transições de estado da autenticação (`session_authenticated`, `session_anonymous`, `auth_error`).
  - Registra tentativas de reautenticação (`auth_retry_requested`) e finalização de recuperação de senha (`recovery_finished`).
  - Monitoramento de falhas de inicialização do cliente Supabase (`config_error`).
- Testes automatizados:
  - `src/lib/error-monitor.test.ts` (8 testes unitários de sanitização, captura e tolerância a falhas).
  - `src/App.test.tsx` (5 novos testes para `ErrorBoundary`, reset da UI, e captura de eventos/erros de autenticação; total de 23 testes no arquivo).
  - Execução validada: 412 testes passando sem regressão, typecheck e build aprovados.

## P1 Master — migration DEV aplicada; frontend DEV aguardando publicação — 29/10/2026

- **Fonte do P1:** `main`, commit `ef93a664290aa96a23cba95213d0244a09c155c1` (PR #8 integrado; lock transacional por Loja para início de sessões). Commits posteriores devem ser preservados; não reverter evoluções independentes.
- **Supabase DEV:** `szqkdekwhzxsoxorgvaz`; migration `20261029021140_v35_master_readonly_support_sessions` aplicada. RPCs `start_master_support_session`, `get_active_master_support_session`, `end_master_support_session` disponíveis; controles MASTER/AAL2, vínculo ao operador/Loja, duração de 15 minutos, `read_only`, replay e auditoria verificados.
- **Gate SQL P1:** PASS em DEV com transação `ROLLBACK` para abertura, consulta, encerramento, idempotência, reenvio sem renovação de expiração, rejeição de sobreposição, payload divergente e encerramento por operador diferente; negativas para usuário de Loja. Nenhum registro de QA persistido. **NÃO TESTADOS neste P1:** chamadas HTTP reais entre conexões independentes e ciclo completo na UI Master com MFA real. P0 de chamados/MFA A/B já homologado anteriormente e NÃO deve ser repetido.
- **Cloudflare DEV:** Worker `corsys-tronco-digital-dev`; último deploy visto pelo operador era `3d269771`, anterior ao P1. O operador corrigiu Workers Builds de `feat/v35-dev-gate-20261002` para `main` e exibiu configuração de build `npm ci --ignore-scripts && npm run check`, deploy `npx wrangler deploy --config wrangler.dev.jsonc`, com token de build já configurado e Supabase DEV como destino. **Deploy novo ainda não observado/confirmado**; o push deste registro é autorizado para permitir o build automático no Cloudflare DEV, se a integração estiver ativa.
- **Próxima ação única:** conferir o build/deploy da `main` no Cloudflare DEV; se atualizado, homologar somente o módulo de sessões P1 com JWT/AAL2 real. Não executar SQL novamente, não refazer P0, não usar máquina local, não alterar PROD.

## Sessões temporárias Master somente leitura (P1 preparado) — 28/10/2026


P0 de suporte homologado e concluído no DEV (`docs/V35_P0_SUPPORT_20261028.md`).
Incremento P1 preparado sem execução remota:
- Migration `20261029000000_v35_master_readonly_support_sessions.sql`: RPCs `start_master_support_session`, `get_active_master_support_session` e `end_master_support_session`.
- Invariantes: `MASTER` + `AAL2` obrigatório, vínculo estrito a `auth.uid()` e Loja (`organization_id`), motivo obrigatório (5..500 chars), escopo `read_only`, prazo de 15 minutos fixo no servidor, replay sem duplicidade/renovação de expirada, negação de sessão ativa concorrente, término idempotente e auditoria em `saas_master_audit_logs`.
- Biblioteca cliente `src/lib/master-support-sessions.ts` com tipagem e validação fail-closed.
- Integração na UI em `src/components/MasterOperations.tsx` (aba Suporte) com seleção de Loja, justificativa auditada, visualização de sessão ativa com contador regressivo e botão de encerramento.
- Script de teste com rollback transacional `supabase/tests/test_master_support_sessions_rollback.sql`.
- Testes unitários focados em `src/components/MasterSupportSessions.test.tsx` e preservação dos testes de `MasterOperations.test.tsx`.
- ADR-0038 registrado.
- Estado: P1 preparado localmente; migration SQL remota NÃO aplicada; homologação HTTP/UI DEV pendente. Não executar merge, deploy PROD ou push sem autorização.

## P0 suporte funcional concluído no DEV — 28/10/2026

PASS frontend, MFA Master real/UI/HTTP, Loja A UI/HTTP, replay/concorrência/22023 e segregação B UI/HTTP. B HTTP403/42501,409/23503,403/42501; leituras A ocultas e nenhuma escrita indevida. #11/#12/#13 closed, baseline três abertos restaurado; histórico imutável preservado. Timeout forçado NÃO TESTADO; concorrência sem timeout. Sem migration/PROD/merge. Não repetir suíte aprovada. Evidência consolidada docs/V35_P0_SUPPORT_20261028.md. Próximo: revisão da branch para integração; V35 geral permanece aberta.

## P0 Master homologado — 28/10/2026

Atualização: Loja A UI abertura/resposta e HTTP criação/resposta concorrência/replay/22023 PASS sem duplicação. Sessão A preexistente no navegador interno aproveitada. Chamados fictícios #11/#12/#13 fechados por Master, baseline três abertos restaurado. B ainda NÃO TESTADA; próxima entrada jobmcc@hotmail.com na mesma aba interna, mantendo sessionStorage com ID A 81caf24e-2891-4cd4-a112-7201b50cbce4. Master Edge preservado. Branch remota autorizada pelo usuário; não repetir A/Master.

MFA real aal2, acesso Master, resposta UI e HTTP concorrência/replay/22023 PASS. Fixture Master #11 encerrada pelo fluxo normal, histórico preservado (DELETE bloqueado por imutabilidade); baseline três abertos restaurado. Deploy DEV 3d269771. A/B ainda pendentes por sessão; página /support-qa.html preparada e guardada ao DEV. Não repetir Master. Relatório docs/V35_P0_SUPPORT_20261028.md. Sessão Master Edge preservada; nova sessão separada aguardando login A.

## P0 suporte / MFA — 28/10/2026

Branch fix/v35-mfa-challenge-dev-20261028 sobre 99dfd64d. MfaGate, integração App e testes adicionados; 30 testes/tipos/build PASS. Deploy somente DEV autorizado pelo usuário. Sem banco/PROD. Próximo: usuário confirma código TOTP no navegador, depois homologar chamados A/B e Master/idempotência HTTP. Não repetir migration/suítes já aprovadas. Evidências externas outputs/V35_P0_HOMOLOGACAO_20261028.md; ADR-0037.

## Continuidade de sessão e mútuas — 21/10/2026

Atualização: CI323/c6b2fd2 SUCCESS. Refresh real B PASS preservando campos/Loja; ágape UI B criado, histórico integrante/R$1,25 conferido e mobile375/scroll375 PASS, screenshot agape-B-mobile-20261021.jpg. Cobrança a4c4db6d cancelada via RPC normal DEV/open0/integrity true. Aba duplicada fechada pelo usuário; viewport restaurado. UI mútuas+helper HTTP implementados,6 testes focados e tipos/build PASS; publicar versão DEV e executar somente gate novo B. A ágapes/mútuas agrupados depois. Repasse neutro ainda lacuna real do guard de categoria, não declarar resolvido.

Ágapes HTTP B PASS19/19 (pago/gratuito), cobrança cancelada e caixa10, não repetir helper. UI B apenas prévia: revalidação desmontou a tela antes da confirmação. Regressão reproduzida; fix useAuth/Workspace preserva mesma identidade, bloqueia interações enquanto verifica, recarrega escopo sem perder Loja válida e oculta usuário/escopo inválido. App+recuperação23 PASS; publicar preview e testar refresh real com segunda aba QA, sem tokens. Backend mútuas migration66 DEV SQL A/B36 negativas rollback PASS, faixas710–721/722–745; implementar UI/HTTP. ADR-0035/0036 e docs/V35_EXECUTION_20261021.md. SessãoB Edge3/aba1875275295 autenticada; aproveitar B e agrupar A depois, conforme usuário. Não encerrar após este incremento nem repetir gates aprovados.

## Continuação — ágapes — 21/10/2026

CI321/2bd3391 SUCCESS, preview46c8d288. Histórico B com voto existente e mobile PASS somente leitura; sem novos votos/pagamentos. Ágapes implementados: migration65 DEV, SQL A/B26 negativas rollback PASS,8 testes focados UI/contrato/cleanup PASS. Publicar novo preview/CI e executar gate novo de ágapes + UI B atual, depois A. Helper execução única paga/gratuita, cancela somente cobrança fictícia e verifica caixa10; não exige mudar categorias. SessãoB Edge3/aba1875275295 autenticada na interface. Eventos/participantes0 após SQL rollback. ADR-0034 e docs/V35_EXECUTION_20261021.md. Demais gates já aprovados não repetir.

## Estado verificado — 21/10/2026

Anuidade/correção HTTP A/B PASS35/35 cada; cobertura legada11/13 A/B. Negociação HTTP A/B PASS14/14 e UI desktop/mobile A/B PASS; quatro originais+12 parcelas fictícios cancelados, flags das duas categorias restauradas false, caixa10 A/B, deadlocks2. Não repetir. Preview934d9d02; CI320/7afea27 SUCCESS. Migration64 DEV corrige lock do integrante e alinha ordem FIFO; SQL A/B30 negativas PASS, probe concorrente via conector INCONCLUSIVO. Multiaprovação SQL A/B16 negativas rollback PASS com dois atores, sem grants persistidos. Histórico de aprovações implementado e9 testes focados PASS; publicar preview/CI e verificar interface. Evidências em docs/V35_EXECUTION_20261021.md. SessãoB Edge3/aba1875275295 autenticada; preservar. Continuar ágapes/mútuas/especiais e paridade, além de HTTP específico estorno/MasterAAL2. Sem merge do PR/PROD; execução autorizada continua.

## Continuidade DEV — migrações de negociação sincronizadas — 2026-10-21

Branch PR #5: `fix/v35-http-conflicts-review-20261016`. Banco DEV `szqkdekwhzxsoxorgvaz`.
A revisão do GitHub possuía 61 migrações; o banco já tinha 63 (duas de 19/10 ainda sem arquivo na branch).
Recuperados dos statements persistidos pelo Supabase e versionados, sem reaplicar SQL:
- `20261019235201_member_debt_agreement_commands.sql`: prévia com fingerprint e comando idempotente de acordo;
- `20261019235427_member_agreement_source_date_guard.sql`: guarda a data de emissão das cobranças originais na prévia.
Comparação texto a texto com os statements do banco: ambas EXATAS (acréscimo apenas da quebra de linha final).
Read-back somente leitura: RPCs `preview_member_debt_agreement` e `create_member_debt_agreement` têm SECURITY DEFINER, search_path vazio, EXECUTE por authenticated e não por anon; quatro tabelas de acordos com RLS ligado.
Não foram executadas jornadas SQL positivas/negativas, HTTP/JWT, concorrência ou UI dessa nova funcionalidade neste incremento; não declarar acordo homologado.
Nenhuma migration reaplicada, nenhum seed, merge, alteração de tráfego ou produção.
Próximo: executar testes rollback de negociação em QA A/B, especialmente fingerprint obsoleto, competência, isolamento e idempotência; depois integrar/homologar interface.
Continua pendente a homologação anual HTTP/navegador A/B e três RPCs legadas separadas (correção institucional, estorno e Master/AAL2). Não repetir gates já homologados em 19/10.

## Execução contínua — HTTP A/B ampliado e anual implementado — 19/10/2026

HTTP legado ampliado A/B PASS69/69 cada; anual/correção B PASS35/35 e cleanup confirmado, não repetir B. Cobertura10/13 A e11/13 B. CI317/e1076df SUCCESS. Negociação/parcelamento implementados: migrations62/63 DEV, SQL A/B30 negativas rollback PASS, preservação63 PASS, suíte314 testes PASS e7 focados PASS após helper novo. UI em Financeiro → Negociar dívida; HTTP/UI real pendentes. Evidências em docs/V35_EXECUTION_20261019_CONTINUED.md. Login A solicitado; aba1875275285 Edge3 está na raiz/tela de acesso. Próximo: publicar preview novo, anual/correção A e negociação HTTP A/B. Categorias QA allow_installments continuam false; helper de negociação exige preparo temporário e restauração posterior. Master/AAL2 e estorno separados. Sem merge/PROD; continuar entre incrementos.

## Reajuste institucional UI A/B aprovado — 19/10/2026

Sessão A confirmou outubro R$1 e novembro R$2 no preview `94c5078e`, sem emissão de obrigação ou pagamento. Cleanup e readback SQL A/B: regras `9b72101b-fb78-43f0-afb4-cedf2511f429` (A) e `8d31ed2e-90a5-4964-8c26-4e2c5ebddfc8` (B) inativas, zero obrigações, uma auditoria de reajuste por regra e saldo R$10 por Loja. UI A deixa de ser pendência; não solicitar login para repetir esse gate. CI #315/run39340656215 do commit `7e11a49` SUCCESS. Nenhum código, build, migration ou deploy novo nesta rodada; apenas homologação e documentação. Próximo escopo: HTTP específico de reajuste e cobertura das 11 RPCs legadas restantes; Etapa 2 e demais requisitos seguem abertos. Sessão A preservada no Edge3/aba1875275275.

## Evidência final deste incremento — 19/10/2026

Código `df436a25018b6080d1275a95cfa666e2f179da13` enviado ao PR #5; CI #313/run39340174874 SUCCESS, 43 arquivos/304 testes PASS. Preview `94c5078e` (alias `v35-finance`), bytes remotos index/app/QA conferidos. UI de reajuste B PASS desktop/mobile (375 px sem overflow); regra `8d31ed2e-90a5-4964-8c26-4e2c5ebddfc8` inativa, zero obrigações, uma auditoria, outubro R$1/novembro R$2. Login A solicitado para o novo reajuste UI; sessão B preservada na aba1875275275, Edge3. HTTP legado de identidade/catálogo A/B já PASS, não repetir. Outras 11 RPCs continuam pendentes por HTTP. Gate SQL de identidade resolvido; reajuste SQL com 36 negativas e rollback PASS. Próxima ação: finalizar UI A do reajuste e HTTP específico, mantendo os demais requisitos da Etapa 2 abertos; nenhuma alteração em produção ou merge.

## Work — 19/10/2026: identidade resolvida, HTTP A/B parcial e reajuste

Identidade SQL rollback PASS; HTTP identidade/catálogo A/B 10calls/10requests cada, cleanup confirmado. Cobertura:2/13 RPCs legadas, outras11 ainda pendentes. CI312 do head retomado1d9249d SUCCESS. Reajuste futuro implementado, migration60/20261019230916 DEV, SQL4combinações/36negativas rollback PASS. Regressão MemberForm falhou antes/passou após correção. Ver docs/V35_EXECUTION_20261019.md para IDs, testes, riscos e estado de publicação. Não repetir mensal aprovado. Etapa2 aberta; sem merge/PROD.

## Checkpoint — 19/10/2026: CI #311 e pendência HTTP real

- CI #311, run 39330807587, commit 7f59856e0cd224c019b5cba7b79a5869bcf757cb: SUCCESS; jobs static e frontend SUCCESS (SQL grammar/preservation, frontend tests/check/build sem upload).
- Fixture catálogo A/B restringiu UPDATE user_roles por user_id + organization_id; SQL DEV com ROLLBACK: DEV_TREASURY_CATALOG_ROLLBACK_PASS.
- Fixture identidade com mesmo ajuste, mas gate SQL completo bloqueado pelo controle de segurança da ferramenta: NAO EXECUTADO, não é PASS.
- Read-back DEV: 13 RPCs alvo, 17 PT409, zero 40001 explícito, SECURITY DEFINER e search_path intactos.
- HTTP A/B autenticado, isolamento entre tenants, idempotência e contagem de requests: NAO EXECUTADO. Browser conectado indisponível; não houve aquisição/exposição de JWT. db.retry=false e CI não equivalem a trace HTTP real.
- PR #5 draft; sem merge ou deploy. Gates de identidade e HTTP real A/B devem ocorrer em ambiente autorizado com captura de status/código/retries e read-back/cleanup.

## Checkpoint 19/10/2026 — correção dos conflitos HTTP legados

- PR #5 draft, branch `fix/v35-http-conflicts-review-20261016`. CI #302 do commit 822d313: SUCCESS.
- Migration 59 `20261019205415_legacy_business_http_conflicts_pt409.sql`: aplicada apenas ao Supabase DEV e adicionada ao GitHub; 13 funções/17 conflitos. Read-back confirmou PT409, sem 40001 nas 13 RPCs, SECURITY DEFINER/search_path intactos.
- Supabase JS `db.retry=false` para evitar retry automático HTTP 409. Scripts SQL com exceções de conflito atualizados.
- Gate membro perfil SQL rollback PASS. Gate identidade não executado por bloqueio de segurança da ferramenta. Gate catálogo FAIL devido a fixture user_roles/roles FK. Ambos permanecem pendentes; não declarar QA geral aprovado.
- CI do head atual e HTTP real A/B pendentes. Nenhum merge, deploy ou alteração de produção.

## Revisão de conflitos HTTP históricos — PARCIAL — 2026-10-16

Base: PR#4/feat/v35-dev-gate-20261002 SHA944b8bc; revisão isolada PR#5
https://github.com/MichaelDeCarvalho/Corsys.TroncoDigital/pull/5
branch fix/v35-http-conflicts-review-20261016, draft, sem merge/produção.
Recorrência mensal institucional HTTP/UI A/B continua PASS e não foi repetida.
Auditoria READ-ONLY no Supabase DEV szqkdekwhzxsoxorgvaz:13 RPCs public,
17 raises explícitos40001 e0 private; todos conflitos de estado/versão.
Documentação docs/V35_HTTP_CONFLICT_AUDIT.md atualizada e11 componentes UI
passaram a reconhecer PT409 como conflito definitivo, preservando40001 legado.
Dois testes de regressão PT409 adicionados a mensalidades e Master.
Nenhuma migration/grant/RLS/seed ou escrita no banco; comportamento HTTP novo
ainda NÃO AVALIADO. CI inicial#301 iniciou para cb58e54; checar CI do commit
final do handoff antes de declarar PASS. Atenção a retries HTTP409 em supabase-js.
PRÓXIMA AÇÃO ÚNICA: verificar CI e diff PR#5, então preparar migration nova
e teste SQL rollback para os17 raises, seguido por HTTP real A/B e read-back
sem reabrir QA mensal A/B. Etapa2 e21telas continuam abertas.

## Recorrência mensal: aceite UI/HTTP A/B concluído — 2026-10-16

B RESULT PASS no preview6959e115/commitae1d4a6: quatro tabelas estrangeiras
ocultas, escopo42501/ID23503, replay simultâneo mesmoUUID, divergência22023,
disputa chaves distintas um vencedor+PT409 HTTP409, uma obrigação/auditoria por
regra/mês e reemissão após cancelamento23514 negada. Despesa/receitaJul/Ago2027.
Read-back B: saldo10, regrasQA ativas0, quatro obrigações canceladas/integrity_ok,
aberto0. IDs despesaJul75dcff52-5c58-494b-bb24-3bcd06b5a4ff;
Ago492f8b9a-39e8-4471-9f8d-35d4d967ea6e; receitaJula3993d44-5d03-4531-9563-74edfc56cf8a;
Ago453fcc91-ae03-4217-ac20-941ec8cd78b4. A já PASS; não repetir jornadas/login
para este escopo. CI298 success. Somente documentação nesta rodada, sem novo
build/deploy/migration. Próximo: revisão dos13 comandos emV35_HTTP_CONFLICT_AUDIT,
depois pendências anuais/especiais/reajustes/negociação/multiaprovação e lotes21telas.
Etapa2 permanece aberta. Usuário pediu economia de tokens/tempo: evitar releitura
extensa, testes já aprovados, sondagens repetidas e duplicar blocos em vários docs;
priorizar lote concreto com verificações proporcionais. SessãoB Edge4 aba1875274888.

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
sem40001 mensal; permissões/RLS conservadas. CI298/run38973320275 SUCCESS; anterior estado em execução;
CI296/297 success. Billing resolvido, não pedir de novo.
Auditoria read-only localizou13 funções públicas históricas ainda com40001;
revisar conflitos de negócio no próximo lote, sem concluir que todos os usos são
iguais. Lista em docs/V35_HTTP_CONFLICT_AUDIT.md. Etapa2 ainda aberta.

## Regressão concorrente mensal em correção — 2026-10-16

UI mensal A/B concluída e cleanup SQL saldo10/canceladas/regras inativas.
CI296 e297 SUCCESS: billing resolvido. Novo gate HTTP A falhou em chaves distintas:
replay mesma chave passou, um fato/auditoria por competência, mas outro pedido
timeout15s; não registrar PASS. TentativasA somente despesaNov2026–Jun2027
canceladas; sem recebimento/pagamento e saldo10. Deadlocks observados2.
Migration57/20261016215748 aplica NO KEY UPDATE na organização (3comandos);
58/20261016220039 usa PT409 para conflito de negócio, evitando retry infinito
PostgREST com40001 conforme fonte oficial. Não editar56/57 após aplicadas.
Helper cleanup agora usa chave única por execução e verifica regra inativa,
obrigação cancelada/integrity_ok/aberto0 e saldo10. Corrigido replay antigo de
cleanup que deixara regraA ativa; UI desativou e SQL confirmou inativa.
Gate final usa Jul/Ago2027, vazio preflight A/B, R$1 por operação. Próximo publicar
e executar com A atual. B depois depende login. Não repetirmeses comhistórico.
SQL rollback4positivos/56negativos PASS após58;294 testes/tipos/build PASS,
mais regressão PT409 e cleanup em25 testes focados PASS; preservação58 PASS.
Outros40001 históricos precisam auditoria antes de fechar Etapa2. ADR0030.

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

## Recorrência mensal B homologada; A pendente — 2026-10-16

Commit41f4ead0d9fcbd1aba25de051d29a0edbaecca6a enviado ao PR4.
Preview53304611-1bb5-44ee-b5dd-6d82186301f0 no alias v35-finance; sem mudar tráfego.
HTTP200 e bytes iguais: index SHA256 bc60dbc159138767802a4c059740eb46910e046ed204187c06dd11c93c9df246;
app-C2dtEIhP.js 8579ffba8fd44ff663fefd3de99906e3211fc9094862e24aab1ceaa06eb4f47a;
CSS0093a8ed83ea769e899c4d5f058f245129a9761a3c70633c091fbaf4722ce172.
UI real B: cadastro de despesa/receitaR$1, prévia, emissão, cancelamento e
regra desativada PASS; prévia bloqueia repetição inclusive após cancelamento.
Regra despesa1d792556-5a99-4454-8b7f-57cb92d346de;
obrigação abf5b027-c9e9-4f4d-8d60-c684824858e5.
Regra receita79578aa9-20c7-4ade-9b65-ee98b57f03fe;
obrigação49afaf80-2542-44fa-8794-c8f5f0e3d96c.
Read-back SQL: ambas inativas, obrigações canceladas/integrity_ok/aberto0,
nenhuma obrigação institucional aberta B e saldoR$10.
Desktop1912/client1897 sem overflow; mobile390/client375/scroll375 e prévia
visualmente legível. Viewport restaurado. Não comprova paridade das21 telas.
292 testes/tipos/build,12 gates DEV, gramática SQL e preservação PASS.
CI295/run38970341421 NÃO EXECUTOU jobs: GitHub informa pagamento pendente ou
limite de gastos atingido. Logs404 e stepsvazios confirmados; anotação lida na UI.
Não alterar billing nem declarar CI PASS. Usuário informado para regularizar.
Login A solicitado somente para NOVA recorrência; sessão B ainda no Edge4,
aba1875274888. Não repetir HTTP/UI estornos anteriores. HTTP concorrente mensal
não avaliado; SQL com claims simuladas4positivos/56negativos PASS rollback.
Etapa2/anual/especial/reajuste/negociação/multiaprovadores/21telas abertos.

## Recorrência institucional mensal em implementação — 2026-10-16

Estorno institucional fechado no escopo UI/HTTP A/B (milestone945782d).
Migration56/20261016212643 tenant_institutional_monthly_generation aplicada DEV;
arquivo criado pela CLI e timestamp alinhado ao retorno MCP. Quatro comandos:
create_tenant_institutional_monthly_rule, set_tenant_institutional_monthly_rule_status,
preview_institutional_monthly_generation, generate_institutional_monthly_obligation.
Settings.manage para regra/status, institutional.manage para preview/emissão;
SaaS gate e idempotência, prévia com fingerprint, uma obrigação por regra/mês,
sem movimentar caixa. Despesa gera pedido de aprovação quando política exige.
Não reemite após cancelamento. Gate SQL A/B:4 positivos/56 negativos PASS rollback,
claims simuladas. Frontend InstitutionalMonthly e loader criados,22 testes novos
PASS; 292 testes/tipos/build PASS. Homologação preview ainda pendente. Não declarar entregue.
SessãoB Edge4 aba1875274888 em /dev-qa, alias v35-finance atualversãoe1785942
(ainda anterior a este recurso). Próximo: completar checks/revisão/commit/upload
sem tráfego e UI B criar regras QA atéR$1, prévia/gerar/cancelar/desativar; depois A.
Não repetir seeds ou estornos/jornadas já concluídos. Reajuste/anual/especial,
multiaprovador e21 telas continuam abertos. Nenhum merge/PROD autorizado.

## Estorno institucional A/B concluído — 2026-10-16

HTTP B também RESULT PASS na versãoe1785942: RLS em4 tabelas, escopoA42501,
IDA sobB23503, pagamento/recebimento com replay simultâneo/mesmoID,
divergência22023, chaves diferentes com um vencedor/23505 e uma auditoria/fato.
Cleanup/DRE PASS. SQL final A/B: saldo10 por Loja, nenhuma obrigação aberta;
auditorias de estorno6 por Loja. UI A/B já concluída. Não pedir nova troca de
conta para este escopo. SessãoB atual Edge4 aba1875274888 em /dev-qa.
PayableB cd09e741-b9d0-4af8-826c-0bcc209f68dc; pagamentos
e7bcd957-2d4c-4260-9663-6cc97b5ab49c e f32f4d35-758c-4a22-b478-91fcacdf3aa0.
ReceivableB138c3e6c-98e2-4541-b904-9c065070dc4d; recebimentos
7cc1d129-6a09-478e-bfe6-b3e95200a81d e0bc5c252-58c3-463b-a822-f010e78723b4.
CI #292/run38968227946 success;270 testes/tipos/build PASS. Sem nova migration
após55, sem merge/PROD. Próximo escopo em auditoria: recorrência institucional
mensal (cadastro/prévia/geração única por regra/competência/desativação). Não
considerar recorrência anual/especial/multiaprovações/21 telas concluídas.

## HTTP institucional A — concorrência assinada PASS — 2026-10-16

Commit ca98d22:270 testes/40 arquivos, tipos/build com entrada QA PASS.
Versão isolada e1785942-7f06-401e-925a-5a294eac0911 no alias v35-finance,
sem trocar tráfego. App/QA/JS/CSS HTTP200 iguais ao build. QA JS
qa-Di4J3YUN.js SHA2561e626c6456698fe94fc800f599a356eea6040c74bac3d122a3a1656db25769bb.
Sessão real A em /dev-qa: RESULT PASS. Para despesa e receita, duas chamadas
simultâneas com mesma chave retornaram mesmo ID, payload divergente negado22023;
duas chaves distintas disputaram estorno, um vencedor e um23505. EscopoB negado
42501, IDB sob escopoA negado23503; quatro tabelas estrangeiras ocultas por RLS.
Um evento e uma auditoria por movimento; cleanup automático confirmado. São
requisições HTTP concorrentes; não prova todos os interleavings/alocação/fechamento.
Payable0fffde34-73eb-4c26-9c2b-6372463e0fb3, pagamentos
79130d3e-1bfa-486a-8a17-47b2aaa3a9d0 e b889e39f-8619-42e8-8533-f350e7dc9d4e.
Receivable45520fa7-bf01-49c8-9d0f-f63de8456637, recebimentos
446eed84-60eb-43b0-8baa-1461aa0d3569 e af6ae9f3-dca3-46ff-af45-6afbb429d222.
Read-back SQL após HTTP: QA A/B saldo10/10; nenhuma obrigação aberta, nenhum
movimento institucional sem estorno; auditorias A6/B2. DRE A restaurada pelo gate.
App devolvido à raiz; solicitado login DEV B somente para rodar este novo gate
no sentido inverso. Não repetir UI A/B/seed/OAuth; aba1875274888 Edge4 preservada.
Depois do login: /dev-qa.html, executar apenas Testar estornos institucionais HTTP
e concorrência, conferir RESULT e read-back antes de prosseguir próximo lote.

## Jornada institucional A concluída — 2026-10-16

A também concluiu despesa/receitaR$1, liquidação integral, estorno com ESTORNAR,
reabertura automática e cancelamento na versão841a8aa5. Read-back SQL:
origemR$10, ambas obrigações canceladas/aberto0, dois movimentos estornados,
duas auditorias. Não repetir UI A/B ou seed. Sessão A mantida no Edge id4,
aba1875274888, alias v35-finance. Pendência de login A nos blocos abaixo resolvida.
Despesa fa332a80-40b3-4147-84a7-c77acc24559d; pagamento
5faca7ff-d2a8-4af8-ac51-e9092437a1d7. Receita
412791a4-7626-4b8d-bbcf-48e786c1528d; recebimento
3888546e-bdfa-46da-867c-3004a065720f. Referências DEV QA REVERSAL A ...20261016.
Preparando gate HTTP institucional em dev-qa.html opcional, com preflight QA
FINANCE exato, atéR$1/operacao, replay e corrida/cleanup. Não afirmar execução
antes de observar RESULT PASS e read-back. Sem nova migration/produção.

## Preview e jornada institucional B — 2026-10-16

Commit funcional f0ac5ec, 269 testes/40 arquivos, tipos/build PASS; CI #290,
run38967138712 success. Publicado somente como versão isolada
841a8aa5-5353-4f57-a517-df89e2bc0a9f, alias v35-finance preservado, sem alterar
tráfego. HTML/JS/CSS HTTP200 e iguais ao build; JS index-CmPGR9WU.js SHA256
c9c7cf698be3d89fa09b96ed3cdd5bde489745626447d6bda7aa15086496c384.
CSS index-CIurdFNA.css SHA2560093a8ed83ea769e899c4d5f058f245129a9761a3c70633c091fbaf4722ce172.
B no Edge: despesaR$1 e receitaR$1 criadas, liquidadas integralmente, estornadas
com confirmação ESTORNAR; obrigação reabriu automaticamente emR$1 e depois foi
cancelada. Sem nova emissão ou alteração de fatos originais. Read-back SQL B:
saldo origemR$10, duas obrigações canceladas/aberto0, dois movimentos estornados,
duas auditorias institutional_movement.reverse. Histórico de teste preservado.
Despesa b84f6a6c-33d3-40df-b497-40e21082c714; pagamento
df07315b-31a3-4ecb-b3c0-199626f47e69. Receita
3e0c4d4f-2186-4aff-8b40-15456fd8820c; recebimento
537d75b6-e41b-4e6a-bec2-eee51d912cc8. Referências DEV QA REVERSAL B ...20261016.
Mobile390x844 observado: client/document375, sem overflow global; histórico tem
rolagem horizontal própria. Override restaurado. Não é paridade integral21 telas.
Solicitado login DEV A na mesma origem para repetir apenas este novo escopo.
Aba atual1875274888, Edge id4; preservar. Não repetir B/seed/OAuth.
Ainda pendentes A UI, concorrência real nova e demais requisitos da Etapa2.

## Estado vigente — acesso restaurado e estorno institucional — 2026-10-15

Supabase multiaccount agora expõe seleção de conexão nas ferramentas. Conexão
correta identificada por list_projects: somente TroncoDigital em Michael - jobmcc.
Consulta administrativa PASS; não pedir nova autorização/reconexão. Banco DEV
szqkdekwhzxsoxorgvaz tem55 migrations, última20261016003940. Arquivo criado pela
CLI e alinhado ao timestamp retornado pelo apply_migration; hash no manifesto.
Read-back A/B QA FINANCE confirmou R$10, zero cobranças/obrigações abertas.
Comando reverse_tenant_institutional_movement e guard de conciliação aplicados.
Quatro jornadas SQL positivas e44 rejeições esperadas A/B PASS rollback, claims
simuladas, não HTTP/concorrência real. UI nova em InstitutionalReversals: tipos,
histórico validado, confirmação, replay da mesma chave após resultado incerto,
refresh da obrigação após sucesso. Testes de componente e loader passaram.
Publicação/QA assinada dessa interface em preparação; não declarar homologada.
Próximo: terminar build/commit, versions upload alias v35-finance sem trocar
tráfego; QA B na sessão existente, depois A com login humano se necessário.
Antes de operar conferir Loja QA FINANCE exata. Cada operação fictícia atéR$1,
estornar e cancelar ao final, preservar seedR$10. Nenhum merge/PROD autorizado.
Detalhes em ADR-0028 e V35_INSTITUTIONAL_REVERSAL_PLAN.md. Etapa2 segue aberta.

## Conexão Supabase — nova conta adicionada — 2026-10-15

Navegador Edge atual id4, Supabase tab1875274733 no projeto correto
szqkdekwhzxsoxorgvaz, organização Michael - jobmcc/fblwfnjkisduhzuylazo.
Plugin ainda listava somente Distribuição/Catálogo/Água e SQL DEV negado.
Pela UI ChatGPT > Plugins > Supabase > Gerenciar > Conectar outra conta,
foi iniciado OAuth na sessão correta; organização Michael - jobmcc selecionada.
O proprietário clicou Authorize ChatGPT e confirmou FEITO. Retorno OAuth observado
 e configurações agora mostram DUAS contas com mesmo nome Conta de Michael no
Supabase. Controles de conta estão desabilitados nesta UI, inclusive após reload.
Não remover a antiga: ela atende outros projetos. Não pedir nova autorização OAuth.
Consulta/listagem por ferramentas DEPOIS do consentimento ainda usa conta antiga
 e nega o DEV. Nova conexão persistida não equivale a roteamento deste chat corrigido.
Próximo: proprietário recarregar este chat/cliente e reenviar menção Supabase;
verificar list_projects + consulta read-only ao DEV antes de migration. Se ainda
falhar, tratar seleção/roteamento multiaccount no cliente; não reduzir RLS/grants,
transferir projetos, buscar tokens ou presumir solução. Sem alterações no banco,
sem nova migration ou publicação nesta tentativa. Repo funcional permanece37879f6.

## Estado vigente — jornadas financeiras A/B concluídas — 2026-10-15

Este bloco substitui as pendências de login/jornada B nos registros anteriores.
DEV B permanece no Edge 1875274749, alias v35-finance. NÃO repetir seed nem A/B.
QA FINANCE B 7a6aa771-524d-4d5a-9d38-7006175e1cb4 concluiu pela interface:
- mensal março/2027 R$1, batch 0bd3365f-daeb-429f-bae5-85c30aa006c7;
  nova prévia zero novas/uma existente e sem botão de emissão;
- pagamento R$1 em 02/03/2027 (prefixo 84ad3760), alocação integral e estorno;
  crédito/alocação zerados, mensalidade reaberta e depois cancelada;
- avulsa outubro R$1 criada/cancelada; outubro fechado, nova avulsa rejeitada
  pelo servidor e competência reaberta;
- despesa e receita R$1 corrigidas para R$0,50/vencimento21/10 e canceladas;
- origem R$10, destino sem movimentos; DRE outubro2026/março2027 receitas,
  despesas e resultado R$0. Última leitura DRE e Loja selecionada reconferidas.
A concluiu o mesmo escopo. Nenhuma liquidação institucional executada.
Build funcional 37879f6, preview c7008f47, 252 testes/tipos/build PASS e CI #286
success; auditoria de dependências retornou zero vulnerabilidades. Evidência de
UI não substitui read-back SQL atual, nem comprova toda a Etapa 2/21 telas.
Próximo bloqueio: estorno institucional requer confirmar catálogo real, migration
mínima, testes SQL e UI. Contrato/aceite em docs/V35_INSTITUTIONAL_REVERSAL_PLAN.md.
CLI local migration new falhou ao gravar telemetria fora do workspace; não criou
arquivo. Nenhuma nova migration, comando de estorno ou interface foi implementada.
Consulta administrativa read-only ao DEV continua negada pela integração mesmo
após reconexões. Não contornar acesso, liquidar sem estorno validado ou publicar
recurso incompleto. Projeto DEV exato szqkdekwhzxsoxorgvaz. Sem merge/produção.

## Retomada após aprovação das fixtures — 2026-10-15

Proprietário aprovou explicitamente QA FINANCE A/B, saldo inicial R$10 e operações
fictícias até R$1, com cancelamentos/estornos e histórico preservado. Seed persistido
uma vez. NÃO repetir. A: 94b84958-4dd9-435d-9a4e-244220835d70;
B: 7a6aa771-524d-4d5a-9d38-7006175e1cb4. Sessão A ativa no Edge 1875274749,
alias v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev.
A UI: prévia/atualização/geração mensal março2027 R$1; nova prévia recusou duplicação;
batch 997f14d1-535f-47c2-8922-d0b88059da3a. Recebimento R$1 02/03/2027, ID começa
b598d5dd, alocado integralmente; estorno confirmado, crédito zero e cobrança aberta
novamente. Cobrança mensal cancelada; avulsa R$1 outubro criada/cancelada. Outubro
fechado, tentativa de avulsa bloqueada, competência reaberta. Tudo observado UI.
Despesa R$1 criada, corrigida para R$0,50 e cancelamento enviado; conferir conclusão.
Atualização: cancelamento da despesa confirmado; receita também criada R$1,
corrigida R$0,50/vencimento21/10 e cancelada/zero aberto. Outubro reaberto.
Correção loader passou 252 testes/tipos/build/preservação; commit37879f6 enviado,
versãoDEVc7008f47 no mesmo alias, assets iguais ao build. Reload mantém sessão A;
conferir nova leitura institucional e saldos antes de pedir troca para B.
Conferido no novo build: despesa/receita canceladas/zero aberto sem erro; origem
R$10, destino sem movimentos; DRE outubro2026 e março2027 toda zerada. Mobile390
document/client375, override restaurado. CI #286/run38811322401 success.
Solicitado login B na mesma aba/alias; não repetir A. Próximo B: selecionar
DEV QA FINANCE B 20261015, gerar mensal março2027R$1, conferir nova emissão negada,
registrar R$1/alocar/estornar, cancelar mensalidade, avulsaR$1/cancelar, despesa e
receitaR$1/corrigirR$0,50/cancelar, fechamento outubro/bloqueio/reabrir e saldos/DRE.
Cada operação atéR$1 autorizada. Não estornar pagamento inicial deR$10.
Sem pagamento institucional criado. Não liquidar antes de implementar/validar
estorno institucional: nenhum comando correspondente localizado no código versionado.
SQL administrativo voltou sem permissão; usuário reconectou duas vezes, mas a
chamada direta ao DEV continua negada. Primeira listagem mostrou conta de Água/
Catálogo/Distribuição; última reconexão foi declarada TroncoDigital, sem sucesso
na consulta. Não insistir em credenciais ou trocar projetos. UI normal funciona.
Correção local adicional em institutional-operations.ts rejeita duplicatas,
saldos inconsistentes/cancelado com aberto e aprovação desconhecida; quatro
regressões falharam antes/passaram após. Validação geral em andamento.
Ver V35_STAGE_2_IMPLEMENTATION.md para histórico. Etapa 2 aberta.

## Histórico — Sequência 1–5 autorizada — 2026-10-15

Passo 1 consolidado em docs/V35_VERTICAL_DELIVERIES.md. Passo 2 em execução:
oito gates SQL rollback e matriz nova de 60 negações A/B PASS; tipos/build/243
testes/gramática/preservação/12 guardas PASS. Corrigido bloqueio permanente após
Atualizar regras durante prévia mensal lenta; regressão falhou antes/passou após.
Não repetir todos os testes sem mudança. Não há regra mensal persistida para QA.
Preflight scripts/prepare_dev_financial_browser_qa.sql passou com rollback; COMMIT
bloqueado pelo auto-review por autorização anterior restrita a QA INTERFACE.
Precisa aprovação específica das novas QA FINANCE A/B e login no novo preview;
não gravar por outro caminho. Plano imutável original e fixtures antigas intactos.
Commit funcional 991ae9c enviado; versão isolada a782b50f publicada sem trocar
tráfego, assets HTML/JS/CSS iguais ao build. Alias v35-finance-corsys-tronco-digital-dev.corsys1.workers.dev
aberto no Edge 1875274749 para login A. CI #284/run38676894646 inicialmente em curso.
Ver docs/V35_STAGE_2_IMPLEMENTATION.md para escopo e próximos gates. Sem PROD/merge.

## Homologação A/B encerrada no escopo — 2026-10-15

Sessão A real na versão isolada 962f7b1b concluiu transferência R$1/estorno UI,
OFX persistido/validado/conciliado/desfeito e HTTP isolamento A→B/replay/disputa.
Todos PASS observados. B já havia concluído CSV/UI/HTTP e concorrência bancária.
Read-back conjunto confirmou A/B 10/0, zero transferências sem estorno, zero valor
conciliado ativo nas fixtures e zero faturas SaaS QA; originais 17 cobranças/16
pagamentos. IDs/SHA e limitações em docs/V35_SIGNED_BROWSER_QA.md.
Não repetir jornadas nem pedir login A novamente. Sem nova migration, publicação,
merge ou produção nesta conclusão. Próximo: revisar pendências da Etapa 2 e lotes
em docs/V35_VERTICAL_DELIVERIES.md; não tratar 21 telas como concluídas.
Se precisar publicar DEV, preservar a versão isolada e coordenar o outro publicador
que altera o endpoint principal. Manter históricos fictícios identificados.

## Histórico — Orçamento operacional DEV — 2026-10-14

Mais recente: versão isolada `962f7b1b-1652-4ae5-86d3-4e53f4cbe7ae`, commit
`23906b6` (CI #281 success), URL no V35_SIGNED_BROWSER_QA.md. Publicada por
versions upload sem trocar tráfego; outro publicador substitui o DEV principal.
B UI/CSV e HTTP isolamento/concorrência de transferências e conciliação PASS.
Todos vínculos/transferências B desfeitos, saldos 10/0 e originais preservados.
Proprietário entrou B nessa versão e foi solicitado a trocar para A na aba Edge
1875274749; aguardar sessão real A. Arquivo OFX de A está em
.test-tmp/DEV_QA_UPLOAD_A_20261014.ofx, uma linha fictícia R$10 em 2026-10-15.
Próximo A: selecionar DEV QA INTERFACE A, transferir R$1/estornar na UI, importar
OFX/validar/conciliar pagamento sintético/desfazer, depois abrir /dev-qa e executar
isolamento e concorrência de transferências. Não pedir senha/token nem .env.dev.

Retomada seguinte: proprietário autorizou duas Lojas QA isoladas A/B (IDs no novo
V35_SIGNED_BROWSER_QA.md), cada uma com duas contas e R$10 sintéticos. Seed
preflight rollback e persistência passaram, sem alterações originais. B UI criou
transferência 1f124bed-e806-433f-97e8-45f86ea18027; UUID regex frontend defeituosa
gerou resultado incerto, retry não duplicou. Correção/testes preparados. Estornar
esse registro pela UI após publicar correção, antes de gate de saldo 10/0.
Página dev-qa.html opcional para testar RPC HTTP com sessões existentes sem
extrair JWT. Publicar somente DEV e observar resultados; não presumir testes PASS.

Retomada seguinte: conciliação implementada, migration #54 aplicada DEV,
239 testes/tipos/build e 12 guardas locais PASS. SQL A/B e transferência positiva
com estorno/duas pontas conciliadas PASS, tudo rollback. Dois extratos B autorizados
ficam persistidos para disputa; primeira tentativa via conector sem sobreposição,
vínculo desfeito. HTTP real aguarda .env.dev local A/B (não pedir secrets no chat).
Atualização posterior: DEV `485cc0a0`, `19c9c32` publicado e assets iguais ao build.
Browser B duas abas: único aceite de R$100, concorrente rejeitado, desfazimento pela
tela e zero vínculos ativos conferidos. Prévia CSV local e QA desktop/mobile PASS
após correção de overflow. Quatro negativas HTTP anon PASS. VIEWER/suspensão SQL PASS.
Proprietário prefere browser, sem .env.dev; registrar HTTP A/B completo não avaliado,
sem pedir credenciais novamente. Ver docs/V35_BANK_RECONCILIATION.md antes de avançar.

Atualização de publicação: commit funcional 0a3ed4e, CI38659598745 success, versão
DEV23727d71-ec86-4fc1-8650-346264573d9f. Bundle remoto igual ao local por SHA256.
Browser A percorreu draft/linha/remoção/reinclusão/publicação/consulta; Edge1440/390
conferido, quatro negativas HTTP anon PASS. Ciclo fictício publicado
ce7f052b-2f0b-4db0-9ff7-e29d44f0b195 fica preservado; 17 cobranças/16 pagamentos.
Sessão B no Edge passou: draft/linha R$250/publicação imutável; seletor sem ciclo A.
Ciclo B 73d7be4f-bfc2-474c-a7ea-26320fb5b3a5 preservado como evidência DEV.
Negativos HTTP cross-tenant com JWT real e corrida
independente continuam pendentes. Não avançar classificando esses limites como PASS.

Nova migration #53 `20261015001840_tenant_budget_lifecycle` aplicada DEV e hash no
manifesto. BudgetManagement em Financeiro > Planejar orçamento: draft/linhas/revisão/
publicação, com RPCs autenticadas e idempotentes e histórico imutável. ADR-0006 e
docs/V35_BUDGET_LIFECYCLE.md registram segurança, testes e recuperação. 224 testes,
tipos/build, SQL lifecycle A/B rollback, regressões e preservação PASS. Sem ledger,
RLS, grants diretos, produção ou merge. Próximo: publicar/homologar esta jornada
no preview com registro de versão/SHA, antes de avançar outra entrega funcional.

## Retomada auditada — 2026-10-14

QA positivo posterior: proprietário aprovou fixture orçamentária temporária. Teste
real no preview A passou (250 orçado / 500 realizado / -250 restante / 200% explícito).
Ciclo `6f953af3-c600-4bf2-ae3c-4ff1a0c63236` e linha removidos por cleanup restrito;
zero remanescentes, 17 cobranças/16 pagamentos preservados. Aprovação resolveu
bloqueio de fixture registrado abaixo; não há aprovação pendente para esse teste.
Desktop/mobile separados, demais papéis e fechamento da Etapa 2 continuam pendentes.

Atualização: OAuth Cloudflare concluído. A publicação DEV existente
`4d47c0cf-d659-4403-8624-8fe63d259b80` contém os assets exatos do build `be967cf`
(hashes JS/CSS no relatório); não houve novo upload. CI `38655489396` success.
Sessão A e orçamento vazio conferidos no build publicado. Fixture positiva de
orçamento persistida para QA foi bloqueada pelo auto-review; aprovação específica
solicitada, nenhum registro criado. Viewport do navegador interno permaneceu
754x668 apesar do pedido 1440x1000; não declarar desktop/mobile homologados.

Base `210a039b`, branch `feat/v35-dev-gate-20261002`, PR draft #4 confirmado.
Auditoria, evidências, seis lotes e 21 telas em `docs/V35_VERTICAL_DELIVERIES.md`.
Lote 0: orçamento consultivo com execução visual, validação de duplicatas/moeda/
centavos e Wrangler 4.151.0. 217 testes/tipos/build, 12 guardas DEV, preservação,
regressões financeiras e novo SQL de orçamento A/B PASS. SQL revertido; 52 migrations,
sem DDL novo. OAuth Cloudflare solicitado para preview; login Loja A observado.
Sem merge/PROD. Etapa 2 não encerrada. Próximo: publicar/homologar o lote 0, antes
de avançar demais lotes. Cadastro/publicação de orçamento e conciliação permanecem
pendentes; transferência positiva exige duas contas legitimamente mapeadas.

## Incremento 29 — busca filtrada de clientes Master, 2026-10-10

- Migração DEV #52 `20261010224802_master_tenant_search_filters` aplicada, SQL e SHA256 no manifesto. Nova RPC `search_platform_master_tenants(search,status,plan,limit,offset)` exige MASTER/MFA AAL2 no PostgreSQL, retorna o mesmo contrato de `list_platform_master_tenants`, pagina 1–50 linhas e até offset 20.000. A busca ocorre no banco por nome, número, cidade e contatos do cadastro comercial, não revela e-mail/telefone no resultado; status `active`/`past_due` e plano por nome/código. `anon` sem EXECUTE.
- `MasterConsole` agora tem formulário “Filtrar clientes SaaS” e botão Limpar filtros. `loadMasterTenants` mantém RPC histórica para ausência de filtros e usa nova RPC somente com filtros, preservando teste/regressão do dashboard. Botões de Cliente 360 e Cobrança Master continuam consumindo lista da página atual, não implementam navegação direta entre todos os clientes.
- SQL `DEV_MASTER_TENANT_SEARCH_ROLLBACK_PASS` verificou busca de DEV-A/DEV-B, status ativo, paginação distinta, filtro sem resultado, parâmetro inválido e acessos negados Master AAL1/tenant AAL2/anon, tudo revertido. Testes React incluem filtro/limpeza e rejeição de input >100 caracteres. CI do último commit verificar.
- Paridade parcial com `view-master-clientes`: campo Plano é texto de busca por nome/código, não SELECT catálogo, e permanecem buscas combinadas com filtros avançados, cards de saúde/uso, 360° completo, onboarding cinco etapas e ações do HTML. Sem merge/PROD.

## Incremento 28 — fluxo de caixa diário com realizado e pendente (2026-10-10)

- Migração DEV #51 `20261010224130_tenant_daily_cash_flow_summary` aplicada e versionada, hash SHA256 no manifesto. RPC `read_tenant_daily_cash_flow(org,from,to)` exige `finance.read` no PostgreSQL e intervalo máximo de 93 dias, valida `integrity_ok` de cobranças, recebíveis e pagamentos institucionais, e agrupa todas as movimentações efetivas/débitos em SQL, evitando soma parcial de consultas paginadas. Recebimentos incluem pagamentos de integrantes/institucionais líquidos de reversões, saídas incluem pagamentos a fornecedores líquidos de reversões. Transferências entre contas e entradas de abertura foram explicitamente excluídas de recebimentos/saídas operacionais para evitar dupla contagem.
- **Pendentes** em colunas distintas: cobranças em aberto de integrantes, recebíveis institucionais e contas a pagar pela data de vencimento; não confundir com fluxo realizado, saldos de contas bancárias ou previsão estatística de recebimento. Retorna todos os dias do período mesmo com zeros.
- UI `DailyCashFlow` integrada em `Financeiro > Fluxo de caixa`: filtro de datas, resumos realizados/projetados e tabela diária validada contra equações financeiras completas em `daily-cash-flow.ts`. Nenhuma gravação ocorre. Testes Vitest de período, valores inválidos, saldo versus projeção, erros de permissão e mudança de datas.
- Gate SQL **`DEV_DAILY_CASH_FLOW_ROLLBACK_PASS`** executado com claims A/B simuladas: 30 dias de setembro/2026 por Loja, recebimentos registrados reconciliados exatamente com movimentações assinadas, valores a receber comparados às views, acesso cross-tenant negado, janela acima de 93 dias negada e anon sem EXECUTE. ROLLBACK, sem alteração em dados.
- PENDÊNCIAS: gráficos de fluxo de caixa V35, cortes mais amplos, cash balance projetado com saldos iniciais e riscos de recebimento, validação JWT HTTP real, concorrência e QA mobile/desktop. Etapa 2 não encerrada. Sem produção.

## Incremento 27 — exportação CSV privada de inadimplência (2026-10-10)

- `Financeiro > Inadimplência` ganhou botão `Exportar CSV completo`, acionado pelo usuário autenticado com `finance.read`, sem endpoint de exportação público e sem chave de serviço no navegador. `loadDelinquencyExport` percorre as páginas da RPC autorizada `read_tenant_delinquency`, valida cada posição, detecta integrante duplicado entre páginas, interrompe em erro ou mudança de tenant e bloqueia arquivos parciais (limite **1.000 integrantes**). `createDelinquencyCsv` usa UTF-8 BOM, `;` para pt-BR e neutraliza células iniciadas por fórmulas (`=`, `+`, `-`, `@`) ou controles. Não exporta CPF, telefone ou e-mail. Sem custos/serviços externos.
- Testes Vitest em `src/lib/delinquency-export.test.ts` cobrem duas páginas (31 registros), CSV injection, valores incorretos, duplicatas, interrupção ao trocar de Loja e limite. Teste na UI confirma que exportação não roda automaticamente e falha fechada se a consulta retorna erro de autorização. CI do HEAD deve ser verificada.
- **Limitações:** CSV NÃO é XLSX nem PDF; registros podem mudar entre páginas e não há snapshot consistente de transação (informado na UI). Não é relatório contábil auditado de corte; para comprovantes oficiais e volumetria alta é preciso exportação server-side com snapshot consistente, LGPD e retenção adequada. Teste real de download em navegador mobile/desktop NÃO AVALIADO.
- DEV somente, branch PR #4. Etapa 2 continua aberta, sem produção ou merge.

## Incremento 26 — transferências internas entre contas e estornos (2026-10-10)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Supabase **50 migrations**, #50 `20261010222543_tenant_account_transfer_commands` aplicada/versionada com SHA256 no manifesto. Sem merge, deploy ou alteração de PROD.
- Criadas RPCs `register_tenant_account_transfer_idempotent` e `reverse_tenant_account_transfer_idempotent`. Exigem `institutional.manage` e assinatura com escrita permitida; usam `private.idempotency_begin/complete`, chave/payload, `financial_account_transfers` e `financial_account_transfer_reversals` imutáveis; bloqueiam contas da própria Loja, datas futuras, saldo insuficiente, mesma conta, reversão duplicada e competência fechada. Auditoria separada em `audit_logs`. As views originais `v_financial_account_movements` e `v_financial_account_balances` já projetavam transferências e reversões como movimento de igual valor e sinal inverso entre contas; não são receitas/despesas DRE.
- Nova aba `Financeiro > Transferências` com formulário entre contas ativas, saldo da origem, extrato paginado de transferências da Loja e estorno por confirmação digitada `ESTORNAR` + motivo, retry idempotente após perda de resposta. Componente `AccountTransfers`, loader `account-transfers.ts`, testes React com mocks.
- Teste SQL `DEV_TRANSFER_GUARDS_ROLLBACK_PASS`: conta destino estrangeira negada, origem=destino negada, estorno inexistente negado e anonimato sem EXECUTE, tudo revertido. Tentativa de montar **novo tenant temporário com duas contas mapeadas para ensaio positivo** foi bloqueada pela ferramenta de segurança; NÃO executar bypass. DEV atualmente tem só **1 conta ativa por Loja**, inviabilizando teste de transferência positiva sem preparação contábil completa. Portanto **TRANSFERÊNCIA REAL POSITIVA + ESTORNO NO BANCO NÃO HOMOLOGADOS**; não declarar PASS. Teste multi-conexão e saldo concorrente também NOT EVALUATED.
- Etapa 2 segue aberta: criar plano sucessor e mapear/ativar segunda conta por Loja com autorização, validar ciclo positivo/reversão, reconciliação OFX/CSV, saldos de fundos, remessas, paridade 21 telas, exportação segura, HTTP JWT assinado e QA mobile/desktop. Não produzir nem cobrar cliente.
- CI final do HEAD: conferir GitHub Actions; não extrapolar status de commit anterior.

## Incremento 25 — versões sucessoras de ofertas Master (2026-10-10)

- Migração DEV #49 `20261010211529_master_promotion_successor_idempotent` aplicada, hash SHA256 no manifesto. `create_master_promotion_successor_idempotent` exige MASTER/AAL2, chave + hash invariantes, bloqueia série para concorrência e confere a última versão publicada; cria somente draft sucessor com validade futura, sem mutação do histórico. Publicação existente fecha a vigência da versão anterior.
- `MasterPromotions` agora escolhe nova série ou sucessora de uma oferta publicada, com mesma validação monetária e confirmação posterior de publicação. Teste React adicional distingue RPC de sucessão de edição direta. 
- SQL `DEV_MASTER_PROMOTION_SUCCESSOR_ROLLBACK_PASS`: versão inicial publicada, sucessora draft/publicada, janela anterior encerrada, chave reutilizada com payload diferente negada e origem obsoleta `40001` bloqueada; tudo em transação `ROLLBACK`. **JWT HTTP real e concorrência em conexões simultâneas NÃO AVALIADOS.**
- Pendente Stage 2: revisão/edição de promoções draft, exclusão/retirada autorizada, resgates reais, billing SaaS, contas/tesouraria específicas e demais 21 telas V35. Não houve deploy/merge produção.

## Incremento 24 — políticas de aprovação parametrizáveis (2026-10-10)

- Migração DEV #48 `20261010210919_tenant_expense_approval_policy_lifecycle` aplicada/versionada SHA256. `create_tenant_approval_policy_draft` exige `approvals.manage`, regras `off`/`all`/`threshold`, limite em BRL centesimal quando applicable, 1–10 aprovadores e vigência futura. `publish_tenant_approval_policy_idempotent` delega à RPC auditada existente de publicação, com motivo e replay idempotente. Constraint de não sobreposição entre políticas publicadas continua no PostgreSQL.
- UI `ApprovalPolicies` integrada ao Financeiro em aba separada da fila de decisões. Permite cadastro de rascunho, leitura do histórico tenant-scoped e publicação somente após digitar `PUBLICAR`. Nenhuma política altera cobrança/contrato histórico, votos anteriores ou aprovações já tomadas.
- Teste SQL A/B `scripts/verify_dev_expense_approval_policies.sql`: `DEV_APPROVAL_POLICY_LIFECYCLE_ROLLBACK_PASS`, duas Lojas, publish/replay, bloqueio de vigência sobreposta, anon sem grant, ROLLBACK. Testes React incluem draft threshold, publish confirm, retry e row cross-tenant bloqueado; conferir CI do HEAD antes de aceite.
- PENDENTE: autores/roles autorizados a aprovar, regra de autoaprovação, delegação, workflows especiais do HTML V35, HTTP JWT real e concorrência independente. PROD não autorizada.

## Incremento 23 — ofertas promocionais Master (2026-10-10)

- Migração DEV #47 `20261010210329_master_promotion_draft_publication_idempotent` aplicada, SQL + SHA256 no manifesto. Duas RPCs `create_master_promotion_draft_idempotent` e `publish_master_promotion_draft_idempotent` validam MASTER/AAL2 no PostgreSQL, usam `private.master_idempotency_keys` e hash de payload para impedir duplicidade/alteração em retry; preservam versões e registram `saas_master_audit_logs`.
- UI `MasterPromotions` integrada ao `MasterCommercialCatalog`: cria rascunho com desconto percentual/fixo/preço de teste, vigência, elegibilidade, máximo de resgates, combinação e duração; publica apenas draft selecionado após digitar `PUBLICAR`. Nenhum contrato, cliente, fatura ou resgate é ativado retroativamente pela tela.
- Script DEV `verify_dev_master_promotions.sql` retornou `DEV_MASTER_PROMOTION_ROLLBACK_PASS`: criação de rascunho, prevenção de payload divergente na mesma key, publicação, retry, auditoria e AAL1/tenant/anon negados, tudo ROLLBACK. Frontend testado por Vitest (criação, publicação, retry, permissão); confirmar CI do último commit.
- Pendentes Master: ofertas sucessoras e edição de drafts, ações de ativação/aposentadoria, contratos, cobrança, verificação real de resgate, importação de clientes e Cliente360 completo. Etapa2 segue ABERTA. Não houve produção.

## Incremento 22 — Master draft replay protegido por payload (2026-10-10)

- Migration DEV #46 `20261010205909_master_onboarding_strict_idempotency`, SQL e SHA256 versionados. RPC `create_master_onboarding_draft_idempotent(key,payload)` usa `private.require_platform_staff('MASTER')` AAL2, normaliza campos, valida papel ADMIN e dados essenciais, serializa mesma key via advisory lock, compara todos os campos com rascunho existente e só invoca a RPC antiga no primeiro envio. Key existente com payload diferente ou status não-draft gera `22023`, nenhuma mutação/evento adicional.
- Frontend `MasterOnboarding` agora chama wrapper protegido, mantendo a mesma key/payload quando resultado de transporte é incerto. Script SQL `DEV_MASTER_ONBOARDING_STRICT_REPLAY_ROLLBACK_PASS` validou replay, colisão de payload rejeitada, uma única linha e um único evento, AAL1 e tenant negados, anon sem grant. ROLLBACK.
- Atenção: RPC legada `save_saas_onboarding_draft` continua diretamente chamável por MASTER/AAL2; sua colisão sem validação não pode ser considerada corrigida para todos os consumidores. Nova UI usa wrapper; antes de PROD mapear consumidores e restringir/aposentar legado ou endurecê-lo com compatibilidade validada. Nenhum deploy PROD, HTTP/JWT real não avaliado.
- CI `GitHub Actions` do SHA consolidado deve ser verificada depois desta revisão documental. Etapa 2 ainda aberta: convite/aceite real e entrega, integrações comerciais, paridade do piloto, Master completo, relatórios e segurança E2E.

## Incremento 21 — onboarding e Cliente 360 Master (2026-10-10)

- DEV branch `feat/v35-dev-gate-20261002`, PR #4. Supabase migrações **45**, `20261010010836_master_plan_draft_publication_idempotent` (#44, anterior) e `20261010205431_master_client_360_summary` (#45, nova), SQLs versionados e hashes SHA256 conferidos no manifesto.
- `MasterOnboarding`: lista rascunhos e versões comerciais publicadas, cadastra proposta de Loja com valores de contrato, administrador/invite previsto, início, plano, identificador e MFA MASTER. Reutiliza `save_saas_onboarding_draft`, cuja constraint exige papel inicial `ADMIN` (corrigido após teste). Draft NÃO cria organização, assinatura nem convite. O comando `provision_saas_onboarding_database` existente fica acessível somente após seleção de draft completo e confirmação digitada `PROVISIONAR`; ele cria Loja + assinatura e enfileira tarefa de convite **sem comprovar envio de e-mail**, sem provedor de cobrança ativado. Fluxo final de convite/termos ainda pendente.
- Gates SQL AAL2 Master, tenant e AAL1 com ROLLBACK: `DEV_MASTER_ONBOARDING_DRAFT_ROLLBACK_PASS` e `DEV_MASTER_ONBOARDING_PROVISION_ROLLBACK_PASS`. O primeiro teste de contagens do provision falhou por contar organizações sob RLS authenticated (retornava 0): corrigido conferindo totais após `RESET ROLE` e gate PASS. Nenhuma Loja fictícia persistida.
- `MasterClient360` e função `read_master_client_360(org)` mostram somente um cliente SaaS escolhido (cadastro, assinatura, faturas abertas/vencidas e chamados), exige `private.require_platform_staff('MASTER')` AAL2 no backend, controla escopo e integridade. SQL `DEV_MASTER_CLIENT_360_ROLLBACK_PASS`: números reconciliados com view, AAL1 e tenant negados, anon sem EXECUTE. NÃO exibe ledger de integrantes, nem concede acesso de suporte/impersonação. Testes frontend adicionados, conferir CI do HEAD.
- Limitação relevante: tela Cliente360 é **panorama**, ainda não representa formulário/edit completo, trilha de auditoria, negociação, contrato, atendimento e gráficos do piloto. Onboarding exige convite autenticado/consentimento, gestão de status e tratamentos de falhas; não declarar homologia integral.
- Não houve merge nem deploy PRODUÇÃO. HTTP/JWT com tokens assinados reais, sessões concorrentes independentes e validação visual mobile/desktop continuam **NOT EVALUATED**. Etapa 2 permanece aberta.

## Incremento 20 — operação Master de suporte e respostas (2026-10-10)
- Branch DEV PR #4, migration #43 `20261010005826_master_tenant_support_idempotent_reply` versionada e SHA256 conferido no manifesto. `MasterSupportQueue` mostra chamados internos e da Loja, métricas reais, mensagens e paginação; `MasterConsole` tem aba Operação e suporte.
- `reply_master_tenant_support_idempotent` exige MASTER ativo + MFA AAL2 no PostgreSQL, restringe `ticket_scope='tenant'`, valida mensagem e status, usa mesma chave/payload após perda de resposta e delega à RPC auditada `reply_saas_support_ticket`. Não concede escrita em chamados internos ou impersonação cross-tenant.
- Gates SQL `DEV_MASTER_SUPPORT_RLS_ROLLBACK_PASS` e `DEV_MASTER_SUPPORT_REPLY_ROLLBACK_PASS`: Master AAL2 pode, AAL1/tenant sem MASTER/anon não pode; chamada repetida não duplica mensagem; ROLLBACK. Claims do SQL são simuladas, **não** JWT HTTP assinados.
- CI funcional `cb6fe527` run `38011418036`: 162/162 testes em 26 arquivos, TypeScript, build e estático PASS. Antes de production exige HTTP/JWT real, QA desktop/mobile e restante da paridade 21 telas.
- Master overview, diretório, versões comerciais permanecem READ-ONLY; **resposta a ticket de cliente e mudança de status são comandos reais em DEV**, sem ativar cobranças comerciais.
- Pendências Stage2: onboarding, Cliente 360, billing SaaS, políticas de aprovação completas, negociação, ágapes/mútuas, conciliação, transferências, exportação PDF/XLSX, regras anuais e institucionais, paridade piloto, segurança HTTP concorrência, testes de navegação real. Sem PROD ou merge.

## Incrementos 15–19 — recorrência, tesouraria, correções e Master (2026-10-09/10)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Supabase DEV **42 migrations**, #36–42 versionadas em `docs/engineering/v35-dev-runtime-manifest.json` com SHA256 dos SQL aplicados. Nenhum deploy ou alteração PROD autorizados.
- **Mensalidade recorrente:** `preview_monthly_charge_generation` e `generate_monthly_member_charges`, último lote transacional, fingerprint da prévia, vigência, isenção, preço individual, dia de vencimento ajustado a meses curtos, até 200 integrantes por regra, `charges_recurring_base_uidx` + chave idempotente e snapshot contábil. Teste `DEV_MONTHLY_GENERATION_ROLLBACK_PASS` em Tenant A/B com geração de 2 cobranças por Loja e ROLLBACK.
- **Operações de competência/cobranças:** wrappers idempotentes para cancelar cobrança de integrante e fechar/reabrir competência; telas `ManualCharges` e `FinancialPeriods`. SQL `DEV_CHARGE_CANCEL_PERIOD_EVENTS_ROLLBACK_PASS` A/B.
- **Painel e relatórios:** 6 KPIs server-side (`read_tenant_financial_dashboard`), inadimplência paginada (`read_tenant_delinquency`), caixa/bancos com saldo por view e movimentações paginadas, orçamento×realizado nas views originais. SQL `DEV_FINANCIAL_DASHBOARD_ROLLBACK_PASS`, `DEV_DELINQUENCY_REPORT_ROLLBACK_PASS` e `DEV_TREASURY_READ_RLS_ROLLBACK_PASS` A/B. Orçamento DEV sem ciclo cadastrado; consultas de orçamento são testadas por mocks, não existe orçamento executado de negócio.
- **Institucional:** novas RPCs `cancel_tenant_institutional_obligation_idempotent` e `correct_tenant_institutional_obligation_idempotent`. Correção bloqueia estado stale `40001` com snapshot/lock e reaproveita comandos antigos, auditoria, aprovação recalculada por política atual, classificação histórica. SQL `DEV_INSTITUTIONAL_CANCELLATION_ROLLBACK_PASS` e `DEV_INSTITUTIONAL_CORRECTION_ROLLBACK_PASS`, ambas Lojas e ROLLBACK. UI `InstitutionalOperations` atualizada com correção/cancelamento.
- **Master SaaS:** `read_platform_master_overview` e `list_platform_master_tenants` com `private.require_platform_staff('MASTER')` e MFA/AAL2; nav Master renderiza somente após validação de overview, com painel, diretório e catálogo histórico read-only `MasterCommercialCatalog`. SQL `DEV_MASTER_READONLY_AAL2_ROLLBACK_PASS` com rejeição de sessão AAL1, conta de Loja AAL2 e anon. Nenhuma impersonação, onboarding ou cobrança Master ativada.
- CI pré-Master commit `5c21457f`: 141 testes PASS, frontend build/static PASS. CI para incrementos posteriores conferir o SHA final; nunca contar checks anteriores como aceite de HEAD.
- **Etapa 2 ABERTA**: Master onboarding/360º/billing, catálogo comercial editável/versionado, relatórios Excel/PDF privados e filtros do piloto, conciliação OFX/CSV, transferências e saldos de fundos, negociações/ágapes/mútuas, regras anuais/institucionais, 21 telas HTML V35 e paridade visual mobile/desktop, HTTP/JWT real, sessões concorrentes independentes, qualidade de acessibilidade e segurança. Stage 1 não equivale ao release PROD.
- Atenção a CAPs de 150/200 registros: falham fechado onde limitados, exigem paginação/escala V35. Não exponha entitlements, dados cross-tenant ou execução de Master a partir de CSS/nav; segurança final está no PostgreSQL.

## Incremento 14 — decisões de aprovação de despesas (2026-10-09)

- Migration DEV #35 `20261009181235_payable_approval_idempotent_decisions`, SQL/hash no manifesto. A RPC `decide_payable_approval_idempotent` valida `approvals.review`, decisão `approve/reject`, razão e chave de idempotência e chama a RPC auditada preexistente `decide_payable_approval`. A unicidade `(approval_request_id,actor_user_id)` e eventos imutáveis continuam válidos.
- Interface `PayableApprovals.tsx` adicionada ao Financeiro; exibe apenas solicitações `pending` da Loja conforme `v_payable_approval_state`, com aprovação/rejeição e justificativa. A decisão não gera pagamento. Segurança fail closed para falha de RLS, tenant cruzado, consulta acima de 150 pedidos e replay incerto.
- SQL DEV A/B `DEV_APPROVAL_IDEMPOTENCY_ROLLBACK_PASS`, incluindo criação temporária de obrigação, aprovação/replay e ROLLBACK. Testes React adicionados; CI da SHA final conferir. Visão de aprovação pendente de design completo V35 (políticas, múltiplos aprovadores, autorrevisão, histórico e decisão em casos complexos).
- **Etapa 2 ainda NÃO encerrada.** Permanecem geração de recorrência, operações de correção/cancelamento, orçamento, conciliação, Master SaaS, 21 telas piloto e homologações JWT HTTP/concurrency/visual. Sem produção.

## Incremento 13 — tesouraria institucional com cadastro e liquidação (2026-10-09)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4. Sem migrations adicionais além das 34 existentes.
- UI `InstitutionalOperations.tsx` e loader `institutional-operations.ts` em Financeiro. Reutiliza RPCs existentes idempotentes: payable/receivable create e payable-payment/receipt, sem duplicar lógica monetária em React. Bloqueia liquidação de despesas sem aprovação e de valores superiores ao saldo; resultados com `integrity_ok` obrigatório e filtro tenant.
- SQL A/B `scripts/verify_dev_institutional_lifecycle.sql`: `DEV_INSTITUTIONAL_LIFECYCLE_ROLLBACK_PASS`, inclusive create/retry e pagamento parcial, tudo revertido. `verify_dev_institutional_foreign_id.sql` PASS. Scripts `verify_dev_financial_lifecycle.sql` PASS. `verify_dev_financial_commands.sql` foi interrompido por precondição histórica incompatível `Fixture changed`, não por divergência testada de valores; atualizar fixture separadamente.
- CI `37971091914` testou commit `69d4d5a4` e aprovou 101 testes/15 arquivos e build. A próxima revisão documental deve ter seu próprio CI validado.
- PENDENTE: autorizar/decidir aprovações, correções e cancelamentos de obrigação, periodicidade institucional, conciliação, contas/fundos, relatórios comparativos, Master SaaS, 21 telas completas HTML V35, HTTP/JWT real e concorrência independente.
- Não executar merge/deploy PROD. Nenhum trabalho em background depois deste turno.

## Incremento 12 — pagamentos e DRE realizados (2026-10-09)

- Branch DEV `feat/v35-dev-gate-20261002`, PR #4, Supabase DEV migrations #33/#34 aplicadas e versionadas.
- UI `MemberPayments`: registrar pagamentos de integrantes, alocação manual a cobrança e reversão auditada com replay seguro; consultas isoladas por Loja/integrante e `integrity_ok`. Reutiliza RPCs `register_payment` e `allocate_payment_to_charge`; wrapper novo `reverse_member_payment_idempotent` protege reversão e delega à RPC original.
- UI `DreReport`: consulta até 12 competências da `v_dre_entries` agrupada por conta histórica e natureza, sem apresentar crédito/caixa como receita; relatório somente realizado, sem orçamento/comparativo V35.
- GATES SQL executados: `DEV_MEMBER_PAYMENT_OPERATIONS_ROLLBACK_PASS` e `DEV_DRE_REPORT_ROLLBACK_PASS`, ambas as Lojas e ROLLBACK. Sem alteração em 17 cobranças / 16 pagamentos existentes. Componentes/testes de frontend precisam ter CI final confirmada (não inferir sucesso por SQL).
- Risco: UI limita listagem de integrantes e extratos; revisão com volumes reais/paginação necessária. RPC antiga `reverse_payment` permanece acessível, embora a nova UI use wrapper idempotente. HTTP/JWT assinados, concorrência comprovada, visual desktop/mobile e dezenas de módulos V35 ainda pendentes.
- Não realizar merge/PROD sem critérios de aceite e homologação.

## Incremento 11 — concorrência por Loja e cobertura contábil (2026-10-09 Brasil)

- PR #4 / branch `feat/v35-dev-gate-20261002`, migration DEV #32 `20261009165809_tenant_scoped_accounting_publication_guard`, SHA256 no manifesto.
- Substituídos bloqueios `LOCK TABLE SHARE` globais da publicação por bloqueios `organizations FOR UPDATE` de cada Loja. Seis triggers `accounting_tenant_change_guard` em categorias, contas de caixa/banco, contas contábeis, dois mapeamentos e planos contábeis coordenam escritas concorrentes por tenant. RPC de vínculo contábil passa a bloquear a Loja **antes** do plano para impedir inversão de ordem/deadlocks.
- Categorias novas ativas sem mapeamentos nos planos publicados atuais/futuros são rejeitadas com `23514`. Categorias inativas são admitidas para planejamento de sucessor. Novas contas financeiras são criadas **inativas** por padrão, auditadas corretamente; tentativa de ativá-las sem classificação patrimonial em todos os planos publicados aplicáveis é rejeitada. Triggers impedem inclusive gravações privilegiadas que ignorassem RPCs. UI ajustada e testes de erro `23514`; `scripts/verify_dev_treasury_catalog.sql` atualizado para novo contrato.
- Verificações executadas com transações SQL `ROLLBACK` A/B: `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS`, `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS`, `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS`, `DEV_TREASURY_CATALOG_ROLLBACK_PASS` e `DEV_TENANT_ACCOUNTING_GUARD_ROLLBACK_PASS`. Contagens persistidas: planos 6, publicados 4, template 91, categorias 8, contas financeiras 2, charges 17, payments 16.
- Tentativa de três consultas simultâneas pela API de execução SQL não demonstrou lock do mesmo tenant: falhou na asserção `same-tenant lock unexpectedly free`. O executor pareceu enfileirar consultas. **Concorrência entre conexões comprovadamente independentes: NOT EVALUATED.** Gate definido em `docs/engineering/ACCOUNTING_CONCURRENCY_TEST_PLAN.md`; não declarar PASS.
- CI do último commit: conferir GitHub Actions. HTTP com JWT real, sessões DB independentes, V35 visual desktop/mobile, escala e regras de vigência de novas categorias ainda pendentes. Nenhum deploy/merge de produção.

## Incremento 10 — publicação validada (2026-10-09)

- Branch `feat/v35-dev-gate-20261002`, PR #4, Supabase DEV migration 31 `20261009162535_validated_accounting_plan_publication`; fonte e hash no manifesto.
- Wrapper `publish_validated_accounting_plan` verifica `accounting.manage`, vigência esperada, retry idempotente e prontidão real sob locks na Loja/rascunho e nas tabelas contábeis. Publicação antiga continua apenas internamente, com EXECUTE autenticado revogado.
- Frontend `AccountingPrepublication` exige confirmação e motivo, reenvia payload inalterado em erro incerto e atualiza estado quando o servidor confirma UUID idêntico ao plano.
- SQL rollback A/B `DEV_VALIDATED_ACCOUNTING_PUBLICATION_ROLLBACK_PASS` cobre sucesso, bloqueios, imutabilidade, auditoria e ausência de alterações financeiras persistentes. CI da SHA final deve ser conferida antes de classificar.
- Risco: SHARE lock global em 5 tabelas bloqueia gravações de outros tenants durante publicação. Testar concorrência de conexões separadas e HTTP/JWT real antes de produção, além de verificar compatibilidade de clientes externos com RPC legada revogada.
- Próximo: validação multi-sessão, sucessão de categorias ativas pós-publicação e paridade visual V35 desktop/mobile. Nenhum merge/deploy em PROD.

## Incremento 9 — Pré-validação para publicação contábil (2026-10-09)

- Contexto: V35 Etapa 2; GitHub PR draft #4 branch `feat/v35-dev-gate-20261002`.
- DEV migration #30: `20261009041818_accounting_plan_prepublication_preview`, fonte/hashes no manifesto. RPC `preview_accounting_plan_publication` é somente leitura, `accounting.manage`, status draft/futuro, contagem de cobertura, incompatibilidades, ciclos e conflito com published.
- UI `AccountingPrepublication.tsx` e testes, integrada em `AccountingPlans` para rascunhos; apenas mostra razões de bloqueio e quantidades. Prontidão no preview **não** publica nem torna o plano ativo.
- SQL de integração A/B `DEV_ACCOUNTING_PREPUBLICATION_ROLLBACK_PASS` verificado; nenhuma mudança persistida nas fixtures e nenhuma alteração de ledger.
- CI dos arquivos frontend/consolidação: verificar no GitHub Actions pela SHA final antes de declarar PASS. HTTP/JWT real, concorrência simultânea de publicação e homologação visual/mobile não executados.
- Próximo passo crítico: definir comando transacional de publicação que reavalie o preview sob locks, com retry idempotente e prevenção de alterações pós-check; testar cenários concorrentes e evitar sobrescrever fatos históricos. Avaliar o endpoint legado `publish_accounting_plan` antes de liberar UI, preservando isolamento, publicações existentes e o HTML V35.
- Sem merge, deploy de produção ou pagamento de provedores.

## Incremento 8 — Plano de Contas: drafts e mappings (2026-10-08 Brasil)

- Branch `feat/v35-dev-gate-20261002`, PR draft #4, nova migration DEV29 `20261009014331_tenant_accounting_drafts_and_mappings`, fonte SHA256 no manifesto.
- Código: `src/lib/accounting-plans.ts`, `src/components/AccountingPlans.tsx`/`.test.tsx`, módulo conectado a `FinancialStructure` e CSS responsivo; wrapper idempotente para plano draft a partir de template (91 contas), duplicata da Loja ou branco; vinculação draft de categoria/conta financeira a conta analítica com natureza compatível.
- Preservação: plano publicado imutável, mapeamentos/valores históricos não alterados; nenhuma publicação automática, sem alteração de ledger, RLS ou grants de tabela.
- SQL DEV `DEV_ACCOUNTING_DRAFT_MAPPINGS_ROLLBACK_PASS` confirmado A/B, inclusive 91 contas/86 hierarquias; fixtures SQL revertidos. 6 planos DEV anteriores e template padrão preservados.
- CI validar revisão exata após commit. HTTPS/JWT real do novo recurso, concorrência entre sessões e homologação visual com HTML V35/mobile ainda não verificados.
- Próximo: revisão de códigos/estrutura V35, validação pré-publicação e sucessão sem sobreposição, regras de categoria neutra/repasse, operações financeiras e relatórios.
- Sem produção/merge/contratações.

## Incremento 7 — Identidade da Loja, 2026-10-08 Brasil

- DEV migrations 27/28 `20261009012944_tenant_identity_commands` e `20261009013042_tenant_settings_monotonic_version`, fontes e hashes no manifesto.
- Nova UI `TenantIdentity.tsx` inserida na tela Plano de Contas; cadastro e edição de contato, PIX, endereço e localização, sem fluxo de transferência.
- RPC de gravação única com `settings.manage` + idempotência + lock da Loja + revisão otimista e auditoria minimizada. Trigger corrigido somente para `organization_settings` por bug de `now()` em transações.
- SQL de DEV A/B, cenários positivos/negativos e ROLLBACK PASS; fixture não persistida. Os 17 títulos e 16 pagamentos financeiros anteriores seguem intactos.
- Verificar CI do commit final, HTTP/JWT real, concorrência entre conexões, mobile, HTML V35, demais parâmetros, plano contábil, logo e demais configurações ainda pendentes. Nada liberado em produção.

## Incremento 6 — contas/fundos/meios de pagamento (2026-10-08 Brasil)

- Branch: `feat/v35-dev-gate-20261002` no PR draft #4.
- Migrations DEV 25 e 26: `20261009011416_tenant_treasury_catalog_commands`, `20261009011533_treasury_catalog_scope_error_fix`. Fontes e hashes versionados.
- RPCs protegidas: criação/ativação/desativação de financial_accounts, funds e payment_methods, sem DELETE, sem novos grants ou RLS e sem operações financeiras; permission `settings.manage`/assinatura. Correção de checagem explícita `v_old is null` após EXECUTE INTO.
- Frontend: `TreasuryCatalogs.tsx` dentro de `FinancialStructure.tsx`; `treasury-catalogs.ts` carrega três catálogos com escopo explícito; testes de componente e CSS responsivo.
- Gate SQL reexecutado A/B (claims simuladas, ROLLBACK): `DEV_TREASURY_CATALOG_ROLLBACK_PASS`; resultados reais positivos/negativos e contagens financeiras preservadas.
- Validação CI do commit final: consultar GitHub Actions antes de classificar. E2E HTTP/JWT real, corrida simultânea, screenshot/mobile e paridade integral não avaliados.
- Próximo: identidade/parâmetros da Loja, plano contábil e mapeamentos, regras especiais e geração/baixas, mantendo escopo do HTML V35. Sem merge/prod/pagamento contratado.

## Retomada sem Work — 2026-10-08, Etapa 2 / incremento 5

- Base: `feat/v35-dev-gate-20261002`, PR draft #4; migração 24 aplicada somente DEV: `20261008211155_member_term_transition`.
- Implementação: transição atômica de termo mensal aberto, validação de competência futura, lock, idempotência, auditoria, autorização `settings.manage`, sem escrita direta nem alteração de ledger.
- UI: substituir ou encerrar condição individual/isenção na ficha do integrante, tratamento de conflito `40001` e atualização de histórico.
- Evidência: SQL DEV executado para A/B com testes positivos/negativos, exceções financeiras e `ROLLBACK`, `DEV_MEMBER_TERM_TRANSITION_ROLLBACK_PASS`. Integridade histórica e 24 migrations no manifesto.
- Não avaliado nesta verificação: HTTP/JWT real da nova RPC, concorrência de clientes simultâneos, preview visual desktop/mobile, paridade V35 integral. Não declarar produção pronta.
- Próximo incremento: contas financeiras, fundos, meios de pagamento, parâmetros e plano de contas, preservando piloto e ACLs. Nova UI precisa ser validada pela CI no commit efetivo.
- Sem merge, deploy de produção, novo provider ou custo pago.

# SESSION HANDOFF — 2026-10-03 UTC / 2026-10-02 Brasil

## Etapa 2 — catálogo mensal entregue, 2026-10-08

Implementado FinancialStructure em navegação Plano de Contas; cria categoria, regra mensal/preço inicial futuro e programa preço sucessor. MigrationCLI2.119.0 alinhada ao DEV20261008203643, total23no manifesto. Ver ADR0008 e docs/V35_STAGE_2_IMPLEMENTATION.md. Typecheck/45 testes/build PASS; placeholder público de build, sem publicação. SQL DEV_MONTHLY_RULE_CATALOG_ROLLBACK_PASS antes/depois DDL; teste final ampliado suspensão3RPCs PASS. Claims simuladas, sem credenciais/HTTPnovo. Pós-teste8categorias originais, regras/preços/termos0, doisADMIN e subscriptionsactive, flags originaisallow_recurrencefalse. Ledger não modificado. Advisors43/3/1. Nenhuma produção/custo/merge.
Próximo: sucessão/encerramento de termos individuais; catálogos de contas/fundos/meios, parâmetros Loja e plano/mapeamentos. Preservar natureza neutra/repasse e regras especiais do piloto; regras anuais/institucionais e geração/previsão não implementadas aqui. Consolidação HTTP real e paridade visual/mobile ainda pendentes. CI após push; preview não publicado por esta sessão.


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
Grau/cargo textual não substitui catálogo/cargo vigente. Mensalidade individual/isenção versionadas, criação de login, CPF, vínculos, cargos com vigência e paridade integral continuam pendentes; não concluir etapa2.

Migration gerada pela CLI2.119.0 e aplicada no DEV com versão20261008195936; fonte/hash no manifesto. Recuperação: forward-fix aditivo; se houver falha operacional, revogar EXECUTE da novaRPC e manter leituras/dados, sem apagar integrantes/ledger. Não aplicada produção.
DEV_MEMBER_PROFILE_COMMANDS_ROLLBACK_PASS antes e depois da aplicação: positivosA/B, retry, payload divergente, mass-assignment/date/name inválidos, estrangeiros, escrita direta, stale, VIEWER, suspensão e Master sem papeltenant. Claims simuladas/SQL, NÃO HTTP/JWT real novo. Zero integrantes temporários remanescentes; A/B ADMIN e assinaturasactive conferidos.
npm run check PASS: typecheck,36 testes frontend, build com chaveplaceholder; build não prova login/deploy. HTTP real novo, concorrência simultânea e homologação visual pendentes. CI do incremento de consulta880cc5a/run37834705645success; novaCI conferir após push.

Advisors pós-DDL:38 RPCs definer autenticadas (37 existentes + novaRPC intencional com require_permission),3 tabelas backend RLS sem policies e aviso preexistente de proteção contra senhas vazadas. Não declarar scanner zero nem modificar grants/RLS backend para remover avisos:
- [RPC autenticada definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabelas backend sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)


## Etapa 2 — primeiro incremento de consulta cadastral

Busca por nome/contato, quatro situações e ficha dos campos existentes implementadas; ver docs/V35_STAGE_2_IMPLEMENTATION.md. Typecheck/32 testes/build PASS; SQL A/B dos campos ampliados isolados PASS com claims simuladas. Sem writes/schema/grants. Cadastro/edição, cargos/termos com vigência, mensalidade/isenção e estrutura configurável continuam pendentes. Build placeholder não prova deploy; conferir CI após push e não declarar paridade/etapa2 concluída. CI do encerramento etapa1 0bb69d7: run37833762180success.

## Estado atual — 2026-10-08 Brasil

Etapa 1 CONCLUÍDA no DEV; etapa 2 EM EXECUÇÃO, começando pela conciliação de integrantes, parâmetros e estrutura financeira com o piloto V35. Evidência consolidada e limites: [V35_STAGE_1_CLOSURE_REPORT.md](docs/V35_STAGE_1_CLOSURE_REPORT.md).
Último HTTP: DEV FINAL AUTHORIZATION 09fcfa34-48ad-4c19-ac60-b2c173b2648b, PASS nas duas lojas; 28 views e oito negativas adicionais por recurso em cada loja. Estados finais e saldos conferidos administrativamente. CI do código f467d8e6: run 37720733935 success.
Produção/release comercial continuam bloqueados pelo escopo restante V35, homologação, recuperação e aprovação. Os registros datados abaixo são históricos; suas pendências da etapa 1 são superadas somente no escopo discriminado no relatório, sem converter cenários não avaliados em PASS.


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


## Correção do contrato AAL1 no teste Master — 2026-10-07, 23:11 Brasil

Primeira execução Master pelo proprietário interrompeu em AAL1 staff RLS: private rows exposed (1 != 0), antes de enrollment. Login/UUID/AAL1 e RPC privilegiada negada42501 já passaram pelas assertions anteriores. Inspeção da política real platform_staff_select_self_or_master confirmou SELECT user_id=auth.uid() OR private.is_platform_staff('MASTER'); helpers privilegiados exigem AAL2. A leitura do próprio vínculo em AAL1 é permitida pela política existente; a expectativa zero-row do teste estava errada. Corrigido test:master-mfa para consultar o escopo staff inteiro e exigir exatamente a própria linha MASTER ativa (UUID conferido), mantendo a negação42501 da RPC em AAL1 e a prova TOTP/AAL2/RPC/audit positiva posterior. Não alterar RLS/grants/helpers para satisfazer teste incorreto. 12 testes locais e sintaxe PASS; reexecução HTTP/MFA ainda pendente. Nenhum fator criado pela tentativa que falhou. Não classificar MFA como PASS.


## Compatibilidade do QR MFA corrigida — 2026-10-07, 23:15 Brasil

Proprietário apresentou 12 checks PASS e Master identidade/AAL1/comando privilegiado negado PASS. Enrollment iniciou, mas qrDataUrl rejeitou prefixo antes de SVG; desafio/verificação/AAL2 não executados. Consulta read-only de factor_type/status/count confirmou zero fatores remanescentes da conta dedicada após finally (não consultados QR, secret ou OTP). Fonte primária supabase/auth internal/api/mfa.go usa goqrsvg/SVGo; ajstarks/svgo svg.go define cabeçalho XML + comentário Generated by SVGo antes de <svg>. Validação anterior aceitava XML mas não comentário; corrigido helper para aceitar comentários XML completos antes da raiz SVG, mantendo rejeição de HTML, URLs remotas, DOCTYPE e comentários incompletos. Teste de regressão com cabeçalho sintético em SVG bruto, data URL bruto, percent-encoded e base64 PASS; 12 testes/sintaxe PASS. Nenhum QR real lido ou logado; nenhum grant/RLS/Auth alterado pelo agente. MFA real continua OPEN até proprietário executar novamente e apresentar TOTP/AAL2/RPC/audit PASS.


## MFA Master comprovado; expectativa de leitura da auditoria corrigida — 2026-10-07, 23:26 Brasil

Execução local do proprietário alcançou a consulta de auditoria após passar enrollment/challengeAndVerify real, currentLevel=aal2, getUser UUID conferido, vínculo MASTER ativo positivo, plano fixo price0 já active=true e RPC set_saas_plan_active retornando UUID esperado. Interrompeu por42501 permission denied for table saas_master_audit_logs; roteiro integral encerrou com FAIL e NÃO deve ser descrito como saída final PASS. Etapas anteriores comprovadas pelo ponto de falha, mais inventário administrativo factor_type=totp/status=verified. Nenhum secret/OTP/QR/token recebido pelo agente.

Inspeção de contrato: tabela saas_master_audit_logs RLS=true, sem policies e sem SELECT authenticated, backend-only. Não adicionar grant/policy para satisfazer expectativa errada. Consulta administrativa encontrou exatamente um evento saas_plan.reactivate/resource_type saas_plan/recurso7c71fda8-13b9-4bd4-999a-7df06937666d, actor71e27b4c-f0ba-46f7-832f-4faf29e8603d, reason DEV MASTER MFA fb5a5b74-00b4-45c8-9a6b-0565c2b69f56, previous_active=true e new_active=true. Evidência combinada: MFA/AAL1 negativo/AAL2 positivo/RPC e auditoria backend comprovados nesta execução; saída integral corrigida ainda não executada. Sem cobrança comercial ativada.

Roteiro corrigido exige42501 para leitura direta backend-audit e informa que operador precisa conferir evento único pela tag; não converte qualquer erro em PASS nem declara auditoria positiva via HTTP. 12 testes/sintaxe locais PASS. Não repetir cadastro TOTP: fator verificado permanece para próximas autenticações. Reexecução desnecessária desta operação comprovada; futura execução corrigida reutiliza fator. Support/Billing, suporte temporário/expiração/revogação e ciclo Auth permanecem OPEN, etapa1 em execução, etapa2 pendente.


## Gate staff live preparado — 2026-10-07, após MFA Master

Ver docs/DEV_STAFF_LIVE_GATE.md. Novo test:staff-live preparado: terceira identidade dedicada michael.c.carvalho+corsys-dev-staff@gmail.com, SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno, mesma sessão JWT em janela read_only A/negação B, expiração por datas passadas/reabertura/revogação, Billing positivo subscriptions e limites Support/Master, active=false, cleanup e logout global com refresh anterior negado por código Auth específico (rede não PASS). Não confundir revogação refresh com invalidação criptográfica instantânea do access JWT. Fatos são ticket/mensagem internos fictícios; nenhum pagamento/cobrança/provedor ativado.

Oito scripts bind/transição/cleanup guardados preservam último Master e contas tenant. Teste de todas transições em ROLLBACK passou DEV_STAFF_TRANSITIONS_ROLLBACK_PASS, usando B só dentro da transação com ADMIN removido/revertido. 12 testes/sintaxe locais PASS. Consulta posterior confirmou A/B ADMIN, único Master ativo, zero janelas suporte abertas e conta staff ainda inexistente. Nenhuma nova transição persistida, HTTP/TOTP desta conta NÃO executados. Proprietário precisa criar conta oficial, sem senha no chat; depois conferirUUID/bind e preencher .env privado. Em FAIL/cancelamento operador deve executar cleanup imediatamente. Stage1 continua aberta; nenhuma produção/custo/grant/schema/policy alterada. Conferir CI do pacote após push.


## Conta staff criada e janela preparada — 2026-10-07, 23:37 Brasil

Proprietário criou oficialmente michael.c.carvalho+corsys-dev-staff@gmail.com. Consulta Auth conferiu UUID0cb72963-9bef-4740-9f20-db4b9d54c74b e email_confirmed_at2026-10-08 02:36:51.497373+00. Executado bind_dev_dedicated_staff.sql guardado; retorno/consulta conferiu SUPPORT active=true e Master71e27b4c-f0ba-46f7-832f-4faf29e8603d ainda MASTER active=true. Nenhuma janela tenant criada; A/B admins preservados. HTTP/MFA novo PENDENTE do proprietário; credenciais não recebidas. CI pacote staff Foundation checks37718586263/run39 completed success. Proprietário deve baixar branch atualizada, preservar .env privado e preencher TEST_STAFF_USER_ID/password somente local; próximo comando test:staff-live. JANELA STAFF TEMPORÁRIO ABERTA: cleanup obrigatório via staff_dev_cleanup.sql em erro/cancelamento/conclusão, nunca remover Master. Ainda sem fator staff inscrito pelo agente. Etapa1 aberta, sem produção/custo/schema/grants.


## Staff live HTTP/MFA aprovado — 2026-10-07, 23:51 Brasil

Proprietário executou test:staff-live na cópia Windows (4), com saída final PASS apresentada. Tag DEV STAFF LIVE bf006725-2a14-4a7b-ba71-eee1178ed738. SUPPORT AAL1 negativo/TOTP real/AAL2 positivo ticket interno e mensagem, janela Aread_only/B oculto/20writes por loja negados, expiração por datas passadas, reabertura positiva, encerramento/revogação, Billing assinaturas positivas/limites financeiro-Support-Master, inactive e cleanup, logout global e refresh anterior rejeitado por código Auth/status esperado PASS. Mesmo JWT preservado durante as mudanças SQL; não equivale a invalidação criptográfica imediata do accessJWT em logout. Ticket fictício e TOTP verificado permanecem, credenciais não recebidas.

Agente aplicou sete transições guardadas entre WAITs. SQL final: A/B ADMIN próprios, tenant_links0, duas subscriptionsactive, somente Master dedicado active, zero janelas suporte abertas, auth.sessions staff0; fatores Master/staff TOTP verified. Janela temporária ENCERRADA, cleanupRequired=false. CI pacote37718586263success. Gates de perfis/MFA/staff/suporte/refresh concluídos no escopo executado. Revisão do critério histórico IDOR por recurso em cada RPC ainda identifica casos de configuração/aprovação e views financeiras/DRE a conferir; não encerrar etapa1 nem promover etapa2 antes de completar essa matriz. Autorização cross-org20RPCs não substitui own-org/foreign-resource-ID. Sem produção/custos/grants/schema alterados.


## Matriz final recursos/views preparada — 2026-10-07, após staff PASS

Ver docs/DEV_FINAL_AUTHORIZATION_GATE.md. Staff/MFA/expiração/revogação/refresh concluídos. Revisão mantém etapa1 aberta pela pendência explícita de IDs elegíveis estrangeiros com own organization e views diretas/DRE. Novo test:authorization-final preparado: oito negativas por loja para plano/source/policy/request/payable/receivable, 28views (dez com fatos próprios financeiros/DRE obrigatórios), positivos de duplicação própria/policy2030off/decisão manual/audit. Duas policies draft2030off e duas solicitações MANUAIS fictícias seedadas sobre payables DEV100; não altera valores originais/current policy nem afirma fluxo automático completo de aprovação. SQL verify_dev_final_authorization.sql passou com claims simuladas/ROLLBACK; 12 testes locais/sintaxe PASS. HTTP real do novo roteiro ainda PENDENTE. Preparar pacote dev-gate público sem .env real/node_modules/QR para owner; não repetir gates já aprovados. Após PASS revisar estado final e critérios antes de encerrar1/promover2. Sem produção/custos/Auth/grants/schema.
